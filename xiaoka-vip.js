/*
 * 小卡健康 (com.calai.calmate) 会员态改写
 * 作用：把 cal-cn.ishuohua.cn 返回体里的 is_vip / vip_type / 到期时间改成本地会员
 * 依据：App 的用户信息缓存在 flutter.USER_INFO_KEY，字段 is_vip/vip_type/vip_type_text/expiration_time
 *      启动 12s 内会被 /api/user/info 覆盖，故必须在响应层改写。
 * 注意：Loon http-response 脚本放行必须 $done({})，否则等于丢弃响应。
 */
var body = $response.body;

if (body && body.indexOf('"is_vip":0') >= 0) {
  var now = Date.now();
  var newBody = body
    .replace(/"is_vip":0/g, '"is_vip":1')
    .replace(/"vip_type":0/g, '"vip_type":1')
    .replace(/"vip_type_text":"[^"]*"/g, '"vip_type_text":"终身会员"')
    .replace(/"expiration_time":0/g, '"expiration_time":4102444800000')
    .replace(/"buy_time":0/g, '"buy_time":' + now);

  console.log('[xiaoka-vip] rewarded, len ' + body.length + ' -> ' + newBody.length);
  $done({ body: newBody });
} else {
  $done({});
}
