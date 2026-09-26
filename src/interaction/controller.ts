import { sampleCinematicFilm, isFilmId, type FilmId } from './films';
import {
  FILM_DURATION,
  clamp01,
  ease,
  mix,
  type MotionAction,
  type MotionMode,
  type MotionValue,
} from './state';

interface Step {
  from: MotionValue;
  to: MotionValue;
  duration: number;
}
/** 唯一产品动作时钟；不持有 DOM、WebGL 或自己的 RAF，可按固定帧时间离线采样。 */
export function createMotionController(reducedMotion = false) {
  let film: FilmId = 'reveal';
  const sampleFilm = (time: number) => sampleCinematicFilm(time, film);
  let value: MotionValue = { lid: 1, extraction: 0 };
  let mode: MotionMode = 'idle',
    action: MotionAction | null = null;
  let time = 0,
    loop = true,
    elapsed = 0,
    disposed = false;
  let steps: Step[] = [];
  function stop() {
    steps = [];
    elapsed = 0;
    action = null;
    mode = 'idle';
  }
  function sync(next: MotionValue) {
    if (disposed) return;
    if (!Number.isFinite(next.lid + next.extraction)) throw new RangeError('无效动作状态');
    stop();
    value = { lid: clamp01(next.lid), extraction: clamp01(next.extraction) };
    if (value.extraction > 0) value.lid = 1;
  }
  function request(next: MotionAction) {
    if (disposed || mode === 'action') return false;
    stop();
    let from = { ...value };
    const add = (to: MotionValue, seconds: number) => {
      const distance = Math.max(
        Math.abs(to.lid - from.lid),
        Math.abs(to.extraction - from.extraction),
      );
      if (distance > 1e-9) steps.push({ from, to, duration: seconds * distance });
      from = to;
    };
    if (next === 'close' || next === 'return') add({ lid: value.lid, extraction: 0 }, 2.2);
    if (next === 'close') add({ lid: 0, extraction: 0 }, 1.15);
    if (next === 'open' || next === 'extract') add({ lid: 1, extraction: value.extraction }, 1.15);
    if (next === 'extract') add({ lid: 1, extraction: 1 }, 2.2);
    if (!steps.length) return false;
    action = next;
    mode = 'action';
    if (reducedMotion) {
      value = { ...steps.at(-1)!.to };
      stop();
    }
    return true;
  }
  function update(delta: number): boolean {
    if (!Number.isFinite(delta) || delta < 0) throw new RangeError('无效时间步长');
    if (disposed || delta === 0 || mode === 'idle' || mode === 'paused') return false;
    if (mode === 'playing') {
      time += delta;
      if (time >= FILM_DURATION) {
        if (loop) time %= FILM_DURATION;
        else {
          time = FILM_DURATION;
          mode = 'paused';
        }
      }
      const sample = sampleFilm(time);
      value = { lid: sample.lid, extraction: sample.extraction };
      return true;
    }
    elapsed += delta;
    while (steps.length && elapsed >= steps[0].duration) {
      elapsed -= steps[0].duration;
      value = { ...steps.shift()!.to };
    }
    if (!steps.length) {
      stop();
      return true;
    }
    const step = steps[0],
      t = ease(elapsed / step.duration);
    value = {
      lid: mix(step.from.lid, step.to.lid, t),
      extraction: mix(step.from.extraction, step.to.extraction, t),
    };
    return true;
  }
  return {
    request,
    update,
    sync,
    stop,
    play() {
      if (disposed) return;
      if (mode !== 'paused' || time >= FILM_DURATION) time = 0;
      steps = [];
      action = null;
      mode = 'playing';
      const frame = sampleFilm(time);
      value = { lid: frame.lid, extraction: frame.extraction };
    },
    pause() {
      if (mode === 'playing') mode = 'paused';
    },
    seek(seconds: number) {
      if (!Number.isFinite(seconds)) throw new RangeError('无效影片时间');
      if (disposed) return;
      stop();
      time = Math.max(0, Math.min(FILM_DURATION, seconds));
      mode = 'paused';
      const frame = sampleFilm(time);
      value = { lid: frame.lid, extraction: frame.extraction };
    },
    selectFilm(next: FilmId) {
      if (!isFilmId(next)) throw new RangeError('未知片段');
      if (disposed) return;
      stop();
      film = next;
      time = 0;
      mode = 'playing';
      const frame = sampleFilm(0);
      value = { lid: frame.lid, extraction: frame.extraction };
    },
    setLoop(next: boolean) {
      loop = next;
    },
    reset() {
      if (disposed) return;
      stop();
      time = 0;
      value = { lid: 1, extraction: 0 };
    },
    inspect() {
      return {
        film,
        value: { ...value },
        mode,
        action,
        time,
        duration: FILM_DURATION,
        loop,
        phase: sampleFilm(time).phase,
      };
    },
    dispose() {
      stop();
      disposed = true;
    },
  };
}
