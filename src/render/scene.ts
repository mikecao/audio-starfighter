import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  BoxGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  MeshBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  RingGeometry,
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
  const lowEnergyBg = new Color("#070b14");
  const highEnergyBg = new Color("#1a1426");
  const currentBg = lowEnergyBg.clone();
  scene.background = currentBg;

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
    metalness: 0.2,
    emissive: "#7f1d1d",
    emissiveIntensity: 0.2
  });
  const enemyHitMaterial = new MeshStandardMaterial({
    color: "#fef08a",
    roughness: 0.25,
    metalness: 0.25,
    emissive: "#fde047",
    emissiveIntensity: 0.9
  });
  const enemyGeometry = new BoxGeometry(0.85, 0.85, 0.85);
  const enemyGroup = new Group();
  scene.add(enemyGroup);
  const enemyMeshes: Mesh[] = [];

  const playerProjectileGeometry = new BoxGeometry(0.9, 0.06, 0.06);
  const projectileMaterial = new MeshStandardMaterial({
    color: "#22d3ee",
    roughness: 0.15,
    metalness: 0.7,
    emissive: "#06b6d4",
    emissiveIntensity: 0.7
  });
  const projectileGroup = new Group();
  scene.add(projectileGroup);
  const projectileMeshes: Mesh[] = [];
  const enemyProjectileGeometry = new SphereGeometry(0.15, 12, 8);
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
  const explosionMaterial = new MeshBasicMaterial({
    color: "#fde047",
    transparent: true,
    opacity: 1,
    blending: AdditiveBlending
  });
  const explosionRingGeometry = new RingGeometry(0.45, 0.62, 32);
  const explosionRingMaterial = new MeshBasicMaterial({
    color: "#fb923c",
    transparent: true,
    opacity: 1,
    side: 2,
    blending: AdditiveBlending
  });
  const explosionGroup = new Group();
  scene.add(explosionGroup);
  const explosionMeshes: Mesh[] = [];
  const explosionRingMeshes: Mesh[] = [];
  const explosionParticleBursts: ExplosionBurst[] = [];

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

  const nearStars = createStarLayer(180, 0x93c5fd, 3.2, 0.06);
  const farStars = createStarLayer(120, 0x334155, 1.6, 0.04);
  scene.add(farStars.points);
  scene.add(nearStars.points);

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

      const intensity = snapshot.currentIntensity;
      currentBg.copy(lowEnergyBg).lerp(highEnergyBg, intensity);
      shipMaterial.emissive.set("#0e7490");
      shipMaterial.emissiveIntensity = 0.08 + intensity * 0.3;
      enemyMaterial.emissive.set("#7f1d1d");
      enemyMaterial.emissiveIntensity = 0.18 + intensity * 0.6;
      enemyHitMaterial.emissive.set("#fde047");
      enemyHitMaterial.emissiveIntensity = 0.55 + intensity * 0.65;
      updateStarLayer(farStars, snapshot.simTimeSeconds);
      updateStarLayer(nearStars, snapshot.simTimeSeconds);

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
        mesh.material = enemy.damageFlash > 0.02 ? enemyHitMaterial : enemyMaterial;
        mesh.position.set(enemy.x, enemy.y, enemy.z);
        mesh.rotation.z = enemy.rotationZ;
        const flashScale = 1 + enemy.damageFlash * 0.14;
        mesh.scale.setScalar(flashScale);
      }

      syncMeshPool(
        projectileMeshes,
        snapshot.projectiles.length,
        projectileGroup,
        () => {
          const mesh = new Mesh(playerProjectileGeometry, projectileMaterial);
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
        mesh.rotation.z = projectile.rotationZ;
      }

      syncMeshPool(
        enemyProjectileMeshes,
        snapshot.enemyProjectiles.length,
        enemyProjectileGroup,
        () => {
          const mesh = new Mesh(enemyProjectileGeometry, enemyProjectileMaterial);
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
      syncMeshPool(explosionRingMeshes, snapshot.explosions.length, explosionGroup, () => {
        const mesh = new Mesh(explosionRingGeometry, explosionRingMaterial.clone());
        mesh.visible = false;
        return mesh;
      });
      while (explosionParticleBursts.length < snapshot.explosions.length) {
        const burst = createExplosionBurst(explosionParticleBursts.length);
        burst.points.visible = false;
        explosionParticleBursts.push(burst);
        explosionGroup.add(burst.points);
      }
      for (let i = 0; i < explosionMeshes.length; i += 1) {
        const mesh = explosionMeshes[i];
        const ringMesh = explosionRingMeshes[i];
        const burst = explosionParticleBursts[i];
        const explosion = snapshot.explosions[i];
        if (!explosion) {
          mesh.visible = false;
          ringMesh.visible = false;
          burst.points.visible = false;
          continue;
        }

        const normalizedAge = clamp01(1 - explosion.alpha);
        const intensityScale = 0.75 + intensity * 1.45;
        const intensityGlow = 0.7 + intensity * 0.8;

        mesh.visible = true;
        mesh.position.set(explosion.x, explosion.y, explosion.z);
        mesh.scale.setScalar(explosion.scale * ARCADE_CORE_SCALE_MULTIPLIER * intensityScale);
        const material = mesh.material as MeshBasicMaterial;
        material.opacity = Math.max(0, Math.pow(explosion.alpha, 0.55) * intensityGlow);

        ringMesh.visible = true;
        ringMesh.position.set(explosion.x, explosion.y, explosion.z + 0.01);
        ringMesh.scale.setScalar(0.9 + normalizedAge * ARCADE_RING_MAX_SCALE * intensityScale);
        const ringMaterial = ringMesh.material as MeshBasicMaterial;
        ringMaterial.opacity = Math.max(
          0,
          Math.pow(1 - normalizedAge, 0.8) * (0.6 + intensity * 0.7)
        );

        burst.points.visible = true;
        burst.points.position.set(explosion.x, explosion.y, explosion.z + 0.02);
        updateExplosionBurst(burst, normalizedAge, explosion.alpha, intensity);
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

type StarLayer = {
  points: Points;
  basePositions: Float32Array;
  animatedPositions: Float32Array;
  speed: number;
};

type ExplosionBurst = {
  points: Points;
  baseDirections: Float32Array;
  positionAttribute: Float32BufferAttribute;
};

const ARCADE_PARTICLE_COUNT = 96;
const ARCADE_CORE_SCALE_MULTIPLIER = 3.4;
const ARCADE_RING_MAX_SCALE = 7.2;

function createStarLayer(
  count: number,
  color: number,
  speed: number,
  size: number
): StarLayer {
  const basePositions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const offset = i * 3;
    basePositions[offset] = -18 + Math.random() * 36;
    basePositions[offset + 1] = -8 + Math.random() * 16;
    basePositions[offset + 2] = -7 - Math.random() * 6;
  }

  const animatedPositions = new Float32Array(basePositions);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(animatedPositions, 3));

  const material = new PointsMaterial({
    color,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85
  });

  return {
    points: new Points(geometry, material),
    basePositions,
    animatedPositions,
    speed
  };
}

function updateStarLayer(layer: StarLayer, simTimeSeconds: number): void {
  const loopWidth = 36;
  const minX = -18;

  for (let i = 0; i < layer.basePositions.length; i += 3) {
    const baseX = layer.basePositions[i];
    const traveled = (simTimeSeconds * layer.speed) % loopWidth;
    let x = baseX - traveled;
    while (x < minX) {
      x += loopWidth;
    }
    layer.animatedPositions[i] = x;
  }

  const position = layer.points.geometry.getAttribute("position");
  position.needsUpdate = true;
}

function createExplosionBurst(seed: number): ExplosionBurst {
  const particleCount = ARCADE_PARTICLE_COUNT;
  const baseDirections = new Float32Array(particleCount * 3);
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i += 1) {
    const offset = i * 3;
    const angle = hash01(seed * 197 + i * 31) * Math.PI * 2;
    const radius = 0.75 + hash01(seed * 389 + i * 19) * 1.7;
    baseDirections[offset] = Math.cos(angle) * radius;
    baseDirections[offset + 1] = Math.sin(angle) * radius;
    baseDirections[offset + 2] = (hash01(seed * 521 + i * 7) - 0.5) * 0.35;
    positions[offset] = 0;
    positions[offset + 1] = 0;
    positions[offset + 2] = 0;
  }

  const geometry = new BufferGeometry();
  const positionAttribute = new Float32BufferAttribute(positions, 3);
  geometry.setAttribute("position", positionAttribute);
  const material = new PointsMaterial({
    color: "#fff1b3",
    size: 10,
    sizeAttenuation: false,
    transparent: true,
    opacity: 1,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });

  return {
    points: new Points(geometry, material),
    baseDirections,
    positionAttribute
  };
}

function updateExplosionBurst(
  burst: ExplosionBurst,
  normalizedAge: number,
  alpha: number,
  intensity: number
): void {
  const intensityScale = 0.75 + intensity * 1.45;
  const travel = (0.4 + normalizedAge * 7.8) * intensityScale;
  const wobble = Math.sin(normalizedAge * Math.PI * 5) * 0.08;
  const positions = burst.positionAttribute.array as Float32Array;
  for (let i = 0; i < burst.baseDirections.length; i += 3) {
    positions[i] = burst.baseDirections[i] * travel;
    positions[i + 1] = burst.baseDirections[i + 1] * travel;
    positions[i + 2] = burst.baseDirections[i + 2] * travel + wobble;
  }
  burst.positionAttribute.needsUpdate = true;

  const material = burst.points.material as PointsMaterial;
  material.opacity = Math.max(0, Math.pow(alpha, 0.35) * (0.65 + intensity * 0.7));
  material.size = (12 - normalizedAge * 6) * (0.7 + intensity * 0.9);
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
