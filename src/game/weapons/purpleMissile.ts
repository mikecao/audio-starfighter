import type { Enemy, PlannedPurpleMissileShot, SimulationState } from "../types";
import { clamp, normalizeDirection, predictEnemyPosition } from "../utils";
import type { WeaponModule } from "./types";

const PURPLE_MISSILE_BASE_SPEED = 11.4;
const PURPLE_MISSILE_LAUNCH_OFFSET_X = -0.62;
const PURPLE_MISSILE_MAX_SPEED = 14.2;
const PURPLE_MISSILE_TURN_RATE = 7.2;
const PURPLE_MISSILE_LOOP_RADIUS_MIN = 3.5;
const PURPLE_MISSILE_LOOP_RADIUS_MAX = 5.6;
const PURPLE_MISSILE_LOOP_MIN_TURNS = 1.08;
const PURPLE_MISSILE_LOOP_MAX_TURNS = 1.36;
const PURPLE_MISSILE_LOOP_DURATION_MIN = 0.9;
const PURPLE_MISSILE_LOOP_DURATION_MAX = 1.55;
const PURPLE_MISSILE_LOOP_ENTRY_OFFSET_MIN = 1.3;
const PURPLE_MISSILE_LOOP_ENTRY_OFFSET_MAX = 2.4;
const PURPLE_MISSILE_LOOP_SIDE_OFFSET_MIN = 3.4;
const PURPLE_MISSILE_LOOP_SIDE_OFFSET_MAX = 5.8;
const PURPLE_MISSILE_POST_LOOP_SWERVE_DECAY = 1.7;
const PURPLE_MISSILE_COLLISION_RADIUS = 0.44;
const PURPLE_MISSILE_LEAD_SCALE = 1.95;
const PURPLE_MISSILE_MIN_LEAD_SECONDS = 0.18;
const PURPLE_MISSILE_MAX_LEAD_SECONDS = 1.45;
const PURPLE_MISSILE_FIRING_WINDOW_PADDING = 0.06;
const PURPLE_MISSILE_SIM_BUFFER_SECONDS = 0.14;

export const purpleMissileModule: WeaponModule = {
	id: "purple",
	assignmentWeight: 3,
	isEnabled: (state) => state.combatConfig.shipWeapons.purpleMissile,
	planCue(state, enemy, cueTimeSeconds) {
		queuePurpleMissileForEnemy(state, enemy, cueTimeSeconds);
	},
	getCatchupLeadSeconds: (_state, baseLeadSeconds) =>
		clamp(baseLeadSeconds * 2.35, 0.58, 1.76),
	fireQueued: fireQueuedPurpleMissiles,
};

export function updateMissiles(state: SimulationState, deltaSeconds: number): void {
	if (state.missiles.length === 0) {
		return;
	}

	const survivors = [] as typeof state.missiles;
	for (const missile of state.missiles) {
		missile.ageSeconds += deltaSeconds;
		if (missile.ageSeconds >= missile.maxLifetimeSeconds) {
			continue;
		}
		survivors.push(missile);
	}

	state.missiles = survivors;
}

function queuePurpleMissileForEnemy(
	state: SimulationState,
	enemy: Enemy,
	cueTimeSeconds: number,
): void {
	if (!state.combatConfig.shipWeapons.purpleMissile) {
		return;
	}

	let fireTimeSeconds = solvePurpleMissileFireTime(state, enemy, cueTimeSeconds);
	if (fireTimeSeconds === null) {
		const leadSeconds = cueTimeSeconds - state.simTimeSeconds;
		fireTimeSeconds = cueTimeSeconds - clamp(leadSeconds * 0.4, 0.14, 0.58);
	}

	fireTimeSeconds = Math.max(fireTimeSeconds, state.simTimeSeconds + 0.02);
	fireTimeSeconds = Math.min(fireTimeSeconds, cueTimeSeconds - 0.04);
	if (fireTimeSeconds <= state.simTimeSeconds + 0.01) {
		fireImmediatePurpleMissile(state, enemy, cueTimeSeconds);
		return;
	}

	insertPlannedPurpleMissileShot(state, {
		cueTimeSeconds,
		enemyId: enemy.id,
		fireTimeSeconds,
	});
}

