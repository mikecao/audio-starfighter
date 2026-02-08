import "./styles.css";
import { analyzeAudioTrack } from "./audio/analyze-track";
import type { FeatureFrame } from "./audio/types";
import { setupScene } from "./render/scene";
import { createSimulation, type SimulationSnapshot } from "./game/sim";
import { createDebugHud } from "./ui/debugHud";
import { createAudioPanel } from "./ui/audioPanel";

const BEST_SCORE_STORAGE_PREFIX = "audio-starfighter.best-score";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app container");
}

const scene = setupScene(app);
const sim = createSimulation();
const hud = createDebugHud(app);
let latestSnapshot: SimulationSnapshot = sim.getSnapshot();
let currentBestScore = 0;
let currentRunKey: string | null = null;
const audioPanel = createAudioPanel(app, {
  onAnalyze(file) {
    return analyzeAudioTrack(file);
  },
  onStartRun(analysis, seed) {
    sim.setRandomSeed(seed);
    sim.setIntensityTimeline(buildIntensityTimeline(analysis.frames));
    sim.startTrackRun(analysis.cues.map((cue) => cue.timeSeconds));
    appliedAnalysisRef = analysis;
    currentRunKey = buildBestScoreKey(analysis.fileName, seed);
    currentBestScore = loadBestScore(currentRunKey);
  },
  onExportSummary(seed) {
    const analysis = audioPanel.getLatestAnalysis();
    if (!analysis) {
      return null;
    }

    return {
      exportedAtIso: new Date().toISOString(),
      trackFileName: analysis.fileName,
      seed,
      bpm: analysis.beat.bpm,
      cueCount: analysis.cues.length,
      simTimeSeconds: latestSnapshot.simTimeSeconds,
      cueResolvedCount: latestSnapshot.cueResolvedCount,
      cueMissedCount: latestSnapshot.cueMissedCount,
      avgCueErrorMs: latestSnapshot.avgCueErrorMs,
      score: latestSnapshot.score,
      combo: latestSnapshot.combo,
      playbackDriftMs:
        analysis && audioPanel.getAudioPlaybackTime() > 0
          ? (latestSnapshot.simTimeSeconds - audioPanel.getAudioPlaybackTime()) * 1000
          : null
    };
  }
});
let appliedAnalysisRef: object | null = null;

let previousFrameTime = performance.now();
let accumulatorSeconds = 0;
let lastSimTimeSeconds = 0;
const fixedStepSeconds = 1 / 60;
const maxFrameSeconds = 0.25;

function animate(frameTimeMs: number): void {
  const rawFrameSeconds = (frameTimeMs - previousFrameTime) / 1000;
  previousFrameTime = frameTimeMs;

  const frameSeconds = Math.min(rawFrameSeconds, maxFrameSeconds);
  const analysis = audioPanel.getLatestAnalysis();
  const audioPlaybackTimeSecondsPreStep = audioPanel.getAudioPlaybackTime();
  const freezeForPausedAudio =
    analysis !== null &&
    audioPlaybackTimeSecondsPreStep > 0 &&
    !audioPanel.isAudioPlaying();
  const driftSecondsPreStep =
    audioPlaybackTimeSecondsPreStep > 0
      ? lastSimTimeSeconds - audioPlaybackTimeSecondsPreStep
      : 0;
  const simRateCorrection = clamp(1 - driftSecondsPreStep * 0.25, 0.9, 1.1);
  if (freezeForPausedAudio) {
    accumulatorSeconds = 0;
  } else {
    accumulatorSeconds += frameSeconds * simRateCorrection;
  }

  while (accumulatorSeconds >= fixedStepSeconds) {
    sim.step(fixedStepSeconds);
    accumulatorSeconds -= fixedStepSeconds;
  }

  const alpha = accumulatorSeconds / fixedStepSeconds;
  const snapshot: SimulationSnapshot = sim.getSnapshot();
  latestSnapshot = snapshot;
  lastSimTimeSeconds = snapshot.simTimeSeconds;
  const audioPlaybackTimeSeconds = audioPanel.getAudioPlaybackTime();
  const playbackDriftMs =
    analysis && audioPlaybackTimeSeconds > 0
      ? (snapshot.simTimeSeconds - audioPlaybackTimeSeconds) * 1000
      : null;
  if (analysis && analysis !== appliedAnalysisRef) {
    sim.setIntensityTimeline(buildIntensityTimeline(analysis.frames));
    sim.setCueTimeline(analysis.cues.map((cue) => cue.timeSeconds));
    appliedAnalysisRef = analysis;
    currentRunKey = buildBestScoreKey(analysis.fileName, 7);
    currentBestScore = loadBestScore(currentRunKey);
  }

  if (currentRunKey && snapshot.score > currentBestScore) {
    currentBestScore = snapshot.score;
    saveBestScore(currentRunKey, currentBestScore);
  }

  scene.update(snapshot, alpha);
  scene.render();
  audioPanel.setPlaybackTime(snapshot.simTimeSeconds);
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
    currentIntensity: snapshot.currentIntensity,
    score: snapshot.score,
    combo: snapshot.combo,
    playbackDriftMs,
    pendingCueCount: snapshot.pendingCueCount,
    plannedCueCount: snapshot.plannedCueCount,
    bestScore: currentBestScore
  });

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

window.addEventListener("resize", () => {
  scene.resize();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    accumulatorSeconds = 0;
    previousFrameTime = performance.now();
  }
});

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildIntensityTimeline(frames: FeatureFrame[]): Array<{
  timeSeconds: number;
  intensity: number;
}> {
  if (frames.length === 0) {
    return [];
  }

  const output: Array<{ timeSeconds: number; intensity: number }> = [];
  const targetIntervalSeconds = 1 / 30;
  let nextTime = 0;

  for (const frame of frames) {
    if (frame.timeSeconds < nextTime) {
      continue;
    }
    output.push({
      timeSeconds: frame.timeSeconds,
      intensity: frame.intensity
    });
    nextTime = frame.timeSeconds + targetIntervalSeconds;
  }

  const last = frames[frames.length - 1];
  if (output[output.length - 1]?.timeSeconds !== last.timeSeconds) {
    output.push({
      timeSeconds: last.timeSeconds,
      intensity: last.intensity
    });
  }

  return output;
}

function buildBestScoreKey(fileName: string, seed: number): string {
  return `${BEST_SCORE_STORAGE_PREFIX}:${fileName}:${seed}`;
}

function loadBestScore(key: string): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return 0;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures.
  }
}
