import {
	AdditiveBlending,
	AmbientLight,
	BoxGeometry,
	Color,
	DataTexture,
	DirectionalLight,
	DoubleSide,
	Fog,
	FrontSide,
	Group,
	LinearFilter,
	MeshBasicMaterial,
	Mesh,
	MeshStandardMaterial,
	OrthographicCamera,
	PlaneGeometry,
	PointLight,
	RGBAFormat,
	RingGeometry,
	Scene,
	SphereGeometry,
	Vector2,
	Vector3,
	WebGLRenderer,
} from "three";
import type { SpectrumTimeline } from "../audio/types";
import type { SimulationSnapshot } from "../game/sim";
import {
	createExplosionBurst,
	normalizeExplosionPower,
	updateExplosionBurst,
	type ExplosionBurst,
} from "./effects/explosions";
import {
	bindPurplePulseRenderable,
	clearPurplePulseRenderable,
	computePurplePulseTravelDuration,
	PURPLE_PULSE_DASH_END,
	PURPLE_PULSE_DASH_START,
	PURPLE_PULSE_MAX_NEW_BINDINGS_PER_FRAME,
	PURPLE_PULSE_MAX_POOL_SIZE,
	PURPLE_PULSE_TERMINAL_ACCELERATION_POWER,
	PURPLE_PULSE_TRAVEL_DASH_RATIO,
	setDashOffset,
	setDashRatio,
	syncPurplePulsePool,
	type PurplePulseRenderable,
} from "./effects/purplePulses";
import {
	createStarLayer,
	normalizeStarfieldShipMovementResponse,
	normalizeStarfieldSpeedScale,
	STARFIELD_SHIP_MOVEMENT_RESPONSE_DEFAULT,
	STARFIELD_SPEED_SCALE_DEFAULT,
	updateStarLayer,
	type StarLayer,
} from "./stages/starfield";
import {
	fillWaveformTextureDataWithSilence,
	populateSpectrumTimelineTexture,
	populateSpectrumTimelineTextureFromWaveform,
	sampleWaveformLinear,
} from "./stages/waveformTexture";
import {
	createEnemyRenderer,
	updateEnemyRenderer,
} from "./enemies/enemyRenderer";
import {
	createEnemyProjectileRenderer,
	updateEnemyProjectileRenderer,
} from "./weapons/enemyProjectiles";
import {
	createLaserBeamRenderer,
	updateLaserBeamRenderer,
} from "./weapons/laserBeams";
import {
	createPlayerProjectileRenderer,
	updatePlayerProjectileRenderer,
} from "./weapons/playerProjectiles";
import {
	WAVEFORM_PLANE_DISTORTION_DEFAULT,
	buildWaveformPlaneDisplacementHeader,
	normalizeWaveformPlaneDistortionAlgorithm,
	populateWaveformPlaneSpectrumForDistortion,
	type WaveformPlaneDistortionAlgorithm,
} from "./stages/waveformPlane/distortion";
import { createOceanStage, type OceanTimeOfDay } from "./stages/ocean";
import { createSkyStage } from "./stages/sky";

type WaveformPlaneSurfaceShading = "smooth" | "flat" | "matte" | "metallic";
type WaveformPlaneSide = "bottom" | "top";

export type RenderScene = {
	update: (snapshot: SimulationSnapshot, alpha: number) => void;
	render: () => void;
	resize: () => void;
	setStarfieldEnabled: (enabled: boolean) => void;
	setStarfieldSpeedScale: (speedScale: number) => void;
	setStarfieldShipMovementResponse: (responseScale: number) => void;
	setOceanEnabled: (enabled: boolean) => void;
	setOceanSize: (size: number) => void;
	setOceanDistortionScale: (scale: number) => void;
	setOceanAmplitude: (amplitude: number) => void;
	setOceanSpeed: (speed: number) => void;
	setOceanTimeOfDay: (tod: OceanTimeOfDay) => void;
	setSkyEnabled: (enabled: boolean) => void;
	setSkyTurbidity: (v: number) => void;
	setSkyRayleigh: (v: number) => void;
	setSkyMieCoefficient: (v: number) => void;
	setSkyMieDirectionalG: (v: number) => void;
	setSkyElevation: (v: number) => void;
	setSkyAzimuth: (v: number) => void;
	setSkyExposure: (v: number) => void;
	setWaveformPlaneEnabled: (enabled: boolean) => void;
	setWaveformPlaneSurfaceEnabled: (
		side: WaveformPlaneSide,
		enabled: boolean,
	) => void;
	setWaveformPlaneWireframeEnabled: (
		side: WaveformPlaneSide,
		enabled: boolean,
	) => void;
	setWaveformPlaneSideEnabled: (
		side: WaveformPlaneSide,
		enabled: boolean,
	) => void;
	setWaveformPlaneHeightScale: (
		side: WaveformPlaneSide,
		heightScale: number,
	) => void;
	setWaveformPlaneSurfaceShading: (
		side: WaveformPlaneSide,
		shading: WaveformPlaneSurfaceShading,
	) => void;
	setWaveformPlaneDistortionAlgorithm: (
		side: WaveformPlaneSide,
		algorithm: WaveformPlaneDistortionAlgorithm,
	) => void;
	setWaveformPlaneSurfaceColor: (
		side: WaveformPlaneSide,
		colorHex: string,
	) => void;
	setWaveformPlaneWireframeColor: (
		side: WaveformPlaneSide,
		colorHex: string,
	) => void;
	setWaveformPlaneSurfaceOpacity: (
		side: WaveformPlaneSide,
		opacity: number,
	) => void;
	setWaveformPlaneSpectrumSmoothing: (
		side: WaveformPlaneSide,
		smoothingTimeConstant: number,
	) => void;
	setWaveformPlaneSpectrum: (spectrumBins: Float32Array | null) => void;
	setWaveformPlaneSpectrumTimeline: (timeline: SpectrumTimeline | null) => void;
	setWaveformPlaneData: (
		waveformLeft: Float32Array,
		waveformRight: Float32Array,
	) => void;
	clearWaveformPlaneData: () => void;
	setWaveformPlaneTime: (timeSeconds: number) => void;
};

