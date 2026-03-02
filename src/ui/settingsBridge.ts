import type { CombatConfigPatch } from "../game/combatConfig";
import type { SceneKind } from "../render/scenes/types";
import type { StagePresetId } from "../render/scenes/sceneManager";

export type { SceneKind, StagePresetId };

export type SceneListEntry = { id: string; kind: SceneKind };

export type SettingsHandlers = {
	onCombatConfigChange: (config: CombatConfigPatch) => void;
	onPresetChange: (preset: StagePresetId) => void;
	onAddScene: (kind: SceneKind) => string;
	onRemoveScene: (sceneId: string) => void;
	onSceneSettingChange: (sceneId: string, key: string, value: unknown) => void;
};

export type SettingsBridge = {
	handlers: SettingsHandlers;
	isSongLoaded: () => boolean;
	requestRecompute: () => Promise<void>;
	getActiveScenes: () => ReadonlyArray<SceneListEntry>;
	getActivePreset: () => StagePresetId;
	subscribeSceneList: (cb: () => void) => () => void;
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
	getActiveScenes: () => ReadonlyArray<SceneListEntry>,
	getActivePreset: () => StagePresetId,
	subscribeSceneList: (cb: () => void) => () => void,
): SettingsBridge {
	const songListeners = new Set<() => void>();
	const hiddenListeners = new Set<(hidden: boolean) => void>();
	let hidden = false;

	return {
		handlers,
		isSongLoaded,
		requestRecompute,
		getActiveScenes,
		getActivePreset,
		subscribeSceneList,
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
