import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
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
    },
    render() {
      renderer.render(scene, camera);
    },
    resize
  };
}
