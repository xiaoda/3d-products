import { BufferGeometry, Float32BufferAttribute, Vector3, Vector4 } from 'three';
import { NURBSSurface } from 'three/addons/curves/NURBSSurface.js';
import { mm } from '../config/product';
import { EAR_BARE_SHELL_CONTROLS, SHELL_COLUMNS, SHELL_KNOTS } from './earbudDefinition';

const aroundKnots = Array.from({ length: SHELL_COLUMNS + 7 }, (_, i) => i);
const controls = EAR_BARE_SHELL_CONTROLS.map((row) =>
  [...row, ...row.slice(0, 3)].map(([x, y, z]) => new Vector4(x, y, z, 1)),
);
const surface = new NURBSSurface(3, 3, [...SHELL_KNOTS], aroundKnots, controls);

function validateParameters(u: number, v: number) {
  if (!Number.isFinite(u) || u < 0 || u > 1 || !Number.isFinite(v))
    throw new RangeError('裸壳曲面参数必须有限，u 须位于 0–1');
}

/** u 从柄底到头顶；v 绕整个控制网格一周。不按椭圆半径、旋转角生成截面。 */
export function sampleEarbudShell(u: number, v: number, target = new Vector3()): Vector3 {
  validateParameters(u, v);
  const wrapped = ((v % 1) + 1) % 1;
  // NURBSSurface 将参数映射到完整节点区间；周期曲面的有效区间是 [3, n + 3]。
  surface.getPoint(u, (3 + wrapped * SHELL_COLUMNS) / (SHELL_COLUMNS + 6), target);
  return target.multiplyScalar(mm(1));
}

export function shellNormal(u: number, v: number, target = new Vector3()): Vector3 {
  validateParameters(u, v);
  if (u === 0) return target.set(0, -1, 0);
  if (u === 1) return target.set(0, 1, 0);
  const e = 1e-5;
  const longitudinal = sampleEarbudShell(Math.min(1, u + e), v).sub(
    sampleEarbudShell(Math.max(0, u - e), v),
  );
  const transverse = sampleEarbudShell(u, v + e).sub(sampleEarbudShell(u, v - e));
  return target.crossVectors(longitudinal, transverse).normalize();
}

export interface EarbudShellOptions {
  segments?: number;
  longitudinalSegments?: number;
}

/** 单个封闭外壳。所有内部区域、周期接缝共享顶点，端部各使用一个极点。 */
export function createEarbudShellGeometry(options: EarbudShellOptions = {}): BufferGeometry {
  const { segments = 128, longitudinalSegments = 192 } = options;
  if (
    !Number.isInteger(segments) ||
    segments < 16 ||
    segments > 512 ||
    !Number.isInteger(longitudinalSegments) ||
    longitudinalSegments < 24 ||
    longitudinalSegments > 512
  )
    throw new RangeError('裸壳网格细分超出允许范围');
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const rows: number[][] = [];
  const point = new Vector3(),
    normal = new Vector3();
  for (let i = 0; i <= longitudinalSegments; i++) {
    const u = i / longitudinalSegments;
    const count = i === 0 || i === longitudinalSegments ? 1 : segments;
    const row: number[] = [];
    for (let j = 0; j < count; j++) {
      const v = j / segments;
      sampleEarbudShell(u, v, point);
      shellNormal(u, v, normal);
      row.push(positions.length / 3);
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(v, u);
    }
    rows.push(row);
  }
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
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    model: 'earbud-bare-shell-review',
    units: '10mm',
    normalizedByBounds: false,
  };
  return geometry;
}
