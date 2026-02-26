import {
	AdditiveBlending,
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	Points,
	PointsMaterial,
} from "three";

export type ExplosionBurst = {
	points: Points;
	baseDirections: Float32Array;
	positionAttribute: Float32BufferAttribute;
};

const ARCADE_PARTICLE_COUNT = 40;
const EXPLOSION_POWER_MIN = 0.12;
const EXPLOSION_POWER_MAX = 2.12;

export function createExplosionBurst(seed: number): ExplosionBurst {
	const particleCount = ARCADE_PARTICLE_COUNT;
	const baseDirections = new Float32Array(particleCount * 3);
	const positions = new Float32Array(particleCount * 3);

	for (let i = 0; i < particleCount; i += 1) {
		const offset = i * 3;
		const angle = hash01(seed * 197 + i * 31) * Math.PI * 2;
		const radius = 0.75 + hash01(seed * 389 + i * 19) * 1.7;
		baseDirections[offset] = Math.cos(angle) * radius;
		baseDirections[offset + 1] = Math.sin(angle) * radius;
		baseDirections[offset + 2] = (hash01(seed * 521 + i * 7) - 0.5) * 0.35;
		positions[offset] = 0;
		positions[offset + 1] = 0;
		positions[offset + 2] = 0;
	}

	const geometry = new BufferGeometry();
	const positionAttribute = new Float32BufferAttribute(positions, 3);
	geometry.setAttribute("position", positionAttribute);
	const material = new PointsMaterial({
		color: "#fff1b3",
		size: 5.4,
		sizeAttenuation: false,
		transparent: true,
		opacity: 1,
		blending: AdditiveBlending,
		depthWrite: false,
		depthTest: false,
	});

	return {
		points: new Points(geometry, material),
		baseDirections,
		positionAttribute,
	};
}

export function updateExplosionBurst(
	burst: ExplosionBurst,
	normalizedAge: number,
	alpha: number,
	peakScale: number,
	color: Color,
): void {
	const peakNormalized = normalizeExplosionPower(peakScale);
	const intensityScale = 0.3 + peakScale * 0.85;
	const travel = (0.4 + normalizedAge * 7.8) * intensityScale;
	const wobble = Math.sin(normalizedAge * Math.PI * 5) * 0.08;
	const positions = burst.positionAttribute.array as Float32Array;
	for (let i = 0; i < burst.baseDirections.length; i += 3) {
		positions[i] = burst.baseDirections[i] * travel;
		positions[i + 1] = burst.baseDirections[i + 1] * travel;
		positions[i + 2] = burst.baseDirections[i + 2] * travel + wobble;
	}
	burst.positionAttribute.needsUpdate = true;

	const material = burst.points.material as PointsMaterial;
	material.color.copy(color);
	material.opacity = Math.max(
		0,
		Math.pow(alpha, 0.3) * (0.72 + peakNormalized * 0.92),
	);
	material.size = Math.max(
		1.8,
		(4.5 - normalizedAge * 2.4) * (0.58 + peakNormalized * 1.12),
	);
}

export function normalizeExplosionPower(power: number): number {
	return clamp01((power - EXPLOSION_POWER_MIN) / (EXPLOSION_POWER_MAX - EXPLOSION_POWER_MIN));
}

function hash01(seed: number): number {
	const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}
