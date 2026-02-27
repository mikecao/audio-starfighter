import "./styles.css";
import { analyzeAudioTrack } from "./audio/analyze-track";
import type { AudioAnalysisResult, FeatureFrame, SpectrumTimeline } from "./audio/types";
import { setupScene } from "./render/scene";
import { createSimulation, type SimulationSnapshot } from "./game/sim";
import {
  buildPrecomputedRunAsync,
  type PrecomputedRun
} from "./game/precomputedRun";
import type { CombatConfigPatch } from "./game/combatConfig";
import { createAudioPanel } from "./ui/audioPanel";
import { createEventTimeline } from "./ui/eventTimeline";
import { createLoadingOverlay, type LoadingPhaseTone } from "./ui/loadingOverlay";

const BEST_SCORE_STORAGE_PREFIX = "audio-starfighter.best-score";
const ENEMY_BULLET_RATIO = 0.94;
const ANALYSIS_PROGRESS_START = 0.02;
const ANALYSIS_PROGRESS_END = 0.2;
const PRECOMPUTE_PROGRESS_START = 0.24;
const PRECOMPUTE_PROGRESS_SPAN = 0.76;
const PRECOMPUTE_CHUNK_SIZE_DEFAULT = 120;
const PRECOMPUTE_CHUNK_SIZE_PURPLE = 48;
const PRECOMPUTE_MAX_CHUNK_MS_DEFAULT = 10;
const PRECOMPUTE_MAX_CHUNK_MS_PURPLE = 5;
const PRECOMPUTE_STEP_SECONDS_DEFAULT = 1 / 180;
const PRECOMPUTE_STEP_SECONDS_PURPLE = 1 / 96;
const DEMO_RUN_SEED = 7;
const DEMO_CUE_START_SECONDS = 0.7;
const DEMO_CUE_END_SECONDS = 360;
const DEMO_CUE_INTERVAL_SECONDS = 0.55;
const DEMO_SPECTRUM_BIN_COUNT = 28;
const DEMO_SPECTRUM_HOP_SECONDS = 1 / 45;
let currentCombatConfig: CombatConfigPatch = {
  shipWeapons: {
    blueLaser: true,
    yellowLaser: true,
    greenLaser: true,
    purpleMissile: false
  },
  enemyRoster: {
    enabledArchetypes: ["redCube"],
    spawnScale: 1,
    fireScale: 1,
    enemyProjectileStyle: "balls"
  }
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app container");
}

const sceneHost = document.createElement("div");
sceneHost.className = "scene-host";
app.appendChild(sceneHost);

const loadingOverlay = createLoadingOverlay(app);

const uiHost = document.createElement("div");
uiHost.className = "ui-host";
app.appendChild(uiHost);

const scene = setupScene(sceneHost);
scene.setWaveformPlaneEnabled(false);
const demoSpectrumTimeline = createDemoSpectrumTimeline();
scene.setWaveformPlaneSpectrumTimeline(demoSpectrumTimeline);
const sim = createSimulation();
sim.setCombatConfig(currentCombatConfig);
sim.setEnemyBulletRatio(ENEMY_BULLET_RATIO);
const eventTimeline = createEventTimeline(uiHost);

let uiHidden = false;
const uiOverlaySelectors = [
  ".audio-controls-bar__main",
  ".audio-controls-settings",
  ".event-timeline",
  ".waveform-panel",
  ".spectrum-panel",
  ".playback-panel"
];

function setUiHidden(hidden: boolean): void {
  uiHidden = hidden;
  app!.classList.toggle("app--ui-hidden", hidden);
  for (const selector of uiOverlaySelectors) {
    const nodes = app!.querySelectorAll<HTMLElement>(selector);
    nodes.forEach((node) => {
      node.style.display = hidden ? "none" : "";
    });
  }
}

