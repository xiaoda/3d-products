import { describe, expect, it } from 'vitest';
import { Box3, Mesh, Vector3 } from 'three';
import { PRODUCT, mm } from '../config/product';
import { createCase } from '../model/createCase';
import { createEarbud } from '../model/createEarbud';
import { createProduct, disposeProduct } from '../model/createProduct';

describe('产品配置', () => {
  it('采用标准充电盒版及毫米尺寸', () => {
    expect(PRODUCT.variant).toBe('standard');
    expect(mm(50.1)).toBeCloseTo(5.01);
    expect(PRODUCT.case).toMatchObject({ width: 50.1, height: 46.2, depth: 21.2 });
    expect(PRODUCT.earbud).toMatchObject({ width: 18.3, height: 30.2, depth: 18.1 });
  });
});

describe('基础白模', () => {
  it('具有可独立变换的必需节点', () => {
    const { root, parts } = createProduct();
    expect(root.name).toBe('ProductRoot');
    for (const name of ['CaseBody', 'CaseLid', 'LidPivot', 'LeftEarbud', 'RightEarbud']) {
      expect(root.getObjectByName(name), name).toBeDefined();
    }
    expect(parts.caseLid.parent).toBe(parts.lidPivot);
    const previous = parts.rightEarbud.position.clone();
    parts.leftEarbud.position.x += 1;
    expect(parts.rightEarbud.position.equals(previous)).toBe(true);
    disposeProduct(root);
  });

  it('充电盒闭合外包围尺寸与规格一致', () => {
    const { group } = createCase();
    const size = new Box3().setFromObject(group).getSize(new Vector3());
    expect(size.x).toBeCloseTo(mm(PRODUCT.case.width), 3);
    expect(size.y).toBeCloseTo(mm(PRODUCT.case.height), 3);
    expect(size.z).toBeCloseTo(mm(PRODUCT.case.depth), 3);
    disposeProduct(group);
  });

  it.each(['left', 'right'] as const)('%s 耳机的独立局部尺寸正确', (side) => {
    const group = createEarbud(side);
    const size = new Box3().setFromObject(group).getSize(new Vector3());
    expect(size.x).toBeCloseTo(mm(PRODUCT.earbud.width), 3);
    expect(size.y).toBeCloseTo(mm(PRODUCT.earbud.height), 3);
    expect(size.z).toBeCloseTo(mm(PRODUCT.earbud.depth), 3);
    disposeProduct(group);
  });

  it('几何坐标与法线有限且法线有效', () => {
    const { root } = createProduct();
    let meshCount = 0;
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshCount++;
      const { geometry } = object;
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      expect(position.count).toBeGreaterThan(0);
      expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(normal.array).every(Number.isFinite)).toBe(true);
      for (let i = 0; i < normal.count; i++) {
        expect(new Vector3().fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 3);
      }
      if (geometry.index) {
        for (const index of geometry.index.array) expect(index).toBeLessThan(position.count);
      }
    });
    expect(meshCount).toBeGreaterThanOrEqual(6);
    disposeProduct(root);
  });

  it('固定分开展示姿态中耳机与盒体不重叠', () => {
    const { root, parts } = createProduct();
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(parts.caseAssembly);
    const left = new Box3().setFromObject(parts.leftEarbud);
    const right = new Box3().setFromObject(parts.rightEarbud);
    expect(box.intersectsBox(left)).toBe(false);
    expect(box.intersectsBox(right)).toBe(false);
    expect(left.intersectsBox(right)).toBe(false);
    disposeProduct(root);
  });
});
