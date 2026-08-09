import { useEffect, useRef, useState } from 'react';
import {
  act,
  createGame,
  normalizeGameState,
  selectCabinet,
  tileColor,
  tileIcon,
  tileName,
  todayDate,
  todaySeed,
  undoGame,
  type GameState,
  type Mode,
} from './game';
import './styles.css';

const API = import.meta.env.VITE_API_URL || '';

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}

function Auth({ onLogin }: { onLogin: (name: string) => void }) {
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMessage('');
    try {
      const body = register ? { username, password, invite } : { username, password };
      const data = await api(register ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (register) {
        setRegister(false);
        setMessageType('success');
        setMessage('档案创建成功，现在可以登录了。');
      } else {
        onLogin(data.user.username);
      }
    } catch (error) {
      setMessageType('error');
      setMessage(error instanceof Error ? error.message : '网络连接失败，请检查 API 配置');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth game-auth">
      <div className="game-grid" />
      <div className="game-glow glow-a" />
      <div className="game-glow glow-b" />
      <section className="auth-shell game-shell">
        <div className="auth-story game-story">
          <div className="game-topbar"><span className="game-logo">✦</span><span>ARCHIVE // 01</span><b>ONLINE</b></div>
          <div className="game-hero">
            <div className="level-badge"><small>SECTOR</small><strong>01</strong></div>
            <p className="story-label">THE LOST EXHIBIT</p>
            <h1>折叠<br /><em>博物馆</em></h1>
            <p className="game-tagline">每一次旋转，都是一次<br /><b>文明重组。</b></p>
            <div className="relic-stage"><div className="relic-shadow" /><div className="relic"><i>✦</i><span>◈</span></div><div className="relic-orbit orbit-a" /><div className="relic-orbit orbit-b" /><small>UNKNOWN RELIC<br /><b>SYNC REQUIRED</b></small></div>
          </div>
          <div className="quest-panel"><span className="quest-icon">◇</span><div><small>NEXT OBJECTIVE</small><b>RESTORE THE GALLERY</b></div><strong>0/01</strong></div>
          <div className="story-footer"><span>DAILY CHALLENGE</span><span>UTC+8 · 00:00</span></div>
        </div>
        <section className="card auth-card game-card">
          <div className="panel-heading"><div><span className="panel-eyebrow">{register ? 'NEW PLAYER' : 'PLAYER LOGIN'}</span><h2>{register ? '建立馆长档案' : '继续探索'}</h2></div><span className="panel-code">{register ? '02' : '01'}<i>/02</i></span></div>
          <div className="xp-line"><span /><b>READY</b></div>
          {register && <label>邀请码<input autoFocus value={invite} onChange={(event) => setInvite(event.target.value.toUpperCase())} placeholder="输入邀请代码" /></label>}
          <label>馆长昵称<input autoFocus={!register} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="输入你的昵称" /></label>
          <label>访问密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="至少 8 位字符" onKeyDown={(event) => event.key === 'Enter' && void submit()} /></label>
          {message && <div className={`form-error ${messageType === 'success' ? 'form-success' : ''}`}>{message}</div>}
          <button className="primary auth-submit" disabled={busy} onClick={() => void submit()}><span>{busy ? '同步档案中...' : register ? '创建馆长档案' : '开始游戏'}</span><b>▶</b></button>
          <button className="link auth-switch" onClick={() => { setRegister(!register); setMessage(''); }}>{register ? '已有档案？返回登录' : '没有档案？使用邀请码加入'}</button>
          <div className="save-status"><span className="status-dot" /> 云端存档已启用 <span>·</span> 跨设备同步</div>
        </section>
      </section>
      <small className="auth-legal">FOLDING MUSEUM v0.1 · ALL SYSTEMS NOMINAL</small>
    </main>
  );
}

type RankItem = { username: string; score: number; moves: number; highest_tile: number; created_at: string };

function Admin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [items, setItems] = useState<Array<{ code: string; used_by: string | null; revoked: number }>>([]);
  const [error, setError] = useState('');
  const auth = () => `Basic ${btoa(`${username}:${password}`)}`;
  const load = async () => {
    try {
      const data = await api('/api/admin/invites', { headers: { Authorization: auth() } });
      setItems(data.items || []);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : '管理接口不可用');
    }
  };
  const create = async () => {
    try {
      const data = await api('/api/admin/invites', { method: 'POST', headers: { Authorization: auth() } });
      setCode(data.code);
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : '生成失败');
    }
  };
  const revoke = async (inviteCode: string) => {
    try {
      await api(`/api/admin/invites?code=${encodeURIComponent(inviteCode)}`, { method: 'DELETE', headers: { Authorization: auth() } });
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : '作废失败');
    }
  };
  return <main className="admin-page"><section className="card admin-card"><p className="eyebrow">CURATOR CONSOLE</p><h1>邀请码管理</h1><label>管理员账号<input value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>管理员密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><div className="admin-actions"><button className="primary" onClick={() => void load()}>读取邀请码</button><button onClick={() => void create()}>生成新邀请码</button></div>{code && <div className="invite-code">{code}</div>}{error && <p className="form-error">{error}</p>}<div className="invite-list">{items.map((item) => <div className="invite-row" key={item.code}><code>{item.code}</code><span>{item.used_by ? '已使用' : item.revoked ? '已作废' : '可使用'}</span>{!item.used_by && !item.revoked && <button onClick={() => void revoke(item.code)}>作废</button>}</div>)}</div></section></main>;
}

