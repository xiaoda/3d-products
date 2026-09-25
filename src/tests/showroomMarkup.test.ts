import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

describe('沉浸式展示台结构', () => {
  it('仅保留一组主要操作，不在首屏恢复旧工作台', () => {
    expect(html).toContain('class="control-dock"');
    expect(html).toContain('id="lid-action"');
    expect(html).toContain('id="view-selector"');
    expect(html).toContain('id="reset-view"');
    expect(html).not.toContain('class="study-panel"');
    expect(html).not.toContain('class="shot-bar"');
  });

  it('八种已支持的观察入口仍全部可达', () => {
    const views = [...html.matchAll(/data-view="([a-z]+)"/g)].map((match) => match[1]);
    expect(views).toEqual([
      'perspective',
      'front',
      'side',
      'back',
      'top',
      'bottom',
      'interior',
      'earbud',
    ]);
    expect(html).toContain('id="zoom-out"');
    expect(html).toContain('id="zoom-in"');
  });

  it('信息与开发入口默认折叠或隐藏', () => {
    expect(html).toContain('id="product-info"');
    expect(html).toContain('id="debug-panel-host"');
    expect(html).toMatch(/id="debug-panel-host"[^>]*hidden/);
    expect(html.match(/class="summary-chevron"/g)).toHaveLength(2);
    expect(html).not.toContain('>⌄</span>');
  });
});
