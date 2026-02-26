import {
	type CombatConfig,
	type CombatConfigPatch,
	DEFAULT_COMBAT_CONFIG,
	ENEMY_ARCHETYPE_DEFINITIONS,
	type EnemyArchetypeDefinition,
	type EnemyArchetypeId,
	normalizeCombatConfig,
	sanitizeEnabledArchetypes,
} from "./combatConfig";
import { spawnAmbientEnemyWave as spawnAmbientEnemyWaveForArchetype } from "./enemies/registry";
import { createDefaultModules } from "./modules/defaultModules";
import { createModuleRunner } from "./modules/runner";
import type { SimulationModule } from "./modules/types";
import type {
	CombatPressureTuning,
	CueWeaponId,
	Enemy,
	EnemyProjectile,
	ScheduledCue,
	SimulationState,
} from "./types";
import {
	clamp,
	createMulberry32,
	findBestTarget,
	getEnemyById,
	getIntensityAtTime,
	getRelativeIntensityAtTime,
	isPlayerTargetViable,
	moodParameters,
	normalizeSeed,
	predictEnemyPosition,
	predictShipPosition,
	resolveEnemyPatternY,
	samplePercentile,
} from "./utils";
import { LASER_MAX_TARGET_X } from "./constants";
import { fireQueuedCueShots, PLAYER_PROJECTILE_SPEED } from "./weapons/cueShots";
import {
	getEnabledWeaponModules,
	getWeaponModule,
	getWeaponModules,
	isWeaponEnabled,
	selectCueWeaponForAssignment,
} from "./weapons/registry";
import { updateMissiles } from "./weapons/purpleMissile";

export type Simulation = import("./types").Simulation;
export type SimulationSnapshot = import("./types").SimulationSnapshot;

export type SimulationOptions = {
	modules?: SimulationModule[];
};

const CUE_ASSIGN_MIN_LEAD_SECONDS = 0.2;
const CUE_ASSIGN_MAX_LEAD_SECONDS = 0.8;
const CUE_SUPPORT_LEAD_PADDING_SECONDS = 0.55;
const MAX_CUE_SUPPORT_SPAWNS_PER_STEP = 12;
const MAX_CATCHUP_CUES_PER_STEP = 7;
const PLAYER_TARGET_HARD_DISTANCE_X = 12.6;
const ENEMY_PROJECTILE_LASER_SPEED_MULTIPLIER = 2.2;
const LASER_BEAM_LIFETIME_SECONDS = 0.26;
const MIN_ENEMY_SURVIVAL_SECONDS = 1.25;
const SHIP_MIN_X = -19.8;
const SHIP_MAX_X = 19.8;
const SHIP_MIN_Y = -11.2;
const SHIP_MAX_Y = 11.2;
const SHIP_MAX_SPEED_X = 6.4;
const SHIP_MAX_SPEED_Y = 8.3;
const SHIP_ACCEL_X = 14.5;
const SHIP_ACCEL_Y = 17.5;
const SHIP_RETARGET_MIN_SECONDS = 0.18;
const SHIP_RETARGET_MAX_SECONDS = 0.46;
const SHIP_THREAT_HORIZON_SECONDS = 1.15;
const SHIP_SAFE_RADIUS = 1.25;
const SHIP_PANIC_THRESHOLD = 1.2;
const SHIP_COLLISION_RADIUS = 0.7;
const SHIP_ESCAPE_HORIZON_SECONDS = 1.05;
const SHIP_ESCAPE_STEP_SECONDS = 1 / 15;
const SHIP_ESCAPE_NEAR_MISS_RADIUS = 2.4;
const SHIP_EDGE_AVOIDANCE_BUFFER = 0.05;
const SHIP_EDGE_AVOIDANCE_PENALTY = 0.45;
const SHIP_EDGE_AVOIDANCE_BUFFER_X = 0.08;
const SHIP_EDGE_AVOIDANCE_PENALTY_X = 0.35;
const SHIP_EDGE_BREAKOUT_BAND = 0.85;
const SHIP_EDGE_BREAKOUT_THREAT_MIN = 0.55;
const SHIP_EDGE_BREAKOUT_TRIGGER_SECONDS = 0.5;
const SHIP_EDGE_BREAKOUT_HOLD_SECONDS = 0.45;
const SHIP_PRE_BREAKOUT_TRIGGER_FRACTION = 0.5;
const SHIP_CENTER_BIAS_THREAT_LOW = 0.25;
const SHIP_CENTER_BIAS_THREAT_HIGH = 1.1;
const SHIP_CENTER_BIAS_X_STRENGTH = 0.72;
const SHIP_CENTER_BIAS_Y_STRENGTH = 0.9;
const SHIP_EDGE_APPROACH_BUFFER_Y = 2.35;
const SHIP_EDGE_APPROACH_BUFFER_X = 2.9;
const SHIP_EDGE_APPROACH_PENALTY_Y = 1.15;
const SHIP_EDGE_APPROACH_PENALTY_X = 0.62;
const SHIP_EDGE_RETURN_COOLDOWN_SECONDS = 2.3;
const SHIP_EDGE_RETURN_BAND_Y = 7.4;
const SHIP_EDGE_RETURN_PENALTY = 1.7;
const SHIP_ENEMY_THREAT_HORIZON_SECONDS = 1.05;
const SHIP_ENEMY_SAFE_RADIUS = 1.45;
const SHIP_ENEMY_ESCAPE_NEAR_MISS_RADIUS = 2.65;
const SHIP_ENEMY_COLLISION_COST = 6200;
const SHIP_ENEMY_NEAR_MISS_COST = 1.55;
const ENEMY_EDGE_AIM_RELAX_DISTANCE_Y = 3.2;
const ENEMY_EDGE_AIM_RELAX_MAX_LAG_SECONDS = 0.12;
const ENEMY_EDGE_AIM_RELAX_MAX_JITTER = 0.45;
const ENEMY_EDGE_PRESSURE_WINDOW_X = 8.2;
const ENEMY_EDGE_PRESSURE_WINDOW_Y = 3.6;
const ENEMY_EDGE_PRESSURE_PROJECTILE_CAP = 8;
const ENEMY_EDGE_PRESSURE_EXTRA_SPREAD = 0.11;
const ENEMY_INTENSITY_SPAWN_BOOST = 0.08;
const ENEMY_INTENSITY_FIRE_COOLDOWN_BOOST = 0.1;
const ENEMY_BULLET_RATE_BASE = 2.05;
const ENEMY_BULLET_RATE_INTENSITY_GAIN = 3.15;
const ENEMY_BULLET_RATE_MAX = 10.9;
const ENEMY_BULLET_BUDGET_WINDOW_SECONDS = 0.68;
const ENEMY_FIRE_COOLDOWN_MULTIPLIER = 1.25;

