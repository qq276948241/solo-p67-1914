# 游戏核心运行流程全链路

> 从玩家点主菜单「开始游戏」→ 游戏中运行 → 死亡 → 返回主菜单的完整生命周期说明

---

## 一、总览流程图

```
┌──────────────────────┐
│  浏览器加载 index.html  │
│  React 渲染 App.tsx      │
└──────────┬───────────────┘
           │ scene === 'menu'
           ▼
┌──────────────────────┐
│   MainMenu 主菜单       │
│   点击「▶ 开始游戏」      │
└──────────┬───────────────┘
           │ store.startGame()
           │  → scene = 'playing'
           │  → 初始化 player/resources/dogs/...
           ▼
┌──────────────────────────────────────────────┐
│            GameCanvas 组件挂载                 │
│   useEffect() → new GameEngine(canvas)         │
│   → engine.start() → requestAnimationFrame     │
└──────────────────────┬───────────────────────┘
                       │ 每帧 RAF 循环 (60fps)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 GameEngine.tick(now)                     │
│  ① 读取 store 状态                                        │
│  ② scene==='playing' ? 走逻辑 : 只渲染                   │
│  ③ updateRaw(state) → updateGame() 执行 9 个子系统        │
│  ④ renderer.render() 绘制到 canvas                        │
│  ⑤ 每 100ms 推送一次 setState 触发 React HUD 刷新          │
└──────────────────────┬──────────────────────────────────┘
                       │ player.hp <= 0
                       │ updateDeath() → scene = 'dead'
                       ▼
┌──────────────────────┐
│   DeathScreen 死亡界面   │
│   显示存活天数+死因        │
│   点击「返回主菜单」       │
└──────────┬───────────────┘
           │ store.toMenu()
           │  → scene = 'menu'
           ▼
    ┌──────────────┐
    │  回到 MainMenu │
    └──────────────┘
```

---

## 二、阶段 1：启动与主菜单

### 2.1 React 根组件路由

文件：[App.tsx](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/App.tsx)

```tsx
export default function App() {
  const scene = useGameStore((s) => s.scene);
  return (
    <div className="relative" style={{ width: 960, height: 640 }}>
      {(scene === 'playing' || scene === 'dead') && (
        <>
          <GameCanvas />
          {scene === 'playing' && <HUD />}
          {scene === 'dead' && <DeathScreen />}
        </>
      )}
      {scene === 'menu' && <MainMenu />}
    </div>
  );
}
```

用一个 Zustand store 的 `scene` 字段（`'menu' | 'playing' | 'dead'`）控制渲染哪个界面。这是整个游戏的场景切换总开关。

### 2.2 主菜单 → 开始游戏

文件：[components/MainMenu.tsx](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/components/MainMenu.tsx)

```tsx
const startGame = useGameStore((s) => s.startGame);
<button onClick={startGame}>▶ 开始游戏</button>
```

点击后调用 store 的 `startGame()`，它会完整初始化所有游戏数据：

