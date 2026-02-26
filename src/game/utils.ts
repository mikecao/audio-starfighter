import type { Enemy, MoodProfile, SimulationState } from "./types";
import { LASER_MAX_TARGET_X } from "./constants";

// ── Math utilities ─────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function samplePercentile(values: number[], percentile: number): number {
	if (values.length === 0) {
		return 0;
	}
	if (values.length === 1) {
		return values[0];
	}
	const p = clamp(percentile, 0, 1);
	const index = p * (values.length - 1);
	const lo = Math.floor(index);
	const hi = Math.min(values.length - 1, lo + 1);
	const t = index - lo;
	return values[lo] + (values[hi] - values[lo]) * t;
}

export function normalizeDirection(
	x: number,
	y: number,
): { x: number; y: number } {
	const magnitude = Math.hypot(x, y) || 1;
	return {
		x: x / magnitude,
		y: y / magnitude,
	};
}

// ── PRNG ───────────────────────────────────────────────────────────

export function createMulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let value = Math.imul(t ^ (t >>> 15), 1 | t);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

export function normalizeSeed(value: number): number {
	if (!Number.isFinite(value)) {
		return 7;
	}
	const int = Math.trunc(value);
	return int >>> 0;
}

// ── Enemy helpers ──────────────────────────────────────────────────

export function getEnemyById(
	enemies: Enemy[],
	enemyId: number,
): Enemy | null {
	for (const enemy of enemies) {
		if (enemy.id === enemyId) {
			return enemy;
		}
	}
	return null;
}

export function findBestTarget(
	enemies: Enemy[],
	shipX: number,
	shipY: number,
	maxDistanceX: number,
): Enemy | null {
	let bestEnemy: Enemy | null = null;
	let bestScore = Number.POSITIVE_INFINITY;

	for (const enemy of enemies) {
		if (enemy.x < shipX + 0.6) {
			continue;
		}
		if (enemy.x > shipX + maxDistanceX) {
			continue;
		}

		const dx = enemy.x - shipX;
		const dy = enemy.y - shipY;
		const score = dx * 0.8 + Math.abs(dy) * 1.6;
		if (score < bestScore) {
			bestScore = score;
			bestEnemy = enemy;
		}
	}

	return bestEnemy;
}

// ── Intensity timeline ─────────────────────────────────────────────

export function getIntensityAtTime(
	state: SimulationState,
	timeSeconds: number,
): number {
	const timeline = state.intensityTimeline;
	if (timeline.length === 0) {
		return 0.5;
	}

	if (timeSeconds <= timeline[0].timeSeconds) {
		return timeline[0].intensity;
	}

	const last = timeline[timeline.length - 1];
	if (timeSeconds >= last.timeSeconds) {
		return last.intensity;
	}

	for (let i = 1; i < timeline.length; i += 1) {
		const next = timeline[i];
		if (timeSeconds > next.timeSeconds) {
			continue;
		}
		const prev = timeline[i - 1];
		const span = Math.max(next.timeSeconds - prev.timeSeconds, 1e-6);
		const t = (timeSeconds - prev.timeSeconds) / span;
		return prev.intensity + (next.intensity - prev.intensity) * t;
	}

	return last.intensity;
}

export function getRelativeIntensityAtTime(
	state: SimulationState,
	timeSeconds: number,
): number {
	const intensity = getIntensityAtTime(state, timeSeconds);
	const floor = state.intensityFloor;
	const ceil = state.intensityCeil;
	const span = Math.max(1e-4, ceil - floor);
	return clamp((intensity - floor) / span, 0, 1);
}

// ── Mood parameters ────────────────────────────────────────────────

export type MoodParameters = {
	enemySpeedScale: number;
	spawnIntervalScale: number;
	enemyFireIntervalScale: number;
	enemyBulletRateScale: number;
	playerFireIntervalScale: number;
};

const ENEMY_SPAWN_INTERVAL_MULTIPLIER = 0.9;
const ENEMY_FIRE_INTERVAL_MULTIPLIER = 1.15;

export function moodParameters(mood: MoodProfile): MoodParameters {
	if (mood === "calm") {
		return {
			enemySpeedScale: 0.88,
			spawnIntervalScale: 1.12,
			enemyFireIntervalScale: 1.15,
			enemyBulletRateScale: 0.84,
			playerFireIntervalScale: 1.04,
		};
	}
	if (mood === "aggressive") {
		return {
			enemySpeedScale: 1.04,
			spawnIntervalScale: 0.8,
			enemyFireIntervalScale: 0.82,
			enemyBulletRateScale: 1.22,
			playerFireIntervalScale: 0.92,
		};
	}
	return {
		enemySpeedScale: 1,
		spawnIntervalScale: ENEMY_SPAWN_INTERVAL_MULTIPLIER,
		enemyFireIntervalScale: ENEMY_FIRE_INTERVAL_MULTIPLIER,
		enemyBulletRateScale: 1,
		playerFireIntervalScale: 1,
	};
}

// ── Enemy movement patterns ────────────────────────────────────────

