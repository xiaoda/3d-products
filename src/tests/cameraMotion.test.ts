import { expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { filmDirection, frameFilmBox, interpolateCamera } from '../scene/cameraMotion';
it('正反面镜头过渡保持观察距离，不从产品内部穿过', () => {
  const from = { target: new Vector3(0, 3, 0), position: new Vector3(0, 3, 15) };
  const to = { target: new Vector3(0, 3, 0), position: new Vector3(0, 3, -15) };
  for (let i = 0; i <= 100; i++) {
    const sample = interpolateCamera(from, to, i / 100);
    expect(sample.position.distanceTo(sample.target)).toBeCloseTo(15, 8);
  }
  expect(interpolateCamera(from, to, 1).position.distanceTo(to.position)).toBeLessThan(1e-8);
});

it('竖屏与横屏的盒体八角均在画面安全边距内', () => {
  const box = new Box3(new Vector3(-3, 0, -2), new Vector3(3, 9, 2));
  for (const aspect of [9 / 16, 16 / 9]) {
    const frame = frameFilmBox(box, filmDirection(0.6, 0.4), aspect, 32);
    const camera = new PerspectiveCamera(32, aspect, 0.1, 150);
    camera.position.copy(frame.position);
    camera.lookAt(frame.target);
    camera.updateMatrixWorld(true);
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const point = new Vector3(x, y, z).project(camera);
          expect(Math.abs(point.x)).toBeLessThanOrEqual(1 / 1.25 + 1e-9);
          expect(Math.abs(point.y)).toBeLessThanOrEqual(1 / 1.35 + 1e-9);
        }
  }
});
