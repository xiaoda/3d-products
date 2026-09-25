# AirPods 5 · 光影研究

纯 Three.js 程序化产品建模项目，当前版本 **0.3.0**。第三阶段后的几何校准 `636d080` 未通过用户形态验收：俯视尖凸、后视背肩存在不自然起伏。

**当前检查点：B / C / D 几何基线已验收并提交 `c422cde`；本轮按用户新增官网图校准收纳朝向与内腔，等待视觉验收。** 已确认单耳曲面与充电盒外轮廓未变，未进入第四阶段动画。见 [收纳校准记录与同机位对照](docs/acceptance/earbud-seating-review.md)；[D 记录](docs/acceptance/earbud-assembly-review.md) 保留历史结果。

开发服务启动后，直接打开主页检查整套产品；本轮已验证地址为 `http://127.0.0.1:57907/`，未来重启以实际端口为准。右侧开发面板提供闭合 / 开盖 / 分开展示及单耳六向、四斜视、灰模与条带高光。

本轮优先选择 **“收纳正交正视 / 收纳正交顶视”**，勾选“隐藏耳机”检查孔位。收纳位置由 `earbudPlacement.ts` 统一用于正式耳机与腔体包络；单耳检查清除收纳旋转，回到整套时恢复。

添加 **`?review=earbud-details`** 或点击主页“回看已确认 B / C 耳机”保留局部对照：左侧裸壳、右侧恢复细节，支持七项开关、左右耳及四种材质。它不改变主页面装配。详见 [C 验收记录与对照图](docs/acceptance/earbud-details-review.md)。

原 **`?review=earbud-shell`** 保留 B 与修正前模型的同机位比较，见 [裸壳记录](docs/acceptance/earbud-shell-review.md)。两个评审入口均不进入生产构建。

## 当前能力

- 独立开发评审：毫米自由控制网格生成的新裸壳，六向正交 + 四个斜视、灰模 / 条带反射 / 轮廓、同机位新旧对照，不做逐轴包围盒拉伸。
- C 细节：出音口、佩戴传感器、背侧麦克风、顶部通气口、柄底麦克风、两个侧面充电触点；按局部毫米轮廓裁切，孔缘与封底共享边界，几何细网贴合凹腔。左右镜像修正法线与面绕序；全部关闭后逐顶点恢复 B 裸壳。
- 正式装配直接使用 C 几何，顶点、法线、索引与分组逐值一致，不做包围盒尺寸归一化。固定 CPU 模板只生成一次，每个实例持有独立几何，释放幂等。
- 双耳收纳位置、向内旋转与微倾角使用共享刚体变换；盒体槽和盒盖凹腔从变换后曲面重建，左右镜像不使用负节点缩放。
- 标准充电盒版，用户已确认。
- 头部、背肩、头颈与耳柄由同一自由控制曲面生成；旧定向截面只保留为开发对照，不参与正式产品。
- 充电盒、独立盒盖、内胆、深收纳槽、盒盖内凹腔与铰链节点。
- 几何网罩、传感器凹面、底部触点、USB-C 凹槽及舌片、前部指示灯。
- 九类共享物理材质：亮面白塑料、内胆、金属、触点、传感器、网罩衬底/细网、接口与指示灯。
- 程序化柔光箱 PMREM 环境反射、主辅灯光、真实几何投影生成的柔化接触阴影。
- 闭合主视觉、开盖双耳、单耳特写三个静态摄影构图；默认开盖双耳。
- 鼠标拖动旋转、滚轮缩放、按钮缩放和重置。
- 透视、正面、侧面、背面、顶部、底部、空盒内胆、单耳特写八个即时观察入口。
- 仅开发模式：闭合 / 开盖 / 分开展示静态姿态、0–115° 铰链滑块、线框、条带高光、统一灰模、隐藏耳机。
- 仅开发模式：单耳六向正交与四个斜视（后视严格沿 -Z），闭合盒盖正交顶 / 正视；固定局部姿态并关闭地面阴影。
- 基础窄屏适配、键盘按钮操作、WebGL 初始化失败提示。
- 没有外部 GLB/GLTF、下载 HDR 或产品图片参与运行时渲染；环境和阴影纹理在 GPU 中生成。

## 环境与启动

使用 Node.js 24.x；本次验证环境为 Node.js 24.14.0、npm 11.9.0。

```powershell
cd D:\Projects-X\3D-Products
npm ci
npm run dev
```

开发服务仅监听 `127.0.0.1`。**使用当次终端实际输出的地址**，不要假设端口固定，也不要使用 `file://` 打开 HTML。

