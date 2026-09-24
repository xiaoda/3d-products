import {
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UniformsUtils,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

/** 从实际几何离屏投影并模糊；只在装配/可见性改变时重绘，不是固定椭圆贴图。 */
export function createContactShadow(renderer: WebGLRenderer, scene: Scene) {
  const size = 512,
    extent = 14;
  const target = new WebGLRenderTarget(size, size),
    scratch = new WebGLRenderTarget(size, size);
  target.texture.name = 'ProceduralContactShadow';
  const camera = new OrthographicCamera(-extent / 2, extent / 2, extent / 2, -extent / 2, 0.05, 12);
  // 从地面下看，优先捕获离地最近的表面；随离地高度降低阴影密度。
  camera.position.set(0, -0.2, 0);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 1, 0);
  const depth = new ShaderMaterial({
    side: DoubleSide,
    vertexShader: `varying float elevation; void main() { vec4 world = modelMatrix * vec4(position, 1.0); elevation = max(world.y, 0.0); gl_Position = projectionMatrix * viewMatrix * world; }`,
    fragmentShader: `varying float elevation; void main() { float alpha = 1.0 - smoothstep(0.0, 9.0, elevation); gl_FragColor = vec4(vec3(1.0), alpha); }`,
  });
  const horizontal = new ShaderMaterial({
    uniforms: UniformsUtils.clone(HorizontalBlurShader.uniforms),
    vertexShader: HorizontalBlurShader.vertexShader,
    fragmentShader: HorizontalBlurShader.fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const vertical = new ShaderMaterial({
    uniforms: UniformsUtils.clone(VerticalBlurShader.uniforms),
    vertexShader: VerticalBlurShader.vertexShader,
    fragmentShader: VerticalBlurShader.fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const blurScene = new Scene(),
    blurCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new Mesh(new PlaneGeometry(2, 2), horizontal);
  blurScene.add(quad);
  const floor = new Mesh(
    new PlaneGeometry(extent, extent),
    new MeshBasicMaterial({
      map: target.texture,
      color: 0x514e47,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    }),
  );
  floor.name = 'StudioContactShadow';
  floor.rotation.x = Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);
  let dirty = true,
    disposed = false,
    updates = 0;
  return {
    floor,
    markDirty() {
      dirty = true;
    },
    get updates() {
      return updates;
    },
    render() {
      if (disposed || !dirty || !floor.visible) return;
      const oldTarget = renderer.getRenderTarget(),
        oldMaterial = scene.overrideMaterial,
        oldBackground = scene.background;
      const oldColor = renderer.getClearColor(new Color()),
        oldAlpha = renderer.getClearAlpha(),
        oldShadow = renderer.shadowMap.enabled;
      try {
        floor.visible = false;
        scene.background = null;
        scene.overrideMaterial = depth;
        renderer.shadowMap.enabled = false;
        renderer.setClearColor(0xffffff, 0);
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, camera);
        for (const radius of [2.5, 1]) {
          quad.material = horizontal;
          horizontal.uniforms.tDiffuse.value = target.texture;
          horizontal.uniforms.h.value = radius / size;
          renderer.setRenderTarget(scratch);
          renderer.render(blurScene, blurCamera);
          quad.material = vertical;
          vertical.uniforms.tDiffuse.value = scratch.texture;
          vertical.uniforms.v.value = radius / size;
          renderer.setRenderTarget(target);
          renderer.render(blurScene, blurCamera);
        }
        dirty = false;
        updates++;
      } finally {
        floor.visible = true;
        scene.background = oldBackground;
        scene.overrideMaterial = oldMaterial;
        renderer.shadowMap.enabled = oldShadow;
        renderer.setClearColor(oldColor, oldAlpha);
        renderer.setRenderTarget(oldTarget);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      target.dispose();
      scratch.dispose();
      depth.dispose();
      horizontal.dispose();
      vertical.dispose();
      quad.geometry.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      floor.removeFromParent();
    },
  };
}
