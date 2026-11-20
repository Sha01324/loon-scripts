# 星驰API（xingchiapi.com）Loon 自动签到

## 原理（已逆向 + 实测确认，2026-11-21）

从站点前端 JS（index-DshE68Gh.js / DashboardView / AppLayout）逆向确认：

| 项 | 值 |
|---|---|
| 签到接口 | GET/POST /api/v1/user/checkin |
| 完整地址 | https://xingchiapi.com/api/v1/user/checkin（同源；也支持 api.xingchiapi.com） |
| 鉴权 | 请求头 Authorization: Bearer <access_token> |
| token 存处 | 浏览器 localStorage 键 auth_token（Loon 读不到，故用 MITM 抓请求头） |
| 状态响应 | {code:0, data:{enabled, claimed_today, amount, total_count, total_amount}} |
| 签到成功 | {code:0, data:{status, amount}} |
| 已签到 | {code:非0, reason:"CHECKIN_ALREADY_CLAIMED"} |
| 刷新token | POST /api/v1/auth/refresh body {refresh_token} → {code:0,data:{access_token,refresh_token,expires_in}} |

无签到验证码（没挂 turnstile/captcha），Bearer 鉴权即可，脚本方案可行。

两段式工作流：
1. Safari 登录 xingchiapi.com → http-request 脚本 MITM 抓到 Authorization 头 → 存入 $persistentStore
2. cron 每天 08:00 读 token → 先查状态 → 未签到则 POST 签到 → 发通知

## 文件清单

- xc-token-capture.js — http-request 抓 token（需 MITM）
- xc-checkin.js — cron 定时签到（核心）
- xc-set-token.js — generic 手动填 token（兜底）
- xingchi.plugin — Loon 插件配置
- README.md — 本文件

## 部署步骤（脚本已托管，直接导入即可）

脚本已放在公开仓库 `Sha01324/loon-scripts`，plugin 内已填好 raw 直链，无需自己托管。

### 第 1 步：导入插件
Loon 配置 → 插件 → 从 URL 导入，粘贴：
https://raw.githubusercontent.com/Sha01324/loon-scripts/main/xingchi-checkin.plugin

### 第 2 步：安装 MITM 证书
Loon 安装 MITM 证书并在 iOS 设置里信任（设置 → 通用 → VPN与设备管理 → 描述文件）。
确认插件里 [MITM] hostname = xingchiapi.com, api.xingchiapi.com。

### 第 3 步：抓 token（一次性）
用 Safari（走 Loon 代理）打开并登录 https://xingchiapi.com/keys，登录后随便点几下页面。
抓到 token 时 Loon 弹通知「token 已捕获」。
注意：若用不走 Loon 代理的 App 内 WKWebView 则抓不到，改第 4 步手动填。

### 第 4 步（兜底）手动填 token
1. 复制 Authorization: Bearer xxx 里的 xxx
2. 编辑 xc-set-token.js 顶部 MANUAL_TOKEN = "你的token"，或运行该 generic 脚本时用 argument 传入
3. 手动运行一次 → 通知「已保存 token」

### 第 5 步：验证
Loon 里手动运行一次 xc-checkin.js（或把 cron 时间临时改到下一分钟），
应收到通知「签到成功 +N 额度」或「今日已签到，跳过」。

## 自定义

- 签到时间：改 xingchi.plugin 里 cron "0 8 * * *"（分 时 日 月 周），如 9:30 改 "30 9 * * *"
- 换域名：脚本自动记录实际抓到 token 的域名；手动场景可用存储键 xc_host 指定
- 看上次结果：$persistentStore 键 xc_checkin_result

## 排障

| 现象 | 处理 |
|---|---|
| 未找到 token | 没抓到也没手填，做第 4 或第 5 步 |
| token 已过期且刷新失败 | 重新登录让抓包更新，或手填新 token |
| 一直抓不到 | MITM 证书没装/没信任；Safari 没走 Loon；登录后没触发 /api/v1/* 请求 |
| 本站未开启签到 | 该账号/站点未开签到，非脚本问题 |
| 手动正常定时不跑 | cron 要开着 Loon 且后台刷新未被系统杀；iOS 后台时间不精确 |

## 技术说明

- 用 Loon 标准 Script API：$httpClient / $persistentStore / $notification / $done，无外部依赖
- token 过期自动走 /auth/refresh 换新后重试
- 纯读取，不改请求响应，不干扰上网
