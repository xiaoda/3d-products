import { describe, expect, it } from 'vitest';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import {
  createEarbudShellGeometry,
  sampleEarbudShell,
  shellNormal,
} from '../model/createEarbudShell';
import { EAR_BARE_SHELL_CONTROLS, SHELL_KNOTS } from '../model/earbudDefinition';
import { meshQuality, nonAdjacentIntersections } from './meshQuality';
import { EAR_REFERENCE } from './earbudReference';
import { silhouetteIoU } from './silhouette';

describe('单耳裸壳的曲面质量门槛', () => {
  it.each([
    ['top', [0, 2], 0.92],
    ['front', [0, 1], 0.95],
    ['side', [2, 1], 0.87],
  ] as const)('%s 保留原有独立参考轮廓门槛，不因平顺化而放宽阈值', (name, axes, minimum) => {
    const geometry = createEarbudShellGeometry(),
      material = new MeshBasicMaterial();
    const root = new Group().add(new Mesh(geometry, material));
    try {
      expect(silhouetteIoU(root, [...axes], EAR_REFERENCE[name])).toBeGreaterThan(minimum);
    } finally {
      geometry.dispose();
      material.dispose();
    }
  });
  it('显示网格不得以平滑法线掩盖超过 15° 的局部折痕', () => {
    const geometry = createEarbudShellGeometry();
    try {
      const quality = meshQuality(geometry);
      expect(quality.maxDihedral).toBeLessThan(15);
      expect(quality.percentile999).toBeLessThan(12);
    } finally {
      geometry.dispose();
    }
  });
  it('整个显示网格封闭、无退化面、正体积且属于单个球面拓扑', () => {
    const g = createEarbudShellGeometry();
    try {
      const q = meshQuality(g);
      expect(q.closed).toBe(true);
      expect(q.euler).toBe(2);
      expect(q.minimumArea).toBeGreaterThan(1e-10);
      expect(q.volume).toBeGreaterThan(1);
      const p = g.attributes.position,
        n = g.attributes.normal;
      expect([...p.array, ...n.array].every(Number.isFinite)).toBe(true);
      let minimumNormal = Infinity,
        maximumNormal = 0;
      for (let i = 0; i < n.count; i++) {
        const length = new Vector3().fromBufferAttribute(n, i).length();
        minimumNormal = Math.min(minimumNormal, length);
        maximumNormal = Math.max(maximumNormal, length);
      }
      expect(minimumNormal).toBeCloseTo(1, 5);
      expect(maximumNormal).toBeCloseTo(1, 5);
    } finally {
      g.dispose();
    }
  });
  it('尺寸来自毫米控制点，裸壳距目标包围尺寸不超过 0.35 mm', () => {
    const g = createEarbudShellGeometry();
    try {
      const actual = g.boundingBox!.getSize(new Vector3()).multiplyScalar(10).toArray();
      for (const [i, target] of [18.3, 30.2, 18.1].entries())
        expect(Math.abs(actual[i] - target)).toBeLessThan(0.35);
      expect(g.userData.normalizedByBounds).toBe(false);
      expect(sampleEarbudShell(0, 0).distanceTo(new Vector3(0.41, -1.51, -0.58))).toBeLessThan(
        1e-12,
      );
      expect(EAR_BARE_SHELL_CONTROLS).toHaveLength(14);
      expect(EAR_BARE_SHELL_CONTROLS.every((row) => row.length === 16)).toBe(true);
    } finally {
      g.dispose();
    }
  });
  it('周期接缝的点和法线连续，不依赖两片重叠曲面', () => {
    for (let i = 1; i < 30; i++) {
      const u = i / 30;
      expect(sampleEarbudShell(u, 0).distanceTo(sampleEarbudShell(u, 1))).toBeLessThan(1e-10);
      expect(shellNormal(u, 1 - 1e-5).angleTo(shellNormal(u, 1e-5))).toBeLessThan(0.01);
    }
  });
  it('内部样条节点两侧保持二阶连续，避免拼接成曲率折痕', () => {
    const e = 1e-5;
    for (const u of [...new Set(SHELL_KNOTS)].filter((v) => v > 0 && v < 1))
      for (let j = 0; j < 16; j++) {
        const v = j / 16,
          p = sampleEarbudShell(u, v);
        const left = p
          .clone()
          .addScaledVector(sampleEarbudShell(u - e, v), -2)
          .add(sampleEarbudShell(u - 2 * e, v))
          .divideScalar(e * e);
        const right = sampleEarbudShell(u + 2 * e, v)
          .addScaledVector(sampleEarbudShell(u + e, v), -2)
          .add(p)
          .divideScalar(e * e);
        expect(left.distanceTo(right) / Math.max(1, left.length(), right.length())).toBeLessThan(
          0.015,
        );
      }
  });
  it('最终显示网格没有非邻接三角形相交', () => {
    const g = createEarbudShellGeometry();
    try {
      expect(nonAdjacentIntersections(g)).toEqual([]);
    } finally {
      g.dispose();
    }
  });
  it('三角形相交检查确实能识别交叉面与共面重叠', () => {
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new Float32BufferAttribute(
        [
          -1, -1, 0, 1, -1, 0, 0, 1, 0, 0, -0.5, -1, 0, -0.5, 1, 0, 0.5, 0, -0.1, -0.1, 0, 0.2,
          -0.1, 0, 0, 0.2, 0,
        ],
        3,
      ),
    );
    g.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(nonAdjacentIntersections(g).length).toBeGreaterThanOrEqual(2);
    g.dispose();
  });
  it('拒绝无效输入，重新创建得到独立、确定的几何', () => {
    for (const u of [NaN, Infinity, -0.1, 1.1])
      expect(() => sampleEarbudShell(u, 0)).toThrow(RangeError);
    expect(() => shellNormal(0, NaN)).toThrow(RangeError);
    expect(() => createEarbudShellGeometry({ segments: 3 })).toThrow(RangeError);
    expect(() => createEarbudShellGeometry({ longitudinalSegments: NaN })).toThrow(RangeError);
    const a = createEarbudShellGeometry({ segments: 24, longitudinalSegments: 32 });
    const b = createEarbudShellGeometry({ segments: 24, longitudinalSegments: 32 });
    expect(a).not.toBe(b);
    expect(a.attributes.position.array).toEqual(b.attributes.position.array);
    a.dispose();
    b.dispose();
  });
});
