import { BufferGeometry, Group, Mesh } from 'three';
import { createDetailedEarbud } from './createDetailedEarbud';
import { createProductMaterials, type MaterialRole, type ProductMaterials } from './materials';

export type EarSide = 'left' | 'right';
interface EarTemplate {
  name: string;
  geometry: BufferGeometry;
  roles: MaterialRole[];
}
let templates: EarTemplate[] | undefined;

/** 固定 C 参数只计算一次。模板仅在 CPU，永不加入场景；每个实例克隆独立几何。 */
function acceptedTemplates(): EarTemplate[] {
  if (templates) return templates;
  const model = createDetailedEarbud('right');
  try {
    templates = model.root.children.map((object) => {
      const mesh = object as Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      return {
        name: mesh === model.shell ? 'EarbudShell' : mesh.name,
        geometry: mesh.geometry.clone(),
        roles: materials.map((material) => material.name as MaterialRole),
      };
    });
    return templates;
  } finally {
    // 包括评审控制器保留的裸壳。生产实例不携带细节开关或该控制器的生命周期。
    model.dispose();
  }
}

/** 正式装配直接采用已确认 C 几何；不按产品包围盒二次平移/缩放。 */
export function createEarbud(
  side: EarSide,
  materials: ProductMaterials = createProductMaterials(),
): Group {
  const root = new Group(),
    prefix = side === 'left' ? 'Left' : 'Right';
  root.name = `${prefix}Earbud`;
  for (const template of acceptedTemplates()) {
    const geometry = template.geometry.clone();
    if (side === 'left') {
      geometry.scale(-1, 1, 1);
      const index = geometry.index!;
      for (let i = 0; i < index.count; i += 3) {
        const b = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, b);
      }
    }
    const roles = template.roles.map((role) => materials.get(role));
    const mesh = new Mesh(geometry, roles.length === 1 ? roles[0] : roles);
    mesh.name = prefix + template.name;
    root.add(mesh);
  }
  root.userData.model = 'accepted-control-surface-with-details';
  root.userData.normalizedByBounds = false;
  return root;
}
