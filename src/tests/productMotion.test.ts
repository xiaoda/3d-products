import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Mesh, Vector3 } from 'three';
import { createProduct, disposeProduct, setProductPose } from '../model/createProduct';
import { applyProductMotion } from '../model/productMotion';
import { cavityProfile, insideCavity } from '../model/earbudCavity';
import { bodyProfile, lidProfile } from '../model/profiles';
import { sampleProfile } from '../model/geometry';
import { caseDistance } from '../model/caseSurface';

describe('动作路径与已验收几何', () => {
  let product: ReturnType<typeof createProduct>;
  beforeAll(() => {
    product = createProduct();
  }, 30000);
  afterAll(() => disposeProduct(product.root));
  it('20 次取出/归位后严格恢复已验收的收纳矩阵', () => {
    setProductPose(product, 'open');
    const expected = [product.parts.leftEarbud, product.parts.rightEarbud].map((e) =>
      e.matrixWorld.toArray(),
    );
    for (let i = 0; i < 20; i++) {
      applyProductMotion(product, { lid: 1, extraction: 1 });
      applyProductMotion(product, { lid: 1, extraction: 0 });
    }
    expect(
      [product.parts.leftEarbud, product.parts.rightEarbud].map((e) => e.matrixWorld.toArray()),
    ).toEqual(expected);
  });
  it('161 个取出时刻的全部主体顶点不穿入盒体和已打开盒盖', { timeout: 30000 }, () => {
    const cavities = [cavityProfile('body', -1), cavityProfile('body', 1)];
    const lidCavities = [cavityProfile('lid', -1), cavityProfile('lid', 1)];
    for (let frame = 0; frame <= 160; frame++) {
      applyProductMotion(product, { lid: 1, extraction: frame / 160 });
      const inverseLid = product.parts.caseLid.matrixWorld.clone().invert();
      let hits = 0;
      const hitPoints: string[] = [];
      for (const [side, name] of ['LeftEarbudShell', 'RightEarbudShell'].entries()) {
        const shell = product.root.getObjectByName(name) as Mesh;
        const positions = shell.geometry.attributes.position;
        const step = 1;
        for (let i = 0; i < positions.count; i += step) {
          const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(shell.matrixWorld);
          if (p.y <= bodyProfile.at(-1)!.y && !insideCavity(cavities[side], p)) {
            hits++;
            hitPoints.push(`body ${p.toArray().map((v) => v.toFixed(3))}`);
          }
          p.applyMatrix4(inverseLid);
          if (
            p.y > lidProfile[0].y &&
            p.y < lidProfile.at(-1)!.y &&
            caseDistance(sampleProfile(lidProfile, p.y), p.x, p.z) < 0 &&
            !insideCavity(lidCavities[p.x < 0 ? 0 : 1], p)
          ) {
            hits++;
            hitPoints.push(`lid ${p.toArray().map((v) => v.toFixed(3))}`);
          }
        }
      }
      expect(hits, `取出进度 ${frame / 160}: ${hitPoints.slice(0, 5).join(';')}`).toBe(0);
    }
  });
});
