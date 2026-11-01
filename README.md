# loon-scripts

个人使用的 Loon 脚本集合。

## 脚本列表

| 脚本 | 类型 | 说明 |
| --- | --- | --- |
| [buddy-capture.js](scripts/buddy-capture.js) | HTTP 请求拦截（MITM） | 自动抓取 WorkBuddy 登录态存入 Loon 持久化存储 |
| [buddy-checkin.js](scripts/buddy-checkin.js) | 定时任务（cron）/ 手动 | WorkBuddy「Buddy加油站」每日签到领积分 |
| [conf/buddy.plugin](conf/buddy.plugin) | 插件 | 一键导入上面两条的 Loon 插件声明 |

---

## 快速开始

### 1. 安装插件

把 `conf/buddy.plugin` 里的 `YOUR_GITHUB/YOUR_REPO` 替换成你的仓库地址，
然后在 Loon 中「配置 → 插件 → 添加订阅」或直接粘贴插件内容。

### 2. 信任证书

插件启用后，Loon 会提示安装 CA 证书：

**设置 → 通用 → VPN与设备管理 → 安装描述文件**，
再到 **设置 → 通用 → 关于本机 → 证书信任设置** 里把 Loon 的根证书打开。

> 不装证书，`buddy-capture.js` 抓不到任何东西（HTTPS 内容无法解密）。

### 3. 获取登录态

有两种方式，**任选其一**：

**方式 A：自动抓取（仅 iPhone App）**

1. 保持 Loon 运行，打开 iPhone 上的 WorkBuddy App
2. 在 App 里随便点点（进「Buddy加油站」页面即可）
3. 收到「✓ 已自动抓取登录态」通知就成了

**方式 B：手动填写（任何情况都能用）**

从**桌面客户端**的登录态文件里取 `auth.accessToken` 和 `account.uid`，
然后在 Loon 的脚本参数里填：

```
token=你的accessToken&uid=你的uid
```

或 JSON 形式：

```json
{"token":"你的accessToken","uid":"你的uid"}
```

---

## ⚠️ 重要：抓取只对 iPhone App 生效

`buddy-capture.js` 是通过 Loon 拦截**本机产生的网络流量**来取 token 的。

- ✅ **iPhone 上的 WorkBuddy App** —— 能抓到
- ❌ **Mac / Windows 桌面客户端** —— 抓不到，请求不经过手机

如果你主要在桌面端使用 WorkBuddy，手机 App 不怎么开，
**就请直接用方式 B 手动粘贴 token**，不要指望自动抓取。

手动粘贴的 token 同样会存进 Loon 持久化存储，
`buddy-checkin.js` 会优先读持久化存储，所以填一次就能一直用，直到 token 过期。

---

## 安全说明

1. **不要把 token 写进脚本常量**。代码一旦推到 GitHub，token 就等同于公开。
   本仓库的脚本默认 `token: ""` / `uid: ""`，请保持为空。

2. **token 只放在 Loon 里**。Loon 的 `$persistentStore` 是本地明文存储，
   依托 iOS 沙盒隔离，日常使用风险可接受，但**不要截图分享**带 token 的配置。

3. **提交代码前自查**。本仓库提交前会做敏感信息扫描，你自己改代码后也建议扫一遍：

   ```bash
   rg -n 'Bearer\s+[A-Za-z0-9_-]{20,}|ghp_|sk-[A-Za-z0-9]{20,}' .
   ```

4. **token 过期怎么办**。`buddy-checkin.js` 遇到 HTTP 401 或业务码 `10002`
   会发通知「登录态已过期」，重新抓取或重新粘贴即可。

---

## 脚本行为说明

### buddy-checkin.js

运行流程：

```
读取配置（argument > 持久化 > 脚本常量）
  ↓
GET  /v2/billing/meter/checkin-activity-status   查今日签到状态
  ↓
已签到 → 通知「今天已领取」→ 结束
  ↓
未签到 → POST /v2/billing/meter/daily-checkin    执行签到
  ↓
再查一次状态，核对连续天数 / 累计积分 → 通知结果
```

容错处理：

- 网络失败、HTTP 非 2xx、返回体不是 JSON → 通知失败原因
- HTTP 401 / 业务码 10002 → 判定登录态过期
- 业务码 10001 或提示「已签到」→ 判定为已领取（幂等，不会误报失败）
- 脚本整体包了 try/catch，异常也会发通知而不是静默退出

### buddy-capture.js

- 只处理带 `Authorization: Bearer xxx` 的请求
- `X-User-Id` 缺失时，尝试从 JWT 载荷里解析 `uid` / `user_id` / `sub` 等字段
- **只在 token 变化时发通知**，避免每次请求都打扰
- 日志里的 token 做了打码处理（`前8位...后4位`）
- 不对 token 做合法性校验，存进去是否有效要等签到脚本实际调用才知道

---

## 目录说明

```
scripts/    Loon 脚本（*.js）
conf/       Loon 插件 / 配置片段（*.plugin）
icons/      图标
```

## 免责声明

本仓库脚本仅供个人学习与技术交流使用，请勿用于商业用途。
使用者需自行承担使用风险，脚本作者不对任何账号异常、数据丢失等后果负责。