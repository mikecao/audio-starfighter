import {
	Color,
	Group,
	InstancedMesh,
	MeshStandardMaterial,
	Object3D,
	PerspectiveCamera,
	SphereGeometry,
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
const MOUNTAIN_SCROLL_SPEED_DEFAULT = 6.2;
const MOUNTAIN_SCROLL_SPEED_MIN = 0;
const MOUNTAIN_SCROLL_SPEED_MAX = 24;
const MOUNTAIN_CAMERA_FOV = 41;
const MOUNTAIN_CAMERA_POSITION = new Vector3(16, -2.1, 16.8);
const MOUNTAIN_CAMERA_TARGET = new Vector3(16, -5.3, -31);

type MountainChunkState = {
	group: Group;
	mesh: InstancedMesh;
	worldChunkIndex: number | null;
	terrainVersion: number | null;
};

type MountainsSceneState = {
	chunks: MountainChunkState[];
	dummy: Object3D;
	color: Color;
	chunkWidth: number;
	speed: number;
	maxHeight: number;
	terrainVersion: number;
	scrollOffset: number;
	lastSimTimeSeconds: number | null;
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

function computeMountainHeight(worldX: number, depthRatio: number, maxHeight: number): number {
	const broad = fbm(worldX * 0.08 + 3.1, depthRatio * 3.4 + 1.2);
	const detail = fbm(worldX * 0.16 + 7.4, depthRatio * 7.8 + 2.6);
	const ridge = 1 - Math.abs(detail * 2 - 1);
	const depth = clamp(depthRatio, 0, 1);
	const horizonLift = Math.pow(smoothstep(Math.pow(depth, 1.18)), 2.35);
	const shaped = Math.pow(clamp(broad * 0.72 + ridge * 0.28, 0, 1), 1.58);
	return shaped * horizonLift * maxHeight;
}

function createChunk(geometry: SphereGeometry, material: MeshStandardMaterial): MountainChunkState {
	const group = new Group();
	const mesh = new InstancedMesh(geometry, material, MOUNTAIN_COLUMNS * MOUNTAIN_ROWS);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	mesh.frustumCulled = false;
	group.add(mesh);
	return {
		group,
		mesh,
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
			const scale = 0.76 + Math.pow(depthRatio, 1.35) * 0.3;
			const y = MOUNTAIN_BASE_Y + height + MOUNTAIN_DOT_RADIUS * scale;

			state.dummy.position.set(localX, y, z);
			state.dummy.scale.setScalar(scale);
			state.dummy.updateMatrix();
			chunk.mesh.setMatrixAt(instanceIndex, state.dummy.matrix);

			const heightAlpha = state.maxHeight <= 0
				? 0
				: clamp(height / state.maxHeight, 0, 1);
			state.color.setHSL(0, 0, 0.36 + heightAlpha * 0.52);
			chunk.mesh.setColorAt(instanceIndex, state.color);
			instanceIndex += 1;
		}
	}

	chunk.mesh.instanceMatrix.needsUpdate = true;
	if (chunk.mesh.instanceColor) {
		chunk.mesh.instanceColor.needsUpdate = true;
	}
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

	const geometry = new SphereGeometry(MOUNTAIN_DOT_RADIUS, 10, 8);
	const material = new MeshStandardMaterial({
		color: "#f2f2f2",
		roughness: 1,
		metalness: 0,
		emissive: "#050505",
		emissiveIntensity: 0.05,
	});

	const state: MountainsSceneState = {
		chunks: [],
		dummy: new Object3D(),
		color: new Color(),
		chunkWidth: MOUNTAIN_COLUMNS * MOUNTAIN_CELL_X,
		speed: MOUNTAIN_SCROLL_SPEED_DEFAULT,
		maxHeight: MOUNTAIN_MAX_HEIGHT_DEFAULT,
		terrainVersion: 0,
		scrollOffset: 0,
		lastSimTimeSeconds: null,
	};

	for (let i = 0; i < MOUNTAIN_CHUNK_COUNT; i += 1) {
		const chunk = createChunk(geometry, material);
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
				default:
					return false;
			}
		},
		getSettings() {
			return {
				speed: state.speed,
				maxHeight: state.maxHeight,
			};
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}
