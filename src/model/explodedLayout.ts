import { Box3, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from 'three';
import { EXPLODED_PARTS, EXPLODED_VIEW, type ExplodedPartId } from './explodedEarbudDefinition';

/** 展示平面与峰值机位共用基准，排列不依赖画幅或截图像素。 */
const direction = new Vector3(
  Math.sin(EXPLODED_VIEW.yaw),
  EXPLODED_VIEW.pitch,
  Math.cos(EXPLODED_VIEW.yaw),
).normalize();
const right = new Vector3(EXPLODED_VIEW.roll, 1, 0).cross(direction).normalize();
const up = direction.clone().cross(right).normalize();
const displayRotation = new Quaternion().setFromRotationMatrix(
  new Matrix4().makeBasis(right, up, direction),
);
const worldPoint = (x: number, y: number, z: number) =>
  right.clone().multiplyScalar(x).addScaledVector(up, y).addScaledVector(direction, z);

function projectedBounds(node: Object3D) {
  node.updateWorldMatrix(true, true);
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
}

/** 几何仅测量一次；动画使用绝对校正，不缩放零件、不累积变换。 */
export function createExplodedLayout(parts: Record<ExplodedPartId, Object3D>) {
  const rest = new Map(EXPLODED_PARTS.map(({ id }) => [id, parts[id].position.clone()]));
  const children: { node: Object3D; from: Vector3; rotation: Quaternion; to: Vector3 }[] = [];
  for (const part of Object.values(parts)) {
    part.position.set(0, 0, 0);
    part.quaternion.identity();
  }
  // 原来散落在头部与柄底的小件，在峰值合成短横排；收合时准确返回原装配姿态。
  for (const id of ['sensing', 'contacts'] as const) {
    const row = parts[id].children.map((node) => {
      const from = node.position.clone(),
        rotation = node.quaternion.clone();
      node.quaternion.copy(displayRotation);
      const bounds = projectedBounds(node);
      return { node, from, rotation, bounds, width: bounds.max.x - bounds.min.x };
    });
    const gap = 0.11;
    let cursor = -(row.reduce((sum, item) => sum + item.width, 0) + gap * (row.length - 1)) / 2;
    for (const item of row) {
      const center = item.bounds.getCenter(new Vector3());
      const to = item.node.position
        .clone()
        .add(worldPoint(cursor + item.width / 2 - center.x, -center.y, -center.z));
      item.node.position.copy(to);
      children.push({ node: item.node, from: item.from, rotation: item.rotation, to });
      cursor += item.width + gap;
    }
  }
  const rows = ['driver', 'battery', 'flex', 'logic', 'sensing', 'contacts'] as const;
  const boxes = new Map(EXPLODED_PARTS.map(({ id }) => [id, projectedBounds(parts[id])]));
  const target = new Map<ExplodedPartId, Vector3>();
  const gap = 0.18;
  const totalHeight =
    rows.reduce((sum, id) => sum + boxes.get(id)!.getSize(new Vector3()).y, 0) +
    gap * (rows.length - 1);
  const innerHalf = Math.max(...rows.map((id) => boxes.get(id)!.getSize(new Vector3()).x)) / 2;
  function place(id: ExplodedPartId, x: number, y: number, depth: number) {
    const center = boxes.get(id)!.getCenter(new Vector3());
    target.set(id, worldPoint(x - center.x, y - center.y, depth - center.z));
  }
  let cursor = totalHeight / 2;
  for (const id of rows) {
    const height = boxes.get(id)!.getSize(new Vector3()).y;
    place(id, 0, cursor - height / 2, 0);
    cursor -= height + gap;
  }
  for (const [id, sign] of [
    ['backShell', -1],
    ['frontShell', 1],
  ] as const) {
    const width = boxes.get(id)!.getSize(new Vector3()).x;
    place(id, sign * (innerHalf + 0.16 + width / 2), 0, sign * 0.35);
  }
  const correction = new Map(
    EXPLODED_PARTS.map(({ id, offset }) => [
      id,
      target
        .get(id)!
        .clone()
        .sub(rest.get(id)!)
        .sub(new Vector3(...offset)),
    ]),
  );
  // 构造只进行测量，不改变原始装配状态。
  for (const { id } of EXPLODED_PARTS) parts[id].position.copy(rest.get(id)!);
  for (const child of children) {
    child.node.position.copy(child.from);
    child.node.quaternion.copy(child.rotation);
  }
  const identity = new Quaternion();
  return {
    apply(open: number) {
      // 主组件先沿已有净空曲线离壳，再连续收齐；不能过早横移穿过壳壁。
      const mix = open ** 4;
      // 小件横排接近全展时收敛更充分，避免仍散落在电路板旁。
      const rowEase = mix * mix * (3 - 2 * mix);
      const rowMix = rowEase * rowEase * (3 - 2 * rowEase);
      for (const { id } of EXPLODED_PARTS) {
        const amount = id === 'sensing' || id === 'contacts' ? rowMix : mix;
        parts[id].position.addScaledVector(correction.get(id)!, amount);
        parts[id].quaternion.slerp(identity, amount);
      }
      for (const child of children) {
        child.node.position.lerpVectors(child.from, child.to, rowMix);
        child.node.quaternion.slerpQuaternions(child.rotation, displayRotation, rowMix);
      }
    },
  };
}
