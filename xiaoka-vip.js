/*
 * 小卡健康 (com.calai.calmate) 会员态改写  v2
 * 依据（实测）：用户信息缓存在 flutter.USER_INFO_KEY，含 is_vip/vip_type/vip_type_text/expiration_time；
 *   App 启动 12 秒内会请求 /api/user/info 并用服务端结果覆盖缓存 → 必须在响应层改写。
 * Loon 铁律：http-response 放行必须 $done({})，不带参数的 $done() 等于丢弃响应。
 */
var body = $response.body;

function patch(s) {
  var now = Date.now();
  return s
    .replace(/"is_vip":0/g, '"is_vip":1')
    .replace(/"vip_type":0/g, '"vip_type":1')
    .replace(/"vip_type_text":"[^"]*"/g, '"vip_type_text":"终身会员"')
    .replace(/"expiration_time":0/g, '"expiration_time":4102444800000')
    .replace(/"buy_time":0/g, '"buy_time":' + now);
}

try {
  if (typeof body === 'string' && body.indexOf('"is_vip":0') >= 0) {
    var nb = patch(body);
    console.log('[xiaoka-vip] patched ' + body.length + ' -> ' + nb.length);
    $done({ body: nb });
  } else {
    $done({});
  }
} catch (e) {
  console.log('[xiaoka-vip] error ' + e);
  $done({});
}
