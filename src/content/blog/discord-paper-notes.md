---
title: "[ICCV2025] DisCoRD：让离散动作恢复连续细节"
description: "从逐帧条件投影、整流速度场和短窗口训练，理解 DisCoRD 如何替换动作解码器，并比较重建、生成、平滑度与速度的实验结果。"
pubDate: "2026-10-14"
badge: "Paper"
tags: ["DisCoRD", "Motion-Tokenizer", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · ICCV 2025 · 正文与补充</summary>

**保留原来的动作词表和生成器，把“一次性还原动作”换成“以 token 为条件，逐步生成连续动作”。**

**完整标题：** DisCoRD: Discrete Tokens to Continuous Motion via Rectified Flow Decoding  
**作者：** Jungbin Cho、Junwan Kim、Jisoo Kim、Minseo Kim、Mingu Kang、Sungeun Hong、Tae-Hyun Oh、Youngjae Yu  
**出处：** ICCV 2025，pp. 14602–14612；会议官方名单标为 Highlight。预印本编号为 arXiv:2411.19527。  
**入口：** [CVF 正式发表页面](https://openaccess.thecvf.com/content/ICCV2025/html/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.html) · [正文](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf) · [补充材料](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Cho_DisCoRD_Discrete_Tokens_ICCV_2025_supplemental.pdf) · [项目页](https://whwjdqls.github.io/discord-motion/) · [官方代码](https://github.com/whwjdqls/DisCoRD)  
**领域与关键词：** 人体动作生成、动作离散表示、条件解码、Rectified Flow、运动自然度。  
**阅读范围：** 以 ICCV 正文与补充材料为准，静态检查官方代码；未运行模型。核查日期：2026-10-14。

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

**DisCoRD 冻结已有动作量化器，复用原来的 token 生成器，单独训练一个以离散 token 为条件的 Rectified Flow 解码器：它从高斯噪声出发，在连续动作空间中逐步恢复运动细节，改善一次性离散解码容易出现的抖动和动作幅度不足。**

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 文本、语音和音乐都可以驱动人体动作生成。离散路线通常先用 VQ-VAE 把动作压成 token，再训练自回归或掩码模型预测这些 token，最后通过解码器还原动作。这将复杂的连续运动预测转成有限词表上的分类问题，T2M-GPT、MoMask 等模型都采用了这一思路。

**现有痛点：** token 序列在语义上选对了，解码出的动作仍可能不够自然。例如，指令要求角色有力地摆动手臂，结果的动作类别没错，但手臂的小幅变化被压平；另一些帧又出现不必要的细碎抖动。作者分别把这两种问题称为 under-reconstruction，即细节和动态幅度恢复不足，以及 frame-wise noise，即逐帧噪声。

**核心矛盾：** 离散表示有利于学习“条件对应哪类动作”，但多个连续动作会被压缩到相同或相近的编码，细节并没有完整保留下来。若再要求一个确定性的前馈解码器一次性还原所有变化，它就容易生成折中的结果。连续生成模型擅长刻画细节，却又要面对高维动作与有限配对数据带来的条件学习难题。

**本文目标：** 保留现有离散生成器的条件建模能力，同时提高解码后的平滑性与动态表现。作者希望这项改动能接到不同离散基座上，而不必重新训练整套文本、语音或音乐到动作的映射。

**切入角度：** 将离散 token 视作连续生成过程的条件，而不是必须直接转换成某个唯一动作的编码。这样，token 负责告诉模型“这段动作大致是什么”，连续生成器负责补足“怎样自然地完成这段运动”。

**核心 idea：** 把原来的前馈动作解码器替换为条件 Rectified Flow。先把短 token 序列变成逐帧条件，再让模型学习如何在这些条件引导下，把与目标同形状的噪声逐步变成连续动作。[原文 §1、§3](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf#page=2)

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

DisCoRD 的训练与推理共享一套新的解码模块，但 token 的来源不同。训练时，真实动作经过冻结的编码器和量化器，得到量化嵌入；模型学习在这些嵌入的条件下重建动作。推理时，则由原先训练好的条件生成器预测 token，再交给同一个新解码器。新训练的主要部分是 **Condition Projection 和 1D U-Net 速度场**；原有量化器、码本与 token 生成器被复用。

[![DisCoRD 完整架构：训练与推理](/paper-notes/discord/architecture.svg)](/paper-notes/discord/architecture.svg)

*完整架构教学示意，点击可查看大图。根据[原论文方法部分](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf)重绘，训练关系与推理信息流分区展示。*

*读图顺序：先看上半部如何从真实动作得到 token 条件和速度监督，再看下半部如何把 token 来源换成已有生成器。蓝色表示复用组件，绿色表示新训练的解码模块。噪声与 token 条件从不同支路进入 RF 解码器，循环箭头表示连续状态的多次更新。依据论文图 3 与 §3 重绘；图中的 t 是生成过程的时间，不是动作的第几帧。*

这条流程从高斯噪声直接生成动作特征。它不先经过旧解码器得到一段粗动作，也不是在粗动作上叠加一个平滑滤波器。论文专门将“旧解码器输出后再修复”作为消融比较。[原文图 3、表 6](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf#page=4)

### 关键设计

1. **保留离散生成路线，只改变 token 最后怎样变成动作**

   原来的两阶段系统先训练动作 VQ-VAE，再训练条件 token 预测器。对于一段 T 帧动作，编码器以时间压缩倍数 q 得到约 T/q 个位置的量化表示；生成器预测对应码本索引，查表后得到量化嵌入 Z。传统解码器接收 Z，直接输出整段动作。

   DisCoRD 保留前面的词表与预测过程，用新解码器学习条件分布“给定 Z，哪些连续动作是合理的”。同一组 token 因而可以对应不同的细节实现，而不是只有一个确定性的输出。好处是有机会补回有表现力的运动；代价是补出的细节不一定与某条参考动作逐点一致。它改善的是离散表示的解码方式，并没有让 token 自动变成“右手抬起”这类可解释动作符号。

   这种替换还保留了原条件生成器的工作分工：文字、语音或音乐先影响 token，再通过 token 影响 RF 解码。官方默认实现没有把文字直接送入 RF U-Net，配置中的 `text_condition` 为 `false`。[原文 §3.1–3.2](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf#page=4)

2. **Condition Projection：让一个 token 对应的几帧拥有不同条件**

   量化表示比最终动作短，RF 解码却需要逐帧条件。以 MoMask 配套设置为例，q=4：一个时间位置的量化嵌入覆盖 4 帧。直接复制它四次，再用同一个逐帧线性层处理，会给这四帧相同的条件，很难表达一小段运动内部的变化。

   作者采用“重复 → 堆叠 → 线性投影 → 拆分”的过程：先把一个嵌入的四份副本堆到通道维，在更宽的向量上进行投影，再拆成四个帧位置的特征。因为这四个输出位置对应不同的投影参数，它们可以不同，同时仍明确地对应原 token 覆盖的四帧。

   补充材料的 MoMask 设置使用 **512 维量化嵌入、256 维逐帧条件**。这层投影不直接输出动作，而是产生 C₁、C₂……Cₜ，随后与当前连续动作状态按通道拼接。公开代码也实现了这一过程，最终再用逐点投影得到条件通道。这个设计在保留时间对应的同时，为每帧提供了不同的细节线索。[原文 §3.2；补充 A](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Cho_DisCoRD_Discrete_Tokens_ICCV_2025_supplemental.pdf#page=1)

3. **Rectified Flow：学习从噪声走向动作的速度，而不是一次猜出所有坐标**

   训练时，X₁ 是真实动作，X₀ 是独立采样的高斯噪声，两者有相同的序列长度和特征维度。随机抽取 t∈[0,1]，构造一个中间状态：

   <div class="equation">X<sub>t</sub> = (1 − t) X<sub>0</sub> + t X<sub>1</sub></div>

   t=0 时是纯噪声，t=1 时是真实动作。注意，这里的 t 沿着“生成过程”变化；每一个 Xₜ 内部都包含整段动作的所有帧，不能把 t=0.5 理解成视频播放到一半。

   模型接收 Xₜ、t 和 token 产生的逐帧条件 C，预测速度 vθ。训练目标是让预测接近这条直线路径的速度 X₁−X₀：

   <div class="equation">L<sub>RF</sub> = E [ ‖v<sub>θ</sub>(X<sub>t</sub>, t, C) − (X<sub>1</sub> − X<sub>0</sub>)‖² ]</div>

   这两个式子对应原文公式 4。它们把“怎样变成真实动作”拆成可监督的速度预测：不同噪声、动作和 t 产生大量训练状态，网络学习在条件 C 下应往哪个方向更新。

   推理时没有 X₁，只有预测 token 产生的 Ĉ 和新采样的 X₀。论文采用 Euler 方法反复更新：

   <div class="equation">X<sub>t+Δt</sub> = X<sub>t</sub> + Δt · v<sub>θ</sub>(X<sub>t</sub>, t, Ĉ)，t：0 → 1</div>

   每一步重新读取当前状态，逐渐得到最终动作。这里的随机性允许同一 token 条件下存在不同细节；它不能凭空确定量化时已经丢失的唯一原始轨迹。[原文 §3.2](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf#page=5)

4. **短窗口训练：让解码器适应生成器没在训练中给过的 token 组合**

   只看真实动作重建，很容易忽略一个差别：训练时 token 来自真实动作的编码，生成时 token 来自另一个模型的预测。预测出的排列组合可能不曾在解码器训练中出现，重建成绩好并不自动意味着这些新组合也解得好。

   作者不以最长整段作为默认训练单位，而使用 **64 帧滑动窗口**。这样模型围绕局部运动学习条件与连续细节的关系，再用于更长的生成序列。默认 1D U-Net 也不加注意力模块。消融显示，整段训练能把重建 FID 从 0.011 改善到 0.008，却让生成 FID 从 0.032 变差到 0.038；设计选择因而以实际生成端的效果为依据。[原文表 6；补充表 A](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf#page=8)

5. **sJPE：同时观察细碎抖动和运动幅度不足**

   动作看起来过于僵硬和过于抖动，都可能不自然。因此，只惩罚运动变化也不够：把角色完全平滑成不动，虽然没有噪声，却丢失了应有的动态。

   作者用位置对时间的三阶导数 jerk 来观察这种差异，提出 **symmetric Jerk Percentage Error，sJPE**，衡量预测与参考动作 jerk 的相对差别。它进一步分成两部分：预测 jerk 高于参考时记入 Noise sJPE，主要用于观察过多的细碎变化；低于参考时记入 Static sJPE，用于观察动态恢复不足。较低的总分意味着相对参考动作，两种偏差更小。

   这是论文的评价贡献，不是 RF 训练中额外施加的 jerk 损失。补充材料中的人工研究报告，sJPE 与自然度排序的平均 Pearson 相关为 0.483，MPJPE 为 0.181；计算时剔除了人类评分在模型间差异最小的 10% 样本。因此，这一结果支持它作为补充观察工具，仍不能把一个 jerk 指标等同于动作自然度的全部。[原文 §4.1；补充 C.2–C.4](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Cho_DisCoRD_Discrete_Tokens_ICCV_2025_supplemental.pdf#page=2)


### 一个完整例子

沿用论文架构图中的指令 **“A person walks towards the camera.”（一个人朝相机走来）**，看已有 MoMask 生成器如何接入 DisCoRD。以下是方法流程的教学说明，数值尺寸选作例子，不是一次实际运行的记录。

1. **确定长度并预测 token。** 假设要生成 HumanML3D 表示下的 196 帧动作。文字和目标长度交给已有 token 生成器。对于 q=4 的设置，时间轴上对应 49 个量化位置；MoMask 使用残差量化时，每个位置还会有多层码本索引。DisCoRD 不重新替这些索引做语言规划。
2. **把索引变成逐帧条件。** 查原码本得到 49 个位置的量化嵌入，再经 Condition Projection 展开成 196 个条件向量。原本由一个 token 覆盖的四帧现在可以接收不同线索，例如支持步行周期内前后相邻的运动变化；这里并没有人工指定“这一帧必须左脚落地”。
3. **从同形状噪声开始。** 采样一个 196×263 的 X₀；263 是 HumanML3D 的逐帧动作特征维度，不是 263 个关节。U-Net 在每个生成时刻都同时读取整段当前状态、时间 t 和固定的 token 条件。
4. **沿速度场逐步更新。** 在论文默认的 16 步采样设置下，连续状态从噪声逐渐变成符合这些 token 的动作。离散生成器提供“朝相机走”的条件基础，RF 解码器学习补足运动过程中的连续变化。
5. **得到动作并评价。** 输出已经是连续动作特征，无需再过旧前馈解码器；之后按原动作表示恢复关节用于渲染。评价时既看文本与动作匹配，也看分布质量、局部轨迹和相应动态指标。仅凭 token 选对，不能确定脚接触或每个细节都已正确。

如果把第一步换成“将一段真实动作编码成 token”，后面仍可沿同一条 RF 解码链路运行，但此时做的是**重建**。前者考验预测 token 的生成质量，后者考验真实动作压缩后能恢复到什么程度，这正是论文将两类主结果分开报告的原因。

### 训练/推理

- **复用并冻结：** 既有动作编码器和量化器。官方训练脚本显式将已有 VQ-VAE 参数设为不计算梯度；原 token 生成器也不在 RF 训练优化器里。
- **新训练：** Condition Projection 与 RF 速度场，默认骨干为无注意力的 1D U-Net。HumanML3D/MoMask 设置约 **66.9M 参数**，训练目标为 flow MSE。
- **训练配置：** 补充材料报告 batch size 768、窗口 64 帧、AdamW、学习率 0.0005、200 epochs、481,896 steps，并报告约 35 小时的单卡训练。原文将硬件写作“NVIDIA RTX 4090 Ti”，此处按作者记载保留；该时间是新增解码器训练，不包含原量化器和 token 生成器的预训练成本。
- **推理配置：** 论文默认 16 sampling steps。官方推理入口要求提供动作长度，也可结合基座的长度预测器；RF 解码器本身不负责从自然语言决定终止时间。[补充表 A](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Cho_DisCoRD_Discrete_Tokens_ICCV_2025_supplemental.pdf#page=1) · [官方 README](https://github.com/whwjdqls/DisCoRD)

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

**表 1：HumanML3D 动作重建，摘自正式论文表 1。输入是真实动作编码出的 token；FID、MPJPE 与 sJPE 均越低越好。**

| 解码设置 | FID ↓ | MPJPE ↓ | sJPE ↓ |
|---|---:|---:|---:|
| T2M-GPT 原解码器 | 0.089 | **60.0** | 0.564 |
| T2M-GPT + DisCoRD | **0.031** | 71.5 | **0.488** |
| MMM 原解码器 | 0.097 | **46.9** | 0.517 |
| MMM + DisCoRD | **0.020** | 56.8 | **0.429** |
| MoMask 原解码器 | 0.019 | **29.5** | 0.512 |
| MoMask + DisCoRD | **0.011** | 33.3 | **0.385** |

*加粗仅表示每组配对中较好的结果。MPJPE 衡量与参考动作的关节位置接近程度；sJPE 关注对应的动态偏差，两者测量的内容不同。[原表 1](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf#page=6)*

**表 2：文本到动作生成，摘自正式论文表 2。输入 token 来自已有生成器，保留原表的 95% 置信区间。**

| 数据集 | 方法 | R-Precision Top-3 ↑ | FID ↓ | MM-Dist ↓ |
|---|---|---:|---:|---:|
| HumanML3D | T2M-GPT | 0.775 ± .002 | 0.116 ± .004 | 3.118 ± .011 |
| HumanML3D | + DisCoRD | 0.760 ± .007 | 0.095 ± .011 | 3.121 ± .009 |
| HumanML3D | BAMM | 0.814 ± .003 | 0.055 ± .002 | 2.919 ± .008 |
| HumanML3D | + DisCoRD | 0.811 ± .004 | 0.041 ± .002 | 2.921 ± .015 |
| HumanML3D | MoMask | 0.807 ± .002 | 0.045 ± .002 | 2.958 ± .008 |
| HumanML3D | + DisCoRD | 0.809 ± .002 | **0.032 ± .002** | 2.938 ± .010 |
| KIT-ML | ReMoDiffuse | 0.765 ± .055 | **0.155 ± .006** | 2.814 ± .012 |
| KIT-ML | MoMask | **0.781 ± .005** | 0.204 ± .011 | **2.779 ± .022** |
| KIT-ML | + DisCoRD | 0.775 ± .004 | 0.169 ± .010 | 2.792 ± .015 |

*“+ DisCoRD”对应上一行基座，替换解码器。R-Precision 衡量特征空间中的文本检索匹配，其命中率不等于严格指令成功率；MM-Dist 衡量文本与动作特征距离。KIT-ML 的 0.169 优于 MoMask 的 0.204，但仍高于 ReMoDiffuse 的 0.155。[原表 2](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf#page=7)*

**表 3：MoMask 条件下的采样效率，摘自补充表 E。仅测解码阶段，每批 32 条序列，不包含文字到 token 的预测时间。**

| 解码方式 | 论文采样步数 | 生成 FID ↓ | 批解码耗时 ↓ |
|---|---:|---:|---:|
| MoMask 原解码器 | 一次前馈 | —（该表未列） | 0.244 s |
| DisCoRD | 2 | 0.034 | 0.016 s |
| DisCoRD | 16 | 0.032 | 0.221 s |
| DisCoRD | 50 | 0.032 | 0.703 s |
| DisCoRD | 100 | 0.032 | 1.426 s |

*论文图 6 说明结果平均于 20 次计时，使用作者标注的 RTX 4090 Ti。这里是特定实现与批处理设置下的结果，不能直接换算成端到端单条动作延迟。[补充表 E](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Cho_DisCoRD_Discrete_Tokens_ICCV_2025_supplemental.pdf#page=8)*

### 消融实验

**直接条件解码与后处理：** 在 MoMask 已解码动作上再接 RF 修复模型，生成 FID 为 0.035、重建 sJPE 为 0.489；直接以 token 为条件的 DisCoRD 分别为 0.032 和 0.385。提升不只是多运行一个连续模型，输入条件和介入位置也很重要。

**逐帧条件投影：** 将本文投影换成上卷积或简单重复加线性层，生成 FID 分别从 0.032 变为 0.039、0.038。简单重复的重建 sJPE 反而更低，说明最佳重建设置与最佳生成设置并不完全一致。

**窗口与注意力：** 使用整段动作训练，重建 FID 更好，但生成 FID 变差到 0.038；给 U-Net 加入注意力后，生成 FID 为 0.043。作者因此选择窗口训练与无注意力骨干。[原文表 6](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf#page=8)

**token 的信息量：** 改变 MoMask 的残差量化层数时，DisCoRD 一直能改善 FID，但条件匹配的代价不同。R0 设置下，Top-1 从 0.505 降到 0.491；R5 设置下则从 0.521 升到 0.524。丰富的量化条件更有利于 RF 在补细节时维持语义。[原文表 5](https://openaccess.thecvf.com/content/ICCV2025/papers/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.pdf#page=8)

**跨任务适配：** 论文还分别训练配套解码器接到语音手势和音乐舞蹈模型。TalkSHOW 的 FGD 从 74.88 降至 43.58，ProbTalk 从 5.21 降至 4.83；两者分别使用整体和身体 FGD，不能横向比较绝对值。舞蹈 TM2D 的分布扩展指标和节拍对齐有所改善，但补充表 D 的 FIDₖ 从 19.01 变为 23.98、FIDɡ 从 20.09 变为 88.74，表现退步。[原文表 3–4；补充 B.2、表 D](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Cho_DisCoRD_Discrete_Tokens_ICCV_2025_supplemental.pdf#page=6)

### 关键发现

1. **主要收益发生在 token 到连续动作的最后一步。** 在基座 token 生成器不变的情况下，MoMask 的生成 FID 从 0.045 降至 0.032，说明最后一段解码链路仍有可观改进空间。
2. **自然的动作与逐点相同的动作是不同目标。** HumanML3D 三组重建实验都改善了 FID 和 sJPE，却提高了 MPJPE。这与条件生成允许多种细节实现相吻合，使用时应根据任务决定更看重哪一种质量。
3. **上游 token 越充分，新解码器越容易兼顾细节与条件。** T2M-GPT 上存在检索匹配下降，丰富残差量化条件的 MoMask 表现更稳；解码器无法完全弥补输入信息不足。
4. **更多计算和更强重建不一定带来更好生成。** 16 步之后继续增加采样步数，表 E 中 FID 已无明显收益；整段训练虽然改善重建，也没有改善预测 token 的生成。这两点都提醒我们要在最终生成任务上选择配置。

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **把表示与解码能力分开改进：** 离散词表便于学习条件映射，连续 RF 擅长生成运动细节，两者可以在同一系统中分工。原系统已经能选出合适动作 token 时，不必先重做整个 tokenizer。
- **对齐粒度的投影很小，却解决实际接口问题：** 每个 token 覆盖多帧，解码器需要逐帧条件。显式展开 q 个不同特征，比只说“把 token 上采样”更清楚地保留了时间对应关系。
- **把重建与生成分开看：** 相同 decoder 面对真实编码和预测 token 时处在不同输入分布。论文把这种差异直接反映到训练窗口、投影方式和评价表中，是方法选择的重要依据。
- **自然度同时需要平滑与动态：** 引入 Noise/Static sJPE，是为了避免仅以“更平滑”替代“更自然”。动作该快的地方仍应有足够变化，该稳的地方才应减少细碎噪声。

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

1. **生成细节不等于恢复唯一原动作。** 量化信息已经丢失时，RF 学到的是合理的条件补全。对于要求保留原轨迹、指定关节逐帧不变的动作编辑任务，需要另行设计约束与检查，不能把这篇解码改进直接当成保持机制。
2. **条件匹配取决于基座与表示容量。** T2M-GPT、不同残差层数以及 KIT-ML 结果都呈现取舍。论文总体上改善离散基座的自然度，并未做到每个设置、每项指标均提升。
3. **sJPE 覆盖的是部分动态特征。** 它依赖参考动作的 jerk，不能单独判断语义、接触、脚滑、碰撞和整体可行性；人工相关实验也不是对所有动作类型的普遍证明。
4. **迁移范围与公开验证范围需分开。** 论文测试了文本、语音和音乐三类任务，但使用各自基座与配套训练。官方仓库当前提供训练、推理、重建和生成评估入口，并在 README 中提供 MoMask 版 checkpoint 链接；本次未完成该权重下载与加载核验，也未运行模型，不能据此宣称所有论文设置都已复现。

一个实施时需要注意的细节是：**论文写 Euler 采样，当前公开 RF 类的默认求解器却是 midpoint**，`steps=16` 被用于构造 16 个时间点。复现时应核对具体入口的求解器和模型调用次数，不能仅凭“16 steps”就认为运行成本完全一致。这一差异不影响上文按发表版本解释方法，但会影响代码复现口径。[官方固定版本源码](https://github.com/whwjdqls/DisCoRD/blob/782deffca1a263a2241b6321cfe6532a022f284e/MotionPriors/models/rf_decoder/rectified_flow.py)

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **[T2M-GPT](https://github.com/Mael-zys/T2M-GPT)：** 先学习离散动作编码，再从文本预测 token。DisCoRD 复用这条条件建模路线，替换末端解码器；实验也表明较有限的离散条件可能在补细节时付出文本匹配代价。
- **[MoMask](https://arxiv.org/abs/2312.00063)：** 使用残差量化和掩码建模生成动作，是本文主要配套基座。DisCoRD 保留其动作表示与 token 预测，利用更丰富的量化信息指导连续解码。
- **[Rectified Flow](https://arxiv.org/abs/2209.03003)：** 将分布间生成写成速度场与积分过程。DisCoRD 将这类方法用于动作 token 的条件解码，在原始连续动作空间学习噪声到运动的变换。
- **启发：** 离散 token 不必承担连续运动全部细节的存储与还原。可以让它保留适合条件预测的结构，再交给连续生成器完成细节；但系统应同时检查条件是否保持、自然度是否改善，以及补出的变化是否符合最终任务。

<span id="reading-8" class="reading-anchor"></span>

## 来源

- [ICCV 2025 正式论文与题录](https://openaccess.thecvf.com/content/ICCV2025/html/Cho_DisCoRD_Discrete_Tokens_to_Continuous_Motion_via_Rectified_Flow_Decoding_ICCV_2025_paper.html)，方法及主要结果采用这一发表版本。
- [ICCV 补充材料](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Cho_DisCoRD_Discrete_Tokens_ICCV_2025_supplemental.pdf)，核对实现细节、人工评价、跨任务附加结果与采样耗时。
- [ICCV 官方接收名单](https://iccv.thecvf.com/Conferences/2025/AcceptedPapers)，核对 Highlight；[官方代码固定版本](https://github.com/whwjdqls/DisCoRD/tree/782deffca1a263a2241b6321cfe6532a022f284e)，核对训练/推理入口与默认实现。
- [arXiv 版本入口](https://arxiv.org/abs/2411.19527)，作为预印本身份与版本索引。本文实验数字均为作者报告，非本次复现结果。
- 图为依据论文重新绘制的教学架构示意。笔记更新：2026-10-14。

</div>
