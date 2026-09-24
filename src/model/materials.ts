import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three';

export type MaterialRole =
  | 'plastic'
  | 'interior'
  | 'metal'
  | 'contact'
  | 'sensor'
  | 'grille'
  | 'grilleWire'
  | 'port'
  | 'led';

/** 参数是展示调色，不是对实物折射率、粗糙度或金属成分的测量结果。 */
export function createProductMaterials() {
  const cache = new Map<MaterialRole, MeshStandardMaterial>();
  return {
    get(role: MaterialRole): MeshStandardMaterial {
      const existing = cache.get(role);
      if (existing) return existing;
      let material: MeshStandardMaterial;
      switch (role) {
        case 'plastic':
          material = new MeshPhysicalMaterial({
            color: 0xf4f4f1,
            metalness: 0,
            roughness: 0.24,
            clearcoat: 0.85,
            clearcoatRoughness: 0.19,
            ior: 1.46,
            envMapIntensity: 1,
          });
          break;
        case 'interior':
          material = new MeshPhysicalMaterial({
            color: 0xe4e5df,
            metalness: 0,
            roughness: 0.35,
            clearcoat: 0.35,
            clearcoatRoughness: 0.3,
            ior: 1.46,
            envMapIntensity: 0.85,
          });
          break;
        case 'metal':
          material = new MeshStandardMaterial({
            color: 0xbac1c4,
            metalness: 1,
            roughness: 0.26,
            envMapIntensity: 1.2,
          });
          break;
        case 'contact':
          material = new MeshStandardMaterial({
            color: 0xd4d3c8,
            metalness: 1,
            roughness: 0.21,
            envMapIntensity: 1.3,
          });
          break;
        case 'sensor':
          material = new MeshPhysicalMaterial({
            color: 0x101719,
            metalness: 0.08,
            roughness: 0.16,
            clearcoat: 1,
            clearcoatRoughness: 0.12,
            ior: 1.52,
          });
          break;
        case 'grille':
          material = new MeshStandardMaterial({
            color: 0x151918,
            metalness: 0.12,
            roughness: 0.82,
          });
          break;
        case 'grilleWire':
          material = new MeshStandardMaterial({
            color: 0x444b49,
            metalness: 0.72,
            roughness: 0.49,
            envMapIntensity: 0.7,
          });
          break;
        case 'port':
          material = new MeshStandardMaterial({
            color: 0x252a2b,
            metalness: 0.65,
            roughness: 0.36,
          });
          break;
        case 'led':
          material = new MeshPhysicalMaterial({
            color: 0x84987d,
            roughness: 0.32,
            metalness: 0,
            clearcoat: 0.5,
          });
      }
      material.name = role;
      cache.set(role, material);
      return material;
    },
  };
}
export type ProductMaterials = ReturnType<typeof createProductMaterials>;
