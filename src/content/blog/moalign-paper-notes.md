---
title: "[ICLR2026] MoAlign：怎样教视频生成器让硬币落进杯子？"
description: "MoAlign 用光流训练运动教师，再让 CogVideoX 学习视频块之间的时空关系。对照 VideoPhy2 的静止基线、运动幅度和跨模型实验，读懂运动更可信究竟测到了什么。"
pubDate: "2026-11-25T18:03:00+08:00"
badge: "Paper"
tags: ["MoAlign", "Text-to-Video", "Video Diffusion", "Representation Alignment", "Optical Flow", "CogVideoX", "VideoPhy2", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML][html] · [ICLR 终稿 PDF][pdf] · [作者补充视频（ZIP，8 段）][videos]

<details class="paper-meta"><summary>论文信息与版本 · ICLR 2026</summary>

*MoAlign: Motion-Centric Representation Alignment for Video Diffusion Models*。作者为 Aritra Bhowmik、Denis Korzhenkov、Cees G. M. Snoek、Amirhossein Habibian、Mohsen Ghafoorian，来自阿姆斯特丹大学和 Qualcomm AI Research。研究任务是文本生成视频。arXiv HTML 对应 2025 年 10 月的 v1；本文按 19 页会议终稿核对数据。终稿补充了第一阶段耗时、Wan2.1 实验和同预算下的 VideoJAM 训练观察。截至 2026 年 11 月 25 日，在作者与会议入口查到论文及演示视频，未查到作者发布的 MoAlign 训练代码或权重。下文使用作者报告的结果。[会议记录][venue] · [作者论文目录][author] · [终稿附录 A.3][cost] · [A.5–A.6][wan]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

输入“硬币落进杯子”，视频模型可能画对了硬币和杯子，却让硬币悬在半空。**MoAlign 先用真实视频里估计出的二维光流，训练一个对移动敏感的教师；再让视频生成器模仿教师眼中各个视频块之间的关系。** 光流用于训练。用户生成视频时只需输入文字，模型从随机噪声开始，最后输出连续的 RGB 画面。[原文图 1][coin] · [方法图 2][fig2]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文本生成视频模型在压缩的视频表示上去噪，能合成清晰的外观。研究者也会用另一个在视频上预训练的编码器作教师，帮助生成模型学到画面之间的关联。[§2–3.1][prior]

**现有痛点**　一帧截图里，硬币出现在杯子上方完全合理。看连续几帧才知道它是向杯口下落、突然消失，还是一直悬停。单凭一帧里物体是否齐全，分不出这三种情况。[图 1][coin]

**核心矛盾**　教师视频特征同时反映物体身份、纹理、背景和位移。如果直接模仿全部特征，学生可以先学会“每一帧都是同一只杯子”，而“硬币相对杯口怎样移动”得到的监督仍可能很弱。[§1–2][intro]

**本文目标**　微调已有的视频扩散模型，提高输出运动与文字要求、日常物理经验的一致性，同时保留只用文字生成视频的使用方式。[§1][intro]

**切入角度**　从普通视频里可以估计每个可见像素如何在画面上移动。作者让一个压缩后的小表示负责预测这种位移，以此筛出比通用视觉特征更关心运动的训练信号。[§3.2，式 3–4][teacher]

**核心 idea**　先把“哪些信息值得教”限定为能支持光流预测的特征，再决定“学生模仿什么”：让学生复现教师特征之间的相似关系，尤其关注时间上相邻的画面。[§3.2，式 5–9][student]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练时同一段视频走两条路。教师从**干净视频**提取运动特征；CogVideoX 从**加噪视频潜变量和配套文字**提取去噪过程中的特征。两条路的时空网格对齐后，各自计算视频块之间的关系，关系差异为生成器提供额外的训练信号。真正生成新视频时，只走微调好的生成器和原有视频解码器。[原文图 2][fig2] · [§3.2][student]

