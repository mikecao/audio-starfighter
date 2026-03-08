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
	sideEnabled: {
		label: "Enabled",
		levaConfig: { value: true },
	},
	surfaceEnabled: {
		label: "Surface",
		levaConfig: { value: false },
	},
	surfaceShading: {
		label: "Surface Shading",
		levaConfig: {
			value: "smooth",
			options: { Smooth: "smooth", Flat: "flat", Matte: "matte", Metallic: "metallic" },
		},
	},
	surfaceColor: {
		label: "Surface Color",
		levaConfig: { value: "#f4f4f4" },
	},
	surfaceOpacity: {
		label: "Surface Opacity",
		levaConfig: { value: 1, min: 0, max: 1, step: 0.01 },
	},
	wireframeEnabled: {
		label: "Wireframe",
		levaConfig: { value: true },
	},
	wireframeColor: {
		label: "Wireframe Color",
		levaConfig: { value: "#f4f4f4" },
	},
	heightScale: {
		label: "Max Height",
		levaConfig: { value: 6.8, min: 2.5, max: 12, step: 0.1 },
	},
	distortionAlgorithm: {
		label: "Distortion",
		levaConfig: {
			value: "ridge",
			options: { "Ridge Flow": "ridge", "Pulse Ripple": "ripple" },
		},
	},
	spectrumSmoothing: {
		label: "Spectrum Smoothing",
		levaConfig: { value: 0.5, min: 0, max: 0.95, step: 0.01 },
	},
	positionY: {
		label: "Position Y",
		levaConfig: { value: -15.8, min: -30, max: 30, step: 0.1 },
	},
	rotationX: {
		label: "Rotation X",
		levaConfig: { value: -1.21, min: -3.15, max: 3.15, step: 0.01 },
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

const CITY_SCHEMA: SceneControlSchema = {
	speedScale: {
		label: "Speed",
		levaConfig: { value: 1, min: 0, max: 3, step: 0.01 },
	},
	shipMovementResponse: {
		label: "Ship Movement Response",
		levaConfig: { value: 0.12, min: 0, max: 1, step: 0.01 },
	},
};

const CUBES_SCHEMA: SceneControlSchema = {
	surfaceColor: {
		label: "Surface Color",
		levaConfig: { value: "#7dd3fc" },
	},
	outlineColor: {
		label: "Outline Color",
		levaConfig: { value: "#e0f2fe" },
	},
	motionMode: {
		label: "Motion",
		levaConfig: {
			value: "static",
			options: { Static: "static", Flow: "flow" },
		},
	},
	reactivityStrength: {
		label: "Reactivity",
		levaConfig: { value: 1, min: 0, max: 3, step: 0.01 },
	},
	columns: {
		label: "Columns",
		levaConfig: { value: 24, min: 6, max: 64, step: 1 },
	},
	rows: {
		label: "Rows",
		levaConfig: { value: 14, min: 4, max: 36, step: 1 },
	},
};

const SCHEMAS: Record<SceneKind, SceneControlSchema> = {
	starfield: STARFIELD_SCHEMA,
	grid: GRID_SCHEMA,
	ocean: OCEAN_SCHEMA,
	sky: SKY_SCHEMA,
	city: CITY_SCHEMA,
	cubes: CUBES_SCHEMA,
};

export function getSceneControlSchema(kind: SceneKind): SceneControlSchema {
	return SCHEMAS[kind];
}

export const SCENE_KIND_LABELS: Record<SceneKind, string> = {
	starfield: "Starfield",
	grid: "Grid",
	ocean: "Ocean",
	sky: "Sky",
	city: "City",
	cubes: "Cubes",
};
