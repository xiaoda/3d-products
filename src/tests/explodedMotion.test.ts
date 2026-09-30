import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { Box3, Mesh, OrthographicCamera, Vector3, Matrix4 } from 'three';
import { createExplodedEarbud } from '../model/createExplodedEarbud';
import { createExplodedFraming } from '../scene/explodedFilmCamera';
import { EXPLODED_DURATION, sampleExplodedFilm } from '../interaction/explodedFilm';
import { triangleSurface } from './helpers/triangleSurface';
import { EXPLODED_PARTS } from '../model/explodedEarbudDefinition';

describe('结构动作与镜头', () => {
  let model: ReturnType<typeof createExplodedEarbud>,
    framing: ReturnType<typeof createExplodedFraming>;
  beforeAll(() => {
    model = createExplodedEarbud();
    framing = createExplodedFraming(model);
  }, 30000);
  afterAll(() => model.dispose());
  const matrices = () => Object.values(model.parts).map((p) => p.matrix.toArray());
  test('最大展开时内部件沿中轴等间距排列，两片外壳平行分列两侧', () => {
    const sample = sampleExplodedFilm(4);
    model.applyFilm(sample);
    const shot = framing.frame(sample, 9 / 16);
    const direction = shot.position.clone().sub(shot.target).normalize();
    const right = shot.up.clone().cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    const bounds = (node: typeof model.root) => {
      const box = new Box3();
      node.traverse((mesh) => {
        if (!(mesh instanceof Mesh)) return;
        const position = mesh.geometry.attributes.position,
          p = new Vector3();
        for (let i = 0; i < position.count; i++) {
          p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
          box.expandByPoint(new Vector3(p.dot(right), p.dot(up), p.dot(direction)));
        }
      });
      return box;
    };
    const rows = ['driver', 'battery', 'flex', 'logic', 'sensing', 'contacts'] as const;
    const boxes = rows.map((id) => bounds(model.parts[id]));
    for (const b of boxes) expect(b.getCenter(new Vector3()).x).toBeCloseTo(0, 8);
    for (let i = 1; i < boxes.length; i++)
      expect(boxes[i - 1].min.y - boxes[i].max.y).toBeCloseTo(0.18, 8);
    const left = bounds(model.parts.backShell),
      rightBox = bounds(model.parts.frontShell);
    expect(left.max.x).toBeLessThan(Math.min(...boxes.map((b) => b.min.x)) - 0.1);
    expect(rightBox.min.x).toBeGreaterThan(Math.max(...boxes.map((b) => b.max.x)) + 0.1);
    expect(
      model.parts.frontShell.quaternion.angleTo(model.parts.backShell.quaternion),
    ).toBeLessThan(1e-8);
    for (const id of ['sensing', 'contacts'] as const) {
      const children = model.parts[id].children.map((child) => bounds(child as typeof model.root));
      const centerY = children[0].getCenter(new Vector3()).y;
      for (const child of children)
        expect(child.getCenter(new Vector3()).y).toBeCloseTo(centerY, 8);
    }
    for (const t of [3.5, 4.5]) {
      model.applyFilm(sampleExplodedFilm(t));
      const logic = bounds(model.parts.logic),
        sensing = bounds(model.parts.sensing),
        contacts = bounds(model.parts.contacts);
      expect(logic.min.y - sensing.max.y).toBeGreaterThan(0.07);
      expect(sensing.min.y - contacts.max.y).toBeGreaterThan(0.07);
      for (const id of ['sensing', 'contacts'] as const) {
        const centers = model.parts[id].children.map(
          (node) => bounds(node as typeof model.root).getCenter(new Vector3()).y,
        );
        expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(0.03);
      }
    }
  });
  test('小件横排没有历史依赖，静态内部与片尾恢复装配原位', () => {
    const children = [...model.parts.sensing.children, ...model.parts.contacts.children];
    const poses = () => children.map((node) => node.matrix.toArray());
    model.setPose('inside');
    const rest = poses();
    model.applyFilm(sampleExplodedFilm(3));
    const partial = poses();
    for (const t of [4, 7, 2, 8, 3]) model.applyFilm(sampleExplodedFilm(t));
    expect(poses()).toEqual(partial);
    model.setPose('inside');
    expect(poses()).toEqual(rest);
    model.applyFilm(sampleExplodedFilm(4));
    expect(poses()).not.toEqual(rest);
    model.applyFilm(sampleExplodedFilm(8));
    expect(poses()).toEqual(rest);
    for (const child of children) expect(child.scale.toArray()).toEqual([1, 1, 1]);
  });
  test('任意跳转无历史依赖，展开和末帧准确复位', () => {
    model.applyFilm(sampleExplodedFilm(2));
    const before = matrices();
    for (const t of [7, 4, 1, 5, 8, 2]) model.applyFilm(sampleExplodedFilm(t));
    expect(matrices()).toEqual(before);
    model.setPose('exploded');
    const accepted = matrices();
    model.applyFilm(sampleExplodedFilm(4));
    expect(matrices()).toEqual(accepted);
    model.applyFilm(sampleExplodedFilm(8));
    expect(model.complete.visible).toBe(true);
    for (const p of EXPLODED_PARTS) expect(model.parts[p.id].visible).toBe(false);
  });
  test('停留期间全部节点保持展开姿态，退出停留后继续回收', () => {
    const nodes: number[][] = [];
    const capture = (t: number) => {
      model.applyFilm(sampleExplodedFilm(t));
      nodes.length = 0;
      model.root.traverse((node) => nodes.push(node.matrix.toArray()));
      return nodes.map((matrix) => [...matrix]);
    };
    const hold = capture(3.4);
    for (const t of [3.5, 4, 4.5, 4.6]) expect(capture(t)).toEqual(hold);
    expect(capture(4.8)).not.toEqual(hold);
  });
  test('301 个时刻所有零件始终在安全区，镜头位置、方向、尺度和目标固定', () => {
    for (const aspect of [9 / 16, 1])
      for (let i = 0; i <= 300; i++) {
        const sample = sampleExplodedFilm((i / 300) * EXPLODED_DURATION);
        model.applyFilm(sample);
        const shot = framing.frame(sample, aspect);
        const reference = framing.frame(sampleExplodedFilm(0), aspect);
        expect(shot.half).toBe(reference.half);
        expect(shot.target.toArray()).toEqual(reference.target.toArray());
        expect(shot.position.toArray()).toEqual(reference.position.toArray());
        expect(shot.up.toArray()).toEqual(reference.up.toArray());
        const camera = new OrthographicCamera(
          -shot.half * aspect,
          shot.half * aspect,
          shot.half,
          -shot.half,
          0.1,
          100,
        );
        camera.position.copy(shot.position);
        camera.up.copy(shot.up);
        camera.lookAt(shot.target);
        camera.updateMatrixWorld(true);
        const axes = [0, 1, 2].map((axis) =>
          new Vector3().setFromMatrixColumn(camera.matrixWorld, axis),
        );
        for (const point of framing.worldPoints(axes)) {
          point.project(camera);
          expect(Math.abs(point.z), `time=${sample.time}`).toBeLessThan(1);
          expect(Math.abs(point.x), `x time=${sample.time}`).toBeLessThan(0.84);
          expect(Math.abs(point.y), `y time=${sample.time}`).toBeLessThan(0.81);
        }
      }
  }, 30000);
  test('回装末段镜头连续，首尾一致；非法画幅拒绝', () => {
    const frameAt = (t: number) => {
      const sample = sampleExplodedFilm(t);
      model.applyFilm(sample);
      return framing.frame(sample, 9 / 16);
    };
    const start = frameAt(0),
      end = frameAt(EXPLODED_DURATION);
    expect(start.half).toBeCloseTo(end.half, 12);
    expect(start.position.distanceTo(end.position)).toBeLessThan(1e-10);
    for (const t of [0.1, 2, 4, 6, 7.9]) {
      const a = frameAt(t - 0.0001),
        b = frameAt(t + 0.0001);
      expect(a.position.distanceTo(b.position), `position t=${t}`).toBeLessThan(0.001);
      expect(Math.abs(a.half - b.half), `half t=${t}`).toBeLessThan(0.001);
    }
    for (const aspect of [0, -1, NaN, Infinity])
      expect(() => framing.frame(sampleExplodedFilm(0), aspect)).toThrow(RangeError);
  });
  test('所有部件始终实体显示，没有逐件淡化', () => {
    const opacities = (node: typeof model.root) => {
      const values: number[] = [];
      node.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const mat of Array.isArray(object.material) ? object.material : [object.material])
          values.push(mat.opacity);
      });
      return values;
    };
    for (const t of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      model.applyFilm(sampleExplodedFilm(t));
      expect(opacities(model.root).every((v) => v === 1)).toBe(true);
    }
    model.setPose('exploded');
    expect(opacities(model.root).every((v) => v === 1)).toBe(true);
  });
  test('同步展开采样，主要内部件表面边样本不穿过壳体三角面', () => {
    const shells: { mesh: Mesh; surface: ReturnType<typeof triangleSurface> }[] = [];
    for (const id of ['frontShell', 'backShell'] as const)
      model.parts[id].traverse((mesh) => {
        if (mesh instanceof Mesh) shells.push({ mesh, surface: triangleSurface(mesh.geometry) });
      });
    const edges: { mesh: Mesh; id: string; segments: [Vector3, Vector3][] }[] = [];
    for (const id of ['driver', 'battery', 'logic'] as const)
      model.parts[id].traverse((mesh) => {
        if (!(mesh instanceof Mesh)) return;
        const pos = mesh.geometry.attributes.position,
          index = mesh.geometry.index;
        const count = Math.floor((index?.count ?? pos.count) / 3),
          segments: [Vector3, Vector3][] = [];
        for (let face = 0; face < count; face += Math.max(1, Math.floor(count / 24))) {
          const points = [0, 1, 2].map((k) =>
            new Vector3().fromBufferAttribute(pos, index ? index.getX(face * 3 + k) : face * 3 + k),
          );
          for (let k = 0; k < 3; k++) segments.push([points[k], points[(k + 1) % 3]]);
        }
        edges.push({ mesh, id, segments });
      });
    const overlaps = new Set<string>();
    for (let i = 0; i <= 120; i++) {
      const time = (i / 120) * EXPLODED_DURATION;
      model.applyFilm(sampleExplodedFilm(time));
      for (const shell of shells) {
        const shellBox = new Box3().setFromObject(shell.mesh);
        const inverse = shell.mesh.matrixWorld.clone().invert();
        for (const entry of edges) {
          if (!shellBox.intersectsBox(new Box3().setFromObject(entry.mesh))) continue;
          const matrix = new Matrix4().multiplyMatrices(inverse, entry.mesh.matrixWorld);
          for (const [a, b] of entry.segments) {
            if (
              shell.surface.intersectsSegment(
                a.clone().applyMatrix4(matrix),
                b.clone().applyMatrix4(matrix),
              )
            ) {
              overlaps.add(`${time.toFixed(3)} ${entry.id}/${shell.mesh.name}`);
              break;
            }
          }
        }
      }
    }
    expect([...overlaps]).toEqual([]);
  }, 30000);
});
