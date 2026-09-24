import { section, type Section } from './geometry';
import { PRODUCT, mm } from '../config/product';

/** 横截面半轴在场景单位下定义，外形端点与官方毫米包围尺寸一致。 */
export const bodyProfile: Section[] = [
  section(0, 1.42, 0.2),
  section(0.025, 1.62, 0.35),
  section(0.1, 1.87, 0.57),
  section(0.24, 2.1, 0.77),
  section(0.44, 2.29, 0.93),
  section(0.7, 2.43, 1.025),
  section(1.02, 2.495, 1.058),
  section(1.35, 2.505, 1.06),
  section(2.4, 2.505, 1.06),
  section(mm(PRODUCT.case.seamHeight - PRODUCT.case.seamGap / 2), 2.505, 1.06),
];
export const lidProfile: Section[] = [
  section(mm(PRODUCT.case.seamHeight + PRODUCT.case.seamGap / 2), 2.505, 1.06),
  section(3.35, 2.49, 1.059),
  section(3.5, 2.464, 1.055),
  section(3.7, 2.407, 1.037),
  section(3.9, 2.317, 0.993),
  section(4.1, 2.182, 0.907),
  section(4.3, 1.977, 0.756),
  section(4.45, 1.735, 0.571),
  section(4.55, 1.457, 0.369),
  section(4.6, 1.16, 0.181),
  section(mm(PRODUCT.case.height), 0.9, 0.002),
];
