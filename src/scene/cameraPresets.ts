import type { ProductPose } from '../model/createProduct';

export type ViewName =
  'perspective' | 'front' | 'side' | 'back' | 'top' | 'bottom' | 'interior' | 'earbud';
export interface CameraPreset {
  direction: [number, number, number];
  distanceScale: number;
}

export const CAMERA_PRESETS: Record<ViewName, CameraPreset> = {
  perspective: { direction: [7, 4.2, 17], distanceScale: 0.95 },
  front: { direction: [0, 0, 1], distanceScale: 1 },
  side: { direction: [1, 0, 0], distanceScale: 1 },
  back: { direction: [0, 0.15, -1], distanceScale: 1 },
  top: { direction: [0, 1, 0.0001], distanceScale: 1 },
  bottom: { direction: [0, -1, 0.0001], distanceScale: 1 },
  interior: { direction: [0, 1.7, 2.2], distanceScale: 0.95 },
  earbud: { direction: [-1.4, 0.32, 2.7], distanceScale: 0.9 },
};
export type ShotName = 'closed' | 'open' | 'detail';
export const SHOTS: Record<ShotName, { label: string; pose: ProductPose; view: ViewName }> = {
  closed: { label: '闭合主视觉', pose: 'closed', view: 'perspective' },
  open: { label: '开盖双耳', pose: 'open', view: 'perspective' },
  detail: { label: '单耳特写', pose: 'separated', view: 'earbud' },
};
