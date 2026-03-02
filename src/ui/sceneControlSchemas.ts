import type { SceneKind } from "./settingsBridge";

export type SceneControlDef = {
	label: string;
	levaConfig: Record<string, unknown>;
};

export type SceneControlSchema = Record<string, SceneControlDef>;

const STARFIELD_SCHEMA: SceneControlSchema = {
	speedScale: {
		label: "Speed",
		levaConfig: { value: 1, min: 0, max: 3, step: 0.01 },
	},
	shipMovementResponse: {
		label: "Ship Movement Response",
		levaConfig: { value: 1, min: 0, max: 2, step: 0.01 },
	},
};

const GRID_SCHEMA: SceneControlSchema = {
	"top.sideEnabled": {
		label: "Top Enabled",
		levaConfig: { value: false },
	},
	"top.surfaceEnabled": {
		label: "Top Surface",
		levaConfig: { value: false },
	},
	"top.surfaceShading": {
		label: "Top Surface Shading",
		levaConfig: {
			value: "smooth",
			options: { Smooth: "smooth", Flat: "flat", Matte: "matte", Metallic: "metallic" },
		},
	},
	"top.surfaceColor": {
		label: "Top Surface Color",
		levaConfig: { value: "#f4f4f4" },
	},
	"top.surfaceOpacity": {
		label: "Top Surface Opacity",
		levaConfig: { value: 1, min: 0, max: 1, step: 0.01 },
	},
	"top.wireframeEnabled": {
		label: "Top Wireframe",
		levaConfig: { value: true },
	},
	"top.wireframeColor": {
		label: "Top Wireframe Color",
		levaConfig: { value: "#f4f4f4" },
	},
	"top.heightScale": {
		label: "Top Max Height",
		levaConfig: { value: 6.8, min: 2.5, max: 12, step: 0.1 },
	},
	"top.distortionAlgorithm": {
		label: "Top Distortion",
		levaConfig: {
			value: "ridge",
			options: { "Ridge Flow": "ridge", "Pulse Ripple": "ripple" },
		},
	},
	"top.spectrumSmoothing": {
		label: "Top Spectrum Smoothing",
		levaConfig: { value: 0.5, min: 0, max: 0.95, step: 0.01 },
	},
	"bottom.sideEnabled": {
		label: "Bottom Enabled",
		levaConfig: { value: true },
	},
	"bottom.surfaceEnabled": {
		label: "Bottom Surface",
		levaConfig: { value: false },
	},
	"bottom.surfaceShading": {
		label: "Bottom Surface Shading",
		levaConfig: {
			value: "smooth",
			options: { Smooth: "smooth", Flat: "flat", Matte: "matte", Metallic: "metallic" },
		},
	},
	"bottom.surfaceColor": {
		label: "Bottom Surface Color",
		levaConfig: { value: "#f4f4f4" },
	},
	"bottom.surfaceOpacity": {
		label: "Bottom Surface Opacity",
		levaConfig: { value: 1, min: 0, max: 1, step: 0.01 },
	},
	"bottom.wireframeEnabled": {
		label: "Bottom Wireframe",
		levaConfig: { value: true },
	},
	"bottom.wireframeColor": {
		label: "Bottom Wireframe Color",
		levaConfig: { value: "#f4f4f4" },
	},
	"bottom.heightScale": {
		label: "Bottom Max Height",
		levaConfig: { value: 6.8, min: 2.5, max: 12, step: 0.1 },
	},
	"bottom.distortionAlgorithm": {
		label: "Bottom Distortion",
		levaConfig: {
			value: "ridge",
			options: { "Ridge Flow": "ridge", "Pulse Ripple": "ripple" },
		},
	},
	"bottom.spectrumSmoothing": {
		label: "Bottom Spectrum Smoothing",
		levaConfig: { value: 0.5, min: 0, max: 0.95, step: 0.01 },
	},
};

const OCEAN_SCHEMA: SceneControlSchema = {
	timeOfDay: {
		label: "Time of Day",
		levaConfig: {
			value: "day",
			options: { Sunrise: "sunrise", Day: "day", Sunset: "sunset", Night: "night" },
		},
	},
	size: {
		label: "Ocean Size",
		levaConfig: { value: 0.7, min: 0.1, max: 3, step: 0.01 },
	},
	distortionScale: {
		label: "Distortion Scale",
		levaConfig: { value: 3.1, min: 0, max: 8, step: 0.1 },
	},
	amplitude: {
		label: "Amplitude",
		levaConfig: { value: 0.25, min: 0, max: 2, step: 0.01 },
	},
	speed: {
		label: "Speed",
		levaConfig: { value: 4, min: 0, max: 10, step: 0.1 },
	},
};

const SKY_SCHEMA: SceneControlSchema = {
	turbidity: {
		label: "Turbidity",
		levaConfig: { value: 10, min: 0, max: 20, step: 0.1 },
	},
	rayleigh: {
		label: "Rayleigh",
		levaConfig: { value: 3, min: 0, max: 4, step: 0.001 },
	},
	mieCoefficient: {
		label: "Mie Coefficient",
		levaConfig: { value: 0.005, min: 0, max: 0.1, step: 0.001 },
	},
	mieDirectionalG: {
		label: "Mie Directional G",
		levaConfig: { value: 0.7, min: 0, max: 1, step: 0.001 },
	},
	elevation: {
		label: "Elevation",
		levaConfig: { value: 2, min: 0, max: 90, step: 0.1 },
	},
	azimuth: {
		label: "Azimuth",
		levaConfig: { value: 180, min: -180, max: 180, step: 0.1 },
	},
	exposure: {
		label: "Exposure",
		levaConfig: { value: 0.5, min: 0, max: 1, step: 0.0001 },
	},
	horizon: {
		label: "Horizon",
		levaConfig: { value: 0.35, min: 0, max: 1, step: 0.01 },
	},
	cloudCoverage: {
		label: "Cloud Coverage",
		levaConfig: { value: 0.4, min: 0, max: 1, step: 0.01 },
	},
	cloudDensity: {
		label: "Cloud Density",
		levaConfig: { value: 0.4, min: 0, max: 1, step: 0.01 },
	},
	cloudElevation: {
		label: "Cloud Elevation",
		levaConfig: { value: 0.5, min: 0, max: 1, step: 0.01 },
	},
};

const SCHEMAS: Record<SceneKind, SceneControlSchema> = {
	starfield: STARFIELD_SCHEMA,
	grid: GRID_SCHEMA,
	ocean: OCEAN_SCHEMA,
	sky: SKY_SCHEMA,
};

export function getSceneControlSchema(kind: SceneKind): SceneControlSchema {
	return SCHEMAS[kind];
}

export const SCENE_KIND_LABELS: Record<SceneKind, string> = {
	starfield: "Starfield",
	grid: "Grid",
	ocean: "Ocean",
	sky: "Sky",
};
