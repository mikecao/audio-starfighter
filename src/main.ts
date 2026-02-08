import "./styles.css";
import { analyzeAudioTrack } from "./audio/analyze-track";
import { setupScene } from "./render/scene";
import { createSimulation, type SimulationSnapshot } from "./game/sim";
import { createDebugHud } from "./ui/debugHud";
import { createAudioPanel } from "./ui/audioPanel";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app container");
}

const scene = setupScene(app);
const sim = createSimulation();
const hud = createDebugHud(app);
const audioPanel = createAudioPanel(app, {
  onAnalyze(file) {
    return analyzeAudioTrack(file);
  },
  onStartRun(analysis) {
    sim.setIntensityTimeline(
      analysis.frames.map((frame) => ({
        timeSeconds: frame.timeSeconds,
        intensity: frame.intensity
      }))
    );
    sim.startTrackRun(analysis.cues.map((cue) => cue.timeSeconds));
    appliedAnalysisRef = analysis;
  }
});
let appliedAnalysisRef: object | null = null;

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
  const analysis = audioPanel.getLatestAnalysis();
  if (analysis && analysis !== appliedAnalysisRef) {
    sim.setIntensityTimeline(
      analysis.frames.map((frame) => ({
        timeSeconds: frame.timeSeconds,
        intensity: frame.intensity
      }))
    );
    sim.setCueTimeline(analysis.cues.map((cue) => cue.timeSeconds));
    appliedAnalysisRef = analysis;
  }

  scene.update(snapshot, alpha);
  scene.render();
  hud.update({
    fps: frameSeconds > 0 ? 1 / frameSeconds : 0,
    simTimeSeconds: snapshot.simTimeSeconds,
    simTick: snapshot.simTick,
    enemyCount: snapshot.enemyCount,
    projectileCount: snapshot.projectileCount,
    bpm: analysis?.beat.bpm ?? null,
    cueCount: analysis?.cues.length ?? 0,
    cueResolvedCount: snapshot.cueResolvedCount,
    cueMissedCount: snapshot.cueMissedCount,
    avgCueErrorMs: snapshot.avgCueErrorMs,
    currentIntensity: snapshot.currentIntensity
  });

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

window.addEventListener("resize", () => {
  scene.resize();
});
