import type { ProductScene, ViewName } from '../scene/createScene';

const labels: Record<ViewName, string> = {
  perspective: '透视',
  front: '正面',
  side: '侧面',
  top: '顶部',
};

export function markView(view: ViewName | 'manual') {
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });
  const caption = document.querySelector('#view-caption');
  if (caption)
    caption.textContent = `${view === 'manual' ? '自由观察' : labels[view]} · 固定分开展示`;
}

export function connectControls(scene: ProductScene): () => void {
  const abort = new AbortController();
  const options = { signal: abort.signal };
  document.querySelectorAll<HTMLButtonElement>('.viewer-toolbar button').forEach((button) => {
    button.disabled = false;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const view = button.dataset.view as ViewName;
        scene.setView(view);
        markView(view);
      },
      options,
    );
  });
  document.querySelector('#reset-view')?.addEventListener(
    'click',
    () => {
      scene.setView('perspective');
      markView('perspective');
    },
    options,
  );
  document.querySelector('#zoom-in')?.addEventListener('click', () => scene.zoom(0.87), options);
  document
    .querySelector('#zoom-out')
    ?.addEventListener('click', () => scene.zoom(1 / 0.87), options);
  return () => abort.abort();
}
