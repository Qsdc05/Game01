import { todayDate, todaySeed, validateChallengeResult, type ReplayAction } from '../src/game';

interface Env {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  ALLOWED_ORIGIN?: string;
}

type User = { id: string; username: string };
type StoredUser = User & { password_hash: string };
type ScoreBody = {
  score?: unknown;
  moves?: unknown;
  highestLevel?: unknown;
  challengeDate?: unknown;
  challengeVersion?: unknown;
  actions?: unknown;
};

const now = () => new Date().toISOString();

function requestOrigin(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  if (!origin) return '*';
  return env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN : 'null';
}

function cors(request: Request, env: Env) {
  return {
    'Access-Control-Allow-Origin': requestOrigin(request, env),
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, request: Request, env: Env, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(request, env), 'content-type': 'application/json', ...extraHeaders },
  });
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function passwordHash(password: string, salt: string = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return `${salt}:${[...new Uint8Array(bits)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

async function checkPassword(password: string, stored: string) {
  const [salt] = stored.split(':');
  return stored === await passwordHash(password, salt);
}

function sessionCookie(token: string) {
  return `session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=604800`;
}

function clearSessionCookie() {
  return 'session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0';
}

async function getSessionUser(request: Request, env: Env): Promise<User | null> {
  const token = request.headers.get('Cookie')?.match(/session=([^;]+)/)?.[1];
  if (!token) return null;
  const tokenHash = await digest(token);
  return await env.DB.prepare('SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(tokenHash, now()).first<User>();
}

function adminCredentials(request: Request, env: Env) {
  const encoded = request.headers.get('Authorization')?.replace(/^Basic\s+/i, '');
  if (!encoded) return false;
  try {
    const [username, password] = atob(encoded).split(':');
    return username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request, env) });
    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/auth/register' && request.method === 'POST') {
        const body = await request.json() as { username?: string; password?: string; invite?: string };
        if (!body.username || !body.password || !body.invite || body.username.length > 24 || body.password.length < 8) {
          return json({ error: '请输入有效用户名、密码（至少 8 位）和邀请码' }, 400, request, env);
        }
        const invite = await env.DB.prepare('SELECT code FROM invite_codes WHERE code=? AND used_by IS NULL AND revoked=0').bind(body.invite).first();
        if (!invite) return json({ error: '邀请码无效或已使用' }, 400, request, env);
        const exists = await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(body.username).first();
        if (exists) return json({ error: '用户名已存在' }, 409, request, env);
        const id = crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare('INSERT INTO users VALUES (?,?,?,?)').bind(id, body.username, await passwordHash(body.password), now()),
          env.DB.prepare('UPDATE invite_codes SET used_by=?,used_at=? WHERE code=? AND used_by IS NULL AND revoked=0').bind(id, now(), body.invite),
        ]);
        return json({ ok: true }, 201, request, env);
      }

      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body = await request.json() as { username?: string; password?: string };
        const user = await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(body.username ?? '').first<StoredUser>();
        if (!user || !(await checkPassword(body.password ?? '', user.password_hash))) return json({ error: '用户名或密码错误' }, 401, request, env);
        const token = crypto.randomUUID() + crypto.randomUUID();
        await env.DB.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(await digest(token), user.id, new Date(Date.now() + 604800000).toISOString()).run();
        return json({ user: { id: user.id, username: user.username } }, 200, request, env, { 'Set-Cookie': sessionCookie(token) });
      }

      if (url.pathname === '/api/auth/me') {
        const user = await getSessionUser(request, env);
        return user ? json({ user }, 200, request, env) : json({ user: null }, 401, request, env);
      }

      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        const token = request.headers.get('Cookie')?.match(/session=([^;]+)/)?.[1];
        if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
        return json({ ok: true }, 200, request, env, { 'Set-Cookie': clearSessionCookie() });
      }

      if (url.pathname === '/api/challenge/today' && request.method === 'GET') {
        const date = todayDate();
        return json({ date, version: 1, seed: todaySeed() }, 200, request, env);
      }

      if (url.pathname === '/api/scores' && request.method === 'POST') {
        const user = await getSessionUser(request, env);
        if (!user) return json({ error: '请先登录' }, 401, request, env);
        const body = await request.json() as ScoreBody;
        const date = todayDate();
        const score = body.score;
        const moves = body.moves;
        const highestLevel = body.highestLevel;
        const actions = Array.isArray(body.actions) ? body.actions as ReplayAction[] : [];
        const validShape = body.challengeDate === date
          && body.challengeVersion === 1
          && Number.isInteger(score)
          && Number.isInteger(moves)
          && Number.isInteger(highestLevel)
          && typeof score === 'number'
          && typeof moves === 'number'
          && typeof highestLevel === 'number'
          && moves >= 1
          && moves <= 30
          && score >= 0
          && score <= 10000000
          && highestLevel >= 0
          && highestLevel < 8;
        const validReplay = validShape && validateChallengeResult(todaySeed(), actions, { score, moves, highestLevel });
        if (!validReplay) return json({ error: '成绩校验失败，请使用当前每日地图完成挑战' }, 400, request, env);
        await env.DB.prepare('INSERT INTO scores(user_id,challenge_date,score,moves,highest_tile,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,challenge_date) DO UPDATE SET score=MAX(score,excluded.score),moves=CASE WHEN excluded.score>score THEN excluded.moves ELSE moves END,highest_tile=MAX(highest_tile,excluded.highest_tile)').bind(user.id, date, score, moves, highestLevel, now()).run();
        return json({ ok: true }, 200, request, env);
      }

      if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
        const period = url.searchParams.get('period') || 'daily';
        const today = new Date(Date.now() + 8 * 3600000);
        const date = today.toISOString().slice(0, 10);
        const start = new Date(today);
        if (period === 'weekly') start.setUTCDate(start.getUTCDate() - 6);
        const condition = period === 'all' ? '1=1' : period === 'weekly' ? 's.challenge_date>=?' : 's.challenge_date=?';
        const params = period === 'all' ? [] : [period === 'weekly' ? start.toISOString().slice(0, 10) : date];
        const rows = await env.DB.prepare(`SELECT u.username,MAX(s.score) AS score,MIN(s.moves) AS moves,MAX(s.highest_tile) AS highest_tile,MAX(s.created_at) AS created_at FROM scores s JOIN users u ON u.id=s.user_id WHERE ${condition} GROUP BY s.user_id ORDER BY score DESC LIMIT 50`).bind(...params).all();
        return json({ items: rows.results }, 200, request, env);
      }

      if (url.pathname === '/api/save' && (request.method === 'GET' || request.method === 'POST')) {
        const user = await getSessionUser(request, env);
        if (!user) return json({ error: '请先登录' }, 401, request, env);
        if (request.method === 'GET') {
          const save = await env.DB.prepare('SELECT payload,updated_at FROM game_saves WHERE user_id=?').bind(user.id).first();
          return json({ save }, 200, request, env);
        }
        const payload = await request.text();
        if (payload.length > 100000) return json({ error: '存档过大' }, 413, request, env);
        await env.DB.prepare('INSERT INTO game_saves VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(user.id, payload, now()).run();
        return json({ ok: true }, 200, request, env);
      }

      if (url.pathname.startsWith('/api/admin/invites')) {
        if (!adminCredentials(request, env)) return json({ error: '未授权' }, 401, request, env);
        if (request.method === 'GET') {
          const rows = await env.DB.prepare('SELECT code,used_by,revoked,created_at,used_at FROM invite_codes ORDER BY created_at DESC LIMIT 100').all();
          return json({ items: rows.results }, 200, request, env);
        }
        if (request.method === 'DELETE') {
          const code = url.searchParams.get('code');
          if (!code) return json({ error: '缺少邀请码' }, 400, request, env);
          await env.DB.prepare('UPDATE invite_codes SET revoked=1 WHERE code=? AND used_by IS NULL').bind(code).run();
          return json({ ok: true }, 200, request, env);
        }
        if (request.method === 'POST') {
          const code = crypto.randomUUID().slice(0, 8).toUpperCase();
          await env.DB.prepare('INSERT INTO invite_codes(code,created_at) VALUES (?,?)').bind(code, now()).run();
          return json({ code }, 201, request, env);
        }
      }

      return json({ error: 'Not found' }, 404, request, env);
    } catch (error) {
      console.error(error);
      return json({ error: '服务暂时不可用' }, 500, request, env);
    }
  },
};
