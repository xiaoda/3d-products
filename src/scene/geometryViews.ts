/** 产品局部坐标的检查机位；不复用略带俯角的整套产品 back 预设。 */
export const GEOMETRY_VIEWS = {
  top: { label: '顶视', direction: [0, 1, 0], up: [0, 0, -1] },
  front: { label: '正视', direction: [0, 0, 1], up: [0, 1, 0] },
  side: { label: '右视', direction: [1, 0, 0], up: [0, 1, 0] },
  back: { label: '后视', direction: [0, 0, -1], up: [0, 1, 0] },
  left: { label: '左视', direction: [-1, 0, 0], up: [0, 1, 0] },
  bottom: { label: '仰视', direction: [0, -1, 0], up: [0, 0, 1] },
  backLeft: { label: '后左斜视', direction: [-1, 0.3, -1], up: [0, 1, 0] },
  backRight: { label: '后右斜视', direction: [1, 0.3, -1], up: [0, 1, 0] },
  frontLeft: { label: '前左斜视', direction: [-1, 0.3, 1], up: [0, 1, 0] },
  frontRight: { label: '前右斜视', direction: [1, 0.3, 1], up: [0, 1, 0] },
} as const;
export type GeometryView = keyof typeof GEOMETRY_VIEWS;