export function createSimulation(options: SimulationOptions = {}): Simulation {
	const state: SimulationState = {
		simTimeSeconds: 0,
		simTick: 0,
		shipX: -6,
		shipY: 0,
		shipVx: 0,
		shipVy: 0,
		shipTargetX: -6,
		shipTargetY: 0,
		nextShipRetargetTime: 0,
		lockedTargetEnemyId: null,
		targetLockUntilSeconds: 0,
		lastPlayerAimX: 1,
		lastPlayerAimY: 0,
		edgeDwellSeconds: 0,
		edgeBreakoutSeconds: 0,
		recentEdgeSideY: 0,
		recentEdgeCooldownSeconds: 0,
		shipShieldAlpha: 0,
		enemies: [],
		projectiles: [],
		missiles: [],
		enemyProjectiles: [],
		laserBeams: [],
		explosions: [],
		nextEnemySpawnTime: 0.4,
		nextPlayerFireTime: 0.2,
		spawnIndex: 0,
		nextEnemyId: 1,
		nextProjectileId: 1,
		nextMissileId: 1,
		nextEnemyProjectileId: 1,
		enemyBulletBudget: 0,
		enemyBulletRatio: 1,
		enemyFireSelectionCursor: 0,
		cueWeaponCursor: 0,
		combatConfig: normalizeCombatConfig(undefined),
		activeEnemyArchetypes: sanitizeEnabledArchetypes(
			DEFAULT_COMBAT_CONFIG.enemyRoster.enabledArchetypes,
		),
		nextLaserFireTime: 0,
		cueTimeline: [],
		cueStartOffsetSeconds: 0,
		cueResolvedCount: 0,
		cueMissedCount: 0,
		cumulativeCueErrorMs: 0,
		plannedCueShots: [],
		plannedPurpleMissileShots: [],
		score: 0,
		combo: 0,
		intensityTimeline: [],
		intensityFloor: 0,
		intensityCeil: 1,
		moodProfile: "driving",
		randomSeed: 7,
		rng: createMulberry32(7),
	};
	const modules =
		options.modules ??
		createDefaultModules({
			shipMotion: updateShipMotion,
			enemySpawns: stepEnemySpawns,
			cuePlanning: stepCuePlanning,
			weaponFire: stepWeaponFire,
			enemyUpdates: stepEnemyUpdates,
			projectileUpdates: stepProjectileUpdates,
			collisionResolution: stepCollisionResolution,
			cleanup: stepCleanup,
		});
	const moduleRunner = createModuleRunner(modules);
	moduleRunner.init(state);

	return {
		step(deltaSeconds: number) {
			state.simTimeSeconds += deltaSeconds;
			state.simTick += 1;
			moduleRunner.step(state, deltaSeconds);
		},
		getSnapshot() {
			return {
				simTimeSeconds: state.simTimeSeconds,
				simTick: state.simTick,
				ship: {
					x: state.shipX,
					y: state.shipY,
					z: 0,
				},
				enemyCount: state.enemies.length,
				projectileCount:
					state.projectiles.length +
					state.missiles.length +
					state.enemyProjectiles.length,
				enemies: state.enemies.map((enemy) => ({
					x: enemy.x,
					y: enemy.y,
					z: enemy.z,
					rotationZ:
						enemy.phase +
						enemy.ageSeconds * (enemy.archetype === "greenTriangle" ? 5.2 : 2),
					damageFlash: enemy.damageFlash,
					archetype: enemy.archetype,
				})),
				projectiles: state.projectiles.map((projectile) => ({
					id: projectile.id,
					x: projectile.x,
					y: projectile.y,
					z: projectile.z,
					rotationZ: Math.atan2(projectile.vy, projectile.vx),
					isCueShot: projectile.isCueShot,
					isFlak: projectile.isFlak,
				})),
				missiles: state.missiles.map((missile) => {
					return {
						id: missile.id,
						x: missile.x,
						y: missile.y,
						z: missile.z,
						rotationZ: Math.atan2(missile.vy, missile.vx),
						ageSeconds: missile.ageSeconds,
						maxLifetimeSeconds: missile.maxLifetimeSeconds,
						launchX: missile.launchX,
						launchY: missile.launchY,
						targetX: missile.targetX,
						targetY: missile.targetY,
						cueTimeSeconds: missile.cueTimeSeconds,
						loopDirection: missile.loopDirection,
						loopTurns: missile.loopTurns,
						pathVariant: missile.pathVariant,
					};
				}),
				enemyProjectiles: state.enemyProjectiles.map((projectile) => ({
					id: projectile.id,
					x: projectile.x,
					y: projectile.y,
					z: projectile.z,
					rotationZ: Math.atan2(projectile.vy, projectile.vx),
				})),
				laserBeams: state.laserBeams.map((beam) => ({
					fromX: beam.fromX,
					fromY: beam.fromY,
					toX: beam.toX,
					toY: beam.toY,
					alpha: 1 - beam.ageSeconds / Math.max(beam.lifetimeSeconds, 1e-6),
				})),
				explosions: state.explosions.map((explosion) => {
					const normalizedAge =
						explosion.ageSeconds / Math.max(explosion.lifetimeSeconds, 1e-6);
					return {
						x: explosion.x,
						y: explosion.y,
						z: explosion.z,
						scale: 0.5 + normalizedAge * 1.5,
						alpha: 1 - normalizedAge,
						variant: explosion.variant,
						power: explosion.power,
					};
				}),
				shieldAlpha: state.shipShieldAlpha,
				cueResolvedCount: state.cueResolvedCount,
				cueMissedCount: state.cueMissedCount,
				avgCueErrorMs:
					state.cueResolvedCount > 0
						? state.cumulativeCueErrorMs / state.cueResolvedCount
						: 0,
				currentIntensity: getIntensityAtTime(state, state.simTimeSeconds),
				score: state.score,
				combo: state.combo,
				pendingCueCount: state.cueTimeline.length,
				plannedCueCount: countPlannedCues(state.cueTimeline),
				queuedCueShotCount: state.plannedCueShots.length,
				upcomingCueWindowCount: countUpcomingCueWindow(state),
				availableCueTargetCount: countAvailableCueTargets(state),
				moodProfile: state.moodProfile,
				purpleMissileEnabled: isWeaponEnabled(state, "purple"),
				enemyProjectileStyle:
					state.combatConfig.enemyRoster.enemyProjectileStyle,
			};
		},
		setCueTimeline(cueTimesSeconds) {
			state.cueStartOffsetSeconds = state.simTimeSeconds;
			state.cueResolvedCount = 0;
			state.cueMissedCount = 0;
			state.cumulativeCueErrorMs = 0;
			state.plannedCueShots = [];
			state.plannedPurpleMissileShots = [];
			for (const enemy of state.enemies) {
				enemy.scheduledCueTime = null;
				enemy.cuePrimed = false;
				enemy.damageFlash = 0;
			}
			state.cueTimeline = cueTimesSeconds
				.filter((time) => Number.isFinite(time) && time >= 0)
				.map((time) => ({
					timeSeconds: state.cueStartOffsetSeconds + time,
					planned: false,
					assignedEnemyId: null,
					assignedWeapon: null,
				}));
			state.cueWeaponCursor = 0;
		},
		startTrackRun(cueTimesSeconds) {
			resetRunState(state);
			moduleRunner.reset(state);
			state.cueTimeline = cueTimesSeconds
				.filter((time) => Number.isFinite(time) && time >= 0)
				.map((time) => ({
					timeSeconds: time,
					planned: false,
					assignedEnemyId: null,
					assignedWeapon: null,
				}));
			state.cueWeaponCursor = 0;
		},
		setIntensityTimeline(samples) {
			state.intensityTimeline = samples
				.filter((sample) => Number.isFinite(sample.timeSeconds))
				.map((sample) => ({
					timeSeconds: Math.max(0, sample.timeSeconds),
					intensity: clamp(sample.intensity, 0, 1),
				}))
				.sort((a, b) => a.timeSeconds - b.timeSeconds);

			const intensities = state.intensityTimeline.map(
				(sample) => sample.intensity,
			);
			if (intensities.length === 0) {
				state.intensityFloor = 0;
				state.intensityCeil = 1;
				return;
			}

			intensities.sort((a, b) => a - b);
			const p08 = samplePercentile(intensities, 0.08);
			const p92 = samplePercentile(intensities, 0.92);
			const min = intensities[0];
			const max = intensities[intensities.length - 1];
			if (p92 - p08 > 0.06) {
				state.intensityFloor = p08;
				state.intensityCeil = p92;
			} else {
				state.intensityFloor = min;
				state.intensityCeil = Math.max(min + 0.05, max);
			}
		},
		setRandomSeed(seed) {
			const normalized = normalizeSeed(seed);
			state.randomSeed = normalized;
			state.rng = createMulberry32(normalized);
		},
		setMoodProfile(mood) {
			state.moodProfile = mood;
		},
		setEnemyBulletRatio(ratio) {
			const normalizedRatio = clamp(ratio, 0, 4);
			state.enemyBulletRatio = normalizedRatio;
			if (normalizedRatio <= 0) {
				state.enemyBulletBudget = 0;
			}
		},
		setShipWeapons(weapons) {
			applyCombatConfigPatch(state, { shipWeapons: weapons });
		},
		setEnemyRoster(roster) {
			applyCombatConfigPatch(state, { enemyRoster: roster });
		},
		setCombatConfig(config) {
			applyCombatConfigPatch(state, config);
		},
	};
}

function stepEnemySpawns(state: SimulationState): void {
	spawnEnemies(state);
}

function stepCuePlanning(state: SimulationState): void {
	planCueShots(state);
	planCatchupCueKills(state);
}

function stepWeaponFire(state: SimulationState, deltaSeconds: number): void {
	fireQueuedCueShots(
		state,
		getWeaponModule,
		(weaponId: CueWeaponId) => isWeaponEnabled(state, weaponId),
	);
	for (const module of getWeaponModules()) {
		module.fireQueued?.(state);
	}
	for (const module of getWeaponModules()) {
		module.step?.(state, deltaSeconds);
	}
}

function stepEnemyUpdates(state: SimulationState, deltaSeconds: number): void {
	updateEnemies(state, deltaSeconds);
}

function stepProjectileUpdates(
	state: SimulationState,
	deltaSeconds: number,
): void {
	updateProjectiles(state, deltaSeconds);
	updateMissiles(state, deltaSeconds);
	updateEnemyProjectiles(state, deltaSeconds);
	updateLaserBeams(state, deltaSeconds);
	updateExplosions(state, deltaSeconds);
}

function stepCollisionResolution(state: SimulationState): void {
	resolvePlayerProjectileCollisions(state);
	resolveEnemyProjectileShipCollisions(state);
	resolveDueCueExplosions(state);
}

function stepCleanup(state: SimulationState, deltaSeconds: number): void {
	state.shipShieldAlpha = Math.max(0, state.shipShieldAlpha - deltaSeconds * 2.8);
	state.enemies = state.enemies.filter(
		(enemy) => enemy.x > -16 || enemy.scheduledCueTime !== null,
	);
	state.projectiles = state.projectiles.filter(
		(projectile) =>
			projectile.x > -15 &&
			projectile.x < 20 &&
			Math.abs(projectile.y) < 11,
	);
	state.enemyProjectiles = state.enemyProjectiles.filter(
		(projectile) =>
			projectile.x > -18 &&
			projectile.x < 16 &&
			Math.abs(projectile.y) < 11,
	);
	state.explosions = state.explosions.filter(
		(explosion) => explosion.ageSeconds < explosion.lifetimeSeconds,
	);
}

