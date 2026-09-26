import { describe, expect, it } from 'vitest';
import { createMotionController } from '../interaction/controller';
import { FILM_DURATION, sampleFilm } from '../interaction/state';

describe('第四阶段统一时间线', () => {
  it('20 秒影片首尾姿态和机位严格相同', () => {
    expect(FILM_DURATION).toBe(20);
    const start = sampleFilm(0),
      end = sampleFilm(20);
    expect(end.lid).toBe(start.lid);
    expect(end.extraction).toBe(start.extraction);
    expect(end.camera).toEqual(start.camera);
  });
  it('全程先开盖再取出，归位后才允许关盖', () => {
    for (let i = 0; i <= 2000; i++) {
      const frame = sampleFilm(i / 100);
      if (frame.extraction > 0) expect(frame.lid).toBe(1);
      expect(frame.extraction).toBeGreaterThanOrEqual(0);
      expect(frame.extraction).toBeLessThanOrEqual(1);
    }
  });
  it('20 次完整循环无漂移，暂停时不推进，定位与顺序播放一致', () => {
    const motion = createMotionController();
    motion.play();
    for (let i = 0; i < 20; i++) motion.update(20);
    expect(motion.inspect().time).toBe(0);
    motion.update(9.25);
    const expected = motion.inspect().value;
    motion.pause();
    motion.update(500);
    expect(motion.inspect().value).toEqual(expected);
    motion.seek(9.25);
    expect(motion.inspect().value).toEqual(expected);
  });
  it('非循环结束停留末帧，再次播放回到起点', () => {
    const motion = createMotionController();
    motion.setLoop(false);
    motion.play();
    motion.update(21);
    expect(motion.inspect().mode).toBe('paused');
    expect(motion.inspect().time).toBe(20);
    motion.play();
    expect(motion.inspect().time).toBe(0);
  });
  it('重复动作忽略，不叠加；关盖自动先归位', () => {
    const motion = createMotionController();
    expect(motion.request('extract')).toBe(true);
    for (let i = 0; i < 10; i++) expect(motion.request('extract')).toBe(false);
    motion.update(10);
    expect(motion.inspect().value).toEqual({ lid: 1, extraction: 1 });
    motion.request('close');
    for (let i = 0; i < 400; i++) {
      motion.update(0.01);
      const value = motion.inspect().value;
      if (value.extraction > 0) expect(value.lid).toBe(1);
    }
    expect(motion.inspect().value).toEqual({ lid: 0, extraction: 0 });
  });
  it.each(['open', 'close', 'extract', 'return'] as const)(
    '%s 中途重置一致恢复开盖收纳',
    (action) => {
      const motion = createMotionController();
      motion.sync({ lid: action === 'open' ? 0 : 1, extraction: action === 'return' ? 1 : 0 });
      motion.request(action);
      motion.update(0.25);
      motion.reset();
      motion.update(10);
      expect(motion.inspect().mode).toBe('idle');
      expect(motion.inspect().value).toEqual({ lid: 1, extraction: 0 });
    },
  );
  it('减少动态效果只让手动动作立即到位，影片仍由用户启动', () => {
    const motion = createMotionController(true);
    motion.request('close');
    expect(motion.inspect().value).toEqual({ lid: 0, extraction: 0 });
    motion.play();
    motion.update(3);
    expect(motion.inspect().mode).toBe('playing');
    expect(motion.inspect().value.lid).toBeGreaterThan(0);
    expect(motion.inspect().value.lid).toBeLessThan(1);
  });
  it('拒绝非法时间，销毁后不继续推进', () => {
    const motion = createMotionController();
    expect(() => motion.seek(NaN)).toThrow();
    expect(() => motion.update(Infinity)).toThrow();
    motion.play();
    motion.dispose();
    expect(motion.update(1)).toBe(false);
    expect(motion.request('close')).toBe(false);
  });
});
