import './earbudReview.css';
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEarbudShellGeometry } from '../model/createEarbudShell';
import { createLegacyEarbudShell } from './legacyEarbudShell';
import { createDetailedEarbud } from '../model/createDetailedEarbud';
import { EAR_FEATURES } from '../model/earbudFeatures';
import { createProductMaterials } from '../model/materials';
import { createStudioEnvironment, disposeStudioEnvironment } from '../scene/lighting';
import {
  REVIEW_VIEWS,
  reviewFrustum,
  type ReviewMaterial,
  type ReviewMode,
  type ReviewView,
} from './earbudReviewConfig';

export function mountEarbudReview(phase: 'shell' | 'details' = 'shell') {
  const details = phase === 'details';
  document.title = `AirPods 5 · ${details ? '耳机细节评审' : '单耳裸壳评审'}`;
  document.body.innerHTML = `
    <div class="shell-review">
      <header class="review-header"><a href="./">◧ 产品研究室 <span>/ 返回整套产品</span></a><span class="review-status">${details ? 'B / C 已确认 · 整套收纳校准待验收' : '几何专项 · A / B · 用户已确认'}</span></header>
      <main class="review-main">
        <section class="review-heading"><div><p class="eyebrow">${details ? '冻结主曲面，只恢复局部细节' : '只看形体，不用细节掩盖问题'}</p><h1>${details ? '耳机细节<span>局部恢复。' : '单耳裸壳<span>曲面评审。'}</span></h1></div><p>同一机位 · 同一比例 · 同一光照<br>${details ? '已接入整套产品；本页保留局部对照。' : '不含开孔与附件，保留已确认形体。'}</p></section>
        <div class="review-workspace">
          <section class="review-stage" aria-label="${details ? '裸壳与细节同机位比较' : '新旧裸壳同机位比较'}">
            <div class="review-modebar" role="group" aria-label="对照方式"><button type="button" data-mode="compare">${details ? '裸壳 / 细节' : '同机位并排'}</button><button type="button" data-mode="candidate">${details ? '完整右耳' : '只看新裸壳'}</button><button type="button" data-mode="legacy">${details ? '只看裸壳' : '只看旧裸壳'}</button>${details ? '<button type="button" data-mode="pair">左右耳</button>' : ''}<span id="review-projection">后视 / 正交投影</span></div>
            ${details ? `<div class="review-featurebar" role="group" aria-label="逐项细节开关">${EAR_FEATURES.map((f) => `<label><input type="checkbox" data-feature="${f.id}" checked>${f.label}</label>`).join('')}<div><button type="button" id="review-all-on">全部恢复</button><button type="button" id="review-all-off">全部关闭</button></div><p id="review-detail-status" role="status">细节恢复：7 / 7</p></div>` : ''}
            <div id="review-viewport"><div id="review-model-labels" aria-hidden="true"><span>${details ? '已确认裸壳 <small>同一主曲面 · 无细节</small>' : '修正前 <small>636d080 · 无细节</small>'}</span><span>${details ? '完整右耳 <small>局部开口 · 主壳不变</small>' : '新裸壳 <small>控制曲面 · 无细节</small>'}</span></div><div id="review-divider" aria-hidden="true"></div><div id="review-error" role="alert" hidden><strong>耳机评审预览暂时不可用</strong><p>请重新加载后重试，或返回整套产品。</p><button type="button" id="review-retry">重新加载</button></div></div>
            <div class="review-camera-tools"><p>拖动旋转 · 滚轮缩放 · 聚焦画布后可用方向键旋转</p><div><button type="button" id="review-zoom-out" aria-label="缩小耳机">−</button><button type="button" id="review-zoom-in" aria-label="放大耳机">+</button><button type="button" id="review-reset">${details ? '重置评审' : '重置后视'}</button></div></div>
            <p class="review-stage-note">${details ? '左侧为已确认裸壳，右侧只改局部开口。全部关闭后逐顶点恢复裸壳；孔口是带封底的展示凹腔，不是内部声学结构。' : '新旧对照均移除细节。旧模型沿用原有尺寸变换；新模型直接以毫米控制点生成，不做逐轴包围盒拉伸。'}</p>
          </section>
          <aside class="review-sidebar" aria-label="耳机检查选项">
            <section><h2>01 <span>固定观察方向</span></h2><div class="review-view-grid" role="group" aria-label="单耳观察方向">${Object.entries(
              REVIEW_VIEWS,
            )
              .map(
                ([key, view]) =>
                  `<button type="button" data-review-view="${key}">${view.label}</button>`,
              )
              .join('')}</div></section>
            <section><h2>02 <span>检查表面</span></h2><div class="review-materials" role="group" aria-label="诊断材质">${details ? '<button type="button" data-material="physical">白塑料 / 金属</button>' : ''}<button type="button" data-material="clay">中性灰模</button><button type="button" data-material="stripes">条带反射</button><button type="button" data-material="silhouette">纯色轮廓</button></div><p id="review-material-note">无摄影棚贴图、无地面阴影，先检查表面体积和转折。</p></section>
            <section><h2>03 <span>本次重点</span></h2><ol>${details ? '<li>开孔位置、朝向与孔缘是否自然。</li><li>开关细节，检查背肩与主轮廓是否保持。</li><li>检查左右耳、网罩贴合与底部触点。</li>' : '<li>俯视边线是否还存在尖凸和波浪。</li><li>背肩与头颈过渡是否顺畅。</li><li>旋转到斜视时，体积与高光是否连贯。</li>'}</ol></section>
            <section class="review-spec"><h2>尺寸复核 <span>mm</span></h2><p>目标外包围：18.3 × 30.2 × 18.1</p><p>已确认裸壳：<strong id="review-size"></strong></p><p>曲面与局部参数是展示近似，不是工程 CAD。收纳与盒盖避让的自检结果见 D 装配记录。</p></section>
            <a class="review-source" href="?review=${details ? 'earbud-shell' : 'earbud-details'}">${details ? '返回已确认裸壳对照' : '进入 C 细节与左右耳评审'} →</a>
            <a class="review-source" href="https://www.apple.com.cn/v/airpods-5/b/images/overview/bento-gallery/bento_pair__c7i9mu5k2zee_xlarge.jpg" target="_blank" rel="noopener noreferrer">打开官网双耳参考 ↗</a>
          </aside>
        </div>
        <footer class="review-footer"><span>Three.js 程序化控制曲面 · 无外部产品网格</span><strong>${details ? 'C 细节已确认；整套装配在主页验收。' : '裸壳已确认，控制曲面已冻结。'}</strong></footer>
      </main>
    </div>`;

  const root = document.querySelector<HTMLElement>('.shell-review')!;
  const host = document.querySelector<HTMLElement>('#review-viewport')!;
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '耳机评审画布，拖动或使用方向键旋转，滚轮缩放');
  host.prepend(canvas);
  const candidate = createEarbudShellGeometry();
  const legacy = details ? createEarbudShellGeometry() : createLegacyEarbudShell();
  const productMaterials = createProductMaterials();
  const right = details ? createDetailedEarbud('right', productMaterials) : null;
  const left = details ? createDetailedEarbud('left', productMaterials) : null;
  const size = candidate.boundingBox!.getSize(new Vector3()).multiplyScalar(10);
  document.querySelector('#review-size')!.textContent = size
    .toArray()
    .map((v) => v.toFixed(2))
    .join(' × ');

  const clay = new MeshStandardMaterial({ color: 0xb1b5b4, roughness: 0.8, metalness: 0 });
  const silhouette = new MeshBasicMaterial({ color: 0x314d42 });
  const stripes = new ShaderMaterial({
    vertexShader: `varying vec3 vN;
      void main() { vec4 p=modelViewMatrix*vec4(position,1.0); vN=normalMatrix*normal; gl_Position=projectionMatrix*p; }`,
    fragmentShader: `varying vec3 vN;
      void main() { vec3 n=normalize(vN); vec3 r=reflect(vec3(0.0,0.0,-1.0),n);
        float x=(r.x+r.y*0.35)*16.0; float wave=sin(x); float width=max(fwidth(wave),0.025);
        float mask=smoothstep(-width,width,wave);
        gl_FragColor=vec4(mix(vec3(0.06,0.13,0.10),vec3(0.90,0.94,0.89),mask),1.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
  });
  const materials = { clay, stripes, silhouette };
  const newMesh: Mesh = new Mesh(candidate, clay),
    oldMesh: Mesh = new Mesh(legacy, clay);
  const makeScene = (mesh: Object3D) => {
    const scene = new Scene();
    scene.background = new Color(0xe9eae6);
    const sky = new HemisphereLight(0xffffff, 0x9b9e99, 1.4);
    const key = new DirectionalLight(0xffffff, 2.6);
    key.position.set(-3, 5, 7);
    const fill = new DirectionalLight(0xffffff, 1.3);
    fill.position.set(4, 2, -6);
    scene.add(mesh, sky, key, fill);
    return scene;
  };
  const newScene = makeScene(right?.root ?? newMesh),
    oldScene = makeScene(oldMesh),
    leftScene = left ? makeScene(left.root) : null;
  const environment = details
    ? (() => {
        const studio = createStudioEnvironment(),
          generator = new PMREMGenerator(renderer);
        try {
          return generator.fromScene(studio, 0.055, 0.1, 50, { size: 256 });
        } finally {
          generator.dispose();
          disposeStudioEnvironment(studio);
        }
      })()
    : null;
  const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 50);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const abort = new AbortController(),
    events = { signal: abort.signal };
  let controls: OrbitControls<OrthographicCamera>;
  let mode: ReviewMode = 'compare',
    material: ReviewMaterial = details ? 'physical' : 'clay';
  let view: ReviewView | 'manual' = 'back';
  let width = 1,
    height = 1,
    frame = 0,
    disposed = false,
    failed = false;

  function syncLabels() {
    root
      .querySelectorAll<HTMLButtonElement>('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    root
      .querySelectorAll<HTMLButtonElement>('[data-material]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.material === material)));
    root
      .querySelectorAll<HTMLButtonElement>('[data-review-view]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.reviewView === view)));
    root.dataset.mode = mode;
    root.dataset.split = String(mode === 'compare' || mode === 'pair');
    if (details) {
      document.querySelector('#review-model-labels span:first-child')!.innerHTML =
        mode === 'pair'
          ? '左耳 <small>正确镜像 · 局部细节</small>'
          : '已确认裸壳 <small>同一主曲面 · 无细节</small>';
      document.querySelector('#review-model-labels span:last-child')!.innerHTML =
        mode === 'pair'
          ? '右耳 <small>同机位 · 同一比例</small>'
          : '完整右耳 <small>局部开口 · 主壳不变</small>';
    }
    document.querySelector('#review-projection')!.textContent =
      `${view === 'manual' ? '自由观察' : REVIEW_VIEWS[view].label} / 正交投影`;
    document.querySelector('#review-material-note')!.textContent =
      material === 'physical'
        ? '沿用白塑料、金属、传感器与网罩物理材质。程序化柔光箱反射，无下载纹理；无地面阴影。'
        : material === 'stripes'
          ? '诊断用条带反射，并非真实产品材质。观察条带是否连续，有无局部挤压或异常反折。'
          : material === 'silhouette'
            ? '只观察外轮廓；轮廓相似不能证明背面和内部转折正确。'
            : '无摄影棚贴图、无地面阴影，先检查表面体积和转折。';
  }
  function applyMaterial() {
    const diagnostic = material === 'physical' ? null : materials[material];
    newMesh.material = oldMesh.material = diagnostic ?? productMaterials.get('plastic');
    right?.setDiagnosticMaterial(diagnostic);
    left?.setDiagnosticMaterial(diagnostic);
    for (const scene of [newScene, oldScene, leftScene])
      if (scene) {
        scene.environment = material === 'physical' ? (environment?.texture ?? null) : null;
        scene.environmentIntensity = 0.8;
      }
    syncLabels();
  }
  const featureInputs = [...root.querySelectorAll<HTMLInputElement>('[data-feature]')];
  function updateFeatures(all?: boolean) {
    if (all !== undefined) for (const input of featureInputs) input.checked = all;
    const ids = featureInputs.filter((i) => i.checked).map((i) => i.dataset.feature!);
    right?.setFeatures(ids);
    left?.setFeatures(ids);
    const status = document.querySelector('#review-detail-status');
    if (status)
      status.textContent = `细节恢复：${ids.length} / ${EAR_FEATURES.length}${ids.length ? '' : ' · 已恢复裸壳'}`;
  }
  function project() {
    Object.assign(camera, reviewFrustum(width, height, mode === 'compare' || mode === 'pair'));
    camera.updateProjectionMatrix();
  }
  function setView(next: ReviewView) {
    controls?.dispose();
    const preset = REVIEW_VIEWS[next];
    camera.up.set(preset.up[0], preset.up[1], preset.up[2]);
    camera.position
      .set(preset.direction[0], preset.direction[1], preset.direction[2])
      .normalize()
      .multiplyScalar(12);
    camera.zoom = 1;
    camera.lookAt(0, 0, 0);
    controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.55;
    controls.minZoom = 0.65;
    controls.maxZoom = 3;
    controls.addEventListener('start', () => {
      view = 'manual';
      syncLabels();
    });
    view = next;
    project();
    syncLabels();
  }
  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    project();
  }
  function draw() {
    frame = 0;
    if (disposed || failed || document.hidden) return;
    controls.update();
    renderer.setScissorTest(true);
    if (mode === 'compare' || mode === 'pair') {
      const half = width / 2;
      renderer.setViewport(0, 0, half, height);
      renderer.setScissor(0, 0, half, height);
      renderer.render(mode === 'pair' ? leftScene! : oldScene, camera);
      renderer.setViewport(half, 0, half, height);
      renderer.setScissor(half, 0, half, height);
      renderer.render(newScene, camera);
    } else {
      renderer.setViewport(0, 0, width, height);
      renderer.setScissor(0, 0, width, height);
      renderer.render(mode === 'candidate' ? newScene : oldScene, camera);
    }
    frame = requestAnimationFrame(draw);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  setView(details ? 'frontLeft' : 'back');
  applyMaterial();
  draw();
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener(
      'click',
      () => {
        mode = b.dataset.mode as ReviewMode;
        project();
        syncLabels();
      },
      events,
    ),
  );
  root
    .querySelectorAll<HTMLButtonElement>('[data-review-view]')
    .forEach((b) =>
      b.addEventListener('click', () => setView(b.dataset.reviewView as ReviewView), events),
    );
  root.querySelectorAll<HTMLButtonElement>('[data-material]').forEach((b) =>
    b.addEventListener(
      'click',
      () => {
        material = b.dataset.material as ReviewMaterial;
        applyMaterial();
      },
      events,
    ),
  );
  const zoom = (factor: number) => {
    camera.zoom = Math.max(0.65, Math.min(3, camera.zoom * factor));
    camera.updateProjectionMatrix();
  };
  document.querySelector('#review-zoom-in')!.addEventListener('click', () => zoom(1.15), events);
  document
    .querySelector('#review-zoom-out')!
    .addEventListener('click', () => zoom(1 / 1.15), events);
  document.querySelector('#review-reset')!.addEventListener(
    'click',
    () => {
      material = details ? 'physical' : 'clay';
      mode = 'compare';
      if (details) updateFeatures(true);
      applyMaterial();
      setView(details ? 'frontLeft' : 'back');
    },
    events,
  );
  for (const input of featureInputs)
    input.addEventListener('change', () => updateFeatures(), events);
  document
    .querySelector('#review-all-on')
    ?.addEventListener('click', () => updateFeatures(true), events);
  document
    .querySelector('#review-all-off')
    ?.addEventListener('click', () => updateFeatures(false), events);
  canvas.addEventListener(
    'keydown',
    (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const axis =
        event.key === 'ArrowLeft' || event.key === 'ArrowRight'
          ? camera.up
          : new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const sign = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? 1 : -1;
      camera.position.applyAxisAngle(axis, (sign * Math.PI) / 24);
      controls.update();
      view = 'manual';
      syncLabels();
    },
    events,
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!document.hidden && !disposed && !failed) draw();
    },
    events,
  );
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      failed = true;
      cancelAnimationFrame(frame);
      controls.enabled = false;
      document.querySelector<HTMLElement>('#review-error')!.hidden = false;
      root
        .querySelectorAll<HTMLButtonElement | HTMLInputElement>('button:not(#review-retry), input')
        .forEach((b) => {
          b.disabled = true;
        });
    },
    events,
  );
  document
    .querySelector('#review-retry')!
    .addEventListener('click', () => window.location.reload(), events);
  document.documentElement.dataset.viewerReady = 'true';
  return {
    inspect: () => ({
      phase,
      detailState: right?.inspect(),
      leftState: left?.inspect(),
      shellVertices: right?.shell.geometry.attributes.position.count,
      mode,
      material,
      view,
      sizeMm: size.toArray(),
      projection: 'orthographic',
      position: camera.position.toArray(),
      up: camera.up.toArray(),
      zoom: camera.zoom,
      frustum: [camera.left, camera.right, camera.top, camera.bottom],
      canvas: [canvas.width, canvas.height],
      vertices: candidate.attributes.position.count,
      triangles: candidate.index!.count / 3,
      resources: { ...renderer.info.memory },
      disposed,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      abort.abort();
      observer.disconnect();
      controls.dispose();
      candidate.dispose();
      legacy.dispose();
      right?.dispose();
      left?.dispose();
      environment?.dispose();
      if (details)
        for (const role of ['plastic', 'grille', 'sensor', 'contact', 'grilleWire'] as const)
          productMaterials.get(role).dispose();
      Object.values(materials).forEach((m) => m.dispose());
      newScene.clear();
      oldScene.clear();
      leftScene?.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
