import { describe, expect, it } from 'vitest';
import { act, createGame, normalizeGameState, todaySeed, undoGame } from '../src/game';

describe('folding museum engine', () => {
  it('creates deterministic daily boards within Beijing date', () => {
    expect(todaySeed(new Date('2026-08-09T00:00:00Z'))).toBe(todaySeed(new Date('2026-08-09T15:59:59Z')));
  });

  it('starts with a curated playable challenge and empty space', () => {
    const game = createGame('challenge', 42);
    expect(game.board.some((tile) => tile === null)).toBe(true);
    expect(game.board.filter((tile) => tile?.level === 0).length).toBeGreaterThanOrEqual(3);
  });

  it('rotates a selected cabinet and spends a move without ending immediately', () => {
    const game = createGame('free', 42);
    const next = act(game, { type: 'rotate', cabinet: 0, clockwise: true });
    expect(next.moves).toBe(1);
    expect(next.gameOver).toBe(false);
  });

  it('merges three matching relics and awards feedback', () => {
    const game = createGame('free', 42);
    const board = Array.from({ length: 16 }, () => null);
    board[0] = { id: 1, level: 0 };
    board[1] = { id: 2, level: 0 };
    board[4] = { id: 3, level: 0 };
    const next = act({ ...game, board, highestLevel: 0 }, { type: 'rotate', cabinet: 0, clockwise: true });
    expect(next.lastMerge).toBeGreaterThan(0);
    expect(next.lastGained).toBeGreaterThan(0);
    expect(next.highestLevel).toBeGreaterThanOrEqual(1);
  });

  it('uses a folded edge to connect distant relics', () => {
    const game = createGame('free', 42);
    const board = Array.from({ length: 16 }, () => null);
    board[0] = { id: 1, level: 0 };
    board[3] = { id: 2, level: 0 };
    board[12] = { id: 3, level: 0 };
    const next = act({ ...game, board, highestLevel: 0 }, { type: 'fold', cabinet: 0 });
    expect(next.lastMerge).toBeGreaterThan(0);
  });

  it('undoes the latest move and consumes one undo charge', () => {
    const game = createGame('free', 42);
    const moved = act(game, { type: 'rotate', cabinet: 0, clockwise: true });
    const restored = undoGame(moved);
    expect(restored.moves).toBe(game.moves);
    expect(restored.score).toBe(game.score);
    expect(restored.undoRemaining).toBe(game.undoRemaining - 1);
    expect(restored.lastAction).toBe('undo');
  });

  it('keeps a valid state shape after restoring a legacy save', () => {
    const game = createGame('challenge', 42);
    const legacy = { board: game.board, score: 20, moves: 2, mode: 'challenge', seed: 42 };
    const normalized = normalizeGameState(legacy, game);
    expect(normalized.targetLevel).toBeGreaterThan(0);
    expect(normalized.history).toEqual([]);
    expect(normalized.gameOver).toBe(false);
  });
});
