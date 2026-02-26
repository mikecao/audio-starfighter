import { AdditiveBlending, Mesh, type Group, type Vector2 } from "three";
import { MeshLine, MeshLineMaterial } from "three.meshline";
import type { SimulationSnapshot } from "../../game/sim";

export type PurplePulseRenderable = {
	mesh: Mesh;
	line: MeshLine;
	material: MeshLineMaterial;
	missileId: number | null;
	animationStartTimeSeconds: number;
	animationDurationSeconds: number;
};

export const PURPLE_PULSE_MAX_POOL_SIZE = 20;
export const PURPLE_PULSE_MAX_NEW_BINDINGS_PER_FRAME = 5;
export const PURPLE_PULSE_TERMINAL_ACCELERATION_POWER = 1.65;
export const PURPLE_PULSE_TRAVEL_DASH_RATIO = 0.9;
export const PURPLE_PULSE_DASH_START = 1 - PURPLE_PULSE_TRAVEL_DASH_RATIO + 0.001;
export const PURPLE_PULSE_DASH_END = 1;

const MISSILE_TRAIL_LINE_WIDTH = 0.06;
const MISSILE_TRAIL_Z_OFFSET = 0.018;
const PURPLE_PULSE_MIN_DURATION_SECONDS = 0.5;
const PURPLE_PULSE_TOTAL_SAMPLES = 128;
const PURPLE_PULSE_MIN_EFFECTIVE_DISTANCE = 15.5;
const PURPLE_PULSE_VERTICAL_DELAY_PORTION = 0.26;
const PURPLE_PULSE_AXIAL_SWEEP_BASE = 0.28;
const PURPLE_PULSE_BACK_DRIFT_MIN = 1.9;
const PURPLE_PULSE_BACK_DRIFT_MAX = 3.25;
const PURPLE_PULSE_BACK_DRIFT_DISTANCE_REFERENCE = 9.2;
const PURPLE_PULSE_BACK_DRIFT_BOOST = 1.42;
const PURPLE_PULSE_ENVELOPE_POWER_BASE = 0.72;
const PURPLE_PULSE_LAUNCH_PHASE_END = 0.62;
const PURPLE_PULSE_LAUNCH_MIN_SPAN = 8.13;
const PURPLE_PULSE_LAUNCH_STRAIGHT_PHASE_END = 0.68;
const PURPLE_PULSE_LAUNCH_STRAIGHT_MIN_DISTANCE = 5.87;
const PURPLE_PULSE_LAUNCH_STRAIGHT_DISTANCE_SCALE = 0.387;
const PURPLE_PULSE_LAUNCH_CURVE_MIN_SPAN = 2.8;
const PURPLE_PULSE_LAUNCH_BACK_DIRECTION_WEIGHT = 1.08;
const PURPLE_PULSE_LAUNCH_SIDE_DIRECTION_WEIGHT = 1.26;
const PURPLE_PULSE_LAUNCH_OUT_HANDLE_SCALE = 0.44;
const PURPLE_PULSE_LAUNCH_IN_HANDLE_SCALE = 0.46;
const PURPLE_PULSE_LAUNCH_ARC_MIN = 0.28;
const PURPLE_PULSE_LAUNCH_ARC_MAX = 0.92;
const PURPLE_PULSE_LAUNCH_CLAMP_PORTION = 0.14;
const PURPLE_PULSE_MAX_LAUNCH_SLOPE = 2.4;
const PURPLE_PULSE_TERMINAL_PHASE_START = 0.54;
const PURPLE_PULSE_TERMINAL_MIN_SPAN = 8.4;
const PURPLE_PULSE_TERMINAL_OUT_HANDLE_SCALE = 0.5;
const PURPLE_PULSE_TERMINAL_IN_HANDLE_SCALE = 0.64;

type MissileSnapshot = SimulationSnapshot["missiles"][number];

export function syncPurplePulsePool(
	pulses: PurplePulseRenderable[],
	requiredCount: number,
	parent: Group,
	resolution: Vector2,
): void {
	while (pulses.length < requiredCount) {
		const line = new MeshLine();
		line.setPoints([
			0,
			0,
			MISSILE_TRAIL_Z_OFFSET,
			0.01,
			0,
			MISSILE_TRAIL_Z_OFFSET,
		]);
		const material = createPurplePulseMaterial(resolution);
		const mesh = new Mesh(line, material);
		mesh.frustumCulled = false;
		mesh.visible = false;
		parent.add(mesh);
		pulses.push({
			mesh,
			line,
			material,
			missileId: null,
			animationStartTimeSeconds: -1,
			animationDurationSeconds: PURPLE_PULSE_MIN_DURATION_SECONDS,
		});
	}
}

