---
title: "[NeurIPS2026] TT-VidT：把动作倒放，视频编码器会跟着改变判断吗？"
description: "从首帧外观与逐帧运动表示拆解 Diff Compression，对照 24 组预训练组合、同一动作的正放与倒放，以及身份线索仍然保留的证据。"
pubDate: "2026-11-26T21:01:00+08:00"
badge: "Paper"
tags: ["TT-VidT", "NeurIPS 2026", "视频运动表示", "自监督学习", "动作识别", "时序建模", "运动编码器", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML，含附录 A–L][html] · [原文 PDF][pdf] · [作者项目页][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · NeurIPS 2026</summary>

*TT-VidT: Decoupling the Temporal Axis for Efficient Motion-Centric Video Pretraining*。作者为 Shih-Ying Yeh、Daniel Z. Kaplan、Xuehai Wang、Fu-En Yang、Min-Hung Chen 和 Shang-Hong Lai。NeurIPS 2026 主会录用，会议海报将方法名写作 TTVidT。本文按 arXiv v2 正文和补充材料阅读，另核对了公开模型卡、训练仓库和特征提取代码。以下成绩均为作者报告。[会议海报 154339][conf] · [版本记录][abs] · [训练及评测代码][repo] · [编码器权重][weights]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

一段“把杯子推近镜头”的视频倒放，就变成了“把杯子移远”，尽管每一帧的物体、人物和背景都没换。TT-VidT 把首帧外观单独交给重建器，留给每一时刻一个窄通道描述后续变化，再用这种方向正好相反的动作检验编码器究竟读到了多少运动。[方法 §3][method] · [方向实验，附录 I.1][inversion]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　视频自监督模型可以遮住部分画面再重建，也可以根据上下文预测隐藏特征，最后用动作识别任务衡量表示质量。有人站在泳池跳台上时，即使只给一张照片，识别器也有机会猜中动作的大类。[引言与相关工作][intro]

**现有痛点**　依赖物体或场景的特征，遇到“把两个物体靠拢”和“把两个物体分开”就不够用了。这两个动作可以包含完全相同的帧，差别只在播放顺序。单看整体分类准确率，很难辨别模型究竟利用了哪种证据。[附录 A][appearance] · [附录表 31][pairs]

**核心矛盾**　动作需要借助外观解释，但高容量重建器也可以用帧内纹理走捷径。把所有外观信息都丢弃，又会伤害需要识别交互物体的任务，例如厨房里的动词识别。[首帧条件设计][diff] · [表 5][final]

**本文目标**　在统一视频、训练轮数和相近模型规模下，找出更能保留动作方向的编码方式，并量出它在手势、日常操作和人物身份等任务上的取舍。[实验协议 §4.1][setup]

**切入角度**　给重建器一条宽通道，从首帧读取“场景原本长什么样”；给每个后续时刻一条窄通道，让有限的容量优先承载首帧解释不了的变化。[框架图 2][fig]

**核心 idea**　让少量运动 token 一边读当前帧，一边与先前帧交换信息；训练时要求它们配合首帧恢复指定时刻。训练后冻结编码器，再对同一组帧做正放、倒放和镜像，看动作的预测方向是否随输入改变。[§3.1–3.3][method] · [表 4][probe]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

输入是 8 张按时间排序的 RGB 图像。DINOv3 初始化的二维 ViT 逐帧提取空间特征，Temporal Transfer 在每个深度层交换跨帧信息。训练时，小型 DiT 用首帧完整空间特征与目标时刻的运动表示，给目标帧潜变量去噪；做识别时，直接读取编码器的逐帧运动表示。[原文图 2][fig] · [附录 C][pretrain]

<figure class="reading-figure"><a href="/paper-notes/tt-vidt/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/tt-vidt/architecture.svg" alt="TT-VidT 的逐帧二维编码与跨帧 TT3D 交替十二次。训练解码器接收首帧外观、目标时刻运动表示和带噪潜变量，使用时导出逐帧特征。" /></a><figcaption>根据原文图 1、图 2 及公开编码器重绘。左下是预训练的重建任务，右下是释放的特征接口。首帧传给解码器时保留全部 256 个空间位置。点击可放大。</figcaption></figure>

### 关键设计

1. **让少数 token 负责跨帧通信。** 每一帧的 256 个图像块配有 8 个可学习的运动 token。二维自注意力先让这 8 个 token 读取本帧，再让时间分支交换各帧的信息。跨帧注意力按帧采用因果掩码，时刻 t 可以看本帧和之前的帧。空间与时间模块交替 12 次。最简单的 TT1D 只沿时间交换这 8 个 token，8 帧的跨帧序列总长为 64。[§3.1][tt1d]

2. **给时间分支留下一张粗略的位置图。** 正式模型 TT3D 把每帧 16 × 16 的空间网格降到 4 × 4，让 16 个粗空间 token 与 8 个运动 token 一起跨帧通信。8 帧共 192 个位置，比对全部 2,048 个图像块做跨帧注意力短得多，同时能参考前几帧中物体所处的位置。更新过的空间信息写回逐帧分支，首帧给解码器的空间特征仍保留完整分辨率。[§3.2][tt3d] · [公开实现][enc]

3. **用同一张首帧分别解释每一张目标帧。** 原式 (1) 写作 x̂ₜ = D(z₁, mₜ)，z₁ 是首帧外观，mₜ 由参考片段截至 t 的观测编码得到。实现中将目标帧编码成 16 × 16 × 4 的 VAE 潜变量，DiT 在两条条件下学习去噪。各个目标时刻共用 z₁，重建第 t 帧时无需把第 t−1 帧的生成结果递给它。后续帧确实被编码器看到，因此这项任务检验压缩后还能保留哪些变化。[§3.3][diff] · [附录 C–D][pretrain]

4. **分清内部的 8 个 token 和实际拿到的特征。** 作者权重的编码过程保留每帧 8 个运动 token，最后用学习到的池化层将它们汇成 1 个向量。输入形状为 [B, 8, 3, 256, 256] 时，默认接口的运动输出为 [B, 8, 1, 768]。其中 B 是视频数；特征没有命名的关节槽位或动作类别。[模型卡和示例][weights] · [输出池化代码][pool]

### 一个完整例子

以 SSv2 的一组真实类别“物体向镜头靠近／远离镜头”为例。假设画面中是一只杯子，杯子仅用于示意。首帧外观提供桌面和杯子的初始位置。对第六帧，编码器已观察前六帧，m₆ 可以携带杯子变大、位置改变等首帧之外的信息。预训练重建器拿到 z₁ 和 m₆，尝试恢复第六帧。正式测试拿同一批帧倒序重新编码，分别统计预测变为相反类别、维持原类别和变成其他类别的比例。这里的倒放实验检验方向敏感度，论文没有逐维测量哪一维专门表示杯子大小。[九组类别对][pairs] · [方向实验协议][inversion]

### 训练与推理

训练数据来自约 100 万个 OpenVid 片段与约 70 万个 Moments-in-Time v2 片段。按每秒 6 帧取 8 帧，训练 8 轮，有效批量 32。最终设置先在视频上预训练小型解码器，再联合更新二维骨干、时间模块、运动 token 与解码器。只做特征提取时可以单用公开的 195.5M 参数编码器；仓库也公开了训练、数据准备、评测配置和独立的预训练解码器权重。本次核查到代码和权重，未运行模型。[§4.1][setup] · [训练代码][repo] · [编码器文件][files] · [解码器文件][decoders]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

下表选自原文表 5，指标为 Top-1 准确率（%，↑）。除 Diving48 使用 50 轮全量微调，其余各列使用冻结编码器的注意力分类头。表中的 DisMo 是作者按统一设置重训并恢复双增强的版本，V-JEPA 2 也在这套预算下重训。[表 5 与基线设置][final] · [§4.1][setup]

| 同预算模型 | Jester 手势 | SSv2 物体操作 | ARID 暗光动作 | Diving48 微调 | IARD 动作识别 | HMDB51 | EK-V 动词识别 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V-JEPA 2 | 27.41 | 10.59 | 16.01 | 8.02 | 79.34 | 22.70 | 32.61 |
| VideoMAE | 39.47 | 14.95 | 24.37 | 8.43 | 80.44 | **27.73** | **35.62** |
| DisMo，双增强 | 46.95 | 13.33 | 22.45 | 8.12 | **89.89** | 22.57 | 31.97 |
| TT-VidT | **73.25** | **25.92** | **37.47** | **18.63** | 74.84 | 25.15 | 32.54 |

原文表 4 先挑出模型能正确分类的 SSv2 验证片段，然后重新变换、编码和分类。前两列分别是倒放后改判为配对的反向类别，以及仍维持原判的比例，剩下的片段落入其他类。右列换用另一种干预，记录打乱帧序后准确率的**相对下降**。[表 4][probe] · [附录 I.1][inversion]

| 运动方向诊断 | 倒放后匹配反向类别（%）↑ | 倒放后维持原类（%）↓ | 打乱帧序后的相对下降（%） |
| --- | ---: | ---: | ---: |
| 单帧 DINOv3 | 0.0 | 100.0 | 3.1 |
| DisMo | 34.5 | 16.4 | 31.9 |
| VideoMAE-3D | 38.6 | 20.9 | 50.0 |
| TT-VidT | **71.4** | **1.0** | 50.9 |

### 消融实验

**时间通道与训练目标。** 作者组合了 4 个编码器和 6 个目标。固定 ImageNet 初始化的小解码器和 Diff Compression，TT1D、TT3D 的 Jester 分别为 24.32 和 53.89，SSv2 为 7.91 和 18.28。保留 TT3D 但改用带扩散头的遮挡重建（MAE-Diff），两项降至 10.32 和 4.82。正式结果另用了视频预训练解码器。[表 1][sweep]

**解码器预训练与容量。** 固定 TT3D 与同样大小的 S 解码器，随机初始化并以扩散训练、ImageNet 预训练、视频预训练，在 Jester 上依次为 28.46、53.89、73.25。继续将视频预训练解码器从 S 增大到 B、L，Jester 又降至 69.99、34.37。B 在 ARID 的 37.84 略高于 S 的 37.47，容量取舍随任务而变。[表 2][decoderab]

**直接做帧特征减法。** 同样保留首帧条件，用显式特征差代替学习到的运动表示。Jester 从 73.25 降到 64.7，SSv2 从 25.92 降到 24.8，ARID 从 37.47 降到 26.5。[表 4][probe]

### 关键发现

1. **依赖顺序与读对方向是两种能力。** 打乱顺序时，VideoMAE 和 TT-VidT 的相对下降都约为 50%；把合法动作完整倒放时，后者能在 71.4% 的片段上给出具体反向类别，前者为 38.6%。即使 TT-VidT 很少坚持原标签，倒放后的其余错误类别仍然值得看。[表 4][probe]
2. **表征舍弃了一部分人物身份，依然保留相当多身份信号。** 附录在 IARD 另做五人身份分类（随机机会 20%）。用冻结特征做近邻分类，TT-VidT 为 70.99%，DisMo 为 99.56%，单帧 DINOv3 为 100.00%。这组数字衡量“谁在动”，应与主表 IARD 的“做什么动作”分开读。[附录 A 表 7][appearance]
3. **跨帧序列变短带来了可量化的节省。** 256 × 256 输入的单次编码前向为 456.1 GFLOPs，DisMo 为 874.7，VideoMAE 为 1012.6。真实训练的节省幅度小得多，采用小解码器的统一实验中，TT3D 与 DisMo 的单次训练中位数分别为 87.7 和 91.1 B200 GPU 小时。[表 3][cost] · [附录 G][budget]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把视频倒放是代价很低的反事实实验。** 图片集合完全相同，动词含义发生改变；维持原类、转到预期反类、落入其他类三个结果，分别对应不同错误，比只看打乱帧序后的降幅更有辨别力。[附录 I.1][inversion]
- **首帧旁路改变了训练问题。** 左右平移时，桌子材质和杯子纹理已能从首帧取回。减小逐帧通道便给模型留下一条经济的编码方式，用有限容量交代物体怎么移动。作者又用相同骨干搭配遮挡重建去检验这个解释。[训练目标][diff] · [表 1][sweep]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- 判别任务的改善集中在短时方向、手势和动作识别。表 5 的厨房动词提前预测由 V-JEPA 2 领先（23.07%），TT-VidT 为 21.33%。从 8 帧短片提取变化和推断接下来会发生什么，依赖的上下文不同。[表 5][final]
- 模型的公开输出是每帧一个整幅画面的向量。模型卡把跨主体迁移列作后续用途；论文评测没有检验由动物视频驱动人体骨架、多个角色分别绑定或足部接触等目标。研究这些问题，还需要相应的解码器和目标域评测。[公开模型卡][weights] · [局限与方向][limits]
- 数值的比较条件是约 170 万片段与 8 轮共同预算。主扫描每格是单次训练，作者又对关键配置补做不同随机种子与 15 轮实验。深入比较 V-JEPA 2 等大规模训练方案时，需要另行核对各自原生数据与训练预算。[§4.1][setup] · [附录 I.4][seeds]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **DisMo**　两篇都从视频学习运动表示。DisMo 用保持运动的外观增强，并展示视频动作迁移；TT-VidT 研究首帧外观旁路与紧凑时间通道，最扎实的证据来自逐段反向测试。这里的 DisMo 基线重训时使用 DINOv3，原作使用 DINOv2。[站内 DisMo 解读][dismo] · [原文 §2][related]
- **What Moves?**　TT-VidT 回答“倒放后是否能读对方向”；What Moves? 还要求回答“由参考视频中的谁，把动作传给目标画面中的谁”，所以增加了区域掩码、逐实体表示和局部轨迹监督。同一套时间方向测试可以启发局部编码器评测，但这两篇没有做直接对比实验。[WhatMoves 站内解读][whatmoves] · [WhatMoves 方法][wmorig]
- **VTok**　两者都让首帧提供外观。VTok 用显式帧特征差生成变化表示，而 TT-VidT 的 mₜ 经多层时序交互学习得到；表 4 的显式差分对照有助于判断“做差”能解释多少提升。[方法 §3.3][diff] · [表 4][probe]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 会议与原文：[NeurIPS 2026 官方海报][conf] · [arXiv 摘要与版本][abs] · [HTML 正文及附录][html] · [PDF][pdf]
- 实验与诊断：[架构 × 目标扫描][sweep] · [完整主对比][final] · [时间反向实验][inversion] · [训练开销][budget]
- 项目与复现：[项目页][project] · [作者训练与评测代码][repo] · [编码器权重与示例][weights] · [独立预训练解码器][decoders]

</div>

[conf]: https://neurips.cc/virtual/2026/poster/154339
[abs]: https://arxiv.org/abs/2609.33419
[html]: https://arxiv.org/html/2609.33419v2
[pdf]: https://arxiv.org/pdf/2609.33419v2
[project]: https://kohakublueleaf.github.io/TTVidT/
[repo]: https://github.com/KohakuBlueleaf/TTVidT/tree/21c666087ee658c2d8a822eecbe87c6e006fbb1a
[weights]: https://huggingface.co/KBlueLeaf/TTVidT
[files]: https://huggingface.co/KBlueLeaf/TTVidT/tree/3c7a7896988e635f64c7897528f2724484428392
[enc]: https://huggingface.co/KBlueLeaf/TTVidT/blob/3c7a7896988e635f64c7897528f2724484428392/dinov3_vit.py#L310
[pool]: https://huggingface.co/KBlueLeaf/TTVidT/blob/3c7a7896988e635f64c7897528f2724484428392/dinov3_vit.py#L351
[decoders]: https://huggingface.co/KBlueLeaf/TTVidT-decoders
[intro]: https://arxiv.org/html/2609.33419v2#S1
[related]: https://arxiv.org/html/2609.33419v2#S2
[method]: https://arxiv.org/html/2609.33419v2#S3
[tt1d]: https://arxiv.org/html/2609.33419v2#S3.SS1
[tt3d]: https://arxiv.org/html/2609.33419v2#S3.SS2
[diff]: https://arxiv.org/html/2609.33419v2#S3.SS3
[fig]: https://arxiv.org/html/2609.33419v2#S3.F2
[setup]: https://arxiv.org/html/2609.33419v2#S4.SS1
[sweep]: https://arxiv.org/html/2609.33419v2#S4.T1
[decoderab]: https://arxiv.org/html/2609.33419v2#S4.T2
[cost]: https://arxiv.org/html/2609.33419v2#S4.T3
[probe]: https://arxiv.org/html/2609.33419v2#S4.T4
[final]: https://arxiv.org/html/2609.33419v2#S4.T5
[appearance]: https://arxiv.org/html/2609.33419v2#A1
[pretrain]: https://arxiv.org/html/2609.33419v2#A3
[budget]: https://arxiv.org/html/2609.33419v2#A7
[inversion]: https://arxiv.org/html/2609.33419v2#A9.SS1
[pairs]: https://arxiv.org/html/2609.33419v2#A9.T31
[seeds]: https://arxiv.org/html/2609.33419v2#A9.SS4
[limits]: https://arxiv.org/html/2609.33419v2#A11
[dismo]: /blog/neurips2025-dismo/
[whatmoves]: /blog/eccv2026-whatmoves/
[wmorig]: https://arxiv.org/html/2609.04383v1#S3
