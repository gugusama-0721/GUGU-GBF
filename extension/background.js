// GUGU-GBF 后台服务（MV3 Service Worker）
// 聚合 content script 拦截到的三类配置数据，供 popup 展示并同步本机 Python 分析端。
// 只读，不自动操作。

const ANALYZER_URL = "http://127.0.0.1:8765";
const STORE_KEY = "gugu_gbf_data";

// 存储内容：
// { character: {url, data, time} | null, weapon: {...}, summon: {...} }
let cache = {
  character: null,
  weapon: null,
  summon: null,
  deck: null,
};

// 恢复缓存
chrome.storage.local.get(STORE_KEY, (obj) => {
  if (obj && obj[STORE_KEY]) cache = obj[STORE_KEY];
});

function persist() {
  chrome.storage.local.set({ [STORE_KEY]: cache });
}

// 接收 content script 拦截到的真实接口数据
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 三类配置接口数据
  if (message && message.type === "gbf_api_data" && message.kind) {
    saveKind(message.kind, message.url, message.data);
    forwardToAnalyzer({ kind: message.kind, url: message.url, data: message.data });
    sendResponse({ ok: true });
    return;
  }
  // 为扩展界面提供汇总数据
  if (message && message.type === "gbf_get_collected") {
    sendResponse({ cache });
    return;
  }
});

function saveKind(kind, url, data) {
  cache[kind] = { url, data, time: Date.now() };
  persist();
}

// 转发到本机 Python 分析端（不存在则忽略，不拖慢游戏）
async function forwardToAnalyzer(payload) {
  try {
    await fetch(ANALYZER_URL + "/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[GUGU-GBF] 分析端未连接:", e.message);
  }
}

// 保留 webRequest 监听作为 URL 日志（可选，用于观察有哪些接口在活跃请求）
chrome.webRequest.onCompleted.addListener(
  (details) => {
    // 仅记录，不做响应体解析（响应体由 content script 处理）
  },
  { urls: ["https://game.granbluefantasy.jp/*", "https://gbf.game.mbga.jp/*"] }
);

// ---------- 以 MAIN world 注入 hook.js ----------
// content script 默认在 ISOLATED world，hook 不到游戏主世界的 fetch/XHR。
// 用 chrome.scripting 以 world:"MAIN" 注入，才能真正拦截游戏请求。
async function injectMainWorld(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      files: ["hook.js"],
    });
    return results;
  } catch (e) {
    console.warn("[GUGU-GBF] MAIN注入失败:", e.message);
    return null;
  }
}

// 监听新标签页/已完成导航，自动注入（并在页面刷新/跳转后再次注入）
chrome.webNavigation?.onCommitted.addListener((details) => {
  if (
    details.frameType === "outermost_frame" &&
    /game\.granbluefantasy\.jp|gbf\.game\.mbga\.jp/.test(details.url)
  ) {
    injectMainWorld(details.tabId);
  }
});

// 扩展启动时，给已打开的 GBF 标签页注入
chrome.tabs.query({ url: ["https://game.granbluefantasy.jp/*", "https://gbf.game.mbga.jp/*"] }, (tabs) => {
  (tabs || []).forEach((t) => injectMainWorld(t.id));
});