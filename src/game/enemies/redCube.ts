import { ENEMY_ARCHETYPE_DEFINITIONS } from "../combatConfig";
import type { EnemyPattern, SimulationState } from "../types";
import {
	clamp,
	getIntensityAtTime,
	moodParameters,
} from "../utils";
import type { SimEnemyModule } from "./types";

const RED_CUBE_PATTERNS: EnemyPattern[] = [
	"straight",
	"sine",
	"arc",
	"zigzag",
	"weave",
];

const ENEMY_FIRE_COOLDOWN_MULTIPLIER = 1.25;

function enemyFireIntensityMultiplier(intensity: number): number {
	const ENEMY_INTENSITY_FIRE_COOLDOWN_BOOST = 0.1;
	return clamp(1 - intensity * ENEMY_INTENSITY_FIRE_COOLDOWN_BOOST, 0.82, 1);
}

function pickAmbientPattern(
	spawnIndex: number,
	_rng: () => number,
): EnemyPattern {
	const selector = spawnIndex % 5;
	if (selector === 0) return "straight";
	if (selector === 1) return "sine";
	if (selector === 2) return "arc";
	if (selector === 3) return "zigzag";
	return "weave";
}

function spawnAmbientWave(state: SimulationState): number {
	spawnAmbientRedCube(state);
	return 1;
}

function spawnAmbientRedCube(state: SimulationState): void {
	const intensity = getIntensityAtTime(state, state.simTimeSeconds);
	const mood = moodParameters(state.moodProfile);
	const archetypeDef = ENEMY_ARCHETYPE_DEFINITIONS.redCube;
	const lane = (state.spawnIndex % 5) - 2;
	const pattern = pickAmbientPattern(state.spawnIndex, state.rng);

	// Import getCombatPressureTuning from sim would create a circular dep,
	// so we use the combatConfig directly for the fire scale
	const fireScale = state.combatConfig.enemyRoster.fireScale;

	state.enemies.push({
		id: state.nextEnemyId++,
		archetype: "redCube",
		x: 22.2 + state.rng() * 3.1,
		y: lane * 1.6,
		z: 0,
		vx:
			(-2.5 - intensity * 1.8 - state.rng() * 0.95) *
			mood.enemySpeedScale *
			archetypeDef.speedScale,
		ageSeconds: 0,
		pattern,
		baseY: lane * 1.6,
		phase: state.rng() * Math.PI * 2,
		amplitude: 0.35 + state.rng() * 1.25,
		frequency: 1 + state.rng() * 1.4,
		pathAgeOffsetSeconds: 0,
		radius: 0.44 * archetypeDef.radiusScale,
		fireCooldownSeconds:
			((0.5 + (1 - intensity) * 0.8 + state.rng() * 0.5) *
				mood.enemyFireIntervalScale *
				ENEMY_FIRE_COOLDOWN_MULTIPLIER *
				enemyFireIntensityMultiplier(intensity) *
				archetypeDef.fireCooldownScale) /
			fireScale,
		scheduledCueTime: null,
		cuePrimed: false,
		damageFlash: 0,
		hasEnteredView: false,
	});
}

export const redCubeModule: SimEnemyModule = {
	archetypeId: "redCube",
	definition: ENEMY_ARCHETYPE_DEFINITIONS.redCube,
	patterns: RED_CUBE_PATTERNS,
	pickAmbientPattern,
	spawnAmbientWave,
};
