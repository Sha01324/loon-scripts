# 星驰API Loon 自动签到 v3.0.0

## 安装 / 从旧版升级

1. 在Loon更新或重新导入同一插件地址（不必叠加安装两份）：
   `https://raw.githubusercontent.com/Sha01324/loon-scripts/main/xingchi-checkin.plugin`
2. 确认MITM已启用、证书已安装并信任，域名含 `xingchiapi.com` 和 `api.xingchiapi.com`。新配置应有认证请求、普通请求、认证响应三条http规则；脚本URL带 `?v=3.0.0`。
3. **升级后请在走Loon的Safari里重新登录一次。**看到「已保存配套登录凭证，可用于自动续期」才表示access与refresh已配套保存。只看到访问凭证通知不代表续期已就绪；不必发送或截图你的token。
4. 手动运行 `xc_daily_checkin` 验证普通签到/已签到提示。定时仍为设备时区每天08:00。

旧版access可迁移继续使用，但旧refresh没有可靠账号绑定，**不会迁移为配套refresh**。迁移后旧token键会清空，让旧缓存脚本停止，而不是继续使用另一账号；必须一起更新插件和三个脚本。

## 本版修复

- 从认证成功响应整体保存access、refresh和来源，不再把浏览器发出的旧refresh当新凭证；登录、二次验证、refresh及其他返回完整凭证对的auth响应采用同一处理。
- 普通Bearer切换或手动只换access时解除旧refresh/Cookie绑定，防止刷新回旧账号。
- GET/POST401都可进入恢复，每次执行最多刷新一次，成功后重新查状态，再决定是否POST。
- 同时校验HTTP成功状态、业务码与必需字段；5xx/格式异常不再冒充成功。
- 真实奖励0显示+0，不再用预计额度300替代；无有效奖励字段会提示核对结果，不猜金额。
- 抓包始终`$done({})`放行，不改请求响应，不记录密码/token正文或凭证前缀。

## 手动兜底

在 `xc_set_token` 的argument中传入纯access token，支持去掉前后空白和Bearer前缀。**仅传access会清掉旧refresh绑定，不能因此自动续期。**

也支持完整JSON（以下均为占位内容，不是可用凭据）：
```json
{"access_token":"YOUR_ACCESS_TOKEN","refresh_token":"YOUR_MATCHING_REFRESH_TOKEN","host":"https://xingchiapi.com"}
```
不要把真实凭证写入公开脚本或GitHub；不要为测试故意触发真实签到。

## 验证边界与排障

- VERIFIED（本地）：3个独立生成脚本语法检查、72项离线模拟回归通过；未调用真实登录、refresh或签到。
- 待验证：真实Loon响应捕获/自动续期、定时触发，服务器refresh有效期、撤销/轮换规则。不能承诺永久免维护。
- 网络超时、POST返回不明时不盲重发；先查本站签到记录。
- 检测到认证请求重叠时不猜测响应归属，不覆盖凭证；待请求结束后再登录。它是保守保护，不是跨脚本原子锁，也不能取消已经发出的请求。
- 会话变化时旧回调停止，不继续使用旧响应。单人、单个日常cron是当前预期负载。
- token是凭证，Header/Cookie是载体；本版按已观察到的Bearer+refresh流程工作，不把一次无Cookie推论为Cookie普遍不可行。
- `xc_session_v3`保存完整会话；`xc_checkin_result`保存最后结果。请勿把完整存储导出公开。

## 源码与开发验证

运行时仍是3个无外部依赖的独立Loon脚本；本地 `src/session.js`与3个入口由 `build.cjs`合并，避免各入口的会话规则分叉。

```sh
node build.cjs
node build.cjs --check
node --check xc-checkin.js
node --check xc-token-capture.js
node --check xc-set-token.js
node --test tests/signin.test.cjs
```

原缺陷审计见 `AUDIT-2026-11-27.md`；旧源码及档案保留于 `releases/pre-v3/`，不再作为当前操作指南。
