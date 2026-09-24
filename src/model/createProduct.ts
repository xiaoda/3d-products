import { Group, Material, Mesh } from 'three';
import { createCase } from './createCase';
import { createEarbud } from './createEarbud';

export function createProduct() {
  const root = new Group();
  root.name = 'ProductRoot';
  const caseModel = createCase();
  const leftEarbud = createEarbud('left');
  const rightEarbud = createEarbud('right');
  // 固定展示布局，不是耳机取出动画，也不是实际收纳位置。
  leftEarbud.position.set(-1.65, 6.7, 0.25);
  leftEarbud.rotation.set(0.12, -0.38, 0.14);
  rightEarbud.position.set(1.65, 7.0, -0.15);
  rightEarbud.rotation.set(-0.06, 0.42, -0.18);
  root.add(caseModel.group, leftEarbud, rightEarbud);
  return {
    root,
    parts: {
      caseAssembly: caseModel.group,
      caseBody: caseModel.body,
      caseLid: caseModel.lid,
      lidPivot: caseModel.lidPivot,
      leftEarbud,
      rightEarbud,
    },
  };
}

export function disposeProduct(root: Group): void {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Material>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
