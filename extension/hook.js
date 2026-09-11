// GUGU-GBF MAIN-world 注入脚本（运行在游戏同世界）
// 通过 chrome.scripting 以 world:"MAIN" 注入，才能真正 hook 到游戏主世界的 fetch/XHR。
// 捕获到数据后经 window.postMessage 交给隔离世界的 content.js 转发给 background。
(function () {
  if (window.__guguGbfHookInjected) return;
  window.__guguGbfHookInjected = true;

  const BRIDGE_EVENT = "gugu_gbf_bridge";
  const API_PATTERNS = [
    { kind: "character", match: /\/npc\/list\// },
    { kind: "weapon", match: /\/listall\/content\// },
    { kind: "summon", match: /\/summon\/list\// },
    { kind: "deck", match: /\/party\/(?:create|edit|list|detail|combination)\/|\/deck\/(?:editor|edit|detail)/ },
  ];

  function detectKind(url) {
    for (const p of API_PATTERNS) {
      if (p.match.test(url)) return p.kind;
    }
    return null;
  }

  function classify(url, data) {
    if (data && data.deck && data.deck.npc) return "deck";
    if (data && data.list) return detectKind(url);
    return null;
  }

  function emit(kind, url, data) {
    try {
      window.postMessage(
        { __gugu_gbf: true, kind, url, data },
        "*"
      );
    } catch (e) {}
  }

  // ---------- 拦截 fetch ----------
  const F = window.fetch;
  if (typeof F === "function" && !window.__guguGbfOrigFetch) {
    window.__guguGbfOrigFetch = F;
    window.fetch = function (...args) {
      const url = String(args[0] || "");
      const urlKind = detectKind(url);
      if (urlKind) {
        return F.apply(this, args).then((resp) => {
          try {
            const clone = resp.clone();
            clone
              .json()
              .then((data) => {
                const kind = classify(url, data);
                if (kind) emit(kind, url, data);
              })
              .catch(() => {});
          } catch (e) {}
          return resp;
        });
      }
      return F.apply(this, args);
    };
  }

  // ---------- 拦截 XMLHttpRequest ----------
  const O = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__guguUrl = url;
    return O.call(this, method, url, ...rest);
  };
  const S = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        const url = this.__guguUrl || "";
        const urlKind = detectKind(url);
        if (urlKind && this.status === 200) {
          let data;
          try {
            data = JSON.parse(this.responseText);
          } catch (e) {
            return;
          }
          const kind = classify(url, data);
          if (kind) emit(kind, url, data);
        }
      } catch (e) {}
    });
    return S.apply(this, args);
  };
})();