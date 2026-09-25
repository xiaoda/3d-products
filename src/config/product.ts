/** 建模输入为毫米，场景中 1 单位 = 10 mm。+Y 向上，+Z 为正面。 */
export const mm = (value: number): number => value / 10;

export const PRODUCT = {
  name: 'AirPods 5',
  variant: 'standard',
  variantLabel: '标准充电盒版',
  case: { width: 50.1, height: 46.2, depth: 21.2, seamHeight: 32.075, seamGap: 0.15 },
  earbud: { width: 18.3, height: 30.2, depth: 18.1 },
  // 图片推定的展示几何参数，不是官方机械图尺寸。
  assembly: {
    seatX: 10.5,
    seatY: 28.4,
    seatZ: -2,
    // 右耳先绕局部 X，再 Y，再世界 Z；左耳用镜像共轭旋转。单位为度。
    seatPitch: 0,
    seatYaw: -45,
    seatRoll: -9,
    hingeY: 32.075,
    hingeZ: -10.9,
    openAngle: 115,
  },
  stage: 3,
} as const;
