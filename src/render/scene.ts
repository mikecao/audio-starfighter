import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer
} from "three";
import type { SimulationSnapshot } from "../game/sim";

export type RenderScene = {
  update: (snapshot: SimulationSnapshot, alpha: number) => void;
  render: () => void;
  resize: () => void;
};

export function setupScene(container: HTMLElement): RenderScene {
  const scene = new Scene();
  scene.background = new Color("#070b14");

  const camera = new PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 0, 20);
  camera.lookAt(new Vector3(0, 0, 0));

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambientLight = new AmbientLight("#9bb9ff", 0.45);
  scene.add(ambientLight);

  const directionalLight = new DirectionalLight("#fef2c2", 1.1);
  directionalLight.position.set(2, 4, 8);
  scene.add(directionalLight);

  const shipGeometry = new BoxGeometry(1.2, 0.6, 0.9);
  const shipMaterial = new MeshStandardMaterial({
    color: "#67e8f9",
    roughness: 0.25,
    metalness: 0.5
  });
  const shipMesh = new Mesh(shipGeometry, shipMaterial);
  scene.add(shipMesh);
  const shieldMaterial = new MeshStandardMaterial({
    color: "#7dd3fc",
    transparent: true,
    opacity: 0,
    emissive: "#38bdf8",
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0
  });
  const shieldMesh = new Mesh(new SphereGeometry(0.8, 16, 12), shieldMaterial);
  scene.add(shieldMesh);

  const enemyMaterial = new MeshStandardMaterial({
    color: "#f87171",
    roughness: 0.35,
    metalness: 0.2
  });
  const enemyGeometry = new BoxGeometry(0.85, 0.85, 0.85);
  const enemyGroup = new Group();
  scene.add(enemyGroup);
  const enemyMeshes: Mesh[] = [];

  const projectileGeometry = new SphereGeometry(0.15, 12, 8);
  const projectileMaterial = new MeshStandardMaterial({
    color: "#22d3ee",
    roughness: 0.2,
    metalness: 0.55
  });
  const projectileGroup = new Group();
  scene.add(projectileGroup);
  const projectileMeshes: Mesh[] = [];
  const enemyProjectileMaterial = new MeshStandardMaterial({
    color: "#fb7185",
    roughness: 0.25,
    metalness: 0.1,
    emissive: "#f43f5e",
    emissiveIntensity: 0.7
  });
  const enemyProjectileGroup = new Group();
  scene.add(enemyProjectileGroup);
  const enemyProjectileMeshes: Mesh[] = [];

  const explosionGeometry = new SphereGeometry(0.4, 10, 8);
  const explosionMaterial = new MeshStandardMaterial({
    color: "#fbbf24",
    emissive: "#f59e0b",
    emissiveIntensity: 1.3,
    roughness: 0.8,
    metalness: 0
  });
  const explosionGroup = new Group();
  scene.add(explosionGroup);
  const explosionMeshes: Mesh[] = [];

  const laneGeometry = new BoxGeometry(26, 0.04, 0.04);
  const laneMaterial = new MeshStandardMaterial({
    color: "#293447",
    roughness: 0.8,
    metalness: 0.05
  });
  for (let i = -2; i <= 2; i += 1) {
    const lane = new Mesh(laneGeometry, laneMaterial);
    lane.position.set(0, i * 2, -1.6);
    scene.add(lane);
  }

  function resize(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();

  return {
    update(snapshot) {
      shipMesh.position.set(snapshot.ship.x, snapshot.ship.y, snapshot.ship.z);
      shipMesh.rotation.z = snapshot.ship.y * -0.08;
      shieldMesh.position.copy(shipMesh.position);
      shieldMaterial.opacity = snapshot.shieldAlpha * 0.45;
      shieldMesh.scale.setScalar(1 + snapshot.shieldAlpha * 0.5);

      syncMeshPool(enemyMeshes, snapshot.enemies.length, enemyGroup, () => {
        const mesh = new Mesh(enemyGeometry, enemyMaterial);
        mesh.visible = false;
        return mesh;
      });
      for (let i = 0; i < enemyMeshes.length; i += 1) {
        const mesh = enemyMeshes[i];
        const enemy = snapshot.enemies[i];
        if (!enemy) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.position.set(enemy.x, enemy.y, enemy.z);
        mesh.rotation.z = enemy.rotationZ;
      }

      syncMeshPool(
        projectileMeshes,
        snapshot.projectiles.length,
        projectileGroup,
        () => {
          const mesh = new Mesh(projectileGeometry, projectileMaterial);
          mesh.visible = false;
          return mesh;
        }
      );
      for (let i = 0; i < projectileMeshes.length; i += 1) {
        const mesh = projectileMeshes[i];
        const projectile = snapshot.projectiles[i];
        if (!projectile) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.position.set(projectile.x, projectile.y, projectile.z);
      }

      syncMeshPool(
        enemyProjectileMeshes,
        snapshot.enemyProjectiles.length,
        enemyProjectileGroup,
        () => {
          const mesh = new Mesh(projectileGeometry, enemyProjectileMaterial);
          mesh.visible = false;
          return mesh;
        }
      );
      for (let i = 0; i < enemyProjectileMeshes.length; i += 1) {
        const mesh = enemyProjectileMeshes[i];
        const projectile = snapshot.enemyProjectiles[i];
        if (!projectile) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.position.set(projectile.x, projectile.y, projectile.z);
      }

      syncMeshPool(explosionMeshes, snapshot.explosions.length, explosionGroup, () => {
        const mesh = new Mesh(explosionGeometry, explosionMaterial.clone());
        mesh.visible = false;
        return mesh;
      });
      for (let i = 0; i < explosionMeshes.length; i += 1) {
        const mesh = explosionMeshes[i];
        const explosion = snapshot.explosions[i];
        if (!explosion) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.position.set(explosion.x, explosion.y, explosion.z);
        mesh.scale.setScalar(explosion.scale);
        const material = mesh.material as MeshStandardMaterial;
        material.opacity = explosion.alpha;
        material.transparent = true;
      }
    },
    render() {
      renderer.render(scene, camera);
    },
    resize
  };
}

function syncMeshPool(
  meshes: Mesh[],
  requiredCount: number,
  parent: Group,
  createMesh: () => Mesh
): void {
  while (meshes.length < requiredCount) {
    const mesh = createMesh();
    meshes.push(mesh);
    parent.add(mesh);
  }
}
