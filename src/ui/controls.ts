import { FILMS, isFilmId } from '../interaction/films';
import type { ProductScene, ViewName } from '../scene/createScene';
import { GEOMETRY_VIEWS } from '../scene/geometryViews';
const labels: Record<ViewName, string> = {
  perspective: '透视',
  front: '正面',
  side: '侧面',
  back: '背面',
  top: '顶部',
  bottom: '底部',
  interior: '空盒内胆',
  earbud: '单耳特写',
};
export function markView(view: ViewName | 'manual') {
  document
    .querySelectorAll<HTMLButtonElement>('[data-view]')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
}

export function connectControls(scene: ProductScene): () => void {
  const abort = new AbortController(),
    options = { signal: abort.signal };
  const $ = <T extends Element = HTMLElement>(selector: string) =>
    document.querySelector<T>(selector)!;
  const showroom = $('.showroom');
  const lidAction = $<HTMLButtonElement>('#lid-action'),
    earAction = $<HTMLButtonElement>('#earbud-action');
  const play = $<HTMLButtonElement>('#film-toggle');
  const viewSelector = $<HTMLDetailsElement>('#view-selector'),
    info = $<HTMLDetailsElement>('#product-info');
  const progress = $<HTMLInputElement>('#film-progress');
  const format = $<HTMLButtonElement>('#film-format');
  const panel = $('#film-panel'),
    countdown = $('#film-countdown');
  let portrait = true,
    clean = false,
    preparing = false,
    timer = 0,
    failed = false;
  const clock = (seconds: number) => `00:${Math.floor(seconds).toString().padStart(2, '0')}`;
  const closePanels = () => {
    viewSelector.open = false;
    info.open = false;
  };

  function refresh() {
    const state = scene.inspect(),
      a = state.animation;
    const film = FILMS[a.film];
    document.querySelectorAll<HTMLButtonElement>('[data-film-id]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.filmId === a.film));
      b.disabled = failed;
    });
    $('#film-description').textContent = film.description;
    const isFilm = a.mode === 'playing' || a.mode === 'paused';
    const busy = a.mode === 'action';
    markView(state.geometryView || isFilm ? 'manual' : state.view);
    $('#lid-action-label').textContent =
      a.value.lid < 0.5 ? '打开盒盖' : a.value.extraction > 0 ? '归位并合盖' : '合上盒盖';
    $('#earbud-action-label').textContent = a.value.extraction > 0.01 ? '双耳归位' : '取出双耳';
    lidAction.disabled = failed || busy;
    earAction.disabled = failed || busy;
    $('#film-toggle-label').textContent =
      a.mode === 'playing'
        ? '暂停演示'
        : a.mode === 'paused' && a.time < a.duration
          ? '继续演示'
          : '播放演示';
    play.dataset.playing = String(a.mode === 'playing');
    play.setAttribute(
      'aria-label',
      a.mode === 'playing' ? `暂停${film.title}` : `播放${film.title}，20 秒`,
    );
    panel.hidden = !isFilm;
    showroom.dataset.film = String(isFilm);
    showroom.dataset.format = isFilm && portrait ? 'portrait' : 'full';
    progress.value = a.time.toFixed(2);
    progress.setAttribute('aria-valuetext', `${a.time.toFixed(1)} 秒，共 ${a.duration} 秒`);
    $('#film-time').textContent = `${clock(a.time)} / ${clock(a.duration)}`;
    $('#film-phase').textContent = a.phase;
    $<HTMLInputElement>('#film-loop').checked = a.loop;
    $('#material-caption').textContent = state.wireframe
      ? '线框检查'
      : state.stripes
        ? '条带高光检查'
        : state.uniformGray
          ? '统一灰模'
          : '物理材质 / 柔光棚';
    $('#view-caption').textContent = isFilm
      ? `${film.title} · ${a.phase}`
      : busy
        ? '产品动作进行中'
        : state.geometryView
          ? `${state.focus === 'case' ? '盒盖' : state.focus === 'product' ? '收纳' : '单耳'}正交${GEOMETRY_VIEWS[state.geometryView].label} · 形态检查`
          : state.focus === 'earbud'
            ? '单耳特写 · 材质研究'
            : `${state.view === 'manual' ? '自由观察' : labels[state.view]} · ${a.value.extraction > 0 ? '双耳展示' : a.value.lid === 0 ? '闭合装配' : '开盖展示'}`;
  }
  function leaveClean(pause = true) {
    window.clearTimeout(timer);
    preparing = false;
    clean = false;
    countdown.hidden = true;
    showroom.classList.remove('is-clean', 'is-preparing');
    if (pause && !failed) scene.pauseFilm();
    play.focus();
  }
  function beginClean() {
    closePanels();
    scene.seekFilm(0);
    preparing = true;
    showroom.classList.add('is-preparing');
    countdown.hidden = false;
    let remaining = 3;
    $('#countdown-number').textContent = '3';
    const step = () => {
      if (!preparing) return;
      remaining--;
      if (remaining > 0) {
        $('#countdown-number').textContent = String(remaining);
        timer = window.setTimeout(step, 1000);
        return;
      }
      preparing = false;
      clean = true;
      countdown.hidden = true;
      showroom.classList.remove('is-preparing');
      showroom.classList.add('is-clean');
      document.querySelector<HTMLCanvasElement>('#viewport canvas')?.focus();
      scene.playFilm();
    };
    timer = window.setTimeout(step, 1000);
  }
  const togglePlayback = () => {
    closePanels();
    if (scene.inspect().animation.mode === 'playing') scene.pauseFilm();
    else scene.playFilm();
  };

  document
    .querySelectorAll<HTMLButtonElement>('.control-dock button')
    .forEach((b) => (b.disabled = false));
  play.addEventListener('click', togglePlayback, options);
  document.querySelectorAll<HTMLButtonElement>('[data-film-id]').forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        const id = button.dataset.filmId;
        if (!id || !isFilmId(id) || failed) return;
        closePanels();
        scene.selectFilm(id);
        play.focus();
      },
      options,
    ),
  );
  lidAction.addEventListener(
    'click',
    () => {
      const a = scene.inspect().animation;
      scene.requestAction(a.value.lid < 0.5 ? 'open' : 'close');
      viewSelector.open = false;
      viewSelector.querySelector('summary')?.focus();
    },
    options,
  );
  earAction.addEventListener(
    'click',
    () => {
      const a = scene.inspect().animation;
      scene.requestAction(a.value.extraction > 0.01 ? 'return' : 'extract');
      viewSelector.open = false;
      viewSelector.querySelector('summary')?.focus();
    },
    options,
  );
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) =>
    b.addEventListener(
      'click',
      () => {
        scene.setView(b.dataset.view as ViewName);
        viewSelector.open = false;
        viewSelector.querySelector('summary')?.focus();
      },
      options,
    ),
  );
  $('#reset-view').addEventListener(
    'click',
    () => {
      leaveClean(false);
      closePanels();
      scene.reset();
    },
    options,
  );
  $('#zoom-in').addEventListener('click', () => scene.zoom(0.87), options);
  $('#zoom-out').addEventListener('click', () => scene.zoom(1 / 0.87), options);
  progress.addEventListener('input', () => scene.seekFilm(Number(progress.value)), options);
  $('#film-loop').addEventListener(
    'change',
    () => scene.setFilmLoop($<HTMLInputElement>('#film-loop').checked),
    options,
  );
  format.addEventListener(
    'click',
    () => {
      portrait = !portrait;
      format.setAttribute('aria-pressed', String(portrait));
      format.textContent = portrait ? '9:16 竖屏' : '自适应画幅';
      refresh();
    },
    options,
  );
  $('#clean-view').addEventListener('click', beginClean, options);
  $('#viewport').addEventListener('modelchange', refresh, options);
  $('#viewport').addEventListener(
    'viewererror',
    () => {
      failed = true;
      leaveClean(false);
      refresh();
    },
    options,
  );
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (clean || preparing) {
        event.preventDefault();
        event.stopPropagation();
        leaveClean();
      }
    },
    { signal: abort.signal, capture: true },
  );
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target as Node;
      if (!viewSelector.contains(target)) viewSelector.open = false;
      if (!info.contains(target)) info.open = false;
    },
    options,
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        if (clean || preparing) {
          leaveClean();
          return;
        }
        for (const item of [viewSelector, info])
          if (item.open) {
            item.open = false;
            item.querySelector('summary')?.focus();
          }
      }
      const target = event.target as HTMLElement;
      if (
        event.code === 'Space' &&
        !event.repeat &&
        !failed &&
        !preparing &&
        (clean || !target.closest('button,summary,input,a'))
      ) {
        event.preventDefault();
        togglePlayback();
      }
    },
    options,
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden && preparing) leaveClean();
    },
    options,
  );
  refresh();
  return () => {
    window.clearTimeout(timer);
    abort.abort();
  };
}