export function setupScene(container: HTMLElement): RenderScene {
	const FIXED_RENDER_WIDTH = 1920;
	const FIXED_RENDER_HEIGHT = 1080;
	const ORTHO_HALF_HEIGHT = 11.5;

	const scene = new Scene();
	const lowEnergyBg = new Color("#070707");
	const highEnergyBg = new Color("#141414");
	const currentBg = lowEnergyBg.clone();
	scene.background = currentBg;
	const sceneFog = new Fog(
		currentBg.clone(),
		WAVEFORM_SCENE_FOG_NEAR,
		WAVEFORM_SCENE_FOG_FAR,
	);
	scene.fog = sceneFog;

	const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
	camera.position.set(0, 0, 20);
	camera.lookAt(new Vector3(0, 0, 0));

	const renderer = new WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(1);
	renderer.setSize(FIXED_RENDER_WIDTH, FIXED_RENDER_HEIGHT, false);
	renderer.domElement.classList.add("main-scene-canvas");
	container.appendChild(renderer.domElement);
	const meshLineResolution = new Vector2(
		FIXED_RENDER_WIDTH,
		FIXED_RENDER_HEIGHT,
	);

	const ambientLight = new AmbientLight("#c7ced9", 0.4);
	scene.add(ambientLight);

	const directionalLight = new DirectionalLight("#fef2c2", 1.1);
	directionalLight.position.set(2, 4, 8);
	scene.add(directionalLight);
	const waveformTopLight = new PointLight("#b7ffd9", 2.2, 90, 2);
	waveformTopLight.position.set(0, 10, -14);
	scene.add(waveformTopLight);

	const shipGeometry = new BoxGeometry(1.2, 0.6, 0.9);
	const shipMaterial = new MeshStandardMaterial({
		color: "#67e8f9",
		roughness: 0.25,
		metalness: 0.5,
		transparent: true,
		opacity: 0.62,
		side: DoubleSide,
		depthWrite: false,
	});
	const shipMesh = new Mesh(shipGeometry, shipMaterial);
	scene.add(shipMesh);
	const shieldMaterial = new MeshStandardMaterial({
		color: "#7dd3fc",
		transparent: true,
		opacity: 0,
		emissive: "#38bdf8",
		emissiveIntensity: 0.5,
		roughness: 0.2,
		metalness: 0,
	});
	const shieldMesh = new Mesh(new SphereGeometry(0.8, 16, 12), shieldMaterial);
	scene.add(shieldMesh);

	const enemyRenderer = createEnemyRenderer();
	scene.add(enemyRenderer.group);

	const playerProjectileRenderer = createPlayerProjectileRenderer();
	scene.add(playerProjectileRenderer.group);
	const purplePulseGroup = new Group();
	scene.add(purplePulseGroup);
	const purplePulses: PurplePulseRenderable[] = [];
	const purplePulseIndexByMissileId = new Map<number, number>();
	syncPurplePulsePool(
		purplePulses,
		PURPLE_PULSE_MAX_POOL_SIZE,
		purplePulseGroup,
		meshLineResolution,
	);
	const enemyProjectileRenderer = createEnemyProjectileRenderer();
	scene.add(enemyProjectileRenderer.ballGroup);
	scene.add(enemyProjectileRenderer.laserGroup);

	const laserBeamRenderer = createLaserBeamRenderer();
	scene.add(laserBeamRenderer.group);

	let previousShipY = 0;
	let previousShipTimeSeconds = 0;
	let hasPreviousShipY = false;
	let shipPitch = 0;
	let lastMissileTrailSnapshotTime = -1;

	const explosionGeometry = new SphereGeometry(0.4, 10, 8);
	const explosionMaterial = new MeshBasicMaterial({
		color: "#fde047",
		transparent: true,
		opacity: 1,
		blending: AdditiveBlending,
	});
	const explosionRingGeometry = new RingGeometry(0.595, 0.62, 40);
	const explosionRingMaterial = new MeshBasicMaterial({
		color: "#fb923c",
		transparent: true,
		opacity: 1,
		side: 2,
		blending: AdditiveBlending,
	});
	const explosionGroup = new Group();
	scene.add(explosionGroup);
	const explosionMeshes: Mesh[] = [];
	const explosionRingMeshes: Mesh[] = [];
	const explosionParticleBursts: ExplosionBurst[] = [];
	const coreColor = new Color();
	const ringColor = new Color();
	const sparkColor = new Color();

	const closeStars = createStarLayer(130, 0xe0f2fe, 10.5, 0.12, 0.56);
	const nearStars = createStarLayer(220, 0x93c5fd, 6.6, 0.08, 0.34);
	const farStars = createStarLayer(150, 0x334155, 3.1, 0.05, 0.14);
	const starLayers = [farStars, nearStars, closeStars];
	scene.add(farStars.primary);
	scene.add(farStars.wrap);
	scene.add(nearStars.primary);
	scene.add(nearStars.wrap);
	scene.add(closeStars.primary);
	scene.add(closeStars.wrap);
	let starfieldEnabled = true;
	let starfieldSpeedScale = STARFIELD_SPEED_SCALE_DEFAULT;
	let starfieldShipMovementResponse = STARFIELD_SHIP_MOVEMENT_RESPONSE_DEFAULT;
	const syncStarfieldVisibility = (): void => {
		for (const layer of starLayers) {
			layer.primary.visible = starfieldEnabled;
			layer.wrap.visible = starfieldEnabled;
		}
	};
	syncStarfieldVisibility();

	const oceanStage = createOceanStage();
	scene.add(oceanStage.group);
	let oceanEnabled = false;
	const syncOceanVisibility = (): void => {
		oceanStage.group.visible = oceanEnabled;
	};
	syncOceanVisibility();

	const skyStage = createSkyStage();
	scene.add(skyStage.group);
	let skyEnabled = false;
	const syncSkyVisibility = (): void => {
		skyStage.group.visible = skyEnabled;
	};
	syncSkyVisibility();

	type WaveformPlaneMeshSet = {
		placement: WaveformPlaneSide;
		depthMesh: Mesh;
		surfaceMesh: Mesh;
		wireframeMesh: Mesh;
	};
	type WaveformPlaneRenderState = {
		side: WaveformPlaneSide;
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
		meshSet: WaveformPlaneMeshSet;
		planeEnabled: boolean;
		surfaceEnabled: boolean;
		surfaceOpacity: number;
		wireframeEnabled: boolean;
		amplitudeDrive: number;
	};
	const waveformPlaneBeginNormal = `
      float heightN = computeHeight(uv);
      float steppedHeightN = floor(heightN * 8.0 + 0.5) / 8.0;
      float depthCurveN = pow(clamp(uv.y, 0.0, 1.0), 1.95);
      float depthMappedN = pow(clamp(uv.y, 0.0, 1.0), 1.55);
      float widthScaleN = mix(1.0, 0.44, depthCurveN);
      float heightAttenuationN = 1.0 - depthCurveN * 0.58;
      float baseXN = mix(-${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, uv.x);
      float baseYN = mix(-${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, depthMappedN);
      float baseZN = steppedHeightN * heightAttenuationN;
      float uvStepXN = ${Math.max(1 / Math.max(WAVEFORM_PLANE_SEGMENTS_X, 1), 1e-5).toFixed(6)};
      float uvStepYN = ${Math.max(1 / Math.max(WAVEFORM_PLANE_SEGMENTS_Y, 1), 1e-5).toFixed(6)};
      vec2 uvXN = vec2(min(1.0, uv.x + uvStepXN), uv.y);
      vec2 uvYN = vec2(uv.x, min(1.0, uv.y + uvStepYN));
      float hXN = floor(computeHeight(uvXN) * 8.0 + 0.5) / 8.0;
      float hYN = floor(computeHeight(uvYN) * 8.0 + 0.5) / 8.0;
      float depthCurveYN = pow(clamp(uvYN.y, 0.0, 1.0), 1.95);
      float depthMappedYN = pow(clamp(uvYN.y, 0.0, 1.0), 1.55);
      float widthScaleYN = mix(1.0, 0.44, depthCurveYN);
      float heightAttenuationYN = 1.0 - depthCurveYN * 0.58;
      float xXN = mix(-${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, uvXN.x) * widthScaleN;
      float yXN = baseYN;
      float zXN = hXN * heightAttenuationN;
      float xYN = baseXN * widthScaleYN;
      float yYN = mix(-${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, depthMappedYN);
      float zYN = hYN * heightAttenuationYN;
      vec3 tangentXN = vec3(xXN - baseXN * widthScaleN, yXN - baseYN, zXN - baseZN);
      vec3 tangentYN = vec3(xYN - baseXN * widthScaleN, yYN - baseYN, zYN - baseZN);
      vec3 objectNormal = normalize(cross(tangentXN, tangentYN));
  `;
	const waveformPlaneBeginVertex = `
      float heightV = computeHeight(uv);
      float steppedHeightV = floor(heightV * 8.0 + 0.5) / 8.0;
      float depthCurveV = pow(clamp(uv.y, 0.0, 1.0), 1.95);
      float depthMappedV = pow(clamp(uv.y, 0.0, 1.0), 1.55);
      float widthScaleV = mix(1.0, 0.44, depthCurveV);
      float heightAttenuationV = 1.0 - depthCurveV * 0.58;
      float baseXV = mix(-${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, uv.x);
      float baseYV = mix(-${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, depthMappedV);
      float baseZV = steppedHeightV * heightAttenuationV;
      vec3 transformed = vec3(baseXV * widthScaleV, baseYV, position.z + baseZV);
  `;
	const waveformPlaneGeometry = new PlaneGeometry(
		WAVEFORM_PLANE_WIDTH,
		WAVEFORM_PLANE_HEIGHT,
		WAVEFORM_PLANE_SEGMENTS_X,
		WAVEFORM_PLANE_SEGMENTS_Y,
	);
	const normalizeWaveformPlaneSide = (side: WaveformPlaneSide): WaveformPlaneSide =>
		side === "top" ? "top" : "bottom";
	const normalizeWaveformPlaneColor = (
		colorHex: string,
		fallback: string,
	): string => (/^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : fallback);
	const normalizeWaveformPlaneSpectrumSmoothing = (value: number): number => {
		if (!Number.isFinite(value)) {
			return WAVEFORM_PLANE_SPECTRUM_SMOOTHING_DEFAULT;
		}
		return clamp(
			value,
			WAVEFORM_PLANE_SPECTRUM_SMOOTHING_MIN,
			WAVEFORM_PLANE_SPECTRUM_SMOOTHING_MAX,
		);
	};
	const normalizeWaveformPlaneSurfaceOpacity = (value: number): number => {
		if (!Number.isFinite(value)) {
			return WAVEFORM_PLANE_SURFACE_OPACITY_DEFAULT;
		}
		return clamp(
			value,
			WAVEFORM_PLANE_SURFACE_OPACITY_MIN,
			WAVEFORM_PLANE_SURFACE_OPACITY_MAX,
		);
	};
	const createWaveformPlaneMeshSet = (
		placement: WaveformPlaneSide,
		positionY: number,
		rotationX: number,
		materials: {
			depth: MeshStandardMaterial;
			surface: MeshStandardMaterial;
			wireframe: MeshStandardMaterial;
		},
	): WaveformPlaneMeshSet => {
		const depthMesh = new Mesh(waveformPlaneGeometry, materials.depth);
		depthMesh.position.set(0, positionY, WAVEFORM_PLANE_Z);
		depthMesh.rotation.x = rotationX;
		depthMesh.rotation.y = 0;
		depthMesh.rotation.z = 0;
		depthMesh.renderOrder = -2;

		const surfaceMesh = new Mesh(waveformPlaneGeometry, materials.surface);
		surfaceMesh.position.set(0, positionY, WAVEFORM_PLANE_Z);
		surfaceMesh.rotation.x = rotationX;
		surfaceMesh.rotation.y = 0;
		surfaceMesh.rotation.z = 0;
		surfaceMesh.renderOrder = -1;

		const wireframeMesh = new Mesh(waveformPlaneGeometry, materials.wireframe);
		wireframeMesh.position.set(0, positionY, WAVEFORM_PLANE_Z);
		wireframeMesh.rotation.x = rotationX;
		wireframeMesh.rotation.y = 0;
		wireframeMesh.rotation.z = 0;
		wireframeMesh.renderOrder = 0;

		return {
			placement,
			depthMesh,
			surfaceMesh,
			wireframeMesh,
		};
	};
	const applyWaveformPlaneDisplacement = (
		state: WaveformPlaneRenderState,
		material: MeshStandardMaterial,
	): void => {
		material.onBeforeCompile = (shader) => {
			Object.assign(shader.uniforms, state.displacementUniforms);
			const displacementHeader = buildWaveformPlaneDisplacementHeader(
				state.distortionAlgorithm,
				Math.max(1 / (WAVEFORM_PLANE_SPECTRUM_BIN_COUNT - 1), 1e-5),
			);
			shader.vertexShader = `${displacementHeader}\n${shader.vertexShader}`;
			shader.vertexShader = shader.vertexShader.replace(
				"#include <beginnormal_vertex>",
				waveformPlaneBeginNormal,
			);
			shader.vertexShader = shader.vertexShader.replace(
				"#include <begin_vertex>",
				waveformPlaneBeginVertex,
			);
		};
		material.customProgramCacheKey = () =>
			`waveform-plane-displacement-v8-${state.side}-${state.distortionAlgorithm}`;
	};
	const applyWaveformPlaneSurfaceShading = (
		state: WaveformPlaneRenderState,
		shading: WaveformPlaneSurfaceShading,
	): void => {
		const normalizedShading: WaveformPlaneSurfaceShading =
			shading === "flat" ||
			shading === "matte" ||
			shading === "metallic" ||
			shading === "smooth"
				? shading
				: WAVEFORM_PLANE_SURFACE_SHADING_DEFAULT;
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
	};
	const applyWaveformPlaneDistortionAlgorithm = (
		state: WaveformPlaneRenderState,
		algorithm: WaveformPlaneDistortionAlgorithm,
	): void => {
		const normalizedAlgorithm =
			normalizeWaveformPlaneDistortionAlgorithm(algorithm);
		if (normalizedAlgorithm === state.distortionAlgorithm) {
			return;
		}
		state.distortionAlgorithm = normalizedAlgorithm;
		state.surfaceMaterial.needsUpdate = true;
		state.wireframeMaterial.needsUpdate = true;
		state.depthMaterial.needsUpdate = true;
	};
	const applyWaveformPlaneSurfaceColor = (
		state: WaveformPlaneRenderState,
		colorHex: string,
	): void => {
		const normalizedColor = normalizeWaveformPlaneColor(
			colorHex,
			WAVEFORM_PLANE_DEFAULT_SURFACE_COLOR_HEX,
		);
		state.surfaceBaseColor.set(normalizedColor);
		state.surfaceMaterial.color.copy(state.surfaceBaseColor);
		state.surfaceEmissiveColor
			.copy(state.surfaceBaseColor)
			.multiplyScalar(WAVEFORM_PLANE_SURFACE_EMISSIVE_COLOR_SCALE);
		state.surfaceMaterial.emissive.copy(state.surfaceEmissiveColor);
	};
	const applyWaveformPlaneSurfaceOpacity = (
		state: WaveformPlaneRenderState,
		opacity: number,
	): void => {
		const normalizedOpacity = normalizeWaveformPlaneSurfaceOpacity(opacity);
		state.surfaceOpacity = normalizedOpacity;
		state.surfaceMaterial.opacity = normalizedOpacity;
	};
	const applyWaveformPlaneWireframeColor = (
		state: WaveformPlaneRenderState,
		colorHex: string,
	): void => {
		const normalizedColor = normalizeWaveformPlaneColor(
			colorHex,
			WAVEFORM_PLANE_DEFAULT_WIREFRAME_COLOR_HEX,
		);
		state.wireframeBaseColor.set(normalizedColor);
		state.wireframeMaterial.color.copy(state.wireframeBaseColor);
		state.wireframeEmissiveColor
			.copy(state.wireframeBaseColor)
			.multiplyScalar(WAVEFORM_PLANE_WIREFRAME_EMISSIVE_COLOR_SCALE);
		state.wireframeMaterial.emissive.copy(state.wireframeEmissiveColor);
	};
	const createWaveformPlaneState = (
		side: WaveformPlaneSide,
		positionY: number,
		rotationX: number,
	): WaveformPlaneRenderState => {
		const spectrumTextureData = new Uint8Array(
			WAVEFORM_PLANE_SPECTRUM_BIN_COUNT * 4,
		);
		for (let i = 0; i < spectrumTextureData.length; i += 4) {
			spectrumTextureData[i] = 0;
			spectrumTextureData[i + 1] = 0;
			spectrumTextureData[i + 2] = 0;
			spectrumTextureData[i + 3] = 255;
		}
		const spectrumTexture = new DataTexture(
			spectrumTextureData,
			WAVEFORM_PLANE_SPECTRUM_BIN_COUNT,
			1,
			RGBAFormat,
		);
		spectrumTexture.magFilter = LinearFilter;
		spectrumTexture.minFilter = LinearFilter;
		spectrumTexture.needsUpdate = true;
		const spectrumShaped = new Float32Array(WAVEFORM_PLANE_SPECTRUM_BIN_COUNT);
		const displacementUniforms = {
			uTimeSeconds: { value: 0 },
			uHeightScale: { value: WAVEFORM_PLANE_HEIGHT_SCALE_DEFAULT },
			uAmplitudeDrive: { value: 0 },
			uSpectrumTex: { value: spectrumTexture },
		};

		const surfaceBaseColor = new Color(WAVEFORM_PLANE_DEFAULT_SURFACE_COLOR_HEX);
		const surfaceEmissiveColor = surfaceBaseColor
			.clone()
			.multiplyScalar(WAVEFORM_PLANE_SURFACE_EMISSIVE_COLOR_SCALE);
		const surfaceMaterial = new MeshStandardMaterial({
			color: surfaceBaseColor.clone(),
			emissive: surfaceEmissiveColor.clone(),
			emissiveIntensity: 0.14,
			roughness: 0.9,
			metalness: 0,
			wireframe: false,
			transparent: true,
			opacity: WAVEFORM_PLANE_SURFACE_OPACITY_DEFAULT,
			side: FrontSide,
			depthWrite: true,
			depthTest: true,
		});
		const wireframeBaseColor = new Color(
			WAVEFORM_PLANE_DEFAULT_WIREFRAME_COLOR_HEX,
		);
		const wireframeEmissiveColor = wireframeBaseColor
			.clone()
			.multiplyScalar(WAVEFORM_PLANE_WIREFRAME_EMISSIVE_COLOR_SCALE);
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

		const state: WaveformPlaneRenderState = {
			side,
			displacementUniforms,
			distortionAlgorithm: WAVEFORM_PLANE_DISTORTION_DEFAULT,
			spectrumSmoothingTimeConstant: WAVEFORM_PLANE_SPECTRUM_SMOOTHING_DEFAULT,
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
			meshSet: createWaveformPlaneMeshSet(side, positionY, rotationX, {
				depth: depthMaterial,
				surface: surfaceMaterial,
				wireframe: wireframeMaterial,
			}),
			planeEnabled: side === "bottom",
			surfaceEnabled: WAVEFORM_PLANE_SURFACE_ENABLED_DEFAULT,
			surfaceOpacity: WAVEFORM_PLANE_SURFACE_OPACITY_DEFAULT,
			wireframeEnabled: WAVEFORM_PLANE_WIREFRAME_ENABLED_DEFAULT,
			amplitudeDrive: 0,
		};

		applyWaveformPlaneDisplacement(state, state.surfaceMaterial);
		applyWaveformPlaneDisplacement(state, state.wireframeMaterial);
		applyWaveformPlaneDisplacement(state, state.depthMaterial);
		applyWaveformPlaneSurfaceShading(state, WAVEFORM_PLANE_SURFACE_SHADING_DEFAULT);
		applyWaveformPlaneSurfaceOpacity(
			state,
			WAVEFORM_PLANE_SURFACE_OPACITY_DEFAULT,
		);
		return state;
	};
	const waveformPlaneStates: Record<WaveformPlaneSide, WaveformPlaneRenderState> =
		{
			bottom: createWaveformPlaneState(
				"bottom",
				WAVEFORM_PLANE_BOTTOM_Y,
				WAVEFORM_PLANE_BOTTOM_ROTATION_X,
			),
			top: createWaveformPlaneState(
				"top",
				WAVEFORM_PLANE_TOP_Y,
				WAVEFORM_PLANE_TOP_ROTATION_X,
			),
		};
	const waveformPlaneStateList = [
		waveformPlaneStates.bottom,
		waveformPlaneStates.top,
	];
	for (const planeState of waveformPlaneStateList) {
		scene.add(planeState.meshSet.depthMesh);
		scene.add(planeState.meshSet.surfaceMesh);
		scene.add(planeState.meshSet.wireframeMesh);
	}

	let waveformPlaneEnabled = false;
	let waveformPlaneHasData = true;
	let waveformPlaneTimeSeconds = 0;
	const syncWaveformPlaneVisibility = (): void => {
		const active = waveformPlaneEnabled && waveformPlaneHasData;
		for (const planeState of waveformPlaneStateList) {
			const meshSet = planeState.meshSet;
			const placementVisible = active && planeState.planeEnabled;
			meshSet.surfaceMesh.visible =
				placementVisible && planeState.surfaceEnabled;
			meshSet.wireframeMesh.visible =
				placementVisible && planeState.wireframeEnabled;
			meshSet.depthMesh.visible =
				placementVisible &&
				planeState.wireframeEnabled &&
				!planeState.surfaceEnabled;
		}
	};
	const updateWaveformPlaneSpectrumForState = (
		state: WaveformPlaneRenderState,
		spectrumBins: Float32Array,
	): void => {
		if (state.sourceSpectrumSmoothed.length !== spectrumBins.length) {
			state.sourceSpectrumSmoothed = new Float32Array(spectrumBins.length);
		}
		const smoothing = normalizeWaveformPlaneSpectrumSmoothing(
			state.spectrumSmoothingTimeConstant,
		);
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
		for (let i = 0; i < WAVEFORM_PLANE_SPECTRUM_BIN_COUNT; i += 1) {
			const encoded = Math.round(clamp(state.spectrumShaped[i], 0, 1) * 255);
			const offset = i * 4;
			state.spectrumTextureData[offset] = encoded;
			state.spectrumTextureData[offset + 1] = encoded;
			state.spectrumTextureData[offset + 2] = encoded;
			state.spectrumTextureData[offset + 3] = 255;
		}
		state.spectrumTexture.needsUpdate = true;
	};
	const resetWaveformPlaneSpectrumState = (state: WaveformPlaneRenderState): void => {
		state.amplitudeDrive = 0;
		state.sourceSpectrumSmoothed.fill(0);
		for (let i = 0; i < WAVEFORM_PLANE_SPECTRUM_BIN_COUNT; i += 1) {
			state.spectrumShaped[i] = 0;
			const offset = i * 4;
			state.spectrumTextureData[offset] = 0;
			state.spectrumTextureData[offset + 1] = 0;
			state.spectrumTextureData[offset + 2] = 0;
			state.spectrumTextureData[offset + 3] = 255;
		}
		state.spectrumTexture.needsUpdate = true;
	};
	syncWaveformPlaneVisibility();

	function resize(): void {
		const width = container.clientWidth;
		const height = container.clientHeight;
		if (width === 0 || height === 0) {
			return;
		}

		const targetAspect = FIXED_RENDER_WIDTH / FIXED_RENDER_HEIGHT;
		let displayWidth = Math.min(width, FIXED_RENDER_WIDTH);
		let displayHeight = displayWidth / targetAspect;

		if (displayHeight > height) {
			displayHeight = Math.min(height, FIXED_RENDER_HEIGHT);
			displayWidth = displayHeight * targetAspect;
		}

		displayWidth = Math.max(1, displayWidth);
		displayHeight = Math.max(1, displayHeight);

		renderer.domElement.style.width = `${displayWidth}px`;
		renderer.domElement.style.height = `${displayHeight}px`;
		renderer.domElement.style.left = `${(width - displayWidth) * 0.5}px`;
		renderer.domElement.style.top = `${(height - displayHeight) * 0.5}px`;

		meshLineResolution.set(displayWidth, displayHeight);
		for (const pulse of purplePulses) {
			pulse.material.resolution = meshLineResolution;
		}

		const halfWidth = ORTHO_HALF_HEIGHT * targetAspect;
		camera.left = -halfWidth;
		camera.right = halfWidth;
		camera.top = ORTHO_HALF_HEIGHT;
		camera.bottom = -ORTHO_HALF_HEIGHT;
		camera.updateProjectionMatrix();
	}

	resize();

	return {
		update(snapshot) {
			const starTimeSeconds = snapshot.simTimeSeconds;
			shipMesh.position.set(snapshot.ship.x, snapshot.ship.y, snapshot.ship.z);
			const deltaY = hasPreviousShipY ? snapshot.ship.y - previousShipY : 0;
			const deltaTime = hasPreviousShipY
				? Math.max(1e-3, snapshot.simTimeSeconds - previousShipTimeSeconds)
				: 1 / 60;
			const verticalVelocity = deltaY / deltaTime;
			hasPreviousShipY = true;
			previousShipY = snapshot.ship.y;
			previousShipTimeSeconds = snapshot.simTimeSeconds;
			const targetPitch = clamp01Signed(-verticalVelocity * 0.085, 0.58);
			shipPitch += (targetPitch - shipPitch) * 0.3;
			shipMesh.rotation.x = shipPitch;
			shipMesh.rotation.y = 0;
			shipMesh.rotation.z = 0;
			shieldMesh.position.copy(shipMesh.position);
			shieldMaterial.opacity = snapshot.shieldAlpha * 0.45;
			shieldMesh.scale.setScalar(1 + snapshot.shieldAlpha * 0.5);

			const intensity = snapshot.currentIntensity;
			currentBg.copy(lowEnergyBg).lerp(highEnergyBg, intensity);
			sceneFog.color.copy(currentBg);
			shipMaterial.emissive.set("#0e7490");
			shipMaterial.emissiveIntensity = 0.08 + intensity * 0.3;
			if (starfieldEnabled) {
				updateStarLayer(
					farStars,
					starTimeSeconds,
					snapshot.ship.y,
					starfieldSpeedScale,
					starfieldShipMovementResponse,
				);
				updateStarLayer(
					nearStars,
					starTimeSeconds,
					snapshot.ship.y,
					starfieldSpeedScale,
					starfieldShipMovementResponse,
				);
				updateStarLayer(
					closeStars,
					starTimeSeconds,
					snapshot.ship.y,
					starfieldSpeedScale,
					starfieldShipMovementResponse,
				);
			}

			if (oceanEnabled) {
				oceanStage.update(starTimeSeconds, snapshot.ship.y);
			}

			if (skyEnabled) {
				skyStage.update(starTimeSeconds, snapshot.ship.y);
			}

			syncWaveformPlaneVisibility();
			if (waveformPlaneEnabled && waveformPlaneHasData) {
				for (const planeState of waveformPlaneStateList) {
					const placementVisible = planeState.planeEnabled;
					const renderable =
						placementVisible &&
						(planeState.surfaceEnabled || planeState.wireframeEnabled);
					if (!renderable) {
						continue;
					}
					planeState.displacementUniforms.uTimeSeconds.value =
						waveformPlaneTimeSeconds;
					planeState.displacementUniforms.uAmplitudeDrive.value =
						planeState.amplitudeDrive;
				}
			}

			updateEnemyRenderer(enemyRenderer, snapshot.enemies, intensity);
			updatePlayerProjectileRenderer(
				playerProjectileRenderer,
				snapshot.projectiles,
			);
			updateEnemyProjectileRenderer(
				enemyProjectileRenderer,
				snapshot.enemyProjectiles,
				snapshot.enemyProjectileStyle,
			);

			if (snapshot.simTimeSeconds < lastMissileTrailSnapshotTime - 1e-6) {
				for (const pulse of purplePulses) {
					clearPurplePulseRenderable(pulse);
				}
				purplePulseIndexByMissileId.clear();
			}
			lastMissileTrailSnapshotTime = snapshot.simTimeSeconds;

			if (snapshot.purpleMissileEnabled) {
				const missileById = new Map<
					number,
					SimulationSnapshot["missiles"][number]
				>();
				for (const missile of snapshot.missiles) {
					missileById.set(missile.id, missile);
				}

				let bindingsThisFrame = 0;
				for (const missile of snapshot.missiles) {
					if (purplePulseIndexByMissileId.has(missile.id)) {
						continue;
					}
					const travelDurationSeconds = computePurplePulseTravelDuration(
						snapshot.simTimeSeconds,
						missile,
					);
					if (missile.ageSeconds >= travelDurationSeconds - 1e-4) {
						continue;
					}
					if (bindingsThisFrame >= PURPLE_PULSE_MAX_NEW_BINDINGS_PER_FRAME) {
						break;
					}

					const freeIndex = purplePulses.findIndex(
						(pulse) => pulse.missileId === null,
					);
					if (freeIndex < 0) {
						break;
					}

					const pulse = purplePulses[freeIndex];
					bindPurplePulseRenderable(pulse, missile);
					purplePulseIndexByMissileId.set(missile.id, freeIndex);
					bindingsThisFrame += 1;
				}

				for (let i = 0; i < purplePulses.length; i += 1) {
					const pulse = purplePulses[i];
					if (pulse.missileId === null) {
						continue;
					}

					const missile = missileById.get(pulse.missileId);
					if (missile) {
						pulse.animationDurationSeconds = computePurplePulseTravelDuration(
							snapshot.simTimeSeconds,
							missile,
						);
						pulse.animationStartTimeSeconds =
							snapshot.simTimeSeconds - missile.ageSeconds;
					}

					pulse.mesh.visible = true;
					const elapsed =
						snapshot.simTimeSeconds - pulse.animationStartTimeSeconds;
					const progress = clamp01(
						elapsed / Math.max(1e-4, pulse.animationDurationSeconds),
					);
					const shapedProgress = Math.pow(
						progress,
						PURPLE_PULSE_TERMINAL_ACCELERATION_POWER,
					);
					setDashOffset(
						pulse.material,
						-lerp(
							PURPLE_PULSE_DASH_START,
							PURPLE_PULSE_DASH_END,
							shapedProgress,
						),
					);
					setDashRatio(pulse.material, PURPLE_PULSE_TRAVEL_DASH_RATIO);
					pulse.material.opacity = 0.92 * (1 - progress * 0.1);

					if (progress >= 1) {
						if (pulse.missileId !== null) {
							purplePulseIndexByMissileId.delete(pulse.missileId);
						}
						clearPurplePulseRenderable(pulse);
					}
				}
			} else {
				for (const pulse of purplePulses) {
					clearPurplePulseRenderable(pulse);
				}
				purplePulseIndexByMissileId.clear();
			}

			updateLaserBeamRenderer(laserBeamRenderer, snapshot.laserBeams);

			syncMeshPool(
				explosionMeshes,
				snapshot.explosions.length,
				explosionGroup,
				() => {
					const mesh = new Mesh(explosionGeometry, explosionMaterial.clone());
					mesh.visible = false;
					return mesh;
				},
			);
			syncMeshPool(
				explosionRingMeshes,
				snapshot.explosions.length,
				explosionGroup,
				() => {
					const mesh = new Mesh(
						explosionRingGeometry,
						explosionRingMaterial.clone(),
					);
					mesh.visible = false;
					return mesh;
				},
			);
			while (explosionParticleBursts.length < snapshot.explosions.length) {
				const burst = createExplosionBurst(explosionParticleBursts.length);
				burst.points.visible = false;
				explosionParticleBursts.push(burst);
				explosionGroup.add(burst.points);
			}
			for (let i = 0; i < explosionMeshes.length; i += 1) {
				const mesh = explosionMeshes[i];
				const ringMesh = explosionRingMeshes[i];
				const burst = explosionParticleBursts[i];
				const explosion = snapshot.explosions[i];
				if (!explosion) {
					mesh.visible = false;
					ringMesh.visible = false;
					burst.points.visible = false;
					continue;
				}

				const normalizedAge = clamp01(1 - explosion.alpha);
				const peakScale = explosion.power;
				const peakNormalized = normalizeExplosionPower(explosion.power);
				const intensityScale = 0.22 + peakScale * 0.88;
				const intensityGlow = 0.62 + peakNormalized * 1.05;
				const palette =
					EXPLOSION_PALETTES[explosion.variant % EXPLOSION_PALETTES.length];

				mesh.visible = true;
				mesh.position.set(explosion.x, explosion.y, explosion.z);
				mesh.scale.setScalar(
					explosion.scale * ARCADE_CORE_SCALE_MULTIPLIER * intensityScale,
				);
				const material = mesh.material as MeshBasicMaterial;
				if (normalizedAge < 0.4) {
					coreColor.lerpColors(
						palette.coreStart,
						palette.coreMid,
						normalizedAge / 0.4,
					);
				} else {
					coreColor.lerpColors(
						palette.coreMid,
						palette.coreEnd,
						(normalizedAge - 0.4) / 0.6,
					);
				}
				material.color.copy(coreColor);
				material.opacity = Math.max(
					0,
					Math.pow(explosion.alpha, 0.55) * intensityGlow,
				);

				ringMesh.visible = true;
				ringMesh.position.set(explosion.x, explosion.y, explosion.z + 0.01);
				ringMesh.scale.setScalar(
					0.5 +
						normalizedAge *
							ARCADE_RING_MAX_SCALE *
							(0.42 + peakNormalized * 0.78),
				);
				const ringMaterial = ringMesh.material as MeshBasicMaterial;
				ringColor.lerpColors(palette.ringStart, palette.ringEnd, normalizedAge);
				ringMaterial.color.copy(ringColor);
				ringMaterial.opacity = Math.max(
					0,
					Math.pow(1 - normalizedAge, 0.8) * (0.6 + peakNormalized * 0.9),
				);

				sparkColor.lerpColors(coreColor, ringColor, 0.4 + normalizedAge * 0.35);

				burst.points.visible = true;
				burst.points.position.set(explosion.x, explosion.y, explosion.z + 0.08);
				updateExplosionBurst(
					burst,
					normalizedAge,
					explosion.alpha,
					peakScale,
					sparkColor,
				);
			}
		},
		render() {
			renderer.render(scene, camera);
		},
		resize,
		setStarfieldEnabled(enabled) {
			starfieldEnabled = enabled;
			syncStarfieldVisibility();
		},
		setStarfieldSpeedScale(speedScale) {
			starfieldSpeedScale = normalizeStarfieldSpeedScale(speedScale);
		},
		setStarfieldShipMovementResponse(responseScale) {
			starfieldShipMovementResponse =
				normalizeStarfieldShipMovementResponse(responseScale);
		},
		setOceanEnabled(enabled) {
			oceanEnabled = enabled;
			syncOceanVisibility();
		},
		setOceanSize(size) {
			oceanStage.setSize(size);
		},
		setOceanDistortionScale(scale) {
			oceanStage.setDistortionScale(scale);
		},
		setOceanAmplitude(amplitude) {
			oceanStage.setAmplitude(amplitude);
		},
		setOceanSpeed(speed) {
			oceanStage.setSpeed(speed);
		},
		setOceanTimeOfDay(tod) {
			oceanStage.setTimeOfDay(tod);
		},
		setSkyEnabled(enabled) {
			skyEnabled = enabled;
			syncSkyVisibility();
		},
		setSkyTurbidity(v) {
			skyStage.setTurbidity(v);
		},
		setSkyRayleigh(v) {
			skyStage.setRayleigh(v);
		},
		setSkyMieCoefficient(v) {
			skyStage.setMieCoefficient(v);
		},
		setSkyMieDirectionalG(v) {
			skyStage.setMieDirectionalG(v);
		},
		setSkyElevation(v) {
			skyStage.setElevation(v);
		},
		setSkyAzimuth(v) {
			skyStage.setAzimuth(v);
		},
		setSkyExposure(v) {
			skyStage.setExposure(v);
		},
		setWaveformPlaneEnabled(enabled) {
			waveformPlaneEnabled = enabled;
			syncWaveformPlaneVisibility();
		},
		setWaveformPlaneSurfaceEnabled(side, enabled) {
			const normalizedSide = normalizeWaveformPlaneSide(side);
			waveformPlaneStates[normalizedSide].surfaceEnabled = enabled;
			syncWaveformPlaneVisibility();
		},
		setWaveformPlaneWireframeEnabled(side, enabled) {
			const normalizedSide = normalizeWaveformPlaneSide(side);
			waveformPlaneStates[normalizedSide].wireframeEnabled = enabled;
			syncWaveformPlaneVisibility();
		},
		setWaveformPlaneSideEnabled(side, enabled) {
			const normalizedSide = normalizeWaveformPlaneSide(side);
			waveformPlaneStates[normalizedSide].planeEnabled = enabled;
			syncWaveformPlaneVisibility();
		},
		setWaveformPlaneHeightScale(side, heightScale) {
			const normalizedSide = normalizeWaveformPlaneSide(side);
			const state = waveformPlaneStates[normalizedSide];
			const nextHeightScale = clamp(
				Number.isFinite(heightScale)
					? heightScale
					: WAVEFORM_PLANE_HEIGHT_SCALE_DEFAULT,
				WAVEFORM_PLANE_HEIGHT_SCALE_MIN,
				WAVEFORM_PLANE_HEIGHT_SCALE_MAX,
			);
			state.displacementUniforms.uHeightScale.value = nextHeightScale;
		},
		setWaveformPlaneSurfaceShading(side, shading) {
			const normalizedSide = normalizeWaveformPlaneSide(side);
			applyWaveformPlaneSurfaceShading(waveformPlaneStates[normalizedSide], shading);
		},
		setWaveformPlaneDistortionAlgorithm(side, algorithm) {
			const normalizedSide = normalizeWaveformPlaneSide(side);
			applyWaveformPlaneDistortionAlgorithm(
				waveformPlaneStates[normalizedSide],
				algorithm,
			);
		},
		setWaveformPlaneSurfaceColor(side, colorHex) {
			const normalizedSide = normalizeWaveformPlaneSide(side);
			applyWaveformPlaneSurfaceColor(waveformPlaneStates[normalizedSide], colorHex);
		},
		setWaveformPlaneWireframeColor(side, colorHex) {
			const normalizedSide = normalizeWaveformPlaneSide(side);
			applyWaveformPlaneWireframeColor(
				waveformPlaneStates[normalizedSide],
				colorHex,
			);
		},
		setWaveformPlaneSurfaceOpacity(side, opacity) {
			const normalizedSide = normalizeWaveformPlaneSide(side);
			applyWaveformPlaneSurfaceOpacity(
				waveformPlaneStates[normalizedSide],
				opacity,
			);
		},
		setWaveformPlaneSpectrumSmoothing(side, smoothingTimeConstant) {
			const normalizedSide = normalizeWaveformPlaneSide(side);
			waveformPlaneStates[normalizedSide].spectrumSmoothingTimeConstant =
				normalizeWaveformPlaneSpectrumSmoothing(smoothingTimeConstant);
		},
		setWaveformPlaneSpectrum(spectrumBins) {
			if (!spectrumBins || spectrumBins.length === 0) {
				for (const planeState of waveformPlaneStateList) {
					resetWaveformPlaneSpectrumState(planeState);
				}
				return;
			}

			for (const planeState of waveformPlaneStateList) {
				updateWaveformPlaneSpectrumForState(planeState, spectrumBins);
			}
		},
		setWaveformPlaneSpectrumTimeline(timeline) {
			void timeline;
			waveformPlaneHasData = true;
			syncWaveformPlaneVisibility();
		},
		setWaveformPlaneData(waveformLeft, waveformRight) {
			void waveformLeft;
			void waveformRight;
			waveformPlaneHasData = true;
			syncWaveformPlaneVisibility();
		},
		clearWaveformPlaneData() {
			waveformPlaneHasData = false;
			syncWaveformPlaneVisibility();
		},
		setWaveformPlaneTime(timeSeconds) {
			waveformPlaneTimeSeconds = Math.max(0, timeSeconds);
		},
	};
}

