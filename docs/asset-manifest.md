# 运行时素材与生成方式

更新：2026-09-24，第三阶段，版本 0.3.0。

| 项目 | 来源与形式 | 运行时处理 | 许可与边界 |
| --- | --- | --- | --- |
| 产品几何 | 本项目 Three.js 截面与网格代码 | 生成 BufferGeometry | 图片近似，不是官方 CAD；参考来源见 `reference-manifest.md` |
| 外壳/内胆/金属等九类材质 | `src/model/materials.ts` 数值配置 | MeshPhysicalMaterial / MeshStandardMaterial，按角色共享 | 参数为展示调校；包括 IOR 在内均非实物检测数据 |
| 摄影棚反射 | `src/scene/lighting.ts` 五个高亮矩形柔光箱 | PMREMGenerator.fromScene，256 级分辨率，GPU 半浮点纹理 | 本项目程序化生成，不是下载的 HDR 照片，无图片素材网络依赖 |
| 模型自阴影 | 本项目主灯与真实几何 | 1024 PCF 阴影图 | 渲染近似，不是离线路径追踪 |
| 接触阴影 | `src/scene/contactShadow.ts` 投影实际模型 | 512×512 离屏投影与两轮分离模糊，状态变化时更新 | 非固定椭圆图片；不是严格面积光源的物理半影 |
| 网罩 | 第二阶段的真实几何细网 | 哑光衬底 + 金属细网材质 | 无外部网罩贴图，微观尺寸为近似 |
| 背景与材质图例 | `src/ui/styles.css` 渐变 | CSS 绘制，仅用于界面 | 图例不是实物采样照片，也不映射到模型上 |
| 产品参考图片 | `docs/references/stage-01/`、`stage-02/` | 不由网页请求，不进入 dist | 仅建模对照；官方版权和再次分发许可仍须单独确认 |

## 依赖与技术依据

- Three.js 0.186.0，MIT；许可证位于 `node_modules/three/LICENSE`。本阶段未增加依赖。
- PMREM、物理材质、阴影 API 按本项目已安装版本源码与类型定义核对；使用的模糊着色器来自 `three/addons/shaders/HorizontalBlurShader.js` 和 `VerticalBlurShader.js`，随 Three.js 的 MIT 许可。
- 程序化环境与投影阴影均在浏览器本地生成，无上传接口或第三方素材请求。
- 未引入外部图片纹理，因此没有需要存入 `public/textures/` 的文件。后续若引入 HDR、贴图或字体，必须补充来源、许可和加载路径。

## 不应混淆的数据

整体产品尺寸来自项目登记的公开规格；几何截面由图片观察估算；粗糙度、清漆、光强、反射环境及曝光则是本轮视觉调校。三类数据不能互相当作实测依据。
