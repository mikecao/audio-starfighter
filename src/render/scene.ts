import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  BoxGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Fog,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LinearFilter,
  MeshBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RGBAFormat,
  RingGeometry,
  Scene,
  SphereGeometry,
  TetrahedronGeometry,
  Vector2,
  Vector3,
  WebGLRenderer
} from "three";
import { MeshLine, MeshLineMaterial } from "three.meshline";
import type { SimulationSnapshot } from "../game/sim";
import type { SpectrumTimeline } from "../audio/types";

export type RenderScene = {
  update: (snapshot: SimulationSnapshot, alpha: number) => void;
  render: () => void;
  resize: () => void;
  setWaveformPlaneEnabled: (enabled: boolean) => void;
  setWaveformPlaneSpectrum: (spectrumBins: Float32Array | null) => void;
  setWaveformPlaneSpectrumTimeline: (timeline: SpectrumTimeline | null) => void;
  setWaveformPlaneData: (waveformLeft: Float32Array, waveformRight: Float32Array) => void;
  clearWaveformPlaneData: () => void;
  setWaveformPlaneTime: (timeSeconds: number) => void;
};

export function setupScene(container: HTMLElement): RenderScene {
  const FIXED_RENDER_WIDTH = 1920;
  const FIXED_RENDER_HEIGHT = 1080;
  const ORTHO_HALF_HEIGHT = 11.5;
  const ENEMY_BASE_OPACITY = 0.62;

  const scene = new Scene();
  const lowEnergyBg = new Color("#070707");
  const highEnergyBg = new Color("#141414");
  const currentBg = lowEnergyBg.clone();
  scene.background = currentBg;
  const sceneFog = new Fog(currentBg.clone(), WAVEFORM_SCENE_FOG_NEAR, WAVEFORM_SCENE_FOG_FAR);
  scene.fog = sceneFog;

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(0, 0, 20);
  camera.lookAt(new Vector3(0, 0, 0));

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(FIXED_RENDER_WIDTH, FIXED_RENDER_HEIGHT, false);
  renderer.domElement.classList.add("main-scene-canvas");
  container.appendChild(renderer.domElement);
  const meshLineResolution = new Vector2(FIXED_RENDER_WIDTH, FIXED_RENDER_HEIGHT);

  const ambientLight = new AmbientLight("#c7ced9", 0.4);
  scene.add(ambientLight);

  const directionalLight = new DirectionalLight("#fef2c2", 1.1);
  directionalLight.position.set(2, 4, 8);
  scene.add(directionalLight);
  const waveformTopLight = new PointLight("#b7ffd9", 2.2, 90, 2);
  waveformTopLight.position.set(0, 10, -14);
  scene.add(waveformTopLight);

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
    opacity: 1,
    side: DoubleSide,
    depthWrite: false
  });
  type EnemyRenderStyle = {
    baseColor: Color;
    hitColor: Color;
    baseEmissive: Color;
    hitEmissive: Color;
  };
  const enemyRenderStyles: Record<SimulationSnapshot["enemies"][number]["archetype"], EnemyRenderStyle> = {
    redCube: {
      baseColor: new Color("#f87171"),
      hitColor: new Color("#fef08a"),
      baseEmissive: new Color("#7f1d1d"),
      hitEmissive: new Color("#fde047")
    },
    greenTriangle: {
      baseColor: new Color("#4ade80"),
      hitColor: new Color("#fef08a"),
      baseEmissive: new Color("#166534"),
      hitEmissive: new Color("#bef264")
    }
  };
  const enemyTintColor = new Color();
  const enemyTintEmissive = new Color();
  const redCubeGeometry = new BoxGeometry(0.85, 0.85, 0.85);
  const greenTriangleGeometry = new TetrahedronGeometry(0.62, 0);
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
  const cueProjectileColor = new Color("#fde047");
  const cueProjectileEmissive = new Color("#f59e0b");
  const primaryProjectileColor = new Color("#22d3ee");
  const primaryProjectileEmissive = new Color("#06b6d4");
  const projectileGroup = new Group();
  scene.add(projectileGroup);
  const projectileMeshes: Mesh[] = [];
  const purplePulseGroup = new Group();
  scene.add(purplePulseGroup);
  const purplePulses: PurplePulseRenderable[] = [];
  const purplePulseIndexByMissileId = new Map<number, number>();
  syncPurplePulsePool(
    purplePulses,
    PURPLE_PULSE_MAX_POOL_SIZE,
    purplePulseGroup,
    meshLineResolution
  );
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
  const enemyProjectileLaserGeometry = new BoxGeometry(1.15, 0.055, 0.055);
  const enemyProjectileLaserMaterial = new MeshStandardMaterial({
    color: "#fb7185",
    roughness: 0.16,
    metalness: 0.38,
    emissive: "#f43f5e",
    emissiveIntensity: 0.95
  });
  const enemyProjectileLaserGroup = new Group();
  scene.add(enemyProjectileLaserGroup);
  const enemyProjectileLaserMeshes: Mesh[] = [];

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
  let lastMissileTrailSnapshotTime = -1;

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
  const sparkColor = new Color();

  const closeStars = createStarLayer(130, 0xe0f2fe, 10.5, 0.12, 0.56);
  const nearStars = createStarLayer(220, 0x93c5fd, 6.6, 0.08, 0.34);
  const farStars = createStarLayer(150, 0x334155, 3.1, 0.05, 0.14);
  scene.add(farStars.primary);
  scene.add(farStars.wrap);
  scene.add(nearStars.primary);
  scene.add(nearStars.wrap);
  scene.add(closeStars.primary);
  scene.add(closeStars.wrap);

  const waveformSpectrumTextureData = new Uint8Array(WAVEFORM_PLANE_SPECTRUM_BIN_COUNT * 4);
  for (let i = 0; i < waveformSpectrumTextureData.length; i += 4) {
    waveformSpectrumTextureData[i] = 0;
    waveformSpectrumTextureData[i + 1] = 0;
    waveformSpectrumTextureData[i + 2] = 0;
    waveformSpectrumTextureData[i + 3] = 255;
  }
  const waveformSpectrumTexture = new DataTexture(
    waveformSpectrumTextureData,
    WAVEFORM_PLANE_SPECTRUM_BIN_COUNT,
    1,
    RGBAFormat
  );
  waveformSpectrumTexture.magFilter = LinearFilter;
  waveformSpectrumTexture.minFilter = LinearFilter;
  waveformSpectrumTexture.needsUpdate = true;
  const waveformSpectrumSmoothed = new Float32Array(WAVEFORM_PLANE_SPECTRUM_BIN_COUNT);

  const waveformPlaneDisplacementUniforms = {
    uTimeSeconds: { value: 0 },
    uHeightScale: { value: WAVEFORM_PLANE_HEIGHT_SCALE },
    uAmplitudeDrive: { value: 0 },
    uSpectrumTex: { value: waveformSpectrumTexture }
  };
  const waveformPlaneDisplacementHeader = `
      uniform float uTimeSeconds;
      uniform float uHeightScale;
      uniform float uAmplitudeDrive;
      uniform sampler2D uSpectrumTex;

      float sampleSpectrum(float binNorm) {
        float u = clamp(binNorm, 0.0, 1.0);
        float stepSize = ${Math.max(1 / (WAVEFORM_PLANE_SPECTRUM_BIN_COUNT - 1), 1e-5).toFixed(6)};
        float c = texture2D(uSpectrumTex, vec2(u, 0.5)).r;
        float l = texture2D(uSpectrumTex, vec2(max(0.0, u - stepSize), 0.5)).r;
        float r = texture2D(uSpectrumTex, vec2(min(1.0, u + stepSize), 0.5)).r;
        return c * 0.52 + (l + r) * 0.24;
      }

      float computeHeight(vec2 uvPoint) {
        vec2 p = uvPoint * vec2(5.8, 8.9);
        p.x += uTimeSeconds * 1.84;
        float baseA = sin(p.x * 1.33 + p.y * 0.29) * 0.58;
        float baseB = sin(p.x * 0.79 - p.y * 1.14 + 1.12) * 0.37;
        float baseC = sin((p.x + p.y) * 1.47 - 0.46) * 0.25;
        float raw = abs(baseA + baseB + baseC);
        float ridgeSource = (raw * 1.24) / (1.0 + raw * 0.34);
        float ridge = pow(ridgeSource, 1.04);
        float depthScale = pow(max(0.0, 1.0 - uvPoint.y), 0.54);
        float lateral = 1.0 - smoothstep(0.18, 0.86, abs(uvPoint.x - 0.5));
        float depthSpectrumBin = pow(clamp(1.0 - uvPoint.y, 0.0, 1.0), 1.55);
        float sweepSpectrumBin = 0.5 + 0.5 * sin(
          uvPoint.x * 12.6 +
          uvPoint.y * 5.2 +
          uTimeSeconds * 1.28
        );
        float spectrum = mix(
          sampleSpectrum(depthSpectrumBin),
          sampleSpectrum(sweepSpectrumBin),
          0.42
        );
        float spectrumAccent = pow(max(0.0, spectrum), 1.08);
        float spectralShape = 0.56 + spectrum * 1.74 + spectrumAccent * 1.12;
        float amplitudeBoost = 0.76 + uAmplitudeDrive * 1.52;
        float nearEdgeFade = smoothstep(0.12, 0.42, uvPoint.y);
        float nearSafetyScale = 0.08 + nearEdgeFade * 0.92;
        float nearAmplitudeScale = 0.28 + nearEdgeFade * 0.72;
        return ridge * uHeightScale * (0.1 + depthScale * 0.88) * (0.74 + lateral * 0.46) * spectralShape * amplitudeBoost * nearSafetyScale * nearAmplitudeScale;
      }
  `;
  const waveformPlaneBeginNormal = `
      float heightN = computeHeight(uv);
      float steppedHeightN = floor(heightN * 8.0 + 0.5) / 8.0;
      float depthCurveN = pow(clamp(uv.y, 0.0, 1.0), 1.95);
      float depthMappedN = pow(clamp(uv.y, 0.0, 1.0), 1.55);
      float widthScaleN = mix(1.0, 0.44, depthCurveN);
      float heightAttenuationN = 1.0 - depthCurveN * 0.58;
      float baseXN = mix(-${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, uv.x);
      float baseYN = mix(-${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, depthMappedN);
      float baseZN = steppedHeightN * heightAttenuationN;
      float uvStepXN = ${Math.max(1 / Math.max(WAVEFORM_PLANE_SEGMENTS_X, 1), 1e-5).toFixed(6)};
      float uvStepYN = ${Math.max(1 / Math.max(WAVEFORM_PLANE_SEGMENTS_Y, 1), 1e-5).toFixed(6)};
      vec2 uvXN = vec2(min(1.0, uv.x + uvStepXN), uv.y);
      vec2 uvYN = vec2(uv.x, min(1.0, uv.y + uvStepYN));
      float hXN = floor(computeHeight(uvXN) * 8.0 + 0.5) / 8.0;
      float hYN = floor(computeHeight(uvYN) * 8.0 + 0.5) / 8.0;
      float depthCurveYN = pow(clamp(uvYN.y, 0.0, 1.0), 1.95);
      float depthMappedYN = pow(clamp(uvYN.y, 0.0, 1.0), 1.55);
      float widthScaleYN = mix(1.0, 0.44, depthCurveYN);
      float heightAttenuationYN = 1.0 - depthCurveYN * 0.58;
      float xXN = mix(-${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, uvXN.x) * widthScaleN;
      float yXN = baseYN;
      float zXN = hXN * heightAttenuationN;
      float xYN = baseXN * widthScaleYN;
      float yYN = mix(-${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, depthMappedYN);
      float zYN = hYN * heightAttenuationYN;
      vec3 tangentXN = vec3(xXN - baseXN * widthScaleN, yXN - baseYN, zXN - baseZN);
      vec3 tangentYN = vec3(xYN - baseXN * widthScaleN, yYN - baseYN, zYN - baseZN);
      vec3 objectNormal = normalize(cross(tangentXN, tangentYN));
  `;
  const waveformPlaneBeginVertex = `
      float heightV = computeHeight(uv);
      float steppedHeightV = floor(heightV * 8.0 + 0.5) / 8.0;
      float depthCurveV = pow(clamp(uv.y, 0.0, 1.0), 1.95);
      float depthMappedV = pow(clamp(uv.y, 0.0, 1.0), 1.55);
      float widthScaleV = mix(1.0, 0.44, depthCurveV);
      float heightAttenuationV = 1.0 - depthCurveV * 0.58;
      float baseXV = mix(-${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_WIDTH * 0.5).toFixed(6)}, uv.x);
      float baseYV = mix(-${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, ${(WAVEFORM_PLANE_HEIGHT * 0.5).toFixed(6)}, depthMappedV);
      float baseZV = steppedHeightV * heightAttenuationV;
      vec3 transformed = vec3(baseXV * widthScaleV, baseYV, position.z + baseZV);
  `;
  const applyWaveformPlaneDisplacement = (material: MeshStandardMaterial): void => {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, waveformPlaneDisplacementUniforms);
      shader.vertexShader = `${waveformPlaneDisplacementHeader}\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", waveformPlaneBeginNormal);
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", waveformPlaneBeginVertex);
    };
    material.customProgramCacheKey = () => "waveform-plane-displacement-v5";
  };
  const waveformPlaneMaterial = new MeshStandardMaterial({
    color: "#f2fff8",
    emissive: "#0d2f22",
    emissiveIntensity: 0.14,
    roughness: 0.9,
    metalness: 0,
    wireframe: true,
    transparent: false,
    side: FrontSide,
    depthWrite: false,
    depthTest: true
  });
  applyWaveformPlaneDisplacement(waveformPlaneMaterial);
  const waveformPlaneDepthMaterial = waveformPlaneMaterial.clone();
  waveformPlaneDepthMaterial.wireframe = false;
  waveformPlaneDepthMaterial.colorWrite = false;
  waveformPlaneDepthMaterial.transparent = false;
  waveformPlaneDepthMaterial.side = FrontSide;
  waveformPlaneDepthMaterial.fog = false;
  waveformPlaneDepthMaterial.depthWrite = true;
  waveformPlaneDepthMaterial.depthTest = true;
  applyWaveformPlaneDisplacement(waveformPlaneDepthMaterial);
  const waveformPlaneGeometry = new PlaneGeometry(
    WAVEFORM_PLANE_WIDTH,
    WAVEFORM_PLANE_HEIGHT,
    WAVEFORM_PLANE_SEGMENTS_X,
    WAVEFORM_PLANE_SEGMENTS_Y
  );
  const waveformPlaneDepthMesh = new Mesh(waveformPlaneGeometry, waveformPlaneDepthMaterial);
  waveformPlaneDepthMesh.position.set(0, -15.8, -28);
  waveformPlaneDepthMesh.rotation.x = -1.21;
  waveformPlaneDepthMesh.rotation.y = 0;
  waveformPlaneDepthMesh.rotation.z = 0;
  waveformPlaneDepthMesh.renderOrder = -2;
  const waveformPlaneMesh = new Mesh(waveformPlaneGeometry, waveformPlaneMaterial);
  waveformPlaneMesh.position.set(0, -15.8, -28);
  waveformPlaneMesh.rotation.x = -1.21;
  waveformPlaneMesh.rotation.y = 0;
  waveformPlaneMesh.rotation.z = 0;
  waveformPlaneMesh.renderOrder = -1;
  scene.add(waveformPlaneDepthMesh);
  scene.add(waveformPlaneMesh);

  let waveformPlaneEnabled = true;
  let waveformPlaneHasData = true;
  let waveformPlaneTimeSeconds = 0;
  let waveformPlaneAmplitudeDrive = 0;
  let waveformPlaneAmplitudePeak = 0.35;
  let waveformPlaneSpectrumPeak = 0.35;

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

    meshLineResolution.set(displayWidth, displayHeight);
    for (const pulse of purplePulses) {
      pulse.material.resolution = meshLineResolution;
    }

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
      const starTimeSeconds = snapshot.simTimeSeconds;
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
      sceneFog.color.copy(currentBg);
      shipMaterial.emissive.set("#0e7490");
      shipMaterial.emissiveIntensity = 0.08 + intensity * 0.3;
      updateStarLayer(farStars, starTimeSeconds, snapshot.ship.y);
      updateStarLayer(nearStars, starTimeSeconds, snapshot.ship.y);
      updateStarLayer(closeStars, starTimeSeconds, snapshot.ship.y);

      const waveformPlaneVisible = waveformPlaneEnabled && waveformPlaneHasData;
      waveformPlaneDepthMesh.visible = waveformPlaneVisible;
      waveformPlaneMesh.visible = waveformPlaneVisible;
      if (waveformPlaneVisible) {
        waveformPlaneDisplacementUniforms.uTimeSeconds.value = waveformPlaneTimeSeconds;
        waveformPlaneDisplacementUniforms.uAmplitudeDrive.value = waveformPlaneAmplitudeDrive;
      }

      syncMeshPool(enemyMeshes, snapshot.enemies.length, enemyGroup, () => {
        const mesh = new Mesh(redCubeGeometry, enemyMaterial.clone());
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
        const style = enemyRenderStyles[enemy.archetype] ?? enemyRenderStyles.redCube;
        const material = mesh.material as MeshStandardMaterial;
        const expectedGeometry =
          enemy.archetype === "greenTriangle" ? greenTriangleGeometry : redCubeGeometry;
        if (mesh.geometry !== expectedGeometry) {
          mesh.geometry = expectedGeometry;
        }
        enemyTintColor.lerpColors(style.baseColor, style.hitColor, flash);
        material.color.copy(enemyTintColor);
        enemyTintEmissive.lerpColors(style.baseEmissive, style.hitEmissive, flash);
        material.emissive.copy(enemyTintEmissive);
        material.emissiveIntensity = (0.18 + intensity * 0.6) + flash * (0.45 + intensity * 0.35);
        material.opacity = entryAlpha * ENEMY_BASE_OPACITY;
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

      syncMeshPool(
        projectileMeshes,
        snapshot.projectiles.length,
        projectileGroup,
        () => {
          const mesh = new Mesh(playerProjectileGeometry, projectileMaterial.clone());
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
        const material = mesh.material as MeshStandardMaterial;
        if (projectile.isCueShot) {
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

      if (snapshot.enemyProjectileStyle === "lasers") {
        for (const mesh of enemyProjectileMeshes) {
          mesh.visible = false;
        }

        syncMeshPool(
          enemyProjectileLaserMeshes,
          snapshot.enemyProjectiles.length,
          enemyProjectileLaserGroup,
          () => {
            const mesh = new Mesh(enemyProjectileLaserGeometry, enemyProjectileLaserMaterial);
            mesh.visible = false;
            return mesh;
          }
        );
        for (let i = 0; i < enemyProjectileLaserMeshes.length; i += 1) {
          const mesh = enemyProjectileLaserMeshes[i];
          const projectile = snapshot.enemyProjectiles[i];
          if (!projectile) {
            mesh.visible = false;
            continue;
          }
          mesh.visible = true;
          mesh.position.set(projectile.x, projectile.y, projectile.z);
          mesh.rotation.z = projectile.rotationZ;
        }
      } else {
        for (const mesh of enemyProjectileLaserMeshes) {
          mesh.visible = false;
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
      }

      if (snapshot.simTimeSeconds < lastMissileTrailSnapshotTime - 1e-6) {
        for (const pulse of purplePulses) {
          clearPurplePulseRenderable(pulse);
        }
        purplePulseIndexByMissileId.clear();
      }
      lastMissileTrailSnapshotTime = snapshot.simTimeSeconds;

      if (snapshot.purpleMissileEnabled) {
        const missileById = new Map<number, SimulationSnapshot["missiles"][number]>();
        for (const missile of snapshot.missiles) {
          missileById.set(missile.id, missile);
        }

        let bindingsThisFrame = 0;
        for (const missile of snapshot.missiles) {
          if (purplePulseIndexByMissileId.has(missile.id)) {
            continue;
          }
          const travelDurationSeconds = computePurplePulseTravelDuration(snapshot.simTimeSeconds, missile);
          if (missile.ageSeconds >= travelDurationSeconds - 1e-4) {
            continue;
          }
          if (bindingsThisFrame >= PURPLE_PULSE_MAX_NEW_BINDINGS_PER_FRAME) {
            break;
          }

          const freeIndex = purplePulses.findIndex((pulse) => pulse.missileId === null);
          if (freeIndex < 0) {
            break;
          }

          const pulse = purplePulses[freeIndex];
          bindPurplePulseRenderable(pulse, missile);
          purplePulseIndexByMissileId.set(missile.id, freeIndex);
          bindingsThisFrame += 1;
        }

        for (let i = 0; i < purplePulses.length; i += 1) {
          const pulse = purplePulses[i];
          if (pulse.missileId === null) {
            continue;
          }

          const missile = missileById.get(pulse.missileId);
          if (missile) {
            pulse.animationDurationSeconds = computePurplePulseTravelDuration(
              snapshot.simTimeSeconds,
              missile
            );
            pulse.animationStartTimeSeconds = snapshot.simTimeSeconds - missile.ageSeconds;
          }

          pulse.mesh.visible = true;
          const elapsed = snapshot.simTimeSeconds - pulse.animationStartTimeSeconds;
          const progress = clamp01(elapsed / Math.max(1e-4, pulse.animationDurationSeconds));
          const shapedProgress = Math.pow(progress, PURPLE_PULSE_TERMINAL_ACCELERATION_POWER);
          setDashOffset(
            pulse.material,
            -lerp(PURPLE_PULSE_DASH_START, PURPLE_PULSE_DASH_END, shapedProgress)
          );
          setDashRatio(pulse.material, PURPLE_PULSE_TRAVEL_DASH_RATIO);
          pulse.material.opacity = 0.92 * (1 - progress * 0.1);

          if (progress >= 1) {
            if (pulse.missileId !== null) {
              purplePulseIndexByMissileId.delete(pulse.missileId);
            }
            clearPurplePulseRenderable(pulse);
          }
        }
      } else {
        for (const pulse of purplePulses) {
          clearPurplePulseRenderable(pulse);
        }
        purplePulseIndexByMissileId.clear();
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

        sparkColor.lerpColors(coreColor, ringColor, 0.4 + normalizedAge * 0.35);

        burst.points.visible = true;
        burst.points.position.set(explosion.x, explosion.y, explosion.z + 0.08);
        updateExplosionBurst(burst, normalizedAge, explosion.alpha, peakScale, sparkColor);
      }
    },
    render() {
      renderer.render(scene, camera);
    },
    resize,
    setWaveformPlaneEnabled(enabled) {
      waveformPlaneEnabled = enabled;
      const visible = waveformPlaneEnabled && waveformPlaneHasData;
      waveformPlaneDepthMesh.visible = visible;
      waveformPlaneMesh.visible = visible;
    },
    setWaveformPlaneSpectrum(spectrumBins) {
      if (!spectrumBins || spectrumBins.length === 0) {
        waveformPlaneAmplitudeDrive = 0;
        waveformPlaneAmplitudePeak = 0.22;
        waveformPlaneSpectrumPeak = 0.22;
        for (let i = 0; i < WAVEFORM_PLANE_SPECTRUM_BIN_COUNT; i += 1) {
          waveformSpectrumSmoothed[i] = 0;
          const encoded = 0;
          const offset = i * 4;
          waveformSpectrumTextureData[offset] = encoded;
          waveformSpectrumTextureData[offset + 1] = encoded;
          waveformSpectrumTextureData[offset + 2] = encoded;
          waveformSpectrumTextureData[offset + 3] = 255;
        }
        waveformSpectrumTexture.needsUpdate = true;
        return;
      }

      const maxSourceIndex = Math.max(0, spectrumBins.length - 1);
      let frameSpectrumPeak = 0;
      for (let i = 0; i < spectrumBins.length; i += 1) {
        frameSpectrumPeak = Math.max(frameSpectrumPeak, clamp(spectrumBins[i] ?? 0, 0, 1));
      }
      waveformPlaneSpectrumPeak = clamp(frameSpectrumPeak, 0.22, 1.4);
      const lowBandCount = Math.max(1, Math.min(spectrumBins.length, Math.floor(spectrumBins.length * 0.12)));
      let lowBandWeightedSum = 0;
      let lowBandWeightTotal = 0;
      for (let i = 0; i < lowBandCount; i += 1) {
        const normalized = lowBandCount <= 1 ? 0 : i / (lowBandCount - 1);
        const weight = 1.0 - normalized * 0.75;
        lowBandWeightedSum += clamp(spectrumBins[i] ?? 0, 0, 1) * weight;
        lowBandWeightTotal += weight;
      }
      const lowBandDrive = lowBandWeightTotal > 0 ? lowBandWeightedSum / lowBandWeightTotal : 0;
      const lowMidBandCount = Math.max(
        1,
        Math.min(spectrumBins.length, Math.floor(spectrumBins.length * 0.3))
      );
      let lowMidBandWeightedSum = 0;
      let lowMidBandWeightTotal = 0;
      for (let i = 0; i < lowMidBandCount; i += 1) {
        const normalized = lowMidBandCount <= 1 ? 0 : i / (lowMidBandCount - 1);
        const weight = 1.0 - normalized * 0.6;
        lowMidBandWeightedSum += clamp(spectrumBins[i] ?? 0, 0, 1) * weight;
        lowMidBandWeightTotal += weight;
      }
      const lowMidBandDrive = lowMidBandWeightTotal > 0 ? lowMidBandWeightedSum / lowMidBandWeightTotal : 0;
      const rawAmplitudeTarget = clamp(
        Math.pow(lowBandDrive, 0.78) * 0.92 + Math.pow(lowMidBandDrive, 0.86) * 0.44,
        0,
        1
      );
      waveformPlaneAmplitudePeak = clamp(rawAmplitudeTarget, 0.22, 1.2);
      const normalizedAmplitudeTarget = clamp(rawAmplitudeTarget, 0, 1);
      const amplitudeNoiseGate = 0.04;
      const amplitudeTarget =
        normalizedAmplitudeTarget <= amplitudeNoiseGate
          ? 0
          : clamp(
              (normalizedAmplitudeTarget - amplitudeNoiseGate) / (1 - amplitudeNoiseGate),
              0,
              1
            );
      waveformPlaneAmplitudeDrive = amplitudeTarget;

      for (let i = 0; i < WAVEFORM_PLANE_SPECTRUM_BIN_COUNT; i += 1) {
        const t =
          WAVEFORM_PLANE_SPECTRUM_BIN_COUNT <= 1
            ? 0
            : i / (WAVEFORM_PLANE_SPECTRUM_BIN_COUNT - 1);
        const sourcePos = Math.pow(t, 1.36) * maxSourceIndex;
        const target = clamp(sampleWaveformLinear(spectrumBins, sourcePos), 0, 1);
        waveformSpectrumSmoothed[i] = target;
        const encoded = Math.round(target * 255);
        const offset = i * 4;
        waveformSpectrumTextureData[offset] = encoded;
        waveformSpectrumTextureData[offset + 1] = encoded;
        waveformSpectrumTextureData[offset + 2] = encoded;
        waveformSpectrumTextureData[offset + 3] = 255;
      }

      waveformSpectrumTexture.needsUpdate = true;
    },
    setWaveformPlaneSpectrumTimeline(timeline) {
      void timeline;
      waveformPlaneHasData = true;
      const visible = waveformPlaneEnabled;
      waveformPlaneDepthMesh.visible = visible;
      waveformPlaneMesh.visible = visible;
    },
    setWaveformPlaneData(waveformLeft, waveformRight) {
      void waveformLeft;
      void waveformRight;
      waveformPlaneHasData = true;
      const visible = waveformPlaneEnabled;
      waveformPlaneDepthMesh.visible = visible;
      waveformPlaneMesh.visible = visible;
    },
    clearWaveformPlaneData() {
      waveformPlaneHasData = false;
      waveformPlaneDepthMesh.visible = false;
      waveformPlaneMesh.visible = false;
    },
    setWaveformPlaneTime(timeSeconds) {
      waveformPlaneTimeSeconds = Math.max(0, timeSeconds);
    }
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

function syncPurplePulsePool(
  pulses: PurplePulseRenderable[],
  requiredCount: number,
  parent: Group,
  resolution: Vector2
): void {
  while (pulses.length < requiredCount) {
    const line = new MeshLine();
    line.setPoints([0, 0, MISSILE_TRAIL_Z_OFFSET, 0.01, 0, MISSILE_TRAIL_Z_OFFSET]);
    const material = createPurplePulseMaterial(resolution);
    const mesh = new Mesh(line, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    parent.add(mesh);
    pulses.push({
      mesh,
      line,
      material,
      missileId: null,
      animationStartTimeSeconds: -1,
      animationDurationSeconds: PURPLE_PULSE_MIN_DURATION_SECONDS
    });
  }
}

function createPurplePulseMaterial(resolution: Vector2): MeshLineMaterial {
  return new MeshLineMaterial({
    color: "#a855f7",
    transparent: true,
    opacity: 0.92,
    lineWidth: MISSILE_TRAIL_LINE_WIDTH,
    dashArray: 1,
    dashRatio: PURPLE_PULSE_TRAVEL_DASH_RATIO,
    dashOffset: 0,
    sizeAttenuation: 1,
    resolution,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
}

function bindPurplePulseRenderable(
  pulse: PurplePulseRenderable,
  missile: SimulationSnapshot["missiles"][number]
): void {
  pulse.line.setPoints(
    buildPurplePulsePathPoints(
      missile.launchX,
      missile.launchY,
      missile.targetX,
      missile.targetY,
      missile.loopDirection,
      missile.loopTurns,
      missile.pathVariant
    )
  );
  pulse.missileId = missile.id;
  setDashOffset(pulse.material, 0);
  setDashRatio(pulse.material, PURPLE_PULSE_TRAVEL_DASH_RATIO);
}

function clearPurplePulseRenderable(pulse: PurplePulseRenderable): void {
  pulse.missileId = null;
  pulse.animationStartTimeSeconds = -1;
  pulse.animationDurationSeconds = PURPLE_PULSE_MIN_DURATION_SECONDS;
  pulse.mesh.visible = false;
  setDashOffset(pulse.material, 0);
  setDashRatio(pulse.material, PURPLE_PULSE_TRAVEL_DASH_RATIO);
}

function computePurplePulseTravelDuration(
  simTimeSeconds: number,
  missile: SimulationSnapshot["missiles"][number]
): number {
  const launchTimeSeconds = simTimeSeconds - missile.ageSeconds;
  const cueTravelSeconds = missile.cueTimeSeconds - launchTimeSeconds;
  return Math.max(PURPLE_PULSE_MIN_DURATION_SECONDS, cueTravelSeconds);
}

function buildPurplePulsePathPoints(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  loopDirection: number,
  loopTurns: number,
  pathVariant: number
): Float32Array {
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const effectiveDistance = Math.max(distance, PURPLE_PULSE_MIN_EFFECTIVE_DISTANCE);
  const virtualDx = (dx / distance) * effectiveDistance;
  const virtualDy = (dy / distance) * effectiveDistance;
  const dirX = dx / distance;
  const dirY = dy / distance;
  const perpX = -dirY;
  const perpY = dirX;

  const variant = clamp(pathVariant, 0, 1);
  const variantPhase = variant * Math.PI * 2;

  const loopRadius = clamp(effectiveDistance * (0.58 + variant * 0.22), 3.1, 10.4);
  const launchBackBase =
    PURPLE_PULSE_BACK_DRIFT_MIN +
    variant * (PURPLE_PULSE_BACK_DRIFT_MAX - PURPLE_PULSE_BACK_DRIFT_MIN);
  const launchBackDistanceScale = clamp(
    effectiveDistance / PURPLE_PULSE_BACK_DRIFT_DISTANCE_REFERENCE,
    0.84,
    1.38
  );
  const launchBackDrift = launchBackBase * launchBackDistanceScale;
  const launchArcStrength =
    PURPLE_PULSE_LAUNCH_ARC_MIN +
    Math.abs(Math.sin(variantPhase * 0.73)) *
      (PURPLE_PULSE_LAUNCH_ARC_MAX - PURPLE_PULSE_LAUNCH_ARC_MIN);
  const loopSide = loopDirection < 0 ? -1 : 1;
  const turns = clamp(loopTurns + (variant - 0.5) * 0.28, 1.04, 1.52);
  const axialSweep = clamp(PURPLE_PULSE_AXIAL_SWEEP_BASE + (variant - 0.5) * 0.18, 0.2, 0.52);
  const envelopePower = clamp(PURPLE_PULSE_ENVELOPE_POWER_BASE + (0.5 - variant) * 0.2, 0.58, 0.9);
  const pointCount = PURPLE_PULSE_TOTAL_SAMPLES;
  const points = new Float32Array(pointCount * 3);

  for (let i = 0; i < pointCount; i += 1) {
    const t = pointCount > 1 ? i / (pointCount - 1) : 0;
    const easedT = easeInOutSine(t);
    const delayedVerticalT = clamp(
      (t - PURPLE_PULSE_VERTICAL_DELAY_PORTION) /
        Math.max(1e-4, 1 - PURPLE_PULSE_VERTICAL_DELAY_PORTION),
      0,
      1
    );
    const easedVerticalT = easeInOutSine(delayedVerticalT);
    const angle = turns * Math.PI * 2 * t + variantPhase * 0.16;
    const envelope = Math.pow(Math.sin(Math.PI * t), envelopePower);

    const lateralPrimary = Math.sin(angle) * loopRadius * envelope;
    const lateralSecondary =
      Math.sin(angle * (1.62 + variant * 0.46) + variantPhase * 0.9) *
      loopRadius *
      (0.08 + variant * 0.08) *
      envelope;
    const lateral = (lateralPrimary + lateralSecondary) * loopSide;

    const axialLoop = (Math.cos(angle) - 1) * loopRadius * axialSweep * envelope;
    const launchBack =
      -launchBackDrift * t * Math.pow(1 - t, 2) * (1 + PURPLE_PULSE_BACK_DRIFT_BOOST * (1 - t));
    const launchArc =
      loopSide *
      launchArcStrength *
      t *
      Math.pow(1 - t, 1.85) *
      effectiveDistance *
      0.24;

    const baseX = startX + virtualDx * easedT;
    const baseY = startY + virtualDy * easedVerticalT;
    const verticalOffset = (perpY * lateral + dirY * axialLoop) * easedVerticalT;
    const offset = i * 3;
    const x = baseX + perpX * lateral + dirX * axialLoop + launchBack;
    let y = baseY + verticalOffset + launchArc;
    if (t <= PURPLE_PULSE_LAUNCH_CLAMP_PORTION) {
      const dxFromStart = Math.abs(x - startX);
      const maxDy = dxFromStart * PURPLE_PULSE_MAX_LAUNCH_SLOPE;
      y = startY + clamp(y - startY, -maxDy, maxDy);
    }

    points[offset] = x;
    points[offset + 1] = y;
    points[offset + 2] = MISSILE_TRAIL_Z_OFFSET;
  }

  smoothPurplePulseLaunchSegment(
    points,
    startX,
    startY,
    dirX,
    dirY,
    perpX,
    perpY,
    loopSide,
    effectiveDistance
  );
  smoothPurplePulseTerminalSegment(points, targetX, targetY, dirX, dirY);

  return points;
}

function smoothPurplePulseLaunchSegment(
  points: Float32Array,
  startX: number,
  startY: number,
  targetDirX: number,
  targetDirY: number,
  perpX: number,
  perpY: number,
  loopSide: number,
  effectiveDistance: number
): void {
  const pointCount = points.length / 3;
  if (pointCount < 5) {
    return;
  }

  let launchEndIndex = clamp(
    Math.floor((pointCount - 1) * PURPLE_PULSE_LAUNCH_PHASE_END),
    2,
    pointCount - 2
  );
  while (launchEndIndex < pointCount - 2) {
    const offset = launchEndIndex * 3;
    const span = Math.hypot(points[offset] - startX, points[offset + 1] - startY);
    if (span >= PURPLE_PULSE_LAUNCH_MIN_SPAN) {
      break;
    }
    launchEndIndex += 1;
  }

  const endOffset = launchEndIndex * 3;
  const nextOffset = (launchEndIndex + 1) * 3;
  const endX = points[endOffset];
  const endY = points[endOffset + 1];
  const nextX = points[nextOffset];
  const nextY = points[nextOffset + 1];

  const exitRawX = nextX - endX;
  const exitRawY = nextY - endY;
  const exitRawLength = Math.hypot(exitRawX, exitRawY);
  const exitDirX = exitRawLength > 1e-4 ? exitRawX / exitRawLength : targetDirX;
  const exitDirY = exitRawLength > 1e-4 ? exitRawY / exitRawLength : targetDirY;

  const launchRawX =
    -targetDirX * PURPLE_PULSE_LAUNCH_BACK_DIRECTION_WEIGHT +
    loopSide * perpX * PURPLE_PULSE_LAUNCH_SIDE_DIRECTION_WEIGHT;
  const launchRawY =
    -targetDirY * PURPLE_PULSE_LAUNCH_BACK_DIRECTION_WEIGHT +
    loopSide * perpY * PURPLE_PULSE_LAUNCH_SIDE_DIRECTION_WEIGHT;
  const launchRawLength = Math.hypot(launchRawX, launchRawY);
  const launchDirX = launchRawLength > 1e-4 ? launchRawX / launchRawLength : -targetDirX;
  const launchDirY = launchRawLength > 1e-4 ? launchRawY / launchRawLength : -targetDirY;

  const launchDistance = Math.max(0.8, Math.hypot(endX - startX, endY - startY));
  const straightDistanceCap = Math.max(1.2, launchDistance - PURPLE_PULSE_LAUNCH_CURVE_MIN_SPAN);
  const desiredStraightDistance = Math.max(
    PURPLE_PULSE_LAUNCH_STRAIGHT_MIN_DISTANCE,
    effectiveDistance * PURPLE_PULSE_LAUNCH_STRAIGHT_DISTANCE_SCALE
  );
  const straightDistance = Math.min(straightDistanceCap, desiredStraightDistance);
  let straightEndIndex = clamp(
    Math.floor(launchEndIndex * PURPLE_PULSE_LAUNCH_STRAIGHT_PHASE_END),
    1,
    launchEndIndex - 2
  );
  while (straightEndIndex < launchEndIndex - 2) {
    const offset = straightEndIndex * 3;
    const span = Math.hypot(points[offset] - startX, points[offset + 1] - startY);
    if (span >= straightDistance) {
      break;
    }
    straightEndIndex += 1;
  }

  const straightEndX = startX + launchDirX * straightDistance;
  const straightEndY = startY + launchDirY * straightDistance;
  for (let i = 0; i <= straightEndIndex; i += 1) {
    const u = straightEndIndex > 0 ? i / straightEndIndex : 1;
    const offset = i * 3;
    points[offset] = startX + (straightEndX - startX) * u;
    points[offset + 1] = startY + (straightEndY - startY) * u;
  }

  const curvedDistance = Math.max(0.8, Math.hypot(endX - straightEndX, endY - straightEndY));
  const outHandleLength = clamp(
    effectiveDistance * PURPLE_PULSE_LAUNCH_OUT_HANDLE_SCALE,
    1.24,
    Math.max(1.8, curvedDistance * 0.95)
  );
  const inHandleLength = clamp(
    curvedDistance * PURPLE_PULSE_LAUNCH_IN_HANDLE_SCALE,
    0.92,
    Math.max(1.2, curvedDistance * 0.86)
  );

  const controlOneX = straightEndX + launchDirX * outHandleLength;
  const controlOneY = straightEndY + launchDirY * outHandleLength;
  const controlTwoX = endX - exitDirX * inHandleLength;
  const controlTwoY = endY - exitDirY * inHandleLength;

  const curvedSampleCount = launchEndIndex - straightEndIndex;
  for (let i = 0; i <= curvedSampleCount; i += 1) {
    const u = curvedSampleCount > 0 ? i / curvedSampleCount : 1;
    const invU = 1 - u;
    const b0 = invU * invU * invU;
    const b1 = 3 * invU * invU * u;
    const b2 = 3 * invU * u * u;
    const b3 = u * u * u;
    const offset = (straightEndIndex + i) * 3;

    points[offset] =
      b0 * straightEndX + b1 * controlOneX + b2 * controlTwoX + b3 * endX;
    points[offset + 1] =
      b0 * straightEndY + b1 * controlOneY + b2 * controlTwoY + b3 * endY;
  }
}

function smoothPurplePulseTerminalSegment(
  points: Float32Array,
  targetX: number,
  targetY: number,
  targetDirX: number,
  targetDirY: number
): void {
  const pointCount = points.length / 3;
  if (pointCount < 4) {
    return;
  }

  let terminalStartIndex = clamp(
    Math.floor((pointCount - 1) * PURPLE_PULSE_TERMINAL_PHASE_START),
    1,
    pointCount - 2
  );
  while (terminalStartIndex > 1) {
    const offset = terminalStartIndex * 3;
    const remaining = Math.hypot(targetX - points[offset], targetY - points[offset + 1]);
    if (remaining >= PURPLE_PULSE_TERMINAL_MIN_SPAN) {
      break;
    }
    terminalStartIndex -= 1;
  }

  const startOffset = terminalStartIndex * 3;
  const prevOffset = (terminalStartIndex - 1) * 3;

  const startX = points[startOffset];
  const startY = points[startOffset + 1];
  const prevX = points[prevOffset];
  const prevY = points[prevOffset + 1];

  const directApproachX = targetX - startX;
  const directApproachY = targetY - startY;
  const directApproachLength = Math.hypot(directApproachX, directApproachY);
  const directApproachDirX =
    directApproachLength > 1e-4 ? directApproachX / directApproachLength : targetDirX;
  const directApproachDirY =
    directApproachLength > 1e-4 ? directApproachY / directApproachLength : targetDirY;

  let entryDirX = startX - prevX;
  let entryDirY = startY - prevY;
  const entryDirLength = Math.hypot(entryDirX, entryDirY);
  if (entryDirLength > 1e-4) {
    entryDirX /= entryDirLength;
    entryDirY /= entryDirLength;
  } else {
    entryDirX = targetDirX;
    entryDirY = targetDirY;
  }

  const remainingDistance = Math.max(0.5, Math.hypot(targetX - startX, targetY - startY));
  const blendedTargetDirX = targetDirX * 0.28 + directApproachDirX * 0.72;
  const blendedTargetDirY = targetDirY * 0.28 + directApproachDirY * 0.72;
  const blendedTargetDirLength = Math.hypot(blendedTargetDirX, blendedTargetDirY);
  const resolvedTargetDirX =
    blendedTargetDirLength > 1e-4 ? blendedTargetDirX / blendedTargetDirLength : directApproachDirX;
  const resolvedTargetDirY =
    blendedTargetDirLength > 1e-4 ? blendedTargetDirY / blendedTargetDirLength : directApproachDirY;

  const outHandleLength = clamp(
    remainingDistance * PURPLE_PULSE_TERMINAL_OUT_HANDLE_SCALE,
    0.24,
    Math.max(0.4, remainingDistance * 0.88)
  );
  const inHandleLength = clamp(
    remainingDistance * PURPLE_PULSE_TERMINAL_IN_HANDLE_SCALE,
    0.26,
    Math.max(0.46, remainingDistance * 0.92)
  );

  const controlOneX = startX + entryDirX * outHandleLength;
  const controlOneY = startY + entryDirY * outHandleLength;
  const controlTwoX = targetX - resolvedTargetDirX * inHandleLength;
  const controlTwoY = targetY - resolvedTargetDirY * inHandleLength;

  const terminalSampleCount = pointCount - 1 - terminalStartIndex;
  for (let i = 0; i <= terminalSampleCount; i += 1) {
    const u = terminalSampleCount > 0 ? i / terminalSampleCount : 1;
    const invU = 1 - u;
    const b0 = invU * invU * invU;
    const b1 = 3 * invU * invU * u;
    const b2 = 3 * invU * u * u;
    const b3 = u * u * u;
    const offset = (terminalStartIndex + i) * 3;

    points[offset] =
      b0 * startX + b1 * controlOneX + b2 * controlTwoX + b3 * targetX;
    points[offset + 1] =
      b0 * startY + b1 * controlOneY + b2 * controlTwoY + b3 * targetY;
  }
}

function easeInOutSine(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function setDashOffset(material: MeshLineMaterial, value: number): void {
  const dashOffsetUniform = material.uniforms.dashOffset;
  if (dashOffsetUniform) {
    dashOffsetUniform.value = value;
  }
}

function setDashRatio(material: MeshLineMaterial, value: number): void {
  const dashRatioUniform = material.uniforms.dashRatio;
  if (dashRatioUniform) {
    dashRatioUniform.value = value;
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

type PurplePulseRenderable = {
  mesh: Mesh;
  line: MeshLine;
  material: MeshLineMaterial;
  missileId: number | null;
  animationStartTimeSeconds: number;
  animationDurationSeconds: number;
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
const MISSILE_TRAIL_LINE_WIDTH = 0.06;
const MISSILE_TRAIL_Z_OFFSET = 0.018;
const WAVEFORM_PLANE_SPECTRUM_BIN_COUNT = 192;
const WAVEFORM_PLANE_TIMELINE_SAMPLES = 4096;
const WAVEFORM_PLANE_TEXTURE_BINS = 64;
const WAVEFORM_PLANE_WIDTH = 120;
const WAVEFORM_PLANE_HEIGHT = 90;
const WAVEFORM_PLANE_SEGMENTS_X = 56;
const WAVEFORM_PLANE_SEGMENTS_Y = 42;
const WAVEFORM_PLANE_HEIGHT_SCALE = 6.8;
const WAVEFORM_SCENE_FOG_NEAR = 52;
const WAVEFORM_SCENE_FOG_FAR = 92;
const WAVEFORM_PLANE_TIME_WINDOW_SECONDS = 2.4;
const PURPLE_PULSE_TRAVEL_DASH_RATIO = 0.9;
const PURPLE_PULSE_MIN_DURATION_SECONDS = 0.5;
const PURPLE_PULSE_MIN_POOL_SIZE = 4;
const PURPLE_PULSE_MAX_POOL_SIZE = 20;
const PURPLE_PULSE_MAX_NEW_BINDINGS_PER_FRAME = 5;
const PURPLE_PULSE_TERMINAL_ACCELERATION_POWER = 1.65;
const PURPLE_PULSE_TOTAL_SAMPLES = 128;
const PURPLE_PULSE_MIN_EFFECTIVE_DISTANCE = 15.5;
const PURPLE_PULSE_VERTICAL_DELAY_PORTION = 0.26;
const PURPLE_PULSE_AXIAL_SWEEP_BASE = 0.28;
const PURPLE_PULSE_BACK_DRIFT_MIN = 1.9;
const PURPLE_PULSE_BACK_DRIFT_MAX = 3.25;
const PURPLE_PULSE_BACK_DRIFT_DISTANCE_REFERENCE = 9.2;
const PURPLE_PULSE_BACK_DRIFT_BOOST = 1.42;
const PURPLE_PULSE_ENVELOPE_POWER_BASE = 0.72;
const PURPLE_PULSE_LAUNCH_PHASE_END = 0.62;
const PURPLE_PULSE_LAUNCH_MIN_SPAN = 8.13;
const PURPLE_PULSE_LAUNCH_STRAIGHT_PHASE_END = 0.68;
const PURPLE_PULSE_LAUNCH_STRAIGHT_MIN_DISTANCE = 5.87;
const PURPLE_PULSE_LAUNCH_STRAIGHT_DISTANCE_SCALE = 0.387;
const PURPLE_PULSE_LAUNCH_CURVE_MIN_SPAN = 2.8;
const PURPLE_PULSE_LAUNCH_BACK_DIRECTION_WEIGHT = 1.08;
const PURPLE_PULSE_LAUNCH_SIDE_DIRECTION_WEIGHT = 1.26;
const PURPLE_PULSE_LAUNCH_OUT_HANDLE_SCALE = 0.44;
const PURPLE_PULSE_LAUNCH_IN_HANDLE_SCALE = 0.46;
const PURPLE_PULSE_LAUNCH_ARC_MIN = 0.28;
const PURPLE_PULSE_LAUNCH_ARC_MAX = 0.92;
const PURPLE_PULSE_LAUNCH_CLAMP_PORTION = 0.14;
const PURPLE_PULSE_MAX_LAUNCH_SLOPE = 2.4;
const PURPLE_PULSE_TERMINAL_PHASE_START = 0.54;
const PURPLE_PULSE_TERMINAL_MIN_SPAN = 8.4;
const PURPLE_PULSE_TERMINAL_OUT_HANDLE_SCALE = 0.5;
const PURPLE_PULSE_TERMINAL_IN_HANDLE_SCALE = 0.64;
const PURPLE_PULSE_DASH_START = 1 - PURPLE_PULSE_TRAVEL_DASH_RATIO + 0.001;
const PURPLE_PULSE_DASH_END = 1;
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
  peakScale: number,
  color: Color
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
  material.color.copy(color);
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

function fillWaveformTextureDataWithSilence(data: Uint8Array): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }
}

function populateSpectrumTimelineTexture(
  data: Uint8Array,
  timeline: SpectrumTimeline,
  textureTimeSamples: number,
  textureBinSamples: number
): void {
  fillWaveformTextureDataWithSilence(data);
  if (textureTimeSamples <= 0 || textureBinSamples <= 0 || timeline.frameCount <= 0) {
    return;
  }

  const frameCount = timeline.frameCount;
  const binCount = timeline.binCount;
  const frameMax = Math.max(1, frameCount - 1);
  const binMax = Math.max(1, binCount - 1);
  for (let y = 0; y < textureBinSamples; y += 1) {
    const textureBinT = textureBinSamples <= 1 ? 0 : y / (textureBinSamples - 1);
    const remappedBin = Math.pow(textureBinT, 1.3) * binMax;
    const binLo = Math.floor(remappedBin);
    const binHi = Math.min(binCount - 1, binLo + 1);
    const binMix = remappedBin - binLo;

    for (let x = 0; x < textureTimeSamples; x += 1) {
      const timeT = textureTimeSamples <= 1 ? 0 : x / (textureTimeSamples - 1);
      const remappedFrame = timeT * frameMax;
      const frameLo = Math.floor(remappedFrame);
      const frameHi = Math.min(frameCount - 1, frameLo + 1);
      const frameMix = remappedFrame - frameLo;

      const loLo = timeline.bins[frameLo * binCount + binLo] ?? 0;
      const loHi = timeline.bins[frameLo * binCount + binHi] ?? loLo;
      const hiLo = timeline.bins[frameHi * binCount + binLo] ?? loLo;
      const hiHi = timeline.bins[frameHi * binCount + binHi] ?? hiLo;
      const frameLoMix = loLo + (loHi - loLo) * binMix;
      const frameHiMix = hiLo + (hiHi - hiLo) * binMix;
      const value = clamp(frameLoMix + (frameHiMix - frameLoMix) * frameMix, 0, 1);

      const beatLo = timeline.beatEnvelope[frameLo] ?? 0;
      const beatHi = timeline.beatEnvelope[frameHi] ?? beatLo;
      const beat = clamp(beatLo + (beatHi - beatLo) * frameMix, 0, 1);

      const encodedValue = Math.round(Math.pow(value, 1.04) * 255);
      const encodedBeat = Math.round(beat * 255);
      const offset = (y * textureTimeSamples + x) * 4;
      data[offset] = encodedValue;
      data[offset + 1] = encodedBeat;
      data[offset + 2] = encodedValue;
      data[offset + 3] = 255;
    }
  }
}

function populateSpectrumTimelineTextureFromWaveform(
  data: Uint8Array,
  waveformLeft: Float32Array,
  waveformRight: Float32Array,
  textureTimeSamples: number,
  textureBinSamples: number
): void {
  fillWaveformTextureDataWithSilence(data);
  const maxLength = Math.max(waveformLeft.length, waveformRight.length);
  if (maxLength <= 0 || textureTimeSamples <= 0 || textureBinSamples <= 0) {
    return;
  }

  for (let y = 0; y < textureBinSamples; y += 1) {
    const binT = textureBinSamples <= 1 ? 0 : y / (textureBinSamples - 1);
    const skew = Math.pow(binT, 1.72);
    const lowBoost = 1 - binT * 0.82;

    for (let x = 0; x < textureTimeSamples; x += 1) {
      const timeT = textureTimeSamples <= 1 ? 0 : x / (textureTimeSamples - 1);
      const sourcePos = timeT * (maxLength - 1);
      const left = sampleWaveformLinear(waveformLeft, sourcePos);
      const right = waveformRight.length > 0 ? sampleWaveformLinear(waveformRight, sourcePos) : left;
      const mono = clamp((left + right) * 0.5, 0, 1);
      const ridge = Math.max(
        0,
        Math.sin((timeT * (3.8 + skew * 13.2) + skew * 0.21) * Math.PI * 2)
      );
      const value = clamp(Math.pow(mono, 1.06) * (0.5 + lowBoost * 0.44) + ridge * 0.16, 0, 1);
      const beat = clamp(ridge * (0.4 + lowBoost * 0.42), 0, 1);
      const encodedValue = Math.round(value * 255);
      const encodedBeat = Math.round(beat * 255);
      const offset = (y * textureTimeSamples + x) * 4;
      data[offset] = encodedValue;
      data[offset + 1] = encodedBeat;
      data[offset + 2] = encodedValue;
      data[offset + 3] = 255;
    }
  }
}

function sampleWaveformLinear(samples: Float32Array, index: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const clampedIndex = clamp(index, 0, samples.length - 1);
  const lo = Math.floor(clampedIndex);
  const hi = Math.min(samples.length - 1, lo + 1);
  const t = clampedIndex - lo;
  const loValue = samples[lo] ?? 0;
  const hiValue = samples[hi] ?? loValue;
  return loValue + (hiValue - loValue) * t;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeExplosionPower(power: number): number {
  return clamp01((power - 0.12) / (2.12 - 0.12));
}

function clamp01Signed(value: number, maxAbs: number): number {
  return Math.max(-maxAbs, Math.min(maxAbs, value));
}
