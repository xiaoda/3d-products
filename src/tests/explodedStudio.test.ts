import { Group, Mesh, Scene, WebGLRenderer } from 'three';
import { describe, expect, test } from 'vitest';
import {
  createExplodedStudio,
  EXPLODED_STUDIOS,
  parseExplodedStudio,
} from '../scene/explodedStudio';
import { createContactShadow } from '../scene/contactShadow';

describe('三种摄影棚背景', () => {
  test('提供三个独立方案，未指定或非法输入回退建筑摄影棚', () => {
    expect(EXPLODED_STUDIOS.map((p) => p.id)).toEqual(['architecture', 'ice', 'gallery']);
    for (const value of [null, '', 'other', '../ice'])
      expect(parseExplodedStudio(value)).toBe('architecture');
    expect(parseExplodedStudio('ice')).toBe('ice');
    expect(parseExplodedStudio('gallery')).toBe('gallery');
  });
  test('每次只显示一个背景，切换不改变场景中的产品节点', () => {
    const scene = new Scene(),
      model = new Group();
    model.position.set(1, 2, 3);
    scene.add(model);
    const studio = createExplodedStudio(scene);
    for (const preset of EXPLODED_STUDIOS) {
      studio.setPreset(preset.id);
      expect(studio.inspect().id).toBe(preset.id);
      expect(studio.root.children.filter((node) => node.visible).map((node) => node.name)).toEqual([
        preset.id,
      ]);
      expect(model.position.toArray()).toEqual([1, 2, 3]);
      expect(model.parent).toBe(scene);
      expect(studio.inspect().groundY).toBe(preset.id === 'gallery' ? -2.93 : -3.65);
    }
    studio.dispose();
    expect(scene.children).toEqual([model]);
    expect(scene.background).toBeNull();
  });
  test('每个几何和材质只释放一次，重复销毁安全', () => {
    const scene = new Scene(),
      studio = createExplodedStudio(scene);
    const resources = new Set<{ addEventListener: Function }>();
    studio.root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      resources.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material])
        resources.add(material);
    });
    let count = 0;
    for (const resource of resources) resource.addEventListener('dispose', () => count++);
    studio.dispose();
    studio.dispose();
    expect(count).toBe(resources.size);
    expect(resources.size).toBeGreaterThan(5);
  });
  test('阴影工具默认兼容原摄影棚，新背景可切换地面与展台高度', () => {
    const scene = new Scene(),
      renderer = {} as WebGLRenderer;
    const original = createContactShadow(renderer, scene);
    expect(original.floor.position.y).toBe(-0.02);
    expect(original.floor.material.opacity).toBe(0.42);
    original.dispose();
    const shadow = createContactShadow(renderer, scene, {
      groundY: -3.65,
      surfaceOffset: 0.012,
      extent: 10,
      opacity: 0.22,
    });
    expect(shadow.floor.position.y).toBeCloseTo(-3.638);
    shadow.setGroundY(-2.93);
    expect(shadow.floor.position.y).toBeCloseTo(-2.918);
    expect(shadow.floor.material.opacity).toBe(0.22);
    shadow.dispose();
  });
});
