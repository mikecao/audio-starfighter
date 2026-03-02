import {
	Color,
	DataTexture,
	FrontSide,
	Group,
	LinearFilter,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	RGBAFormat,
} from "three";
import type { SpectrumTimeline } from "../../audio/types";
import type { SceneInstance, GridSceneExtensions } from "./types";
import {
	WAVEFORM_PLANE_DISTORTION_DEFAULT,
	buildWaveformPlaneDisplacementHeader,
	normalizeWaveformPlaneDistortionAlgorithm,
	populateWaveformPlaneSpectrumForDistortion,
	type WaveformPlaneDistortionAlgorithm,
} from "../stages/waveformPlane/distortion";
import { sampleWaveformLinear } from "../stages/waveformTexture";

// ── Constants ──

const GRID_SPECTRUM_BIN_COUNT = 192;
const GRID_WIDTH = 120;
const GRID_HEIGHT = 90;
const GRID_SEGMENTS_X = 56;
const GRID_SEGMENTS_Y = 42;
const GRID_Z = -28;
const GRID_DEFAULT_POSITION_Y = -15.8;
const GRID_DEFAULT_ROTATION_X = -1.21;
const GRID_POSITION_Y_MIN = -30;
const GRID_POSITION_Y_MAX = 30;
const GRID_ROTATION_X_MIN = -3.15;
const GRID_ROTATION_X_MAX = 3.15;
const GRID_HEIGHT_SCALE_DEFAULT = 6.8;
const GRID_HEIGHT_SCALE_MIN = 2.5;
const GRID_HEIGHT_SCALE_MAX = 12;
const GRID_SPECTRUM_SMOOTHING_DEFAULT = 0.5;
const GRID_SPECTRUM_SMOOTHING_MIN = 0;
const GRID_SPECTRUM_SMOOTHING_MAX = 0.95;
const GRID_SURFACE_SHADING_DEFAULT: GridSurfaceShading = "smooth";
const GRID_SURFACE_ENABLED_DEFAULT = false;
const GRID_WIREFRAME_ENABLED_DEFAULT = true;
const GRID_DEFAULT_SURFACE_COLOR_HEX = "#f4f4f4";
const GRID_DEFAULT_WIREFRAME_COLOR_HEX = "#f4f4f4";
const GRID_SURFACE_OPACITY_DEFAULT = 1;
const GRID_SURFACE_OPACITY_MIN = 0;
const GRID_SURFACE_OPACITY_MAX = 1;
const GRID_SURFACE_EMISSIVE_COLOR_SCALE = 0.085;
const GRID_WIREFRAME_EMISSIVE_COLOR_SCALE = 0.085;

// ── Types ──

export type GridSurfaceShading = "smooth" | "flat" | "matte" | "metallic";

type GridMeshSet = {
	depthMesh: Mesh;
	surfaceMesh: Mesh;
	wireframeMesh: Mesh;
};

type GridRenderState = {
	displacementUniforms: {
		uTimeSeconds: { value: number };
		uHeightScale: { value: number };
		uAmplitudeDrive: { value: number };
		uSpectrumTex: { value: DataTexture };
	};
	distortionAlgorithm: WaveformPlaneDistortionAlgorithm;
	spectrumSmoothingTimeConstant: number;
	spectrumTextureData: Uint8Array;
	spectrumTexture: DataTexture;
	spectrumShaped: Float32Array;
	sourceSpectrumSmoothed: Float32Array;
	surfaceBaseColor: Color;
	surfaceEmissiveColor: Color;
	wireframeBaseColor: Color;
	wireframeEmissiveColor: Color;
	surfaceMaterial: MeshStandardMaterial;
	wireframeMaterial: MeshStandardMaterial;
	depthMaterial: MeshStandardMaterial;
	meshSet: GridMeshSet;
	planeEnabled: boolean;
	surfaceEnabled: boolean;
	surfaceOpacity: number;
	wireframeEnabled: boolean;
	amplitudeDrive: number;
};

// ── GLSL template strings ──