<figure class="reading-figure"><a href="/paper-notes/moalign/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/moalign/architecture.svg" alt="两阶段训练与文本生成流程。冻结的视频编码器与压缩头构成运动教师，光流头在第一阶段学习回归 RAFT 估计。第二阶段对齐视频扩散模型和教师在帧内、跨帧的关系。推理用文字和噪声生成 RGB 视频。" /></a><figcaption>依据终稿图 2、式 3–9 及附录 A.3–A.4 重绘。先看教师如何得到监督，再看哪些量进入生成器的训练损失。最下方是生成新视频时实际经过的路径。点击可放大。</figcaption></figure>

### 关键设计

1. **用可检验的预测任务训练运动教师。** 冻结的 VideoMAEv2 为每个时空位置输出 768 维特征。两层三维卷积将通道数压为 256，再压为 64。一个轻量解码头从 64 维特征预测光流，用 L1 误差对齐 RAFT 从视频估计的二维位移。论文所称的光流“真值”在这里是算法估计值。以附录配置为例，一段输入取 49 帧，教师特征在时间上有 24 个位置，光流头最终输出 23 张 128 × 192 的双通道位移图。转给下一阶段的是教师的 **64 维特征**。[式 3–4][teacher] · [终稿附录 A.3][cost]

2. **让学生学习“这两块像不像”的结构。** 从 CogVideoX-2B 第 18 个 Transformer 块中取出 1,920 维特征，投影至 64 维，并调整时空分辨率。对同一帧，教师先算任意两个空间位置的余弦相似度，学生也在自己的特征中做同样计算，再比较两个相似度矩阵。跨帧时则在不同时刻的位置之间比较。学生有自由使用自己的特征坐标系，只要保留这些关系。例如对所有向量做同一个正交旋转，余弦关系仍然成立。[§3.2，式 5–8][student] · [终稿附录 A.4][depth]

3. **用时间距离决定跨帧监督的权重。** 两个视频块所在的潜在帧相隔 Δ，跨帧误差的权重为 exp(−Δ/τ)，主配置 τ＝10。相隔 1 个时间位置，权重约 0.90；相隔 10 个则约 0.37。同一帧已经有独立的空间项，因此在跨帧项中的权重为零。这样做强调局部运动如何接续，同时仍利用较远帧。附录 A.4 有一句描述强调远程关系，这里按式 7 与正文的定义解读。[式 7–8][student] · [附录 A.4][depth]

4. **把运动监督留在训练环节。** 第二阶段固定教师，更新 CogVideoX 的 Transformer 和训练用投影头。优化目标是原有扩散去噪损失加上 0.5 倍关系损失。生成时无需参考视频、RAFT、光流头或关系矩阵，所学知识进入去噪器的参数。因此用户可以要求“让硬币下落”，却不能通过这个接口指定硬币每一帧的位置或碰撞时刻。[式 9][student] · [实现设置][setup]

### 一个完整例子

把图 1 的硬币例子沿训练和使用两个环节走一遍。以下对视频块的选择是帮助读图的示意；论文展示了生成画面，没有给这枚硬币的内部相似度数值。[原文图 1][coin]

| 环节 | 能看到什么 | 会得到什么 |
|---|---|---|
| 训练教师 | 一段有物体移动的完整视频，以及 RAFT 估计的位移 | 压缩特征必须保留足够信息，光流头才能读出画面中的移动。训练不要求人工标出“这是一枚硬币”。 |
| 训练生成器 | 教师看干净视频，学生看同一视频的带噪表示和文字 | 两者分别比较某时刻物体附近的视频块与稍后其他位置的视频块。训练惩罚关系差异，不给学生指定硬币的跨帧匹配点。 |
| 新提示生成 | 只有“硬币落进杯中”和随机噪声 | 去噪器迭代产生视频潜变量，VAE 解码为画面。可以看硬币是否持续下落、是否进入杯口；要测加速度或接触误差，还需要追踪和几何标定。 |

