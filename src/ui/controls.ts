import type { ProductScene, ViewName } from '../scene/createScene';
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
  const refresh = () => {
    const state = scene.inspect();
    markView(state.view);
    const caption = document.querySelector('#view-caption');
    if (caption)
      caption.textContent = `${state.view === 'manual' ? '自由观察' : labels[state.view]} · ${state.pose === 'closed' ? '闭合装配' : state.pose === 'open' ? '开盖检查' : state.pose === 'custom' ? '自定义开盖角度' : '分开展示'}`;
  };
  document.querySelectorAll<HTMLButtonElement>('.viewer-toolbar button').forEach((b) => {
    b.disabled = false;
  });
  document
    .querySelectorAll<HTMLButtonElement>('[data-view]')
    .forEach((b) =>
      b.addEventListener('click', () => scene.setView(b.dataset.view as ViewName), options),
    );
  document.querySelector('#reset-view')?.addEventListener('click', () => scene.reset(), options);
  document.querySelector('#zoom-in')?.addEventListener('click', () => scene.zoom(0.87), options);
  document
    .querySelector('#zoom-out')
    ?.addEventListener('click', () => scene.zoom(1 / 0.87), options);
  document.querySelector('#viewport')?.addEventListener('modelchange', refresh, options);
  refresh();
  return () => abort.abort();
}
