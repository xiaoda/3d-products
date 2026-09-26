import { Euler, Quaternion, Vector3 } from 'three';
import { PRODUCT } from '../config/product';
import { setLidAngle, type ProductModel } from './createProduct';
import { seatedEarbudTransform } from './earbudPlacement';
import { clamp01, ease, type MotionValue } from '../interaction/state';

const seats = ([-1, 1] as const).map((side) => {
  const matrix = seatedEarbudTransform(side);
  return {
    position: new Vector3().setFromMatrixPosition(matrix),
    rotation: new Quaternion().setFromRotationMatrix(matrix),
  };
});
const rotations = [
  new Quaternion().setFromEuler(new Euler(0.1, 0.28, 0.18)),
  new Quaternion().setFromEuler(new Euler(-0.06, -0.28, -0.18)),
];

/** 先沿倾斜收纳槽小幅导向提升；完全脱离盒口后才展开/转动。反向采样严格原路归位。 */
export function applyProductMotion(
  product: Pick<ProductModel, 'root' | 'parts'>,
  value: MotionValue,
  perEar: readonly [number, number] = [value.extraction, value.extraction],
) {
  if (!Number.isFinite(value.lid + value.extraction)) throw new RangeError('无效动作参数');
  const extraction = clamp01(value.extraction);
  setLidAngle(
    product,
    (Math.max(...perEar) > 0 ? 1 : clamp01(value.lid)) * PRODUCT.assembly.openAngle,
  );
  for (const [index, ear] of [product.parts.leftEarbud, product.parts.rightEarbud].entries()) {
    const amount = clamp01(perEar[index]);
    const lift = ease(amount / 0.68);
    const spread = ease((amount - 0.68) / 0.32);
    const height = 3.65 * lift;
    const guide =
      height <= 0.9
        ? height
        : height < 1.3
          ? 0.9 + (height - 0.9) - (height - 0.9) ** 2 / 0.8
          : 1.1;
    const side = index === 0 ? -1 : 1,
      seat = seats[index];
    ear.position.copy(seat.position);
    ear.position.y += 3.65 * lift + 0.25 * spread;
    ear.position.x += side * (0.08 * guide + 0.5 * spread);
    ear.position.z += 0.022 * ease((3.65 * lift - 0.35) / 0.65) + 0.45 * spread;
    ear.quaternion.copy(seat.rotation).slerp(rotations[index], spread);
    ear.scale.set(1, 1, 1);
  }
  product.root.userData.pose =
    extraction === 1
      ? 'separated'
      : extraction > 0
        ? 'custom'
        : value.lid === 0
          ? 'closed'
          : value.lid === 1
            ? 'open'
            : 'custom';
  product.root.updateMatrixWorld(true);
}
