import {
	BufferAttribute,
	BufferGeometry,
	BoxGeometry,
	Color,
	Group,
	InstancedMesh,
	LineBasicMaterial,
	LineSegments,
	MeshStandardMaterial,
	Object3D,
	Vector3,
} from "three";
import type { SceneInstance, SpectrumReactiveSceneExtensions } from "./types";

const PERSPECTIVE_FOV_DEGREES = 46;
const PERSPECTIVE_ASPECT = 1920 / 1080;
const PERSPECTIVE_CAMERA_POSITION = new Vector3(16, 42, 52);
const CUBES_PLANE_TARGET = new Vector3(16, 4, -28);
const CUBES_COLUMNS_DEFAULT = 24;
const CUBES_ROWS_DEFAULT = 14;
const CUBES_COLUMNS_MIN = 6;
const CUBES_COLUMNS_MAX = 64;
const CUBES_ROWS_MIN = 4;
const CUBES_ROWS_MAX = 36;
const CUBES_REACTIVITY_DEFAULT = 1;
const CUBES_REACTIVITY_MIN = 0;
const CUBES_REACTIVITY_MAX = 3;
const CUBES_SURFACE_COLOR_DEFAULT = "#7dd3fc";
const CUBES_OUTLINE_COLOR_DEFAULT = "#e0f2fe";
const CUBES_CELL_OVERLAP = 1.02;
const CUBES_BASE_DEPTH_RATIO = 0.1;
const CUBES_MAX_DEPTH_RATIO = 1.85;
const CUBES_MOTION_SPEED = 0.08;
const CUBE_EDGE_INDEX_PAIRS = [
	[0, 1], [1, 2], [2, 3], [3, 0],
	[4, 5], [5, 6], [6, 7], [7, 4],
	[0, 4], [1, 5], [2, 6], [3, 7],
] as const;
const CUBE_EDGE_CORNERS = [
	[-0.5, -0.5, 0],
	[0.5, -0.5, 0],
	[0.5, 0.5, 0],
	[-0.5, 0.5, 0],
	[-0.5, -0.5, 1],
	[0.5, -0.5, 1],
	[0.5, 0.5, 1],
	[-0.5, 0.5, 1],
] as const;

type CubesMotionMode = "static" | "flow";
const CUBES_MOTION_MODE_DEFAULT: CubesMotionMode = "static";

type CubesSceneState = {
	columns: number;
	rows: number;
	reactivityStrength: number;
	surfaceColorHex: string;
	outlineColorHex: string;
	motionMode: CubesMotionMode;
	timeSeconds: number;
	spectrumBins: Float32Array | null;
	instancedMesh: InstancedMesh | null;
	outlineLines: LineSegments | null;
	solidMaterial: MeshStandardMaterial;
	outlineMaterial: LineBasicMaterial;
};