export function bindPurplePulseRenderable(
	pulse: PurplePulseRenderable,
	missile: MissileSnapshot,
): void {
	pulse.line.setPoints(
		buildPurplePulsePathPoints(
			missile.launchX,
			missile.launchY,
			missile.targetX,
			missile.targetY,
			missile.loopDirection,
			missile.loopTurns,
			missile.pathVariant,
		),
	);
	pulse.missileId = missile.id;
	setDashOffset(pulse.material, 0);
	setDashRatio(pulse.material, PURPLE_PULSE_TRAVEL_DASH_RATIO);
}

export function clearPurplePulseRenderable(pulse: PurplePulseRenderable): void {
	pulse.missileId = null;
	pulse.animationStartTimeSeconds = -1;
	pulse.animationDurationSeconds = PURPLE_PULSE_MIN_DURATION_SECONDS;
	pulse.mesh.visible = false;
	setDashOffset(pulse.material, 0);
	setDashRatio(pulse.material, PURPLE_PULSE_TRAVEL_DASH_RATIO);
}

export function computePurplePulseTravelDuration(
	simTimeSeconds: number,
	missile: MissileSnapshot,
): number {
	const launchTimeSeconds = simTimeSeconds - missile.ageSeconds;
	const cueTravelSeconds = missile.cueTimeSeconds - launchTimeSeconds;
	return Math.max(PURPLE_PULSE_MIN_DURATION_SECONDS, cueTravelSeconds);
}

export function setDashOffset(material: MeshLineMaterial, value: number): void {
	const dashOffsetUniform = material.uniforms.dashOffset;
	if (dashOffsetUniform) {
		dashOffsetUniform.value = value;
	}
}

export function setDashRatio(material: MeshLineMaterial, value: number): void {
	const dashRatioUniform = material.uniforms.dashRatio;
	if (dashRatioUniform) {
		dashRatioUniform.value = value;
	}
}

function createPurplePulseMaterial(resolution: Vector2): MeshLineMaterial {
	return new MeshLineMaterial({
		color: "#a855f7",
		transparent: true,
		opacity: 0.92,
		lineWidth: MISSILE_TRAIL_LINE_WIDTH,
		dashArray: 1,
		dashRatio: PURPLE_PULSE_TRAVEL_DASH_RATIO,
		dashOffset: 0,
		sizeAttenuation: 1,
		resolution,
		blending: AdditiveBlending,
		depthWrite: false,
		depthTest: true,
	});
}

