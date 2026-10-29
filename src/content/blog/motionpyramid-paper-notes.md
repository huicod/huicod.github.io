---
title: "[SCA2026] MotionPyramid：先生成可编辑相位，再控制动作的节奏、风格与路径"
description: "解析风格化相位流形、Gram 统计与两级扩散，完整呈现主文和附录实验，区分相位条件生成与文本生成、软接触约束和当前代码版本。"
pubDate: "2026-10-29T14:08:00+08:00"
badge: "Paper"
tags: ["MotionPyramid", "Phase-Manifold", "Motion-Control", "Motion-Style-Transfer", "Text-to-Motion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · SCA / CGF 2026 · 正式全文与附录 A–D</summary>

论文：*MotionPyramid: Controllable Motion Synthesis via Stylized Phase Manifolds*。作者：**Jingyuan Li、Peizhuo Li、Andreas Aristidou、Olga Sorkine-Hornung**。正式发表于 **Computer Graphics Forum 45(8)，SCA 2026 Proceedings**，DOI：[10.1111/cgf.70563][doi]，[Eurographics 正式记录][eg]与 [ETH 页面][eth]均可核对。本文不是同名机器人学习论文。

已完整阅读 [ETH 提供的正式版 PDF][paper]共 **13 页，含附录 A–D**，目视核查架构、主表及附表。入口：[官方项目][project] · [代码][repo]。核查日期 **2026-10-29**。源码检查固定到当前提交，未运行训练/推理，未下载大权重和数据，视频未逐帧评价。

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

MotionPyramid 把文本先变成“做什么、周期进度、连续风格、根路径”的可编辑中间信号，再用相位条件扩散生成完整动作；它把 WalkTheDog 的对齐表示扩展为生成接口，但相位、风格和路径的可编辑性仍不等于逐关节、接触或原动作细节的硬保持。

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 文本到动作模型擅长表达“先走路，再爬上去”等高层意图；轨迹和相位控制擅长表达走向、周期频率和具体时间进度。两类接口分别容易使用，却很难同时给出丰富语义和细粒度控制。

**现有痛点：** 把提示词改成“走得更快”不一定能精确缩短每次迈步周期；直接编辑骨架，又容易破坏自然性和风格。一段已经生成的动作，若只想延长行走、换一条路径或逐渐弓背，通常需要重新生成或进行复杂优化。

**核心矛盾：** 文字太粗，逐帧关节太细。真正可编辑的中间表示既要能组织动作语义，又要把时间和风格分开；过度压缩会丢失表现力，过度扩张又容易失去可解释结构。

**本文目标：** 学习一个无需风格标签的中间动作空间，让用户能修改动作类别片段、相位频率、风格强度和根轨迹，再由生成模型补足具体姿态与多样性。

**切入角度：** WalkTheDog 已将离散运动类别与连续周期相位分开，但其紧凑表示不擅长保留丰富风格，而且最终依赖动作匹配。MotionPyramid 增加一个连续、局部时间稳定的风格变量，并把完整动作恢复交给扩散模型。

**核心 idea：** 先从动作中学出“离散幅值码＋连续相位＋连续风格”，再训练“文本 → 中间信号”和“中间信号 → 动作”两个扩散模型。用户在两级之间操作可解释的信号，从而把高层文本生成与低层动作编辑连起来。[§1–3][paper]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

方法有三个学习环节：**风格化相位自编码器**从骨架动作学表示；**Text2Phase**把文本转为逐帧相位类别、角度、风格和根轨迹；**Phase2Motion**根据这些控制信号生成局部姿态、根运动与脚接触标签。后两者是独立扩散模型，均以无交叉注意力的条件 1D U-Net 为主干。

推理不一定从文字开始：也可以使用已有动作编码得到的相位序列，或手工指定相位和风格。修改中间信号之后，再从噪声合成完整动作，而不是逐帧复制原动作。

<!-- ARCHITECTURE -->
[![MotionPyramid 完整架构教学示意](/paper-notes/motionpyramid/architecture.svg)](/paper-notes/motionpyramid/architecture.svg)

图依次展示离线表示学习、两个扩散模型的监督、以及文本/源动作/人工控制进入同一编辑层的推理流程。箭头表示数据与条件流，三个分区区分表示学习、扩散训练和编辑推理；最终动作来自 Phase2Motion，平均姿态探针不作为最终解码器。图根据原文图 2–4、附录 A 重绘，属于教学示意。

### 关键设计

1. **把动作分成局部姿态、根运动与可编辑控制表示**

   论文以局部姿态 x₁:ₙ 和根轨迹 r₁:ₙ 表示动作。局部姿态包含关节旋转、位置、速度，均在根坐标系下表达；根轨迹用地面二维位置和朝向描述，原文写成 **N × 4**，并以相邻帧坐标系的相对变换参数化。[§3.1][paper]

   根路径与身体姿态分开，能让同一相位内容沿不同路线执行。需要注意，正文 §3.5 又将 Text2Phase 预测轨迹称为全局坐标；公开代码使用的根表示也是另一种维度。本文不把这些表述悄悄合并为一套完全一致的坐标定义，具体差异见后文实现边界。

2. **椭圆表示内容和相位，额外的连续轴表示风格**

   延续 WalkTheDog，幅值向量 A 从有限码本中选取，分成 A⁰、A¹ 两半；连续相位 φ 决定椭圆上的位置：

   <div class="equation">p = A⁰ sin(2πφ) + A¹ cos(2πφ)，m = (p, s)</div>

   A 对应离散类别结构，φ ∈ (−0.5, 0.5] 是周期进度，s ∈ [0, 1] 是连续风格码。固定 A 时，可把 m 理解为高维椭圆柱面：沿椭圆绕行改变运动进度，沿柱面高度改变风格。[式（1）–（2）][paper]

   **1D 风格没有固定语义刻度。** 它可能在某类动作上对应弓背到挺直，也可能对应另一种姿态变化。没有风格标签意味着 s = 0.7 不是普遍定义的“快乐 70%”，更不是跨所有动作统一的情感控制器。风格在短窗口内近似稳定，但整段序列仍可平滑变化。

3. **用 Gram 统计提取幅值与风格，而不是只取时间均值**

   卷积编码器得到通道 × 时间特征后，时间分支估计中心相位与频率；另一分支计算 Gram 矩阵 Gᵢⱼ = ⟨cᵢ, cⱼ⟩，保留不同特征通道的相关性。MLP 从 G 同时输出原始幅值与风格码：幅值进入 VQ 最近邻量化，风格绕过量化，连续地注入重建路径。[§3.3、图 3][paper]

   直觉是，行走时手臂和对侧腿的协同可能比简单平均幅度更能表示“走路”。时间均值会随窗口包含的相位或夸张程度变化，可能把不同风格分到不同内容码，或把不同内容压到同一码。Gram 统计保留二阶关系，但也不能凭结构本身保证完美语义分离，论文用接触分布和平均姿态做验证。

   模型仍用局部周期假设重合成潜在序列：固定窗口中心的 A、s，以 φ + fτ 推进相位，再重建输入。学得表示后，完整动作不再由这个低维自编码器负责恢复，而由后续扩散生成。

4. **Phase2Motion：控制信号与带噪动作逐帧拼接**

   生成目标 O 同时包含局部姿态 x、根轨迹 r 与脚接触标签 f。训练时给 O 加噪，U-Net 根据带噪序列、扩散步 t 和条件 C = {m, r} 预测干净 O₀。条件是逐帧稠密信号，与带噪输入在特征维度拼接；主干采用 AdaGN 调制，不需要用文本与动作交叉注意力寻找时间对应。[§3.4、附录 A][paper]

   轨迹既作为条件，又在输出中预测，因此不能据此推断输出坐标被逐帧直接覆盖成输入轨迹。表 3 中控制误差非零，也说明“trajectory control”不是严格的解析约束。

   训练对轨迹、相位、风格条件引入可学习的缺失替代值，各类条件按 10% 概率随机遮蔽，使网络处理缺失信号。正文只对局部姿态做归一化。全卷积设计支持改变序列长度；这表示架构不限定一个固定长度，不意味着无限长运动已验证没有漂移。[§4.1.1–4.1.2][paper]

5. **接触预测与滑动损失：改善脚滑，但仍是软约束**

   除干净动作重建损失外，作者计算预测姿态与根运动导出的脚速度 v̂，并使用预测接触 f̂ 加权：

   <div class="equation">Lslide = ‖v̂ ⊙ f̂‖²₂；Lp2m = Lm + λslide Lslide</div>

   接触时速度小有助于减少脚滑；预测接触又在 O₀ 的监督中受到约束。它没有在每个采样步骤调用物理求解器，也没有把脚固定到指定世界坐标。因此“foot locking”应理解为训练目标和效果方向，不能改写成精确接触保证。[式（8）–（10）、附录 C][paper]

6. **Text2Phase：预测结构化信号，而不是让语言模型写动作计划**

   冻结的 **CLIP ViT-B/32** 提取文字表示，逐帧扩展后与带噪中间序列拼接，条件 U-Net 预测中间控制信号。原文没有 LLM、思维链文本或强化学习模块。[§3.5、附录 A][paper]

   模型并不直接回归任意 p：它预测码本条目的 one-hot 表示与连续相位角，再由椭圆公式组成 p，同时预测风格码和根轨迹。扩散学习目标是干净中间表示重建。用户可以删除、重复、排列或拼接片段，再修改相位推进速度、风格或轨迹，最后把结果交给 Phase2Motion。

   **类别离散不代表时间离散。** 码本决定使用哪条椭圆，相位沿椭圆连续变化；也不能把这些码看成一个码对应一个固定动作帧或一句可解释词语。

### 一个完整例子

论文图 9 展示“行走片段 → 爬升片段”的重组，图 10–11 展示改频率和风格。下面把这些操作串成教学流程，不表示作者额外验证了所有操作同时组合的成功率。

1. 输入一段文字，例如“走一段，再爬上去”。Text2Phase 从噪声预测一串类别/角度、风格值和根路径。
2. 用户在中间序列中找到行走片段，把它重复一次，再接回爬升片段。改的是控制表示的长度与顺序，不是直接复制原始关节轨迹。
3. 保留行走类别 A，增大相位推进频率，使同样时间内完成更多迈步周期；随后修改连续风格 s，让姿态更弓背或挺直。这里 s 的视觉含义来自该模型与动作的实际表示，不能凭数值先验命名。
4. 为这段动作指定新的根路径，再把编辑后的 m 和 r 一起送入 Phase2Motion。
5. 扩散模型重新生成完整身体、根运动与接触预测。结果应符合所给信号，但身体细节可以变化；未修改区也没有逐帧硬复制保证。

如果已有源动作，可以先编码出其相位与风格，跳过 Text2Phase。该用法继承的是源的中间运动结构，不是宣称保留源动作全部关节、接触和轨迹细节。

### 训练/推理

**三个阶段。** 先无风格标签地训练流形自编码器，学习重建与量化；再用得到的逐帧表示监督 Phase2Motion；对于带文本的 HumanML3D，再训练 Text2Phase。平均姿态 MLP 只用于检查表示和解耦。完整文本生成依次运行两个扩散模型；直接相位条件生成只运行后一级。

**数据与算力。** HumanML3D 使用官方训练/测试划分，其他数据集按动作序列随机 9:1 划分。Phase2Motion 训练用滑动窗口，测试用更长窗口。作者报告单张 **GTX 1080 Ti**：流形学习约 **1 天**，Phase2Motion 与 Text2Phase 各约 **3 天**。没有报告完整端到端推理时间，因此不能仅因 U-Net 较轻就给出实时帧率或延迟。[§4.1][paper]

<details><summary>全部架构与训练参数：原附表 5–7</summary>

表 5，Phase2Motion（PDF p.12）；下表保留原始分组，不把“3–12”误当成只含十个卷积算子。

| 原层号 / 模块 | 描述 |
|---|---|
| 1 Input Process | Linear(input_feats → latent_dim) |
| 2 Condition Masking | 可选条件遮蔽 |
| 3–12 Conditional UNet1D | 时间嵌入 + 下采样 + 中间块 + 上采样 |
| Time Embedding | TimestepEmbedder(time_dim) → Linear(time_dim → 4×time_dim) → Mish → Linear(4×time_dim → time_dim) |
| 下采样路径 | 4 stages；每阶段 CondConv1DBlock × 2，Downsample1d |
| Middle Block | CondConv1DBlock × 2 |
| 上采样路径 | 4 stages；Upsample1d，CondConv1DBlock × 2 |
| 13 Output Process | Linear(latent_dim → output_feats) |

表 6，Text2Phase（PDF p.13）。

| 原层号 / 模块 | 描述 |
|---|---|
| 1 Text Embedding | CLIP Encoder |
| 2 Input Embedding | Linear(input_feats → latent_dim) |
| 3–12 Conditional UNet1D | 同表 5 |
| 13 Output Heads | 四个 Linear：latent_dim 分别映射到 one_hot_vector_feats、phase_feats、style_code_feats、trajectory_feats |

表 7，扩散训练超参数（PDF p.13）；两列相同项显式展开。

| 参数 | Phase2Motion | Text2Phase |
|---|---|---|
| Batch size | 64 | 64 |
| Latent dimension | 512 | 512 |
| Channel multipliers | [2, 2, 2, 2] | [2, 2, 2, 2] |
| Attention Layer | No Attention | No Attention |
| β scheduler | Cosine | Cosine |
| Learning rate | 1e−4 | 1e−4 |
| Optimizer | Adam | Adam |
| Training T | 1000 | 1000 |
| Diffusion loss | x₀-prediction | x₀-prediction |
| Masking | Random Masking | No Masking |
| Unconstrained Synthesis | Yes | — |

**原文内部差异需保留。** §4.1.2 写 T = 100、cosine schedule，附表 7 却写 Training T = 1000；正文流形学习率为 1e−3、扩散为 1e−4。不能擅自将 100/1000 解释成确定的“训练步/采样步”对应，论文没有在此清楚消歧。主文式（5）的 VQ 损失两项之间还印为减号，公开实现则为两个正 MSE 项；本文按“重建＋量化约束”解释目的，不将该符号冲突伪装成已验证的统一公式。

</details>

### 公开资源与当前实现

官方仓库已有 Python 训练、评估、生成和 Unity 导入/回放代码，固定核查提交为 [320949ae，2026-10-07][commit]。README 分别提供 VQ/逐帧嵌入的 ETH Polybox 入口，以及两个扩散 checkpoint 的 Google Drive 目录；本次公开页面确实可见 **HumanML3D_difftest_3、HumanML3D_text2phase_2**，两目录内都可见 **model001680000.pt**。Unity 资源页面可见 **Demos.zip**。这些证明有真实文件入口，尚不证明权重、配置、全部数据及环境能组合跑通。

当前 README 的 Phase2Motion 示例却指向 model001480000.pt，与本次列出的目录文件名不同；实际使用需按可见版本核对。HumanML3D 完整数据仍需按其流程准备、转换并导出，不把一个小 Unity 演示包视为完整训练集。仓库根目录未发现覆盖整个项目的 LICENSE，第三方依赖各有许可；论文 CC BY 不能自动视为全部源码、权重或数据的统一许可。

<details><summary>实现差异：本文按论文讲机制，复现时要另核当前代码</summary>

- 当前 [VQ.py][vq] 的确实现 Gram → MLP → 幅值/风格分支，风格 sigmoid 后绕过 VQ，并逐层注入重建解码；量化损失是两个正项，与纸面式（5）不同。
- 当前 README 的表示训练命令使用 n_latent_channel = 256，附表 10 的论文默认 ambient dimension 却是 128；文本扩散命令学习率为 1e−5，而附表 7 为 1e−4。命令均指定 diffusion_steps = 100，不能代替论文全部实验配置。
- README 明确区分原来的 one-hot 类别＋相位角版本，与新增的 use_manifold 连续嵌入版本。本文描述的是论文前者，不把后来的连续版本混入原表。
- 当前 [mdm.py][mdm] 的原版 Text2Phase 输出为 512 类、2 维归一化相位坐标、1 维风格与 **12 维根表示**；这与论文 N×4 的简述不同。默认生成脚本从数据批次读取预计算 text_embed，CLIP 加载路径在模型构造处被注释；不能仅因源码保留 text_prompt 参数，就宣称已验证任意新文字一条命令运行。
- 论文滑动项使用预测接触加权，当前训练分支还加入接触 BCE、位置/根特征的不同权重；README Phase2Motion 命令设置 lambda_fc = 0。它与附表 8 的“有滑动损失”设置不能自动等同。
- 本次未运行代码或校验 checkpoint；以上只定位公开接口与纸面描述的差异，不对模型实际成败作推断。

</details>

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

**原表 1：训练数据规模及用途（PDF p.6）。** HumanML3D 还用于文本到相位；其余两套用于流形和相位条件动作建模。时长沿用原表。

| 数据集 | 帧数 | fps | 时长 | 动作内容 |
|---|---:|---:|---:|---|
| Locomotion | 151338 | 60 | 42.03 min | Walk、Jog、Run、Side Steps、常规及急转 |
| Styles | 159658 | 120 | 22.17 min | Walk、Jog、Run、Jump、Punch、Kick，8 种风格 |
| HumanML3D | 4146620 | 20 | 57.59 h | 多样的移动与非移动动作 |

**原表 2：按相位分箱的局部关节平均距离，m ↓（PDF p.7）。** 固定 f = 1.25 Hz、初相位 −0.5、s = 0.5，生成多个序列；按相位分为 16 箱，在箱内计算关节两两距离，再跨箱平均。Global baseline 不分箱。它测试同相位的一致性，不是与动作真值的重建误差。

| 动作 | Phase-binned position（m） | Global baseline position（m） |
|---|---:|---:|
| Walk | 0.0854 | 0.2031 |
| Wave | 0.0889 | 0.1105 |
| Kick | 0.0827 | 0.1440 |
| Jump | 0.0682 | 0.1960 |

**原表 3：HumanML3D 测试集，质量/文本指标与控制指标拆开排版，所有行列保留（PDF p.9）。** 两种 Ours 都用真值根轨迹测控制；phase2motion 另给相位条件，text2motion 包含文本到相位步骤，不能混为同输入排行榜。R-precision 是文本动作检索命中率，不是严格指令成功率。Diversity 以真实动作 9.503 为参照，原表未标越大越好。

| 方法 | 控制信号 | FID ↓ | R1 ↑ | R2 ↑ | R3 ↑ | Diversity |
|---|---|---:|---:|---:|---:|---:|
| Real | — | 0.002 | 0.454 | 0.658 | 0.797 | 9.503 |
| MDM | Pelvis | 0.698 | 0.320 | 0.498 | 0.602 | 9.197 |
| PriorMDM | Pelvis | 0.475 | 0.344 | 0.524 | 0.583 | 9.156 |
| GMD | Pelvis | 0.576 | 0.373 | 0.558 | 0.665 | 9.206 |
| OmniControl | Pelvis | 0.218 | 0.418 | 0.614 | 0.687 | 9.422 |
| MoMask | — | 0.065 | 0.462 | 0.668 | 0.776 | 9.402 |
| Ours（phase2motion） | Pelvis (x,z) | 0.043 | 0.415 | 0.612 | 0.726 | 9.353 |
| Ours（text2motion） | Pelvis (x,z) | 0.674 | 0.338 | 0.515 | 0.631 | 8.822 |

| 方法 | Footskating ratio ↓ | Traj. err. ↓（50 cm） | Loc. err. ↓（50 cm） | Avg. err. ↓ |
|---|---:|---:|---:|---:|
| Real | 0.000 | 0.000 | 0.000 | 0.000 |
| MDM | 0.1019 | 0.4022 | 0.3076 | 0.5959 |
| PriorMDM | 0.0897 | 0.3457 | 0.2132 | 0.4417 |
| GMD | 0.1009 | 0.0931 | 0.0321 | 0.1439 |
| OmniControl | 0.0547 | 0.0387 | 0.0096 | 0.0338 |
| MoMask | — | — | — | — |
| Ours（phase2motion） | 0.0535 | 0.0108 | 0.0024 | 0.0382 |
| Ours（text2motion） | 0.0627 | 0.0821 | 0.0165 | 0.0754 |

Traj. err. 是至少一个受控关键帧超阈值的**序列比例**，Loc. err. 是超阈值的**关键帧比例**；二者不是厘米误差。Avg. err. 是生成与目标关节位置的平均欧氏距离，原表未另标单位，本文不补造单位。MoMask 没有该受控关节接口，原表以横线表示不适用。表中没有 CI，不能据小差值宣布统计显著。

<details><summary>原表 4：相位变速和风格平移后的全部左右脚接触相位分布</summary>

PDF p.9；数值为 mean ± std，**不是越低越好的误差，也不是置信区间**。相位区间 [−0.5, 0.5] 首尾环绕。变速测试为选定自然频率的 0.5×/1.5×、s = 0.5；风格测试在 s ∈ [0.3, 0.7] 内改变。原表按左右脚分拆。

| 动作 / 左脚 L | Origin | Slow（0.5×） | Fast（1.5×） | Style shift |
|---|---:|---:|---:|---:|
| Proud walk | 0.302 ± 0.130 | 0.334 ± 0.179 | 0.363 ± 0.174 | 0.298 ± 0.136 |
| Walking back | 0.019 ± 0.150 | 0.066 ± 0.154 | −0.003 ± 0.266 | 0.014 ± 0.153 |
| Ballet kick | −0.104 ± 0.404 | −0.495 ± 0.400 | 0.041 ± 0.380 | 0.438 ± 0.355 |
| Balance beam | 0.259 ± 0.112 | 0.257 ± 0.194 | 0.271 ± 0.096 | 0.269 ± 0.141 |
| All codebook entries | 0.272 ± 0.220 | 0.254 ± 0.230 | 0.229 ± 0.204 | 0.278 ± 0.215 |

| 动作 / 右脚 R | Origin | Slow（0.5×） | Fast（1.5×） | Style shift |
|---|---:|---:|---:|---:|
| Proud walk | −0.206 ± 0.122 | −0.181 ± 0.181 | −0.170 ± 0.215 | −0.191 ± 0.124 |
| Walking back | −0.445 ± 0.182 | −0.418 ± 0.211 | −0.477 ± 0.343 | −0.467 ± 0.197 |
| Ballet kick | −0.190 ± 0.235 | −0.208 ± 0.104 | −0.189 ± 0.101 | −0.168 ± 0.219 |
| Balance beam | −0.181 ± 0.115 | −0.163 ± 0.215 | −0.191 ± 0.115 | −0.184 ± 0.117 |
| All codebook entries | 0.226 ± 0.257 | 0.338 ± 0.271 | 0.237 ± 0.218 | 0.237 ± 0.262 |

作者据此认为接触阶段总体稳定。仍需看到 Ballet kick 左脚分布宽、均值变化较大；循环相位也不能直接按普通直线差比较。这个实验只覆盖接触代理，不能证明所有动作语义和原始细节都严格不变。

</details>

### 消融实验

**Gram 替代平均池化：** 图 6 比较两种表示在改变风格时的接触序列。跳跃两者都能维持接触结构，跑步中 Gram 版本更一致；正文没有给独立分类准确率数字，因此保留为定性消融，不补造提升百分比。

**移除滑动损失：** 重新训练 HumanML3D Phase2Motion，无该损失时，原表 8 的四项指标均变差（PDF p.13）。单位仅沿用原表。

| 指标 ↓ | Without sliding loss | With sliding loss |
|---|---:|---:|
| Root Pos. Error（cm） | 0.194 | 0.148 |
| Root Rot. MSE | 1.556 × 10⁻⁶ | 1.175 × 10⁻⁶ |
| Acc. Root L2（m） | 0.1102 | 0.0831 |
| Foot Contact Error | 0.2589 | 0.2192 |

**码本大小：** 原表 9（HumanML3D，PDF p.13），增大码本改善重建，但 1536 项时使用率降到 78.6%。作者选 512，平衡重建与使用率；这不意味着 512 在每项指标上最好。

| 码本大小 | Reconstruction MSE ↓ | Codebook Usage |
|---:|---:|---:|
| 128 | 0.4498 | 100.0% |
| 256 | 0.4220 | 100.0% |
| 512（Ours） | 0.3906 | 100.0% |
| 1024 | 0.3662 | 99.9% |
| 1536 | 0.3610 | 78.6% |

**流形嵌入维数：** 原表 10（PDF p.13），64 → 128 提升重建，256 略差于 128。这里是 p 的环境维数，不是码本项数或连续相位的自由度。

| Ambient dimension | Reconstruction MSE ↓ | Codebook Usage |
|---:|---:|---:|
| 64 | 0.4215 | 100.0% |
| 128（Ours） | 0.3906 | 100.0% |
| 256 | 0.3926 | 100.0% |

**风格维数：** 原表 11（PDF p.13），1D → 3D 的 MSE 下降，但 Style Coverage 从 82.3% 降至 20.0%。作者用覆盖来衡量编辑更可能留在有效表示区域的程度；正文未给覆盖计算的完整可复现定义，不能把它当成风格识别成功率。

| Style dimension | Reconstruction MSE ↓ | Codebook Usage | Style Coverage |
|---|---:|---:|---:|
| 1D（Ours） | 0.3906 | 100.0% | 82.3% |
| 2D | 0.3722 | 100.0% | 52.0% |
| 3D | 0.3296 | 100.0% | 20.0% |

### 关键发现

1. **相位条件与文本条件的差距很大。** phase2motion 的 FID 0.043 不能拿来宣传完整文本生成性能；text2motion 的 FID 0.674、R1 0.338 与 Diversity 8.822 都显示上游映射仍有明显代价。
2. **控制误差的不同统计量会给出不同优劣。** 相位条件模型的超阈值比例优于 OmniControl，但 Avg. err. 0.0382 仍高于其 0.0338，不能概括成所有控制指标最佳。
3. **重建更准不一定更易编辑。** 更大码本和更多风格维度能减少 MSE，却削弱使用率或有效风格覆盖；本文的表示设计有明确容量取舍。

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **中间表示让编辑发生在生成之前：** 文本提供意图，相位/风格/路径提供可操作结构，扩散负责细节，不必在自然语言里反复试探每个周期。
- **从对齐表示走向随机生成：** 同一个相位信号可以对应多个具体动作，扩散比单点平均姿态 MLP 更适合表达这种一对多关系。
- **风格的结构定义可检验：** 把风格定义为连续且局部时间稳定，使它有明确计算路径；同时用接触与覆盖暴露该定义的边界。
- **附录保留了表达力与可编辑性的相反趋势：** 1D 风格不是表达力最大，而是当前表示中更易保持有效覆盖的折中。

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **不是通用动作语义空间。** 作者明确指出，复杂物体交互、人与人接触和高度非周期结构可能无法被相位/类别＋1D 风格充分表达。
- **风格无统一语义标签。** 一个标量不能保证控制所有独立风格因素，更不等于任意参考风格都能准确迁移；更高维结构又存在覆盖下降。
- **未编辑内容仍会重生成。** 修改相位或风格后，完整动作经扩散重新合成；没有未改关节逐帧拷贝、硬端点或精确场景接触保证。
- **轨迹主要是根层级。** 论文明确承认对单个关节轨迹的精细控制有限，不能从根路径测试推广到手掌对准物体或全身物理交互。
- **文本到相位仍是瓶颈。** 主表保留了完整文本路径的质量和语义退步，不宜只展示条件更充分的 phase2motion 行。
- **论文与发布版本需要对齐。** 100/1000 步、VQ 符号、根表示、默认训练命令与实际 checkpoint 名称均需复现者核对；本次未运行，不将静态差异直接判作模型失败。

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **[WalkTheDog（SIGGRAPH 2024）](/blog/siggraph2024-walkthedog/)：** 本文直接延伸其离散幅值＋连续相位。WalkTheDog 侧重跨形态对齐和目标库检索，MotionPyramid 增加连续风格与两级扩散，不再把完整动作恢复交给 motion matching。
- **[DeepPhase](https://i.cs.hku.hk/~taku/deepphase.pdf)：** 周期自编码器提供时间结构基础；MotionPyramid 进一步把类别、连续风格和文本接口分开，应用边界也不同。
- **[OmniControl](https://arxiv.org/abs/2310.08580)：** 用文本和受控关节条件生成动作。MotionPyramid 更强调周期、风格和序列重组；主表说明根路径控制各指标并非统一优于它。
- **[MoMask](https://arxiv.org/abs/2312.00099)：** 主要处理文本动作生成，原表没有为它计算受控关节指标；它的文本检索和 FID 结果提醒我们，可编辑接口与无条件质量优势是不同问题。
- **启发：** 中间层应同时回答“哪些量能独立操作”和“操作后还剩多少有效数据支撑”，不能只凭漂亮的流形图或低重建误差判断可控性。

<span id="reading-8" class="reading-anchor"></span>

## 来源

1. [Eurographics 正式记录][eg]、[DOI][doi]、[ETH 机构页面][eth]，用于确认 CGF 45(8) / SCA 2026 身份。
2. [正式版 13 页 PDF，含附录 A–D][paper]：§3 方法，§4 主实验，附录 A–B 架构与配置，附录 C–D 滑动损失和表示容量消融。本文转写了原表 1–11 的全部内容。
3. [官方项目][project]与[固定仓库提交][commit]；[Python README][readme]、[Unity README][unityreadme]。
4. [VQ/风格表示实现][vq]、[扩散模型接口][mdm]与[损失实现][loss]，用于区分论文和当前源码，不作为原表已复现的证据。
5. README 链接的 [VQ / 嵌入资源][vqweights]、[扩散权重目录][weights]、[Unity 演示资源][unitydata]。仅核页面和可见文件条目，未下载大包或执行。

图为依据原文重新绘制的中文教学图；数字以正式 PDF 原表为准，未知单位、内部矛盾和负面结果保留。本篇来源审计不等同于模型复现。

</div>

[paper]: https://igl.ethz.ch/projects/MotionPyramid/Mopyramid_SCA2026_camera_ready.pdf
[doi]: https://doi.org/10.1111/cgf.70563
[eg]: https://diglib.eg.org/items/f721ed90-745d-4489-bcea-517b49aa1233
[eth]: https://igl.ethz.ch/projects/MotionPyramid/
[project]: https://lee-abcde.github.io/MotionPyramid_web/
[repo]: https://github.com/Lee-abcde/MotionPyramid
[commit]: https://github.com/Lee-abcde/MotionPyramid/tree/320949aeb15bc0fe32fa1c7ff2c1b15e0cfc59cf
[readme]: https://github.com/Lee-abcde/MotionPyramid/blob/320949aeb15bc0fe32fa1c7ff2c1b15e0cfc59cf/Python/README.md
[unityreadme]: https://github.com/Lee-abcde/MotionPyramid/blob/320949aeb15bc0fe32fa1c7ff2c1b15e0cfc59cf/Unity/README.md
[vq]: https://github.com/Lee-abcde/MotionPyramid/blob/320949aeb15bc0fe32fa1c7ff2c1b15e0cfc59cf/Python/models/VQ.py
[mdm]: https://github.com/Lee-abcde/MotionPyramid/blob/320949aeb15bc0fe32fa1c7ff2c1b15e0cfc59cf/Python/models/mdm.py
[loss]: https://github.com/Lee-abcde/MotionPyramid/blob/320949aeb15bc0fe32fa1c7ff2c1b15e0cfc59cf/Python/diffusion/gaussian_diffusion.py#L1788-L1867
[vqweights]: https://polybox.ethz.ch/index.php/s/3reE6rGw5jfpgeq
[weights]: https://drive.google.com/drive/folders/1arDtyJ3mjQpeoAO6PO-wChmPTKt-k2Op
[unitydata]: https://drive.google.com/drive/folders/1Tq-V6qf6q3_Ufu-fJOEJ1kXXRY6GM5MP

