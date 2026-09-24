import { describe, expect, it } from 'vitest';
import { Mesh, Vector3, type Group } from 'three';
import { createEarbud } from '../model/createEarbud';
import { createDetailedEarbud } from '../model/createDetailedEarbud';
import { createProduct, disposeProduct, setLidAngle, setProductPose } from '../model/createProduct';
import { cavityProfile, insideCavity } from '../model/earbudCavity';
import { bodyProfile, lidProfile } from '../model/profiles';
import { sampleProfile } from '../model/geometry';
import { caseDistance } from '../model/caseSurface';
import { GEOMETRY_VIEWS } from '../scene/geometryViews';

function earSamples(root: Group, faces = false) {
  const points: Vector3[] = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const p = object.geometry.attributes.position,
      index = object.geometry.index!;
    if (faces) {
      for (let i = 0; i < index.count; i += 3) {
        const a = new Vector3().fromBufferAttribute(p, index.getX(i));
        const b = new Vector3().fromBufferAttribute(p, index.getX(i + 1));
        const c = new Vector3().fromBufferAttribute(p, index.getX(i + 2));
        points.push(a.add(b).add(c).divideScalar(3).applyMatrix4(object.matrixWorld));
      }
    } else {
      for (let i = 0; i < p.count; i++)
        points.push(new Vector3().fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld));
    }
  });
  return points;
}