function resetRunState(state: SimulationState): void {
	state.simTimeSeconds = 0;
	state.simTick = 0;
	state.shipX = -6;
	state.shipY = 0;
	state.shipVx = 0;
	state.shipVy = 0;
	state.shipTargetX = -6;
	state.shipTargetY = 0;
	state.nextShipRetargetTime = 0;
	state.lockedTargetEnemyId = null;
	state.targetLockUntilSeconds = 0;
	state.lastPlayerAimX = 1;
	state.lastPlayerAimY = 0;
	state.edgeDwellSeconds = 0;
	state.edgeBreakoutSeconds = 0;
	state.recentEdgeSideY = 0;
	state.recentEdgeCooldownSeconds = 0;
	state.shipShieldAlpha = 0;
	state.enemies = [];
	state.projectiles = [];
	state.missiles = [];
	state.enemyProjectiles = [];
	state.laserBeams = [];
	state.explosions = [];
	state.nextEnemySpawnTime = 0.4;
	state.nextPlayerFireTime = 0.2;
	state.spawnIndex = 0;
	state.nextEnemyId = 1;
	state.nextProjectileId = 1;
	state.nextMissileId = 1;
	state.nextEnemyProjectileId = 1;
	state.enemyBulletBudget = 0;
	state.enemyFireSelectionCursor = 0;
	state.cueWeaponCursor = 0;
	state.activeEnemyArchetypes = sanitizeEnabledArchetypes(
		state.combatConfig.enemyRoster.enabledArchetypes,
	);
	state.nextLaserFireTime = 0;
	state.cueResolvedCount = 0;
	state.cueMissedCount = 0;
	state.cumulativeCueErrorMs = 0;
	state.plannedCueShots = [];
	state.plannedPurpleMissileShots = [];
	state.score = 0;
	state.combo = 0;
	state.cueStartOffsetSeconds = 0;
	state.moodProfile = "driving";
	state.rng = createMulberry32(state.randomSeed);
}

function applyCombatConfigPatch(
	state: SimulationState,
	patch: CombatConfigPatch,
): void {
	state.combatConfig = normalizeCombatConfig(patch, state.combatConfig);
	state.activeEnemyArchetypes = sanitizeEnabledArchetypes(
		state.combatConfig.enemyRoster.enabledArchetypes,
	);
}

function getCombatPressureTuning(state: SimulationState): CombatPressureTuning {
	let spawnScale = state.combatConfig.enemyRoster.spawnScale;
	let enemyFireScale = state.combatConfig.enemyRoster.fireScale;
	const cleanupEnabled = isWeaponEnabled(state, "green");
	const primaryEnabled = isWeaponEnabled(state, "blue");
	const cueEnabled = isWeaponEnabled(state, "yellow");
	const purpleEnabled = isWeaponEnabled(state, "purple");
	const orangeEnabled = isWeaponEnabled(state, "orange");

	if (!cleanupEnabled) {
		spawnScale *= 0.9;
		enemyFireScale *= 0.92;
	}
	if (!primaryEnabled) {
		spawnScale *= 0.82;
		enemyFireScale *= 0.88;
	}
	if (!cueEnabled) {
		spawnScale *= 0.9;
	}
	if (!purpleEnabled) {
		spawnScale *= 0.93;
	}
	if (!orangeEnabled) {
		spawnScale *= 0.92;
	}

	const purpleOnlyLoadout =
		purpleEnabled && !primaryEnabled && !cueEnabled && !cleanupEnabled && !orangeEnabled;
	if (purpleOnlyLoadout) {
		spawnScale *= 0.72;
		enemyFireScale *= 0.8;
	}

	const loadoutKillScale = getLoadoutKillScale(state);
	spawnScale *= loadoutKillScale;
	enemyFireScale *= 0.82 + loadoutKillScale * 0.28;

	return {
		spawnScale: clamp(spawnScale, 0.45, 2.4),
		enemyFireScale: clamp(enemyFireScale, 0.45, 2.4),
	};
}

function getLoadoutKillScale(state: SimulationState): number {
	let capacity = 0;
	if (isWeaponEnabled(state, "blue")) {
		capacity += 1.5;
	}
	if (isWeaponEnabled(state, "yellow")) {
		capacity += 1;
	}
	if (isWeaponEnabled(state, "green")) {
		capacity += 0.9;
	}
	if (isWeaponEnabled(state, "purple")) {
		capacity += 1.35;
	}
	if (isWeaponEnabled(state, "orange")) {
		capacity += 1.15;
	}
	return clamp(capacity / 5.6, 0.38, 1.05);
}

function pickEnemyArchetype(
	state: SimulationState,
	filter: ((archetypeId: EnemyArchetypeId) => boolean) | null = null,
): EnemyArchetypeId {
	const filtered = filter
		? state.activeEnemyArchetypes.filter(filter)
		: state.activeEnemyArchetypes;
	const enabled = filtered.length > 0 ? filtered : state.activeEnemyArchetypes;
	if (enabled.length === 0) {
		return "redCube";
	}

	let totalWeight = 0;
	for (const archetypeId of enabled) {
		totalWeight += getEnemyArchetypeDefinition(archetypeId).spawnWeight;
	}
	if (totalWeight <= 1e-6) {
		return enabled[0];
	}

	let roll = state.rng() * totalWeight;
	for (const archetypeId of enabled) {
		roll -= getEnemyArchetypeDefinition(archetypeId).spawnWeight;
		if (roll <= 0) {
			return archetypeId;
		}
	}

	return enabled[enabled.length - 1];
}

function pickShootCapableEnemyArchetype(
	state: SimulationState,
): EnemyArchetypeId {
	const hasShootCapableArchetype = state.activeEnemyArchetypes.some(
		(archetypeId) => getEnemyArchetypeDefinition(archetypeId).canShoot,
	);
	if (!hasShootCapableArchetype) {
		return "redCube";
	}
	return pickEnemyArchetype(
		state,
		(archetypeId) => getEnemyArchetypeDefinition(archetypeId).canShoot,
	);
}

function getEnemyArchetypeDefinition(
	archetypeId: EnemyArchetypeId,
): EnemyArchetypeDefinition {
	return ENEMY_ARCHETYPE_DEFINITIONS[archetypeId];
}

function spawnEnemies(state: SimulationState): void {
	while (state.simTimeSeconds >= state.nextEnemySpawnTime) {
		const spawnedCount = spawnAmbientEnemyWave(state);
		state.spawnIndex += spawnedCount;
		const intensity = getIntensityAtTime(state, state.simTimeSeconds);
		const mood = moodParameters(state.moodProfile);
		const combatTuning = getCombatPressureTuning(state);
		const cadence = (0.9 - intensity * 0.5) * mood.spawnIntervalScale;
		const intensitySpawnMultiplier =
			1 - intensity * ENEMY_INTENSITY_SPAWN_BOOST;
		const formationCadenceMultiplier = 1 + Math.max(0, spawnedCount - 1) * 0.4;
		state.nextEnemySpawnTime += clamp(
			(((cadence + state.rng() * 0.35) * intensitySpawnMultiplier) /
				combatTuning.spawnScale) *
				formationCadenceMultiplier,
			0.22,
			1.45,
		);
	}

	ensureCueSupportEnemies(state);
}

function spawnAmbientEnemyWave(state: SimulationState): number {
	const archetype = pickEnemyArchetype(state);
	return spawnAmbientEnemyWaveForArchetype(state, archetype);
}

function updateEnemies(state: SimulationState, deltaSeconds: number): void {
	const intensity = getIntensityAtTime(state, state.simTimeSeconds);
	const mood = moodParameters(state.moodProfile);
	const combatTuning = getCombatPressureTuning(state);
	const readyToFire: Enemy[] = [];

	for (const enemy of state.enemies) {
		enemy.ageSeconds += deltaSeconds;
		enemy.x += enemy.vx * deltaSeconds;
		enemy.y = resolveEnemyPatternY(enemy, enemy.ageSeconds);

		enemy.damageFlash = Math.max(0, enemy.damageFlash - deltaSeconds * 8);
		if (!enemy.hasEnteredView && enemy.x <= LASER_MAX_TARGET_X) {
			enemy.hasEnteredView = true;
		}
		enemy.fireCooldownSeconds -= deltaSeconds;
		const archetypeDef = getEnemyArchetypeDefinition(enemy.archetype);
		if (!archetypeDef.canShoot) {
			continue;
		}
		if (enemy.fireCooldownSeconds <= 0 && enemy.x > state.shipX + 2.5) {
			readyToFire.push(enemy);
		}
	}

	replenishEnemyBulletBudget(
		state,
		deltaSeconds,
		intensity,
		mood,
		combatTuning,
	);
	if (readyToFire.length === 0 || state.enemyBulletBudget < 1) {
		return;
	}

	const startIndex = state.enemyFireSelectionCursor % readyToFire.length;
	let firedEnemies = 0;
	for (let offset = 0; offset < readyToFire.length; offset += 1) {
		if (state.enemyBulletBudget < 1) {
			break;
		}

		const enemy = readyToFire[(startIndex + offset) % readyToFire.length];
		const desiredBurstCount = getEnemyBurstCount(intensity);
		const burstCount = Math.min(
			desiredBurstCount,
			Math.max(1, Math.floor(state.enemyBulletBudget)),
		);
		fireEnemyBurst(state, enemy, burstCount);
		state.enemyBulletBudget = Math.max(0, state.enemyBulletBudget - burstCount);
		const fireCadenceIntensityMultiplier =
			enemyFireIntensityMultiplier(intensity);
		enemy.fireCooldownSeconds =
			((0.28 + (1 - intensity) * 0.52 + state.rng() * 0.32) *
				mood.enemyFireIntervalScale *
				ENEMY_FIRE_COOLDOWN_MULTIPLIER *
				fireCadenceIntensityMultiplier) /
			combatTuning.enemyFireScale;
		firedEnemies += 1;
	}

	state.enemyFireSelectionCursor =
		(startIndex + firedEnemies) % readyToFire.length;
}