文件：[game/store.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/store.ts#L176-L205)

```typescript
startGame: () => {
  const player = makeInitialPlayer();
  set({
    scene: 'playing',
    player,
    resources: makeInitialResources(player.pos),
    buildSpots: makeBuildSpots(),
    dogs: makeInitialDogs(player.pos),
    dayNight: {
      phase: 'day',
      phaseEndTime: performance.now() + DAY_DURATION_MS,
      dayCount: 1,
    },
    floatMessages: [],
    noises: [],
    cameraShakeUntil: 0,
    deathReason: '',
    lastTickTime: performance.now(),
  });
},
```

**关键**：这里不只是改 scene，而是重新生成 player/resources/dogs/dayNight 全部初始状态，保证每次开局都是新的。

---

## 三、阶段 2：游戏引擎启动（GameCanvas 挂载）

文件：[components/GameCanvas.tsx](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/components/GameCanvas.tsx)

```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);
const engineRef = useRef<GameEngine | null>(null);

useEffect(() => {
  if (!canvasRef.current) return;
  engineRef.current = new GameEngine(canvasRef.current);
  engineRef.current.start();
  return () => {
    engineRef.current?.destroy();
  };
}, []);
```

只要 App 渲染了 GameCanvas（scene 不是 menu 时），就会在 useEffect 里：
1. 创建 `GameEngine(canvas)` 实例
2. 绑定键盘输入（InputManager 在 GameEngine 构造函数里创建）
3. 调用 `engine.start()` 开启 RAF 主循环
4. 卸载时 `engine.destroy()` 清理 RAF 和键盘事件

---

## 四、阶段 3：主循环（RAF 每帧执行）

文件：[game/GameEngine.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/GameEngine.ts#L25-L66)

```typescript
start() {
  if (this.running) return;
  this.running = true;
  const loop = (now: number) => {
    if (!this.running) return;
    this.tick(now);
    this.rafId = requestAnimationFrame(loop);
  };
  this.rafId = requestAnimationFrame(loop);
}

private tick(now: number) {
  const snap = useGameStore.getState();
  if (snap.scene !== 'playing') {
    this.renderFrame(snap, now);       // 非 playing 只渲染，不跑逻辑
    this.input.endFrame();
    return;
  }

  // ⭐ 核心：通过 updateRaw 绕过 React，直接改游戏状态
  useGameStore.getState().updateRaw((state) => {
    updateGame(state, this.input, now);
  });

  const after = useGameStore.getState();
  this.renderFrame(after, now);         // 渲染到 canvas
  this.input.endFrame();                // 清理 justPressed 标记

  // 每 100ms 手动触发一次 React setState → HUD 刷新
  if (now - this.lastPushTime > 100) {
    this.lastPushTime = now;
    useGameStore.setState({});
  }
}
```

### 4.1 为什么用 updateRaw 而不是 setState？

Zustand 每次 `setState` 都会触发订阅组件重渲染。游戏 60fps 运行，每帧 setState 的话 React 会 60 次/s 重渲染 HUD，性能浪费。

所以我们设计了 `updateRaw`：
- 直接 mutate store 内部对象（游戏状态非常复杂，不可变更新代价高）
- 只在每 100ms 触发一次 setState，让 HUD 以 10fps 刷新就足够了

### 4.2 为什么 scene !== 'playing' 也要渲染？

死亡界面（scene='dead'）仍然需要显示游戏画面作为背景，然后在上面叠加死亡结算层。所以 scene='dead' 时，GameCanvas 还在，主循环还在跑 RAF，只是不执行 updateGame 逻辑（让世界定格在死的那一刻）。

---

## 五、阶段 4：updateGame() 的 9 个子系统

文件：[game/logic.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/logic.ts#L554-L573)

```typescript
export function updateGame(state, input, now) {
  const dtSec = (now - state.lastTickTime) / 1000;
  state.lastTickTime = now;

  updatePlayerMovement(state, input, now);      // ① 移动/翻滚
  updateInventorySelection(state, input);       // ② 数字键 1-6 选背包
  updateUseItem(state, input, now);             // ③ F吃罐头 / 空格喝水
  updateInteraction(state, input, now);         // ④ E搜刮 / E建造 / E加柴
  updateDayNight(state, now, dtSec);            // ⑤ 昼夜循环 + 夜晚寒冷扣血
  updateVitals(state, dtSec);                   // ⑥ 饥饿/口渴扣减
  updateDogs(state, now);                       // ⑦ 野狗 AI（含噪音模块）
  updateCleanup(state, now);                    // ⑧ 清理过期 floatMessage / noises
  updateDeath(state);                           // ⑨ 检测死亡 → scene='dead'
}
```

每个子系统独立函数，单一职责，便于调试。下面挑几个最关键的讲。

### 5.1 移动与翻滚

```typescript
// 正常 WASD 移动（速度 PLAYER_SPEED=3 像素/帧）
if (dx !== 0 || dy !== 0) {
  const n = normalize({ x: dx, y: dy });
  player.pos.x += n.x * PLAYER_SPEED;
  player.pos.y += n.y * PLAYER_SPEED;
}

// Shift 翻滚：ROLL_SPEED=12px/帧，持续 400ms，期间无敌
if (input.isDown('shift') && player.rollCooldownUntil <= now) {
  player.isRolling = true;
  player.invincibleUntil = now + ROLL_DURATION;   // 野狗咬不进来
  player.rollCooldownUntil = now + ROLL_COOLDOWN;  // 2秒冷却
}
```

### 5.2 E 键交互（搜刮 / 建造 / 加柴，三合一）

```typescript
function updateInteraction(state, input, now) {
  if (!input.justPressed('e')) return;
  if (tryLoot(state, now)) return;   // 优先尝试搜刮
  tryBuildOrRefuel(state, now);      // 搜刮没东西再尝试建造/加柴
}
```

搜刮成功会触发噪音，把附近的野狗引过来（详见「噪音机制」章节）：

```typescript
function tryLoot(state, now) {
  // ... 找到最近的未搜刮资源点 ...
  nearestResource.looted = true;
  emitNoise(state, nearestResource.pos, 'loot', now);  // ⭐ 产生搜刮噪音
  // ... 给玩家背包加木头/罐头/破布 ...
}
```

### 5.3 野狗 AI + 噪音机制

文件：[game/logic.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/logic.ts#L376-L464)（updateSingleDog）
文件：[game/noise.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/noise.ts)（噪音模块）

野狗每帧的状态机流转：

```
                    听到噪音/嗅探到玩家
   ┌───────────┐  ──────────────────────►  ┌──────────┐
   │   idle    │                           │  chase   │
   └───────────┘  ◄──────────────────────  └────┬─────┘
                       玩家超出嗅探范围 1.5x      │
                                                │ 距离 < DOG_ATTACK_RANGE
                                                ▼
                                          ┌──────────┐
                                          │  windup  │  (攻击前摇 600ms)
                                          └────┬─────┘
                                                │ 前摇结束
                                                ▼
                                          ┌──────────┐
                                          │ cooldown │  (2秒后转 idle)
                                          └──────────┘
```

野狗在 chase 状态的移动目标有**优先级**：噪音源 > 玩家。由 noise 模块的 `getDogEffectiveTarget()` 决定：

```typescript
// noise.ts
export function getDogEffectiveTarget(dog, now, fallback) {
  return hasActiveInvestigation(dog, now) ? dog.investigateTarget : fallback;
}

// logic.ts 里使用
const target = getDogEffectiveTarget(dog, now, player.pos);  // 噪音优先
// ... 狗朝 target 方向移动 ...
```

到达噪音源附近（<40px）后清除调查目标，但**不转 idle**，保持 chase 状态继续嗅探玩家——这是修复「狗追完噪音卡在墙边不动」的关键。

### 5.4 昼夜循环

```typescript
if (now >= dn.phaseEndTime) {
  if (dn.phase === 'day') {
    dn.phase = 'night';
    dn.phaseEndTime = now + NIGHT_DURATION_MS;   // 夜晚 90 秒
  } else {
    dn.phase = 'day';
    dn.phaseEndTime = now + DAY_DURATION_MS;     // 白天 120 秒
    dn.dayCount++;
    state.resources.push(...makeFreshResources(player.pos));  // ⭐ 新的一天刷资源
  }
}
```

夜晚（`phase==='night'`）如果玩家**不在任何已点燃的篝火 CAMPFIRE_WARM_RANGE(120px) 范围内**，每秒扣 2 血：

```typescript
if (dn.phase === 'night' && !nearCampfire) {
  player.hp -= NIGHT_HP_DRAIN_PER_SEC * dtSec;  // 2 hp/s
  state.deathReason = '严寒冻死';
}
```

### 5.5 死亡检测

最后一个子系统 `updateDeath()` 检查血量：

```typescript
function updateDeath(state) {
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.scene = 'dead';   // ⭐ 场景切换到死亡
  }
}
```

一旦 `scene='dead'`，下一个 RAF tick 就会进入「只渲染不跑逻辑」的分支，世界冻结在死亡瞬间。

---

## 六、阶段 5：渲染

文件：[game/renderer.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/renderer.ts)

渲染调用栈（`renderer.render(state, now)`）按 9 个层级顺序绘制：

| 层级 | 内容 | 说明 |
|---|---|---|
| 1 | 背景瓷砖（灰瓦+瓦砾碎片） | 960x640 视口按相机位置只画可见区域 |
| 2 | 建造点标记（空/围墙/篝火/净水器） | 篝火带跳动火焰动画 |
| 3 | 资源点（废弃汽车/便利店废墟） | 已搜刮的变灰 |
| 4 | 野狗 | HP 血条 + 头顶循声波纹指示 |
| 5 | 玩家 | 4 方向像素小人 + 翻滚旋转效果 |
| 6 | 夜晚黑暗遮罩 | phase='night' 时叠加半透明黑，篝火范围内打洞发光 |
| 7 | 交互提示（E 搜刮 / E 建造） | 玩家靠近资源/建造点时显示 |
| 8 | 噪音声波（搜刮黄圈/建造绿圈） | noise 模块的 `renderNoises()` 绘制 |
| 9 | 浮动文字（+30饱食 / -10血 / 获得罐头 x2） | `drawFloatMessages()` 1.5 秒内向上飘淡出 |

**相机跟随**：相机中心始终对其玩家，加 150ms 震屏（被狗咬时 `cameraShakeUntil`）偏移。

```typescript
this.camera.x = clamp(state.player.pos.x - VIEW_W / 2, 0, MAP_WIDTH - VIEW_W);
this.camera.y = clamp(state.player.pos.y - VIEW_H / 2, 0, MAP_HEIGHT - VIEW_H);
// 震屏
if (now < state.cameraShakeUntil) {
  shakeX = (Math.random() - 0.5) * 6;
  shakeY = (Math.random() - 0.5) * 6;
}
ctx.translate(-camera.x + shakeX, -camera.y + shakeY);  // 后续所有绘制都在世界坐标
```

---

## 七、阶段 6：死亡界面 → 返回主菜单

文件：[components/DeathScreen.tsx](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/components/DeathScreen.tsx)

```tsx
const toMenu = useGameStore((s) => s.toMenu);
const day = useGameStore((s) => s.dayNight.dayCount);
const reason = useGameStore((s) => s.deathReason);

<button onClick={toMenu}>返回主菜单</button>
```

`toMenu()` 只是简单地把 scene 切回 menu：

```typescript
toMenu: () => set({ scene: 'menu' }),
```

切回 menu 后，App.tsx 不再渲染 GameCanvas，GameCanvas 的 useEffect 清理函数执行 → `engine.destroy()` → RAF 停止、键盘事件解绑。下次再点开始游戏时，一切重新初始化。

---

## 八、文件职责速查

| 文件 | 职责 |
|---|---|
| [App.tsx](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/App.tsx) | 根据 scene 渲染主菜单 / 游戏 / 死亡 |
| [store.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/store.ts) | Zustand 全局状态 + startGame/toMenu/updateRaw |
| [GameEngine.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/GameEngine.ts) | RAF 主循环，调度逻辑和渲染 |
| [InputManager.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/InputManager.ts) | 键盘输入（isDown/justPressed） |
| [logic.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/logic.ts) | 9 个子系统的游戏逻辑 |
| [noise.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/noise.ts) | 噪音产生/野狗听声/声波渲染 |
| [renderer.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/renderer.ts) | 9 层 Canvas 像素渲染 |
| [types.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/types.ts) | 全部类型定义 |
| [constants.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/constants.ts) | 62 个游戏平衡参数 |
| [utils.ts](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/game/utils.ts) | 背包堆叠/距离/随机数/物品增删工具 |
| [MainMenu.tsx](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/components/MainMenu.tsx) | 像素风主菜单 |
| [GameCanvas.tsx](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/components/GameCanvas.tsx) | canvas 容器 + GameEngine 生命周期 |
| [HUD.tsx](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/components/HUD.tsx) | 血/饥饿/口渴 + 倒计时 + 6格背包 |
| [DeathScreen.tsx](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo67/project67/src/components/DeathScreen.tsx) | 死亡结算 + 返回主菜单 |
