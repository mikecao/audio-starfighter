import "./styles.css";
import { setupScene } from "./render/scene";
import { createSimulation, type SimulationSnapshot } from "./game/sim";
import { createDebugHud } from "./ui/debugHud";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app container");
}

const scene = setupScene(app);
const sim = createSimulation();
const hud = createDebugHud(app);

let previousFrameTime = performance.now();
let accumulatorSeconds = 0;
const fixedStepSeconds = 1 / 60;
const maxFrameSeconds = 0.25;

function animate(frameTimeMs: number): void {
  const rawFrameSeconds = (frameTimeMs - previousFrameTime) / 1000;
  previousFrameTime = frameTimeMs;

  const frameSeconds = Math.min(rawFrameSeconds, maxFrameSeconds);
  accumulatorSeconds += frameSeconds;

  while (accumulatorSeconds >= fixedStepSeconds) {
    sim.step(fixedStepSeconds);
    accumulatorSeconds -= fixedStepSeconds;
  }

  const alpha = accumulatorSeconds / fixedStepSeconds;
  const snapshot: SimulationSnapshot = sim.getSnapshot();

  scene.update(snapshot, alpha);
  scene.render();
  hud.update({
    fps: frameSeconds > 0 ? 1 / frameSeconds : 0,
    simTimeSeconds: snapshot.simTimeSeconds,
    simTick: snapshot.simTick,
    enemyCount: snapshot.enemyCount,
    projectileCount: snapshot.projectileCount
  });

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

window.addEventListener("resize", () => {
  scene.resize();
});
