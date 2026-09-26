import { ease, mix } from './state';

export const FILMS = {
  reveal: { letter: 'A', title: '光影揭幕', description: '微距悬念 · 双耳编舞 · 擦镜转场' },
  sculpture: { letter: 'B', title: '失重雕塑', description: '悬浮倾转 · 错层轨道 · 空间环绕' },
  light: { letter: 'C', title: '一束光的旅行', description: '暗场轮廓 · 游走柔光 · 细节巡礼' },
} as const;
export type FilmId = keyof typeof FILMS;
export const isFilmId = (id: string): id is FilmId => Object.hasOwn(FILMS, id);
const ramp = (t: number, a: number, b: number) => ease((t - a) / (b - a));
const windowAt = (t: number, a: number, b: number, c: number, d: number) =>
  ramp(t, a, b) * (1 - ramp(t, c, d));
/** 非随机、纯数值的轨道插值；任何时间可直接恢复，不依赖前一帧。 */
export function track(t: number, keys: readonly (readonly [number, number])[]) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++)
    if (t <= keys[i][0])
      return mix(keys[i - 1][1], keys[i][1], ramp(t, keys[i - 1][0], keys[i][0]));
  return keys.at(-1)![1];
}

export function sampleCinematicFilm(seconds: number, id: FilmId) {
  if (!Number.isFinite(seconds) || !isFilmId(id)) throw new RangeError('无效影片或时间');
  // 末帧连同光照/机位完全复现开场，避免循环时背景或光线跳变。
  const t = seconds >= 20 ? 0 : Math.max(0, seconds);
  const extraction = ramp(t, 5, 7.7) * (1 - ramp(t, 14.5, 17));
  const left = id === 'reveal' ? ramp(t, 5, 7.4) * (1 - ramp(t, 14.7, 17)) : extraction;
  const right = id === 'reveal' ? ramp(t, 5.45, 7.9) * (1 - ramp(t, 14.5, 16.8)) : extraction;
  const lid = ramp(t, 2, 4.5) * (1 - ramp(t, 17, 18.5));
  const dance = windowAt(t, 8, 9, 13.2, 14.4);
  const float = windowAt(t, 0, 2, 18, 20);
  const wipe = windowAt(t, 10, 10.8, 10.8, 11.7);
  let yaw = 0.3,
    elevation = 0.25,
    edge = 0,
    ear = 0,
    close = 7.2,
    roll = 0,
    stem = 0;
  let environment = 0.8,
    ambient = 0.45,
    key = 1.9,
    fill = 0.9,
    rim = 1.5,
    sweep = 0;
  let background: [number, number, number] = [0.88, 0.865, 0.835];
  if (id === 'reveal') {
    yaw = track(t, [
      [0, 0.65],
      [4.5, -0.35],
      [8, -0.45],
      [9.7, 0.08],
      [11, 0.08],
      [12.5, 0.4],
      [15, 0.35],
      [18, 0.3],
      [20, 0.65],
    ]);
    elevation = track(t, [
      [0, 0.12],
      [4.5, 0.38],
      [8, 0.2],
      [9.7, 0.1],
      [11, 0.1],
      [12.5, 0.26],
      [17, 0.4],
      [20, 0.12],
    ]);
    edge = 1 - windowAt(t, 0.8, 3.5, 18.1, 20);
    ear = windowAt(t, 8, 9.5, 11, 12.3);
    close = mix(6.4, 7.2, ear);
    roll = -0.09 * windowAt(t, 5, 8, 13, 15);
    const reveal = windowAt(t, 0, 3, 18.5, 20);
    environment = mix(0.3, 0.8, reveal);
    fill = mix(0.18, 0.9, reveal);
    sweep = track(t, [
      [0, -1],
      [3, 0.5],
      [9, 0.8],
      [14, -0.4],
      [20, -1],
    ]);
  } else if (id === 'sculpture') {
    yaw = track(t, [
      [0, -0.4],
      [5, 0.5],
      [8, 1.05],
      [12, -0.9],
      [16, -0.55],
      [20, -0.4],
    ]);
    elevation = track(t, [
      [0, 0.22],
      [5, 0.35],
      [9, 0.15],
      [12, 0.48],
      [16, 0.28],
      [20, 0.22],
    ]);
    roll = 0.14 * Math.sin((t / 20) * Math.PI * 2) * float;
    background = [0.73, 0.8, 0.82];
    sweep = Math.sin((t * Math.PI) / 10) * 0.8;
    rim = 2.4;
  } else {
    yaw = track(t, [
      [0, -0.55],
      [4.5, 0.4],
      [8, 0.3],
      [10.5, -0.6],
      [13, 0.5],
      [16, 0.35],
      [20, -0.55],
    ]);
    elevation = track(t, [
      [0, 0.08],
      [4.5, 0.35],
      [8, 0.22],
      [11, 0.05],
      [14, 0.3],
      [20, 0.08],
    ]);
    edge = 1 - windowAt(t, 0.8, 3.5, 18.2, 20);
    ear = windowAt(t, 7.9, 9.5, 11.4, 13.1);
    stem = windowAt(t, 9.9, 11, 11.8, 13.1);
    close = mix(7.2, 5.3, stem);
    const reveal = windowAt(t, 11, 14, 16, 19);
    const readable = windowAt(t, 2, 5, 17.5, 20);
    environment = mix(0.025 + 0.1 * readable, 0.45, reveal);
    ambient = mix(0.015 + 0.06 * readable, 0.22, reveal);
    key = mix(0.08, 1.6, reveal);
    fill = mix(0.02, 0.4, reveal);
    rim = 3.2;
    sweep = track(t, [
      [0, -1.2],
      [4, 1],
      [8, -0.9],
      [12, 1.1],
      [16, 0.2],
      [20, -1.2],
    ]);
    background = [0.009, 0.013, 0.021];
  }
  const phase =
    t < 2
      ? id === 'sculpture'
        ? '挣脱重力'
        : id === 'light'
          ? '轮廓初现'
          : '曲线悬念'
      : t < 5
        ? '揭幕开盖'
        : t < 8
          ? '双耳升起'
          : t < 12
            ? id === 'reveal'
              ? '微距与擦镜'
              : id === 'sculpture'
                ? '失重轨道'
                : '光的巡礼'
            : t < 14.5
              ? '主视觉'
              : t < 17
                ? '双耳归位'
                : t < 18.5
                  ? '缓缓合盖'
                  : '回到开场';
  return {
    id,
    time: t,
    lid,
    extraction: Math.max(left, right),
    left,
    right,
    dance,
    float,
    wipe,
    phase,
    camera: { yaw, elevation, edge, ear, close, roll, stem },
    light: {
      environment,
      ambient,
      key,
      fill,
      rim,
      sweep,
      background,
      spot: id === 'light' ? 160 * windowAt(t, 1.5, 4, 17, 19.5) : 0,
      floor: id !== 'light',
    },
  };
}
/** 擦镜先向前脱离另一只耳机，再横移；退场严格反向。 */
export function wipeOffset(wipe: number): [number, number, number] {
  return [4.35 * ease((wipe - 0.35) / 0.65), 0.5 * wipe, 5.4 * ease(wipe / 0.55)];
}
export type FilmSample = ReturnType<typeof sampleCinematicFilm>;
