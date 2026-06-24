import MainMenu from '@/components/MainMenu';
import GameCanvas from '@/components/GameCanvas';
import HUD from '@/components/HUD';
import DeathScreen from '@/components/DeathScreen';
import { useGameStore } from '@/game/store';

export default function App() {
  const scene = useGameStore((s) => s.scene);

  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div
        className="relative"
        style={{
          width: 960,
          height: 640,
        }}
      >
        {(scene === 'playing' || scene === 'dead') && (
          <>
            <GameCanvas />
            {scene === 'playing' && <HUD />}
            {scene === 'dead' && <DeathScreen />}
          </>
        )}
        {scene === 'menu' && <MainMenu />}
      </div>
    </div>
  );
}
