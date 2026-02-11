declare module "three.meshline" {
  import type { BufferGeometry, ColorRepresentation, ShaderMaterial, Vector2, Vector3 } from "three";

  export class MeshLine extends BufferGeometry {
    setGeometry(geometry: BufferGeometry, widthCallback?: (p: number) => number): void;
    setPoints(
      points: Float32Array | number[] | Vector3[],
      widthCallback?: (p: number) => number
    ): void;
    advance(point: Vector3): void;
  }

  export type MeshLineMaterialParameters = {
    color?: ColorRepresentation;
    opacity?: number;
    lineWidth?: number;
    resolution?: Vector2;
    sizeAttenuation?: number;
    transparent?: boolean;
    depthWrite?: boolean;
    depthTest?: boolean;
    blending?: number;
    [key: string]: unknown;
  };

  export class MeshLineMaterial extends ShaderMaterial {
    constructor(parameters?: MeshLineMaterialParameters);
    lineWidth: number;
    color: { set: (value: ColorRepresentation) => void };
    opacity: number;
    resolution: Vector2;
  }
}
