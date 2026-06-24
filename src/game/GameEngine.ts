import type { GameStateData } from './types';
import { useGameStore } from './store';
import { InputManager } from './InputManager';
import { GameRenderer } from './renderer';
import { updateGame } from './logic';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: GameRenderer;
  private input: InputManager;
  private rafId: number = 0;
  private running: boolean = false;
  private lastPushTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.renderer = new GameRenderer(ctx);
    this.input = new InputManager();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now: number) => {
      if (!this.running) return;
      this.tick(now);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  destroy() {
    this.stop();
    this.input.destroy();
  }

  private tick(now: number) {
    const snap = useGameStore.getState();
    if (snap.scene !== 'playing') {
      this.renderFrame(snap, now);
      this.input.endFrame();
      return;
    }

    useGameStore.getState().updateRaw((state) => {
      updateGame(state, this.input as unknown as Parameters<typeof updateGame>[1], now);
    });

    const after = useGameStore.getState();
    this.renderFrame(after, now);
    this.input.endFrame();

    if (now - this.lastPushTime > 100) {
      this.lastPushTime = now;
      useGameStore.setState({});
    }
  }

  private renderFrame(state: GameStateData, now: number) {
    this.renderer.render(state, now);
  }
}
