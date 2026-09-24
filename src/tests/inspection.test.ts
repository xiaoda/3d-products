import { describe, expect, it } from 'vitest';
import { Box3, Mesh, Vector3 } from 'three';
import { createProduct, disposeProduct, setProductPose, setLidAngle } from '../model/createProduct';
import { PRODUCT } from '../config/product';
import { caseDistance } from '../model/caseSurface';
import { sampleProfile } from '../model/geometry';
import { bodyProfile, lidProfile } from '../model/profiles';
import { cavityProfile, insideCavity } from '../model/earbudCavity';

describe('第二阶段静态装配', () => {
  it('精修耳机主体是单个连续网格，带有凹槽和接口细节', () => {
    const product = createProduct();
    for (const side of ['Left', 'Right']) {
      const shell = product.root.getObjectByName(`${side}EarbudShell`);
      expect(shell).toBeInstanceOf(Mesh);
      expect(product.root.getObjectByName(`${side}EarbudHead`)).toBeUndefined();
      expect(product.root.getObjectByName(`${side}speakerLattice`)).toBeInstanceOf(Mesh);
      // C 将孔缘、封底、传感器和触点焊接在同一壳中，以材质分组表达而非重叠节点。
      const mesh = shell as Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      expect(mesh.geometry.groups.map((g) => materials[g.materialIndex!].name)).toEqual([
        'plastic',
        'grille',
        'sensor',
        'contact',
      ]);
      expect(mesh.geometry.userData.features).toHaveLength(7);
    }
    for (const name of [
      'CaseInterior',
      'LeftWell',
      'RightWell',
      'LidInterior',
      'Hinge',
      'USBPort',
    ]) {
      expect(product.root.getObjectByName(name), name).toBeDefined();
    }
    disposeProduct(product.root);
  });
  it('三个姿态可重复切换，闭合时耳机位于盒体包围范围内', () => {
    const product = createProduct();
    setProductPose(product, 'closed');
    product.root.updateMatrixWorld(true);
    const shell = new Box3().setFromObject(product.parts.caseAssembly, true).expandByScalar(0.01);
    expect(shell.containsBox(new Box3().setFromObject(product.parts.leftEarbud, true))).toBe(true);
    expect(shell.containsBox(new Box3().setFromObject(product.parts.rightEarbud, true))).toBe(true);
    const before = product.parts.leftEarbud.position.clone();
    for (let i = 0; i < 10; i++) {
      setProductPose(product, 'separated');
      setProductPose(product, 'open');
      setProductPose(product, 'closed');
    }
    expect(product.parts.leftEarbud.position.distanceTo(before)).toBe(0);
    expect(product.parts.lidPivot.rotation.x).toBe(0);
    disposeProduct(product.root);
  });
  it('铰链角度有限制，旋转不改变盒体位置', () => {
    const product = createProduct();
    const bodyPosition = product.parts.caseBody.getWorldPosition(new Vector3());
    setLidAngle(product, 999);
    expect(product.parts.lidPivot.rotation.x).toBeCloseTo(
      (-Math.PI * PRODUCT.assembly.openAngle) / 180,
    );
    expect(product.parts.caseBody.getWorldPosition(new Vector3()).distanceTo(bodyPosition)).toBe(0);
    setLidAngle(product, -30);
    expect(product.parts.lidPivot.rotation.x).toBe(0);
    disposeProduct(product.root);
  });
  it('收纳状态下所有耳机壳顶点都位于实际凹槽或盒盖凹腔内', () => {
    const product = createProduct();
    setProductPose(product, 'closed');
    for (const side of [-1, 1] as const) {
      const shell = product.root.getObjectByName(
        `${side === -1 ? 'Left' : 'Right'}EarbudShell`,
      ) as Mesh;
      const p = shell.geometry.getAttribute('position');
      const bodyCavity = cavityProfile('body', side),
        lidCavity = cavityProfile('lid', side);
      let collisions = 0;
      let worst: number[] = [];
      for (let i = 0; i < p.count; i++) {
        const v = new Vector3().fromBufferAttribute(p, i).applyMatrix4(shell.matrixWorld);
        if (v.y > bodyProfile.at(-1)!.y && v.y < lidProfile[0].y) continue;
        const profile = v.y <= bodyProfile.at(-1)!.y ? bodyCavity : lidCavity;
        if (!insideCavity(profile, v)) {
          collisions++;
          worst = v.toArray();
        }
      }
      expect(collisions, `${side} 凹腔穿透位置 ${worst}`).toBe(0);
    }
    disposeProduct(product.root);
  });
  it('盒盖 0 至最大角度 度采样时不会进入盒体外壳包络', () => {
    const product = createProduct();
    setProductPose(product, 'closed');
    const shell = product.root.getObjectByName('LidOuterShell') as Mesh;
    const positions = shell.geometry.getAttribute('position');
    for (const angle of Array.from({ length: PRODUCT.assembly.openAngle + 1 }, (_, i) => i)) {
      setLidAngle(product, angle);
      product.root.updateMatrixWorld(true);
      let collisions = 0;
      for (let i = 0; i < positions.count; i++) {
        const v = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(shell.matrixWorld);
        if (v.y >= bodyProfile.at(-1)!.y - 0.002 || v.y <= 0) continue;
        const s = sampleProfile(bodyProfile, v.y);
        const metric = caseDistance(s, v.x, v.z);
        if (metric < -0.002) collisions++;
      }
      expect(collisions, `${angle} 度盒盖穿入盒体`).toBe(0);
    }
    disposeProduct(product.root);
  });
  it('开盖角度采样时收纳耳机不进入盒盖实体区域', { timeout: 30000 }, () => {
    const product = createProduct();
    setProductPose(product, 'closed');
    const points: Vector3[] = [];
    const leftCavity = cavityProfile('lid', -1),
      rightCavity = cavityProfile('lid', 1);
    for (const name of ['LeftEarbudShell', 'RightEarbudShell']) {
      const shell = product.root.getObjectByName(name) as Mesh;
      const positions = shell.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++)
        points.push(
          new Vector3().fromBufferAttribute(positions, i).applyMatrix4(shell.matrixWorld),
        );
    }
    for (const angle of Array.from({ length: PRODUCT.assembly.openAngle + 1 }, (_, i) => i)) {
      setLidAngle(product, angle);
      product.root.updateMatrixWorld(true);
      let collisions = 0;
      for (const point of points) {
        const p = product.parts.caseLid.worldToLocal(point.clone());
        if (p.y <= lidProfile[0].y || p.y >= lidProfile.at(-1)!.y) continue;
        const outer = sampleProfile(lidProfile, p.y);
        if (caseDistance(outer, p.x, p.z) >= 0) continue;
        const inCavity = insideCavity(p.x < 0 ? leftCavity : rightCavity, p);
        if (!inCavity) collisions++;
      }
      expect(collisions, `${angle} 度时耳机进入盒盖`).toBe(0);
    }
    disposeProduct(product.root);
  });
});
