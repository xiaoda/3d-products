import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PRODUCT, mm } from '../config/product';

type Vertex = { p: Vector3; n: Vector3 };

/** 用同一个圆角盒切出两个粗模部件，保留一致外轮廓；内部封口留到阶段二。 */
function sliceGeometry(source: BufferGeometry, height: number, keepAbove: boolean): BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const points: number[] = [];
  const directions: number[] = [];
  const inside = (v: Vertex) => (keepAbove ? v.p.y >= height : v.p.y <= height);
  for (let i = 0; i < positions.count; i += 3) {
    const triangle = [0, 1, 2].map((offset) => ({
      p: new Vector3().fromBufferAttribute(positions, i + offset),
      n: new Vector3().fromBufferAttribute(normals, i + offset),
    }));
    const polygon: Vertex[] = [];
    for (let edge = 0; edge < 3; edge++) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      if (inside(a)) polygon.push(a);
      if (inside(a) !== inside(b)) {
        const t = (height - a.p.y) / (b.p.y - a.p.y);
        polygon.push({ p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize() });
      }
    }
    for (let j = 1; j < polygon.length - 1; j++) {
      for (const v of [polygon[0], polygon[j], polygon[j + 1]]) {
        points.push(v.p.x, v.p.y, v.p.z);
        directions.push(v.n.x, v.n.y, v.n.z);
      }
    }
  }
  if (geometry !== source) geometry.dispose();
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(points, 3));
  result.setAttribute('normal', new Float32BufferAttribute(directions, 3));
  return result;
}

export function createCase() {
  const { width, height, depth, seamHeight, seamGap } = PRODUCT.case;
  const w = mm(width),
    h = mm(height),
    d = mm(depth);
  const group = new Group();
  group.name = 'CaseAssembly';
  const source = new RoundedBoxGeometry(w, h, d, 5, mm(10.2));
  source.translate(0, h / 2, 0);
  const material = new MeshStandardMaterial({ color: 0xd6d8d4, roughness: 0.74, metalness: 0 });
  const body = new Mesh(sliceGeometry(source, mm(seamHeight - seamGap / 2), false), material);
  body.name = 'CaseBody';

  const lidPivot = new Group();
  lidPivot.name = 'LidPivot';
  lidPivot.position.set(0, mm(seamHeight), -d * 0.44);
  const lidGeometry = sliceGeometry(source, mm(seamHeight + seamGap / 2), true);
  lidGeometry.translate(0, -lidPivot.position.y, -lidPivot.position.z);
  const lid = new Mesh(lidGeometry, material);
  lid.name = 'CaseLid';
  lidPivot.add(lid);
  group.add(body, lidPivot);
  source.dispose();
  return { group, body, lid, lidPivot };
}
