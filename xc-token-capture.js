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

      console.log("[XC抓包] token已保存 from " + host + " cookie=" + (cookie ? "有" : "无") + " changed=" + changed);
      // 每次抓到都弹通知，明确区分「新token」与「复用老token」。
      // 进一次网站会触发十几个 /api/v1/* 请求，复用通知做 60s 节流防刷屏；
      // 新 token 属重要事件，不节流、每次都弹。
      var tip = changed
        ? "检测到新 token，已覆盖保存（来自 " + host + "）。"
        : "进网站抓到 token，与已保存的一致（复用），签到脚本正常工作。";
      var title = changed ? "token 已捕获" : "token 已确认(复用)";
      var now = Date.now();
      var last = parseInt($persistentStore.read("xc_last_notify_ts") || "0", 10) || 0;
      if (changed || (now - last) > 60000) {
        $notification.post(title, "星驰API签到", tip);
        $persistentStore.write(String(now), "xc_last_notify_ts");
      } else {
        console.log("[XC抓包] 复用通知节流跳过，距上次 " + (now - last) + "ms");
      }
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

  // 关键：http-request 中 $done({}) 表示放行请求（原样继续）。
  // 切勿写 $done() 无参数，否则会丢弃该请求导致网页白屏无数据。
  $done({});
})();
