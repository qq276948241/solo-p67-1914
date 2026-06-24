import { Heart, Utensils, Droplet, Sun, Moon } from 'lucide-react';
import { useGameStore } from '../game/store';
import { useEffect, useState } from 'react';
import type { ItemType } from '../game/types';
import { ITEM_COLORS, ITEM_NAMES, DAY_DURATION_MS, NIGHT_DURATION_MS } from '../game/constants';

const BAR_W = 180;
const BAR_H = 14;

function StatBar({
  icon,
  value,
  color,
  bg,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  color: string;
  bg: string;
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="text-white" style={{ width: 20, height: 20 }}>
        {icon}
      </div>
      <div
        className="relative"
        style={{
          width: BAR_W,
          height: BAR_H,
          background: bg,
          border: '2px solid #1a1a1a',
          imageRendering: 'pixelated',
          boxShadow: '0 0 0 2px #000',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            transition: 'width 120ms linear',
          }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center text-white"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 9,
            textShadow: '1px 1px 0 #000',
            letterSpacing: 0.5,
          }}
        >
          {Math.round(pct)}
        </div>
      </div>
    </div>
  );
}

function ItemIcon({ type }: { type: ItemType }) {
  const color = ITEM_COLORS[type];
  if (type === 'wood') {
    return (
      <svg viewBox="0 0 16 16" width="28" height="28" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="5" width="12" height="6" fill={color} stroke="#5a3d1e" strokeWidth="1" />
        <rect x="3" y="6" width="2" height="4" fill="#a67c52" />
        <rect x="9" y="6" width="2" height="4" fill="#a67c52" />
      </svg>
    );
  }
  if (type === 'can') {
    return (
      <svg viewBox="0 0 16 16" width="28" height="28" style={{ imageRendering: 'pixelated' }}>
        <rect x="4" y="3" width="8" height="11" fill={color} stroke="#6d7a80" strokeWidth="1" />
        <rect x="4" y="3" width="8" height="2" fill="#e8e8e8" />
        <rect x="5" y="7" width="6" height="2" fill="#c0392b" />
        <rect x="6" y="10" width="4" height="1" fill="#7f8c8d" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width="28" height="28" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="4" width="10" height="9" fill={color} stroke="#546063" strokeWidth="1" />
      <path d="M3 4 L8 8 L3 13" fill="none" stroke="#6d7a7d" strokeWidth="1" />
      <path d="M13 4 L8 8 L13 13" fill="none" stroke="#6d7a7d" strokeWidth="1" />
    </svg>
  );
}

export default function HUD() {
  const player = useGameStore((s) => s.player);
  const dayNight = useGameStore((s) => s.dayNight);
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 100);
    return () => clearInterval(id);
  }, []);

  const now = performance.now();
  const totalMs = dayNight.phase === 'day' ? DAY_DURATION_MS : NIGHT_DURATION_MS;
  const remainMs = Math.max(0, dayNight.phaseEndTime - now);
  const remainSec = Math.ceil(remainMs / 1000);
  const mm = Math.floor(remainSec / 60);
  const ss = remainSec % 60;
  const phasePct = 1 - remainMs / totalMs;

  return (
    <>
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        <StatBar
          icon={<Heart size={18} color="#e74c3c" fill="#e74c3c33" />}
          value={player.hp}
          color="linear-gradient(180deg, #ff5a5a 0%, #c0392b 100%)"
          bg="#4a1818"
          label="血量"
        />
        <StatBar
          icon={<Utensils size={18} color="#e67e22" />}
          value={player.hunger}
          color="linear-gradient(180deg, #ffb25a 0%, #e67e22 100%)"
          bg="#4a3018"
          label="饥饿"
        />
        <StatBar
          icon={<Droplet size={18} color="#3498db" fill="#3498db33" />}
          value={player.thirst}
          color="linear-gradient(180deg, #5ab8ff 0%, #2980b9 100%)"
          bg="#18384a"
          label="口渴"
        />
      </div>

      <div className="absolute top-3 right-3">
        <div
          className="flex flex-col items-center"
          style={{
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.7)',
            border: '2px solid #444',
            boxShadow: '0 0 0 2px #000',
            minWidth: 120,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            {dayNight.phase === 'day' ? (
              <Sun size={16} color="#f1c40f" fill="#f1c40f44" />
            ) : (
              <Moon size={16} color="#95a5a6" fill="#95a5a633" />
            )}
            <div
              className="text-white"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 9 }}
            >
              第 {dayNight.dayCount} 天
            </div>
          </div>
          <div
            className="text-white"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 14 }}
          >
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </div>
          <div
            className="mt-1"
            style={{
              width: 96,
              height: 6,
              background: '#222',
              border: '1px solid #000',
            }}
          >
            <div
              style={{
                width: `${phasePct * 100}%`,
                height: '100%',
                background: dayNight.phase === 'day' ? '#f39c12' : '#34495e',
              }}
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {player.inventory.map((slot, i) => {
          const selected = player.selectedSlot === i;
          return (
            <div
              key={i}
              className="relative flex items-center justify-center"
              style={{
                width: 56,
                height: 56,
                background: 'rgba(0,0,0,0.75)',
                border: selected ? '3px solid #e74c3c' : '3px solid #555',
                boxShadow: selected
                  ? '0 0 12px rgba(231,76,60,0.6), 0 0 0 2px #000'
                  : '0 0 0 2px #000',
              }}
            >
              {slot.item && (
                <>
                  <ItemIcon type={slot.item} />
                  <div
                    className="absolute bottom-0 right-0 px-1 text-white"
                    style={{
                      fontFamily: '"Press Start 2P", monospace',
                      fontSize: 9,
                      textShadow: '1px 1px 0 #000',
                      background: 'rgba(0,0,0,0.6)',
                    }}
                  >
                    {slot.count}
                  </div>
                </>
              )}
              <div
                className="absolute top-0 left-0 text-white/70 px-1"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: 8,
                }}
              >
                {i + 1}
              </div>
              {slot.item && (
                <div
                  className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-white"
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: 7,
                    textShadow: '1px 1px 0 #000',
                  }}
                >
                  {ITEM_NAMES[slot.item]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="absolute bottom-28 left-1/2 -translate-x-1/2 text-white/70 text-center"
        style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 8,
          letterSpacing: 0.5,
          lineHeight: 1.8,
          background: 'rgba(0,0,0,0.4)',
          padding: '6px 10px',
          border: '1px solid #333',
        }}
      >
        WASD 移动 · E 搜刮/建造 · SHIFT 翻滚 · F 使用罐头 · 空格 饮水
      </div>
    </>
  );
}
