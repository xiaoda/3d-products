import { Group, Material, Mesh } from 'three';
import { createCase } from './createCase';
import { createEarbud } from './createEarbud';
import { PRODUCT, mm } from '../config/product';

export type ProductPose = 'closed' | 'open' | 'separated';

export function createProduct() {
  const root = new Group();
  root.name = 'ProductRoot';
  const caseModel = createCase();
  const leftEarbud = createEarbud('left');
  const rightEarbud = createEarbud('right');
  root.add(caseModel.group, leftEarbud, rightEarbud);
  const product = {
    root,
    parts: {
      caseAssembly: caseModel.group,
      caseBody: caseModel.body,
      caseLid: caseModel.lid,
      lidPivot: caseModel.lidPivot,
      leftEarbud,
      rightEarbud,
      caseInterior: caseModel.interior,
      lidInterior: caseModel.lidInterior,
    },
  };
  setProductPose(product, 'separated');
  return product;
}

export type ProductModel = ReturnType<typeof createProduct>;

export function setLidAngle(product: { parts: { lidPivot: Group } }, degrees: number): void {
  if (!Number.isFinite(degrees)) throw new RangeError('无效盒盖角度');
  const angle = Math.max(0, Math.min(PRODUCT.assembly.openAngle, degrees));
  product.parts.lidPivot.rotation.x = angle === 0 ? 0 : (-angle * Math.PI) / 180;
}

export function setProductPose(
  product: { root: Group; parts: { leftEarbud: Group; rightEarbud: Group; lidPivot: Group } },
  pose: ProductPose,
): void {
  const { leftEarbud: left, rightEarbud: right } = product.parts;
  left.visible = true;
  right.visible = true;
  left.rotation.set(0, 0, 0);
  right.rotation.set(0, 0, 0);
  if (pose === 'separated') {
    left.position.set(-1.5, 6.6, 0.6);
    right.position.set(1.5, 6.9, 0.3);
    left.rotation.set(0.1, 0.1, 0.18);
    right.rotation.set(-0.04, -0.28, -0.15);
    setLidAngle(product, PRODUCT.assembly.openAngle);
  } else {
    left.position.set(-mm(PRODUCT.assembly.seatX), mm(PRODUCT.assembly.seatY), 0);
    right.position.set(mm(PRODUCT.assembly.seatX), mm(PRODUCT.assembly.seatY), 0);
    setLidAngle(product, pose === 'open' ? PRODUCT.assembly.openAngle : 0);
  }
  product.root.userData.pose = pose;
  product.root.updateMatrixWorld(true);
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
