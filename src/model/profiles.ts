import { section, type Section } from './geometry';
import { PRODUCT, mm } from '../config/product';

/** 横截面半轴在场景单位下定义，外形端点与官方毫米包围尺寸一致。 */
export const caseExponent = 3.4;
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
  section(3.57, 2.5, 1.06),
  section(3.84, 2.445, 1.035),
  section(4.07, 2.34, 0.975),
  section(4.27, 2.19, 0.86),
  section(4.44, 1.99, 0.68),
  section(4.55, 1.77, 0.46),
  section(4.6, 1.56, 0.28),
  section(4.62, 1.42, 0.2),
];

export const earbudProfile: Section[] = [
  section(-1.51, 0, 0, 0.28, -0.27),
  section(-1.49, 0.13, 0.12, 0.28, -0.27),
  section(-1.44, 0.23, 0.21, 0.28, -0.27),
  section(-1.34, 0.27, 0.245, 0.28, -0.27),
  section(-0.85, 0.275, 0.255, 0.28, -0.27),
  section(-0.35, 0.285, 0.275, 0.27, -0.25),
  section(-0.1, 0.34, 0.37, 0.21, -0.19),
  section(0.12, 0.5, 0.57, 0.055, -0.07),
  section(0.36, 0.74, 0.77, -0.12, 0.03),
  section(0.5, 0.856, 0.857, -0.13, 0.024),
  section(0.65, 0.9, 0.895, -0.136, 0.016),
  section(0.8, 0.886, 0.881, -0.143, 0.004),
  section(0.95, 0.844, 0.839, -0.152, -0.01),
  section(1.1, 0.767, 0.763, -0.166, -0.028),
  section(1.25, 0.645, 0.642, -0.18, -0.048),
  section(1.37, 0.492, 0.489, -0.191, -0.064),
  section(1.45, 0.33, 0.328, -0.199, -0.074),
  section(1.49, 0.193, 0.192, -0.203, -0.078),
  section(1.505, 0.097, 0.096, -0.204, -0.08),
  section(1.51, 0, 0, -0.205, -0.08),
];

export function wellProfile(side: -1 | 1): Section[] {
  const x = side * mm(PRODUCT.assembly.seatX);
  return [
    section(1.15, 0, 0, x + side * 0.43, -0.29),
    section(1.18, 0.18, 0.16, x + side * 0.43, -0.29),
    section(1.28, 0.36, 0.34, x + side * 0.43, -0.29),
    section(2.25, 0.37, 0.36, x + side * 0.43, -0.27),
    section(2.58, 0.54, 0.55, x + side * 0.3, -0.19),
    section(2.82, 0.76, 0.77, x + side * 0.18, -0.09),
    section(3.05, 0.9, 0.9, x + side * 0.045, -0.02),
    section(3.22, 0.965, 0.91, x, 0),
    section(bodyProfile.at(-1)!.y, 0.98, 0.925, x, 0),
  ];
}

export function lidWellProfile(side: -1 | 1): Section[] {
  const x = side * mm(PRODUCT.assembly.seatX);
  return [
    section(lidProfile[0].y, 0.98, 0.925, x, 0),
    section(3.39, 0.96, 0.92, x, 0),
    section(3.7, 0.97, 0.925, x, 0.01),
    section(3.95, 0.87, 0.83, x - side * 0.02, -0.02),
    section(4.17, 0.67, 0.66, x - side * 0.03, -0.04),
    section(4.35, 0.42, 0.43, x - side * 0.05, -0.06),
    section(4.45, 0.14, 0.16, x - side * 0.075, -0.08),
    section(4.47, 0, 0, x - side * 0.08, -0.08),
  ];
}
