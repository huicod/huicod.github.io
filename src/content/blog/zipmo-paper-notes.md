---
title: "[CVPR2026] ZipMo：给鹰的飞行指定一个终点，中间可以怎么飞？"
description: "从一个起始画面出发，用 64 帧的二维点轨迹训练可查询的运动网格。对照目标点预测、视频基线和机器人实验，理解这个网格能读出什么。"
pubDate: "2026-11-26T20:41:00+08:00"
badge: "Paper"
tags: ["ZipMo", "CVPR 2026", "Learning Long-term Motion Embeddings for Efficient Kinematics Generation", "二维点轨迹", "运动压缩", "条件流匹配", "运动规划", "LIBERO", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[arXiv HTML，含附录][html] · [CVPR 正文 PDF][pdf] · [补充材料 PDF][supp] · [作者项目与动画][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026</summary>

*Learning Long-term Motion Embeddings for Efficient Kinematics Generation*，作者为 Nick Stracke、Kolja Bauer、Stefan Andreas Baumann、Miguel Angel Bautista、Josh Susskind 和 Björn Ommer，来自慕尼黑大学、MCML 与 Apple。方法名为 ZipMo。本文对照 CVPR 记录、arXiv v1 正文与附录、官方代码及权重清单；表内数字为作者报告，本次未训练或运行模型。[会议记录][cvf] · [官方实现][repo] · [模型文件][weights]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给 ZipMo 一张鹰飞行的照片，它能提出扇翅、滑翔或转向等多种未来。用户还可以给画面里的点指定终点，约束模型采样的路线。它一次采样整段运动，再回答“首帧这个像素到第 t 帧去了哪里”。因此研究者可以直接检查翼尖、躯干或背景点的二维轨迹，无需先画完一段视频。[鹰的多个未来，原文图 5][eagle] · [带终点的动画示例][project] · [运动空间，图 2][vae]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　视频生成器能从首尾画面补中间过程；点跟踪器则能从已经拍好的视频估计某些像素怎样移动。一个能产生多种未来，一个能把已观察到的运动表示得很紧凑。[引言][intro]

**现有痛点**　若要比较一只鹰可能怎样转向，用视频模型得反复画天空、羽毛和光影，再用跟踪器把路线读出来。一次跟踪失误还会混入对生成效果的评价。[与视频模型的对照][vid]

**核心矛盾**　目标点只规定“到哪儿”，并不决定“怎样去”。单条平均轨迹会忽略多种可能；逐像素、逐帧地生成很多候选又过于昂贵。表示既要容得下时间变化，也要足够小，才能反复采样。[运动空间规划][fm]

**本文目标**　学习一个既能压缩已有轨迹、又能采样未知轨迹的表示。给定首帧后，开放域模型接收空间目标点；机器人模型接收任务文字。二者最终都要交出可衡量的运动。[任务设置][tasks]

**切入角度**　跟踪器已经给出了许多训练样本：点的起始位置和后来逐帧的坐标。若模型只看到其中一部分，却能还原同一物体上未输入的点，就有理由相信它学到了比“一点对应一条已知线”更可复用的信息。[式 7–9][space]

**核心 idea**　先把一段场景运动写进二维空间网格，训练一个按“首帧位置＋未来时刻”读取网格的解码器，再训练另一个网络根据场景和任务生成这样的网格。改变随机种子，就有机会得到不同的运动假设。[模型图 2][vae] · [模型图 3][plan]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练时，轨迹编码器读到了已经发生的运动；实际预测时，规划器必须从起始画面和目标推断可能的运动。两条路径通往同一种网格，因而可以共用同一套轨迹查询。图中右下角的机器人策略头是专为 LIBERO 实验训练的额外部件。[原文 §3][method] · [机器人动作预测][tasks]

<figure class="reading-figure"><a href="/paper-notes/zipmo/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/zipmo/architecture.svg" alt="ZipMo 先用首帧和已跟踪的点训练运动 VAE，再训练流匹配模型从目标条件生成运动网格。解码器回答首帧某一点在未来的二维位置，机器人另用策略头。" /></a><figcaption>根据论文图 2、图 3 和图 7 重绘。先看上半部如何学会读网格，再看下半部在没有未来帧时如何生成网格。点击可放大。</figcaption></figure>

### 关键设计

1. **把轨迹上一个点放回正确的时空位置。** 一条记录含当前二维坐标、首帧起点和时间。坐标经傅里叶特征和 MLP 编码；旋转位置编码用起点区分不同轨迹，用时间区分同一轨迹上的采样。轨迹和网格 token 可以相互读取，也通过交叉注意力读首帧的 DINOv2 特征。傅里叶特征在这里编码的是坐标，不代表模型显式输出了动作的频率或相位。[式 1–6][space]

2. **64 帧压到一张空间网格，解码时再问时间。** 最大时间压缩设置产生 16 × 16 个空间位置，每个位置 16 个通道。网格没有 64 层时间切片，仍能描述时间变化，因为解码器每次还接收查询时刻。训练损失同时奖励还原已输入轨迹和留出轨迹的二维绝对坐标，另加 KL 正则约束分布。这里的 64 倍指时间轴压缩比；单看这个比值，不能推出文件大小或端到端耗时缩小了 64 倍。[编码与查询解码][space] · [附录表 G][config]

3. **分清目标点和查询点。** 目标点（poke）告诉规划器“首帧这一点应在指定时间抵达这里”，起点、目标位置、时刻共同构成条件。查询点则在采样后让解码器报告运动，本身没有命令物体去哪里。用户可以只给鹰的躯干设目标，再查询未设目标的翼尖会怎样飞。后半句是按模型接口展开的教学例子。[条件流匹配，式 10][fm] · [作者演示][project]

4. **轨迹计划怎样变成机器人动作？** 在 LIBERO 中，文字和首帧约束未来运动；另训的策略头把预测的运动表示映射到七维控制量。执行下一步后重新观测、重规划。于是实验既能算轨迹误差，也能在仿真里实测“杯子是否真的放进微波炉”。这一步引入了机器人任务数据和控制器。[图 7 和表 2][robot] · [公开策略头][weights]

### 一个完整例子

原文图 5 从同一张鹰的照片生成多种飞行轨迹。下表沿用这个场景，加入论文支持的目标点条件，演示它和查询点的区别。指定终点与查询翼尖是教学例子。[原文图 5][eagle]

| 步骤 | 模型收到或产生什么 |
|---|---|
| 给条件 | 首帧显示鹰的位置和朝向。在画面上选一点，指定它在终点时刻应到达的二维位置。 |
| 提出未来 | 从不同噪声开始，条件流匹配模型可以产生多个运动网格。每个网格对应整个场景的一种未来假设。 |
| 读出运动 | 任选首帧上的翼尖或身体点，逐时刻查询其二维坐标。改变查询点可以读出同一次采样里不同位置的运动，无须重新采样网格。 |
| 检验 | 可以逐帧测投影位移、何时转弯以及终点偏差。仅凭翼尖在画面上的曲线，仍无法唯一恢复翅膀的三维关节角。 |

### 训练与推理

在开放域实验中，两个阶段均使用 1,000 万段视频训练。作者从每段首帧随机选取 1,024 个位置，用 TAPNext 提供轨迹监督。单独的 LIBERO 机器人实验使用 CoTracker3 跟踪得到的轨迹。VAE 约 340M 参数、训练 80 万步；规划器约 530M 参数、训练 70 万步。两阶段各约 3 天，训练配置从 16 张 H200 扩展到 64 张；这不足以还原每阶段精确的 GPU 小时或账单。官方发布项包括运动 VAE、稀疏与稠密目标点规划器，以及 LIBERO 专用规划器和策略头。[数据与跟踪器][data] · [附录表 G][config] · [代码与使用方式][repo] · [权重清单][weights]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**指定几个点后，其他点能否得到合理路线？** 下表节选原文表 1。作者先把轨迹坐标缩放到 0–128。Min MSE 衡量最接近实拍轨迹的候选，EPE 衡量指定端点的偏差，两者越低越好。Mean MSE 要结合 Min MSE 读：两者太接近，几次采样可能都给了同一条路线；均值过大，又可能混入不合理的路线。稠密一栏给各方法能够使用的最强条件，Track2Act 接收终止帧。[指标定义][metrics] · [原表 1][t1]

| 方法 | 条件 | Min MSE ↓ | Mean MSE ↓ | EPE ↓ |
|---|---|---:|---:|---:|
| Motion-I2V | 1 个目标点 | 135.7 | 429.7 | 19.7 |
| ZipMo | 1 个目标点 | 41.0 | 57.9 | 0.5 |
| Motion-I2V | 稠密 | 46.9 | 71.7 | 8.8 |
| Track2Act | 稠密 | 138.7 | 156.1 | 20.9 |
| ZipMo | 稠密 | 30.4 | 44.1 | 1.1 |

**直接出轨迹和先生成视频相比如何？** 作者挑选 68 段 Pexels 片段，每段保留 40 条可见的运动轨迹。Wan 和 Veo 3 拿首尾帧，ZipMo 拿首帧和 40 个起点到终点的运动条件。视频结果用 CoTracker3 跟踪后评分。原表 3 固定每种方法采样 8 次；两边的条件和读出轨迹的方式都有差别，原表的耗时分别是 Wan 约 1 小时、ZipMo 约 1 秒，Veo 3 未报告。ZipMo 这 1 秒生成的是轨迹。[原表 3][t3] · [评测协议][eval]

| 方法 | Min MSE ↓ | Mean MSE ↓ | EPE ↓ |
|---|---:|---:|---:|
| Wan | 28.67 | 57.02 | 4.68 |
| Veo 3 | 36.18 | 94.00 | 6.21 |
| ZipMo | 27.08 | 39.53 | 1.17 |

**轨迹计划能否帮助执行任务？** 原表 2 在两种训练与评估协议下报告 LIBERO 仿真成功率。这里列作者给出的平均值。按 ATM 协议，ZipMo 的 Goal 子集为 69.7%，低于 ATM 的 77.8%；平均值的提升不代表每种任务都更好。[原表 2][robot]

| 协议 | 对照平均成功率 | ZipMo 平均成功率 |
|---|---:|---:|
| ATM | ATM 60.4%，Amplify 71.4% | 77.5% |
| Tra-MoE | Tra-MoE 61.4% | 80.3% |

### 消融实验

- **把时间压得更紧会怎样？** 在固定计算预算下，比较 2、4、8、16、32、64 倍时间压缩。64 倍比 2 倍需要去噪的 token 少 32 倍，生成更快，生成误差也更低；代价是轨迹重建精度略降。SSv2 子集的近邻动作识别随压缩增强而改善。作者将结果归因于更少的 token 和更有结构的表示，两项贡献并未被单独量化。[原图 4][compression] · [不同预算匹配方式][ablate]
- **轨迹标签换一个跟踪器行不行？** 用 TAPNext 或 CoTracker3 监督训练，在两种跟踪器标签上交叉评估，结果都接近；主动丢轨迹、过滤遮挡轨迹后再到含遮挡的测试集评估，准确率下降。下表是附录 H、I 表的平均位置阈值准确率，越高越好。[跟踪器与数据质量消融][tracker]

| 训练条件 | 评估条件 | 准确率 |
|---|---|---:|
| TAPNext 监督 | TAPNext / CoTracker3 | 96.8 / 97.0 |
| CoTracker3 监督 | TAPNext / CoTracker3 | 96.3 / 97.3 |
| 主动丢弃部分训练轨迹 | 含遮挡的评估集 | 94.0 |
| 训练时仅保留可见轨迹 | 含遮挡的评估集 | 93.2 |

### 关键发现

同预算下，提高压缩率对“复原一段已知运动”和“生成一个可能的未来”影响相反。选动作表示时，要先区分最终用途是无损记录、生成候选还是向策略提供计划。另一方面，EPE 很低仍然是平均误差；论文没有把 poke 实现成逐点精确满足的求解器。[图 4][compression] · [表 1][t1]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **可直接问一个局部位置发生了什么。** 相同的网格可以解码许多首帧位置，也可以沿同一点读完整时间序列。如果想研究振幅、投影转向或重复节奏，可以从轨迹计算，并检查遮挡时是否可信。作者没有据此宣称网格中存在命名好的“振幅维”或“周期维”。[查询解码器][space]
- **把“想象可能的未来”和“执行其中一步”分开测。** 开放域部分报告轨迹分布与端点误差，机器人部分另用仿真执行控制动作，报告任务成功率。这让人可以分别检查运动计划和闭环行为。[原表 1][t1] · [原表 2][robot]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **二维投影有歧义。** 同一条画面轨迹可能来自对象移动、相机移动或两者叠加。模型没有显式人体骨架、深度、接触力或物体身份保证；主评测偏向可持续跟踪的点。附录另给含相机运动的 DAVIS 结果。[评测设置][vid] · [附录 G][extra]
- **视频基线多经过一道测量。** 在生成画面上追点会受到遮挡、生成伪影和跟踪器选择影响。附录把读出器替换为 TAPNext，并用最后一次观测补缺，视频基线的 Min MSE 也随之变化。[附录 F 的实测][readout]
- **“长期”有具体窗口。** 主模型在 64 帧上学习；LIBERO 按既有协议评估时会换算成 16 步预测并在线更新。论文展示了固定窗口与闭环重规划，持续几分钟的单次无反馈预测准确度仍待检验。[附录 A][eval]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **DisMo** 从参考视频抽取连续运动向量，借助视频生成器让另一主体表演；ZipMo 专门把潜变量解码成用户指定位置的二维轨迹。若关心演员的动作能否跨外观复用，可看前者的身份探针；若关心同一翼尖何时转弯，可直接读取后者的轨迹。[DisMo 站内解读][dismo] · [ZipMo 原图 2][vae]
- **TT-VidT** 也把视频的运动压到紧凑表示，用动作识别检验它留下了多少时间信息。ZipMo 的解码器多提供了一种检验：可以指定首帧的任意点，检查它在目标时刻的坐标。[TT-VidT 站内解读](/blog/neurips2026-tt-vidt/) · [ZipMo 的解码器][space]
- **Motion-I2V 与 Track2Act** 是这里实际参加定量对照的运动预测方法。比较它们时应对齐输入：只给一个稀疏目标点和给完整末帧，对中间路线的约束程度不同。[原表 1][t1]
- **对动作研究的启发。** 给出两个需要相互协调的查询点，记录它们的相对位移，比挑一段好看的可视化更容易定位错误。若问题进一步要求手在三维空间握住目标，还需要相应深度、物体位置与接触检查。这个检验思路来自其可查询接口。[运动空间定义][space]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **论文**　[CVPR 会议记录][cvf] · [可翻译的完整 HTML][html] · [正文 PDF][pdf] · [补充材料][supp]
- **研究资源**　[作者项目及动画][project] · [代码版本][repo] · [公开权重][weights]

</div>

[html]: https://arxiv.org/html/2604.11737v1
[cvf]: https://openaccess.thecvf.com/content/CVPR2026/html/Stracke_Learning_Long-term_Motion_Embeddings_for_Efficient_Kinematics_Generation_CVPR_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/Stracke_Learning_Long-term_Motion_Embeddings_for_Efficient_Kinematics_Generation_CVPR_2026_paper.pdf
[supp]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Stracke_Learning_Long-term_Motion_CVPR_2026_supplemental.pdf
[repo]: https://github.com/CompVis/long-term-motion/tree/d0f8b4b9db8a2ee43b7a5fa751de66e1c5d29ff2
[project]: https://compvis.github.io/long-term-motion/
[weights]: https://huggingface.co/CompVis/ZipMo/tree/main
[intro]: https://arxiv.org/html/2604.11737v1#S1
[method]: https://arxiv.org/html/2604.11737v1#S3
[space]: https://arxiv.org/html/2604.11737v1#S3.SS1
[fm]: https://arxiv.org/html/2604.11737v1#S3.SS2
[vae]: https://arxiv.org/html/2604.11737v1#S2.F2
[plan]: https://arxiv.org/html/2604.11737v1#S3.F3
[compression]: https://arxiv.org/html/2604.11737v1#S3.F4
[eagle]: https://arxiv.org/html/2604.11737v1#S4.F5
[tasks]: https://arxiv.org/html/2604.11737v1#S4.SS2
[data]: https://arxiv.org/html/2604.11737v1#S4.SS0.SSS0.Px2
[metrics]: https://arxiv.org/html/2604.11737v1#S4.SS0.SSS0.Px3
[t1]: https://arxiv.org/html/2604.11737v1#S4.T1
[robot]: https://arxiv.org/html/2604.11737v1#S4.T2
[vid]: https://arxiv.org/html/2604.11737v1#S4.SS3
[t3]: https://arxiv.org/html/2604.11737v1#S4.T3
[config]: https://arxiv.org/html/2604.11737v1#S2.T7
[eval]: https://arxiv.org/html/2604.11737v1#S1a
[ablate]: https://arxiv.org/html/2604.11737v1#S4a
[tracker]: https://arxiv.org/html/2604.11737v1#S5a
[readout]: https://arxiv.org/html/2604.11737v1#S6
[extra]: https://arxiv.org/html/2604.11737v1#S7
[dismo]: /blog/neurips2025-dismo/
