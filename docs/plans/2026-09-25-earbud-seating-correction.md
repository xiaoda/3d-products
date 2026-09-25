# 耳机收纳姿态与内腔校准实施计划

> 执行：使用 executing-plans 按步骤实施。用户已明确要求参照指定官网图修复；本轮不开发第四阶段动画、不自动提交 Git，完成后等待视觉验收。

> 进度：共享收纳坐标、同步内腔、正交检查与回归已实现；自动检查和浏览器自检结果见 [验收记录](../acceptance/earbud-seating-review.md)。当前等待用户视觉验收。

**目标：** 使双耳的收纳朝向、头部露出、盒体槽口及盒盖凹腔关系接近官网开盖图。

**架构：** 冻结已验收 B / C 单耳局部曲面和盒体外形，新增共享刚体收纳变换；正式装配与腔体采样使用同一变换。单耳正交检查继续使用原局部坐标，不受装配旋转影响。

**技术栈：** 现有 Three.js / TypeScript / Vite / Vitest；Chrome DevTools 本地 HTTP 验证，不增加依赖。

---

## 依据、问题与方案选择

- 基线提交：`c422cde`。
- 用户指定[官网开盖图片](https://www.apple.com.cn/v/airpods-5/b/images/overview/contrast/explore_airpods_5_in__gadkl3bf562y_xlarge_2x.jpg)，已下载并实际查看：`docs/references/assembly/official-seated-earbuds.jpg`。沿用已有官方空盒图辅助观察盒盖内腔。
- 当前 `setProductPose` 收纳时旋转清零、仅平移 X/Y；`earbudCavity.ts` 同样只平移裸壳。单耳坐标来自独立形态研究，不等同于收纳坐标。
- 图中双耳向内转、传感器靠中间、出音口并非正面可见；当前正面能看到两个明显出音口。盒盖凹腔的偏心与方向亦受错误收纳姿态影响。
- 方案一只移动孔位：无法纠正朝向且可能穿模，不采用。方案二共享刚体变换并重建包络：推荐。方案三重塑耳机或整体拉伸：破坏已验收形态，不采用。
- 单图不能确定真实三维角度、槽深、机械公差；新参数是受外形与碰撞约束的展示校准值，不声称官方 CAD 数据。

## 步骤 1：建立失败用例与几何校准

**文件：** 新增 `src/tests/earbudSeating.test.ts`；离线分析仅写入 `.local/seating-research/`。

1. 在不变形的前提下检查候选收纳旋转、位置、特征相对方向及外壳约束。
2. 写入回归：左右刚体镜像、单位尺度、出音口朝内、传感器可见且靠内、头部露出与壳体边界。
3. 对基线运行 `npm run test -- --run src/tests/earbudSeating.test.ts`，确认旧收纳姿态不能通过。

## 步骤 2：统一装配坐标与内腔生成

**文件：** 新增 `src/model/earbudPlacement.ts`；修改 `src/config/product.ts`、`src/model/createProduct.ts`、`src/model/earbudCavity.ts`。

1. 以毫米位置和明确顺序的角度定义右耳刚体姿态，左耳使用镜像共轭旋转；节点不使用负缩放。
2. 正式耳机和低密度裸壳包络使用相同的变换矩阵。
3. 从变换后实际网格确定上下界，不能再假定 `seatY ± height / 2` 适用于旋转后的耳机。
4. 重算盒体槽口、内壁、盒盖扫掠；如需额外轮廓修饰，必须有图片依据并接受碰撞/壁余量检查，不放宽原空间容差。
5. 运行新增测试及 `inspection.test.ts`、`earbudAssembly.test.ts`，保持原严格几何断言。

## 步骤 3：提供同机位收纳复查

**文件：** 修改 `src/scene/createScene.ts`、`src/debug/modelInspection.ts`、`src/ui/controls.ts`。

1. 增加整套收纳的正交正视、顶视入口，支持隐藏耳机检查孔位。
2. 单耳六向仍清除收纳旋转；普通视图恢复装配姿态，重置与静态姿态切换不漂移。
3. 实际查看正视开盖、俯视、空内胆、闭合与分开展示；检查新姿态与槽口同步。

## 步骤 4：回归与交付

**文件：** 新增 `docs/acceptance/earbud-seating-review.md`；更新 README、参考资料清单。

1. `npm run test -- --run`、`npm run typecheck`、`npm run build`、Prettier 和 `git diff --check`。
2. 保留 B / C 与外壳文件哈希，注明新旧收纳参数、自动采样检查及其局限。
3. 浏览器截图实际查看；归档离线几何对照图时明确不是浏览器截图。
4. 交付本地预览与验收记录，等待用户确认，不自动进入动画或提交代码。
