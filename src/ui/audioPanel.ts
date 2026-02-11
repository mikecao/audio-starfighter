import type { AudioAnalysisResult } from "../audio/types";
import type { CombatConfigPatch, EnemyArchetypeId } from "../game/combatConfig";

const RUN_SEED_STORAGE_KEY = "audio-starfighter.run-seed";

type AudioPanelHandlers = {
  onAnalyze: (file: File) => Promise<AudioAnalysisResult>;
  onStartRun: (analysis: AudioAnalysisResult, seed: number) => void | Promise<void>;
  onCombatConfigChange: (config: CombatConfigPatch) => void;
  onToggleUi: () => boolean;
};

export type AudioPanel = {
  getLatestAnalysis: () => AudioAnalysisResult | null;
  setPlaybackTime: (timeSeconds: number) => void;
  getAudioPlaybackTime: () => number;
  isAudioPlaying: () => boolean;
  loadFile: (file: File) => Promise<void>;
};

type UiCombatState = {
  blueLaser: boolean;
  yellowLaser: boolean;
  greenLaser: boolean;
  purpleMissile: boolean;
  redCubeEnabled: boolean;
  spawnScale: number;
  fireScale: number;
};

const DEFAULT_COMBAT_STATE: UiCombatState = {
  blueLaser: true,
  yellowLaser: true,
  greenLaser: true,
  purpleMissile: false,
  redCubeEnabled: true,
  spawnScale: 1,
  fireScale: 1
};