function syncMeshPool(
	meshes: Mesh[],
	requiredCount: number,
	parent: Group,
	createMesh: () => Mesh,
): void {
	while (meshes.length < requiredCount) {
		const mesh = createMesh();
		meshes.push(mesh);
		parent.add(mesh);
	}
}

function lerp(start: number, end: number, t: number): number {
	return start + (end - start) * t;
}

type ExplosionPalette = {
	coreStart: Color;
	coreMid: Color;
	coreEnd: Color;
	ringStart: Color;
	ringEnd: Color;
};

const ARCADE_CORE_SCALE_MULTIPLIER = 2.35;
const ARCADE_RING_MAX_SCALE = 7.2;
const WAVEFORM_PLANE_SPECTRUM_BIN_COUNT = 192;
const WAVEFORM_PLANE_TIMELINE_SAMPLES = 4096;
const WAVEFORM_PLANE_TEXTURE_BINS = 64;
const WAVEFORM_PLANE_WIDTH = 120;
const WAVEFORM_PLANE_HEIGHT = 90;
const WAVEFORM_PLANE_SEGMENTS_X = 56;
const WAVEFORM_PLANE_SEGMENTS_Y = 42;
const WAVEFORM_PLANE_Z = -28;
const WAVEFORM_PLANE_BOTTOM_Y = -15.8;
const WAVEFORM_PLANE_TOP_Y = 15.8;
const WAVEFORM_PLANE_BOTTOM_ROTATION_X = -1.21;
const WAVEFORM_PLANE_TOP_ROTATION_X = 1.21;
const WAVEFORM_PLANE_HEIGHT_SCALE_DEFAULT = 6.8;
const WAVEFORM_PLANE_HEIGHT_SCALE_MIN = 2.5;
const WAVEFORM_PLANE_HEIGHT_SCALE_MAX = 12;
const WAVEFORM_PLANE_SPECTRUM_SMOOTHING_DEFAULT = 0.5;
const WAVEFORM_PLANE_SPECTRUM_SMOOTHING_MIN = 0;
const WAVEFORM_PLANE_SPECTRUM_SMOOTHING_MAX = 0.95;
const WAVEFORM_PLANE_SURFACE_SHADING_DEFAULT: WaveformPlaneSurfaceShading =
	"smooth";
