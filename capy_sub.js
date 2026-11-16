// CapyPlayer /api/v1/subscriptions/status -> is_active:true
// 响应体是 base64，需要解码->改->再编码。只改响应，不动请求签名。
function b64d(s){var c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',o='';
s=String(s).replace(/[^A-Za-z0-9+/=]/g,'');
for(var i=0;i<s.length;i+=4){var a=c.indexOf(s.charAt(i)),b=c.indexOf(s.charAt(i+1)),
d=c.indexOf(s.charAt(i+2)),e=c.indexOf(s.charAt(i+3));
var n=(a<<18)|(b<<12)|((d&63)<<6)|(e&63);o+=String.fromCharCode((n>>16)&255);
if(d!==64)o+=String.fromCharCode((n>>8)&255);if(e!==64)o+=String.fromCharCode(n&255);}return o;}
function b64e(s){var c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',o='',i=0;
while(i<s.length){var a=s.charCodeAt(i++),b=i<s.length?s.charCodeAt(i++):NaN,d=i<s.length?s.charCodeAt(i++):NaN;
var e1=a>>2,e2=((a&3)<<4)|(isNaN(b)?0:b>>4),e3=isNaN(b)?64:((b&15)<<2)|(isNaN(d)?0:d>>6),e4=isNaN(d)?64:(d&63);
o+=c.charAt(e1)+c.charAt(e2)+(e3===64?'=':c.charAt(e3))+(e4===64?'=':c.charAt(e4));}return o;}

var raw = $response.body || '';
var txt = raw, wasB64 = false;
var t = raw.trim();
if (/^[A-Za-z0-9+/=]+$/.test(t) && t.length % 4 === 0) {
  try { var dec = b64d(t); if (dec.indexOf('{') >= 0) { txt = dec; wasB64 = true; } } catch(e) {}
}
var o;
try { o = JSON.parse(txt); } catch(e) { $done({}); }
if (!o) { $done({}); }

var TRUE_KEYS = ['active','isactive','is_active','has_active_subscription','has_subscription',
                 'entitled','ispro','haspro','premium','subscribed','valid','isvalid','is_valid'];
var STATUS_OK = /^(none|inactive|expired|free|trial_expired|unsubscribed|null)$/i;
var EXP_KEYS = ['expiresat','expires_at','expires','expireat','endat','expiredat'];
var PLAN_KEYS = ['plan','planid','plan_id','productid','product_id','tier','type'];

function walk(x){
  if (!x || typeof x !== 'object') return;
  var ks = Object.keys(x);
  for (var i=0;i<ks.length;i++){
    var k = ks[i], v = x[k], kk = k.toLowerCase();
    if (TRUE_KEYS.indexOf(kk) >= 0) {
      if (typeof v === 'boolean') x[k] = true;
      else if (typeof v === 'number') x[k] = 1;
    } else if (kk === 'status' && typeof v === 'string' && STATUS_OK.test(v)) {
      x[k] = 'active';
    } else if (EXP_KEYS.indexOf(kk) >= 0 && !v) {
      x[k] = '2099-12-31T23:59:59Z';
    } else if (PLAN_KEYS.indexOf(kk) >= 0 && !v && typeof v !== 'boolean') {
      x[k] = 'lifetime';
    }
    walk(v);
  }
}
walk(o);
// ---- 补全真实订阅用户才会有的字段 ----
var d = o.data;
if (d && typeof d === 'object') {
  d.has_subscription = true;
  d.is_active = true;
  if (!d.plan) { d.plan = 'lifetime'; d.plan_id = 'lifetime'; }
  if (!d.product_id) d.product_id = 'capyplayer.pro.lifetime';
  if (!d.productId) d.productId = d.product_id;
  if (!d.status) d.status = 'active';
  if (!d.started_at) d.started_at = '2024-01-01T00:00:00Z';
  if (!d.startedAt) d.startedAt = d.started_at;
  if (!d.expires_at) d.expires_at = '2099-12-31T23:59:59Z';
  if (!d.expiresAt) d.expiresAt = d.expires_at;
  if (!d.subscription) d.subscription = { plan: 'lifetime', is_active: true, status: 'active' };
  // 功能级清单（App 里有 blockedProFeatures / requiredFeatures 字段）
  d.blockedProFeatures = [];
  d.blocked_pro_features = [];
  d.features = ['skipIntroOutro','autoSkipIntroOutro','skipOutro','skipIntro',
                'subtitleSearch','onlineSubtitles','multiDevice','exportZip','unlimitedExport'];
  d.entitlements = ['pro','premium','lifetime'];
  d.requiredFeatures = [];
}
if (o.code !== undefined && typeof o.code === 'number' && o.code !== 1000 && o.code !== 0) o.code = 1000;
if (o.message !== undefined && typeof o.message === 'string') o.message = 'success';

var body = JSON.stringify(o);
var outBody = wasB64 ? b64e(body) : body;
$done({ body: outBody, headers: { 'Content-Length': String(outBody.length),
                                   'Content-Type': 'application/json; charset=utf-8' } });
