import { describe, expect, it, vi } from 'vitest';
import { Color, MeshBasicMaterial, Scene, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { createContactShadow } from '../scene/contactShadow';

function rendererStub() {
  let target: WebGLRenderTarget | null = null;
  const color = new Color(0x123456);
  let alpha = 0.4;
  const renderer = {
    shadowMap: { enabled: true },
    getRenderTarget: () => target,
    setRenderTarget: (next: WebGLRenderTarget | null) => {
      target = next;
    },
    getClearColor: (next: Color) => next.copy(color),
    getClearAlpha: () => alpha,
    setClearColor: (next: Color | number, nextAlpha: number) => {
      color.set(next);
      alpha = nextAlpha;
    },
    clear: vi.fn(),
    render: vi.fn(),
  };
  return { renderer, gpu: renderer as unknown as WebGLRenderer };
}

describe('程序化接触阴影生命周期', () => {
  it('仅脏状态重绘，并在渲染后恢复主场景与渲染器', () => {
    const { renderer, gpu } = rendererStub(),
      scene = new Scene();
    const background = new Color(0xabcdef),
      override = new MeshBasicMaterial();
    scene.background = background;
    scene.overrideMaterial = override;
    const shadow = createContactShadow(gpu, scene);
    shadow.render();
    expect(renderer.render).toHaveBeenCalledTimes(5);
    expect(shadow.updates).toBe(1);
    expect(scene.background).toBe(background);
    expect(scene.overrideMaterial).toBe(override);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.getRenderTarget()).toBeNull();
    expect(renderer.getClearAlpha()).toBe(0.4);
    expect(renderer.getClearColor(new Color()).getHex()).toBe(0x123456);
    shadow.render();
    expect(renderer.render).toHaveBeenCalledTimes(5);
    shadow.markDirty();
    shadow.render();
    expect(shadow.updates).toBe(2);
    shadow.dispose();
    override.dispose();
  });
  it('隐藏地面时跳过渲染，销毁只释放一次并移除平面', () => {
    const { renderer, gpu } = rendererStub(),
      scene = new Scene();
    const shadow = createContactShadow(gpu, scene);
    shadow.floor.visible = false;
    shadow.render();
    expect(renderer.render).not.toHaveBeenCalled();
    let releases = 0;
    shadow.floor.geometry.addEventListener('dispose', () => releases++);
    shadow.dispose();
    shadow.dispose();
    expect(releases).toBe(1);
    expect(shadow.floor.parent).toBeNull();
    shadow.render();
    expect(renderer.render).not.toHaveBeenCalled();
  });
  it('离屏渲染失败也恢复状态，允许下次重试', () => {
    const { renderer, gpu } = rendererStub(),
      scene = new Scene();
    const shadow = createContactShadow(gpu, scene);
    renderer.render.mockImplementationOnce(() => {
      throw new Error('测试注入');
    });
    expect(() => shadow.render()).toThrow('测试注入');
    expect(shadow.floor.visible).toBe(true);
    expect(scene.overrideMaterial).toBeNull();
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.getRenderTarget()).toBeNull();
    expect(shadow.updates).toBe(0);
    shadow.render();
    expect(shadow.updates).toBe(1);
    shadow.dispose();
  });
});
