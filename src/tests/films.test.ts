import { describe, expect, it } from 'vitest';
import { FILMS, sampleCinematicFilm } from '../interaction/films';
import { createMotionController } from '../interaction/controller';

describe('三种独立短片', () => {
  it.each(['reveal', 'sculpture', 'light'] as const)(
    '%s 首尾状态一致、可确定定位且编舞安全门控',
    (id) => {
      const first = sampleCinematicFilm(0, id),
        last = sampleCinematicFilm(20, id);
      expect(last).toEqual(first);
      for (let i = 0; i <= 400; i++) {
        const s = sampleCinematicFilm(i / 20, id);
        expect(s).toEqual(sampleCinematicFilm(i / 20, id));
        if (s.left > 0 || s.right > 0) expect(s.lid).toBe(1);
        if (s.dance > 0) {
          expect(s.left).toBe(1);
          expect(s.right).toBe(1);
        }
        expect(JSON.stringify(s)).not.toMatch(/null/);
      }
    },
  );
  it('三种片段具有不同镜头、编舞和光照', () => {
    expect(Object.keys(FILMS)).toHaveLength(3);
    const a = sampleCinematicFilm(10, 'reveal'),
      b = sampleCinematicFilm(10, 'sculpture'),
      c = sampleCinematicFilm(10, 'light');
    expect(a.camera).not.toEqual(b.camera);
    expect(b.dance).toBeGreaterThan(0);
    expect(c.light.environment).toBeLessThan(a.light.environment);
    expect(sampleCinematicFilm(11.2, 'light').camera.stem).toBe(1);
  });
  it('播放中切片清除旧动作、从0播放，暂停选择不残留上片时间', () => {
    const c = createMotionController();
    c.play();
    c.update(9);
    c.selectFilm('sculpture');
    expect(c.inspect().film).toBe('sculpture');
    expect(c.inspect().time).toBe(0);
    expect(c.inspect().mode).toBe('playing');
    c.pause();
    c.selectFilm('light');
    expect(c.inspect().mode).toBe('playing');
    expect(c.inspect().time).toBe(0);
    c.reset();
    expect(c.inspect().film).toBe('light');
    expect(() => c.selectFilm('invalid' as never)).toThrow();
  });
});
