import * as THREE from 'three';
import { addBlocks, block, seededRandom, type Block } from './voxel';

const grid = 3;
const waterfallX = -9;
const waterfallZ = 18;
export const waterfallTop = 66;

function hill(x: number, z: number, cx: number, cz: number, rx: number, rz: number, height: number): number {
  const distance = Math.sqrt(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2);
  return height * Math.max(0, 1 - distance) ** 0.72;
}

function streamCenter(z: number): number {
  return -9 + Math.sin((z + 24) * 0.042) * 12;
}

function isWater(x: number, z: number): boolean {
  const pond = ((x + 9) / 30) ** 2 + ((z + 6) / 26) ** 2 < 1;
  const stream = z < -13 && Math.abs(x - streamCenter(z)) < 6.5 + Math.sin(z * 0.065) * 1.4;
  return pond || stream;
}

export function terrainHeight(x: number, z: number): number {
  if (isWater(x, z)) return -1.5;
  const front = 21 + Math.sin(x * 0.13) * 2;
  const plateau = z > front && z < 83 && Math.abs(x + 7) < 53
    ? Math.max(0, 69 - ((x + 8) / 12) ** 2 - ((z - 39) / 12) ** 2) : 0;
  const incense = hill(x, z, -45, 47, 27, 31, 101);
  const easternPeak = hill(x, z, 39, 52, 34, 38, 87);
  const rearPeak = hill(x, z, 2, 81, 39, 35, 96);
  const leftSlope = hill(x, z, -65, -4, 41, 55, 29);
  const rightSlope = hill(x, z, 59, 4, 46, 52, 35);
  const lowland = 1.4 + 1.6 * Math.sin(x * 0.036) * Math.cos(z * 0.041);
  const noise = Math.sin(x * 0.46 + z * 0.15) * 1.2 + Math.cos(z * 0.39 - x * 0.18) * 0.9;
  return Math.max(0, Math.round((Math.max(plateau, incense, easternPeak, rearPeak, leftSlope, rightSlope, lowland) + noise) / grid) * grid);
}

interface Particle {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  phase: number;
}

export interface Landscape {
  update: (time: number) => void;
}

