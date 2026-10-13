import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLandscape } from './landscape';
import { getView, overview, type ViewConfig } from './poem';

export interface WorldSnapshot {
  ready: boolean;
  view: string;
  flying: boolean;
  paused: boolean;
  reducedMotion: boolean;
  contextLost: boolean;
  compact: boolean;
  frameCount: number;
  animationTime: number;
  drawCalls: number;
  triangles: number;
  fps: number;
  pixelRatio: number;
  camera: number[];
  target: number[];
}

export interface WorldController {
  selectView: (id: string) => void;
  setMotion: (paused: boolean, reducedMotion: boolean) => void;
  snapshot: () => WorldSnapshot;
  dispose: () => void;
}

interface WorldOptions {
  initialView: string;
  paused: boolean;
  reducedMotion: boolean;
  onReady: () => void;
  onFailure: (message: string) => void;
  onRestored: () => void;
  onExplore: () => void;
  onArrive: () => void;
}

interface Flight {
  start: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
  destination: ViewConfig;
  lift: number;
}

function disposeScene(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      meshMaterials.forEach((material) => materials.add(material));
      if (object instanceof THREE.InstancedMesh) object.dispose();
    }
    if (object instanceof THREE.Light && 'shadow' in object) {
      (object.shadow as THREE.LightShadow | undefined)?.dispose();
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  scene.clear();
}

