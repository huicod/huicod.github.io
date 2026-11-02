---
title: "[NeurIPS2025] TransPhase：让相邻动作在去噪时一起决定怎样衔接"
description: "沿着先走 2.4 秒、再坐下 3.6 秒的原文示例，看懂语义段与过渡段如何交换相位，并区分长序列、补间和平滑度的证据。"
pubDate: "2026-11-02T16:20:00+08:00"
badge: "Paper"
tags: ["TransPhase", "Motion-Phase", "Motion-Diffusion", "Motion-Inbetweening", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · NeurIPS 2025</summary>

*Deep Compositional Phase Diffusion for Long Motion Sequence Generation*。Ho Yin Au、Jie Chen（通讯作者）、Junkun Jiang、Jingyu Xiang，香港浸会大学。正式发表于 NeurIPS 2025 主会，DOI 10.52202/085713-5187。TransPhase 是作者项目与仓库的名称。本文核对会议正文、技术附录、官方补充材料与公开推理代码；实验结果来自作者，本次未运行模型。[会议记录][venue] · [正式全文][paper] · [补充材料][supp] · [项目与动画][project] · [代码与权重入口][code]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

让角色“走 2.4 秒，再坐下 3.6 秒”，困难在于走的最后一步要让身体接得住坐下的第一步。TransPhase 同时生成走、坐和跨越边界的一段运动。在每次去噪中，文字告诉模型各段要做什么，相邻段的相位估计告诉它身体正在怎样动，最后才把三个结果解码并融合。[正文图 3、5][fig3] · [作者动画][project]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 文本到动作模型已能按一句话生成一段动作。长动作通常包含多条按顺序执行的指令。BABEL-TEACH 提供连续动作的文本片段标注，让研究者能学习一次动作怎样进入下一次。[§1–2][paper]

**现有痛点：** 两个各自合理的生成片段接在一起时，角色可能突然转向、停顿或滑脚。插值能让两个姿势数值上靠近，但未必保留入座前的减速或支撑腿转换。论文图 5 用“走→坐”对比了不同方法的边界表现。[图 5、表 1][pair]

**核心矛盾：** 一段动作需要保留自己的语义，同时要给前后动作留出衔接余地。如果只在前段结束后决定后段，前段已经定型；如果完全独立生成，则两段都无从知道对方的运动状态。[§2、3.2][fig3]

**本文目标：** 输入按时间排列的文字描述和各段长度，生成一条连续动作。系统还应能在已知的两段运动之间补上指定长度的缺口，并允许使用者为缺口另给动作描述。[图 1、4][paper] · [推理接口][demo]

**切入角度：** 作者将一个语义完整、时长可变的动作编码为固定大小的周期参数，再按该段长度展开为逐帧信号。去噪器因此既能比较两段的运动模式，也能读取每个模式随时间怎样展开。[§3.1、图 2][act]

**核心 idea：** 对每对相邻语义段，再定义一个跨边界的过渡段；三段共同去噪。带文字的段同时接受语义与邻段条件，过渡段则从前后两侧获取动态线索。迭代结束后把重叠时间内的预测融合成一条骨骼序列。[§3.2、式 2][blend] · [算法 1][alg]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

先将动作对整理成三段：前段、后段，以及跨越两者边界的过渡段。ACT-PAE 学习这三类片段的共同表示。随后 SPDM 根据文字去噪，TPDM 根据前方或后方的邻段去噪；它们在同一轮对同一目标提出的估计，经混合后交给 DDIM 更新。最后，ACT-PAE 将相位还原成运动，按原时间轴融合重叠区。[原文图 2–4][fig3] · [附录算法 1][alg]

<figure class="paper-figure"><a href="/paper-notes/transphase/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/transphase/architecture.svg" alt="TransPhase 的 ACT-PAE 重建、文本与邻段条件去噪、相位混合、过渡段时间位置及最终补间分支。" /></a><figcaption>教学示意。实线是特征和动作的传递，虚线表示训练时的重建监督；03 的黄色条带占用已有时间。<a href="/paper-notes/transphase/architecture.svg" target="_blank" rel="noopener">查看原图</a></figcaption></figure>

先看 **01**，参数 P 可以用同一尺寸表示长短不同的动作，而信号 Q 按该动作的帧数展开。再看 **03**，过渡段从前一动作中点延续至后一动作中点，因此边界两侧都能调整。**04** 才把相位变成关节运动，全文有两处“混合”：迭代中的相位预测混合，以及解码后对重叠运动的时间加权。[图 2、式 1][act] · [式 2、图 4][blend] · [推理代码][demo]

### 关键设计

1. **用一组周期参数表示长度可变的动作。** ACT-PAE 的 Transformer 编码器读取整段 N 帧运动，预测频率 F、幅值 A、偏置 B、相移 S，每组有 512 个通道。按论文式 1 写，逐帧信号为 **Q = A sin(F · (T − S)) + B**，再由解码器恢复动作。T 是段内的时间坐标。半数通道按归一化进度展开，半数按帧尺度展开，让相同动作既能比较“做到哪一步”，也能体现实际持续时间。公开实现把相移写作正弦角内的加性参数，论文公式与代码中的 S 不宜按同一数值直接代换。[图 2、§3.1.1][act] · [附录 A.2][alg] · [编码与重参数化][paecode]

2. **分开回答“该做什么”和“要接住怎样的运动”。** SPDM 用冻结的 CLIP ViT-B/32 编码本段描述，在自注意力模型中同时读取带噪的四组参数和按时间展开的 Q。TPDM 改读邻段条件，通过交叉注意力预测目标段的噪声；前向条件看时间轴前面的邻段，后向条件看后面的邻段。训练时邻段的干净相位取自真实动作；自由生成时取上一轮 DDIM 推得的干净估计。当前迭代里还不能读取未来的真实运动。[图 2、§3.1.2–3.1.3][act] · [算法 1][alg]

3. **同一时间边界联合生成三个结果。** 每轮中，前段听文字和过渡段，后段也听文字和过渡段，过渡段从左右两个语义段读取动态信息。令 k 为从大到小的噪声步，K 为最大步。带文字的段给邻段预测的权重为 **r = (k/K)³**，给语义预测的权重为 **1 − r**。早期更重衔接，接近采样结束时更重本段语义；没有文字条件的过渡段取 r = 1，平均两侧预测。DDIM 把混合预测换算成下一轮状态和新的干净估计。扩展到多段时，同一组模型沿时间线反复使用。[图 3、式 2][blend] · [算法 1][alg]

4. **补间时固定两端，只为缺口选择条件。** 两端已有骨骼动作先经 ACT-PAE 编成已知相位，迭代期间保持这些条件固定。新生成的是缺口和跨过两个接缝的两段过渡运动。无文字时使用 TPDM；若希望中间“抬起双臂”，再让缺口的 SPDM 读入文字。最终重叠区仍要做时间加权，因此固定已知段的编码，与保证重叠区内每个世界坐标完全不变，是两种不同的要求。[图 4][blend] · [图 7][impl] · [补间脚本][mibcode]

### 一个完整例子：走 2.4 秒，再坐下 3.6 秒

下面采用原文图 5 的两个提示与时长；表中区间由原文对过渡段的定义推得，位置数值没有来自一次新增运行。[图 5][pair] · [过渡定义与不等长示例][alg]

| 步骤 | 在这 6 秒里具体做什么 |
|---|---|
| 布置时间轴 | 走占 0–2.4 秒，坐占 2.4–6.0 秒。过渡从走的中点 1.2 秒延伸到坐的中点 4.2 秒，覆盖 3.0 秒；输出总长仍是 6.0 秒。 |
| 交换估计 | “走”与“坐”分别提供语义条件。过渡估计会读取两侧运动；下一轮，两侧再读取更新后的过渡估计，因此走路最后几步也有机会调整。 |
| 得到一条动作 | 解码三个片段。公开生成脚本先把两语义段拼成完整时间轴，再在过渡区内替换为加权组合：越靠近 2.4 秒边界，跨段预测的权重越大，越靠近过渡区两端，原语义段的权重越大。[公开实现][demo] |
| 对照证据 | 图 5 展示该示例的步态和坐下过程；表 1 的分数来自整个测试集。两个提示都没有指定最后一步由哪只脚承重，也没有给出椅子的三维坐标。 |

### 训练与推理

数据来自 BABEL-TEACH。每个语义段保留 **45–250 帧**，按相邻关系构成 **4,370 对训练样本、1,582 对测试样本**。作者从 HumanML3D 的 263 维运动表示出发，额外加入根的 6D 旋转得到 269 维。先用 L2 重建训练 ACT-PAE，再用其编码训练 SPDM 和前后向 TPDM，以 L1 监督所加的噪声。补充材料记录 ACT-PAE、TPDM、SPDM 分别训练 6,500、2,500、9,000 个 epoch，论文报告使用两张 RTX 4090。[§4.1][pair] · [附录 A.3–A.4][impl] · [补充 §1.1][supp]

论文配置为 1,000 个训练噪声步与 100 个推理步。代码库提供动作表示、去噪器、推理与评估脚本，以及权重和预处理数据的外部下载入口；当前公开长动作示例脚本实际调用 `set_timesteps(99)`。脚本末尾给出的五段提示与帧数解释了控制接口：**时长由调用方输入**，去噪器决定各时间区间内的动作表现。[附录 A.4][impl] · [生成脚本][demo] · [仓库说明][code]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验一：两段文字能否同时保住语义和接缝？

原表 1 将两语义段、跨边界过渡段和整体分别评估。FID 衡量生成与真实动作在特征空间中的分布差异，MMD 是文动嵌入间的多模态距离（Multimodal Distance）。过渡段与左右两段的文字进行匹配，两项指标都是越低越好。MDM-30 与 MLD-30 表示按独立提示生成并使用 30 帧重叠混合的基线。[§4.1–4.2、表 1][pair] · [指标口径][long]

| BABEL-TEACH · 表 1 | 语义 FID ↓ | 过渡 FID ↓ | 整体 FID ↓ | 语义 MMD ↓ | 过渡 MMD ↓ | 整体 MMD ↓ |
|---|---:|---:|---:|---:|---:|---:|
| MDM-30 | 1.084 | 2.526 | 1.146 | 3.793 | **6.429** | 4.923 |
| MLD-30 | 13.88 | 15.20 | 14.25 | 8.478 | 7.407 | 7.632 |
| TEACH | 0.941 | 2.375 | 1.041 | **3.185** | 7.479 | 4.821 |
| PCMDM | 1.056 | 1.898 | 0.837 | 4.548 | 7.323 | 5.423 |
| priorMDM | 1.148 | 2.580 | 0.839 | 3.732 | 7.399 | 5.025 |
| TransPhase | **0.736** | **1.807** | **0.782** | 3.509 | 6.545 | **4.711** |

### 主实验二：把 3,164 条描述放进一条时间线

作者将整个测试集的描述连成一条序列，共 **302,298 帧，约 168 分钟**。原表 2 比较这条长序列中的窗口。这个时长是生成内容的长度。补充材料另测端到端推理耗时：两段 **1.705 秒**、十段 **2.015 秒**。将多段堆入 batch 可并行去噪，重排、融合与显存仍随规模变化；论文没有给出同口径的 3,164 段耗时。[表 2][long] · [补充 §1.2、5.1][supp]

| BABEL-TEACH · 表 2 | 语义 FID ↓ | 过渡 FID ↓ | 整体 FID ↓ | 语义 MMD ↓ | 过渡 MMD ↓ | 整体 MMD ↓ |
|---|---:|---:|---:|---:|---:|---:|
| MDM-30 | 1.094 | 2.051 | 1.365 | 3.877 | 6.411 | 4.958 |
| MLD-30 | 14.36 | 13.44 | 17.02 | 8.423 | 7.407 | 7.690 |
| TEACH | 0.785 | 1.645 | 1.780 | **3.175** | 5.483 | 4.984 |
| PCMDM | 1.068 | 0.934 | 0.876 | 4.188 | 5.721 | 5.156 |
| priorMDM | 2.288 | 1.067 | 1.536 | 4.299 | 5.536 | 5.060 |
| TransPhase | **0.773** | **0.909** | **0.847** | 3.642 | **5.389** | **4.849** |

### 主实验三：补间时会不会用平滑换掉动作内容？

原表 3 把真实动作边界附近的 **60 / 120 / 180 帧**遮住，用两端恢复缺口。速度和 6D 旋转误差、频谱指标 NPSS 均与遮住的真实动作比较；RMS-Jerk 衡量关节旋转的平滑性。下表固定 120 帧以便比较各方法。[原表 3][umib]

| 无文本补间 · 120 帧 | L2-Vel ↓ | L2-Rot6D ↓ | NPSS ↓ | RMS-Jerk ↓ |
|---|---:|---:|---:|---:|
| RMIB | 0.0307 | 0.3797 | 5.7334 | 1.3794 |
| RSMT | 0.0273 | 0.2438 | 2.8986 | 1.4670 |
| CMB | 0.0172 | 0.2209 | 1.0278 | 1.9885 |
| MDM | 0.0275 | 0.3099 | 3.2291 | 2.1205 |
| priorMDM | 0.0141 | 0.2455 | 1.2107 | 0.4495 |
| TransPhase | **0.0102** | **0.2205** | **0.9296** | **0.1054** |

附录表 4 再给缺口加文本，评测只针对补间区。图 7 的具体指令是“向上弯起双臂”。两张表任务和指标不同，比较时应分别在表内读。[图 7 与条件补间设置][impl] · [附录表 4][cmib]

| 有文本补间 · 附录表 4 | FID ↓（60 / 120 / 180 帧） | MMD ↓（60 / 120 / 180 帧） |
|---|---:|---:|
| CMB | 0.693 / 1.382 / 2.765 | 7.420 / 7.544 / 7.561 |
| MDM | 0.694 / 1.482 / 2.626 | 7.411 / 7.609 / 7.658 |
| priorMDM | 1.613 / 1.392 / 5.699 | 7.761 / 8.075 / 7.544 |
| TransPhase | **0.389 / 0.679 / 2.152** | **7.213 / 6.871 / 7.206** |

### 消融实验

补充表 1 在两段组合任务上分别去掉逐帧 Q、改变噪声建模、移除根轨迹强调投影，或丢弃最后解码出的过渡段。以下为原表选列。[补充表 1 与 §3.1][supp]

| 配置 | 过渡 FID ↓ | 整体 FID ↓ | 整体 MMD ↓ |
|---|---:|---:|---:|
| 不用 ε 预测 | 3.544 | 3.411 | 5.931 |
| 去掉强调投影 | 2.576 | 0.958 | 5.133 |
| 两个模块都去掉逐帧 Q | 11.348 | 19.451 | 7.678 |
| 只在 SPDM 去掉 Q | 9.057 | 15.591 | 7.226 |
| 只在 TPDM 去掉 Q | 4.837 | 3.621 | 5.677 |
| 解码后不混入过渡段 | 2.295 | 1.061 | 4.970 |
| 完整模型 | **1.807** | **0.782** | **4.711** |

**时间表示与容量。** 在组合任务上，将相位通道数从 16 提到 128、512 时，整体 FID 为 **7.603 → 2.124 → 0.782**。在 512 通道配置下，同时使用真实帧尺度、归一化进度和起中末位置编码，比只用单一时间窗更均衡；仅看语义 FID，混合时间窗配普通位置编码的 0.499 反而更低。[补充表 2–3][supp]

**混合权重。** 固定过渡段只读邻段时，语义段完全不读邻段、一直用 0.5、只读邻段、采用立方调度，其整体 FID 分别为 **1.960、1.912、3.568、0.782**。立方调度是作者在该基准比较后的选择；改用四次方，语义 FID 从 0.736 改为 0.634，但整体 FID 变为 1.157。缺口没有文字时，两侧都依赖邻段的设置在 60 帧补间中取得最低 NPSS 和 RMS-Jerk。[补充表 5–6][supp]

**人评。** 30 位独立评审参加；每个任务准备 30 条样例，每次从中随机抽 5 条，按 1–5 分评价。两段组合中，TransPhase 的自然度、语义符合度、转场平滑度分别为 **4.1、3.9、4.1**。在无文字的补间实验中，评审只评价自然度与平滑度。图中是主观评分，未报告这些差值的显著性检验。[补充图 1、§2][supp]

### 关键发现

1. **逐帧展开是相位接口的一部分。** 四组参数虽然能统一不同片长的表示，去掉展开的 Q 后两段组合的整体 FID 从 0.782 升到 19.451。实验支持保留“这些参数在这段时间实际怎样变化”的信息。[补充表 1][supp]
2. **组合质量与单段文字匹配有取舍。** TransPhase 的两段与长序列整体 FID、MMD 均为各表最低，但两种设置下单独看语义段 MMD，TEACH 都更低。两侧衔接的收益不等于每段的文字匹配都领先。[表 1][pair] · [表 2][long]
3. **平滑优势有对应的任务口径。** 固定 120 帧真实缺口时，TransPhase 同时降低了 RMS-Jerk 和相对真实运动的误差。它说明这套条件下的补间接近真实且平滑，仍不能据此计算任意真实场景中的碰撞率或落脚精度。[表 3、图 6][umib]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **过渡段给两段动作一个共同的观察区。** 按“前半/后半”定义过渡，长短不同的语义段便不需要共享固定帧数的拼接窗；在这个具体区间里，来自两边的运动估计可以反复互相修正。[图 3、附录 A.2][alg]
- **语义文本与边界运动各有独立通路。** 同一扩散流程中可以移除缺口文字、固定已有片段、改变片段时长。因此组合生成与补间共享大部分机制，而控制信息的来源仍可追踪。[图 2–4][fig3]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **依赖相邻且有分段标注的数据。** 训练集为 BABEL-TEACH 中整理出的相邻动作对，单段训练长度限于 45–250 帧。长序列实验增加了段的数量，并没有测任意长的单个动作是否仍可由一套相位表示保真重建。[§4.1、4.2][pair]
- **时长、相位与物理控制各有边界。** 给定某段持续多久，可以安排“什么时候进入坐下区间”；框架没有显式足接触、椅面或目标位置条件，也没有为每个周期通道命名可独立操纵的动作事件。[图 2–5][fig3] · [控制输入][demo]
- **并行采样依赖可用显存。** 原文测试了长时间线上的分布指标，补充材料的短耗时测量只覆盖两段和十段。双向读取邻居意味着后来的描述也会影响先前片段；论文未检验输入持续到来时已播动作能否稳定提交。[表 2][long] · [补充 §1.2、5.1][supp]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **DeepPhase。** 它为固定时间窗学习多通道相位。TransPhase 保留周期信号这一归纳偏置，改由 Transformer 编码完整、可变长的动作，不同片长都输出相同数量的参数，再训练条件去噪器。[TransPhase §3.1.1][act] · [站内 DeepPhase 解读](/blog/siggraph2022-deepphase/)
- **TEACH。** 同样使用成对的动作和描述，按时间顺序生成是很自然的选择。TransPhase 改为同时更新两端，使前一段也能为后一段改变动态。TEACH 在语义段 MMD 上的优势说明顺序模型仍有值得比较之处。[TEACH 作者项目](https://teach.is.tue.mpg.de/) · [TransPhase 表 1][pair]
- **priorMDM。** 两者都使用过渡运动处理接缝。TransPhase 从扩散开始就在语义段与过渡段之间交换相位估计，最后仍保留线性融合。可以分别通过模块消融、接缝区指标和物理量判断各阶段的作用。[priorMDM 作者仓库](https://github.com/priorMDM/priorMDM) · [TransPhase 补充表 1][supp]
- **与 FunPhase 对读。** 两篇都会把片段编码成周期参数。TransPhase 为“走路接坐下”额外建立跨边界的过渡段，用两端的信息共同去噪；FunPhase 的解码器则允许在同一片段中指定关节和时刻，查询该处的姿态。前者可看过渡区误差，后者可看稀疏关键帧之间的重建误差。[FunPhase 正式论文](https://proceedings.mlr.press/v306/pegoraro26a.html) · [站内 FunPhase 解读](/blog/icml2026-funphase/)

<span id="reading-8" class="reading-anchor"></span>

## 来源

- [NeurIPS 2025 正式记录][venue] · [会议正文与技术附录][paper] · [会议补充包：消融表、人评与视频][supp] · [可检索的作者 HTML 版][html]
- [作者项目与分任务动画][project] · [公开代码及数据、权重说明][code] · [长动作推理][demo] · [补间推理][mibcode]
- 架构图为本文根据正式论文图 2–5、算法 1 重绘的教学示意。表中数值由作者报告，代码核查固定在提交 `75b1ec8`。

</div>

[venue]: https://proceedings.neurips.cc/paper_files/paper/2025/hash/e4130450106ffcaf202c928c6c91ceb3-Abstract-Conference.html
[paper]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Paper-Conference.pdf
[act]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Paper-Conference.pdf#page=4
[fig3]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Paper-Conference.pdf#page=5
[blend]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Paper-Conference.pdf#page=6
[pair]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Paper-Conference.pdf#page=7
[long]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Paper-Conference.pdf#page=8
[umib]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Paper-Conference.pdf#page=9
[alg]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Paper-Conference.pdf#page=20
[impl]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Paper-Conference.pdf#page=21
[cmib]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Paper-Conference.pdf#page=22
[supp]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e4130450106ffcaf202c928c6c91ceb3-Supplemental-Conference.zip
[html]: https://arxiv.org/html/2510.14427v1
[project]: https://asdryau.github.io/TransPhase/
[code]: https://github.com/asdryau/TransPhase
[paecode]: https://github.com/asdryau/TransPhase/blob/75b1ec852b1ccb8fd932f29ac199aed5db02cbf2/model/PAE/model.py#L123-L180
[demo]: https://github.com/asdryau/TransPhase/blob/75b1ec852b1ccb8fd932f29ac199aed5db02cbf2/demo_t2m_long.py#L58-L266
[mibcode]: https://github.com/asdryau/TransPhase/blob/75b1ec852b1ccb8fd932f29ac199aed5db02cbf2/demo_mib.py