function replenishEnemyBulletBudget(
	state: SimulationState,
	deltaSeconds: number,
	intensity: number,
	mood: {
		enemyBulletRateScale: number;
	},
	combatTuning: CombatPressureTuning,
): void {
	const bulletsPerSecond = clamp(
		(ENEMY_BULLET_RATE_BASE + intensity * ENEMY_BULLET_RATE_INTENSITY_GAIN) *
			mood.enemyBulletRateScale *
			state.enemyBulletRatio *
			combatTuning.enemyFireScale,
		0,
		ENEMY_BULLET_RATE_MAX,
	);
	const maxBudget = bulletsPerSecond * ENEMY_BULLET_BUDGET_WINDOW_SECONDS;
	state.enemyBulletBudget = Math.min(
		maxBudget,
		state.enemyBulletBudget + bulletsPerSecond * deltaSeconds,
	);
}

function getEnemyBurstCount(intensity: number): number {
	if (intensity > 0.72) {
		return 3;
	}
	if (intensity > 0.45) {
		return 2;
	}
	return 1;
}

function fireEnemyBurst(
	state: SimulationState,
	enemy: Enemy,
	burstCount: number,
): void {
	const spreadStep = 0.12 + state.rng() * 0.07;
	for (let i = 0; i < burstCount; i += 1) {
		const centeredIndex = i - (burstCount - 1) * 0.5;
		spawnEnemyProjectile(state, enemy, centeredIndex * spreadStep);
	}
}

function enemyFireIntensityMultiplier(intensity: number): number {
	return clamp(1 - intensity * ENEMY_INTENSITY_FIRE_COOLDOWN_BOOST, 0.82, 1);
}

function updateProjectiles(state: SimulationState, deltaSeconds: number): void {
	for (const projectile of state.projectiles) {
		projectile.ageSeconds += deltaSeconds;
		projectile.x += projectile.vx * deltaSeconds;
		projectile.y += projectile.vy * deltaSeconds;
	}
}

function updateEnemyProjectiles(
	state: SimulationState,
	deltaSeconds: number,
): void {
	for (const projectile of state.enemyProjectiles) {
		projectile.ageSeconds += deltaSeconds;
		projectile.x += projectile.vx * deltaSeconds;
		projectile.y += projectile.vy * deltaSeconds;
	}
}

function updateLaserBeams(state: SimulationState, deltaSeconds: number): void {
	for (const beam of state.laserBeams) {
		beam.ageSeconds += deltaSeconds;
	}
	state.laserBeams = state.laserBeams.filter(
		(beam) => beam.ageSeconds < beam.lifetimeSeconds,
	);
}

function updateExplosions(state: SimulationState, deltaSeconds: number): void {
	for (const explosion of state.explosions) {
		explosion.ageSeconds += deltaSeconds;
	}
}

function resolvePlayerProjectileCollisions(state: SimulationState): void {
	const destroyedEnemies = new Set<number>();
	const destroyedProjectiles = new Set<number>();

	for (let p = 0; p < state.projectiles.length; p += 1) {
		const projectile = state.projectiles[p];

		for (let e = 0; e < state.enemies.length; e += 1) {
			if (destroyedEnemies.has(e)) {
				continue;
			}

			const enemy = state.enemies[e];
			const dx = enemy.x - projectile.x;
			const dy = enemy.y - projectile.y;
			const radius = enemy.radius + projectile.radius;
			if (dx * dx + dy * dy <= radius * radius) {
				if (enemy.scheduledCueTime !== null) {
					enemy.cuePrimed = true;
					enemy.damageFlash = 1;
					destroyedProjectiles.add(p);
					break;
				}

				destroyedEnemies.add(e);
				destroyedProjectiles.add(p);
				spawnExplosion(state, enemy.x, enemy.y, enemy.z);
				break;
			}
		}
	}

	if (destroyedEnemies.size > 0) {
		state.enemies = state.enemies.filter(
			(_, index) => !destroyedEnemies.has(index),
		);
	}
	if (destroyedProjectiles.size > 0) {
		state.projectiles = state.projectiles.filter(
			(_, index) => !destroyedProjectiles.has(index),
		);
	}
}

function resolveEnemyProjectileShipCollisions(state: SimulationState): void {
	const kept: EnemyProjectile[] = [];

	for (const projectile of state.enemyProjectiles) {
		const dx = projectile.x - state.shipX;
		const dy = projectile.y - state.shipY;
		const radius = projectile.radius + 0.52;
		if (dx * dx + dy * dy <= radius * radius) {
			state.shipShieldAlpha = 1;
			continue;
		}

		kept.push(projectile);
	}

	state.enemyProjectiles = kept;
}

function planCueShots(state: SimulationState): void {
	if (state.cueTimeline.length === 0) {
		return;
	}

	for (const cue of state.cueTimeline) {
		if (cue.planned) {
			continue;
		}

		const leadSeconds = cue.timeSeconds - state.simTimeSeconds;
		if (leadSeconds < CUE_ASSIGN_MIN_LEAD_SECONDS) {
			continue;
		}

		const weapon = selectCueWeaponForAssignment(state);
		if (!weapon) {
			continue;
		}
		const weaponId = weapon.id;

		if (leadSeconds > CUE_ASSIGN_MAX_LEAD_SECONDS) {
			if (leadSeconds <= 2.2) {
				const reserved = spawnReservedCueEnemy(state, cue.timeSeconds);
				cue.planned = true;
				cue.assignedEnemyId = reserved.id;
				cue.assignedWeapon = weaponId;
				weapon.planCue(state, reserved, cue.timeSeconds);
			}
			continue;
		}

		const candidate = findCueCandidate(state, cue.timeSeconds);
		if (!candidate) {
			const reserved = spawnReservedCueEnemy(state, cue.timeSeconds);
			cue.planned = true;
			cue.assignedEnemyId = reserved.id;
			cue.assignedWeapon = weaponId;
			weapon.planCue(state, reserved, cue.timeSeconds);
			continue;
		}

		candidate.enemy.scheduledCueTime = cue.timeSeconds;
		cue.planned = true;
		cue.assignedEnemyId = candidate.enemy.id;
		cue.assignedWeapon = weaponId;
		weapon.planCue(state, candidate.enemy, cue.timeSeconds);
	}
}

function planCatchupCueKills(state: SimulationState): void {
	if (getEnabledWeaponModules(state).length === 0) {
		return;
	}

	let created = 0;
	for (const enemy of state.enemies) {
		if (created >= MAX_CATCHUP_CUES_PER_STEP) {
			break;
		}
		if (enemy.scheduledCueTime !== null || !enemy.hasEnteredView) {
			continue;
		}
		if (enemyAlreadyAssignedToCue(state.cueTimeline, enemy.id)) {
			continue;
		}

		const aheadDistance = enemy.x - state.shipX;
		if (aheadDistance > 8.8 || aheadDistance < -2.5) {
			continue;
		}

		const weapon = selectCueWeaponForAssignment(state);
		if (!weapon) {
			break;
		}

		const shipX = state.shipX + 0.65;
		const shipY = state.shipY;
		const distance = Math.hypot(enemy.x - shipX, enemy.y - shipY);
		const baseLead = clamp(distance / PLAYER_PROJECTILE_SPEED, 0.14, 0.75);
		const cueLeadSeconds = weapon.getCatchupLeadSeconds
			? weapon.getCatchupLeadSeconds(state, baseLead)
			: clamp(baseLead, 0.18, 0.58);
		const cueTimeSeconds = state.simTimeSeconds + cueLeadSeconds;

		enemy.scheduledCueTime = cueTimeSeconds;
		const cue: ScheduledCue = {
			timeSeconds: cueTimeSeconds,
			planned: true,
			assignedEnemyId: enemy.id,
			assignedWeapon: weapon.id,
		};
		insertScheduledCue(state, cue);
		weapon.planCue(state, enemy, cueTimeSeconds);

		created += 1;
	}
}

function insertScheduledCue(state: SimulationState, cue: ScheduledCue): void {
	const insertAt = state.cueTimeline.findIndex(
		(candidate) => candidate.timeSeconds > cue.timeSeconds,
	);
	if (insertAt < 0) {
		state.cueTimeline.push(cue);
	} else {
		state.cueTimeline.splice(insertAt, 0, cue);
	}
}


