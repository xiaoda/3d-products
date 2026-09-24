import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import type { Surface } from './geometry';

/** 经官网展示参考校准的低维参数曲面，不是从外部模型复制的网格。u 沿耳柄→颈部→出音端。 */
const rings = [
  // u, cx, cy, cz, 横向半径, 纵向半径, 倾角°, 截面不对称量, 偏航角°
  [0.0, 0.36, -1.51, -0.6, 0.0, 0.0, 0.0, 0.0, 20.0],
  [0.008, 0.36, -1.5, -0.6, 0.13, 0.12, 0.0, 0.0, 20.0],
  [0.025, 0.36, -1.46, -0.6, 0.26, 0.23, 0.0, 0.0, 20.0],
  [0.045, 0.36, -1.38, -0.6, 0.3, 0.265, 0.0, 0.0, 20.0],
  [0.15, 0.36, -0.85, -0.6, 0.305, 0.27, 0.0, 0.0, 20.0],
  [0.28, 0.36, -0.25, -0.59, 0.31, 0.28, 0.0, 0.0, 20.0],
  [0.4, 0.35, 0.25096, -0.56043, 0.2845, 0.39232, 5, 0.01, 4.48115],
  [0.48, 0.32836, 0.5032, -0.50913, 0.30079, 0.40426, 27.28863, 0.025, 8.89874],
  [0.57, 0.23771, 0.77239, -0.18026, 0.39399, 0.57325, 63.17444, 0.05, 11.86509],
  [0.66, 0.17538, 0.8609, 0.2827, 0.65925, 0.70506, 92.47574, 0.08, 20.87721],
  [0.76, 0.08598, 0.79268, 0.50273, 0.68844, 0.77343, 101.48937, 0.09, 30.4783],
  [0.86, -0.36272, 0.52162, 0.65127, 0.44433, 0.71587, 103.72843, 0.065, 62.1585],
  [0.94, -0.63481, 0.34138, 0.50619, 0.10387, 0.45458, 111.23172, 0.035, 93.57698],
  [0.985, -0.7, 0.24, 0.635, 0.09, 0.12, 112.0, 0.0, 80.0],
  [1.0, -0.73, 0.22, 0.63, 0.0, 0.0, 112.0, 0.0, 80.0],
] as const;

// 各标量保形三次插值；提前缓存斜率，凹槽法线重复采样时不重新建曲线。
const tangents = rings.map((row, i) =>
  row.map((_, key) => {
    if (!key) return 0;
    const slope = (j: number) =>
      (rings[j + 1][key] - rings[j][key]) / (rings[j + 1][0] - rings[j][0]);
    if (!i) return slope(0);
    if (i === rings.length - 1) return slope(i - 1);
    const before = slope(i - 1),
      after = slope(i);
    if (before * after <= 0) return 0;
    const left = row[0] - rings[i - 1][0],
      right = rings[i + 1][0] - row[0];
    const w1 = 2 * right + left,
      w2 = right + 2 * left;
    return (w1 + w2) / (w1 / before + w2 / after);
  }),
);

export const earbudSurface: Surface = (parameter, angle) => {
  const u = Math.max(0, Math.min(1, parameter));
  let i = 0;
  while (i < rings.length - 2 && rings[i + 1][0] < u) i++;
  const a = rings[i],
    b = rings[i + 1],
    h = b[0] - a[0],
    t = (u - a[0]) / h;
  const at = (key: number) =>
    (2 * t ** 3 - 3 * t ** 2 + 1) * a[key] +
    (t ** 3 - 2 * t ** 2 + t) * h * tangents[i][key] +
    (-2 * t ** 3 + 3 * t ** 2) * b[key] +
    (t ** 3 - t ** 2) * h * tangents[i + 1][key];
  const yaw = (at(8) * Math.PI) / 180;
  const forward = new Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
  const lateral = new Vector3(forward.z, 0, -forward.x);
  const tilt = (at(6) * Math.PI) / 180,
    s = Math.sin(angle);
  const transverse = at(4) * Math.cos(angle) * (1 + at(7) * s);
  const longitudinal = at(5) * s;
  return new Vector3(at(1), at(2), at(3))
    .addScaledVector(lateral, transverse)
    .addScaledVector(forward, longitudinal * Math.cos(tilt))
    .add(new Vector3(0, -longitudinal * Math.sin(tilt), 0));
};

/** 参数环沿弯曲主轴分布；极点也由同一曲面计算，不能用旧的水平 y 端点。 */
export function createEarbudGeometry(
  surface: Surface = earbudSurface,
  options: { detailSamples?: readonly number[]; segments?: number; subdivisions?: number } = {},
): BufferGeometry {
  const { segments = 160, subdivisions = 10, detailSamples = [] } = options;
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [],
    rows: number[][] = [];
  const us: number[] = [];
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < subdivisions; j++)
      us.push(rings[i][0] + ((rings[i + 1][0] - rings[i][0]) * j) / subdivisions);
  us.push(1);
  us.push(...detailSamples.filter((u) => u > 0 && u < 1));
  us.sort((a, b) => a - b);
  for (let i = us.length - 1; i > 0; i--) if (us[i] - us[i - 1] < 1e-6) us.splice(i, 1);
  const vertex = (u: number, j: number) => {
    const id = positions.length / 3;
    positions.push(...surface(u, (j / segments) * Math.PI * 2).toArray());
    uv.push(j / segments, u);
    return id;
  };
  for (const u of us)
    rows.push(
      u === 0 || u === 1
        ? [vertex(u, 0)]
        : Array.from({ length: segments }, (_, j) => vertex(u, j)),
    );
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i],
      b = rows[i + 1];
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      if (a.length === 1) indices.push(a[0], b[j], b[next]);
      else if (b.length === 1) indices.push(a[j], b[0], a[next]);
      else indices.push(a[j], b[j], a[next], a[next], b[j], b[next]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}
