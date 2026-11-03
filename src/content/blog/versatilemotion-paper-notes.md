---
title: "[ECCV2026] VersatileMotion：用同一套动作词表连通文字、音频与多人运动"
description: "从保留世界坐标的 VerMoVQ、因果身体 token、统一动作消息和两阶段任务采样，理解 VersatileMotion 的九任务框架，并核对正式版实验与早期 FlowVQ 版本的差别。"
pubDate: "2026-11-03T12:42:00+08:00"
badge: "Paper"
tags: ["VersatileMotion", "MotionHub", "Multimodal-Generation", "Motion-Understanding", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · ECCV 2026</summary>

*VersatileMotion: A Unified Framework for Motion Synthesis and Comprehension*。作者 Zeyu Ling、Bo Han、Shiyang Li、Jikang Cheng、Hongdeng Shen、Changqing Zou。发表于 ECCV 2026，正式章节 DOI 为 10.1007/978-3-032-37335-9_19。本篇以会议公开的 21 页 PDF 为技术主版本，已核对正文、图 2 及表 2–8；其中仅包含正文与参考文献，未取得正文引用的补充材料。研究覆盖文字、音乐、语音与单人/多人动作之间的生成、描述及时间补全。核查日期：2026-11-03。[正式记录][venue] · [会议公开全文][paper] · [作者仓库][code] · [MotionHub 数据][dataset]

**版本需要区分：** [早期工作使用 MotionLLaMA 名称](https://arxiv.org/abs/2411.17335v1)，arXiv:2411.17335v2 仍采用 FlowVQ 和 generalist→specialist 三阶段叙述；ECCV 正文改为 VerMoVQ 与两阶段 generalist 训练。本文架构、表格按 ECCV 主文讲解。当前仓库 README 仍保留部分旧版内容，正式版核心模型实现的发布项尚未完成，不能据此把不同版本拼成一个系统。[早期版本][old] · [正式版 §3][method] · [仓库发布说明][code]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

VersatileMotion 先把保留世界空间运动的身体状态编码成因果、分关节的离散 token，再把动作、文字和音频排成同一种“指令—条件—回复”消息，用一个自回归模型完成生成与理解。它的核心是让动作表示和训练数据适合共享的下一 token 预测，而不是为每种任务增加一套生成网络。[§1、§3][method]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 文本到动作、音乐到舞蹈、语音到手势和双人交互已有不同的生成系统，TM2T、MotionGPT 等则证明了动作离散化后可以与文字共同建模。后一条路线尤其适合同时处理“根据描述生成动作”和“观看动作写描述”，因为两者只需交换条件与目标的位置。[§1–2][intro]

**现有痛点：** 同一个虚拟角色可能需要按文字走路、随音乐跳舞、随讲话做手势，再与另一角色互动。单一任务模型通常只覆盖其中一部分；把多个模型接起来，也没有自动获得共同的动作表示、人物空间关系和统一任务接口。[§1][intro]

**核心矛盾：** 自回归模型可以统一处理不同序列，但输入 token 必须保留任务所需的信息。把全身压成单一帧向量会增加量化压力，非因果编码会借助未来帧，而多人任务还需要明确保留相互位置。同时，文字动作样本远多于音乐、语音样本，统一训练并不意味着每项任务都被充分学习。[§3.1–3.3][method]

**本文目标：** 在共享词表和同一个 decoder-only Transformer 中，覆盖单人/多人文字到动作与动作到文字、音乐到舞蹈、舞蹈到音乐、语音到手势、动作预测和补间九项基准任务，并支持文字加音频等组合条件。[§1、§4.1][setup]

**切入角度：** 作者先改进动作 tokenizer：显式保留根位置与速度，把每帧拆成多个低维身体 token，在时间轴使用因果卷积、在身体轴使用注意力。再通过 MotionHub 和分阶段任务采样，让同一个语言模型接触足够多的模态与任务。[§3][method]

**核心 idea：** 先让 tokenizer 同时照顾几何重建、身体结构和向前生成的一致性，再将各种输入输出写成统一消息。预训练按数据规模建立动作先验，指令微调改为按任务均匀采样，使稀缺的音频任务也获得足够训练机会。[§3.2–3.3][token]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

流程分为动作分词器与统一自回归模型两层。VerMoVQ 将连续动作变为“时间位置 × 身体位置”的离散索引，再展开为一维序列；文字与音频使用各自的分词器。任务消息把已知模态放入条件、待生成模态放入回复，同一个 Transformer 逐 token 预测回复，最后调用对应模态解码器。多人动作共享同一 tokenizer，以人物分隔符连接各人的序列。[图 2、§3][method]

<figure class="paper-figure"><a href="/paper-notes/versatilemotion/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/versatilemotion/architecture.svg" alt="VersatileMotion 完整架构：世界空间动作经过因果时空 VerMoVQ 与 FSQ，与文字音频共同组成任务消息；统一自回归模型预测回复，按模态解码，训练支线区分 tokenizer 与两阶段任务采样。" /></a><figcaption>依据 ECCV 正式版 §3.1–3.3 和图 2 重绘的教学示意。训练流程按正文的两阶段 generalist 方案绘制；原图 2 仍保留 Specialist SFT 字样，图文差异在下文说明。<a href="/paper-notes/versatilemotion/architecture.svg" target="_blank" rel="noopener">查看大图</a></figcaption></figure>

先看上方的 VerMoVQ 训练，连续动作保留根运动并变为身体 token；中间是 MotionHub 支持的两阶段自回归训练；下方才是不同模态条件汇合为消息、生成回复并解码的推理主线。实线表示数据流，金色虚线表示训练监督或已学习参数的复用。人物分隔符决定如何拆回各人的动作序列，采样回线表示此前生成的回复会成为后续预测的上下文。[§3.1–3.3][method]

### 关键设计

1. **显式保留世界空间的根运动，方便表达多人关系。** 每帧状态包含根位置 p、根速度 v，以及各关节的 6D 旋转 R。位置与速度合成一个六维 token，其余 token 各承载一个关节的六维旋转，形成 X∈R<sup>T×K×6</sup>。这里 T 是帧数，K 是身体 token 数。这样，两人的动作都能携带各自的根轨迹，并在共同坐标约定下表达相对位置。它强调的是显式世界坐标的便利；HumanML3D 等表示也包含可积分的根运动信息，不能笼统理解成其他表示完全无法恢复全局运动。[§3.1–3.2、式 1–2][representation] · [HumanML3D 原始表示与恢复代码](https://github.com/EricGuo5513/HumanML3D/blob/main/motion_representation.ipynb)

2. **时间上只看当前与过去，身体上交流关节信息。** VerMoVQ 的编码器和解码器均使用严格因果的时间卷积，当前位置不读取未来帧，减少完整片段编码与向前生成之间的可见信息差异。卷积沿时间处理身体 token，而每个时刻的身体自注意力负责在根运动、腿、躯干和手臂之间交换信息。输出潜变量的形状为 L×K×d，其中 L 是时间降采样后的长度，d 是隐通道数。身体轴仍被保留，不把整帧提前压成一个向量。[§3.2、式 3][token]

3. **对每个时空位置做 FSQ，再展开成语言模型序列。** 正式版选用有限标量量化（FSQ），将隐表示各维映射到固定标量等级，组合为离散索引。它不需要学习向量码本中心，也没有额外的码本损失和承诺损失。所得 L×K 索引按时间和身体位置展开，成为自回归模型可预测的动作词。虽然论文先用通用 VQ 符号说明接口，具体实现选择应按后面的 FSQ 段落理解。这些码对应身体状态的压缩表示，并非人工定义的“挥手开始”“接触完成”等语义事件。[§3.2][token]

4. **用消息的排列定义任务，而不为每项任务改网络。** 文字经子词分词器，语音与音乐经音频 VQ-VAE，动作经 VerMoVQ；各模态保留自己的 token 类型及起止标记。消息由 Instruction、Condition、Reply 组成，条件可包含文字、音频、已有动作、人数或时长等元数据。模型见到前两部分后预测回复：文字→动作和动作→文字因条件/回复交换而成为不同任务。训练时随机加入可选条件，帮助模型适应条件组合。[§3.3][message]

5. **多人复用同一码空间，但生成仍需学会人物协调。** 各人使用相同动作编码器和量化器，通过人物分隔符串接 token 流。世界空间根信息保留下来，使后续人物能在共同上下文中建模；预训练还把单人片段组成伪双人数据，增加多人格式的训练曝光。表 8 显示这项策略有效，但串接结构本身没有碰撞检测、接触约束或物理求解器，不能单凭统一序列就保证互动几何正确。[§3.3、§4.6、表 8][ablation]

6. **改变采样顺序，让稀缺音频任务真正参与训练。** 第一阶段按数据比例取样，对整个消息做下一 token 预测，建立共享先验。第二阶段先均匀选择一个可用任务，再取该任务样本，并只监督回复 token。论文指出，音乐条件样本在可用数据中不足 1%；若一直按数据量抽样，模型可能几乎学不到如何使用音乐。任务均匀采样提高音频任务曝光，同时继续训练已有任务，降低遗忘风险。这里的“双路径”是训练采样策略，不是两个推理生成器。[§3.3，第 9 页][sampling]

### 一个完整例子

沿用正文第 8 页的消息示例：给定音乐，并要求“两位舞者做互补动作，一位顺时针旋转，另一位向上跳”。以下按论文格式展开数据流；示例中的中间 token 是格式说明，不代表已运行出的结果。[§3.3 消息示例][message]

1. 音频分词器把音乐变成音频 token；文字分词器编码动作要求。人数字段填入两人，若指定时长，再加入相应条件字段。
2. 把“按给定音乐和描述生成动作”写成指令，将两种输入及元数据放入条件段。此时没有目标动作的真实 token。
3. 自回归模型逐个预测动作索引，并在人物边界输出分隔标记。每一步读取输入条件和此前已产生的回复。
4. 按人物边界拆开输出，将每个人的一维动作码还原为时间×身体索引，经过 FSQ 对应值和 VerMoVQ 解码器，恢复根位置、速度及关节旋转。
5. 两个人体在共同坐标系中播放。旋转和跳跃是否在合适乐句发生、双方有没有穿插或不合理接触，需要检查最终动作；人数与时长字段也只是模型条件，正文没有给出硬约束投影机制。

若换成“描述这两个人在做什么”，则先编码已有双人动作，将其放入条件段，回复改为文字。共享的是模态词表与自回归骨干，输入序列的构造和输出解码器随任务改变。[§3.3][message]

### 训练/推理

VerMoVQ 的重建损失为 L<sub>rec</sub>=L<sub>param</sub>+λ<sub>fk</sub>L<sub>fk</sub>：前一项约束根平移、速度和旋转参数的 L1 误差，后一项通过前向运动学（FK）约束以根为中心的三维关节位置。两个约束分别照顾参数还原与姿态几何；由于 FK 项是根中心化的，世界轨迹仍需由根参数重建项承担。[§3.2、式 4][token]

统一模型的正式正文给出 generalist 预训练和 generalist SFT 两阶段，默认骨干为 LLaMA 3.2–1B。原图 2 仍绘有第三阶段 Specialist SFT，而正文 §3.3 没有相应阶段描述；本文遵循正文，并把表 7 的 single-task specialist 视为对照设置，不把最终主表自动解释成多个单任务模型的汇总。[§3.3、表 7–8][sampling]

论文使用约 380K 片段的 MotionHub，动作统一到 SMPL 风格表示、30 FPS。当前公开 MotionHub 已扩展到约 1.11M 片段、1,528 小时，采用 SMPL-H 52 关节格式，是另一个发布快照，不能直接作为论文训练规模。正式主文未完整披露训练步数、批量、GPU 小时和全部 tokenizer 超参数；这些细节所指的补充材料尚未取得。当前正式版核心训练/推理实现仍在待发布清单，本篇未运行模型。[§4.1][setup] · [当前数据版本][dataset] · [发布状态][code]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

MotionHub 测试集的 tokenizer 重建，摘自原表 2。MPJPE 与 PA-MPJPE 单位为 mm，MPJRE 为度；1P/2P 指单人/双人。[原表 2，第 10 页][reconstruction]

| 设置 | 方法与量化配置 | MPJPE ↓ | PA-MPJPE ↓ | MPJRE ↓ | 码本使用率 ↑ |
|---|---|---:|---:|---:|---:|
| 1P | MotionStreamer，连续 TAE | 36.42 | 27.21 | 7.76 | — |
| 1P | Go-To-Zero，FSQ 64k | 27.19 | 21.19 | 6.35 | 83.7% |
| 1P | VerMoVQ，1D RVQ 1k×6 | 12.34 | 9.49 | 3.43 | 100.0% |
| 1P | VerMoVQ，2D FSQ 4k | 19.81 | 11.67 | 2.15 | 99.2% |
| 1P | VerMoVQ，2D FSQ 16k | 18.13 | 10.51 | 1.93 | 97.3% |
| 1P | VerMoVQ，2D FSQ 64k | 13.54 | 8.38 | 1.50 | 59.2% |
| 2P | Go-To-Zero，FSQ 64k | 38.80 | 28.89 | 7.60 | 60.9% |
| 2P | InterMask，VQ 1024 | 67.10 | 51.14 | 10.61 | 99.5% |
| 2P | VerMoVQ，2D FSQ 16k | 18.52 | 10.73 | 2.07 | 97.8% |

单人文字到动作，摘自原表 3，全部使用作者训练的 TMR 特征评测。R@1/R@3 为对应检索精度，MM-D 为文字与动作特征距离；不同评测器下的 FID 不宜直接与其他论文榜单横比。[原表 3，第 11 页][t2m]

| 数据集 | 方法 | R@1 ↑ | R@3 ↑ | FID ↓ | MM-D ↓ |
|---|---|---:|---:|---:|---:|
| HumanML3D | MotionGPT | 0.313 | 0.502 | 0.324 | 1.155 |
| HumanML3D | MotionStreamer | 0.460 | 0.715 | 0.065 | 1.024 |
| HumanML3D | HY-Motion | 0.561 | 0.797 | 0.185 | 1.063 |
| HumanML3D | Go-To-Zero | 0.443 | 0.653 | 0.075 | 1.052 |
| HumanML3D | VersatileMotion | 0.457 | 0.692 | 0.062 | 1.039 |
| MotionHub | MotionGPT | 0.129 | 0.243 | 0.434 | 1.237 |
| MotionHub | MotionStreamer | 0.190 | 0.367 | 0.411 | 1.176 |
| MotionHub | HY-Motion | 0.417 | 0.621 | 0.363 | 1.148 |
| MotionHub | Go-To-Zero | 0.291 | 0.464 | 0.101 | 1.130 |
| MotionHub | VersatileMotion | 0.408 | 0.612 | 0.098 | 1.122 |

作者指出，多数基线没有在 MotionHub 上训练。因此第二组结果同时受到数据覆盖差异影响，不能全部归因于网络结构。[§4.3][t2m]

双人文字到动作，原表 4。R-P 沿用原表名称，原表没有标出具体 Top-k；Diversity 的 → 表示接近真实动作的 25.25。[原表 4，第 11–12 页][multiperson]

| 方法 | R-P ↑ | FID ↓ | MM-D ↓ | Diversity → |
|---|---:|---:|---:|---:|
| ComMDM，在对应数据上重训 | 0.141 | 1.01 | 1.357 | 17.80 |
| InterGen | 0.367 | 0.77 | 1.265 | 22.51 |
| InterControl | 0.413 | 0.66 | 1.211 | 22.16 |
| InterMask | 0.508 | 0.43 | 1.147 | 23.44 |
| VersatileMotion | 0.473 | 0.51 | 1.165 | 23.11 |

这组评测使用多人 TMR。作者说明，多数基线在首帧根相对坐标下计算，再回填真实根信息；VersatileMotion 直接在世界坐标下评价。这个处理差异需要连同数值保留。[§4.4][multiperson]

动作描述，摘自原表 5。R-P 是 64 个候选中的 Top-3 检索精度，MM-D 使用 TMR；BERT 使用 RoBERTa-large，MET 为 METEOR，Sim 使用 Sentence-BERT。以下保留原始量纲，不当作百分比。[原表 5，第 12 页][m2t]

| 测试集 | 方法 | R-P ↑ | MM-D ↓ | BERT ↑ | MET ↑ | Sim ↑ |
|---|---|---:|---:|---:|---:|---:|
| HumanML3D，1P | MotionGPT | 0.398 | 1.123 | 0.895 | 0.367 | 0.598 |
| HumanML3D，1P | TM2T | 0.536 | 1.062 | 0.909 | 0.403 | 0.670 |
| HumanML3D，1P | VersatileMotion | 0.686 | 1.044 | 0.909 | 0.370 | 0.642 |
| MotionHub，1P | TM2T | 0.186 | 1.257 | 0.884 | 0.190 | 0.539 |
| MotionHub，1P | VersatileMotion | 0.509 | 1.115 | 0.901 | 0.422 | 0.694 |
| MotionHub，2P | TM2T，重训 | 0.623 | 1.089 | 0.882 | 0.378 | 0.615 |
| MotionHub，2P | MotionGPT，重训 | 0.691 | 1.045 | 0.907 | 0.420 | 0.662 |
| MotionHub，2P | VersatileMotion | 0.778 | 0.994 | 0.929 | 0.466 | 0.728 |

MotionHub 的预测与补间，摘自原表 6 的“一帧+文字”设置。ADE/FDE 保留原表量纲，公开主文没有明确写出其单位，不能自行补成米或毫米。[原表 6，第 13 页][completion]

| 任务 | 方法 | R-P ↑ | FID ↓ | ADE ↓ | FDE ↓ |
|---|---|---:|---:|---:|---:|
| 预测 | MDM | 0.351 | 0.360 | 0.951 | 1.819 |
| 预测 | MotionGPT3 | 0.285 | 0.293 | 1.041 | 1.929 |
| 预测 | VersatileMotion | 0.423 | 0.184 | 0.816 | 1.542 |
| 补间 | MDM | 0.399 | 0.356 | 0.950 | 1.792 |
| 补间 | MotionGPT3 | 0.312 | 0.276 | 1.021 | 1.884 |
| 补间 | VersatileMotion | 0.453 | 0.166 | 0.794 | 1.482 |

**音频与长动作结果的核查范围。** 正文 §4.5 报告音乐到舞蹈的 AIST++ FID/FIDₖ 为 0.152/24.85，FineDance 为 0.185/32.48；AIST++ 加入文字后 FID 为 0.138。BABEL 长动作报告 R@3=0.489、FID=0.106。但这些数值对应的表 9–11，以及语音手势表 15，都不在已取得的 21 页 PDF 中。这里仅转述正文给出的结果，暂不补造完整横向表，也不把旧 arXiv 的语音指标当作正式版结果。[§4.5，第 12–13 页][additional]

### 消融实验

**所有任务共同训练。** 表 7 将统一模型与各任务单独训练的 specialist 比较。共同训练后，文字动作 FID 从 0.075 降至 0.062；文字+音乐到舞蹈的 FIDₖ 从 32.5 降至 23.52，BAS 从 0.215 升至 0.238；文字+语音到手势的 FID 从 0.399 降至 0.346。这里的 specialist 是对照训练设置。[原表 7][ablation]

**生成与理解相互促进。** 表 8(i) 中，只训练文字到动作时 FID 为 0.074，联合训练后降至 0.062；只训练动作到文字时 R@3 为 0.658，联合后为 0.686。两种方向在本文数据与训练设置下带来互补收益。[原表 8][ablation]

**语言模型初始化。** 表 8(ii) 中，随机初始化的 1B 模型文字动作 FID 为 0.147、R@3 为 0.549；LLaMA 3.2–1B 初始化后为 0.062、0.692。更大的 Qwen3–1.7B 将 FID 略降到 0.060，但 R@3 为 0.690，动作描述 R@3 也低于 LLaMA 3.2–1B 的 0.686。[原表 8][ablation]

**伪多人预训练。** 表 8(iii) 只评价双人任务。将单人片段组合成伪双人样本用于预训练后，双人文字动作 FID 从 0.60 降至 0.51，R-P 从 0.427 升至 0.473；双人动作描述的 R@3 从 0.544 升至 0.778。正式主文没有展开伪配对的完整构造细节。[原表 8、§4.6][ablation]

**码本大小与身体 token。** 表 2 中，2D FSQ 从 16k 增至 64k，单人 MPJPE 从 18.13 mm 降至 13.54 mm，码本使用率从 97.3% 降至 59.2%。1D RVQ 的 MPJPE 更低，为 12.34 mm，但作者依据补充表 12 的下游生成结果选择 2D。已核对的表 2 证明重建层面的取舍，补充表 12 的具体生成数字尚未取得。[原表 2、§4.2、§4.6][reconstruction]

### 关键发现

1. **较好的分布质量不等于所有语义指标领先。** HumanML3D 上 VersatileMotion 的 FID 最低，但 HY-Motion 的检索精度更高，MotionStreamer 的 MM-D 更低；动作描述中，TM2T 的 METEOR 和 Sentence-BERT 相似度也仍更高。[表 3、表 5][t2m]
2. **多人共享接口有竞争力，专用交互模型仍有优势。** 世界空间表示加人物串接已能处理双人生成，表 4 中 InterMask 仍在列出的四项指标上更好。因此结果支持多任务覆盖，不能写成所有多人控制都优于专用方法。[表 4][multiperson]
3. **重建最优与生成最优需要分别比较。** 1D RVQ 重建误差更低，作者仍选择 2D 身体 token。这提醒我们，tokenizer 还会改变语言模型的预测难度，不能只用重建误差选生成表示。[表 2、§4.2][reconstruction]
4. **统一训练的收益有直接对照，但九任务总排名还需补充材料。** 表 7–8 已支持多任务与生成/理解协同的收益；完整语音、音乐和长动作的横向证据仍需对应补充表。作者“九项中七项领先”的总结不应替代逐任务核对。[表 7–8、§4.5][ablation]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **把统一能力落实到表示和采样机制。** 单一 Transformer 只是公共执行骨干，世界根信息、身体因子化和任务曝光才决定它实际能学到哪些能力。本文把这几层放在同一框架内设计。[§3][method]
- **因果性贯穿动作编解码，而不只属于语言模型。** 若动作编码器提前看未来，语言模型的前缀就未必对应可独立解码的过去。对编码与解码都施加时间因果约束，为预测、续接和可变长度处理提供更一致的接口。[§3.2][token]
- **几何维度上的因子化可以提高动作词的可组合性。** 根状态与关节旋转分开量化，同时用身体注意力交换信息，使局部表示与全身协调能够并存。它提供的是表示结构，并未直接给出可读动作事件或用户逐关节编辑接口。[§3.2][token]
- **生成与理解共享监督值得单独检验。** 表 8 的双向联合训练优于各自单独训练，说明描述任务可能帮助生成器组织语义，生成任务也可能帮助理解器学习更好的动作关系。这是本次对照支持的效果，具体迁移原因仍需进一步分析。[表 8(i)][ablation]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **统一词表没有给出任意条件满足的保证。** 文字、音乐、语音、人数、时长可以作为条件，输出仍由概率模型采样。正文没有指定关节坐标、接触时刻或精确节拍事件的强制投影；分身体 token 也不能直接等同于各部位可独立、精确编辑。[§3.3][message]
- **人物数量的结构扩展不等于已验证大群体。** 共享码本和人物分隔符可以表达更多人物，但公开定量结果集中在单人和双人。人数增加后的上下文长度、相互碰撞、角色一致性和推理速度需要另做实验。[§3.3、表 4][multiperson]
- **因果 token 不自动证明实时交互。** 因果性使前缀处理更自然，但每个时间位置有多个身体 token，多个人物又增加序列长度。公开主文没有给出足以判断直播场景的端到端延迟、首帧等待和长时累积误差曲线。[§3.2、§4.5][additional]
- **数据与评价口径影响比较结论。** MotionHub 扩大了训练覆盖，TMR 也按作者的数据与协议重新训练。多人基线的真实根回填和部分方法未在 MotionHub 上训练，都需要在复现时明确控制。将表示、数据量和采样策略分别固定后比较，才能更清楚地定位收益来源。[§4.1–4.4][setup]
- **正式版复现材料尚不完整。** 当前主文的图 2 与训练章节存在阶段差异，部分关键表与实现细节在未取得的补充材料中；公开主分支也尚未发布正式版核心模型实现。本文因此是一份原文核查与机制分析，不是已经复现九项任务的运行报告。[正式全文][paper] · [仓库状态][code]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **[MotionGPT](https://arxiv.org/abs/2306.14795)（NeurIPS 2023）。** 两者都将动作离散化并与文字共同建模。VersatileMotion 进一步面向音频和多人条件设计动作表示与消息格式，并用 decoder-only 自回归骨干处理不同目标模态。[本文 §2–3][method]
- **[MotionStreamer](https://openaccess.thecvf.com/content/ICCV2025/html/Xiao_MotionStreamer_Streaming_Motion_Generation_via_Diffusion-based_Autoregressive_Model_in_Causal_ICCV_2025_paper.html)（ICCV 2025）。** 两者重视因果动作表示与逐步生成。MotionStreamer 以连续潜变量和扩散头处理流式文本动作，VersatileMotion 使用离散 FSQ 词表，把理解、音频和多人任务也纳入统一序列。时间因果性相近，输出空间与任务重点不同。[本文表 2–3][reconstruction]
- **[InterMask](https://arxiv.org/abs/2410.10010)。** InterMask 为双人动作设计交互建模，VersatileMotion 通过共享动作 tokenizer 和人物串接扩展到双人。正式表 4 中 InterMask 更强的数值说明，统一接口与交互专用结构各有价值。[本文 §4.4][multiperson]
- **[UniMuMo](https://arxiv.org/abs/2410.04534)（AAAI 2025）。** UniMuMo 让动作适配音乐码本，并以双流模型连接音乐与动作；VersatileMotion 为动作单独设计时空 tokenizer，再把不同模态放入统一消息。前者的音乐动作双流与后者的统一 token 序列是两种不同的共享方式。[本文 §2–3][method]
- **启发。** 对需要讲解、跳舞与互动的虚拟人，可以先用公共表示连接多个任务，再增加对动作事件、空间目标和接触的显式约束。由本文结果推导，最值得分开验证的是“统一接口带来的覆盖”“跨任务数据带来的迁移”与“解码后的精确执行”，三者不能仅凭一张总体架构图互相替代。

<span id="reading-8" class="reading-anchor"></span>

## 来源

- ECCV 2026 正式章节与会议公开 PDF。本文按公开 21 页版本解读；已核对主文图 2、表 2–8，未取得其引用的表 9–15 和完整补充材料。原文图 2 的第三阶段与 §3.3 的两阶段叙述不一致，本文按正文解释。[正式章节][venue] · [会议公开全文][paper]
- arXiv:2411.17335 的早期版本用于确认名称和方法沿革；其中 FlowVQ 及旧版实验没有混入正式版架构和数值。[arXiv 记录](https://arxiv.org/abs/2411.17335) · [旧版全文][old]
- 官方代码主分支发布说明快照，及扩展后的 MotionHub 数据快照。代码、数据可访问不等于正式模型已经可完整复现；本文未运行训练或推理。[代码快照][code] · [数据快照][dataset]
- 本站架构图依据正式 §3.1–3.3 重绘，为教学示意；表格按原表选行、选列，保留数值与评测口径。

</div>

[venue]: https://link.springer.com/chapter/10.1007/978-3-032-37335-9_19
[paper]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf
[intro]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=2
[method]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=6
[representation]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=7
[token]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=7
[message]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=8
[sampling]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=9
[setup]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=9
[reconstruction]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=10
[t2m]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=11
[multiperson]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=11
[m2t]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=12
[completion]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=13
[additional]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=12
[ablation]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/1172.pdf#page=14
[old]: https://arxiv.org/html/2411.17335v2
[code]: https://github.com/ZeyuLing/VersatileMotion/blob/e521f36dd5ad317bd8b47e69878d0eac79915e58/README.md
[dataset]: https://github.com/ZeyuLing/MotionHub/blob/d74b6686a4825740c1512c80452ab189dfcd8f0a/README.md