function spawnReservedCueEnemy(
	state: SimulationState,
	cueTimeSeconds: number,
): Enemy {
	const intensity = getIntensityAtTime(state, state.simTimeSeconds);
	const mood = moodParameters(state.moodProfile);
	const combatTuning = getCombatPressureTuning(state);
	const archetype = pickShootCapableEnemyArchetype(state);
	const archetypeDef = getEnemyArchetypeDefinition(archetype);
	const leadSeconds = Math.max(0.2, cueTimeSeconds - state.simTimeSeconds);
	const shipAtCue = predictShipPosition(state, leadSeconds);
	const spawnX = 21.5 + state.rng() * 3.5;
	const targetX = shipAtCue.x + 6.8 + (state.rng() - 0.5) * 2.2;
	const requiredVx = (targetX - spawnX) / leadSeconds;
	const vx =
		clamp(requiredVx, -6.2, -1.9) *
		mood.enemySpeedScale *
		archetypeDef.speedScale;
	const lane = ((state.spawnIndex + 2) % 5) - 2;
	const laneOffset = lane * 0.82;
	const baseY = clamp(
		shipAtCue.baseY + laneOffset + (state.rng() - 0.5) * 0.45,
		-4.2,
		4.2,
	);
	const enemy: Enemy = {
		id: state.nextEnemyId++,
		archetype,
		x: spawnX,
		y: baseY,
		z: 0,
		vx,
		ageSeconds: 0,
		pattern: state.rng() < 0.5 ? "sine" : state.rng() < 0.75 ? "arc" : "weave",
		baseY,
		phase: state.rng() * Math.PI * 2,
		amplitude: 0.25 + state.rng() * (0.7 + intensity * 0.6),
		frequency: 0.8 + state.rng() * 1.15,
		pathAgeOffsetSeconds: 0,
		radius: 0.44 * archetypeDef.radiusScale,
		fireCooldownSeconds:
			((0.9 + state.rng() * 0.9) *
				mood.enemyFireIntervalScale *
				ENEMY_FIRE_COOLDOWN_MULTIPLIER *
				enemyFireIntensityMultiplier(intensity) *
				archetypeDef.fireCooldownScale) /
			combatTuning.enemyFireScale,
		scheduledCueTime: cueTimeSeconds,
		cuePrimed: false,
		damageFlash: 0,
		hasEnteredView: false,
	};
	state.enemies.push(enemy);
	state.spawnIndex += 1;
	return enemy;
}

function ensureCueSupportEnemies(state: SimulationState): void {
	if (state.cueTimeline.length === 0) {
		return;
	}

	let pendingCueCount = 0;
	for (const cue of state.cueTimeline) {
		if (cue.planned) {
			continue;
		}
		const leadSeconds = cue.timeSeconds - state.simTimeSeconds;
		if (
			leadSeconds >= CUE_ASSIGN_MIN_LEAD_SECONDS &&
			leadSeconds <=
				CUE_ASSIGN_MAX_LEAD_SECONDS + CUE_SUPPORT_LEAD_PADDING_SECONDS
		) {
			pendingCueCount += 1;
		}
	}

	if (pendingCueCount === 0) {
		return;
	}

	let availableEnemyCount = 0;
	for (const enemy of state.enemies) {
		if (enemy.scheduledCueTime !== null) {
			continue;
		}
		if (enemy.x <= state.shipX + 1.2) {
			continue;
		}
		if (enemyAlreadyAssignedToCue(state.cueTimeline, enemy.id)) {
			continue;
		}
		availableEnemyCount += 1;
	}

	const needed = Math.min(
		MAX_CUE_SUPPORT_SPAWNS_PER_STEP,
		Math.max(0, pendingCueCount - availableEnemyCount),
	);
	if (needed === 0) {
		return;
	}

	for (let i = 0; i < needed; i += 1) {
		spawnCueSupportEnemy(state);
	}
}

function spawnCueSupportEnemy(state: SimulationState): void {
	const intensity = getIntensityAtTime(state, state.simTimeSeconds);
	const mood = moodParameters(state.moodProfile);
	const combatTuning = getCombatPressureTuning(state);
	const archetype = pickShootCapableEnemyArchetype(state);
	const archetypeDef = getEnemyArchetypeDefinition(archetype);
	const lane = ((state.spawnIndex + 1) % 5) - 2;
	const baseY = lane * 1.6 + (state.rng() - 0.5) * 0.35;

	state.enemies.push({
		id: state.nextEnemyId++,
		archetype,
		x: 22 + state.rng() * 2.9,
		y: baseY,
		z: 0,
		vx:
			(-2.15 - intensity * 1.2 - state.rng() * 0.6) *
			mood.enemySpeedScale *
			archetypeDef.speedScale,
		ageSeconds: 0,
		pattern:
			state.rng() < 0.5
				? "straight"
				: state.rng() < 0.75
					? "sine"
					: state.rng() < 0.9
						? "zigzag"
						: "weave",
		baseY,
		phase: state.rng() * Math.PI * 2,
		amplitude: 0.2 + state.rng() * 0.65,
		frequency: 0.8 + state.rng() * 0.8,
		pathAgeOffsetSeconds: 0,
		radius: 0.44 * archetypeDef.radiusScale,
		fireCooldownSeconds:
			((0.9 + state.rng() * 0.7) *
				mood.enemyFireIntervalScale *
				ENEMY_FIRE_COOLDOWN_MULTIPLIER *
				enemyFireIntensityMultiplier(intensity) *
				archetypeDef.fireCooldownScale) /
			combatTuning.enemyFireScale,
		scheduledCueTime: null,
		cuePrimed: false,
		damageFlash: 0,
		hasEnteredView: false,
	});

	state.spawnIndex += 1;
}

function resolveDueCueExplosions(state: SimulationState): void {
	if (state.cueTimeline.length === 0) {
		return;
	}

	while (
		state.cueTimeline.length > 0 &&
		state.cueTimeline[0].timeSeconds <= state.simTimeSeconds
	) {
		const cue = state.cueTimeline.shift();
		if (!cue) {
			break;
		}
		const cueErrorMs = Math.abs(state.simTimeSeconds - cue.timeSeconds) * 1000;

		const assignedWeapon = cue.assignedWeapon;
		if (!assignedWeapon || !isWeaponEnabled(state, assignedWeapon)) {
			state.cueMissedCount += 1;
			state.combo = 0;
			continue;
		}

		const targetIndex =
			cue.assignedEnemyId === null
				? -1
				: state.enemies.findIndex((enemy) => enemy.id === cue.assignedEnemyId);

		if (targetIndex < 0) {
			if (assignedWeapon === "purple") {
				state.cueResolvedCount += 1;
				state.cumulativeCueErrorMs += cueErrorMs;
				state.combo += 1;
				state.score += 100 + Math.min(900, state.combo * 10);
				continue;
			}
			state.cueMissedCount += 1;
			state.combo = 0;
			continue;
		}

		const enemy = state.enemies[targetIndex];

		if (assignedWeapon === "green") {
			if (!isWeaponEnabled(state, "green")) {
				state.cueMissedCount += 1;
				state.combo = 0;
			} else {
				spawnLaserBeam(state, enemy.x, enemy.y);
				spawnExplosion(state, enemy.x, enemy.y, enemy.z);
				state.enemies.splice(targetIndex, 1);
				state.cueResolvedCount += 1;
				state.cumulativeCueErrorMs += cueErrorMs;
				state.combo += 1;
				state.score += 100 + Math.min(900, state.combo * 10);
			}
			continue;
		}

		if (assignedWeapon === "purple") {
			enemy.cuePrimed = true;
		}

		const didCueHit = scheduledEnemyHasCueHit(state, enemy);
		if (didCueHit) {
			spawnExplosion(state, enemy.x, enemy.y, enemy.z);
			state.enemies.splice(targetIndex, 1);
			state.cueResolvedCount += 1;
			state.cumulativeCueErrorMs += cueErrorMs;
			state.combo += 1;
			state.score += 100 + Math.min(900, state.combo * 10);
		} else {
			enemy.scheduledCueTime = null;
			enemy.cuePrimed = false;
			state.cueMissedCount += 1;
			state.combo = 0;
		}
	}
}

function spawnLaserBeam(
	state: SimulationState,
	toX: number,
	toY: number,
): void {
	state.laserBeams.push({
		fromX: state.shipX + 0.4,
		fromY: state.shipY,
		toX,
		toY,
		ageSeconds: 0,
		lifetimeSeconds: LASER_BEAM_LIFETIME_SECONDS,
	});
}

function scheduledEnemyHasCueHit(
	state: SimulationState,
	enemy: Enemy,
): boolean {
	if (enemy.cuePrimed) {
		return true;
	}

	const hitRadius = enemy.radius + 0.28;
	const hitRadiusSq = hitRadius * hitRadius;

	for (const projectile of state.projectiles) {
		const dx = projectile.x - enemy.x;
		const dy = projectile.y - enemy.y;
		if (dx * dx + dy * dy <= hitRadiusSq) {
			return true;
		}
	}

	return false;
}

function findCueCandidate(
	state: SimulationState,
	cueTimeSeconds: number,
): { enemy: Enemy; futureX: number; futureY: number } | null {
	let best: { enemy: Enemy; futureX: number; futureY: number } | null = null;
	let bestScore = Number.POSITIVE_INFINITY;
	const shipAtCue = predictShipPosition(
		state,
		cueTimeSeconds - state.simTimeSeconds,
	);

	for (const enemy of state.enemies) {
		if (
			enemy.scheduledCueTime !== null ||
			enemyAlreadyAssignedToCue(state.cueTimeline, enemy.id)
		) {
			continue;
		}

		const dt = cueTimeSeconds - state.simTimeSeconds;
		if (dt <= 0) {
			continue;
		}

		const future = predictEnemyPosition(enemy, dt);
		const dx = future.x - shipAtCue.x;
		const dy = future.y - shipAtCue.baseY;
		const score = Math.abs(dy) * 1.5 + Math.abs(dx - 6.2) * 0.65;

		if (
			future.x <= shipAtCue.x + 0.8 ||
			future.x > shipAtCue.x + 9.2 ||
			future.x >= 18.8
		) {
			continue;
		}

		if (score < bestScore) {
			bestScore = score;
			best = {
				enemy,
				futureX: future.x,
				futureY: future.y,
			};
		}
	}

	return best;
}

