import {
	BoxGeometry,
	Color,
	Group,
	Mesh,
	MeshStandardMaterial,
} from "three";
import type { SimulationSnapshot } from "../../game/types";

const playerProjectileGeometry = new BoxGeometry(0.9, 0.06, 0.06);
const projectileMaterial = new MeshStandardMaterial({
	color: "#22d3ee",
	roughness: 0.15,
	metalness: 0.7,
	emissive: "#06b6d4",
	emissiveIntensity: 0.7,
});

const cueProjectileColor = new Color("#fde047");
const cueProjectileEmissive = new Color("#f59e0b");
const primaryProjectileColor = new Color("#22d3ee");
const primaryProjectileEmissive = new Color("#06b6d4");
const flakProjectileColor = new Color("#fb923c");
const flakProjectileEmissive = new Color("#ea580c");

export type PlayerProjectileRendererState = {
	group: Group;
	meshes: Mesh[];
};

export function createPlayerProjectileRenderer(): PlayerProjectileRendererState {
	return {
		group: new Group(),
		meshes: [],
	};
}

export function updatePlayerProjectileRenderer(
	renderer: PlayerProjectileRendererState,
	projectiles: SimulationSnapshot["projectiles"],
): void {
	const { meshes, group } = renderer;

	while (meshes.length < projectiles.length) {
		const mesh = new Mesh(
			playerProjectileGeometry,
			projectileMaterial.clone(),
		);
		mesh.visible = false;
		meshes.push(mesh);
		group.add(mesh);
	}

	for (let i = 0; i < meshes.length; i += 1) {
		const mesh = meshes[i];
		const projectile = projectiles[i];
		if (!projectile) {
			mesh.visible = false;
			continue;
		}
		mesh.visible = true;
		mesh.position.set(projectile.x, projectile.y, projectile.z);
		mesh.rotation.z = projectile.rotationZ;
		const material = mesh.material as MeshStandardMaterial;
		if (projectile.isFlak) {
			material.color.copy(flakProjectileColor);
			material.emissive.copy(flakProjectileEmissive);
			material.emissiveIntensity = 1.0;
			mesh.scale.set(0.7, 1.2, 1.2);
		} else if (projectile.isCueShot) {
			material.color.copy(cueProjectileColor);
			material.emissive.copy(cueProjectileEmissive);
			material.emissiveIntensity = 1.2;
			mesh.scale.set(1.6, 1.5, 1.5);
		} else {
			material.color.copy(primaryProjectileColor);
			material.emissive.copy(primaryProjectileEmissive);
			material.emissiveIntensity = 0.7;
			mesh.scale.set(1, 1, 1);
		}
	}
}
