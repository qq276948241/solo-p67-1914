import type { ItemType, BuildingType } from './types';

export const MAP_WIDTH = 1920;
export const MAP_HEIGHT = 1280;
export const VIEW_W = 960;
export const VIEW_H = 640;
export const TILE_SIZE = 64;

export const PLAYER_SPEED = 3;
export const ROLL_SPEED = 12;
export const ROLL_DURATION = 400;
export const ROLL_COOLDOWN = 2000;
export const PLAYER_W = 16;
export const PLAYER_H = 24;

export const DOG_SNIFF_RANGE = 220;
export const DOG_WINDUP_TIME = 600;
export const DOG_DAMAGE = 10;
export const DOG_SPEED = 2.2;
export const DOG_ATTACK_RANGE = 36;
export const DOG_COOLDOWN = 1200;

export const DAY_DURATION_MS = 180 * 1000;
export const NIGHT_DURATION_MS = 90 * 1000;
export const NIGHT_HP_DRAIN_PER_SEC = 1;
export const HUNGER_DRAIN_PER_SEC = 0.1;
export const THIRST_DRAIN_PER_SEC = 0.15;

export const CAMPFIRE_WARM_RANGE = 140;
export const CAMPFIRE_FUEL_PER_WOOD_MS = 60 * 1000;
export const CAN_HUNGER_RESTORE = 30;
export const PURIFIER_THIRST_RESTORE = 30;
export const PURIFIER_RANGE = 80;

export const INTERACT_RANGE = 55;

export const STACK_LIMIT = 99;
export const INVENTORY_SIZE = 6;

export const BUILD_COSTS: Record<BuildingType, Partial<Record<ItemType, number>>> = {
  wall: { wood: 5 },
  campfire: { wood: 3 },
  water_purifier: { wood: 2, cloth: 2 },
};

export const DAILY_RESOURCE_MIN = 3;
export const DAILY_RESOURCE_MAX = 5;

export const INITIAL_DOG_COUNT = 3;

export const ITEM_NAMES: Record<ItemType, string> = {
  wood: '木头',
  can: '罐头',
  cloth: '破布',
};

export const ITEM_COLORS: Record<ItemType, string> = {
  wood: '#8b5a2b',
  can: '#bdc3c7',
  cloth: '#95a5a6',
};

export const NOISE_LOOT_RADIUS = 380;
export const NOISE_LOOT_DURATION = 2500;
export const NOISE_BUILD_RADIUS = 260;
export const NOISE_BUILD_DURATION = 1800;
export const NOISE_LOUDNESS_BASE = 1.0;
export const DOG_HEARING_SENSITIVITY = 1.2;
export const NOISE_INVESTIGATE_PRIORITY_MS = 4000;