let latestSnapshot: SimulationSnapshot = sim.getSnapshot();
let precomputedRun: PrecomputedRun | null = null;
let currentBestScore = 0;
let currentRunKey: string | null = null;
let cachedTimelineAnalysisRef: object | null = null;
let cachedTimelineCues: Array<{ timeSeconds: number; source: "beat" | "peak" }> | null = null;
let usingCueFallback = false;
const audioPanel = createAudioPanel(uiHost, {
  onAnalyze(file) {
    loadingOverlay.show(
      "Analyzing Audio",
      `Decoding ${file.name}...`,
      ANALYSIS_PROGRESS_START,
      "Decode",
      "decode"
    );
    return analyzeAudioTrack(file, {
      onProgress(progress, message, stage) {
        const phase = mapAnalyzeStageToPhase(stage);
        loadingOverlay.setProgress(
          ANALYSIS_PROGRESS_START + progress * (ANALYSIS_PROGRESS_END - ANALYSIS_PROGRESS_START),
          message,
          phase.label,
          phase.tone
        );
      }
    }).catch((error) => {
      loadingOverlay.hide();
      throw error;
    });
  },
  async onStartRun(analysis, seed) {
    scene.setWaveformPlaneSpectrumTimeline(analysis.spectrum);
    loadingOverlay.show(
      "Preparing Synced Run",
      "Configuring simulation...",
      PRECOMPUTE_PROGRESS_START,
      "Precompute",
      "precompute"
    );
    const runTimeline = buildRunTimelineEvents(analysis);
    const intensityTimeline = buildIntensityTimeline(analysis.frames);
    sim.setRandomSeed(seed);
    sim.setMoodProfile(analysis.mood.label);
    sim.setIntensityTimeline(intensityTimeline);
    const cueTimesSeconds = runTimeline.events.map((cue) => cue.timeSeconds);
    sim.startTrackRun(cueTimesSeconds);
    try {
      const usesPurpleMissile = currentCombatConfig.shipWeapons?.purpleMissile === true;
      precomputedRun = await buildPrecomputedRunAsync(
        {
          seed,
          moodProfile: analysis.mood.label,
          intensityTimeline,
          cueTimesSeconds,
          durationSeconds: analysis.durationSeconds,
          stepSeconds: usesPurpleMissile
            ? PRECOMPUTE_STEP_SECONDS_PURPLE
            : PRECOMPUTE_STEP_SECONDS_DEFAULT,
          enemyBulletRatio: ENEMY_BULLET_RATIO,
          combatConfig: currentCombatConfig
        },
        {
          chunkSize: usesPurpleMissile ? PRECOMPUTE_CHUNK_SIZE_PURPLE : PRECOMPUTE_CHUNK_SIZE_DEFAULT,
          maxChunkMs: usesPurpleMissile
            ? PRECOMPUTE_MAX_CHUNK_MS_PURPLE
            : PRECOMPUTE_MAX_CHUNK_MS_DEFAULT,
          onProgress(progress) {
            const done = progress >= 1;
            loadingOverlay.setProgress(
              PRECOMPUTE_PROGRESS_START + progress * PRECOMPUTE_PROGRESS_SPAN,
              done
                ? "Finalizing replay cache..."
                : `Precomputing replay ${(progress * 100).toFixed(0)}%`,
              done ? "Finalize" : "Precompute",
              done ? "finalize" : "precompute"
            );
          }
        }
      );
      latestSnapshot = precomputedRun.getSnapshotAtTime(0);
      cachedTimelineAnalysisRef = analysis;
      cachedTimelineCues = runTimeline.events;
      usingCueFallback = runTimeline.usingCueFallback;
      appliedAnalysisRef = analysis;
      currentRunKey = buildBestScoreKey(analysis.fileName, seed);
      currentBestScore = loadBestScore(currentRunKey);
    } finally {
      loadingOverlay.hide();
    }
  },
  onCombatConfigChange(config) {
    currentCombatConfig = config;
    sim.setCombatConfig(currentCombatConfig);
  },
  onStageChange(stage) {
    scene.setStarfieldEnabled(stage === "starfield");
    scene.setWaveformPlaneEnabled(stage === "waveformPlane");
    scene.setOceanEnabled(stage === "ocean");
  },
  onStarfieldSpeedChange(speedScale) {
    scene.setStarfieldSpeedScale(speedScale);
  },
  onStarfieldShipMovementResponseChange(responseScale) {
    scene.setStarfieldShipMovementResponse(responseScale);
  },
  onWaveformPlaneSurfaceEnabledChange(side, enabled) {
    scene.setWaveformPlaneSurfaceEnabled(side, enabled);
  },
  onWaveformPlaneWireframeEnabledChange(side, enabled) {
    scene.setWaveformPlaneWireframeEnabled(side, enabled);
  },
  onWaveformPlaneSideEnabledChange(side, enabled) {
    scene.setWaveformPlaneSideEnabled(side, enabled);
  },
  onWaveformPlaneHeightScaleChange(side, heightScale) {
    scene.setWaveformPlaneHeightScale(side, heightScale);
  },
  onWaveformPlaneSurfaceShadingChange(side, shading) {
    scene.setWaveformPlaneSurfaceShading(side, shading);
  },
  onWaveformPlaneDistortionAlgorithmChange(side, algorithm) {
    scene.setWaveformPlaneDistortionAlgorithm(side, algorithm);
  },
  onWaveformPlaneSurfaceColorChange(side, colorHex) {
    scene.setWaveformPlaneSurfaceColor(side, colorHex);
  },
  onWaveformPlaneWireframeColorChange(side, colorHex) {
    scene.setWaveformPlaneWireframeColor(side, colorHex);
  },
  onWaveformPlaneSurfaceOpacityChange(side, opacity) {
    scene.setWaveformPlaneSurfaceOpacity(side, opacity);
  },
  onWaveformPlaneSpectrumSmoothingChange(side, smoothingTimeConstant) {
    scene.setWaveformPlaneSpectrumSmoothing(side, smoothingTimeConstant);
  },
  onOceanSizeChange(size) {
    scene.setOceanSize(size);
  },
  onOceanDistortionScaleChange(scale) {
    scene.setOceanDistortionScale(scale);
  },
  onOceanAmplitudeChange(amplitude) {
    scene.setOceanAmplitude(amplitude);
  },
  onOceanTimeOfDayChange(tod) {
    scene.setOceanTimeOfDay(tod);
  },
  onToggleUi() {
    setUiHidden(!uiHidden);
    return uiHidden;
  }
});
audioPanel.subscribeSpectrum((bins) => {
  scene.setWaveformPlaneSpectrum(bins);
});

