import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Material,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
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
import { GEOMETRY_VIEWS, type GeometryView } from './geometryViews';

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
  const stripes = new ShaderMaterial({
    vertexShader: `varying vec3 vN;
      void main() { vN=normalMatrix*normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vN;
      void main() { vec3 r=reflect(vec3(0.0,0.0,-1.0),normalize(vN));
        float wave=sin((r.x+r.y*0.35)*16.0); float w=max(fwidth(wave),0.025);
        gl_FragColor=vec4(mix(vec3(0.06,0.13,0.10),vec3(0.90,0.94,0.89),smoothstep(-w,w,wave)),1.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
  });
  const sphere = new Sphere(),
    perspective = new PerspectiveCamera(32, 1, 0.1, 150),
    orthographic = new OrthographicCamera(-2, 2, 2, -2, 0.1, 150);
  let camera: PerspectiveCamera | OrthographicCamera = perspective;
  let geometryView: GeometryView | null = null;
  let localEarbudInspection = false;
  function createControls() {
    const orbit = new OrbitControls<PerspectiveCamera | OrthographicCamera>(camera, canvas);
    orbit.enablePan = false;
    orbit.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    orbit.dampingFactor = 0.09;
    orbit.rotateSpeed = 0.65;
    orbit.zoomSpeed = 0.75;
    orbit.minZoom = 0.6;
    orbit.maxZoom = 2.2;
    orbit.addEventListener('start', handleManual);
    return orbit;
  }
  let controls = createControls();
  let frameDistance = 20,
    disposed = false,
    failed = false,
    raf = 0,
    pose: ProductPose | 'custom' = 'open',
    view: ViewName | 'manual' = 'perspective';
  let shot: ShotName | null = null;
  let frameScale = 1;
  // 构图对象独立于相机预设：手动旋转后缩放窗口仍保持单耳/内胆聚焦。
  let focus: 'product' | 'case' | 'earbud' = 'product';
  let hideEarbuds = false,
    wireframe = false,
    uniformGray = false,
    stripeInspection = false;

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
    const aspect = host.clientWidth / host.clientHeight;
    frameDistance = fitDistance(sphere.radius, aspect, perspective.fov) * frameScale;
    if (camera instanceof OrthographicCamera) {
      const half = (sphere.radius * 1.12) / Math.min(1, aspect);
      Object.assign(camera, {
        left: -half * aspect,
        right: half * aspect,
        top: half,
        bottom: -half,
        zoom: 1,
      });
      camera.updateProjectionMatrix();
    }
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
    // 单耳检查使用冻结局部坐标；回到整套产品必须恢复收纳姿态。
    if (localEarbudInspection) {
      setProductPose(product, 'open');
      localEarbudInspection = false;
    }
    geometryView = null;
    camera = perspective;
    controls.dispose();
    camera.up.set(0, 1, 0);
    controls = createControls();
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
    localEarbudInspection = false;
    pose = next;
    hideEarbuds = false;
    setProductPose(product, next);
    snapView('perspective');
  }
  function setShot(next: ShotName) {
    localEarbudInspection = false;
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
    perspective.aspect = width / height;
    perspective.updateProjectionMatrix();
    const oldZoom = camera.zoom;
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
      if (camera instanceof OrthographicCamera) {
        camera.zoom = oldZoom;
        camera.updateProjectionMatrix();
      }
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  setShot('open');
  function handleManual() {
    geometryView = null;
    view = 'manual';
    shot = null;
    onManualView();
    notify();
  }
  function tick() {
    if (disposed || failed || document.hidden) return;
    controls.update();
    studio.updateFloor(
      camera.position,
      focus !== 'earbud' && !wireframe && !stripeInspection && !geometryView,
    );
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
    failed = true;
    controls.enabled = false;
    cancelAnimationFrame(raf);
    onContextLost();
  };
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', handleLost);
  tick();
  return {
    setView: snapView,
    setShot,
    setGeometryView(next: GeometryView, subject: 'earbud' | 'case' | 'seating' = 'earbud') {
      pose = subject === 'case' ? 'closed' : 'open';
      setProductPose(product, pose);
      localEarbudInspection = subject === 'earbud';
      if (subject === 'earbud') {
        parts.leftEarbud.rotation.set(0, 0, 0);
        parts.rightEarbud.rotation.set(0, 0, 0);
        root.updateMatrixWorld(true);
      }
      shot = null;
      geometryView = next;
      view = next in CAMERA_PRESETS ? (next as ViewName) : 'earbud';
      focus = subject === 'seating' ? 'product' : subject;
      hideEarbuds = subject === 'case';
      camera = orthographic;
      controls.dispose();
      const preset = GEOMETRY_VIEWS[next];
      camera.up.set(preset.up[0], preset.up[1], preset.up[2]);
      controls = createControls();
      frameScale = 1;
      showParts();
      frame(new Vector3(...preset.direction));
      notify();
    },
    setPose,
    setLidAngle(degrees: number) {
      if (geometryView || focus === 'earbud') snapView('perspective');
      pose = 'custom';
      shot = null;
      setLidAngle(product, degrees);
      root.updateMatrixWorld(true);
      frame(camera.position.clone().sub(controls.target));
      notify();
    },
    setHideEarbuds(hidden: boolean) {
      if (focus === 'earbud') {
        if (localEarbudInspection) {
          setProductPose(product, 'open');
          localEarbudInspection = false;
        }
        geometryView = null;
        camera = perspective;
        controls.dispose();
        camera.up.set(0, 1, 0);
        controls = createControls();
        focus = 'product';
        view = 'perspective';
      }
      hideEarbuds = hidden;
      shot = null;
      showParts();
      frame(
        geometryView
          ? new Vector3(...GEOMETRY_VIEWS[geometryView].direction)
          : directionFor(view === 'manual' ? 'perspective' : view),
      );
      notify();
    },
    setInspectionMaterial(options: {
      wireframe?: boolean;
      uniformGray?: boolean;
      stripes?: boolean;
    }) {
      wireframe = options.wireframe ?? wireframe;
      uniformGray = options.uniformGray ?? uniformGray;
      stripeInspection = options.stripes ?? stripeInspection;
      for (const [mesh, material] of originalMaterials)
        mesh.material = wireframe
          ? wire
          : stripeInspection
            ? stripes
            : uniformGray
              ? clay
              : material;
      notify();
    },
    reset() {
      wireframe = false;
      uniformGray = false;
      stripeInspection = false;
      for (const [mesh, material] of originalMaterials) mesh.material = material;
      setShot('open');
    },
    zoom(factor: number) {
      if (camera instanceof OrthographicCamera) {
        camera.zoom = Math.max(controls.minZoom, Math.min(controls.maxZoom, camera.zoom / factor));
        camera.updateProjectionMatrix();
        return;
      }
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
        geometryView,
        localEarbudInspection,
        modelPose: root.userData.pose,
        projection: camera instanceof OrthographicCamera ? 'orthographic' : 'perspective',
        view,
        focus,
        lidAngle: (-parts.lidPivot.rotation.x * 180) / Math.PI,
        hideEarbuds,
        wireframe,
        uniformGray,
        stripes: stripeInspection,
        earbudModel: parts.rightEarbud.userData.model,
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
        up: camera.up.toArray(),
        zoom: camera.zoom,
        earbudRotation: parts.rightEarbud.rotation.toArray(),
        earbudPosition: parts.rightEarbud.position.toArray(),
        target: controls.target.toArray(),
        distance: camera.position.distanceTo(controls.target),
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        aspect: host.clientWidth / host.clientHeight,
        canvas: [canvas.width, canvas.height],
        meshes: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        failed,
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
      stripes.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
export type ProductScene = ReturnType<typeof createScene>;
