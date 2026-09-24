/** 建模输入为毫米，场景中 1 单位 = 10 mm。+Y 向上，+Z 为正面。 */
export const mm = (value: number): number => value / 10;

export const PRODUCT = {
  name: 'AirPods 5',
  variant: 'standard',
  variantLabel: '标准充电盒版',
  case: { width: 50.1, height: 46.2, depth: 21.2, seamHeight: 32.8, seamGap: 0.22 },
  earbud: { width: 18.3, height: 30.2, depth: 18.1 },
  // 图片推定的展示几何参数，不是官方机械图尺寸。
  assembly: { seatX: 11.7, seatY: 28.6, hingeZ: -10.9, openAngle: 110 },
  stage: 3,
} as const;
