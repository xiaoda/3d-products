/** 展示性参数，单位为本项目场景单位（10 mm）；不是测绘或制造数据。 */
export const EXPLODED_VIEW = { yaw: -0.45, pitch: 0.16, roll: -0.08 } as const;

const PART_DEFINITIONS = [
  {
    id: 'frontShell',
    number: '01',
    title: '外壳 · 出音侧',
    en: 'ACOUSTIC SHELL',
    description: '沿用已确认外表面；切壳位置与内壁厚度为展示示意。',
    offset: [0.45, -1.6, 1.8],
    rotation: [0, 0.55, -0.15],
  },
  {
    id: 'backShell',
    number: '02',
    title: '外壳 · 背侧',
    en: 'REAR SHELL',
    description: '外壳拆分用于讲解空间关系，不代表真实开壳或维修方式。',
    offset: [-0.45, 1.4, -1.25],
    rotation: [0, -0.65, 0.13],
  },
  {
    id: 'driver',
    number: '03',
    title: '声学单元',
    en: 'ACOUSTIC DRIVER',
    description: '以振膜、框架与磁体表达电信号到声音的转换。',
    offset: [0.15, 2.9, 0.45],
    rotation: [0, 0, 0],
  },
  {
    id: 'battery',
    number: '04',
    title: '电池',
    en: 'POWER CELL',
    description: '为耳机供电；封装形态、尺寸和布局为示意，无容量标注。',
    offset: [0.8, 1.25, 0.4],
    rotation: [0, 0, 0],
  },
  {
    id: 'logic',
    number: '05',
    title: '控制电路',
    en: 'CONTROL & RADIO',
    description: '主控、无线通信与电源管理的功能组合，不指定芯片型号。',
    offset: [-0.4, -1.1, 0.65],
    rotation: [0, -0.15, 0.05],
  },
  {
    id: 'flex',
    number: '06',
    title: '柔性互连',
    en: 'FLEX INTERCONNECT',
    description: '连接供电与电控的示意软排线；展开态表示已断开连接。',
    offset: [-0.1, 0.3, 1.0],
    rotation: [0, 0, 0],
  },
  {
    id: 'sensing',
    number: '07',
    title: '拾音与感知',
    en: 'MICROPHONES & SENSING',
    description: '麦克风与佩戴感知电路是功能分组，并非一个真实整体零件。',
    offset: [1.3, 0.7, 0.35],
    rotation: [0, 0, 0],
  },
  {
    id: 'contacts',
    number: '08',
    title: '充电连接',
    en: 'CHARGING INTERFACE',
    description: '从外部触点到内部电路的导电连接示意。',
    offset: [-0.35, -1.45, 0.5],
    rotation: [0, 0, 0],
  },
] as const;

// 取原安全脱离轨迹的紧凑子区间；收拢空隙，不改变组件自身比例或几何。
const COMPACT = 0.72;
export const EXPLODED_PARTS = PART_DEFINITIONS.map((part) => ({
  ...part,
  offset: [
    part.offset[0] * COMPACT,
    part.offset[1] * COMPACT ** 2,
    part.offset[2] * COMPACT,
  ] as const,
  rotation: part.rotation.map((v) => v * COMPACT ** 2) as [number, number, number],
}));

export type ExplodedPartId = (typeof EXPLODED_PARTS)[number]['id'];
export type ExplodedPose = 'assembled' | 'inside' | 'exploded';
export const EXPLODED_DISCLAIMER = '内部结构示意 · 非实物精密复原 · 非维修拆解指南';
