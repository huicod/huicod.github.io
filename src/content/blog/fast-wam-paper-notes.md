---
title: "[NeurIPS2026] Fast-WAM：机器人动手前，需要先生成一段未来视频吗？"
description: "以双臂折毛巾为例，拆开训练时的视频预测、部署时的首帧视觉编码和十步动作采样。通过同架构对照、仿真成功率、真机折叠时间及延迟，看清省去未来视频的收益与代价。"
pubDate: "2026-11-19T17:55:00+08:00"
badge: "Paper"
tags: ["Fast-WAM", "World Action Model", "Robot Manipulation", "Video Pretraining", "Flow Matching", "Multimodal Learning", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 全文][html] · [原文 PDF][pdf] · [会议记录][venue] · [项目演示][project] · [代码][code] · [权重][weights]

<details class="paper-meta"><summary>论文信息与阅读范围 · NeurIPS 2026 Spotlight</summary>

*Fast-WAM: Do World Action Models Need Test-time Future Imagination?*，作者为 Tianyuan Yuan、Zibin Dong、Yicheng Liu、Hang Zhao。NeurIPS 2026 会议已列出该文，第一作者主页确认 Spotlight。研究方向是用预训练视频模型驱动机器人操作。下文方法和实验以 arXiv v2 为准，源码核对固定在提交 7faa711，仓库后续加入的加速和可选 IDM 另行标明。[会议记录][venue] · [第一作者主页][author] · [论文版本][abs] · [代码版本][code]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

机器人折毛巾时，Fast-WAM **每次仍用视频模型看一遍当前画面，但可以省去逐步生成未来画面的计算**。作者在训练时保留预测未来视频的任务，部署时只用当前画面的特征指导动作生成。单卡测量中，先生成视频再预测动作耗时 810 ms，Fast-WAM 耗时 190 ms；真机上前者折叠成功率更高，后者平均完成得更快。[方法图 2][fig2] · [真机图 4][real]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 给机器人一张桌面的图像和“把毛巾叠好”这条指令，视觉语言动作策略可以直接输出机械臂动作。世界动作模型（WAM）还会学习接下来的画面怎样变化；有些模型先画出几帧未来，再从中反推机械臂怎样运动。[§2–3.1][problem]

**现有痛点：** 制作未来视频需要反复更新大量视觉 token。倘若机械臂只需要下一段控制量，这些中间画面究竟帮助了多少次抓取，值得单独测量。[图 1][fig1]

**核心矛盾：** 一个在训练和测试时都预测未来的模型若表现较好，可能是训练任务让模型学会注意手、布边和物体状态，也可能是在线生成的未来轨迹真的提供了额外决策线索。单看该模型的最终成功率，分不清两种原因。[§1、§3.3][variants]

**本文目标：** 让几种策略使用相近的主干、动作表示和训练配方，分别改变训练时有没有视频监督，以及测试时动作能不能读取生成的未来。用任务成功率、任务完成时间和单次推理延迟检验三种后果。[§3.3、§4.2][variants]

**切入角度：** 当前画面是两项预测都能使用的信息。只要训练时就限定动作分支能看哪些画面，未来视频便可成为训练监督，而部署时只需计算观测到的这一帧。[§3.2、图 2][fig2]

**核心 idea：** 让当前帧的视觉特征同时服务于“接下来画面会怎样”和“机械臂接下来怎样动”两项学习任务。测试时把这份视觉特征缓存下来，动作专家在同一份特征上迭代生成动作。[§3.2][arch] · [动作推理代码][infer]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

Fast-WAM 有两个 Transformer 专家。视频专家来自 Wan2.2-5B，动作专家约 1B 参数，二者通过注意力交换允许读取的信息。**训练**输入当前观测、指令、未来视频和示范动作。**部署**输入当前观测和指令，返回一段连续动作。这里“视频模型只跑一遍”指每次生成动作块前，对当前帧进行一次视觉编码；动作采样仍有十步。[§3.2、§4.1][arch] · [实现][infer]

<figure class="reading-figure"><a href="/paper-notes/fast-wam/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/fast-wam/architecture.svg" alt="Fast-WAM 的训练和部署。干净首帧为两路带噪输入提供视觉条件。部署时视频专家从当前画面计算一份缓存，动作专家用十步去噪输出三十二个动作。" loading="lazy" /></a><figcaption>按论文图 2 和作者的动作推理实现重绘，点击可放大。上半图从绿色首帧沿箭头看两项训练任务能读取什么，下半图追踪一次动作请求。橙色表示未来视频监督，蓝色表示动作。</figcaption></figure>

