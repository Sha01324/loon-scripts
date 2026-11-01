/**
 * Buddy 加油站 · 登录态自动抓取（Loon MITM 请求脚本）
 * ------------------------------------------------------------------
 * 原理：WorkBuddy 客户端每次请求 *.codebuddy.cn 都会带
 *       Authorization: Bearer <accessToken>  和  X-User-Id: <uid>
 *       本脚本在请求发出前把这两个值存进 Loon 持久化存储，
 *       签到脚本（buddy-checkin.js）会自动读取，无需手工粘贴。
 *
 * 触发方式（Loon [Script]）：
 *   http-request ^https?:\/\/(www\.)?codebuddy\.cn\/ script-path=buddy-capture.js,tag=Buddy抓取登录态,enable=true
 *
 * 需要配合：
 *   1) [MITM] 里加 hostname = %APPEND% *.codebuddy.cn
 *   2) 手机安装并信任 Loon 的 CA 证书
 *
 * 注意：只在 iPhone 上的客户端产生流量时才会被抓到。桌面客户端的
 *       请求不经过手机，抓不到。
 * ------------------------------------------------------------------
 */
(function () {
  "use strict";

  var KEY_TOKEN = "buddy_access_token";
  var KEY_UID = "buddy_uid";
  var KEY_AT = "buddy_capture_at";

  function log(v) {
    try { console.log(typeof v === "string" ? v : JSON.stringify(v)); } catch (e) {}
  }

  function read(key) {
    try { var v = $persistentStore.read(key); return v ? String(v) : ""; } catch (e) { return ""; }
  }

  function write(key, val) {
    try { return $persistentStore.write(String(val), key); } catch (e) { return false; }
  }

  function header(name) {
    var h = ($request && $request.headers) || {};
    var want = String(name).toLowerCase();
    for (var k in h) {
      if (!Object.prototype.hasOwnProperty.call(h, k)) continue;
      if (k.toLowerCase() === want) return String(h[k] || "");
    }
    return "";
  }

  /**
   * base64url 解码为 UTF-8 字符串。
   * 先按字节还原，再手工拼 UTF-8（Loon 环境无 TextDecoder / Buffer）。
   */
  function b64urlDecode(str) {
    var s = String(str).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var bytes = [], bits = 0, acc = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === "=") break;
      var idx = chars.indexOf(c);
      if (idx < 0) continue;
      acc = (acc << 6) | idx;
      bits += 6;
      if (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 0xff); }
    }

    // 字节序列 → UTF-8 字符
    var out = "", k = 0;
    while (k < bytes.length) {
      var b = bytes[k++];
      if (b < 0x80) {
        out += String.fromCharCode(b);
      } else if (b >= 0xc0 && b < 0xe0 && k < bytes.length) {
        out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[k++] & 0x3f));
      } else if (b >= 0xe0 && b < 0xf0 && k + 1 < bytes.length) {
        out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[k++] & 0x3f) << 6) | (bytes[k++] & 0x3f));
      } else if (b >= 0xf0 && k + 2 < bytes.length) {
        var cp = ((b & 0x07) << 18) | ((bytes[k++] & 0x3f) << 12) | ((bytes[k++] & 0x3f) << 6) | (bytes[k++] & 0x3f);
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      } else {
        out += "\uFFFD";
      }
    }
    return out;
  }

  // 请求头里没有 X-User-Id 时，从 JWT 载荷里找 uid
  function uidFromToken(tok) {
    try {
      var parts = String(tok).split(".");
      if (parts.length < 2) return "";
      var payload = b64urlDecode(parts[1]);
      var m = payload.match(/"(?:uid|user_id|userId|userid|sub|openid)"\s*:\s*"?([A-Za-z0-9_-]{1,64})"?/);
      return m ? m[1] : "";
    } catch (e) {
      return "";
    }
  }

  function mask(t) {
    return t.length > 16 ? t.slice(0, 8) + "..." + t.slice(-4) : "***";
  }

  function pass() { $done({}); }

  var auth = header("Authorization") || header("authorization");
  var m = auth.match(/^Bearer\s+([^\s]+)$/i);

  if (!m) { pass(); return; }

  var token = m[1].trim();
  var uid = header("X-User-Id") || header("x-user-id") || uidFromToken(token);

  if (!token || token.length < 20) { pass(); return; }

  var oldToken = read(KEY_TOKEN);
  var oldUid = read(KEY_UID);
  var changed = token !== oldToken;

  write(KEY_TOKEN, token);
  if (uid) write(KEY_UID, uid);
  write(KEY_AT, String(Math.floor(Date.now() / 1000)));

  if (changed) {
    log("已抓取登录态 token=" + mask(token) + " uid=" + (uid || "(沿用旧值)"));
    try {
      $notification.post(
        "Buddy加油站",
        "✓ 已自动抓取登录态",
        uid
          ? "uid " + uid + " · 签到脚本会自动使用，无需手工粘贴"
          : "只抓到 token，uid 仍为空；请在签到脚本里补一次 uid"
      );
    } catch (e) {}
  } else {
    log("登录态未变化，跳过");
  }

  pass();
})();
