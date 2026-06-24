import type { GameStateData, Direction, ItemType, ResourceType, BuildingType } from './types';
import type { InputManager } from './InputManager';
import {
  PLAYER_SPEED,
  ROLL_SPEED,
  ROLL_DURATION,
  ROLL_COOLDOWN,
  PLAYER_W,
  PLAYER_H,
  CAN_HUNGER_RESTORE,
  PURIFIER_THIRST_RESTORE,
  PURIFIER_RANGE,
  INTERACT_RANGE,
  DAY_DURATION_MS,
  NIGHT_DURATION_MS,
  NIGHT_HP_DRAIN_PER_SEC,
  HUNGER_DRAIN_PER_SEC,
  THIRST_DRAIN_PER_SEC,
  CAMPFIRE_WARM_RANGE,
  CAMPFIRE_FUEL_PER_WOOD_MS,
  BUILD_COSTS,
  ITEM_NAMES,
  DOG_SNIFF_RANGE,
  DOG_WINDUP_TIME,
  DOG_DAMAGE,
  DOG_SPEED,
  DOG_ATTACK_RANGE,
  DOG_COOLDOWN,
  NOISE_LOOT_RADIUS,
  NOISE_LOOT_DURATION,
  NOISE_BUILD_RADIUS,
  NOISE_BUILD_DURATION,
  NOISE_LOUDNESS_BASE,
  DOG_HEARING_SENSITIVITY,
  NOISE_INVESTIGATE_PRIORITY_MS,
} from './constants';
import {
  addItem,
  removeItem,
  clamp,
  clampToMap,
  dist,
  findNearest,
  normalize,
  uid,
  randInt,
  countItem,
} from './utils';
import { makeFreshResources } from './store';

function pushFloatMessage(state: GameStateData, text: string, now: number, color: string = '#ffffff'): void {
  state.floatMessages.push({
    id: uid(),
    text,
    pos: { x: state.player.pos.x, y: state.player.pos.y - 30 },
    startTime: now,
    color,
  });
}

