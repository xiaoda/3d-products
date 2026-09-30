import { describe, expect, test } from 'vitest';
import {
  Box3,
  BoxGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Plane,
  Raycaster,
  Vector3,
} from 'three';
import { splitHollowShell } from '../model/splitEarbudShell';
import { createExplodedEarbud } from '../model/createExplodedEarbud';
import { EXPLODED_PARTS } from '../model/explodedEarbudDefinition';
import { createEarbudShellGeometry } from '../model/createEarbudShell';
import { createEarbud } from '../model/createEarbud';
import { disposeProduct } from '../model/createProduct';

describe('示意壳体裁切', () => {
  test('不修改源几何，保留两侧表面并生成内壁和切口', () => {
    const source = new BoxGeometry(2, 2, 2);
    const before = Array.from(source.attributes.position.array);
    const halves = splitHollowShell(source, new Plane(new Vector3(1, 0, 0), 0), 0.04, 6);
    expect(Array.from(source.attributes.position.array)).toEqual(before);
    halves.forEach((g, side) => {
      expect(g.groups.some((group) => group.materialIndex === 6)).toBe(true);
      expect(g.userData.cutSegments).toBeGreaterThan(0);
      expect(g.userData.outerTriangles).toBeGreaterThan(0);
      g.computeBoundingBox();
      expect(side === 0 ? g.boundingBox!.max.x : -g.boundingBox!.min.x).toBeCloseTo(1);
      for (const n of g.attributes.normal.array) expect(Number.isFinite(n)).toBe(true);
      for (const p of g.attributes.position.array) expect(Number.isFinite(p)).toBe(true);
      g.dispose();
    });
    source.dispose();
  });

  test('拒绝不合法厚度与非单位裁切面', () => {
    const geometry = new BoxGeometry();
    expect(() => splitHollowShell(geometry, new Plane(), -1, 0)).toThrow();
    expect(() => splitHollowShell(geometry, new Plane(new Vector3(0, 0, 2)), 0.04, 0)).toThrow();
    geometry.dispose();
  });

  test('两片的外表面积之和等于原表面，不凭空丢弃或重叠外表面', () => {
    const source = new BoxGeometry(2, 2, 2);
    const halves = splitHollowShell(
      source,
      new Plane(new Vector3(1, 0.3, 0.2).normalize(), 0.13),
      0.04,
      6,
    );
    let area = 0;
    for (const g of halves)
      for (const group of g.groups) {
        if (group.materialIndex === 6) continue;
        for (let i = group.start; i < group.start + group.count; i += 3) {
          const a = new Vector3().fromBufferAttribute(g.attributes.position, i);
          const b = new Vector3().fromBufferAttribute(g.attributes.position, i + 1);
          const c = new Vector3().fromBufferAttribute(g.attributes.position, i + 2);
          area += b.sub(a).cross(c.sub(a)).length() / 2;
        }
      }
    expect(area).toBeCloseTo(24, 5);
    halves.forEach((g) => g.dispose());
    source.dispose();
  });
});

describe('独立单耳结构示意', () => {
  test('功能组完整、示意标识明确、所有几何有限', () => {
    const model = createExplodedEarbud();
    expect(Object.keys(model.parts)).toEqual(EXPLODED_PARTS.map((p) => p.id));
    expect(model.root.userData.schematic).toBe(true);
    model.root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      expect(obj.geometry.attributes.position.count).toBeGreaterThan(0);
      const bounds = new Box3().setFromBufferAttribute(obj.geometry.attributes.position);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
    });
    model.dispose();
  }, 30000);

  test('完整态保留原模型，内部与爆炸态切换不积累漂移', () => {
    const model = createExplodedEarbud();
    model.setPose('inside');
    model.root.updateMatrixWorld(true);
    const base = Object.values(model.parts).map((p) => p.matrix.toArray());
    for (let i = 0; i < 5; i++) {
      model.setPose('exploded');
      expect(model.complete.visible).toBe(false);
      model.setPose('inside');
    }
    model.root.updateMatrixWorld(true);
    expect(Object.values(model.parts).map((p) => p.matrix.toArray())).toEqual(base);
    expect(model.parts.frontShell.visible).toBe(false);
    model.setPose('assembled');
    expect(model.complete.visible).toBe(true);
    expect(Object.values(model.parts).every((p) => !p.visible)).toBe(true);
    model.dispose();
    model.dispose();
    expect(model.root.children.length).toBe(0);
  }, 30000);

  test('主要内部组件的装配包围盒位于外壳总包络内', () => {
    const model = createExplodedEarbud();
    model.setPose('inside');
    model.root.updateMatrixWorld(true);
    const envelope = new Box3().setFromObject(model.complete);
    for (const id of ['driver', 'battery', 'logic'] as const) {
      expect(envelope.containsBox(new Box3().setFromObject(model.parts[id])), id).toBe(true);
    }
    model.dispose();
  }, 30000);

  test('内部主要组件的离散表面采样位于原裸壳内部', () => {
    const model = createExplodedEarbud();
    const geometry = createEarbudShellGeometry();
    const material = new MeshBasicMaterial({ side: DoubleSide });
    const shell = new Mesh(geometry, material);
    shell.updateMatrixWorld(true);
    const ray = new Raycaster(),
      point = new Vector3();
    const direction = new Vector3(1, 0.371, 0.193).normalize();
    model.setPose('inside');
    const outside: string[] = [];
    try {
      for (const id of ['driver', 'battery', 'logic', 'flex', 'sensing', 'contacts'] as const) {
        model.parts[id].traverse((obj) => {
          if (!(obj instanceof Mesh)) return;
          const positions = obj.geometry.attributes.position;
          for (let i = 0; i < positions.count; i += Math.max(1, Math.floor(positions.count / 12))) {
            point.fromBufferAttribute(positions, i).applyMatrix4(obj.matrixWorld);
            ray.set(point, direction);
            const distances = ray.intersectObject(shell, false).map((hit) => hit.distance);
            const unique = distances.filter(
              (d, index) => index === 0 || d - distances[index - 1] > 1e-6,
            );
            if (unique.length % 2 !== 1)
              outside.push(`${id}: ${point.toArray().map((n) => n.toFixed(3))}`);
          }
        });
      }
      expect(outside).toEqual([]);
    } finally {
      model.dispose();
      geometry.dispose();
      material.dispose();
    }
  }, 30000);

  test('释放评审模型不释放其他正式耳机实例的资源', () => {
    const accepted = createEarbud('right');
    let released = 0;
    accepted.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      obj.geometry.addEventListener('dispose', () => released++);
      for (const material of Array.isArray(obj.material) ? obj.material : [obj.material])
        material.addEventListener('dispose', () => released++);
    });
    const model = createExplodedEarbud();
    model.dispose();
    expect(released).toBe(0);
    disposeProduct(accepted);
    expect(released).toBeGreaterThan(0);
  }, 30000);
});