sim.setRandomSeed(DEMO_RUN_SEED);
sim.startTrackRun(buildDemoCueTimes());
latestSnapshot = sim.getSnapshot();

let dragFileDepth = 0;

window.addEventListener("dragenter", (event) => {
  if (!isFileDragEvent(event)) {
    return;
  }
  event.preventDefault();
  dragFileDepth += 1;
  app.classList.add("app--drag-active");
});

window.addEventListener("dragover", (event) => {
  if (!isFileDragEvent(event)) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
  app.classList.add("app--drag-active");
});

window.addEventListener("dragleave", (event) => {
  if (!isFileDragEvent(event)) {
    return;
  }
  event.preventDefault();
  dragFileDepth = Math.max(0, dragFileDepth - 1);
  if (dragFileDepth === 0) {
    app.classList.remove("app--drag-active");
  }
});

window.addEventListener("drop", (event) => {
  if (!isFileDragEvent(event)) {
    return;
  }
  event.preventDefault();
  dragFileDepth = 0;
  app.classList.remove("app--drag-active");
  const file = pickAudioFileFromTransfer(event.dataTransfer);
  if (!file) {
    return;
  }
  void audioPanel.loadFile(file);
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
  scene.setWaveformPlaneTime(snapshot.simTimeSeconds);
  audioPanel.updateReactiveSpectrum(!uiHidden);
  if (analysis && analysis !== appliedAnalysisRef) {
    scene.setWaveformPlaneSpectrumTimeline(analysis.spectrum);
    const runTimeline = buildRunTimelineEvents(analysis);
    sim.setMoodProfile(analysis.mood.label);
    sim.setCombatConfig(currentCombatConfig);
    sim.setIntensityTimeline(buildIntensityTimeline(analysis.frames));
    sim.setCueTimeline(runTimeline.events.map((cue) => cue.timeSeconds));
    precomputedRun = null;
    cachedTimelineAnalysisRef = analysis;
    cachedTimelineCues = runTimeline.events;
    usingCueFallback = runTimeline.usingCueFallback;
    appliedAnalysisRef = analysis;
    currentRunKey = buildBestScoreKey(analysis.fileName, 7);
    currentBestScore = loadBestScore(currentRunKey);
  } else if (!analysis && appliedAnalysisRef !== null) {
    scene.setWaveformPlaneSpectrumTimeline(demoSpectrumTimeline);
    appliedAnalysisRef = null;
  }

  if (currentRunKey && snapshot.score > currentBestScore) {
    currentBestScore = snapshot.score;
    saveBestScore(currentRunKey, currentBestScore);
  }

  scene.update(snapshot, alpha);
  scene.render();
  if (!uiHidden) {
    audioPanel.setPlaybackTime(analysis ? audioPlaybackTimeSeconds : snapshot.simTimeSeconds);
  }
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

  if (!uiHidden) {
    eventTimeline.update({
      simTimeSeconds: snapshot.simTimeSeconds,
      audioTimeSeconds: analysis && audioPlaybackTimeSeconds > 0 ? audioPlaybackTimeSeconds : null,
      cueResolvedCount: snapshot.cueResolvedCount,
      cueMissedCount: snapshot.cueMissedCount,
      cues: cachedTimelineCues,
      usingBeatFallback: usingCueFallback
    });
  }

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

function isFileDragEvent(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) {
    return false;
  }
  return Array.from(types).includes("Files");
}

function pickAudioFileFromTransfer(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer || dataTransfer.files.length === 0) {
    return null;
  }

  const files = Array.from(dataTransfer.files);
  for (const file of files) {
    if (isSupportedAudioFile(file)) {
      return file;
    }
  }

  return null;
}

