import { Euler, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import { PRODUCT, mm } from '../config/product';

/** 唯一收纳坐标源。左耳几何已镜像，节点变换用 S * R * S，不使用负缩放。 */
export function seatedEarbudTransform(side: -1 | 1): Matrix4 {
  const a = PRODUCT.assembly;
  const radians = Math.PI / 180;
  return new Matrix4().compose(
    new Vector3(side * mm(a.seatX), mm(a.seatY), mm(a.seatZ)),
    new Quaternion().setFromEuler(
      new Euler(
        a.seatPitch * radians,
        side * a.seatYaw * radians,
        side * a.seatRoll * radians,
        'ZYX',
      ),
    ),
    new Vector3(1, 1, 1),
  );
}

export function setSeatedEarbudPose(ear: Object3D, side: -1 | 1): void {
  const matrix = seatedEarbudTransform(side);
  ear.position.setFromMatrixPosition(matrix);
  ear.quaternion.setFromRotationMatrix(matrix);
  ear.scale.set(1, 1, 1);
}
