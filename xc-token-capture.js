/**
 * 星驰API token 自动捕获脚本 v2
 * 类型：http-request（需 MITM）
 *
 * 抓取登录后的 Authorization / Cookie / refresh_token，
 * 并把 token 与其来源 host 原子绑定保存，避免域名错配导致 500 Failed to load user。
 */

var TOKEN_KEY   = "xc_token";
var REFRESH_KEY = "xc_refresh_token";
var HOST_KEY    = "xc_host";
var COOKIE_KEY  = "xc_cookie";

function save(url, key, val) {
  if (!val) return;
  $persistentStore.write(String(val), key);
}

(function () {
  var req = $request;
  var url = req.url || "";
  var headers = req.headers || {};

  // 只在抓到 token 的这次请求里，把 host/token/cookie 一起落盘（原子绑定）
  var auth = headers.Authorization || headers.authorization || "";
  if (/^Bearer\s+/i.test(auth)) {
    var tok = auth.replace(/^Bearer\s+/i, "").trim();
    if (tok && tok.length > 20) {
      var m = url.match(/^(https?:\/\/[^\/]+)/);
      var host = m ? m[1] : "https://xingchiapi.com";
      var cookie = headers.Cookie || headers.cookie || "";
      var changed = tok !== $persistentStore.read(TOKEN_KEY);

      save(url, TOKEN_KEY, tok);
      save(url, HOST_KEY, host);            // token 与 host 绑定
      if (cookie) save(url, COOKIE_KEY, cookie);
      else $persistentStore.write("", COOKIE_KEY);

      console.log("[XC抓包] token已保存 from " + host + " cookie=" + (cookie ? "有" : "无"));
      if (changed) $notification.post("星驰API", "token 已捕获", "凭证已保存，可运行签到脚本。");
    }
  }

  // 抓 refresh_token（登录/刷新请求 body）
  var body = req.body || "";
  if (typeof body === "string" && body.length > 0) {
    try {
      var b = JSON.parse(body);
      if (b && b.refresh_token) save(url, REFRESH_KEY, b.refresh_token);
    } catch (e) {}
  }

  $done();
})();
