import { create } from 'zustand';
import type {
  GameStore,
  GameStateData,
  PlayerState,
  ResourceNode,
  BuildSpot,
  WildDog,
  DayNightState,
} from './types';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  DAY_DURATION_MS,
  INITIAL_DOG_COUNT,
  DAILY_RESOURCE_MIN,
  DAILY_RESOURCE_MAX,
} from './constants';
import { createEmptyInventory, uid, randInt, rand } from './utils';

function makeInitialPlayer(): PlayerState {
  return {
    pos: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
    direction: 'down',
    hp: 100,
    hunger: 100,
    thirst: 100,
    isRolling: false,
    rollStartTime: 0,
    rollCooldownUntil: 0,
    invincibleUntil: 0,
    inventory: createEmptyInventory(),
    selectedSlot: 0,
  };
}

function makeBuildSpots(): BuildSpot[] {
  const cx = MAP_WIDTH / 2;
  const cy = MAP_HEIGHT / 2;
  return [
    {
      id: uid(),
      pos: { x: cx - 200, y: cy - 150 },
      building: null,
      campfireLit: false,
      campfireFuelUntil: 0,
    },
    {
      id: uid(),
      pos: { x: cx + 200, y: cy - 150 },
      building: null,
      campfireLit: false,
      campfireFuelUntil: 0,
    },
    {
      id: uid(),
      pos: { x: cx, y: cy + 180 },
      building: null,
      campfireLit: false,
      campfireFuelUntil: 0,
    },
  ];
}

function makeRandomResource(): ResourceNode {
  const type = Math.random() < 0.5 ? 'car' : 'store';
  return {
    id: uid(),
    pos: {
      x: rand(120, MAP_WIDTH - 120),
      y: rand(120, MAP_HEIGHT - 120),
    },
    type,
    looted: false,
  };
}

export function makeFreshResources(excludeCenter: { x: number; y: number } = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }): ResourceNode[] {
  const n = randInt(DAILY_RESOURCE_MIN, DAILY_RESOURCE_MAX);
  const arr: ResourceNode[] = [];
  for (let i = 0; i < n; i++) {
    let tries = 0;
    let r: ResourceNode;
    do {
      r = makeRandomResource();
      tries++;
    } while (
      tries < 30 &&
      Math.hypot(r.pos.x - excludeCenter.x, r.pos.y - excludeCenter.y) < 260
    );
    arr.push(r);
  }
  return arr;
}

function makeInitialDogs(center: { x: number; y: number }): WildDog[] {
  const arr: WildDog[] = [];
  for (let i = 0; i < INITIAL_DOG_COUNT; i++) {
    let pos;
    let tries = 0;
    do {
      pos = {
        x: rand(100, MAP_WIDTH - 100),
        y: rand(100, MAP_HEIGHT - 100),
      };
      tries++;
    } while (tries < 20 && Math.hypot(pos.x - center.x, pos.y - center.y) < 500);
    arr.push({
      id: uid(),
      pos,
      state: 'idle',
      stateUntil: 0,
      hp: 30,
      facing: 'down',
    });
  }
  return arr;
}

function makeInitialDayNight(now: number): DayNightState {
  return {
    phase: 'day',
    phaseEndTime: now + DAY_DURATION_MS,
    dayCount: 1,
  };
}

function makeInitialState(now: number): GameStateData {
  const center = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  return {
    scene: 'menu',
    player: makeInitialPlayer(),
    resources: makeFreshResources(center),
    buildSpots: makeBuildSpots(),
    dogs: makeInitialDogs(center),
    dayNight: makeInitialDayNight(now),
    deathReason: '',
    floatMessages: [],
    lastTickTime: now,
    cameraShakeUntil: 0,
  };
}

export const useGameStore = create<GameStore>((set) => ({
  ...makeInitialState(performance.now()),
  startGame: () => {
    const now = performance.now();
    const ns = makeInitialState(now);
    ns.scene = 'playing';
    set(ns);
  },
  returnToMenu: () => {
    set((s) => ({ ...makeInitialState(performance.now()) }));
  },
  updateRaw: (updater) => {
    set((state) => {
      const copy: GameStateData = {
        ...state,
        player: { ...state.player, pos: { ...state.player.pos }, inventory: state.player.inventory.map((s) => ({ ...s })) },
        resources: state.resources.map((r) => ({ ...r, pos: { ...r.pos } })),
        buildSpots: state.buildSpots.map((b) => ({ ...b, pos: { ...b.pos } })),
        dogs: state.dogs.map((d) => ({ ...d, pos: { ...d.pos } })),
        dayNight: { ...state.dayNight },
        floatMessages: state.floatMessages.map((m) => ({ ...m, pos: { ...m.pos } })),
      };
      updater(copy);
      return copy;
    });
  },
}));