export function createLandscape(scene: THREE.Scene, compact: boolean): Landscape {
  const random = seededRandom(725);
  const stoneBlocks: Block[] = [];
  const greenery: Block[] = [];
  const trees: Block[] = [];
  const waterBlocks: Block[] = [];
  const details: Block[] = [];
  const stonePalette = ['#7c9183', '#849487', '#8c998a', '#99a28f', '#a3a997', '#748879'];
  const cliffPalette = ['#8c9588', '#819184', '#9aa08e', '#75887c', '#a3a695', '#889789'];
  const greens = ['#557c50', '#6e8c53', '#819863', '#5b7e54', '#8ba16d'];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1800, 1800),
    new THREE.MeshLambertMaterial({ color: '#9ba48b' }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -5;
  floor.receiveShadow = true;
  scene.add(floor);

  // Short layers give the cliff horizontal strata instead of stretched columns.
  for (let x = -114; x <= 114; x += grid) {
    for (let z = -138; z <= 117; z += grid) {
      const height = terrainHeight(x, z);
      const water = isWater(x, z);
      if (water) {
        const depthColor = Math.min(1, Math.sqrt(((x + 9) / 30) ** 2 + ((z + 6) / 26) ** 2));
        const color = new THREE.Color('#3f8f89').lerp(new THREE.Color('#77b4a0'), depthColor);
        waterBlocks.push(block(x, 0, z, grid + 0.025, 0.32, grid + 0.025, color));
        stoneBlocks.push(block(x, -3, z, grid, 3, grid, '#679487'));
        continue;
      }
      const cliff = height > 40 && z < 37;
      for (let base = -4; base < height; base += 6) {
        const layerHeight = Math.min(6, height - base);
        const palette = cliff ? cliffPalette : stonePalette;
        const index = Math.floor(random() * palette.length);
        stoneBlocks.push(block(x, base + layerHeight / 2, z, grid, layerHeight, grid, palette[index]));
      }
      greenery.push(block(x, height + 0.14, z, grid + 0.02, 0.28, grid + 0.02, greens[Math.floor(random() * greens.length)]));
      if (height > 21 && height < 75 && random() < 0.014) {
        greenery.push(block(x - 0.5, height + 0.7, z - 0.4, 2, 1.1, 1.8, '#667e4e'));
      }
      const density = compact ? 0.022 : 0.039;
      const sightline = Math.abs(x + 9) < 28 && z < 35;
      if (random() < density && height < 82 && !sightline && z > -98) {
        const scale = 0.75 + random() * 0.7;
        const trunk = (5 + random() * 3) * scale;
        trees.push(block(x, height + trunk / 2, z, 0.8 * scale, trunk, 0.8 * scale, '#675f47'));
        const lean = (random() - 0.5) * 1.4;
        for (let tier = 0; tier < 4; tier++) {
          const size = (5.6 - tier * 1.15) * scale;
          const shade = ['#365f49', '#426d4c', '#4b7651', '#608258'][tier];
          trees.push(block(x + lean * tier, height + trunk * 0.52 + tier * 1.5 * scale, z, size, 1.6 * scale, size * 0.9, shade));
        }
        if (random() < 0.22) {
          trees.push(block(x + 1.5 * scale, height + trunk * 0.54, z, 4.6 * scale, 1.1 * scale, 2.2 * scale, '#426f4e'));
        }
      }
      if (!compact && height < 20 && random() < 0.08 && !sightline) {
        details.push(block(x + random(), height + 0.5, z + random(), 0.25, 1, 0.25, '#a4b67b'));
      }
    }
  }
  addBlocks(scene, stoneBlocks);
  addBlocks(scene, greenery);
  addBlocks(scene, trees);
  addBlocks(scene, details, { shadows: false });
  addBlocks(scene, waterBlocks, { shadows: false });

  const cliffLedges: Block[] = [];
  for (let x = -42; x < 44; x += 3) {
    if (Math.abs(x + 9) < 8) continue;
    for (const elevation of [21, 42]) {
      const z = 19 + Math.sin(x * 0.13) * 2;
      if (terrainHeight(x, z + 6) < elevation + 8 || random() < 0.26) continue;
      const depth = 1 + random() * 1.5;
      const y = elevation + Math.round(Math.sin(x * 0.09) * 2) * 3;
      cliffLedges.push(block(x, y, z - depth / 2, 3, 1.8, depth, '#829183'));
      cliffLedges.push(block(x, y + 0.95, z - depth / 2, 3.05, 0.12, depth + 0.08, '#758c5d'));
    }
  }
  addBlocks(scene, cliffLedges);

  // River on the plateau connects to the same lip and the pool below.
  const upperRiver: Block[] = [];
  for (let z = 24; z < 72; z += 3) {
    const x = -9 + Math.sin((z - 24) * 0.06) * 6;
    const height = terrainHeight(Math.round(x / 3) * 3, z);
    upperRiver.push(block(x, height + 0.32, z, 6.6, 0.35, 3.1, '#9acaba'));
  }
  upperRiver.push(block(-9, waterfallTop + 0.25, 22, 8.4, 0.5, 8.5, '#cce7dc'));
  addBlocks(scene, upperRiver, { shadows: false });

  const waterfall: Block[] = [];
  for (let lane = 0; lane < 11; lane++) {
    const x = waterfallX + (lane - 5) * 0.83;
    for (let y = 1; y < waterfallTop; y += 2.1) {
      const flare = (1 - y / waterfallTop) ** 3;
      const drift = Math.sin(y * 0.22 + lane) * 0.3;
      waterfall.push(block(
        x + (lane - 5) * flare * 0.22 + drift,
        y,
        waterfallZ - flare * 2.8 + Math.cos(y * 0.13 + lane) * 0.32,
        0.85 + flare * 0.15, 2.15, 0.8 + random() * 0.6,
        ['#eaf5e9', '#d6ebe2', '#f5f8eb', '#bbdfd6'][lane % 4],
      ));
    }
  }
  addBlocks(scene, waterfall, { shadows: false, unlit: true });

  const fallParticles: Particle[] = [];
  for (let i = 0; i < (compact ? 90 : 175); i++) {
    fallParticles.push({
      x: waterfallX + (random() - 0.5) * 10,
      y: random() * waterfallTop,
      z: waterfallZ - 1.5 - random() * 2,
      size: 0.18 + random() * 0.38,
      speed: 8 + random() * 12,
      phase: random() * Math.PI * 2,
    });
  }
  const fallingMesh = addBlocks(scene, fallParticles.map((p) => block(p.x, p.y, p.z, p.size, 0.5 + p.size * 3, p.size, '#ffffff')), { opacity: 0.72, unlit: true, shadows: false });
  fallingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fallingMesh.frustumCulled = false;

  const sprayParticles: Particle[] = [];
  for (let i = 0; i < (compact ? 55 : 115); i++) {
    sprayParticles.push({ x: random() * 2 - 1, y: 2 + random() * 6, z: random() * 2 - 1, size: 0.22 + random() * 0.55, speed: 0.1 + random() * 0.25, phase: random() });
  }
  const sprayMesh = addBlocks(scene, sprayParticles.map((p) => block(p.x, p.y, p.z, p.size, p.size, p.size, '#e7f1e4')), { opacity: 0.4, unlit: true, shadows: false });
  sprayMesh.frustumCulled = false;
  sprayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const mistParticles: Particle[] = [];
  for (let i = 0; i < (compact ? 42 : 72); i++) {
    mistParticles.push({
      x: -46 + (random() - 0.5) * 38,
      y: 62 + random() * 23,
      z: 39 + (random() - 0.5) * 32,
      size: 3 + random() * 7,
      speed: 0.14 + random() * 0.15,
      phase: random() * Math.PI * 2,
    });
  }
  const mistMesh = addBlocks(scene, mistParticles.map((p) => block(p.x, p.y, p.z, p.size * 2.6, p.size * 0.4, p.size * 1.6, '#bd94d4')), { opacity: 0.17, unlit: true, shadows: false });
  mistMesh.frustumCulled = false;
  mistMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Open, square ripple outlines are voxel geometry, not a screen overlay.
  const ripples: THREE.Group[] = [];
  const rippleMaterial = new THREE.MeshBasicMaterial({ color: '#cee8cd', transparent: true, opacity: 0.33, depthWrite: false });
  const rippleGeometry = new THREE.BoxGeometry(1, 0.065, 1);
  for (let ring = 0; ring < 4; ring++) {
    const group = new THREE.Group();
    for (let side = 0; side < 4; side++) {
      const edge = new THREE.Mesh(rippleGeometry, rippleMaterial);
      if (side < 2) {
        edge.position.z = side === 0 ? -1 : 1;
        edge.scale.set(2, 1, 0.04);
      } else {
        edge.position.x = side === 2 ? -1 : 1;
        edge.scale.set(0.04, 1, 2);
      }
      group.add(edge);
    }
    group.position.set(-9, 0.25 + ring * 0.015, 11);
    group.rotation.y = 0.2;
    scene.add(group);
    ripples.push(group);
  }

  const highlights: Block[] = [];
  for (let i = 0; i < (compact ? 50 : 120); i++) {
    const x = -90 + random() * 180;
    const z = -110 + random() * 125;
    if (isWater(x, z)) {
      highlights.push(block(x, 0.22, z, 0.7 + random() * 2, 0.025, 0.1, '#d1e9cb'));
    }
  }
  const highlightMesh = addBlocks(scene, highlights, { opacity: 0.5, unlit: true, shadows: false });

  const bankRocks: Block[] = [];
  for (let i = 0; i < 50; i++) {
    const angle = random() * Math.PI * 2;
    const x = -9 + Math.cos(angle) * (30 + random() * 4);
    const z = -6 + Math.sin(angle) * (26 + random() * 3);
    if (terrainHeight(x, z) < 10) {
      const size = 1.3 + random() * 2.7;
      bankRocks.push(block(x, terrainHeight(x, z) + size * 0.32, z, size * 1.2, size * 0.65, size, '#9da392'));
    }
  }
  addBlocks(scene, bankRocks);

  // One quiet viewing rock emphasizes the scale, without inventing a story.
  const viewingRock = [block(24, 4.5, -33, 8, 3, 6, '#a6a695'), block(25, 6.3, -34, 5, 0.6, 4.3, '#b3b19a')];
  addBlocks(scene, viewingRock);

  const sun = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 2), new THREE.MeshBasicMaterial({ color: '#ffe6ae', fog: false }));
  sun.position.set(-110, 106, 5);
  sun.rotation.y = -Math.PI / 5;
  scene.add(sun);

  const cloudBlocks: Block[] = [];
  for (let i = 0; i < 14; i++) {
    cloudBlocks.push(block(-150 + random() * 300, 99 + random() * 22, 103 + random() * 60, 18 + random() * 28, 0.8 + random() * 2, 8 + random() * 14, '#f9e9cf'));
  }
  addBlocks(scene, cloudBlocks, { opacity: 0.38, unlit: true, shadows: false });

  const distantBlocks: Block[] = [];
  for (let ridge = 0; ridge < 3; ridge++) {
    for (let x = -195; x <= 195; x += 9) {
      const height = 18 + ridge * 7 + 29 * Math.max(0, Math.sin(x * 0.045 + ridge * 1.5)) + 5 * Math.sin(x * 0.17);
      distantBlocks.push(block(x, height / 2 - 3, 135 + ridge * 29, 9, height, 16, ['#96aa9c', '#afbbb0', '#bfc9bc'][ridge]));
    }
  }
  addBlocks(scene, distantBlocks, { shadows: false });

  const dummy = new THREE.Object3D();
  const update = (time: number): void => {
    fallParticles.forEach((p, index) => {
      const y = ((p.y - time * p.speed) % waterfallTop + waterfallTop) % waterfallTop;
      dummy.position.set(p.x + Math.sin(time * 0.9 + p.phase) * 0.25, y, p.z - (1 - y / waterfallTop) ** 2 * 2);
      dummy.scale.set(p.size, 0.5 + p.size * 3, p.size);
      dummy.updateMatrix();
      fallingMesh.setMatrixAt(index, dummy.matrix);
    });
    fallingMesh.instanceMatrix.needsUpdate = true;
    sprayParticles.forEach((p, index) => {
      const progress = (p.phase + time * p.speed) % 1;
      dummy.position.set(-9 + p.x * progress * 13, 0.6 + Math.sin(progress * Math.PI) * p.y, 13 + p.z * progress * 8 - progress * 5);
      const size = p.size * (1 - progress * 0.65);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      sprayMesh.setMatrixAt(index, dummy.matrix);
    });
    sprayMesh.instanceMatrix.needsUpdate = true;
    mistParticles.forEach((p, index) => {
      dummy.position.set(p.x + Math.sin(time * p.speed + p.phase) * 3.5, p.y + Math.cos(time * 0.2 + p.phase) * 1.2, p.z);
      dummy.scale.set(p.size * 2.6, p.size * 0.4, p.size * 1.6);
      dummy.updateMatrix();
      mistMesh.setMatrixAt(index, dummy.matrix);
    });
    mistMesh.instanceMatrix.needsUpdate = true;
    ripples.forEach((ripple, index) => {
      const progress = (time * 0.22 + index / ripples.length) % 1;
      ripple.scale.set(2 + progress * 11, 1, 2 + progress * 7);
    });
    highlightMesh.position.y = Math.sin(time * 0.9) * 0.035;
  };
  update(0);
  return { update };
}
