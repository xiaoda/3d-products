import { describe, expect, it, vi } from 'vitest';
import { Color, Group, Scene, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { createStudioLighting } from '../scene/lighting';
import { sampleCinematicFilm } from '../interaction/films';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    PMREMGenerator: class {
      fromScene() {
        return { texture: new actual.Texture(), dispose: vi.fn() };
      }
      dispose() {}
    },
  };
});

function rendererStub() {
  let target: WebGLRenderTarget | null = null;
  const color = new Color(0xffffff);
  let alpha = 0;
  return {
    shadowMap: { enabled: false, autoUpdate: true, needsUpdate: false, type: 0 },
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
}

describe('影片可选布景', () => {
  it('未提供工厂时保留影片背景和原地面', () => {
    const scene = new Scene(),
      renderer = rendererStub();
    const studio = createStudioLighting(renderer as unknown as WebGLRenderer, scene);
    const sample = sampleCinematicFilm(10, 'sculpture');
    studio.setFilmLighting(sample);
    expect(scene.background).toEqual(new Color().setRGB(...sample.light.background));
    expect(scene.getObjectByName('StudioContactShadow')!.position.y).toBe(-0.02);
    studio.setFilmLighting(null);
    expect(scene.background).toBeNull();
    studio.dispose();
  });

  it('布景保留背景，排除于投影，异常后恢复可见性并只释放一次', () => {
    const scene = new Scene(),
      renderer = rendererStub(),
      root = new Group();
    const background = new Color(0xe7e7e2),
      dispose = vi.fn(() => root.removeFromParent());
    const studio = createStudioLighting(renderer as unknown as WebGLRenderer, scene, {
      createBackdrop: (target: Scene) => {
        target.add(root);
        return { root, background, dispose };
      },
    });
    for (const sample of [sampleCinematicFilm(10, 'sculpture'), null]) {
      studio.setFilmLighting(sample);
      expect(scene.background).toBe(background);
    }
    renderer.render.mockImplementation((target: Scene) => {
      if (target === scene) expect(root.visible).toBe(false);
    });
    studio.renderContactShadow();
    expect(root.visible).toBe(true);
    studio.markDirty();
    renderer.render.mockImplementationOnce(() => {
      throw new Error('投影测试失败');
    });
    expect(() => studio.renderContactShadow()).toThrow('投影测试失败');
    expect(root.visible).toBe(true);
    root.visible = false;
    studio.renderContactShadow();
    expect(root.visible).toBe(false);
    studio.dispose();
    studio.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(root.parent).toBeNull();
  });
});
