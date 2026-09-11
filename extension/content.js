// GUGU-GBF 页面注入脚本（ISOLATED world）
// 职责：
// 1) 监听 hook.js（MAIN world）通过 window.postMessage 传来的游戏接口数据
// 2) 转发给 background 存储 / 供 popup 展示 / 备用给本机分析端
// 只读，不自动操作。
if (window.__guguGbfContentInjected) {
} else {
  window.__guguGbfContentInjected = true;

  const BRIDGE_EVENT_KEY = "gugu_gbf_bridge";
  const collected = { character: null, weapon: null, summon: null, deck: null };

  // 诊断信息
  let diagnostics = {
    contentInjected: true,
    hookInjected: false,
    time: Date.now(),
    url: "",
    isIframe: false,
    received: 0,
    lastKind: null,
  };
  try {
    diagnostics.url = window.location.href;
    diagnostics.isIframe = window.top !== window.self;
  } catch (e) {}

  function send(kind, url, data) {
    collected[kind] = data;
    diagnostics.received++;
    diagnostics.lastKind = kind;
    diagnostics.time = Date.now();
    try {
      chrome.storage.local.set({ gugu_gbf_diag: { ...diagnostics, url: window.location.href } });
    } catch (e) {}
    try {
      chrome.runtime.sendMessage(
        { type: "gbf_api_data", kind, url, data },
        () => chrome.runtime.lastError
      );
    } catch (e) {}
  }

  // 监听 MAIN world (hook.js) 发来的数据
  window.addEventListener("message", (event) => {
    const d = event && event.data;
    if (d && d.__gugu_gbf === true) {
      send(d.kind, d.url, d.data);
    }
  });

  // 供 popup 查询当前已收集数据（popup -> background -> 这里）
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "gbf_get_collected") {
      try {
        diagnostics.url = window.location.href;
      } catch (e) {}
      sendResponse({ collected, diagnostics });
    }
  });
}