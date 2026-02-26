import type {
	CombatConfig,
	EnemyArchetypeId,
	EnemyProjectileStyle,
} from "./combatConfig";

// ── Movement patterns ──────────────────────────────────────────────

export type EnemyPattern =
	| "straight"
	| "sine"
	| "arc"
	| "zigzag"
	| "weave"
	| "triangleRibbon"
	| "triangleBankedZig"
	| "triangleDiveRecover"
	| "triangleCorkscrew";

// ── Cue weapon identifiers ─────────────────────────────────────────

export type CueWeaponId = "blue" | "yellow" | "green" | "purple" | "orange";

// ── Entity types ───────────────────────────────────────────────────

export type Enemy = {
	id: number;
	archetype: EnemyArchetypeId;
	x: number;
	y: number;
	z: number;
	vx: number;
	ageSeconds: number;
	pattern: EnemyPattern;
	baseY: number;
	phase: number;
	amplitude: number;
	frequency: number;
	pathAgeOffsetSeconds: number;
	radius: number;
	fireCooldownSeconds: number;
	scheduledCueTime: number | null;
	cuePrimed: boolean;
	damageFlash: number;
	hasEnteredView: boolean;
};

export type Projectile = {
	id: number;
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	ageSeconds: number;
	maxLifetimeSeconds: number;
	radius: number;
	isCueShot: boolean;
	isFlak: boolean;
};

export type PurpleMissile = {
	id: number;
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	ageSeconds: number;
	maxLifetimeSeconds: number;
	launchX: number;
	launchY: number;
	targetEnemyId: number;
	targetX: number;
	targetY: number;
	cueTimeSeconds: number;
	loopTurns: number;
	loopDirection: number;
	pathVariant: number;
};

export type EnemyProjectile = {
	id: number;
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	ageSeconds: number;
	maxLifetimeSeconds: number;
	radius: number;
};

export type Explosion = {
	x: number;
	y: number;
	z: number;
	ageSeconds: number;
	lifetimeSeconds: number;
	variant: number;
	power: number;
};

export type LaserBeam = {
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	ageSeconds: number;
	lifetimeSeconds: number;
};

// ── Cue scheduling ─────────────────────────────────────────────────

export type ScheduledCue = {
	timeSeconds: number;
	planned: boolean;
	assignedEnemyId: number | null;
	assignedWeapon: CueWeaponId | null;
};

export type PlannedCueShot = {
	cueTimeSeconds: number;
	enemyId: number;
	fireTimeSeconds: number;
	weapon: "blue" | "yellow" | "orange";
};

export type PlannedPurpleMissileShot = {
	cueTimeSeconds: number;
	enemyId: number;
	fireTimeSeconds: number;
};

// ── Intensity ──────────────────────────────────────────────────────

export type IntensitySample = {
	timeSeconds: number;
	intensity: number;
};

// ── Mood ───────────────────────────────────────────────────────────

export type MoodProfile = "calm" | "driving" | "aggressive";

// ── Combat pressure ────────────────────────────────────────────────

export type CombatPressureTuning = {
	spawnScale: number;
	enemyFireScale: number;
};

// ── Core simulation state ──────────────────────────────────────────

