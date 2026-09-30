import {
  Box3,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Plane,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createEarbud } from './createEarbud';
import { createProductMaterials } from './materials';
import { EAR_FEATURES, featureFrame } from './earbudFeatures';
import { EXPLODED_PARTS, type ExplodedPartId, type ExplodedPose } from './explodedEarbudDefinition';
import { splitHollowShell } from './splitEarbudShell';
import type { ExplodedFilmSample } from '../interaction/explodedFilm';
import { createExplodedLayout } from './explodedLayout';

const Z = new Vector3(0, 0, 1);
type Point = readonly [number, number, number];

/** 独立功能结构示意：不更改 acceptedTemplates，也不参与正式装配。 */
export function createExplodedEarbud() {
  const root = new Group();
  root.name = 'ExplodedEarbudSchematic';
  root.userData.schematic = true;
  const originalMaterials = createProductMaterials();
  const complete = createEarbud('right', originalMaterials);
  root.add(complete);
  const parts = Object.fromEntries(
    EXPLODED_PARTS.map((spec) => {
      const part = new Group();
      part.name = spec.id;
      part.userData = { schematic: true, title: spec.title };
      root.add(part);
      return [spec.id, part];
    }),
  ) as Record<ExplodedPartId, Group>;
  const materials = {
    interior: new MeshStandardMaterial({ color: 0xd8dcd7, roughness: 0.57 }),
    metal: new MeshStandardMaterial({ color: 0xb8c3c8, metalness: 0.94, roughness: 0.3 }),
    battery: new MeshStandardMaterial({ color: 0xc7ccc6, metalness: 0.86, roughness: 0.34 }),
    dark: new MeshStandardMaterial({ color: 0x252e2d, roughness: 0.6, metalness: 0.12 }),
    membrane: new MeshPhysicalMaterial({
      color: 0x5f6767,
      metalness: 0.42,
      roughness: 0.3,
      clearcoat: 0.5,
    }),
    copper: new MeshStandardMaterial({ color: 0xb8813e, metalness: 0.82, roughness: 0.3 }),
    flex: new MeshStandardMaterial({ color: 0x98511e, metalness: 0.2, roughness: 0.38 }),
    pcb: new MeshStandardMaterial({ color: 0x214b41, metalness: 0.12, roughness: 0.5 }),
    ceramic: new MeshStandardMaterial({ color: 0xd0be96, roughness: 0.55, metalness: 0.1 }),
    glass: originalMaterials.get('sensor'),
  };
  for (const [name, material] of Object.entries(materials)) material.name ||= `Schematic-${name}`;

  function add(
    parent: Group,
    geometry: BufferGeometry,
    material: Material,
    position: Point = [0, 0, 0],
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function box(parent: Group, size: Point, position: Point, material: Material, radius = 0.012) {
    return add(
      parent,
      new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map((v) => v / 3))),
      material,
      position,
    );
  }
  function disc(parent: Group, radius: number, depth: number, z: number, material: Material) {
    const mesh = add(parent, new CylinderGeometry(radius, radius, depth, 64), material, [0, 0, z]);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }
  function ring(parent: Group, radius: number, tube: number, z: number, material: Material) {
    return add(parent, new TorusGeometry(radius, tube, 12, 72), material, [0, 0, z]);
  }

  // 沿贯穿头部及耳柄的斜面分壳；这不是实物接缝。
  const plane = new Plane(new Vector3(0.16, -0.4, 1).normalize(), 0.22 / Math.sqrt(1.1856));
  for (const child of complete.children) {
    if (!(child instanceof Mesh)) continue;
    if (child.name.endsWith('EarbudShell')) {
      const outer = Array.isArray(child.material) ? child.material : [child.material];
      const halves = splitHollowShell(child.geometry, plane, 0.038, outer.length);
      halves.forEach((geometry, i) => {
        const mesh = new Mesh(geometry, [...outer, materials.interior]);
        mesh.name = i === 0 ? 'FrontSectionWithWall' : 'RearSectionWithWall';
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        (i === 0 ? parts.frontShell : parts.backShell).add(mesh);
      });
    } else {
      const center = new Box3().setFromObject(child).getCenter(new Vector3());
      const copy = new Mesh(child.geometry.clone(), child.material);
      copy.name = child.name;
      (plane.distanceToPoint(center) >= 0 ? parts.frontShell : parts.backShell).add(copy);
    }
  }

  // 以出音口方向建立声学轴，但不虚构实物扬声器尺寸。
  const speaker = featureFrame(EAR_FEATURES.find((f) => f.id === 'speaker')!);
  const driver = new Group();
  driver.position.copy(speaker.center).addScaledVector(speaker.normal, -0.395);
  // 为新增的内壁和同步脱离留出净空，保留声学组自身尺寸。
  driver.position.x += 0.18;
  driver.position.y += 0.29;
  driver.quaternion.setFromUnitVectors(Z, speaker.normal);
  parts.driver.add(driver);
  disc(driver, 0.31, 0.14, -0.025, materials.dark);
  disc(driver, 0.19, 0.09, -0.13, materials.metal);
  ring(driver, 0.288, 0.023, 0.052, materials.metal);
  disc(driver, 0.252, 0.015, 0.054, materials.membrane);
  for (const radius of [0.18, 0.215, 0.24]) ring(driver, radius, 0.005, 0.068, materials.dark);
  const dome = add(driver, new SphereGeometry(0.158, 40, 20), materials.membrane, [0, 0, 0.06]);
  dome.scale.z = 0.23;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rib = box(
      driver,
      [0.035, 0.105, 0.015],
      [Math.cos(a) * 0.237, Math.sin(a) * 0.237, -0.1],
      materials.metal,
      0.003,
    );
    rib.rotation.z = a - Math.PI / 2;
  }
  box(driver, [0.11, 0.08, 0.025], [0.2, -0.16, -0.12], materials.copper);

  const cell = new Group();
  cell.position.set(0.14, 0.74, -0.065);
  parts.battery.add(cell);
  disc(cell, 0.335, 0.265, 0, materials.battery);
  ring(cell, 0.321, 0.013, 0.128, materials.metal);
  disc(cell, 0.26, 0.014, 0.142, materials.metal);
  ring(cell, 0.272, 0.012, 0.146, materials.dark);
  // 端子与绝缘圈，不标任何未经测量的容量或商标。
  box(cell, [0.105, 0.15, 0.022], [0.19, -0.2, 0.157], materials.copper);
  box(cell, [0.105, 0.14, 0.022], [-0.16, -0.22, -0.145], materials.copper);

  const pcb = new Group();
  pcb.position.set(0.405, -0.59, -0.56);
  parts.logic.add(pcb);
  box(pcb, [0.29, 1.13, 0.05], [0, 0, 0], materials.pcb, 0.028);
  for (let i = 0; i < 4; i++)
    box(pcb, [0.008, 0.96, 0.004], [-0.11 + i * 0.074, 0, 0.028], materials.copper, 0.001);
  box(pcb, [0.22, 0.39, 0.073], [0, 0.17, 0.06], materials.dark);
  box(pcb, [0.17, 0.21, 0.05], [0, -0.23, 0.048], materials.metal);
  for (const side of [-1, 1])
    for (let i = 0; i < 7; i++) {
      box(
        pcb,
        [0.035, 0.013, 0.012],
        [side * 0.12, 0.015 + i * 0.049, 0.036],
        materials.copper,
        0.001,
      );
    }
  for (let i = 0; i < 4; i++) {
    box(
      pcb,
      [0.05, 0.07, 0.03],
      [-0.075 + (i % 2) * 0.14, -0.43 + Math.floor(i / 2) * 0.08, 0.041],
      materials.ceramic,
      0.005,
    );
  }
  for (let i = 0; i < 5; i++)
    box(pcb, [0.03, 0.052, 0.008], [-0.1 + i * 0.05, 0.517, 0.03], materials.copper, 0.001);

  function ribbon(points: Point[], width: number, material: Material, shift = 0) {
    const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
    const position: number[] = [],
      index: number[] = [];
    const segments = 48,
      thickness = 0.008;
    for (let i = 0; i <= segments; i++) {
      const p = curve.getPoint(i / segments);
      for (const [x, z] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ])
        position.push(p.x + (x * width) / 2 + shift, p.y, p.z + (z * thickness) / 2);
      if (i < segments)
        for (let j = 0; j < 4; j++) {
          const a = i * 4 + j,
            b = i * 4 + ((j + 1) % 4);
          index.push(a, b, a + 4, b, b + 4, a + 4);
        }
    }
    index.push(0, 2, 1, 0, 3, 2);
    const last = segments * 4;
    index.push(last, last + 1, last + 2, last, last + 2, last + 3);
    // 截面点沿 +Y 看为逆绕序，统一翻转后让四壁和端盖法线朝外。
    for (let i = 0; i < index.length; i += 3) {
      const b = index[i + 1];
      index[i + 1] = index[i + 2];
      index[i + 2] = b;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    add(parts.flex, geometry, material);
  }
  const flexPath: Point[] = [
    [0.4, -0.08, -0.53],
    [0.36, 0.16, -0.4],
    [0.29, 0.3, 0.025],
    [0.33, 0.52, 0.057],
  ];
  ribbon(flexPath, 0.14, materials.flex);
  for (const shift of [-0.045, 0, 0.045])
    ribbon(
      flexPath.map(([x, y, z]) => [x, y, z + 0.006]),
      0.008,
      materials.copper,
      shift,
    );
  driver.updateWorldMatrix(true, false);
  const terminal = driver.localToWorld(new Vector3(0.2, -0.16, -0.12));
  const acousticFlex: Point[] = [
    [0.4, -0.05, -0.53],
    [0.36, 0.3, -0.32],
    [0.1, 0.47, 0.16],
    terminal.toArray(),
  ];
  ribbon(acousticFlex, 0.075, materials.flex);
  for (const shift of [-0.024, 0.024])
    ribbon(
      acousticFlex.map(([x, y, z]) => [x, y, z + 0.006]),
      0.006,
      materials.copper,
      shift,
    );

  for (const id of ['sensor', 'outerMic', 'bottomMic']) {
    const frame = featureFrame(EAR_FEATURES.find((f) => f.id === id)!);
    const module = new Group();
    module.position
      .copy(frame.center)
      .addScaledVector(frame.normal, id === 'sensor' ? -0.115 : -0.1);
    module.quaternion.setFromUnitVectors(Z, frame.normal);
    parts.sensing.add(module);
    const scale = id === 'bottomMic' ? 0.65 : 1;
    box(module, [0.18 * scale, 0.14 * scale, 0.032], [0, 0, 0], materials.pcb);
    box(
      module,
      [0.13 * scale, 0.1 * scale, 0.042],
      [0, 0, 0.032],
      id === 'sensor' ? materials.glass : materials.metal,
    );
    if (id !== 'sensor') disc(module, 0.014, 0.004, 0.056, materials.dark);
  }

  for (const id of ['contactFront', 'contactInner']) {
    const frame = featureFrame(EAR_FEATURES.find((f) => f.id === id)!);
    const connector = new Group();
    connector.position.copy(frame.center).addScaledVector(frame.normal, -0.063);
    connector.quaternion.setFromUnitVectors(Z, frame.normal);
    parts.contacts.add(connector);
    box(connector, [0.095, 0.19, 0.02], [0, 0, 0], materials.copper);
    box(connector, [0.05, 0.12, 0.035], [0, 0.13, -0.013], materials.metal);
  }

  const rest = new Map<ExplodedPartId, Vector3>();
  for (const spec of EXPLODED_PARTS) {
    const part = parts[spec.id];
    part.updateMatrixWorld(true);
    const center = new Box3().setFromObject(part).getCenter(new Vector3());
    // 将枢轴放在自己的几何中心，不围绕全局原点旋转外壳。
    for (const child of part.children) child.position.sub(center);
    part.position.copy(center);
    rest.set(spec.id, center);
  }
  const layout = createExplodedLayout(parts);
  let pose: ExplodedPose = 'assembled',
    disposed = false;
  function setPose(next: ExplodedPose) {
    if (disposed) return;
    if (!['assembled', 'inside', 'exploded'].includes(next)) throw new RangeError('未知结构姿态');
    pose = next;
    complete.visible = next === 'assembled';
    for (const spec of EXPLODED_PARTS) {
      const part = parts[spec.id];
      part.position.copy(rest.get(spec.id)!);
      part.quaternion.copy(new Quaternion());
      part.visible = next !== 'assembled' && (next === 'exploded' || !spec.id.endsWith('Shell'));
      if (next === 'exploded') {
        part.position.add(new Vector3(...spec.offset));
        part.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);
      }
    }
    layout.apply(next === 'exploded' ? 1 : 0);
    root.updateMatrixWorld(true);
  }
  setPose('assembled');
  return {
    root,
    complete,
    parts,
    setPose,
    applyFilm(sample: ExplodedFilmSample) {
      if (disposed) return;
      pose = sample.assembled ? 'assembled' : 'exploded';
      complete.visible = sample.assembled;
      for (const spec of EXPLODED_PARTS) {
        const part = parts[spec.id],
          transform = sample.transforms[spec.id];
        part.position.copy(rest.get(spec.id)!).add(new Vector3(...transform.offset));
        part.rotation.set(...transform.rotation);
        part.visible = !sample.assembled;
      }
      layout.apply(sample.open);
      root.updateMatrixWorld(true);
    },
    get pose() {
      return pose;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set<BufferGeometry>(),
        usedMaterials = new Set<Material>(Object.values(materials));
      root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          usedMaterials.add(material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of usedMaterials) material.dispose();
      root.clear();
    },
  };
}