export function createWorld(host: HTMLDivElement, options: WorldOptions): WorldController {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.2, 1100);
  const compact = host.clientWidth < 600 || window.matchMedia('(pointer: coarse)').matches;
  const initialRatio = Math.min(window.devicePixelRatio, compact ? 1 : 1.5);
  renderer.setPixelRatio(initialRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !compact;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'world-canvas';
  renderer.domElement.setAttribute('aria-label', '庐山体素山谷，可拖动环顾、滚轮或双指缩放。使用诗句按钮切换镜头。');
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);
  scene.background = new THREE.Color('#e8dcc5');
  scene.fog = new THREE.Fog('#d8dac8', 145, 430);

  const hemisphere = new THREE.HemisphereLight('#faf4df', '#4e7768', 1.8);
  scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight('#ffe8c2', 2.4);
  sunlight.position.set(-75, 125, -25);
  sunlight.target.position.set(-5, 20, 25);
  sunlight.castShadow = !compact;
  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.camera.left = -125;
  sunlight.shadow.camera.right = 125;
  sunlight.shadow.camera.top = 120;
  sunlight.shadow.camera.bottom = -115;
  sunlight.shadow.camera.near = 5;
  sunlight.shadow.camera.far = 330;
  sunlight.shadow.normalBias = 0.8;
  sunlight.shadow.bias = -0.0003;
  scene.add(sunlight, sunlight.target);
  scene.add(new THREE.DirectionalLight('#c9dfed', 0.75));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.65;
  controls.minPolarAngle = 0.06;

  let disposed = false;
  let contextLost = false;
  let ready = false;
  let paused = options.paused;
  let reducedMotion = options.reducedMotion;
  let viewId = options.initialView;
  let flight: Flight | null = null;
  let frameHandle = 0;
  let frameCount = 0;
  let animationTime = 0;
  let previousTime = performance.now();
  let lastFpsTime = previousTime;
  let fpsFrames = 0;
  let fps = 0;
  let slowSamples = 0;
  const endPosition = new THREE.Vector3();
  const endTarget = new THREE.Vector3();

  const setLimits = (view: ViewConfig): void => {
    controls.minDistance = view.minDistance;
    controls.maxDistance = view.maxDistance;
    controls.maxPolarAngle = view.maxPolarAngle;
  };

  const applyView = (view: ViewConfig): void => {
    setLimits(view);
    camera.position.fromArray(view.position);
    controls.target.fromArray(view.target);
    camera.lookAt(controls.target);
    controls.update();
  };

  let landscape: ReturnType<typeof createLandscape>;
  try {
    landscape = createLandscape(scene, compact);
    applyView(getView(viewId));
  } catch (error) {
    controls.dispose();
    disposeScene(scene);
    renderer.dispose();
    renderer.domElement.remove();
    throw error;
  }

  const resize = (): void => {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    // Portrait needs a wider field of view to retain the cliff and its pool.
    camera.fov = width < height ? 58 : 43;
    camera.updateProjectionMatrix();
    if (width < 600) {
      renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1));
      renderer.shadowMap.enabled = false;
    }
    renderer.setSize(width, height, false);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  const stopFlight = (): void => {
    flight = null;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    setLimits(getView(viewId));
    const distance = camera.position.distanceTo(controls.target);
    controls.minDistance = Math.min(controls.minDistance, distance);
    controls.maxDistance = Math.max(controls.maxDistance, distance);
    controls.maxPolarAngle = Math.max(controls.maxPolarAngle, controls.getPolarAngle());
    options.onExplore();
  };
  controls.addEventListener('start', stopFlight);

  const renderFrame = (now: number): void => {
    if (disposed || contextLost || document.hidden) return;
    const delta = Math.min((now - previousTime) / 1000, 0.06);
    previousTime = now;
    if (!paused && !reducedMotion) {
      animationTime += delta;
      landscape.update(animationTime);
    }
    if (flight) {
      const progress = Math.min(1, (now - flight.start) / 2100);
      const eased = progress * progress * (3 - 2 * progress);
      endPosition.fromArray(flight.destination.position);
      endTarget.fromArray(flight.destination.target);
      camera.position.lerpVectors(flight.position, endPosition, eased);
      camera.position.y += Math.sin(Math.PI * progress) ** 2 * flight.lift;
      controls.target.lerpVectors(flight.target, endTarget, eased);
      camera.lookAt(controls.target);
      if (progress === 1) {
        setLimits(flight.destination);
        flight = null;
        controls.enableDamping = true;
        controls.update();
        options.onArrive();
      }
    } else {
      controls.update();
    }
    try {
      renderer.render(scene, camera);
    } catch {
      contextLost = true;
      ready = false;
      options.onFailure('山水暂时无法绘制。你仍可阅读诗文，或尝试重新进入。');
      return;
    }
    frameCount++;
    fpsFrames++;
    if (now - lastFpsTime > 1400) {
      fps = Math.round(fpsFrames * 1000 / (now - lastFpsTime));
      fpsFrames = 0;
      lastFpsTime = now;
      slowSamples = fps < 27 ? slowSamples + 1 : 0;
      if (slowSamples >= 3 && renderer.getPixelRatio() > 0.8) {
        renderer.setPixelRatio(Math.max(0.8, renderer.getPixelRatio() - 0.25));
        renderer.shadowMap.enabled = false;
        resize();
        slowSamples = 0;
      }
    }
    if (!ready) {
      ready = true;
      options.onReady();
    }
    frameHandle = requestAnimationFrame(renderFrame);
  };

  const onContextLost = (event: Event): void => {
    event.preventDefault();
    if (disposed) return;
    contextLost = true;
    ready = false;
    cancelAnimationFrame(frameHandle);
    options.onFailure('图形连接已中断。诗文仍在这里，重新进入即可尝试恢复山水。');
  };
  const onContextRestored = (): void => {
    if (!disposed) options.onRestored();
  };
  const onVisibilityChange = (): void => {
    cancelAnimationFrame(frameHandle);
    if (!document.hidden && !disposed && !contextLost) {
      previousTime = performance.now();
      lastFpsTime = previousTime;
      fpsFrames = 0;
      frameHandle = requestAnimationFrame(renderFrame);
    }
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
  document.addEventListener('visibilitychange', onVisibilityChange);
  frameHandle = requestAnimationFrame(renderFrame);

  return {
    selectView(id) {
      if (disposed || contextLost) return;
      const destination = getView(id);
      viewId = destination.id;
      // Clear residual orbit damping before recording the next flight origin.
      controls.enableDamping = false;
      controls.update();
      if (reducedMotion) {
        flight = null;
        applyView(destination);
        controls.enableDamping = true;
        options.onArrive();
        return;
      }
      controls.minDistance = 2;
      controls.maxDistance = overview.maxDistance + 60;
      controls.maxPolarAngle = Math.PI - 0.02;
      const distance = camera.position.distanceTo(new THREE.Vector3().fromArray(destination.position));
      flight = {
        start: performance.now(),
        position: camera.position.clone(),
        target: controls.target.clone(),
        destination,
        lift: Math.min(22, distance * 0.12),
      };
    },
    setMotion(nextPaused, nextReducedMotion) {
      paused = nextPaused;
      reducedMotion = nextReducedMotion;
      if (reducedMotion && flight) {
        applyView(flight.destination);
        flight = null;
        controls.enableDamping = true;
        options.onArrive();
      }
    },
    snapshot() {
      return {
        ready, view: viewId, flying: flight !== null, paused, reducedMotion,
        contextLost, compact, frameCount, animationTime,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        fps, pixelRatio: renderer.getPixelRatio(),
        camera: camera.position.toArray(), target: controls.target.toArray(),
      };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameHandle);
      resizeObserver.disconnect();
      controls.removeEventListener('start', stopFlight);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      disposeScene(scene);
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
