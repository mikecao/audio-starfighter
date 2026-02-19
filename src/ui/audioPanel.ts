import type { AudioAnalysisResult } from "../audio/types";
import type {
  CombatConfigPatch,
  EnemyArchetypeId,
  EnemyProjectileStyle
} from "../game/combatConfig";

const RUN_SEED_STORAGE_KEY = "audio-starfighter.run-seed";

type AudioPanelHandlers = {
  onAnalyze: (file: File) => Promise<AudioAnalysisResult>;
  onStartRun: (analysis: AudioAnalysisResult, seed: number) => void | Promise<void>;
  onCombatConfigChange: (config: CombatConfigPatch) => void;
  onWaveformPlaneChange: (enabled: boolean) => void;
  onWaveformPlaneSurfaceEnabledChange: (enabled: boolean) => void;
  onWaveformPlaneWireframeEnabledChange: (enabled: boolean) => void;
  onWaveformPlaneHeightScaleChange: (heightScale: number) => void;
  onWaveformPlaneSurfaceColorChange: (colorHex: string) => void;
  onWaveformPlaneWireframeColorChange: (colorHex: string) => void;
  onToggleUi: () => boolean;
};

export type AudioPanel = {
  getLatestAnalysis: () => AudioAnalysisResult | null;
  setPlaybackTime: (timeSeconds: number) => void;
  getAudioPlaybackTime: () => number;
  isAudioPlaying: () => boolean;
  getAudioSpectrumBins: () => Float32Array | null;
  loadFile: (file: File) => Promise<void>;
};

type UiCombatState = {
  blueLaser: boolean;
  yellowLaser: boolean;
  greenLaser: boolean;
  purpleMissile: boolean;
  redCubeEnabled: boolean;
  greenTriangleEnabled: boolean;
  spawnScale: number;
  fireScale: number;
  enemyProjectileStyle: EnemyProjectileStyle;
  waveformPlaneEnabled: boolean;
  waveformPlaneSurfaceEnabled: boolean;
  waveformPlaneWireframeEnabled: boolean;
  waveformPlaneHeightScale: number;
  waveformPlaneSurfaceColor: string;
  waveformPlaneWireframeColor: string;
};

const DEFAULT_WAVEFORM_PLANE_HEIGHT_SCALE = 6.8;
const DEFAULT_WAVEFORM_PLANE_SURFACE_COLOR = "#f4f4f4";
const DEFAULT_WAVEFORM_PLANE_WIREFRAME_COLOR = "#f4f4f4";

const DEFAULT_COMBAT_STATE: UiCombatState = {
  blueLaser: true,
  yellowLaser: true,
  greenLaser: true,
  purpleMissile: false,
  redCubeEnabled: true,
  greenTriangleEnabled: false,
  spawnScale: 1,
  fireScale: 1,
  enemyProjectileStyle: "balls",
  waveformPlaneEnabled: true,
  waveformPlaneSurfaceEnabled: false,
  waveformPlaneWireframeEnabled: true,
  waveformPlaneHeightScale: DEFAULT_WAVEFORM_PLANE_HEIGHT_SCALE,
  waveformPlaneSurfaceColor: DEFAULT_WAVEFORM_PLANE_SURFACE_COLOR,
  waveformPlaneWireframeColor: DEFAULT_WAVEFORM_PLANE_WIREFRAME_COLOR
};

