import {
	BufferGeometry,
	Float32BufferAttribute,
	Points,
	PointsMaterial,
} from "three";

export type StarLayer = {
	primary: Points;
	wrap: Points;
	speed: number;
	parallaxFactor: number;
	loopWidth: number;
	baseOpacity: number;
};

export const STARFIELD_SPEED_SCALE_DEFAULT = 1;
const STARFIELD_SPEED_SCALE_MIN = 0;
const STARFIELD_SPEED_SCALE_MAX = 3;

export const STARFIELD_SHIP_MOVEMENT_RESPONSE_DEFAULT = 1;
const STARFIELD_SHIP_MOVEMENT_RESPONSE_MIN = 0;
const STARFIELD_SHIP_MOVEMENT_RESPONSE_MAX = 2;

export function normalizeStarfieldSpeedScale(value: number): number {
	if (!Number.isFinite(value)) {
		return STARFIELD_SPEED_SCALE_DEFAULT;
	}
	return clamp(value, STARFIELD_SPEED_SCALE_MIN, STARFIELD_SPEED_SCALE_MAX);
}

export function normalizeStarfieldShipMovementResponse(value: number): number {
	if (!Number.isFinite(value)) {
		return STARFIELD_SHIP_MOVEMENT_RESPONSE_DEFAULT;
	}
	return clamp(
		value,
		STARFIELD_SHIP_MOVEMENT_RESPONSE_MIN,
		STARFIELD_SHIP_MOVEMENT_RESPONSE_MAX,
	);
}

export function createStarLayer(
	count: number,
	color: number,
	speed: number,
	size: number,
	parallaxFactor: number,
): StarLayer {
	const fieldWidth = 74;
	const fieldHeight = 44;
	const basePositions = new Float32Array(count * 3);
	for (let i = 0; i < count; i += 1) {
		const offset = i * 3;
		basePositions[offset] = -fieldWidth * 0.5 + Math.random() * fieldWidth;
		basePositions[offset + 1] =
			-fieldHeight * 0.5 + Math.random() * fieldHeight;
		basePositions[offset + 2] = -7 - Math.random() * 6;
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute(
		"position",
		new Float32BufferAttribute(basePositions, 3),
	);

	const material = new PointsMaterial({
		color,
		size: size * 22,
		sizeAttenuation: false,
		transparent: true,
		opacity: 0.85,
	});

	const primary = new Points(geometry, material);
	const wrap = new Points(geometry, material.clone());
	wrap.position.x = fieldWidth;
	const baseOpacity = 0.7 + (size > 0.08 ? 0.2 : size > 0.05 ? 0.1 : 0);

	return {
		primary,
		wrap,
		speed,
		parallaxFactor,
		loopWidth: fieldWidth,
		baseOpacity,
	};
}

export function updateStarLayer(
	layer: StarLayer,
	simTimeSeconds: number,
	shipY: number,
	speedScale: number,
	shipMovementResponse: number,
): void {
	const traveled = (simTimeSeconds * layer.speed * speedScale) % layer.loopWidth;
	const baseX = -traveled;
	const parallaxYOffset = shipY * layer.parallaxFactor * shipMovementResponse;
	const driftY =
		Math.sin(simTimeSeconds * (0.9 + layer.parallaxFactor)) *
		layer.parallaxFactor *
		0.35;
	const twinkle =
		layer.baseOpacity +
		Math.sin(simTimeSeconds * (1.7 + layer.parallaxFactor * 2.2)) * 0.15;

	layer.primary.position.x = baseX;
	layer.primary.position.y = parallaxYOffset + driftY;
	layer.wrap.position.x = baseX + layer.loopWidth;
	layer.wrap.position.y = parallaxYOffset + driftY;

	const primaryMaterial = layer.primary.material as PointsMaterial;
	const wrapMaterial = layer.wrap.material as PointsMaterial;
	primaryMaterial.opacity = clamp01(twinkle);
	wrapMaterial.opacity = clamp01(twinkle * 0.98);
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
