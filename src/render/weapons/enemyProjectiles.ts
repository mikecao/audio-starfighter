import {
	BoxGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
} from "three";
import type { SimulationSnapshot } from "../../game/types";

const enemyProjectileGeometry = new SphereGeometry(0.15, 12, 8);
const enemyProjectileMaterial = new MeshStandardMaterial({
	color: "#fb7185",
	roughness: 0.25,
	metalness: 0.1,
	emissive: "#f43f5e",
	emissiveIntensity: 0.7,
});

const enemyProjectileLaserGeometry = new BoxGeometry(1.15, 0.055, 0.055);
const enemyProjectileLaserMaterial = new MeshStandardMaterial({
	color: "#fb7185",
	roughness: 0.16,
	metalness: 0.38,
	emissive: "#f43f5e",
	emissiveIntensity: 0.95,
});

export type EnemyProjectileRendererState = {
	ballGroup: Group;
	ballMeshes: Mesh[];
	laserGroup: Group;
	laserMeshes: Mesh[];
};

export function createEnemyProjectileRenderer(): EnemyProjectileRendererState {
	return {
		ballGroup: new Group(),
		ballMeshes: [],
		laserGroup: new Group(),
		laserMeshes: [],
	};
}

export function updateEnemyProjectileRenderer(
	renderer: EnemyProjectileRendererState,
	projectiles: SimulationSnapshot["enemyProjectiles"],
	style: SimulationSnapshot["enemyProjectileStyle"],
): void {
	const { ballMeshes, ballGroup, laserMeshes, laserGroup } = renderer;

	if (style === "lasers") {
		for (const mesh of ballMeshes) {
			mesh.visible = false;
		}

		while (laserMeshes.length < projectiles.length) {
			const mesh = new Mesh(
				enemyProjectileLaserGeometry,
				enemyProjectileLaserMaterial,
			);
			mesh.visible = false;
			laserMeshes.push(mesh);
			laserGroup.add(mesh);
		}

		for (let i = 0; i < laserMeshes.length; i += 1) {
			const mesh = laserMeshes[i];
			const projectile = projectiles[i];
			if (!projectile) {
				mesh.visible = false;
				continue;
			}
			mesh.visible = true;
			mesh.position.set(projectile.x, projectile.y, projectile.z);
			mesh.rotation.z = projectile.rotationZ;
		}
	} else {
		for (const mesh of laserMeshes) {
			mesh.visible = false;
		}

		while (ballMeshes.length < projectiles.length) {
			const mesh = new Mesh(
				enemyProjectileGeometry,
				enemyProjectileMaterial,
			);
			mesh.visible = false;
			ballMeshes.push(mesh);
			ballGroup.add(mesh);
		}

		for (let i = 0; i < ballMeshes.length; i += 1) {
			const mesh = ballMeshes[i];
			const projectile = projectiles[i];
			if (!projectile) {
				mesh.visible = false;
				continue;
			}
			mesh.visible = true;
			mesh.position.set(projectile.x, projectile.y, projectile.z);
		}
	}
}
