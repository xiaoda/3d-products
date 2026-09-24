import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Material,
  PerspectiveCamera,
  Scene,
  Sphere,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createProduct,
  disposeProduct,
  setProductPose,
  setLidAngle,
  type ProductPose,
} from '../model/createProduct';
import { fitDistance } from './framing';
import { CAMERA_PRESETS, SHOTS, type ShotName, type ViewName } from './cameraPresets';
import { createStudioLighting, STUDIO } from './lighting';

export type { ViewName } from './cameraPresets';
const directionFor = (view: ViewName) => new Vector3(...CAMERA_PRESETS[view].direction);

export function createScene(
  host: HTMLElement,
  onManualView: () => void,
  onContextLost: () => void,
) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = STUDIO.exposure;
  renderer.setClearColor(new Color(0xffffff), 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'AirPods 5 摄影棚展示，可旋转观察塑料、金属与网罩材质');
  canvas.setAttribute('role', 'img');
  host.append(canvas);
  const scene = new Scene(),
    product = createProduct(),
    { root, parts } = product;
  scene.add(root);
  const originalMaterials = new Map<Mesh, Material | Material[]>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    originalMaterials.set(object, object.material);
    // 微小网罩不参与投影，防止密网格阴影摩尔纹；主壳和槽壁提供几何阴影。
    object.castShadow =
      /Shell|Well|Rim|Bottom/.test(object.name) && !/Speaker|Sensor|Vent|Mic/.test(object.name);
    object.receiveShadow = !/Lattice|Sensor/.test(object.name);
  });
  const studio = createStudioLighting(renderer, scene);
  const clay = new MeshStandardMaterial({
    color: 0xb8b9b6,
    roughness: 0.85,
    metalness: 0,
    envMapIntensity: 0.5,
  });
  const wire = new MeshBasicMaterial({
    color: 0x647d6d,
    wireframe: true,
  });
  const sphere = new Sphere(),
    camera = new PerspectiveCamera(32, 1, 0.1, 150);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.75;
  controls.minPolarAngle = 0.0001;
  controls.maxPolarAngle = Math.PI - 0.0001;
  let frameDistance = 20,
    disposed = false,
    raf = 0,
    pose: ProductPose | 'custom' = 'open',
    view: ViewName | 'manual' = 'perspective';
  let shot: ShotName | null = null;
  let frameScale = 1;
  // 构图对象独立于相机预设：手动旋转后缩放窗口仍保持单耳/内胆聚焦。
  let focus: 'product' | 'case' | 'earbud' = 'product';
  let hideEarbuds = false,
    wireframe = false,
    uniformGray = false;

  function notify() {
    studio.markDirty();
    host.dispatchEvent(new CustomEvent('modelchange'));
  }
  function frame(direction: Vector3) {
    const target =
      focus === 'earbud'
        ? parts.rightEarbud
        : focus === 'case' || hideEarbuds
          ? parts.caseAssembly
          : root;
    new Box3().setFromObject(target, true).getBoundingSphere(sphere);
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    frameDistance = fitDistance(sphere.radius, camera.aspect, camera.fov) * frameScale;
    controls.minDistance = Math.max(sphere.radius * 1.5, frameDistance * 0.56);
    controls.maxDistance = frameDistance * 1.8;
    controls.target.copy(sphere.center);
    camera.position
      .copy(sphere.center)
      .addScaledVector(direction.clone().normalize(), frameDistance);
    controls.update();
    controls.enableDamping = damping;
  }
  function showParts() {
    parts.caseAssembly.visible = focus !== 'earbud';
    parts.leftEarbud.visible = focus !== 'earbud' && !hideEarbuds;
    parts.rightEarbud.visible = focus === 'earbud' || !hideEarbuds;
  }
  function snapView(next: ViewName) {
    shot = null;
    view = next;
    frameScale = CAMERA_PRESETS[next].distanceScale;
    focus = next === 'earbud' ? 'earbud' : next === 'interior' ? 'case' : 'product';
    if (focus === 'earbud') hideEarbuds = false;
    if (view === 'interior') {
      pose = 'open';
      setProductPose(product, pose);
      hideEarbuds = true;
    } else if (view !== 'earbud') hideEarbuds = false;
    showParts();
    frame(directionFor(next));
    notify();
  }
  function setPose(next: ProductPose) {
    pose = next;
    hideEarbuds = false;
    setProductPose(product, next);
    snapView('perspective');
  }
  function setShot(next: ShotName) {
    const preset = SHOTS[next];
    setProductPose(product, preset.pose);
    pose = preset.pose;
    snapView(preset.view);
    shot = next;
    notify();
  }
  function resize() {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    const ratio = camera.position.distanceTo(controls.target) / frameDistance,
      direction = camera.position.clone().sub(controls.target).normalize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (sphere.radius > 0) {
      frame(direction.lengthSq() ? direction : directionFor('perspective'));
      const distance = Math.max(
        controls.minDistance,
        Math.min(controls.maxDistance, frameDistance * (ratio || 1)),
      );
      camera.position
        .copy(controls.target)
        .addScaledVector(
          direction.lengthSq() ? direction : directionFor('perspective').normalize(),
          distance,
        );
      controls.update();
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  setShot('open');
  const handleManual = () => {
    view = 'manual';
    shot = null;
    onManualView();
    notify();
  };
  controls.addEventListener('start', handleManual);
  function tick() {
    if (disposed || document.hidden) return;
    controls.update();
    studio.updateFloor(camera.position, focus !== 'earbud' && !wireframe);
    studio.renderContactShadow();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !disposed) tick();
  };
  const handleLost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(raf);
    onContextLost();
  };
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', handleLost);
  tick();
  return {
    setView: snapView,
    setShot,
    setPose,
    setLidAngle(degrees: number) {
      pose = 'custom';
      shot = null;
      setLidAngle(product, degrees);
      root.updateMatrixWorld(true);
      frame(camera.position.clone().sub(controls.target));
      notify();
    },
    setHideEarbuds(hidden: boolean) {
      if (focus === 'earbud') {
        focus = 'product';
        view = 'perspective';
      }
      hideEarbuds = hidden;
      shot = null;
      showParts();
      frame(directionFor(view === 'manual' ? 'perspective' : view));
      notify();
    },
    setInspectionMaterial(options: { wireframe?: boolean; uniformGray?: boolean }) {
      wireframe = options.wireframe ?? wireframe;
      uniformGray = options.uniformGray ?? uniformGray;
      for (const [mesh, material] of originalMaterials)
        mesh.material = wireframe ? wire : uniformGray ? clay : material;
      notify();
    },
    reset() {
      wireframe = false;
      uniformGray = false;
      for (const [mesh, material] of originalMaterials) mesh.material = material;
      setShot('open');
    },
    zoom(factor: number) {
      const offset = camera.position.clone().sub(controls.target);
      const distance = Math.max(
        controls.minDistance,
        Math.min(controls.maxDistance, offset.length() * factor),
      );
      camera.position.copy(controls.target).addScaledVector(offset.normalize(), distance);
      controls.update();
    },
    inspect() {
      return {
        pose,
        shot,
        view,
        focus,
        lidAngle: (-parts.lidPivot.rotation.x * 180) / Math.PI,
        hideEarbuds,
        wireframe,
        uniformGray,
        studio: {
          ...studio.inspect(),
          exposure: renderer.toneMappingExposure,
          environment: scene.environment?.name,
          environmentIntensity: scene.environmentIntensity,
          shadowMap: renderer.shadowMap.enabled,
        },
        materials: [...new Set([...originalMaterials.values()].flat().map((m) => m.name))],
        resources: { ...renderer.info.memory },
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        distance: camera.position.distanceTo(controls.target),
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        aspect: camera.aspect,
        canvas: [canvas.width, canvas.height],
        meshes: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        nodes: Object.values(parts).map((p) => p.name),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.removeEventListener('start', handleManual);
      controls.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', handleLost);
      for (const [mesh, material] of originalMaterials) mesh.material = material;
      originalMaterials.clear();
      disposeProduct(root);
      studio.dispose();
      clay.dispose();
      wire.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
export type ProductScene = ReturnType<typeof createScene>;
