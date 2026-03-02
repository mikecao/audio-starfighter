import { useControls, folder, button, Leva } from "leva";
import { useRef, useState, useEffect, useCallback, useSyncExternalStore } from "react";
import type { SettingsBridge, SceneListEntry, StagePresetId } from "./settingsBridge";
import type { SceneKind } from "../render/scenes/types";
import type { EnemyArchetypeId, EnemyProjectileStyle } from "../game/combatConfig";
import { getSceneControlSchema, SCENE_KIND_LABELS } from "./sceneControlSchemas";

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

const ALL_SCENE_KINDS: SceneKind[] = ["starfield", "grid", "ocean", "sky"];

function SceneInstanceControls({
	scene,
	bridge,
	allowRemove,
}: {
	scene: SceneListEntry;
	bridge: SettingsBridge;
	allowRemove: boolean;
}) {
	const schema = getSceneControlSchema(scene.kind);
	const label = SCENE_KIND_LABELS[scene.kind];
	const folderName = `${label} (${scene.id})`;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const controls: Record<string, any> = {};

	for (const [settingKey, def] of Object.entries(schema)) {
		controls[def.label] = {
			...def.levaConfig,
			onChange: (v: unknown) => {
				bridge.handlers.onSceneSettingChange(scene.id, settingKey, v);
			},
		};
	}

	if (allowRemove) {
		controls["Remove"] = button(() => {
			bridge.handlers.onRemoveScene(scene.id);
		});
	}

	useControls({ [folderName]: folder(controls, { collapsed: true }) }, [
		scene.id,
		bridge,
	]);

	return null;
}

function SettingsPanelInner({ bridge }: { bridge: SettingsBridge }) {
	const songLoaded = useSyncExternalStore(
		bridge.subscribeSongLoaded,
		bridge.isSongLoaded,
	);

	const scenes = useSyncExternalStore(
		bridge.subscribeSceneList,
		bridge.getActiveScenes,
	);

	const preset = useSyncExternalStore(
		bridge.subscribeSceneList,
		bridge.getActivePreset,
	);

	const [runDirty, setRunDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const pendingRef = useRef<RunAffectingState>({ ...DEFAULT_RUN_STATE });
	const appliedRef = useRef<RunAffectingState>({ ...DEFAULT_RUN_STATE });

	const handleRunAffecting = useCallback(
		<K extends keyof RunAffectingState>(key: K, value: RunAffectingState[K]) => {
			if (pendingRef.current[key] === value) return;
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

	// ── Stage Preset + Add Scene ──
	const [addKind, setAddKind] = useState<SceneKind>("starfield");

	useControls("Stage", () => {
		const kindOptions: Record<string, SceneKind> = {};
		for (const k of ALL_SCENE_KINDS) {
			kindOptions[SCENE_KIND_LABELS[k]] = k;
		}
		return {
			Stage: {
				value: "space" as StagePresetId,
				options: {
					Space: "space" as const,
					"\u003CCustom\u003E": "custom" as const,
				},
				onChange: (v: StagePresetId) => bridge.handlers.onPresetChange(v),
			},
			"Add Scene": folder({
				"Scene Type": {
					value: addKind,
					options: kindOptions,
					onChange: (v: SceneKind) => setAddKind(v),
				},
				"Add": button(() => {
					bridge.handlers.onAddScene(addKind);
				}),
			}, {
				collapsed: false,
				render: (get: (p: string) => unknown) => get("Stage.Stage") === "custom",
			}),
		};
	}, [bridge, preset, addKind]);

	// ── Apply & Recompute / Close button ──
	useControls(songLoaded ? {
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
	} : {
		"Close": button(() => {
			bridge.setHidden(true);
		}),
	}, [songLoaded, runDirty, saving, bridge]);

	// ── Per-instance scene controls ──
	const isCustom = preset === "custom";

	return (
		<>
			{scenes.map((scene) => (
				<SceneInstanceControls
					key={scene.id}
					scene={scene}
					bridge={bridge}
					allowRemove={isCustom}
				/>
			))}
		</>
	);
}

const LEVA_THEME = {
	colors: {
		elevation1: "rgba(10, 20, 40, 0.94)",
		elevation2: "rgba(16, 31, 57, 0.96)",
		elevation3: "rgba(22, 42, 72, 0.90)",
		accent1: "#2c4480",
		accent2: "#3d6fcc",
		accent3: "#2a4f99",
		highlight1: "#d8eaff",
		highlight2: "#a0bcec",
		highlight3: "#e0eaff",
	},
	fontSizes: { root: "11px" },
	sizes: { rootWidth: "340px" },
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