function isSupportedAudioFile(file: File): boolean {
  if (file.type.toLowerCase().startsWith("audio/")) {
    return true;
  }
  const name = file.name.toLowerCase();
  return [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".opus"].some((ext) =>
    name.endsWith(ext)
  );
}

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

function buildDemoCueTimes(): number[] {
  const cues: number[] = [];
  let t = DEMO_CUE_START_SECONDS;
  let index = 0;
  while (t <= DEMO_CUE_END_SECONDS) {
    cues.push(Number(t.toFixed(3)));
    const jitter = ((index % 4) - 1.5) * 0.018;
    t += DEMO_CUE_INTERVAL_SECONDS + jitter;
    index += 1;
  }
  return cues;
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

function mapAnalyzeStageToPhase(stage: string): { label: string; tone: LoadingPhaseTone } {
  switch (stage) {
    case "features":
      return { label: "Features", tone: "features" };
    case "beats":
      return { label: "Beat Detect", tone: "beats" };
    case "mood":
      return { label: "Mood", tone: "mood" };
    case "cues":
      return { label: "Cue Build", tone: "cues" };
    case "finalize":
      return { label: "Finalize", tone: "finalize" };
    case "decode":
    default:
      return { label: "Decode", tone: "decode" };
  }
}

function createDemoSpectrumTimeline(): SpectrumTimeline {
  const durationSeconds = DEMO_CUE_END_SECONDS + 4;
  const frameCount = Math.max(2, Math.floor(durationSeconds / DEMO_SPECTRUM_HOP_SECONDS) + 1);
  const binCount = DEMO_SPECTRUM_BIN_COUNT;
  const bins = new Float32Array(frameCount * binCount);
  const beatEnvelope = new Float32Array(frameCount);
  const beatSigma = 0.07;
  const beatDenominator = 2 * beatSigma * beatSigma;
  const beatTimes = buildDemoCueTimes();
  let beatIndex = 0;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const timeSeconds = frameIndex * DEMO_SPECTRUM_HOP_SECONDS;

    while (
      beatIndex < beatTimes.length - 1 &&
      (beatTimes[beatIndex + 1] ?? Number.POSITIVE_INFINITY) < timeSeconds
    ) {
      beatIndex += 1;
    }
    const prevBeat = beatTimes[Math.max(0, beatIndex)] ?? Number.POSITIVE_INFINITY;
    const nextBeat = beatTimes[Math.min(beatTimes.length - 1, beatIndex + 1)] ?? prevBeat;
    const prevDelta = timeSeconds - prevBeat;
    const nextDelta = timeSeconds - nextBeat;
    const beatPulse = Math.max(
      Math.exp(-(prevDelta * prevDelta) / beatDenominator),
      Math.exp(-(nextDelta * nextDelta) / beatDenominator)
    );
    beatEnvelope[frameIndex] = clamp01(beatPulse);

    const sweep = timeSeconds * 0.36;
    for (let binIndex = 0; binIndex < binCount; binIndex += 1) {
      const binT = binCount <= 1 ? 0 : binIndex / (binCount - 1);
      const lowEnvelope = Math.pow(1 - binT, 1.34);
      const ridgeA = Math.max(0, Math.sin((binT * 2.4 + sweep) * Math.PI * 2));
      const ridgeB = Math.max(0, Math.sin((binT * 7.3 - sweep * 1.4) * Math.PI * 2));
      const ridgeC = Math.max(0, Math.sin((binT * 15.5 + sweep * 0.92) * Math.PI * 2));
      const value =
        lowEnvelope * (0.2 + beatPulse * 0.58) +
        ridgeA * 0.2 +
        ridgeB * 0.14 +
        ridgeC * 0.08;
      bins[frameIndex * binCount + binIndex] = clamp01(value);
    }
  }

  return {
    frameHopSeconds: DEMO_SPECTRUM_HOP_SECONDS,
    frameCount,
    binCount,
    bins,
    beatEnvelope
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
