# Immersive Showroom UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将已验收的 AirPods 5 三维展示改为单屏沉浸式页面，减少非 3D 内容和重复操作，同时保留所有观察与开发检查能力。

**Architecture:** 只改 HTML、样式和 UI 事件绑定，不修改产品网格、装配、材质或场景。主界面采用占满视口的画布、精简顶栏和底部三项操作；完整视角与缩放放进原生 disclosure，参数放进产品信息 disclosure。开发几何面板仅在 `?debug=1` 且 Vite 开发模式下动态加载。

**Tech Stack:** Vite、TypeScript、Three.js、原生 HTML/CSS、Vitest、Chrome DevTools MCP。

---

### Task 1: 基线与结构

**Files:** Modify `index.html`.

1. 先确认现有开发服务和浏览器真实渲染，记录原页面可见操作。
2. 将两栏工作台改成单屏展示台；保留 `#viewport`、加载/错误节点以及当前状态标题。
3. 顶部只留品牌、简短产品名和“产品信息” disclosure；信息内保留尺寸、材质、近似模型说明。
4. 底部只留 `#lid-action`、视角 disclosure、`#reset-view`；八个视角和两项缩放保留在 disclosure 内。
5. 检查初始 DOM 不出现旧侧栏、两组重复构图控制和默认开发面板。

### Task 2: 行为与开发入口

**Files:** Modify `src/ui/controls.ts`, `src/main.ts`, `src/debug/modelInspection.ts`.

1. 连接开合按钮到已有静态 `setShot('closed'|'open')`，不新增动画；状态文本随模型姿态变化。
2. 视角菜单连接全部八种已有视角；单耳特写采用已有摄影构图；选择后收起菜单。重置恢复默认开盖展示。
3. 模型报错时禁用相关按钮；只在开发模式且 URL 为 `?debug=1` 时装载检查面板及局部评审入口。
4. 保留 `?review=earbud-shell` / `?review=earbud-details` 与只读诊断能力。

### Task 3: 视觉与响应式

**Files:** Modify `src/ui/styles.css`.

1. 以产品为主体设计桌面单屏构图；浮层不遮挡画布旋转区域。
2. 为 390px 手机屏和窄高屏设计紧凑底部操作与可滚动信息/视角菜单。
3. 原生 disclosure、焦点状态、最小触控尺寸、对比度和减少动效偏好要可用。
4. 开发检查面板仅在显式调试时作为独立可滚动浮层显示。

### Task 4: 验证与说明

**Files:** Modify `README.md`; add UI regression test in `src/tests/` if a stable pure-state seam is available.

1. 运行 `npm run typecheck`、`npm run test -- --run`、`npm run build`、Prettier 与 `git diff --check`，预期全部通过。
2. 在真实浏览器检查桌面、手机、`?debug=1` 和原局部评审入口；实际截图确认画布/菜单/溢出。
3. 验证开合、视角、缩放、重置、信息 disclosure、开发面板与键盘行为。
4. 更新 README 的入口与验收说明；本轮先交付视觉验收，不自动提交或推送。
