import { useControls, folder, button, Leva } from "leva";
import { useRef, useState, useEffect, useCallback, useSyncExternalStore } from "react";
import type { SettingsBridge, StageId, WaveformPlaneSide, WaveformPlaneSurfaceShading } from "./settingsBridge";
import type { EnemyArchetypeId, EnemyProjectileStyle } from "../game/combatConfig";
import type { WaveformPlaneDistortionAlgorithm } from "../render/stages/waveformPlane/distortion";
import type { OceanTimeOfDay } from "../render/stages/ocean";

type RunAffectingState = {
	blueLaser: boolean;
	yellowLaser: boolean;
	greenLaser: boolean;
	purpleMissile: boolean;
	orangeFlak: boolean;
	redCubeEnabled: boolean;
	greenTriangleEnabled: boolean;
	enemyProjectileStyle: EnemyProjectileStyle;
	spawnScale: number;
	fireScale: number;
};

const DEFAULT_RUN_STATE: RunAffectingState = {
	blueLaser: true,
	yellowLaser: true,
	greenLaser: true,
	purpleMissile: false,
	orangeFlak: false,
	redCubeEnabled: true,
	greenTriangleEnabled: false,
	enemyProjectileStyle: "balls",
	spawnScale: 1,
	fireScale: 1,
};

function buildCombatConfig(state: RunAffectingState) {
	const enabledArchetypes: EnemyArchetypeId[] = [];
	if (state.redCubeEnabled) enabledArchetypes.push("redCube");
	if (state.greenTriangleEnabled) enabledArchetypes.push("greenTriangle");
	return {
		shipWeapons: {
			blueLaser: state.blueLaser,
			yellowLaser: state.yellowLaser,
			greenLaser: state.greenLaser,
			purpleMissile: state.purpleMissile,
			orangeFlak: state.orangeFlak,
		},
		enemyRoster: {
			enabledArchetypes,
			spawnScale: state.spawnScale,
			fireScale: state.fireScale,
			enemyProjectileStyle: state.enemyProjectileStyle,
		},
	};
}

