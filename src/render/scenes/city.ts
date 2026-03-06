import {
	BoxGeometry,
	Color,
	Group,
	InstancedMesh,
	Mesh,
	MeshStandardMaterial,
	Object3D,
} from "three";
import type { SceneInstance } from "./types";

const CITY_COLUMNS = 56;
const CITY_ROWS = 38;
const CITY_CHUNK_COUNT = 6;
const CITY_CELL_X = 3;
const CITY_CELL_Z = 3.4;
const CITY_BASE_Y = 0;
const CITY_Z_START = 28;
const CITY_MIN_HEIGHT = 1.2;
const CITY_MAX_HEIGHT = 22;
const CITY_CHUNK_WIDTH = CITY_COLUMNS * CITY_CELL_X;
const CITY_DEPTH = CITY_ROWS * CITY_CELL_Z + 28;
const CITY_GROUND_Y = CITY_BASE_Y - 0.35;
const CITY_GROUND_Z =
	CITY_Z_START - ((CITY_ROWS - 1) * CITY_CELL_Z) * 0.5;
const CITY_SCROLL_SPEED = 15;
const CITY_SPEED_SCALE_DEFAULT = 1;
const CITY_SPEED_SCALE_MIN = 0;
const CITY_SPEED_SCALE_MAX = 3;
const CITY_SHIP_MOVEMENT_RESPONSE_DEFAULT = 0.12;
const CITY_SHIP_MOVEMENT_RESPONSE_MIN = 0;
const CITY_SHIP_MOVEMENT_RESPONSE_MAX = 1;

function hash2(x: number, y: number): number {
	const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
	return s - Math.floor(s);
}