function buildPurplePulsePathPoints(
	startX: number,
	startY: number,
	targetX: number,
	targetY: number,
	loopDirection: number,
	loopTurns: number,
	pathVariant: number,
): Float32Array {
	const dx = targetX - startX;
	const dy = targetY - startY;
	const distance = Math.max(1, Math.hypot(dx, dy));
	const effectiveDistance = Math.max(
		distance,
		PURPLE_PULSE_MIN_EFFECTIVE_DISTANCE,
	);
	const virtualDx = (dx / distance) * effectiveDistance;
	const virtualDy = (dy / distance) * effectiveDistance;
	const dirX = dx / distance;
	const dirY = dy / distance;
	const perpX = -dirY;
	const perpY = dirX;

	const variant = clamp(pathVariant, 0, 1);
	const variantPhase = variant * Math.PI * 2;

	const loopRadius = clamp(
		effectiveDistance * (0.58 + variant * 0.22),
		3.1,
		10.4,
	);
	const launchBackBase =
		PURPLE_PULSE_BACK_DRIFT_MIN +
		variant * (PURPLE_PULSE_BACK_DRIFT_MAX - PURPLE_PULSE_BACK_DRIFT_MIN);
	const launchBackDistanceScale = clamp(
		effectiveDistance / PURPLE_PULSE_BACK_DRIFT_DISTANCE_REFERENCE,
		0.84,
		1.38,
	);
	const launchBackDrift = launchBackBase * launchBackDistanceScale;
	const launchArcStrength =
		PURPLE_PULSE_LAUNCH_ARC_MIN +
		Math.abs(Math.sin(variantPhase * 0.73)) *
			(PURPLE_PULSE_LAUNCH_ARC_MAX - PURPLE_PULSE_LAUNCH_ARC_MIN);
	const loopSide = loopDirection < 0 ? -1 : 1;
	const turns = clamp(loopTurns + (variant - 0.5) * 0.28, 1.04, 1.52);
	const axialSweep = clamp(
		PURPLE_PULSE_AXIAL_SWEEP_BASE + (variant - 0.5) * 0.18,
		0.2,
		0.52,
	);
	const envelopePower = clamp(
		PURPLE_PULSE_ENVELOPE_POWER_BASE + (0.5 - variant) * 0.2,
		0.58,
		0.9,
	);
	const pointCount = PURPLE_PULSE_TOTAL_SAMPLES;
	const points = new Float32Array(pointCount * 3);

	for (let i = 0; i < pointCount; i += 1) {
		const t = pointCount > 1 ? i / (pointCount - 1) : 0;
		const easedT = easeInOutSine(t);
		const delayedVerticalT = clamp(
			(t - PURPLE_PULSE_VERTICAL_DELAY_PORTION) /
				Math.max(1e-4, 1 - PURPLE_PULSE_VERTICAL_DELAY_PORTION),
			0,
			1,
		);
		const easedVerticalT = easeInOutSine(delayedVerticalT);
		const angle = turns * Math.PI * 2 * t + variantPhase * 0.16;
		const envelope = Math.pow(Math.sin(Math.PI * t), envelopePower);

		const lateralPrimary = Math.sin(angle) * loopRadius * envelope;
		const lateralSecondary =
			Math.sin(angle * (1.62 + variant * 0.46) + variantPhase * 0.9) *
			loopRadius *
			(0.08 + variant * 0.08) *
			envelope;
		const lateral = (lateralPrimary + lateralSecondary) * loopSide;

		const axialLoop =
			(Math.cos(angle) - 1) * loopRadius * axialSweep * envelope;
		const launchBack =
			-launchBackDrift *
			t *
			Math.pow(1 - t, 2) *
			(1 + PURPLE_PULSE_BACK_DRIFT_BOOST * (1 - t));
		const launchArc =
			loopSide *
			launchArcStrength *
			t *
			Math.pow(1 - t, 1.85) *
			effectiveDistance *
			0.24;

		const baseX = startX + virtualDx * easedT;
		const baseY = startY + virtualDy * easedVerticalT;
		const verticalOffset =
			(perpY * lateral + dirY * axialLoop) * easedVerticalT;
		const offset = i * 3;
		const x = baseX + perpX * lateral + dirX * axialLoop + launchBack;
		let y = baseY + verticalOffset + launchArc;
		if (t <= PURPLE_PULSE_LAUNCH_CLAMP_PORTION) {
			const dxFromStart = Math.abs(x - startX);
			const maxDy = dxFromStart * PURPLE_PULSE_MAX_LAUNCH_SLOPE;
			y = startY + clamp(y - startY, -maxDy, maxDy);
		}

		points[offset] = x;
		points[offset + 1] = y;
		points[offset + 2] = MISSILE_TRAIL_Z_OFFSET;
	}

	smoothPurplePulseLaunchSegment(
		points,
		startX,
		startY,
		dirX,
		dirY,
		perpX,
		perpY,
		loopSide,
		effectiveDistance,
	);
	smoothPurplePulseTerminalSegment(points, targetX, targetY, dirX, dirY);

	return points;
}

