import { Box3, Quaternion, Vector3 } from 'three';
import { ease, mix } from '../interaction/state';

export interface CameraFrame {
  position: Vector3;
  target: Vector3;
}
/** 用球面方向过渡，正面到背面也不会直线穿过产品。 */
export function interpolateCamera(
  from: CameraFrame,
  to: CameraFrame,
  progress: number,
): CameraFrame {
  const t = ease(progress);
  const a = from.position.clone().sub(from.target),
    b = to.position.clone().sub(to.target);
  const distance = mix(a.length(), b.length(), t);
  a.normalize();
  b.normalize();
  const turn = new Quaternion().setFromUnitVectors(a, b);
  const direction = a.applyQuaternion(new Quaternion().slerp(turn, t));
  const target = from.target.clone().lerp(to.target, t);
  return { target, position: target.clone().addScaledVector(direction, distance) };
}

export function filmDirection(yaw: number, elevation: number) {
  return new Vector3(
    Math.sin(yaw) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(yaw) * Math.cos(elevation),
  );
}

/** 按当前包围盒投影留安全边距，竖屏不再被包围球的长边过度缩小。 */
export function frameFilmBox(
  box: Box3,
  direction: Vector3,
  aspect: number,
  fov: number,
): CameraFrame {
  const target = box.getCenter(new Vector3());
  const right = new Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const tanY = Math.tan((fov * Math.PI) / 360),
    tanX = tanY * aspect;
  let distance = 0;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = new Vector3(x, y, z).sub(target),
          depth = p.dot(direction);
        distance = Math.max(
          distance,
          (Math.abs(p.dot(right)) * 1.25) / tanX + depth,
          (Math.abs(p.dot(up)) * 1.35) / tanY + depth,
        );
      }
  return { target, position: target.clone().addScaledVector(direction, distance) };
}
