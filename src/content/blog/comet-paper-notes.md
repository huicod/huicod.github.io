---
title: "[WACV2026] COMET：让角色连续伸手够三个目标，怎样走到第三个还不失稳？"
description: "从骨盆、头、双腕和双踝选出控制点，逐帧生成全身姿态。结合连续触点、动作补间和风格替换，拆解关节目标与参考姿态各自起什么作用。"
pubDate: "2026-11-26T21:30:00+08:00"
badge: "Paper"
tags: ["COMET", "WACV 2026", "Controllable Long-term Motion Generation with Extended Joint Targets", "关节目标", "长时动作生成", "动作补间", "风格迁移", "条件 VAE", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[arXiv HTML 正文][html] · [WACV 终稿 PDF][pdf] · [补充材料 PDF][supp] · [作者演示][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · WACV 2026</summary>

*Controllable Long-term Motion Generation with Extended Joint Targets*。作者为 Eunjong Lee、Eunhee Kim、Sanghoon Hong、Eunho Jung 和 Jihoon Kim，来自 Cinamon Inc.。2025 年 12 月公开 arXiv v1，正式发表于 WACV 2026，第 5164–5173 页。本文对照会议终稿、补充材料、作者演示和公开实现。实验数值为作者报告，本次未运行模型。[会议记录][cvf] · [版本记录][abs] · [代码快照][repo]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给角色一连串三维目标，让右手腕依次够到它们。COMET 用条件 VAE 每次预测一帧全身动作，走远路时用参考姿态小幅纠正累积偏差，接近目标后给末端动作留出调整空间。在三段各 5 米的测试里，它在第三段达到目标的比例为 **86.27%**，对照方法 WANDR 为 **20.96%**。[原文图 2][fig2] · [原表 3][t3] · [补充 D.3][s3]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　游戏和交互动画中，用户常给出的是“手要到哪儿、身体朝哪边”。WANDR 已能把右腕目标变成逐帧引导信号，让角色自行走近再伸手。扩散式动作补间则可根据指定关键帧填充整段动作。[相关工作][related] · [WANDR][wandr]

**现有痛点**　只控制右腕很难指定双手要分开多远、头要低到哪里。连续换目标还会放大另一个问题：模型把自己刚刚生成的姿态当作下一步输入，早期的小偏差会在多段行走中积累。原文图 5 展示了关闭反馈时逐渐倾斜、失稳的例子。[图 4][fig4] · [图 5][fig5]

**核心矛盾**　远离目标时，把姿态轻轻拉回常见步态有助于走稳。到了目标跟前，弯腰或伸手恰好需要偏离普通走姿。同一条姿态修正规则若一直开着，就会和到达目标的动作互相牵制。[§3.3][rgf] · [补充 C.3][s3]

**本文目标**　让一个模型处理六个预设关节的不同组合，在角色持续运动时接受新目标，并将同一生成过程用于首尾姿态之间的补间和带有参考风格的行走。[任务定义][intro] · [作者项目][project]

**切入角度**　把两类信息放到不同的位置。目标要随人与目的地的相对位置不断重算，适合在预测每帧前输入；判断新姿态是否偏离参考动作，则要在得到候选姿态后进行。[图 2][fig2] · [补充算法 1][s2]

**核心 idea**　用掩码指定这一次听哪些关节，以当前位置、剩余时间和朝向构成条件，预测下一帧的姿态增量；再用参考动作拟合的高斯混合模型（GMM）小幅修正姿态，把修正后的状态交还给下一步。替换 GMM，就能改变沿途的姿态风格。[§3.2][control] · [§3.3–3.4][rgf]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

动画师提供初始姿态、选中的关节、世界坐标目标、目标时刻，以及相应的朝向条件。COMET 每帧先重算各关节还差多少路，再让解码器生成整个身体的下一步变化。另一条路径从动作示例中提取姿态分布，决定这一步要不要修正。输出保留 SMPL-X 的骨盆平移、根朝向及身体关节旋转，可以计算每帧手腕、脚踝等在世界中的位置。[图 2][fig2] · [姿态表示][repr] · [参考反馈][rgf]

<figure class="reading-figure"><a href="/paper-notes/comet/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/comet/architecture.svg" alt="COMET 的训练与逐帧生成流程。上方用动作示例训练条件 VAE，并单独拟合参考姿态 GMM。中间把当前姿态、活动关节目标和剩余时间送入解码器。下方按目标距离对候选姿态施加反馈，修正结果成为下一帧的输入。" /></a><figcaption>根据原文图 2、式 3–12 和补充算法 1 重绘。上半部的虚线指向训练后复用的解码器与姿态分布；沿下半部实线走一遍，就是从一帧生成下一帧。点击可放大。</figcaption></figure>

### 关键设计

1. **把目标写成每帧都能更新的三个条件。** 对选中的关节，计算“目标位置减当前关节位置”，再除以剩余帧数。若手腕离目标还有 30 厘米、剩 10 帧，这项输入相当于每帧 3 厘米的位移需求；实际手腕路径和速度由模型决定。另有两个整体条件：骨盆向活动目标的平均水平位置靠近，身体朝向向指定方向转动。即使只控制手腕，模型也能利用这两项判断是否应该先迈步。[式 3–7][intent]

2. **一次选择哪些关节，不必另训一个网络。** 公开模型定义了六个控制槽位：骨盆、头、左腕、右腕、左踝、右踝。训练中每段序列抽取一个活动子集；不用的关节目标 token 在注意力中被遮住，整体位置和朝向条件始终有效。模型仍输出全身姿态，未指定的膝、肘等部位可协同动作。论文所称的任意组合限于这六处。[关节掩码][mask] · [官方输入示例][demo]

3. **一次随机采样，得到下一帧的全身增量。** 训练时，编码器读取姿态、增量与目标条件，输出 64 维潜变量的后验分布。推理时从标准高斯采样，把潜变量、当前姿态与目标条件交给 Transformer 解码器，预测骨盆平移、根朝向和身体关节旋转的变化。在当前状态上应用增量，即得到下一帧候选。公开方法没有在这一步调用逐目标的逆运动学求解器。[生成模型][cvae] · [补充算法 1][s2]

4. **参考反馈修正姿态，同时保留行进方向。** 用参考动作的逐帧特征拟合 GMM。公开代码读取去掉水平朝向后的根旋转、骨盆高度和身体关节旋转，按考虑各分量协方差的马氏距离选出最接近的分量均值。基准设置在远处将候选特征朝该均值推 1%，保留角色的水平位移。靠近目标后普通到达任务关闭参考修正，下一帧读取修正后的状态。若要复现切换时刻，补充算法 1 用骨盆到目标中心的水平距离判断 1 米阈值；公开实现用于切换的距离取三维坐标差的范数。[式 12 与图 3][rgf] · [补充算法 1][s2] · [距离计算][gate] · [实现中的修正][correct]

5. **换反馈参考，得到补间或风格。** 在补间配置中，角色有已知起始和结束姿态。公开实现同时载入常规步态分布和最终姿态，靠近终点时改用最终姿态作参考，反馈强度取 0.05。风格任务则从有特定姿态特征的示例另拟合 GMM，例如用张开双臂走路的样本得到“飞机”风格。主生成器继续复用；新风格的准备工作是拟合参考分布。[风格机制][style] · [补间配置][mibcode] · [图 7 的行走对照][fig7]

### 一个完整例子

作者发布的位置控制演示里，有一段同时要求右踝与右腕到达不同高度。下面的坐标和时长来自同一段配置，具体动作轨迹由模型采样。[官方演示输入][demo]

| 步骤 | 这一段具体发生什么 |
|---|---|
| 接收目标 | 该段时长 3 秒，右踝目标约为（−5.18，2.03，0.08）米，右腕约为（−5.19，2.29，1.28）米，同时给定身体朝向。 |
| 组织条件 | 激活右踝、右腕两个控制槽。根据它们各自的位置误差和剩余帧数计算引导；两个目标的平均水平位置为骨盆提供行进方向。 |
| 迈出下一步 | 解码器采样并生成整个身体的下一帧。离目标还远时，参考反馈微调骨盆高度和关节姿态，修正后的身体再用于重算两处误差。 |
| 读出结果 | 得到连续的全身姿态。可以单独检查脚踝与手腕的最近距离，也可以另查两者是否在同一帧命中。论文的多关节平均成功率只回答前一种问题。 |

### 训练与推理

AMASS 提供多样的行走和身体动作，作者抽取未来帧的真实关节位置来造目标；CIRCLE 提供带起始和目标标注的全身伸手动作。动作统一到 SMPL-X、30 FPS、8 秒窗口。损失包括姿态增量重建误差、潜变量 KL 正则，以及下一帧受控关节世界坐标的均方误差。训练时逐渐提高使用模型自身预测作为输入的步数，到第 50 轮最多连续使用 10 步。补充材料报告 4 张 A6000、约 36 小时、1,800 轮、批量 512；基准 GMM 从训练集行走动作另行拟合，50 个分量，通常不到 1 分钟。[损失函数][loss] · [补充 A–C][supp]

官方仓库提供训练、目标控制、补间、风格演示和评估入口，v1.0.1 发布了预训练权重。推理另需下载 SMPL-X 身体模型。文章中的实现说明来自代码核查，演示成绩取自论文。[代码与资源说明][repo] · [权重发布页][weights]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**连续三个目标。** 原表 3 要求右腕依次接近三个高度均为 1 米的目标。每段路程 5 米、运行 8 秒，共 24 秒；6 个初始姿态，每段选 5 个方向，共 750 条路径，每条采样 5 次。SR 统计手腕是否曾在该段进入目标 10 厘米内，DTG 取该段最小距离，FS 衡量脚滑。[原表 3][t3] · [补充 D.3][s3] · [公开评测器][metrics]

| 目标 | 方法 | SR ↑ | DTG（厘米）↓ | FS ↓ |
|---|---|---:|---:|---:|
| 第一处 | WANDR | 56.16% | 23.56 | 16.57% |
| 第一处 | COMET | 91.55% | 7.22 | 15.29% |
| 第二处 | WANDR | 37.33% | 51.51 | 28.18% |
| 第二处 | COMET | 86.69% | 14.54 | 18.25% |
| 第三处 | WANDR | 20.96% | 99.07 | 39.96% |
| 第三处 | COMET | 86.27% | 13.62 | 20.18% |

**同时指定多个部位。** 原表 2 从测试集姿态构造可实现的目标组合，并给定最终朝向。每个规模枚举活动关节组合，先按关节计算指标再平均。表中“单关节”包含各个槽位，和后面的“只测右腕”是不同协议。[原表 2][t2] · [补充 D.2][s3]

| 活动关节数 | 平均 SR ↑ | 平均 DTG（厘米）↓ | FS ↓ |
|---:|---:|---:|---:|
| 1 | 71.62% | 16.32 | 13.70% |
| 2 | 70.41% | 11.67 | 14.94% |
| 3 | 71.16% | 9.81 | 15.04% |
| 4 | 69.42% | 9.79 | 15.36% |
| 5 | 68.75% | 9.40 | 15.48% |
| 6 | 68.87% | 9.08 | 15.32% |

**关键帧补间。** 原表 4 比较给定首尾姿态后生成的中间动作。作者在相同 AMASS、CIRCLE 数据上重新实现并训练 CondMDI 和 DNO；DNO 两行的步数为测试时优化次数。L2P、L2Q 分别是全局位置和四元数误差，NPSS 比较频谱，FS 衡量脚滑。[原表 4][t4] · [补充 D.4][s3]

| 方法 | L2P ↓ | L2Q ↓ | NPSS ↓ | FS ↓ |
|---|---:|---:|---:|---:|
| CondMDI | 3.396 | 2.148 | 8.991 | 0.255 |
| DNO-MDM，100 步 | 4.278 | 2.526 | 11.072 | 0.337 |
| DNO-MDM，300 步 | 3.503 | 2.255 | 10.420 | 0.416 |
| COMET | **3.323** | **2.126** | **8.650** | **0.166** |

**生成速度和风格。** 补充表 3 中，生成 150 帧时 WANDR 为 2.42 ± 0.18 秒，COMET 为 3.20 ± 0.23 秒；150 帧在 30 FPS 对应 5 秒播放时间。风格部分另请 30 名动作领域从业者比较相同风格输入的结果。图 8(b) 中 COMET 获 75.5% 偏好，SMooDi 获 10.6%，13.9% 选择不确定。[补充 E–F][s5] · [原图 8][fig8]

### 消融实验

原表 1 固定为单右腕，在圆柱区域采样目标，3,750 次测试，每次 8 秒。JA 为关节级注意力，RGF 为参考反馈。[原表 1][t1] · [补充 D.1][s3]

| 模型 | SR ↑ | FS ↓ | DTG（厘米）↓ |
|---|---:|---:|---:|
| WANDR | 32.0% | 16.0% | 24.8 |
| WANDR 加 RGF | 49.5% | **8.9%** | 21.7 |
| COMET 去掉 JA | 8.0% | 9.0% | 107.2 |
| COMET 去掉 RGF | 31.5% | 19.0% | 59.3 |
| 完整 COMET | **52.7%** | 14.0% | **20.3** |

- **删掉关节级注意力。** 保留参考反馈、仅用条件向量标记控制关节，右腕成功率从 52.7% 降至 8.0%；这时脚滑反倒更少，说明“站得稳”和“走过去够到目标”需要分开测。[原表 1][t1]
- **删掉或移植参考反馈。** COMET 去掉 RGF 后右腕最近距离从 20.3 厘米恶化至 59.3 厘米；给既有 WANDR 加上 RGF 后，成功率从 32.0% 提高到 49.5%。[原表 1][t1]
- **改变参考分布大小。** 补充表 2 中，3、50、100 个 GMM 分量的 SR 分别为 49.20%、52.67%、51.73%。作者采用 50 个分量，更大的分布没有继续改善这项结果。[补充表 2][s2]

### 关键发现

1. **持续追目标的收益比单看第一段更明显。** WANDR 的第三段 DTG 达 99.07 厘米，COMET 为 13.62 厘米。后者的脚滑也从第一段的 15.29% 升到第三段的 20.18%，可见“仍能到达”和“步态完全不退化”是两项不同判断。[原表 3][t3]
2. **多给关节，平均更接近目标，固定阈值下的成功率却没有同步上升。** 从一处到六处，DTG 从 16.32 厘米降至 9.08 厘米，平均 SR 从 71.62% 变为 68.87%。这两个量分别回答“典型误差有多大”和“有多少次落入阈值”。[原表 2][t2]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **给动画师一个能随时替换的目标接口。** 一段里控制右踝和右腕，下一段可以切到骨盆和双腕；剩余时间与当前姿态会一起重算，用户不用为每种组合准备另一套生成器。[官方串联示例][demo] · [图 4][fig4]
- **风格和稳定性共享可检查的部件。** 固定目标与解码器，只换参考姿态分布，就能观察“恐龙式弯腰”和“飞机式张臂”分别改变了哪些部位。还能把同一反馈装到 WANDR 上单独测收益。[原图 7][fig7] · [原表 1][t1]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **时刻、接触、同步仍需另测。** 实现的成功判据取整段中的最近距离。即使 SR 记作成功，也可能提前伸手或只短暂擦过目标；多关节平均同样无法证明双手同一帧接触物体。论文将显式接触与物理约束列为后续工作。[评测器][metrics] · [原文局限][limits]
- **控制范围受训练接口约束。** 虽然每帧会生成整个身体，交互接口只接受六处目标。多关节测试由真实姿态构造，无法据此推断不相容的左右手目标会得到怎样的折中。补充材料中同时控制六处时，右踝 SR 仅 49.47%，骨盆为 95.33%。[原表 2][t2] · [逐关节结果][s4]
- **参考 GMM 表达的是姿态偏好。** 它为当前帧选择与身体形状相近的分量，示例的完整时间顺序没有存入这个分量。作者用主观偏好比较风格；若要验证某一招式的节拍、触地时序或手势语义，还需针对这些属性的评测。[风格机制][style] · [补充 D.5–E][s5]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **WANDR（CVPR 2024）** 提供了“用目标和剩余时间构造运动意图”的基础。COMET 将这一接口扩展到六处关节的子集；把 RGF 单独装到 WANDR 的对照，有助于区分目标接口和长期稳定化的贡献。[WANDR 官方实现][wandr] · [COMET 原表 1][t1]
- **CondMDI 与 DNO** 在本论文中是关键帧补间的实际对照。它们从扩散生成或测试时优化出发，COMET 则逐帧更新并在靠近目标时引入已知终姿参考。原表 4 的比较基于作者的重训设置。[CondMDI 站内解读][condmdi] · [补充 D.4][s3]
- **SMooDi（ECCV 2024）** 也能把参考动作的风格引入生成。COMET 的可替换部件是一组姿态分布参数；SMooDi 是作者风格人评中的直接对照，两者在这里通过相同风格输入做比较。[SMooDi 站内解读][smoodi] · [原图 8][fig8]
- **MoCoDiff（CVPR 2026）** 同样处理长期动作与风格，却接受文字内容和风格条件，主要检验生成片段如何衔接。COMET 接受世界坐标中的关节目标，因此可以用时间窗内的腕部误差来检验用户的具体要求。[MoCoDiff 站内解读](/blog/cvpr2026-mocodiff/) · [COMET 原表 3][t3]
- **对可控动作的启发。** 可以固定目标和初姿，只换风格分布，再分别验目标误差、命中帧、接触时长和风格偏好。这能回答风格是否改变了动作的执行结果，比只看角色“像不像在伸手”更具体。[补充算法 1][s2] · [评测定义][metrics]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **论文**　[WACV 会议记录][cvf] · [arXiv 全文 HTML][html] · [会议终稿 PDF][pdf] · [补充材料 PDF][supp]
- **演示与复核**　[官方项目][project] · [训练、推理与评测实现][repo] · [预训练权重 v1.0.1][weights]

</div>

[html]: https://arxiv.org/html/2512.04487v1
[abs]: https://arxiv.org/abs/2512.04487
[cvf]: https://openaccess.thecvf.com/content/WACV2026/html/Lee_Controllable_Long-term_Motion_Generation_with_Extended_Joint_Targets_WACV_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/WACV2026/papers/Lee_Controllable_Long-term_Motion_Generation_with_Extended_Joint_Targets_WACV_2026_paper.pdf
[supp]: https://openaccess.thecvf.com/content/WACV2026/supplemental/Lee_Controllable_Long-term_Motion_WACV_2026_supplemental.pdf
[s2]: https://openaccess.thecvf.com/content/WACV2026/supplemental/Lee_Controllable_Long-term_Motion_WACV_2026_supplemental.pdf#page=2
[s3]: https://openaccess.thecvf.com/content/WACV2026/supplemental/Lee_Controllable_Long-term_Motion_WACV_2026_supplemental.pdf#page=3
[s4]: https://openaccess.thecvf.com/content/WACV2026/supplemental/Lee_Controllable_Long-term_Motion_WACV_2026_supplemental.pdf#page=4
[s5]: https://openaccess.thecvf.com/content/WACV2026/supplemental/Lee_Controllable_Long-term_Motion_WACV_2026_supplemental.pdf#page=5
[project]: https://comet-proj.github.io/
[repo]: https://github.com/CINEV/COMET/tree/c79fde9e885c49f60f4785aa1cbfb644c35ccb75
[weights]: https://github.com/CINEV/COMET/releases/tag/v1.0.1
[demo]: https://github.com/CINEV/COMET/blob/c79fde9e885c49f60f4785aa1cbfb644c35ccb75/configs/demo/position_1.yaml
[gate]: https://github.com/CINEV/COMET/blob/c79fde9e885c49f60f4785aa1cbfb644c35ccb75/src/comet_motion/models/base_motion_prior.py#L765-L804
[correct]: https://github.com/CINEV/COMET/blob/c79fde9e885c49f60f4785aa1cbfb644c35ccb75/src/comet_motion/models/motion_model.py#L412-L458
[mibcode]: https://github.com/CINEV/COMET/blob/c79fde9e885c49f60f4785aa1cbfb644c35ccb75/configs/demo/mib_1.yaml
[metrics]: https://github.com/CINEV/COMET/blob/c79fde9e885c49f60f4785aa1cbfb644c35ccb75/src/comet_motion/evaluation/motion_evaluator.py
[intro]: https://arxiv.org/html/2512.04487v1#S1
[related]: https://arxiv.org/html/2512.04487v1#S2
[fig2]: https://arxiv.org/html/2512.04487v1#S1.F2
[fig4]: https://arxiv.org/html/2512.04487v1#S4.F4
[fig5]: https://arxiv.org/html/2512.04487v1#S4.F5
[fig7]: https://arxiv.org/html/2512.04487v1#S4.F7
[fig8]: https://arxiv.org/html/2512.04487v1#S4.F8
[repr]: https://arxiv.org/html/2512.04487v1#S3.SS1
[control]: https://arxiv.org/html/2512.04487v1#S3.SS2
[intent]: https://arxiv.org/html/2512.04487v1#S3.SS2.SSS0.Px1
[mask]: https://arxiv.org/html/2512.04487v1#S3.SS2.SSS0.Px2
[cvae]: https://arxiv.org/html/2512.04487v1#S3.SS2.SSS0.Px3
[loss]: https://arxiv.org/html/2512.04487v1#S3.SS2.SSS0.Px4
[rgf]: https://arxiv.org/html/2512.04487v1#S3.SS3
[style]: https://arxiv.org/html/2512.04487v1#S3.SS4
[t1]: https://arxiv.org/html/2512.04487v1#S4.T1
[t2]: https://arxiv.org/html/2512.04487v1#S4.T2
[t3]: https://arxiv.org/html/2512.04487v1#S4.T3
[t4]: https://arxiv.org/html/2512.04487v1#S4.T4
[limits]: https://arxiv.org/html/2512.04487v1#S5
[wandr]: https://github.com/markos-diomataris/wandr
[condmdi]: /blog/siggraph2024-condmdi/
[smoodi]: /blog/eccv2024-smoodi/