### 训练与推理

作者报告微调数据包含 Open-Sora Plan 所用视频集的 35 万条子集，以及 Wan2.1-14B 用同一提示来源生成的 1.6 万段视频。两个阶段各用 4 张 80 GB H100。教师阶段训练 5 万步，batch size 128；终稿给出的学习曲线约在 3 万步趋稳，全程约 22 小时，换算约 **88 H100·小时，仅计阶段一**。生成器阶段训练 4,000 步，batch size 32。论文未给第二阶段的实际用时，也未计出光流预计算和整套流程的总成本。[§4.1][setup] · [终稿图 A.2][cost]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**先看能否既完成动作，又显得合理。** VideoPhy2 使用 591 条扩写提示，由自动评估器对语义遵循（SA）和物理常识（PC）分别打 1–5 分。表中 SA、PC 是各自的高分比例，Joint 是同一视频两项都达到 4 分及以上的比例，单位为 %。普通微调与 MoAlign 用相同数据和微调预算；VideoREPA 单列原论文值与本文复现值。[终稿表 1][page7] · [原文 HTML 表 1][t1]

| VideoPhy2 方法 | SA ↑ | PC ↑ | Joint ↑ |
|---|---:|---:|---:|
| CogVideoX-2B | 27.1 | 64.5 | 22.3 |
| 只重复首帧 | 15.6 | **91.0** | 15.1 |
| CogVideoX-2B 普通微调 | 26.4 | 73.1 | 22.8 |
| VideoREPA-2B 原文 | 21.0 | 72.5 | — |
| VideoREPA-2B 本文复现 | 26.1 | 73.3 | 23.0 |
| **MoAlign-2B** | **28.8** | 75.0 | **24.9** |

**再看换一种“物理”评测会怎样。** 下表节选终稿表 2、表 3 与附录表 A.1。VideoPhy 用 343 条短提示和另一套评估器，关注固体、流体等材料交互。VBench 的 Dynamic Degree 对画面运动幅度敏感；VBench-2.0 的 Physics 还包括热学、材料等现象。各列只宜在同列内比较。[终稿表 2][page7] · [表 3][page8] · [附录 A.2][metrics]

| 方法 | VideoPhy 整体 SA ↑ | VideoPhy 整体 PC ↑ | VBench 动态程度 ↑ | VBench-2.0 总分 ↑ | VBench-2.0 Physics ↑ |
|---|---:|---:|---:|---:|---:|
| CogVideoX-2B | **49.8** | 23.9 | **70.3** | 54.9 | **53.9** |
| 普通微调 | 44.9 | 34.1 | 48.1 | 54.7 | 44.9 |
| VideoREPA-2B 本文复现 | 46.7 | 37.9 | 44.4 | 55.0 | 45.1 |
| MoAlign-2B | 49.3 | **39.4** | 42.2 | **55.9** | 48.8 |

**人评与跨骨干验证。** 盲测为每个模型生成 50 段视频，共收集 672 次成对偏好判断。对比基础模型时，MoAlign 获选 68%；对比复现的 VideoREPA 时为 78%。终稿还把方法用于 Wan2.1-1.3B，在 VideoPhy2 上 SA 从 28.7 升至 29.8、PC 从 64.1 升至 64.6、Joint 从 23.7 升至 25.1。这里的 672 是判断次数。[终稿表 6][page9] · [终稿表 A.6][wan]

### 消融实验

终稿表 4 分开检验两件事：教师是否先学过光流；跨帧关系是否按时间距离衰减。取消衰减仍保留关系匹配，相当于让不同帧之间的配对等权。[终稿表 4][page9] · [对应 HTML][abl]

