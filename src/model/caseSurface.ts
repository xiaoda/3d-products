import { Vector2, Vector3 } from 'three';
import { sampleProfile, type Section, type Surface } from './geometry';

/** 水平截面是直边与圆弧相切的胶囊，不再用超椭圆近似其两端。 */
export function capsulePoint(section: Section, angle: number): Vector2 {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    straight = section.rx - section.rz;
  const onStraight = Math.abs(s) > 1e-10 && (Math.abs(c) * section.rz) / Math.abs(s) <= straight;
  const radius = onStraight
    ? section.rz / Math.abs(s)
    : Math.abs(c) * straight + Math.sqrt(Math.max(0, section.rz ** 2 - straight ** 2 * s ** 2));
  return new Vector2(section.cx + radius * c, section.cz + radius * s);
}

export function caseSurface(profile: readonly Section[]): Surface {
  return (y, angle) => {
    const point = capsulePoint(sampleProfile(profile, y), angle);
    return new Vector3(point.x, y, point.y);
  };
}

export function caseContour(section: Section, segments = 128): Vector2[] {
  return Array.from({ length: segments }, (_, i) =>
    capsulePoint(section, (i / segments) * Math.PI * 2),
  );
}

/** 到水平胶囊轮廓的有符号距离；负值在内，单位为场景单位。 */
export function caseDistance(section: Section, x: number, z: number): number {
  return (
    Math.hypot(Math.max(0, Math.abs(x - section.cx) - (section.rx - section.rz)), z - section.cz) -
    section.rz
  );
}
