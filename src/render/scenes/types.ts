import type { Group } from "three";
import type { SpectrumTimeline } from "../../audio/types";

export type SceneKind = "starfield" | "grid" | "ocean" | "sky";

export type SceneInstance = {
	readonly id: string;
	readonly kind: SceneKind;
	readonly group: Group;
	update(simTimeSeconds: number, shipY: number): void;
	set(key: string, value: unknown): boolean;
	getSettings(): Record<string, unknown>;
	dispose(): void;
};

export type GridSceneExtensions = {
	setSpectrum(bins: Float32Array | null): void;
	setSpectrumTimeline(timeline: SpectrumTimeline | null): void;
	setTime(timeSeconds: number): void;
};

export type GridSceneInstance = SceneInstance & GridSceneExtensions;

export type SceneFactory = (id: string) => SceneInstance;
