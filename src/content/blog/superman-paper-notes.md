---
title: "[CVPR2026] Superman：用视觉与骨架共享的动作词表估计、预测和补全动作"
description: "同一个模型怎样从视频估计三维骨架，又根据已有骨架预测未来、补出两端之间的动作？结合 Human3.6M、3DPW 原表，区分视觉引导分词、可选的二维关节输入，以及连续骨架的解码。"
pubDate: "2026-11-19T12:09:00+08:00"
updatedDate: "2026-11-19"
badge: "Paper"
tags: ["Superman", "Pose-Estimation", "Motion-Prediction", "Motion-In-betweening", "Motion-Tokenizer", "Multimodal-LLM", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 阅读版（arXiv v2）][html] · [原文 PDF（CVPR）][pdf] · [补充材料 PDF][supp] · [作者代码][repo]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026 · 三维人体姿态与动作建模</summary>

*Superman: Unifying Skeleton and Vision for Human Motion Perception and Generation*。作者为 Xinshun Wang、Peiming Li、Ziyi Wang、Zhongbin Fang、Zhichao Deng、Songtao Wu、Jason Li、Mengyuan Liu，前三位共同一作。论文刊于 CVPR 2026，第 38335–38344 页。本文按会议版十页正文及七页补充材料核对数据。arXiv v2 的 HTML 含附录，方便对照阅读。[会议记录][venue] · [版本记录][abs]

下文实验数值由作者报告。论文使用 Qwen2.5-VL-7B。作者随后公开的实现采用 Qwen3-VL-8B-Instruct，提供分词器权重下载入口、训练配置和评估脚本，第二阶段的微调 LoRA 权重仍未随该版本发布。本次核读原文与仓库说明，未运行模型。[分词器发布说明][release1] · [多模态模型发布说明][release2]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

Superman 让三种任务共用一套输出：从视频**估计已经发生的动作**、从历史骨架**预测接下来怎么动**、从两端姿势**补出中间过程**，模型最后都逐个生成骨架 token，再把它们解码为连续的三维关节序列。把这些任务接起来的关键，是先让配对的视频与动捕共同决定哪些短时运动可以用同一个编号表示。[原文图 2、3][pdf]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 从视频估计三维骨架，常先在图像中定位二维关节，再把它们提升到三维。动作预测与补间则通常已知一段三维历史或首尾关键帧，关注的是尚未给出的时间段。

**现有痛点：** 只保留二维关节点会丢失原图中的纠错线索。补充材料举了一个具体例子：右脚快速运动造成模糊，二维估计器把脚点放错，但脚部附近的拖影仍然能提供信息。反过来，只用骨架训练的分词器也从未见过这些运动在画面中的样子。[补充图 S2、S5][supp]

**核心矛盾：** 画面由像素构成，骨架由一系列关节坐标构成，语言模型则预测离散符号。若三者之间的对应关系完全交给下游模型去学，即使知道“哪里看起来像脚”，仍要另学“这个局部运动该输出哪个骨架编号”。

**本文目标：** 将三种任务写成有条件的序列预测，让同一组模型参数面对视频或有限骨架时，都能输出结构相同、可以还原成坐标的答案。

**切入角度：** 训练数据中，同一时刻的关节既有三维坐标，又能在画面中找到对应位置。作者据此把关节周围的视觉特征与三维运动特征配对，先学出双方都能使用的词表。

**核心 idea：** 每个编号同时记录一个视觉原型和一个几何原型。训练分词器时，视频与骨架一起选编号；训练语言模型时，三类任务都以编号为答案；生成坐标时，只需沿编号取出几何原型。[原文 §3][method]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

第一阶段把同步视频与三维关节序列交给视觉引导动作分词器（VGMT），以三维骨架重建为训练目标。第二阶段冻结分词器，把目标动作编号当作监督，混合三种指令训练 Qwen。推理时，视频估计任务走视觉输入，预测和补间任务走骨架输入；三条路径共用自回归输出和骨架解码器。[正文图 2、3][pdf] · [附录图 S1、表 S1][supp]

<figure class="reading-figure"><a href="/paper-notes/superman/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/superman/architecture.svg" alt="Superman 的训练和推理图。配对的 RGB 与三维骨架学习混合码本，视频估计、骨架预测及补间由同一模型生成离散编号，再由几何解码器恢复三维关节。" loading="lazy" /></a><figcaption>根据原文图 2、3 与补充图 S1 重绘。读图时要区分两处视觉信息：分词器训练用它学习编号，多模态模型估计视频姿态时可以再用二维关节增强视觉输入。骨架预测和补间关闭后者。点击可放大。</figcaption></figure>