| VideoPhy2 配置 | SA ↑ | PC ↑ | Joint ↑ |
|---|---:|---:|---:|
| 直接对齐对应位置的特征（REPA） | 25.7 | 71.9 | 22.3 |
| 复现 VideoREPA：通用教师、等权跨帧关系 | 26.1 | 73.3 | 23.0 |
| 保留时间衰减，换回通用视频教师 | 27.8 | 73.8 | 23.5 |
| 保留运动教师，取消时间衰减 | 28.2 | 74.4 | 24.1 |
| **运动教师＋时间衰减** | **28.8** | **75.0** | **24.9** |

作者另比较第 10、12、14、16、18、20、22 层。第 16、18、20 层的 Joint 分别为 24.2、24.9、23.8，主配置选第 18 层。这组结果定位的是 CogVideoX-2B 中合适的监督位置；不同骨干仍需选层。[终稿表 5][page9]

### 关键发现

1. **静止基线揭示了指标的捷径。** 只重复首帧时，物体少有机会违反运动规律，PC 高达 91.0，但 Joint 跌到 15.1。MoAlign 的 Joint 为 24.9，相对原始模型 22.3 提高 **2.6 个百分点**。终稿附录 A.2 的文字举例写作 +3.1，此处采用主表两行的差值。[表 1][t1] · [终稿附录 A.2][metrics]
2. **改进取决于考的是哪种运动。** MoAlign 在 VideoPhy 上的整体物理得分升了 15.5 点，同时 VBench-2.0 的 Physics 比基础模型低 5.1 点。作者将后者部分归因于训练集缺乏热学和材料变化样本。动态程度从 70.3 降至 42.2，也说明平滑了突跳与减少了有效运动幅度需要分别检验。[表 2–3][page8] · [终稿局限][limits]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **先问教师能回答什么，再蒸馏。** 光流头让教师面对一个具体问题：这处可见图像内容往哪个方向移动？去掉这一步、仍保留软关系对齐，Joint 从 24.9 降至 23.5。这个消融比只看完整模型超过原始模型，更直接地检验了运动教师的贡献。[表 4][abl]
- **运动的迁移可以发生在“关系”上。** 教师读取干净像素，学生处理带噪潜变量，两套特征来源不同。同帧空间关系保存局部结构，跨帧关系鼓励结构随时间合理变化。要复用这个思路，首先要让两边的时间位置和空间网格可比较。[式 5–9][student] · [附录 A.4][depth]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **光流记录屏幕上的位移。** 相机移动、物体运动都能造成相似的二维位移；遮挡也会让估计出错。一个能预测光流的 64 维表示可以保留更多动态信息，但没有实验据此证明人物身份、纹理和相机运动都被剥离。模型也没有显式输入质量、力或材料参数。[教师目标][teacher] · [终稿局限][limits]
- **真实动作的幅度仍值得单测。** 作者在部分视频中观察到肢体跳变减少，同时承认改善物理常识有时伴随运动减少。若关心跑步或舞蹈，一条直接的验证是用相同提示和视角比较步幅、位移及事件完成率；论文的人体保真和动态程度指标无法单独回答这些问题。[附录 A.2][metrics] · [结论][limits]
- **迁移到人体骨架还有一道对应关系。** MoAlign 的输出是视频，监督单位是图像块。把它作为 3D 动作生成的教师，需要先定义哪些画面区域、时间点对应哪些身体关节，再在解码后的骨架上评估脚滑、接触或轨迹。本文没有报告这条视频到骨架的训练链路。[任务定义][prior] · [方法图][fig2]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **VideoREPA** 是最直接的对照。两种方法都匹配视频块的关系，MoAlign 额外改变教师和跨帧权重。想区分“换用同批数据微调”“加入关系对齐”和“专门监督运动”这三步，应依次读表 1 的普通微调、复现基线，再读表 4 的移除实验。[终稿表 1][page7] · [表 4][abl]
- **VideoJAM** 让视频生成模型同时处理光流。MoAlign 将光流预测放在教师训练阶段。终稿还报告，作者按 MoAlign 第二阶段同样的 4,000 步预算尝试训练 VideoJAM，当时尚未收敛。这只能说明该预算下的适配差异，无法用来给充分训练后的两个系统排名。[终稿附录 A.6][wan]
- **LAMP 与 Parasitic Co-Denoising** 适合用来区分三种“运动”。要在生成前指定物体与相机怎么走，LAMP 有可编辑程序及轨迹；要让视频模型输出独立的三维人体动作，Parasitic Co-Denoising 训练了动作解码支路；MoAlign 则把运动监督放进视频生成器的微调中，使用时直接交付画面。三者能供用户检查和修改的中间产物不同。[站内 LAMP 解读](/blog/cvpr2026-lamp/) · [站内 Parasitic Co-Denoising 解读](/blog/arxiv2026-parasitic-co-denoising3d/) · [MoAlign 方法图][fig2]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- ICLR 2026 出版记录、会议终稿和八段补充对照视频。[会议记录][venue] · [终稿 PDF][pdf] · [视频 ZIP][videos]
- 可翻译的预印本及关键原图、原表。[arXiv HTML][html] · [架构图][fig2] · [主实验][t1] · [消融][abl]
- 终稿新增的计算开销与迁移实验。[教师训练曲线][cost] · [Wan2.1 与 VideoJAM][wan]

