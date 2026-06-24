import type { GameStateData, Direction, ItemType, ResourceType, BuildingType, WildDog } from './types';
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
import {
  emitNoise,
  cleanupExpiredNoises,
  expireInvestigationIfDue,
  tryAssignNoiseTargetToDog,
  getDogEffectiveTarget,
  hasActiveInvestigation,
  clearInvestigation,
} from './noise';

function pushFloatMessage(
  state: GameStateData,
  text: string,
  now: number,
  color: string = '#ffffff',
): void {
  state.floatMessages.push({
    id: uid(),
    text,
    pos: { x: state.player.pos.x, y: state.player.pos.y - 30 },
    startTime: now,
    color,
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

const BUILDING_NAMES: Record<BuildingType, string> = {
  wall: '围墙',
  campfire: '篝火',
  water_purifier: '净水器',
};

function canBuild(
  inventory: { item: ItemType | null; count: number }[],
  type: BuildingType,
): boolean {
  const costs = BUILD_COSTS[type];
  for (const [item, need] of Object.entries(costs)) {
    if (countItem(inventory, item as ItemType) < (need as number)) return false;
  }
  return true;
}

function buildPriority(
  inventory: { item: ItemType | null; count: number }[],
): BuildingType | null {
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

function consumeBuildMaterials(
  inventory: { item: ItemType | null; count: number }[],
  type: BuildingType,
): void {
  const costs = BUILD_COSTS[type];
  for (const [item, need] of Object.entries(costs)) {
    removeItem(inventory, item as ItemType, need as number);
  }
}

// ===== 玩家 =====

function updatePlayerMovement(
  state: GameStateData,
  input: InputManager,
  now: number,
): void {
  const player = state.player;
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
}

function updateInventorySelection(
  state: GameStateData,
  input: InputManager,
): void {
  for (let k = 1; k <= 6; k++) {
    if (input.justPressed(String(k))) {
      state.player.selectedSlot = k - 1;
    }
  }
}

function updateUseItem(
  state: GameStateData,
  input: InputManager,
  now: number,
): void {
  const player = state.player;

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
}

// ===== 搜刮 & 建造 =====

function tryLoot(state: GameStateData, now: number): boolean {
  const player = state.player;
  const nearestResource = findNearest(
    state.resources.filter((r) => !r.looted),
    player.pos,
    INTERACT_RANGE,
  );
  if (!nearestResource) return false;

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
  emitNoise(state, nearestResource.pos, 'loot', now);

  for (const [item, n] of Object.entries(got)) {
    pushFloatMessage(state, `获得${ITEM_NAMES[item as ItemType]} x${n}`, now, '#f39c12');
  }
  return true;
}

function tryBuildOrRefuel(state: GameStateData, now: number): boolean {
  const player = state.player;
  const nearestSpot = findNearest(state.buildSpots, player.pos, INTERACT_RANGE);
  if (!nearestSpot) return false;

  if (nearestSpot.building === null) {
    const buildType = buildPriority(player.inventory);
    if (!buildType) return true;
    consumeBuildMaterials(player.inventory, buildType);
    nearestSpot.building = buildType;
    emitNoise(state, nearestSpot.pos, 'build', now);
    if (buildType === 'campfire') {
      nearestSpot.campfireLit = true;
      nearestSpot.campfireFuelUntil = now + CAMPFIRE_FUEL_PER_WOOD_MS;
    }
    pushFloatMessage(state, `建造完成：${BUILDING_NAMES[buildType]}`, now, '#2ecc71');
    return true;
  }

  if (nearestSpot.building === 'campfire') {
    const hasWood = countItem(player.inventory, 'wood') >= 1;
    const needsFuel = nearestSpot.campfireFuelUntil < now + 30000;
    if (hasWood && needsFuel) {
      removeItem(player.inventory, 'wood', 1);
      nearestSpot.campfireFuelUntil += CAMPFIRE_FUEL_PER_WOOD_MS;
      nearestSpot.campfireLit = true;
      pushFloatMessage(state, '火堆添柴', now, '#e67e22');
    }
    return true;
  }

  return true;
}

function updateInteraction(
  state: GameStateData,
  input: InputManager,
  now: number,
): void {
  if (!input.justPressed('e')) return;
  if (tryLoot(state, now)) return;
  tryBuildOrRefuel(state, now);
}

// ===== 昼夜 =====

function updateDayNight(
  state: GameStateData,
  now: number,
  dtSec: number,
): void {
  const player = state.player;
  const dn = state.dayNight;

  if (now >= dn.phaseEndTime) {
    if (dn.phase === 'day') {
      dn.phase = 'night';
      dn.phaseEndTime = now + NIGHT_DURATION_MS;
    } else {
      dn.phase = 'day';
      dn.phaseEndTime = now + DAY_DURATION_MS;
      dn.dayCount++;
      state.resources.push(...makeFreshResources(player.pos));
    }
  }

  if (dn.phase !== 'night') return;

  let nearCampfire = false;
  for (const spot of state.buildSpots) {
    if (
      spot.building === 'campfire' &&
      spot.campfireLit &&
      now < spot.campfireFuelUntil &&
      dist(spot.pos, player.pos) <= CAMPFIRE_WARM_RANGE
    ) {
      nearCampfire = true;
      break;
    }
  }
  if (!nearCampfire) {
    player.hp -= NIGHT_HP_DRAIN_PER_SEC * dtSec;
    state.deathReason = '严寒冻死';
  }
}

// ===== 属性 =====

function updateVitals(state: GameStateData, dtSec: number): void {
  const player = state.player;
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
}

// ===== 野狗AI（使用 noise 模块，修复卡死问题） =====

function updateSingleDog(
  state: GameStateData,
  dog: WildDog,
  now: number,
): void {
  const player = state.player;

  // Step 1: 过期调查目标自动清除
  expireInvestigationIfDue(dog, now);

  // Step 2: 所有非锁定状态都尝试听取噪音
  // 修复Bug: 之前只有idle和chase(无目标)才听噪音，
  // cooldown结束后转idle不会重新听音，导致卡住
  const canHearNoise =
    dog.state === 'idle' ||
    dog.state === 'chase' ||
    dog.state === 'cooldown';
  if (canHearNoise) {
    tryAssignNoiseTargetToDog(state, dog, now);
  }

  // Step 3: 确定当前移动目标
  const target = getDogEffectiveTarget(dog, now, player.pos);
  const investigating = hasActiveInvestigation(dog, now);

  // Step 4: 到达噪音源附近 → 清除调查目标，转回嗅探玩家
  if (investigating) {
    const dToNoise = dist(dog.pos, target);
    if (dToNoise < 40) {
      clearInvestigation(dog);
      // 修复Bug: 到达噪音源后不转idle，保持chase继续嗅探附近
      if (dog.state === 'chase') {
        // 保持chase，下帧会用嗅探范围检测玩家
      }
    }
  }

  // Step 5: 计算距离
  const dPlayer = dist(dog.pos, player.pos);

  // Step 6: 状态机
  switch (dog.state) {
    case 'idle': {
      // 嗅探到玩家 → 追击
      if (dPlayer <= DOG_SNIFF_RANGE) {
        dog.state = 'chase';
      }
      // 有噪音目标时 tryAssignNoiseTargetToDog 已经把状态设为 chase
      break;
    }

    case 'chase': {
      // 移动向当前目标（噪音源或玩家）
      const dx = target.x - dog.pos.x;
      const dy = target.y - dog.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        dog.pos.x += nx * DOG_SPEED;
        dog.pos.y += ny * DOG_SPEED;
        if (Math.abs(nx) > Math.abs(ny)) {
          dog.facing = nx > 0 ? 'right' : 'left';
        } else {
          dog.facing = ny > 0 ? 'down' : 'up';
        }
      }

      // 追击玩家时：够近就攻击
      if (!investigating && dPlayer <= DOG_ATTACK_RANGE) {
        dog.state = 'windup';
        dog.stateUntil = now + DOG_WINDUP_TIME;
      }
      // 不在追踪噪音、且玩家超出嗅探范围 → 回到idle
      else if (!investigating && dPlayer > DOG_SNIFF_RANGE * 1.5) {
        dog.state = 'idle';
      }
      // 正在追踪噪音 → 持续追，不转idle
      break;
    }

    case 'windup': {
      if (now >= dog.stateUntil) {
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
    }

    case 'cooldown': {
      if (now >= dog.stateUntil) {
        // 修复Bug: cooldown结束后不直接转idle，
        // 先让下一帧的 tryAssignNoiseTargetToDog 检查是否有新噪音
        // 如果有噪音就转chase追过去，没有才转idle
        dog.state = 'idle';
      }
      break;
    }
  }

  const dclamped = clampToMap(dog.pos, 16, 16);
  dog.pos.x = dclamped.x;
  dog.pos.y = dclamped.y;
}

function updateDogs(state: GameStateData, now: number): void {
  for (const dog of state.dogs) {
    updateSingleDog(state, dog, now);
  }
}

// ===== 清理 + 死亡 =====

function updateCleanup(state: GameStateData, now: number): void {
  state.floatMessages = state.floatMessages.filter(
    (m) => m.startTime + 1500 >= now,
  );
  cleanupExpiredNoises(state, now);
}

function updateDeath(state: GameStateData): void {
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.scene = 'dead';
  }
}

// ===== 主入口 =====

export function updateGame(
  state: GameStateData,
  input: InputManager,
  now: number,
): void {
  const dtSec = (now - state.lastTickTime) / 1000;
  state.lastTickTime = now;

  updatePlayerMovement(state, input, now);
  updateInventorySelection(state, input);
  updateUseItem(state, input, now);
  updateInteraction(state, input, now);
  updateDayNight(state, now, dtSec);
  updateVitals(state, dtSec);
  updateDogs(state, now);
  updateCleanup(state, now);
  updateDeath(state);
}
