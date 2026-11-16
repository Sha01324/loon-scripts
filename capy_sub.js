// Loon http-response script: CapyPlayer subscription status -> active
// 只改响应体，不动请求签名。命中 /api/v1/subscriptions/status
let body = $response.body;
try {
  var o = JSON.parse(body);
  function walk(x) {
    if (!x || typeof x !== 'object') return;
    var keys = Object.keys(x);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], v = x[k], kk = k.toLowerCase();
      if (['active','isactive','has_active_subscription','has_subscription',
           'entitled','ispro','haspro','premium','subscribed'].indexOf(kk) >= 0
          && typeof v === 'boolean') {
        x[k] = true;
      } else if (kk === 'status' && typeof v === 'string'
                 && /^(none|inactive|expired|free|trial_expired|unsubscribed)$/i.test(v)) {
        x[k] = 'active';
      } else if (['expiresat','expires_at','expires','expireat','endat','expiredat'].indexOf(kk) >= 0
                 && !v) {
        x[k] = '2099-12-31T23:59:59Z';
      } else if (['plan','planid','plan_id','productid','product_id','tier'].indexOf(kk) >= 0
                 && !v) {
        x[k] = 'lifetime';
      }
      walk(v);
    }
  }
  walk(o);
  $done({ body: JSON.stringify(o) });
} catch (e) {
  $done({});
}
