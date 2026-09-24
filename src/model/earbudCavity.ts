import { BufferGeometry, Float32BufferAttribute, Vector2, Vector3 } from 'three';
import { PRODUCT, mm } from '../config/product';
import { createEarbudShellGeometry } from './createEarbudShell';

export interface CavitySection {
  y: number;
  points: Vector2[];
}
export type CavityKind = 'body' | 'lid';
const segments = 96;
const clearance = 0.045; // 0.45 mm 展示装配间隙，不是官方公差。
let cache: Record<CavityKind, CavitySection[]> | undefined;

function hull(points: Vector2[]): Vector2[] {
  const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vector2, a: Vector2, b: Vector2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vector2[] = [],
    upper: Vector2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 1e-10) lower.pop();
    lower.push(p);
  }
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 1e-10) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function buildProfiles(): Record<CavityKind, CavitySection[]> {
  // 采样已确认 B 外曲面，不创建细节、不计算附件包围盒、不按三个轴拉伸。
  // C 特征均内收；后续回归仍以完整 C 显示网格和细网逐点/面采样核对。
  const proxy = createEarbudShellGeometry({ segments: 64, longitudinalSegments: 96 });
  try {
    const triangles: Vector3[][] = [];
    const p = proxy.getAttribute('position'),
      index = proxy.index!;
    const translation = new Vector3(0, mm(PRODUCT.assembly.seatY), 0);
    for (let i = 0; i < index.count; i += 3)
      triangles.push(
        [0, 1, 2].map((j) =>
          new Vector3().fromBufferAttribute(p, index.getX(i + j)).add(translation),
        ),
      );
    const hingeY = mm(PRODUCT.assembly.hingeY),
      hingeZ = mm(PRODUCT.assembly.hingeZ);
    // 在盒盖自身坐标中包络开盖初段的耳机位置，做真实几何避让而非增大测试容差。
    const sweptTriangles: Vector3[][] = [];
    for (let degrees = 0; degrees <= 60; degrees += 3) {
      const angle = (degrees * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle);
      for (const triangle of triangles) {
        const moved = triangle.map(
          (p) =>
            new Vector3(
              p.x,
              hingeY + c * (p.y - hingeY) - s * (p.z - hingeZ),
              hingeZ + s * (p.y - hingeY) + c * (p.z - hingeZ),
            ),
        );
        if (moved.some((p) => p.y >= mm(PRODUCT.case.seamHeight) - 0.05))
          sweptTriangles.push(moved);
      }
    }
    const slice = (y: number, source = triangles): Vector2[] => {
      const points: Vector2[] = [];
      // 用相邻采样层的薄带包络防止头部下缘在两环之间突然出现，线性墙体切入外壳。
      const band = 0.04;
      for (const triangle of source)
        for (let j = 0; j < 3; j++) {
          const a = triangle[j],
            b = triangle[(j + 1) % 3];
          if (Math.abs(a.y - y) <= band) points.push(new Vector2(a.x, a.z));
          for (const plane of [y - band, y + band]) {
            if ((a.y <= plane && b.y > plane) || (b.y <= plane && a.y > plane)) {
              const t = (plane - a.y) / (b.y - a.y);
              points.push(new Vector2(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t));
            }
          }
        }
      // 没有实物内胆尺寸：取程序化耳机截面的凸包并留间隙，形成保守收纳空间。
      const outline = hull(points);
      if (outline.length < 3) throw new Error(`无法生成 ${y} 高度的收纳槽`);
      const inflated = hull(
        outline.flatMap((p) =>
          Array.from({ length: 16 }, (_, i) =>
            p
              .clone()
              .add(
                new Vector2(
                  Math.cos((i * Math.PI) / 8),
                  Math.sin((i * Math.PI) / 8),
                ).multiplyScalar(clearance),
              ),
          ),
        ),
      );
      // 面积重心不随凸包顶点密度变化；直接平均顶点会造成各层极角原点抖动。
      const center = new Vector2();
      let doubledArea = 0;
      for (let i = 0; i < inflated.length; i++) {
        const a = inflated[i],
          b = inflated[(i + 1) % inflated.length],
          weight = a.cross(b);
        doubledArea += weight;
        center.x += (a.x + b.x) * weight;
        center.y += (a.y + b.y) * weight;
      }
      center.multiplyScalar(1 / (3 * doubledArea));
      return Array.from({ length: segments }, (_, i) => {
        const d = new Vector2(
          Math.cos((i / segments) * Math.PI * 2),
          Math.sin((i / segments) * Math.PI * 2),
        );
        let radius = 0;
        for (let j = 0; j < inflated.length; j++) {
          const a = inflated[j].clone().sub(center),
            edge = inflated[(j + 1) % inflated.length].clone().sub(inflated[j]);
          const denominator = d.cross(edge);
          if (Math.abs(denominator) < 1e-10) continue;
          const t = a.cross(edge) / denominator,
            v = a.cross(d) / denominator;
          if (t > 0 && v >= -1e-8 && v <= 1 + 1e-8) radius = Math.max(radius, t);
        }
        return center.clone().addScaledVector(d, radius);
      });
    };
    const bottom = mm(PRODUCT.assembly.seatY - PRODUCT.earbud.height / 2);
    const top = mm(PRODUCT.assembly.seatY + PRODUCT.earbud.height / 2);
    const seamLow = mm(PRODUCT.case.seamHeight - PRODUCT.case.seamGap / 2);
    const seamHigh = mm(PRODUCT.case.seamHeight + PRODUCT.case.seamGap / 2);
    const body: CavitySection[] = [],
      lid: CavitySection[] = [];
    // 顶盖与盒体分别密采样，墙体是这些同索引轮廓的线性连接。
    // 新壳头颈过渡较快：增加实际槽壁层数，避免三角形对角线切入耳机。
    // 不增大 clearance，也不改 insideCavity 的空间容差。
    for (let i = 0; i <= 108; i++) {
      const y = bottom + 0.001 + ((seamLow - bottom - 0.001) * i) / 108;
      body.push({ y, points: slice(y) });
    }
    const foot = body[0].points
      .reduce((sum, p) => sum.add(p), new Vector2())
      .multiplyScalar(1 / segments);
    body.unshift({ y: bottom - 0.09, points: [foot] });
    for (let i = 0; i <= 38; i++) {
      const y = seamHigh + ((top - 0.001 - seamHigh) * i) / 38;
      lid.push({ y, points: slice(y, sweptTriangles) });
    }
    const crown = lid
      .at(-1)!
      .points.reduce((sum, p) => sum.add(p), new Vector2())
      .multiplyScalar(1 / segments);
    lid.push({ y: top + 0.09, points: [crown] });
    return { body, lid };
  } finally {
    proxy.dispose();
  }
}

