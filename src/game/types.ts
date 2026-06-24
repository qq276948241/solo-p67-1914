export interface Vec2 {
  x: number;
  y: number;
}

export type ItemType = 'wood' | 'can' | 'cloth';
export type ResourceType = 'car' | 'store';
export type BuildingType = 'wall' | 'campfire' | 'water_purifier';
export type DayPhase = 'day' | 'night';
export type GameScene = 'menu' | 'playing' | 'dead';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type DogState = 'idle' | 'chase' | 'windup' | 'attack' | 'cooldown';

export interface InventorySlot {
  item: ItemType | null;
  count: number;
}

export interface PlayerState {
  pos: Vec2;
  direction: Direction;
  hp: number;
  hunger: number;
  thirst: number;
  isRolling: boolean;
  rollStartTime: number;
  rollCooldownUntil: number;
  invincibleUntil: number;
  inventory: InventorySlot[];
  selectedSlot: number;
}

export interface ResourceNode {
  id: string;
  pos: Vec2;
  type: ResourceType;
  looted: boolean;
}

export interface BuildSpot {
  id: string;
  pos: Vec2;
  building: BuildingType | null;
  campfireLit: boolean;
  campfireFuelUntil: number;
}

export interface WildDog {
  id: string;
  pos: Vec2;
  state: DogState;
  stateUntil: number;
  hp: number;
  facing: Direction;
}

export interface DayNightState {
  phase: DayPhase;
  phaseEndTime: number;
  dayCount: number;
}

export interface FloatMessage {
  id: string;
  text: string;
  pos: Vec2;
  startTime: number;
  color: string;
}

export interface GameStateData {
  scene: GameScene;
  player: PlayerState;
  resources: ResourceNode[];
  buildSpots: BuildSpot[];
  dogs: WildDog[];
  dayNight: DayNightState;
  deathReason: string;
  floatMessages: FloatMessage[];
  lastTickTime: number;
  cameraShakeUntil: number;
}

export interface GameStore extends GameStateData {
  startGame: () => void;
  returnToMenu: () => void;
  updateRaw: (updater: (s: GameStateData) => void) => void;
}
