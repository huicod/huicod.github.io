---
title: "[ECCV2026] MJEPA：视频究竟能教会音频什么？"
description: "从十秒击鼓片段读懂视听联合表征。用只听声音的冻结评测，分清共享权重、跨模态预测、联合输入和额外无声视频各自带来的变化。"
pubDate: "2026-11-19T18:03:00+08:00"
badge: "Paper"
tags: ["MJEPA","Audio-Visual Learning","JEPA","Representation Learning","Self-Supervised Learning","Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 全文与补充材料][html] · [原文 PDF][pdf] · [ECCV 出版记录][venue] · [作者代码][repo]

<details class="paper-meta"><summary>论文信息与阅读范围 · ECCV 2026</summary>

*MJEPA: A Simple and Scalable Joint-Embedding Predictive Architecture for Audio-Visual Learning*，作者为 Revant Teotia、Adrien Bardes、Michael Rabbat、Sumit Chopra、Matthew Muckley 和 Nicolas Ballas。ECCV 2026，第 97–114 页。方法与数据取自 arXiv v1 的主文和补充材料；官方仓库提供 PyTorch 预训练、冻结评估配置及样例索引。本次未运行权重。[会议记录][venue] · [作者实现][repo]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

只看声音时，训练中看过画面的模型仍能更好地识别声音事件。MJEPA 让音频预测同片视频的整体特征，也让视频反过来预测音频特征。在 AudioSet-20K 上，朴素共享编码器让只听声音的成绩从 **30.87 降到 28.70 mAP**；加入双向跨模态预测后升到 **33.52**。视频提供的是关于事件和场景的额外监督，任务的输出是可用于识别的特征。[§4.1–4.4][html]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 音轨和画面记录同一个事件的不同侧面。打鼓时可以听到连续敲击，也可以看到鼓面和演奏动作。视听自监督学习可以利用这种天然配对，省去逐条制作事件标签的成本。[§1–2][html]

**现有痛点：** 音频频谱和视频像素的统计差别很大。把两者交给同一个网络，各自做各自的遮挡预测，两项单模态识别成绩都可能下降。[§4.2][html]

**核心矛盾：** 击鼓的场景可以跨模态共享，某一帧的鼓槌位置却没有一个天然唯一对应的频谱小块。若所有细节都要对齐，模型会被要求去预测另一种观测里未必存在的信息。[§4.3][html]

**本文目标：** 用同一套编码器支持只听、只看、同时听看三种输入；冻结这套编码器后，检验每种输入是否仍保有足够的信息完成下游判断。[§3.2、§5][html]

**切入角度：** 将监督分为两种尺度。模态内部保留位置，训练模型补出被遮挡处的特征；跨模态先对整段取平均，只要求两边对整段内容形成可相互预测的表示。[图 2][arch]

**核心 idea：** 音频、视频、音视频拼接这三种输入各做一次自身预测，再在三种输入之间构造六个有方向的预测任务。共享参数由此接到一个清楚的要求：同一个片段，听到的内容应帮助解释看到的内容。[§4.4][html]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

以带音轨的视频为例，同一段记录提供 A（音频）、V（视频）、AV（两路 token 拼接）三种输入。同一个在线编码器看被遮挡的输入，另一份由它的参数作指数移动平均更新的目标编码器看完整输入。预测头从前者的特征估计后者的特征。部署做音频识别时，只需给编码器声音，再由任务分类头读出结果。[图 2、补充图 4][html]

<figure class="reading-figure"><a href="/paper-notes/mjepa/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/mjepa/architecture.svg" alt="MJEPA 从音频、视频和联合输入，经过共享在线编码器与完整输入的 EMA 目标编码器，分别预测局部遮挡特征和跨模态整段特征，最后通过冻结探针进行识别" loading="lazy" /></a><figcaption>教学示意。蓝色为在线分支，浅紫色为目标分支；比较两处监督时留意目标有无位置信息。下方单独画出只听声音时的推理路径。依据原文图 2、补充图 4 绘制。</figcaption></figure>

### 关键设计

1. **先让两种信号各自保留坐标，再共享计算。** 十秒音频转换成 1024 × 128 的对数梅尔频谱，通过二维卷积切块，保留时间与频率位置。视频通过三维卷积形成短时空块，保留时间和二维画面位置。两路都加上模态标识，再送进相同的 ViT。联合输入在 token 序列维度拼接。[补充 §7–8][token]

2. **模态内在原位置预测，保住局部细节。** 在线分支只看可见块，目标分支看完整片段。以 ViT-L 为例，取第 5、11、17、23 层（沿用论文编号）的特征拼接、投影，再让小型 Transformer 预测被遮挡位置的多层目标。优化对应位置上的 L1 距离，目标端停止梯度。三项任务分别为 A→A、V→V、AV→AV。[§4.1、补充图 4][html]

3. **跨模态先汇总整段，再预测另一端。** 对在线分支最后一层的可见 token 取平均，每个方向用一个三层 MLP，预测目标分支在另一种完整输入上的末层平均向量。六个方向为 A↔V、A↔AV、V↔AV。这样提供了片段级的共有信息；训练目标没有指定某个声谱块应配哪个视频块。三项模态内损失和六项跨模态损失等权相加。[§4.3–4.4、补充 §7][html]

4. **没有音轨的视频也能更新共享主干。** 有音画配对时可计算上述联合目标，只有视频的样本则计算 V→V。新增的 VideoMix2M 约含 200 万视频，作者报告约 13.6 万小时。基础 AudioSet-2M 约含 5000 小时配对音画。这个设计使两类数据可以在同一训练中使用。[§4.5、补充表 4][html]

### 一个完整例子

以“十秒鼓手演奏”为教学设例。只给带遮挡的音轨时，局部预测头学习从周围频谱推测缺失块的特征；A→V 预测头则用剩余声音的平均特征，逼近完整画面中鼓手、乐器和场景的整体特征。交换输入后，V→A 提供反向监督。测试如果只有麦克风，把这段声音的编码特征交给冻结主干上的分类头，就可以给“鼓”等事件打分。两个画面若仅相差一次击打的精确时刻，全局均值目标本身不足以定位这次差异。[图 2、§5.1][html]

### 训练与推理

基础 ViT-L 约 3 亿参数，AudioSet-2M 上训练 15 万步。扩展实验还调整了视频裁剪尺寸、批量、学习率方案，并有额外 1.2 万步的收尾训练；ViT-g 的规模约 10 亿参数。以下“加入无声视频”是整套扩展训练的结果。评估冻结编码器，仅训练轻量注意力分类头，因此“只听声音”指评估输入，不等于预训练时没见过画面。[补充表 4、§3.2][html]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

原表 1 节选。AudioSet-20K 是多标签事件分类，三列均为 mAP，越高越好。A、V、AV 分别是评估时的三种输入。作者用统一注意力分类头复核可取得权重的冻结基线；完整微调成绩由对应论文报告。[原表 1][results]

| 模型与协议 | 预训练数据 | A | V | AV |
| --- | --- | ---: | ---: | ---: |
| EquiAV，冻结 | ImageNet + AudioSet | 34.25 | 18.60 | 38.60 |
| MJEPA ViT-L，冻结 | AudioSet | 38.89 | 25.38 | 42.90 |
| MJEPA ViT-L，冻结 | AudioSet + VideoMix2M | 40.00 | 29.63 | 45.31 |
| MJEPA ViT-g，冻结 | AudioSet + VideoMix2M | **40.97** | **29.82** | **45.44** |
| EquiAV，完整微调 | ImageNet + AudioSet | 42.40 | 25.70 | 46.60 |

迁移到别的声音数据，ViT-g 冻结特征在 ESC-50 环境声单标签分类上为 **96.9% 准确率**，在 FSD50K 多标签事件分类上为 **65.8 mAP**。两者的指标不同。反方向也有收获：ViT-L 在相同规模主干下，仅用 VideoMix2M 训练时 Kinetics-400 / Something-Something v2 为 80.6 / 69.8，混入 AudioSet 视听配对后为 84.7 / 73.3，指标均为视频分类 Top-1。[原表 2–3][html]

### 消融实验

原图 3 与 §4 的渐进实验，统一用 AudioSet-20K 冻结探针。最后一行在前一行基础上加入 AV 联合输入，并同时新增相应预测损失。[原图 3、§4.1–4.4][progress]

| 基础 ViT-L 的训练设置 | 只听 A | 只看 V | 同时听看 AV |
| --- | ---: | ---: | ---: |
| 分别训练纯音频与纯视频编码器 | 30.87 | 19.84 | — |
| 共享编码器，各自做遮挡预测 | 28.70 | 17.90 | 32.38 |
| 上一行 + A↔V 全局预测 | 33.52 | 19.58 | 36.34 |
| 再加入 AV 联合编码及相应损失 | **38.89** | **25.38** | **42.90** |

**能归因到哪一步？** 在共享基础上只加入 A↔V，音频增加 **4.82 mAP**，越过纯音频基线；视频虽回升，19.58 仍略低于纯视频的 19.84。完整配置让两边都越过各自基线。此后 ViT-L 加入 VideoMix2M 的训练配置又使只听成绩从 38.89 升至 40.00；完整设置变更见补充表 4。[图 3、补充表 4][html]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **最值得看的是只听的那一列。** AV 变好可能单纯因为测试多给了一路信息；A 的输入固定为音频，得到的提升才直接表明训练中借用视觉信息后，声音特征更适合识别事件。[图 3][progress]
- **对齐有明确的空间尺度。** 音频内部保留频谱坐标，跨模态比对则刻意压缩成一个向量。对于场景语义，这是成本低且可直接检验的设计；若想研究节拍与动作的关系，需另设带时间轴的监督或测试。[§4.3、补充 §7][html]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **分类指标回答的是“是什么”。** 本文评估识别和片段检索，没有把视觉特征解码为音轨，也未用击打时刻误差衡量音画同步。音色、相位、击打力度分别学到多少，现有结果无法拆开回答。[§5、补充 §9][html]
- **有些声音缺少可见声源。** 例如画外的掌声可能只伴随台上演奏者的画面。一段音画共享场景，对一个具体声音的来源仍可能含糊。论文没有单列画外声子集验证分类提升。[§4.3、§5][html]
- **优势随任务而变。** 在补充表 5 的音频检索视频上，MJEPA 的 R@1 为 29.3%，EquiAV 为 29.6%；视听表征能够相互检索，领先关系仍取决于方向和指标。[补充表 5][retrieval]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **V-JEPA / V-JEPA 2。** MJEPA 延续它们在潜空间补全被遮挡视频特征的办法。它新增音频投影、联合输入及有方向的跨模态预测，使视觉遮挡任务可以和音画对齐共享编码器。[原文 §2–4][arch]
- **EquiAV 与 CAV-MAE。** 这组对照可以将两件事分开：网络怎样学习特征、评估时主干是否允许更新。MJEPA 在冻结 AS20K 探针上领先，而完整微调的 EquiAV 在音视频联合列更高。[原表 1][results]
- **Omni2Sound。** 当目标改为“给演奏画面配音”，需要进一步生成连续音频、处理事件时间与画外条件。把 MJEPA 对事件分类的提升，与 Omni2Sound 的音画同步及生成质量并读，可以区分表征与生成各自需要的证据。[Omni2Sound 论文][omni]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 会议、作者、页码及 DOI。[Springer 正式论文][venue]
- 网络结构、冻结评测及逐步消融。[论文 HTML][html] · [作者 PDF][pdf]
- 训练与评估代码、配置和结果清单。[Meta 研究团队仓库][repo]

</div>

[html]: https://arxiv.org/html/2606.25225v1
[pdf]: https://arxiv.org/pdf/2606.25225
[venue]: https://link.springer.com/chapter/10.1007/978-3-032-36969-7_6
[repo]: https://github.com/facebookresearch/MJEPA
[omni]: https://arxiv.org/html/2601.02731v3

[progress]: https://arxiv.org/html/2606.25225v1#S4.F3
[results]: https://arxiv.org/html/2606.25225v1#S5.T1
[retrieval]: https://arxiv.org/html/2606.25225v1#S9.T5
[arch]: https://arxiv.org/html/2606.25225v1#S4.F2
[token]: https://arxiv.org/html/2606.25225v1#S7