function smoothPurplePulseLaunchSegment(
	points: Float32Array,
	startX: number,
	startY: number,
	targetDirX: number,
	targetDirY: number,
	perpX: number,
	perpY: number,
	loopSide: number,
	effectiveDistance: number,
): void {
	const pointCount = points.length / 3;
	if (pointCount < 5) {
		return;
	}

	let launchEndIndex = clamp(
		Math.floor((pointCount - 1) * PURPLE_PULSE_LAUNCH_PHASE_END),
		2,
		pointCount - 2,
	);
	while (launchEndIndex < pointCount - 2) {
		const offset = launchEndIndex * 3;
		const span = Math.hypot(
			points[offset] - startX,
			points[offset + 1] - startY,
		);
		if (span >= PURPLE_PULSE_LAUNCH_MIN_SPAN) {
			break;
		}
		launchEndIndex += 1;
	}

	const endOffset = launchEndIndex * 3;
	const nextOffset = (launchEndIndex + 1) * 3;
	const endX = points[endOffset];
	const endY = points[endOffset + 1];
	const nextX = points[nextOffset];
	const nextY = points[nextOffset + 1];

	const exitRawX = nextX - endX;
	const exitRawY = nextY - endY;
	const exitRawLength = Math.hypot(exitRawX, exitRawY);
	const exitDirX = exitRawLength > 1e-4 ? exitRawX / exitRawLength : targetDirX;
	const exitDirY = exitRawLength > 1e-4 ? exitRawY / exitRawLength : targetDirY;

	const launchRawX =
		-targetDirX * PURPLE_PULSE_LAUNCH_BACK_DIRECTION_WEIGHT +
		loopSide * perpX * PURPLE_PULSE_LAUNCH_SIDE_DIRECTION_WEIGHT;
	const launchRawY =
		-targetDirY * PURPLE_PULSE_LAUNCH_BACK_DIRECTION_WEIGHT +
		loopSide * perpY * PURPLE_PULSE_LAUNCH_SIDE_DIRECTION_WEIGHT;
	const launchRawLength = Math.hypot(launchRawX, launchRawY);
	const launchDirX =
		launchRawLength > 1e-4 ? launchRawX / launchRawLength : -targetDirX;
	const launchDirY =
		launchRawLength > 1e-4 ? launchRawY / launchRawLength : -targetDirY;

	const launchDistance = Math.max(
		0.8,
		Math.hypot(endX - startX, endY - startY),
	);
	const straightDistanceCap = Math.max(
		1.2,
		launchDistance - PURPLE_PULSE_LAUNCH_CURVE_MIN_SPAN,
	);
	const desiredStraightDistance = Math.max(
		PURPLE_PULSE_LAUNCH_STRAIGHT_MIN_DISTANCE,
		effectiveDistance * PURPLE_PULSE_LAUNCH_STRAIGHT_DISTANCE_SCALE,
	);
	const straightDistance = Math.min(
		straightDistanceCap,
		desiredStraightDistance,
	);
	let straightEndIndex = clamp(
		Math.floor(launchEndIndex * PURPLE_PULSE_LAUNCH_STRAIGHT_PHASE_END),
		1,
		launchEndIndex - 2,
	);
	while (straightEndIndex < launchEndIndex - 2) {
		const offset = straightEndIndex * 3;
		const span = Math.hypot(
			points[offset] - startX,
			points[offset + 1] - startY,
		);
		if (span >= straightDistance) {
			break;
		}
		straightEndIndex += 1;
	}

	const straightEndX = startX + launchDirX * straightDistance;
	const straightEndY = startY + launchDirY * straightDistance;
	for (let i = 0; i <= straightEndIndex; i += 1) {
		const u = straightEndIndex > 0 ? i / straightEndIndex : 1;
		const offset = i * 3;
		points[offset] = startX + (straightEndX - startX) * u;
		points[offset + 1] = startY + (straightEndY - startY) * u;
	}

	const curvedDistance = Math.max(
		0.8,
		Math.hypot(endX - straightEndX, endY - straightEndY),
	);
	const outHandleLength = clamp(
		effectiveDistance * PURPLE_PULSE_LAUNCH_OUT_HANDLE_SCALE,
		1.24,
		Math.max(1.8, curvedDistance * 0.95),
	);
	const inHandleLength = clamp(
		curvedDistance * PURPLE_PULSE_LAUNCH_IN_HANDLE_SCALE,
		0.92,
		Math.max(1.2, curvedDistance * 0.86),
	);

	const controlOneX = straightEndX + launchDirX * outHandleLength;
	const controlOneY = straightEndY + launchDirY * outHandleLength;
	const controlTwoX = endX - exitDirX * inHandleLength;
	const controlTwoY = endY - exitDirY * inHandleLength;

	const curvedSampleCount = launchEndIndex - straightEndIndex;
	for (let i = 0; i <= curvedSampleCount; i += 1) {
		const u = curvedSampleCount > 0 ? i / curvedSampleCount : 1;
		const invU = 1 - u;
		const b0 = invU * invU * invU;
		const b1 = 3 * invU * invU * u;
		const b2 = 3 * invU * u * u;
		const b3 = u * u * u;
		const offset = (straightEndIndex + i) * 3;

		points[offset] =
			b0 * straightEndX + b1 * controlOneX + b2 * controlTwoX + b3 * endX;
		points[offset + 1] =
			b0 * straightEndY + b1 * controlOneY + b2 * controlTwoY + b3 * endY;
	}
}

