/** 建模输入为毫米，场景中 1 单位 = 10 mm。+Y 向上，+Z 为正面。 */
export const mm = (value: number): number => value / 10;

export const PRODUCT = {
  name: 'AirPods 5',
  variant: 'standard',
  variantLabel: '标准充电盒版',
  case: { width: 50.1, height: 46.2, depth: 21.2, seamHeight: 32.8, seamGap: 0.22 },
  earbud: { width: 18.3, height: 30.2, depth: 18.1 },
  stage: 1,
} as const;
