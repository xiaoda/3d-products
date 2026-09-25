import { describe, expect, it } from 'vitest';
import { Box3, Matrix4, Vector3 } from 'three';
import { createProduct, disposeProduct, setProductPose } from '../model/createProduct';
import { EAR_FEATURES, featureFrame } from '../model/earbudFeatures';
import { PRODUCT, mm } from '../config/product';
import { cavityProfile } from '../model/earbudCavity';
import reference from './fixtures/seating-reference.json';

describe('官网图片约束的收纳姿态', () => {
  it('正面关键点与露出高度符合图片比例，不能仅靠槽口跟随错误姿态通过', { timeout: 30000 }, () => {
    const product = createProduct();
    try {
      setProductPose(product, 'open');
      const widthPx = reference.caseRight - reference.caseLeft;
      for (const observation of reference.features) {
        const feature = EAR_FEATURES.find((f) => f.id === observation.id)!;
        const point = featureFrame(feature).center.applyMatrix4(
          product.parts.rightEarbud.matrixWorld,
        );
        const x = point.x / mm(PRODUCT.case.width);
        const y =
          (point.y - mm(PRODUCT.case.seamHeight - PRODUCT.case.seamGap / 2)) /
          mm(PRODUCT.case.width);
        expect(
          Math.abs(x - (observation.x - reference.centerX) / widthPx),
          `${observation.id} 横向比例`,
        ).toBeLessThan(reference.normalizedTolerance);
        expect(
          Math.abs(y - (reference.rimY - observation.y) / widthPx),
          `${observation.id} 露出比例`,
        ).toBeLessThan(reference.normalizedTolerance);
      }
      const top = new Box3().setFromObject(product.parts.rightEarbud, true).max.y;
      expect(
        Math.abs(
          (top - mm(32)) / mm(PRODUCT.case.width) - (reference.rimY - reference.earTopY) / widthPx,
        ),
      ).toBeLessThan(reference.normalizedTolerance);
    } finally {
      disposeProduct(product.root);
    }
  });

  it('左右腔体保持镜像及实体中桥，不因向内收拢而连通', () => {
    for (const kind of ['body', 'lid'] as const) {
      const right = cavityProfile(kind, 1);
      const left = cavityProfile(kind, -1);
      // 至少 1 mm 的水平中桥只是展示回归门槛，不是制造壁厚。
      expect(Math.min(...right.flatMap((s) => s.points.map((p) => p.x))) * 20).toBeGreaterThan(1);
      right.forEach((section, i) => {
        expect(left[i].y).toBe(section.y);
        section.points.forEach((p, j) => {
          const l = left[i].points[section.points.length - 1 - j];
          expect(l.x).toBe(-p.x);
          expect(l.y).toBe(p.y);
        });
      });
    }
  });

  it('传感器向内且朝前，出音口主要朝内而不是正面', { timeout: 30000 }, () => {
    const product = createProduct();
    try {
      setProductPose(product, 'open');
      const ear = product.parts.rightEarbud;
      const sensor = featureFrame(EAR_FEATURES.find((f) => f.id === 'sensor')!);
      const speaker = featureFrame(EAR_FEATURES.find((f) => f.id === 'speaker')!);
      const sensorPosition = sensor.center.applyMatrix4(ear.matrixWorld);
      const sensorNormal = sensor.normal.transformDirection(ear.matrixWorld);
      const speakerNormal = speaker.normal.transformDirection(ear.matrixWorld);
      // 参考图传感器位于靠中线一侧；这里只锁定可观察的方向，不虚构机械角度。
      expect(sensorPosition.x).toBeLessThan(ear.position.x - 0.3);
      expect(sensorNormal.z).toBeGreaterThan(0.4);
      expect(speakerNormal.x).toBeLessThan(-0.9);
      expect(speakerNormal.z).toBeLessThan(0.3);
    } finally {
      disposeProduct(product.root);
    }
  });

  it('左右收纳是镜像刚体且反复归位不累计旋转', { timeout: 30000 }, () => {
    const product = createProduct();
    try {
      setProductPose(product, 'closed');
      const { leftEarbud: left, rightEarbud: right } = product.parts;
      const initial = right.matrixWorld.clone();
      const reflect = new Matrix4().makeScale(-1, 1, 1);
      const mirrored = reflect.clone().multiply(right.matrixWorld).multiply(reflect);
      expect(left.scale.toArray()).toEqual([1, 1, 1]);
      expect(right.scale.toArray()).toEqual([1, 1, 1]);
      expect(left.matrixWorld.determinant()).toBeCloseTo(1, 12);
      expect(right.matrixWorld.determinant()).toBeCloseTo(1, 12);
      for (let i = 0; i < 16; i++)
        expect(left.matrixWorld.elements[i]).toBeCloseTo(mirrored.elements[i], 12);
      for (let i = 0; i < 10; i++) {
        setProductPose(product, 'separated');
        setProductPose(product, 'open');
        setProductPose(product, 'closed');
      }
      expect(right.matrixWorld.elements).toEqual(initial.elements);
      const sensor = featureFrame(EAR_FEATURES.find((f) => f.id === 'sensor')!).center;
      const l = new Vector3(-sensor.x, sensor.y, sensor.z).applyMatrix4(left.matrixWorld);
      const r = sensor.clone().applyMatrix4(right.matrixWorld);
      expect(l.x).toBeCloseTo(-r.x, 12);
      expect(l.y).toBeCloseTo(r.y, 12);
      expect(l.z).toBeCloseTo(r.z, 12);
    } finally {
      disposeProduct(product.root);
    }
  });
});
