import { Group, Mesh } from 'three';

const size = 180,
  extent = 1.65,
  step = (extent * 2) / size;
const at = (i: number) => -extent + (i + 0.5) * step;
const pixel = (x: number) => Math.max(0, Math.min(size - 1, Math.floor((x + extent) / step)));

/** 三角形投影光栅化，仅在测试中使用；固定尺度，不对轮廓单独旋转/拉伸配准。 */
export function silhouetteIoU(
  root: Group,
  axes: [number, number],
  reference: readonly (readonly [number, number])[],
): number {
  const mask = new Uint8Array(size * size);
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const p = object.geometry.getAttribute('position'),
      indices = object.geometry.index!;
    const xy = (id: number) => [p.getComponent(id, axes[0]), p.getComponent(id, axes[1])];
    const cross = (a: number[], b: number[], x: number, y: number) =>
      (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    for (let i = 0; i < indices.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((j) => xy(indices.getX(i + j)));
      if (Math.abs(cross(a, b, c[0], c[1])) < 1e-10) continue;
      const minX = pixel(Math.min(a[0], b[0], c[0])),
        maxX = pixel(Math.max(a[0], b[0], c[0]));
      const minY = pixel(Math.min(a[1], b[1], c[1])),
        maxY = pixel(Math.max(a[1], b[1], c[1]));
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          if (mask[y * size + x]) continue;
          const px = at(x),
            py = at(y),
            ab = cross(a, b, px, py),
            bc = cross(b, c, px, py),
            ca = cross(c, a, px, py);
          if ((ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0))
            mask[y * size + x] = 1;
        }
    }
  });
  let intersection = 0,
    union = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = at(x),
        py = at(y);
      let inside = false;
      for (let i = 0, j = reference.length - 1; i < reference.length; j = i++) {
        const a = reference[i],
          b = reference[j];
        if (a[1] > py !== b[1] > py && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0])
          inside = !inside;
      }
      if (inside && mask[y * size + x]) intersection++;
      if (inside || mask[y * size + x]) union++;
    }
  return intersection / union;
}
