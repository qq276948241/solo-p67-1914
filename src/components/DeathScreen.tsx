import { useGameStore } from '../game/store';
import { Skull, Home, Calendar, Heart } from 'lucide-react';

export default function DeathScreen() {
  const dayNight = useGameStore((s) => s.dayNight);
  const deathReason = useGameStore((s) => s.deathReason);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(40,0,0,0.9) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="relative flex flex-col items-center gap-6 p-10"
        style={{
          background: 'linear-gradient(180deg, #2a1414 0%, #120808 100%)',
          border: '4px solid #6b1a1a',
          boxShadow:
            '0 0 0 4px #000, 0 0 80px rgba(231,76,60,0.3), inset 0 0 40px rgba(139,0,0,0.3)',
          minWidth: 520,
        }}
      >
        <div
          className="absolute -top-10 flex items-center justify-center rounded-full"
          style={{
            width: 80,
            height: 80,
            background: '#1a0808',
            border: '4px solid #c0392b',
            boxShadow: '0 0 0 3px #000, 0 0 30px rgba(231,76,60,0.6)',
          }}
        >
          <Skull size={44} color="#e74c3c" />
        </div>

        <div className="mt-8 text-center">
          <div
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 24,
              color: '#e74c3c',
              textShadow: '3px 3px 0 #000, 0 0 20px rgba(231,76,60,0.5)',
              letterSpacing: 2,
              lineHeight: 1.6,
            }}
          >
            你没能挺过这一天
          </div>
          <div
            className="mt-2"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 10,
              color: '#aaa',
              letterSpacing: 1,
            }}
          >
            GAME OVER
          </div>
        </div>

        <div
          className="w-full py-4 my-2"
          style={{
            borderTop: '2px dashed #552222',
            borderBottom: '2px dashed #552222',
          }}
        >
          <div className="flex flex-col gap-3"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 10,
              color: '#ddd',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={16} color="#f39c12" />
                <span>存活天数</span>
              </div>
              <span style={{ color: '#f39c12', fontSize: 14 }}>
                第 {dayNight.dayCount} 天
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Heart size={16} color="#e74c3c" />
                <span>死亡原因</span>
              </div>
              <span style={{ color: '#e74c3c' }}>
                {deathReason || '未知'}
              </span>
            </div>
          </div>
        </div>

        <div
          className="text-center my-2"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 8,
            color: '#8b7355',
            lineHeight: 2,
          }}
        >
          废土无情，下一次尝试一定能活得更久...
        </div>

        <button
          onClick={returnToMenu}
          className="group relative transition-transform duration-150 hover:scale-105 active:scale-95 mt-2"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 12,
            color: '#fff',
            background: 'linear-gradient(180deg, #555 0%, #222 100%)',
            border: '3px solid #000',
            boxShadow:
              '0 4px 0 #000, 0 0 0 3px #888 inset',
            padding: '12px 32px',
            letterSpacing: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Home size={16} />
          <span className="group-hover:animate-pulse">返回主菜单</span>
        </button>
      </div>
    </div>
  );
}
