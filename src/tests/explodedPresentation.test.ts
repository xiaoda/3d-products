import { readFileSync } from 'node:fs';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { triangleSurface } from './helpers/triangleSurface';

describe('纯产品展示回归', () => {
  test('预览不再生成编号、引线、部件说明或章节覆盖层', () => {
    const source = readFileSync(
      new URL('../debug/explodedEarbudReview.ts', import.meta.url),
      'utf8',
    );
    for (const removed of [
      'exploded-pin',
      'data-exploded-part',
      'exploded-chapter',
      'exploded-motion-caption',
      'EXPLODED_PARTS',
    ])
      expect(source).not.toContain(removed);
    for (const retained of [
      'exploded-play',
      'exploded-progress',
      'exploded-loop',
      'webglcontextlost',
      'visibilitychange',
    ])
      expect(source).toContain(retained);
    expect(source).toContain('max="${EXPLODED_DURATION}"');
    expect(source).not.toContain('00:30');
    expect(source).not.toContain('30 秒');
    expect(source).not.toContain('无停留');
    expect(source).toContain('全部展开 · 短暂停留');
    expect(source.indexOf('renderer.shadowMap.needsUpdate = true')).toBeLessThan(
      source.indexOf('new OrbitControls'),
    );
  });
  test('三角面检测区分双向穿面、平行和未到达表面的线段', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 0, 1, 0], 3),
    );
    const surface = triangleSurface(geometry);
    expect(surface.intersectsSegment(new Vector3(0, 0, -1), new Vector3(0, 0, 1))).toBe(true);
    expect(surface.intersectsSegment(new Vector3(0, 0, 1), new Vector3(0, 0, -1))).toBe(true);
    expect(surface.intersectsSegment(new Vector3(0, 0, -2), new Vector3(0, 0, -1))).toBe(false);
    expect(surface.intersectsSegment(new Vector3(-1, 0, 1), new Vector3(1, 0, 1))).toBe(false);
    geometry.dispose();
  });
});
