export const REVIEW_VIEWS = {
  back: { label: '后视', direction: [0, 0, -1], up: [0, 1, 0] },
  top: { label: '俯视', direction: [0, 1, 0], up: [0, 0, -1] },
  front: { label: '正视', direction: [0, 0, 1], up: [0, 1, 0] },
  right: { label: '右视', direction: [1, 0, 0], up: [0, 1, 0] },
  left: { label: '左视', direction: [-1, 0, 0], up: [0, 1, 0] },
  bottom: { label: '仰视', direction: [0, -1, 0], up: [0, 0, 1] },
  backLeft: { label: '后左斜视', direction: [-1, 0.3, -1], up: [0, 1, 0] },
  backRight: { label: '后右斜视', direction: [1, 0.3, -1], up: [0, 1, 0] },
  frontLeft: { label: '前左斜视', direction: [-1, 0.3, 1], up: [0, 1, 0] },
  frontRight: { label: '前右斜视', direction: [1, 0.3, 1], up: [0, 1, 0] },
} as const;
export type ReviewView = keyof typeof REVIEW_VIEWS;
export type ReviewMode = 'compare' | 'candidate' | 'legacy' | 'pair';
export type ReviewMaterial = 'clay' | 'stripes' | 'silhouette' | 'physical';

/** 同一投影、同一毫米比例，不根据新旧模型各自的包围盒缩放。 */
export function reviewFrustum(width: number, height: number, compare: boolean) {
  const aspect = width / (compare ? 2 : 1) / height;
  const halfHeight = Math.max(1.85, 1.18 / aspect);
  return {
    left: -halfHeight * aspect,
    right: halfHeight * aspect,
    top: halfHeight,
    bottom: -halfHeight,
  };
}
