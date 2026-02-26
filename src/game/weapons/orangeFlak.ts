import type { SimulationState } from "../types";
import { clamp, normalizeDirection } from "../utils";
import { queueCueShotForEnemy } from "./cueShots";
import type { CueShotFireParams, CueShotImmediateParams, WeaponModule } from "./types";

const ORANGE_FLAK_PELLET_COUNT_MIN = 5;
const ORANGE_FLAK_PELLET_COUNT_MAX = 8;
const ORANGE_FLAK_CONE_HALF_ANGLE = 0.26;
const ORANGE_FLAK_SPEED_BASE = 20;
const ORANGE_FLAK_SPEED_VARIATION = 2.5;
const ORANGE_FLAK_LIFETIME_SECONDS = 0.28;
const ORANGE_FLAK_PELLET_RADIUS = 0.11;

export const orangeFlakModule: WeaponModule = {
	id: "orange",
	assignmentWeight: 2,
	isEnabled: (state) => state.combatConfig.shipWeapons.orangeFlak,
	planCue(state, enemy, cueTimeSeconds) {
		queueCueShotForEnemy(
			state,
			enemy,
			cueTimeSeconds,
			"orange",
			fireImmediateOrangeCueShot,
		);
	},
	getCatchupLeadSeconds: (_state, baseLeadSeconds) =>
		clamp(baseLeadSeconds * 0.75, 0.12, 0.38),
	fireQueuedShot: fireQueuedOrangeShot,
};

function fireImmediateOrangeCueShot(
	state: SimulationState,
	params: CueShotImmediateParams,
): void {
	fireFlakBurst(
		state,
		params.shipX,
		params.shipY,
		params.dirX,
		params.dirY,
		ORANGE_FLAK_LIFETIME_SECONDS,
	);
}

function fireQueuedOrangeShot(
	state: SimulationState,
	params: CueShotFireParams,
): void {
	const dir = normalizeDirection(params.dx, params.dy);
	fireFlakBurst(
		state,
		params.shipX,
		params.shipY,
		dir.x,
		dir.y,
		params.leadSeconds + 0.06,
	);
}

function fireFlakBurst(
	state: SimulationState,
	shipX: number,
	shipY: number,
	baseDirX: number,
	baseDirY: number,
	maxLifetimeSeconds: number,
): void {
	const pelletCount =
		ORANGE_FLAK_PELLET_COUNT_MIN +
		Math.floor(
			state.rng() *
				(ORANGE_FLAK_PELLET_COUNT_MAX - ORANGE_FLAK_PELLET_COUNT_MIN + 1),
		);

	const baseAngle = Math.atan2(baseDirY, baseDirX);

	for (let i = 0; i < pelletCount; i += 1) {
		const t = pelletCount <= 1 ? 0 : (i / (pelletCount - 1)) * 2 - 1;
		const angleOffset =
			t * ORANGE_FLAK_CONE_HALF_ANGLE +
			(state.rng() - 0.5) * ORANGE_FLAK_CONE_HALF_ANGLE * 0.3;
		const pelletAngle = baseAngle + angleOffset;

		const speedVariation =
			(state.rng() - 0.5) * 2 * ORANGE_FLAK_SPEED_VARIATION;
		const pelletSpeed = ORANGE_FLAK_SPEED_BASE + speedVariation;

		state.projectiles.push({
			id: state.nextProjectileId++,
			x: shipX,
			y: shipY,
			z: 0,
			vx: Math.cos(pelletAngle) * pelletSpeed,
			vy: Math.sin(pelletAngle) * pelletSpeed,
			ageSeconds: 0,
			maxLifetimeSeconds: clamp(
				maxLifetimeSeconds,
				0.12,
				ORANGE_FLAK_LIFETIME_SECONDS + 0.06,
			),
			radius: ORANGE_FLAK_PELLET_RADIUS,
			isCueShot: false,
			isFlak: true,
		});
	}
}
