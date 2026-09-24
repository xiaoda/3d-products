import {
  BufferGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from 'three';

export interface Section {
  y: number;
  rx: number;
  rz: number;
  cx: number;
  cz: number;
}
export type Surface = (y: number, angle: number) => Vector3;
export interface LoftOptions {
  segments?: number;
  subdivisions?: number;
  exponent?: number;
  capStart?: boolean;
  capEnd?: boolean;
  inward?: boolean;
  surface?: Surface;
}

const fields = ['rx', 'rz', 'cx', 'cz'] as const;
type Field = (typeof fields)[number];

/** 保形三次 Hermite 插值：相邻半径单调时不会产生过冲或负半径。 */
export function sampleProfile(profile: readonly Section[], y: number): Section {
  const end = profile.length - 1;
  if (y <= profile[0].y) return { ...profile[0] };
  if (y >= profile[end].y) return { ...profile[end] };
  let i = 0;
  while (profile[i + 1].y < y) i++;
  const a = profile[i],
    b = profile[i + 1];
  const h = b.y - a.y,
    t = (y - a.y) / h;
  const tangent = (at: number, key: Field) => {
    const slope = (n: number) =>
      (profile[n + 1][key] - profile[n][key]) / (profile[n + 1].y - profile[n].y);
    if (at === 0) return slope(0);
    if (at === end) return slope(end - 1);
    const before = slope(at - 1),
      after = slope(at);
    if (before * after <= 0) return 0;
    const left = profile[at].y - profile[at - 1].y,
      right = profile[at + 1].y - profile[at].y;
    const w1 = 2 * right + left,
      w2 = right + 2 * left;
    return (w1 + w2) / (w1 / before + w2 / after);
  };
  const result: Section = { y, rx: 0, rz: 0, cx: 0, cz: 0 };
  for (const key of fields) {
    result[key] =
      (2 * t ** 3 - 3 * t ** 2 + 1) * a[key] +
      (t ** 3 - 2 * t ** 2 + t) * h * tangent(i, key) +
      (-2 * t ** 3 + 3 * t ** 2) * b[key] +
      (t ** 3 - t ** 2) * h * tangent(i + 1, key);
  }
  return result;
}

export function superellipse(
  angle: number,
  rx: number,
  rz: number,
  exponent = 2,
): [number, number] {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return [
    Math.sign(c) * Math.abs(c) ** (2 / exponent) * rx,
    Math.sign(s) * Math.abs(s) ** (2 / exponent) * rz,
  ];
}

export function profileSurface(profile: readonly Section[], exponent = 2): Surface {
  return (y, angle) => {
    const section = sampleProfile(profile, y);
    const [x, z] = superellipse(angle, section.rx, section.rz, exponent);
    return new Vector3(section.cx + x, y, section.cz + z);
  };
}

export function surfaceNormal(surface: Surface, y: number, angle: number): Vector3 {
  const du = surface(y, angle + 0.0001).sub(surface(y, angle - 0.0001));
  const dv = surface(y + 0.0001, angle).sub(surface(y - 0.0001, angle));
  return dv.cross(du).normalize();
}

/** 共享顶点的闭环放样，零半径端点使用单个极点，不生成重复零面积三角形。 */
export function createLoftGeometry(
  profile: readonly Section[],
  options: LoftOptions = {},
): BufferGeometry {
  const {
    segments = 72,
    subdivisions = 6,
    exponent = 2,
    capStart = true,
    capEnd = true,
    inward = false,
  } = options;
  if (
    profile.length < 2 ||
    !Number.isInteger(segments) ||
    segments < 8 ||
    subdivisions < 1 ||
    !Number.isInteger(subdivisions)
  )
    throw new RangeError('无效放样参数');
  profile.forEach((s, i) => {
    if (
      ![s.y, s.rx, s.rz, s.cx, s.cz].every(Number.isFinite) ||
      s.rx < 0 ||
      s.rz < 0 ||
      (i > 0 && s.y <= profile[i - 1].y)
    )
      throw new RangeError('截面必须有序且半径有效');
  });
  const surface = options.surface ?? profileSurface(profile, exponent);
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const rows: number[][] = [];
  const first = profile[0].y,
    last = profile.at(-1)!.y;
  const vertex = (p: Vector3, u: number, v: number) => {
    const id = positions.length / 3;
    positions.push(p.x, p.y, p.z);
    uv.push(u, v);
    return id;
  };
  const ys: number[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < subdivisions; j++)
      ys.push(profile[i].y + ((profile[i + 1].y - profile[i].y) * j) / subdivisions);
  }
  ys.push(last);
  for (const y of ys) {
    const s = sampleProfile(profile, y),
      v = (y - first) / (last - first);
    if (s.rx < 1e-8 && s.rz < 1e-8) rows.push([vertex(new Vector3(s.cx, y, s.cz), 0.5, v)]);
    else
      rows.push(
        Array.from({ length: segments }, (_, j) =>
          vertex(surface(y, (j / segments) * Math.PI * 2), j / segments, v),
        ),
      );
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
  for (const [rowIndex, enabled] of [
    [0, capStart],
    [rows.length - 1, capEnd],
  ] as const) {
    const row = rows[rowIndex];
    if (!enabled || row.length === 1) continue;
    const s = sampleProfile(profile, ys[rowIndex]);
    const center = vertex(new Vector3(s.cx, s.y, s.cz), 0.5, rowIndex === 0 ? 0 : 1);
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      if (rowIndex === 0) indices.push(center, row[j], row[next]);
      else indices.push(center, row[next], row[j]);
    }
  }
  if (inward)
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

export function sectionContour(section: Section, exponent = 2, segments = 72): Vector2[] {
  return Array.from({ length: segments }, (_, i) => {
    const [x, z] = superellipse((i / segments) * Math.PI * 2, section.rx, section.rz, exponent);
    return new Vector2(section.cx + x, section.cz + z);
  });
}

/** 带真实孔洞的水平片，不用深色贴片替代收纳槽。输入坐标为 x,z。 */
export function horizontalPlate(
  contour: Vector2[],
  holes: Vector2[][],
  y: number,
  up = true,
): BufferGeometry {
  const shape = new Shape(contour.map((p) => new Vector2(p.x, -p.y)));
  for (const hole of holes) shape.holes.push(new Path(hole.map((p) => new Vector2(p.x, -p.y))));
  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  if (!up) {
    const index = geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
    geometry.computeVertexNormals();
  }
  return geometry;
}

export function section(y: number, rx: number, rz: number, cx = 0, cz = 0): Section {
  return { y, rx, rz, cx, cz };
}
