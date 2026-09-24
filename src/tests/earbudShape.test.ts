import { describe, expect, it } from 'vitest';
import { Mesh, Vector3 } from 'three';
import { createEarbud } from '../model/createEarbud';
import { disposeProduct } from '../model/createProduct';
import { EAR_REFERENCE } from './earbudReference';
import { silhouetteIoU } from './silhouette';
import { earbudSurface } from '../model/earbudSurface';
import { surfaceNormal } from '../model/geometry';

/** 正交投影三角形覆盖；不以材质、高光或包围圆代替轮廓。坐标单位为 10 mm。 */
function covers(mesh: Mesh, axes: [number, number], point: [number, number]): boolean {
  const p = mesh.geometry.getAttribute('position'),
    index = mesh.geometry.index!;
  const cross = (a: number[], b: number[], q: number[]) =>
    (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
  for (let i = 0; i < index.count; i += 3) {
    const v = [0, 1, 2].map((k) => {
      const xyz = new Vector3().fromBufferAttribute(p, index.getX(i + k)).toArray();
      return axes.map((a) => xyz[a]);
    });
    if (Math.abs(cross(v[0], v[1], v[2])) < 1e-10) continue;
    const c = [cross(v[0], v[1], point), cross(v[1], v[2], point), cross(v[2], v[0], point)];
    if (c.every((x) => x >= -1e-8) || c.every((x) => x <= 1e-8)) return true;
  }
  return false;
}

describe('耳机形态专项回归', () => {
  it('弯曲主轴处的采样截面不出现法线向内翻折', () => {
    let minimum = 1;
    for (let i = 1; i < 1000; i++) {
      const u = i / 1000,
        center = new Vector3();
      for (let j = 0; j < 96; j++) center.add(earbudSurface(u, (j * Math.PI) / 48));
      center.divideScalar(96);
      for (let j = 0; j < 96; j++) {
        const angle = (j * Math.PI) / 48,
          radial = earbudSurface(u, angle).sub(center).normalize();
        minimum = Math.min(minimum, surfaceNormal(earbudSurface, u, angle).dot(radial));
      }
    }
    expect(minimum, '相邻定向截面过度扭转导致翻折').toBeGreaterThan(0);
  });
  it.each([
    ['top', [0, 2], 0.92],
    ['front', [0, 1], 0.95],
    ['side', [2, 1], 0.87],
  ] as const)('%s 完整投影贴近独立官网参考，不只通过局部探针', (name, axes, minimum) => {
    const ear = createEarbud('right');
    try {
      expect(silhouetteIoU(ear, [...axes], EAR_REFERENCE[name])).toBeGreaterThan(minimum);
    } finally {
      disposeProduct(ear);
    }
  });
  it('俯视有颈部收窄和偏心耳柄，不再用近圆头部填满后内侧', () => {
    const ear = createEarbud('right');
    try {
      const shell = ear.getObjectByName('RightEarbudShell') as Mesh;
      expect(covers(shell, [0, 2], [-0.4, -0.55]), '后内侧应收回，不能是圆盘').toBe(false);
      expect(covers(shell, [0, 2], [0.4, -0.65]), '偏心耳柄投影应保留').toBe(true);
      expect(covers(shell, [0, 2], [-0.55, 0.4]), '出音口侧的头部体积应保留').toBe(true);
    } finally {
      disposeProduct(ear);
    }
  });

  it('侧视头部向前伸出且下缘回收，不是球头竖柄', () => {
    const ear = createEarbud('right');
    try {
      const shell = ear.getObjectByName('RightEarbudShell') as Mesh;
      expect(covers(shell, [2, 1], [0.55, 0.12]), '头部下半部应有前伸体积').toBe(true);
      expect(covers(shell, [2, 1], [0, -0.35]), '头部与耳柄间的侧视负空间').toBe(false);
    } finally {
      disposeProduct(ear);
    }
  });

  it('外壳连续封闭、三角形非退化，左右镜像位置和法线一致', () => {
    const right = createEarbud('right'),
      left = createEarbud('left');
    try {
      const r = (right.getObjectByName('RightEarbudShell') as Mesh).geometry;
      const l = (left.getObjectByName('LeftEarbudShell') as Mesh).geometry;
      const p = r.getAttribute('position'),
        lp = l.getAttribute('position');
      const n = r.getAttribute('normal'),
        ln = l.getAttribute('normal'),
        index = r.index!;
      const edges = new Map<string, number>();
      let volume = 0;
      for (let i = 0; i < p.count; i++) {
        expect(lp.getX(i)).toBeCloseTo(-p.getX(i), 6);
        expect(lp.getY(i)).toBeCloseTo(p.getY(i), 6);
        expect(lp.getZ(i)).toBeCloseTo(p.getZ(i), 6);
        expect(ln.getX(i)).toBeCloseTo(-n.getX(i), 6);
        expect(ln.getY(i)).toBeCloseTo(n.getY(i), 6);
        expect(ln.getZ(i)).toBeCloseTo(n.getZ(i), 6);
      }
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        const [a, b, c] = ids.map((id) => new Vector3().fromBufferAttribute(p, id));
        expect(b.clone().sub(a).cross(c.clone().sub(a)).length()).toBeGreaterThan(1e-10);
        volume += a.dot(b.clone().cross(c)) / 6;
        for (let k = 0; k < 3; k++) {
          const key = [ids[k], ids[(k + 1) % 3]].sort((x, y) => x - y).join(':');
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every((count) => count === 2)).toBe(true);
      expect(volume).toBeGreaterThan(0);
    } finally {
      disposeProduct(right);
      disposeProduct(left);
    }
  });
});
