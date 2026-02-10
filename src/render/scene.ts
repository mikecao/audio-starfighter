import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  MeshBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
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
  const FIXED_RENDER_WIDTH = 1920;
  const FIXED_RENDER_HEIGHT = 1080;
  const ORTHO_HALF_HEIGHT = 11.5;

  const scene = new Scene();
  const lowEnergyBg = new Color("#070707");
  const highEnergyBg = new Color("#141414");
  const currentBg = lowEnergyBg.clone();
  scene.background = currentBg;

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(0, 0, 20);
  camera.lookAt(new Vector3(0, 0, 0));

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(FIXED_RENDER_WIDTH, FIXED_RENDER_HEIGHT, false);
  renderer.domElement.classList.add("main-scene-canvas");
  container.appendChild(renderer.domElement);

  const ambientLight = new AmbientLight("#c7ced9", 0.4);
  scene.add(ambientLight);

  const directionalLight = new DirectionalLight("#fef2c2", 1.1);
  directionalLight.position.set(2, 4, 8);
  scene.add(directionalLight);

  const shipGeometry = new BoxGeometry(1.2, 0.6, 0.9);
  const shipMaterial = new MeshStandardMaterial({
    color: "#67e8f9",
    roughness: 0.25,
    metalness: 0.5,
    transparent: true,
    opacity: 0.62,
    side: DoubleSide,
    depthWrite: false
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
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 1
  });
  const enemyBaseColor = new Color("#f87171");
  const enemyHitColor = new Color("#fef08a");
  const enemyBaseEmissive = new Color("#7f1d1d");
  const enemyHitEmissive = new Color("#fde047");
  const enemyTintColor = new Color();
  const enemyTintEmissive = new Color();
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

  const laserGeometry = new BoxGeometry(1, 0.05, 0.04);
  const laserMaterial = new MeshBasicMaterial({
    color: "#22c55e",
    transparent: true,
    opacity: 0.95,
    blending: AdditiveBlending
  });
  const laserGroup = new Group();
  scene.add(laserGroup);
  const laserMeshes: Mesh[] = [];

  let previousShipY = 0;
  let previousShipTimeSeconds = 0;
  let hasPreviousShipY = false;
  let shipPitch = 0;

  const explosionGeometry = new SphereGeometry(0.4, 10, 8);
  const explosionMaterial = new MeshBasicMaterial({
    color: "#fde047",
    transparent: true,
    opacity: 1,
    blending: AdditiveBlending
  });
  const explosionRingGeometry = new RingGeometry(0.595, 0.62, 40);
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
  const coreColor = new Color();
  const ringColor = new Color();

  const closeStars = createStarLayer(130, 0xe0f2fe, 10.5, 0.12, 0.56);
  const nearStars = createStarLayer(220, 0x93c5fd, 6.6, 0.08, 0.34);
  const farStars = createStarLayer(150, 0x334155, 3.1, 0.05, 0.14);
  scene.add(farStars.primary);
  scene.add(farStars.wrap);
  scene.add(nearStars.primary);
  scene.add(nearStars.wrap);
  scene.add(closeStars.primary);
  scene.add(closeStars.wrap);

  function resize(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }

    const targetAspect = FIXED_RENDER_WIDTH / FIXED_RENDER_HEIGHT;
    let displayWidth = Math.min(width, FIXED_RENDER_WIDTH);
    let displayHeight = displayWidth / targetAspect;

    if (displayHeight > height) {
      displayHeight = Math.min(height, FIXED_RENDER_HEIGHT);
      displayWidth = displayHeight * targetAspect;
    }

    displayWidth = Math.max(1, displayWidth);
    displayHeight = Math.max(1, displayHeight);

    renderer.domElement.style.width = `${displayWidth}px`;
    renderer.domElement.style.height = `${displayHeight}px`;
    renderer.domElement.style.left = `${(width - displayWidth) * 0.5}px`;
    renderer.domElement.style.top = `${(height - displayHeight) * 0.5}px`;

    const halfWidth = ORTHO_HALF_HEIGHT * targetAspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = ORTHO_HALF_HEIGHT;
    camera.bottom = -ORTHO_HALF_HEIGHT;
    camera.updateProjectionMatrix();
  }

  resize();

  return {
    update(snapshot) {
      const starTimeSeconds = performance.now() * 0.001;
      shipMesh.position.set(snapshot.ship.x, snapshot.ship.y, snapshot.ship.z);
      const deltaY = hasPreviousShipY ? snapshot.ship.y - previousShipY : 0;
      const deltaTime = hasPreviousShipY
        ? Math.max(1e-3, snapshot.simTimeSeconds - previousShipTimeSeconds)
        : 1 / 60;
      const verticalVelocity = deltaY / deltaTime;
      hasPreviousShipY = true;
      previousShipY = snapshot.ship.y;
      previousShipTimeSeconds = snapshot.simTimeSeconds;
      const targetPitch = clamp01Signed(-verticalVelocity * 0.085, 0.58);
      shipPitch += (targetPitch - shipPitch) * 0.3;
      shipMesh.rotation.x = shipPitch;
      shipMesh.rotation.y = 0;
      shipMesh.rotation.z = 0;
      shieldMesh.position.copy(shipMesh.position);
      shieldMaterial.opacity = snapshot.shieldAlpha * 0.45;
      shieldMesh.scale.setScalar(1 + snapshot.shieldAlpha * 0.5);

      const intensity = snapshot.currentIntensity;
      currentBg.copy(lowEnergyBg).lerp(highEnergyBg, intensity);
      shipMaterial.emissive.set("#0e7490");
      shipMaterial.emissiveIntensity = 0.08 + intensity * 0.3;
      updateStarLayer(farStars, starTimeSeconds, snapshot.ship.y);
      updateStarLayer(nearStars, starTimeSeconds, snapshot.ship.y);
      updateStarLayer(closeStars, starTimeSeconds, snapshot.ship.y);

      syncMeshPool(enemyMeshes, snapshot.enemies.length, enemyGroup, () => {
        const mesh = new Mesh(enemyGeometry, enemyMaterial.clone());
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
        const entryAlpha = clamp01((18.4 - enemy.x) / 2.8);
        mesh.visible = entryAlpha > 0.01;
        if (!mesh.visible) {
          continue;
        }
        const flash = clamp01(enemy.damageFlash);
        const material = mesh.material as MeshStandardMaterial;
        enemyTintColor.lerpColors(enemyBaseColor, enemyHitColor, flash);
        material.color.copy(enemyTintColor);
        enemyTintEmissive.lerpColors(enemyBaseEmissive, enemyHitEmissive, flash);
        material.emissive.copy(enemyTintEmissive);
        material.emissiveIntensity = (0.18 + intensity * 0.6) + flash * (0.45 + intensity * 0.35);
        material.opacity = entryAlpha;
        mesh.position.set(enemy.x, enemy.y, enemy.z);
        mesh.rotation.x = 0.48;
        mesh.rotation.y = 0.58;
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

      syncMeshPool(laserMeshes, snapshot.laserBeams.length, laserGroup, () => {
        const mesh = new Mesh(laserGeometry, laserMaterial.clone());
        mesh.visible = false;
        return mesh;
      });
      for (let i = 0; i < laserMeshes.length; i += 1) {
        const mesh = laserMeshes[i];
        const beam = snapshot.laserBeams[i];
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
        const peakScale = explosion.power;
        const peakNormalized = normalizeExplosionPower(explosion.power);
        const intensityScale = 0.22 + peakScale * 0.88;
        const intensityGlow = 0.62 + peakNormalized * 1.05;
        const palette = EXPLOSION_PALETTES[explosion.variant % EXPLOSION_PALETTES.length];

        mesh.visible = true;
        mesh.position.set(explosion.x, explosion.y, explosion.z);
        mesh.scale.setScalar(explosion.scale * ARCADE_CORE_SCALE_MULTIPLIER * intensityScale);
        const material = mesh.material as MeshBasicMaterial;
        if (normalizedAge < 0.4) {
          coreColor.lerpColors(palette.coreStart, palette.coreMid, normalizedAge / 0.4);
        } else {
          coreColor.lerpColors(palette.coreMid, palette.coreEnd, (normalizedAge - 0.4) / 0.6);
        }
        material.color.copy(coreColor);
        material.opacity = Math.max(0, Math.pow(explosion.alpha, 0.55) * intensityGlow);

        ringMesh.visible = true;
        ringMesh.position.set(explosion.x, explosion.y, explosion.z + 0.01);
        ringMesh.scale.setScalar(
          0.5 + normalizedAge * ARCADE_RING_MAX_SCALE * (0.42 + peakNormalized * 0.78)
        );
        const ringMaterial = ringMesh.material as MeshBasicMaterial;
        ringColor.lerpColors(palette.ringStart, palette.ringEnd, normalizedAge);
        ringMaterial.color.copy(ringColor);
        ringMaterial.opacity = Math.max(
          0,
          Math.pow(1 - normalizedAge, 0.8) * (0.6 + peakNormalized * 0.9)
        );

        burst.points.visible = true;
        burst.points.position.set(explosion.x, explosion.y, explosion.z + 0.08);
        updateExplosionBurst(burst, normalizedAge, explosion.alpha, peakScale);
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
  primary: Points;
  wrap: Points;
  speed: number;
  parallaxFactor: number;
  loopWidth: number;
  baseOpacity: number;
};

type ExplosionBurst = {
  points: Points;
  baseDirections: Float32Array;
  positionAttribute: Float32BufferAttribute;
};

type ExplosionPalette = {
  coreStart: Color;
  coreMid: Color;
  coreEnd: Color;
  ringStart: Color;
  ringEnd: Color;
};

const ARCADE_PARTICLE_COUNT = 40;
const ARCADE_CORE_SCALE_MULTIPLIER = 2.35;
const ARCADE_RING_MAX_SCALE = 7.2;
const EXPLOSION_PALETTES: ExplosionPalette[] = [
  {
    coreStart: new Color("#f472b6"),
    coreMid: new Color("#60a5fa"),
    coreEnd: new Color("#38bdf8"),
    ringStart: new Color("#f0abfc"),
    ringEnd: new Color("#a78bfa")
  },
  {
    coreStart: new Color("#ef4444"),
    coreMid: new Color("#f97316"),
    coreEnd: new Color("#facc15"),
    ringStart: new Color("#fb7185"),
    ringEnd: new Color("#fb923c")
  },
  {
    coreStart: new Color("#22d3ee"),
    coreMid: new Color("#38bdf8"),
    coreEnd: new Color("#a3e635"),
    ringStart: new Color("#67e8f9"),
    ringEnd: new Color("#84cc16")
  },
  {
    coreStart: new Color("#fca5a5"),
    coreMid: new Color("#f9a8d4"),
    coreEnd: new Color("#c084fc"),
    ringStart: new Color("#fda4af"),
    ringEnd: new Color("#e879f9")
  },
  {
    coreStart: new Color("#4ade80"),
    coreMid: new Color("#22d3ee"),
    coreEnd: new Color("#60a5fa"),
    ringStart: new Color("#86efac"),
    ringEnd: new Color("#06b6d4")
  },
  {
    coreStart: new Color("#fde047"),
    coreMid: new Color("#fb923c"),
    coreEnd: new Color("#f43f5e"),
    ringStart: new Color("#fef08a"),
    ringEnd: new Color("#f97316")
  }
];

function createStarLayer(
  count: number,
  color: number,
  speed: number,
  size: number,
  parallaxFactor: number
): StarLayer {
  const fieldWidth = 74;
  const fieldHeight = 44;
  const basePositions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const offset = i * 3;
    basePositions[offset] = -fieldWidth * 0.5 + Math.random() * fieldWidth;
    basePositions[offset + 1] = -fieldHeight * 0.5 + Math.random() * fieldHeight;
    basePositions[offset + 2] = -7 - Math.random() * 6;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(basePositions, 3));

  const material = new PointsMaterial({
    color,
    size: size * 22,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.85
  });

  const primary = new Points(geometry, material);
  const wrap = new Points(geometry, material.clone());
  wrap.position.x = fieldWidth;
  const baseOpacity = 0.7 + (size > 0.08 ? 0.2 : size > 0.05 ? 0.1 : 0);

  return {
    primary,
    wrap,
    speed,
    parallaxFactor,
    loopWidth: fieldWidth,
    baseOpacity
  };
}

function updateStarLayer(layer: StarLayer, simTimeSeconds: number, shipY: number): void {
  const traveled = (simTimeSeconds * layer.speed) % layer.loopWidth;
  const baseX = -traveled;
  const parallaxYOffset = shipY * layer.parallaxFactor;
  const driftY = Math.sin(simTimeSeconds * (0.9 + layer.parallaxFactor)) * layer.parallaxFactor * 0.35;
  const twinkle =
    layer.baseOpacity + Math.sin(simTimeSeconds * (1.7 + layer.parallaxFactor * 2.2)) * 0.15;

  layer.primary.position.x = baseX;
  layer.primary.position.y = parallaxYOffset + driftY;
  layer.wrap.position.x = baseX + layer.loopWidth;
  layer.wrap.position.y = parallaxYOffset + driftY;

  const primaryMaterial = layer.primary.material as PointsMaterial;
  const wrapMaterial = layer.wrap.material as PointsMaterial;
  primaryMaterial.opacity = clamp01(twinkle);
  wrapMaterial.opacity = clamp01(twinkle * 0.98);
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
    size: 5.4,
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
  peakScale: number
): void {
  const peakNormalized = normalizeExplosionPower(peakScale);
  const intensityScale = 0.3 + peakScale * 0.85;
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
  material.opacity = Math.max(0, Math.pow(alpha, 0.3) * (0.72 + peakNormalized * 0.92));
  material.size = Math.max(
    1.8,
    (4.5 - normalizedAge * 2.4) * (0.58 + peakNormalized * 1.12)
  );
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeExplosionPower(power: number): number {
  return clamp01((power - 0.12) / (2.12 - 0.12));
}

function clamp01Signed(value: number, maxAbs: number): number {
  return Math.max(-maxAbs, Math.min(maxAbs, value));
}
