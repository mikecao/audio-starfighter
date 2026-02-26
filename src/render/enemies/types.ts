import type { Color, BufferGeometry } from "three";

/**
 * Visual style for an enemy archetype, used by the enemy renderer
 * to colorize meshes and flash on damage.
 */
export type EnemyRenderStyle = {
	baseColor: Color;
	hitColor: Color;
	baseEmissive: Color;
	hitEmissive: Color;
};

/**
 * Render-side module for an enemy archetype.
 * Provides geometry and visual styling.
 */
export type RenderEnemyModule = {
	archetypeId: string;
	geometry: BufferGeometry;
	style: EnemyRenderStyle;
};