const beginNormal = `
      float heightN = computeHeight(uv);
      float steppedHeightN = floor(heightN * 8.0 + 0.5) / 8.0;
      float depthCurveN = pow(clamp(uv.y, 0.0, 1.0), 1.95);
      float depthMappedN = pow(clamp(uv.y, 0.0, 1.0), 1.55);
      float widthScaleN = mix(1.0, 0.44, depthCurveN);
      float heightAttenuationN = 1.0 - depthCurveN * 0.58;
      float baseXN = mix(-${(GRID_WIDTH * 0.5).toFixed(6)}, ${(GRID_WIDTH * 0.5).toFixed(6)}, uv.x);
      float baseYN = mix(-${(GRID_HEIGHT * 0.5).toFixed(6)}, ${(GRID_HEIGHT * 0.5).toFixed(6)}, depthMappedN);
      float baseZN = steppedHeightN * heightAttenuationN;
      float uvStepXN = ${Math.max(1 / Math.max(GRID_SEGMENTS_X, 1), 1e-5).toFixed(6)};
      float uvStepYN = ${Math.max(1 / Math.max(GRID_SEGMENTS_Y, 1), 1e-5).toFixed(6)};
      vec2 uvXN = vec2(min(1.0, uv.x + uvStepXN), uv.y);
      vec2 uvYN = vec2(uv.x, min(1.0, uv.y + uvStepYN));
      float hXN = floor(computeHeight(uvXN) * 8.0 + 0.5) / 8.0;
      float hYN = floor(computeHeight(uvYN) * 8.0 + 0.5) / 8.0;
      float depthCurveYN = pow(clamp(uvYN.y, 0.0, 1.0), 1.95);
      float depthMappedYN = pow(clamp(uvYN.y, 0.0, 1.0), 1.55);
      float widthScaleYN = mix(1.0, 0.44, depthCurveYN);
      float heightAttenuationYN = 1.0 - depthCurveYN * 0.58;
      float xXN = mix(-${(GRID_WIDTH * 0.5).toFixed(6)}, ${(GRID_WIDTH * 0.5).toFixed(6)}, uvXN.x) * widthScaleN;
      float yXN = baseYN;
      float zXN = hXN * heightAttenuationN;
      float xYN = baseXN * widthScaleYN;
      float yYN = mix(-${(GRID_HEIGHT * 0.5).toFixed(6)}, ${(GRID_HEIGHT * 0.5).toFixed(6)}, depthMappedYN);
      float zYN = hYN * heightAttenuationYN;
      vec3 tangentXN = vec3(xXN - baseXN * widthScaleN, yXN - baseYN, zXN - baseZN);
      vec3 tangentYN = vec3(xYN - baseXN * widthScaleN, yYN - baseYN, zYN - baseZN);
      vec3 objectNormal = normalize(cross(tangentXN, tangentYN));
  `;

const beginVertex = `
      float heightV = computeHeight(uv);
      float steppedHeightV = floor(heightV * 8.0 + 0.5) / 8.0;
      float depthCurveV = pow(clamp(uv.y, 0.0, 1.0), 1.95);
      float depthMappedV = pow(clamp(uv.y, 0.0, 1.0), 1.55);
      float widthScaleV = mix(1.0, 0.44, depthCurveV);
      float heightAttenuationV = 1.0 - depthCurveV * 0.58;
      float baseXV = mix(-${(GRID_WIDTH * 0.5).toFixed(6)}, ${(GRID_WIDTH * 0.5).toFixed(6)}, uv.x);
      float baseYV = mix(-${(GRID_HEIGHT * 0.5).toFixed(6)}, ${(GRID_HEIGHT * 0.5).toFixed(6)}, depthMappedV);
      float baseZV = steppedHeightV * heightAttenuationV;
      vec3 transformed = vec3(baseXV * widthScaleV, baseYV, position.z + baseZV);
  `;

// ── Helpers ──

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function normalizeColor(colorHex: string, fallback: string): string {
	return /^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : fallback;
}

function normalizeSpectrumSmoothing(value: number): number {
	if (!Number.isFinite(value)) return GRID_SPECTRUM_SMOOTHING_DEFAULT;
	return clamp(value, GRID_SPECTRUM_SMOOTHING_MIN, GRID_SPECTRUM_SMOOTHING_MAX);
}

function normalizeSurfaceOpacity(value: number): number {
	if (!Number.isFinite(value)) return GRID_SURFACE_OPACITY_DEFAULT;
	return clamp(value, GRID_SURFACE_OPACITY_MIN, GRID_SURFACE_OPACITY_MAX);
}

// ── Render state helpers ──