export type SimulationState = {
	simTimeSeconds: number;
	simTick: number;
	shipX: number;
	shipY: number;
	shipVx: number;
	shipVy: number;
	shipTargetX: number;
	shipTargetY: number;
	nextShipRetargetTime: number;
	lockedTargetEnemyId: number | null;
	targetLockUntilSeconds: number;
	lastPlayerAimX: number;
	lastPlayerAimY: number;
	edgeDwellSeconds: number;
	edgeBreakoutSeconds: number;
	recentEdgeSideY: number;
	recentEdgeCooldownSeconds: number;
	shipShieldAlpha: number;
	enemies: Enemy[];
	projectiles: Projectile[];
	missiles: PurpleMissile[];
	enemyProjectiles: EnemyProjectile[];
	laserBeams: LaserBeam[];
	explosions: Explosion[];
	nextEnemySpawnTime: number;
	nextPlayerFireTime: number;
	spawnIndex: number;
	nextEnemyId: number;
	nextProjectileId: number;
	nextMissileId: number;
	nextEnemyProjectileId: number;
	enemyBulletBudget: number;
	enemyBulletRatio: number;
	enemyFireSelectionCursor: number;
	cueWeaponCursor: number;
	combatConfig: CombatConfig;
	activeEnemyArchetypes: EnemyArchetypeId[];
	nextLaserFireTime: number;
	cueTimeline: ScheduledCue[];
	cueStartOffsetSeconds: number;
	cueResolvedCount: number;
	cueMissedCount: number;
	cumulativeCueErrorMs: number;
	plannedCueShots: PlannedCueShot[];
	plannedPurpleMissileShots: PlannedPurpleMissileShot[];
	score: number;
	combo: number;
	intensityTimeline: IntensitySample[];
	intensityFloor: number;
	intensityCeil: number;
	moodProfile: MoodProfile;
	randomSeed: number;
	rng: () => number;
};

// ── Simulation snapshot (public data contract) ─────────────────────

export type SimulationSnapshot = {
	simTimeSeconds: number;
	simTick: number;
	ship: {
		x: number;
		y: number;
		z: number;
	};
	enemyCount: number;
	projectileCount: number;
	enemies: Array<{
		x: number;
		y: number;
		z: number;
		rotationZ: number;
		damageFlash: number;
		archetype: EnemyArchetypeId;
	}>;
	projectiles: Array<{
		id: number;
		x: number;
		y: number;
		z: number;
		rotationZ: number;
		isCueShot: boolean;
		isFlak: boolean;
	}>;
	missiles: Array<{
		id: number;
		x: number;
		y: number;
		z: number;
		rotationZ: number;
		ageSeconds: number;
		maxLifetimeSeconds: number;
		launchX: number;
		launchY: number;
		targetX: number;
		targetY: number;
		cueTimeSeconds: number;
		loopDirection: number;
		loopTurns: number;
		pathVariant: number;
	}>;
	enemyProjectiles: Array<{
		id: number;
		x: number;
		y: number;
		z: number;
		rotationZ: number;
	}>;
	laserBeams: Array<{
		fromX: number;
		fromY: number;
		toX: number;
		toY: number;
		alpha: number;
	}>;
	explosions: Array<{
		x: number;
		y: number;
		z: number;
		scale: number;
		alpha: number;
		variant: number;
		power: number;
	}>;
	shieldAlpha: number;
	cueResolvedCount: number;
	cueMissedCount: number;
	avgCueErrorMs: number;
	currentIntensity: number;
	score: number;
	combo: number;
	pendingCueCount: number;
	plannedCueCount: number;
	queuedCueShotCount: number;
	upcomingCueWindowCount: number;
	availableCueTargetCount: number;
	moodProfile: "calm" | "driving" | "aggressive";
	purpleMissileEnabled: boolean;
	enemyProjectileStyle: EnemyProjectileStyle;
};

// ── Simulation public interface ────────────────────────────────────

export type Simulation = {
	step: (deltaSeconds: number) => void;
	getSnapshot: () => SimulationSnapshot;
	setCueTimeline: (cueTimesSeconds: number[]) => void;
	startTrackRun: (cueTimesSeconds: number[]) => void;
	setIntensityTimeline: (samples: IntensitySample[]) => void;
	setRandomSeed: (seed: number) => void;
	setMoodProfile: (mood: MoodProfile) => void;
	setEnemyBulletRatio: (ratio: number) => void;
	setShipWeapons: (weapons: Partial<import("./combatConfig").ShipWeaponsConfig>) => void;
	setEnemyRoster: (roster: Partial<import("./combatConfig").EnemyRosterConfig>) => void;
	setCombatConfig: (config: import("./combatConfig").CombatConfigPatch) => void;
};
