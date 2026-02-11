import type { AudioAnalysisResult } from "../audio/types";

const RUN_SEED_STORAGE_KEY = "audio-starfighter.run-seed";

type AudioPanelHandlers = {
  onAnalyze: (file: File) => Promise<AudioAnalysisResult>;
  onStartRun: (analysis: AudioAnalysisResult, seed: number) => void | Promise<void>;
  onExportSummary: (seed: number) => Record<string, unknown> | null;
};

export type AudioPanel = {
  getLatestAnalysis: () => AudioAnalysisResult | null;
  setPlaybackTime: (timeSeconds: number) => void;
  getAudioPlaybackTime: () => number;
  isAudioPlaying: () => boolean;
  loadFile: (file: File) => Promise<void>;
};

export function createAudioPanel(
  container: HTMLElement,
  handlers: AudioPanelHandlers
): AudioPanel {
  const panel = document.createElement("section");
  panel.className = "audio-panel";

  const title = document.createElement("h2");
  title.className = "audio-panel__title";
  title.textContent = "Audio Analysis";
  panel.appendChild(title);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "audio/*";
  fileInput.className = "audio-panel__file";
  panel.appendChild(fileInput);

  const status = document.createElement("p");
  status.className = "audio-panel__status";
  status.textContent = "Load a track to generate BPM and cue timeline.";
  panel.appendChild(status);

  const stats = document.createElement("p");
  stats.className = "audio-panel__stats";
  stats.textContent = "No analysis yet.";
  panel.appendChild(stats);

  const canvas = document.createElement("canvas");
  canvas.className = "audio-panel__timeline";
  canvas.width = 960;
  canvas.height = 108;
  panel.appendChild(canvas);

  const runButton = document.createElement("button");
  runButton.className = "audio-panel__run";
  runButton.type = "button";
  runButton.textContent = "Start Synced Run";
  runButton.disabled = true;
  panel.appendChild(runButton);

  const restartButton = document.createElement("button");
  restartButton.className = "audio-panel__run audio-panel__run--secondary";
  restartButton.type = "button";
  restartButton.textContent = "Restart Run";
  restartButton.disabled = true;
  panel.appendChild(restartButton);

  const exportButton = document.createElement("button");
  exportButton.className = "audio-panel__run audio-panel__run--secondary";
  exportButton.type = "button";
  exportButton.textContent = "Export Summary";
  exportButton.disabled = false;
  panel.appendChild(exportButton);

  const seedRow = document.createElement("div");
  seedRow.className = "audio-panel__seed-row";
  const seedLabel = document.createElement("label");
  seedLabel.className = "audio-panel__seed-label";
  seedLabel.textContent = "Run Seed";
  seedLabel.htmlFor = "run-seed";
  const seedInput = document.createElement("input");
  seedInput.className = "audio-panel__seed-input";
  seedInput.id = "run-seed";
  seedInput.type = "number";
  seedInput.value = loadSeedFromStorage();
  seedInput.step = "1";
  seedRow.append(seedLabel, seedInput);
  panel.appendChild(seedRow);

  const audio = document.createElement("audio");
  audio.className = "audio-panel__audio";
  audio.controls = true;
  panel.appendChild(audio);

  container.appendChild(panel);

  let latestAnalysis: AudioAnalysisResult | null = null;
  let requestId = 0;
  let trackUrl: string | null = null;
  let playbackTimeSeconds = 0;
  let lastTimelineDrawPlaybackTime = -1;
  let placeholderText = "Load a track to view timeline.";
  let runStarting = false;

  const resizeObserver = new ResizeObserver(() => {
    if (latestAnalysis) {
      drawTimeline(canvas, latestAnalysis, playbackTimeSeconds);
    } else {
      drawPlaceholder(canvas, placeholderText);
    }
  });
  resizeObserver.observe(canvas);

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }
    void analyzeAndLoadFile(file);
  });

  async function analyzeAndLoadFile(file: File): Promise<void> {
    const currentRequestId = ++requestId;
    playbackTimeSeconds = 0;
    lastTimelineDrawPlaybackTime = -1;
    placeholderText = "Analyzing...";
    status.textContent = `Analyzing ${file.name}...`;
    stats.textContent = "Processing waveform...";
    drawPlaceholder(canvas, placeholderText);

    try {
      const analysis = await handlers.onAnalyze(file);
      if (currentRequestId !== requestId) {
        return;
      }

      latestAnalysis = analysis;
      playbackTimeSeconds = 0;
      lastTimelineDrawPlaybackTime = -1;
      runButton.disabled = false;
      restartButton.disabled = false;
      if (trackUrl) {
        URL.revokeObjectURL(trackUrl);
      }
      trackUrl = URL.createObjectURL(file);
      audio.src = trackUrl;
      audio.load();
      status.textContent = `Analyzed ${analysis.fileName}`;
      stats.textContent = [
        `BPM ${analysis.beat.bpm.toFixed(1)}`,
        `Mood ${analysis.mood.label}`,
        `Cues ${analysis.cues.length}`,
        `Duration ${analysis.durationSeconds.toFixed(1)}s`,
        `Confidence ${(analysis.beat.confidence * 100).toFixed(0)}%`
      ].join(" | ");

      drawTimeline(canvas, analysis, 0);
      lastTimelineDrawPlaybackTime = 0;
      void startRun("start");
    } catch (error) {
      if (currentRequestId !== requestId) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = "Analysis failed";
      stats.textContent = message;
      placeholderText = "Analysis failed. Try another track.";
      drawPlaceholder(canvas, placeholderText);
      runButton.disabled = true;
      restartButton.disabled = true;
    }
  }

  runButton.addEventListener("click", () => {
    void startRun("start");
  });

  restartButton.addEventListener("click", () => {
    void startRun("restart");
  });

  exportButton.addEventListener("click", () => {
    const seed = Number(seedInput.value);
    const normalizedSeed = Number.isFinite(seed) ? seed : 7;
    const summary = handlers.onExportSummary(normalizedSeed);
    if (!summary) {
      status.textContent = "No run summary available yet.";
      return;
    }

    const json = JSON.stringify(summary, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `run-summary-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = "Run summary exported.";
  });

  seedInput.addEventListener("change", () => {
    saveSeedToStorage(seedInput.value);
  });

  window.addEventListener("beforeunload", () => {
    if (trackUrl) {
      URL.revokeObjectURL(trackUrl);
      trackUrl = null;
    }
  });

  window.addEventListener("keydown", (event) => {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (audio.paused) {
        void audio.play().catch(() => {
          status.textContent = "Press play to start audio playback.";
        });
      } else {
        audio.pause();
      }
      return;
    }

    if (event.code === "KeyR") {
      event.preventDefault();
      void startRun("restart");
    }
  });

  drawPlaceholder(canvas, placeholderText);

  return {
    getLatestAnalysis() {
      return latestAnalysis;
    },
    setPlaybackTime(timeSeconds) {
      playbackTimeSeconds = Math.max(0, timeSeconds);
      if (latestAnalysis) {
        playbackTimeSeconds = Math.min(playbackTimeSeconds, latestAnalysis.durationSeconds);
        const shouldRedraw =
          lastTimelineDrawPlaybackTime < 0 ||
          Math.abs(playbackTimeSeconds - lastTimelineDrawPlaybackTime) >= 1 / 30 ||
          playbackTimeSeconds === 0 ||
          playbackTimeSeconds >= latestAnalysis.durationSeconds;
        if (!shouldRedraw) {
          return;
        }
        drawTimeline(canvas, latestAnalysis, playbackTimeSeconds);
        lastTimelineDrawPlaybackTime = playbackTimeSeconds;
      }
    },
    getAudioPlaybackTime() {
      return audio.currentTime;
    },
    isAudioPlaying() {
      return !audio.paused && !audio.ended;
    },
    async loadFile(file) {
      await analyzeAndLoadFile(file);
    }
  };

  async function startRun(mode: "start" | "restart"): Promise<void> {
    if (!latestAnalysis || runStarting) {
      return;
    }

    const seed = Number(seedInput.value);
    runStarting = true;
    runButton.disabled = true;
    restartButton.disabled = true;
    status.textContent =
      mode === "start"
        ? `Preparing synced run for ${latestAnalysis.fileName}...`
        : `Preparing restart for ${latestAnalysis.fileName}...`;

    try {
      await handlers.onStartRun(latestAnalysis, Number.isFinite(seed) ? seed : 7);
      playbackTimeSeconds = 0;
      lastTimelineDrawPlaybackTime = -1;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        status.textContent =
          mode === "start"
            ? "Press play to start audio playback."
            : "Press play to restart audio playback.";
      });
      status.textContent =
        mode === "start"
          ? `Synced run started for ${latestAnalysis.fileName}`
          : `Run restarted for ${latestAnalysis.fileName}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = "Run start failed";
      stats.textContent = message;
    } finally {
      runStarting = false;
      runButton.disabled = latestAnalysis === null;
      restartButton.disabled = latestAnalysis === null;
    }
  }
}