const SPECTRUM_ANALYZER_FFT_SIZE = 1024;
const SPECTRUM_ANALYZER_MIN_DB = -100;
const SPECTRUM_ANALYZER_MAX_DB = -12;
const SPECTRUM_REACTIVE_MIN_HZ = 0;
const SPECTRUM_REACTIVE_MAX_HZ = 6000;
const SPECTRUM_DYNAMIC_MIN_RANGE = 0.06;
const SPECTRUM_DYNAMIC_MIN_ATTACK = 0.22;
const SPECTRUM_DYNAMIC_MIN_RELEASE = 0.014;
const SPECTRUM_DYNAMIC_MAX_ATTACK = 0.28;
const SPECTRUM_DYNAMIC_MAX_RELEASE = 0.02;
const SPECTRUM_PANEL_BAR_COUNT = 72;
const SPECTRUM_PANEL_SAMPLE_INTERVAL_MS = 1000 / 120;
const DB_TO_MAG_EXP = 0.1151292546497023;
const SPECTRUM_ANALYZER_MIN_MAGNITUDE = Math.exp(DB_TO_MAG_EXP * SPECTRUM_ANALYZER_MIN_DB);
const SPECTRUM_ANALYZER_MAX_MAGNITUDE = Math.exp(DB_TO_MAG_EXP * SPECTRUM_ANALYZER_MAX_DB);

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
  const enemyGreenTriangleToggle = createModalToggle("Green Triangle", false);
  const enemyProjectileLaserToggle = createModalToggle("Projectile Lasers", false);
  const enemySpawnScale = createModalRange("Spawn Scale", 0.5, 2, 0.05, 1);
  const enemyFireScale = createModalRange("Fire Scale", 0.5, 2, 0.05, 1);
  enemyGroup.append(
    enemyRedCubeToggle.root,
    enemyGreenTriangleToggle.root,
    enemyProjectileLaserToggle.root,
    enemySpawnScale.root,
    enemyFireScale.root
  );

  const visualsGroup = document.createElement("fieldset");
  visualsGroup.className = "audio-settings-modal__group";
  const visualsLegend = document.createElement("legend");
  visualsLegend.className = "audio-settings-modal__legend";
  visualsLegend.textContent = "Visuals";
  visualsGroup.appendChild(visualsLegend);

  const waveformPlaneToggle = createModalToggle("Waveform Plane", true);
  const waveformPlaneSurfaceToggle = createModalToggle("Plane Surface", false);
  const waveformPlaneWireframeToggle = createModalToggle("Plane Wireframe", true);
  const waveformPlaneHeightScale = createModalRange(
    "Plane Max Height",
    2.5,
    12,
    0.1,
    DEFAULT_WAVEFORM_PLANE_HEIGHT_SCALE
  );
  const waveformPlaneSurfaceColor = createModalColor(
    "Surface Color",
    DEFAULT_WAVEFORM_PLANE_SURFACE_COLOR
  );
  const waveformPlaneWireframeColor = createModalColor(
    "Wireframe Color",
    DEFAULT_WAVEFORM_PLANE_WIREFRAME_COLOR
  );
  visualsGroup.append(
    waveformPlaneToggle.root,
    waveformPlaneSurfaceToggle.root,
    waveformPlaneWireframeToggle.root,
    waveformPlaneHeightScale.root,
    waveformPlaneSurfaceColor.root,
    waveformPlaneWireframeColor.root
  );

  settingsForm.append(shipGroup, enemyGroup, visualsGroup);

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

  const spectrumPanel = document.createElement("section");
  spectrumPanel.className = "spectrum-panel";

  const spectrumCanvas = document.createElement("canvas");
  spectrumCanvas.className = "spectrum-panel__canvas";
  spectrumCanvas.width = 960;
  spectrumCanvas.height = 84;
  spectrumPanel.appendChild(spectrumCanvas);
  container.appendChild(spectrumPanel);

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
  let audioContext: AudioContext | null = null;
  let audioSourceNode: MediaElementAudioSourceNode | null = null;
  let audioAnalyserNode: AnalyserNode | null = null;
  let analyserDbData: Float32Array<ArrayBuffer> | null = null;
  let lastSpectrumSampleTimeMs = -Infinity;
  let spectrumDynamicMin = 0;
  let spectrumDynamicMax = 1;
  let spectrumOutputBins = new Float32Array(0);
  let spectrumSmoothedBins = new Float32Array(0);

  const ensureSpectrumBufferSize = (size: number): void => {
    const targetSize = Math.max(0, Math.floor(size));
    if (spectrumOutputBins.length === targetSize && spectrumSmoothedBins.length === targetSize) {
      return;
    }
    spectrumOutputBins = new Float32Array(targetSize);
    spectrumSmoothedBins = new Float32Array(targetSize);
  };

  const resetSpectrumNormalization = (): void => {
    spectrumDynamicMin = 0;
    spectrumDynamicMax = 1;
    spectrumOutputBins.fill(0);
    spectrumSmoothedBins.fill(0);
  };

  const ensureAudioAnalyser = (): void => {
    if (audioContext && audioSourceNode && audioAnalyserNode && analyserDbData) {
      return;
    }
    audioContext = new AudioContext();
    audioSourceNode = audioContext.createMediaElementSource(audio);
    audioAnalyserNode = audioContext.createAnalyser();
    audioAnalyserNode.fftSize = SPECTRUM_ANALYZER_FFT_SIZE;
    audioAnalyserNode.smoothingTimeConstant = 0.5;
    audioAnalyserNode.minDecibels = SPECTRUM_ANALYZER_MIN_DB;
    audioAnalyserNode.maxDecibels = SPECTRUM_ANALYZER_MAX_DB;
    analyserDbData = new Float32Array(audioAnalyserNode.frequencyBinCount);
    const reactiveWindow = getReactiveBinWindow(audioAnalyserNode.frequencyBinCount, audioContext.sampleRate);
    ensureSpectrumBufferSize(reactiveWindow.count);
    audioSourceNode.connect(audioAnalyserNode);
    audioAnalyserNode.connect(audioContext.destination);
  };

  const resumeAudioAnalyser = (): void => {
    ensureAudioAnalyser();
    if (audioContext && audioContext.state === "suspended") {
      void audioContext.resume();
    }
  };

  const updateLiveSpectrumBins = (): Float32Array | null => {
    if (!audioAnalyserNode || !analyserDbData || !audioContext) {
      return null;
    }
    if (audioContext.state === "suspended") {
      return null;
    }
    const nowMs = performance.now();
    if (nowMs - lastSpectrumSampleTimeMs < SPECTRUM_PANEL_SAMPLE_INTERVAL_MS) {
      return spectrumOutputBins;
    }
    lastSpectrumSampleTimeMs = nowMs;
    audioAnalyserNode.getFloatFrequencyData(analyserDbData);
    const reactiveWindow = getReactiveBinWindow(analyserDbData.length, audioContext.sampleRate);
    ensureSpectrumBufferSize(reactiveWindow.count);
    for (let i = 0; i < reactiveWindow.count; i += 1) {
      const dbValue = analyserDbData[reactiveWindow.from + i] ?? SPECTRUM_ANALYZER_MIN_DB;
      const safeDb = Number.isFinite(dbValue) ? dbValue : SPECTRUM_ANALYZER_MIN_DB;
      const clampedDb = clamp(safeDb, SPECTRUM_ANALYZER_MIN_DB, SPECTRUM_ANALYZER_MAX_DB);
      const magnitude = db2mag(clampedDb);
      const normalizedMagnitude =
        (magnitude - SPECTRUM_ANALYZER_MIN_MAGNITUDE) /
        Math.max(1e-8, SPECTRUM_ANALYZER_MAX_MAGNITUDE - SPECTRUM_ANALYZER_MIN_MAGNITUDE);
      spectrumOutputBins[i] = clamp(normalizedMagnitude, 0, 1);
    }
    let frameMin = 1;
    let frameMax = 0;
    for (let i = 0; i < spectrumOutputBins.length; i += 1) {
      const value = clamp(spectrumOutputBins[i] ?? 0, 0, 1);
      if (value < frameMin) {
        frameMin = value;
      }
      if (value > frameMax) {
        frameMax = value;
      }
    }
    const minBlend =
      frameMin < spectrumDynamicMin ? SPECTRUM_DYNAMIC_MIN_ATTACK : SPECTRUM_DYNAMIC_MIN_RELEASE;
    const maxBlend =
      frameMax > spectrumDynamicMax ? SPECTRUM_DYNAMIC_MAX_ATTACK : SPECTRUM_DYNAMIC_MAX_RELEASE;
    spectrumDynamicMin += (frameMin - spectrumDynamicMin) * minBlend;
    spectrumDynamicMax += (frameMax - spectrumDynamicMax) * maxBlend;
    spectrumDynamicMin = clamp(spectrumDynamicMin, 0, 1);
    spectrumDynamicMax = clamp(spectrumDynamicMax, spectrumDynamicMin + SPECTRUM_DYNAMIC_MIN_RANGE, 1);
    const dynamicRange = Math.max(SPECTRUM_DYNAMIC_MIN_RANGE, spectrumDynamicMax - spectrumDynamicMin);
    for (let i = 0; i < spectrumOutputBins.length; i += 1) {
      const normalized = (spectrumOutputBins[i] - spectrumDynamicMin) / dynamicRange;
      spectrumOutputBins[i] = clamp(normalized, 0, 1);
    }
    for (let i = 0; i < spectrumOutputBins.length; i += 1) {
      const incoming = spectrumOutputBins[i];
      const previous = spectrumSmoothedBins[i] ?? 0;
      const blend = incoming > previous ? 0.56 : 0.2;
      spectrumSmoothedBins[i] = previous + (incoming - previous) * blend;
      spectrumOutputBins[i] = spectrumSmoothedBins[i];
    }
    return spectrumOutputBins;
  };

  audio.addEventListener("play", () => {
    resumeAudioAnalyser();
  });

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
    drawSpectrumBars(spectrumCanvas, updateLiveSpectrumBins());
  });
  resizeObserver.observe(canvas);
  resizeObserver.observe(spectrumCanvas);

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
    lastSpectrumSampleTimeMs = -Infinity;
    resetSpectrumNormalization();
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
    enemyGreenTriangleToggle.input.checked = state.greenTriangleEnabled;
    enemyProjectileLaserToggle.input.checked = state.enemyProjectileStyle === "lasers";
    waveformPlaneToggle.input.checked = state.waveformPlaneEnabled;
    waveformPlaneSurfaceToggle.input.checked = state.waveformPlaneSurfaceEnabled;
    waveformPlaneWireframeToggle.input.checked = state.waveformPlaneWireframeEnabled;
    enemySpawnScale.input.value = state.spawnScale.toFixed(2);
    enemyFireScale.input.value = state.fireScale.toFixed(2);
    enemySpawnScale.value.textContent = `${state.spawnScale.toFixed(2)}x`;
    enemyFireScale.value.textContent = `${state.fireScale.toFixed(2)}x`;
    waveformPlaneHeightScale.input.value = state.waveformPlaneHeightScale.toFixed(1);
    waveformPlaneHeightScale.value.textContent = state.waveformPlaneHeightScale.toFixed(1);
    waveformPlaneSurfaceColor.input.value = normalizeHexColor(
      state.waveformPlaneSurfaceColor,
      DEFAULT_WAVEFORM_PLANE_SURFACE_COLOR
    );
    waveformPlaneSurfaceColor.value.textContent = normalizeHexColor(
      state.waveformPlaneSurfaceColor,
      DEFAULT_WAVEFORM_PLANE_SURFACE_COLOR
    ).toUpperCase();
    waveformPlaneWireframeColor.input.value = normalizeHexColor(
      state.waveformPlaneWireframeColor,
      DEFAULT_WAVEFORM_PLANE_WIREFRAME_COLOR
    );
    waveformPlaneWireframeColor.value.textContent = normalizeHexColor(
      state.waveformPlaneWireframeColor,
      DEFAULT_WAVEFORM_PLANE_WIREFRAME_COLOR
    ).toUpperCase();
  };

  const readCombatStateFromForm = (): UiCombatState => ({
    blueLaser: shipPrimaryToggle.input.checked,
    yellowLaser: shipCueToggle.input.checked,
    greenLaser: shipCleanupToggle.input.checked,
    purpleMissile: shipPurpleToggle.input.checked,
    redCubeEnabled: enemyRedCubeToggle.input.checked,
    greenTriangleEnabled: enemyGreenTriangleToggle.input.checked,
    spawnScale: Number(enemySpawnScale.input.value),
    fireScale: Number(enemyFireScale.input.value),
    enemyProjectileStyle: enemyProjectileLaserToggle.input.checked ? "lasers" : "balls",
    waveformPlaneEnabled: waveformPlaneToggle.input.checked,
    waveformPlaneSurfaceEnabled: waveformPlaneSurfaceToggle.input.checked,
    waveformPlaneWireframeEnabled: waveformPlaneWireframeToggle.input.checked,
    waveformPlaneHeightScale: clamp(
      Number.isFinite(Number(waveformPlaneHeightScale.input.value))
        ? Number(waveformPlaneHeightScale.input.value)
        : DEFAULT_WAVEFORM_PLANE_HEIGHT_SCALE,
      2.5,
      12
    ),
    waveformPlaneSurfaceColor: normalizeHexColor(
      waveformPlaneSurfaceColor.input.value,
      DEFAULT_WAVEFORM_PLANE_SURFACE_COLOR
    ),
    waveformPlaneWireframeColor: normalizeHexColor(
      waveformPlaneWireframeColor.input.value,
      DEFAULT_WAVEFORM_PLANE_WIREFRAME_COLOR
    )
  });

  const publishCombatState = (state: UiCombatState): void => {
    const enabledArchetypes: EnemyArchetypeId[] = [];
    if (state.redCubeEnabled) {
      enabledArchetypes.push("redCube");
    }
    if (state.greenTriangleEnabled) {
      enabledArchetypes.push("greenTriangle");
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
        fireScale: state.fireScale,
        enemyProjectileStyle: state.enemyProjectileStyle
      }
    });
    handlers.onWaveformPlaneChange(state.waveformPlaneEnabled);
    handlers.onWaveformPlaneSurfaceEnabledChange(state.waveformPlaneSurfaceEnabled);
    handlers.onWaveformPlaneWireframeEnabledChange(state.waveformPlaneWireframeEnabled);
    handlers.onWaveformPlaneHeightScaleChange(state.waveformPlaneHeightScale);
    handlers.onWaveformPlaneSurfaceColorChange(state.waveformPlaneSurfaceColor);
    handlers.onWaveformPlaneWireframeColorChange(state.waveformPlaneWireframeColor);
  };

  const hasRunAffectingChanges = (previous: UiCombatState, next: UiCombatState): boolean => {
    if (previous.blueLaser !== next.blueLaser) {
      return true;
    }
    if (previous.yellowLaser !== next.yellowLaser) {
      return true;
    }
    if (previous.greenLaser !== next.greenLaser) {
      return true;
    }
    if (previous.purpleMissile !== next.purpleMissile) {
      return true;
    }
    if (previous.redCubeEnabled !== next.redCubeEnabled) {
      return true;
    }
    if (previous.greenTriangleEnabled !== next.greenTriangleEnabled) {
      return true;
    }
    if (previous.enemyProjectileStyle !== next.enemyProjectileStyle) {
      return true;
    }
    if (Math.abs(previous.spawnScale - next.spawnScale) > 1e-4) {
      return true;
    }
    if (Math.abs(previous.fireScale - next.fireScale) > 1e-4) {
      return true;
    }
    return false;
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
  waveformPlaneHeightScale.input.addEventListener("input", () => {
    waveformPlaneHeightScale.value.textContent = Number(
      waveformPlaneHeightScale.input.value
    ).toFixed(1);
  });
  waveformPlaneSurfaceColor.input.addEventListener("input", () => {
    waveformPlaneSurfaceColor.value.textContent = normalizeHexColor(
      waveformPlaneSurfaceColor.input.value,
      DEFAULT_WAVEFORM_PLANE_SURFACE_COLOR
    ).toUpperCase();
  });
  waveformPlaneWireframeColor.input.addEventListener("input", () => {
    waveformPlaneWireframeColor.value.textContent = normalizeHexColor(
      waveformPlaneWireframeColor.input.value,
      DEFAULT_WAVEFORM_PLANE_WIREFRAME_COLOR
    ).toUpperCase();
  });

  settingsSaveButton.addEventListener("click", async () => {
    const nextState = readCombatStateFromForm();
    const previousState = combatState;
    combatState = nextState;
    publishCombatState(combatState);
    closeSettingsModal();

    const shouldRecomputeRun = hasRunAffectingChanges(previousState, nextState);
    if (!latestAnalysis || !shouldRecomputeRun) {
      if (latestAnalysis) {
        setAnalysisSummary(latestAnalysis);
      }
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
    if (audioContext) {
      void audioContext.close();
      audioContext = null;
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
  drawSpectrumBars(spectrumCanvas, null);

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
    getAudioSpectrumBins() {
      const bins = updateLiveSpectrumBins();
      drawSpectrumBars(spectrumCanvas, bins);
      return bins;
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
      resumeAudioAnalyser();
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

type ModalColorControl = {
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

function createModalColor(label: string, value: string): ModalColorControl {
  const wrapper = document.createElement("label");
  wrapper.className = "audio-settings-modal__range audio-settings-modal__color";

  const name = document.createElement("span");
  name.className = "audio-settings-modal__range-name";
  name.textContent = label;

  const input = document.createElement("input");
  input.className = "audio-settings-modal__color-input";
  input.type = "color";
  input.value = normalizeHexColor(value, DEFAULT_WAVEFORM_PLANE_SURFACE_COLOR);

  const valueEl = document.createElement("span");
  valueEl.className = "audio-settings-modal__range-value";
  valueEl.textContent = input.value.toUpperCase();

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

function normalizeHexColor(value: string, fallback: string): string {
  const candidate = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(candidate)) {
    return candidate;
  }
  return fallback;
}

function db2mag(val: number): number {
  return Math.exp(DB_TO_MAG_EXP * val);
}

function getReactiveBinWindow(
  totalBins: number,
  sampleRateHz: number
): { from: number; count: number } {
  if (totalBins <= 0) {
    return { from: 0, count: 0 };
  }
  const nyquistHz = Math.max(1, sampleRateHz * 0.5);
  const maxBinIndex = Math.max(0, totalBins - 1);
  const minReactiveHz = clamp(SPECTRUM_REACTIVE_MIN_HZ, 0, nyquistHz);
  const maxReactiveHz = clamp(SPECTRUM_REACTIVE_MAX_HZ, minReactiveHz + 1, nyquistHz);
  const from = clamp(
    Math.floor((minReactiveHz / nyquistHz) * maxBinIndex),
    0,
    maxBinIndex
  );
  const toInclusive = clamp(
    Math.ceil((maxReactiveHz / nyquistHz) * maxBinIndex),
    from,
    maxBinIndex
  );
  return {
    from,
    count: Math.max(1, toInclusive - from + 1)
  };
}

function drawSpectrumBars(canvas: HTMLCanvasElement, bins: Float32Array | null): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const { width, height } = prepareCanvasForHiDpi(canvas, context);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050d1d";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(95, 132, 196, 0.32)";
  context.lineWidth = 1;
  for (let y = 1; y <= 3; y += 1) {
    const gy = Math.round((y / 4) * height) + 0.5;
    context.beginPath();
    context.moveTo(0, gy);
    context.lineTo(width, gy);
    context.stroke();
  }

  const maxRenderableBars = Math.max(18, Math.floor(width / 3));
  const desiredBarCount = bins && bins.length > 0 ? bins.length : SPECTRUM_PANEL_BAR_COUNT;
  const barCount = Math.min(desiredBarCount, maxRenderableBars);
  const gap = 1.5;
  const usableWidth = Math.max(1, width - gap * (barCount + 1));
  const barWidth = Math.max(1, usableWidth / barCount);
  const baseline = height - 2;
  const maxBarHeight = Math.max(10, height - 6);

  for (let i = 0; i < barCount; i += 1) {
    const rawValue = bins ? sampleSpectrumBinNearest(bins, i, barCount) : 0;
    const shaped = Math.pow(clamp(rawValue, 0, 1), 0.76);
    const level = 0.04 + shaped * 0.96;
    const barHeight = Math.max(1, level * maxBarHeight);
    const x = gap + i * (barWidth + gap);
    const y = baseline - barHeight;

    const hue = i / Math.max(1, barCount - 1);
    const red = Math.round(64 + hue * 70);
    const green = Math.round(212 - hue * 44);
    const blue = Math.round(255 - hue * 28);
    const alpha = 0.28 + level * 0.66;
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
    context.fillRect(x, y, barWidth, barHeight);

    context.fillStyle = `rgba(230, 244, 255, ${(0.06 + level * 0.26).toFixed(3)})`;
    context.fillRect(x, y, barWidth, 1);
  }
}

function sampleSpectrumBinNearest(bins: Float32Array, index: number, barCount: number): number {
  if (bins.length === 0 || barCount <= 0) {
    return 0;
  }
  const binPosition =
    barCount <= 1 ? 0 : (index / Math.max(1, barCount - 1)) * Math.max(0, bins.length - 1);
  const binIndex = clamp(Math.round(binPosition), 0, Math.max(0, bins.length - 1));
  return clamp(bins[binIndex] ?? 0, 0, 1);
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
