import { describe, expect, it } from 'vitest';
import { createGame, todaySeed, act } from '../src/game';
describe('folding museum engine',()=>{it('creates deterministic daily boards within Beijing date',()=>{expect(todaySeed(new Date('2026-08-09T00:00:00Z'))).toBe(todaySeed(new Date('2026-08-09T15:59:59Z')))});it('rotates a selected cabinet and spends a move',()=>{const game=createGame('free',42);const next=act(game,{type:'rotate',cabinet:0,clockwise:true});expect(next.moves).toBe(1);expect(next.board).not.toEqual(game.board)});});
