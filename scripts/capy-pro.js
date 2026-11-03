/**
 * CapyPlayer 订阅接口改写
 *
 * 实测接口（2026-11-03 抓包，com.feifeiduck.capyplayer 1.1.7）：
 *   GET  https://api-capyplayer.feifeiduck.cn/api/v1/subscriptions/status?scope=mobile
 *   GET  https://api-capyplayer.feifeiduck.cn/api/v1/devices?scope=mobile
 *   POST https://api-capyplayer.feifeiduck.cn/api/v1/subscriptions/verify/ios
 *   POST https://api-capyplayer.feifeiduck.cn/api/v1/subscriptions/sync/ios
 *
 * 响应体是 Base64 包装的 JSON：
 *   eyJjb2RlIjoxMDAwLCJtZXNzYWdlIjoic3VjY2VzcyIsImRhdGEiOnsiLi4uIn19
 *   → {"code":1000,"message":"success","data":{"has_subscription":true,"is_active":true}}
 *
 * 请求侧签名头 x-signature / x-timestamp / x-device-id 由 App 生成，
 * 本脚本只改响应，不动请求，签名不受影响。
 *
 * MODE = "capture" : 只记录真实响应，供调试
 * MODE = "fake"    : 改写为已订阅
 */

const MODE = "fake"; // 调试时改成 "capture"

const PATH_RE = /\/api\/v1\/(subscriptions|devices|subscribe)\b/i;

const FAR_MS = 4102444800000; // 2100-01-01
const FAR_STR = "2099-12-31T23:59:59Z";
const PLAN_ID = "capyplayer.pro.lifetime";

const PRO_BOOL = /^(has[_-]?subscription|has[_-]?active[_-]?subscription|has[_-]?premium|hasSubscription|hasActiveSubscription|is[_-]?active|is[_-]?pro|is[_-]?premium|isActive|isPro|isPremium|active|premium|vip|pro)$/i;
const DATE_KEYS = /(expire|expiry|end[_-]?date|endDate|expires[_-]?(at|time|on)|expiresAt|next[_-]?renewal[_-]?time|nextRenewalTime|renew[_-]?date|valid[_-]?until|period[_-]?end)/i;
const LIMIT_KEYS = /(device[_-]?limit|max[_-]?device|scope[_-]?limit|resource[_-]?limit|quota|max[_-]?quota)/i;
const PLAN_KEYS = /^(plan|plan[_-]?id|planId|current[_-]?plan|currentPlan|tier|product[_-]?id|productId|apple[_-]?product[_-]?id)$/i;

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function b64decode(s) {
  const clean = String(s).replace(/[^A-Za-z0-9+/]/g, "");
  const out = [];
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const idx = CHARS.indexOf(clean[i]);
    if (idx < 0) continue;
    buf = (buf << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  let str = "";
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (c < 0x80) str += String.fromCharCode(c);
    else if (c < 0xe0) str += String.fromCharCode(((c & 0x1f) << 6) | (out[++i] & 0x3f));
    else if (c < 0xf0) str += String.fromCharCode(((c & 0x0f) << 12) | ((out[++i] & 0x3f) << 6) | (out[++i] & 0x3f));
    else {
      const cp = ((c & 0x07) << 18) | ((out[++i] & 0x3f) << 12) | ((out[++i] & 0x3f) << 6) | (out[++i] & 0x3f);
      str += String.fromCodePoint(cp);
    }
  }
  return str;
}

function b64encode(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.codePointAt(i);
    if (c > 0xffff) i++;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += CHARS[b0 >> 2];
    out += CHARS[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)];
    out += b1 === undefined ? "=" : CHARS[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)];
    out += b2 === undefined ? "=" : CHARS[b2 & 63];
  }
  return out;
}

function parseBody(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  if (t.charAt(0) === "{") {
    try {
      return { obj: JSON.parse(t), enc: "plain" };
    } catch (e) {}
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(t) && t.length > 8) {
    try {
      return { obj: JSON.parse(b64decode(t)), enc: "base64" };
    } catch (e) {}
  }
  return null;
}

function deepFix(o, d) {
  if (d > 12 || o === null || typeof o !== "object") return o;
  if (Array.isArray(o)) {
    for (let i = 0; i < o.length; i++) o[i] = deepFix(o[i], d + 1);
    return o;
  }
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (PRO_BOOL.test(k)) {
      if (typeof v === "boolean" || typeof v === "string" || typeof v === "number") o[k] = true;
      continue;
    }
    if (DATE_KEYS.test(k) && (v === null || typeof v === "number" || typeof v === "string")) {
      o[k] = typeof v === "number" ? FAR_MS : FAR_STR;
      continue;
    }
    if (LIMIT_KEYS.test(k) && typeof v === "number") {
      o[k] = 9999;
      continue;
    }
    if (PLAN_KEYS.test(k) && (v === null || typeof v === "string")) {
      o[k] = PLAN_ID;
      continue;
    }
    o[k] = deepFix(v, d + 1);
  }
  return o;
}

(function () {
  const url = ($request && $request.url) || "";
  const raw = ($response && $response.body) || "";

  console.log("[capy-pro] hit " + url + " len=" + raw.length);

  if (!PATH_RE.test(url)) {
    console.log("[capy-pro] skip (path not matched)");
    $done({});
    return;
  }

  const parsed = parseBody(raw);
  if (!parsed) {
    console.log("[capy-pro] parse failed, raw head=" + raw.slice(0, 120));
    $notify("capy-pro", "无法解析响应", raw.slice(0, 180));
    $done({});
    return;
  }

  if (MODE === "capture") {
    const s = JSON.stringify(parsed.obj);
    console.log("[capy-pro][capture] enc=" + parsed.enc + " " + s);
    $notify("capy-pro 真实响应", url.split("/api/v1/")[1] || url, s.slice(0, 300));
    $done({});
    return;
  }

  const before = JSON.stringify(parsed.obj);
  const fixed = deepFix(parsed.obj, 0);
  if (fixed && fixed.data && typeof fixed.data === "object") {
    fixed.data.has_subscription = true;
    fixed.data.is_active = true;
  }
  const outStr = JSON.stringify(fixed);
  const body = parsed.enc === "base64" ? b64encode(outStr) : outStr;

  console.log("[capy-pro][fake] " + url + "\n  before=" + before.slice(0, 220) + "\n  after =" + outStr.slice(0, 220));

  $done({
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: body,
  });
})();