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
  const lidAction = document.querySelector<HTMLButtonElement>('#lid-action')!;
  const lidLabel = document.querySelector<HTMLElement>('#lid-action-label')!;
  const viewSelector = document.querySelector<HTMLDetailsElement>('#view-selector')!;
  const info = document.querySelector<HTMLDetailsElement>('#product-info')!;
  const refresh = () => {
    const state = scene.inspect();
    markView(state.geometryView ? 'manual' : state.view);
    const nextAction = state.pose === 'closed' ? '打开盒盖' : '合上盒盖';
    lidLabel.textContent = nextAction;
    lidAction.setAttribute('aria-label', `${nextAction}（静态切换）`);
    const materialCaption = document.querySelector('#material-caption');
    if (materialCaption)
      materialCaption.textContent = state.wireframe
        ? '线框检查'
        : state.stripes
          ? '条带高光检查'
          : state.uniformGray
            ? '统一灰模'
            : '物理材质 / 柔光棚';
    const caption = document.querySelector('#view-caption');
    if (caption)
      caption.textContent = state.geometryView
        ? `${state.focus === 'case' ? '盒盖' : state.focus === 'product' ? '收纳' : '单耳'}正交${GEOMETRY_VIEWS[state.geometryView].label} · 形态检查`
        : state.shot === 'detail'
          ? '单耳特写 · 材质研究'
          : state.shot === 'closed'
            ? '闭合主视觉 · 柔光棚'
            : state.shot === 'open'
              ? '开盖双耳 · 柔光棚'
              : `${state.view === 'manual' ? '自由观察' : labels[state.view]} · ${state.pose === 'closed' ? '闭合装配' : state.pose === 'open' ? '开盖检查' : state.pose === 'custom' ? '自定义开盖角度' : '分开展示'}`;
  };
  document.querySelectorAll<HTMLButtonElement>('.control-dock button').forEach((b) => {
    b.disabled = false;
  });
  lidAction.addEventListener(
    'click',
    () => scene.setShot(scene.inspect().pose === 'closed' ? 'open' : 'closed'),
    options,
  );
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) =>
    b.addEventListener(
      'click',
      () => {
        const view = b.dataset.view as ViewName;
        if (view === 'earbud') scene.setShot('detail');
        else scene.setView(view);
        viewSelector.open = false;
        viewSelector.querySelector('summary')?.focus();
      },
      options,
    ),
  );
  document.querySelector('#reset-view')?.addEventListener('click', () => scene.reset(), options);
  document.querySelector('#zoom-in')?.addEventListener('click', () => scene.zoom(0.87), options);
  document
    .querySelector('#zoom-out')
    ?.addEventListener('click', () => scene.zoom(1 / 0.87), options);
  document.querySelector('#viewport')?.addEventListener('modelchange', refresh, options);
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
      if (event.key !== 'Escape') return;
      if (viewSelector.open) {
        viewSelector.open = false;
        viewSelector.querySelector('summary')?.focus();
      }
      if (info.open) {
        info.open = false;
        info.querySelector('summary')?.focus();
      }
    },
    options,
  );
  refresh();
  return () => abort.abort();
}