describe('D 已确认耳机接入', () => {
  it.each(['left', 'right'] as const)('%s 直接使用 C 的顶点、法线与索引，不二次归一化', (side) => {
    const accepted = createDetailedEarbud(side);
    const actual = createEarbud(side);
    try {
      const shell = actual.getObjectByName(
        `${side === 'left' ? 'Left' : 'Right'}EarbudShell`,
      ) as Mesh;
      expect(actual.userData.normalization).toBeUndefined();
      expect(actual.scale.toArray()).toEqual([1, 1, 1]);
      for (const attribute of ['position', 'normal'])
        expect(
          Buffer.from(shell.geometry.getAttribute(attribute).array.buffer).equals(
            Buffer.from(accepted.shell.geometry.getAttribute(attribute).array.buffer),
          ),
        ).toBe(true);
      expect(
        Buffer.from(shell.geometry.index!.array.buffer).equals(
          Buffer.from(accepted.shell.geometry.index!.array.buffer),
        ),
      ).toBe(true);
      expect(shell.geometry.groups).toEqual(accepted.shell.geometry.groups);
    } finally {
      accepted.dispose();
      disposeProduct(actual);
    }
  });

  // 首次生成收纳包络并创建多个密集网格；并发执行时可能超过默认 5 秒。
  it('CPU 模板不与实例共享可变几何，产品释放幂等且不释放另一个产品', { timeout: 30000 }, () => {
    const a = createProduct(),
      b = createProduct();
    const shell = (root: Group) => root.getObjectByName('RightEarbudShell') as Mesh;
    const ga = shell(a.root).geometry,
      gb = shell(b.root).geometry;
    expect(ga).not.toBe(gb);
    expect(ga.attributes.position.array).not.toBe(gb.attributes.position.array);
    const before = gb.attributes.position.getX(0);
    ga.attributes.position.setX(0, 999);
    expect(gb.attributes.position.getX(0)).toBe(before);
    const c = createEarbud('right');
    expect(shell(c).geometry.attributes.position.getX(0)).toBe(before);
    const counts = new Map<object, number>();
    a.root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const resource of [
        o.geometry,
        ...(Array.isArray(o.material) ? o.material : [o.material]),
      ]) {
        if (counts.has(resource)) continue;
        counts.set(resource, 0);
        resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1));
      }
    });
    let otherDisposed = 0;
    gb.addEventListener('dispose', () => otherDisposed++);
    disposeProduct(a.root);
    disposeProduct(a.root);
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
    expect(otherDisposed).toBe(0);
    disposeProduct(b.root);
    disposeProduct(c);
  });

  it('完整显示耳机及细网的全部顶点均在收纳腔中，槽壁未贯穿充电盒外壳', () => {
    const product = createProduct();
    setProductPose(product, 'closed');
    try {
      for (const [side, ear] of [
        [-1, product.parts.leftEarbud],
        [1, product.parts.rightEarbud],
      ] as const) {
        const body = cavityProfile('body', side),
          lid = cavityProfile('lid', side);
        let collisions = 0;
        for (const point of earSamples(ear)) {
          if (point.y > bodyProfile.at(-1)!.y && point.y < lidProfile[0].y) continue;
          if (!insideCavity(point.y <= bodyProfile.at(-1)!.y ? body : lid, point)) collisions++;
        }
        expect(collisions, `${side} 完整耳机穿插`).toBe(0);
      }
      for (const name of ['LeftWell', 'RightWell', 'LeftLidWell', 'RightLidWell']) {
        const mesh = product.root.getObjectByName(name) as Mesh;
        const p = mesh.geometry.attributes.position;
        const profile = name.includes('Lid') ? lidProfile : bodyProfile;
        let worst = -Infinity;
        for (let i = 0; i < p.count; i++)
          worst = Math.max(
            worst,
            caseDistance(sampleProfile(profile, p.getY(i)), p.getX(i), p.getZ(i)),
          );
        expect(worst, `${name} 水平槽壁不得穿出外壳`).toBeLessThan(-0.05);
      }
    } finally {
      disposeProduct(product.root);
    }
  });

  it('所有耳机面的重心采样在闭合及每 5° 开盖检查中均不进入实体', { timeout: 30000 }, () => {
    const product = createProduct();
    setProductPose(product, 'closed');
    try {
      const samples = [
        ...earSamples(product.parts.leftEarbud, true),
        ...earSamples(product.parts.rightEarbud, true),
      ];
      const body = [cavityProfile('body', -1), cavityProfile('body', 1)];
      const lid = [cavityProfile('lid', -1), cavityProfile('lid', 1)];
      let bodyHits = 0;
      for (const p of samples)
        if (p.y <= bodyProfile.at(-1)!.y && !insideCavity(body[p.x < 0 ? 0 : 1], p)) bodyHits++;
      expect(bodyHits).toBe(0);
      for (let angle = 0; angle <= 115; angle += 5) {
        setLidAngle(product, angle);
        product.root.updateMatrixWorld(true);
        const matrix = product.parts.caseLid.matrixWorld.clone().invert();
        let hits = 0;
        for (const point of samples) {
          const p = point.clone().applyMatrix4(matrix);
          if (p.y <= lidProfile[0].y || p.y >= lidProfile.at(-1)!.y) continue;
          if (caseDistance(sampleProfile(lidProfile, p.y), p.x, p.z) >= 0) continue;
          if (!insideCavity(lid[p.x < 0 ? 0 : 1], p)) hits++;
        }
        expect(hits, `${angle}° 面重心穿入盒盖`).toBe(0);
      }
    } finally {
      disposeProduct(product.root);
    }
  });

  it('返回的包络可独立读取，外部修改不污染缓存；无效铰链角度被拒绝', () => {
    const a = cavityProfile('body', 1),
      b = cavityProfile('body', 1);
    const x = b[1].points[0].x;
    a[1].points[0].x = 999;
    expect(cavityProfile('body', 1)[1].points[0].x).toBe(x);
    const product = createProduct();
    try {
      for (const angle of [NaN, Infinity, -Infinity])
        expect(() => setLidAngle(product, angle)).toThrow(RangeError);
    } finally {
      disposeProduct(product.root);
    }
  });

  it('单耳后视是严格 -Z，六向与四斜视均有正交的观察上轴', () => {
    expect(GEOMETRY_VIEWS.back.direction).toEqual([0, 0, -1]);
    expect(Object.keys(GEOMETRY_VIEWS)).toHaveLength(10);
    for (const [name, view] of Object.entries(GEOMETRY_VIEWS)) {
      const direction = new Vector3(...view.direction),
        up = new Vector3(...view.up);
      expect(direction.clone().cross(up).length(), name).toBeGreaterThan(0.99);
      if (!name.includes('Left') && !name.includes('Right')) expect(direction.dot(up)).toBe(0);
    }
  });
});
