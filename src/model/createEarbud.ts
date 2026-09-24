import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { PRODUCT, mm } from '../config/product';
import { createLoftGeometry, profileSurface } from './geometry';
import { earbudProfile } from './profiles';
import { createEarDetails, recessedSurface } from './details';

export type EarSide = 'left' | 'right';
export function createEarbud(side: EarSide): Group {
  const prefix = side === 'left' ? 'Left' : 'Right',
    group = new Group();
  group.name = `${prefix}Earbud`;
  const surface = recessedSurface(profileSurface(earbudProfile, 2));
  const geometry = createLoftGeometry(earbudProfile, { segments: 144, subdivisions: 10, surface });
  const shell = new Mesh(
    geometry,
    new MeshStandardMaterial({ color: 0xd6dbd7, roughness: 0.74, metalness: 0 }),
  );
  shell.name = `${prefix}EarbudShell`;
  shell.userData.surface = 'continuous-section-loft';
  group.add(shell, createEarDetails(surface, prefix));
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
