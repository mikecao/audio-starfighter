import type { Enemy, SimulationState } from "../types";
import {
	clamp,
	getEnemyById,
	getIntensityAtTime,
	isPlayerTargetViable,
	moodParameters,
	normalizeDirection,
	predictEnemyPosition,
} from "../utils";
import {
	PLAYER_PROJECTILE_SPEED,
	queueCueShotForEnemy,
} from "./cueShots";
import type { CueShotFireParams, CueShotImmediateParams, WeaponModule } from "./types";

const PLAYER_TARGET_HARD_DISTANCE_X = 12.6;
const PLAYER_TARGET_LOCK_MIN_SECONDS = 0.24;
const PLAYER_TARGET_LOCK_MAX_SECONDS = 0.5;
const PLAYER_AIM_LOCKED_JITTER = 0.06;
const PLAYER_AIM_UNLOCKED_JITTER = 0.14;
const BLUE_LASER_FIRE_INTERVAL_MULTIPLIER = 0.5;

export const blueLaserModule: WeaponModule = {
	id: "blue",
	assignmentWeight: 1,
	isEnabled: (state) => state.combatConfig.shipWeapons.blueLaser,
	planCue(state, enemy, cueTimeSeconds) {
		queueCueShotForEnemy(
			state,
			enemy,
			cueTimeSeconds,
			"blue",
			fireImmediateBlueCueShot,
		);
	},
	getCatchupLeadSeconds: (_state, baseLeadSeconds) =>
		clamp(baseLeadSeconds, 0.18, 0.58),
	fireQueuedShot: fireQueuedBlueShot,
	step: fireProjectiles,
};

function fireImmediateBlueCueShot(
	state: SimulationState,
	params: CueShotImmediateParams,
): void {
	state.projectiles.push({
		id: state.nextProjectileId++,
		x: params.shipX,
		y: params.shipY,
		z: 0,
		vx: params.dirX * PLAYER_PROJECTILE_SPEED,
		vy: params.dirY * PLAYER_PROJECTILE_SPEED,
		ageSeconds: 0,
		maxLifetimeSeconds: 0.34,
		radius: 0.16,
		isCueShot: false,
		isFlak: false,
	});
}

function fireQueuedBlueShot(
	state: SimulationState,
	params: CueShotFireParams,
): void {
	state.projectiles.push({
		id: state.nextProjectileId++,
		x: params.shipX,
		y: params.shipY,
		z: 0,
		vx: params.dx / params.leadSeconds,
		vy: params.dy / params.leadSeconds,
		ageSeconds: 0,
		maxLifetimeSeconds: params.leadSeconds + 0.12,
		radius: 0.16,
		isCueShot: false,
		isFlak: false,
	});
}

function fireProjectiles(state: SimulationState): void {
	while (state.simTimeSeconds >= state.nextPlayerFireTime) {
		const intensity = getIntensityAtTime(state, state.simTimeSeconds);
		const mood = moodParameters(state.moodProfile);
		const interval =
			(0.2 - intensity * 0.07) *
			mood.playerFireIntervalScale *
			BLUE_LASER_FIRE_INTERVAL_MULTIPLIER;

		if (!state.combatConfig.shipWeapons.blueLaser) {
			state.lockedTargetEnemyId = null;
			state.nextPlayerFireTime += clamp(interval, 0.05, 0.12);
			continue;
		}

		const shipX = state.shipX + 0.65;
		const shipY = state.shipY;

		const target = selectPlayerFireTarget(state, shipX, shipY);
		let directionX = state.lastPlayerAimX;
		let directionY = state.lastPlayerAimY;

		if (target) {
			const futureTarget = solveProjectileIntercept(
				shipX,
				shipY,
				target,
				PLAYER_PROJECTILE_SPEED,
			);
			const dx = futureTarget.x - shipX;
			const dy = futureTarget.y - shipY;
			const mag = Math.hypot(dx, dy);
			if (mag > 1e-6) {
				const locked = state.lockedTargetEnemyId === target.id;
				const baseJitter = locked
					? PLAYER_AIM_LOCKED_JITTER
					: PLAYER_AIM_UNLOCKED_JITTER;
				const cueBias = target.scheduledCueTime !== null ? 0.55 : 1;
				const jitter = (state.rng() - 0.5) * baseJitter * cueBias;
				const desired = normalizeDirection(dx, dy + jitter);
				const blend = locked ? 0.84 : 0.72;
				const blended = normalizeDirection(
					state.lastPlayerAimX * (1 - blend) + desired.x * blend,
					state.lastPlayerAimY * (1 - blend) + desired.y * blend,
				);
				directionX = blended.x;
				directionY = blended.y;
			}
		} else {
			state.lockedTargetEnemyId = null;
			const fallback = normalizeDirection(
				1,
				clamp(
					state.shipVy * 0.03 +
						Math.sin(state.simTimeSeconds * 1.15) * 0.04,
					-0.12,
					0.12,
				),
			);
			directionX = fallback.x;
			directionY = fallback.y;
		}

		state.lastPlayerAimX = directionX;
		state.lastPlayerAimY = directionY;

		state.projectiles.push({
			id: state.nextProjectileId++,
			x: shipX,
			y: shipY,
			z: 0,
			vx: directionX * PLAYER_PROJECTILE_SPEED,
			vy: directionY * PLAYER_PROJECTILE_SPEED,
			ageSeconds: 0,
			maxLifetimeSeconds: 1.45,
			radius: 0.16,
			isCueShot: false,
			isFlak: false,
		});

		state.nextPlayerFireTime += clamp(interval, 0.05, 0.12);
	}
}