function solvePurpleMissileFireTime(
	state: SimulationState,
	enemy: Enemy,
	cueTimeSeconds: number,
): number | null {
	const dtCue = cueTimeSeconds - state.simTimeSeconds;
	if (dtCue <= 0.03) {
		return null;
	}

	const enemyAtCue = predictEnemyPosition(enemy, dtCue);
	const shipAtNowX = state.shipX + PURPLE_MISSILE_LAUNCH_OFFSET_X;
	const shipAtNowY = state.shipY;
	const straightDistance = Math.hypot(
		enemyAtCue.x - shipAtNowX,
		enemyAtCue.y - shipAtNowY,
	);
	const travelSeconds = clamp(
		(straightDistance / PURPLE_MISSILE_BASE_SPEED) * PURPLE_MISSILE_LEAD_SCALE,
		PURPLE_MISSILE_MIN_LEAD_SECONDS,
		PURPLE_MISSILE_MAX_LEAD_SECONDS,
	);
	const fireTimeSeconds = cueTimeSeconds - travelSeconds;

	if (
		fireTimeSeconds <= state.simTimeSeconds ||
		fireTimeSeconds >= cueTimeSeconds - 0.02
	) {
		return null;
	}
	return fireTimeSeconds;
}

function fireImmediatePurpleMissile(
	state: SimulationState,
	enemy: Enemy,
	cueTimeSeconds: number,
): void {
	if (!state.combatConfig.shipWeapons.purpleMissile) {
		return;
	}

	spawnPurpleMissile(state, enemy, cueTimeSeconds);
	enemy.damageFlash = Math.max(enemy.damageFlash, 0.25);
}

function fireQueuedPurpleMissiles(state: SimulationState): void {
	const plannedShots = state.plannedPurpleMissileShots;
	if (plannedShots.length === 0) {
		return;
	}

	let processedCount = 0;
	while (processedCount < plannedShots.length) {
		const shot = plannedShots[processedCount];
		if (shot.fireTimeSeconds > state.simTimeSeconds) {
			break;
		}

		if (state.combatConfig.shipWeapons.purpleMissile) {
			const enemy = state.enemies.find(
				(candidate) => candidate.id === shot.enemyId,
			);
			if (enemy) {
				spawnPurpleMissile(state, enemy, shot.cueTimeSeconds);
				enemy.damageFlash = Math.max(enemy.damageFlash, 0.25);
			}
		}
		processedCount += 1;
	}

	if (processedCount > 0) {
		plannedShots.splice(0, processedCount);
	}
}

function spawnPurpleMissile(
	state: SimulationState,
	enemy: Enemy,
	cueTimeSeconds: number,
): void {
	const shipX = state.shipX + PURPLE_MISSILE_LAUNCH_OFFSET_X;
	const shipY = state.shipY;
	const loopDirection = state.rng() < 0.5 ? -1 : 1;
	const loopTurns =
		PURPLE_MISSILE_LOOP_MIN_TURNS +
		state.rng() *
			(PURPLE_MISSILE_LOOP_MAX_TURNS - PURPLE_MISSILE_LOOP_MIN_TURNS);
	const cueLeadSeconds = Math.max(0.02, cueTimeSeconds - state.simTimeSeconds);
	const targetAtCue = predictEnemyPosition(enemy, cueLeadSeconds);
	const targetX = targetAtCue.x;
	const targetY = targetAtCue.y;
	const dir = normalizeDirection(targetX - shipX, targetY - shipY);
	const launchSpeed = PURPLE_MISSILE_BASE_SPEED;
	const maxLifetimeSeconds = clamp(
		cueLeadSeconds + PURPLE_MISSILE_SIM_BUFFER_SECONDS,
		0.52,
		1.5,
	);

	state.missiles.push({
		id: state.nextMissileId++,
		x: shipX,
		y: shipY,
		z: 0,
		vx: dir.x * launchSpeed,
		vy: dir.y * launchSpeed,
		ageSeconds: 0,
		maxLifetimeSeconds,
		launchX: shipX,
		launchY: shipY,
		targetEnemyId: enemy.id,
		targetX,
		targetY,
		cueTimeSeconds,
		loopTurns,
		loopDirection,
		pathVariant: state.rng(),
	});
}

function insertPlannedPurpleMissileShot(
	state: SimulationState,
	shot: PlannedPurpleMissileShot,
): void {
	const planned = state.plannedPurpleMissileShots;
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
