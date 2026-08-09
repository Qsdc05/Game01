export type Tile = { id: number; level: number };
export type Mode = 'challenge' | 'free';
export type GameStatus = 'playing' | 'won' | 'lost';
export type GameAction =
  | { type: 'rotate'; cabinet: number; clockwise: boolean }
  | { type: 'fold'; cabinet: number };
export type ReplayAction = GameAction | { type: 'undo' };
export type AchievementId = 'first_merge' | 'folded_space' | 'combo_keeper' | 'masterpiece' | 'restored';

export const ACHIEVEMENTS: Array<{ id: AchievementId; name: string; description: string; icon: string }> = [
  { id: 'first_merge', name: '初次共鸣', description: '完成第一次合成', icon: '✦' },
  { id: 'folded_space', name: '空间折叠', description: '通过折叠边界完成合成', icon: '⌁' },
  { id: 'combo_keeper', name: '连锁守护者', description: '达到 ×3 连锁倍率', icon: '∞' },
  { id: 'masterpiece', name: '价值发现', description: '单局达到 1000 分', icon: '◇' },
  { id: 'restored', name: '修复展厅', description: '完成一局挑战', icon: '♛' },
];

type Snapshot = {
  board: (Tile | null)[];
  score: number;
  moves: number;
  chain: number;
  highestLevel: number;
  status: GameStatus;
  tutorialStep: number;
  actionLog: ReplayAction[];
};

export type GameState = {
  board: (Tile | null)[];
  score: number;
  moves: number;
  chain: number;
  selectedCabinet: number | null;
  mode: Mode;
  seed: number;
  gameOver: boolean;
  highestLevel: number;
  targetLevel: number;
  targetScore: number;
  status: GameStatus;
  undoRemaining: number;
  history: Snapshot[];
  tutorialStep: number;
  lastAction: 'rotate' | 'fold' | 'undo' | null;
  lastRotation: 'clockwise' | 'counterclockwise' | null;
  lastMerge: number;
  lastGained: number;
  lastSpawnId: number | null;
  lastMessage: string;
  actionLog: ReplayAction[];
  unlocked: AchievementId[];
  lastUnlocked: AchievementId | null;
};

export const MAX_MOVES = 30;
const LEVELS = ['碎陶片', '陶罐', '青铜器', '古币', '玉佩', '金面具', '王冠', '镇馆之宝'];
const COLORS = ['#d8a477', '#b8734e', '#6d8894', '#d8b85a', '#72a69b', '#c77478', '#ae82b9', '#efc35a'];
const ICONS = ['◈', '♜', '◉', '✧', '◇', '♢', '♛', '✦'];

export const tileName = (level: number) => LEVELS[Math.min(Math.max(level, 0), LEVELS.length - 1)] ?? '神秘文物';
export const tileColor = (level: number) => COLORS[Math.min(Math.max(level, 0), COLORS.length - 1)] ?? COLORS[0];
export const tileIcon = (level: number) => ICONS[Math.min(Math.max(level, 0), ICONS.length - 1)] ?? ICONS[0];
export const tileLevelCount = LEVELS.length;