function applyDisplacement(
	state: GridRenderState,
	material: MeshStandardMaterial,
): void {
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, state.displacementUniforms);
		const displacementHeader = buildWaveformPlaneDisplacementHeader(
			state.distortionAlgorithm,
			Math.max(1 / (GRID_SPECTRUM_BIN_COUNT - 1), 1e-5),
		);
		shader.vertexShader = `${displacementHeader}\n${shader.vertexShader}`;
		shader.vertexShader = shader.vertexShader.replace(
			"#include <beginnormal_vertex>",
			beginNormal,
		);
		shader.vertexShader = shader.vertexShader.replace(
			"#include <begin_vertex>",
			beginVertex,
		);
	};
	material.customProgramCacheKey = () =>
		`grid-displacement-v8-${state.distortionAlgorithm}`;
}

function applySurfaceShading(
	state: GridRenderState,
	shading: GridSurfaceShading,
): void {
	const normalizedShading: GridSurfaceShading =
		shading === "flat" || shading === "matte" || shading === "metallic" || shading === "smooth"
			? shading
			: GRID_SURFACE_SHADING_DEFAULT;
	if (normalizedShading === "flat") {
		state.surfaceMaterial.flatShading = true;
		state.surfaceMaterial.roughness = 0.88;
		state.surfaceMaterial.metalness = 0.02;
		state.surfaceMaterial.emissiveIntensity = 0.14;
	} else if (normalizedShading === "matte") {
		state.surfaceMaterial.flatShading = false;
		state.surfaceMaterial.roughness = 1;
		state.surfaceMaterial.metalness = 0;
		state.surfaceMaterial.emissiveIntensity = 0.1;
	} else if (normalizedShading === "metallic") {
		state.surfaceMaterial.flatShading = false;
		state.surfaceMaterial.roughness = 0.24;
		state.surfaceMaterial.metalness = 0.58;
		state.surfaceMaterial.emissiveIntensity = 0.11;
	} else {
		state.surfaceMaterial.flatShading = false;
		state.surfaceMaterial.roughness = 0.9;
		state.surfaceMaterial.metalness = 0;
		state.surfaceMaterial.emissiveIntensity = 0.14;
	}
	state.surfaceMaterial.needsUpdate = true;
}

function applyDistortionAlgorithm(
	state: GridRenderState,
	algorithm: WaveformPlaneDistortionAlgorithm,
): void {
	const normalizedAlgorithm = normalizeWaveformPlaneDistortionAlgorithm(algorithm);
	if (normalizedAlgorithm === state.distortionAlgorithm) return;
	state.distortionAlgorithm = normalizedAlgorithm;
	state.surfaceMaterial.needsUpdate = true;
	state.wireframeMaterial.needsUpdate = true;
	state.depthMaterial.needsUpdate = true;
}

function applySurfaceColor(state: GridRenderState, colorHex: string): void {
	const color = normalizeColor(colorHex, GRID_DEFAULT_SURFACE_COLOR_HEX);
	state.surfaceBaseColor.set(color);
	state.surfaceMaterial.color.copy(state.surfaceBaseColor);
	state.surfaceEmissiveColor.copy(state.surfaceBaseColor).multiplyScalar(GRID_SURFACE_EMISSIVE_COLOR_SCALE);
	state.surfaceMaterial.emissive.copy(state.surfaceEmissiveColor);
}

function applySurfaceOpacity(state: GridRenderState, opacity: number): void {
	const normalized = normalizeSurfaceOpacity(opacity);
	state.surfaceOpacity = normalized;
	state.surfaceMaterial.opacity = normalized;
}

function applyWireframeColor(state: GridRenderState, colorHex: string): void {
	const color = normalizeColor(colorHex, GRID_DEFAULT_WIREFRAME_COLOR_HEX);
	state.wireframeBaseColor.set(color);
	state.wireframeMaterial.color.copy(state.wireframeBaseColor);
	state.wireframeEmissiveColor.copy(state.wireframeBaseColor).multiplyScalar(GRID_WIREFRAME_EMISSIVE_COLOR_SCALE);
	state.wireframeMaterial.emissive.copy(state.wireframeEmissiveColor);
}

