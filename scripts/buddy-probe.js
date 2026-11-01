/**
 * 诊断脚本：找出 WorkBuddy App 到底访问了哪些域名
 *
 * 用法：在 Loon [Script] 里临时加一条（放在最前面）：
 *   http-request ^https?:\/\/ script-path=你的诊断脚本地址, tag=域名探测, timeout=10, enable=true
 *
 * 效果：App 每发一个请求，就记录一次域名。
 *      在 Loon 的「脚本日志」里能看到完整列表。
 *      找到真实域名后，把 buddy.plugin 的规则改成对应域名即可。
 */
(function () {
  "use strict";

  var KEY = "buddy_probe_hosts";

  function log(v) {
    try { console.log(typeof v === "string" ? v : JSON.stringify(v)); } catch (e) {}
  }

  function read(k) {
    try { var v = $persistentStore.read(k); return v ? String(v) : ""; } catch (e) { return ""; }
  }

  function write(k, v) {
    try { return $persistentStore.write(String(v), k); } catch (e) { return false; }
  }

  var url = ($request && $request.url) || "";
  var host = "";
  try {
    var m = url.match(/^https?:\/\/([^\/:?#]+)/i);
    host = m ? m[1].toLowerCase() : "";
  } catch (e) {}

  if (!host) { $done({}); return; }

  // 记录域名出现次数
  var store = read(KEY);
  var map = {};
  if (store) {
    store.split("\n").forEach(function (line) {
      var i = line.indexOf("\t");
      if (i <= 0) return;
      map[line.slice(0, i)] = parseInt(line.slice(i + 1), 10) || 0;
    });
  }

  var isNew = !map[host];
  map[host] = (map[host] || 0) + 1;

  var lines = [];
  Object.keys(map).forEach(function (h) { lines.push(h + "\t" + map[h]); });
  write(KEY, lines.join("\n"));

  // 只在新域名出现时打日志 + 通知，避免刷屏
  if (isNew) {
    log("【新域名】" + host + "  ← " + url.slice(0, 160));
    try {
      $notification.post("Buddy域名探测", "发现新域名", host);
    } catch (e) {}
  }

  $done({});
})();