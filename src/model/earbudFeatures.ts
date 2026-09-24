import { Vector3 } from 'three';
import { sampleEarbudShell, shellNormal } from './createEarbudShell';
import type { MaterialRole } from './materials';

export interface EarFeature {
  readonly id: string;
  readonly label: string;
  readonly region: string;
  readonly u: number;
  readonly v: number;
  readonly axis: readonly [number, number, number];
  /** 局部切平面投影中的外口长 / 短轴，mm；不是制造测量值。 */
  readonly size: readonly [number, number];
  readonly depth: number;
  readonly innerScale: number;
  readonly shape: 'ellipse' | 'capsule';
  readonly role: MaterialRole;
  readonly rimRole?: MaterialRole;
  readonly grille: boolean;
}

/** B 已确认主壳上的独立锚点；参照中心投影后重新定位，不复用旧截面的 u/angle。 */
export const EAR_FEATURES: readonly EarFeature[] = (
  [
    {
      id: 'speaker',
      label: '出音口',
      region: '出音端',
      u: 0.704081774,
      v: 0.35423544,
      axis: [-0.294881, 0.952689, -0.073676],
      size: [9.4, 6.0],
      depth: 1.8,
      innerScale: 0.8,
      shape: 'ellipse',
      role: 'grille',
      grille: true,
    },
    {
      id: 'sensor',
      label: '佩戴传感器',
      region: '头部前侧',
      u: 0.734617352,
      v: 0.245764732,
      axis: [0.810186, 0.582378, -0.066599],
      size: [3.65, 2.4],
      depth: 0.07,
      innerScale: 0.95,
      shape: 'capsule',
      role: 'sensor',
      grille: false,
    },
    {
      id: 'outerMic',
      label: '背侧麦克风',
      region: '背肩',
      u: 0.67012395,
      v: 0.826301157,
      axis: [-0.237435, 0.820613, 0.519825],
      size: [8.4, 3.6],
      depth: 0.3,
      innerScale: 0.88,
      shape: 'capsule',
      role: 'grille',
      grille: true,
    },
    {
      id: 'vent',
      label: '顶部通气口',
      region: '冠面前侧',
      u: 0.901580408,
      v: 0.132055297,
      axis: [-0.916075, 0.388171, -0.100644],
      size: [7.8, 2.8],
      depth: 0.25,
      innerScale: 0.86,
      shape: 'capsule',
      role: 'grille',
      grille: true,
    },
    {
      id: 'bottomMic',
      label: '柄底麦克风',
      region: '耳柄底部背侧',
      u: 0.116929337,
      v: 0.816245943,
      axis: [-0.914452, 0.005514, -0.404656],
      size: [2.8, 1.4],
      depth: 0.6,
      innerScale: 0.65,
      shape: 'capsule',
      role: 'grille',
      rimRole: 'contact',
      grille: true,
    },
    {
      id: 'contactFront',
      label: '前侧充电触点',
      region: '耳柄底部前侧',
      u: 0.117664218,
      v: 0.146135777,
      axis: [-0.767887, 0.002923, 0.640579],
      size: [2.8, 1.85],
      depth: 0.025,
      innerScale: 0.94,
      shape: 'ellipse',
      role: 'contact',
      grille: false,
    },
    {
      id: 'contactInner',
      label: '内侧充电触点',
      region: '耳柄底部内侧',
      u: 0.120380819,
      v: 0.488135949,
      axis: [0.037163, 0.004598, 0.999299],
      size: [2.8, 1.85],
      depth: 0.025,
      innerScale: 0.94,
      shape: 'ellipse',
      role: 'contact',
      grille: false,
    },
  ] satisfies EarFeature[]
).map((f) => Object.freeze(f));

const cache = new Map<EarFeature, { center: Vector3; normal: Vector3; x: Vector3; y: Vector3 }>();
export function featureFrame(f: EarFeature) {
  let frame = cache.get(f);
  if (!frame) {
    const center = sampleEarbudShell(f.u, f.v),
      normal = shellNormal(f.u, f.v);
    const x = new Vector3(...f.axis)
      .addScaledVector(normal, -new Vector3(...f.axis).dot(normal))
      .normalize();
    frame = { center, normal, x, y: normal.clone().cross(x).normalize() };
    cache.set(f, frame);
  }
  // 不向调用方泄露内部可变向量。
  return {
    center: frame.center.clone(),
    normal: frame.normal.clone(),
    x: frame.x.clone(),
    y: frame.y.clone(),
  };
}

