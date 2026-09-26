import { describe, expect, it, vi } from 'vitest';
import { connectPicking, isTap } from '../interaction/picking';
describe('点击与拖拽区分', () => {
  const start = { x: 100, y: 100, time: 0 };
  it('接受短距离短按', () => expect(isTap(start, { x: 103, y: 102, time: 180 })).toBe(true));
  it('拒绝拖拽、长按和倒退时间', () => {
    expect(isTap(start, { x: 107, y: 100, time: 100 })).toBe(false);
    expect(isTap(start, { x: 100, y: 100, time: 500 })).toBe(false);
    expect(isTap(start, { x: 100, y: 100, time: -1 })).toBe(false);
  });
  it('轻触不抢占动作，拖出再移回仍不触发点击；多指、取消和销毁安全', () => {
    const canvas = new EventTarget();
    const tap = vi.fn(),
      manual = vi.fn();
    const dispose = connectPicking(canvas as HTMLElement, tap, manual);
    const dispatch = (type: string, x = 100, id = 1) => {
      const event = new Event(type);
      Object.assign(event, {
        pointerId: id,
        isPrimary: id === 1,
        button: 0,
        clientX: x,
        clientY: 100,
      });
      canvas.dispatchEvent(event);
    };
    dispatch('pointerdown');
    dispatch('pointerup');
    expect(tap).toHaveBeenCalledTimes(1);
    expect(manual).not.toHaveBeenCalled();
    dispatch('pointerdown');
    dispatch('pointermove', 120);
    dispatch('pointermove');
    dispatch('pointerup');
    expect(tap).toHaveBeenCalledTimes(1);
    expect(manual).toHaveBeenCalledTimes(1);
    dispatch('pointerdown');
    dispatch('pointerdown', 100, 2);
    dispatch('pointerup', 100, 2);
    dispatch('pointerup');
    expect(tap).toHaveBeenCalledTimes(1);
    dispatch('pointerdown');
    dispatch('pointercancel');
    dispatch('pointerup');
    dispatch('pointerdown');
    dispatch('lostpointercapture');
    dispatch('pointerup');
    expect(tap).toHaveBeenCalledTimes(1);
    canvas.dispatchEvent(new Event('wheel'));
    expect(manual).toHaveBeenCalledTimes(3);
    dispose();
    dispatch('pointerdown');
    dispatch('pointerup');
    expect(tap).toHaveBeenCalledTimes(1);
  });
});
