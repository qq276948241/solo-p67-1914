import { useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import { VIEW_W, VIEW_H } from '../game/constants';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const engine = new GameEngine(canvas);
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        style={{
          width: VIEW_W,
          height: VIEW_H,
          imageRendering: 'pixelated',
          display: 'block',
          background: '#000',
          border: '4px solid #1a1a1a',
          boxShadow:
            '0 0 0 2px #000, 0 0 60px rgba(0,0,0,0.8), inset 0 0 0 1px #333',
        }}
      />
    </div>
  );
}