### 关键设计

1. **在关节附近读取图像，而非把整帧压成一个向量。** 几何分支读入“帧数 × 关节数 × 3”的序列，在时间与关节构成的网格上做卷积。视觉分支先用 HRNet 提取逐帧特征，再从每个关节投影到画面的坐标出发。视觉–骨架注意力（VSA）预测一组采样偏移与权重，让模型可从脚点周围的多个位置取证。估计器把脚点放偏时，这一步仍有机会找到真正随脚运动的区域。[原文 §3.1][method] · [附录图 S5、S6][supp]

2. **一个编号配两组原型，解码只读几何一侧。** 时间下采样把相邻帧压成短时特征。对于一个待编码位置，模型遍历码本，比较视觉特征到视觉原型、骨架特征到几何原型的距离，选择联合距离最小的编号。随后只取选中的几何向量，上采样并重建三维坐标。训练除重建误差外，还用分别作用于两种模态的承诺损失约束特征靠近选中的原型，论文给两项各 0.5 的权重。正式模型有 8,192 个码项。[原文式 (1)–(3)][method]

3. **视频估计额外保留一条可选的二维关节路径。** 标准版本把视频视觉特征送入多模态模型。启用 Motion-Aware Fine-Tuning（MAFT）时，再用二维关节定位到的局部特征作键和值，让视觉网格特征作为查询读取它们，再交给语言模型输出骨架编号。前一阶段 VSA 影响“词表怎么学”；这里的 VSA 影响“从这个视频预测哪个词”。两者所处的位置和输入不同。[原文 §3.2][method2] · [补充图 S1][supp]

4. **任务指令规定要补哪一段运动。** 视频估计输出画面中这段动作的骨架。预测用历史骨架编号作条件，接着生成未来。补间同时给出起始和结束姿势的编号，请模型补出过渡。补充材料将输出按躯干、左右手臂、左右腿排列；这些部位标题标明编号属于哪里，编号本身仍是学出来的码本索引。三任务样本混在同一个 batch 中，对答案序列共同使用下一 token 交叉熵。[正文 §3.2][method2] · [指令实例][supp]

### 一个完整例子

以“正在迈步的人接下来怎样落脚”为教学例。已知过去 16 帧，每帧有 17 个三维关节，输入可写成 **16 × 17 × 3**。按论文补充材料的采样率，这段历史覆盖 320 ms，目标是再预测 16 帧。为了直观看出压缩量，作者**公开实现**的分词器将一个 16 帧窗口表示成 136 个动作编号。每个编号在 8,192 个码项中取值，136 表示序列长度，8,192 表示每个位置可选择的词数。[补充表 S1][supp] · [发布实现的形状说明][release1]

把历史编号连同“预测后续”的任务提示交给模型后，它依次生成未来编号；解码器取对应的几何向量，恢复 16 帧连续关节。此处站在起点只看过去，落脚位置由模型预测。若额外给定迈步结束时的姿势，任务就变成补间；若提供整段真实视频并要知道实际脚踝在哪里，才会走视频估计分支。三种输入可以对应同一个迈步动作，却回答三个不同问题。

### 训练/推理

训练集使用 Human3.6M。附录给出的分词器设置为 AdamW、50 万步、batch size 256、学习率 0.0002。随后冻结分词器，微调 Qwen2.5-VL-7B，混合任务的全局 batch size 为 16，学习率为 0.0001。论文报告使用两张 NVIDIA H20。现有发布仓库提供另一套 Qwen3-VL-8B 配置，README 给出 8 卡、3 个 epoch 的 LoRA 训练设置，不能用它倒推论文训练时长。[会议补充材料][supp] · [仓库配置说明][release2]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**1. Human3.6M，同一模型能否兼顾三项任务？** 表 2 节选。MPJPE 是预测与真实关节的平均位置误差，N-MPJPE 先对尺度作归一化，单位均为毫米，越低越好。预测与补间列为平均 MPJPE。传统估计方法使用二维姿态估计器；Superman 同时给出了直接读取 RGB 与加入二维关节提示的两种结果。[会议表 2][t2]

| 模型 | 姿态估计 N-MPJPE ↓ | 姿态估计 MPJPE ↓ | 未来预测均值 ↓ | 补间均值 ↓ |
| --- | ---: | ---: | ---: | ---: |
| MotionBERT | 47.07 | 56.70 | 29.94 | 42.37 |
| Skeleton-in-Context | 45.26 | 55.57 | 33.42 | 31.27 |
| Human-in-Context | 44.77 | 53.86 | 26.66 | 31.13 |
| PoseLLaVA（逐帧） | 50.40 | 62.43 | — | — |
| MotionGPT3 | — | — | 42.30 | 47.66 |
| Superman | 44.90 | 61.39 | **26.13** | **30.61** |
| Superman + MAFT | **39.41** | **51.61** | **26.13** | **30.61** |

