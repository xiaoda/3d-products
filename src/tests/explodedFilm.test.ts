import { describe, expect, test } from 'vitest';
import { EXPLODED_PARTS } from '../model/explodedEarbudDefinition';
import { sampleExplodedFilm, EXPLODED_DURATION } from '../interaction/explodedFilm';
import { createExplodedPlayer } from '../interaction/explodedPlayer';

describe('8 秒固定视角产品展示', () => {
  test('首尾完全归位，中点达到紧凑展开终点', () => {
    expect(EXPLODED_DURATION).toBe(8);
    expect(sampleExplodedFilm(0).transforms).toEqual(sampleExplodedFilm(8).transforms);
    for (const p of EXPLODED_PARTS) {
      expect(sampleExplodedFilm(4).transforms[p.id].offset).toEqual([...p.offset]);
      expect(sampleExplodedFilm(4).transforms[p.id].rotation).toEqual([...p.rotation]);
    }
    expect(sampleExplodedFilm(0).assembled).toBe(true);
    expect(sampleExplodedFilm(8).assembled).toBe(true);
  });
  test('所有部件共用展开量，同步开始、同时到位、同步回装', () => {
    for (const t of [0.1, 0.7, 1.5, 2.5, 3.3]) {
      const sample = sampleExplodedFilm(t);
      expect(sample.open).toBeGreaterThan(0);
      expect(sample.open).toBeLessThan(1);
      for (const part of EXPLODED_PARTS) {
        part.offset.forEach((v, i) =>
          expect(sample.transforms[part.id].offset[i]).toBeCloseTo(v * sample.spread[i], 12),
        );
        part.rotation.forEach((v, i) =>
          expect(sample.transforms[part.id].rotation[i]).toBeCloseTo(
            v * sample.open * sample.open,
            12,
          ),
        );
      }
      for (const part of EXPLODED_PARTS)
        sample.transforms[part.id].offset.forEach((v, i) =>
          expect(sampleExplodedFilm(8 - t).transforms[part.id].offset[i]).toBeCloseTo(v, 12),
        );
    }
    expect(sampleExplodedFilm(0).open).toBe(0);
    expect(sampleExplodedFilm(4).open).toBe(1);
    expect(sampleExplodedFilm(8).open).toBe(0);
  });
  test('全部展开后保持 1.2 秒，再自动回收，机位和反射不漂移', () => {
    for (let i = 0; i < 34; i++)
      expect(sampleExplodedFilm((i + 1) / 10).open).toBeGreaterThan(
        sampleExplodedFilm(i / 10).open,
      );
    for (let i = 34; i <= 46; i++) {
      const sample = sampleExplodedFilm(i / 10);
      expect(sample.open).toBe(1);
      expect(sample.transforms).toEqual(sampleExplodedFilm(4).transforms);
    }
    for (let i = 46; i < 80; i++)
      expect(sampleExplodedFilm((i + 1) / 10).open).toBeLessThan(sampleExplodedFilm(i / 10).open);
    for (let i = 0; i <= 80; i++) {
      const sample = sampleExplodedFilm(i / 10);
      expect(sample.yaw).toBe(sampleExplodedFilm(0).yaw);
      expect(sample.reflection).toBe(sampleExplodedFilm(0).reflection);
    }
  });
  test('没有逐件焦点、数字标签或分段讲解轨道', () => {
    for (const t of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const sample = sampleExplodedFilm(t);
      expect(sample).not.toHaveProperty('focus');
      expect(sample).not.toHaveProperty('labels');
      expect(sample).not.toHaveProperty('chapter');
    }
  });
  test('所有采样有限、分段连续，不接受 NaN / Infinity', () => {
    for (let frame = 0; frame <= 240; frame++) {
      const s = sampleExplodedFilm(frame / 30);
      for (const part of Object.values(s.transforms))
        expect([...part.offset, ...part.rotation].every(Number.isFinite)).toBe(true);
    }
    for (const time of [0.1, 2, 3.4, 4.6, 6, 7.9]) {
      const a = sampleExplodedFilm(time - 1e-5),
        b = sampleExplodedFilm(time + 1e-5);
      for (const p of EXPLODED_PARTS)
        a.transforms[p.id].offset.forEach((v, i) =>
          expect(Math.abs(v - b.transforms[p.id].offset[i])).toBeLessThan(0.001),
        );
    }
    expect(() => sampleExplodedFilm(NaN)).toThrow();
    expect(() => sampleExplodedFilm(Infinity)).toThrow();
    expect(sampleExplodedFilm(-3).time).toBe(0);
    expect(sampleExplodedFilm(35).time).toBe(8);
  });
});

describe('独立结构播放器', () => {
  test('默认不自动播放，暂停不推进，定位确定且不自动播放', () => {
    const p = createExplodedPlayer();
    expect(p.inspect().mode).toBe('static');
    p.play();
    p.update(4);
    p.pause();
    p.update(5);
    expect(p.inspect().time).toBe(4);
    p.seek(2);
    expect(p.inspect()).toMatchObject({ time: 2, mode: 'paused' });
    p.play();
    p.update(0.5);
    expect(p.inspect().time).toBe(2.5);
  });
  test('单次在 8 秒停住，重新播放从头开始，循环保留余数', () => {
    const p = createExplodedPlayer();
    p.play();
    p.update(9);
    expect(p.inspect()).toMatchObject({ time: 8, mode: 'ended' });
    p.play();
    expect(p.inspect().time).toBe(0);
    p.setLoop(true);
    p.update(10.5);
    expect(p.inspect()).toMatchObject({ time: 2.5, mode: 'playing' });
  });
  test('退出恢复静态、重播与销毁可重复，拒绝非法输入', () => {
    const p = createExplodedPlayer();
    p.seek(14);
    p.restart();
    expect(p.inspect()).toMatchObject({ time: 0, mode: 'playing' });
    p.stop();
    expect(p.inspect().mode).toBe('static');
    expect(() => p.seek(NaN)).toThrow();
    expect(() => p.update(-1)).toThrow();
    p.dispose();
    p.dispose();
    p.play();
    p.update(5);
    expect(p.inspect().mode).toBe('static');
  });
});
