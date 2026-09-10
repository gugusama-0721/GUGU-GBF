// GUGU-GBF 页面注入脚本
// 功能：监听页面发出的 XHR/fetch，尝试读取返回体；从 DOM 读取部分配置。
// 只读，不自动操作。

(function () {
  if (window.__guguGbfInjected) return;
  window.__guguGbfInjected = true;

  const INTERESTING = [
    "user", "party", "party_list", "battle_skill",
    "character_list", "weapon_list", "summon_list",
  ];

  // 拦截 fetch 响应体（探针，真实抓包后按字段打通）
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    return origFetch.apply(this, args).then((resp) => {
      try {
        const url = String(args[0] || "");
        if (INTERESTING.some((f) => url.includes(f))) {
          const clone = resp.clone();
          clone.json().then((data) => {
            sendPageData(url, data);
          }).catch(() => {});
        }
      } catch (e) {}
      return resp;
    });
  };

  function sendPageData(url, data) {
    chrome.runtime.sendMessage({
      type: "gbf_page_data",
      payload: { source: "xhr_fetch", url, data, time: Date.now() },
    });
  }

  // 从 DOM 读取玩家配置示例（真实抓包后可按需要读取对应字段）
  function readConfigFromDom() {
    // 占位实现：当前返回空，待对接真实页面结构
    return { characters: [], weapons: [], summons: [] };
  }

  // 暴露给 popup/background 的查询接口
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "gbf_read_config") {
      sendResponse(readConfigFromDom());
    }
  });
})();