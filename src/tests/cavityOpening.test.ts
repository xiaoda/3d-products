import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { cavityProfile } from '../model/earbudCavity';

it('第四阶段隐藏槽壁避让不改变已验收槽口与盒盖内腔', () => {
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  expect({
    opening: hash(cavityProfile('body', 1).at(-1)),
    lid: hash(cavityProfile('lid', 1)),
  }).toMatchSnapshot();
});
