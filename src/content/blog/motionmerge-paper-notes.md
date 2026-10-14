---
title: "[arXiv2026] MotionMERGE：让动作语言模型学会局部编辑"
description: "从 VQ 动作编码、RAGS 多粒度监督和中间动作，理解 MotionMERGE 的局部编辑机制、数据构建、实验结果与控制边界。"
pubDate: "2026-10-13"
updatedDate: "2026-10-14"
badge: "Paper"
tags: ["MotionMERGE", "Motion-Editing", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**从“生成一个人在走路”，走向“修改这段动作里指定时刻的右手”。**

<details class="paper-meta"><summary>论文信息与阅读范围 · arXiv v1 / 2026.05</summary>

| 论文身份 | 信息 |
|---|---|
| 完整标题 | MotionMERGE: A Multi-granular Framework for Human Motion Editing, Reasoning, Generation, and Explanation |
| 作者 | Bizhu Wu、Jinheng Xie、Wenting Chen、Zhe Kong、Jianfeng Ren、Linlin Shen、Ruibin Bai、Rong Qu |
| 阅读版本 | arXiv:2605.18956v1，2026-05-18 提交；本篇核查于 2026-10-13 |
| 发表状态 | arXiv 预印本；正式录用出处尚未核实 |
| 研究任务 | 动作生成、动作描述、源动作编辑，以及带中间动作的分步生成/编辑 |
| 材料与实现 | 本次阅读正文及附录，检查官方仓库；未运行模型。官方仓库存在，关键代码、模型权重和 MotionFineEdit 数据尚待发布 |
| 入口 | [论文与版本](https://arxiv.org/abs/2605.18956) · [全文](https://arxiv.org/html/2605.18956v1) · [官方仓库](https://github.com/BizhuWu/MotionMERGE) |

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

**MotionMERGE 把已有动作和编辑要求交给一个经过训练的 T5 模型，让它生成新的动作 token；真正支撑细粒度编辑的是部位与时间监督、分步中间动作监督，以及配套的 MotionFineEdit 数据。**

对于编辑任务，**输入有源动作；输出是动作 token；局部控制主要学自数据和训练任务。** 这些 token 是学习得到的压缩编码，并没有天然的“左手”“第几个事件”语义。[原文 §III](https://arxiv.org/html/2605.18956v1#S3)

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**：文本驱动人体动作生成已经形成扩散模型和自回归动作语言模型等路线。后者通常先把连续动作压缩成离散 token，再用语言模型统一处理动作生成与描述；MotionGPT、MG-MotionLLM 等工作为文字与动作之间的转换提供了基础。

**现有痛点**：现有模型较擅长“一人边走边挥手”这样的整段语义，却不容易准确处理“取消 4.5–5.0 秒的右手运动，再在开头增加 1 秒静止”。这类要求同时涉及身体部位、时间区间、长度变化和多个操作的组合，整段动作描述无法提供足够细的监督。

**核心矛盾**：编辑指令要求在局部时空范围内控制动作，常见训练数据却主要对齐整段动作与整体描述。即使加入细节文字，也会出现超过 1,000 个文字 token 对应不足 50 个动作 token 的长度差异，模型难以直接学清每个部位、每个片段的对应关系。

**本文目标**：建立统一的多粒度动作语言框架，使模型能够根据源动作和文字要求进行局部、时间及复合编辑，并支持动作生成、描述和带中间动作的分步输出。

**切入角度**：在固定的 VQ 动作编码和 T5 骨干之上设计训练任务与编辑数据。利用 MotionFineEdit 等数据，通过 RAGS 预训练学习时间定位、局部对齐、动作连贯性及分步动作对应，再进行任务特定的指令微调。

**核心 idea**：将“理解整段动作”拆成可监督的局部与分步任务，让模型同时看到源动作、编辑要求和修改后的动作状态；推理时直接预测目标动作 token，再解码为连续动作。[原文 §I–III](https://arxiv.org/html/2605.18956v1#S1)

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 先看整条链路

对于编辑任务，核心流程可以写成：

<div class="pipeline" role="img" aria-label="源动作经过冻结的动作编码器得到动作token，与编辑指令一起输入T5，输出目标动作token，再经冻结的解码器还原连续动作">
<div><b>源动作</b><span>连续运动序列</span></div><i>→</i><div><b>VQ 编码器</b><span>动作压缩为 token</span></div><i>→</i><div class="accent"><b>T5 + 编辑指令</b><span>预测目标动作 token</span></div><i>→</i><div><b>VQ 解码器</b><span>还原连续动作</span></div>
</div>

这是讲解用简图。T5 的输入同时包含任务提示、源动作 token 和编辑文字；输出 token 经过码本与解码器才变成可播放的动作。论文使用 HumanML3D 的 **263 维逐帧表示**。263 是动作特征维度，不是关节数。[原文 §III-A、§V-A](https://arxiv.org/html/2605.18956v1#S3.SS1)

![论文图2：VQ-VAE 与 T5 的统一动作语言框架](/paper-notes/motionmerge/paper_overview.png)

*读图提示：左边负责连续动作与离散编码的往返；中间 T5 同时处理文字和动作编码；右边展示以自然语言组织的细节说明。来源：Wu 等，MotionMERGE 图 2，CC BY 4.0。*

任务切换主要靠提示与输入输出安排：文字进、动作 token 出，是生成；动作 token 进、文字出，是描述；源动作 token 与修改要求一起进、目标 token 出，是编辑。论文先进行统一预训练，再做任务特定的指令微调；因此“统一框架”不应自动理解为所有成绩都由一份未经任务适配的权重得到。[原文 §III-A/C](https://arxiv.org/html/2605.18956v1#S3.SS3)

### 关键设计

1. **VQ-VAE：把连续动作压缩为离散 token**

    - **时间压缩**：直接逐帧预测 263 维动作特征会产生很长的序列。作者采用 T2M-GPT 路线的动作 VQ-VAE，先用编码器压缩时间序列，得到特征序列。
    - **码本量化**：每个压缩特征选择码本中距离最近的条目，用该条目编号作为动作 token。对应论文公式 1：

    <div class="equation">c<sub>t</sub> = arg min<sub>i</sub> ‖z<sub>t</sub> − b<sub>i</sub>‖²</div>

    其中，**zₜ** 是压缩后第 t 个位置的特征，**bᵢ** 是码本中第 i 个向量，**cₜ** 是选中的条目编号；t 不一定对应原始动作的第 t 帧。

    - **预测与还原**：T5 预测目标 token，码本把编号映射回向量，解码器再恢复连续动作。VQ 编码器和解码器训练完成后冻结，后续语言模型在固定词汇上学习。
    - **表示特点**：token 是学习得到的整体动作编码，可能同时涉及多个身体部位；本文没有为每个关节设置独立、语义可解释的码本。[原文 §III-A/B，公式 1–3](https://arxiv.org/html/2605.18956v1#S3.SS2)

2. **RAGS：通过多粒度任务学习时间和局部对应**

    - **统一输入输出**：T5 的词表包含普通文字、动作 token 和特殊标记。细节描述按 **10 帧片段**组织，`<SEP>` 分隔片段，`<Motionless>` 表示没有显著部位运动的片段。
    - **时间感知任务**：根据指定时间找出相应动作或细节片段，建立时间表达与序列位置的联系。
    - **局部对齐任务**：在部分细节文字与局部动作之间转换，降低长描述与短动作编码直接对齐的困难。
    - **动作连贯任务**：给定少量动作 token，结合文字补齐其余部分，学习动作片段之间的依赖关系。
    - **分步动作监督**：将每个编辑步骤与对应的中间动作配对，使步骤说明与动作状态共同出现。

    上述任务在粗、细粒度动作文字配对之外提供辅助监督，仍以 token 交叉熵训练。默认权重下，论文公式 5 可写为：

    <div class="equation">L<sub>RAGS</sub> = L<sub>gran</sub> + 2L<sub>temp</sub> + 2L<sub>local</sub> + L<sub>coh</sub> + 0.2L<sub>cot</sub></div>

    **Lgran** 对应粗细粒度配对，**Ltemp / Llocal / Lcoh / Lcot** 分别对应时间、局部、连贯与分步监督。附录共列出 **31 个任务：13 个粗粒度、18 个细粒度**；这里的损失是训练任务的加权组合。[原文 §III-C/D、§V-A、附录 D](https://arxiv.org/html/2605.18956v1#S3.SS4)

3. **Motion-grounded CoT：让每个编辑步骤都有中间动作**

    - **共享起点**：从两条已验证的编辑对 **A→B** 和 **A→C** 出发，利用它们共享的源动作 A 构造分步样本。
    - **组合路径**：将第一条操作取逆，再接第二条操作，得到 **B→A→C**。中间状态 A 已经存在，可以直接作为中间动作监督。
    - **联合输出**：模型学习依次输出步骤说明与相应动作 token，而不是只生成“先取消挥手，再增加停顿”的文字说明。
    - **推理方式**：运行时仍由 T5 预测文字和动作 token。数据构造中的原子操作用于提供监督，不代表模型必然调用外部剪辑 API。[原文 §IV-C，公式 7–9](https://arxiv.org/html/2605.18956v1#S4.SS3)

### 一个完整例子：先取消右手运动，再增加开头停顿

下面沿用论文图 6 的复合编辑要求进行讲解；步骤和时间轴是教学示意，并非一次实际运行的日志。

**输入。** 已有一段动作 M₀，要求取消原动作 4.5–5.0 秒的右手运动，然后在动作开头增加 1 秒静止。源动作先编码为 token，文字指令与这些 token 一起进入 T5。

**第一步。** 分步输出可以先生成中间动作 M₁，表达右手局部修改后的状态。要取消的是特定时段的运动，不能粗暴解释成把整条手臂所有关节坐标设为零；其他身体运动仍应协调。

**第二步。** 在 M₁ 的开头增加静止阶段，得到目标 M₂。按这个操作顺序理解，原来的 4.5–5.0 秒内容会移动到新序列的 5.5–6.0 秒。因此多步编辑除了识别时间数字，还必须追踪前序修改对后续时间轴的影响。

**最后。** 目标 token 被解码为连续动作。读取结果时，应该同时检查新增停顿、右手变化、其余动作和过渡。上述流程解释了模型需要完成什么；是否逐项完成，要看输出检查，不能由步骤文字本身确认。

把这个例子放回模型接口，可读成下面的示意。占位符只说明信息流，不是官方提示模板，也不是实际 token 编号：

```text
输入：编辑要求 + [源动作 M₀ 的 token]
分步输出：第一步说明 + [中间动作 M₁ 的 token]
          第二步说明 + [目标动作 M₂ 的 token]
解码：[目标动作 M₂ 的 token] → 连续动作
```

模型输出“步骤说明”的同时，还必须预测表示相应动作状态的 token。后者决定解码出的运动，单靠文字说明并不能完成编辑。

<section class="explorer" aria-labelledby="example-title"><h4 id="example-title">看懂两步修改后的时间轴</h4><p class="caption">教学示意 · 只展示指令与时间坐标，色块不是模型生成的三维动作</p><div class="steps" role="group" aria-label="编辑步骤"><button aria-pressed="true" data-step="0">源动作</button><button aria-pressed="false" data-step="1">① 取消局部运动</button><button aria-pressed="false" data-step="2">② 开头增加静止</button></div><p class="time-note" aria-live="polite"></p><div class="lane-label">动作时间轴（截取原动作前 6 秒用于示意）</div><div class="track" id="motion-track"></div><div class="axis" id="time-axis"></div><div class="lane-label">右手编辑要求所在区间</div><div class="track" id="hand-track"></div><div class="legend"><b><i style="background:#edc898"></i>源动作待改区间</b><b><i style="background:#d5e5c4"></i>要求取消运动的区间</b><b><i style="background:#acd6d3"></i>新增静止</b></div></section>

![论文图4：空间、时间及复合编辑的数据示例](/paper-notes/motionmerge/paper_examples.png)

*图 4 上半部展示原子修改，下半部展示带中间动作的复合修改。先对照文字里的部位和时段，再看目标动作相对源动作改变在哪里。来源：Wu 等，MotionMERGE 图 4，CC BY 4.0。*

### MotionFineEdit：大量编辑监督从哪里来

关键困难是：很难采集大量只在一个局部发生差异的真人动作对。作者用经过微调的 **MG-MotionLLM 细粒度生成器**来制造候选数据：保持粗动作描述一致，只改细节描述中的部位或时间，再分别生成源动作与目标动作。[原文 §IV-A](https://arxiv.org/html/2605.18956v1#S4.SS1)

候选操作共 **11 种**：9 种时间操作是开头、中间、结尾三个位置与填充静止、重复、删除三类修改的组合；另有 2 种空间操作，添加或删除部位运动。合成器重新生成目标动作时，也可能意外改动其他部分，因此作者再加自动筛选与人工核验。最后组合多步编辑，并使用 Gemini 改写指令以扩展表达方式。[原文 §IV、附录 A](https://arxiv.org/html/2605.18956v1#S4)

![论文图3：MotionFineEdit 数据构建流程](/paper-notes/motionmerge/paper_dataset.png)

*图 3 的关键顺序是生成候选 → 质量筛选 → 组合与语言改写。Gemini 位于数据扩充环节，不能因此把它说成 MotionMERGE 编辑推理时调用的模型。来源：Wu 等，MotionMERGE 图 3，CC BY 4.0。*

| 数据口径 | 原子编辑 | 复杂编辑 | 合计 |
|---|---:|---:|---:|
| 动作对条目数 | 9,732 | 25,271 | **35,003** |
| 含不同指令表述的三元组数 | 837,224 | 143,938 | **981,162** |

同一对动作会对应许多不同措辞，所以“约 98 万三元组”不能理解为约 98 万对独立动作，更不能理解为约 98 万次真人采集。复杂动作对也来自原子编辑组合。这个区别决定了如何判断数据规模与多样性。[原文表 II、XII、XIII](https://arxiv.org/html/2605.18956v1#S4.T2)

### 哪些要训练，哪些被冻结

| 部件 | 作用与训练分工 |
|---|---|
| 动作 VQ-VAE | 采用 T2M-GPT 路线；训练动作离散表示后冻结，供语言模型编码和解码使用 |
| 数据生成器 | 从 MG-MotionLLM 预训练模型微调，生成编辑数据；与最终编辑器的用途分开 |
| T5 动作语言模型 | 从语言预训练骨干出发，进行 RAGS，再进行任务特定的指令微调 |
| Gemini | 改写编辑指令，扩展训练数据中的语言表达 |

默认模型是 **T5-Base，220M 参数**。RAGS 为 **500K 迭代**；通用指令微调表列出 300K，但附录特别说明：**动作编辑任务实际设为 100K 迭代**。论文报告训练使用单张 A100 80GB，没有给出足以核算完整训练与数据生产成本的时长、吞吐和人工总成本。[原文 §V-A、附录 B / 表 XIV](https://arxiv.org/html/2605.18956v1#A2)

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

论文在 MotionFix 上评估整段动作编辑，在 MotionFineEdit 上评估原子与复杂编辑，并用 HumanML3D 检验文本生成动作能力。以下均为作者报告的结果。

指标简注：编辑表中 R@K 为目标动作进入检索前 K 名的比例（%），不是严格指令成功率；AvgR 为平均检索排名，越低越好。局部评估以 10 帧为一个片段。生成任务中 R-Precision 衡量文本与动作的匹配，FID 衡量生成与真实动作的特征分布差异。

**整段动作编辑：MotionFix。**

| 方法 | R@1 ↑ | R@2 ↑ | R@3 ↑ | AvgR ↓ |
|---|---:|---:|---:|---:|
| Real | 100.0 | 100.0 | 100.0 | 1.00 |
| TMED† | 35.16 | 51.43 | 60.81 | 5.11 |
| MotionLab | 56.34 | 70.40 | 77.24 | 3.54 |
| **MotionMERGE** | **58.15** | **73.55** | **80.77** | **2.85** |

*来源：[原文表 III](https://arxiv.org/html/2605.18956v1#S5.T3)，五次运行均值。† 表示按 HumanML3D 表示重新实现。扩散编辑基线额外接收目标长度，MotionMERGE 自回归生成至停止条件。*

**细粒度动作编辑：MotionFineEdit。**

| 编辑类型 | 方法 | 整段 R@1 ↑ | 整段 R@3 ↑ | 整段 AvgR ↓ | 局部 R@1 ↑ | 局部 R@3 ↑ | 局部 AvgR ↓ |
|---|---|---:|---:|---:|---:|---:|---:|
| 原子 | TMED† | 9.32 | 22.50 | 11.42 | 7.16 | 17.56 | 11.72 |
| 原子 | MotionLab | 6.80 | 19.90 | 12.61 | 6.33 | 16.24 | 13.97 |
| 原子 | **MotionMERGE** | **79.84** | **93.84** | **1.56** | **41.81** | **52.03** | **6.63** |
| 复杂 | TMED† | 6.13 | 14.15 | 15.31 | 4.11 | 11.31 | 14.55 |
| 复杂 | MotionLab | 2.42 | 9.56 | 15.02 | 2.79 | 9.17 | 15.61 |
| 复杂 | **MotionMERGE** | **20.85** | **35.30** | **9.12** | **11.39** | **25.98** | **10.44** |

*来源：[原文表 IV，节选](https://arxiv.org/html/2605.18956v1#S5.T4)，省略 Real 参照行及 R@2 列。原子编辑对应单个操作，复杂编辑由多个操作组合。*

**文本生成动作：HumanML3D。**

| 模型类别 | 方法 | R-Precision Top-3 ↑ | FID ↓ | MM-Dist ↓ |
|---|---|---:|---:|---:|
| 专用生成 | MoMask | 0.807±.002 | 0.045±.002 | 2.958±.008 |
| 专用生成 | LaMP-T2M | **0.843±.001** | **0.032±.002** | **2.759±.007** |
| 统一模型 | MotionGPT | 0.778±.002 | 0.232±.008 | 3.096±.008 |
| 统一模型 | MG-MotionLLM | 0.802±.003 | 0.303±.010 | 2.952±.009 |
| 统一模型 | MotionLab | 0.810 | 0.167 | 2.830 |
| 统一模型 | **MotionMERGE** | 0.826±.002 | 0.233±.005 | 2.818±.006 |

*来源：[原文表 VII，节选](https://arxiv.org/html/2605.18956v1#S5.T7)。± 为二十次重复的 95% 置信区间，MotionLab 原表未列区间。MM-Dist 为匹配文本与动作的特征距离，越低越好。*

### 消融实验

**训练策略**：比较直接指令微调、仅粗粒度、仅细粒度、粗细联合预训练，以及联合预训练后再微调。直接微调 → 粗细联合预训练 → 再加任务微调时，MotionFix R@3 为 **73.95 → 74.62 → 80.77**，原子局部 AvgR 为 **7.42 → 6.65 → 6.63**，生成 FID 为 **0.485 → 0.331 → 0.233**。联合预训练与最终任务微调带来改善。[原文表 IX](https://arxiv.org/html/2605.18956v1#S5.T9)

**时间感知任务**：从完整的 **31 个任务**（13 个粗粒度、18 个细粒度）中移除时间相关任务，仅保留 14 个非时间任务。细粒度生成 Top-3 从 **52.38 降至 48.463**，详细动作描述 BLEU@4 从 **46.43 降至 41.75**，说明时间监督有助于上述任务。[原文图 9](https://arxiv.org/html/2605.18956v1#S5.F9)、[附录 D](https://arxiv.org/html/2605.18956v1#A4)

**CoT 分步输出**：在不同训练状态下比较直接输出与分步输出。加入 CoT 后，RAGS 预训练模型的复杂编辑 AvgR 从 **12.170 降至 9.242**，完整模型从 **9.911 降至 9.126**；直接指令微调模型则从 **10.779 升至 10.990**。分步输出的收益取决于训练基础。[原文图 10](https://arxiv.org/html/2605.18956v1#S5.F10)

**模型尺寸**：比较 T5-Small、Base、Large（60M、220M、770M）。生成 FID 分别为 **0.352、0.233、0.339**，原子局部 AvgR 分别为 **7.19、6.63、6.70**，Base 最好；详细描述 BLEU@4 则分别为 **46.72、47.69、49.40**，Large 最好。论文默认采用 Base。[原文表 X](https://arxiv.org/html/2605.18956v1#S5.T10)

### 关键发现

1. **细粒度编辑提升突出**：MotionFix R@1 比 MotionLab 高 **1.81 个百分点**；原子局部 R@1 比 TMED 高 **34.65 个百分点**，局部训练与编辑数据体现出更明显的优势。
2. **复杂组合仍有难度**：MotionMERGE 原子局部 R@1 为 **41.81%**，复杂局部 R@1 为 **11.39%**；多个时间与部位操作组合后，任务明显更难。
3. **统一能力存在性能取舍**：在列出的统一模型中，MotionMERGE 的生成 Top-3 和 MM-Dist 最好，但 FID 不及 MotionLab；专用模型 LaMP-T2M 在这三项生成指标上仍领先。

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

**第一，细粒度控制需要合适的监督结构。** 这里并没有一个全新的庞大动作架构：重要工作是让固定动作词汇、细节文字、局部任务和多步监督配合起来。我的理解是，与其先问“要不要换更大的 LLM”，更应该先问模型是否见过能教会它定位与保持的训练例子。

**第二，中间动作比只有文字的步骤更容易核查。** B→A→C 的构造方式让每一步都有已有动作状态支撑，为分步编辑提供了可监督对象。它可以启发中间结果的评测，但还不能代替真实输出的几何与语义验收。

**第三，局部评测能揭开整段分数遮住的问题。** 原子编辑的整段与局部成绩落差，是这篇最值得带走的实验信息之一。要做局部动作编辑，就应该把“改对了哪里”和“误改了哪里”单独观察。

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

**局部可控不等于硬保持。** 输出整体经过 VQ 解码，论文没有给出对任意未编辑关节、root 轨迹、速度连续性或接触状态的逐帧保证。对于“只改右手，其余严格不动”的任务，需要增加源目标对齐后的误差检查，必要时引入有明确保持规则的执行器。

**对推理的证据仍以任务结果和示例为主。** 作者在结论中把“procedural correctness 的专门度量”列为后续方向；零样本应用示例不等于经过广泛测试的通用动作规划器。[原文 §V-E、§VI](https://arxiv.org/html/2605.18956v1#S6)

**合成数据的多样性有上游边界。** MotionFineEdit 由特定生成器、操作集合与指令改写产生。是否能泛化到真实动作噪声、未见风格、更多接触动作和不同骨架，还需要在相应输入上验证。

**目前复现准备不足。** 官方仓库虽已建立，但关键实现、模型权重和新数据仍待发布，现阶段更适合研究任务设计与训练思路。[官方仓库](https://github.com/BizhuWu/MotionMERGE)

<details><summary>展开发表与发布状态的核查依据</summary><p>2026-10-13 检查的官方仓库提交为 <code>00eeb12</code>，可见 README 与图像资源。三种 RAGS 模型下载仍为 “coming soon”，数据下载/准备说明尚待发布，RAGS 预训练与动作编辑训练/评测仍在待办列表中。前作 MG-MotionLLM 的实现不能当作本篇完整实现。arXiv 当前只有 v1；PDF 的 TPAMI 页眉不能证明已获期刊录用，因此此处不标正式期刊或 CCF 等级。</p><p><a href="https://github.com/BizhuWu/MotionMERGE/tree/00eeb12ddeeabab062045755962cdc8231237cb0">查看所核仓库版本</a></p></details>

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **[MG-MotionLLM](https://github.com/BizhuWu/MG-MotionLLM)**：本文前作，提供粗细粒度动作生成与理解的基础，也是 MotionFineEdit 数据生成器的起点。MotionMERGE 在此基础上增加编辑任务、RAGS 预训练和带中间动作的复合编辑监督。
- **[MotionFix](https://arxiv.org/abs/2408.00712)**：以“源动作—文字修改要求—目标动作”三元组研究文本驱动动作编辑。MotionMERGE 在这一任务形式上进一步强调身体部位、时间区间、动作长度变化与多个操作的组合。
- **[LaMoGen](https://arxiv.org/abs/2603.11605)**：通过可解释的 LabanLite 概念表示组织动作生成，由 LLM 操作符号概念。MotionMERGE 则训练 T5 直接预测学习得到的动作 token，其细粒度控制主要来自训练任务和编辑数据。
- **启发**：对于需要局部控制的序列生成任务，可以将整段配对监督进一步拆成时间定位、局部对应和带中间状态的分步监督。这种训练设计为文本驱动动作编辑提供了可借鉴的思路；若目标是严格保持未编辑区域，还需要相应的保持机制与输出评测。

<span id="reading-8" class="reading-anchor"></span>

## 来源

- Wu 等，[MotionMERGE arXiv v1 正文及附录](https://arxiv.org/html/2605.18956v1)，2026-05-18；[PDF](https://arxiv.org/pdf/2605.18956v1)。文中实验数字均为作者报告，非本次复现结果。
- [MotionMERGE 官方仓库](https://github.com/BizhuWu/MotionMERGE)，发布状态检查于 2026-10-13。
- 形式参考：[Paper-Notes 的 LaMoGen 解读](https://papernotes.org/CVPR2026/human_understanding/lamogen_language_to_motion_generation_through_llm-guided_symbolic_inference/)与 [Paper-Notes 源仓库](https://github.com/zhaoyang97/Paper-Notes)。本篇机制解释与判断为重新核对后的原创写作。
- 原论文图 2、3、4 按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 转载，仅作页面显示缩放；原创流程和时间轴标为教学示意。笔记更新：2026-10-14（按 Paper-Notes 结构修订）。

</div>

<script src="/paper-notes/motionmerge-timeline.js" defer></script>
