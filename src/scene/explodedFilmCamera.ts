import { Box3, Mesh, Vector3 } from 'three';
import type { createExplodedEarbud } from '../model/createExplodedEarbud';
import {
  EXPLODED_DURATION,
  sampleExplodedFilm,
  type ExplodedFilmSample,
} from '../interaction/explodedFilm';
import { EXPLODED_VIEW, type ExplodedPartId } from '../model/explodedEarbudDefinition';

export interface ExplodedCameraFrame {
  target: Vector3;
  position: Vector3;
  up: Vector3;
  half: number;
}
const UP = new Vector3(EXPLODED_VIEW.roll, 1, 0).normalize();
const directionAt = (yaw: number) =>
  new Vector3(Math.sin(yaw), EXPLODED_VIEW.pitch, Math.cos(yaw)).normalize();

/** 先校准完整动作的投影范围；播放时固定位置、方向、目标和尺度。 */
export function createExplodedFraming(model: ReturnType<typeof createExplodedEarbud>) {
  const cached: { group: ExplodedPartId | 'complete'; mesh: Mesh }[] = [];
  for (const [group, node] of Object.entries({ complete: model.complete, ...model.parts }))
    node.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      cached.push({ group: group as ExplodedPartId | 'complete', mesh: object });
    });
  // 取各轴上的真实顶点极值，不把曲面 AABB 的空角算进画幅。
  // 对指定投影轴而言，极值点严格覆盖全部顶点，避免只抽点导致裁切。
  function worldPoints(axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
    const points: Vector3[] = [];
    const p = new Vector3();
    for (const entry of cached) {
      if (!(entry.group === 'complete' ? model.complete : model.parts[entry.group]).visible)
        continue;
      const position = entry.mesh.geometry.attributes.position;
      const ranges = axes.map(() => ({
        min: Infinity,
        max: -Infinity,
        a: new Vector3(),
        b: new Vector3(),
      }));
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i).applyMatrix4(entry.mesh.matrixWorld);
        for (let j = 0; j < axes.length; j++) {
          const value = p.dot(axes[j]),
            range = ranges[j];
          if (value < range.min) {
            range.min = value;
            range.a.copy(p);
          }
          if (value > range.max) {
            range.max = value;
            range.b.copy(p);
          }
        }
      }
      for (const range of ranges) points.push(range.a, range.b);
    }
    return points;
  }
  const oldPose = model.pose;
  model.applyFilm(sampleExplodedFilm(EXPLODED_DURATION / 2));
  const bounds = new Box3().setFromPoints(worldPoints());
  const target = bounds.getCenter(new Vector3());
  let halfWidth = 0,
    halfHeight = 0;
  for (let i = 0; i <= 120; i++) {
    const sample = sampleExplodedFilm((i / 120) * EXPLODED_DURATION);
    model.applyFilm(sample);
    const direction = directionAt(sample.yaw);
    const right = UP.clone().cross(direction).normalize(),
      up = direction.clone().cross(right).normalize();
    for (const point of worldPoints([right, up])) {
      point.sub(target);
      halfWidth = Math.max(halfWidth, Math.abs(point.dot(right)));
      halfHeight = Math.max(halfHeight, Math.abs(point.dot(up)));
    }
  }
  model.setPose(oldPose);
  function frame(sample: ExplodedFilmSample, aspect: number): ExplodedCameraFrame {
    if (!Number.isFinite(aspect) || aspect <= 0) throw new RangeError('画幅无效');
    const half = Math.max(halfWidth / aspect / 0.82, halfHeight / 0.79);
    return {
      target: target.clone(),
      position: target.clone().addScaledVector(directionAt(sample.yaw), 15),
      up: UP.clone(),
      half,
    };
  }
  return { frame, worldPoints };
}
