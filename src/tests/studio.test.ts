import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { createStudioEnvironment, STUDIO, disposeStudioEnvironment } from '../scene/lighting';
import { CAMERA_PRESETS, SHOTS } from '../scene/cameraPresets';

describe('摄影棚与构图配置', () => {
  it('反射环境由具名柔光箱组成，不依赖外部贴图', () => {
    const environment = createStudioEnvironment();
    let panels = 0;
    environment.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      panels++;
      expect(object.name).toMatch(/^Softbox/);
      expect((object.material as MeshBasicMaterial).map).toBeNull();
      expect(object.position.length()).toBeGreaterThan(0);
    });
    expect(panels).toBeGreaterThanOrEqual(4);
    disposeStudioEnvironment(environment);
    expect(STUDIO.exposure).toBeGreaterThan(0);
    expect(STUDIO.environmentResolution).toBe(256);
  });
  it('三组摄影构图有确定姿态，所有相机方向有效', () => {
    expect(SHOTS.closed.pose).toBe('closed');
    expect(SHOTS.open.pose).toBe('open');
    expect(SHOTS.detail.view).toBe('earbud');
    for (const preset of Object.values(CAMERA_PRESETS)) {
      expect(new Vector3(...preset.direction).length()).toBeGreaterThan(0);
      expect(preset.distanceScale).toBeGreaterThanOrEqual(0.85);
      expect(preset.distanceScale).toBeLessThanOrEqual(1.2);
    }
  });
});
