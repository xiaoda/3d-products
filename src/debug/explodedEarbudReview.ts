import './explodedEarbudReview.css';
import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  HemisphereLight,
  Material,
  Mesh,
  OrthographicCamera,
  PCFShadowMap,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createExplodedEarbud } from '../model/createExplodedEarbud';
import { EXPLODED_DISCLAIMER, type ExplodedPose } from '../model/explodedEarbudDefinition';
import { createStudioEnvironment } from '../scene/lighting';
import {
  EXPLODED_DURATION,
  EXPLODED_HOLD_DURATION,
  EXPLODED_OPEN_END,
  EXPLODED_CLOSE_START,
  sampleExplodedFilm,
  smooth,
  type ExplodedFilmSample,
} from '../interaction/explodedFilm';
import { createExplodedPlayer } from '../interaction/explodedPlayer';
import { createExplodedFraming, type ExplodedCameraFrame } from '../scene/explodedFilmCamera';

/** 独立产品展示：同步展开、全景、无画内标注，不影响原 A/B/C。 */
export function mountExplodedEarbudReview() {
  document.title = '耳机 · 8 秒定机位展开';
  document.body.innerHTML = `<main class="exploded-review">
    <header class="exploded-top"><div><p class="exploded-kicker">FORM IN MOTION</p><h1>耳机 · 流动的结构</h1></div><a href="/">返回产品展示 ↗</a></header>
    <section class="exploded-stage-area" aria-label="耳机同步展开三维预览">
      <div class="exploded-stage"><div class="exploded-canvas" id="exploded-host"></div>
        <div class="exploded-error" role="alert" hidden><strong>三维预览暂时不可用</strong><p>请重新加载后重试，或检查浏览器是否支持 WebGL 2。</p><button type="button" id="exploded-retry">重新加载</button></div>
      </div>
      <div class="exploded-player" aria-label="产品展示播放器">
        <div class="exploded-toolbar"><div class="exploded-tabs" role="group" aria-label="静态视图"><button data-exploded-pose="assembled" aria-pressed="false">完整</button><button data-exploded-pose="inside" aria-pressed="false">内部</button><button data-exploded-pose="exploded" aria-pressed="true">展开</button></div><button id="exploded-reset">重置视角</button></div>
        <div class="exploded-player-actions"><button id="exploded-play" type="button">▶ 播放 8 秒</button><button id="exploded-replay" type="button" aria-label="从头播放">↺ 重播</button><label><input type="checkbox" id="exploded-loop">循环</label></div>
        <div class="exploded-scrubber"><label for="exploded-progress" class="exploded-sr-only">影片进度（秒）</label><input id="exploded-progress" type="range" min="0" max="${EXPLODED_DURATION}" value="0" step="0.01"><output id="exploded-time" for="exploded-progress" aria-live="off">00:00 / 00:${String(EXPLODED_DURATION).padStart(2, '0')}</output></div>
        <div class="exploded-status-row"><p id="exploded-player-status" role="status">固定视角 · 展开停留 ${EXPLODED_HOLD_DURATION} 秒</p><span>拖动观察 / 空格播放</span></div>
      </div>
    </section>
    <footer class="exploded-disclaimer">${EXPLODED_DISCLAIMER}。展开为断开连接的视觉示意，非实际拆卸路径。当前为动作预览，尚未导出视频。</footer>
  </main>`;
  // The existing showroom stylesheet is global; the review owns a scrolling document.
  document.documentElement.style.overflow = 'auto';
  document.body.style.cssText = 'margin:0;overflow:auto;height:auto;';
  const abort = new AbortController(),
    options = { signal: abort.signal };
  const host = document.querySelector<HTMLElement>('#exploded-host')!;
  const error = document.querySelector<HTMLElement>('.exploded-error')!;
  const player = createExplodedPlayer();
  let stopPlayback = () => {};
  const cleanups: (() => void)[] = [];
  const cleanup = () => {
    while (cleanups.length) cleanups.pop()!();
  };
  let failed = false,
    disposed = false;
  const showError = () => {
    stopPlayback();
    failed = true;
    error.hidden = false;
    document
      .querySelectorAll<HTMLButtonElement | HTMLInputElement>(
        '[data-exploded-pose], #exploded-reset, .exploded-player button, .exploded-player input',
      )
      .forEach((b) => (b.disabled = true));
  };
  document
    .querySelector('#exploded-retry')!
    .addEventListener('click', () => location.reload(), options);
  try {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    cleanups.push(() => {
      renderer.dispose();
      renderer.domElement.remove();
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const canvas = renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '耳机整体同步展开，无数字标注，可拖动旋转');
    canvas.tabIndex = 0;
    host.append(canvas);
    const scene = new Scene();
    renderer.setClearColor(0x000000, 0);
    cleanups.push(() => scene.clear());
    const model = createExplodedEarbud();
    scene.add(model.root);
    cleanups.push(() => model.dispose());
    const framing = createExplodedFraming(model);
    const environment = createStudioEnvironment(),
      generator = new PMREMGenerator(renderer);
    const env = (() => {
      try {
        return generator.fromScene(environment, 0.08, 0.1, 50, { size: 256 });
      } finally {
        generator.dispose();
        environment.traverse((obj) => {
          if (obj instanceof Mesh) {
            obj.geometry.dispose();
            (obj.material as Material).dispose();
          }
        });
        environment.clear();
      }
    })();
    cleanups.push(() => env.dispose());
    scene.environment = env.texture;
    scene.environmentIntensity = 0.9;
    const key = new DirectionalLight(0xfffbf3, 2.15);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -5,
      right: 5,
      top: 5,
      bottom: -5,
      near: 0.5,
      far: 25,
    });
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -0.00006;
    key.shadow.normalBias = 0.01;
    key.shadow.radius = 3;
    cleanups.push(() => key.shadow.dispose());
    const fill = new DirectionalLight(0xeaf0ff, 0.7);
    fill.position.set(5, 0, 3);
    const rim = new DirectionalLight(0xffffff, 1.85);
    rim.position.set(0, 5, -6);
    scene.add(new HemisphereLight(0xffffff, 0xc2c4c1, 0.42), key, fill, rim);
    // 初始化/fit 也会触发 render；首帧前必须分配 PCF 深度贴图。
    renderer.shadowMap.needsUpdate = true;
    const camera = new OrthographicCamera(-3, 3, 5, -5, 0.1, 100);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.minZoom = 0.6;
    controls.maxZoom = 2;
    cleanups.push(() => controls.dispose());
    const viewDirection = new Vector3(-0.35, 0.2, 1).normalize();
    let filmSample: ExplodedFilmSample | null = null;
    let raf = 0,
      lastTick = 0,
      manualCamera = false;
    let cameraReturn: { from: ExplodedCameraFrame; elapsed: number } | null = null;
    const playButton = document.querySelector<HTMLButtonElement>('#exploded-play')!;
    const progress = document.querySelector<HTMLInputElement>('#exploded-progress')!;
    const playerStatus = document.querySelector<HTMLElement>('#exploded-player-status')!;
    const clock = (t: number) => `00:${Math.floor(t).toString().padStart(2, '0')}`;
    const setText = (selector: string, text: string) => {
      const el = document.querySelector(selector)!;
      if (el.textContent !== text) el.textContent = text;
    };
    function refreshPlayer() {
      const state = player.inspect();
      playButton.textContent =
        state.mode === 'playing'
          ? 'Ⅱ 暂停'
          : state.mode === 'ended'
            ? '▶ 再看一次'
            : state.mode === 'paused'
              ? '▶ 继续播放'
              : '▶ 播放 8 秒';
      playButton.setAttribute('aria-pressed', String(state.mode === 'playing'));
      progress.value = String(state.time);
      progress.setAttribute(
        'aria-valuetext',
        `${state.time.toFixed(1)} 秒，共 ${EXPLODED_DURATION} 秒`,
      );
      setText('#exploded-time', `${clock(state.time)} / ${clock(EXPLODED_DURATION)}`);
      const status =
        state.mode === 'static'
          ? `固定视角 · 展开停留 ${EXPLODED_HOLD_DURATION} 秒`
          : state.mode === 'playing' &&
              state.time >= EXPLODED_OPEN_END &&
              state.time <= EXPLODED_CLOSE_START
            ? '全部展开 · 短暂停留'
            : `${state.mode === 'playing' ? '播放中' : state.mode === 'ended' ? '播放结束' : '已暂停'}${manualCamera ? ' · 自由观察' : ' · 固定视角'}`;
      if (playerStatus.textContent !== status) playerStatus.textContent = status;
    }

    function putCamera(shot: ExplodedCameraFrame) {
      const aspect = host.clientWidth / host.clientHeight;
      camera.position.copy(shot.position);
      camera.up.copy(shot.up);
      controls.target.copy(shot.target);
      camera.left = -shot.half * aspect;
      camera.right = shot.half * aspect;
      camera.top = shot.half;
      camera.bottom = -shot.half;
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.update();
    }
    function applyFilm(time: number) {
      filmSample = sampleExplodedFilm(time);
      model.applyFilm(filmSample);
      renderer.shadowMap.needsUpdate = true;
      scene.environmentRotation.y = filmSample.reflection;
      if (!manualCamera) {
        const shot = framing.frame(filmSample, host.clientWidth / host.clientHeight);
        if (cameraReturn) {
          const mix = smooth(cameraReturn.elapsed / 0.7),
            from = cameraReturn.from;
          shot.target.lerpVectors(from.target, shot.target, mix);
          shot.position.lerpVectors(from.position, shot.position, mix);
          shot.half = from.half + (shot.half - from.half) * mix;
          if (mix === 1) cameraReturn = null;
        }
        putCamera(shot);
      }
      document
        .querySelectorAll<HTMLElement>('[data-exploded-pose]')
        .forEach((el) => el.setAttribute('aria-pressed', 'false'));
      refreshPlayer();
      render();
    }
    function pause() {
      player.pause();
      cancelAnimationFrame(raf);
      raf = 0;
      refreshPlayer();
    }
    stopPlayback = pause;
    function tick(now: number) {
      raf = 0;
      if (failed || disposed || document.hidden || player.inspect().mode !== 'playing') return;
      const delta = Math.max(0, (now - lastTick) / 1000);
      lastTick = now;
      if (cameraReturn) cameraReturn.elapsed += delta;
      if (player.update(delta)) applyFilm(player.inspect().time);
      if (player.inspect().mode === 'playing') raf = requestAnimationFrame(tick);
    }
    function play(restart = false) {
      if (failed || disposed || document.hidden) return;
      cancelAnimationFrame(raf);
      if (manualCamera && !restart)
        cameraReturn = {
          from: {
            position: camera.position.clone(),
            target: controls.target.clone(),
            up: camera.up.clone(),
            half: camera.top / camera.zoom,
          },
          elapsed: 0,
        };
      else cameraReturn = null;
      manualCamera = false;
      if (restart) player.restart();
      else player.play();
      applyFilm(player.inspect().time);
      lastTick = performance.now();
      raf = requestAnimationFrame(tick);
    }
    function seekFilm(time: number) {
      if (failed || disposed) return;
      cancelAnimationFrame(raf);
      raf = 0;
      player.seek(time);
      cameraReturn = null;
      manualCamera = false;
      applyFilm(player.inspect().time);
    }
    function leaveFilm() {
      pause();
      player.stop();
      filmSample = null;
      cameraReturn = null;
      manualCamera = false;
      refreshPlayer();
    }
    cleanups.push(() => {
      cancelAnimationFrame(raf);
      player.dispose();
    });
    function render() {
      if (failed || disposed) return;
      renderer.render(scene, camera);
    }
    function fit() {
      if (model.pose === 'exploded') {
        putCamera(
          framing.frame(
            sampleExplodedFilm(EXPLODED_DURATION / 2),
            host.clientWidth / host.clientHeight,
          ),
        );
        render();
        return;
      }
      const bounds = new Box3();
      if (model.pose === 'assembled') bounds.setFromObject(model.complete);
      else
        for (const part of Object.values(model.parts))
          if (part.visible) bounds.union(new Box3().setFromObject(part));
      const target = bounds.getCenter(new Vector3());
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(viewDirection, 15);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      camera.zoom = 1;
      camera.updateMatrixWorld(true);
      // Project each visible mesh bounds, not the inflated combined world box.
      const viewBounds = new Box3();
      model.root.traverseVisible((object) => {
        if (!(object instanceof Mesh)) return;
        object.geometry.computeBoundingBox();
        const b = object.geometry.boundingBox!;
        for (const x of [b.min.x, b.max.x])
          for (const y of [b.min.y, b.max.y])
            for (const z of [b.min.z, b.max.z])
              viewBounds.expandByPoint(
                new Vector3(x, y, z)
                  .applyMatrix4(object.matrixWorld)
                  .applyMatrix4(camera.matrixWorldInverse),
              );
      });
      const size = viewBounds.getSize(new Vector3()),
        aspect = host.clientWidth / host.clientHeight;
      const half = Math.max(size.y / 2 / 0.72, size.x / 2 / aspect / 0.84);
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      controls.update();
      render();
    }
    function setPose(pose: ExplodedPose) {
      leaveFilm();
      model.setPose(pose);
      renderer.shadowMap.needsUpdate = true;
      scene.environmentRotation.y = 0;
      document
        .querySelectorAll<HTMLElement>('[data-exploded-pose]')
        .forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.explodedPose === pose)));
      fit();
    }
    const resize = () => {
      if (failed || disposed) return;
      if (!host.clientWidth || !host.clientHeight) return;
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      if (filmSample) {
        if (manualCamera) {
          const aspect = host.clientWidth / host.clientHeight;
          camera.left = -camera.top * aspect;
          camera.right = camera.top * aspect;
          camera.updateProjectionMatrix();
          render();
        } else applyFilm(player.inspect().time);
      } else fit();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    cleanups.push(() => observer.disconnect());
    controls.addEventListener('change', render);
    controls.addEventListener('start', () => {
      if (filmSample) {
        pause();
        cameraReturn = null;
        manualCamera = true;
        refreshPlayer();
      }
    });
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        controls.enabled = false;
        showError();
      },
      options,
    );
    document
      .querySelectorAll<HTMLElement>('[data-exploded-pose]')
      .forEach((el) =>
        el.addEventListener(
          'click',
          () => setPose(el.dataset.explodedPose as ExplodedPose),
          options,
        ),
      );
    document.querySelector('#exploded-reset')!.addEventListener(
      'click',
      () => {
        if (filmSample) seekFilm(player.inspect().time);
        else fit();
      },
      options,
    );
    playButton.addEventListener(
      'click',
      () => (player.inspect().mode === 'playing' ? pause() : play()),
      options,
    );
    document
      .querySelector('#exploded-replay')!
      .addEventListener('click', () => play(true), options);
    progress.addEventListener('input', () => seekFilm(Number(progress.value)), options);
    document
      .querySelector<HTMLInputElement>('#exploded-loop')!
      .addEventListener(
        'change',
        (event) => player.setLoop((event.target as HTMLInputElement).checked),
        options,
      );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) pause();
      },
      options,
    );
    document.addEventListener(
      'keydown',
      (event) => {
        if (
          event.code !== 'Space' ||
          event.repeat ||
          (event.target instanceof HTMLElement &&
            event.target.closest('input,button,a,select,textarea'))
        )
          return;
        event.preventDefault();
        if (player.inspect().mode === 'playing') pause();
        else play();
      },
      options,
    );
    resize();
    setPose('exploded');
    document.documentElement.dataset.viewerReady = 'true';
    // DEV-only module. No additional production globals or automatic movie playback.
    Object.defineProperty(window, '__explodedReview', {
      configurable: true,
      value: {
        setPose,
        seekFilm,
        playFilm: () => play(),
        pauseFilm: pause,
        inspect: () => ({
          pose: model.pose,
          failed,
          schematic: true,
          canvas: [canvas.width, canvas.height],
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          animation: player.inspect(),
          open: filmSample?.open ?? null,
          manualCamera,
          camera: {
            position: camera.position.toArray(),
            target: controls.target.toArray(),
            half: camera.top,
            zoom: camera.zoom,
          },
          rafActive: raf !== 0,
        }),
      },
    });
    cleanups.push(() => Reflect.deleteProperty(window, '__explodedReview'));
  } catch (cause) {
    console.error('结构评审初始化失败', cause);
    cleanup();
    showError();
  }
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      cleanup();
      document.documentElement.style.overflow = '';
      document.body.style.cssText = '';
    },
  };
}