本次辅助服务的实际地址、PID 和启动时间记录在 `.local/dev-server.json`，日志在 `.local/dev.stdout.log`、`.local/dev.stderr.log`。这些是临时运行信息，不随源代码交付。停止辅助服务前核对 PID 对应的命令确为本项目 Vite 和对应端口，只停止本任务进程；自行前台启动的服务可按 Ctrl+C 停止。

## 检查与生产构建

```powershell
npm run typecheck
npm run test -- --run
npm run build
npm run preview
```

- `build` 包含类型检查，生成 `dist/`。
- D 检查点回归：13 个测试文件、71 项通过；保留 B / C 检查和原轮廓阈值，新增正式接入、完整耳机收纳、槽壁与开盖面采样、实例隔离及释放。尺寸 / 节点测试按已确认 C 结构迁移，原因见 D 记录。
- 本轮收纳回归：14 个文件、75 项通过；新增图片关键点比例、特征朝向、左右刚体镜像、重复归位及腔体中桥检查，保留原空间容差。
- 密集几何测试最多使用 2 个 worker，避免同时复制过多完整产品；不改变几何与碰撞容差。
- `preview` 同样只监听 `127.0.0.1`，以当次输出端口为准。
- 当前打包器提示 Three.js 所在 JS 分块超过 500 kB，构建仍成功；未关闭该警告，包体优化在阶段六继续处理。
- 代码格式：`npx --no-install prettier --check src index.html vite.config.ts vitest.config.ts package.json tsconfig.json`。
- 漏洞检查：`npm audit --registry=https://registry.npmjs.org`；当前默认镜像暂不支持审计接口，此参数仅对该命令生效，不修改全局 registry。

## 几何专项复查

1. 在开发预览右侧选择“单耳顶视 / 后视 / 后左斜视”等，检查局部形态；可勾选“统一灰模”或“条带高光”。
2. 选择“盒盖正交顶视 / 正视”，检查闭合盒盖两端圆弧与收肩。
3. 用“开盖 + 顶部”检查双耳与盒盖关系，再用“内胆”查看非圆收纳空间。
4. 普通观察按钮恢复透视；“重置”恢复开盖双耳与物理材质。

以上入口现已使用已确认 B / C 耳机。[上次专项记录](docs/acceptance/earbud-geometry-correction.md) 保留历史结果，但形态已被用户否定；本轮以 [收纳校准记录](docs/acceptance/earbud-seating-review.md) 为当前状态。官网 AR 只离线辅助校准参数，不参与网页渲染，不能将剪影 IoU 当作整体还原率。

## 第三阶段验收

1. 打开预览，在画布下方依次选择“闭合主视觉 / 开盖双耳 / 单耳特写”。
2. 旋转模型，检查白色塑料的高光、银色触点/铰链、深色网罩与传感器的反射差异。
3. 查看底部接触阴影和内胆；底部观察与单耳聚焦时会隐藏地面阴影，避免遮挡。
4. 开发模式勾选“统一灰模”对照几何，再取消；点击“重置”恢复开盖双耳与物理材质。
5. 缩窄窗口操作，参考 [第三阶段验收记录](docs/acceptance/stage-03.md) 反馈材质、光照与构图。

历史第三阶段只增加材质和摄影棚表现；本次专项另行修改了耳机曲面、盒盖胶囊截面、收肩和非圆收纳槽。几何仍是图片近似，不是工程 CAD；材质参数也不是实物测量值。接触阴影为几何投影与模糊近似，不是光线追踪。正式开合/取出动画、热点与 PNG 导出属于后续阶段，当前构图和姿态均立即切换。

一般视角保留当前装配；“内胆”切换为空盒开盖，“单耳特写”只显示右耳。“重置”恢复开盖双耳并清除检查选项。尺寸指各部件在**未施加展示姿态时的局部包围尺寸**，不是组合展示场景的包围尺寸；指示灯与铰链保留微小表面偏移，闭合盒总尺寸偏差低于 1%。

## 项目结构