function SettingsPanelInner({ bridge }: { bridge: SettingsBridge }) {
	const songLoaded = useSyncExternalStore(
		bridge.subscribeSongLoaded,
		bridge.isSongLoaded,
	);

	const [runDirty, setRunDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const pendingRef = useRef<RunAffectingState>({ ...DEFAULT_RUN_STATE });
	const appliedRef = useRef<RunAffectingState>({ ...DEFAULT_RUN_STATE });

	const handleRunAffecting = useCallback(
		<K extends keyof RunAffectingState>(key: K, value: RunAffectingState[K]) => {
			pendingRef.current = { ...pendingRef.current, [key]: value };
			if (songLoaded) {
				setRunDirty(true);
			} else {
				appliedRef.current = { ...pendingRef.current };
				bridge.handlers.onCombatConfigChange(buildCombatConfig(pendingRef.current));
			}
		},
		[bridge, songLoaded],
	);

	// ── Ship ──
	useControls("Ship", () => ({
		"Blue Laser": {
			value: DEFAULT_RUN_STATE.blueLaser,
			onChange: (v: boolean) => handleRunAffecting("blueLaser", v),
		},
		"Yellow Laser": {
			value: DEFAULT_RUN_STATE.yellowLaser,
			onChange: (v: boolean) => handleRunAffecting("yellowLaser", v),
		},
		"Green Laser": {
			value: DEFAULT_RUN_STATE.greenLaser,
			onChange: (v: boolean) => handleRunAffecting("greenLaser", v),
		},
		"Purple Missile": {
			value: DEFAULT_RUN_STATE.purpleMissile,
			onChange: (v: boolean) => handleRunAffecting("purpleMissile", v),
		},
		"Orange Flak": {
			value: DEFAULT_RUN_STATE.orangeFlak,
			onChange: (v: boolean) => handleRunAffecting("orangeFlak", v),
		},
	}), [handleRunAffecting]);

	// ── Enemies ──
	useControls("Enemies", () => ({
		"Red Cube": {
			value: DEFAULT_RUN_STATE.redCubeEnabled,
			onChange: (v: boolean) => handleRunAffecting("redCubeEnabled", v),
		},
		"Green Triangle": {
			value: DEFAULT_RUN_STATE.greenTriangleEnabled,
			onChange: (v: boolean) => handleRunAffecting("greenTriangleEnabled", v),
		},
		"Projectile Style": {
			value: DEFAULT_RUN_STATE.enemyProjectileStyle,
			options: { Balls: "balls" as const, Lasers: "lasers" as const },
			onChange: (v: EnemyProjectileStyle) => handleRunAffecting("enemyProjectileStyle", v),
		},
		"Spawn Scale": {
			value: DEFAULT_RUN_STATE.spawnScale,
			min: 0.5, max: 2, step: 0.05,
			onChange: (v: number) => handleRunAffecting("spawnScale", v),
		},
		"Fire Scale": {
			value: DEFAULT_RUN_STATE.fireScale,
			min: 0.5, max: 2, step: 0.05,
			onChange: (v: number) => handleRunAffecting("fireScale", v),
		},
	}), [handleRunAffecting]);

	// ── Stage ──
	useControls("Stage", () => ({
		Stage: {
			value: "starfield" as StageId,
			options: {
				Starfield: "starfield" as const,
				"Waveform Plane": "waveformPlane" as const,
				Ocean: "ocean" as const,
			},
			onChange: (v: StageId) => bridge.handlers.onStageChange(v),
		},

		// ── Starfield ──
		"Speed": {
			value: 1, min: 0, max: 3, step: 0.01,
			render: (get: (p: string) => unknown) => get("Stage.Stage") === "starfield",
			onChange: (v: number) => bridge.handlers.onStarfieldSpeedChange(v),
		},
		"Ship Movement Response": {
			value: 1, min: 0, max: 2, step: 0.01,
			render: (get: (p: string) => unknown) => get("Stage.Stage") === "starfield",
			onChange: (v: number) => bridge.handlers.onStarfieldShipMovementResponseChange(v),
		},

		// ── Ocean ──
		"Time of Day": {
			value: "sunset" as OceanTimeOfDay,
			options: {
				Sunrise: "sunrise" as const,
				Day: "day" as const,
				Sunset: "sunset" as const,
				Night: "night" as const,
			},
			render: (get: (p: string) => unknown) => get("Stage.Stage") === "ocean",
			onChange: (v: OceanTimeOfDay) => bridge.handlers.onOceanTimeOfDayChange(v),
		},
		"Ocean Size": {
			value: 0.7, min: 0.1, max: 3, step: 0.01,
			render: (get: (p: string) => unknown) => get("Stage.Stage") === "ocean",
			onChange: (v: number) => bridge.handlers.onOceanSizeChange(v),
		},
		"Distortion Scale": {
			value: 3.1, min: 0, max: 8, step: 0.1,
			render: (get: (p: string) => unknown) => get("Stage.Stage") === "ocean",
			onChange: (v: number) => bridge.handlers.onOceanDistortionScaleChange(v),
		},
		"Amplitude": {
			value: 0.25, min: 0, max: 2, step: 0.01,
			render: (get: (p: string) => unknown) => get("Stage.Stage") === "ocean",
			onChange: (v: number) => bridge.handlers.onOceanAmplitudeChange(v),
		},

		// ── Waveform Plane: Top ──
		"Top Plane": folder(
			{
				Enabled: {
					value: false,
					onChange: (v: boolean) => bridge.handlers.onWaveformPlaneSideEnabledChange("top", v),
				},
				Surface: {
					value: false,
					onChange: (v: boolean) => bridge.handlers.onWaveformPlaneSurfaceEnabledChange("top", v),
				},
				"Surface Shading": {
					value: "smooth" as WaveformPlaneSurfaceShading,
					options: { Smooth: "smooth" as const, Flat: "flat" as const, Matte: "matte" as const, Metallic: "metallic" as const },
					onChange: (v: WaveformPlaneSurfaceShading) => bridge.handlers.onWaveformPlaneSurfaceShadingChange("top", v),
				},
				"Surface Color": {
					value: "#f4f4f4",
					onChange: (v: string) => bridge.handlers.onWaveformPlaneSurfaceColorChange("top", v),
				},
				"Surface Opacity": {
					value: 1, min: 0, max: 1, step: 0.01,
					onChange: (v: number) => bridge.handlers.onWaveformPlaneSurfaceOpacityChange("top", v),
				},
				Wireframe: {
					value: true,
					onChange: (v: boolean) => bridge.handlers.onWaveformPlaneWireframeEnabledChange("top", v),
				},
				"Wireframe Color": {
					value: "#f4f4f4",
					onChange: (v: string) => bridge.handlers.onWaveformPlaneWireframeColorChange("top", v),
				},
				"Max Height": {
					value: 6.8, min: 2.5, max: 12, step: 0.1,
					onChange: (v: number) => bridge.handlers.onWaveformPlaneHeightScaleChange("top", v),
				},
				Distortion: {
					value: "ridge" as WaveformPlaneDistortionAlgorithm,
					options: { "Ridge Flow": "ridge" as const, "Pulse Ripple": "ripple" as const },
					onChange: (v: WaveformPlaneDistortionAlgorithm) => bridge.handlers.onWaveformPlaneDistortionAlgorithmChange("top", v),
				},
				"Spectrum Smoothing": {
					value: 0.5, min: 0, max: 0.95, step: 0.01,
					onChange: (v: number) => bridge.handlers.onWaveformPlaneSpectrumSmoothingChange("top", v),
				},
			},
			{
				collapsed: true,
				render: (get: (p: string) => unknown) => get("Stage.Stage") === "waveformPlane",
			},
		),

		// ── Waveform Plane: Bottom ──
		"Bottom Plane": folder(
			{
				Enabled: {
					value: true,
					onChange: (v: boolean) => bridge.handlers.onWaveformPlaneSideEnabledChange("bottom", v),
				},
				Surface: {
					value: false,
					onChange: (v: boolean) => bridge.handlers.onWaveformPlaneSurfaceEnabledChange("bottom", v),
				},
				"Surface Shading": {
					value: "smooth" as WaveformPlaneSurfaceShading,
					options: { Smooth: "smooth" as const, Flat: "flat" as const, Matte: "matte" as const, Metallic: "metallic" as const },
					onChange: (v: WaveformPlaneSurfaceShading) => bridge.handlers.onWaveformPlaneSurfaceShadingChange("bottom", v),
				},
				"Surface Color": {
					value: "#f4f4f4",
					onChange: (v: string) => bridge.handlers.onWaveformPlaneSurfaceColorChange("bottom", v),
				},
				"Surface Opacity": {
					value: 1, min: 0, max: 1, step: 0.01,
					onChange: (v: number) => bridge.handlers.onWaveformPlaneSurfaceOpacityChange("bottom", v),
				},
				Wireframe: {
					value: true,
					onChange: (v: boolean) => bridge.handlers.onWaveformPlaneWireframeEnabledChange("bottom", v),
				},
				"Wireframe Color": {
					value: "#f4f4f4",
					onChange: (v: string) => bridge.handlers.onWaveformPlaneWireframeColorChange("bottom", v),
				},
				"Max Height": {
					value: 6.8, min: 2.5, max: 12, step: 0.1,
					onChange: (v: number) => bridge.handlers.onWaveformPlaneHeightScaleChange("bottom", v),
				},
				Distortion: {
					value: "ridge" as WaveformPlaneDistortionAlgorithm,
					options: { "Ridge Flow": "ridge" as const, "Pulse Ripple": "ripple" as const },
					onChange: (v: WaveformPlaneDistortionAlgorithm) => bridge.handlers.onWaveformPlaneDistortionAlgorithmChange("bottom", v),
				},
				"Spectrum Smoothing": {
					value: 0.5, min: 0, max: 0.95, step: 0.01,
					onChange: (v: number) => bridge.handlers.onWaveformPlaneSpectrumSmoothingChange("bottom", v),
				},
			},
			{
				collapsed: true,
				render: (get: (p: string) => unknown) => get("Stage.Stage") === "waveformPlane",
			},
		),
	}), [bridge]);

	// ── Apply & Recompute button ──
	useControls({
		"Apply & Recompute": button(
			async () => {
				setSaving(true);
				try {
					bridge.handlers.onCombatConfigChange(buildCombatConfig(pendingRef.current));
					appliedRef.current = { ...pendingRef.current };
					await bridge.requestRecompute();
				} finally {
					setSaving(false);
					setRunDirty(false);
				}
			},
			{ disabled: !runDirty || saving },
		),
	}, [runDirty, saving, bridge]);

	return null;
}

const LEVA_THEME = {
	colors: {
		elevation1: "rgba(10, 20, 40, 0.94)",
		elevation2: "rgba(16, 31, 57, 0.96)",
		elevation3: "rgba(22, 42, 72, 0.90)",
		accent1: "#5b8fff",
		accent2: "#3d6fcc",
		accent3: "#2a4f99",
		highlight1: "#d8eaff",
		highlight2: "#a0bcec",
		highlight3: "#7090c0",
	},
	fontSizes: { root: "11px" },
};

export function SettingsPanel({ bridge }: { bridge: SettingsBridge }) {
	const [hidden, setHidden] = useState(bridge.getHidden());

	useEffect(() => {
		return bridge.subscribeHidden(setHidden);
	}, [bridge]);

	return (
		<>
			<Leva
				theme={LEVA_THEME}
				collapsed={false}
				hidden={hidden}
				titleBar={{ title: "Settings" }}
			/>
			<SettingsPanelInner bridge={bridge} />
		</>
	);
}
