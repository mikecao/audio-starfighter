import {
	Color,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
} from "three";
import type { SimulationSnapshot } from "../../game/types";
import { greenTriangleRenderModule } from "./greenTriangle";
import { redCubeRenderModule } from "./redCube";
import type { EnemyRenderStyle, RenderEnemyModule } from "./types";

const ENEMY_BASE_OPACITY = 0.62;

const renderModules = new Map<string, RenderEnemyModule>([
	["redCube", redCubeRenderModule],
	["greenTriangle", greenTriangleRenderModule],
]);

export function registerEnemyRenderModule(module: RenderEnemyModule): void {
	renderModules.set(module.archetypeId, module);
}

export type EnemyRendererState = {
	group: Group;
	meshes: Mesh[];
	material: MeshStandardMaterial;
	tintColor: Color;
	tintEmissive: Color;
};

export function createEnemyRenderer(): EnemyRendererState {
	const material = new MeshStandardMaterial({
		color: "#f87171",
		roughness: 0.35,
		metalness: 0.2,
		emissive: "#7f1d1d",
		emissiveIntensity: 0.2,
		transparent: true,
		opacity: 1,
		side: DoubleSide,
		depthWrite: false,
	});

	return {
		group: new Group(),
		meshes: [],
		material,
		tintColor: new Color(),
		tintEmissive: new Color(),
	};
}

export function updateEnemyRenderer(
	renderer: EnemyRendererState,
	enemies: SimulationSnapshot["enemies"],
	intensity: number,
): void {
	const { meshes, group, tintColor, tintEmissive, material } = renderer;

	// Grow pool as needed
	while (meshes.length < enemies.length) {
		const mesh = new Mesh(
			redCubeRenderModule.geometry,
			material.clone(),
		);
		mesh.visible = false;
		meshes.push(mesh);
		group.add(mesh);
	}

	for (let i = 0; i < meshes.length; i += 1) {
		const mesh = meshes[i];
		const enemy = enemies[i];
		if (!enemy) {
			mesh.visible = false;
			continue;
		}

		const entryAlpha = clamp01((18.4 - enemy.x) / 2.8);
		mesh.visible = entryAlpha > 0.01;
		if (!mesh.visible) {
			continue;
		}

		const flash = clamp01(enemy.damageFlash);
		const renderModule = renderModules.get(enemy.archetype);
		const style: EnemyRenderStyle = renderModule?.style ?? redCubeRenderModule.style;
		const expectedGeometry = renderModule?.geometry ?? redCubeRenderModule.geometry;
		const mat = mesh.material as MeshStandardMaterial;

		if (mesh.geometry !== expectedGeometry) {
			mesh.geometry = expectedGeometry;
		}

		tintColor.lerpColors(style.baseColor, style.hitColor, flash);
		mat.color.copy(tintColor);
		tintEmissive.lerpColors(style.baseEmissive, style.hitEmissive, flash);
		mat.emissive.copy(tintEmissive);
		mat.emissiveIntensity =
			0.18 + intensity * 0.6 + flash * (0.45 + intensity * 0.35);
		mat.opacity = entryAlpha * ENEMY_BASE_OPACITY;

		mesh.position.set(enemy.x, enemy.y, enemy.z);

		if (enemy.archetype === "greenTriangle") {
			const tumble = enemy.rotationZ;
			mesh.rotation.x = 0.92 + Math.sin(tumble * 1.34) * 0.58;
			mesh.rotation.y = 0.78 + Math.cos(tumble * 1.12) * 0.52;
			mesh.rotation.z = tumble * 1.42;
		} else {
			mesh.rotation.x = 0.48;
			mesh.rotation.y = 0.58;
			mesh.rotation.z = enemy.rotationZ;
		}

		const flashScale = 1 + enemy.damageFlash * 0.14;
		mesh.scale.setScalar(flashScale);
	}
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}