### 关键设计

1. **把视频中真正已知的部分单独编码。** 多台相机的同步画面先拼成一张图，再经视频 VAE 得到当前帧 token。任务指令由 T5 编码，视频和动作两边都可通过交叉注意力读取它。训练时另有带噪的未来视频 token 和带噪的动作 token，推理时从高斯噪声初始化动作块。源码也允许配置机器人本体状态并将其加入上下文。[§3.2][arch] · [源码][infer]

2. **用注意力掩码堵住未来信息的捷径。** 首帧 token 只读取同组首帧。未来视频组可读取首帧及未来视频组内的信息；动作组可读取首帧及动作组内的信息。动作 token 因而无法借用训练示范中真实的未来画面，必须学习用当前观测做决定。首帧既参与视频预测，也参与动作预测，两种监督可共同塑造视频专家的参数。[图 2b][fig2] · [掩码实现][mask]

3. **让视频和动作各解一道流匹配题。** 对任一真实目标 y（未来视频 latent 或动作序列），取噪声 ε，构造 yₜ = (1−t)y + tε，再预测连接二者的速度 ε−y。训练损失为动作损失加上 λ 倍视频损失。若撤去视频损失，模型仍使用预训练的视频主干，训练和部署仍可处理首帧。这个对照专门检验下游示范中“学着预测未来”的贡献。[公式 5–9][arch] · [训练消融][variants]

4. **缓存观测，把反复计算留给动作。** 源码的动作接口先编码输入图像，再由视频专家计算每层可复用的键和值。动作专家以动作噪声开局，在每个采样步读取这些缓存并更新动作序列，最后返回动作。下一次相机观测到了不同的毛巾形态，需要重新编码；缓存的作用域是当前动作块。[动作推理实现][infer]

### 一个完整例子

以原文的 Galaxea R1 Lite 双臂折毛巾为例。以下是按其架构展开的一次决策，具体夹爪动作是教学示意。相机拍到平铺的毛巾，指令要求折叠。训练样本还包含人遥操作时接下来的双臂控制量和真实画面：一条训练信号要求模型理解手抬起后布边如何变化，另一条要求它预测示范者所做的动作。动作专家只能从当前观测、指令和自身带噪动作中学习恢复示范。[真机任务图 3][task] · [架构图 2][fig2]

实际执行时，系统对当前画面做一次编码；随后动作专家迭代，把形状为 **32 × 动作维数** 的噪声变成接下来 32 个时刻的控制量。控制系统才会把这些值送给机器人。真机究竟有没有抓住布边、最终有没有叠好，靠执行结果来评价。视频监督本身既没有指定抓取点，也没有提供接触成功的保证。[实施细节][implementation] · [真机结果][real]

### 训练与推理

视频主干、视频 VAE 和 T5 都来自预训练的 Wan2.2-5B。动作专家隐藏维度为 1024，总模型约 6B 参数。论文将视频按时间下采样 4 倍，每个动作块对应 9 帧视频以及 32 个动作；测试使用 10 个去噪步、CFG 系数 1.0。LIBERO 训练 2 万步，RoboTwin 和真机任务各训练 3 万步。表中的“无具身预训练”指未加专门的具身预训练阶段，策略仍使用目标任务示范，也继承视频预训练。论文给出了推理测量硬件，未给出可核算整个训练成本的 GPU 小时数。[§4.1–4.2][implementation]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**仿真成功率，越高越好。** 原表 1、2 节选。RoboTwin 同时测干净场景和随机化场景，每个任务每种条件 100 次；LIBERO 四个子集共 40 个任务、2,000 次评估。外部基线与本方法的预训练条件不同。下表保留这些区别，把统一实现下的机制比较放在下一张表里。[原表 1][t1] · [原表 2][t2]

| 方法 | 具身预训练 | RoboTwin 干净 % | RoboTwin 随机 % | RoboTwin 均值 % | LIBERO 均值 % |
| --- | --- | ---: | ---: | ---: | ---: |
| π₀.₅ | 有 | 82.74 | 76.76 | 79.8 | 96.9 |
| Motus | 有 | 88.66 | 87.02 | 87.8 | 97.7 |
| LingBot-VA | 有 | 92.90 | 91.50 | 92.2 | 98.5 |
| Motus，从 Wan2.2 初始化 | 无 | 77.56 | 77.00 | 77.3 | — |
| **Fast-WAM** | **无** | **91.88** | **91.78** | **91.8** | **97.6** |