function smoothPurplePulseTerminalSegment(
	points: Float32Array,
	targetX: number,
	targetY: number,
	targetDirX: number,
	targetDirY: number,
): void {
	const pointCount = points.length / 3;
	if (pointCount < 4) {
		return;
	}

	let terminalStartIndex = clamp(
		Math.floor((pointCount - 1) * PURPLE_PULSE_TERMINAL_PHASE_START),
		1,
		pointCount - 2,
	);
	while (terminalStartIndex > 1) {
		const offset = terminalStartIndex * 3;
		const remaining = Math.hypot(
			targetX - points[offset],
			targetY - points[offset + 1],
		);
		if (remaining >= PURPLE_PULSE_TERMINAL_MIN_SPAN) {
			break;
		}
		terminalStartIndex -= 1;
	}

	const startOffset = terminalStartIndex * 3;
	const prevOffset = (terminalStartIndex - 1) * 3;

	const startX = points[startOffset];
	const startY = points[startOffset + 1];
	const prevX = points[prevOffset];
	const prevY = points[prevOffset + 1];

	const directApproachX = targetX - startX;
	const directApproachY = targetY - startY;
	const directApproachLength = Math.hypot(directApproachX, directApproachY);
	const directApproachDirX =
		directApproachLength > 1e-4
			? directApproachX / directApproachLength
			: targetDirX;
	const directApproachDirY =
		directApproachLength > 1e-4
			? directApproachY / directApproachLength
			: targetDirY;

	let entryDirX = startX - prevX;
	let entryDirY = startY - prevY;
	const entryDirLength = Math.hypot(entryDirX, entryDirY);
	if (entryDirLength > 1e-4) {
		entryDirX /= entryDirLength;
		entryDirY /= entryDirLength;
	} else {
		entryDirX = targetDirX;
		entryDirY = targetDirY;
	}

	const remainingDistance = Math.max(
		0.5,
		Math.hypot(targetX - startX, targetY - startY),
	);
	const blendedTargetDirX = targetDirX * 0.28 + directApproachDirX * 0.72;
	const blendedTargetDirY = targetDirY * 0.28 + directApproachDirY * 0.72;
	const blendedTargetDirLength = Math.hypot(
		blendedTargetDirX,
		blendedTargetDirY,
	);
	const resolvedTargetDirX =
		blendedTargetDirLength > 1e-4
			? blendedTargetDirX / blendedTargetDirLength
			: directApproachDirX;
	const resolvedTargetDirY =
		blendedTargetDirLength > 1e-4
			? blendedTargetDirY / blendedTargetDirLength
			: directApproachDirY;

	const outHandleLength = clamp(
		remainingDistance * PURPLE_PULSE_TERMINAL_OUT_HANDLE_SCALE,
		0.24,
		Math.max(0.4, remainingDistance * 0.88),
	);
	const inHandleLength = clamp(
		remainingDistance * PURPLE_PULSE_TERMINAL_IN_HANDLE_SCALE,
		0.26,
		Math.max(0.46, remainingDistance * 0.92),
	);

	const controlOneX = startX + entryDirX * outHandleLength;
	const controlOneY = startY + entryDirY * outHandleLength;
	const controlTwoX = targetX - resolvedTargetDirX * inHandleLength;
	const controlTwoY = targetY - resolvedTargetDirY * inHandleLength;

	const terminalSampleCount = pointCount - 1 - terminalStartIndex;
	for (let i = 0; i <= terminalSampleCount; i += 1) {
		const u = terminalSampleCount > 0 ? i / terminalSampleCount : 1;
		const invU = 1 - u;
		const b0 = invU * invU * invU;
		const b1 = 3 * invU * invU * u;
		const b2 = 3 * invU * u * u;
		const b3 = u * u * u;
		const offset = (terminalStartIndex + i) * 3;

		points[offset] =
			b0 * startX + b1 * controlOneX + b2 * controlTwoX + b3 * targetX;
		points[offset + 1] =
			b0 * startY + b1 * controlOneY + b2 * controlTwoY + b3 * targetY;
	}
}

function easeInOutSine(t: number): number {
	return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
