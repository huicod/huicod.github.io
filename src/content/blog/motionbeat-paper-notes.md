---
title: "[ICASSP2026] MotionBeat：舞者的落脚能教会音乐编码器什么？"
description: "解读 MotionBeat: Motion-Aligned Music Representation via Embodied Contrastive Learning and Bar-Equivariant Contact-Aware Encoding。沿着 AIST++ 的音乐与舞蹈配对，解释逐拍 log-mel、错拍负例、重音与足部接触怎样训练音乐编码器，并核对 EDGE 生成和双向检索的结果。"
pubDate: "2026-11-21"
badge: "Paper"
tags: ["MotionBeat", "Music-to-Dance", "Music Representation", "Contrastive Learning", "Music-Motion Retrieval", "AIST++", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[可翻译的 HTML 全文][html] · [原文 PDF][pdf] · [会议记录][venue] · [作者项目页][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · ICASSP 2026</summary>

*MotionBeat: Motion-Aligned Music Representation via Embodied Contrastive Learning and Bar-Equivariant Contact-Aware Encoding*。作者为悉尼大学的 Xuanchen Wang、Heng Wang、Weidong Cai。论文于 2025 年 10 月首发，2026 年发表于 ICASSP，页码 14647–14651。会议将其列入 Music Content Analysis 口头报告。本文依据 2026 年 1 月修订的 arXiv v2 正文、图 1 与表 1–3，并核对会议条目和作者仓库。数值均为作者报告。[arXiv 记录][record] · [IEEE 出版记录][doi] · [会议日程][venue]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给一首歌配上它原来的舞蹈，再放一遍同一支舞、故意让动作晚一拍。要区分这两对，认出是什么歌还不够。MotionBeat 用这种对比，加上音乐起音与身体接触的时序监督，在 AIST++ 上联合训练音乐和舞蹈两个编码器。训练结束后，音乐编码器可单独提供特征，由 EDGE 把特征转成连续的 3D 舞蹈。[训练目标][objectives] · [下游设置][protocol]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　音乐驱动的编舞可以先提取声音特征，再交给动作生成器。以 EDGE 为例，它用冻结的 Jukebox 提取音乐特征，条件扩散模型负责生成舞蹈。这样，生成器能获取哪些音乐信息，取决于前端保留了什么。[EDGE 项目][edge]

**现有痛点**　同一曲风的两段音乐可能速度相近，重音却落在不同的拍子。假如训练时只让模型区分嘻哈和古典，光凭音色就能做对。到了编舞时，知道曲风仍不足以决定何时落脚。[引言][intro] · [对比学习目标][ecl]

**核心矛盾**　片段来自同一首歌、具有相同 BPM，与音画逐拍同步是两件事。另一方面，舞者也会有意抢拍、拖拍，如果每个动作峰值都必须与鼓点发生在同一帧，又会惩罚合理的表达。[节奏对齐目标][sral]

**本文目标**　让音乐表示同时保留音乐与动作是否相配、音符和身体重音如何分布，再检查这种表示能否迁移到音乐检索、节拍追踪和舞蹈生成。[原文 §1][intro] · [任务与指标][tasks]

**切入角度**　训练的素材是同步录制的音乐和三维舞蹈。同一段数据能提供两类依据：整段音乐配了哪段舞，以及舞者在哪些拍子接触地面、在哪些拍子投入了较多运动能量。[输入表示][input] · [AIST++ 数据集][aist]

**核心 idea**　给编码器一组“只听速度和音色就会选错”的候选，再用两个时间尺度教它辨别节奏。逐拍比较起音和接触，小节内比较重音和动能的分布。最后把节拍相位写入两路注意力，把接触概率写入动作分支的注意力。[方法图 1][fig] · [原文 §2.1–2.2][method]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练时音乐和舞蹈共用一条拍点时间轴，各自通过一个可训练的 Transformer。两个投影头把它们送往共同的对比空间，节奏辅助分支则比较时间上发生的事件。生成新舞蹈时，只需提取新音乐的表示，再送给 EDGE。训练中的舞者为音乐表示提供了监督，推理时无需先找到一段配对的舞。[图 1][fig] · [实验协议][protocol]

<figure class="reading-figure"><a href="/paper-notes/motionbeat/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/motionbeat/architecture.svg" alt="MotionBeat 的两路音乐与动作编码、负例对比与时间对齐训练，以及音乐编码器接入 EDGE 的生成路径。时间轴示例展示原配对和晚一拍的落脚。" loading="lazy" /></a><figcaption>依原文图 1、式 1–9 与下游实验重绘。图中一拍错位只用于说明训练负例。点击可放大。</figcaption></figure>

### 关键设计

1. **让两路输入共享节拍的坐标。** 先估计速度和小节第一拍，再把音频和动作切成连续的 K 个拍区间。每一区间把 128 个频带的 log-mel 谱沿时间取平均，形成 K × 128 的音乐输入。动作侧从 3D 关节和 SMPL 参数计算运动学特征，也逐拍平均。这里的 token 是连续数值，两侧都没有把整拍变成一个码本编号。[输入表示][input] · [训练配置][setup]

2. **用小节相位与接触提示改注意力。** 对每小节 B 拍，第 t 拍的相位为 2π(t mod B)/B。在注意力求内积前，按这个角度，把查询和键的成对通道视作二维向量旋转。两者的内积因此依赖相对相位。动作侧进一步用每拍的接触概率，一次提高该位置被关注的分数，一次放大它贡献的值向量。接触概率为零时，这个位置仍然保留。作者说明训练时可用轻量预测头估计接触。[相位旋转，式 7][phase] · [接触注意力，式 8–9][contact]

3. **ECL 学会分辨速度相同但动作不同步的配对。** 给定音乐表示与真正配对的动作表示，计算余弦相似度。对比损失的分母除了同批次中的其他动作，还有两类难负例：BPM 接近但小节相位或重音不同的片段，以及把同一片段的音乐或动作提前、延后一拍得到的配对。第二类保留了身份、曲风和音色，仅靠“还是原曲”无法取胜。[式 1–2][ecl]

4. **SRAL 分别看拍内事件序列与小节内的能量分布。** 在拍的尺度，用可微的时间规整距离 Soft-DTW 比较音乐起音包络与动作接触脉冲，容许局部错位。在小节尺度，各自将重音强度和运动动能归一化，再用推土机距离 EMD 比较两种分布。把强度集中位置从第一拍移到第三拍会产生搬运代价，即使整个小节的总强度相同。论文训练目标为 ECL + 0.2 × (0.9 × 逐拍项 + 0.2 × 小节项)。[式 3–6][sral]

### 一个完整例子

设一段音乐为 120 BPM、两个四拍小节，共 4 秒、8 拍。以下数字用于演示数据如何流动。音乐经逐拍池化得到 **8 × 128** 的输入，动作变成时间对齐的 8 个运动学向量。假设第二拍的鼓点恰逢舞者落脚，将整段动作延后一拍便会让第三拍出现这次落脚。原配对与错位配对的曲风、速度、舞者都一样，ECL 需要给原配对更高的相似度。若舞者只是略晚于鼓点，Soft-DTW 可以在局部对齐时容许偏差。[输入表示][input] · [ECL][ecl] · [SRAL][sral]

换到生成阶段，同样的 4 秒音乐可直接送入训练好的音乐分支，随后由 EDGE 生成多帧的动作。听到第二拍重音有助于模型在附近安排动作，但该接口没有指定左脚还是右脚落地，也未规定落地帧。论文以整段的节拍对齐和足部接触指标衡量这个过程。[下游协议][protocol] · [指标说明][tasks]

### 训练与推理

论文给出的训练配置为 6 层 Transformer、512 隐藏维、8 个注意力头、128 维嵌入。作者在一张 A6000 上使用 AdamW，学习率 0.0002，batch size 64，对比温度 0.07，最多训练 100 轮并使用早停。输入的 128 个 mel 频带是按频率排列的观测量，输出的 128 维嵌入是学习到的坐标，两者物理含义不同。论文未给出实际早停轮次和用时。[原文 §3.1][setup]

图中所说的“动作监督训练音乐编码器”在这篇成立。MotionBeat 让读 log-mel 的音乐 Transformer 与动作 Transformer 一起学。Jukebox、CLAP、Wav2CLIP 和 wav2vec 2.0 出现在对比实验中，作者冻结这些基线的编码器。节拍预测、分类、检索分别接轻量预测头或投影头。舞蹈生成则统一采用 EDGE；正文没有详述各组如何适配逐拍特征的时间分辨率，以及 EDGE 是否为每种输入重新训练。[模型架构][arch] · [对照协议][protocol]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**生成与节拍追踪。** 前四列在舞蹈生成中评价足部接触的物理合理性（PFC）、动作在运动学与几何特征空间中的多样性（Dist-k、Dist-g）和音乐—动作节拍对齐（BAS）。最后一列是 GTZAN 上的音乐节拍追踪 F1。分数摘自原表 1。[原表 1][table1] · [指标说明][tasks]

| 音乐编码器 | PFC ↓ | Dist-k ↑ | Dist-g ↑ | BAS ↑ | Beat F1 ↑ |
| --- | ---: | ---: | ---: | ---: | ---: |
| wav2vec 2.0 | 1.698 | 8.21 | 5.56 | 0.23 | 0.845 |
| CLAP | 1.625 | 9.53 | 5.75 | 0.25 | 0.851 |
| Wav2CLIP | 1.602 | 10.65 | 6.39 | 0.24 | 0.848 |
| Jukebox | 1.598 | 10.75 | 7.03 | 0.24 | 0.865 |
| **MotionBeat** | **1.545** | **11.02** | **7.89** | **0.27** | **0.878** |

**双向检索。** 在 AIST++ 候选中，R@1 是正确配对排第一的比例，MedR 是正确配对的中位名次。MotionBeat 相对 Jukebox，音乐找舞蹈的 R@1 高 2.3 个百分点，舞蹈找音乐高 2.9 个百分点。绝对值均约 22%，即使模型在这几个编码器中排序最好，也还有大量查询未能排对第一名。[原表 2，节选][table2]

| 编码器 | 音乐找舞蹈 R@1 ↑ | 音乐找舞蹈 MedR ↓ | 舞蹈找音乐 R@1 ↑ | 舞蹈找音乐 MedR ↓ |
| --- | ---: | ---: | ---: | ---: |
| wav2vec 2.0 | 13.7% | 39 | 13.1% | 40 |
| CLAP | 15.6% | 36 | 15.2% | 37 |
| Wav2CLIP | 16.2% | 34 | 15.8% | 35 |
| Jukebox | 19.8% | 27 | 18.8% | 29 |
| **MotionBeat** | **22.1%** | **22** | **21.7%** | **23** |

### 消融实验

**去掉哪项训练目标？** 去掉 ECL，生成 BAS 从 0.27 降到 0.25。去掉 SRAL，BAS 降到 0.24，节拍追踪 F1 从 0.878 降到 0.835。后一个对照显示，知道整段舞与哪首歌配对之后，显式比较起音、接触和能量分布仍能提供额外信息。[原表 1 的消融行][table1]

| 训练目标 | PFC ↓ | BAS ↑ | Beat F1 ↑ |
| --- | ---: | ---: | ---: |
| 去掉 ECL | 1.588 | 0.25 | 0.858 |
| 去掉 SRAL | 1.590 | 0.24 | 0.835 |
| **两项都用** | **1.545** | **0.27** | **0.878** |

**改了哪部分注意力？** 小节相位旋转（BEP）单独使用时，音乐找舞蹈的 R@1 从 19.3% 升到 20.8%。动作端接触引导（CGA）单独使用时，节拍追踪 F1 从 0.852 升到 0.871。二者合用在此表的四项指标上都最好。这里的 PFC 按原表 3 保留两位小数。[原表 3][table3]

| 模型变体 | BAS ↑ | Beat F1 ↑ | PFC ↓ | 音乐找舞蹈 R@1 ↑ |
| --- | ---: | ---: | ---: | ---: |
| 两者均关闭 | 0.24 | 0.852 | 1.60 | 19.3% |
| 仅 BEP | 0.26 | 0.866 | 1.57 | 20.8% |
| 仅 CGA | 0.25 | 0.871 | 1.56 | 20.3% |
| **BEP + CGA** | **0.27** | **0.878** | **1.55** | **22.1%** |

### 关键发现

1. **动作提供的时间监督能反映在纯音频任务上。** 测试 GTZAN 的 Beat F1 只须读音乐。去掉结构节奏损失后，这个指标下降了 0.043，比仅看生成的舞是否自然更直接地检验了音乐表示。[表 1][table1]
2. **收益随任务变化。** 节拍追踪的 CML-t（要求连续跟对节拍层级）为 0.803，Jukebox 为 0.804。Emomusic 效价回归的 R² 按原表尺度分别为 61.2 与 61.5，而唤醒度分别为 73.8 与 72.1。舞者的运动强弱可能帮助判断音乐有多激动，但这组成绩不足以证明一切音乐属性都得到提升。[表 1][table1]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

这篇最值得借鉴的是负例的选择。把别首歌配给原舞蹈，模型可能靠辨认音色答对。把同一首歌和同一支舞错开一拍，靠音色答题的捷径就失效了。再结合“拿掉结构节奏损失，纯音频 Beat F1 下降”的结果，读者可以追踪动作信息通过什么目标进入音乐分支，以及最终在哪一种纯音乐任务上观察到影响。[ECL][ecl] · [表 1][table1]

小节相位也有明确的来源。它来自对音乐的速度和第一拍估计，再按一小节 B 拍计算，而训练数据另外提供舞者的身体运动。这个区分很重要：模型既使用了外部估计的时钟，也学到了身体对这个时钟的响应。要评价第二部分带来的增益，需要在同一节拍输入条件下读架构消融。[相位公式][phase] · [表 3][table3]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **拍内时间细节。** 音乐和动作都在每拍内进行平均。如果研究腕部击点比鼓点早多少毫秒，两个相差几十毫秒的变化可能进入同一个 token。检验这种能力需要帧级偏移实验，论文报告的错位负例是整整一拍。[输入定义][input] · [错位负例][ecl]
- **外推范围。** 配对监督来自 AIST++，数据集收录 10 种舞类。原表没有单列变拍号、自由速度或舞者刻意反拍的表现。将相位公式用到这些场景时，拍点和小节起点的估计也会成为误差来源。[AIST++][aist] · [实验设计][setup]
- **可复现范围。** 截至 2026 年 11 月 21 日，作者主仓库可见 README 和示意图片。公开材料足以核对训练输入、损失和表格，尚未给出可直接运行的训练脚本、权重或每条歌曲的数据划分。文中没有独立复现实验。[作者仓库快照][repo] · [训练描述][setup]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **EDGE。** EDGE 已经提供了由音乐特征生成连续姿态的扩散模型，原始音乐前端使用 Jukebox。MotionBeat 的贡献位于前端，它提出如何让听音乐的模型在训练时得到舞蹈反馈。比较两者时，要分别看上游表示和下游姿态生成器。[EDGE 项目][edge] · [MotionBeat 下游协议][protocol]
- **Danceba。** Danceba 为生成上下身动作码提取节奏线索，重点是生成过程怎样组织身体部位。MotionBeat 用动作监督训练可供不同任务使用的音乐编码器。要研究舞步踩点，可把“音频特征有没有时序信息”与“生成器有没有把它用到腿部”作为两项实验。[Danceba 站内解读](/blog/iccv2025-danceba/) · [MotionBeat 表 1][table1]
- **PhaseDance。** 如果关心“相位到底在哪个信号上”，这两篇可以对读。MotionBeat 以音乐小节为时钟并旋转注意力通道，PhaseDance 则把身体动作自身的周期结构用于舞蹈建模。相同的音乐拍号允许舞者用不同周期摆臂或换步，两种相位描述的对象有别。[PhaseDance 站内解读](/blog/neurips2026-phasedance/) · [MotionBeat 式 7][phase]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 会议报告、页码与出版条目。[ICASSP 日程][venue] · [IEEE DOI][doi]
- 正文架构、训练和全部三张实验表。[arXiv HTML][html] · [PDF][pdf] · [版本记录][record]
- 官方项目、仓库发布内容和数据集。[项目页][project] · [仓库快照][repo] · [AIST++][aist]

</div>

[html]: https://arxiv.org/html/2510.13244v2
[pdf]: https://arxiv.org/pdf/2510.13244v2
[record]: https://arxiv.org/abs/2510.13244
[venue]: https://cmsworkshops.com/ICASSP2026/view_paper.php?PaperNum=12624
[doi]: https://doi.org/10.1109/ICASSP55912.2026.11460499
[project]: https://motionbeat2025.github.io/
[repo]: https://github.com/wangxuanchen88/MotionBeat/tree/a9873742ca9b35d243bdc30114a1f57fac4f6185
[aist]: https://google.github.io/aistplusplus_dataset/
[edge]: https://edge-dance.github.io/
[intro]: https://arxiv.org/html/2510.13244v2#S1
[method]: https://arxiv.org/html/2510.13244v2#S2
[fig]: https://arxiv.org/html/2510.13244v2#S2.F1
[objectives]: https://arxiv.org/html/2510.13244v2#S2.SS1
[arch]: https://arxiv.org/html/2510.13244v2#S2.SS2
[input]: https://arxiv.org/html/2510.13244v2#S2.SS2.SSS1
[phase]: https://arxiv.org/html/2510.13244v2#S2.SS2.SSS2
[contact]: https://arxiv.org/html/2510.13244v2#S2.SS2.SSS3
[ecl]: https://arxiv.org/html/2510.13244v2#S2.SS1.SSS1
[sral]: https://arxiv.org/html/2510.13244v2#S2.SS1.SSS2
[setup]: https://arxiv.org/html/2510.13244v2#S3.SS1
[tasks]: https://arxiv.org/html/2510.13244v2#S3.SS2
[protocol]: https://arxiv.org/html/2510.13244v2#S3.SS3
[table1]: https://arxiv.org/html/2510.13244v2#S2.T1
[table2]: https://arxiv.org/html/2510.13244v2#S2.T2
[table3]: https://arxiv.org/html/2510.13244v2#S2.T3