仅看 RGB 时，Superman 的原始姿态误差为 61.39 mm，高于使用二维检测的 Human-in-Context（53.86）。加入二维提示后降为 51.61 mm。后两列数字完全相同，因为在这两项任务里模型仅接收三维骨架，MAFT 关闭。预测误差也随时间拉长，Superman 在 80、160、320 ms 分别为 13.70、23.30、44.90 mm。[会议表 2 及表注][t2]

**2. 只在 Human3.6M 训练，直接到 3DPW 测试。** 表 4 指标为毫米。先将 3DPW 的 SMPL 结果映射为统一骨架，再测试基于骨架的预测与补间。表中没有报告 3DPW 视频估计结果。[会议表 4][t4]

| 模型 | 未来预测均值 ↓ | 80 ms ↓ | 320 ms ↓ | 补间均值 ↓ | 补间中点 ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| MotionBERT | 164.96 | 137.89 | 200.14 | 123.05 | 148.51 |
| Skeleton-in-Context | 140.71 | 110.77 | 183.74 | 103.97 | 127.68 |
| Human-in-Context | 141.90 | 112.53 | 183.62 | 108.54 | 131.99 |
| MotionGPT3 | 228.17 | 190.83 | 259.49 | 180.10 | 204.71 |
| Superman | **62.05** | **34.75** | **97.37** | **60.68** | **63.35** |

### 消融实验

**分词器是否需要视觉？** 表 6 同时测量分词器重建骨架以及整套模型的姿态估计。两项都是毫米。仅在码本训练中使用骨架时，模型已经能重建动作。加入视觉与几何的等权承诺项后，相对仅用骨架，重建误差下降 3.0 mm，下游 N-MPJPE 下降 2.9 mm。[会议表 6][t6]

| 分词器设置 | 重建误差 ↓ | 下游姿态估计 N-MPJPE ↓ |
| --- | ---: | ---: |
| 仅视觉 | 22.5 | 51.3 |
| 仅骨架 | 7.7 | 47.8 |
| 骨架 / 视觉承诺权重 0.3 / 0.7 | 6.8 | 45.8 |
| 0.7 / 0.3 | 5.3 | 45.1 |
| 0.5 / 0.5 | **4.7** | **44.9** |

**一个模型混合训练，与同架构分别训练相比如何？** 表 7 把每项任务的专用模型与共享模型逐列对比。原表精度为一位小数。估计列与表 6 的 N-MPJPE 对应，后两列为平均 MPJPE。[会议表 7][t7]

| 训练设置 | 姿态估计 ↓ | 未来预测 ↓ | 补间 ↓ |
| --- | ---: | ---: | ---: |
| 三个专用模型，各从本任务取值 | 46.5 | 27.3 | 33.1 |
| 一个模型联合训练 | **44.9** | **26.1** | **30.6** |

### 关键发现

