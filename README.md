# loon-scripts

Loon 脚本集合。

## CapyPlayer Pro

**插件地址**（Loon → 配置 → 插件 → 添加 → 粘贴这一行）：

```
https://raw.githubusercontent.com/Sha01324/loon-scripts/main/conf/capy-pro.plugin
```

- 脚本：`scripts/capy-pro.js`
- 拦截：`api-capyplayer.feifeiduck.cn/api/v1/(subscriptions|devices|subscribe)`
- 响应体是 Base64 包装的 JSON，脚本会解码 → 改写 → 重新编码
- 调试：把脚本里 `const MODE = "fake"` 改成 `"capture"`，Loon 日志里可看到真实响应

> 仅供本机测试与学习使用。