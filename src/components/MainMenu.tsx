import { useGameStore } from '../game/store';

export default function MainMenu() {
  const startGame = useGameStore((s) => s.startGame);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{
        background:
          'radial-gradient(circle at 30% 20%, #3d3529 0%, #1a1612 60%, #0a0806 100%)',
        overflow: 'hidden',
      }}
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
        viewBox="0 0 960 640"
        preserveAspectRatio="none"
      >
        {Array.from({ length: 60 }).map((_, i) => {
          const x = (i * 173) % 960;
          const y = (i * 97) % 640;
          return (
            <g key={i}>
              <rect x={x} y={y} width={8} height={4} fill="#5c4a32" />
              <rect x={x + 4} y={y + 8} width={10} height={3} fill="#4a3c28" />
              <rect x={x - 3} y={y + 14} width={6} height={5} fill="#6d5a3d" />
            </g>
          );
        })}
        <polygon points="120,520 200,360 280,520" fill="#2a241c" stroke="#1a1612" strokeWidth="2" />
        <polygon points="300,520 420,300 540,520" fill="#332b22" stroke="#1a1612" strokeWidth="2" />
        <polygon points="580,520 680,380 780,520" fill="#2a241c" stroke="#1a1612" strokeWidth="2" />
        <polygon points="760,520 860,340 940,520" fill="#332b22" stroke="#1a1612" strokeWidth="2" />
        <rect x="0" y="520" width="960" height="120" fill="#1e1914" />
      </svg>

      <div className="relative z-10 flex flex-col items-center gap-10">
        <div className="text-center">
          <div
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 40,
              color: '#e74c3c',
              textShadow:
                '4px 4px 0 #000, -2px -2px 0 #8b0000, 0 0 30px rgba(231,76,60,0.5)',
              letterSpacing: 3,
              lineHeight: 1.4,
            }}
          >
            WASTELAND
          </div>
          <div
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 32,
              color: '#f39c12',
              textShadow:
                '3px 3px 0 #000, -2px -2px 0 #a04000, 0 0 20px rgba(243,156,18,0.4)',
              letterSpacing: 4,
              marginTop: 6,
            }}
          >
            SCAVENGER
          </div>
          <div
            className="mt-6"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 10,
              color: '#8b7355',
              letterSpacing: 2,
            }}
          >
            废 土 拾 荒 · 生 存 挑 战
          </div>
        </div>

        <button
          onClick={startGame}
          className="group relative transition-transform duration-150 hover:scale-110 active:scale-95"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 18,
            color: '#fff',
            background: 'linear-gradient(180deg, #c0392b 0%, #7b1e13 100%)',
            border: '4px solid #000',
            boxShadow:
              '0 6px 0 #000, 0 0 0 4px #e74c3c inset, 0 0 40px rgba(231,76,60,0.4)',
            padding: '16px 44px',
            letterSpacing: 3,
            cursor: 'pointer',
          }}
        >
          <span className="group-hover:animate-pulse inline-block">▶ 开始游戏</span>
        </button>

        <div
          className="mt-4 p-6"
          style={{
            background: 'rgba(0,0,0,0.7)',
            border: '3px solid #444',
            boxShadow: '0 0 0 3px #000',
            minWidth: 520,
          }}
        >
          <div
            className="mb-4 text-center"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 12,
              color: '#f39c12',
              letterSpacing: 2,
            }}
          >
            操作说明
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 9,
              color: '#ccc',
              lineHeight: 2,
            }}
          >
            <div>
              <span style={{ color: '#3498db' }}>W A S D</span>
              <span className="ml-3">移动角色</span>
            </div>
            <div>
              <span style={{ color: '#3498db' }}>E</span>
              <span className="ml-3">搜刮 / 建造 / 添柴</span>
            </div>
            <div>
              <span style={{ color: '#3498db' }}>SHIFT</span>
              <span className="ml-3">翻滚（无敌躲攻击）</span>
            </div>
            <div>
              <span style={{ color: '#3498db' }}>F</span>
              <span className="ml-3">吃罐头恢复饱食</span>
            </div>
            <div>
              <span style={{ color: '#3498db' }}>空格</span>
              <span className="ml-3">净水器旁饮水</span>
            </div>
            <div>
              <span style={{ color: '#3498db' }}>1 ~ 6</span>
              <span className="ml-3">选择背包格</span>
            </div>
          </div>
          <div
            className="mt-5 pt-4 border-t border-gray-700 text-center"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 8,
              color: '#888',
              lineHeight: 2,
            }}
          >
            白天搜刮建造 · 夜晚点燃火堆保暖 · 小心野狗的前摇攻击！
          </div>
        </div>
      </div>
    </div>
  );
}