function selectPlayerFireTarget(
	state: SimulationState,
	shipX: number,
	shipY: number,
): Enemy | null {
	if (
		state.lockedTargetEnemyId !== null &&
		state.simTimeSeconds <= state.targetLockUntilSeconds
	) {
		const lockedTarget = getEnemyById(state.enemies, state.lockedTargetEnemyId);
		if (lockedTarget && isPlayerTargetViable(lockedTarget, shipX, shipY)) {
			return lockedTarget;
		}
	}

	let bestTarget: Enemy | null = null;
	let bestScore = Number.POSITIVE_INFINITY;

	for (const enemy of state.enemies) {
		if (!isPlayerTargetViable(enemy, shipX, shipY)) {
			continue;
		}

		const score = scorePlayerFireTarget(state, enemy, shipX, shipY);
		if (score < bestScore) {
			bestScore = score;
			bestTarget = enemy;
		}
	}

	if (!bestTarget) {
		state.lockedTargetEnemyId = null;
		state.targetLockUntilSeconds = 0;
		return null;
	}

	state.lockedTargetEnemyId = bestTarget.id;
	state.targetLockUntilSeconds =
		state.simTimeSeconds +
		PLAYER_TARGET_LOCK_MIN_SECONDS +
		state.rng() *
			(PLAYER_TARGET_LOCK_MAX_SECONDS - PLAYER_TARGET_LOCK_MIN_SECONDS);
	return bestTarget;
}

function scorePlayerFireTarget(
	state: SimulationState,
	enemy: Enemy,
	shipX: number,
	shipY: number,
): number {
	const intercept = solveProjectileIntercept(
		shipX,
		shipY,
		enemy,
		PLAYER_PROJECTILE_SPEED,
	);
	const dx = intercept.x - shipX;
	const dy = intercept.y - shipY;
	const distance = Math.hypot(dx, dy);
	let score = dx * 0.52 + Math.abs(dy) * 1.35 + distance * 0.06;

	if (enemy.scheduledCueTime !== null) {
		const timeUntilCue = enemy.scheduledCueTime - state.simTimeSeconds;
		if (timeUntilCue > 0.06 && timeUntilCue < 1.2) {
			score -= 1.2 + (1.2 - timeUntilCue) * 0.45;
		} else {
			score -= 0.55;
		}
	}
	if (enemy.cuePrimed) {
		score -= 0.35;
	}
	if (!enemy.hasEnteredView) {
		score += 0.28;
	}
	if (state.lockedTargetEnemyId === enemy.id) {
		score -= 0.7;
	}

	return score;
}

function solveProjectileIntercept(
	shipX: number,
	shipY: number,
	enemy: Enemy,
	projectileSpeed: number,
): { x: number; y: number } {
	const initialDx = enemy.x - shipX;
	const initialDy = enemy.y - shipY;
	let travelSeconds = clamp(
		Math.hypot(initialDx, initialDy) / projectileSpeed,
		0.03,
		0.85,
	);

	for (let i = 0; i < 3; i += 1) {
		const future = predictEnemyPosition(enemy, travelSeconds);
		const dx = future.x - shipX;
		const dy = future.y - shipY;
		travelSeconds = clamp(Math.hypot(dx, dy) / projectileSpeed, 0.03, 0.85);
	}

	return predictEnemyPosition(enemy, travelSeconds);
}
