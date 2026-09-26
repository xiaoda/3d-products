import { PRODUCT } from '../config/product';
import type { ProductScene } from '../scene/createScene';
import type { ProductPose } from '../model/createProduct';
import { GEOMETRY_VIEWS, type GeometryView } from '../scene/geometryViews';

/** 只在 Vite 开发模式加载；静态姿态检查不等于第四阶段的正式动画交互。 */
export function mountModelInspection(scene: ProductScene): () => void {
  const panel = document.createElement('section');
  panel.className = 'panel-section inspection-panel';
  panel.setAttribute('aria-label', '几何开发检查面板');
  panel.innerHTML = `<h3>几何检查 <span class="inspection-tag">开发模式</span></h3>
    <div class="inspection-poses" role="group" aria-label="静态装配姿态"><button type="button" data-pose="closed">闭合</button><button type="button" data-pose="open">开盖</button><button type="button" data-pose="separated">分开展示</button></div>
    <label class="angle-label" for="lid-angle">铰链角度 <output id="lid-angle-output" for="lid-angle">${PRODUCT.assembly.openAngle}°</output></label><input id="lid-angle" type="range" min="0" max="${PRODUCT.assembly.openAngle}" step="1" value="${PRODUCT.assembly.openAngle}" aria-label="静态盒盖角度">
    <div class="inspection-options"><label><input id="inspect-wire" type="checkbox">线框</label><label><input id="inspect-gray" type="checkbox">统一灰模</label><label><input id="inspect-stripes" type="checkbox">条带高光</label><label><input id="inspect-empty" type="checkbox">隐藏耳机</label></div>
    <div class="inspection-poses inspection-directions" role="group" aria-label="单耳正交轮廓检查">${Object.entries(
      GEOMETRY_VIEWS,
    )
      .map(
        ([key, value]) =>
          `<button type="button" data-geometry="${key}">单耳${value.label}</button>`,
      )
      .join('')}</div>
    <div class="inspection-poses" role="group" aria-label="盒盖正交轮廓检查"><button type="button" data-case-geometry="top">盒盖正交顶视</button><button type="button" data-case-geometry="front">盒盖正交正视</button></div>
    <div class="inspection-poses" role="group" aria-label="收纳装配正交检查"><button type="button" data-seating-geometry="front">收纳正交正视</button><button type="button" data-seating-geometry="top">收纳正交顶视</button></div>
    <p class="inspection-note">收纳入口保留实际装配朝向，可隐藏耳机检查槽口；单耳入口清除收纳旋转。线框优先于条带、灰模。本面板为静态检查，正式动画使用底部播放与操作入口。</p>`;
  document.querySelector('#debug-panel-host')?.append(panel);
  const abort = new AbortController(),
    options = { signal: abort.signal };
  const slider = panel.querySelector<HTMLInputElement>('#lid-angle')!;
  const wire = panel.querySelector<HTMLInputElement>('#inspect-wire')!,
    gray = panel.querySelector<HTMLInputElement>('#inspect-gray')!,
    stripes = panel.querySelector<HTMLInputElement>('#inspect-stripes')!,
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
    stripes.checked = s.stripes;
    empty.checked = s.hideEarbuds;
    panel
      .querySelectorAll<HTMLButtonElement>('[data-geometry]')
      .forEach((b) =>
        b.setAttribute(
          'aria-pressed',
          String(s.focus === 'earbud' && b.dataset.geometry === s.geometryView),
        ),
      );
    panel
      .querySelectorAll<HTMLButtonElement>('[data-seating-geometry]')
      .forEach((b) =>
        b.setAttribute(
          'aria-pressed',
          String(s.focus === 'product' && b.dataset.seatingGeometry === s.geometryView),
        ),
      );
    panel
      .querySelectorAll<HTMLButtonElement>('[data-case-geometry]')
      .forEach((b) =>
        b.setAttribute(
          'aria-pressed',
          String(s.focus === 'case' && b.dataset.caseGeometry === s.geometryView),
        ),
      );
  };
  panel
    .querySelectorAll<HTMLButtonElement>('[data-pose]')
    .forEach((b) =>
      b.addEventListener('click', () => scene.setPose(b.dataset.pose as ProductPose), options),
    );
  slider.addEventListener('input', () => scene.setLidAngle(Number(slider.value)), options);
  panel
    .querySelectorAll<HTMLButtonElement>('[data-geometry]')
    .forEach((b) =>
      b.addEventListener(
        'click',
        () => scene.setGeometryView(b.dataset.geometry as GeometryView),
        options,
      ),
    );
  panel
    .querySelectorAll<HTMLButtonElement>('[data-seating-geometry]')
    .forEach((b) =>
      b.addEventListener(
        'click',
        () => scene.setGeometryView(b.dataset.seatingGeometry as 'top' | 'front', 'seating'),
        options,
      ),
    );
  panel
    .querySelectorAll<HTMLButtonElement>('[data-case-geometry]')
    .forEach((b) =>
      b.addEventListener(
        'click',
        () => scene.setGeometryView(b.dataset.caseGeometry as 'top' | 'front', 'case'),
        options,
      ),
    );
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
  stripes.addEventListener(
    'change',
    () => scene.setInspectionMaterial({ stripes: stripes.checked }),
    options,
  );
  document.querySelector('#viewport')?.addEventListener('modelchange', refresh, options);
  refresh();
  return () => {
    abort.abort();
    panel.remove();
  };
}
