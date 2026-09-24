import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { surfaceNormal, type Surface } from './geometry';

export interface Recess {
  name: string;
  y: number;
  angle: number;
  height: number;
  span: number;
  depth: number;
  grille: boolean;
}
export const earRecesses: Recess[] = [
  { name: 'Speaker', y: 0.64, angle: 2.28, height: 0.43, span: 0.47, depth: 0.08, grille: true },
  { name: 'Sensor', y: 0.84, angle: 1.26, height: 0.135, span: 0.135, depth: 0.026, grille: false },
  { name: 'OuterMic', y: 0.62, angle: -0.06, height: 0.29, span: 0.14, depth: 0.036, grille: true },
  { name: 'Vent', y: 1.2, angle: 4.57, height: 0.12, span: 0.3, depth: 0.025, grille: true },
];

export function recessedSurface(base: Surface): Surface {
  return (y, angle) => {
    const p = base(y, angle);
    let inset = 0;
    for (const recess of earRecesses) {
      const delta = Math.atan2(Math.sin(angle - recess.angle), Math.cos(angle - recess.angle));
      const radius = Math.hypot(delta / recess.span, (y - recess.y) / recess.height);
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
    const y = recess.y + Math.sin(phi) * recess.height * r,
      angle = recess.angle + Math.cos(phi) * recess.span * r;
    const p = surface(y, angle).addScaledVector(surfaceNormal(surface, y, angle), offset);
    positions.push(p.x, p.y, p.z);
  };
  const start = startRadius === 0 ? 1 : 0;
  if (start) {
    const p = surface(recess.y, recess.angle).addScaledVector(
      surfaceNormal(surface, recess.y, recess.angle),
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
    const y = recess.y + v * recess.height,
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

export function createEarDetails(surface: Surface, prefix: string): Group {
  const group = new Group();
  group.name = `${prefix}EarDetails`;
  const inset = new MeshStandardMaterial({ color: 0x454c49, roughness: 0.83, metalness: 0 });
  const rim = new MeshStandardMaterial({ color: 0xc5cdc7, roughness: 0.78, metalness: 0 });
  const lattice = new MeshStandardMaterial({ color: 0x78817c, roughness: 0.9, metalness: 0 });
  for (const recess of earRecesses) {
    const border = new Mesh(patchGeometry(surface, recess, 0.83, 0.96, 0.003), rim);
    border.name = `${prefix}${recess.name}Rim`;
    const face = new Mesh(patchGeometry(surface, recess, 0, 0.83, 0.005), inset);
    face.name = `${prefix}${recess.name}${recess.grille ? 'Grille' : ''}`;
    group.add(border, face);
    if (recess.grille) {
      const grid = new Mesh(grilleGeometry(surface, recess), lattice);
      grid.name = `${prefix}${recess.name}Lattice`;
      group.add(grid);
    }
  }
  const tip = new Mesh(new SphereGeometry(1, 32, 16), rim);
  tip.name = `${prefix}ChargingContact`;
  tip.scale.set(0.241, 0.073, 0.217);
  tip.position.set(0.28, -1.429, -0.27);
  group.add(tip);
  return group;
}

export function createCaseDetails(): Group {
  const group = new Group();
  group.name = 'CaseDetails';
  const material = new MeshStandardMaterial({ color: 0x909994, roughness: 0.8, metalness: 0 });
  const hinge = new Mesh(new RoundedBoxGeometry(1.5, 0.2, 0.075, 3, 0.035), material);
  hinge.name = 'Hinge';
  hinge.position.set(0, 3.28, -1.03);
  group.add(hinge);
  for (const x of [-0.54, 0.54]) {
    const joint = new Mesh(new RoundedBoxGeometry(0.016, 0.19, 0.004, 1, 0.002), material);
    joint.position.set(x, 3.28, -1.069);
    group.add(joint);
  }
  const led = new Mesh(new SphereGeometry(0.036, 24, 12), material);
  led.name = 'StatusLight';
  // 仅 0.02 mm 表面偏移，避免被外壳覆盖；不是发光材质。
  led.scale.z = 0.11;
  led.position.set(0, 3.045, 1.058);
  group.add(led);
  return group;
}