function enemyAlreadyAssignedToCue(
	cues: ScheduledCue[],
	enemyId: number,
): boolean {
	for (const cue of cues) {
		if (cue.assignedEnemyId === enemyId) {
			return true;
		}
	}
	return false;
}

function countPlannedCues(cues: ScheduledCue[]): number {
	let count = 0;
	for (const cue of cues) {
		if (cue.planned) {
			count += 1;
		}
	}
	return count;
}

function countUpcomingCueWindow(state: SimulationState): number {
	let count = 0;
	const maxLead =
		CUE_ASSIGN_MAX_LEAD_SECONDS + CUE_SUPPORT_LEAD_PADDING_SECONDS;
	for (const cue of state.cueTimeline) {
		if (cue.planned) {
			continue;
		}
		const leadSeconds = cue.timeSeconds - state.simTimeSeconds;
		if (leadSeconds >= CUE_ASSIGN_MIN_LEAD_SECONDS && leadSeconds <= maxLead) {
			count += 1;
		}
	}
	return count;
}

function countAvailableCueTargets(state: SimulationState): number {
	let count = 0;
	for (const enemy of state.enemies) {
		if (enemy.scheduledCueTime !== null) {
			continue;
		}
		if (enemy.x <= state.shipX + 1.2) {
			continue;
		}
		if (enemyAlreadyAssignedToCue(state.cueTimeline, enemy.id)) {
			continue;
		}
		count += 1;
	}
	return count;
}

function updateShipMotion(state: SimulationState, deltaSeconds: number): void {
	if (state.simTimeSeconds >= state.nextShipRetargetTime) {
		const target = chooseShipTarget(state);
		state.shipTargetX = target.x;
		state.shipTargetY = target.y;
		state.nextShipRetargetTime =
			state.simTimeSeconds +
			SHIP_RETARGET_MIN_SECONDS +
			state.rng() * (SHIP_RETARGET_MAX_SECONDS - SHIP_RETARGET_MIN_SECONDS);
	}

	const threat = analyzeProjectileThreat(state);
	const panicFactor = clamp(threat.score / SHIP_PANIC_THRESHOLD, 0, 1);
	const breakoutActive = updateEdgeBreakoutState(
		state,
		threat.score,
		deltaSeconds,
	);
	const preBreakoutActive =
		!breakoutActive &&
		state.edgeDwellSeconds >=
			SHIP_EDGE_BREAKOUT_TRIGGER_SECONDS * SHIP_PRE_BREAKOUT_TRIGGER_FRACTION &&
		threat.score >= SHIP_EDGE_BREAKOUT_THREAT_MIN * 0.72;
	const centerBiasStrength =
		1 -
		clamp(
			(threat.score - SHIP_CENTER_BIAS_THREAT_LOW) /
				Math.max(
					1e-4,
					SHIP_CENTER_BIAS_THREAT_HIGH - SHIP_CENTER_BIAS_THREAT_LOW,
				),
			0,
			1,
		);

	let baseDesiredX = clamp(
		state.shipTargetX +
			threat.dodgeX * (0.8 + panicFactor * 2.2) -
			panicFactor * (breakoutActive ? 0.45 : preBreakoutActive ? 0.92 : 1.6),
		SHIP_MIN_X,
		SHIP_MAX_X,
	);
	let baseDesiredY = clamp(
		state.shipTargetY + threat.dodgeY * (0.95 + panicFactor * 2.4),
		SHIP_MIN_Y,
		SHIP_MAX_Y,
	);

	baseDesiredX = clamp(
		baseDesiredX +
			(0 - baseDesiredX) * centerBiasStrength * SHIP_CENTER_BIAS_X_STRENGTH,
		SHIP_MIN_X,
		SHIP_MAX_X,
	);
	baseDesiredY = clamp(
		baseDesiredY +
			(0 - baseDesiredY) * centerBiasStrength * SHIP_CENTER_BIAS_Y_STRENGTH,
		SHIP_MIN_Y,
		SHIP_MAX_Y,
	);

	if (preBreakoutActive || breakoutActive) {
		const inwardYDirection = state.shipY >= 0 ? -1 : 1;
		const inwardYStrength = breakoutActive
			? 1.4 + panicFactor * 1.8
			: 0.78 + panicFactor * 1.25;
		baseDesiredY = clamp(
			baseDesiredY + inwardYDirection * inwardYStrength,
			SHIP_MIN_Y,
			SHIP_MAX_Y,
		);

		const centerX = 0;
		const spreadDirection = state.shipX < centerX ? 1 : -1;
		const spreadStrength = breakoutActive
			? 1.2 + panicFactor * 1.1
			: 0.72 + panicFactor * 0.85;
		baseDesiredX = clamp(
			baseDesiredX + spreadDirection * spreadStrength,
			SHIP_MIN_X,
			SHIP_MAX_X,
		);
	}

	const escapeTarget = selectEscapeTarget(
		state,
		baseDesiredX,
		baseDesiredY,
		panicFactor,
		breakoutActive,
		preBreakoutActive,
		centerBiasStrength,
	);
	const desiredX = escapeTarget.x;
	const desiredY = escapeTarget.y;

	const speedScale = 1 + panicFactor * 0.9;
	const accelScale = 1 + panicFactor * 1.35;

	const desiredVx = clamp(
		(desiredX - state.shipX) * (3.1 + panicFactor * 2.1),
		-SHIP_MAX_SPEED_X * speedScale,
		SHIP_MAX_SPEED_X * speedScale,
	);
	const desiredVy = clamp(
		(desiredY - state.shipY) * (3.7 + panicFactor * 2.4),
		-SHIP_MAX_SPEED_Y * speedScale,
		SHIP_MAX_SPEED_Y * speedScale,
	);

	const maxDvX = SHIP_ACCEL_X * accelScale * deltaSeconds;
	const maxDvY = SHIP_ACCEL_Y * accelScale * deltaSeconds;
	state.shipVx += clamp(desiredVx - state.shipVx, -maxDvX, maxDvX);
	state.shipVy += clamp(desiredVy - state.shipVy, -maxDvY, maxDvY);

	state.shipVx *= 1 - Math.min(0.3, deltaSeconds * 0.6);
	state.shipVy *= 1 - Math.min(0.3, deltaSeconds * 0.5);

	state.shipX = clamp(
		state.shipX + state.shipVx * deltaSeconds,
		SHIP_MIN_X,
		SHIP_MAX_X,
	);
	state.shipY = clamp(
		state.shipY + state.shipVy * deltaSeconds,
		SHIP_MIN_Y,
		SHIP_MAX_Y,
	);

	if (state.shipX === SHIP_MIN_X || state.shipX === SHIP_MAX_X) {
		state.shipVx *= breakoutActive ? 0.72 : 0.35;
	}
	if (state.shipY === SHIP_MIN_Y || state.shipY === SHIP_MAX_Y) {
		state.shipVy *= breakoutActive ? 0.78 : 0.35;
	}
}

function analyzeProjectileThreat(state: SimulationState): {
	dodgeX: number;
	dodgeY: number;
	score: number;
} {
	let dodgeX = 0;
	let dodgeY = 0;
	let score = 0;

	for (const projectile of state.enemyProjectiles) {
		const relPx = projectile.x - state.shipX;
		const relPy = projectile.y - state.shipY;
		const relVx = projectile.vx - state.shipVx;
		const relVy = projectile.vy - state.shipVy;
		const relSpeedSq = Math.max(1e-6, relVx * relVx + relVy * relVy);
		const tClosest = clamp(
			-(relPx * relVx + relPy * relVy) / relSpeedSq,
			0,
			SHIP_THREAT_HORIZON_SECONDS,
		);

		const closestDx = relPx + relVx * tClosest;
		const closestDy = relPy + relVy * tClosest;
		const closestDist = Math.hypot(closestDx, closestDy);
		if (closestDist > SHIP_SAFE_RADIUS * 2.2) {
			continue;
		}

		const closeness = clamp(1 - closestDist / (SHIP_SAFE_RADIUS * 2.2), 0, 1);
		const imminence = clamp(1 - tClosest / SHIP_THREAT_HORIZON_SECONDS, 0, 1);
		const weight = closeness * (0.8 + imminence * 1.4);

		const awayX =
			closestDist > 1e-4
				? -closestDx / closestDist
				: state.rng() < 0.5
					? -1
					: 1;
		const awayY =
			closestDist > 1e-4
				? -closestDy / closestDist
				: state.rng() < 0.5
					? -1
					: 1;
		dodgeX += awayX * weight * 2.1;
		dodgeY += awayY * weight * 2.9;
		score += weight;
	}

	for (const enemy of state.enemies) {
		if (enemy.x < state.shipX - 2.2 || enemy.x > state.shipX + 11.6) {
			continue;
		}

		let closestDist = Number.POSITIVE_INFINITY;
		let closestDx = 0;
		let closestDy = 0;
		let tClosest = 0;
		const steps = 6;
		for (let i = 0; i <= steps; i += 1) {
			const t = (i / steps) * SHIP_ENEMY_THREAT_HORIZON_SECONDS;
			const enemyFuture = predictEnemyPosition(enemy, t);
			const shipFutureX = state.shipX + state.shipVx * t;
			const shipFutureY = state.shipY + state.shipVy * t;
			const dx = enemyFuture.x - shipFutureX;
			const dy = enemyFuture.y - shipFutureY;
			const dist = Math.hypot(dx, dy);
			if (dist < closestDist) {
				closestDist = dist;
				closestDx = dx;
				closestDy = dy;
				tClosest = t;
			}
		}

		const safeRadius = SHIP_ENEMY_SAFE_RADIUS + enemy.radius;
		if (closestDist > safeRadius * 2.1) {
			continue;
		}

		const closeness = clamp(1 - closestDist / (safeRadius * 2.1), 0, 1);
		const imminence = clamp(
			1 - tClosest / SHIP_ENEMY_THREAT_HORIZON_SECONDS,
			0,
			1,
		);
		const weight = closeness * (1.1 + imminence * 1.8);
		const awayX =
			closestDist > 1e-4
				? -closestDx / closestDist
				: state.rng() < 0.5
					? -1
					: 1;
		const awayY =
			closestDist > 1e-4
				? -closestDy / closestDist
				: state.rng() < 0.5
					? -1
					: 1;
		dodgeX += awayX * weight * 2.6;
		dodgeY += awayY * weight * 3.2;
		score += weight * 1.15;
	}

	return {
		dodgeX,
		dodgeY,
		score,
	};
}

