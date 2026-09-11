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

// 点击工具栏图标直接打开侧边栏（复刻 Tarou 行为）
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel
    .open({ tabId: tab.id })
    .catch(() => chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {}));
});
// 启动时也设置一次
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ================= debugger/CDP 捕获 HTTP 响应体 =================
// 复刻 Tarou 的核心机制：用 chrome.debugger + CDP 直接从协议层读响应体，
// 完全绕开 CSP / 页面注入时序问题。角色/武器/召唤配置数据走 HTTP，可在此捕获。
let debugTabId = null;

// 目标接口 -> kind 映射（基于抓包实证的接口路径）
function kindForUrl(u) {
  if (!u) return null;
  if (/deckcombination|deck_combination_list|\/party\//.test(u)) return "deck";
  if (/\/npc\/list\//.test(u)) return "character";
  if (/\/listall\/content\//.test(u)) return "weapon";
  if (/\/summon\/list\//.test(u)) return "summon";
  return null;
}

async function attachDebug(tabId) {
  debugTabId = tabId;
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    await chrome.debugger.sendCommand({ tabId }, "Network.enable", {
      maxTotalBufferSize: 10000000,
      maxResourceBufferSize: 10000000,
    });
    console.log("[GUGU-GBF] debugger 已附加", tabId);
    writeDbgStatus("attached", tabId, "debugger 已附加到标签页");
  } catch (e) {
    console.warn("[GUGU-GBF] debugger attach 失败:", e.message);
    writeDbgStatus("attach-fail", tabId, e.message);
  }
}
function writeDbgStatus(state, tabId, detail) {
  try {
    chrome.storage.local.set({
      gugu_gbf_dbg: { state, tabId, detail, captured: dbgCount, time: Date.now() },
    });
  } catch (e) {}
}
let dbgCount = 0;
let recentRequestUrls = [];

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!params || source.tabId !== debugTabId) return;
  if (method === "Network.responseReceived") {
    const { requestId, response, type } = params;
    // 记录最近若干请求 URL，供诊断查看（不匹配 kind 也记录，便于确认该匹配哪条接口）
    recentRequestUrls.push({ url: response && response.url, type, t: Date.now() });
    if (recentRequestUrls.length > 12) recentRequestUrls.shift();
    try { chrome.storage.local.set({ gugu_gbf_recent: recentRequestUrls.slice() }); } catch (e) {}
    const kind = kindForUrl(response && response.url);
    if (kind && (type === "XHR" || type === "Fetch")) {
      pendingFetch[kind] = requestId;
    }
  } else if (method === "Network.loadingFinished") {
    const { requestId, encodedDataLength } = params;
    // 从 pendingFetch 找到 kind
    for (const kind of Object.keys(pendingFetch)) {
      if (pendingFetch[kind] === requestId) {
        getBody(kind, requestId);
        delete pendingFetch[kind];
        break;
      }
    }
  }
});

const pendingFetch = {};
async function getBody(kind, requestId) {
  try {
    const res = await chrome.debugger.sendCommand({ tabId: debugTabId }, "Network.getResponseBody", { requestId });
    let data;
    try {
      data = JSON.parse(res.body);
    } catch (e) {
      try { chrome.storage.local.set({ gugu_gbf_dbg: { state: "attached", detail: "getBody 非JSON body(" + kind + ")", captured: dbgCount, time: Date.now() } }); } catch (x) {}
      return;
    }
    saveKind(kind, "cdp:" + kind, data);
    forwardToAnalyzer({ kind, url: "cdp:" + kind, data });
    dbgCount++;
    try {
      chrome.storage.local.get("gugu_gbf_dbg", (o) => {
        const d = (o && o.gugu_gbf_dbg) || {};
        chrome.storage.local.set({ gugu_gbf_dbg: { ...d, captured: dbgCount, lastKind: kind, time: Date.now() } });
      });
    } catch (e) {}
  } catch (e) {
    // 响应体已释放或不可读，记录状态供诊断
    try { chrome.storage.local.set({ gugu_gbf_dbg: { state: "attached", detail: "getBody 失败(" + kind + "):" + e.message, captured: dbgCount, time: Date.now() } }); } catch (x) {}
  }
}

// 当用户打开 GBF 标签页时自动附加 debugger；关闭时分离
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && /game\.granbluefantasy\.jp|gbf\.game\.mbga\.jp/.test(tab.url)) {
    // 只附加已存在的 debugger，避免重复
    chrome.debugger.getTargets().then((targets) => {
      const already = targets.some((t) => t.tabId === tabId && t.attached);
      if (!already) attachDebug(tabId);
    });
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === debugTabId) {
    debugTabId = null;
    try { chrome.debugger.detach({ tabId }, () => {}); } catch (e) {}
  }
});

// 扩展启动时附加到已打开的 GBF 标签页
chrome.tabs.query({ url: ["https://game.granbluefantasy.jp/*", "https://gbf.game.mbga.jp/*"] }, (tabs) => {
  if (tabs && tabs.length && !debugTabId) attachDebug(tabs[0].id);
});