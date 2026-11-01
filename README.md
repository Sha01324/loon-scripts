# loon-scripts

个人使用的 Loon 脚本集合，基于 [Loon](https://nsloon.app) 的脚本 / 定时任务能力。

## 脚本列表

| 脚本 | 类型 | 说明 |
| --- | --- | --- |
| [workbuddy-checkin.js](scripts/workbuddy-checkin.js) | 定时任务（cron） | WorkBuddy 每日签到领积分 |

## 使用方法

### 方式一：直接引用 GitHub 原始链接（推荐）

在 Loon 中打开 **配置 → 定时任务 (Cron)**，新增一条：

```
名称：WorkBuddy 签到
脚本：https://raw.githubusercontent.com/<USER>/loon-scripts/main/scripts/workbuddy-checkin.js
定时：0 9 * * *
```

> 请把 `<USER>` 换成你的 GitHub 用户名。

### 方式二：引用配置文件

在 Loon 的配置里批量导入 `conf/` 目录下的 `.conf` 文件，或用「配置 → 插件」订阅 raw 链接。

### 方式三：本地脚本

把 `scripts/*.js` 拷到 Loon 的「配置 → 我的脚本」里手动添加。

## 鉴权 / Cookie 说明

脚本所需的 Cookie、Token 等敏感信息，**统一从 Loon 的 Argument 传入，不要写死在代码里**，
也不要提交到本仓库。

在 Loon 的脚本参数（Argument）中填写，例如：

```
cookie=xxxxx
```

脚本内通过 `$argument.cookie` 读取。

## 目录说明

```
scripts/    Loon 脚本（*.js）
conf/       Loon 配置 / 插件片段（*.conf / *.plugin）
icons/      图标
```

## 免责声明

本仓库脚本仅供个人学习与技术交流使用，请勿用于商业用途。
使用者需自行承担使用风险，脚本作者不对任何账号异常、数据丢失等后果负责。