function createMeshSet(
	geometry: PlaneGeometry,
	positionY: number,
	rotationX: number,
	materials: {
		depth: MeshStandardMaterial;
		surface: MeshStandardMaterial;
		wireframe: MeshStandardMaterial;
	},
): GridMeshSet {
	const depthMesh = new Mesh(geometry, materials.depth);
	depthMesh.position.set(0, positionY, GRID_Z);
	depthMesh.rotation.x = rotationX;
	depthMesh.rotation.y = 0;
	depthMesh.rotation.z = 0;
	depthMesh.renderOrder = -2;

	const surfaceMesh = new Mesh(geometry, materials.surface);
	surfaceMesh.position.set(0, positionY, GRID_Z);
	surfaceMesh.rotation.x = rotationX;
	surfaceMesh.rotation.y = 0;
	surfaceMesh.rotation.z = 0;
	surfaceMesh.renderOrder = -1;

	const wireframeMesh = new Mesh(geometry, materials.wireframe);
	wireframeMesh.position.set(0, positionY, GRID_Z);
	wireframeMesh.rotation.x = rotationX;
	wireframeMesh.rotation.y = 0;
	wireframeMesh.rotation.z = 0;
	wireframeMesh.renderOrder = 0;

	return { depthMesh, surfaceMesh, wireframeMesh };
}

function createRenderState(
	geometry: PlaneGeometry,
	positionY: number,
	rotationX: number,
): GridRenderState {
	const spectrumTextureData = new Uint8Array(GRID_SPECTRUM_BIN_COUNT * 4);
	for (let i = 0; i < spectrumTextureData.length; i += 4) {
		spectrumTextureData[i] = 0;
		spectrumTextureData[i + 1] = 0;
		spectrumTextureData[i + 2] = 0;
		spectrumTextureData[i + 3] = 255;
	}
	const spectrumTexture = new DataTexture(
		spectrumTextureData,
		GRID_SPECTRUM_BIN_COUNT,
		1,
		RGBAFormat,
	);
	spectrumTexture.magFilter = LinearFilter;
	spectrumTexture.minFilter = LinearFilter;
	spectrumTexture.needsUpdate = true;
	const spectrumShaped = new Float32Array(GRID_SPECTRUM_BIN_COUNT);
	const displacementUniforms = {
		uTimeSeconds: { value: 0 },
		uHeightScale: { value: GRID_HEIGHT_SCALE_DEFAULT },
		uAmplitudeDrive: { value: 0 },
		uSpectrumTex: { value: spectrumTexture },
	};

	const surfaceBaseColor = new Color(GRID_DEFAULT_SURFACE_COLOR_HEX);
	const surfaceEmissiveColor = surfaceBaseColor
		.clone()
		.multiplyScalar(GRID_SURFACE_EMISSIVE_COLOR_SCALE);
	const surfaceMaterial = new MeshStandardMaterial({
		color: surfaceBaseColor.clone(),
		emissive: surfaceEmissiveColor.clone(),
		emissiveIntensity: 0.14,
		roughness: 0.9,
		metalness: 0,
		wireframe: false,
		transparent: true,
		opacity: GRID_SURFACE_OPACITY_DEFAULT,
		side: FrontSide,
		depthWrite: true,
		depthTest: true,
	});
	const wireframeBaseColor = new Color(GRID_DEFAULT_WIREFRAME_COLOR_HEX);
	const wireframeEmissiveColor = wireframeBaseColor
		.clone()
		.multiplyScalar(GRID_WIREFRAME_EMISSIVE_COLOR_SCALE);
	const wireframeMaterial = new MeshStandardMaterial({
		color: wireframeBaseColor.clone(),
		emissive: wireframeEmissiveColor.clone(),
		emissiveIntensity: 0.14,
		roughness: 0.9,
		metalness: 0,
		wireframe: true,
		transparent: false,
		side: FrontSide,
		depthWrite: false,
		depthTest: true,
	});
	const depthMaterial = surfaceMaterial.clone();
	depthMaterial.wireframe = false;
	depthMaterial.colorWrite = false;
	depthMaterial.transparent = false;
	depthMaterial.side = FrontSide;
	depthMaterial.fog = false;
	depthMaterial.depthWrite = true;
	depthMaterial.depthTest = true;

	const state: GridRenderState = {
		displacementUniforms,
		distortionAlgorithm: WAVEFORM_PLANE_DISTORTION_DEFAULT,
		spectrumSmoothingTimeConstant: GRID_SPECTRUM_SMOOTHING_DEFAULT,
		spectrumTextureData,
		spectrumTexture,
		spectrumShaped,
		sourceSpectrumSmoothed: new Float32Array(0),
		surfaceBaseColor,
		surfaceEmissiveColor,
		wireframeBaseColor,
		wireframeEmissiveColor,
		surfaceMaterial,
		wireframeMaterial,
		depthMaterial,
		meshSet: createMeshSet(geometry, positionY, rotationX, {
			depth: depthMaterial,
			surface: surfaceMaterial,
			wireframe: wireframeMaterial,
		}),
		planeEnabled: true,
		surfaceEnabled: GRID_SURFACE_ENABLED_DEFAULT,
		surfaceOpacity: GRID_SURFACE_OPACITY_DEFAULT,
		wireframeEnabled: GRID_WIREFRAME_ENABLED_DEFAULT,
		amplitudeDrive: 0,
	};

	applyDisplacement(state, state.surfaceMaterial);
	applyDisplacement(state, state.wireframeMaterial);
	applyDisplacement(state, state.depthMaterial);
	applySurfaceShading(state, GRID_SURFACE_SHADING_DEFAULT);
	applySurfaceOpacity(state, GRID_SURFACE_OPACITY_DEFAULT);
	return state;
}

