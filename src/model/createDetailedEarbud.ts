import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Vector2,
  Vector3,
  type Material,
} from 'three';
import { createEarbudShellGeometry } from './createEarbudShell';
import {
  EAR_FEATURES,
  featureDistance,
  featureDistance2D,
  featureFrame,
  featurePoint,
  type EarFeature,
} from './earbudFeatures';
import { createProductMaterials, type MaterialRole, type ProductMaterials } from './materials';
import type { EarSide } from './createEarbud';

const roles: MaterialRole[] = ['plastic', 'grille', 'sensor', 'contact'];
type Face = { ids: number[]; role: MaterialRole };

/** 镜像烘焙进几何，同时修正法线和三角面绕序，不使用负节点缩放。 */
function mirror(geometry: BufferGeometry) {
  geometry.scale(-1, 1, 1);
  const index = geometry.index!;
  for (let i = 0; i < index.count; i += 3) {
    const b = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, b);
  }
}

function detailedShell(bare: BufferGeometry, active: readonly EarFeature[]): BufferGeometry {
  const vertices: Vector3[] = [],
    normals: Vector3[] = [],
    uv: Vector2[] = [];
  for (let i = 0; i < bare.attributes.position.count; i++) {
    vertices.push(new Vector3().fromBufferAttribute(bare.attributes.position, i));
    normals.push(new Vector3().fromBufferAttribute(bare.attributes.normal, i));
    uv.push(new Vector2(bare.attributes.uv.getX(i), bare.attributes.uv.getY(i)));
  }
  let faces: Face[] = [];
  for (let i = 0; i < bare.index!.count; i += 3)
    faces.push({ ids: [0, 1, 2].map((k) => bare.index!.getX(i + k)), role: 'plastic' });
  for (const feature of active) {
    const frame = featureFrame(feature),
      edgeCache = new Map<string, number>(),
      boundary: number[][] = [];
    const distances = vertices.map((p, i) => featureDistance(feature, p, normals[i]));
    const intersection = (a: number, b: number) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`,
        cached = edgeCache.get(key);
      if (cached !== undefined) return cached;
      let low = 0,
        high = 1;
      const av = uv[a].clone(),
        bv = uv[b].clone();
      if (av.y === 0 || av.y === 1) av.x = bv.x;
      if (bv.y === 0 || bv.y === 1) bv.x = av.x;
      let dv = bv.x - av.x;
      if (dv > 0.5) dv--;
      if (dv < -0.5) dv++;
      // 在线性三角形边上裁切，保持原面平面与绕序；不能把交点投回曲面导致极点附近翻面。
      const evaluate = (t: number) => vertices[a].clone().lerp(vertices[b], t);
      for (let step = 0; step < 26; step++) {
        const mid = (low + high) / 2;
        const normal = normals[a].clone().lerp(normals[b], mid).normalize();
        if (featureDistance(feature, evaluate(mid), normal) < 0 === distances[a] < 0) low = mid;
        else high = mid;
      }
      const t = (low + high) / 2,
        point = evaluate(t),
        u = av.y + (bv.y - av.y) * t,
        v = av.x + dv * t,
        id = vertices.length;
      vertices.push(point);
      normals.push(normals[a].clone().lerp(normals[b], t).normalize());
      uv.push(new Vector2(v, u));
      edgeCache.set(key, id);
      return id;
    };
    const nextFaces: Face[] = [];
    for (const face of faces) {
      const inside = face.ids.filter((i) => distances[i] < 0).length;
      if (inside === 0) {
        nextFaces.push(face);
        continue;
      }
      if (inside === 3) continue;
      const outside: number[] = [],
        crossings: number[] = [];
      for (let i = 0; i < 3; i++) {
        const a = face.ids[i],
          b = face.ids[(i + 1) % 3];
        if (distances[a] >= 0) outside.push(a);
        if (distances[a] < 0 !== distances[b] < 0) {
          const hit = intersection(a, b);
          outside.push(hit);
          crossings.push(hit);
        }
      }
      for (let i = 1; i < outside.length - 1; i++)
        nextFaces.push({ ids: [outside[0], outside[i], outside[i + 1]], role: face.role });
      if (crossings.length === 2) boundary.push(crossings);
    }
    if (boundary.length < 8) throw new Error(`特征 ${feature.id} 的开口采样不足`);
    // 以局部切线图的极角排序，轮廓为椭圆或胶囊，均为星形且无内环。
    const loop = [...new Set(boundary.flat())].sort((a, b) => {
      const p = vertices[a].clone().sub(frame.center),
        q = vertices[b].clone().sub(frame.center);
      return (
        Math.atan2(p.dot(frame.y), p.dot(frame.x)) - Math.atan2(q.dot(frame.y), q.dot(frame.x))
      );
    });
    const loopEdges = new Set(
      loop.map((a, i) => [a, loop[(i + 1) % loop.length]].sort((x, y) => x - y).join(':')),
    );
    if (boundary.some((edge) => !loopEdges.has(edge.sort((x, y) => x - y).join(':'))))
      throw new Error(`特征 ${feature.id} 边界不构成单个闭环`);
    let outer = loop;
    const edgeCorrections = loop.map((id) => {
      const delta = vertices[id].clone().sub(frame.center).multiplyScalar(10);
      return vertices[id]
        .clone()
        .sub(featurePoint(feature, delta.dot(frame.x), delta.dot(frame.y), 0, uv[id]));
    });
    // 孔缘从原壳向内收束，外边共享原裁切索引；不把深色面直接贴在未开口的塑料上。
    const rimSteps = feature.depth > 0.5 ? 32 : 16;
    for (let ring = 1; ring <= rimSteps; ring++) {
      const t = ring / rimSteps,
        radius = 1 - (1 - feature.innerScale) * t;
      const depth = -feature.depth * (t * t * (3 - 2 * t));
      const inner = loop.map((id, boundaryIndex) => {
        const d = vertices[id].clone().sub(frame.center).multiplyScalar(10),
          x = d.dot(frame.x) * radius,
          y = d.dot(frame.y) * radius;
        const p = featurePoint(feature, x, y, depth, uv[id]),
          next = vertices.length;
        // 消除原三角面与连续曲面的微小弦差；在孔缘内平滑归零，避免窄孔缘第一环产生折角。
        p.addScaledVector(edgeCorrections[boundaryIndex], (1 - t) ** 3);
        vertices.push(p);
        normals.push(new Vector3());
        uv.push(new Vector2());
        return next;
      });
      for (let i = 0; i < loop.length; i++) {
        const j = (i + 1) % loop.length;
        nextFaces.push(
          { ids: [outer[i], outer[j], inner[i]], role: feature.rimRole ?? 'plastic' },
          { ids: [outer[j], inner[j], inner[i]], role: feature.rimRole ?? 'plastic' },
        );
      }
      outer = inner;
    }
    // 封底继续采用同一曲面的内偏移，不臆造声学通道。
    for (let ring = 1; ring <= 8; ring++) {
      const radius = feature.innerScale * (1 - ring / 9);
      const inner = loop.map((id) => {
        const d = vertices[id].clone().sub(frame.center).multiplyScalar(10),
          next = vertices.length;
        vertices.push(
          featurePoint(
            feature,
            d.dot(frame.x) * radius,
            d.dot(frame.y) * radius,
            -feature.depth,
            uv[id],
          ),
        );
        normals.push(new Vector3());
        uv.push(new Vector2());
        return next;
      });
      for (let i = 0; i < loop.length; i++) {
        const j = (i + 1) % loop.length;
        nextFaces.push(
          { ids: [outer[i], outer[j], inner[i]], role: feature.role },
          { ids: [outer[j], inner[j], inner[i]], role: feature.role },
        );
      }
      outer = inner;
    }
    const center = vertices.length;
    vertices.push(featurePoint(feature, 0, 0, -feature.depth));
    normals.push(new Vector3());
    uv.push(new Vector2());
    for (let i = 0; i < loop.length; i++)
      nextFaces.push({ ids: [outer[i], outer[(i + 1) % loop.length], center], role: feature.role });
    faces = nextFaces;
  }
  // 去掉裁孔后不再引用的旧顶点；原壳外部顶点与法线逐值保留。
  const remap = new Map<number, number>(),
    positions: number[] = [],
    norms: number[] = [],
    indices: number[] = [];
  const geometry = new BufferGeometry();
  for (const role of roles) {
    const start = indices.length;
    for (const face of faces)
      if (face.role === role)
        for (const id of face.ids) {
          let mapped = remap.get(id);
          if (mapped === undefined) {
            mapped = remap.size;
            remap.set(id, mapped);
            positions.push(...vertices[id].toArray());
            norms.push(...normals[id].toArray());
          }
          indices.push(mapped);
        }
    if (indices.length > start)
      geometry.addGroup(start, indices.length - start, roles.indexOf(role));
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normal = geometry.attributes.normal;
  for (let i = 0; i < norms.length; i += 3)
    if (norms[i] || norms[i + 1] || norms[i + 2])
      normal.setXYZ(i / 3, norms[i], norms[i + 1], norms[i + 2]);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    model: 'earbud-local-details-review',
    normalizedByBounds: false,
    features: active.map((f) => f.id),
  };
  return geometry;
}

function grilleGeometry(f: EarFeature): BufferGeometry {
  const positions: number[] = [],
    indices: number[] = [];
  const pitch = f.id === 'bottomMic' ? 0.18 : 0.25,
    half = 0.025;
  // 双向细网，条带在局部毫米坐标中裁至内口，沿内凹曲面生成。
  for (const swapped of [false, true]) {
    const extent = (f.size[swapped ? 0 : 1] / 2) * f.innerScale;
    const along = (f.size[swapped ? 1 : 0] / 2) * f.innerScale;
    for (let line = Math.ceil(-extent / pitch); line <= Math.floor(extent / pitch); line++) {
      const fixed = line * pitch;
      const valid = (q: number) => {
        const x = swapped ? fixed : q,
          y = swapped ? q : fixed;
        return (
          featureDistance2D(
            f,
            (Math.abs(x) + half) / f.innerScale,
            (Math.abs(y) + half) / f.innerScale,
          ) < -0.02
        );
      };
      let lo = 0,
        hi = along;
      if (!valid(0)) continue;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (valid(mid)) lo = mid;
        else hi = mid;
      }
      const count = Math.max(2, Math.ceil((2 * lo) / 0.18));
      for (let segment = 0; segment < count; segment++) {
        const a = -lo + (2 * lo * segment) / count,
          b = -lo + (2 * lo * (segment + 1)) / count,
          base = positions.length / 3;
        for (const [x, y] of [
          [a, fixed - half],
          [b, fixed - half],
          [b, fixed + half],
          [a, fixed + half],
        ]) {
          const p = featurePoint(
            f,
            swapped ? y : x,
            swapped ? x : y,
            -f.depth + 0.018 + (swapped ? 0.008 : 0),
          );
          positions.push(...p.toArray());
        }
        if (swapped) indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
        else indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function createDetailedEarbud(side: EarSide, supplied?: ProductMaterials) {
  const materials = supplied ?? createProductMaterials(),
    root = new Group();
  root.name = side === 'left' ? 'NewLeftEarbud' : 'NewRightEarbud';
  const bare = createEarbudShellGeometry();
  const physical = roles.map((role) => materials.get(role));
  const shell: Mesh = new Mesh(bare.clone(), physical);
  shell.name = `${root.name}Shell`;
  root.add(shell);
  const grids = new Map<string, Mesh>();
  for (const feature of EAR_FEATURES.filter((f) => f.grille)) {
    const geometry = grilleGeometry(feature);
    if (side === 'left') mirror(geometry);
    const mesh = new Mesh(geometry, materials.get('grilleWire'));
    mesh.name = feature.id + 'Lattice';
    grids.set(feature.id, mesh);
    root.add(mesh);
  }
  let disposed = false,
    diagnostic: Material | null = null,
    enabled: string[] = [];
  const setFeatures = (ids: readonly string[]) => {
    if (disposed) throw new Error('耳机已经释放');
    if (ids.some((id) => !EAR_FEATURES.some((f) => f.id === id)))
      throw new RangeError('未知耳机细节');
    const active = EAR_FEATURES.filter((f) => ids.includes(f.id));
    if (enabled.length === active.length && active.every((f, i) => enabled[i] === f.id)) return;
    const geometry = active.length ? detailedShell(bare, active) : bare.clone();
    if (side === 'left') mirror(geometry);
    const old = shell.geometry;
    shell.geometry = geometry;
    old.dispose();
    enabled = active.map((f) => f.id);
    for (const [id, mesh] of grids) mesh.visible = ids.includes(id);
  };
  setFeatures(EAR_FEATURES.map((f) => f.id));
  return {
    root,
    shell,
    setFeatures,
    inspect: () => ({ side, enabled: [...enabled], disposed }),
    setDiagnosticMaterial(material: Material | null) {
      if (disposed) throw new Error('耳机已经释放');
      diagnostic = material;
      shell.material = diagnostic ?? physical;
      for (const mesh of grids.values()) mesh.material = diagnostic ?? materials.get('grilleWire');
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      bare.dispose();
      shell.geometry.dispose();
      for (const mesh of grids.values()) mesh.geometry.dispose();
      if (!supplied) {
        for (const mat of new Set([...physical, materials.get('grilleWire')])) mat.dispose();
      }
      root.clear();
    },
  };
}