function updateEdgeBreakoutState(
	state: SimulationState,
	threatScore: number,
	deltaSeconds: number,
): boolean {
	if (state.recentEdgeCooldownSeconds > 0) {
		state.recentEdgeCooldownSeconds = Math.max(
			0,
			state.recentEdgeCooldownSeconds - deltaSeconds,
		);
		if (state.recentEdgeCooldownSeconds <= 0) {
			state.recentEdgeSideY = 0;
		}
	}

	const verticalEdgeDistance = Math.min(
		state.shipY - SHIP_MIN_Y,
		SHIP_MAX_Y - state.shipY,
	);
	const isEdgePinned = verticalEdgeDistance < SHIP_EDGE_BREAKOUT_BAND;
	const edgeSideY = isEdgePinned ? (state.shipY >= 0 ? 1 : -1) : 0;
	if (isEdgePinned && threatScore >= SHIP_EDGE_BREAKOUT_THREAT_MIN) {
		state.edgeDwellSeconds += deltaSeconds;
	} else {
		state.edgeDwellSeconds = Math.max(
			0,
			state.edgeDwellSeconds - deltaSeconds * 1.8,
		);
	}

	if (state.edgeDwellSeconds >= SHIP_EDGE_BREAKOUT_TRIGGER_SECONDS) {
		state.edgeBreakoutSeconds = Math.max(
			state.edgeBreakoutSeconds,
			SHIP_EDGE_BREAKOUT_HOLD_SECONDS,
		);
		if (edgeSideY !== 0) {
			state.recentEdgeSideY = edgeSideY;
			state.recentEdgeCooldownSeconds = SHIP_EDGE_RETURN_COOLDOWN_SECONDS;
		}
		state.edgeDwellSeconds = 0;
	}

	if (state.edgeBreakoutSeconds > 0) {
		state.edgeBreakoutSeconds = Math.max(
			0,
			state.edgeBreakoutSeconds - deltaSeconds,
		);
	}

	return state.edgeBreakoutSeconds > 0;
}

function selectEscapeTarget(
	state: SimulationState,
	baseDesiredX: number,
	baseDesiredY: number,
	panicFactor: number,
	breakoutActive: boolean,
	preBreakoutActive: boolean,
	centerBiasStrength: number,
): { x: number; y: number } {
	const hasNearbyEnemyThreat = state.enemies.some(
		(enemy) => enemy.x > state.shipX - 1.4 && enemy.x < state.shipX + 10.8,
	);
	if (state.enemyProjectiles.length === 0 && !hasNearbyEnemyThreat) {
		return {
			x: baseDesiredX,
			y: baseDesiredY,
		};
	}

	const xOffsets = breakoutActive
		? [-3.6, -2.2, -1.1, 0, 1.1, 2.2, 3.6]
		: preBreakoutActive
			? [-2.8, -1.8, -1, 0, 1, 1.8, 2.8]
			: [-2.2, -1.3, -0.6, 0, 0.6, 1.3, 2.2];
	const yOffsets = breakoutActive
		? [-4.2, -2.8, -1.5, 0, 1.5, 2.8, 4.2]
		: preBreakoutActive
			? [-3.7, -2.5, -1.35, 0, 1.35, 2.5, 3.7]
			: [-2.9, -1.9, -1.0, 0, 1.0, 1.9, 2.9];

	let bestX = baseDesiredX;
	let bestY = baseDesiredY;
	let bestCost = Number.POSITIVE_INFINITY;

	for (const xOffset of xOffsets) {
		const candidateX = clamp(baseDesiredX + xOffset, SHIP_MIN_X, SHIP_MAX_X);
		for (const yOffset of yOffsets) {
			const candidateY = clamp(baseDesiredY + yOffset, SHIP_MIN_Y, SHIP_MAX_Y);
			const cost = evaluateEscapeCandidate(
				state,
				candidateX,
				candidateY,
				panicFactor,
				breakoutActive,
				preBreakoutActive,
				centerBiasStrength,
			);
			if (cost < bestCost) {
				bestCost = cost;
				bestX = candidateX;
				bestY = candidateY;
			}
		}
	}

	return {
		x: bestX,
		y: bestY,
	};
}

