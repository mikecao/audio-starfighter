import type { CombatConfigPatch } from "../game/combatConfig";
import type { WaveformPlaneDistortionAlgorithm } from "../render/stages/waveformPlane/distortion";
import type { OceanTimeOfDay } from "../render/stages/ocean";

export type WaveformPlaneSide = "bottom" | "top";
export type WaveformPlaneSurfaceShading = "smooth" | "flat" | "matte" | "metallic";
export type StageId = "starfield" | "waveformPlane" | "ocean" | "sky";

export type SettingsHandlers = {
	onCombatConfigChange: (config: CombatConfigPatch) => void;
	onStageChange: (stage: StageId) => void;
	onStarfieldSpeedChange: (speedScale: number) => void;
	onStarfieldShipMovementResponseChange: (responseScale: number) => void;
	onWaveformPlaneSideEnabledChange: (side: WaveformPlaneSide, enabled: boolean) => void;
	onWaveformPlaneSurfaceEnabledChange: (side: WaveformPlaneSide, enabled: boolean) => void;
	onWaveformPlaneWireframeEnabledChange: (side: WaveformPlaneSide, enabled: boolean) => void;
	onWaveformPlaneHeightScaleChange: (side: WaveformPlaneSide, heightScale: number) => void;
	onWaveformPlaneSurfaceShadingChange: (side: WaveformPlaneSide, shading: WaveformPlaneSurfaceShading) => void;
	onWaveformPlaneDistortionAlgorithmChange: (side: WaveformPlaneSide, algorithm: WaveformPlaneDistortionAlgorithm) => void;
	onWaveformPlaneSurfaceColorChange: (side: WaveformPlaneSide, colorHex: string) => void;
	onWaveformPlaneWireframeColorChange: (side: WaveformPlaneSide, colorHex: string) => void;
	onWaveformPlaneSurfaceOpacityChange: (side: WaveformPlaneSide, opacity: number) => void;
	onWaveformPlaneSpectrumSmoothingChange: (side: WaveformPlaneSide, smoothingTimeConstant: number) => void;
	onOceanSizeChange: (size: number) => void;
	onOceanDistortionScaleChange: (scale: number) => void;
	onOceanAmplitudeChange: (amplitude: number) => void;
	onOceanSpeedChange: (speed: number) => void;
	onOceanTimeOfDayChange: (tod: OceanTimeOfDay) => void;
	onSkyTurbidityChange: (v: number) => void;
	onSkyRayleighChange: (v: number) => void;
	onSkyMieCoefficientChange: (v: number) => void;
	onSkyMieDirectionalGChange: (v: number) => void;
	onSkyElevationChange: (v: number) => void;
	onSkyAzimuthChange: (v: number) => void;
	onSkyExposureChange: (v: number) => void;
};

export type SettingsBridge = {
	handlers: SettingsHandlers;
	isSongLoaded: () => boolean;
	requestRecompute: () => Promise<void>;
	subscribeSongLoaded: (cb: () => void) => () => void;
	notifySongLoadedChanged: () => void;
	setHidden: (hidden: boolean) => void;
	getHidden: () => boolean;
	subscribeHidden: (cb: (hidden: boolean) => void) => () => void;
};

export function createSettingsBridge(
	handlers: SettingsHandlers,
	isSongLoaded: () => boolean,
	requestRecompute: () => Promise<void>,
): SettingsBridge {
	const songListeners = new Set<() => void>();
	const hiddenListeners = new Set<(hidden: boolean) => void>();
	let hidden = false;

	return {
		handlers,
		isSongLoaded,
		requestRecompute,
		subscribeSongLoaded(cb) {
			songListeners.add(cb);
			return () => { songListeners.delete(cb); };
		},
		notifySongLoadedChanged() {
			for (const cb of songListeners) cb();
		},
		setHidden(h) {
			hidden = h;
			for (const cb of hiddenListeners) cb(h);
		},
		getHidden() {
			return hidden;
		},
		subscribeHidden(cb) {
			hiddenListeners.add(cb);
			return () => { hiddenListeners.delete(cb); };
		},
	};
}
