import type { ProductScene } from '../scene/createScene';
import type { ProductPose } from '../model/createProduct';

/** 只在 Vite 开发模式加载；静态姿态检查不等于第四阶段的正式动画交互。 */
export function mountModelInspection(scene: ProductScene): () => void {
  const panel = document.createElement('section');
  panel.className = 'panel-section inspection-panel';
  panel.setAttribute('aria-label', '几何开发检查面板');
  panel.innerHTML = `<h3>几何检查 <span class="inspection-tag">开发模式</span></h3>
    <div class="inspection-poses" role="group" aria-label="静态装配姿态"><button type="button" data-pose="closed">闭合</button><button type="button" data-pose="open">开盖</button><button type="button" data-pose="separated">分开展示</button></div>
    <label class="angle-label" for="lid-angle">铰链角度 <output id="lid-angle-output" for="lid-angle">110°</output></label><input id="lid-angle" type="range" min="0" max="110" step="1" value="110" aria-label="静态盒盖角度">
    <div class="inspection-options"><label><input id="inspect-wire" type="checkbox">线框</label><label><input id="inspect-gray" type="checkbox">统一灰模</label><label><input id="inspect-empty" type="checkbox">隐藏耳机</label></div><p class="inspection-note">立即切换静态姿态，用于检查装配；不含开合动画。</p>`;
  document.querySelector('.stage-summary')?.after(panel);
  const abort = new AbortController(),
    options = { signal: abort.signal };
  const slider = panel.querySelector<HTMLInputElement>('#lid-angle')!;
  const wire = panel.querySelector<HTMLInputElement>('#inspect-wire')!,
    gray = panel.querySelector<HTMLInputElement>('#inspect-gray')!,
    empty = panel.querySelector<HTMLInputElement>('#inspect-empty')!;
  const refresh = () => {
    const s = scene.inspect();
    panel
      .querySelectorAll<HTMLButtonElement>('[data-pose]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pose === s.pose)));
    slider.value = String(Math.round(s.lidAngle));
    panel.querySelector('output')!.textContent = `${Math.round(s.lidAngle)}°`;
    wire.checked = s.wireframe;
    gray.checked = s.uniformGray;
    empty.checked = s.hideEarbuds;
  };
  panel
    .querySelectorAll<HTMLButtonElement>('[data-pose]')
    .forEach((b) =>
      b.addEventListener('click', () => scene.setPose(b.dataset.pose as ProductPose), options),
    );
  slider.addEventListener('input', () => scene.setLidAngle(Number(slider.value)), options);
  wire.addEventListener(
    'change',
    () => scene.setInspectionMaterial({ wireframe: wire.checked }),
    options,
  );
  gray.addEventListener(
    'change',
    () => scene.setInspectionMaterial({ uniformGray: gray.checked }),
    options,
  );
  empty.addEventListener('change', () => scene.setHideEarbuds(empty.checked), options);
  document.querySelector('#viewport')?.addEventListener('modelchange', refresh, options);
  refresh();
  return () => {
    abort.abort();
    panel.remove();
  };
}
