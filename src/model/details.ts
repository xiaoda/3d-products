import { BufferGeometry, Float32BufferAttribute, Group, Mesh, SphereGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { surfaceNormal, type Surface } from './geometry';
import type { ProductMaterials } from './materials';

export interface Recess {
  name: string;
  u: number;
  angle: number;
  radiusU: number;
  span: number;
  depth: number;
  grille: boolean;
}
/** u 为弯曲曲面的纵向参数，不是世界坐标高度。 */
export const earRecesses: Recess[] = [
  {
    name: 'Speaker',
    u: 0.909,
    angle: -0.035,
    radiusU: 0.03,
    span: 0.82,
    depth: 0.035,
    grille: true,
  },
  {
    name: 'Sensor',
    u: 0.837,
    angle: -0.227,
    radiusU: 0.0175,
    span: 0.255,
    depth: 0.021,
    grille: false,
  },
  {
    name: 'OuterMic',
    u: 0.529,
    angle: -1.431,
    radiusU: 0.058,
    span: 0.67,
    depth: 0.025,
    grille: true,
  },
  { name: 'Vent', u: 0.732, angle: -1.047, radiusU: 0.042, span: 0.61, depth: 0.023, grille: true },
];

export function recessedSurface(base: Surface): Surface {
  return (y, angle) => {
    const p = base(y, angle);
    let inset = 0;
    for (const recess of earRecesses) {
      const delta = Math.atan2(Math.sin(angle - recess.angle), Math.cos(angle - recess.angle));
      const radius = Math.hypot(delta / recess.span, (y - recess.u) / recess.radiusU);
      if (radius >= 1.1) continue;
      const t = Math.max(0, Math.min(1, (radius - 0.74) / 0.36));
      inset += recess.depth * (1 - t * t * (3 - 2 * t));
    }
    if (inset > 0) p.addScaledVector(surfaceNormal(base, y, angle), -inset);
    return p;
  };
}

function patchGeometry(
  surface: Surface,
  recess: Recess,
  startRadius: number,
  endRadius: number,
  offset: number,
): BufferGeometry {
  const positions: number[] = [],
    indices: number[] = [];
  const count = 64,
    steps = 4;
  const add = (r: number, phi: number) => {
    const y = recess.u + Math.sin(phi) * recess.radiusU * r,
      angle = recess.angle + Math.cos(phi) * recess.span * r;
    const p = surface(y, angle).addScaledVector(surfaceNormal(surface, y, angle), offset);
    positions.push(p.x, p.y, p.z);
  };
  const start = startRadius === 0 ? 1 : 0;
  if (start) {
    const p = surface(recess.u, recess.angle).addScaledVector(
      surfaceNormal(surface, recess.u, recess.angle),
      offset,
    );
    positions.push(p.x, p.y, p.z);
  }
  const rings: number[][] = [];
  for (let j = start; j <= steps; j++) {
    const r = startRadius + ((endRadius - startRadius) * j) / steps,
      ring: number[] = [];
    for (let i = 0; i < count; i++) {
      ring.push(positions.length / 3);
      add(r, (i / count) * Math.PI * 2);
    }
    rings.push(ring);
  }
  if (start)
    for (let i = 0; i < count; i++) indices.push(0, rings[0][(i + 1) % count], rings[0][i]);
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count,
        a = rings[j][i],
        b = rings[j][next],
        c = rings[j + 1][i],
        d = rings[j + 1][next];
      indices.push(a, b, c, b, d, c);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function grilleGeometry(surface: Surface, recess: Recess): BufferGeometry {
  const positions: number[] = [],
    indices: number[] = [];
  const add = (u: number, v: number) => {
    const y = recess.u + v * recess.radiusU,
      a = recess.angle + u * recess.span;
    const p = surface(y, a).addScaledVector(surfaceNormal(surface, y, a), 0.011);
    positions.push(p.x, p.y, p.z);
  };
  for (const swap of [false, true])
    for (let line = -7; line <= 7; line++) {
      const v = line * 0.1,
        half = 0.013,
        length = Math.sqrt(0.8 ** 2 - (Math.abs(v) + half) ** 2);
      for (let segment = 0; segment < 16; segment++) {
        const u0 = -length + (2 * length * segment) / 16,
          u1 = -length + (2 * length * (segment + 1)) / 16,
          base = positions.length / 3;
        for (const [u, w] of [
          [u0, v - half],
          [u1, v - half],
          [u1, v + half],
          [u0, v + half],
        ])
          swap ? add(w, u) : add(u, w);
        if (swap) indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        else indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createEarDetails(
  surface: Surface,
  prefix: string,
  materials: ProductMaterials,
): Group {
  const group = new Group();
  group.name = `${prefix}EarDetails`;
  const rim = materials.get('plastic');
  const lattice = materials.get('grilleWire');
  for (const recess of earRecesses) {
    const border = new Mesh(patchGeometry(surface, recess, 0.83, 0.96, 0.003), rim);
    border.name = `${prefix}${recess.name}Rim`;
    const face = new Mesh(
      patchGeometry(surface, recess, 0, 0.83, 0.005),
      materials.get(recess.grille ? 'grille' : 'sensor'),
    );
    face.name = `${prefix}${recess.name}${recess.grille ? 'Grille' : ''}`;
    group.add(border, face);
    if (recess.grille) {
      const grid = new Mesh(grilleGeometry(surface, recess), lattice);
      grid.name = `${prefix}${recess.name}Lattice`;
      group.add(grid);
    }
  }
  const tip = new Mesh(new SphereGeometry(1, 32, 16), materials.get('contact'));
  tip.name = `${prefix}ChargingContact`;
  tip.scale.set(0.252, 0.05, 0.233);
  tip.position.set(0.36, -1.455, -0.6);
  group.add(tip);
  return group;
}

export function createCaseDetails(materials: ProductMaterials): Group {
  const group = new Group();
  group.name = 'CaseDetails';
  const material = materials.get('metal');
  const hinge = new Mesh(new RoundedBoxGeometry(1.5, 0.2, 0.075, 3, 0.035), material);
  hinge.name = 'Hinge';
  hinge.position.set(0, 3.28, -1.03);
  group.add(hinge);
  for (const x of [-0.54, 0.54]) {
    const joint = new Mesh(
      new RoundedBoxGeometry(0.016, 0.19, 0.004, 1, 0.002),
      materials.get('port'),
    );
    joint.position.set(x, 3.28, -1.069);
    group.add(joint);
  }
  const led = new Mesh(new SphereGeometry(0.036, 24, 12), materials.get('led'));
  led.name = 'StatusLight';
  // 仅 0.02 mm 表面偏移，避免被外壳覆盖；不是发光材质。
  led.scale.z = 0.11;
  led.position.set(0, 3.045, 1.058);
  group.add(led);
  return group;
}
