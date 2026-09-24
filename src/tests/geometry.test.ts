import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createLoftGeometry, sampleProfile, superellipse } from '../model/geometry';

describe('连续截面工具', () => {
  const profile = [
    { y: -1, rx: 0, rz: 0, cx: 0, cz: 0 },
    { y: -0.5, rx: 0.8, rz: 0.6, cx: 0.1, cz: 0 },
    { y: 0.5, rx: 1, rz: 0.7, cx: 0.2, cz: 0 },
    { y: 1, rx: 0, rz: 0, cx: 0.1, cz: 0 },
  ];
  it('插值经过控制截面且不会越过相邻半径范围', () => {
    expect(sampleProfile(profile, -0.5).rx).toBeCloseTo(0.8);
    for (let y = -0.5; y <= 0.5; y += 0.01) {
      expect(sampleProfile(profile, y).rx).toBeGreaterThanOrEqual(0.8);
      expect(sampleProfile(profile, y).rx).toBeLessThanOrEqual(1);
    }
  });
  it('超椭圆截面满足边界方程', () => {
    for (let i = 0; i < 24; i++) {
      const [x, z] = superellipse((i * Math.PI) / 12, 2, 1, 3.5);
      expect(Math.abs(x / 2) ** 3.5 + Math.abs(z) ** 3.5).toBeCloseTo(1, 6);
    }
  });
  it('闭合放样网格每条边被两个三角形共享，且没有退化面', () => {
    const geometry = createLoftGeometry(profile, { segments: 32, subdivisions: 5 });
    const p = geometry.getAttribute('position');
    const index = geometry.index!;
    const edges = new Map<string, number>();
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      const vertices = ids.map((v) => new Vector3().fromBufferAttribute(p, v));
      const area = vertices[1]
        .clone()
        .sub(vertices[0])
        .cross(vertices[2].clone().sub(vertices[0]))
        .length();
      expect(area).toBeGreaterThan(1e-10);
      for (let k = 0; k < 3; k++) {
        const key = [ids[k], ids[(k + 1) % 3]].sort((a, b) => a - b).join(':');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every((count) => count === 2)).toBe(true);
    geometry.dispose();
  });
  it('拒绝无序截面和无效细分', () => {
    expect(() => createLoftGeometry([...profile].reverse())).toThrow();
    expect(() => createLoftGeometry(profile, { segments: 2 })).toThrow();
  });
});