**真机折毛巾。** 原图 4 左图以散点报告成功率和整项任务的平均完成时间，下表这两列按坐标近似读取；右图的单次推理延迟直接标有数值。各策略均使用同一真机任务，作者采集了 60 小时遥操作示范；延迟用一张 RTX 5090D V2 32 GB 测量。[真机设置][setup] · [原图 4][real]

| 方法 | 折叠成功率 ↑ | 平均完成时间 ↓ | 单次推理延迟 ↓ |
| --- | ---: | ---: | ---: |
| π₀.₅，有具身预训练 | 约 100% | 约 120 s | 180 ms |
| Fast-WAM | 约 75% | 约 150 s | 190 ms |
| Fast-WAM-Joint | 约 70% | 约 225 s | 580 ms |
| Fast-WAM-IDM | 约 90% | 约 175 s | 810 ms |
| Fast-WAM，移除视频联合训练 | 10%（正文亦报告） | 约 240 s | 190 ms |

### 消融实验

原表 1、2 的四个受控变体。Joint 让未来视频和动作联合去噪，IDM 先生成未来视频再让动作读取它。最后一行只移除训练时的视频预测目标，保留首帧编码、动作专家和相同的推理路径。[变体定义][variants] · [表 1][t1] · [表 2][t2]

| 设置 | RoboTwin 均值 % | LIBERO Spatial % | Object % | Goal % | Long % | LIBERO 均值 % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fast-WAM | 91.8 | 98.2 | 100.0 | 97.0 | 95.2 | 97.6 |
| Joint | 90.6 | 99.6 | 99.4 | 98.2 | 96.8 | 98.5 |
| IDM | 91.3 | 98.8 | 97.8 | 97.8 | 97.6 | 98.0 |
| 移除视频联合训练 | 83.8 | 89.2 | 99.2 | 95.4 | 90.0 | 93.5 |

**撤掉视频训练目标。** 用相同部署方式，RoboTwin 损失 8.0 个百分点，LIBERO 损失 4.1 个百分点。LIBERO-Spatial 损失 9.0 个百分点，而 Object 只损失 0.8 个百分点。预测未来的训练信号在同一基准内部也有不同作用。[表 1][t1] · [表 2][t2]

**让动作读取生成的未来。** 相比 Fast-WAM，Joint 和 IDM 在 LIBERO 分别高 0.9 和 0.4 个百分点，在 RoboTwin 平均分别低 1.2 和 0.5 个百分点。三者是各自训练的变体，因此差值反映整种设计，不能解读成同一份权重切换开关后的纯效果。[§3.3][variants] · [§4.3.2][controlled]

### 关键发现

