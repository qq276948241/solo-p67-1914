import type { GameStateData, Vec2, Direction, DogState } from './types';
import {
  TILE_SIZE,
  MAP_WIDTH,
  MAP_HEIGHT,
  VIEW_W,
  VIEW_H,
  PLAYER_W,
  PLAYER_H,
  ROLL_DURATION,
  INTERACT_RANGE,
  CAMPFIRE_WARM_RANGE,
} from './constants';

const TILE_COLORS = [
  '#3d3d3d',
  '#4a4a4a',
  '#555555',
];

const RUBBLE_COLORS = [
  '#2a2a2a',
  '#333333',
  '#5c5c5c',
  '#6a6a6a',
];

function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function dirToAngle(d: Direction): number {
  switch (d) {
    case 'up': return 0;
    case 'right': return 1;
    case 'down': return 2;
    case 'left': return 3;
  }
}

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private camera: Vec2 = { x: 0, y: 0 };

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  render(state: GameStateData, now: number): void {
    const ctx = this.ctx;
    const { player } = state;

    ctx.imageSmoothingEnabled = false;

    this.camera.x = clamp(player.pos.x - VIEW_W / 2, 0, MAP_WIDTH - VIEW_W);
    this.camera.y = clamp(player.pos.y - VIEW_H / 2, 0, MAP_HEIGHT - VIEW_H);

    let shakeX = 0;
    let shakeY = 0;
    if (state.cameraShakeUntil > now) {
      shakeX = (Math.random() - 0.5) * 4;
      shakeY = (Math.random() - 0.5) * 4;
    }

    ctx.save();
    ctx.translate(-Math.floor(this.camera.x) + shakeX, -Math.floor(this.camera.y) + shakeY);

    this.clear();
    this.drawTiles();
    this.drawBuildSpots(state);
    this.drawResources(state);
    this.drawDogs(state, now);
    this.drawPlayer(state, now);
    this.drawInteractHints(state);
    this.drawCampfireGlow(state, now);
    ctx.restore();
    this.drawNightOverlay(state, now);
    ctx.save();
    ctx.translate(-Math.floor(this.camera.x) + shakeX, -Math.floor(this.camera.y) + shakeY);
    this.drawFloatMessages(state, now);
    ctx.restore();
  }

  private clear(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(Math.floor(this.camera.x), Math.floor(this.camera.y), VIEW_W, VIEW_H);
  }

  private drawTiles(): void {
    const ctx = this.ctx;
    const startCol = Math.floor(this.camera.x / TILE_SIZE);
    const endCol = Math.ceil((this.camera.x + VIEW_W) / TILE_SIZE);
    const startRow = Math.floor(this.camera.y / TILE_SIZE);
    const endRow = Math.ceil((this.camera.y + VIEW_H) / TILE_SIZE);
    const maxCol = Math.ceil(MAP_WIDTH / TILE_SIZE);
    const maxRow = Math.ceil(MAP_HEIGHT / TILE_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (col < 0 || row < 0 || col >= maxCol || row >= maxRow) continue;

        const tileX = col * TILE_SIZE;
        const tileY = row * TILE_SIZE;
        const seed = row * 1000 + col;
        const colorIdx = Math.floor(seededRand(seed) * TILE_COLORS.length);

        ctx.fillStyle = TILE_COLORS[colorIdx];
        ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);

        const rubbleCount = 3 + Math.floor(seededRand(seed * 7) * 4);
        for (let i = 0; i < rubbleCount; i++) {
          const rx = tileX + Math.floor(seededRand(seed * 13 + i * 31) * (TILE_SIZE - 6));
          const ry = tileY + Math.floor(seededRand(seed * 17 + i * 41) * (TILE_SIZE - 6));
          const rw = 2 + Math.floor(seededRand(seed * 19 + i * 53) * 5);
          const rh = 2 + Math.floor(seededRand(seed * 23 + i * 61) * 5);
          const rcIdx = Math.floor(seededRand(seed * 29 + i * 71) * RUBBLE_COLORS.length);
          ctx.fillStyle = RUBBLE_COLORS[rcIdx];
          ctx.fillRect(rx, ry, rw, rh);
        }

        if (seededRand(seed * 37) > 0.7) {
          ctx.strokeStyle = '#262626';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const lx1 = tileX + Math.floor(seededRand(seed * 41) * TILE_SIZE);
          const ly1 = tileY;
          const lx2 = lx1 + Math.floor(seededRand(seed * 43) * 8) - 4;
          const ly2 = tileY + TILE_SIZE;
          ctx.moveTo(lx1, ly1);
          ctx.lineTo(lx2, ly2);
          ctx.stroke();
        }
      }
    }
  }

  private drawBuildSpots(state: GameStateData): void {
    const ctx = this.ctx;
    for (const spot of state.buildSpots) {
      const sx = Math.floor(spot.pos.x);
      const sy = Math.floor(spot.pos.y);
      const size = 64;

      if (!spot.building) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(sx, sy, size, size);
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(sx + 2, sy + 2, size - 4, size - 4);
      } else if (spot.building === 'wall') {
        ctx.fillStyle = '#6b5846';
        ctx.fillRect(sx, sy, size, size);

        const brickW = 16;
        const brickH = 10;
        for (let r = 0; r < Math.ceil(size / brickH); r++) {
          const offset = (r % 2) * (brickW / 2);
          for (let c = 0; c < Math.ceil(size / brickW); c++) {
            const bx = sx + c * brickW + offset;
            const by = sy + r * brickH;
            if (bx >= sx && bx + brickW <= sx + size) {
              ctx.fillStyle = (r + c) % 2 === 0 ? '#7a6650' : '#5c4a3a';
              ctx.fillRect(bx, by, brickW - 1, brickH - 1);
            }
          }
        }
        ctx.strokeStyle = '#3a2f25';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, size, size);
      } else if (spot.building === 'campfire') {
        const cx = sx + size / 2;
        const cy = sy + size / 2;

        ctx.fillStyle = '#4a3a28';
        ctx.fillRect(sx + 8, sy + 48, size - 16, 10);
        ctx.fillStyle = '#3a2e22';
        ctx.fillRect(sx + 12, sy + 50, size - 24, 6);

        const stoneColors = ['#5a5a5a', '#6a6a6a', '#4a4a4a', '#555555'];
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const r = 20 + Math.sin(i * 3) * 3;
          const stx = Math.floor(cx + Math.cos(angle) * r - 4);
          const sty = Math.floor(cy + 8 + Math.sin(angle) * (r * 0.4) - 3);
          ctx.fillStyle = stoneColors[i % stoneColors.length];
          ctx.fillRect(stx, sty, 8, 6);
        }

        const t = performance.now();
        const baseY = sy + 46;
        if (spot.campfireLit) {
          const flicker1 = Math.sin(t / 80) * 2;
          ctx.fillStyle = '#ff6a00';
          ctx.beginPath();
          ctx.ellipse(cx, baseY - 8 + flicker1, 12, 16, 0, 0, Math.PI * 2);
          ctx.fill();

          const flicker2 = Math.sin(t / 55 + 1) * 3;
          ctx.fillStyle = '#ffae00';
          ctx.beginPath();
          ctx.ellipse(cx, baseY - 12 + flicker2, 8, 12, 0, 0, Math.PI * 2);
          ctx.fill();

          const flicker3 = Math.sin(t / 40 + 2) * 2;
          ctx.fillStyle = '#fff3a0';
          ctx.beginPath();
          ctx.ellipse(cx, baseY - 14 + flicker3, 4, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          for (let i = 0; i < 3; i++) {
            const px = cx + Math.sin(t / 200 + i * 2) * 6;
            const py = baseY - 20 - (t / 30 + i * 10) % 18;
            const pa = 1 - ((t / 30 + i * 10) % 18) / 18;
            ctx.fillStyle = `rgba(255,${180 + i * 20},0,${pa})`;
            ctx.fillRect(Math.floor(px), Math.floor(py), 2, 2);
          }
        } else {
          ctx.fillStyle = '#2a2018';
          ctx.beginPath();
          ctx.ellipse(cx, baseY - 4, 10, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (spot.building === 'water_purifier') {
        ctx.fillStyle = '#1f4e79';
        ctx.fillRect(sx + 8, sy + 16, 48, 44);

        ctx.fillStyle = '#2a6ba3';
        ctx.fillRect(sx + 10, sy + 18, 44, 18);

        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(sx + 14, sy + 10, 12, 8);
        ctx.fillRect(sx + 14, sy + 8, 12, 4);

        ctx.fillStyle = '#d0d0d0';
        ctx.fillRect(sx + 40, sy + 26, 6, 30);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(sx + 38, sy + 22, 10, 6);

        const t = performance.now();
        const dripPhase = (t / 400) % 1;
        ctx.fillStyle = 'rgba(100, 200, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(sx + 43, sy + 56 + dripPhase * 6, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(150, 220, 255, 0.5)';
        ctx.fillRect(sx + 16, sy + 32, 16, 10);
        const waveY = sy + 36 + Math.sin(t / 150) * 2;
        ctx.fillStyle = 'rgba(180, 230, 255, 0.7)';
        ctx.fillRect(sx + 18, waveY, 12, 4);

        ctx.strokeStyle = '#153858';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 8, sy + 16, 48, 44);

        ctx.fillStyle = '#3d8bc4';
        ctx.fillRect(sx + 12, sy + 20, 2, 36);
        ctx.fillRect(sx + 52, sy + 20, 2, 36);
      }
    }
  }

  private drawResources(state: GameStateData): void {
    const ctx = this.ctx;
    for (const res of state.resources) {
      const rx = Math.floor(res.pos.x);
      const ry = Math.floor(res.pos.y);

      ctx.save();
      if (res.looted) {
        ctx.globalAlpha = 0.35;
      }

      if (res.type === 'car') {
        const bodyColor = res.looted ? '#6a5050' : '#8b2a2a';
        const darkColor = res.looted ? '#4a3838' : '#5a1818';
        const trimColor = res.looted ? '#4a4a4a' : '#2e2e2e';
        const glassColor = res.looted ? '#555555' : '#3a5568';

        ctx.fillStyle = trimColor;
        ctx.fillRect(rx + 2, ry + 22, 52, 16);

        ctx.fillStyle = bodyColor;
        ctx.fillRect(rx + 4, ry + 10, 48, 34);

        ctx.fillStyle = darkColor;
        ctx.fillRect(rx + 4, ry + 38, 48, 6);

        ctx.fillStyle = bodyColor;
        ctx.fillRect(rx + 10, ry + 2, 36, 14);

        ctx.fillStyle = glassColor;
        ctx.fillRect(rx + 14, ry + 5, 12, 9);
        ctx.fillRect(rx + 30, ry + 5, 12, 9);

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(rx + 8, ry + 40, 10, 10);
        ctx.fillRect(rx + 38, ry + 40, 10, 10);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(rx + 11, ry + 43, 4, 4);
        ctx.fillRect(rx + 41, ry + 43, 4, 4);

        if (!res.looted) {
          ctx.fillStyle = '#c42020';
          ctx.fillRect(rx + 50, ry + 14, 4, 12);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(rx + 51, ry + 16, 2, 3);
        } else {
          ctx.strokeStyle = '#2a1818';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rx + 16, ry + 12);
          ctx.lineTo(rx + 24, ry + 22);
          ctx.moveTo(rx + 36, ry + 14);
          ctx.lineTo(rx + 40, ry + 20);
          ctx.stroke();
        }
      } else if (res.type === 'store') {
        const wallColor = res.looted ? '#5a6a5a' : '#3e7d48';
        const darkWall = res.looted ? '#4a5848' : '#2d5e35';
        const signColor = res.looted ? '#8a9a8a' : '#6ec46a';

        ctx.fillStyle = darkWall;
        ctx.fillRect(rx, ry + 10, 60, 42);

        ctx.fillStyle = wallColor;
        ctx.fillRect(rx + 2, ry + 12, 56, 38);

        ctx.fillStyle = signColor;
        ctx.fillRect(rx + 4, ry, 52, 14);

        ctx.fillStyle = res.looted ? '#5a6a5a' : '#2d5e35';
        ctx.fillRect(rx + 6, ry + 3, 48, 8);

        if (!res.looted) {
          ctx.fillStyle = '#ffffff';
          const text = 'MART';
          ctx.font = 'bold 9px monospace';
          ctx.textBaseline = 'top';
          ctx.fillText(text, rx + 15, ry + 3);
        } else {
          ctx.fillStyle = '#3a4a3a';
          ctx.fillRect(rx + 10, ry + 4, 8, 6);
          ctx.fillRect(rx + 32, ry + 2, 12, 8);
        }

        ctx.fillStyle = '#1a2a1a';
        ctx.fillRect(rx + 22, ry + 26, 16, 24);
        if (!res.looted) {
          ctx.fillStyle = '#2a3a2a';
          ctx.fillRect(rx + 36, ry + 2, 2, 24);
        }

        ctx.fillStyle = res.looted ? '#3a4a3a' : '#1f4a28';
        ctx.fillRect(rx + 6, ry + 26, 12, 14);
        ctx.fillRect(rx + 42, ry + 26, 12, 14);

        if (res.looted) {
          ctx.strokeStyle = '#1a2a1a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rx + 8, ry + 14);
          ctx.lineTo(rx + 14, ry + 22);
          ctx.moveTo(rx + 48, ry + 16);
          ctx.lineTo(rx + 52, ry + 24);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  private drawDogs(state: GameStateData, now: number): void {
    const ctx = this.ctx;
    for (const dog of state.dogs) {
      const dx = Math.floor(dog.pos.x);
      const dy = Math.floor(dog.pos.y);

      const flip = dog.facing === 'left';

      let pulseScale = 1;
      let pulseAlpha = 1;
      if (dog.state === 'windup') {
        const t = Math.sin(now / 60) * 0.5 + 0.5;
        pulseScale = 1 + t * 0.18;
        pulseAlpha = 1 - t * 0.25;
      }

      ctx.save();
      ctx.translate(dx + 6, dy + 8);
      if (flip) ctx.scale(-1, 1);
      ctx.scale(pulseScale, pulseScale);
      ctx.globalAlpha = pulseAlpha;

      const runFrame = Math.floor(now / 120) % 2;
      const isRunning = dog.state === 'chase';
      const legOffset1 = isRunning ? (runFrame === 0 ? -2 : 2) : 0;
      const legOffset2 = isRunning ? (runFrame === 0 ? 2 : -2) : 0;

      if (dog.state === 'windup') {
        ctx.fillStyle = 'rgba(200, 40, 40, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#7a5230';
      ctx.fillRect(-5, -2, 14, 8);

      ctx.fillStyle = '#8b5e34';
      ctx.fillRect(7, -6, 9, 8);

      ctx.fillStyle = '#6a4428';
      ctx.fillRect(13, -8, 2, 3);
      ctx.fillRect(10, -8, 2, 3);

      if (dog.state === 'windup' || dog.state === 'chase' || dog.state === 'attack') {
        ctx.fillStyle = '#ff3030';
        ctx.fillRect(14, -4, 2, 2);
      } else {
        ctx.fillStyle = '#201010';
        ctx.fillRect(14, -4, 2, 2);
      }

      ctx.fillStyle = '#8b5e34';
      ctx.fillRect(-8, 0, 4, 3);
      ctx.fillStyle = '#6a4428';
      ctx.fillRect(-9, 1, 2, 2);

      ctx.fillStyle = '#6a4428';
      ctx.fillRect(-3 + legOffset1, 6, 3, 5);
      ctx.fillRect(5 + legOffset2, 6, 3, 5);
      ctx.fillRect(0 + legOffset2, 6, 3, 5);
      ctx.fillRect(8 + legOffset1, 6, 3, 5);

      ctx.fillStyle = '#4a3020';
      ctx.fillRect(-3 + legOffset1, 10, 3, 1);
      ctx.fillRect(5 + legOffset2, 10, 3, 1);
      ctx.fillRect(0 + legOffset2, 10, 3, 1);
      ctx.fillRect(8 + legOffset1, 10, 3, 1);

      if (dog.state === 'attack' || dog.state === 'windup') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(15, -2, 1, 1);
        ctx.fillRect(13, -1, 1, 1);
      }

      ctx.restore();

      const hpBarW = 22;
      const hpPct = clamp(dog.hp / 30, 0, 1);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(dx - 2, dy - 8, hpBarW, 4);
      ctx.fillStyle = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#ff9800' : '#f44336';
      ctx.fillRect(dx - 1, dy - 7, Math.floor((hpBarW - 2) * hpPct), 2);
    }
  }

  private drawPlayer(state: GameStateData, now: number): void {
    const ctx = this.ctx;
    const { player } = state;
    const px = Math.floor(player.pos.x);
    const py = Math.floor(player.pos.y);

    let scaleX = 1;
    let alpha = 1;
    if (player.isRolling) {
      const t = (now - player.rollStartTime) / ROLL_DURATION;
      const ct = clamp(t, 0, 1);
      scaleX = 1 + Math.sin(ct * Math.PI) * 0.6;
      alpha = 1 - ct * 0.25;
    }

    if (player.invincibleUntil > now) {
      if (Math.floor(now / 80) % 2 === 0) {
        alpha *= 0.5;
      }
    }

    const flip = player.direction === 'left';
    const dirAngle = dirToAngle(player.direction);

    ctx.save();
    ctx.translate(px + PLAYER_W / 2, py + PLAYER_H / 2);
    if (flip) ctx.scale(-1, 1);
    ctx.scale(scaleX, 1);
    ctx.globalAlpha = alpha;
    ctx.translate(-PLAYER_W / 2, -PLAYER_H / 2);

    const walkFrame = Math.floor(now / 180) % 2;
    const isMoving = player.isRolling || false;
    const legOff = isMoving ? (walkFrame === 0 ? -1 : 1) : 0;

    ctx.fillStyle = '#6b4423';
    ctx.fillRect(2, 18, 5, 6 + legOff);
    ctx.fillRect(9, 18, 5, 6 - legOff);
    ctx.fillStyle = '#4a2e18';
    ctx.fillRect(2, 23 + legOff, 5, 1);
    ctx.fillRect(9, 23 - legOff, 5, 1);

    ctx.fillStyle = '#4a9b3e';
    ctx.fillRect(1, 9, 14, 10);
    ctx.fillStyle = '#3d8034';
    ctx.fillRect(1, 17, 14, 2);

    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(4, 3, 8, 8);
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(4, 3, 8, 2);

    ctx.fillStyle = '#1a1a1a';
    if (dirAngle === 0) {
      ctx.fillRect(6, 5, 1, 2);
      ctx.fillRect(9, 5, 1, 2);
    } else if (dirAngle === 2) {
      ctx.fillRect(6, 7, 1, 2);
      ctx.fillRect(9, 7, 1, 2);
    } else {
      ctx.fillRect(9, 6, 2, 2);
    }

    ctx.fillStyle = '#3d8034';
    ctx.fillRect(0, 11, 2, 6);
    ctx.fillRect(14, 11, 2, 6);
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(0, 16, 2, 2);
    ctx.fillRect(14, 16, 2, 2);

    ctx.restore();

    const hpBarW = 20;
    const hpPct = clamp(player.hp / 100, 0, 1);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(px - 2, py - 6, hpBarW, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(px - 1, py - 5, Math.floor((hpBarW - 2) * hpPct), 2);
  }

  private drawInteractHints(state: GameStateData): void {
    const ctx = this.ctx;
    const { player } = state;
    const px = player.pos.x + PLAYER_W / 2;
    const py = player.pos.y;

    let target: { pos: Vec2; label: string } | null = null;
    let minDist = INTERACT_RANGE;

    for (const res of state.resources) {
      if (res.looted) continue;
      const cx = res.pos.x + 30;
      const cy = res.pos.y + 25;
      const dx = cx - px;
      const dy = cy - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) {
        minDist = d;
        target = { pos: { x: cx, y: res.pos.y - 6 }, label: '按E搜刮' };
      }
    }

    for (const spot of state.buildSpots) {
      const cx = spot.pos.x + 32;
      const cy = spot.pos.y + 32;
      const dx = cx - px;
      const dy = cy - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) {
        minDist = d;
        if (!spot.building) {
          target = { pos: { x: cx, y: spot.pos.y - 6 }, label: '按E建造' };
        } else if (spot.building === 'campfire') {
          target = { pos: { x: cx, y: spot.pos.y - 6 }, label: '按E加木' };
        } else if (spot.building === 'water_purifier') {
          target = { pos: { x: cx, y: spot.pos.y - 6 }, label: '按E饮水' };
        } else {
          target = { pos: { x: cx, y: spot.pos.y - 6 }, label: '按E操作' };
        }
      }
    }

    if (target) {
      ctx.font = 'bold 12px "Microsoft YaHei", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const tw = ctx.measureText(target.label).width;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(Math.floor(target.pos.x - tw / 2 - 4), Math.floor(target.pos.y - 14), Math.floor(tw + 8), 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(target.label, target.pos.x, target.pos.y);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
  }

  private drawCampfireGlow(state: GameStateData, now: number): void {
    const ctx = this.ctx;
    const { dayNight, buildSpots, player } = state;
    if (dayNight.phase !== 'night') return;

    for (const spot of buildSpots) {
      if (spot.building !== 'campfire' || !spot.campfireLit) continue;
      const cx = spot.pos.x + 32;
      const cy = spot.pos.y + 32;
      const px = player.pos.x + PLAYER_W / 2;
      const py = player.pos.y + PLAYER_H / 2;
      const dx = cx - px;
      const dy = cy - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > CAMPFIRE_WARM_RANGE * 1.8) continue;

      const flicker = Math.sin(now / 120) * 0.12 + 1;
      const radius = CAMPFIRE_WARM_RANGE * flicker;

      const grd = ctx.createRadialGradient(cx, cy, 8, cx, cy, radius);
      grd.addColorStop(0, 'rgba(255, 190, 80, 0.45)');
      grd.addColorStop(0.4, 'rgba(255, 140, 40, 0.22)');
      grd.addColorStop(1, 'rgba(255, 80, 20, 0)');

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grd;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();
    }
  }

  private drawNightOverlay(state: GameStateData, now: number): void {
    const ctx = this.ctx;
    const { dayNight, player } = state;

    if (dayNight.phase === 'day') {
      ctx.fillStyle = 'rgba(255, 245, 200, 0.04)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }

    const cx = Math.floor(player.pos.x + PLAYER_W / 2 - this.camera.x);
    const cy = Math.floor(player.pos.y + PLAYER_H / 2 - this.camera.y);

    const flicker = Math.sin(now / 400) * 0.02 + 0.75;

    ctx.save();
    ctx.fillStyle = `rgba(10, 17, 40, ${flicker})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const vignette = ctx.createRadialGradient(cx, cy, 30, cx, cy, 320);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.6, 'rgba(0,0,0,0.15)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  private drawFloatMessages(state: GameStateData, now: number): void {
    const ctx = this.ctx;
    const LIFE = 1000;

    for (const msg of state.floatMessages) {
      const age = now - msg.startTime;
      if (age < 0 || age > LIFE) continue;

      const t = age / LIFE;
      const ease = t * t;
      const yOff = -ease * 32;
      const alpha = 1 - t;

      const mx = msg.pos.x;
      const my = msg.pos.y + yOff;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 13px "Microsoft YaHei", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(msg.text, mx, my);
      ctx.fillStyle = msg.color;
      ctx.fillText(msg.text, mx, my);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }
}