function loadSeedFromStorage(): string {
  try {
    const value = window.localStorage.getItem(RUN_SEED_STORAGE_KEY);
    if (value === null || value.trim() === "") {
      return "7";
    }
    return value;
  } catch {
    return "7";
  }
}

function saveSeedToStorage(value: string): void {
  try {
    window.localStorage.setItem(RUN_SEED_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

function drawTimeline(
  canvas: HTMLCanvasElement,
  analysis: AudioAnalysisResult,
  playbackTimeSeconds = 0
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const { width, height } = prepareCanvasForHiDpi(canvas, context);
  context.clearRect(0, 0, width, height);

  context.fillStyle = "#050d1d";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(95, 132, 196, 0.4)";
  context.lineWidth = 1;
  for (let y = 0; y <= 4; y += 1) {
    const gy = Math.round((y / 4) * (height - 1)) + 0.5;
    context.beginPath();
    context.moveTo(0, gy);
    context.lineTo(width, gy);
    context.stroke();
  }

  const frames = analysis.frames;
  if (frames.length > 1) {
    context.strokeStyle = "#67e8f9";
    context.lineWidth = 1.4;
    context.beginPath();
    for (let i = 0; i < frames.length; i += 1) {
      const x = (frames[i].timeSeconds / analysis.durationSeconds) * width;
      const y = height - frames[i].intensity * (height - 8) - 4;
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();
  }

  context.strokeStyle = "rgba(244, 114, 182, 0.9)";
  context.lineWidth = 1;
  for (const cue of analysis.cues) {
    const x = (cue.timeSeconds / analysis.durationSeconds) * width;
    context.beginPath();
    context.moveTo(x, height);
    context.lineTo(x, 0);
    context.stroke();
  }

  const playheadX = (playbackTimeSeconds / analysis.durationSeconds) * width;
  const clampedPlayheadX = Math.max(0, Math.min(width, playheadX));
  context.strokeStyle = "rgba(251, 191, 36, 0.95)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(clampedPlayheadX, 0);
  context.lineTo(clampedPlayheadX, height);
  context.stroke();
}

function drawPlaceholder(canvas: HTMLCanvasElement, text: string): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const { width, height } = prepareCanvasForHiDpi(canvas, context);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050d1d";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#9eb4d3";
  context.font = "12px Consolas, 'Courier New', monospace";
  context.fillText(text, 12, height / 2);
}

function prepareCanvasForHiDpi(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(1, Math.floor(canvas.clientWidth || canvas.width));
  const cssHeight = Math.max(1, Math.floor(canvas.clientHeight || canvas.height));
  const deviceWidth = Math.max(1, Math.floor(cssWidth * dpr));
  const deviceHeight = Math.max(1, Math.floor(cssHeight * dpr));

  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth;
    canvas.height = deviceHeight;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: cssWidth, height: cssHeight };
}
