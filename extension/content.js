// GUGU-GBF content script（ISOLATED world）
// 机制（仿 Tarou）：
//   1) 向页面主世界注入 inject.js
//   2) inject.js 在主世界用 jQuery 的 $(document).ajaxSuccess 捕获 GBF 全部 ajax 请求
//   3) 数据通过 window.dispatchEvent(new CustomEvent(extensionId, ...)) 发回此处
//   4) 此处转 chrome.runtime.sendMessage 给 background 存 cache 展示
(() => {
  if (window.__guguGbfContentInjected) return;
  window.__guguGbfContentInjected = true;

  const EXT_ID = chrome.runtime.id;
  const collected = { character: null, weapon: null, summon: null, deck: null };

  let diagnostics = {
    contentInjected: true,
    url: "",
    isIframe: false,
    jquery: false,
    injectLoaded: null,
    received: 0,
    lastKind: null,
    time: Date.now(),
  };
  try {
    diagnostics.url = window.location.href;
    diagnostics.isIframe = window.top !== window.self;
    diagnostics.jquery = typeof window.jQuery === "function";
  } catch (e) {}

  function writeDiag() {
    try {
      const d = { ...diagnostics };
      delete d.hookDiag;
      chrome.storage.local.set({ gugu_gbf_diag: d });
    } catch (e) {}
  }

  function send(kind, url, data) {
    collected[kind] = { url, data, time: Date.now() };
    diagnostics.received++;
    diagnostics.lastKind = kind;
    diagnostics.time = Date.now();
    writeDiag();
    try {
      chrome.runtime.sendMessage({ type: "gbf_api_data", kind, url, data }, () => {
        void chrome.runtime.lastError;
      });
    } catch (e) {}
  }

  // 监听 inject.js（主世界）通过 CustomEvent 发来的请求数据
  window.addEventListener(EXT_ID + ":gbf:ajax", (event) => {
    try {
      const payload = event.detail; // { url, requestData, responseData }
      if (!payload || !payload.url) return;
      const data = payload.responseData;
      const kind = classify(payload.url, data);
      if (kind) send(kind, payload.url, data);
    } catch (e) {}
  });

  // ---------- 注入主世界脚本 inject.js ----------
  function bootstrapInject() {
    try {
      const s = document.createElement("script");
      s.async = true;
      s.src = chrome.runtime.getURL(`inject.js?extensionId=${EXT_ID}`);
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapInject, { once: true });
  } else {
    bootstrapInject();
  }
  // 注入后立即写一次初始化诊断，供侧边栏排查未注入/未截获
  writeDiag();

  // ---------- 响应 popup 查询 ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "gbf_get_collected") {
      try {
        diagnostics.url = window.location.href;
      } catch (e) {}
      writeDiag();
      sendResponse({ collected, diagnostics });
    }
  });

  // URL -> 类别检测
  function detectKind(url) {
    const u = String(url || "");
    if (/\/npc\/list\//.test(u)) return "character";
    if (/\/listall\/content\//.test(u)) return "weapon";
    if (/\/summon\/list\//.test(u)) return "summon";
    if (/\/party\/|\/deck\//.test(u)) return "deck";
    return null;
  }

  function classify(url, data) {
    if (!data) return null;
    // 队伍编成：含 deck 或 party 数据
    if (data.deck || data.party) return "deck";
    if (Array.isArray(data.list) || data.list) return detectKind(url);
    return detectKind(url);
  }
})();