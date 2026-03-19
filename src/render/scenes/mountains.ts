import {
	BufferAttribute,
	BufferGeometry,
	Color,
	Group,
	PerspectiveCamera,
	Points,
	ShaderMaterial,
	Vector3,
} from "three";
import type { SceneInstance } from "./types";

const MOUNTAIN_CHUNK_COUNT = 7;
const MOUNTAIN_COLUMNS = 68;
const MOUNTAIN_ROWS = 84;
const MOUNTAIN_CELL_X = 1.18;
const MOUNTAIN_CELL_Z = 1.28;
const MOUNTAIN_FRONT_Z = 44;
const MOUNTAIN_BASE_Y = -4.8;
const MOUNTAIN_MAX_HEIGHT_DEFAULT = 17.5;
const MOUNTAIN_MAX_HEIGHT_MIN = 0;
const MOUNTAIN_MAX_HEIGHT_MAX = 30;
const MOUNTAIN_GROUP_X = 16;
const MOUNTAIN_GROUP_Y = -6.4;
const MOUNTAIN_GROUP_Z = -42;
const MOUNTAIN_DOT_RADIUS = 0.2;
const MOUNTAIN_POINT_SIZE_BASE = 150;
const MOUNTAIN_SCROLL_SPEED_DEFAULT = 6.2;
const MOUNTAIN_SCROLL_SPEED_MIN = 0;
const MOUNTAIN_SCROLL_SPEED_MAX = 24;
const MOUNTAIN_COLOR_DEFAULT = "#f2f2f2";
const MOUNTAIN_OPACITY_DEFAULT = 1;
const MOUNTAIN_OPACITY_MIN = 0;
const MOUNTAIN_OPACITY_MAX = 1;
const MOUNTAIN_CAMERA_FOV = 41;
const MOUNTAIN_CAMERA_POSITION = new Vector3(16, -2.1, 16.8);
const MOUNTAIN_CAMERA_TARGET = new Vector3(16, -5.3, -31);
const MOUNTAIN_VERTEX_SHADER = `
	attribute float scale;
	uniform float pointSizeBase;

	void main() {
		vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
		gl_PointSize = scale * (pointSizeBase / -mvPosition.z);
		gl_Position = projectionMatrix * mvPosition;
	}
`;
const MOUNTAIN_FRAGMENT_SHADER = `
	uniform vec3 color;
	uniform float opacity;

	void main() {
		if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.475) discard;
		gl_FragColor = vec4(color, opacity);
	}
`;

type MountainChunkState = {
	group: Group;
	points: Points;
	positions: Float32Array;
	scales: Float32Array;
	worldChunkIndex: number | null;
	terrainVersion: number | null;
};

type MountainsSceneState = {
	chunks: MountainChunkState[];
	chunkWidth: number;
	speed: number;
	maxHeight: number;
	colorHex: string;
	opacity: number;
	terrainVersion: number;
	scrollOffset: number;
	lastSimTimeSeconds: number | null;
	material: ShaderMaterial;
};

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, t: number): number {
	return start + (end - start) * t;
}

function smoothstep(t: number): number {
	return t * t * (3 - 2 * t);
}

function hash2(x: number, y: number): number {
	const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
	return s - Math.floor(s);
}

