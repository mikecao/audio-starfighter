import "./styles.css";
import { analyzeAudioTrack } from "./audio/analyze-track";
import type { AudioAnalysisResult, FeatureFrame } from "./audio/types";
import { setupScene } from "./render/scene";
import { createSimulation, type SimulationSnapshot } from "./game/sim";
import { buildPrecomputedRun, type PrecomputedRun } from "./game/precomputedRun";
import { createDebugHud } from "./ui/debugHud";
import { createAudioPanel } from "./ui/audioPanel";
import { createEventTimeline } from "./ui/eventTimeline";

const BEST_SCORE_STORAGE_PREFIX = "audio-starfighter.best-score";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app container");
}

const scene = setupScene(app);
const sim = createSimulation();
const hud = createDebugHud(app);
const eventTimeline = createEventTimeline(app);
const canvasOnlyButton = document.createElement("button");
canvasOnlyButton.type = "button";
canvasOnlyButton.className = "ui-toggle-button";
canvasOnlyButton.textContent = "Hide UI";
canvasOnlyButton.title = "Toggle interface visibility";
app.appendChild(canvasOnlyButton);

let uiHidden = false;
const uiOverlaySelectors = [".audio-panel", ".debug-hud", ".event-timeline"];

function setUiHidden(hidden: boolean): void {
  uiHidden = hidden;
  canvasOnlyButton.textContent = hidden ? "Show UI" : "Hide UI";
  for (const selector of uiOverlaySelectors) {
    const nodes = app!.querySelectorAll<HTMLElement>(selector);
    nodes.forEach((node) => {
      node.style.display = hidden ? "none" : "";
    });
  }
}

canvasOnlyButton.addEventListener("click", () => {
  setUiHidden(!uiHidden);
});

