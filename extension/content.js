// GUGU-GBF 页面注入脚本
// 功能：拦截 GBF 的 XHR/fetch 响应体，识别三类配置接口（角色/武器/召唤），
//       转发给 background（再转本机 Python 分析端）。只读，不自动操作。
(function () {
  if (window.__guguGbfInjected) return;
  window.__guguGbfInjected = true;

  // 需要拦截返回体的接口前缀
  const API_PATTERNS = [
    { kind: "character", match: /\/npc\/list\// },
    { kind: "weapon", match: /\/listall\/content\// },
    { kind: "summon", match: /\/summon\/list\// },
    // 队伍编成接口：一次返回 角色+武器+召唤 的完整数据（含名称/属性/技能）
    { kind: "deck", match: /\/party\/(?:create|edit|list|detail|combination)\/|\/deck\/(?:editor|edit|detail)/ },
  ];

  function detectKind(url) {
    for (const p of API_PATTERNS) {
      if (p.match.test(url)) return p.kind;
    }
    return null;
  }

  // 判断返回 JSON 属于哪种类型：优先看结构（更鲁棒），再退到 URL
  function classify(url, data) {
    if (data && data.deck && data.deck.npc) return "deck";
    if (data && data.list) return detectKind(url);
    return null;
  }

  // 缓存已收集的数据（同 kind 覆盖，保留最新一页；分页由分析端聚合）
  const collected = { character: null, weapon: null, summon: null, deck: null };

  // 诊断信息：记录注入环境，便于排查为何未拦截到数据
  let diagnostics = {
    injected: true,
    time: Date.now(),
    url: "",
    isIframe: false,
    fetchHooked: true,
    xhrOverridden: true,
    frameCount: 0,
    hooks: { fetch: 0, xhr: 0 },
  };
  try {
    diagnostics.url = window.location.href;
    diagnostics.isIframe = window.top !== window.self;
  } catch (e) {}

  function bump() {
    // 每收到一条数据写一次诊断，记录最近一次拦截
    try {
      diagnostics.url = window.location.href;
      chrome.runtime.sendMessage({ type: "gbf_got_data", url: diagnostics.url });
    } catch (e) {}
  }

  function send(kind, url, data) {
    collected[kind] = data;
    diagnostics.time = Date.now();
    diagnostics.hooks.lastKind = kind;
    try {
      chrome.storage.local.set({ gugu_gbf_diag: { ...diagnostics, hooks: { ...diagnostics.hooks } } });
    } catch (e) {}
    try {
      chrome.runtime.sendMessage(
        { type: "gbf_api_data", kind, url, data },
        () => chrome.runtime.lastError // 分析端未开时的静默失败
      );
    } catch (e) {}
  }

  // ---------- 拦截 fetch ----------
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    return origFetch.apply(this, args).then((resp) => {
      try {
        const url = String(args[0] || "");
        const urlKind = detectKind(url);
        if (urlKind) {
          diagnostics.hooks.fetch++;
          const clone = resp.clone();
          clone
            .json()
            .then((data) => {
              const kind = classify(url, data);
              if (kind) send(kind, url, data);
            })
            .catch(() => {});
        }
      } catch (e) {}
      return resp;
    });
  };

  // ---------- 拦截 XMLHttpRequest ----------
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__guguUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        const url = this.__guguUrl || "";
        const urlKind = detectKind(url);
        if (urlKind) {
          diagnostics.hooks.xhr++;
          if (this.status === 200) {
            let data;
            try {
              data = JSON.parse(this.responseText);
            } catch (e) {
              return;
            }
            const kind = classify(url, data);
            if (kind) send(kind, url, data);
          }
        }
      } catch (e) {}
    });
    return origSend.apply(this, args);
  };

  // ---------- 供 popup 查询当前已收集数据 ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "gbf_get_collected") {
      sendResponse({ collected });
    }
  });
})();