function pushNoise(
  state: GameStateData,
  pos: { x: number; y: number },
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

function directionToVec(d: Direction): { x: number; y: number } {
  switch (d) {
    case 'up': return { x: 0, y: -1 };
    case 'down': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
  }
}

function pickLootItem(type: ResourceType): ItemType {
  const r = Math.random();
  if (type === 'car') {
    if (r < 0.5) return 'wood';
    if (r < 0.8) return 'can';
    return 'cloth';
  } else {
    if (r < 0.2) return 'wood';
    if (r < 0.65) return 'can';
    return 'cloth';
  }
}

function canBuild(inventory: { item: ItemType | null; count: number }[], type: BuildingType): boolean {
  const costs = BUILD_COSTS[type];
  for (const [item, need] of Object.entries(costs)) {
    if (countItem(inventory, item as ItemType) < (need as number)) return false;
  }
  return true;
}

function buildPriority(inventory: { item: ItemType | null; count: number }[]): BuildingType | null {
  const order: BuildingType[] = ['wall', 'campfire', 'water_purifier'];
  let best: BuildingType | null = null;
  let bestScore = 0;
  for (const t of order) {
    if (!canBuild(inventory, t)) continue;
    const costs = BUILD_COSTS[t];
    let score = 0;
    for (const [item, need] of Object.entries(costs)) {
      score += countItem(inventory, item as ItemType);
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function consumeBuildMaterials(inventory: { item: ItemType | null; count: number }[], type: BuildingType): void {
  const costs = BUILD_COSTS[type];
  for (const [item, need] of Object.entries(costs)) {
    removeItem(inventory, item as ItemType, need as number);
  }
}

const BUILDING_NAMES: Record<BuildingType, string> = {
  wall: '围墙',
  campfire: '篝火',
  water_purifier: '净水器',
};

function findLoudestNoiseForDog(
  state: GameStateData,
  dogPos: { x: number; y: number },
  now: number,
): { pos: { x: number; y: number }; priorityUntil: number } | null {
  let best: typeof state.noises[0] | null = null;
  let bestAttraction = 0;
  for (const noise of state.noises) {
    const age = now - noise.startTime;
    if (age >= noise.duration) continue;
    const agePct = age / noise.duration;
    const currentRadius = noise.maxRadius * (0.3 + 0.7 * Math.min(1, agePct * 1.5));
    const d = dist(dogPos, noise.pos);
    if (d > currentRadius * DOG_HEARING_SENSITIVITY) continue;
    const attenuation = 1 - d / (currentRadius * DOG_HEARING_SENSITIVITY);
    const attraction = noise.loudness * attenuation * (1 - agePct * 0.5);
    if (attraction > bestAttraction) {
      bestAttraction = attraction;
      best = noise;
    }
  }
  if (best) {
    return {
      pos: best.pos,
      priorityUntil: now + NOISE_INVESTIGATE_PRIORITY_MS,
    };
  }
  return null;
}

export function updateGame(state: GameStateData, input: InputManager, now: number): void {
  const player = state.player;
  const dtSec = (now - state.lastTickTime) / 1000;
  state.lastTickTime = now;

  // 1. 玩家移动与翻滚
  let dx = 0, dy = 0;
  if (input.isDown('w')) dy -= 1;
  if (input.isDown('s')) dy += 1;
  if (input.isDown('a')) dx -= 1;
  if (input.isDown('d')) dx += 1;

  if (player.isRolling) {
    if (now >= player.rollStartTime + ROLL_DURATION) {
      player.isRolling = false;
    } else {
      const rv = directionToVec(player.direction);
      player.pos.x += rv.x * ROLL_SPEED;
      player.pos.y += rv.y * ROLL_SPEED;
    }
  } else {
    if (dx !== 0 || dy !== 0) {
      const n = normalize({ x: dx, y: dy });
      player.pos.x += n.x * PLAYER_SPEED;
      player.pos.y += n.y * PLAYER_SPEED;

      if (Math.abs(n.x) > Math.abs(n.y)) {
        player.direction = n.x > 0 ? 'right' : 'left';
      } else {
        player.direction = n.y > 0 ? 'down' : 'up';
      }
    }

    if (input.isDown('shift') && player.rollCooldownUntil <= now) {
      player.isRolling = true;
      player.rollStartTime = now;
      player.rollCooldownUntil = now + ROLL_COOLDOWN;
      player.invincibleUntil = now + ROLL_DURATION;
    }
  }

  const clamped = clampToMap(player.pos, PLAYER_W, PLAYER_H);
  player.pos.x = clamped.x;
  player.pos.y = clamped.y;

  // 2. 背包槽位选择
  for (let k = 1; k <= 6; k++) {
    if (input.justPressed(String(k))) {
      player.selectedSlot = k - 1;
    }
  }

  // 3. 使用物品
  if (input.justPressed('f')) {
    const slot = player.inventory[player.selectedSlot];
    if (slot && slot.item === 'can' && slot.count > 0) {
      removeItem(player.inventory, 'can', 1);
      player.hunger = clamp(player.hunger + CAN_HUNGER_RESTORE, 0, 100);
      pushFloatMessage(state, '罐头+30饱食', now, '#27ae60');
    }
  }

  if (input.justPressed(' ')) {
    const nearestPurifier = findNearest(
      state.buildSpots.filter((b) => b.building === 'water_purifier'),
      player.pos,
      PURIFIER_RANGE,
    );
    if (nearestPurifier) {
      player.thirst = clamp(player.thirst + PURIFIER_THIRST_RESTORE, 0, 100);
      pushFloatMessage(state, '饮水+30口渴', now, '#3498db');
    }
  }

  // 4 & 5. 搜刮 / 建造（按 E）
  if (input.justPressed('e')) {
    const nearestResource = findNearest(
      state.resources.filter((r) => !r.looted),
      player.pos,
      INTERACT_RANGE,
    );

    if (nearestResource) {
      const count = randInt(1, 3);
      const got: Record<string, number> = {};
      for (let i = 0; i < count; i++) {
        const item = pickLootItem(nearestResource.type);
        const added = addItem(player.inventory, item, 1);
        if (added > 0) {
          got[item] = (got[item] || 0) + added;
        }
      }
      nearestResource.looted = true;
      pushNoise(state, nearestResource.pos, 'loot', now);
      for (const [item, n] of Object.entries(got)) {
        pushFloatMessage(state, `获得${ITEM_NAMES[item as ItemType]} x${n}`, now, '#f39c12');
      }
    } else {
      const nearestSpot = findNearest(state.buildSpots, player.pos, INTERACT_RANGE);
      if (nearestSpot) {
        if (nearestSpot.building === null) {
          const buildType = buildPriority(player.inventory);
          if (buildType) {
            consumeBuildMaterials(player.inventory, buildType);
            nearestSpot.building = buildType;
            pushNoise(state, nearestSpot.pos, 'build', now);
            if (buildType === 'campfire') {
              nearestSpot.campfireLit = true;
              nearestSpot.campfireFuelUntil = now + CAMPFIRE_FUEL_PER_WOOD_MS * 1;
            }
            pushFloatMessage(state, `建造完成：${BUILDING_NAMES[buildType]}`, now, '#2ecc71');
          }
        } else if (nearestSpot.building === 'campfire') {
          if (countItem(player.inventory, 'wood') >= 1 && nearestSpot.campfireFuelUntil < now + 30000) {
            removeItem(player.inventory, 'wood', 1);
            nearestSpot.campfireFuelUntil += CAMPFIRE_FUEL_PER_WOOD_MS;
            nearestSpot.campfireLit = true;
            pushFloatMessage(state, '火堆添柴', now, '#e67e22');
          }
        }
      }
    }
  }

  // 6. 昼夜系统
  if (now >= state.dayNight.phaseEndTime) {
    if (state.dayNight.phase === 'day') {
      state.dayNight.phase = 'night';
      state.dayNight.phaseEndTime = now + NIGHT_DURATION_MS;
    } else {
      state.dayNight.phase = 'day';
      state.dayNight.phaseEndTime = now + DAY_DURATION_MS;
      state.dayNight.dayCount++;
      const fresh = makeFreshResources(player.pos);
      state.resources.push(...fresh);
    }
  }

  if (state.dayNight.phase === 'night') {
    let nearCampfire = false;
    for (const spot of state.buildSpots) {
      if (spot.building === 'campfire' && spot.campfireLit && now < spot.campfireFuelUntil) {
        if (dist(spot.pos, player.pos) <= CAMPFIRE_WARM_RANGE) {
          nearCampfire = true;
          break;
        }
      }
    }
    if (!nearCampfire) {
      player.hp -= NIGHT_HP_DRAIN_PER_SEC * dtSec;
      state.deathReason = '严寒冻死';
    }
  }

  // 7. 属性衰减
  player.hunger = clamp(player.hunger - HUNGER_DRAIN_PER_SEC * dtSec, 0, 100);
  player.thirst = clamp(player.thirst - THIRST_DRAIN_PER_SEC * dtSec, 0, 100);

  if (player.hunger <= 0) {
    player.hp -= 0.5 * dtSec;
    state.deathReason = '饥饿身亡';
  }
  if (player.thirst <= 0) {
    player.hp -= 0.8 * dtSec;
    state.deathReason = '脱水身亡';
  }

  // 8. 野狗AI
  for (const dog of state.dogs) {
    if (dog.investigatePriorityUntil > 0 && now >= dog.investigatePriorityUntil) {
      dog.investigateTarget = null;
      dog.investigatePriorityUntil = 0;
    }
    if (dog.state === 'idle' || (dog.state === 'chase' && !dog.investigateTarget)) {
      const noiseTarget = findLoudestNoiseForDog(state, dog.pos, now);
      if (noiseTarget) {
        dog.investigateTarget = { x: noiseTarget.pos.x, y: noiseTarget.pos.y };
        dog.investigatePriorityUntil = noiseTarget.priorityUntil;
        if (dog.state === 'idle') {
          dog.state = 'chase';
        }
      }
    }

    const targetPos = (dog.investigateTarget && now < dog.investigatePriorityUntil)
      ? dog.investigateTarget
      : player.pos;

    const toPlayer = {
      x: targetPos.x - dog.pos.x,
      y: targetPos.y - dog.pos.y,
    };
    const d = Math.sqrt(toPlayer.x * toPlayer.x + toPlayer.y * toPlayer.y);

    const toRealPlayer = {
      x: player.pos.x - dog.pos.x,
      y: player.pos.y - dog.pos.y,
    };
    const dReal = Math.sqrt(toRealPlayer.x * toRealPlayer.x + toRealPlayer.y * toRealPlayer.y);

    if (dog.investigateTarget && d < 40) {
      dog.investigateTarget = null;
      dog.investigatePriorityUntil = 0;
    }

    switch (dog.state) {
      case 'idle':
        if (dReal <= DOG_SNIFF_RANGE) {
          dog.state = 'chase';
        }
        break;

      case 'chase': {
        if (d > 0.001) {
          const nx = toPlayer.x / d;
          const ny = toPlayer.y / d;
          dog.pos.x += nx * DOG_SPEED;
          dog.pos.y += ny * DOG_SPEED;
          if (Math.abs(nx) > Math.abs(ny)) {
            dog.facing = nx > 0 ? 'right' : 'left';
          } else {
            dog.facing = ny > 0 ? 'down' : 'up';
          }
        }
        if (dReal <= DOG_ATTACK_RANGE && !dog.investigateTarget) {
          dog.state = 'windup';
          dog.stateUntil = now + DOG_WINDUP_TIME;
        } else if (dReal <= DOG_SNIFF_RANGE && !dog.investigateTarget) {
          // 已经在追，什么都不做
        } else if (dog.investigateTarget && d >= 40) {
          // 继续调查噪音源
        } else if (!dog.investigateTarget && dReal > DOG_SNIFF_RANGE * 1.5) {
          dog.state = 'idle';
        }
        break;
      }

      case 'windup':
        if (now >= dog.stateUntil) {
          dog.state = 'attack';
          if (now > player.invincibleUntil) {
            player.hp -= DOG_DAMAGE;
            state.cameraShakeUntil = now + 150;
            pushFloatMessage(state, '-10血', now, '#c0392b');
            state.deathReason = '被野狗咬死';
          }
          dog.state = 'cooldown';
          dog.stateUntil = now + DOG_COOLDOWN;
        }
        break;

      case 'cooldown':
        if (now >= dog.stateUntil) {
          dog.state = 'idle';
        }
        break;
    }

    const dclamped = clampToMap(dog.pos, 16, 16);
    dog.pos.x = dclamped.x;
    dog.pos.y = dclamped.y;
  }

  // 9. 清理floatMessages和noises
  state.floatMessages = state.floatMessages.filter((m) => m.startTime + 1500 >= now);
  state.noises = state.noises.filter((n) => n.startTime + n.duration >= now);

  // 10. 死亡判定
  if (player.hp <= 0) {
    player.hp = 0;
    state.scene = 'dead';
  }
}