export function featureDistance2D(f: EarFeature, x: number, y: number): number {
  const a = f.size[0] / 2,
    b = f.size[1] / 2;
  return f.shape === 'capsule'
    ? Math.hypot(Math.max(Math.abs(x) - a + b, 0), y) - b
    : (Math.hypot(x / a, y / b) - 1) * b;
}

/** 与中心切平面同向的局部区域；排除投影在孔内但处于壳背面的顶点。 */
export function featureDistance(f: EarFeature, point: Vector3, normal?: Vector3): number {
  const frame = cache.get(f) ?? (featureFrame(f), cache.get(f)!);
  if (normal && normal.dot(frame.normal) <= 0.1) return 100;
  const d = point.clone().sub(frame.center).multiplyScalar(10);
  if (Math.abs(d.dot(frame.normal)) > Math.max(1.2, f.size[0] / 2)) return 100;
  return featureDistance2D(f, d.dot(frame.x), d.dot(frame.y));
}

/** 局部切平面毫米坐标 → 原曲面，Newton 求解；没有用平面贴片悬浮覆盖曲面。 */
export function featurePoint(
  f: EarFeature,
  x: number,
  y: number,
  offsetMm = 0,
  seed?: { x: number; y: number },
): Vector3 {
  if (![x, y, offsetMm].every(Number.isFinite)) throw new RangeError('特征坐标必须有限');
  const frame = cache.get(f) ?? (featureFrame(f), cache.get(f)!);
  let u = seed?.y ?? f.u,
    v = seed?.x ?? f.v;
  const e = 1e-5;
  for (let i = 0; i < 18; i++) {
    const p = sampleEarbudShell(u, v),
      d = p.clone().sub(frame.center).multiplyScalar(10);
    const dx = x - d.dot(frame.x),
      dy = y - d.dot(frame.y);
    // 局部法向直线内收；深孔若沿每点不同法线缩进，会在强曲率处翻折。
    if (Math.hypot(dx, dy) < 1e-7) return p.addScaledVector(frame.normal, offsetMm / 10);
    const du = sampleEarbudShell(Math.min(0.999999, u + e), v)
      .sub(sampleEarbudShell(Math.max(0.000001, u - e), v))
      .multiplyScalar(5 / e);
    const dv = sampleEarbudShell(u, v + e)
      .sub(sampleEarbudShell(u, v - e))
      .multiplyScalar(5 / e);
    const a = du.dot(frame.x),
      b = dv.dot(frame.x),
      c = du.dot(frame.y),
      d2 = dv.dot(frame.y);
    const determinant = a * d2 - b * c;
    if (Math.abs(determinant) < 1e-8) break;
    const changeU = (dx * d2 - b * dy) / determinant;
    const changeV = (a * dy - dx * c) / determinant;
    // 冠面附近参数退化，限制 Newton 步长并回溯，避免一步跳过极点。
    let scale = Math.min(
      1,
      0.06 / Math.max(0.000001, Math.abs(changeU)),
      0.15 / Math.max(0.000001, Math.abs(changeV)),
    );
    for (let backtrack = 0; backtrack < 12; backtrack++) {
      const nextU = Math.max(0.000001, Math.min(0.999999, u + changeU * scale)),
        nextV = v + changeV * scale;
      const delta = sampleEarbudShell(nextU, nextV).sub(frame.center).multiplyScalar(10);
      if (Math.hypot(x - delta.dot(frame.x), y - delta.dot(frame.y)) < Math.hypot(dx, dy)) {
        u = nextU;
        v = nextV;
        break;
      }
      scale *= 0.5;
    }
  }
  // 边界种子靠近收束极点时可能落在病态参数区，改由该特征的固定中心求解一次。
  if (seed) return featurePoint(f, x, y, offsetMm);
  throw new RangeError(`特征 ${f.id} 超出可逆局部曲面范围`);
}