let latestSnapshot: SimulationSnapshot = sim.getSnapshot();
let precomputedRun: PrecomputedRun | null = null;
let precomputeStatsText = "off";
let currentBestScore = 0;
let currentRunKey: string | null = null;
let cachedTimelineAnalysisRef: object | null = null;
let cachedTimelineCues: Array<{ timeSeconds: number; source: "beat" | "peak" }> | null = null;
let usingCueFallback = false;
const audioPanel = createAudioPanel(app, {
  onAnalyze(file) {
    return analyzeAudioTrack(file);
  },
  onStartRun(analysis, seed) {
    const runTimeline = buildRunTimelineEvents(analysis);
    const intensityTimeline = buildIntensityTimeline(analysis.frames);
    sim.setRandomSeed(seed);
    sim.setMoodProfile(analysis.mood.label);
    sim.setIntensityTimeline(intensityTimeline);
    const cueTimesSeconds = runTimeline.events.map((cue) => cue.timeSeconds);
    sim.startTrackRun(cueTimesSeconds);
    precomputedRun = buildPrecomputedRun({
      seed,
      moodProfile: analysis.mood.label,
      intensityTimeline,
      cueTimesSeconds,
      durationSeconds: analysis.durationSeconds
    });
    precomputeStatsText = formatPrecomputeStats(precomputedRun);
    latestSnapshot = precomputedRun.getSnapshotAtTime(0);
    cachedTimelineAnalysisRef = analysis;
    cachedTimelineCues = runTimeline.events;
    usingCueFallback = runTimeline.usingCueFallback;
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
      mood: analysis.mood.label,
      moodConfidence: analysis.mood.confidence,
      cueCount: buildRunTimelineEvents(analysis).events.length,
      simTimeSeconds: latestSnapshot.simTimeSeconds,
      cueResolvedCount: latestSnapshot.cueResolvedCount,
      cueMissedCount: latestSnapshot.cueMissedCount,
      cueHitRate:
        latestSnapshot.cueResolvedCount + latestSnapshot.cueMissedCount > 0
          ? latestSnapshot.cueResolvedCount /
            (latestSnapshot.cueResolvedCount + latestSnapshot.cueMissedCount)
          : 0,
      pendingCueCount: latestSnapshot.pendingCueCount,
      plannedCueCount: latestSnapshot.plannedCueCount,
      queuedCueShotCount: latestSnapshot.queuedCueShotCount,
      avgCueErrorMs: latestSnapshot.avgCueErrorMs,
      score: latestSnapshot.score,
      bestScore: currentBestScore,
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
  const activePrecomputedRun = precomputedRun;
  const hasPrecomputedRun = activePrecomputedRun !== null;
  const audioPlaybackTimeSecondsPreStep = audioPanel.getAudioPlaybackTime();
  const isAudioPlaying = audioPanel.isAudioPlaying();
  const freezeForPausedAudio =
    analysis !== null &&
    audioPlaybackTimeSecondsPreStep > 0 &&
    !isAudioPlaying;
  const followAudioClock =
    analysis !== null && audioPlaybackTimeSecondsPreStep > 0 && isAudioPlaying;
  if (hasPrecomputedRun) {
    accumulatorSeconds = 0;
  } else if (freezeForPausedAudio) {
    accumulatorSeconds = 0;
  } else if (followAudioClock) {
    const catchUpSeconds = audioPlaybackTimeSecondsPreStep - lastSimTimeSeconds;
    if (catchUpSeconds > 0) {
      accumulatorSeconds += Math.min(catchUpSeconds, maxFrameSeconds);
    } else if (catchUpSeconds < -fixedStepSeconds) {
      accumulatorSeconds = 0;
    }
  } else {
    accumulatorSeconds += frameSeconds;
  }

  while (!hasPrecomputedRun && accumulatorSeconds >= fixedStepSeconds) {
    sim.step(fixedStepSeconds);
    accumulatorSeconds -= fixedStepSeconds;
  }

  const alpha = accumulatorSeconds / fixedStepSeconds;
  const snapshot: SimulationSnapshot = hasPrecomputedRun
    ? activePrecomputedRun.getSnapshotAtTime(
        audioPlaybackTimeSecondsPreStep > 0 ? audioPlaybackTimeSecondsPreStep : 0
      )
    : sim.getSnapshot();
  latestSnapshot = snapshot;
  lastSimTimeSeconds = snapshot.simTimeSeconds;
  const audioPlaybackTimeSeconds = audioPanel.getAudioPlaybackTime();
  const playbackDriftMs =
    analysis && audioPlaybackTimeSeconds > 0
      ? (snapshot.simTimeSeconds - audioPlaybackTimeSeconds) * 1000
      : null;
  if (analysis && analysis !== appliedAnalysisRef) {
    const runTimeline = buildRunTimelineEvents(analysis);
    sim.setMoodProfile(analysis.mood.label);
    sim.setIntensityTimeline(buildIntensityTimeline(analysis.frames));
    sim.setCueTimeline(runTimeline.events.map((cue) => cue.timeSeconds));
    precomputedRun = null;
    precomputeStatsText = "off";
    cachedTimelineAnalysisRef = analysis;
    cachedTimelineCues = runTimeline.events;
    usingCueFallback = runTimeline.usingCueFallback;
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
  if (analysis !== cachedTimelineAnalysisRef) {
    if (analysis) {
      const runTimeline = buildRunTimelineEvents(analysis);
      cachedTimelineCues = runTimeline.events;
      usingCueFallback = runTimeline.usingCueFallback;
    } else {
      cachedTimelineCues = null;
      usingCueFallback = false;
    }
    cachedTimelineAnalysisRef = analysis;
  }

  eventTimeline.update({
    simTimeSeconds: snapshot.simTimeSeconds,
    audioTimeSeconds: analysis && audioPlaybackTimeSeconds > 0 ? audioPlaybackTimeSeconds : null,
    cueResolvedCount: snapshot.cueResolvedCount,
    cueMissedCount: snapshot.cueMissedCount,
    cues: cachedTimelineCues,
    usingBeatFallback: usingCueFallback
  });
  hud.update({
    fps: frameSeconds > 0 ? 1 / frameSeconds : 0,
    simTimeSeconds: snapshot.simTimeSeconds,
    simTick: snapshot.simTick,
    enemyCount: snapshot.enemyCount,
    projectileCount: snapshot.projectileCount,
    bpm: analysis?.beat.bpm ?? null,
    cueCount: cachedTimelineCues?.length ?? 0,
    cueResolvedCount: snapshot.cueResolvedCount,
    cueMissedCount: snapshot.cueMissedCount,
    avgCueErrorMs: snapshot.avgCueErrorMs,
    currentIntensity: snapshot.currentIntensity,
    score: snapshot.score,
    combo: snapshot.combo,
    playbackDriftMs,
    pendingCueCount: snapshot.pendingCueCount,
    plannedCueCount: snapshot.plannedCueCount,
    upcomingCueWindowCount: snapshot.upcomingCueWindowCount,
    availableCueTargetCount: snapshot.availableCueTargetCount,
    queuedCueShotCount: snapshot.queuedCueShotCount,
    bestScore: currentBestScore,
    moodProfile: snapshot.moodProfile,
    precomputeStats: precomputeStatsText
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

function buildRunTimelineEvents(analysis: AudioAnalysisResult): {
  events: Array<{ timeSeconds: number; source: "beat" | "peak" }>;
  usingCueFallback: boolean;
} {
  const beatEvents = analysis.beat.beatTimesSeconds
    .filter((timeSeconds) => Number.isFinite(timeSeconds) && timeSeconds >= 0)
    .map((timeSeconds) => ({ timeSeconds, source: "beat" as const }));

  if (beatEvents.length > 0) {
    return {
      events: beatEvents,
      usingCueFallback: false
    };
  }

  const cueEvents = analysis.cues
    .filter((cue) => Number.isFinite(cue.timeSeconds) && cue.timeSeconds >= 0)
    .map((cue) => ({ timeSeconds: cue.timeSeconds, source: cue.source }));

  return {
    events: cueEvents,
    usingCueFallback: true
  };
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

function formatPrecomputeStats(run: PrecomputedRun): string {
  const mb = run.estimatedBytes / (1024 * 1024);
  return `${run.snapshots.length} frames | ${run.buildMs.toFixed(0)}ms | ${mb.toFixed(1)}MB`;
}
