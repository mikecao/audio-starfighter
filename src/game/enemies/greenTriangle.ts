import { ENEMY_ARCHETYPE_DEFINITIONS } from "../combatConfig";
import type { EnemyPattern, SimulationState } from "../types";
import {
	clamp,
	getIntensityAtTime,
	moodParameters,
} from "../utils";
import type { SimEnemyModule } from "./types";

const GREEN_TRIANGLE_PATTERNS: EnemyPattern[] = [
	"triangleRibbon",
	"triangleBankedZig",
	"triangleDiveRecover",
	"triangleCorkscrew",
];

const TRIANGLE_FORMATION_MIN_SIZE = 3;
const TRIANGLE_FORMATION_MAX_SIZE = 8;
const TRIANGLE_FORMATION_CATERPILLAR_DELAY_MIN_SECONDS = 0.24;
const TRIANGLE_FORMATION_CATERPILLAR_DELAY_MAX_SECONDS = 0.34;
const TRIANGLE_FORMATION_SPEED_BASE = 4.65;
const TRIANGLE_FORMATION_SPEED_INTENSITY_GAIN = 2.9;
const TRIANGLE_FORMATION_SPEED_RANDOM_GAIN = 1.45;
const ENEMY_FIRE_COOLDOWN_MULTIPLIER = 1.25;

function enemyFireIntensityMultiplier(intensity: number): number {
	const ENEMY_INTENSITY_FIRE_COOLDOWN_BOOST = 0.1;
	return clamp(1 - intensity * ENEMY_INTENSITY_FIRE_COOLDOWN_BOOST, 0.82, 1);
}

function pickAmbientPattern(spawnIndex: number, _rng: () => number): EnemyPattern {
	return pickTriangleFormationPattern(spawnIndex);
}

export function pickTriangleFormationPattern(spawnIndex: number): EnemyPattern {
	const selector = spawnIndex % 4;
	if (selector === 0) return "triangleRibbon";
	if (selector === 1) return "triangleBankedZig";
	if (selector === 2) return "triangleDiveRecover";
	return "triangleCorkscrew";
}

function spawnAmbientWave(state: SimulationState): number {
	return spawnGreenTriangleFormation(state);
}

export function spawnGreenTriangleFormation(state: SimulationState): number {
	const intensity = getIntensityAtTime(state, state.simTimeSeconds);
	const mood = moodParameters(state.moodProfile);
	const archetypeDef = ENEMY_ARCHETYPE_DEFINITIONS.greenTriangle;
	const fireScale = state.combatConfig.enemyRoster.fireScale;

	const formationSize =
		TRIANGLE_FORMATION_MIN_SIZE +
		Math.floor(
			state.rng() *
				(TRIANGLE_FORMATION_MAX_SIZE - TRIANGLE_FORMATION_MIN_SIZE + 1),
		);
	const lane = (state.spawnIndex % 5) - 2;
	const anchorY = clamp(lane * 1.35 + (state.rng() - 0.5) * 0.45, -3.8, 3.8);
	const leaderSpawnX = 21.6 + state.rng() * 1.8;
	const pattern = pickTriangleFormationPattern(state.spawnIndex);
	const sharedPhase = state.rng() * Math.PI * 2;
	const sharedFrequency = 0.9 + state.rng() * 1.25;
	const sharedAmplitude = 0.95 + state.rng() * (0.9 + intensity * 0.9);
	const sharedVx =
		(-TRIANGLE_FORMATION_SPEED_BASE -
			intensity * TRIANGLE_FORMATION_SPEED_INTENSITY_GAIN -
			state.rng() * TRIANGLE_FORMATION_SPEED_RANDOM_GAIN) *
		mood.enemySpeedScale *
		archetypeDef.speedScale;
	const caterpillarDelaySeconds =
		TRIANGLE_FORMATION_CATERPILLAR_DELAY_MIN_SECONDS +
		state.rng() *
			(TRIANGLE_FORMATION_CATERPILLAR_DELAY_MAX_SECONDS -
				TRIANGLE_FORMATION_CATERPILLAR_DELAY_MIN_SECONDS);

	for (let i = 0; i < formationSize; i += 1) {
		const pathAgeOffsetSeconds = i * caterpillarDelaySeconds;
		const spawnX = leaderSpawnX + -sharedVx * pathAgeOffsetSeconds;
		state.enemies.push({
			id: state.nextEnemyId++,
			archetype: "greenTriangle",
			x: spawnX,
			y: anchorY,
			z: 0,
			vx: sharedVx,
			ageSeconds: 0,
			pattern,
			baseY: anchorY,
			phase: sharedPhase,
			amplitude: sharedAmplitude * (0.96 + state.rng() * 0.08),
			frequency: sharedFrequency * (0.96 + state.rng() * 0.08),
			pathAgeOffsetSeconds,
			radius: 0.44 * archetypeDef.radiusScale,
			fireCooldownSeconds:
				((0.8 + (1 - intensity) * 0.7 + state.rng() * 0.5) *
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

	return formationSize;
}

export const greenTriangleModule: SimEnemyModule = {
	archetypeId: "greenTriangle",
	definition: ENEMY_ARCHETYPE_DEFINITIONS.greenTriangle,
	patterns: GREEN_TRIANGLE_PATTERNS,
	pickAmbientPattern,
	spawnAmbientWave,
};