export function resolveEnemyPatternY(
	enemy: Enemy,
	ageSeconds: number,
): number {
	const effectiveAge = Math.max(0, ageSeconds - enemy.pathAgeOffsetSeconds);
	if (enemy.pattern === "straight") {
		return enemy.baseY;
	}

	if (enemy.pattern === "sine") {
		return (
			enemy.baseY +
			Math.sin(enemy.phase + effectiveAge * enemy.frequency) * enemy.amplitude
		);
	}

	if (enemy.pattern === "zigzag") {
		const wave = Math.asin(
			Math.sin(enemy.phase + effectiveAge * enemy.frequency * 1.8),
		);
		return enemy.baseY + wave * enemy.amplitude * 0.85;
	}

	if (enemy.pattern === "weave") {
		return (
			enemy.baseY +
			Math.sin(enemy.phase + effectiveAge * enemy.frequency * 0.75) *
				(enemy.amplitude * 0.55) +
			Math.cos(enemy.phase * 1.4 + effectiveAge * enemy.frequency * 1.9) *
				(enemy.amplitude * 0.35)
		);
	}

	if (enemy.pattern === "arc") {
		return (
			enemy.baseY +
			Math.sin(enemy.phase + effectiveAge * enemy.frequency * 1.2) *
				(enemy.amplitude * 0.55) +
			Math.sin(effectiveAge * 0.9) * 0.45
		);
	}

	if (enemy.pattern === "triangleRibbon") {
		return (
			enemy.baseY +
			Math.sin(enemy.phase + effectiveAge * enemy.frequency * 0.95) *
				(enemy.amplitude * 1.05) +
			Math.sin(enemy.phase * 0.7 + effectiveAge * enemy.frequency * 0.42) *
				(enemy.amplitude * 0.48)
		);
	}

	if (enemy.pattern === "triangleBankedZig") {
		const wave = Math.asin(
			Math.sin(enemy.phase + effectiveAge * enemy.frequency * 2.4),
		);
		return (
			enemy.baseY +
			wave * enemy.amplitude * 0.98 +
			Math.sin(enemy.phase * 0.5 + effectiveAge * enemy.frequency * 0.82) *
				(enemy.amplitude * 0.36)
		);
	}

	if (enemy.pattern === "triangleDiveRecover") {
		const wave = Math.sin(enemy.phase + effectiveAge * enemy.frequency * 1.3);
		const shapedWave = wave < 0 ? wave * 1.22 : wave * 0.6;
		return (
			enemy.baseY +
			shapedWave * enemy.amplitude * 1.12 +
			Math.sin(effectiveAge * enemy.frequency * 0.44 + enemy.phase * 0.42) *
				(enemy.amplitude * 0.42)
		);
	}

	if (enemy.pattern === "triangleCorkscrew") {
		return (
			enemy.baseY +
			Math.sin(enemy.phase + effectiveAge * enemy.frequency * 1.05) *
				(enemy.amplitude * 0.86) +
			Math.cos(enemy.phase * 0.82 + effectiveAge * enemy.frequency * 2.05) *
				(enemy.amplitude * 0.74)
		);
	}

	return (
		enemy.baseY +
		Math.sin(enemy.phase + effectiveAge * enemy.frequency * 1.05) *
			(enemy.amplitude * 0.52) +
		Math.cos(enemy.phase * 0.82 + effectiveAge * enemy.frequency * 2.05) *
			(enemy.amplitude * 0.48)
	);
}

export function predictEnemyPosition(
	enemy: Enemy,
	dt: number,
): { x: number; y: number } {
	const age = enemy.ageSeconds + dt;
	const x = enemy.x + enemy.vx * dt;
	return { x, y: resolveEnemyPatternY(enemy, age) };
}

// ── Ship prediction ────────────────────────────────────────────────

const SHIP_MIN_X = -19.8;
const SHIP_MAX_X = 19.8;
const SHIP_MIN_Y = -11.2;
const SHIP_MAX_Y = 11.2;

export function predictShipPosition(
	state: SimulationState,
	dt: number,
): {
	x: number;
	baseY: number;
	vx: number;
	vy: number;
} {
	const t = Math.max(0, dt);
	const projectedX =
		state.shipX + state.shipVx * t + (state.shipTargetX - state.shipX) * 0.35;
	const projectedY =
		state.shipY + state.shipVy * t + (state.shipTargetY - state.shipY) * 0.35;
	return {
		x: clamp(projectedX, SHIP_MIN_X, SHIP_MAX_X),
		baseY: clamp(projectedY, SHIP_MIN_Y, SHIP_MAX_Y),
		vx: state.shipVx,
		vy: state.shipVy,
	};
}

export function isPlayerTargetViable(
	enemy: Enemy,
	shipX: number,
	shipY: number,
	hardDistanceX = 12.6,
	maxLateralDistance = 7.2,
): boolean {
	if (enemy.x < shipX + 0.5) {
		return false;
	}
	if (enemy.x > shipX + hardDistanceX || enemy.x > LASER_MAX_TARGET_X + 1.2) {
		return false;
	}
	if (Math.abs(enemy.y - shipY) > maxLateralDistance) {
		return false;
	}
	return true;
}
