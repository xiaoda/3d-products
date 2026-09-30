# 失重雕塑建筑摄影棚视频导出计划

**目标：** 保持已导出 B 片的 20 秒动作、相机和产品灯光，只增加用户选定的建筑摄影棚布景，另存手机竖屏 MP4。

**架构：** 给 `createScene` / `createStudioLighting` 增加可选布景工厂，不传时保持原页面行为。导出专用页复用 `createExplodedStudio` 的建筑风格，扩展墙地尺寸适应整套产品与环绕镜头；布景不进入产品取景计算或接触阴影离屏通道，也不进入 PMREM 产品反射生成。主页面不新增选择器。

**技术：** Three.js、Vitest、Chrome DevTools MCP、本地 PNG 逐帧管线、FFmpeg H.264。

1. 新增 `src/tests/studioBackdrop.test.ts`，验证默认行为、可选背景不被影片覆写、阴影渲染排除布景与异常恢复、幂等释放；先运行失败测试。
2. 修改 `src/scene/lighting.ts` 与 `src/scene/createScene.ts` 的可选工厂接口；原动作、相机、几何代码不变，测试通过。
3. 新建 `.local/sculpture-architecture-export/` 辅助页及本机令牌接收服务，原生 1080×1920 / DPR 1。实际查看不同机位，确认摄影棚无露边、无遮挡。
4. 按旧版 i/30 采样 600 帧，编码 20 秒 / 30 fps / H.264 High 4.1 / yuv420p / faststart / 无音轨，输出新文件，拒绝覆盖旧视频。
5. 全量测试、类型与构建检查；ffprobe、完整解码、关键帧检查和浏览器播放验证。记录结果及旧视频哈希，清理本次服务与页面，不自动提交/推送。