function rng(seed: number) {
  let x = seed || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function cloneBoard(board: (Tile | null)[]) {
  return board.map((tile) => (tile ? { ...tile } : null));
}

function cabinetCells(cabinet: number) {
  const row = Math.floor(cabinet / 2) * 2;
  const col = (cabinet % 2) * 2;
  return [row * 4 + col, row * 4 + col + 1, (row + 1) * 4 + col, (row + 1) * 4 + col + 1];
}

function makeFreeBoard(seed: number) {
  const random = rng(seed);
  return Array.from({ length: 16 }, (_, id) => random() > 0.28 ? { id, level: Math.floor(random() * 3) } : null);
}

function makeChallengeBoard(seed: number) {
  // The challenge starts as a checkerboard instead of an already-complete match.
  // Rotating a cabinet then creates the first opportunity, so the player can see
  // why a move worked instead of winning on the first click.
  const layouts: Array<Array<number | null>> = [
    [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 2, 1, 1, 0, 1, null],
    [null, 1, 0, 1, 0, 1, 2, 0, 1, 0, 1, 0, 0, 1, 0, 1],
    [0, 1, 0, null, 1, 0, 2, 0, 0, 1, 0, 1, 1, 0, 1, 0],
    [1, 0, 1, 0, 0, 1, 0, 1, 1, 2, 1, 0, null, 1, 0, 1],
  ];
  const layout = layouts[Math.abs(seed) % layouts.length];
  return layout.map((level, id) => level === null ? null : { id, level });
}

function snapshot(state: GameState): Snapshot {
  return {
    board: cloneBoard(state.board),
    score: state.score,
    moves: state.moves,
    chain: state.chain,
    highestLevel: state.highestLevel,
    status: state.status,
    tutorialStep: state.tutorialStep,
    actionLog: [...state.actionLog],
  };
}

export function todayDate(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

export function todaySeed(date = new Date()) {
  const key = todayDate(date);
  return [...key].reduce((accumulator, character) => ((accumulator * 31 + character.charCodeAt(0)) >>> 0), 7);
}

export function createGame(mode: Mode = 'free', seed = Date.now()): GameState {
  const board = mode === 'challenge' ? makeChallengeBoard(seed) : makeFreeBoard(seed);
  return {
    board,
    score: 0,
    moves: 0,
    chain: 1,
    selectedCabinet: null,
    mode,
    seed,
    gameOver: false,
    highestLevel: Math.max(0, ...board.filter(Boolean).map((tile) => tile!.level)),
    targetLevel: mode === 'challenge' ? 4 : 5,
    targetScore: mode === 'challenge' ? 5000 : 2600,
    status: 'playing',
    undoRemaining: 3,
    history: [],
    tutorialStep: 0,
    lastAction: null,
    lastRotation: null,
    lastMerge: 0,
    lastGained: 0,
    lastSpawnId: null,
    lastMessage: '先选择一个展柜，看看里面藏着什么。',
    actionLog: [],
    unlocked: [],
    lastUnlocked: null,
  };
}

function rotate(board: (Tile | null)[], cabinet: number, clockwise: boolean) {
  const out = cloneBoard(board);
  const cells = cabinetCells(cabinet);
  const map = clockwise ? [2, 0, 3, 1] : [1, 3, 0, 2];
  cells.forEach((at, index) => { out[at] = board[cells[map[index]]] ? { ...board[cells[map[index]]]! } : null; });
  return out;
}

function addEdge(edges: Map<number, Set<number>>, a: number, b: number) {
  if (!edges.has(a)) edges.set(a, new Set());
  if (!edges.has(b)) edges.set(b, new Set());
  edges.get(a)!.add(b);
  edges.get(b)!.add(a);
}

function foldedEdges(cabinet: number) {
  const edges = new Map<number, Set<number>>();
  const row = Math.floor(cabinet / 2);
  const col = cabinet % 2;
  if (row === 0) {
    addEdge(edges, col * 2, 12 + col * 2);
    addEdge(edges, col * 2 + 1, 13 + col * 2);
  } else {
    addEdge(edges, 8 + col * 2, col * 2);
    addEdge(edges, 8 + col * 2 + 1, col * 2 + 1);
  }
  if (col === 0) {
    addEdge(edges, row * 8, row * 8 + 3);
    addEdge(edges, row * 8 + 4, row * 8 + 7);
  } else {
    addEdge(edges, row * 8 + 3, row * 8);
    addEdge(edges, row * 8 + 7, row * 8 + 4);
  }
  return edges;
}

function neighbors(index: number, foldCabinet: number | null) {
  const row = Math.floor(index / 4);
  const col = index % 4;
  const result = new Set<number>();
  if (row > 0) result.add(index - 4);
  if (row < 3) result.add(index + 4);
  if (col > 0) result.add(index - 1);
  if (col < 3) result.add(index + 1);
  if (foldCabinet !== null) foldedEdges(foldCabinet).get(index)?.forEach((next) => result.add(next));
  return result;
}

function resolveOnce(board: (Tile | null)[], foldCabinet: number | null) {
  const out = cloneBoard(board);
  const groups: number[][] = [];
  const seen = new Set<number>();
  out.forEach((tile, index) => {
    if (!tile || seen.has(index)) return;
    const group = [index];
    const queue = [index];
    seen.add(index);
    while (queue.length) {
      const current = queue.pop()!;
      neighbors(current, foldCabinet).forEach((next) => {
        if (!seen.has(next) && out[next]?.level === tile.level) {
          seen.add(next);
          group.push(next);
          queue.push(next);
        }
      });
    }
    if (group.length >= 3 && tile.level < tileLevelCount - 1) groups.push(group);
  });

  let gained = 0;
  let highest = 0;
  groups.forEach((group) => {
    const level = out[group[0]]!.level + 1;
    const first = group[0];
    group.forEach((index) => { out[index] = null; });
    out[first] = { id: out[first]?.id ?? first, level };
    gained += group.length * 100 * level;
    highest = Math.max(highest, level);
  });
  return { board: out, gained, merged: groups.length, highest };
}

function hasAvailableMerge(board: (Tile | null)[], foldCabinet: number | null = null) {
  return board.some((tile, index) => tile && [...neighbors(index, foldCabinet)].some((next) => board[next]?.level === tile.level));
}

function updateTutorial(step: number, action: GameAction, merged: number) {
  if (merged > 0) return Math.max(step, 4);
  if (step === 0) return 1;
  if (step === 1 && action.type === 'rotate') return 2;
  if (step <= 2 && action.type === 'fold') return 3;
  return step;
}

export function selectCabinet(state: GameState, cabinet: number): GameState {
  if (state.gameOver || cabinet < 0 || cabinet > 3) return state;
  return {
    ...state,
    selectedCabinet: cabinet,
    tutorialStep: Math.max(state.tutorialStep, 1),
    lastMerge: 0,
    lastGained: 0,
    lastSpawnId: null,
    lastRotation: null,
    lastUnlocked: null,
    lastMessage: `已选中展柜 ${String.fromCharCode(65 + cabinet)}，现在试试旋转。`,
  };
}

function unlockAchievements(state: GameState, action: GameAction, merged: number, chain: number, score: number, status: GameStatus) {
  const unlocked = new Set(state.unlocked);
  if (merged > 0) unlocked.add('first_merge');
  if (action.type === 'fold' && merged > 0) unlocked.add('folded_space');
  if (chain >= 3) unlocked.add('combo_keeper');
  if (score >= 1000) unlocked.add('masterpiece');
  if (status === 'won' && state.mode === 'challenge') unlocked.add('restored');
  const next = [...unlocked];
  return { unlocked: next, lastUnlocked: next.find((id) => !state.unlocked.includes(id)) ?? null };
}

export function act(state: GameState, action: GameAction): GameState {
  if (state.gameOver) return state;
  const history = [...state.history, snapshot(state)].slice(-8);
  const rotated = action.type === 'rotate' ? rotate(state.board, action.cabinet, action.clockwise) : cloneBoard(state.board);
  let board = rotated;
  let gained = 0;
  let merged = 0;
  let highestMerged = 0;
  let cascade = 0;
  while (true) {
    const result = resolveOnce(board, action.type === 'fold' ? action.cabinet : null);
    if (!result.merged) break;
    board = result.board;
    gained += result.gained * (cascade + 1);
    merged += result.merged;
    highestMerged = Math.max(highestMerged, result.highest);
    cascade += 1;
  }

  const empty = board.map((tile, index) => (tile ? -1 : index)).filter((index) => index >= 0);
  let spawnId: number | null = null;
  if (empty.length) {
    const random = rng(state.seed + state.moves * 97 + action.cabinet * 13 + 1);
    const at = empty[Math.floor(random() * empty.length)];
    spawnId = at + state.moves * 16 + 1000;
    board[at] = { id: spawnId, level: random() > 0.72 ? 1 : 0 };
  }

  const highestLevel = Math.max(state.highestLevel, highestMerged, ...board.filter(Boolean).map((tile) => tile!.level));
  const score = state.score + gained * (merged ? state.chain : 1);
  const targetReached = highestLevel >= state.targetLevel || score >= state.targetScore;
  const outOfMoves = state.moves + 1 >= MAX_MOVES;
  const blocked = empty.length === 0 && !hasAvailableMerge(board);
  const status: GameStatus = targetReached ? 'won' : outOfMoves || blocked ? 'lost' : 'playing';
  const achievementState = unlockAchievements(state, action, merged, Math.min(state.chain + cascade, 9), score, status);
  const message = achievementState.lastUnlocked
    ? `解锁馆藏成就：${ACHIEVEMENTS.find((item) => item.id === achievementState.lastUnlocked)?.name ?? '新发现'}。`
    : targetReached
      ? '目标达成！这件文物可以进入镇馆展厅。'
    : merged
      ? `发现 ${merged} 组共鸣，连锁 ×${Math.min(state.chain + cascade, 9)}！`
      : action.type === 'fold'
        ? '边界折叠完成，远处的展柜被拉到了一起。'
        : action.clockwise ? '展柜顺时针旋转。' : '展柜逆时针旋转。';

  return {
    ...state,
    board,
    score,
    moves: state.moves + 1,
    chain: merged ? Math.min(state.chain + cascade, 9) : 1,
    selectedCabinet: null,
    gameOver: status !== 'playing',
    highestLevel,
    status,
    history,
    tutorialStep: updateTutorial(state.tutorialStep, action, merged),
    lastAction: action.type,
    lastRotation: action.type === 'rotate' ? (action.clockwise ? 'clockwise' : 'counterclockwise') : null,
    lastMerge: merged,
    lastGained: gained,
    lastSpawnId: spawnId,
    lastMessage: message,
    actionLog: [...state.actionLog, action],
    unlocked: achievementState.unlocked,
    lastUnlocked: achievementState.lastUnlocked,
  };
}

export function undoGame(state: GameState): GameState {
  if (!state.history.length || state.undoRemaining <= 0) {
    return { ...state, lastMessage: state.undoRemaining <= 0 ? '本局撤销次数已经用完。' : '还没有可以撤销的操作。' };
  }
  const previous = state.history[state.history.length - 1];
  return {
    ...state,
    ...previous,
    board: cloneBoard(previous.board),
    selectedCabinet: null,
    gameOver: previous.status !== 'playing',
    history: state.history.slice(0, -1),
    undoRemaining: state.undoRemaining - 1,
    lastAction: 'undo',
    lastRotation: null,
    lastMerge: 0,
    lastGained: 0,
    lastSpawnId: null,
    lastMessage: '已回到上一步，重新规划你的展柜。',
    actionLog: [...state.actionLog, { type: 'undo' }],
  };
}

export function normalizeGameState(value: unknown, fallback: GameState): GameState {
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Partial<GameState>;
  if (!Array.isArray(raw.board) || raw.board.length !== 16) return fallback;
  const board = raw.board.map((tile) => tile && typeof tile === 'object' && typeof tile.level === 'number'
    ? { id: typeof tile.id === 'number' ? tile.id : Math.random(), level: Math.max(0, Math.min(tileLevelCount - 1, tile.level)) }
    : null);
  const status: GameStatus = raw.status === 'won' || raw.status === 'lost' ? raw.status : 'playing';
  return {
    ...fallback,
    ...raw,
    board,
    mode: raw.mode === 'challenge' ? 'challenge' : 'free',
    seed: typeof raw.seed === 'number' ? raw.seed : fallback.seed,
    score: typeof raw.score === 'number' ? Math.max(0, raw.score) : 0,
    moves: typeof raw.moves === 'number' ? Math.max(0, Math.min(MAX_MOVES, raw.moves)) : 0,
    chain: typeof raw.chain === 'number' ? Math.max(1, Math.min(9, raw.chain)) : 1,
    selectedCabinet: typeof raw.selectedCabinet === 'number' && raw.selectedCabinet >= 0 && raw.selectedCabinet <= 3 ? raw.selectedCabinet : null,
    gameOver: status !== 'playing',
    highestLevel: typeof raw.highestLevel === 'number' ? raw.highestLevel : 0,
    targetLevel: typeof raw.targetLevel === 'number' ? raw.targetLevel : fallback.targetLevel,
    targetScore: typeof raw.targetScore === 'number' ? raw.targetScore : fallback.targetScore,
    status,
    undoRemaining: typeof raw.undoRemaining === 'number' ? Math.max(0, Math.min(3, raw.undoRemaining)) : 3,
    history: Array.isArray(raw.history) ? raw.history.slice(-8) as Snapshot[] : [],
    tutorialStep: typeof raw.tutorialStep === 'number' ? Math.max(0, Math.min(5, raw.tutorialStep)) : 0,
    lastAction: raw.lastAction === 'rotate' || raw.lastAction === 'fold' || raw.lastAction === 'undo' ? raw.lastAction : null,
    lastRotation: raw.lastRotation === 'clockwise' || raw.lastRotation === 'counterclockwise' ? raw.lastRotation : null,
    lastMerge: typeof raw.lastMerge === 'number' ? raw.lastMerge : 0,
    lastGained: typeof raw.lastGained === 'number' ? raw.lastGained : 0,
    lastSpawnId: typeof raw.lastSpawnId === 'number' ? raw.lastSpawnId : null,
    lastMessage: typeof raw.lastMessage === 'string' ? raw.lastMessage : fallback.lastMessage,
    actionLog: Array.isArray(raw.actionLog) ? raw.actionLog.filter(isReplayAction).slice(-120) : [],
    unlocked: Array.isArray(raw.unlocked) ? raw.unlocked.filter((id): id is AchievementId => ACHIEVEMENTS.some((item) => item.id === id)) : [],
    lastUnlocked: typeof raw.lastUnlocked === 'string' && ACHIEVEMENTS.some((item) => item.id === raw.lastUnlocked) ? raw.lastUnlocked as AchievementId : null,
  };
}

function isReplayAction(value: unknown): value is ReplayAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as Partial<ReplayAction>;
  if (action.type === 'undo') return true;
  return (action.type === 'rotate' && typeof action.cabinet === 'number' && Number.isInteger(action.cabinet) && action.cabinet >= 0 && action.cabinet <= 3 && typeof action.clockwise === 'boolean')
    || (action.type === 'fold' && typeof action.cabinet === 'number' && Number.isInteger(action.cabinet) && action.cabinet >= 0 && action.cabinet <= 3);
}

export function validateChallengeResult(seed: number, actions: ReplayAction[], expected: { score: number; moves: number; highestLevel: number }) {
  if (!Number.isInteger(seed) || actions.length < 1 || actions.length > 120) return false;
  if (!actions.every(isReplayAction)) return false;
  const replayed = simulateChallenge(seed, actions);
  return replayed.actionLog.length === actions.length
    && replayed.gameOver
    && replayed.score === expected.score
    && replayed.moves === expected.moves
    && replayed.highestLevel === expected.highestLevel;
}

export function simulateChallenge(seed: number, actions: ReplayAction[]) {
  let state = createGame('challenge', seed);
  for (const action of actions) {
    if (action.type === 'undo') state = undoGame(state);
    else state = act(state, action);
  }
  return state;
}
