// GUGU-GBF 主世界注入脚本（在页面主世界运行）
// 仿 Tarou 机制：GBF 使用 jQuery 发 ajax，这里挂 $(document).ajaxSuccess
// 捕获到请求的 URL + 请求参数 + 返回体，通过自定义事件发回 content script。
(function () {
  if (window.__guguGbfInjectLoaded) return;
  window.__guguGbfInjectLoaded = true;

  const script = document.currentScript;
  const extId =
    script && script.src
      ? new URLSearchParams(script.src.split("?")[1]).get("extensionId")
      : null;
  if (!extId) return;

  const EVENT_NAME = extId + ":gbf:ajax";
  const STATE_EVENT = extId + ":gbf:state";

  // 加载成功即回报（供 content.js 确认主世界 inject 已执行）
  let report = () => {};
  try {
    document.dispatchEvent(
      new CustomEvent(STATE_EVENT, { detail: { state: "loaded", t: Date.now(), jq: typeof window.jQuery === "function" } })
    );
    report = () => {};
  } catch (e) {}

  function tryHook() {
    if (typeof jQuery === "undefined" && typeof $ === "undefined") return false;

    jQuery(document).ajaxSuccess((event, xhr, settings, responseData) => {
      try {
        const url =
          (settings && typeof settings.url === "string") ? settings.url : "";
        document.dispatchEvent(
          new CustomEvent(EVENT_NAME, {
            detail: {
              url,
              requestData: settings && settings.data,
              responseData,
            },
          })
        );
      } catch (e) {}
    });
    return true;
  }

  // 轮询等待 jQuery 就绪后挂事件（最多约 30 秒）
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (tryHook()) {
      clearInterval(timer);
      try {
        document.dispatchEvent(
          new CustomEvent(STATE_EVENT, { detail: { state: "hooked", t: Date.now() } })
        );
      } catch (e) {}
    } else if (tries > 300) {
      clearInterval(timer);
      try {
        document.dispatchEvent(
          new CustomEvent(STATE_EVENT, { detail: { state: "no-jquery", t: Date.now() } })
        );
      } catch (e) {}
    }
  }, 100);

  // 万一 jQuery 已经就绪，立即试一次
  if (tryHook()) {
    try {
      document.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: { state: "hooked", t: Date.now() } }));
    } catch (e) {}
  }
})();