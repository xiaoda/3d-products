import { createEarbudGeometry } from '../model/earbudSurface';
import { createLegacyEarbud } from './legacyEarbud';
import { disposeProduct } from '../model/createProduct';

/** 仅用于对照 636d080 的裸壳；保留它当时的尺寸处理，不加入凹槽或附件。 */
export function createLegacyEarbudShell() {
  const ear = createLegacyEarbud('right');
  try {
    const { center, scale } = ear.userData.normalization as {
      center: [number, number, number];
      scale: [number, number, number];
    };
    const geometry = createEarbudGeometry();
    geometry.translate(-center[0], -center[1], -center[2]);
    geometry.scale(...scale);
    return geometry;
  } finally {
    disposeProduct(ear);
  }
}
