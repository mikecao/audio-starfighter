import {
	AdditiveBlending,
	BoxGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
} from "three";
import type { SimulationSnapshot } from "../../game/types";

const laserGeometry = new BoxGeometry(1, 0.05, 0.04);
const laserMaterial = new MeshBasicMaterial({
	color: "#22c55e",
	transparent: true,
	opacity: 0.95,
	blending: AdditiveBlending,
});

export type LaserBeamRendererState = {
	group: Group;
	meshes: Mesh[];
};

export function createLaserBeamRenderer(): LaserBeamRendererState {
	return {
		group: new Group(),
		meshes: [],
	};
}

export function updateLaserBeamRenderer(
	renderer: LaserBeamRendererState,
	beams: SimulationSnapshot["laserBeams"],
): void {
	const { meshes, group } = renderer;

	while (meshes.length < beams.length) {
		const mesh = new Mesh(laserGeometry, laserMaterial.clone());
		mesh.visible = false;
		meshes.push(mesh);
		group.add(mesh);
	}

	for (let i = 0; i < meshes.length; i += 1) {
		const mesh = meshes[i];
		const beam = beams[i];
		if (!beam || beam.alpha <= 0.01) {
			mesh.visible = false;
			continue;
		}
		const dx = beam.toX - beam.fromX;
		const dy = beam.toY - beam.fromY;
		const length = Math.max(0.12, Math.hypot(dx, dy));
		mesh.visible = true;
		mesh.position.set(beam.fromX + dx * 0.5, beam.fromY + dy * 0.5, 0.04);
		mesh.scale.set(length, 1, 1);
		mesh.rotation.z = Math.atan2(dy, dx);
		const material = mesh.material as MeshBasicMaterial;
		material.opacity = beam.alpha * 0.9;
	}
}