function updateSpectrum(
	state: GridRenderState,
	spectrumBins: Float32Array,
): void {
	if (state.sourceSpectrumSmoothed.length !== spectrumBins.length) {
		state.sourceSpectrumSmoothed = new Float32Array(spectrumBins.length);
	}
	const smoothing = normalizeSpectrumSmoothing(state.spectrumSmoothingTimeConstant);
	const blend = clamp(1 - smoothing, 0.02, 1);
	for (let i = 0; i < spectrumBins.length; i += 1) {
		const target = clamp(spectrumBins[i] ?? 0, 0, 1);
		state.sourceSpectrumSmoothed[i] +=
			(target - state.sourceSpectrumSmoothed[i]) * blend;
	}

	const metrics = populateWaveformPlaneSpectrumForDistortion({
		algorithm: state.distortionAlgorithm,
		sourceBins: state.sourceSpectrumSmoothed,
		targetBins: state.spectrumShaped,
		sampleLinear: sampleWaveformLinear,
	});
	state.amplitudeDrive = metrics.amplitudeDrive;
	for (let i = 0; i < GRID_SPECTRUM_BIN_COUNT; i += 1) {
		const encoded = Math.round(clamp(state.spectrumShaped[i], 0, 1) * 255);
		const offset = i * 4;
		state.spectrumTextureData[offset] = encoded;
		state.spectrumTextureData[offset + 1] = encoded;
		state.spectrumTextureData[offset + 2] = encoded;
		state.spectrumTextureData[offset + 3] = 255;
	}
	state.spectrumTexture.needsUpdate = true;
}

function resetSpectrum(state: GridRenderState): void {
	state.amplitudeDrive = 0;
	state.sourceSpectrumSmoothed.fill(0);
	for (let i = 0; i < GRID_SPECTRUM_BIN_COUNT; i += 1) {
		state.spectrumShaped[i] = 0;
		const offset = i * 4;
		state.spectrumTextureData[offset] = 0;
		state.spectrumTextureData[offset + 1] = 0;
		state.spectrumTextureData[offset + 2] = 0;
		state.spectrumTextureData[offset + 3] = 255;
	}
	state.spectrumTexture.needsUpdate = true;
}

// ── Mesh positioning ──

function setMeshPositionY(meshSet: GridMeshSet, y: number): void {
	meshSet.depthMesh.position.y = y;
	meshSet.surfaceMesh.position.y = y;
	meshSet.wireframeMesh.position.y = y;
}

function setMeshRotationX(meshSet: GridMeshSet, rx: number): void {
	meshSet.depthMesh.rotation.x = rx;
	meshSet.surfaceMesh.rotation.x = rx;
	meshSet.wireframeMesh.rotation.x = rx;
}

// ── Grid Scene Factory ──

