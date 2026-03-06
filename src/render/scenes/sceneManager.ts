import type { Scene } from "three";
import type { SpectrumTimeline } from "../../audio/types";
import type { SceneInstance, SceneKind, GridSceneExtensions } from "./types";
import { createStarfieldScene } from "./starfield";
import { createGridScene } from "./grid";
import { createOceanScene } from "./ocean";
import { createSkyScene } from "./sky";
import { createCityScene } from "./city";

export type StagePresetId = "space" | "custom";

export type SceneManager = {
	getActiveScenes(): ReadonlyArray<SceneInstance>;
	hasPerspectiveScenes(): boolean;
	getActivePreset(): StagePresetId;
	activatePreset(presetId: StagePresetId): void;
	addScene(kind: SceneKind): string;
	removeScene(id: string): void;
	getScene(id: string): SceneInstance | undefined;
	setSceneSetting(sceneId: string, key: string, value: unknown): boolean;
	updateAll(simTimeSeconds: number, shipY: number): void;
	setGridSpectrum(bins: Float32Array | null): void;
	setGridSpectrumTimeline(timeline: SpectrumTimeline | null): void;
	setGridTime(timeSeconds: number): void;
	subscribe(listener: () => void): () => void;
};

function createSceneInstance(kind: SceneKind, id: string): SceneInstance {
	switch (kind) {
		case "starfield":
			return createStarfieldScene(id);
		case "grid":
			return createGridScene(id);
		case "ocean":
			return createOceanScene(id);
		case "sky":
			return createSkyScene(id);
		case "city":
			return createCityScene(id);
	}
}

function isGridScene(instance: SceneInstance): instance is SceneInstance & GridSceneExtensions {
	return instance.kind === "grid";
}

function getParentSceneForInstance(
	instance: SceneInstance,
	orthoScene: Scene,
	perspectiveScene: Scene,
): Scene {
	return instance.renderLayer === "perspective" ? perspectiveScene : orthoScene;
}

export function createSceneManager(
	orthoScene: Scene,
	perspectiveScene: Scene,
): SceneManager {
	const instanceMap = new Map<string, SceneInstance>();
	let instanceList: SceneInstance[] = [];
	let activePreset: StagePresetId = "space";
	let idCounter = 0;
	const listeners = new Set<() => void>();

	function notify(): void {
		for (const cb of listeners) cb();
	}

	function addInstanceInternal(kind: SceneKind): SceneInstance {
		const id = `${kind}-${idCounter++}`;
		const instance = createSceneInstance(kind, id);
		instanceMap.set(id, instance);
		instanceList.push(instance);
		getParentSceneForInstance(instance, orthoScene, perspectiveScene).add(
			instance.group,
		);
		return instance;
	}

	function removeInstanceInternal(id: string): void {
		const instance = instanceMap.get(id);
		if (!instance) return;
		getParentSceneForInstance(instance, orthoScene, perspectiveScene).remove(
			instance.group,
		);
		instance.dispose();
		instanceMap.delete(id);
		instanceList = instanceList.filter((s) => s.id !== id);
	}

	function clearAll(): void {
		for (const instance of instanceList) {
			getParentSceneForInstance(instance, orthoScene, perspectiveScene).remove(
				instance.group,
			);
			instance.dispose();
		}
		instanceMap.clear();
		instanceList = [];
	}

	// Initialize with Space preset
	addInstanceInternal("starfield");
	notify();

	return {
		getActiveScenes() {
			return instanceList;
		},
		hasPerspectiveScenes() {
			return instanceList.some((instance) => instance.renderLayer === "perspective");
		},
		getActivePreset() {
			return activePreset;
		},
		activatePreset(presetId) {
			clearAll();
			activePreset = presetId === "custom" ? "custom" : "space";
			if (activePreset === "space") {
				addInstanceInternal("starfield");
			}
			notify();
		},
		addScene(kind) {
			const instance = addInstanceInternal(kind);
			notify();
			return instance.id;
		},
		removeScene(id) {
			if (!instanceMap.has(id)) return;
			removeInstanceInternal(id);
			notify();
		},
		getScene(id) {
			return instanceMap.get(id);
		},
		setSceneSetting(sceneId, key, value) {
			const instance = instanceMap.get(sceneId);
			if (!instance) return false;
			return instance.set(key, value);
		},
		updateAll(simTimeSeconds, shipY) {
			for (const instance of instanceList) {
				instance.update(simTimeSeconds, shipY);
			}
		},
		setGridSpectrum(bins) {
			for (const instance of instanceList) {
				if (isGridScene(instance)) {
					instance.setSpectrum(bins);
				}
			}
		},
		setGridSpectrumTimeline(timeline) {
			for (const instance of instanceList) {
				if (isGridScene(instance)) {
					instance.setSpectrumTimeline(timeline);
				}
			}
		},
		setGridTime(timeSeconds) {
			for (const instance of instanceList) {
				if (isGridScene(instance)) {
					instance.setTime(timeSeconds);
				}
			}
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
	};
}