function lerp(start: number, end: number, t: number): number {
	return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function normalizeSpeedScale(value: number): number {
	if (!Number.isFinite(value)) return CITY_SPEED_SCALE_DEFAULT;
	return clamp(value, CITY_SPEED_SCALE_MIN, CITY_SPEED_SCALE_MAX);
}

function normalizeShipMovementResponse(value: number): number {
	if (!Number.isFinite(value)) return CITY_SHIP_MOVEMENT_RESPONSE_DEFAULT;
	return clamp(
		value,
		CITY_SHIP_MOVEMENT_RESPONSE_MIN,
		CITY_SHIP_MOVEMENT_RESPONSE_MAX,
	);
}

function createCityChunk(
	seedOffset: number,
	geometry: BoxGeometry,
	material: MeshStandardMaterial,
): InstancedMesh {
	const count = CITY_COLUMNS * CITY_ROWS;
	const mesh = new InstancedMesh(geometry, material, count);
	const dummy = new Object3D();
	const color = new Color();
	let instanceIndex = 0;

	for (let row = 0; row < CITY_ROWS; row += 1) {
		for (let column = 0; column < CITY_COLUMNS; column += 1) {
			const nx = column + seedOffset * 71.13;
			const nz = row + seedOffset * 19.37;
			const baseNoise = hash2(nx, nz);
			const widthNoise = hash2(nx * 1.71 + 2.3, nz * 0.49 + 8.4);
			const depthNoise = hash2(nx * 0.44 + 4.9, nz * 1.93 + 0.7);
			const height = lerp(
				CITY_MIN_HEIGHT,
				CITY_MAX_HEIGHT,
				Math.pow(baseNoise, 1.45),
			);
			const width = 0.85 + widthNoise * 1.25;
			const depth = 0.85 + depthNoise * 1.45;

			const x =
				column * CITY_CELL_X + CITY_CELL_X * 0.5 - CITY_CHUNK_WIDTH * 0.5;
			const z = CITY_Z_START - row * CITY_CELL_Z;

			dummy.position.set(x, CITY_BASE_Y, z);
			dummy.scale.set(width, height, depth);
			dummy.updateMatrix();
			mesh.setMatrixAt(instanceIndex, dummy.matrix);

			const heightAlpha = (height - CITY_MIN_HEIGHT) / (CITY_MAX_HEIGHT - CITY_MIN_HEIGHT);
			color.setHSL(
				0.58 + 0.03 * widthNoise,
				0.18 + (1 - heightAlpha) * 0.2,
				0.11 + heightAlpha * 0.42,
			);
			mesh.setColorAt(instanceIndex, color);
			instanceIndex += 1;
		}
	}

	mesh.instanceMatrix.needsUpdate = true;
	if (mesh.instanceColor) {
		mesh.instanceColor.needsUpdate = true;
	}
	mesh.frustumCulled = false;
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

function createCityChunkGroup(
	seedOffset: number,
	buildingGeometry: BoxGeometry,
	buildingMaterial: MeshStandardMaterial,
	groundGeometry: BoxGeometry,
	groundMaterial: MeshStandardMaterial,
): Group {
	const chunkGroup = new Group();
	const buildings = createCityChunk(seedOffset, buildingGeometry, buildingMaterial);
	const ground = new Mesh(groundGeometry, groundMaterial);
	ground.position.set(0, CITY_GROUND_Y, CITY_GROUND_Z);
	ground.receiveShadow = true;
	chunkGroup.add(buildings);
	chunkGroup.add(ground);
	return chunkGroup;
}

function positiveModulo(value: number, divisor: number): number {
	const remainder = value % divisor;
	return remainder < 0 ? remainder + divisor : remainder;
}

export function createCityScene(id: string): SceneInstance {
	const group = new Group();

	const buildingGeometry = new BoxGeometry(1, 1, 1);
	buildingGeometry.translate(0, 0.5, 0);
	const buildingMaterial = new MeshStandardMaterial({
		color: "#7f86b7",
		roughness: 1,
		metalness: 0,
		emissive: "#000000",
		emissiveIntensity: 0,
		vertexColors: true,
	});
	const groundGeometry = new BoxGeometry(
		CITY_CHUNK_WIDTH + CITY_CELL_X * 2,
		0.8,
		CITY_DEPTH,
	);
	const groundMaterial = new MeshStandardMaterial({
		color: "#cfcfd4",
		roughness: 1,
		metalness: 0,
		emissive: "#000000",
		emissiveIntensity: 0,
	});
	const chunks: Group[] = [];
	for (let i = 0; i < CITY_CHUNK_COUNT; i += 1) {
		const chunk = createCityChunkGroup(
			i,
			buildingGeometry,
			buildingMaterial,
			groundGeometry,
			groundMaterial,
		);
		chunks.push(chunk);
		group.add(chunk);
	}

	let speedScale = CITY_SPEED_SCALE_DEFAULT;
	let shipMovementResponse = CITY_SHIP_MOVEMENT_RESPONSE_DEFAULT;

	return {
		id,
		kind: "city",
		renderLayer: "perspective",
		group,
		update(simTimeSeconds, shipY) {
			const distance = simTimeSeconds * CITY_SCROLL_SPEED * speedScale;
			const baseChunkIndex = Math.floor(distance / CITY_CHUNK_WIDTH);
			const centerSlot = Math.floor(CITY_CHUNK_COUNT / 2);
			for (let slot = 0; slot < CITY_CHUNK_COUNT; slot += 1) {
				const worldChunkIndex = baseChunkIndex + slot - centerSlot;
				const chunkIndex = positiveModulo(worldChunkIndex, CITY_CHUNK_COUNT);
				const chunk = chunks[chunkIndex];
				chunk.position.x = worldChunkIndex * CITY_CHUNK_WIDTH - distance;
			}
			group.position.z = shipY * shipMovementResponse;
		},
		set(key, value) {
			switch (key) {
				case "speedScale":
					speedScale = normalizeSpeedScale(value as number);
					return true;
				case "shipMovementResponse":
					shipMovementResponse = normalizeShipMovementResponse(value as number);
					return true;
				default:
					return false;
			}
		},
		getSettings() {
			return { speedScale, shipMovementResponse };
		},
		dispose() {
			buildingGeometry.dispose();
			buildingMaterial.dispose();
			groundGeometry.dispose();
			groundMaterial.dispose();
		},
	};
}
