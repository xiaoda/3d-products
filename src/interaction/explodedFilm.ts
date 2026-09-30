import {
  EXPLODED_PARTS,
  EXPLODED_VIEW,
  type ExplodedPartId,
} from '../model/explodedEarbudDefinition';

export const EXPLODED_DURATION = 8;
export const EXPLODED_HOLD_DURATION = 1.2;
export const EXPLODED_OPEN_END = (EXPLODED_DURATION - EXPLODED_HOLD_DURATION) / 2;
export const EXPLODED_CLOSE_START = EXPLODED_DURATION - EXPLODED_OPEN_END;
export type Triple = [number, number, number];
export interface ExplodedTransform {
  offset: Triple;
  rotation: Triple;
}
export const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** 同步展开：没有部件延迟、焦点轨道、章节、编号或随机散射。 */
export function sampleExplodedFilm(seconds: number) {
  if (!Number.isFinite(seconds)) throw new RangeError('影片时间必须有限');
  const time = Math.max(0, Math.min(EXPLODED_DURATION, seconds));
  // 对称展开/回收；中间 1.2 秒保持完整展开，接入和退出停留的速度均为零。
  const open = smooth(Math.min(time, EXPLODED_DURATION - time) / EXPLODED_OPEN_END);
  // 空间脱离曲线与整齐目标保持不变；只有整体时间节奏改变，没有分组延迟。
  const spread: Triple = [open, open * open, open];
  const transforms = {} as Record<ExplodedPartId, ExplodedTransform>;
  for (const spec of EXPLODED_PARTS) {
    transforms[spec.id] = {
      offset: spec.offset.map((v, i) => v * spread[i]) as Triple,
      rotation: spec.rotation.map((v) => v * open * open) as Triple,
    };
  }
  return {
    time,
    open,
    spread,
    transforms,
    assembled: open === 0,
    // 定机位展示，停留时不通过相机或环境反射制造额外运动。
    yaw: EXPLODED_VIEW.yaw,
    reflection: 0,
  };
}
export type ExplodedFilmSample = ReturnType<typeof sampleExplodedFilm>;
