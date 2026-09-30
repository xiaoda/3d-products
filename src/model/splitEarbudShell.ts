import { BufferGeometry, Float32BufferAttribute, Plane, Vector3 } from 'three';

interface Vertex {
  p: Vector3;
  n: Vector3;
}
interface Bucket {
  p: number[];
  n: number[];
}

/** 原表面逐三角形精确裁切。内壁采用法线偏移，是示意壳厚，不是工程实体偏置。 */
export function splitHollowShell(
  source: BufferGeometry,
  plane: Plane,
  thickness: number,
  interiorMaterial: number,
): [BufferGeometry, BufferGeometry] {
  if (!Number.isFinite(thickness) || thickness <= 0 || thickness > 0.15)
    throw new RangeError('示意壳厚须在 0–1.5 mm 之间');
  if (Math.abs(plane.normal.length() - 1) > 1e-6 || !Number.isFinite(plane.constant))
    throw new RangeError('裁切面须有效且归一化');
  const position = source.getAttribute('position'),
    normal = source.getAttribute('normal');
  if (!position || !normal) throw new Error('需要位置和法线');
  const index = source.index;
  const count = index?.count ?? position.count;
  const read = (i: number): Vertex => {
    const j = index ? index.getX(i) : i;
    return {
      p: new Vector3().fromBufferAttribute(position, j),
      n: new Vector3().fromBufferAttribute(normal, j),
    };
  };
  return [1, -1].map((sign) => {
    const buckets = new Map<number, Bucket>();
    let cutSegments = 0,
      outerTriangles = 0,
      groupIndex = 0;
    function triangle(a: Vertex, b: Vertex, c: Vertex, material: number, flat = false) {
      if (
        new Vector3().subVectors(b.p, a.p).cross(new Vector3().subVectors(c.p, a.p)).lengthSq() <
        1e-20
      )
        return;
      const bucket = buckets.get(material) ?? { p: [], n: [] };
      buckets.set(material, bucket);
      const n = flat
        ? new Vector3().subVectors(b.p, a.p).cross(new Vector3().subVectors(c.p, a.p)).normalize()
        : null;
      for (const v of [a, b, c]) {
        bucket.p.push(...v.p.toArray());
        bucket.n.push(...(n ?? v.n).toArray());
      }
    }
    const inner = (v: Vertex): Vertex => ({
      p: v.p.clone().addScaledVector(v.n, -thickness),
      n: v.n.clone().negate(),
    });
    for (let i = 0; i < count; i += 3) {
      while (
        groupIndex + 1 < source.groups.length &&
        i >= source.groups[groupIndex].start + source.groups[groupIndex].count
      )
        groupIndex++;
      const role = source.groups[groupIndex]?.materialIndex ?? 0;
      const vertices = [read(i), read(i + 1), read(i + 2)],
        clipped: Vertex[] = [];
      for (let j = 0; j < 3; j++) {
        const a = vertices[j],
          b = vertices[(j + 1) % 3];
        const da = plane.distanceToPoint(a.p) * sign,
          db = plane.distanceToPoint(b.p) * sign;
        if (da >= 0) clipped.push(a);
        if (da < 0 !== db < 0) {
          const t = da / (da - db);
          clipped.push({ p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize() });
        }
      }
      if (clipped.length < 3) continue;
      for (let j = 1; j < clipped.length - 1; j++) {
        triangle(clipped[0], clipped[j], clipped[j + 1], role);
        triangle(inner(clipped[0]), inner(clipped[j + 1]), inner(clipped[j]), interiorMaterial);
        outerTriangles++;
      }
      for (let j = 0; j < clipped.length; j++) {
        const a = clipped[j],
          b = clipped[(j + 1) % clipped.length];
        if (
          Math.abs(plane.distanceToPoint(a.p)) > 1e-7 ||
          Math.abs(plane.distanceToPoint(b.p)) > 1e-7 ||
          a.p.distanceToSquared(b.p) < 1e-14
        )
          continue;
        triangle(b, a, inner(a), interiorMaterial, true);
        triangle(b, inner(a), inner(b), interiorMaterial, true);
        cutSegments++;
      }
    }
    const geometry = new BufferGeometry(),
      p: number[] = [],
      n: number[] = [];
    for (const [material, bucket] of buckets) {
      geometry.addGroup(p.length / 3, bucket.p.length / 3, material);
      // Avoid argument-count limits on the full-resolution shell.
      for (const value of bucket.p) p.push(value);
      for (const value of bucket.n) n.push(value);
    }
    geometry.setAttribute('position', new Float32BufferAttribute(p, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(n, 3));
    geometry.computeBoundingSphere();
    geometry.userData = { schematic: true, cutSegments, outerTriangles, thickness };
    return geometry;
  }) as [BufferGeometry, BufferGeometry];
}