function Tutorial({ state, onSkip }: { state: GameState; onSkip: () => void }) {
  if (state.tutorialStep >= 4) return null;
  const steps = [
    ['01 / 04', '先选一个展柜', '点击棋盘里的任意展柜，查看它的边界。'],
    ['02 / 04', '旋转空间', '选好展柜后，点顺时针或逆时针，让文物重新排列。'],
    ['03 / 04', '折叠边界', '试试折叠边界，远处的展柜会短暂连在一起。'],
    ['04 / 04', '完成第一次合成', '让三个同等级文物相遇，就能把它们合成为更珍贵的藏品。'],
  ];
  const step = steps[Math.min(state.tutorialStep, steps.length - 1)];
  return <div className="tutorial-card"><div className="tutorial-kicker">{step[0]}</div><strong>{step[1]}</strong><p>{step[2]}</p><button className="link" onClick={onSkip}>跳过教学</button></div>;
}

function Leaderboard({ period, setPeriod }: { period: 'daily' | 'weekly' | 'all'; setPeriod: (value: 'daily' | 'weekly' | 'all') => void }) {
  const [items, setItems] = useState<RankItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api(`/api/leaderboard?period=${period}`).then((data) => setItems(data.items || [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, [period]);
  return <section className="rank card"><div className="rank-heading"><div><p className="eyebrow">GLOBAL ARCHIVE</p><h2>全球馆长榜</h2></div><span>TOP 50</span></div><div className="rank-tabs"><button className={period === 'daily' ? 'active' : ''} onClick={() => setPeriod('daily')}>今日</button><button className={period === 'weekly' ? 'active' : ''} onClick={() => setPeriod('weekly')}>本周</button><button className={period === 'all' ? 'active' : ''} onClick={() => setPeriod('all')}>总榜</button></div>{loading ? <p className="muted">正在调取馆藏记录…</p> : items.length ? <div className="rank-list">{items.map((item, index) => <div className={`rank-row rank-${index + 1}`} key={`${item.username}-${index}`}><strong>{String(index + 1).padStart(2, '0')}</strong><span><b>{item.username}</b><small>最高：{tileName(item.highest_tile)}</small></span><em>{item.score.toLocaleString()}<small>分 · {item.moves} 步</small></em></div>)}</div> : <p className="muted">还没有成绩，成为第一个挑战者吧。</p>}</section>;
}

function GameRoom({ user, onLogout }: { user: string; onLogout: () => void }) {
  const [state, setState] = useState<GameState>(() => createGame('challenge', todaySeed()));
  const [mode, setMode] = useState<Mode>('challenge');
  const [tab, setTab] = useState<'game' | 'rank'>('game');
  const [rankPeriod, setRankPeriod] = useState<'daily' | 'weekly' | 'all'>('daily');
  const [saved, setSaved] = useState(true);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const submitted = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    api('/api/save').then((data) => {
      if (!active) return;
      const fallback = createGame('challenge', todaySeed());
      if (!data.save?.payload) {
        setState(fallback);
        setMode(fallback.mode);
        return;
      }
      try {
        const stored = normalizeGameState(JSON.parse(data.save.payload), fallback);
        const currentChallenge = todaySeed();
        const restored = stored.mode === 'challenge' && stored.seed !== currentChallenge ? fallback : stored;
        setState(restored);
        setMode(restored.mode);
      } catch {
        setState(fallback);
        setMode(fallback.mode);
      }
    }).catch(() => setNotice('云端存档暂时不可用，本局仍可继续，操作后会自动重试。')).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saveState = (next: GameState, message?: string) => {
    setState(next);
    setMode(next.mode);
    setSaved(false);
    if (message) setNotice(message);
    api('/api/save', { method: 'POST', body: JSON.stringify(next) }).then(() => setSaved(true)).catch(() => setNotice('保存失败，请检查网络连接。'));
  };

  useEffect(() => {
    if (loading || state.mode !== 'challenge' || !state.gameOver) return;
    const key = `${state.seed}:${state.moves}:${state.score}`;
    if (submitted.current === key) return;
    submitted.current = key;
    api('/api/scores', { method: 'POST', body: JSON.stringify({ score: state.score, moves: state.moves, highestLevel: state.highestLevel, challengeDate: todayDate(), challengeVersion: 1 }) }).then(() => setNotice(state.status === 'won' ? '目标达成，成绩已进入今日排行榜。' : '本局结束，成绩已记录到今日排行榜。')).catch(() => setNotice('本局结束，但成绩提交失败。'));
  }, [loading, state]);

  const chooseCabinet = (cabinet: number) => saveState(selectCabinet(state, cabinet));
  const perform = (action: Parameters<typeof act>[1]) => {
    const next = act(state, action);
    if (next === state) return;
    saveState(next);
  };
  const undo = () => {
    const next = undoGame(state);
    if (next === state) return;
    saveState(next);
  };
  const newGame = (nextMode: Mode) => {
    const next = createGame(nextMode, nextMode === 'challenge' ? todaySeed() : Date.now());
    setNotice(nextMode === 'challenge' ? '今日地图已准备好，所有馆长面对同一座展柜。' : '自由展览已开启，不计入排行榜。');
    saveState(next);
    setTab('game');
  };
  const logout = () => { api('/api/auth/logout', { method: 'POST' }).finally(onLogout); };
  const progress = Math.min(100, Math.round((state.highestLevel / state.targetLevel) * 100));

  if (loading) return <div className="loading-screen"><span className="status-dot" /> 正在恢复云端展柜…</div>;
  return <div className="app museum-app">
    <header><div className="logo"><span>✦</span><div><b>折叠博物馆</b><small>THE FOLDING MUSEUM</small></div></div><div className="user"><span className="user-dot" />{user}<button onClick={logout}>退出</button></div></header>
    <nav><button className={tab === 'game' ? 'active' : ''} onClick={() => setTab('game')}>今日展柜</button><button className={tab === 'rank' ? 'active' : ''} onClick={() => setTab('rank')}>排行榜</button></nav>
    {notice && <div className="notice">{notice}</div>}
    {tab === 'rank' ? <Leaderboard period={rankPeriod} setPeriod={setRankPeriod} /> : <main className="game-layout">
      <aside className="museum-sidebar">
        <p className="eyebrow">{mode === 'challenge' ? 'DAILY CHALLENGE' : 'FREE EXHIBITION'}</p>
        <h1>{mode === 'challenge' ? '今日展柜' : '自由展览'}</h1>
        <p className="muted">{mode === 'challenge' ? `北京时区 · ${todayDate()}` : '练习空间折叠，不计入排行榜。'}</p>
        <div className="goal-card"><div><small>本局目标</small><b>{state.targetLevel >= 4 ? '修复珍贵展品' : '完成展柜整理'}</b></div><strong>{progress}%</strong><div className="goal-track"><i style={{ width: `${progress}%` }} /></div><span>最高等级：{tileName(state.highestLevel)} · 目标：{tileName(state.targetLevel)}</span></div>
        <div className="score"><small>当前藏品价值</small><strong>{state.score.toLocaleString()}</strong><span>分</span></div>
        <div className="stats"><div><b>{Math.max(0, 30 - state.moves)}</b><small>剩余步数</small></div><div><b>×{state.chain}</b><small>连锁倍率</small></div><div><b>{state.undoRemaining}</b><small>撤销次数</small></div></div>
        <div className="mode-buttons"><button className={mode === 'challenge' ? 'selected' : ''} onClick={() => newGame('challenge')}>每日挑战</button><button className={mode === 'free' ? 'selected' : ''} onClick={() => newGame('free')}>自由模式</button></div>
        <button className="undo-button" disabled={state.gameOver || state.undoRemaining <= 0 || state.history.length === 0} onClick={undo}>↶ 撤销上一步 <span>{state.undoRemaining} 次可用</span></button>
      </aside>
      <section className="board-wrap">
        <div className="board-head"><span>展柜 A · B · C · D</span><span className={saved ? 'saved' : 'unsaved'}>{saved ? '● 云端已保存' : '○ 保存中...'}</span></div>
        <div className={`board ${state.lastAction ? `action-${state.lastAction}` : ''}`}>
          {state.board.map((tile, index) => {
            const cabinet = Math.floor(index / 4 / 2) * 2 + Math.floor((index % 4) / 2);
            const selected = state.selectedCabinet === cabinet;
            const className = `tile ${index % 2 === 1 || Math.floor(index / 4) % 2 === 1 ? 'cabinet-edge' : ''}${selected ? ' selected' : ''}${tile && state.lastSpawnId === tile.id ? ' tile-spawn' : ''}${tile && state.lastMerge > 0 ? ' tile-merge' : ''}`;
            return <button className={className} key={`${index}-${tile?.id ?? 'empty'}-${tile?.level ?? 0}`} style={{ background: tile ? tileColor(tile.level) : 'transparent' }} onClick={() => chooseCabinet(cabinet)} aria-label={`展柜 ${String.fromCharCode(65 + cabinet)} ${tile ? tileName(tile.level) : '空位'}`}><span className="cabinet-mark">{String.fromCharCode(65 + cabinet)}</span>{tile && <><span className="tile-icon">{tileIcon(tile.level)}</span><small>{tileName(tile.level)}</small></>}</button>;
          })}
        </div>
        <div className="board-feedback" aria-live="polite"><span>{state.lastMessage}</span>{state.lastGained > 0 && <b>+{state.lastGained.toLocaleString()}</b>}</div>
        <div className="controls"><button disabled={state.gameOver || state.selectedCabinet === null} onClick={() => state.selectedCabinet !== null && perform({ type: 'rotate', cabinet: state.selectedCabinet, clockwise: false })}>↶ 逆时针</button><button className="primary" disabled={state.gameOver || state.selectedCabinet === null} onClick={() => state.selectedCabinet !== null && perform({ type: 'fold', cabinet: state.selectedCabinet })}>折叠边界</button><button disabled={state.gameOver || state.selectedCabinet === null} onClick={() => state.selectedCabinet !== null && perform({ type: 'rotate', cabinet: state.selectedCabinet, clockwise: true })}>顺时针 ↷</button></div>
        <p className="hint">选择一个展柜，再旋转它。折叠边界会把棋盘的远端边缘临时接在一起。</p>
        <Tutorial state={state} onSkip={() => saveState({ ...state, tutorialStep: 4, lastMessage: '教学已跳过，开始你的展柜整理。' })} />
        {state.gameOver && <div className={`finished card ${state.status === 'won' ? 'finished-win' : ''}`}><p className="eyebrow">{state.status === 'won' ? 'EXHIBITION RESTORED' : 'EXHIBITION CLOSED'}</p><h2>{state.status === 'won' ? '展品修复完成' : '展览结束'}</h2><p>本次藏品价值 <b>{state.score.toLocaleString()}</b> 分 · 最高 {tileName(state.highestLevel)}</p><button className="primary" onClick={() => newGame(mode)}>再来一局</button></div>}
      </section>
    </main>}
  </div>;
}

function App() {
  const [user, setUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => { api('/api/auth/me').then((data) => setUser(data.user?.username || null)).catch(() => setUser(null)).finally(() => setChecking(false)); }, []);
  if (window.location.pathname === '/admin') return <Admin />;
  if (checking) return <div className="loading-screen"><span className="status-dot" /> 正在连接博物馆…</div>;
  return user ? <GameRoom user={user} onLogout={() => setUser(null)} /> : <Auth onLogin={setUser} />;
}

export default App;
