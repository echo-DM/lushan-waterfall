import * as THREE from 'three';

export interface Block {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: THREE.ColorRepresentation;
}

export function addBlocks(
  scene: THREE.Object3D,
  blocks: readonly Block[],
  options: { opacity?: number; unlit?: boolean; shadows?: boolean } = {},
): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const properties = {
    color: 0xffffff,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    depthWrite: (options.opacity ?? 1) === 1,
  };
  const material = options.unlit
    ? new THREE.MeshBasicMaterial(properties)
    : new THREE.MeshLambertMaterial(properties);
  const mesh = new THREE.InstancedMesh(geometry, material, blocks.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  blocks.forEach((block, index) => {
    dummy.position.set(block.x, block.y, block.z);
    dummy.scale.set(block.sx, block.sy, block.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, color.set(block.color));
  });
  mesh.castShadow = options.shadows ?? true;
  mesh.receiveShadow = !options.unlit;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}

export function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function block(
  x: number, y: number, z: number,
  sx: number, sy: number, sz: number,
  color: THREE.ColorRepresentation,
): Block {
  return { x, y, z, sx, sy, sz, color };
}
