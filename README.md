# AirPods 5 · 形体研究

纯 Three.js 程序化产品建模项目。当前完成**第一阶段基础白模的开发与本地自测，等待用户验收**，未开始第二阶段精修。

## 当前能力

- 标准充电盒版，用户已确认。
- 充电盒、盒盖、左右耳机的独立节点及固定分开展示。
- 鼠标拖动旋转、滚轮缩放、按钮缩放和重置。
- 透视、正面、侧面、顶部四个即时观察入口，便于白模验收；不是第四阶段的平滑相机动画。
- 基础窄屏适配、键盘按钮操作、WebGL 初始化失败提示。
- 没有外部 GLB/GLTF、纹理或产品图片参与运行时渲染。

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

## 第一阶段验收

1. 打开预览，确认充电盒和两只耳机完整显示。
2. 拖拽旋转、缩放后点击“重置”，确认恢复透视构图。
3. 点击“正面”“侧面”“顶部”，检查粗比例与部件位置。
4. 缩窄窗口，确认模型不拉伸、工具栏仍可用。
5. 对照 [参考资料](docs/reference-manifest.md) 与 [验收记录](docs/acceptance/stage-01.md) 提供反馈。

第一阶段只验收粗比例与可运行结构。耳机仍是椭球、肩部和胶囊的组合，连接处尚未做连续曲面；盒盖切面未建立内部封口或内胆，暂不能开盖。精细曲面与内部结构属于阶段二；真实材质、开合和取出动画、热点、导出分别属于后续阶段。

侧视和顶视存在固定空间布局带来的投影遮挡，可旋转观察；视角按钮不会改变零件布局。尺寸指各部件在**未施加展示姿态时的局部包围尺寸**，不是组合展示场景的包围尺寸。

## 项目结构

```text
src/
  config/product.ts        产品版本、毫米尺寸和单位换算
  model/createCase.ts      圆角盒切分的粗模盒体与盒盖
  model/createEarbud.ts    椭球/胶囊组合耳机及尺寸归一化
  model/createProduct.ts   产品层级、固定展示姿态、资源释放
  scene/createScene.ts     灯光、相机、控制器、窗口响应
  scene/framing.ts         按包围球计算安全构图距离
  ui/controls.ts           DOM 按钮与观察视角状态
  ui/styles.css            阶段一验收工作台样式
  tests/                   产品结构、尺寸、几何与构图测试
  main.ts                  初始化、错误提示和生命周期
docs/
  plans/                   总体方案与六阶段计划
  references/stage-01/     官方参考图，仅建模参照，不进入构建
  reference-manifest.md     参考来源、用途和缺失视角
  acceptance/              阶段验收记录及测试证据
```

建模输入以毫米表示，`mm()` 转换为场景单位，1 单位 = 10 mm。+Y 为上方，+Z 为产品正面。耳机几何的局部原点在包围盒中心，充电盒从 y=0 向上构建；铰链有独立节点，未实现动画。

仅开发模式暴露只读诊断：`window.__stage01.inspect()`，可查看相机距离、视口、节点与三角形数量；生产版本不暴露场景调试入口。

## 安全与参考素材

- 开发服务禁止访问 `docs/`、`.local/`、`.env*`、`.git/` 等非预览数据。
- 官方图片仅保存在文档目录作为参考，未用于网页展示，不代表获得再次分发或商用许可。
- 无登录、无追踪、无后端接口，不连接真实 AirPods 设备。
- 此页面为独立建模研究，不是 Apple 官方网页。

## 后续阶段

见 [分阶段实施与验收计划](docs/plans/2026-09-24-airpods5-phased-delivery-plan.md)。必须先收到第一阶段的用户验收确认，再进行第二阶段。
