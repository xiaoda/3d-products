import { Group, Mesh } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PRODUCT, mm } from '../config/product';
import { createLoftGeometry, horizontalPlate, sectionContour, section } from './geometry';
import { bodyProfile, lidProfile } from './profiles';
import { caseSurface, caseContour } from './caseSurface';
import { cavityProfile, createCavityGeometry } from './earbudCavity';
import { createCaseDetails } from './details';
import { createProductMaterials, type ProductMaterials } from './materials';

export function createCase(materials: ProductMaterials = createProductMaterials()) {
  const group = new Group();
  group.name = 'CaseAssembly';
  const body = new Group();
  body.name = 'CaseBody';
  const clay = materials.get('plastic');
  const interiorClay = materials.get('interior');
  const outer = new Mesh(
    createLoftGeometry(bodyProfile, {
      surface: caseSurface(bodyProfile),
      segments: 128,
      capStart: false,
      capEnd: false,
    }),
    clay,
  );
  outer.name = 'CaseOuterShell';
  body.add(outer);
  const portProfile = [
    section(0, 0.445, 0.15),
    section(0.018, 0.43, 0.135),
    section(0.22, 0.43, 0.135),
  ];
  const bottom = new Mesh(
    horizontalPlate(caseContour(bodyProfile[0]), [sectionContour(portProfile[0], 4)], 0, false),
    clay,
  );
  bottom.name = 'CaseBottom';
  body.add(bottom);
  const port = new Group();
  port.name = 'USBPort';
  const portMaterial = materials.get('port');
  port.add(
    new Mesh(
      createLoftGeometry(portProfile, { exponent: 4, capStart: false, capEnd: true, inward: true }),
      portMaterial,
    ),
  );
  const tongue = new Mesh(new RoundedBoxGeometry(0.63, 0.035, 0.05, 2, 0.014), interiorClay);
  tongue.position.y = 0.16;
  port.add(tongue);
  body.add(port);
  const interior = new Group();
  interior.name = 'CaseInterior';
  const holes = [];
  for (const side of [-1, 1] as const) {
    const profile = cavityProfile('body', side);
    holes.push(profile.at(-1)!.points);
    const well = new Mesh(createCavityGeometry(profile), interiorClay);
    well.name = side === -1 ? 'LeftWell' : 'RightWell';
    interior.add(well);
  }
  const deck = new Mesh(
    horizontalPlate(caseContour(bodyProfile.at(-1)!), holes, bodyProfile.at(-1)!.y),
    clay,
  );
  deck.name = 'CaseRim';
  interior.add(deck);
  body.add(interior);
  const lidPivot = new Group();
  lidPivot.name = 'LidPivot';
  lidPivot.position.set(0, mm(PRODUCT.assembly.hingeY), mm(PRODUCT.assembly.hingeZ));
  const lid = new Group();
  lid.name = 'CaseLid';
  const lidOuter = new Mesh(
    createLoftGeometry(lidProfile, {
      surface: caseSurface(lidProfile),
      segments: 128,
      capStart: false,
    }),
    clay,
  );
  lidOuter.name = 'LidOuterShell';
  lid.add(lidOuter);
  const lidInterior = new Group();
  lidInterior.name = 'LidInterior';
  const lidHoles = [];
  for (const side of [-1, 1] as const) {
    const profile = cavityProfile('lid', side);
    lidHoles.push(profile[0].points);
    const well = new Mesh(createCavityGeometry(profile), interiorClay);
    well.name = side === -1 ? 'LeftLidWell' : 'RightLidWell';
    lidInterior.add(well);
  }
  const lidRim = new Mesh(
    horizontalPlate(caseContour(lidProfile[0]), lidHoles, lidProfile[0].y, false),
    clay,
  );
  lidRim.name = 'LidRim';
  lidInterior.add(lidRim);
  lid.add(lidInterior);
  lid.position.copy(lidPivot.position).multiplyScalar(-1);
  lidPivot.add(lid);
  body.add(createCaseDetails(materials));
  group.add(body, lidPivot);
  return { group, body, lid, lidPivot, interior, lidInterior };
}
