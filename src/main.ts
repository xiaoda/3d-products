import './ui/styles.css';
import { createScene } from './scene/createScene';
import { connectControls, markView } from './ui/controls';

if (
  import.meta.env.DEV &&
  ['earbud-shell', 'earbud-details'].includes(
    new URLSearchParams(window.location.search).get('review') ?? '',
  )
) {
  let dispose = () => {};
  let cancelled = false;
  import('./debug/earbudReview')
    .then(({ mountEarbudReview }) => {
      if (cancelled) return;
      const review = mountEarbudReview(
        new URLSearchParams(window.location.search).get('review') === 'earbud-details'
          ? 'details'
          : 'shell',
      );
      dispose = review.dispose;
      Object.defineProperty(window, '__earbudReview', {
        value: { inspect: review.inspect },
        configurable: true,
      });
    })
    .catch((cause) => {
      if (cancelled) return;
      console.error('耳机评审初始化失败', cause);
      const overlay = document.querySelector<HTMLElement>('#review-error');
      if (overlay) {
        overlay.hidden = false;
        document
          .querySelectorAll<HTMLButtonElement | HTMLInputElement>(
            '.shell-review button:not(#review-retry), .shell-review input',
          )
          .forEach((button) => (button.disabled = true));
        document
          .querySelector('#review-retry')!
          .addEventListener('click', () => window.location.reload(), { once: true });
        return;
      }
      const loading = document.querySelector<HTMLElement>('#loading');
      if (loading) loading.hidden = true;
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = '无法初始化耳机评审，请重新加载或返回整套产品。';
      document.body.append(message);
    });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      cancelled = true;
      dispose();
    }
  });
  import.meta.hot?.dispose(() => {
    cancelled = true;
    dispose();
    Reflect.deleteProperty(window, '__earbudReview');
  });
} else {
  const host = document.querySelector<HTMLElement>('#viewport')!;
  const loading = document.querySelector<HTMLElement>('#loading')!;
  const error = document.querySelector<HTMLElement>('#viewer-error')!;
  const status = document.querySelector<HTMLElement>('#render-status')!;
  const retry = document.querySelector<HTMLButtonElement>('#retry-button')!;
  let cleanup = () => {};
  let disconnected = false;
  let removeInspection = () => {};

  function showError(message: string) {
    loading.hidden = true;
    error.hidden = false;
    document.querySelector<HTMLElement>('#error-message')!.textContent = message;
    status.textContent = '预览不可用';
    document
      .querySelectorAll<HTMLButtonElement>(
        '.viewer-toolbar button, [data-shot], .inspection-panel button, .inspection-panel input',
      )
      .forEach((button) => {
        button.disabled = true;
      });
  }

  retry.addEventListener('click', () => window.location.reload());

  try {
    const scene = createScene(
      host,
      () => markView('manual'),
      () => showError('图形上下文已丢失，请重新加载。本阶段尚未实现自动恢复。'),
    );
    const disconnect = connectControls(scene);
    loading.hidden = true;
    status.textContent = '实时三维 · 可交互';
    document.documentElement.dataset.viewerReady = 'true';
    cleanup = () => {
      disconnected = true;
      removeInspection();
      disconnect();
      scene.dispose();
    };
    // 仅开发模式提供只读诊断入口，不暴露可修改场景的全局句柄。
    if (import.meta.env.DEV) {
      const reviewLink = document.createElement('a');
      reviewLink.href = '?review=earbud-details';
      reviewLink.className = 'inspection-review-link';
      reviewLink.textContent = '回看已确认 B / C 耳机 →（本页整套装配已通过 D 验收）';
      document.querySelector('.stage-summary')?.after(reviewLink);
      Object.defineProperty(window, '__stage03', {
        value: { inspect: scene.inspect },
        configurable: true,
      });
      import('./debug/modelInspection')
        .then(({ mountModelInspection }) => {
          if (!disconnected) removeInspection = mountModelInspection(scene);
        })
        .catch((cause) => console.error('几何检查面板加载失败', cause));
    }
  } catch (cause) {
    console.error('三维预览初始化失败', cause);
    showError('无法创建 WebGL 2 画布。请检查浏览器的图形加速设置，或换用支持 WebGL 2 的浏览器。');
  }

  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) cleanup();
  });
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      cleanup();
      Reflect.deleteProperty(window, '__stage03');
    });
}
