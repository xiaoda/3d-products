import { EXPLODED_DURATION } from './explodedFilm';

export type ExplodedPlayMode = 'static' | 'playing' | 'paused' | 'ended';
export function createExplodedPlayer() {
  let time = 0,
    mode: ExplodedPlayMode = 'static',
    loop = false,
    disposed = false;
  return {
    inspect: () => ({ time, mode, loop }),
    play() {
      if (disposed) return;
      if (mode === 'static' || mode === 'ended') time = 0;
      mode = 'playing';
    },
    pause() {
      if (mode === 'playing') mode = 'paused';
    },
    seek(seconds: number) {
      if (!Number.isFinite(seconds)) throw new RangeError('定位时间无效');
      if (disposed) return;
      time = Math.max(0, Math.min(EXPLODED_DURATION, seconds));
      mode = time === EXPLODED_DURATION ? 'ended' : 'paused';
    },
    restart() {
      if (!disposed) {
        time = 0;
        mode = 'playing';
      }
    },
    stop() {
      mode = 'static';
      time = 0;
    },
    setLoop(value: boolean) {
      loop = value;
    },
    update(delta: number) {
      if (!Number.isFinite(delta) || delta < 0) throw new RangeError('时间步长无效');
      if (disposed || mode !== 'playing' || delta === 0) return false;
      time += delta;
      if (time >= EXPLODED_DURATION) {
        if (loop) time %= EXPLODED_DURATION;
        else {
          time = EXPLODED_DURATION;
          mode = 'ended';
        }
      }
      return true;
    },
    dispose() {
      disposed = true;
      mode = 'static';
    },
  };
}
