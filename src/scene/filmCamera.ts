import { Box3, Vector3 } from 'three';
import type { ProductModel } from '../model/createProduct';
import { wipeOffset, type FilmSample } from '../interaction/films';
import { filmDirection, frameFilmBox } from './cameraMotion';
import { mix } from '../interaction/state';

/** 远景按包围盒留边；微距有意裁切产品，不用“完整入镜”约束抵消推镜。 */
export function cinematicCamera(
  product: Pick<ProductModel, 'root' | 'parts'>,
  s: FilmSample,
  aspect: number,
  fov: number,
) {
  const cue = s.camera;
  const direction = filmDirection(cue.yaw, cue.elevation);
  const bounds = new Box3().setFromObject(product.root);
  // 前景擦镜物体不能参与远景自动缩放，否则耳机一靠近镜头，镜头反而后退。
  const base = new Box3().setFromObject(product.parts.caseAssembly);
  base.union(new Box3().setFromObject(product.parts.rightEarbud));
  const leftBounds = new Box3().setFromObject(product.parts.leftEarbud);
  if (s.id === 'reveal') leftBounds.translate(new Vector3(...wipeOffset(s.wipe)).negate());
  base.union(leftBounds);
  const frame = frameFilmBox(s.id === 'reveal' ? base : bounds, direction, aspect, fov);
  const edge = product.parts.caseAssembly.localToWorld(new Vector3(1.35, 4.04, 0.6));
  const head = product.parts.rightEarbud.localToWorld(
    new Vector3(0.4 * cue.stem, mix(0.9, -1.2, cue.stem), -0.45 * cue.stem),
  );
  const target = frame.target.clone().lerp(edge, cue.edge).lerp(head, cue.ear);
  const macro = Math.max(cue.edge, cue.ear);
  const fullDistance = frame.position.distanceTo(frame.target);
  // 横屏保持同等垂直微距尺度，竖屏约有 2–2.3 场景单位的画面宽度。
  const distance = mix(fullDistance, cue.close, macro);
  return {
    target,
    position: target.clone().addScaledVector(direction, distance),
    up: new Vector3(0, 1, 0).applyAxisAngle(direction, cue.roll),
    macro,
  };
}
