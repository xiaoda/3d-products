# 耳机非圆俯视轮廓几何修正实施计划

> 执行：使用 writing-plans、executing-plans 与 test-runner，按下列步骤在本会话实施；用户已确认几何专项修正，不进入第四阶段。无需重新选择执行方式，不使用子代理。

**目标：** 修复耳机俯视近圆、头柄关系和头部下缘轮廓错误，并按用户追加要求修正盒盖俯视截面和收肩，同时维持现有尺寸、材质、灯光和装配能力。

**架构：** 耳机采用独立的弯曲主轴定向截面曲面，参数不再等同于世界坐标高度；半轴、朝向及不对称程度分别控制。充电盒保留水平放样框架，截面改为胶囊轮廓、盒盖肩部提早收拢，按新耳机形状调整收纳槽，不通过增大碰撞容差隐藏穿插。

**技术栈：** Three.js / TypeScript / Vitest / Vite；无新增运行时依赖，不导入官网模型到网页。

## 参考与约束

- 基线提交：4e0d7aa。参考为上轮实际检查的官网图片及 AR 展示模型，见 `.local/earbud-top-research/README.md`。
- 用户指定中国官网：https://www.apple.com.cn/airpods-5/。
- https://www.apple.com/airpods-5/ 与 https://www.apple.com/airpods-5/specs/。
- AR 仅离线核对轮廓，不是 CAD；不将它作为运行时资产或复制顶点网格。规格仍为 18.3 × 30.2 × 18.1 mm。
- 先灰模/投影，再恢复现有物理材质；不新增营销页面、动画或导出功能。
- 开发完成后不自动提交 Git；2026-09-25 用户明确要求提交，随后仅进行本地归档，不推送远程。

## 1. 建立回归基线

- 新增 `src/tests/earbudShape.test.ts` 和必要的稀疏参考轮廓测试数据。
- 验证俯视头柄偏心和收窄、头部下缘、三向轮廓，而不只是包围尺寸。
- 运行 `npm run test -- --run src/tests/earbudShape.test.ts`，确认原实现失败。
- 保留本轮前后的几何投影，不把截图或近似轮廓声称为工程测量。

## 2. 重建连续曲面

- 新增 `src/model/earbudSurface.ts`：弯曲中心线、截面朝向、非圆截面和统一曲面采样；独立处理极点。
- 修改 `src/model/createEarbud.ts`，替换水平圆截面放样；保持单个闭合外壳与左右镜像。
- 修改 `src/model/details.ts`：使用曲面参数重新定位开口、网罩、传感器与触点，避免悬浮/穿插。
- 检查有限坐标、法线、非退化面、封闭边与镜像；运行几何和材质回归。

## 3. 收纳与检查视图

- 检查 `src/model/profiles.ts`、`createCase.ts` 与 `createProduct.ts` 的槽形、姿态和开闭盖范围。
- 保留装配回归，若槽形改为非椭圆则同步改为实际轮廓判定，不放宽容差。
- 为开发检查提供单耳正交顶/正/侧视，避免把透视“顶部”误当作正交轮廓。涉及 `src/scene/createScene.ts`、`src/debug/modelInspection.ts`。

- 追加盒盖回归：俯视两端圆弧、收肩、顶脊与内腔壁厚；铰链保留无穿插的展示旋转轴，不将 AR 开盖姿态的变换枢轴直接当作物理铰链。

## 4. 实际视觉验证与迭代

- 使用 Chrome DevTools MCP：先 list_pages，再建立本任务独立隔离页面，所有操作传返回 pageId。
- 复用经端口验证的 127.0.0.1 开发服务。检查灰模三视图、顶部开盖双耳、材质特写、收纳与重置、窄屏及控制台。
- 完成轮廓对比图，注明坐标对齐方式及近似边界；先解决轮廓，再检查高光连续性。

## 5. 验证与交付

- `npm run test -- --run`、`npm run typecheck`、`npm run build`。
- `npx --no-install prettier --check src index.html vite.config.ts package.json tsconfig.json`、`git diff --check`。
- 更新 README、参考说明及专项验收记录；说明实际通过项和未验证项。
- 交付本地预览与改前/改后对照，等待用户视觉验收；应用户后续要求提交代码，提交不等同于验收通过。
