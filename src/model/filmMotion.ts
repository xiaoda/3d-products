import { Euler, Quaternion } from 'three';
import type { ProductModel } from './createProduct';
import { applyProductMotion } from './productMotion';
import { wipeOffset, type FilmSample } from '../interaction/films';

export function resetFilmRig(product: Pick<ProductModel, 'root' | 'parts'>) {
  product.root.position.set(0, 0, 0);
  product.root.rotation.set(0, 0, 0);
  product.parts.caseAssembly.position.set(0, 0, 0);
  product.parts.caseAssembly.rotation.set(0, 0, 0);
}
/** 每次从同源收纳轨道重建，编舞只在完全离槽时叠加，无增量累积。 */
export function applyFilmMotion(product: Pick<ProductModel, 'root' | 'parts'>, s: FilmSample) {
  resetFilmRig(product);
  applyProductMotion(product, s, [s.left, s.right]);
  const { leftEarbud: left, rightEarbud: right, caseAssembly: box } = product.parts;
  const d = s.dance,
    t = s.time;
  if (s.id === 'reveal') {
    left.position.y += 0.65 * d;
    right.position.y += 0.15 * d;
    left.position.x -= 0.35 * d;
    right.position.z += 0.65 * d;
    const [x, y, z] = wipeOffset(s.wipe);
    left.position.x += x;
    left.position.y += y;
    left.position.z += z;
    right.quaternion.multiply(
      new Quaternion().setFromEuler(new Euler(0.1 * d, 0.35 * d, -0.12 * d)),
    );
    left.quaternion.multiply(
      new Quaternion().setFromEuler(new Euler(-0.1 * d, -0.4 * d - s.wipe, 0.25 * d)),
    );
  } else if (s.id === 'sculpture') {
    // 整套共同抬升；在出入槽阶段，耳机与盒体没有额外相对倾斜。
    product.root.position.y = 0.9 * s.float;
    product.root.rotation.z = -0.09 * Math.sin((t * Math.PI) / 10) * s.float;
    box.rotation.z = 0.13 * d;
    box.rotation.y = -0.18 * d;
    const orbit = (t - 8) * 0.7;
    left.position.x -= (0.75 + 0.35 * Math.sin(orbit)) * d;
    right.position.x += (0.75 + 0.35 * Math.cos(orbit)) * d;
    left.position.y += (1.0 + 0.65 * Math.sin(orbit)) * d;
    right.position.y += (0.65 + 0.45 * Math.cos(orbit)) * d;
    left.position.z += 1.15 * Math.cos(orbit) * d;
    right.position.z -= 1.0 * Math.sin(orbit) * d;
    left.quaternion.multiply(
      new Quaternion().setFromEuler(new Euler(0.25 * d, 0.65 * Math.sin(orbit) * d, -0.35 * d)),
    );
    right.quaternion.multiply(
      new Quaternion().setFromEuler(new Euler(-0.2 * d, -0.5 * Math.cos(orbit) * d, 0.4 * d)),
    );
  } else {
    left.position.y += 0.45 * d;
    right.position.z += 0.4 * d;
    right.quaternion.multiply(new Quaternion().setFromEuler(new Euler(0, 0.45 * d, -0.1 * d)));
  }
  product.root.updateMatrixWorld(true);
}
