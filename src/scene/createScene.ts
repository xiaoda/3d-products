import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  MeshStandardMaterial,
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

export type ViewName =
  'perspective' | 'front' | 'side' | 'back' | 'top' | 'bottom' | 'interior' | 'earbud';
const directions: Record<ViewName, Vector3> = {
  perspective: new Vector3(6.5, 4.5, 17),
  front: new Vector3(0, 0, 1),
  side: new Vector3(1, 0, 0),
  back: new Vector3(0, 0, -1),
  top: new Vector3(0, 1, 0.0001),
  bottom: new Vector3(0, -1, 0.0001),
  interior: new Vector3(0, 1.7, 2.2),
  earbud: new Vector3(-1.2, 0.3, 2.5),
};

export function createScene(
  host: HTMLElement,
  onManualView: () => void,
  onContextLost: () => void,
) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(new Color(0xffffff), 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'AirPods 5 精修灰模，可旋转观察连续曲面、内胆与细节');
  canvas.setAttribute('role', 'img');
  host.append(canvas);
  const scene = new Scene(),
    product = createProduct(),
    { root, parts } = product;
  scene.add(root);
  // 沿用基础照明：不在几何阶段引入 HDR、贴图、金属材质或后处理。
  scene.add(new HemisphereLight(0xffffff, 0x69725d, 2.1));
  const key = new DirectionalLight(0xffffff, 3);
  key.position.set(-5, 10, 8);
  const fill = new DirectionalLight(0xedf0ff, 1.4);
  fill.position.set(7, 4, -4);
  scene.add(key, fill);
  const clay = new MeshStandardMaterial({ color: 0xcbd2cc, roughness: 0.8, metalness: 0 });
  const wire = new MeshStandardMaterial({
    color: 0x647d6d,
    wireframe: true,
    roughness: 1,
    metalness: 0,
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
    pose: ProductPose | 'custom' = 'separated',
    view: ViewName | 'manual' = 'perspective';
  // 构图对象独立于相机预设：手动旋转后缩放窗口仍保持单耳/内胆聚焦。
  let focus: 'product' | 'case' | 'earbud' = 'product';
  let hideEarbuds = false,
    wireframe = false,
    uniformGray = false;

  function notify() {
    host.dispatchEvent(new CustomEvent('modelchange'));
  }
  function frame(direction: Vector3) {
    const target =
      focus === 'earbud' ? parts.rightEarbud : focus === 'case' ? parts.caseAssembly : root;
    new Box3().setFromObject(target, true).getBoundingSphere(sphere);
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    frameDistance = fitDistance(sphere.radius, camera.aspect, camera.fov);
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
    view = next;
    focus = next === 'earbud' ? 'earbud' : next === 'interior' ? 'case' : 'product';
    if (focus === 'earbud') hideEarbuds = false;
    if (view === 'interior') {
      pose = 'open';
      setProductPose(product, pose);
      hideEarbuds = true;
    } else if (view !== 'earbud') hideEarbuds = false;
    showParts();
    frame(directions[next]);
    notify();
  }
  function setPose(next: ProductPose) {
    pose = next;
    hideEarbuds = false;
    setProductPose(product, next);
    snapView('perspective');
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
      frame(direction.lengthSq() ? direction : directions.perspective);
      const distance = Math.max(
        controls.minDistance,
        Math.min(controls.maxDistance, frameDistance * (ratio || 1)),
      );
      camera.position
        .copy(controls.target)
        .addScaledVector(
          direction.lengthSq() ? direction : directions.perspective.clone().normalize(),
          distance,
        );
      controls.update();
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  snapView('perspective');
  const handleManual = () => {
    view = 'manual';
    onManualView();
    notify();
  };
  controls.addEventListener('start', handleManual);
  function tick() {
    if (disposed || document.hidden) return;
    controls.update();
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
    setPose,
    setLidAngle(degrees: number) {
      pose = 'custom';
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
      showParts();
      frame(directions[view === 'manual' ? 'perspective' : view]);
      notify();
    },
    setInspectionMaterial(options: { wireframe?: boolean; uniformGray?: boolean }) {
      wireframe = options.wireframe ?? wireframe;
      uniformGray = options.uniformGray ?? uniformGray;
      scene.overrideMaterial = wireframe ? wire : uniformGray ? clay : null;
      notify();
    },
    reset() {
      wireframe = false;
      uniformGray = false;
      scene.overrideMaterial = null;
      setPose('separated');
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
        view,
        focus,
        lidAngle: (-parts.lidPivot.rotation.x * 180) / Math.PI,
        hideEarbuds,
        wireframe,
        uniformGray,
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
      disposeProduct(root);
      clay.dispose();
      wire.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
export type ProductScene = ReturnType<typeof createScene>;
