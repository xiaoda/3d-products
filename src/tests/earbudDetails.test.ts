import { describe, expect, it } from 'vitest';
import { Mesh, Vector3, Raycaster, MeshStandardMaterial } from 'three';
import { createEarbudShellGeometry, sampleEarbudShell } from '../model/createEarbudShell';
import { EAR_FEATURES, featureFrame, featurePoint, featureDistance } from '../model/earbudFeatures';
import { createDetailedEarbud } from '../model/createDetailedEarbud';
import { meshQuality, nonAdjacentIntersections } from './meshQuality';
import { createProductMaterials } from '../model/materials';

describe('C 检查点：冻结裸壳上的局部细节', () => {
  it('使用新的曲面锚点与正交毫米切线基底', () => {
    for (const f of EAR_FEATURES) {
      const frame = featureFrame(f);
      expect(frame.center.distanceTo(sampleEarbudShell(f.u, f.v))).toBeLessThan(1e-12);
      expect(Math.abs(frame.x.dot(frame.y))).toBeLessThan(1e-10);
      expect(frame.x.clone().cross(frame.y).dot(frame.normal)).toBeCloseTo(1, 8);
      const p = featurePoint(f, 0.5, 0.2).sub(frame.center).multiplyScalar(10);
      expect(p.dot(frame.x)).toBeCloseTo(0.5, 5);
      expect(p.dot(frame.y)).toBeCloseTo(0.2, 5);
      expect(featureDistance(f, frame.center)).toBeLessThan(0);
    }
  });
  it('所有细节关闭时逐顶点恢复已确认裸壳，不累积变形', () => {
    const ear = createDetailedEarbud('right');
    const bare = createEarbudShellGeometry();
    try {
      ear.setFeatures([]);
      expect(ear.shell.geometry.attributes.position.array).toEqual(bare.attributes.position.array);
      expect(ear.shell.geometry.attributes.normal.array).toEqual(bare.attributes.normal.array);
      expect(ear.shell.geometry.index!.array).toEqual(bare.index!.array);
      ear.setFeatures(EAR_FEATURES.map((f) => f.id));
      ear.setFeatures([]);
      expect(ear.shell.geometry.attributes.position.array).toEqual(bare.attributes.position.array);
    } finally {
      ear.dispose();
      bare.dispose();
    }
  });
  it('开口的内收孔缘与封底共用边界，最终壳封闭、无退化面', () => {
    const ear = createDetailedEarbud('right');
    try {
      const q = meshQuality(ear.shell.geometry);
      expect(q.closed).toBe(true);
      expect(q.euler).toBe(2);
      expect(q.minimumArea).toBeGreaterThan(1e-12);
      expect(q.volume).toBeGreaterThan(2);
      // 局部孔缘有刻意的陡转折，不能套用裸壳 15° 门槛；但不应出现接近翻面的折角。
      expect(q.maxDihedral).toBeLessThan(45);
      expect([...ear.shell.geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    } finally {
      ear.dispose();
    }
  });
  it('镜像同时改变顶点、法线与绕序，不通过负缩放反转可见面', () => {
    const right = createDetailedEarbud('right'),
      left = createDetailedEarbud('left');
    try {
      const a = right.shell.geometry,
        b = left.shell.geometry;
      expect(a.attributes.position.count).toBe(b.attributes.position.count);
      for (let i = 0; i < a.attributes.position.count; i += 23) {
        const p = new Vector3().fromBufferAttribute(a.attributes.position, i);
        p.x = -p.x;
        expect(
          p.distanceTo(new Vector3().fromBufferAttribute(b.attributes.position, i)),
        ).toBeLessThan(1e-7);
      }
      expect(meshQuality(b).volume).toBeCloseTo(meshQuality(a).volume, 6);
      for (let i = 0; i < a.attributes.normal.count; i += 23) {
        const n = new Vector3().fromBufferAttribute(a.attributes.normal, i);
        n.x = -n.x;
        expect(
          n.distanceTo(new Vector3().fromBufferAttribute(b.attributes.normal, i)),
        ).toBeLessThan(1e-7);
      }
      for (let i = 0; i < a.index!.count; i += 129) {
        expect(b.index!.getX(i)).toBe(a.index!.getX(i));
        expect(b.index!.getX(i + 1)).toBe(a.index!.getX(i + 2));
      }
      left.root.traverse((o) => {
        if (o instanceof Mesh) expect(o.scale.toArray()).toEqual([1, 1, 1]);
      });
    } finally {
      right.dispose();
      left.dispose();
    }
  });
  it('逐项启停不影响局部开口以外的原壳顶点与法线', () => {
    const ear = createDetailedEarbud('right'),
      bare = createEarbudShellGeometry();
    const key = (p: Vector3) => p.toArray().join(',');
    try {
      for (const feature of EAR_FEATURES) {
        ear.setFeatures([feature.id]);
        expect(ear.inspect().enabled).toEqual([feature.id]);
        const g = ear.shell.geometry,
          lookup = new Map<string, Vector3>();
        for (let i = 0; i < g.attributes.position.count; i++)
          lookup.set(
            key(new Vector3().fromBufferAttribute(g.attributes.position, i)),
            new Vector3().fromBufferAttribute(g.attributes.normal, i),
          );
        for (let i = 0; i < bare.attributes.position.count; i++) {
          const p = new Vector3().fromBufferAttribute(bare.attributes.position, i),
            n = new Vector3().fromBufferAttribute(bare.attributes.normal, i);
          if (featureDistance(feature, p, n) < 0) continue;
          const actual = lookup.get(key(p));
          expect(actual).toBeDefined();
          expect(actual!.distanceTo(n)).toBeLessThan(1e-7);
        }
        expect(meshQuality(g).closed).toBe(true);
      }
    } finally {
      ear.dispose();
      bare.dispose();
    }
  }, 20000);
  it('全部细节的显示壳没有非邻接面相交', () => {
    const ear = createDetailedEarbud('right');
    try {
      expect(nonAdjacentIntersections(ear.shell.geometry)).toEqual([]);
    } finally {
      ear.dispose();
    }
  }, 30000);
  it('细网位于同一局部凹腔封底外侧，采样检查无穿插或大间隙', () => {
    const ear = createDetailedEarbud('right');
    ear.root.updateMatrixWorld(true);
    const ray = new Raycaster(),
      p = new Vector3();
    try {
      for (const feature of EAR_FEATURES.filter((f) => f.grille)) {
        const mesh = ear.root.getObjectByName(feature.id + 'Lattice') as Mesh;
        const n = featureFrame(feature).normal;
        for (
          let i = 0;
          i < mesh.geometry.attributes.position.count;
          i += Math.max(1, Math.floor(mesh.geometry.attributes.position.count / 12))
        ) {
          p.fromBufferAttribute(mesh.geometry.attributes.position, i);
          ray.set(p.clone().addScaledVector(n, 0.03), n.clone().negate());
          const hits = ray.intersectObject(ear.shell, false);
          expect(hits.length).toBeGreaterThan(0);
          const clearance = hits[0].distance - 0.03;
          expect(clearance).toBeGreaterThan(0);
          expect(clearance).toBeLessThan(0.008);
        }
      }
    } finally {
      ear.dispose();
    }
  });
  it('材质切换不改几何；替换释放旧几何，幂等释放且不释放借用材质', () => {
    const materials = createProductMaterials(),
      ear = createDetailedEarbud('right', materials);
    const clay = new MeshStandardMaterial(),
      geometry = ear.shell.geometry;
    let released = 0,
      borrowedReleased = 0;
    geometry.addEventListener('dispose', () => released++);
    materials.get('plastic').addEventListener('dispose', () => borrowedReleased++);
    ear.setDiagnosticMaterial(clay);
    expect(ear.shell.geometry).toBe(geometry);
    expect(ear.shell.material).toBe(clay);
    ear.setDiagnosticMaterial(null);
    expect(Array.isArray(ear.shell.material)).toBe(true);
    expect(() => ear.setFeatures(['unknown'])).toThrow(RangeError);
    expect(ear.shell.geometry).toBe(geometry);
    ear.setFeatures([]);
    expect(released).toBe(1);
    ear.dispose();
    ear.dispose();
    expect(ear.inspect().disposed).toBe(true);
    expect(borrowedReleased).toBe(0);
    expect(() => ear.setFeatures([])).toThrow();
    expect(() => featurePoint(EAR_FEATURES[0], NaN, 0)).toThrow(RangeError);
    clay.dispose();
    for (const role of ['plastic', 'grille', 'sensor', 'contact', 'grilleWire'] as const)
      materials.get(role).dispose();
  });
});