function valueNoise2(x: number, y: number): number {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const x1 = x0 + 1;
	const y1 = y0 + 1;
	const tx = smoothstep(x - x0);
	const ty = smoothstep(y - y0);
	const a = hash2(x0, y0);
	const b = hash2(x1, y0);
	const c = hash2(x0, y1);
	const d = hash2(x1, y1);
	return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function fbm(x: number, y: number): number {
	let amplitude = 0.5;
	let frequency = 0.85;
	let total = 0;
	let sum = 0;
	for (let octave = 0; octave < 5; octave += 1) {
		total += valueNoise2(x * frequency, y * frequency) * amplitude;
		sum += amplitude;
		amplitude *= 0.52;
		frequency *= 2.02;
	}
	return sum > 0 ? total / sum : 0;
}

function normalizeSpeed(value: unknown): number {
	if (!Number.isFinite(value as number)) {
		return MOUNTAIN_SCROLL_SPEED_DEFAULT;
	}
	return clamp(
		value as number,
		MOUNTAIN_SCROLL_SPEED_MIN,
		MOUNTAIN_SCROLL_SPEED_MAX,
	);
}

function normalizeMaxHeight(value: unknown): number {
	if (!Number.isFinite(value as number)) {
		return MOUNTAIN_MAX_HEIGHT_DEFAULT;
	}
	return clamp(
		value as number,
		MOUNTAIN_MAX_HEIGHT_MIN,
		MOUNTAIN_MAX_HEIGHT_MAX,
	);
}

function normalizeColor(value: unknown): string {
	return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
		? value
		: MOUNTAIN_COLOR_DEFAULT;
}

function normalizeOpacity(value: unknown): number {
	if (!Number.isFinite(value as number)) {
		return MOUNTAIN_OPACITY_DEFAULT;
	}
	return clamp(
		value as number,
		MOUNTAIN_OPACITY_MIN,
		MOUNTAIN_OPACITY_MAX,
	);
}

function computeMountainHeight(worldX: number, depthRatio: number, maxHeight: number): number {
	const broad = fbm(worldX * 0.08 + 3.1, depthRatio * 3.4 + 1.2);
	const detail = fbm(worldX * 0.16 + 7.4, depthRatio * 7.8 + 2.6);
	const ridge = 1 - Math.abs(detail * 2 - 1);
	const depth = clamp(depthRatio, 0, 1);
	const depthBlend = Math.pow(smoothstep(Math.pow(depth, 0.72)), 1.28);
	const horizonLift = lerp(0.08, 1, depthBlend);
	const shaped = Math.pow(clamp(broad * 0.72 + ridge * 0.28, 0, 1), 1.58);
	return shaped * horizonLift * maxHeight;
}

function syncMaterialState(state: MountainsSceneState): void {
	(state.material.uniforms.color.value as Color).set(state.colorHex);
	state.material.uniforms.opacity.value = state.opacity;
	state.material.depthWrite = state.opacity >= 0.99;
	state.material.needsUpdate = true;
}

function createChunk(material: ShaderMaterial): MountainChunkState {
	const group = new Group();
	const positions = new Float32Array(MOUNTAIN_COLUMNS * MOUNTAIN_ROWS * 3);
	const scales = new Float32Array(MOUNTAIN_COLUMNS * MOUNTAIN_ROWS);
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(positions, 3));
	geometry.setAttribute("scale", new BufferAttribute(scales, 1));
	const points = new Points(geometry, material);
	points.frustumCulled = false;
	group.add(points);
	return {
		group,
		points,
		positions,
		scales,
		worldChunkIndex: null,
		terrainVersion: null,
	};
}

function rebuildChunk(
	state: MountainsSceneState,
	chunk: MountainChunkState,
	worldChunkIndex: number,
): void {
	if (
		chunk.worldChunkIndex === worldChunkIndex
		&& chunk.terrainVersion === state.terrainVersion
	) {
		return;
	}

	let instanceIndex = 0;
	for (let row = 0; row < MOUNTAIN_ROWS; row += 1) {
		const depthRatio = MOUNTAIN_ROWS <= 1 ? 0 : row / (MOUNTAIN_ROWS - 1);
		for (let column = 0; column < MOUNTAIN_COLUMNS; column += 1) {
			const localX = -state.chunkWidth * 0.5 + (column + 0.5) * MOUNTAIN_CELL_X;
			const worldX = worldChunkIndex * state.chunkWidth + localX;
			const z = MOUNTAIN_FRONT_Z - row * MOUNTAIN_CELL_Z;
			const height = computeMountainHeight(worldX, depthRatio, state.maxHeight);
			const y = MOUNTAIN_BASE_Y + height + MOUNTAIN_DOT_RADIUS;
			const scale = 0.7 + Math.pow(depthRatio, 1.2) * 0.9;
			const positionIndex = instanceIndex * 3;
			chunk.positions[positionIndex] = localX;
			chunk.positions[positionIndex + 1] = y;
			chunk.positions[positionIndex + 2] = z;
			chunk.scales[instanceIndex] = scale;
			instanceIndex += 1;
		}
	}

	chunk.points.geometry.attributes.position.needsUpdate = true;
	chunk.points.geometry.attributes.scale.needsUpdate = true;
	chunk.points.geometry.computeBoundingSphere();
	chunk.worldChunkIndex = worldChunkIndex;
	chunk.terrainVersion = state.terrainVersion;
}