```text
src/
  config/product.ts        产品版本、毫米尺寸和单位换算
  model/geometry.ts        保形插值、截面放样、带孔水平片
  model/profiles.ts        盒体与盒盖的高度截面
  model/caseSurface.ts     胶囊轮廓、表面和有符号距离
  model/earbudSurface.ts   旧定向截面，保留供开发对照
  model/earbudDefinition.ts 新裸壳的毫米控制点、节点与语义区域
  model/createEarbudShell.ts 周期三次样条、共享顶点与封闭裸壳
  model/earbudFeatures.ts  新壳局部特征锚点、毫米切线图与形状定义
  model/createDetailedEarbud.ts 裁切 / 内收 / 封底、细网、镜像和细节开关
  model/earbudCavity.ts    同源曲面的收纳 / 开盖避让包络
  model/earbudPlacement.ts 正式耳机与腔体共享的收纳刚体变换
  model/details.ts         曲面凹陷、网罩、传感器、触点和铰链
  model/materials.ts       按角色惰性创建、产品内共享的 PBR 材质
  model/createCase.ts      盒壳、内胆、盒盖和 USB-C 凹槽
  model/createEarbud.ts    已确认 C 几何的 CPU 模板、实例克隆与镜像
  model/createProduct.ts   产品层级、三个静态姿态、资源释放
  debug/modelInspection.ts 仅开发模式使用的几何检查面板
  debug/earbudReview.ts    独立裸壳评审、同机位新旧对照与诊断材质
  debug/earbudReviewConfig.ts 六向 / 四斜视与统一尺度投影
  debug/legacyEarbudShell.ts 无细节的旧曲面比较基线
  debug/legacyEarbud.ts    636d080 的旧完整耳机，仅开发参考
  scene/createScene.ts     灯光、相机、控制器、窗口响应
  scene/lighting.ts        程序化柔光箱、PMREM、主辅灯与阴影配置
  scene/contactShadow.ts   离屏几何投影、模糊、脏状态更新及释放
  scene/cameraPresets.ts   八观察方向与三摄影构图
  scene/geometryViews.ts   严格局部六向与四斜视、观察上轴
  scene/framing.ts         按包围球计算安全构图距离
  ui/controls.ts           DOM 按钮与观察视角状态
  ui/styles.css            材质验收工作台样式
  tests/                   产品结构、尺寸、几何与构图测试
  main.ts                  初始化、错误提示和生命周期
docs/
  plans/                   总体方案与六阶段计划
  references/stage-*/      官方参考图，仅建模参照，不进入构建
  reference-manifest.md     参考来源、用途和缺失视角
  asset-manifest.md         程序化环境、阴影与运行时素材来源
  acceptance/              阶段验收记录及测试证据
```

建模输入以毫米表示，`mm()` 转换为场景单位，1 单位 = 10 mm。+Y 为上方，+Z 为产品正面。耳机沿用 A 阶段一次固定的局部坐标，不按生成结果重新居中或归一化；充电盒从 y=0 向上构建，铰链有独立节点，未实现动画。

仅开发模式暴露只读诊断：主页面 `window.__stage03.inspect()`；评审页 `window.__earbudReview.inspect()`。生产版本加载新几何，但不加载开发面板、独立评审界面、旧模型或上述全局入口。`profiles.ts` 使用场景单位；`product.ts` 的整体规格与装配参数使用毫米。

第一阶段历史提交 `e24eff0`，第二阶段提交 `8aa34cd`，第三阶段提交 `4e0d7aa`，被复查的几何修正为 `636d080`。保留各阶段原始验收记录；本轮 A / B / C / D 修正作为用户已验收的几何基线，提交信息见 Git 历史。

## 材质与灯光参数

- `materials.ts`：外壳粗糙度 0.24、清漆权重 0.85；银色金属 metalness 1；网罩哑光衬底 roughness 0.82。均为艺术调校，不代表实物材质检测结果。
- `lighting.ts`：五块柔光箱生成 256 级 PMREM，ACES 曝光 1.05，环境强度 0.8；模型自阴影使用 1024 PCF 阴影图。
- `contactShadow.ts`：512×512 接触阴影，随场景状态改变更新；日常相机渲染不逐帧重建环境贴图。
- `cameraPresets.ts`：相机方向、构图距离倍率与静态姿态映射。所有构图仍按主体包围球适配屏幕宽高比。
- 当前不需要外部纹理文件，因此未创建空的 `public/textures/`。详见 [运行时素材清单](docs/asset-manifest.md)。

## 安全与参考素材

- 开发服务禁止访问 `docs/`、`.local/`、`.env*`、`.git/` 等非预览数据。
- 官方图片仅保存在文档目录作为参考，未用于网页展示，不代表获得再次分发或商用许可。
- 无登录、无追踪、无后端接口，不连接真实 AirPods 设备。
- 此页面为独立建模研究，不是 Apple 官方网页。

## 后续阶段

按 [主曲面重建方案](docs/plans/2026-09-25-earbud-surface-rebuild-design.md)，B / C / D 基线已通过用户验收。本轮执行 [收纳校准计划](docs/plans/2026-09-25-earbud-seating-correction.md)，完成后等待用户确认；不自动提交或推进第四阶段动画。
