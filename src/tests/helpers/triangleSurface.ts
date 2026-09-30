import { Box3, BufferGeometry, Ray, Triangle, Vector3 } from 'three';

interface Face {
  triangle: Triangle;
  bounds: Box3;
  center: Vector3;
}
interface Node {
  bounds: Box3;
  faces?: Face[];
  children?: Node[];
}

/** 测试用局部三角面树：线段实际穿面检测，避免曲面内腔的 AABB 假阳性。 */
export function triangleSurface(geometry: BufferGeometry) {
  const position = geometry.attributes.position,
    index = geometry.index;
  const faces: Face[] = [];
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const points = [0, 1, 2].map((k) =>
      new Vector3().fromBufferAttribute(position, index ? index.getX(i + k) : i + k),
    );
    const bounds = new Box3().setFromPoints(points);
    faces.push({
      triangle: new Triangle(...(points as [Vector3, Vector3, Vector3])),
      bounds,
      center: bounds.getCenter(new Vector3()),
    });
  }
  function build(list: Face[]): Node {
    const bounds = new Box3();
    for (const face of list) bounds.union(face.bounds);
    if (list.length <= 20) return { bounds, faces: list };
    const size = bounds.getSize(new Vector3());
    const axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
    list.sort((a, b) => a.center[axis] - b.center[axis]);
    const mid = Math.floor(list.length / 2);
    return { bounds, children: [build(list.slice(0, mid)), build(list.slice(mid))] };
  }
  const root = build(faces),
    ray = new Ray(),
    hit = new Vector3();
  return {
    intersectsSegment(a: Vector3, b: Vector3) {
      const length = a.distanceTo(b);
      if (length < 1e-10) return false;
      ray.set(a, b.clone().sub(a).divideScalar(length));
      const stack = [root];
      while (stack.length) {
        const node = stack.pop()!;
        if (!ray.intersectsBox(node.bounds)) continue;
        if (node.children) {
          stack.push(...node.children);
          continue;
        }
        for (const face of node.faces!) {
          const t = face.triangle;
          if (
            ray.intersectTriangle(t.a, t.b, t.c, false, hit) &&
            a.distanceTo(hit) <= length + 1e-8
          )
            return true;
        }
      }
      return false;
    },
  };
}
