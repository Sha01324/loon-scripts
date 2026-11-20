/**
 * 星驰API token 自动捕获脚本
 * 类型：http-request（需 MITM）
 *
 * 作用：当用户用浏览器/Safari 登录并访问 xingchiapi.com 的 /api/v1/* 接口时，
 *       抓取请求头里的 Authorization: Bearer xxx，存入 $persistentStore，
 *       供 xc-checkin.js 定时签到使用。
 *
 * 匹配 URL（写在 plugin 的 pattern 里）：
 *   ^https?://(api\.)?xingchiapi\.com/api/v1/.*
 *
 * 注意：此脚本不修改请求，随后 $done() 放行。
 */

var TOKEN_KEY   = "xc_token";
var REFRESH_KEY = "xc_refresh_token";
var HOST_KEY    = "xc_host";

function saveHost(url) {
  try {
    var m = url.match(/^(https?:\/\/[^\/]+)/);
    if (m) $persistentStore.write(m[1], HOST_KEY);
  } catch (e) {}
}

(function () {
  var req = $request;
  var url = req.url || "";
  var headers = req.headers || {};

  // 记录当前实际使用的 API 域名（signin 站点可能是 xingchiapi.com 或 api.xingchiapi.com）
  saveHost(url);

  // 抓 Authorization: Bearer <token>
  var auth = headers.Authorization || headers.authorization || "";
  var gotToken = false;
  if (/^Bearer\s+/i.test(auth)) {
    var tok = auth.replace(/^Bearer\s+/i, "").trim();
    if (tok && tok.length > 20 && tok !== $persistentStore.read(TOKEN_KEY)) {
      $persistentStore.write(tok, TOKEN_KEY);
      console.log("[XC抓包] 已捕获并保存 Bearer token (" + tok.length + " 字符) from " + url);
      $notification.post("星驰API", "token 已捕获", "已自动保存登录凭证，签到脚本现在可以工作了。");
      gotToken = true;
    }
  }

  // 顺带抓 refresh_token：登录/刷新请求的 body 里可能出现
  var body = req.body || "";
  if (typeof body === "string" && body.length > 0) {
    try {
      var b = JSON.parse(body);
      if (b && b.refresh_token && b.refresh_token !== $persistentStore.read(REFRESH_KEY)) {
        $persistentStore.write(b.refresh_token, REFRESH_KEY);
        console.log("[XC抓包] 已捕获 refresh_token");
      }
    } catch (e) {}
  }

  // 放行请求，不做任何改动
  $done();
})();
