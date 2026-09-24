import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { REVIEW_VIEWS, reviewFrustum } from '../debug/earbudReviewConfig';
import { createEarbudShellGeometry } from '../model/createEarbudShell';

describe('独立裸壳评审相机', () => {
  it('覆盖六个严格轴向和四个不同斜向；上方向不与观察轴平行', () => {
    expect(Object.keys(REVIEW_VIEWS)).toHaveLength(10);
    for (const view of Object.values(REVIEW_VIEWS)) {
      expect(
        new Vector3(...view.direction).cross(new Vector3(...view.up)).length(),
      ).toBeGreaterThan(0.99);
    }
    expect(REVIEW_VIEWS.back.direction).toEqual([0, 0, -1]);
    expect(REVIEW_VIEWS.top.direction).toEqual([0, 1, 0]);
    expect(REVIEW_VIEWS.bottom.direction).toEqual([0, -1, 0]);
  });
  it('并排模式每半屏与同尺寸单屏使用相同毫米比例', () => {
    expect(reviewFrustum(1000, 548, true)).toEqual(reviewFrustum(500, 548, false));
  });
  it('窄屏同时容纳两个完整裸壳，不靠独立拉伸填满画面', () => {
    const f = reviewFrustum(286, 410, true);
    expect(f.top).toBeGreaterThan(1.51);
    expect(f.right).toBeGreaterThan(0.93);
    expect(f.left).toBe(-f.right);
    expect(f.bottom).toBe(-f.top);
  });
  it('所有固定视图的左右镜像在窄屏保留至少 1 mm 水平余量', () => {
    const g = createEarbudShellGeometry(),
      f = reviewFrustum(286, 410, true);
    try {
      for (const view of Object.values(REVIEW_VIEWS))
        for (const side of [-1, 1]) {
          const axis = new Vector3(...view.up).cross(new Vector3(...view.direction)).normalize();
          let maximum = 0;
          for (let i = 0; i < g.attributes.position.count; i++) {
            const p = new Vector3().fromBufferAttribute(g.attributes.position, i);
            p.x *= side;
            maximum = Math.max(maximum, Math.abs(p.dot(axis)));
          }
          expect(maximum + 0.1).toBeLessThan(f.right);
        }
    } finally {
      g.dispose();
    }
  });
});