1. **“快四倍”有明确的比较对象。** 图 4 中 IDM 耗时约为 Fast-WAM 的 4.26 倍（810/190）；Joint 约为 3.05 倍（580/190）。相比同样只做动作推理的无视频联合训练变体，二者都是 190 ms，折毛巾成功率却相差约 65 个百分点。[图 4][real]
2. **有些操作仍可能受益于生成未来。** RoboTwin 随机场景中，Move Stapler Pad 的成功率为 Fast-WAM 64%、Joint 81%、IDM 85%；Handover Block 为 81%、91%、94%。论文覆盖的任务中，仅靠首帧学习的策略能有很强的平均表现，个别精细操作的取舍仍须细看。[附录表 3][t3]
3. **成功和速度可以给出不同选择。** 真机折叠时 IDM 的最终成功率较高，Fast-WAM 的平均完成时间较短。单次推理省下的数百毫秒也不能直接换算成整项任务的耗时，后者还包括动作执行和失败后的调整。[图 4][real]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **训练时看未来，部署时看现在。** 示范的未来画面提供监督，而动作分支在训练阶段就只能读取首帧。这一约束解释了为何部署时拿掉整组未来 token，动作专家仍收到训练中学过的输入。[图 2b][fig2]
- **把一个含混的“视频先验”拆成可度量的代价。** 当前帧视觉编码、未来视频采样和动作采样分别占用计算。比较这三者的职责，能解释为什么 Fast-WAM 仍是约 6B 的模型，却可以跳过最昂贵的一部分工作。[§3–4][arch] · [源码][infer]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **真机证据来自一种任务。** 双臂折毛巾考验形变物体操作，但论文的真机实验没有覆盖当前观测不足以判断目标状态、必须预演多个方案再选择的任务，也未直接检验长期反事实规划。[§4.2–4.3][setup]
- **“学到物理”仍是机制解释。** 联合训练改进了成功率，作者没有通过干预隐变量或预测接触力来证明视频专家显式存储了哪条物理规律。这里最强的证据是有无视频目标的受控对照。[§4.3.2][controlled]
- **版本和设备会改变推理数字。** 后续作者仓库报告优化后 LIBERO 端到端推理在 H20 上由 470 ms 降至 210 ms，在 RTX 4090 上由 190 ms 降至 110 ms，包含文本和 VAE 编码。这组是后续实现的设备内对照；论文图 4 的测量用 RTX 5090D V2。官方已发布训练与评测代码、LIBERO 和 RoboTwin 权重，本文核对源码和发布记录，未重新运行机器人实验。[固定版本说明][code] · [权重][weights]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **联合生成与逆动力学。** Joint 让视频和动作一起去噪；IDM 先形成对未来的预测，再反推到达该状态所需的动作。Fast-WAM 则缓存当前状态的视觉信息直接预测动作。若任务中的目标位置被遮挡、要先探查环境，一个值得验证的问题是在哪次决策上支付未来采样成本，而非每步都支付。[模型对照][variants]
- **与视觉语言动作模型比较。** π₀.₅ 同样能以观测和指令为条件输出动作，在真机折叠中，使用具身预训练的版本取得图中最高成功率和最短完成时间。各模型的外部预训练和数据条件不同。要检验视频预测这一项的贡献，应优先读本论文的同框架消融。[§2][html] · [图 4][real]
- **对人体动作研究的启发。** 若视频只在训练时用作辅助监督，可以保留动作分支、数据和推理路径，单独去掉预测未来画面的训练目标，再衡量速度和任务表现。迁移到人体动作时，评价量也应换成所关心的动作质量、事件时序或目标达成度。本文直接验证的对象是机器人操作。[受控实验][controlled]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 会议记录及作者的 Spotlight 公告。[NeurIPS 2026][venue] · [第一作者主页][author]
- 模型结构、实验协议、图 4 与附录逐任务数据。[arXiv v2 HTML][html] · [原始 PDF][pdf] · [作者项目及视频][project]
- 核对动作接口、注意力掩码、缓存复用和发布权重。[代码版本][code] · [动作推理][infer] · [权重][weights]

</div>

[venue]: https://neurips.cc/virtual/2026/poster/149922
[author]: https://yuantianyuan01.github.io/
[project]: https://yuantianyuan01.github.io/FastWAM/
[abs]: https://arxiv.org/abs/2603.16666v2
[html]: https://arxiv.org/html/2603.16666v2
[pdf]: https://arxiv.org/pdf/2603.16666v2
[code]: https://github.com/yuantianyuan01/FastWAM/tree/7faa71108368fbb3b6885649f112af607427a2d4
[weights]: https://huggingface.co/yuanty/fastwam/tree/main
[infer]: https://github.com/yuantianyuan01/FastWAM/blob/7faa71108368fbb3b6885649f112af607427a2d4/src/fastwam/models/wan22/fastwam.py#L979-L1160
[mask]: https://github.com/yuantianyuan01/FastWAM/blob/7faa71108368fbb3b6885649f112af607427a2d4/src/fastwam/models/wan22/fastwam.py#L397-L418
[fig1]: https://arxiv.org/html/2603.16666v2#S1.F1
[fig2]: https://arxiv.org/html/2603.16666v2#S3.F2
[problem]: https://arxiv.org/html/2603.16666v2#S3.SS1
[arch]: https://arxiv.org/html/2603.16666v2#S3.SS2
[variants]: https://arxiv.org/html/2603.16666v2#S3.SS3
[implementation]: https://arxiv.org/html/2603.16666v2#S4.SS1
[setup]: https://arxiv.org/html/2603.16666v2#S4.SS2
[task]: https://arxiv.org/html/2603.16666v2#S4.F3
[real]: https://arxiv.org/html/2603.16666v2#S4.F4
[t1]: https://arxiv.org/html/2603.16666v2#S4.T1
[t2]: https://arxiv.org/html/2603.16666v2#S4.T2
[t3]: https://arxiv.org/html/2603.16666v2#A1.T3
[controlled]: https://arxiv.org/html/2603.16666v2#S4.SS3.SSS2
