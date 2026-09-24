/** 636d080 原耳机，仅开发对照；不得用于正式产品或新收纳包络。 */
import { Box3, Group, Mesh, Vector3 } from 'three';
import { PRODUCT, mm } from '../config/product';
import { createEarbudGeometry, earbudSurface } from '../model/earbudSurface';
import { createEarDetails, recessedSurface, earRecesses } from '../model/details';
import { createProductMaterials, type ProductMaterials } from '../model/materials';

export type EarSide = 'left' | 'right';
export function createLegacyEarbud(
  side: EarSide,
  materials: ProductMaterials = createProductMaterials(),
): Group {
  const prefix = side === 'left' ? 'Left' : 'Right',
    group = new Group();
  group.name = `${prefix}Earbud`;
  const surface = recessedSurface(earbudSurface);
  // 小开口附近加密纵向采样，避免孔缘落在稀疏环之间形成波浪形切边。
  const detailSamples = earRecesses.flatMap((r) =>
    Array.from({ length: 25 }, (_, i) => r.u + (r.radiusU * (i - 12)) / 10),
  );
  const geometry = createEarbudGeometry(surface, { detailSamples });
  const shell = new Mesh(geometry, materials.get('plastic'));
  shell.name = `${prefix}EarbudShell`;
  shell.userData.surface = 'bent-asymmetric-loft';
  group.add(shell, createEarDetails(surface, prefix, materials));
  group.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(group, true),
    center = bounds.getCenter(new Vector3()),
    size = bounds.getSize(new Vector3());
  const scale = new Vector3(
    mm(PRODUCT.earbud.width) / size.x,
    mm(PRODUCT.earbud.height) / size.y,
    mm(PRODUCT.earbud.depth) / size.z,
  );
  group.userData.normalization = { center: center.toArray(), scale: scale.toArray() };
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.applyMatrix4(object.matrixWorld);
    object.geometry.translate(-center.x, -center.y, -center.z);
    object.geometry.scale(side === 'left' ? -scale.x : scale.x, scale.y, scale.z);
    if (side === 'left') {
      const index = object.geometry.index!;
      for (let i = 0; i < index.count; i += 3) {
        const value = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, value);
      }
    }
    // 几何变换已通过法线矩阵变换法线；保留球体极点的解析法线。
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);
  });
  group.updateMatrixWorld(true);
  return group;
}
