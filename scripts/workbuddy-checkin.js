/**
 * WorkBuddy 每日签到领积分
 *
 * Loon 定时任务脚本
 * 建议 cron: 0 9 * * *
 *
 * @author you
 * @version 0.1.0
 */

/* ---------------- 配置区（切勿写死 Cookie） ---------------- */

const CONFIG = {
  // 接口域名，需与 Loon 规则 / 脚本中保持一致
  host: 'api.workbuddy.example.com',
  // Loon 脚本 Argument 中传 cookie=xxx
  cookie: $argument.cookie || '',
  // 需要额外的 UA 时填入
  ua: $argument.ua || 'WorkBuddy/1.0 (iPhone; iOS 17.0)',
  // 单次运行最大重试
  retry: 2,
};

/* ---------------- 工具函数 ---------------- */

/**
 * 统一请求封装：返回 { ok, status, data }
 */
function request(method, path, body) {
  return new Promise((resolve) => {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': CONFIG.ua,
      'Cookie': CONFIG.cookie,
    };

    const opts = {
      url: `https://${CONFIG.host}${path}`,
      headers,
      timeout: 15000,
      // node: Loon 内置的请求库 wx / $http
    };

    if (method === 'POST') {
      opts.body = JSON.stringify(body || {});
    }

    $httpClient[method.toLowerCase()](opts, (err, resp, data) => {
      if (err) {
        resolve({ ok: false, status: 0, data: null, error: String(err) });
        return;
      }

      let parsed = null;
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        parsed = { raw: String(data).slice(0, 300) };
      }

      resolve({
        ok: resp.status === 200 || resp.status === 201,
        status: resp.status,
        data: parsed,
      });
    });
  });
}

/** 通知：有 UI 时弹通知，无 UI 时打日志 */
function notify(title, subtitle, body) {
  $notification.post(title, subtitle || '', body || '');
  console.log(`[${title}] ${subtitle} ${body || ''}`);
}

/** 判断业务是否成功（按实际返回结构调整） */
function isSuccess(data) {
  if (!data || typeof data !== 'object') return false;
  // 常见形态：code === 0 / 200, success === true
  if (typeof data.code !== 'undefined') return data.code === 0 || data.code === 200;
  if (typeof data.success !== 'undefined') return data.success === true;
  return false;
}

/* ---------------- 业务逻辑 ---------------- */

(async () => {
  console.log('========== WorkBuddy 签到开始 ==========');
  console.log(new Date().toString());

  if (!CONFIG.cookie) {
    notify('WorkBuddy 签到', '配置错误', '未设置 cookie，请在脚本 Argument 中填写');
    $done();
    return;
  }

  // 1. 预检：拉取用户信息，确认 Cookie 有效
  const me = await request('GET', '/api/user/info');
  console.log('用户信息:', JSON.stringify(me.data));

  if (!me.ok) {
    notify('WorkBuddy 签到', '登录失效', `HTTP ${me.status}，请重新抓取 Cookie`);
    $done();
    return;
  }

  const nickname = (me.data && (me.data.nickname || me.data.name)) || '用户';

  // 2. 查询今日签到状态
  const status = await request('GET', '/api/checkin/status');
  console.log('签到状态:', JSON.stringify(status.data));

  if (status.ok && status.data && (status.data.checkedIn || status.data.todaySigned)) {
    notify('WorkBuddy 签到', nickname, '今日已签到，无需重复');
    $done();
    return;
  }

  // 3. 执行签到（带重试）
  let result = null;
  for (let i = 0; i <= CONFIG.retry; i++) {
    result = await request('POST', '/api/checkin');
    console.log(`第 ${i + 1} 次签到结果:`, JSON.stringify(result.data));

    if (result.ok && isSuccess(result.data)) break;
    if (i < CONFIG.retry) await new Promise((r) => setTimeout(r, 1500));
  }

  // 4. 结果播报
  if (result && result.ok && isSuccess(result.data)) {
    const d = result.data;
    const gained = d.points || d.reward || (d.data && d.data.points) || '?';
    notify('WorkBuddy 签到成功', nickname, `获得 ${gained} 积分`);
  } else {
    const msg = (result && result.data && (result.data.msg || result.data.message)) || '未知错误';
    notify('WorkBuddy 签到失败', nickname, msg);
  }

  console.log('========== WorkBuddy 签到结束 ==========');
  $done();
})();