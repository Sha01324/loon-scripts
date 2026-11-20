/**
 * 星驰API (xingchiapi.com) 每日签到脚本
 * 类型：cron 定时 / 也可被 http-request 触发
 * 依赖：$persistentStore 中 key "xc_token" 保存的 Bearer token
 *
 * token 来源有两种：
 *   1) xc-token-capture.js 自动抓包（用户用 Safari 登录 xingchiapi.com 时捕获）
 *   2) xc-set-token.js 手动粘贴 token
 *
 * 接口（已实测/逆向确认，2026-11-21）：
 *   GET  https://<host>/api/v1/user/checkin    -> {code,data:{enabled,claimed_today,amount,total_count,total_amount}}
 *   POST https://<host>/api/v1/user/checkin    -> 成功 {code:0,data:{status,amount}}
 *                                                 已签 code!=0, reason=CHECKIN_ALREADY_CLAIMED
 *   POST https://<host>/api/v1/auth/refresh    -> {code:0,data:{access_token,refresh_token,expires_in}}
 */

var TOKEN_KEY   = "xc_token";
var REFRESH_KEY = "xc_refresh_token";
var HOST_KEY    = "xc_host";
var COOKIE_KEY  = "xc_cookie";
var RESULT_KEY  = "xc_checkin_result";
var DEFAULT_HOST = "https://xingchiapi.com";

function log(s) {
  console.log("[XC签到] " + s);
}

function getHost() {
  var h = $persistentStore.read(HOST_KEY);
  return (h && h.length > 0) ? h.replace(/\/+$/, "") : DEFAULT_HOST;
}

function parseJSON(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

// 统一发出带鉴权的请求
function api(method, path, token, body, cb) {
  var headers = {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
  };
  // 前端 axios 用 withCredentials:true，真实请求带 Cookie；服务端可能依赖它识别用户
  var ck = $persistentStore.read(COOKIE_KEY);
  if (ck) headers["Cookie"] = ck;
  var params = {
    url: getHost() + path,
    headers: headers,
    timeout: 15000
  };
  if (method === "POST") params.body = body || "{}";
  $httpClient[method.toLowerCase()](params, function (err, resp, data) {
    if (err) { cb({ error: err }, null); return; }
    cb(null, { status: resp && resp.status, body: parseJSON(data), raw: data });
  });
}

// 用 refresh_token 换新 access_token
function refreshToken(oldRefresh, cb) {
  if (!oldRefresh) { cb(null); return; }
  $httpClient.post({
    url: getHost() + "/api/v1/auth/refresh",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: oldRefresh }),
    timeout: 15000
  }, function (err, resp, data) {
    if (err) { cb(null); return; }
    var j = parseJSON(data);
    if (j && j.code === 0 && j.data && j.data.access_token) {
      $persistentStore.write(j.data.access_token, TOKEN_KEY);
      if (j.data.refresh_token) $persistentStore.write(j.data.refresh_token, REFRESH_KEY);
      cb(j.data.access_token);
    } else {
      cb(null);
    }
  });
}

function notify(title, content) {
  try { $notification.post(title, "星驰API 每日签到", content); } catch (e) {}
}

function finish(msg) {
  log(msg);
  $persistentStore.write(new Date().toLocaleString() + " | " + msg, RESULT_KEY);
  notify("星驰API签到", msg);
  $done();
}

(function main() {
  var token = $persistentStore.read(TOKEN_KEY);
  if (!token) {
    finish("未找到 token，请先登录 xingchiapi.com 让脚本抓包，或用『手动设置token』脚本填入。");
    return;
  }

  // 第一步：查询当天签到状态
  api("GET", "/api/v1/user/checkin", token, null, function (e1, r1) {
    if (e1) { finish("网络错误：" + e1.error); return; }

    // token 过期 -> 尝试刷新后重试
    if (r1.status === 401) {
      log("token 过期，尝试 refresh_token 刷新…");
      refreshToken($persistentStore.read(REFRESH_KEY), function (newTok) {
        if (!newTok) { finish("token 已过期且刷新失败，请重新登录抓包或手动更新 token。"); return; }
        api("GET", "/api/v1/user/checkin", newTok, null, function (e2, r2) {
          if (e2) { finish("刷新后网络错误：" + e2.error); return; }
          if (r2.status === 401) { finish("刷新后仍 401，请重新登录抓包更新 token。"); return; }
          handleStatus(r2, newTok);
        });
      });
      return;
    }
    handleStatus(r1, token);
  });

  function handleStatus(r, tok) {
    var d = r.body && r.body.data;
    log("状态响应 HTTP " + r.status + " host=" + getHost() + " cookie=" + ($persistentStore.read(COOKIE_KEY) ? "有" : "无") + " -> " + String(r.raw).slice(0, 200));
    if (!r.body || typeof r.body.code === "undefined") {
      finish("状态查询返回异常：" + (r.raw || "空响应").slice(0, 120));
      return;
    }
    if (r.status && r.status >= 500) {
      finish("服务端错误(HTTP " + r.status + ")：" + (r.body && (r.body.message || r.body.error) || "load user 失败") + "。建议重新登录让脚本抓最新 token+Cookie，或检查 plugin 的 MITM 是否放行了该域名。");
      return;
    }
    if (r.body.code !== 0 && !d) {
      finish("状态查询失败：" + (r.body.message || r.body.reason || "未知错误"));
      return;
    }
    d = d || {};
    if (d.claimed_today === true) {
      finish("今日已签到，跳过。累计 " + (d.total_count || 0) + " 次 / " + (d.total_amount || 0));
      return;
    }
    if (d.enabled === false) {
      finish("本站未开启签到功能。");
      return;
    }

    // 第二步：执行签到
    api("POST", "/api/v1/user/checkin", tok, "{}", function (e3, r3) {
      if (e3) { finish("签到请求网络错误：" + e3.error); return; }
      log("签到响应 HTTP " + r3.status + " -> " + r3.raw);
      var j = r3.body || {};
      if (j.code === 0) {
        var amt = (j.data && j.data.amount) || (d.amount) || "?";
        finish("签到成功 +" + amt + " 额度 🎉");
      } else if (j.reason === "CHECKIN_ALREADY_CLAIMED" || j.code === "CHECKIN_ALREADY_CLAIMED") {
        finish("今日已签到（重复请求），跳过。");
      } else {
        finish("签到失败：" + (j.message || j.reason || "code=" + j.code));
      }
    });
  }
})();
