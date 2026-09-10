// GUGU-GBF 后台服务（MV3 Service Worker）
// 只能读、不自动操作。捕获 GBF 网络请求，转发到本机 Python 分析端。

// 本机 Python 分析端地址（后续可配置）
const ANALYZER_URL = "http://127.0.0.1:8765";

// 相关兴趣的请求路径片断（真实抓包后需补充）
const INTERESTING_FRAGMENTS = [
  "user", "party", "team", "party_list",
  "battle", "battle_start", "battle_skill", "battle_action",
  "relics", "character_list", "weapon_list", "summon_list",
  "raid", "quest",
];

// 监听网络请求（只捕获，不拦截、不改写）
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const url = details.url;
    if (!INTERESTING_FRAGMENTS.some((f) => url.includes(f))) return;

    console.log("[GUGU-GBF] 捕获请求:", url, "method:", details.method);
    // TODO: 拿到响应体需 content script 配合，这里先记录 URL/方法/状态
    const payload = {
      type: "web_request",
      url,
      method: details.method,
      statusCode: details.statusCode,
      tabId: details.tabId,
      time: Date.now(),
    };
    forwardToAnalyzer(payload);
  },
  // 只监听 https 的 gbf 域
  { urls: ["https://game.granbluefantasy.jp/*", "https://gbf.game.mbga.jp/*"] }
);

// 接收 content script 发来的页面数据
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "gbf_page_data") {
    forwardToAnalyzer(message.payload);
    sendResponse({ ok: true });
  }
  // 战斗状态半自动录入
  if (message && message.type === "gbf_battle_state") {
    forwardToAnalyzer(message.payload);
    sendResponse({ ok: true });
  }
});

async function forwardToAnalyzer(payload) {
  try {
    await fetch(ANALYZER_URL + "/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // 分析端未启动时忽略，不打断游戏
    console.warn("[GUGU-GBF] 分析端未连接:", e.message);
  }
}