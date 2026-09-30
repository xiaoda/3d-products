import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
} from 'three';
import { EXPLODED_VIEW } from '../model/explodedEarbudDefinition';

export const EXPLODED_STUDIOS = [
  {
    id: 'architecture',
    title: '建筑摄影棚',
    description: '弧形浅灰 · 斜向柔光',
    color: 0xe7e7e2,
    groundY: -3.65,
  },
  {
    id: 'ice',
    title: '冰蓝磨砂',
    description: '冷灰蓝 · 磨砂光影',
    color: 0xdbe9ef,
    groundY: -3.65,
  },
  {
    id: 'gallery',
    title: '暖白展陈',
    description: '奶油白 · 圆润展台',
    color: 0xeee4d4,
    groundY: -2.93,
  },
] as const;
export type ExplodedStudioId = (typeof EXPLODED_STUDIOS)[number]['id'];
export function parseExplodedStudio(value: string | null): ExplodedStudioId {
  return EXPLODED_STUDIOS.find((preset) => preset.id === value)?.id ?? 'architecture';
}

const ground = -3.65;
function cyclorama() {
  const profile: [number, number][] = [
    [ground, 18],
    [ground, -4],
  ];
  for (let i = 1; i <= 32; i++) {
    const a = ((i / 32) * Math.PI) / 2;
    profile.push([ground + 3 * (1 - Math.cos(a)), -4 - 3 * Math.sin(a)]);
  }
  profile.push([16, -7]);
  const position: number[] = [],
    index: number[] = [];
  profile.forEach(([y, z], i) => {
    position.push(-24, y, z, 24, y, z);
    if (i < profile.length - 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

const stageVertex = `varying vec3 localPoint; varying vec3 localNormal;
  void main() { localPoint = position; localNormal = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
function stageMaterial(top: number, bottom: number, floor: number, beam: number) {
  return new ShaderMaterial({
    uniforms: {
      upper: { value: new Color(top) },
      lower: { value: new Color(bottom) },
      floorTint: { value: new Color(floor) },
      beam: { value: beam },
    },
    vertexShader: stageVertex,
    fragmentShader: `uniform vec3 upper; uniform vec3 lower; uniform vec3 floorTint; uniform float beam;
      varying vec3 localPoint; varying vec3 localNormal;
      void main() {
        vec3 c = mix(lower, upper, smoothstep(-2.7, 7.0, localPoint.y));
        c = mix(c, floorTint, clamp(localNormal.y, 0.0, 1.0) * .72);
        float cove = exp(-pow((localPoint.y + 2.8) / 1.0, 2.0)) * exp(-pow((localPoint.z + 5.6) / 1.6, 2.0));
        c *= 1.0 - .07 * cove;
        float diagonal = localPoint.x + .72 * localPoint.y;
        float light = 1.0 - smoothstep(.7, 2.3, abs(diagonal + .6));
        float shade = 1.0 - smoothstep(.0, 1.1, abs(diagonal - 4.6));
        c = mix(c, vec3(1.0), light * beam);
        c *= 1.0 - shade * beam * .26;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
  });
}

function frostedPanel(width: number, height: number) {
  const material = new ShaderMaterial({
    uniforms: { ratio: { value: width / height } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `varying vec2 coords; void main() { coords = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float ratio; varying vec2 coords;
      void main() {
        vec2 q = abs((coords - .5) * vec2(ratio, 1.0)) - vec2(ratio * .5 - .025, .475);
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - .025;
        float edge = 1.0 - smoothstep(.0, .013, abs(d));
        float alpha = (1.0 - smoothstep(-.003, .008, d)) * (.13 + .16 * coords.x + edge * .25);
        vec3 c = mix(vec3(.66, .83, .88), vec3(.98, 1.0, 1.0), coords.x * .8 + edge * .2);
        gl_FragColor = vec4(c, alpha);
        #include <colorspace_fragment>
      }`,
  });
  return new Mesh(new PlaneGeometry(width, height), material);
}

/** 独立背景组，不引用产品或相机；切换只影响布景，便于同帧比较和后续视频合成。 */
export function createExplodedStudio(scene: Scene) {
  const previousBackground = scene.background;
  const root = new Group();
  root.name = 'ExplodedStudioVariants';
  root.rotation.y = EXPLODED_VIEW.yaw;
  const geometry = cyclorama();
  const materials = {
    architecture: stageMaterial(0xf5f5f0, 0xcdd2cc, 0xccd0c8, 0.55),
    ice: stageMaterial(0xeff7fa, 0xc5d9e3, 0xbdcfd8, 0.25),
    gallery: stageMaterial(0xfcf7ee, 0xe8ddcb, 0xd7c6ac, 0.16),
  };
  for (const preset of EXPLODED_STUDIOS) {
    const group = new Group();
    group.name = preset.id;
    const sweep = new Mesh(geometry, materials[preset.id]);
    sweep.name = 'Cyclorama';
    group.add(sweep);
    if (preset.id === 'ice') {
      const panel = frostedPanel(2.5, 7.2);
      panel.name = 'FrostedLightPanel';
      panel.position.set(1.7, 0.9, -3.8);
      panel.rotation.z = -0.1;
      const second = frostedPanel(1.4, 8.2);
      second.name = 'FrostedSidePanel';
      second.position.set(-2.8, 2.1, -4.2);
      second.rotation.z = -0.1;
      group.add(panel, second);
    }
    if (preset.id === 'gallery') {
      const plinth = new Mesh(
        new LatheGeometry(
          [
            new Vector2(0, 0),
            new Vector2(2.27, 0),
            new Vector2(2.37, 0.045),
            new Vector2(2.4, 0.12),
            new Vector2(2.4, 0.6),
            new Vector2(2.37, 0.68),
            new Vector2(2.29, 0.72),
            new Vector2(0, 0.72),
          ],
          128,
        ),
        new MeshStandardMaterial({ color: 0xe8dcc7, roughness: 0.82, metalness: 0 }),
      );
      plinth.name = 'RoundedDisplayPlinth';
      plinth.position.set(0.2, ground, 0);
      const baseShadow = new Mesh(
        new PlaneGeometry(7.5, 7.5),
        new ShaderMaterial({
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          vertexShader: `varying vec2 coords; void main() { coords=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
          fragmentShader: `varying vec2 coords;
            void main() {
              float r = length((coords - .5) * 2.0);
              float a = exp(-r * r * 5.5) * .28 * (1.0 - smoothstep(.8, 1.0, r));
              gl_FragColor = vec4(.16, .12, .08, a);
              #include <colorspace_fragment>
            }`,
        }),
      );
      baseShadow.name = 'PlinthAmbientShadow';
      baseShadow.rotation.x = -Math.PI / 2;
      baseShadow.position.set(0.2, ground + 0.005, 0);
      group.add(baseShadow, plinth);
    }
    root.add(group);
  }
  scene.add(root);
  const background = new Color();
  let current: ExplodedStudioId = 'architecture',
    disposed = false;
  function setPreset(id: ExplodedStudioId) {
    if (disposed) return;
    current = parseExplodedStudio(id);
    for (const group of root.children) group.visible = group.name === current;
    background.set(EXPLODED_STUDIOS.find((preset) => preset.id === current)!.color);
    scene.background = background;
  }
  setPreset(current);
  return {
    root,
    setPreset,
    inspect: () => ({
      id: current,
      groundY: EXPLODED_STUDIOS.find((preset) => preset.id === current)!.groundY,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set<BufferGeometry>(),
        usedMaterials = new Set<ShaderMaterial | MeshStandardMaterial>();
      root.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material])
          usedMaterials.add(material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of usedMaterials) material.dispose();
      root.removeFromParent();
      root.clear();
      if (scene.background === background) scene.background = previousBackground;
    },
  };
}