- **视觉提示的收益与动作类型有关。** 原表 3 中，MAFT 将“坐下”的 N-MPJPE 从 71.93 降至 48.97 mm，却让“行走”从 30.89 升至 36.12 mm。总体误差下降，不能据此认定每类姿态的二维提示都更可靠。[会议表 3][t3]
- **联合训练与视觉引导解决的是两件事。** 表 7 显示骨架预测与补间也受益于任务混合；表 2 则表明，在这两项任务的推理路径上打开视频专用模块没有意义。跨数据集实验的优势也来自对骨架序列的处理。[会议表 2、4、7][pdf]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **任务之间共享了可以直接检验的中间结果。** 无论视频估计还是骨架预测，输出都要经同一个几何解码器还原为三维关节。因此既可以单独测试“正确编号能还原到多准”，也可以再测试“模型能不能从有限输入预测正确的运动”。表 6 的 4.7 mm 与表 2 的 51.61 mm 对应这两个不同问题。
- **关于“动作词”的证据具体到运动方向。** 作者统计每个码项所覆盖片段的平均末端位移，并为腕、踝绘出方向分布。这支持码项与局部运动方向有联系。给定一个编号能否指定“伸手接杯”这样的事件，还需要物体、接触与解码动作的单独验证。[补充图 S7][supp]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **三维输出有明确坐标约定。** 预处理将横纵位置转换到图像坐标，以骨盆深度为零点表示相对深度，同时保留骨盆在画面中的横纵位置。即使某段骨架预测准确，也不能直接将其当作带绝对尺度和位置的世界轨迹。[原文 §4，Data Preprocessing][exps]
- **预测跨度与控制条件都很具体。** 预测协议是过去 320 ms 到未来 320 ms，补间主要给定首尾姿势，误差按关节距离统计。长时动作意图、任意文本指令的动作生成、接触是否执行以及端点的精确几何误差，都需要另外的实验验证。[补充材料 §A.2][supp]
- **自回归骨干主导耗时，现有权重也要区分阶段。** 论文表 5 列出 Qwen 骨干延迟约 3,300 ms、MAFT 模块 0.3 ms，这些是原表组件测量，无法直接换算成在线动画帧率。仓库分词器说明报告发布权重重建为 5.85 mm，与论文消融表的 4.7 mm 分属不同记录；第二阶段 README 明示未附微调 LoRA。[会议表 5][t5] · [会议表 6][t6] · [分词器发布记录][release1] · [第二阶段发布记录][release2]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **与 UniEgoMotion 对照输入。** Superman 的视频估计任务分析画面中的人，而骨架预测任务读取一段已知关节序列。UniEgoMotion 要恢复的是摄像眼镜佩戴者自己，通常连双腿也拍不到，因此专门引入设备轨迹和头部参考系。[本站 UniEgoMotion 解读](/blog/iccv2025-uniegomotion/)
- **MotionBERT、Skeleton-in-Context、Human-in-Context。** 三者是原表中的骨架建模比较对象，适合用来问“显式二维或三维姿态输入已经很强时，视觉–骨架联合词表还增加了什么”。对照时应保留有没有二维检测这一列，也要分别看预测与补间。[会议表 2、4][pdf]
- **MotionGPT、MotionGPT3。** 这条路线同样把运动表示为语言模型能预测的离散序列。Superman 多做的一步是从配对 RGB 和骨架共同学习码项，并让视觉输入最终也产生这组编号。表 2 中空缺的视觉估计单元格表示该任务不适用，并非模型误差为零。[会议表 1、2][pdf]
- **与 VideoMDM 一起读。** 两者都利用视频，但承担训练成本的标签不同。Superman 依赖三维动作与图像配对来建分词器；VideoMDM 把粗略三维估计投回二维观测来训练生成先验。若手头只有单目视频与二维轨迹，这个区别直接决定能否照搬训练过程。[本站 VideoMDM 解读](/blog/neurips2026-videomdm/)

<span id="reading-8" class="reading-anchor"></span>
## 来源

- [CVPR 2026 会议记录][venue] · [原文 PDF][pdf] · [arXiv HTML v2][html] · [补充材料][supp]。方法依据正文 §3 与补充图 S1，任务协议及部位输出例子见补充表 S1，数字来自正文表 2–7。
- [作者代码][repo] · [分词器 README][release1] · [多模态模型 README][release2]。仓库引用固定到核对时的版本，便于区分论文主表与后续实现。

[venue]: https://openaccess.thecvf.com/content/CVPR2026/html/Wang_Superman_Unifying_Skeleton_and_Vision_for_Human_Motion_Perception_and_CVPR_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/Wang_Superman_Unifying_Skeleton_and_Vision_for_Human_Motion_Perception_and_CVPR_2026_paper.pdf
[html]: https://arxiv.org/html/2602.02401v2
[abs]: https://arxiv.org/abs/2602.02401
[supp]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Wang_Superman_Unifying_Skeleton_CVPR_2026_supplemental.pdf
[repo]: https://github.com/BradleyWang0416/Superman-CVPR2026
[release1]: https://github.com/BradleyWang0416/Superman-CVPR2026/blob/d9b473ecf93d61fc2375f60394c2e64a43f3eed6/motion_tokenizer/README.md
[release2]: https://github.com/BradleyWang0416/Superman-CVPR2026/blob/d9b473ecf93d61fc2375f60394c2e64a43f3eed6/mllm/README.md
[method]: https://arxiv.org/html/2602.02401v2#S3.SS1
[method2]: https://arxiv.org/html/2602.02401v2#S3.SS2
[t2]: https://arxiv.org/html/2602.02401v2#S3.T2
[t3]: https://arxiv.org/html/2602.02401v2#S3.T3
[exps]: https://arxiv.org/html/2602.02401v2#S4
[t5]: https://arxiv.org/html/2602.02401v2#S4.T5
[t4]: https://arxiv.org/html/2602.02401v2#S3.T4
[t6]: https://arxiv.org/html/2602.02401v2#S4.T6
[t7]: https://arxiv.org/html/2602.02401v2#S4.T7
</div>
