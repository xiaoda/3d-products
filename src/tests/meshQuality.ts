import { BufferGeometry, Vector3 } from 'three';

/** 针对最终三角形计算，不使用插值后的显示法线掩盖折痕。 */
export function meshQuality(geometry: BufferGeometry) {
  const p = geometry.getAttribute('position');
  const index = geometry.index!;
  const edges = new Map<string, { normal: Vector3; count: number }>();
  const angles: number[] = [];
  let minimumArea = Infinity,
    volume = 0;
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const [a, b, c] = ids.map((id) => new Vector3().fromBufferAttribute(p, id));
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    minimumArea = Math.min(minimumArea, normal.length() / 2);
    volume += a.dot(b.clone().cross(c)) / 6;
    normal.normalize();
    for (let k = 0; k < 3; k++) {
      const key = [ids[k], ids[(k + 1) % 3]].sort((x, y) => x - y).join(':');
      const edge = edges.get(key);
      if (edge) {
        edge.count++;
        angles.push((normal.angleTo(edge.normal) * 180) / Math.PI);
      } else edges.set(key, { normal, count: 1 });
    }
  }
  angles.sort((a, b) => a - b);
  return {
    closed: [...edges.values()].every((e) => e.count === 2),
    euler: p.count - edges.size + index.count / 3,
    minimumArea,
    volume,
    maxDihedral: angles.at(-1) ?? 0,
    percentile999: angles[Math.floor(angles.length * 0.999)] ?? 0,
  };
}

/** AABB 扫描筛选后使用三角形分离轴测试，包含共面情况；不比较共享顶点的邻接面。 */
export function nonAdjacentIntersections(geometry: BufferGeometry, maxResults = 4): number[][] {
  const p = geometry.getAttribute('position'),
    index = geometry.index!;
  const triangles = Array.from({ length: index.count / 3 }, (_, id) => {
    const ids = [0, 1, 2].map((k) => index.getX(id * 3 + k));
    const points = ids.map((i) => new Vector3().fromBufferAttribute(p, i));
    const edges = points.map((a, i) => points[(i + 1) % 3].clone().sub(a));
    const normal = edges[0].clone().cross(edges[1]).normalize();
    return {
      id,
      ids,
      points,
      edges,
      normal,
      min: new Vector3(
        Math.min(...points.map((v) => v.x)),
        Math.min(...points.map((v) => v.y)),
        Math.min(...points.map((v) => v.z)),
      ),
      max: new Vector3(
        Math.max(...points.map((v) => v.x)),
        Math.max(...points.map((v) => v.y)),
        Math.max(...points.map((v) => v.z)),
      ),
    };
  }).sort((a, b) => a.min.x - b.min.x);
  const hits: number[][] = [];
  const epsilon = 1e-9;
  for (let i = 0; i < triangles.length; i++) {
    const a = triangles[i];
    for (let j = i + 1; j < triangles.length && triangles[j].min.x <= a.max.x + epsilon; j++) {
      const b = triangles[j];
      if (
        b.min.y > a.max.y + epsilon ||
        a.min.y > b.max.y + epsilon ||
        b.min.z > a.max.z + epsilon ||
        a.min.z > b.max.z + epsilon
      )
        continue;
      if (a.ids.some((id) => b.ids.includes(id))) continue;
      const axes = [
        a.normal,
        b.normal,
        ...a.edges.flatMap((e) => b.edges.map((f) => e.clone().cross(f))),
        ...a.edges.map((e) => e.clone().cross(a.normal)),
        ...b.edges.map((e) => e.clone().cross(b.normal)),
      ];
      const separated = axes.some((axis) => {
        if (axis.lengthSq() < 1e-20) return false;
        axis = axis.clone().normalize();
        const ap = a.points.map((v) => v.dot(axis)),
          bp = b.points.map((v) => v.dot(axis));
        return (
          Math.max(...ap) < Math.min(...bp) - epsilon || Math.max(...bp) < Math.min(...ap) - epsilon
        );
      });
      if (!separated) {
        hits.push([a.id, b.id]);
        if (hits.length >= maxResults) return hits;
      }
    }
  }
  return hits;
}