function evaluateEscapeCandidate(
	state: SimulationState,
	targetX: number,
	targetY: number,
	panicFactor: number,
	breakoutActive: boolean,
	preBreakoutActive: boolean,
	centerBiasStrength: number,
): number {
	let simX = state.shipX;
	let simY = state.shipY;
	let simVx = state.shipVx;
	let simVy = state.shipVy;
	let totalCost = 0;
	const horizon = SHIP_ESCAPE_HORIZON_SECONDS;
	const steps = Math.max(1, Math.floor(horizon / SHIP_ESCAPE_STEP_SECONDS));
	const speedLimitX = SHIP_MAX_SPEED_X * (1 + panicFactor * 0.9);
	const speedLimitY = SHIP_MAX_SPEED_Y * (1 + panicFactor * 0.9);
	const accelLimitX = SHIP_ACCEL_X * (1 + panicFactor * 1.35);
	const accelLimitY = SHIP_ACCEL_Y * (1 + panicFactor * 1.35);

	for (let i = 1; i <= steps; i += 1) {
		const t = i * SHIP_ESCAPE_STEP_SECONDS;
		const desiredVx = clamp(
			(targetX - simX) * (3.1 + panicFactor * 2.1),
			-speedLimitX,
			speedLimitX,
		);
		const desiredVy = clamp(
			(targetY - simY) * (3.8 + panicFactor * 2.6),
			-speedLimitY,
			speedLimitY,
		);
		simVx += clamp(
			desiredVx - simVx,
			-accelLimitX * SHIP_ESCAPE_STEP_SECONDS,
			accelLimitX * SHIP_ESCAPE_STEP_SECONDS,
		);
		simVy += clamp(
			desiredVy - simVy,
			-accelLimitY * SHIP_ESCAPE_STEP_SECONDS,
			accelLimitY * SHIP_ESCAPE_STEP_SECONDS,
		);
		simVx *= 1 - Math.min(0.22, SHIP_ESCAPE_STEP_SECONDS * 0.6);
		simVy *= 1 - Math.min(0.22, SHIP_ESCAPE_STEP_SECONDS * 0.5);
		simX = clamp(
			simX + simVx * SHIP_ESCAPE_STEP_SECONDS,
			SHIP_MIN_X,
			SHIP_MAX_X,
		);
		simY = clamp(
			simY + simVy * SHIP_ESCAPE_STEP_SECONDS,
			SHIP_MIN_Y,
			SHIP_MAX_Y,
		);

		for (const projectile of state.enemyProjectiles) {
			const px = projectile.x + projectile.vx * t;
			const py = projectile.y + projectile.vy * t;
			const dx = px - simX;
			const dy = py - simY;
			const dist = Math.hypot(dx, dy);
			const imminence = 1 - t / horizon;

			if (dist <= SHIP_COLLISION_RADIUS) {
				totalCost += 5000 * (1 + imminence * 2.2);
				continue;
			}

			if (dist <= SHIP_ESCAPE_NEAR_MISS_RADIUS) {
				const nearMiss = SHIP_ESCAPE_NEAR_MISS_RADIUS - dist;
				totalCost += nearMiss * nearMiss * (1.2 + imminence * 1.8);
			}
		}

		for (const enemy of state.enemies) {
			if (enemy.x < simX - 3.2 || enemy.x > simX + 12.4) {
				continue;
			}

			const enemyFuture = predictEnemyPosition(enemy, t);
			const dx = enemyFuture.x - simX;
			const dy = enemyFuture.y - simY;
			const dist = Math.hypot(dx, dy);
			const imminence = 1 - t / horizon;
			const collisionRadius = SHIP_COLLISION_RADIUS + enemy.radius;

			if (dist <= collisionRadius) {
				totalCost += SHIP_ENEMY_COLLISION_COST * (1 + imminence * 2.1);
				continue;
			}

			const nearMissRadius = SHIP_ENEMY_ESCAPE_NEAR_MISS_RADIUS + enemy.radius;
			if (dist <= nearMissRadius) {
				const nearMiss = nearMissRadius - dist;
				totalCost +=
					nearMiss *
					nearMiss *
					SHIP_ENEMY_NEAR_MISS_COST *
					(1.05 + imminence * 1.55);
			}
		}

		const edgeDistanceY = Math.min(simY - SHIP_MIN_Y, SHIP_MAX_Y - simY);
		if (edgeDistanceY < SHIP_EDGE_AVOIDANCE_BUFFER) {
			totalCost +=
				(SHIP_EDGE_AVOIDANCE_BUFFER - edgeDistanceY) *
				(SHIP_EDGE_AVOIDANCE_PENALTY + panicFactor * 0.8);
		}
		if (edgeDistanceY < SHIP_EDGE_APPROACH_BUFFER_Y) {
			const approach =
				(SHIP_EDGE_APPROACH_BUFFER_Y - edgeDistanceY) /
				Math.max(1e-4, SHIP_EDGE_APPROACH_BUFFER_Y);
			totalCost +=
				approach *
				approach *
				(SHIP_EDGE_APPROACH_PENALTY_Y + centerBiasStrength * 1.15) *
				(0.75 + panicFactor * 0.65);
		}

		const edgeDistanceX = Math.min(simX - SHIP_MIN_X, SHIP_MAX_X - simX);
		if (edgeDistanceX < SHIP_EDGE_AVOIDANCE_BUFFER_X) {
			totalCost +=
				(SHIP_EDGE_AVOIDANCE_BUFFER_X - edgeDistanceX) *
				(SHIP_EDGE_AVOIDANCE_PENALTY_X + panicFactor * 0.6);
		}
		if (edgeDistanceX < SHIP_EDGE_APPROACH_BUFFER_X) {
			const approach =
				(SHIP_EDGE_APPROACH_BUFFER_X - edgeDistanceX) /
				Math.max(1e-4, SHIP_EDGE_APPROACH_BUFFER_X);
			totalCost +=
				approach *
				approach *
				(SHIP_EDGE_APPROACH_PENALTY_X + centerBiasStrength * 0.75) *
				(0.72 + panicFactor * 0.55);
		}

		if (breakoutActive) {
			const trappedEdgeDistance =
				state.shipY >= 0 ? SHIP_MAX_Y - simY : simY - SHIP_MIN_Y;
			if (trappedEdgeDistance < SHIP_EDGE_BREAKOUT_BAND) {
				totalCost +=
					(SHIP_EDGE_BREAKOUT_BAND - trappedEdgeDistance) *
					(4.4 + panicFactor * 2.8);
			}
		} else if (preBreakoutActive) {
			const trappedEdgeDistance =
				state.shipY >= 0 ? SHIP_MAX_Y - simY : simY - SHIP_MIN_Y;
			if (trappedEdgeDistance < SHIP_EDGE_BREAKOUT_BAND) {
				totalCost +=
					(SHIP_EDGE_BREAKOUT_BAND - trappedEdgeDistance) *
					(2.1 + panicFactor * 1.3 + centerBiasStrength * 1.5);
			}
		}
	}

	totalCost += Math.abs(targetY - state.shipY) * 0.12;
	totalCost += Math.abs(targetX - state.shipX) * (breakoutActive ? 0.03 : 0.09);
	totalCost += Math.abs(targetY) * (0.08 + centerBiasStrength * 0.54);
	totalCost += Math.abs(targetX) * (0.04 + centerBiasStrength * 0.24);

	if (state.recentEdgeCooldownSeconds > 0 && state.recentEdgeSideY !== 0) {
		const targetSideY = targetY > 0 ? 1 : targetY < 0 ? -1 : 0;
		if (
			targetSideY === state.recentEdgeSideY &&
			Math.abs(targetY) > SHIP_EDGE_RETURN_BAND_Y
		) {
			const cooldownT =
				state.recentEdgeCooldownSeconds /
				Math.max(1e-4, SHIP_EDGE_RETURN_COOLDOWN_SECONDS);
			const overshoot =
				(Math.abs(targetY) - SHIP_EDGE_RETURN_BAND_Y) /
				Math.max(0.2, SHIP_MAX_Y - SHIP_EDGE_RETURN_BAND_Y);
			totalCost +=
				(1 + overshoot * 1.8) *
				SHIP_EDGE_RETURN_PENALTY *
				cooldownT *
				(0.7 + centerBiasStrength * 1.1);
		}
	}

	if (breakoutActive) {
		const xShift = Math.abs(targetX - state.shipX);
		if (xShift < 1.2) {
			totalCost += (1.2 - xShift) * 0.9;
		}
	}

	return totalCost;
}

function chooseShipTarget(state: SimulationState): { x: number; y: number } {
	const lockedTarget =
		state.lockedTargetEnemyId === null
			? null
			: getEnemyById(state.enemies, state.lockedTargetEnemyId);
	const focus =
		lockedTarget && isPlayerTargetViable(lockedTarget, state.shipX, state.shipY)
			? lockedTarget
			: findBestTarget(
					state.enemies,
					state.shipX,
					state.shipY,
					PLAYER_TARGET_HARD_DISTANCE_X,
				);
	const roamPhase = state.simTimeSeconds * 0.72;

	if (focus) {
		return {
			x: clamp(
				focus.x - 5.8 + Math.sin(roamPhase) * 0.7,
				SHIP_MIN_X,
				SHIP_MAX_X,
			),
			y: clamp(
				focus.y + Math.sin(roamPhase * 1.25) * 0.9,
				SHIP_MIN_Y,
				SHIP_MAX_Y,
			),
		};
	}

	return {
		x: clamp(
			-5.4 +
				Math.sin(roamPhase * 0.9) * 2.4 +
				Math.sin(roamPhase * 0.47 + 1.2) * 1.1,
			SHIP_MIN_X,
			SHIP_MAX_X,
		),
		y: clamp(
			Math.sin(roamPhase * 1.35 + 0.4) * 2.6 +
				Math.cos(roamPhase * 0.52 + 0.2) * 1.05,
			SHIP_MIN_Y,
			SHIP_MAX_Y,
		),
	};
}

function spawnEnemyProjectile(
	state: SimulationState,
	enemy: Enemy,
	spreadRadians = 0,
): void {
	const baseSpeed = 6.8 + state.rng() * 2;
	const speedMultiplier =
		state.combatConfig.enemyRoster.enemyProjectileStyle === "lasers"
			? ENEMY_PROJECTILE_LASER_SPEED_MULTIPLIER
			: 1;
	const speed = baseSpeed * speedMultiplier;
	const edgeDistanceY = Math.min(
		state.shipY - SHIP_MIN_Y,
		SHIP_MAX_Y - state.shipY,
	);
	const edgeProximity = clamp(
		(ENEMY_EDGE_AIM_RELAX_DISTANCE_Y - edgeDistanceY) /
			ENEMY_EDGE_AIM_RELAX_DISTANCE_Y,
		0,
		1,
	);
	let localProjectilePressure = 0;
	for (const projectile of state.enemyProjectiles) {
		if (
			projectile.x < state.shipX - 1 ||
			projectile.x > state.shipX + ENEMY_EDGE_PRESSURE_WINDOW_X
		) {
			continue;
		}
		if (Math.abs(projectile.y - state.shipY) > ENEMY_EDGE_PRESSURE_WINDOW_Y) {
			continue;
		}
		localProjectilePressure += 1;
		if (localProjectilePressure >= ENEMY_EDGE_PRESSURE_PROJECTILE_CAP) {
			break;
		}
	}
	const pressure = clamp(
		localProjectilePressure / ENEMY_EDGE_PRESSURE_PROJECTILE_CAP,
		0,
		1,
	);
	const edgePressure = edgeProximity * pressure;
	const aimLagSeconds = edgePressure * ENEMY_EDGE_AIM_RELAX_MAX_LAG_SECONDS;
	const relaxedShipX = state.shipX - state.shipVx * aimLagSeconds;
	const relaxedShipY = state.shipY - state.shipVy * aimLagSeconds;
	const jitter =
		(state.rng() - 0.5) *
		(0.55 + edgePressure * ENEMY_EDGE_AIM_RELAX_MAX_JITTER);
	const targetX = relaxedShipX - 0.2;
	const targetY = relaxedShipY + jitter;
	const dx = targetX - enemy.x;
	const dy = targetY - enemy.y;
	const magnitude = Math.hypot(dx, dy) || 1;

	const baseX = dx / magnitude;
	const baseY = dy / magnitude;
	const spreadWithPressure =
		spreadRadians +
		(state.rng() - 0.5) * edgePressure * ENEMY_EDGE_PRESSURE_EXTRA_SPREAD;
	const cos = Math.cos(spreadWithPressure);
	const sin = Math.sin(spreadWithPressure);
	const dirX = baseX * cos - baseY * sin;
	const dirY = baseX * sin + baseY * cos;

	state.enemyProjectiles.push({
		id: state.nextEnemyProjectileId++,
		x: enemy.x - 0.5,
		y: enemy.y,
		z: 0,
		vx: dirX * speed,
		vy: dirY * speed,
		ageSeconds: 0,
		maxLifetimeSeconds: 3,
		radius: 0.18,
	});
}

function spawnExplosion(
	state: SimulationState,
	x: number,
	y: number,
	z: number,
): void {
	const relativeIntensity = getRelativeIntensityAtTime(
		state,
		state.simTimeSeconds,
	);
	const power = clamp(0.12 + Math.pow(relativeIntensity, 2.2) * 2, 0.12, 2.12);
	state.explosions.push({
		x,
		y,
		z,
		ageSeconds: 0,
		lifetimeSeconds: 0.34 + power * 0.1,
		variant: Math.floor(state.rng() * 6),
		power,
	});
}