function getPlaneMetrics(): { width: number; height: number } {
	const planeDistance = PERSPECTIVE_CAMERA_POSITION.distanceTo(CUBES_PLANE_TARGET);
	const planeHeight =
		2 * Math.tan((PERSPECTIVE_FOV_DEGREES * Math.PI) / 360) * planeDistance;
	const planeWidth = planeHeight * PERSPECTIVE_ASPECT;
	return { width: planeWidth, height: planeHeight };
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function normalizeCount(value: unknown, fallback: number, min: number, max: number): number {
	if (!Number.isFinite(value as number)) {
		return fallback;
	}
	return clamp(Math.round(value as number), min, max);
}

function normalizeReactivity(value: unknown): number {
	if (!Number.isFinite(value as number)) {
		return CUBES_REACTIVITY_DEFAULT;
	}
	return clamp(
		value as number,
		CUBES_REACTIVITY_MIN,
		CUBES_REACTIVITY_MAX,
	);
}

function normalizeColor(value: unknown): string {
	return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
		? value
		: CUBES_SURFACE_COLOR_DEFAULT;
}

function normalizeMotionMode(value: unknown): CubesMotionMode {
	return value === "flow" ? "flow" : CUBES_MOTION_MODE_DEFAULT;
}

function sampleSpectrumBinLinear(
	bins: Float32Array,
	index: number,
	count: number,
): number {
	if (bins.length === 0 || count <= 1) {
		return bins[0] ?? 0;
	}
	const position = (index / (count - 1)) * Math.max(0, bins.length - 1);
	const lower = Math.floor(position);
	const upper = Math.min(bins.length - 1, lower + 1);
	const t = position - lower;
	const start = bins[lower] ?? 0;
	const end = bins[upper] ?? start;
	return start + (end - start) * t;
}

function getSpectrumAmplitude(
	state: CubesSceneState,
	row: number,
	column: number,
): number {
	const bins = state.spectrumBins;
	if (!bins || bins.length === 0) {
		return 0;
	}

	const totalCells = Math.max(2, state.rows * state.columns);
	if (state.motionMode === "static") {
		return sampleSpectrumBinLinear(
			bins,
			row * state.columns + column,
			totalCells,
		);
	}

	const u = state.columns <= 1 ? 0 : column / (state.columns - 1);
	const v = state.rows <= 1 ? 0 : row / (state.rows - 1);
	const mapped = u * 0.72 + v * 0.28;
	const wrapped = (mapped + state.timeSeconds * CUBES_MOTION_SPEED) % 1;
	return sampleSpectrumBinLinear(
		bins,
		wrapped * (totalCells - 1),
		totalCells,
	);
}

function rebuildMesh(
	group: Group,
	geometry: BoxGeometry,
	state: CubesSceneState,
): void {
	if (state.instancedMesh) {
		group.remove(state.instancedMesh);
		state.instancedMesh.dispose();
		state.instancedMesh = null;
	}

	const count = state.columns * state.rows;
	const mesh = new InstancedMesh(geometry, state.solidMaterial, count);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	mesh.frustumCulled = false;
	state.instancedMesh = mesh;
	group.add(mesh);

	if (state.outlineLines) {
		group.remove(state.outlineLines);
		state.outlineLines.geometry.dispose();
		state.outlineLines = null;
	}

	const edgeVertexCount = state.columns * state.rows * CUBE_EDGE_INDEX_PAIRS.length * 2;
	const outlineGeometry = new BufferGeometry();
	outlineGeometry.setAttribute(
		"position",
		new BufferAttribute(new Float32Array(edgeVertexCount * 3), 3),
	);
	const outlineLines = new LineSegments(outlineGeometry, state.outlineMaterial);
	outlineLines.frustumCulled = false;
	state.outlineLines = outlineLines;
	group.add(outlineLines);
}

function syncMaterialState(state: CubesSceneState): void {
	const surfaceColor = new Color(state.surfaceColorHex);
	const outlineColor = new Color(state.outlineColorHex);
	state.solidMaterial.color.copy(surfaceColor);
	state.solidMaterial.emissive.copy(surfaceColor).multiplyScalar(0.05);
	state.outlineMaterial.color.copy(outlineColor);
	if (state.instancedMesh) {
		state.instancedMesh.material = state.solidMaterial;
		state.instancedMesh.visible = true;
		state.instancedMesh.castShadow = true;
		state.instancedMesh.receiveShadow = true;
	}
	if (state.outlineLines) {
		state.outlineLines.visible = true;
	}
}

function updateMeshTransforms(
	group: Group,
	geometry: BoxGeometry,
	state: CubesSceneState,
): void {
	if (!state.instancedMesh) {
		rebuildMesh(group, geometry, state);
	}
	const mesh = state.instancedMesh;
	if (!mesh) {
		return;
	}
	const outlineLines = state.outlineLines;
	if (!outlineLines) {
		return;
	}

	const { width: planeWidth, height: planeHeight } = getPlaneMetrics();
	const cellWidth = planeWidth / state.columns;
	const cellHeight = planeHeight / state.rows;
	const cellDepth = Math.min(cellWidth, cellHeight);
	const baseDepth = cellDepth * CUBES_BASE_DEPTH_RATIO;
	const maxDepth = cellDepth * CUBES_MAX_DEPTH_RATIO;
	const dummy = new Object3D();
	const outlinePositions = outlineLines.geometry.getAttribute("position");
	let outlineWriteIndex = 0;
	let instanceIndex = 0;
	for (let row = 0; row < state.rows; row += 1) {
		for (let column = 0; column < state.columns; column += 1) {
			const amplitude = getSpectrumAmplitude(state, row, column);
			const shapedAmplitude = Math.pow(clamp(amplitude, 0, 1), 0.8);
			const depth =
				baseDepth +
				shapedAmplitude * state.reactivityStrength * maxDepth;
			const x = -planeWidth * 0.5 + cellWidth * (column + 0.5);
			const y = planeHeight * 0.5 - cellHeight * (row + 0.5);
			const halfWidth = (cellWidth * CUBES_CELL_OVERLAP) * 0.5;
			const halfHeight = (cellHeight * CUBES_CELL_OVERLAP) * 0.5;

			dummy.position.set(x, y, 0);
			dummy.scale.set(
				cellWidth * CUBES_CELL_OVERLAP,
				cellHeight * CUBES_CELL_OVERLAP,
				depth,
			);
			dummy.updateMatrix();
			mesh.setMatrixAt(instanceIndex, dummy.matrix);

			for (const [startIndex, endIndex] of CUBE_EDGE_INDEX_PAIRS) {
				const startCorner = CUBE_EDGE_CORNERS[startIndex];
				const endCorner = CUBE_EDGE_CORNERS[endIndex];
				outlinePositions.setXYZ(
					outlineWriteIndex,
					x + startCorner[0] * halfWidth * 2,
					y + startCorner[1] * halfHeight * 2,
					startCorner[2] * depth,
				);
				outlineWriteIndex += 1;
				outlinePositions.setXYZ(
					outlineWriteIndex,
					x + endCorner[0] * halfWidth * 2,
					y + endCorner[1] * halfHeight * 2,
					endCorner[2] * depth,
				);
				outlineWriteIndex += 1;
			}
			instanceIndex += 1;
		}
	}
	mesh.instanceMatrix.needsUpdate = true;
	outlinePositions.needsUpdate = true;
	outlineLines.geometry.computeBoundingSphere();
}

export function createCubesScene(
	id: string,
): SceneInstance & SpectrumReactiveSceneExtensions {
	const group = new Group();
	group.position.copy(CUBES_PLANE_TARGET);
	group.lookAt(PERSPECTIVE_CAMERA_POSITION);

	const geometry = new BoxGeometry(1.02, 1.02, 1);
	geometry.translate(0, 0, 0.5);
	const solidMaterial = new MeshStandardMaterial({
		color: CUBES_SURFACE_COLOR_DEFAULT,
		emissive: "#081420",
		emissiveIntensity: 0.05,
		roughness: 0.68,
		metalness: 0.08,
	});
	const outlineMaterial = new LineBasicMaterial({
		color: CUBES_OUTLINE_COLOR_DEFAULT,
	});
	const state: CubesSceneState = {
		columns: CUBES_COLUMNS_DEFAULT,
		rows: CUBES_ROWS_DEFAULT,
		reactivityStrength: CUBES_REACTIVITY_DEFAULT,
		surfaceColorHex: CUBES_SURFACE_COLOR_DEFAULT,
		outlineColorHex: CUBES_OUTLINE_COLOR_DEFAULT,
		motionMode: CUBES_MOTION_MODE_DEFAULT,
		timeSeconds: 0,
		spectrumBins: null,
		instancedMesh: null,
		outlineLines: null,
		solidMaterial,
		outlineMaterial,
	};

	rebuildMesh(group, geometry, state);
	syncMaterialState(state);
	updateMeshTransforms(group, geometry, state);

	return {
		id,
		kind: "cubes",
		renderLayer: "perspective",
		group,
		update(simTimeSeconds) {
			state.timeSeconds = Math.max(0, simTimeSeconds);
			if (state.motionMode !== "static") {
				updateMeshTransforms(group, geometry, state);
			}
		},
		set(key, value) {
			switch (key) {
				case "surfaceColor":
					state.surfaceColorHex = normalizeColor(value);
					syncMaterialState(state);
					return true;
				case "outlineColor":
					state.outlineColorHex = normalizeColor(value);
					syncMaterialState(state);
					return true;
				case "outlineOverlay":
					return true;
				case "color":
					state.surfaceColorHex = normalizeColor(value);
					state.outlineColorHex = normalizeColor(value);
					syncMaterialState(state);
					return true;
				case "motionMode":
					state.motionMode = normalizeMotionMode(value);
					updateMeshTransforms(group, geometry, state);
					return true;
				case "reactivityStrength":
					state.reactivityStrength = normalizeReactivity(value);
					updateMeshTransforms(group, geometry, state);
					return true;
				case "columns":
					state.columns = normalizeCount(
						value,
						CUBES_COLUMNS_DEFAULT,
						CUBES_COLUMNS_MIN,
						CUBES_COLUMNS_MAX,
					);
					rebuildMesh(group, geometry, state);
					syncMaterialState(state);
					updateMeshTransforms(group, geometry, state);
					return true;
				case "rows":
					state.rows = normalizeCount(
						value,
						CUBES_ROWS_DEFAULT,
						CUBES_ROWS_MIN,
						CUBES_ROWS_MAX,
					);
					rebuildMesh(group, geometry, state);
					syncMaterialState(state);
					updateMeshTransforms(group, geometry, state);
					return true;
				case "outlineOnly":
					return true;
				default:
					return false;
			}
		},
		getSettings() {
			return {
				surfaceColor: state.surfaceColorHex,
				outlineColor: state.outlineColorHex,
				motionMode: state.motionMode,
				reactivityStrength: state.reactivityStrength,
				columns: state.columns,
				rows: state.rows,
			};
		},
		dispose() {
			if (state.instancedMesh) {
				state.instancedMesh.dispose();
			}
			if (state.outlineLines) {
				state.outlineLines.geometry.dispose();
			}
			geometry.dispose();
			solidMaterial.dispose();
			outlineMaterial.dispose();
		},
		setSpectrum(bins) {
			state.spectrumBins = bins;
			updateMeshTransforms(group, geometry, state);
		},
	};
}
