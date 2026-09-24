# 产品建模参考资料清单

- 核对日期：2026-09-24
- 所选版本：**AirPods 5 标准充电盒版**，已由用户确认。
- 使用范围：整体尺寸、轮廓与主要可见结构；不是完整 CAD 复刻依据。

## 官方资料

| 资料 | 来源 | 用途 |
| --- | --- | --- |
| 官方技术规格 | https://www.apple.com/airpods-5/specs/ | 耳机与充电盒的包围尺寸、区分版本 |
| 官方产品展示 | https://www.apple.com/airpods-5/ | 耳机大体轮廓、前视开盖、闭合盒体与细节参考 |

尺寸按宽 × 高 × 深排列：充电盒 50.1 × 46.2 × 21.2 mm；单只耳机 18.3 × 30.2 × 18.1 mm。尺寸来自官方规格；白模中的铰链位置、分缝高度、耳机截面与展示姿态是基于图片的**建模近似参数**，不是官方提供的工程尺寸。

## 已下载并实际查看的图片

图片仅用于建模参考，保存在 `docs/references/stage-01/`；不通过网页加载，也不进入生产构建。下载不等于获得发布许可。

| 本地文件 | 来源地址 | 可观察内容 |
| --- | --- | --- |
| `case-open.jpg` | https://www.apple.com/v/airpods-5/b/images/specs/hero_airpods_5gen__d26undxkde2q_large.jpg | 标准版规格页面的正面开盖图，分缝和耳机收纳关系 |
| `case-closed.png` | https://www.apple.com/v/airpods-5/b/images/overview/stories/battery_case__e74v6o9y3mie_large.png | 闭合盒体的正面轮廓；不用于推断未显示的版本专有细节 |
| `earbuds.jpg` | https://www.apple.com/v/airpods-5/b/images/overview/bento-gallery/bento_pair__c7i9mu5k2zee_xlarge.jpg | 左右耳机、头柄比例、倾斜侧向轮廓 |
| `earbud-angle.jpg` | https://www.apple.com/v/airpods-5/b/images/overview/bento-gallery/bento_angle__c74f9wrga8mu_xlarge.jpg | 头部局部形状与开口，供下一阶段精修参考 |

## 第一阶段当时的缺失与限制（保留历史）

- 暂无标准版充电盒背面、底面和严格正交侧视的高分辨率参考。
- 耳机倾斜图片不能替代工业设计三视图，透视误差未定量校正。
- 当前内胆、微孔、网罩、底部接口与文字均未作为第一阶段交付。
- 第二阶段补充版本一致的背面和底部参考后，再确定接口和铰链精细结构。
- 不把无法观察的内部结构或近似参数声称为已核实的真实结构。

## 第二阶段补充（2026-09-24）

- 官方识别页面：[识别你的 AirPods](https://support.apple.com/zh-cn/109525)。本轮核对标准充电盒 A3529 的底部 USB-C、前部指示灯与盒盖内侧序列号位置；不混入另一版本的扬声器孔等特征。
- 新增并实际查看 `docs/references/stage-02/standard-case-empty.png`：[官方空盒开盖图](https://cdsassets.apple.com/live/7WUAS350/images/airpods/charging-case-for-airpods-5.png)，用于内胆与盒盖双凹腔结构参考。沿用第一阶段已查看的耳机与盒体参考。
- `src/model/profiles.ts` 的连续截面、凹腔轮廓，`src/model/details.ts` 的开孔位置、大小、网格间距，以及铰链轴后偏 10.9 mm、收纳高度 28.6 mm、开盖检查上限 110°，均为建模近似参数；110° 不表示官方机械限位。
- 当前盒盖凹腔采用规则椭圆截面，未精确复现图片里的非规则轮廓。耳机的偏心曲面、网罩大小和铰链外观也应由用户对照确认；尺寸测试通过不等于曲面还原率达到 99%。
- 尚缺标准版精确背/底面工程图，USB-C 与铰链只完成可视近似结构，未模拟真实连接器针脚、内部电子元件或序列号。暂不虚构工程细节。
- 这些图片仅用于文档建模对照，未进入运行时或构建产物；仍需单独确认再次分发及商业发布许可。


## 耳机与盒盖形态专项（2026-09-24）

- 按用户指定的 [中国官网](https://www.apple.com.cn/airpods-5/) 重新检查“定睛细看”里的双耳、耳部特写与闭合盒图；中国站 `bento_case_close__dlwgev4muxkm_xlarge.jpg` 已下载并实际查看。
- 同页“摆在眼前看看”的 [AR 展示参考](https://www.apple.com.cn/105/media/us/airpods-5/2026/1bae77a6-82ef-46c2-875f-571e880dbfe2/ar/airpods-mid.usdz) 用于离线正交投影与低维曲面参数校准，不导入运行时、不复制顶点网格，不宣称它是制造 CAD。
- 完整 USDZ、离线分析依赖和中间结果仅在忽略目录 `.local/earbud-top-research/`。测试中保留少量三向二维轮廓点；文档保留投影对照，不把原始展示模型作为应用资产发布。
- 替换此前的近圆头部、超椭圆盒盖和规则椭圆槽；仍维持官方整体尺寸。接缝 32.075 mm、收纳高度 27.8 mm、简化铰链轴与 115° 检查姿态均为展示参数，不是官方机械尺寸或限位。
- 保留侧面和局部曲率、内胆、金属铰链及接口的近似边界，详见 [专项记录](acceptance/earbud-geometry-correction.md)。以上补充取代第二阶段关于“当前椭圆腔体”的现状描述，历史记录不改写。
