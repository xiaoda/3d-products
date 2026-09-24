import { describe, expect, it } from 'vitest';
import { fitDistance } from '../scene/framing';

describe('相机构图', () => {
  it('窄视口自动增大距离，保留主体', () => {
    expect(fitDistance(5, 0.7, 32)).toBeGreaterThan(fitDistance(5, 1.5, 32));
  });
  it('距离总在模型包围球之外', () => {
    for (const aspect of [0.5, 1, 2]) expect(fitDistance(5, aspect, 32)).toBeGreaterThan(5);
  });
  it.each([
    [0, 1, 32],
    [5, 0, 32],
    [5, 1, 180],
    [5, 1, NaN],
  ])('拒绝无效输入 %s %s %s', (r, a, f) => {
    expect(() => fitDistance(r, a, f)).toThrow(RangeError);
  });
});
