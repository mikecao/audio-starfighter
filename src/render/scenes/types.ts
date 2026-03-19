import type { Group, PerspectiveCamera } from "three";
import type { SpectrumTimeline } from "../../audio/types";

export type SceneKind = "starfield" | "grid" | "ocean" | "sky" | "city" | "cubes" | "mountains";
export type SceneRenderLayer = "ortho" | "perspective";

export type SceneInstance = {
	readonly id: string;
	readonly kind: SceneKind;
	readonly group: Group;
	readonly renderLayer?: SceneRenderLayer;
	readonly perspectiveCamera?: PerspectiveCamera;
	update(simTimeSeconds: number, shipY: number): void;
	set(key: string, value: unknown): boolean;
	getSettings(): Record<string, unknown>;
	dispose(): void;
};

export type SpectrumReactiveSceneExtensions = {
	setSpectrum(bins: Float32Array | null): void;
};

export type GridSceneExtensions = SpectrumReactiveSceneExtensions & {
	setSpectrumTimeline(timeline: SpectrumTimeline | null): void;
	setTime(timeSeconds: number): void;
};

export type GridSceneInstance = SceneInstance & GridSceneExtensions;

export type SceneFactory = (id: string) => SceneInstance;
