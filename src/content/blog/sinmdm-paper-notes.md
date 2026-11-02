---
title: "[ICLR2024] SinMDM：只给一段示范，怎样生成相似又有变化的动作？"
description: "以热身上身与绕圈步态的组合为例，讲清单动作扩散的训练、编辑和长序列生成，并用整段记忆与短裁片失真的对照读懂实验。"
pubDate: "2026-11-02T10:50:00+08:00"
badge: "Paper"
tags: ["SinMDM", "Single-Motion-Synthesis", "Motion-Diffusion", "Motion-Editing", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息 · ICLR 2024 Spotlight</summary>

*Single Motion Diffusion*。作者为 Sigal Raab、Inbal Leibovitch（共同一作）、Guy Tevet、Moab Arar、Amit H. Bermano 和 Daniel Cohen-Or，来自特拉维夫大学。本文依据 ICLR 2024 的 21 页正式版（含附录）、作者演示与公开代码解读。实验数值由作者报告，本次未运行训练或推理。[会议记录][venue] · [正式论文][paper] · [视频演示][demo] · [官方代码][code]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

只有一段角色动画时，SinMDM 为这段动画单独训练一个扩散模型，让去噪器每次只看时间上相邻的一小段。它学到的是这个角色怎样迈步、转身、衔接姿势，因此既能生成更长的变体，也能在给定上身热身动作时，为它补出示范里的绕圈步态。[原文图 2、7、8][paper] · [作者动画][demo]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 人体动作生成通常可以从许多人、许多动作的共享数据中学规律。动画师为一只鸵鸟或一条虚构的龙单独搭骨架时，手头可能只有一条做好的动画。它的关节、骨长和运动方式都可能与现成的人体数据相差很远。[§1、3][paper]

**现有痛点：** 想让一群角色沿用同一个动作风格，最省事的是循环播放，再把起点错开。但若每个角色都按同一顺序转身、停顿，很快就能看出它们在播放同一段素材。反过来，把片段随意剪开重组，又容易丢掉发力前的准备或落地后的缓冲。[§1、图 10、13][paper]

**核心矛盾：** 生成结果要像示范，又要允许新的时间安排。给网络看完整序列，复述原片就能取得很好的重建分数。只追求不同，又可能生成示范里从未出现过的突跳。判断这种模型要同时问两件事：局部动作还像吗？换一次采样，真的有变化吗？[§6.2–6.5][results]

**本文目标：** 为手上的这一条运动训练一个专用模型，保留其局部动作特征，按需生成不同长度的变体。架构可以用于不同骨架，但每条训练序列各有一套权重，连同这段素材的骨架一起使用。[§1、3][paper]

**切入角度：** 一条绕圈行走的动画虽然只有一次完整表演，却含有多个相互重叠的迈步、摆臂、转向片段。若每次去噪只能看见短邻域，许多位置都能为同一个局部预测器提供监督，模型也更难凭整段上下文记住唯一的表演顺序。[§4、图 2][net]

**核心 idea：** 让浅层 U-Net 只沿时间处理动作，用窗口相互重叠的局部注意力学习短时协调。训练后从噪声生成整条序列；编辑时可以在采样途中写回参考动作的一部分，让同一模型根据已知部分补其余内容。[§4–5、图 2–5][net]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

SinMDM 用同一条干净示范做两件事：加噪得到去噪器的输入，保留原值作为预测目标。模型只学这个角色的运动。训练结束后，改变起始噪声的帧数即可改变动画长度；有参考帧或关节时，在反向采样的一轮内部接入它们。[训练图 2][net] · [编辑图 4–5][compose]

<figure class="paper-figure"><a href="/paper-notes/sinmdm/architecture.svg?v=arch-20261102-r2" target="_blank" rel="noopener"><img src="/paper-notes/sinmdm/architecture.svg?v=arch-20261102-r2" alt="SinMDM 的单序列训练、局部窗口、反向扩散循环，以及分别接入干净预测和带噪样本的参考动作" /></a><figcaption>教学示意。沿实线看去噪器怎样生成样本；虚线引入干净示范监督或编辑参考。 <a href="/paper-notes/sinmdm/architecture.svg?v=arch-20261102-r2" target="_blank" rel="noopener">查看原图</a></figcaption></figure>

图中 **02 的回路**是读懂编辑的关键。先由去噪器预测干净运动，再采到下一个噪声步。03 左支像剪辑中的“锁轨”，在干净预测上保留指定的帧或关节；右支作用于带噪样本，将内容的低频与风格示范提供的高频细节组合。正式图 4 与图 5 分别描述这两个位置。[原文图 4–5][compose] · [采样写回][mask]

### 关键设计

1. **每帧生成什么？** 把动作整理成「帧数 N × 每帧动态特征数 F」的矩阵。以通用骨架表示为例，每帧包含根位置、各关节相对父节点的 6D 旋转和足接触标签。骨长与父子关系固定，把生成的动态特征和原骨架交给正向运动学（FK），才得到各关节在空间中的轨迹。HumanML3D 另含关节位置、速度等特征。由此可以理解“任意拓扑”：时间卷积不要求预先规定一种骨架，具体模型的特征通道仍对应训练角色。[§3、附录 B][repr]

2. **一段动作怎样提供足够的训练信号？** 随机取扩散步 t，给同一条干净动作 x₀ 加入相应强度的高斯噪声；网络读入带噪动作 xₜ 和 t，直接预测 x₀，以预测与原动作的均方误差训练。浅层 U-Net 的一次预测看不到整段时间轴。QnA 在每个位置用共享的可学习查询，对邻域内各帧的键和值加权；相邻窗口有重叠，窗口边界两侧也能交换信息。作者所谓 *motifs* 指由此习得的局部运动规律，没有人工标注的动作单元，也没有离散动作词表。[§4、附录 A、D][net] · [QnA 原文][qna]

3. **怎样告诉它“这部分必须跟参考走”？** 模型每轮先给出干净动作估计，再按掩码把保留区的特征替换成参考值，其余部分继续采样。按时间选区可以固定开头与结尾、补中间，也可以固定中间、向两端扩展；按关节选区可以固定上身、补下身。原文图 4 的掩码以 1 表示待生成区，公开代码的 `inpainting_mask` 以 1 表示保留区。差异大的片段在交界处可采用线性过渡。写回某关节的局部旋转能约束该特征；它在世界空间中的位置还受根和父关节影响。[§5.1、图 3–7][compose] · [实现中的写回][mask]

4. **风格迁移为什么要用另一种编辑方式？** 如果把整段内容逐帧写死，模型无处加入风格。作者改在反向扩散中保留参考动作的低频变化，并加上生成样本减去其低通结果后留下的高频部分。图 9 用同一段走路作内容，分别采用从“开心”和“蹲伏”示范训练的模型；作者展示步幅与节奏跟随内容，姿态则朝各自的示范变化。这里的高低频是时间滤波的结果，论文未建立频率与语义风格一一对应的关系。[§5.2、图 5、9][style] · [公开编辑入口][edit]

### 一个完整例子：下半身为什么会绕圈走？

原文图 7 和项目页分别给出了上身参考、训练示范和最后的组合结果。辨认这三段素材，就能看清控制到底来自哪里。[图 7][style] · [Spatial Composition 演示][demo]

| 阶段 | 输入了什么 | 发生了什么 |
|---|---|---|
| 训练 | 一条角色绕圈行走的动作 | 模型从示范中学习步态和转弯时的姿态协调。此时没有提供热身动作，也没有“热身＋走路”的配对样本。 |
| 提出编辑 | 一条训练时未见过的热身动作 | 选取其上身特征作为需要保留的部分。绕圈示范已经体现在权重里，不必拿两条完整动画逐帧拼接。 |
| 反向采样 | 参考上身与待补区域 | 反复写回已知上身特征，让下身在这一条件下去噪。参考决定上身做什么，模型决定怎样迈步。 |
| 看结果 | 同一骨架的一段完整动画 | 项目页中的角色上身做热身动作，下身沿曲线行走。这里指定了上身动作，没有指定每一次落脚的世界坐标或转弯半径。 |

### 训练与推理

附录表 4 的主实验配置为 256 通道、4 个注意力头、1 个残差块、卷积核 3、batch 64、60,000 次参数更新，采用 1,000 步余弦噪声日程。64 个批内样本来自同一条示范。公开训练循环复制输入，并随机做时间缩放；仓库附的两个基准脚本各列 10 条动作，逐条训练，脚本设置的 20,000 次更新与论文主配置有区别。[附录表 4][config] · [训练循环][train] · [Mixamo 脚本][mixscript] · [HumanML3D 脚本][hmlscript]

自由生成时，输出多少帧就初始化多长的噪声序列。图 8 从 **10 秒**的后退、转身示范生成 **60 秒**动画。群体演示为不同个体采样不同噪声，使它们的动作有所差别。两项实验分别说明能改变长度、能产生多个变体，均未测量多人避碰或指定时刻发生某件事的成功率。[§5.3、图 8、10][style] · [长动作与群体演示][demo]

实现中，这两种参考编辑也有可定位的差别：组合模式按掩码写回干净预测；协调模式对参考做降采样与上采样以取得低频，在公开采样循环中仅当反向索引大于 20 时注入。图中的风格支路据此标在反向更新的位置。[写回代码][mask] · [低通设置][edit] · [低频注入位置](https://github.com/SinMDM/SinMDM/blob/main/diffusion/gaussian_diffusion.py#L679-L685)

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

定量基准是 Mixamo 和 HumanML3D。作者还用 Truebones Zoo 的动物素材及艺术家制作的动画展示非人角色，包括鸵鸟与龙；下面的人体指标不能直接当作这些角色的定量成绩。[§6、图 10][metrics] · [非人角色演示][demo]

### 主实验一：看起来像，是因为学会了，还是因为记住了？

HumanML3D 基准对每条示范分别训练。SiFID 衡量生成片段与示范片段在动作编码空间中的分布距离；Inter 衡量同一模型的不同生成结果相差多远；Intra Diff 衡量生成动作的内部变化程度与示范相差多少。HM 是归一化后的调和平均。作者对无已知上界的指标用第 90 百分位作参照，分值可以为负。[§6.2、表 2][hml]

| HumanML3D，原表 2 | SiFID ↓ | Inter ↑ | Intra Diff ↓ | HM ↑ |
|---|---:|---:|---:|---:|
| MDM，整段训练 | **0.01** | 0.03 | **0.14** | 0.05 |
| MDM，短裁片训练 | 13.94 | **1.64** | 1.83 | −0.46 |
| GANimator | 11.01 | 0.87 | 0.86 | 0.15 |
| SinMDM | 1.87 | 0.73 | 0.40 | **0.60** |

整段 MDM 的 SiFID 最好，可它的 Inter 只有 0.03，换随机种子仍接近复述示范。剪短训练样本让 Inter 升到 1.64，却在图 13 中出现角色从站立直接跳起、前后缺少屈膝的问题。SinMDM 在两者之间取得了较高的综合分。单看“像不像”或“变化大不大”都会选出不同方法。[表 2、图 13][hml]

### 主实验二：覆盖、变化与训练代价

Mixamo 基准直接在运动序列上计算距离。覆盖率衡量示范中有多少局部时间窗能在生成结果里找到；全局多样性衡量生成动作即使按片段匹配原片仍有多不同；局部多样性衡量生成窗口与示范最近邻的距离。原表 1 在此按列拆开，HM 同时纳入动作指标和训练资源。[§6.2][metrics] · [表 1][results]

| Mixamo，表 1 的动作指标 | 覆盖率 ↑ | 全局多样性 ↑ | 局部多样性 ↑ | Inter ↑ | Intra Diff ↓ |
|---|---:|---:|---:|---:|---:|
| GANimator | 94.3% | 1.24 | **1.17** | 0.09 | 0.13 |
| GenMM | **98.7%** | 0.40 | 0.35 | **0.13** | 0.05 |
| SinMDM | 94.3% | **1.42** | 1.00 | **0.13** | **0.03** |

| Mixamo，表 1 的训练开销与综合分 | 参数（百万）↓ | 更新（千次）↓ | 秒/次 ↓ | 训练小时 ↓ | HM ↑ |
|---|---:|---:|---:|---:|---:|
| GANimator | 21.7 | 60（15 × 4） | 0.36 | 6.0 | −0.51 |
| GenMM | 0 | 0 | 0 | 0 | 0.56 |
| SinMDM | 5.26 | 60 | 0.09 | 1.5 | **0.84** |

耗时只测了基准中的第 9 条动作，论文使用 RTX 2080 Ti。GenMM 对每段示范免训练，所以训练栏全是零，生成仍需要搜索和组合片段。SinMDM 的 1.5 小时与 GANimator 的 6 小时是这个案例上的训练耗时，不能用来推算交互帧率。[§6.1–6.3、表 1][results]

**人评。** 每对方法比较 8 条动作，每次比较由 10 位不同评审判断。表中是选择 SinMDM 的比例。图 12 的比较对象只有下面两种。[图 12][results] · [问卷示例图 16][survey]

| 对照方法 | 判断多样性时选 SinMDM | 判断忠实度时选 SinMDM | 判断质量时选 SinMDM |
|---|---:|---:|---:|
| GANimator | 83.8% | 65.0% | 76.2% |
| 短裁片 MDM | 96.2% | 100.0% | 96.2% |

### 消融实验

**换骨干、扩大感受野。** 在 HumanML3D 上保留局部 QnA，换成 Transformer，Inter 升高但 SiFID 恶化；在 U-Net 内把深度从 1 提高到 3，SiFID 改善但 Inter 从 0.73 降为 0.20。作者把后一种现象解释为更容易记住原片。主实验表 2 与消融表 3 分别报告 SinMDM 的 HM 为 0.60 和 0.59，以下保留消融原值。[原表 3、§6.5][hml]

| HumanML3D，原表 3 | SiFID ↓ | Inter ↑ | Intra Diff ↓ | HM ↑ |
|---|---:|---:|---:|---:|
| QnA Transformer | 5.99 | 1.74 | 0.57 | 0.47 |
| QnA U-Net，深度 3 | 0.69 | 0.20 | 0.34 | 0.28 |
| QnA U-Net，深度 1（SinMDM） | 1.87 | 0.73 | 0.40 | **0.59** |

**让运动更平顺。** 附录另测生成动作和示范在 FK 后的关节加速度统计差异。增大感受野会降低这个误差，但全局多样性也下降。固定架构、增加平滑损失权重，λ = 1 时误差从 9.8 降至 4.8，覆盖率从 94.3% 到 94.0%；λ = 100 时误差更低，覆盖率降到 89.4%。主表报告的是 λ = 0 的配置。[附录表 5–6、式 7–9][smooth]

| 附录表 5–6，选列 | 覆盖率 ↑ | 全局多样性 ↑ | 平滑误差（×10⁻⁵）↓ |
|---|---:|---:|---:|
| 表 5 · 1 层、1 残差块（基线） | 94.3% | 1.42 | 9.8 |
| 表 5 · 1 层、2 残差块 | 97.9% | 1.22 | 2.9 |
| 表 5 · 2 层、1 残差块 | 99.4% | 0.99 | 1.9 |
| 表 6 · 基线架构、λ = 0.1 | 94.1% | 1.43 | 7.7 |
| 表 6 · 基线架构、λ = 1 | 94.0% | 1.43 | 4.8 |
| 表 6 · 基线架构、λ = 10 | 92.8% | 1.48 | 2.6 |
| 表 6 · 基线架构、λ = 100 | 89.4% | 1.50 | 1.5 |

### 关键发现

1. **最容易误读的是低 SiFID。** 当训练集只有一段，完整重播本身就能很好地匹配分布；必须结合多次采样的差异和动作过渡一起判断。[表 2、图 13][hml]
2. **GenMM 给出了另一种有价值的结果。** 它覆盖了更多原有片段，而且免训练。SinMDM 的优势主要体现在全局变化和综合平衡上。论文并没有证明所有编辑任务里 SinMDM 都更好。[表 1][results]
3. **能编辑的证据来自演示。** 主表评的是生成结果与示范间的忠实度、多样性等。图 7 和 9 则回答“能做出什么样的组合和风格变化”。若关心末端是否对准目标，要额外测解码轨迹的误差。[§5、图 7–9][style] · [作者动画][demo]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **把“单样本”分成两个尺度理解。** 在整段表演的尺度上，数据确实只有一条；在单次预测所见的时间邻域里，同一条动作提供了许多互相重叠的观察。这解释了小模型为什么能学到步态，同时也预示它会丢失跨很长时间的顺序。[图 2][net] · [表 3][hml]
- **控制发生在一个可检查的位置。** 去噪器直接预测干净动作，艺术家因而可以明确指定哪些帧或哪些关节来自参考。实际使用中可以把输入掩码、保留区的特征误差和解码后的空间误差分别检查。[图 4][compose] · [掩码实现][mask]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **示范决定了能借到什么。** 给一段绕圈走路可以学步态；若整段从未演示挥剑，就没有证据表明能凭空生成挥剑。每换一段要学习的素材也需重新训练。未见过的参考动作仍可在编辑时作为已知部分输入，这是另一种使用方式。[§1、5、7][paper]
- **长动作的先后次序仍难控制。** 作者明确讨论了需要按特定顺序完成舞步的情况。扩大感受野有望保留顺序，却也会压缩多样性。如果任务指定“第 5 秒转向、第 8 秒落脚”，生成一分钟动作的演示并未验证这样的时间要求。[§7、表 3][hml]
- **推理要反复去噪。** 论文将较长的推理时间列为限制。群体、风格与混合动作都有演示，但主实验没有给出实时响应、跨角色避碰、世界坐标接触精度等指标。[§5–7][paper]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **GANimator（SIGGRAPH 2022）。** 同样从一段动画中学习局部运动规律，采用多尺度生成器与判别器。SinMDM 转用共享的扩散去噪器，按不同采样规则做补间、关节组合和风格迁移。[站内 GANimator 解读](/blog/siggraph2022-ganimator/) · [GANimator 项目][gan] · [SinMDM §2、5][paper]
- **GenMM（SIGGRAPH 2023）。** 它在示例中搜索相似片段，用多尺度匹配合成结果，不需要为每个示范训练网络。两者都能提取示范的变化空间，GenMM 的高覆盖率与 SinMDM 的局部扩散为“忠实”和“变化”给出了不同取舍。[GenMM 原论文][genmm] · [站内 GenMM 解读](/blog/siggraph2023-genmm/)
- **MDM（ICLR 2023）。** SinMDM 沿用直接预测干净动作的思路，针对数据仅有一条的情形限制了时间感受野。原表 2 把整段 MDM 和裁片 MDM 都列进来，让这项架构改动有了可以检验的对照。[MDM 原论文][mdm] · [SinMDM 表 2][hml]
- **对可控动作生成的启发。** 如果目标是让角色边走边做指定的上身动作，可以分别查上身是否保留、下身是否像示范、组合后接触是否正确。SinMDM 给出了前两问的建模办法；第三问需要在最终骨骼轨迹上单独评估。这是基于图 7 的研究启发。[图 7][style]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- [ICLR 2024 会议记录][venue] · [正式论文与附录][paper] · [项目主页及逐项动画][demo]
- [官方代码和预训练模型入口][code] · [训练循环][train] · [编辑入口][edit] · [反向采样与掩码写回][mask]
- 架构图为本文原创教学重绘。实验依据正式版表 1–3、图 12 和附录表 5–6；表 4 用于核对训练配置。模型效果与硬件数据均来自论文，代码部分为静态核查。

</div>

[venue]: https://proceedings.iclr.cc/paper_files/paper/2024/hash/821d5c03ff3bbb574c876bb6beef98b2-Abstract-Conference.html
[paper]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf
[net]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf#page=4
[compose]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf#page=5
[style]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf#page=6
[metrics]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf#page=7
[results]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf#page=8
[hml]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf#page=9
[repr]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf#page=17
[config]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf#page=17
[smooth]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf#page=19
[survey]: https://proceedings.iclr.cc/paper_files/paper/2024/file/821d5c03ff3bbb574c876bb6beef98b2-Paper-Conference.pdf#page=21
[demo]: https://sinmdm.github.io/SinMDM-page/
[code]: https://github.com/SinMDM/SinMDM
[edit]: https://github.com/SinMDM/SinMDM/blob/main/sample/edit.py
[train]: https://github.com/SinMDM/SinMDM/blob/main/train/training_loop.py
[mask]: https://github.com/SinMDM/SinMDM/blob/main/diffusion/gaussian_diffusion.py#L279-L285
[mixscript]: https://github.com/SinMDM/SinMDM/blob/main/eval/train_eval_mixamo_benchmark.sh
[hmlscript]: https://github.com/SinMDM/SinMDM/blob/main/eval/train_eval_humanml_benchmark.sh
[gan]: https://peizhuoli.github.io/ganimator/
[genmm]: https://igl.ethz.ch/projects/genmm/
[mdm]: https://arxiv.org/abs/2209.14916
[qna]: https://openaccess.thecvf.com/content/CVPR2022/papers/Arar_Learned_Queries_for_Efficient_Local_Attention_CVPR_2022_paper.pdf