export function createGridScene(id: string): SceneInstance & GridSceneExtensions {
	const group = new Group();
	const geometry = new PlaneGeometry(GRID_WIDTH, GRID_HEIGHT, GRID_SEGMENTS_X, GRID_SEGMENTS_Y);

	const state = createRenderState(geometry, GRID_DEFAULT_POSITION_Y, GRID_DEFAULT_ROTATION_X);
	let positionY = GRID_DEFAULT_POSITION_Y;
	let rotationX = GRID_DEFAULT_ROTATION_X;

	group.add(state.meshSet.depthMesh);
	group.add(state.meshSet.surfaceMesh);
	group.add(state.meshSet.wireframeMesh);

	let hasData = true;
	let timeSeconds = 0;

	const syncVisibility = (): void => {
		const meshSet = state.meshSet;
		const visible = hasData && state.planeEnabled;
		meshSet.surfaceMesh.visible = visible && state.surfaceEnabled;
		meshSet.wireframeMesh.visible = visible && state.wireframeEnabled;
		meshSet.depthMesh.visible = visible && state.wireframeEnabled && !state.surfaceEnabled;
	};

	syncVisibility();

	return {
		id,
		kind: "grid",
		group,
		update(_simTimeSeconds, _shipY) {
			syncVisibility();
			if (!hasData) return;
			if (!state.planeEnabled) return;
			if (!state.surfaceEnabled && !state.wireframeEnabled) return;
			state.displacementUniforms.uTimeSeconds.value = timeSeconds;
			state.displacementUniforms.uAmplitudeDrive.value = state.amplitudeDrive;
		},
		set(key, value) {
			switch (key) {
				case "sideEnabled":
					state.planeEnabled = !!value;
					syncVisibility();
					return true;
				case "surfaceEnabled":
					state.surfaceEnabled = !!value;
					syncVisibility();
					return true;
				case "wireframeEnabled":
					state.wireframeEnabled = !!value;
					syncVisibility();
					return true;
				case "heightScale": {
					const next = clamp(
						Number.isFinite(value as number) ? (value as number) : GRID_HEIGHT_SCALE_DEFAULT,
						GRID_HEIGHT_SCALE_MIN,
						GRID_HEIGHT_SCALE_MAX,
					);
					state.displacementUniforms.uHeightScale.value = next;
					return true;
				}
				case "surfaceShading":
					applySurfaceShading(state, value as GridSurfaceShading);
					return true;
				case "distortionAlgorithm":
					applyDistortionAlgorithm(state, value as WaveformPlaneDistortionAlgorithm);
					return true;
				case "surfaceColor":
					applySurfaceColor(state, value as string);
					return true;
				case "wireframeColor":
					applyWireframeColor(state, value as string);
					return true;
				case "surfaceOpacity":
					applySurfaceOpacity(state, value as number);
					return true;
				case "spectrumSmoothing":
					state.spectrumSmoothingTimeConstant = normalizeSpectrumSmoothing(value as number);
					return true;
				case "positionY": {
					const py = clamp(
						Number.isFinite(value as number) ? (value as number) : GRID_DEFAULT_POSITION_Y,
						GRID_POSITION_Y_MIN,
						GRID_POSITION_Y_MAX,
					);
					positionY = py;
					setMeshPositionY(state.meshSet, py);
					return true;
				}
				case "rotationX": {
					const rx = clamp(
						Number.isFinite(value as number) ? (value as number) : GRID_DEFAULT_ROTATION_X,
						GRID_ROTATION_X_MIN,
						GRID_ROTATION_X_MAX,
					);
					rotationX = rx;
					setMeshRotationX(state.meshSet, rx);
					return true;
				}
				default:
					return false;
			}
		},
		getSettings() {
			return {
				sideEnabled: state.planeEnabled,
				surfaceEnabled: state.surfaceEnabled,
				wireframeEnabled: state.wireframeEnabled,
				heightScale: state.displacementUniforms.uHeightScale.value,
				surfaceOpacity: state.surfaceOpacity,
				spectrumSmoothing: state.spectrumSmoothingTimeConstant,
				positionY,
				rotationX,
			};
		},
		dispose() {
			geometry.dispose();
			state.surfaceMaterial.dispose();
			state.wireframeMaterial.dispose();
			state.depthMaterial.dispose();
			state.spectrumTexture.dispose();
		},

		// Grid-specific extensions
		setSpectrum(spectrumBins) {
			if (!spectrumBins || spectrumBins.length === 0) {
				resetSpectrum(state);
				return;
			}
			updateSpectrum(state, spectrumBins);
		},
		setSpectrumTimeline(_timeline: SpectrumTimeline | null) {
			hasData = true;
			syncVisibility();
		},
		setTime(t: number) {
			timeSeconds = Math.max(0, t);
		},
	};
}
