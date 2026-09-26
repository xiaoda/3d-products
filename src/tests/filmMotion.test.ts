import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Box3, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { createProduct, disposeProduct } from '../model/createProduct';
import { applyFilmMotion, resetFilmRig } from '../model/filmMotion';
import { applyProductMotion } from '../model/productMotion';
import { FILMS, sampleCinematicFilm, type FilmId } from '../interaction/films';
import { cinematicCamera } from '../scene/filmCamera';
import { cavityProfile, insideCavity } from '../model/earbudCavity';
import { bodyProfile, lidProfile } from '../model/profiles';
import { sampleProfile } from '../model/geometry';
import { caseDistance } from '../model/caseSurface';

describe('导演轨道实际几何验证', () => {
  let product: ReturnType<typeof createProduct>;
  beforeAll(() => {
    product = createProduct();
  }, 30000);
  afterAll(() => disposeProduct(product.root));
  const matrices = () =>
    [
      product.root,
      product.parts.caseAssembly,
      product.parts.leftEarbud,
      product.parts.rightEarbud,
      product.parts.lidPivot,
    ].map((p) => p.matrixWorld.toArray());
  it.each(Object.keys(FILMS) as FilmId[])('%s 不累积变换，首尾相同，回手动姿态无残留', (id) => {
    applyFilmMotion(product, sampleCinematicFilm(0, id));
    const first = matrices();
    for (const t of [10, 7, 13, 1, 18, 10, 0]) applyFilmMotion(product, sampleCinematicFilm(t, id));
    expect(matrices()).toEqual(first);
    applyFilmMotion(product, sampleCinematicFilm(20, id));
    expect(matrices()).toEqual(first);
    applyFilmMotion(product, sampleCinematicFilm(10, id));
    resetFilmRig(product);
    applyProductMotion(product, { lid: 1, extraction: 0 });
    expect(product.root.position.length()).toBe(0);
    expect(product.parts.caseAssembly.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
  });
  it.each(Object.keys(FILMS) as FilmId[])(
    '%s 全片81时刻主体顶点/双耳边界/镜头安全',
    { timeout: 60000 },
    (id) => {
      const bodyCavities = [cavityProfile('body', -1), cavityProfile('body', 1)];
      const lidCavities = [cavityProfile('lid', -1), cavityProfile('lid', 1)];
      const camera = new PerspectiveCamera(32, 9 / 16, 0.1, 150);
      for (let n = 0; n <= 80; n++) {
        const s = sampleCinematicFilm(n / 4, id);
        applyFilmMotion(product, s);
        const bodyInverse = product.parts.caseAssembly.matrixWorld.clone().invert();
        const lidInverse = product.parts.caseLid.matrixWorld.clone().invert();
        const frame = cinematicCamera(product, s, 9 / 16, 32);
        camera.position.copy(frame.position);
        camera.up.copy(frame.up);
        camera.lookAt(frame.target);
        camera.updateMatrixWorld(true);
        let hits = 0;
        for (const name of ['LeftEarbudShell', 'RightEarbudShell']) {
          const shell = product.root.getObjectByName(name) as Mesh;
          for (let i = 0; i < shell.geometry.attributes.position.count; i++) {
            const world = new Vector3()
              .fromBufferAttribute(shell.geometry.attributes.position, i)
              .applyMatrix4(shell.matrixWorld);
            const p = world.clone().applyMatrix4(bodyInverse);
            if (
              p.y > bodyProfile[0].y &&
              p.y < bodyProfile.at(-1)!.y &&
              caseDistance(sampleProfile(bodyProfile, p.y), p.x, p.z) < 0 &&
              !bodyCavities.some((c) => insideCavity(c, p))
            )
              hits++;
            p.copy(world).applyMatrix4(lidInverse);
            if (
              p.y > lidProfile[0].y &&
              p.y < lidProfile.at(-1)!.y &&
              caseDistance(sampleProfile(lidProfile, p.y), p.x, p.z) < 0 &&
              !lidCavities.some((c) => insideCavity(c, p))
            )
              hits++;
            p.copy(world).applyMatrix4(camera.matrixWorldInverse);
            if (p.z >= -0.1) hits++;
          }
        }
        expect(hits, `${id} t=${n / 4}`).toBe(0);
        if (s.dance > 0)
          expect(
            new Box3()
              .setFromObject(product.parts.leftEarbud)
              .intersectsBox(new Box3().setFromObject(product.parts.rightEarbud)),
            `${id} 双耳 t=${n / 4}`,
          ).toBe(false);
      }
    },
  );
});