</div>

[venue]: https://proceedings.iclr.cc/paper_files/paper/2026/hash/c700d47679e325215a3edb323b63f069-Abstract-Conference.html
[pdf]: https://proceedings.iclr.cc/paper_files/paper/2026/file/c700d47679e325215a3edb323b63f069-Paper-Conference.pdf
[videos]: https://proceedings.iclr.cc/paper_files/paper/2026/file/c700d47679e325215a3edb323b63f069-Supplemental-Conference.zip
[html]: https://arxiv.org/html/2510.19022v1
[author]: https://mohsenghafoorian.github.io/publications.html
[intro]: https://arxiv.org/html/2510.19022v1#S1
[coin]: https://arxiv.org/html/2510.19022v1#S1.F1
[prior]: https://arxiv.org/html/2510.19022v1#S3.SS1
[fig2]: https://arxiv.org/html/2510.19022v1#S3.F2
[teacher]: https://arxiv.org/html/2510.19022v1#S3.SS2.SSS0.Px1
[student]: https://arxiv.org/html/2510.19022v1#S3.SS2.SSS0.Px2
[setup]: https://arxiv.org/html/2510.19022v1#S4.SS1
[t1]: https://arxiv.org/html/2510.19022v1#S5.T2.fig1
[abl]: https://arxiv.org/html/2510.19022v1#S5.T5.fig1
[page7]: https://proceedings.iclr.cc/paper_files/paper/2026/file/c700d47679e325215a3edb323b63f069-Paper-Conference.pdf#page=7
[page8]: https://proceedings.iclr.cc/paper_files/paper/2026/file/c700d47679e325215a3edb323b63f069-Paper-Conference.pdf#page=8
[page9]: https://proceedings.iclr.cc/paper_files/paper/2026/file/c700d47679e325215a3edb323b63f069-Paper-Conference.pdf#page=9
[limits]: https://proceedings.iclr.cc/paper_files/paper/2026/file/c700d47679e325215a3edb323b63f069-Paper-Conference.pdf#page=10
[metrics]: https://proceedings.iclr.cc/paper_files/paper/2026/file/c700d47679e325215a3edb323b63f069-Paper-Conference.pdf#page=16
[cost]: https://proceedings.iclr.cc/paper_files/paper/2026/file/c700d47679e325215a3edb323b63f069-Paper-Conference.pdf#page=17
[depth]: https://proceedings.iclr.cc/paper_files/paper/2026/file/c700d47679e325215a3edb323b63f069-Paper-Conference.pdf#page=18
[wan]: https://proceedings.iclr.cc/paper_files/paper/2026/file/c700d47679e325215a3edb323b63f069-Paper-Conference.pdf#page=19
