import { describe, expect, it } from 'vitest';
import { Mesh, MeshPhysicalMaterial } from 'three';
import { createProductMaterials } from '../model/materials';
import { createProduct, disposeProduct } from '../model/createProduct';

describe('第三阶段材质', () => {
  it('白塑料、银色金属与网罩具有不同的物理属性', () => {
    const library = createProductMaterials();
    const plastic = library.get('plastic');
    expect(plastic).toBeInstanceOf(MeshPhysicalMaterial);
    expect(plastic.metalness).toBe(0);
    expect((plastic as MeshPhysicalMaterial).clearcoat).toBeGreaterThan(0.5);
    expect(library.get('metal').metalness).toBeGreaterThan(0.8);
    expect(library.get('grille').roughness).toBeGreaterThan(plastic.roughness);
    expect(library.get('sensor').color.getHex()).not.toBe(plastic.color.getHex());
  });
  it('同一产品按角色共享材质，不同产品不共享生命周期', () => {
    const a = createProductMaterials(),
      b = createProductMaterials();
    expect(a.get('plastic')).toBe(a.get('plastic'));
    expect(a.get('plastic')).not.toBe(b.get('plastic'));
  });
  it('产品中所有网格有具名材质，左右耳与充电盒共享塑料', () => {
    const product = createProduct();
    const mesh = (name: string) => product.root.getObjectByName(name) as Mesh;
    const shellMaterials = (name: string) => {
      const material = mesh(name).material;
      expect(Array.isArray(material)).toBe(true);
      return Array.isArray(material) ? material : [material];
    };
    expect(shellMaterials('LeftEarbudShell')[0]).toBe(mesh('CaseOuterShell').material);
    expect(shellMaterials('RightEarbudShell')[0]).toBe(mesh('CaseOuterShell').material);
    expect((mesh('Hinge').material as MeshPhysicalMaterial).name).toBe('metal');
    expect(shellMaterials('RightEarbudShell')[2].name).toBe('sensor');
    const materials = new Set();
    product.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        expect(material.name).not.toBe('');
        materials.add(material);
      }
      if (Array.isArray(object.material))
        for (const group of object.geometry.groups)
          expect(group.materialIndex!).toBeLessThan(list.length);
    });
    expect(materials.size).toBeLessThanOrEqual(10);
    let releases = 0;
    (mesh('CaseOuterShell').material as MeshPhysicalMaterial).addEventListener(
      'dispose',
      () => releases++,
    );
    disposeProduct(product.root);
    expect(releases).toBe(1);
  });
});
