import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createCase } from '../model/createCase';
import { disposeProduct } from '../model/createProduct';
import { sampleProfile } from '../model/geometry';
import { bodyProfile, lidProfile } from '../model/profiles';
import { caseDistance } from '../model/caseSurface';
import { cavityProfile, cavityContourAt } from '../model/earbudCavity';

describe('充电盒外形校准', () => {
  it('非圆收纳槽位于外壳以内，截面采样至少保留 0.2 mm 外壁', () => {
    for (const kind of ['body', 'lid'] as const)
      for (const side of [-1, 1] as const) {
        const cavity = cavityProfile(kind, side),
          outer = kind === 'body' ? bodyProfile : lidProfile;
        let distance = -Infinity;
        for (let i = 0; i < cavity.length - 1; i++)
          for (let j = 0; j <= 3; j++) {
            const y = cavity[i].y + ((cavity[i + 1].y - cavity[i].y) * j) / 3;
            for (const p of cavityContourAt(cavity, y))
              distance = Math.max(distance, caseDistance(sampleProfile(outer, y), p.x, p.y));
          }
        expect(distance, `${kind}/${side} 内腔越过外壳`).toBeLessThan(-0.02);
      }
  });
  it('盒盖从接缝上方即开始收肩，顶部不保留过大的平盖', () => {
    expect(sampleProfile(lidProfile, 3.7).rx).toBeLessThan(2.43);
    expect(sampleProfile(lidProfile, 4.3).rx).toBeLessThan(2.02);
    expect(lidProfile.at(-1)!.rz).toBeLessThan(0.01);
  });
  it('俯视两端接近半圆而非超椭圆的方角', () => {
    const product = createCase();
    try {
      const mesh = product.group.getObjectByName('LidOuterShell') as import('three').Mesh;
      const p = mesh.geometry.getAttribute('position');
      let violations = 0;
      for (let i = 0; i < p.count; i++) {
        const v = new Vector3().fromBufferAttribute(p, i);
        const s = sampleProfile(lidProfile, v.y);
        const dx = Math.max(0, Math.abs(v.x) - (s.rx - s.rz));
        if (dx * dx + v.z * v.z > s.rz * s.rz + 1e-5) violations++;
      }
      expect(violations).toBe(0);
    } finally {
      disposeProduct(product.group);
    }
  });
});
