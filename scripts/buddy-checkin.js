/**
 * Buddy 加油站 · WorkBuddy 每日签到（Loon 定时脚本）
 * ------------------------------------------------------------------
 * 运行方式：Loon [Script] 中的 cron 定时任务，或 generic 手动触发
 * 依赖：无（只用 Loon 内置 API，不需要 MITM / 证书）
 *
 * 需要填的只有下面 token 和 uid 两个值，获取方法见使用说明：
 *   桌面客户端登录态文件里的 auth.accessToken 和 account.uid
 *
 * 也可以不改脚本，改用 Loon 脚本的「参数」传入：
 *   argument="token=xxxxx&uid=12345"
 * 或 JSON：argument={"token":"xxxxx","uid":"12345"}
 * ------------------------------------------------------------------
 */
(function () {
  "use strict";

  /* ======================= 1. 配置区（改这里） ======================= */

  var CONFIG = {
    domain: "www.codebuddy.cn", // 接口域名，一般不用改
    token: "",                  // ← 粘贴 accessToken
    uid: "",                    // ← 粘贴 uid
    notifyWhenDone: true        // 今天已领过时，是否也发一条通知
  };

  /* ================================================================= */

  var EP_STATUS = "/v2/billing/meter/checkin-activity-status";
  var EP_CHECKIN = "/v2/billing/meter/daily-checkin";
  var KEY_TOKEN = "buddy_access_token";
  var KEY_UID = "buddy_uid";
  var TITLE = "Buddy加油站";

  /* ---------------------------- 工具函数 ---------------------------- */

  function log(v) {
    try { console.log(typeof v === "string" ? v : JSON.stringify(v)); } catch (e) {}
  }

  function readStore(key) {
    try {
      var v = $persistentStore.read(key);
      return v ? String(v) : "";
    } catch (e) {
      return "";
    }
  }

  function parseKV(s) {
    var out = {};
    String(s).split("&").forEach(function (pair) {
      var i = pair.indexOf("=");
      if (i <= 0) return;
      var k = pair.slice(0, i).trim();
      var v = pair.slice(i + 1).trim();
      try { v = decodeURIComponent(v); } catch (e) {}
      if (k) out[k] = v;
    });
    return out;
  }

  function loadConfig() {
    var c = {
      domain: CONFIG.domain || "www.codebuddy.cn",
      token: CONFIG.token || "",
      uid: CONFIG.uid || "",
      notifyWhenDone: CONFIG.notifyWhenDone !== false
    };

    // 持久化存储（可覆盖脚本里的常量，适合想隐藏 token 的人）
    var st = readStore(KEY_TOKEN);
    var su = readStore(KEY_UID);
    if (st) c.token = st;
    if (su) c.uid = su;

    // 脚本参数（优先级最高）
    var arg = typeof $argument === "undefined" ? null : $argument;
    if (arg) {
      var a = arg;
      if (typeof a === "string") {
        a = a.trim();
        if (a.charAt(0) === "{") {
          try { a = JSON.parse(a); } catch (e) { a = parseKV(a); }
        } else if (a) {
          a = parseKV(a);
        } else {
          a = null;
        }
      }
      if (a && typeof a === "object") {
        if (a.token) c.token = String(a.token).trim();
        if (a.uid) c.uid = String(a.uid).trim();
        if (a.domain) c.domain = String(a.domain).trim();
      }
    }
    return c;
  }

  /**
   * 在任意嵌套结构里按 key 名找值。
   * depth 限制防止异常返回体导致深递归（最大 8 层）。
   */
  function pick(obj, keys, depth) {
    if (!obj) return null;
    depth = depth || 0;
    if (depth > 8) return null;

    var i, r;
    if (Array.isArray(obj)) {
      for (i = 0; i < obj.length; i++) {
        r = pick(obj[i], keys, depth + 1);
        if (r !== null && r !== "") return r;
      }
      return null;
    }
    if (typeof obj === "object") {
      for (i = 0; i < keys.length; i++) {
        var v = obj[keys[i]];
        if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) return v;
      }
      for (i in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
        r = pick(obj[i], keys, depth + 1);
        if (r !== null && r !== "") return r;
      }
    }
    return null;
  }

  /** 宽松布尔：兼容 true / 1 / "true" / "1" 等形态 */
  function boolish(v) {
    return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";
  }

  function num(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  }

  function text(v, dft) {
    return v === null || v === undefined || v === "" ? dft : v;
  }

  function describe(payload) {
    var data = payload && typeof payload.data === "object" && payload.data ? payload.data : (payload || {});
    return {
      code: payload && payload.code !== undefined ? payload.code : null,
      msg: String(pick(payload, ["msg", "message", "errMsg"]) || ""),
      checked: boolish(pick(data, ["today_checked_in", "todayCheckedIn"])),
      today: num(pick(data, ["today_credit", "todayCredit"])),
      streak: num(pick(data, ["streak_days", "streakDays"])),
      total: num(pick(data, ["total_credits", "totalCredits"])),
      streakDay: boolish(pick(data, ["is_streak_day", "isStreakDay"])),
      activity: pick(data, ["activity_name", "activityName"]) || TITLE
    };
  }

  function codeIs(payload, list) {
    if (!payload) return false;
    for (var i = 0; i < list.length; i++) {
      if (payload.code === list[i] || String(payload.code) === String(list[i])) return true;
    }
    return false;
  }

  function summary(info) {
    var s = [];
    if (info.streak !== null) s.push("连续 " + info.streak + " 天");
    if (info.total !== null) s.push("累计 " + info.total + " 积分");
    return s.length ? s.join(" · ") : "已领取";
  }

  function notify(sub, body) {
    log(sub + " | " + body);
    try {
      $notification.post(TITLE, sub, body);
    } catch (e) {
      log("通知发送失败: " + e);
    }
  }

  function finish(sub, body) {
    notify(sub, body);
    $done();
  }

  /* ---------------------------- 网络请求 ---------------------------- */

  function api(cfg, path, cb) {
    $httpClient.post(
      {
        url: "https://" + cfg.domain + path,
        timeout: 15000,
        headers: {
          "Authorization": "Bearer " + cfg.token,
          "X-User-Id": cfg.uid,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "WorkBuddy-Loon-Checkin/1.0"
        },
        body: "{}"
      },
      function (err, resp, data) {
        var json = null;
        if (data && typeof data === "string") {
          try { json = JSON.parse(data); } catch (e) { json = null; }
        }
        cb(err || null, resp ? resp.status : 0, json, typeof data === "string" ? data : "");
      }
    );
  }

  function brief(status, raw) {
    var tail = "";
    if (raw) tail = " · " + raw.replace(/\s+/g, " ").slice(0, 100);
    return "HTTP " + status + tail;
  }

  var MSG_EXPIRED = "登录态已过期，请重新从桌面客户端复制 accessToken 更新脚本";

  /* ---------------------------- 主流程 ---------------------------- */

  function run() {
    var cfg = loadConfig();

    if (!cfg.token || !cfg.uid) {
      finish("✗ 还没配置登录信息", "请在脚本开头填写 token / uid，或用 argument 传入（见使用说明）");
      return;
    }

    log("查询签到状态…");
    api(cfg, EP_STATUS, function (err, status, json, raw) {
      if (err) { finish("✗ 网络请求失败", String(err)); return; }
      if (status === 401 || codeIs(json, [401, 10002])) { finish("✗ " + MSG_EXPIRED, "更新 token 后即可恢复"); return; }
      if (status >= 400 || !json) { finish("✗ 查询失败", brief(status, raw)); return; }

      var info = describe(json);

      if (info.checked) {
        log("今天已领取，跳过");
        if (cfg.notifyWhenDone) finish("今天已领取", summary(info));
        else $done();
        return;
      }

      log("今天未领取，开始签到…");
      api(cfg, EP_CHECKIN, function (err2, status2, ck, raw2) {
        if (err2) { finish("✗ 签到请求失败", String(err2)); return; }
        if (status2 === 401 || codeIs(ck, [401, 10002])) { finish("✗ " + MSG_EXPIRED, "更新 token 后即可恢复"); return; }

        var ci = describe(ck);

        // 幂等：服务端对重复签到返回 code=10001「今天已签到」
        if (ci.code === 10001 || ((!ck || !ck.data) && /已签到/.test(ci.msg))) {
          finish("今天已领取", summary(ci.streak !== null || ci.total !== null ? ci : info));
          return;
        }

        var ok = status2 >= 200 && status2 < 300 && ck &&
          (ci.code === 0 || ci.code === "0" || ci.code === null || ci.code === undefined);

        if (!ok) {
          finish("✗ 签到失败", brief(status2, ci.msg || raw2));
          return;
        }

        var gained = ci.today !== null ? ci.today : info.today;

        // 二次核对：拿最新的累计积分和连续天数（服务端可能延迟，未刷新则退回签到接口的值）
        api(cfg, EP_STATUS, function (err3, status3, j3) {
          var i3 = describe(j3);
          var fresh = i3.checked;

          var streak = fresh && i3.streak !== null ? i3.streak
            : (ci.streak !== null ? ci.streak : info.streak);
          var total = fresh && i3.total !== null ? i3.total
            : (ci.total !== null ? ci.total : info.total);
          var bonus = ci.streakDay || i3.streakDay || streak === 7;

          var head = "✓ 签到成功 +" + text(gained, "?") + " 积分";
          var tail = [];
          if (streak !== null) tail.push("连续 " + streak + " 天");
          if (total !== null) tail.push("累计 " + total + " 积分");
          if (bonus) tail.push("本周满 7 天，1000 分奖励已到手");

          finish(head, tail.length ? tail.join(" · ") : "已入账");
        });
      });
    });
  }

  try {
    run();
  } catch (e) {
    finish("✗ 脚本异常", String(e));
  }
})();
