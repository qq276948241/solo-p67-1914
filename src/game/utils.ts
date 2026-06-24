import type { Vec2, InventorySlot, ItemType } from './types';
import { MAP_WIDTH, MAP_HEIGHT, STACK_LIMIT, INVENTORY_SIZE } from './constants';

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function clampToMap(pos: Vec2, w: number, h: number): Vec2 {
  return {
    x: clamp(pos.x, w / 2, MAP_WIDTH - w / 2),
    y: clamp(pos.y, h / 2, MAP_HEIGHT - h / 2),
  };
}

export function createEmptyInventory(): InventorySlot[] {
  const arr: InventorySlot[] = [];
  for (let i = 0; i < INVENTORY_SIZE; i++) {
    arr.push({ item: null, count: 0 });
  }
  return arr;
}

export function addItem(inventory: InventorySlot[], item: ItemType, count: number): number {
  let remaining = count;
  for (let i = 0; i < inventory.length && remaining > 0; i++) {
    const slot = inventory[i];
    if (slot.item === item && slot.count < STACK_LIMIT) {
      const canAdd = Math.min(remaining, STACK_LIMIT - slot.count);
      slot.count += canAdd;
      remaining -= canAdd;
    }
  }
  for (let i = 0; i < inventory.length && remaining > 0; i++) {
    const slot = inventory[i];
    if (slot.item === null) {
      const canAdd = Math.min(remaining, STACK_LIMIT);
      slot.item = item;
      slot.count = canAdd;
      remaining -= canAdd;
    }
  }
  return count - remaining;
}

export function removeItem(inventory: InventorySlot[], item: ItemType, count: number): boolean {
  let total = 0;
  for (const s of inventory) if (s.item === item) total += s.count;
  if (total < count) return false;
  let need = count;
  for (let i = 0; i < inventory.length && need > 0; i++) {
    const slot = inventory[i];
    if (slot.item === item) {
      const take = Math.min(need, slot.count);
      slot.count -= take;
      need -= take;
      if (slot.count <= 0) {
        slot.item = null;
        slot.count = 0;
      }
    }
  }
  return true;
}

export function countItem(inventory: InventorySlot[], item: ItemType): number {
  let total = 0;
  for (const s of inventory) if (s.item === item) total += s.count;
  return total;
}

export function findNearest<T extends { pos: Vec2 }>(
  arr: T[],
  pos: Vec2,
  maxRange: number,
): T | null {
  let best: T | null = null;
  let bestD = maxRange * maxRange;
  for (const x of arr) {
    const d = distSq(x.pos, pos);
    if (d <= bestD) {
      best = x;
      bestD = d;
    }
  }
  return best;
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len < 0.001) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}
