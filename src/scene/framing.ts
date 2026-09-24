/** 根据包围球与视口短边求相机距离，保证旋转后也不会因初始构图裁切。 */
export function fitDistance(radius: number, aspect: number, verticalFov: number): number {
  if (
    radius <= 0 ||
    aspect <= 0 ||
    !Number.isFinite(radius + aspect + verticalFov) ||
    verticalFov <= 0 ||
    verticalFov >= 180
  ) {
    throw new RangeError('无效的相机构图参数');
  }
  const halfVertical = (verticalFov * Math.PI) / 360;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
  return (radius / Math.sin(Math.min(halfVertical, halfHorizontal))) * 1.13;
}