export function cavityProfile(kind: CavityKind, side: -1 | 1): CavitySection[] {
  cache ??= buildProfiles();
  return cache[kind].map((section) => ({
    y: section.y,
    points: (side === 1 ? section.points : [...section.points].reverse()).map(
      (p) => new Vector2(side * (p.x + mm(PRODUCT.assembly.seatX)), p.y),
    ),
  }));
}

export function cavityContourAt(profile: CavitySection[], y: number): Vector2[] {
  if (y <= profile[0].y) return profile[0].points;
  if (y >= profile.at(-1)!.y) return profile.at(-1)!.points;
  let i = 0;
  while (profile[i + 1].y < y) i++;
  const a = profile[i],
    b = profile[i + 1],
    t = (y - a.y) / (b.y - a.y);
  return Array.from({ length: segments * 2 }, (_, k) =>
    a.points[a.points.length === 1 ? 0 : (Math.floor(k / 2) + (k % 2)) % segments]
      .clone()
      .lerp(b.points[b.points.length === 1 ? 0 : Math.floor(k / 2)], t),
  );
}

/** 每个四边面有两片三角形；截面包含纵边和对角线的交点，不用双线性近似。 */
export function insideCavity(profile: CavitySection[], p: Vector3): boolean {
  if (p.y < profile[0].y || p.y > profile.at(-1)!.y) return false;
  let lo = 0,
    hi = profile.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (profile[mid].y <= p.y) lo = mid;
    else hi = mid;
  }
  const a = profile[lo],
    b = profile[hi],
    t = (p.y - a.y) / (b.y - a.y);
  const firstA = a.points[0],
    lastB = b.points[b.points.length === 1 ? 0 : segments - 1];
  let previousX = firstA.x + (lastB.x - firstA.x) * t;
  let previousZ = firstA.y + (lastB.y - firstA.y) * t;
  let inside = false;
  for (let k = 0; k < segments * 2; k++) {
    const j = k >> 1,
      ap = a.points[a.points.length === 1 ? 0 : (j + (k % 2)) % segments],
      bp = b.points[b.points.length === 1 ? 0 : j];
    const x = ap.x + (bp.x - ap.x) * t,
      z = ap.y + (bp.y - ap.y) * t;
    if (
      previousZ > p.z !== z > p.z &&
      p.x < previousX + ((x - previousX) * (p.z - previousZ)) / (z - previousZ)
    )
      inside = !inside;
    previousX = x;
    previousZ = z;
  }
  return inside;
}

export function createCavityGeometry(profile: CavitySection[]): BufferGeometry {
  const positions: number[] = [],
    indices: number[] = [],
    rows: number[][] = [];
  for (const section of profile)
    rows.push(
      section.points.map((p) => {
        const id = positions.length / 3;
        positions.push(p.x, section.y, p.y);
        return id;
      }),
    );
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i],
      b = rows[i + 1];
    for (let j = 0; j < segments; j++) {
      const n = (j + 1) % segments;
      if (a.length === 1) indices.push(a[0], b[n], b[j]);
      else if (b.length === 1) indices.push(a[j], a[n], b[0]);
      else indices.push(a[j], a[n], b[j], a[n], b[n], b[j]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}
