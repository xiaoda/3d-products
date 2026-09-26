import type { FilmSample } from '../interaction/films';
import {
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PCFShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SpotLight,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { createContactShadow } from './contactShadow';

export const STUDIO = {
  exposure: 1.05,
  environmentIntensity: 0.8,
  environmentResolution: 256,
  background: 0xeceae4,
  shadowResolution: 1024,
} as const;

/** 离屏摄影棚：矩形柔光箱直接生成高动态范围反射，不下载 HDR/图片。 */
export function createStudioEnvironment(): Scene {
  const environment = new Scene();
  environment.background = new Color().setRGB(0.18, 0.19, 0.21);
  const panels: Array<{
    name: string;
    position: [number, number, number];
    size: [number, number];
    intensity: number;
    color: number;
  }> = [
    { name: 'Key', position: [-7, 5, 6], size: [6, 10], intensity: 5.5, color: 0xfff7ec },
    { name: 'Fill', position: [8, 3, 2], size: [3, 9], intensity: 2.6, color: 0xf2f6ff },
    { name: 'Top', position: [0, 10, -2], size: [8, 7], intensity: 3.5, color: 0xffffff },
    { name: 'Rim', position: [2, 4, -9], size: [5, 8], intensity: 4, color: 0xffffff },
    { name: 'Front', position: [0, 1, 10], size: [6, 3], intensity: 1.8, color: 0xffffff },
  ];
  for (const p of panels) {
    const panel = new Mesh(
      new PlaneGeometry(...p.size),
      new MeshBasicMaterial({
        color: new Color(p.color).multiplyScalar(p.intensity),
        side: DoubleSide,
        toneMapped: false,
      }),
    );
    panel.name = `Softbox${p.name}`;
    panel.position.set(...p.position);
    panel.lookAt(0, 0, 0);
    environment.add(panel);
  }
  return environment;
}

export function disposeStudioEnvironment(environment: Scene) {
  environment.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    (object.material as MeshBasicMaterial).dispose();
  });
  environment.clear();
}

export function createStudioLighting(renderer: WebGLRenderer, scene: Scene) {
  const environment = createStudioEnvironment();
  const generator = new PMREMGenerator(renderer);
  const environmentTarget = (() => {
    try {
      return generator.fromScene(environment, 0.055, 0.1, 50, {
        size: STUDIO.environmentResolution,
      });
    } finally {
      generator.dispose();
      disposeStudioEnvironment(environment);
    }
  })();
  environmentTarget.texture.name = 'ProceduralStudioPMREM';
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = STUDIO.environmentIntensity;
  const rig = new Group();
  rig.name = 'StudioLights';
  const ambient = new HemisphereLight(0xffffff, 0x9b9892, 0.45);
  const key = new DirectionalLight(0xfff8ed, 1.9);
  key.position.set(-3, 13, 5);
  key.target.position.set(0, 2.7, 0);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(STUDIO.shadowResolution);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 10, bottom: -8, near: 0.5, far: 40 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.00004;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 3;
  const fill = new DirectionalLight(0xe9efff, 0.9);
  fill.position.set(8, 5, 3);
  const rim = new DirectionalLight(0xffffff, 1.5);
  rim.position.set(0, 7, -7);
  const sweepLight = new SpotLight(0xf3f6ff, 0, 40, 0.24, 0.85, 2);
  sweepLight.name = 'CinematicSweep';
  const filmBackground = new Color();
  let filmFloor = true;
  rig.add(ambient, key, key.target, fill, rim, sweepLight, sweepLight.target);
  scene.add(rig);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const contact = createContactShadow(renderer, scene);
  let disposed = false;
  return {
    setFilmLighting(sample: FilmSample | null, target = new Vector3(0, 4, 0)) {
      const light = sample?.light;
      scene.background = light ? filmBackground.setRGB(...light.background) : null;
      scene.environmentIntensity = light?.environment ?? STUDIO.environmentIntensity;
      scene.environmentRotation.y = (light?.sweep ?? 0) * 0.65;
      ambient.intensity = light?.ambient ?? 0.45;
      key.intensity = light?.key ?? 1.9;
      fill.intensity = light?.fill ?? 0.9;
      rim.intensity = light?.rim ?? 1.5;
      key.position.set(-3 + (light?.sweep ?? 0) * 6, 13, 5);
      rim.position.set((light?.sweep ?? 0) * 5, 7, -7);
      sweepLight.intensity = light?.spot ?? 0;
      sweepLight.position.set((light?.sweep ?? 0) * 7, 9, 7);
      sweepLight.target.position.copy(target);
      filmFloor = light?.floor ?? true;
    },
    markDirty() {
      renderer.shadowMap.needsUpdate = true;
      contact.markDirty();
    },
    updateFloor(cameraPosition: Vector3, enabled: boolean) {
      contact.floor.visible =
        enabled && filmFloor && cameraPosition.y > contact.floor.position.y + 0.1;
    },
    renderContactShadow: contact.render,
    inspect() {
      return { contactUpdates: contact.updates, floorVisible: contact.floor.visible };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.environment = null;
      environmentTarget.dispose();
      key.shadow.dispose();
      contact.dispose();
      rig.removeFromParent();
    },
  };
}
