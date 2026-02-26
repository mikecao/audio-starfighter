import type {
	CueWeaponId,
	Enemy,
	PlannedCueShot,
	SimulationState,
} from "../types";
import {
	clamp,
	normalizeDirection,
	predictEnemyPosition,
	predictShipPosition,
} from "../utils";
import type { CueShotImmediateParams, WeaponModule } from "./types";

export const PLAYER_PROJECTILE_SPEED = 22;

export function solveCueFireTime(
	state: SimulationState,
	enemy: Enemy,
	cueTimeSeconds: number,
): number | null {
	const dtCue = cueTimeSeconds - state.simTimeSeconds;
	if (dtCue <= 0.02) {
		return null;
	}

	const enemyAtCue = predictEnemyPosition(enemy, dtCue);
	let fireTimeSeconds = cueTimeSeconds - clamp(dtCue * 0.5, 0.14, 0.8);

	for (let i = 0; i < 4; i += 1) {
		const shipPose = predictShipPosition(
			state,
			fireTimeSeconds - state.simTimeSeconds,
		);
		const shotX = shipPose.x + 0.65;
		const shotY = shipPose.baseY;
		const leadSeconds =
			Math.hypot(enemyAtCue.x - shotX, enemyAtCue.y - shotY) /
			PLAYER_PROJECTILE_SPEED;
		fireTimeSeconds = cueTimeSeconds - leadSeconds;
	}

	if (
		fireTimeSeconds < state.simTimeSeconds ||
		fireTimeSeconds > cueTimeSeconds - 0.01
	) {
		return null;
	}

	return fireTimeSeconds;
}

export function queueCueShotForEnemy(
	state: SimulationState,
	enemy: Enemy,
	cueTimeSeconds: number,
	weapon: PlannedCueShot["weapon"],
	fireImmediate: (state: SimulationState, params: CueShotImmediateParams) => void,
): void {
	let fireTimeSeconds = solveCueFireTime(state, enemy, cueTimeSeconds);
	if (fireTimeSeconds === null) {
		const leadSeconds = cueTimeSeconds - state.simTimeSeconds;
		fireTimeSeconds = cueTimeSeconds - clamp(leadSeconds * 0.35, 0.16, 0.46);
	}

	fireTimeSeconds = Math.max(fireTimeSeconds, state.simTimeSeconds + 0.015);
	fireTimeSeconds = Math.min(fireTimeSeconds, cueTimeSeconds - 0.02);
	if (
		fireTimeSeconds <= state.simTimeSeconds + 0.01 ||
		fireTimeSeconds >= cueTimeSeconds - 0.01
	) {
		const aim = computeImmediateCueAim(state, enemy);
		fireImmediate(state, aim);
		enemy.cuePrimed = true;
		enemy.damageFlash = Math.max(enemy.damageFlash, 0.35);
		return;
	}

	insertPlannedCueShot(state, {
		cueTimeSeconds,
		enemyId: enemy.id,
		fireTimeSeconds,
		weapon,
	});
}

export function fireQueuedCueShots(
	state: SimulationState,
	getModule: (weaponId: CueWeaponId) => WeaponModule | undefined,
	isWeaponEnabled: (weaponId: CueWeaponId) => boolean,
): void {
	const plannedShots = state.plannedCueShots;
	if (plannedShots.length === 0) {
		return;
	}

	let processedCount = 0;
	while (processedCount < plannedShots.length) {
		const shot = plannedShots[processedCount];
		if (shot.fireTimeSeconds > state.simTimeSeconds) {
			break;
		}

		const enemy = state.enemies.find(
			(candidate) => candidate.id === shot.enemyId,
		);
		if (!enemy) {
			processedCount += 1;
			continue;
		}

		if (!isWeaponEnabled(shot.weapon)) {
			processedCount += 1;
			continue;
		}

		const module = getModule(shot.weapon);
		if (!module?.fireQueuedShot) {
			processedCount += 1;
			continue;
		}

		const leadSeconds = shot.cueTimeSeconds - state.simTimeSeconds;
		if (leadSeconds <= 0.02) {
			enemy.cuePrimed = true;
			enemy.damageFlash = Math.max(enemy.damageFlash, 0.35);
			processedCount += 1;
			continue;
		}

		const shipX = state.shipX + 0.65;
		const shipY = state.shipY;
		const future = predictEnemyPosition(enemy, leadSeconds);
		const dx = future.x - shipX;
		const dy = future.y - shipY;

		module.fireQueuedShot(state, {
			shipX,
			shipY,
			dx,
			dy,
			leadSeconds,
		});

		enemy.cuePrimed = true;
		enemy.damageFlash = Math.max(enemy.damageFlash, 0.35);
		processedCount += 1;
	}

	if (processedCount > 0) {
		plannedShots.splice(0, processedCount);
	}
}

export function computeImmediateCueAim(
	state: SimulationState,
	enemy: Enemy,
): CueShotImmediateParams {
	const shipX = state.shipX + 0.65;
	const shipY = state.shipY;
	const future = predictEnemyPosition(enemy, 0.12);
	const dir = normalizeDirection(future.x - shipX, future.y - shipY);
	return {
		shipX,
		shipY,
		dirX: dir.x,
		dirY: dir.y,
	};
}

function insertPlannedCueShot(
	state: SimulationState,
	shot: PlannedCueShot,
): void {
	const planned = state.plannedCueShots;
	if (
		planned.length === 0 ||
		planned[planned.length - 1].fireTimeSeconds <= shot.fireTimeSeconds
	) {
		planned.push(shot);
		return;
	}

	const insertAt = planned.findIndex(
		(candidate) => candidate.fireTimeSeconds > shot.fireTimeSeconds,
	);
	if (insertAt < 0) {
		planned.push(shot);
	} else {
		planned.splice(insertAt, 0, shot);
	}
}
