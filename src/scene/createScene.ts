import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Sphere,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createProduct, disposeProduct } from '../model/createProduct';
import { fitDistance } from './framing';

export type ViewName = 'perspective' | 'front' | 'side' | 'top';
const directions: Record<ViewName, Vector3> = {
  perspective: new Vector3(7.5, 4.2, 17),
  front: new Vector3(0, 0, 1),
  side: new Vector3(1, 0, 0),
  top: new Vector3(0, 1, 0.0001),
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
  canvas.setAttribute('aria-label', 'AirPods 5 基础白模，拖动旋转；也可使用下方视角和缩放按钮');
  canvas.setAttribute('role', 'img');
  host.append(canvas);

  const scene = new Scene();
  const { root, parts } = createProduct();
  scene.add(root);
  // 第一阶段仅使用基础灯光，不引入环境贴图与正式材质系统。
  scene.add(new HemisphereLight(0xffffff, 0x69725d, 2.1));
  const key = new DirectionalLight(0xffffff, 3.0);
  key.position.set(-5, 10, 8);
  const fill = new DirectionalLight(0xedf0ff, 1.4);
  fill.position.set(7, 4, -4);
  scene.add(key, fill);

  const sphere = new Box3().setFromObject(root).getBoundingSphere(new Sphere());
  const camera = new PerspectiveCamera(32, 1, 0.1, 150);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.75;
  controls.minPolarAngle = 0.0001;
  controls.maxPolarAngle = Math.PI - 0.0001;
  let frameDistance = 20;
  let disposed = false;
  let raf = 0;

  function snapView(view: ViewName) {
    // 清掉阻尼残量，保证视角重置不会继续漂移。
    const wasDamped = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.target.copy(sphere.center);
    camera.position
      .copy(sphere.center)
      .addScaledVector(directions[view].clone().normalize(), frameDistance);
    controls.update();
    controls.enableDamping = wasDamped;
  }

  function resize() {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    const ratio = frameDistance ? camera.position.distanceTo(controls.target) / frameDistance : 1;
    const direction = camera.position.clone().sub(controls.target).normalize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    frameDistance = fitDistance(sphere.radius, camera.aspect, camera.fov);
    controls.minDistance = Math.max(sphere.radius * 1.65, frameDistance * 0.64);
    controls.maxDistance = frameDistance * 1.8;
    if (direction.lengthSq()) {
      camera.position
        .copy(controls.target)
        .addScaledVector(
          direction,
          Math.max(
            controls.minDistance,
            Math.min(controls.maxDistance, frameDistance * (ratio || 1)),
          ),
        );
    }
    renderer.setSize(width, height, false);
    controls.update();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  snapView('perspective');
  controls.addEventListener('start', onManualView);

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
    zoom(factor: number) {
      const offset = camera.position.clone().sub(controls.target);
      const length = Math.max(
        controls.minDistance,
        Math.min(controls.maxDistance, offset.length() * factor),
      );
      camera.position.copy(controls.target).addScaledVector(offset.normalize(), length);
      controls.update();
    },
    inspect() {
      return {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        distance: camera.position.distanceTo(controls.target),
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        aspect: camera.aspect,
        canvas: [canvas.width, canvas.height],
        meshes: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        bounds: new Box3().setFromObject(root).getSize(new Vector3()).toArray(),
        nodes: Object.values(parts).map((part) => part.name),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.removeEventListener('start', onManualView);
      controls.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', handleLost);
      disposeProduct(root);
      renderer.dispose();
      canvas.remove();
    },
  };
}

export type ProductScene = ReturnType<typeof createScene>;