export function createAudioPanel(
  container: HTMLElement,
  handlers: AudioPanelHandlers
): AudioPanel {
  const controlsBar = document.createElement("section");
  controlsBar.className = "audio-controls-bar";

  const controlsMain = document.createElement("div");
  controlsMain.className = "audio-controls-bar__main";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "audio/*";
  fileInput.className = "audio-controls__file-input";

  const chooseFileButton = document.createElement("button");
  chooseFileButton.type = "button";
  chooseFileButton.className = "audio-controls__pick";
  chooseFileButton.textContent = "Open File";
  chooseFileButton.title = "Select an audio file";

  controlsMain.append(chooseFileButton, fileInput);

  const summary = document.createElement("p");
  summary.className = "audio-controls__summary";
  summary.textContent = "Load a track";
  controlsMain.appendChild(summary);

  const controlsActions = document.createElement("div");
  controlsActions.className = "audio-controls__actions";

  const seedRow = document.createElement("div");
  seedRow.className = "audio-controls__seed-row";
  const seedLabel = document.createElement("label");
  seedLabel.className = "audio-controls__seed-label";
  seedLabel.textContent = "Seed";
  seedLabel.htmlFor = "run-seed";
  const seedInput = document.createElement("input");
  seedInput.className = "audio-controls__seed-input";
  seedInput.id = "run-seed";
  seedInput.type = "number";
  seedInput.value = loadSeedFromStorage();
  seedInput.step = "1";
  seedRow.append(seedLabel, seedInput);
  controlsActions.appendChild(seedRow);

  const runButton = document.createElement("button");
  runButton.className = "audio-controls__button";
  runButton.type = "button";
  runButton.textContent = "Start Synced Run";
  runButton.disabled = true;
  controlsActions.appendChild(runButton);

  const restartButton = document.createElement("button");
  restartButton.className = "audio-controls__button audio-controls__button--secondary";
  restartButton.type = "button";
  restartButton.textContent = "Restart Run";
  restartButton.disabled = true;
  controlsActions.appendChild(restartButton);

  controlsMain.appendChild(controlsActions);

  const controlsRight = document.createElement("div");
  controlsRight.className = "audio-controls-bar__right";

  const settingsButton = document.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "audio-controls__button audio-controls__button--secondary audio-controls-settings";
  settingsButton.textContent = "Settings";
  settingsButton.title = "Configure ship and enemy settings";
  controlsRight.appendChild(settingsButton);

  const toggleUiButton = document.createElement("button");
  toggleUiButton.type = "button";
  toggleUiButton.className = "audio-controls-toggle";
  toggleUiButton.textContent = "Hide UI";
  toggleUiButton.title = "Toggle interface visibility";
  controlsRight.appendChild(toggleUiButton);

  controlsBar.append(controlsMain, controlsRight);
  container.appendChild(controlsBar);

  const settingsBackdrop = document.createElement("div");
  settingsBackdrop.className = "audio-settings-modal-backdrop audio-settings-modal-backdrop--hidden";
  const settingsModal = document.createElement("section");
  settingsModal.className = "audio-settings-modal";

  const settingsHeader = document.createElement("div");
  settingsHeader.className = "audio-settings-modal__header";
  const settingsTitle = document.createElement("h3");
  settingsTitle.className = "audio-settings-modal__title";
  settingsTitle.textContent = "Combat Settings";
  settingsHeader.appendChild(settingsTitle);

  const settingsForm = document.createElement("div");
  settingsForm.className = "audio-settings-modal__form";

  const shipGroup = document.createElement("fieldset");
  shipGroup.className = "audio-settings-modal__group";
  const shipLegend = document.createElement("legend");
  shipLegend.className = "audio-settings-modal__legend";
  shipLegend.textContent = "Ship";
  shipGroup.appendChild(shipLegend);

  const shipPrimaryToggle = createModalToggle("Blue Laser", true);
  const shipCueToggle = createModalToggle("Yellow Laser", true);
  const shipCleanupToggle = createModalToggle("Green Laser", true);
  const shipPurpleToggle = createModalToggle("Purple Missile", false);
  shipGroup.append(
    shipPrimaryToggle.root,
    shipCueToggle.root,
    shipCleanupToggle.root,
    shipPurpleToggle.root
  );

  const enemyGroup = document.createElement("fieldset");
  enemyGroup.className = "audio-settings-modal__group";
  const enemyLegend = document.createElement("legend");
  enemyLegend.className = "audio-settings-modal__legend";
  enemyLegend.textContent = "Enemies";
  enemyGroup.appendChild(enemyLegend);

  const enemyRedCubeToggle = createModalToggle("Red Cube", true);
  const enemySpawnScale = createModalRange("Spawn Scale", 0.5, 2, 0.05, 1);
  const enemyFireScale = createModalRange("Fire Scale", 0.5, 2, 0.05, 1);
  enemyGroup.append(enemyRedCubeToggle.root, enemySpawnScale.root, enemyFireScale.root);

  settingsForm.append(shipGroup, enemyGroup);

  const settingsFooter = document.createElement("div");
  settingsFooter.className = "audio-settings-modal__footer";
  const settingsCancelButton = document.createElement("button");
  settingsCancelButton.type = "button";
  settingsCancelButton.className = "audio-controls__button audio-controls__button--secondary";
  settingsCancelButton.textContent = "Cancel";
  const settingsResetButton = document.createElement("button");
  settingsResetButton.type = "button";
  settingsResetButton.className = "audio-controls__button audio-controls__button--secondary";
  settingsResetButton.textContent = "Reset";
  const settingsSaveButton = document.createElement("button");
  settingsSaveButton.type = "button";
  settingsSaveButton.className = "audio-controls__button";
  settingsSaveButton.textContent = "Save";
  settingsFooter.append(settingsResetButton, settingsCancelButton, settingsSaveButton);

  settingsModal.append(settingsHeader, settingsForm, settingsFooter);
  settingsBackdrop.appendChild(settingsModal);
  container.appendChild(settingsBackdrop);

  const waveformPanel = document.createElement("section");
  waveformPanel.className = "waveform-panel";

  const canvas = document.createElement("canvas");
  canvas.className = "waveform-panel__canvas";
  canvas.width = 960;
  canvas.height = 108;
  waveformPanel.appendChild(canvas);
  container.appendChild(waveformPanel);

  const playbackPanel = document.createElement("section");
  playbackPanel.className = "playback-panel";

  const audio = document.createElement("audio");
  audio.className = "playback-panel__audio";
  audio.controls = true;
  playbackPanel.appendChild(audio);
  container.appendChild(playbackPanel);

  let latestAnalysis: AudioAnalysisResult | null = null;
  let requestId = 0;
  let trackUrl: string | null = null;
  let playbackTimeSeconds = 0;
  let lastTimelineDrawPlaybackTime = -1;
  let placeholderText = "Load a track to view timeline.";
  let runStarting = false;
  let combatState: UiCombatState = { ...DEFAULT_COMBAT_STATE };

  const setAnalysisSummary = (analysis: AudioAnalysisResult): void => {
    summary.textContent = [
      `BPM ${analysis.beat.bpm.toFixed(1)}`,
      `Frames ${analysis.frames.length}`,
      `Mood ${analysis.mood.label}`,
      `Duration ${analysis.durationSeconds.toFixed(1)}s`
    ].join(" | ");
  };

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

  chooseFileButton.addEventListener("click", () => {
    fileInput.click();
  });

  async function analyzeAndLoadFile(file: File): Promise<void> {
    const currentRequestId = ++requestId;
    playbackTimeSeconds = 0;
    lastTimelineDrawPlaybackTime = -1;
    placeholderText = "Analyzing...";
    summary.textContent = `Analyzing ${file.name}...`;
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
      setAnalysisSummary(analysis);

      drawTimeline(canvas, analysis, 0);
      lastTimelineDrawPlaybackTime = 0;
      void startRun("start");
    } catch (error) {
      if (currentRequestId !== requestId) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      summary.textContent = `Analysis failed: ${message}`;
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

  toggleUiButton.addEventListener("click", () => {
    const hidden = handlers.onToggleUi();
    toggleUiButton.textContent = hidden ? "Show UI" : "Hide UI";
  });

  seedInput.addEventListener("change", () => {
    saveSeedToStorage(seedInput.value);
  });

  const isSettingsModalOpen = (): boolean =>
    !settingsBackdrop.classList.contains("audio-settings-modal-backdrop--hidden");

  const closeSettingsModal = (): void => {
    settingsBackdrop.classList.add("audio-settings-modal-backdrop--hidden");
  };

  const applyCombatStateToForm = (state: UiCombatState): void => {
    shipPrimaryToggle.input.checked = state.blueLaser;
    shipCueToggle.input.checked = state.yellowLaser;
    shipCleanupToggle.input.checked = state.greenLaser;
    shipPurpleToggle.input.checked = state.purpleMissile;
    enemyRedCubeToggle.input.checked = state.redCubeEnabled;
    enemySpawnScale.input.value = state.spawnScale.toFixed(2);
    enemyFireScale.input.value = state.fireScale.toFixed(2);
    enemySpawnScale.value.textContent = `${state.spawnScale.toFixed(2)}x`;
    enemyFireScale.value.textContent = `${state.fireScale.toFixed(2)}x`;
  };

  const readCombatStateFromForm = (): UiCombatState => ({
    blueLaser: shipPrimaryToggle.input.checked,
    yellowLaser: shipCueToggle.input.checked,
    greenLaser: shipCleanupToggle.input.checked,
    purpleMissile: shipPurpleToggle.input.checked,
    redCubeEnabled: enemyRedCubeToggle.input.checked,
    spawnScale: Number(enemySpawnScale.input.value),
    fireScale: Number(enemyFireScale.input.value)
  });

  const publishCombatState = (state: UiCombatState): void => {
    const enabledArchetypes: EnemyArchetypeId[] = [];
    if (state.redCubeEnabled) {
      enabledArchetypes.push("redCube");
    }
    handlers.onCombatConfigChange({
      shipWeapons: {
        blueLaser: state.blueLaser,
        yellowLaser: state.yellowLaser,
        greenLaser: state.greenLaser,
        purpleMissile: state.purpleMissile
      },
      enemyRoster: {
        enabledArchetypes,
        spawnScale: state.spawnScale,
        fireScale: state.fireScale
      }
    });
  };

  settingsButton.addEventListener("click", () => {
    applyCombatStateToForm(combatState);
    settingsBackdrop.classList.remove("audio-settings-modal-backdrop--hidden");
  });

  settingsCancelButton.addEventListener("click", () => {
    closeSettingsModal();
  });

  settingsResetButton.addEventListener("click", () => {
    applyCombatStateToForm(DEFAULT_COMBAT_STATE);
  });

  settingsBackdrop.addEventListener("pointerdown", (event) => {
    if (event.target === settingsBackdrop) {
      closeSettingsModal();
    }
  });

  enemySpawnScale.input.addEventListener("input", () => {
    enemySpawnScale.value.textContent = `${Number(enemySpawnScale.input.value).toFixed(2)}x`;
  });
  enemyFireScale.input.addEventListener("input", () => {
    enemyFireScale.value.textContent = `${Number(enemyFireScale.input.value).toFixed(2)}x`;
  });

  settingsSaveButton.addEventListener("click", async () => {
    combatState = readCombatStateFromForm();
    publishCombatState(combatState);
    closeSettingsModal();

    if (!latestAnalysis) {
      return;
    }

    const seed = Number(seedInput.value);
    const normalizedSeed = Number.isFinite(seed) ? seed : 7;
    summary.textContent = "Applying settings and recomputing...";
    runButton.disabled = true;
    restartButton.disabled = true;

    try {
      await handlers.onStartRun(latestAnalysis, normalizedSeed);
      setAnalysisSummary(latestAnalysis);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.textContent = `Settings apply failed: ${message}`;
    } finally {
      runButton.disabled = latestAnalysis === null;
      restartButton.disabled = latestAnalysis === null;
    }
  });

  applyCombatStateToForm(combatState);
  publishCombatState(combatState);

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
          summary.textContent = "Press play to start audio playback.";
        });
      } else {
        audio.pause();
      }
      return;
    }

    if (event.code === "KeyR") {
      event.preventDefault();
      void startRun("restart");
      return;
    }

    if (event.code === "Escape" && isSettingsModalOpen()) {
      event.preventDefault();
      closeSettingsModal();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!latestAnalysis) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const localX = clamp(event.clientX - rect.left, 0, rect.width);
    const targetSeconds = (localX / rect.width) * latestAnalysis.durationSeconds;
    audio.currentTime = targetSeconds;
    playbackTimeSeconds = targetSeconds;
    lastTimelineDrawPlaybackTime = -1;
    drawTimeline(canvas, latestAnalysis, playbackTimeSeconds);
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
    summary.textContent =
      mode === "start"
        ? `Preparing synced run for ${latestAnalysis.fileName}...`
        : `Preparing restart for ${latestAnalysis.fileName}...`;

    try {
      await handlers.onStartRun(latestAnalysis, Number.isFinite(seed) ? seed : 7);
      playbackTimeSeconds = 0;
      lastTimelineDrawPlaybackTime = -1;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        summary.textContent =
          mode === "start"
            ? "Press play to start audio playback."
            : "Press play to restart audio playback.";
      });
      summary.textContent =
        mode === "start"
          ? `Synced run started for ${latestAnalysis.fileName}`
          : `Run restarted for ${latestAnalysis.fileName}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.textContent = `Run start failed: ${message}`;
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

type ModalToggleControl = {
  root: HTMLLabelElement;
  input: HTMLInputElement;
};

type ModalRangeControl = {
  root: HTMLLabelElement;
  input: HTMLInputElement;
  value: HTMLSpanElement;
};

function createModalToggle(label: string, checked: boolean): ModalToggleControl {
  const wrapper = document.createElement("label");
  wrapper.className = "audio-settings-modal__check";

  const input = document.createElement("input");
  input.className = "audio-settings-modal__check-input";
  input.type = "checkbox";
  input.checked = checked;

  const text = document.createElement("span");
  text.className = "audio-settings-modal__check-text";
  text.textContent = label;

  wrapper.append(input, text);
  return {
    root: wrapper,
    input
  };
}

function createModalRange(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number
): ModalRangeControl {
  const wrapper = document.createElement("label");
  wrapper.className = "audio-settings-modal__range";

  const name = document.createElement("span");
  name.className = "audio-settings-modal__range-name";
  name.textContent = label;

  const input = document.createElement("input");
  input.className = "audio-settings-modal__range-input";
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);

  const valueEl = document.createElement("span");
  valueEl.className = "audio-settings-modal__range-value";
  valueEl.textContent = `${value.toFixed(2)}x`;

  wrapper.append(name, input, valueEl);
  return {
    root: wrapper,
    input,
    value: valueEl
  };
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

  const midY = Math.round(height * 0.5) + 0.5;
  context.strokeStyle = "rgba(95, 132, 196, 0.4)";
  context.lineWidth = 1;
  for (let y = 0; y <= 6; y += 1) {
    const gy = Math.round((y / 6) * (height - 1)) + 0.5;
    context.beginPath();
    context.moveTo(0, gy);
    context.lineTo(width, gy);
    context.stroke();
  }
  context.strokeStyle = "rgba(146, 178, 230, 0.45)";
  context.beginPath();
  context.moveTo(0, midY);
  context.lineTo(width, midY);
  context.stroke();

  const topBaseY = midY - 2;
  const bottomBaseY = midY + 2;
  const topMaxHeight = Math.max(8, topBaseY - 6);
  const bottomMaxHeight = Math.max(8, height - 6 - bottomBaseY);

  drawWaveformEnvelope(
    context,
    analysis.waveformLeft,
    width,
    topBaseY,
    topMaxHeight,
    "up",
    "rgba(103, 232, 249, 0.88)",
    "rgba(103, 232, 249, 0.22)"
  );

  drawWaveformEnvelope(
    context,
    analysis.waveformRight,
    width,
    bottomBaseY,
    bottomMaxHeight,
    "down",
    "rgba(244, 114, 182, 0.9)",
    "rgba(244, 114, 182, 0.24)"
  );

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

function drawWaveformEnvelope(
  context: CanvasRenderingContext2D,
  envelope: Float32Array,
  width: number,
  baseY: number,
  maxHeight: number,
  direction: "up" | "down",
  stroke: string,
  fill: string
): void {
  if (envelope.length === 0 || width <= 1) {
    return;
  }

  context.fillStyle = fill;
  context.beginPath();
  context.moveTo(0, baseY);
  for (let x = 0; x < width; x += 1) {
    const amplitude = sampleWaveform(envelope, x, width);
    const y =
      direction === "up" ? baseY - amplitude * maxHeight : baseY + amplitude * maxHeight;
    context.lineTo(x, y);
  }
  context.lineTo(width, baseY);
  context.closePath();
  context.fill();

  context.strokeStyle = stroke;
  context.lineWidth = 1.2;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const amplitude = sampleWaveform(envelope, x, width);
    const y =
      direction === "up" ? baseY - amplitude * maxHeight : baseY + amplitude * maxHeight;
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
}

function sampleWaveform(envelope: Float32Array, x: number, width: number): number {
  if (envelope.length === 0) {
    return 0;
  }
  const normalized = width <= 1 ? 0 : x / (width - 1);
  const index = Math.min(envelope.length - 1, Math.floor(normalized * (envelope.length - 1)));
  return envelope[index] ?? 0;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
