import type { GameStateData, Vec2, WildDog, NoiseSource } from './types';
import {
  NOISE_LOOT_RADIUS,
  NOISE_LOOT_DURATION,
  NOISE_BUILD_RADIUS,
  NOISE_BUILD_DURATION,
  NOISE_LOUDNESS_BASE,
  DOG_HEARING_SENSITIVITY,
  NOISE_INVESTIGATE_PRIORITY_MS,
} from './constants';
import { dist, uid } from './utils';

export function emitNoise(
  state: GameStateData,
  pos: Vec2,
  type: 'loot' | 'build',
  now: number,
): void {
  const maxRadius = type === 'loot' ? NOISE_LOOT_RADIUS : NOISE_BUILD_RADIUS;
  const duration = type === 'loot' ? NOISE_LOOT_DURATION : NOISE_BUILD_DURATION;
  state.noises.push({
    id: uid(),
    pos: { x: pos.x, y: pos.y },
    startTime: now,
    duration,
    maxRadius,
    loudness: NOISE_LOUDNESS_BASE,
    type,
  });
}

export function cleanupExpiredNoises(state: GameStateData, now: number): void {
  state.noises = state.noises.filter((n) => n.startTime + n.duration >= now);
}

export function getNoiseEffectiveRadius(noise: NoiseSource, now: number): number {
  const age = now - noise.startTime;
  const t = Math.max(0, Math.min(1, age / noise.duration));
  return noise.maxRadius * (0.3 + 0.7 * Math.min(1, t * 1.5));
}

export function findLoudestNoiseForDog(
  state: GameStateData,
  dogPos: Vec2,
  now: number,
): { pos: Vec2; priorityUntil: number } | null {
  let best: NoiseSource | null = null;
  let bestAttraction = 0;

  for (const noise of state.noises) {
    const age = now - noise.startTime;
    if (age >= noise.duration) continue;

    const agePct = age / noise.duration;
    const currentRadius = getNoiseEffectiveRadius(noise, now);
    const d = dist(dogPos, noise.pos);

    const hearingRange = currentRadius * DOG_HEARING_SENSITIVITY;
    if (d > hearingRange) continue;

    const attenuation = 1 - d / hearingRange;
    const attraction = noise.loudness * attenuation * (1 - agePct * 0.5);

    if (attraction > bestAttraction) {
      bestAttraction = attraction;
      best = noise;
    }
  }

  if (best) {
    return {
      pos: { x: best.pos.x, y: best.pos.y },
      priorityUntil: now + NOISE_INVESTIGATE_PRIORITY_MS,
    };
  }
  return null;
}

export function hasActiveInvestigation(dog: WildDog, now: number): boolean {
  return (
    dog.investigateTarget !== null &&
    dog.investigatePriorityUntil > 0 &&
    now < dog.investigatePriorityUntil
  );
}

export function clearInvestigation(dog: WildDog): void {
  dog.investigateTarget = null;
  dog.investigatePriorityUntil = 0;
}

export function expireInvestigationIfDue(dog: WildDog, now: number): void {
  if (dog.investigatePriorityUntil > 0 && now >= dog.investigatePriorityUntil) {
    clearInvestigation(dog);
  }
}

export function tryAssignNoiseTargetToDog(
  state: GameStateData,
  dog: WildDog,
  now: number,
): boolean {
  if (hasActiveInvestigation(dog, now)) return false;
  if (dog.state !== 'idle' && dog.state !== 'chase' && dog.state !== 'cooldown') {
    return false;
  }
  if (dog.state === 'chase' && dog.investigateTarget) {
    return false;
  }

  const target = findLoudestNoiseForDog(state, dog.pos, now);
  if (!target) return false;

  dog.investigateTarget = { x: target.pos.x, y: target.pos.y };
  dog.investigatePriorityUntil = target.priorityUntil;

  if (dog.state === 'idle' || dog.state === 'cooldown') {
    dog.state = 'chase';
  }
  return true;
}

export function getDogEffectiveTarget(dog: WildDog, now: number, fallback: Vec2): Vec2 {
  return hasActiveInvestigation(dog, now)
    ? (dog.investigateTarget as Vec2)
    : fallback;
}

export function renderNoises(
  ctx: CanvasRenderingContext2D,
  state: GameStateData,
  now: number,
): void {
  for (const noise of state.noises) {
    const age = now - noise.startTime;
    if (age < 0 || age > noise.duration) continue;

    const t = age / noise.duration;
    const radius = noise.maxRadius * (0.25 + 0.75 * Math.min(1, t * 1.6));
    const alpha = (1 - t) * 0.55;

    const ringCount = noise.type === 'loot' ? 3 : 2;
    const baseColor = noise.type === 'loot' ? '241, 196, 15' : '46, 204, 113';

    for (let i = 0; i < ringCount; i++) {
      const ringT = (t - i * 0.2) / (1 - i * 0.2);
      if (ringT < 0 || ringT > 1) continue;

      const ringRadius = radius * (0.4 + ringT * 0.6);
      const ringAlpha = alpha * (1 - ringT * 0.6);
      const lineWidth = noise.type === 'loot' ? 3 : 2;

      ctx.save();
      ctx.globalAlpha = ringAlpha;
      ctx.strokeStyle = `rgba(${baseColor}, ${ringAlpha})`;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(
        Math.floor(noise.pos.x),
        Math.floor(noise.pos.y),
        Math.floor(ringRadius),
        0,
        Math.PI * 2,
      );
      ctx.stroke();

      if (i === 0 && ringT < 0.7) {
        const pulseR = ringRadius * 0.6;
        ctx.globalAlpha = ringAlpha * 0.3;
        ctx.fillStyle = `rgba(${baseColor}, 0.15)`;
        ctx.beginPath();
        ctx.arc(
          Math.floor(noise.pos.x),
          Math.floor(noise.pos.y),
          Math.floor(pulseR),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.restore();
    }

    if (t < 0.25) {
      ctx.save();
      const iconAlpha = 1 - t * 4;
      ctx.globalAlpha = iconAlpha;
      ctx.fillStyle = noise.type === 'loot' ? '#f1c40f' : '#2ecc71';
      const iy = noise.pos.y - radius * 0.5 - 10 - (1 - t * 4) * 8;
      for (let w = 0; w < 3; w++) {
        const wy = iy - w * 4;
        const ww = 8 + w * 4;
        ctx.fillRect(
          Math.floor(noise.pos.x - ww / 2),
          Math.floor(wy),
          ww,
          2,
        );
      }
      ctx.restore();
    }
  }
}

export function renderDogInvestigationIndicator(
  ctx: CanvasRenderingContext2D,
  dog: WildDog,
  dx: number,
  dy: number,
  now: number,
): void {
  if (!hasActiveInvestigation(dog, now)) return;

  const ex = dx + 6;
  const ey = dy - 18;
  const wobble = Math.sin(now / 120) * 1.5;

  ctx.save();
  ctx.fillStyle = '#f1c40f';
  ctx.globalAlpha = 0.85;
  for (let w = 0; w < 3; w++) {
    const wy = ey - w * 4 + wobble;
    const ww = 6 + w * 3;
    ctx.fillRect(Math.floor(ex - ww / 2), Math.floor(wy), ww, 2);
  }
  ctx.restore();
}
