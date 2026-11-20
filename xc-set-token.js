/**
 * 手动设置 token（generic 脚本，兜底方案）
 * 类型：generic
 *
 * 用法：在 Loon 里运行此脚本时通过 argument 传入 token，例如：
 *   argument = "eyJhbGciOi..."
 * 或者更简单：把下面 MANUAL_TOKEN 变量改成你的 token 后运行一次。
 *
 * token 获取方法：Safari 登录 xingchiapi.com -> 设置/控制台里复制用户的 access token，
 * 或让 xc-token-capture.js 自动抓包（推荐）。
 */

var MANUAL_TOKEN = "";   // 可在此直接粘贴 token，留空则用 argument

(function () {
  var tok = MANUAL_TOKEN;
  if (!tok && typeof $argument !== "undefined" && $argument) {
    tok = String($argument).trim();
  }
  tok = String(tok || "").replace(/^Bearer\s+/i, "").trim();

  if (!tok) {
    var cur = $persistentStore.read("xc_token");
    $notification.post("星驰API", "手动设置token",
      cur ? "当前已有 token：" + cur.slice(0, 12) + "…（未改动）" : "未提供 token，请在 argument 或脚本 MANUAL_TOKEN 中填入。");
    $done();
    return;
  }

  $persistentStore.write(tok, "xc_token");
  $notification.post("星驰API", "手动设置token", "已保存 token：" + tok.slice(0, 12) + "… 现在可以运行签到脚本了。");
  $done();
})();
