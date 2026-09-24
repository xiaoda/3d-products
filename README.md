# AirPods 5 · 光影研究

纯 Three.js 程序化产品建模项目。当前版本 **0.3.0：第三阶段材质、灯光与构图开发和本地自测完成，等待用户视觉验收**。未进入第四阶段动画开发。

## 当前能力

- 标准充电盒版，用户已确认。
- 连续截面放样耳机，非对称头部与耳柄使用同一外壳网格；左右耳镜像并保持正确法线。
- 充电盒、独立盒盖、内胆、深收纳槽、盒盖内凹腔与铰链节点。
- 几何网罩、传感器凹面、底部触点、USB-C 凹槽及舌片、前部指示灯。
- 九类共享物理材质：亮面白塑料、内胆、金属、触点、传感器、网罩衬底/细网、接口与指示灯。
- 程序化柔光箱 PMREM 环境反射、主辅灯光、真实几何投影生成的柔化接触阴影。
- 闭合主视觉、开盖双耳、单耳特写三个静态摄影构图；默认开盖双耳。
- 鼠标拖动旋转、滚轮缩放、按钮缩放和重置。
- 透视、正面、侧面、背面、顶部、底部、空盒内胆、单耳特写八个即时观察入口。
- 仅开发模式：闭合 / 开盖 / 分开展示静态姿态、0–110° 铰链滑块、线框、统一灰模、隐藏耳机。
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
- `preview` 同样只监听 `127.0.0.1`，以当次输出端口为准。
- 当前打包器提示 Three.js 所在 JS 分块超过 500 kB，构建仍成功；未关闭该警告，包体优化在阶段六继续处理。
- 代码格式：`npx prettier --check src index.html vite.config.ts package.json tsconfig.json`。
- 漏洞检查：`npm audit --registry=https://registry.npmjs.org`；当前默认镜像暂不支持审计接口，此参数仅对该命令生效，不修改全局 registry。

## 第三阶段验收

1. 打开预览，在画布下方依次选择“闭合主视觉 / 开盖双耳 / 单耳特写”。
2. 旋转模型，检查白色塑料的高光、银色触点/铰链、深色网罩与传感器的反射差异。
3. 查看底部接触阴影和内胆；底部观察与单耳聚焦时会隐藏地面阴影，避免遮挡。
4. 开发模式勾选“统一灰模”对照几何，再取消；点击“重置”恢复开盖双耳与物理材质。
5. 缩窄窗口操作，参考 [第三阶段验收记录](docs/acceptance/stage-03.md) 反馈材质、光照与构图。

本轮只为现有几何增加材质和摄影棚表现，未修改曲面截面参数。几何仍是图片近似，不是工程 CAD；材质参数也不是实物测量值。接触阴影为几何投影与模糊近似，不是光线追踪。正式开合/取出动画、热点与 PNG 导出属于后续阶段，当前构图和姿态均立即切换。

一般视角保留当前装配；“内胆”切换为空盒开盖，“单耳特写”只显示右耳。“重置”恢复开盖双耳并清除检查选项。尺寸指各部件在**未施加展示姿态时的局部包围尺寸**，不是组合展示场景的包围尺寸；指示灯与铰链保留微小表面偏移，闭合盒总尺寸偏差低于 1%。

## 项目结构

```text
src/
  config/product.ts        产品版本、毫米尺寸和单位换算
  model/geometry.ts        保形插值、截面放样、带孔水平片
  model/profiles.ts        盒体、耳机、收纳槽和内凹腔截面
  model/details.ts         曲面凹陷、网罩、传感器、触点和铰链
  model/materials.ts       按角色惰性创建、产品内共享的 PBR 材质
  model/createCase.ts      盒壳、内胆、盒盖和 USB-C 凹槽
  model/createEarbud.ts    连续耳机外壳与尺寸归一化
  model/createProduct.ts   产品层级、三个静态姿态、资源释放
  debug/modelInspection.ts 仅开发模式使用的几何检查面板
  scene/createScene.ts     灯光、相机、控制器、窗口响应
  scene/lighting.ts        程序化柔光箱、PMREM、主辅灯与阴影配置
  scene/contactShadow.ts   离屏几何投影、模糊、脏状态更新及释放
  scene/cameraPresets.ts   八观察方向与三摄影构图
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

建模输入以毫米表示，`mm()` 转换为场景单位，1 单位 = 10 mm。+Y 为上方，+Z 为产品正面。耳机几何的局部原点在包围盒中心，充电盒从 y=0 向上构建；铰链有独立节点，未实现动画。

仅开发模式暴露只读诊断：`window.__stage03.inspect()`，可查看姿态、摄影构图、材质角色、摄影棚状态、资源计数和相机；生产版本不加载检查面板、不暴露该入口。`profiles.ts` 使用场景单位；`product.ts` 的整体规格与装配参数使用毫米。

第一阶段历史提交 `e24eff0`，第二阶段提交 `8aa34cd`；保留各阶段原始验收记录。第三阶段本轮未自动提交，源码快照见 `docs/acceptance/stage-03-source-sha256.json`。

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

见 [分阶段实施与验收计划](docs/plans/2026-09-24-airpods5-phased-delivery-plan.md)。用户已授权进入第三阶段；本阶段材质与构图确认后，再进行第四阶段。
