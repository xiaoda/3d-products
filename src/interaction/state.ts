export interface MotionValue {
  lid: number;
  extraction: number;
}
export type MotionAction = 'open' | 'close' | 'extract' | 'return';
export type MotionMode = 'idle' | 'action' | 'playing' | 'paused';
export const FILM_DURATION = 20;
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
/** 五次缓入缓出：端点速度/加速度为零，暂停、定位和回放可复现。 */
export const ease = (n: number) => {
  const t = clamp01(n);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ramp = (time: number, start: number, end: number) => ease((time - start) / (end - start));

const CAMERA_KEYS = [
  { t: 0, yaw: 0.35, elevation: 0.24 },
  { t: 2, yaw: 0.22, elevation: 0.28 },
  { t: 5, yaw: -0.22, elevation: 0.42 },
  { t: 8, yaw: -0.48, elevation: 0.25 },
  { t: 11, yaw: 0.15, elevation: 0.2 },
  { t: 13, yaw: 0.62, elevation: 0.32 },
  { t: 16, yaw: 0.4, elevation: 0.42 },
  { t: 18.5, yaw: 0.35, elevation: 0.24 },
  { t: 20, yaw: 0.35, elevation: 0.24 },
];

export function sampleFilm(seconds: number) {
  if (!Number.isFinite(seconds)) throw new RangeError('影片时间必须为有限值');
  const time = Math.max(0, Math.min(FILM_DURATION, seconds));
  const lid = time <= 16 ? ramp(time, 2, 5) : 1 - ramp(time, 16, 18.5);
  const extraction = time <= 13 ? ramp(time, 5, 8) : 1 - ramp(time, 13, 16);
  const index = Math.max(
    1,
    CAMERA_KEYS.findIndex((k) => k.t >= time),
  );
  const a = CAMERA_KEYS[index - 1],
    b = CAMERA_KEYS[index];
  const t = ramp(time, a.t, b.t);
  return {
    lid,
    extraction,
    camera: { yaw: mix(a.yaw, b.yaw, t), elevation: mix(a.elevation, b.elevation, t) },
    phase:
      time < 2
        ? '闭合亮相'
        : time < 5
          ? '轻启盒盖'
          : time < 8
            ? '双耳升起'
            : time < 13
              ? '悬浮环视'
              : time < 16
                ? '双耳归位'
                : time < 18.5
                  ? '缓缓合盖'
                  : '闭合定格',
  };
}
