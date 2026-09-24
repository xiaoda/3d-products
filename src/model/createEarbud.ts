import {
  Box3,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { PRODUCT, mm } from '../config/product';

export type EarSide = 'left' | 'right';

/** 第一阶段的椭球与胶囊组合白模；连续有机曲面在第二阶段替换。 */
export function createEarbud(side: EarSide): Group {
  const sign = side === 'left' ? -1 : 1;
  const group = new Group();
  group.name = side === 'left' ? 'LeftEarbud' : 'RightEarbud';
  const material = new MeshStandardMaterial({ color: 0xdbdcd8, roughness: 0.74, metalness: 0 });

  const head = new Mesh(new SphereGeometry(1, 40, 28), material);
  head.name = `${group.name}Head`;
  head.scale.set(0.82, 0.7, 0.84);
  head.rotation.z = sign * 0.23;
  head.position.set(-sign * 0.18, 0.85, 0.04);

  const stem = new Mesh(new CapsuleGeometry(0.255, 1.67, 8, 20), material);
  stem.name = `${group.name}Stem`;
  stem.scale.z = 0.88;
  stem.position.set(sign * 0.29, -0.24, -0.25);
  stem.rotation.z = sign * 0.06;

  const shoulder = new Mesh(new SphereGeometry(1, 28, 20), material);
  shoulder.name = `${group.name}Shoulder`;
  shoulder.scale.set(0.36, 0.56, 0.4);
  shoulder.position.set(sign * 0.24, 0.48, -0.23);
  group.add(head, stem, shoulder);
  group.updateMatrixWorld(true);

  // 把基础几何的变换烘焙回局部顶点，再按官方整体尺寸统一归一化。
  const box = new Box3().setFromObject(group, true);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const scale = new Vector3(
    mm(PRODUCT.earbud.width) / size.x,
    mm(PRODUCT.earbud.height) / size.y,
    mm(PRODUCT.earbud.depth) / size.z,
  );
  for (const object of [head, stem, shoulder]) {
    object.geometry.applyMatrix4(object.matrix);
    object.geometry.translate(-center.x, -center.y, -center.z);
    object.geometry.scale(scale.x, scale.y, scale.z);
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);
  }
  group.updateMatrixWorld(true);
  return group;
}