function updateMountains(state: MountainsSceneState, simTimeSeconds: number): void {
	if (state.lastSimTimeSeconds === null || simTimeSeconds < state.lastSimTimeSeconds) {
		state.lastSimTimeSeconds = simTimeSeconds;
	}
	const deltaSeconds = Math.max(0, simTimeSeconds - state.lastSimTimeSeconds);
	state.lastSimTimeSeconds = simTimeSeconds;
	state.scrollOffset += deltaSeconds * state.speed;

	const distance = state.scrollOffset;
	const baseChunkIndex = Math.floor(distance / state.chunkWidth);
	const centerSlot = Math.floor(MOUNTAIN_CHUNK_COUNT / 2);

	for (let slot = 0; slot < state.chunks.length; slot += 1) {
		const worldChunkIndex = baseChunkIndex + slot - centerSlot;
		const chunk = state.chunks[slot];
		rebuildChunk(state, chunk, worldChunkIndex);
		chunk.group.position.x = worldChunkIndex * state.chunkWidth - distance;
	}
}

export function createMountainsScene(id: string): SceneInstance {
	const group = new Group();
	group.position.set(MOUNTAIN_GROUP_X, MOUNTAIN_GROUP_Y, MOUNTAIN_GROUP_Z);

	const perspectiveCamera = new PerspectiveCamera(
		MOUNTAIN_CAMERA_FOV,
		1920 / 1080,
		0.1,
		260,
	);
	perspectiveCamera.position.copy(MOUNTAIN_CAMERA_POSITION);
	perspectiveCamera.lookAt(MOUNTAIN_CAMERA_TARGET);

	const material = new ShaderMaterial({
		uniforms: {
			color: { value: new Color(MOUNTAIN_COLOR_DEFAULT) },
			opacity: { value: MOUNTAIN_OPACITY_DEFAULT },
			pointSizeBase: { value: MOUNTAIN_POINT_SIZE_BASE },
		},
		vertexShader: MOUNTAIN_VERTEX_SHADER,
		fragmentShader: MOUNTAIN_FRAGMENT_SHADER,
		transparent: true,
		depthWrite: true,
	});

	const state: MountainsSceneState = {
		chunks: [],
		chunkWidth: MOUNTAIN_COLUMNS * MOUNTAIN_CELL_X,
		speed: MOUNTAIN_SCROLL_SPEED_DEFAULT,
		maxHeight: MOUNTAIN_MAX_HEIGHT_DEFAULT,
		colorHex: MOUNTAIN_COLOR_DEFAULT,
		opacity: MOUNTAIN_OPACITY_DEFAULT,
		terrainVersion: 0,
		scrollOffset: 0,
		lastSimTimeSeconds: null,
		material,
	};
	syncMaterialState(state);

	for (let i = 0; i < MOUNTAIN_CHUNK_COUNT; i += 1) {
		const chunk = createChunk(material);
		state.chunks.push(chunk);
		group.add(chunk.group);
	}

	updateMountains(state, 0);

	return {
		id,
		kind: "mountains",
		renderLayer: "perspective",
		perspectiveCamera,
		group,
		update(simTimeSeconds) {
			updateMountains(state, simTimeSeconds);
		},
		set(key, value) {
			switch (key) {
				case "speed":
					state.speed = normalizeSpeed(value);
					return true;
				case "maxHeight": {
					const nextMaxHeight = normalizeMaxHeight(value);
					if (nextMaxHeight !== state.maxHeight) {
						state.maxHeight = nextMaxHeight;
						state.terrainVersion += 1;
					}
					return true;
				}
				case "color":
					state.colorHex = normalizeColor(value);
					syncMaterialState(state);
					return true;
				case "opacity":
					state.opacity = normalizeOpacity(value);
					syncMaterialState(state);
					return true;
				default:
					return false;
			}
		},
		getSettings() {
			return {
				speed: state.speed,
				maxHeight: state.maxHeight,
				color: state.colorHex,
				opacity: state.opacity,
			};
		},
		dispose() {
			for (const chunk of state.chunks) {
				chunk.points.geometry.dispose();
			}
			material.dispose();
		},
	};
}