const WAVEFORM_PLANE_SURFACE_ENABLED_DEFAULT = false;
const WAVEFORM_PLANE_WIREFRAME_ENABLED_DEFAULT = true;
const WAVEFORM_PLANE_DEFAULT_SURFACE_COLOR_HEX = "#f4f4f4";
const WAVEFORM_PLANE_DEFAULT_WIREFRAME_COLOR_HEX = "#f4f4f4";
const WAVEFORM_PLANE_SURFACE_OPACITY_DEFAULT = 1;
const WAVEFORM_PLANE_SURFACE_OPACITY_MIN = 0;
const WAVEFORM_PLANE_SURFACE_OPACITY_MAX = 1;
const WAVEFORM_PLANE_SURFACE_EMISSIVE_COLOR_SCALE = 0.085;
const WAVEFORM_PLANE_WIREFRAME_EMISSIVE_COLOR_SCALE = 0.085;
const WAVEFORM_SCENE_FOG_NEAR = 52;
const WAVEFORM_SCENE_FOG_FAR = 92;
const WAVEFORM_PLANE_TIME_WINDOW_SECONDS = 2.4;
const EXPLOSION_PALETTES: ExplosionPalette[] = [
	{
		coreStart: new Color("#f472b6"),
		coreMid: new Color("#60a5fa"),
		coreEnd: new Color("#38bdf8"),
		ringStart: new Color("#f0abfc"),
		ringEnd: new Color("#a78bfa"),
	},
	{
		coreStart: new Color("#ef4444"),
		coreMid: new Color("#f97316"),
		coreEnd: new Color("#facc15"),
		ringStart: new Color("#fb7185"),
		ringEnd: new Color("#fb923c"),
	},
	{
		coreStart: new Color("#22d3ee"),
		coreMid: new Color("#38bdf8"),
		coreEnd: new Color("#a3e635"),
		ringStart: new Color("#67e8f9"),
		ringEnd: new Color("#84cc16"),
	},
	{
		coreStart: new Color("#fca5a5"),
		coreMid: new Color("#f9a8d4"),
		coreEnd: new Color("#c084fc"),
		ringStart: new Color("#fda4af"),
		ringEnd: new Color("#e879f9"),
	},
	{
		coreStart: new Color("#4ade80"),
		coreMid: new Color("#22d3ee"),
		coreEnd: new Color("#60a5fa"),
		ringStart: new Color("#86efac"),
		ringEnd: new Color("#06b6d4"),
	},
	{
		coreStart: new Color("#fde047"),
		coreMid: new Color("#fb923c"),
		coreEnd: new Color("#f43f5e"),
		ringStart: new Color("#fef08a"),
		ringEnd: new Color("#f97316"),
	},
];

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function clamp01Signed(value: number, maxAbs: number): number {
	return Math.max(-maxAbs, Math.min(maxAbs, value));
}
