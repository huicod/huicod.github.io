---
title: "[AAAI2025] Light-T2M：用帧级卷积和片段级 Mamba 轻量生成动作"
description: "Light-T2M: A Lightweight and Fast Model for Text-to-motion Generation。以走路时向左转的 100 帧示例解释局部卷积、片段文本门控与伪双向扫描，核对 4.48M 参数和约 0.15 秒的计量范围。"
pubDate: "2026-11-23T22:02:00+08:00"
badge: "Paper"
tags: ["Light-T2M", "Text-to-Motion", "Mamba", "State Space Model", "Diffusion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[HTML 阅读版（含附录）][html] · [原文 PDF（含附录）][pdf] · [作者项目与演示][project] · [官方代码与权重说明][repo]

<details class="paper-meta"><summary>论文信息与阅读范围 · AAAI 2025</summary>

*Light-T2M: A Lightweight and Fast Model for Text-to-motion Generation*。作者为中山大学的 Ling-An Zeng、Guohong Huang、Gaojie Wu、Wei-Shi Zheng。发表于 AAAI 2025，论文集第 39 卷第 9 期，9797–9805 页。arXiv v1 发布于 2024 年 12 月 15 日。下文的图表编号采用带附录的 arXiv 版本，公开实现核对至 2026 年 11 月 23 日。研究方向为文本驱动的三维人体动作生成、扩散采样和状态空间模型。[会议出版记录][aaai] · [arXiv 版本记录][record]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

Light-T2M 把动作生成分成两种时间尺度：相邻帧之间的姿态变化交给小卷积，跨片段的动作次序和文本条件交给 Mamba 与文本门控。整个去噪器有 **448 万个可训练参数**，用 10 步 UniPC 直接生成连续动作特征。作者在 RTX 3090 Ti 上测得平均每段约 **0.15 秒**。[方法图][fig2] · [主表][t1] · [计时协议][timing]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文本生成动作既可以在连续姿态或潜空间中做扩散，也可以先训练动作码本，再用生成器预测离散码。Light-T2M 选择连续动作扩散路线，关注每一步去噪需要多大的网络、整段生成需要多少步。[原文 §2–3][overview]

**现有痛点**　拿“一个人向前走，随后向左改变路线”来说。摆臂承接上一帧、支撑腿完成换脚，只需附近帧的信息；什么时候开始转弯、转完是否继续走，则要联系前后更长的运动。如果各层都对全部原始帧做全局交互，局部姿态也要承担这笔计算成本。[原文 §3.3–3.4][global-sec] · [作者生成示例][example]

**核心矛盾**　一帧可能只表现为膝部略微屈曲，单独拿出来很难对应文本里的“走”或“转弯”。但把时间序列压得太短，又会丢掉支撑脚和根部朝向如何衔接的细节。需要让文字进入较有意义的片段，同时保留逐帧运动的路径。[局部与全局建模][global-sec]

**本文目标**　在 HumanML3D 和 KIT-ML 上缩小生成主干、降低整段采样耗时，同时用动作分布质量和文本检索两个维度衡量代价。论文把参数量、推理时间和生成质量放在同一张表中。[原文表 1][t1]

**切入角度**　对全长序列使用轻量的一维卷积。只在需要全局信息的一条支路中，每八帧形成一个片段，让片段根据自身状态选择句向量的通道，再让片段之间交换信息。[图 2][fig2] · [图 4][fig4]

**核心 idea**　在每个基本块里先处理局部，再处理全局和文本，最后回到逐帧的局部更新。去噪时反复使用这个主干，每一步都估计整段干净动作。模型的轻量化来自对帧和片段做不同的运算，速度还取决于搭配的采样器。[图 2][fig2] · [采样器消融][t7]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

输入是一句动作描述和目标帧数。训练时在真实动作上加噪，推理时从相同形状的高斯噪声出发。冻结的 CLIP 提取整句特征，去噪网络接收当前动作、文本和扩散时刻，输出对干净动作的估计；采样器再计算下一步的状态。四个基本块位于一次去噪调用内部，10 个采样步位于外部。[原文 §3.1–3.2][overview] · [采样实现][sampler]

<figure class="reading-figure"><a href="/paper-notes/light-t2m/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/light-t2m/architecture.svg" alt="Light-T2M 的训练与推理。四个局部—全局—局部基本块构成一次去噪，片段支路注入文本并做伪双向扫描，外层采样器迭代生成连续动作。"/></a><figcaption>本站据原文图 2–4 和公开去噪器绘制，点击可放大。先沿动作支路看时间分辨率怎样缩短和恢复，再看独立的句向量如何进入每一组片段。推理循环中的一步会完整经过四个基本块。</figcaption></figure>

### 关键设计

1. **帧级局部卷积保留细节。** 在宽度为 256 的特征上，逐通道时域卷积用大小为 3 的核看相邻位置，1×1 卷积负责混合特征通道。一个基本块的开头和结尾各有一个这样的局部模块（LIMM），带归一化和残差连接。帧级路径保留了同一片段内部各帧的差异，供恢复时间分辨率时使用。[原文 §3.3][local] · [局部模块代码][local-code]

2. **在片段上对同一句话做不同的门控。** 中间的全局模块先把连续八帧压成一个片段特征。对片段 i，将其特征与整句向量拼接，经线性层和 sigmoid 得到逐通道权重；权重乘到句向量后，再与该片段融合。于是，不同阶段可以从同一句话取到不同的信息。模型收到的是冻结 CLIP 的句末汇聚向量，训练数据并没有指定哪个片段必须对应“向左”。[原文图 4 与式 6–7][fig4] · [文本编码器][clip] · [门控实现][gate]

3. **倒序在前、正序在后，同一个 Mamba 扫一次。** 假设动作只有 A、B、C 三个片段，送入扫描器的是 **C、B、A｜A、B、C**，只保留竖线后面三个输出。当模型在后半段读到 B 时，前面的状态已经处理过原本位于其右侧的 C。这样能获得双侧上下文，只使用一套扫描参数。扫描序列变长了一倍，省下的主要是额外方向的参数和在全帧尺度做全局计算的开销。[原文图 3][fig3] · [扫描实现][scan]

4. **把全局片段信息送回每一帧。** 将每个处理后的片段特征重复八次，与对应的原帧特征融合，再交给第二个局部模块。同一片段的八帧共享全局上下文，每帧仍有自己的输入。公开代码还会临时补齐末尾不足八帧的部分，在融合后裁回指定帧数。[原文 §3.4][global-sec] · [分段与融合实现][scan]

**对照公式与实现。** 论文式 4 写成先逐通道卷积、后逐点卷积；公开源码的次序相反，并在残差相加后使用 LayerNorm。论文式 5 用“相加后投影”表达融合，源码则把帧特征与上采样特征拼接，由线性层从 512 维映回 256 维。两种表述都保留了帧与片段两路信息，复现已发布模型时应采用权重对应的源码结构。[论文 §3.3–3.4][local] · [局部模块][local-code] · [融合代码][scan]

### 一个完整例子

作者的生成配置给出一句“一个人走着走着，路线向左改变”，并指定 **100 帧**。以下形状按单条 HumanML3D 动作计算，省略批次维，只追踪数据在公开实现中的变化。[作者示例配置][example] · [关节输出代码][generate]

1. **从文本和噪声出发。** 文字经冻结 CLIP ViT-B/32 得到一个 512 维句向量，再投影至 256 维。初始动作噪声为 **100 × 263**；每帧投影到 256 维。扩散时刻的嵌入单独放在动作序列首位，句向量通过旁路送入各块。[文本编码器][clip] · [去噪器输入输出][io]
2. **100 帧在全局支路里变成 13 段。** 该支路暂时移开时间 token，把 100 帧补到 104 帧，八帧一组得到 **13 × 256**。每一段从同一句话得到自己的门控结果。将倒序与正序拼接成 26 个片段位置，用 Mamba 扫描，保留后 13 个。[分段与扫描代码][scan]
3. **回到 100 帧并迭代。** 将 13 个输出重复展开到 104 个位置，与帧级特征融合并裁掉补齐的 4 帧。经过四个基本块后得到一个 **100 × 263** 的干净动作估计。外层采样器逐步更新噪声状态，完成后反归一化并恢复为 **100 × 22 × 3** 的关节坐标。[采样循环][sampler] · [关节恢复][generate]
4. **怎样检查“向左”真的发生了？** 可以取根部的水平轨迹，比较开始行走与转弯后的行进方向。若还关心脚是否打滑，要在支撑期追踪脚的地面位移。作者用轨迹与关键姿态作定性比较；这条命令提供了方向描述和总帧数，具体转弯时刻、半径与脚步由模型生成。[作者图 5][fig5]

### 训练与推理

训练时从 1,000 个扩散时刻抽取一个，在真实动作特征上加噪，让网络用均方误差预测干净动作；源码只对有效帧计损失。20% 的训练样本置空文本，供生成时组合有条件与无条件预测。HumanML3D 有 14,616 段动作与 44,970 条描述，KIT-ML 有 3,911 段与 6,278 条描述。原文报告总批量 256、AdamW 学习率 2×10⁻⁴，在两张 RTX 3090 Ti 上分别训练 3,000 和 5,000 个 epoch，按验证集 FID 选权重。作者没有报告训练总小时数。[原文 §4.1–4.2][setup] · [附录 C][train-details] · [损失实现][loss]

推理用 10 步 UniPC。公开代码先一起编码描述和空文本，再在每个采样步把条件、无条件分支合在一个批次送入去噪器。复现时有一个容易忽略的系数差异：论文式 3 把引导写作 εc + s(εc−εu)，源码使用 εu + w(εc−εu)。论文和示例配置都写 4，但按两条公式换算，同一引导强度要求 w = s + 1。表中的结果按作者报告列出。[原文式 3][overview] · [实际采样公式][sampler]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

以下摘自表 1，取作者报告的均值。FID 衡量生成与真实动作的特征分布距离；R@1、R@3 衡量正确文本与动作的检索匹配；MM-Dist 衡量配对特征距离。论文重复评估 20 次并报告 95% 置信区间。参数量和平均生成时间 AIT 只在 HumanML3D 上报告。[原文表 1][t1]

| HumanML3D | 可训练参数 | AIT（秒/段）↓ | FID ↓ | R@1 ↑ | R@3 ↑ | MM-Dist ↓ |
|---|---:|---:|---:|---:|---:|---:|
| T2M | 31.16M | **0.038** | 1.087 | 0.455 | 0.736 | 3.347 |
| MLD | 26.38M | 0.250 | 0.473 | 0.481 | 0.772 | 3.196 |
| T2M-GPT | 247.80M | 0.434 | 0.141 | 0.492 | 0.775 | 3.121 |
| MoMask | 44.85M | 0.180 | 0.045 | **0.521** | **0.807** | **2.958** |
| **Light-T2M** | **4.48M** | 0.151 | **0.040** | 0.511 | 0.795 | 3.002 |

| KIT-ML | FID ↓ | R@1 ↑ | R@2 ↑ | R@3 ↑ | MM-Dist ↓ |
|---|---:|---:|---:|---:|---:|
| T2M-GPT | 0.514 | 0.416 | 0.627 | 0.745 | 3.007 |
| ReMoDiffuse | **0.155** | 0.427 | 0.641 | 0.765 | 2.814 |
| MoMask | 0.204 | 0.433 | 0.656 | 0.781 | 2.779 |
| **Light-T2M** | 0.161 | **0.444** | **0.670** | **0.794** | **2.746** |

**两处原文数字需要区分。** Light-T2M 的 AIT 在表 1 记为 0.151 秒，在摘要和正文记为 0.152 秒。MoMask 在 KIT-ML 上的 FID 在表 1 为 0.204，在摘要为 0.228。上面两表统一按原表 1。对照 MoMask 的 0.180 秒，两种 AIT 写法都对应每段耗时减少约 16%。[摘要与主表][t1]

**0.15 秒测了什么？** 作者在同一张 RTX 3090 Ti 上，取 HumanML3D 测试集随机选定的同一组 100 条样本，逐条生成、关闭混合精度、重复计时 20 轮。当前脚本先准备数据并预热，再用 CUDA Events 计整组耗时并同步 GPU；采样调用含文本编码和去噪，骨架渲染、权重加载、数据读取在计时区间之外。脚本打印的是每轮整组的毫秒数，换算“秒/段”还需除以样本数和 1,000。默认入口中的权重载入段已被注释，因此它可用于检查网络计算耗时，生成质量需从加载权重的评测入口核对。[附录 D.1][timing] · [计时代码][bench] · [计时入口][bench-entry]

**448 万参数统计了什么？** 公开脚本数的是去噪器中允许训练的参数，冻结的 CLIP 文本编码器在推理中仍要使用。论文对有 VAE 或 VQ-VAE 的基线计入相应模块。参数数值可用于比较训练主干规模；整套程序占多少显存、在手机上要多久，都需要单独实测。[原文 §4.3][results] · [参数统计][bench-entry]

### 消融实验

**片段扫描和文本门控。** 以下均为 HumanML3D 均值。表 3 上半改变 Mamba 的扫描方式，下半改变文本注入方式，共用最后一行完整模型作参照。[表 3][t3]

| 条件 | 可训练参数 | FID ↓ | R@1 ↑ | R@3 ↑ |
|---|---:|---:|---:|---:|
| 单向扫描 | 4.48M | 0.058 | 0.495 | 0.781 |
| 双向扫描 | 4.66M | 0.042 | 0.509 | 0.793 |
| 移除 ATII | 3.43M | 0.102 | 0.489 | 0.778 |
| 保留注入、移除门控 | 3.95M | 0.074 | 0.497 | 0.781 |
| 完整模型，伪双向扫描与门控 | 4.48M | **0.040** | **0.511** | **0.795** |

**把全局模块放在哪里？** 记局部模块为 L、带文本与 Mamba 的全局模块为 G。只用 G 得到 FID 0.158；在参数同为 4.48M 的三个排列中，LLG、GLL、LGL 分别为 0.042、0.043、0.040，选用 LGL。只换成普通 Mamba 的 LML 为 0.165，说明完整模型的收益涉及分段、文本注入和扫描方式的组合。作者未给这些消融的置信区间。[表 2][t2] · [附录表 5][t5]

**每段多长？** 把下采样倍数从 1 改为 4、8、16，FID 依次为 0.060、0.045、0.040、0.043。逐帧注入时 R@1 为 0.501，每八帧注入时为 0.511。八帧是这组设置中表现最好的计算粒度，不代表一句话里的每个动作都持续八帧。[附录表 6][t6]

**十个采样步是否值得？** 下表使用同一组附录实验。五步时 DDIM 优于 UniPC；十步时次序反转，继续增加 UniPC 步数的收益已很小。[附录表 7][t7]

| 调度器 | 步数 | FID ↓ | R@1 ↑ | R@3 ↑ |
|---|---:|---:|---:|---:|
| DDIM | 5 | 0.083 | 0.506 | 0.790 |
| UniPC | 5 | 0.226 | 0.425 | 0.703 |
| DDIM | 10 | 0.061 | 0.509 | 0.794 |
| UniPC | 9 | 0.042 | 0.508 | 0.792 |
| UniPC | 10 | 0.040 | 0.511 | 0.795 |
| UniPC | 20 | 0.039 | 0.512 | 0.796 |

<figure class="reading-figure"><a href="/paper-notes/light-t2m/sampling-steps.svg" target="_blank" rel="noopener"><img src="/paper-notes/light-t2m/sampling-steps.svg" alt="表 7 的采样步数与 FID。五步时 DDIM 的 FID 较低，十步时 UniPC 较低，继续增加 UniPC 步数后降幅很小。"/></a><figcaption>本站按附录表 7 重绘。横轴是更新整段动作的次数，纵轴是 HumanML3D 的 FID，越低越好。论文没有逐点报告耗时，图中没有将步数换算成秒。</figcaption></figure>

### 关键发现

1. **轻量化换来的是一个具体的质量与速度组合。** HumanML3D 上，Light-T2M 相比 MoMask 约少九成可训练参数，FID 从 0.045 降至 0.040，而 R@1 从 0.521 降至 0.511。表中还有 0.038 秒的 T2M，其 FID 为 1.087。只看最快或只看 FID 会得到不同选择。[表 1][t1]
2. **两项结构改动可以分开检验。** 单向换伪双向，在相同参数数目下 FID 从 0.058 改善到 0.040；去掉文本门控则从 0.040 退至 0.074。后一项也改变了参数量，无法仅凭该行确定增益有多少来自门控形式本身。[表 3][t3]
3. **参数减少和延迟减少不是同一比例。** 4.48M 对 44.85M 接近十倍差距，整段耗时差约 29 毫秒。系统仍有文本编码、多个去噪步和调度器更新；论文没有逐模块列出耗时，因此不能把这 29 毫秒归给某一个组件。[主表][t1] · [采样循环][sampler]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **局部支路给时间压缩保留了退路。** 八帧共享的片段特征负责较长时间关系，融合时仍能取得每帧自己的姿态信息。因此减少全局序列长度，也能继续以逐帧精度输出。[图 2][fig2]
- **一个很小的对照解释了设计取舍。** 原文把单向、双向、伪双向放在同表。读者可以看见第二个方向是否值得为之增加参数，以及重复序列能否达到接近的检索效果。[表 3][t3]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **整段耗时与在线响应是两种测量。** 采样从整段噪声开始，伪双向支路也使用整个片段序列。想部署到能随用户讲话立即动作的角色上，还需测首帧等待、续接和提示变化后的响应。论文提供的是桌面 GPU 离线整段测试。[图 3][fig3] · [计时协议][timing]
- **“向左”是描述，精确轨迹需要另设约束。** 当前输入没有转弯时刻、指定脚落点或曲线半径。文本门控提供的是学习到的条件作用，图 5 的定性样本和整段检索成绩都无法直接验证逐事件执行率。[图 4][fig4] · [图 5][fig5]
- **模型规模和训练开销要分别看。** 公开训练命令每轮将数据重复五次，HumanML3D/KIT-ML 分别配置 600/1,000 轮，与正文 3,000/5,000 次遍历的量级一致。源码说明列 RTX 3090，论文列 RTX 3090 Ti。缺少墙钟时间，无法从参数量和轮数推出训练成本。[作者训练说明][train-code] · [原文 §4.2][setup]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **MDM。** 两者都在扩散步骤中直接估计连续干净动作。Light-T2M 的变化主要发生在去噪主干的时间尺度、片段文本注入和少步采样上。比较速度时也要固定具体采样器与步数。[MDM 作者项目](https://guytevet.github.io/mdm-page/) · [Light-T2M 的采样对照][t7]
- **MoMask（CVPR 2024）。** MoMask 迭代填补离散动作码，并由解码器恢复动作。Light-T2M 则直接更新连续特征。两者在同一协议下分别占优于 HumanML3D 的文本检索和 FID，适合用来区分“遵循描述”和“像数据集中的自然动作”。[MoMask 原文][momask] · [主表][t1]
- **Event-T2M（ICLR 2026）。** 这篇后续工作把复合描述拆为事件来建模和评估，可用来追问 Light-T2M 留下的问题：从一个句向量给不同片段门控后，动作是否真的按描述的次序完成。两篇所用的整库成绩与多事件子集成绩应分别比较。[Event-T2M 原文][event] · [本站已有解读](/blog/iclr2026-event-t2m/)
- **启发。** 若目标是做轻量的可控角色，可以沿用本文的帧级局部计算，把昂贵条件模块放在片段级。评估时同时记录整段生成耗时、首次可显示姿态的时间，以及目标事件与轨迹误差，才能判断节省的计算是否满足实际交互。[结构设计][fig2] · [原始计时范围][timing]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 正式出版资料以 AAAI 记录为准。正文、方法图和主表按会议论文及可翻译的 arXiv 版本阅读，步数对照和计时细节见 arXiv 附录 C–D。本站架构图为教学重绘，采样图使用作者表 7 的数据。[会议版 PDF](https://ojs.aaai.org/index.php/AAAI/article/download/33062/35217) · [HTML 全文][html] · [含附录的 PDF][pdf]
- 代码核对使用作者仓库的固定版本，包含条件注入、扫描、采样、计时和关节恢复。本文列出的是作者报告的基准结果，未在本机运行权重或重新测速。[官方实现][repo] · [作者演示][project]

</div>

[html]: https://arxiv.org/html/2412.11193v1
[pdf]: https://arxiv.org/pdf/2412.11193v1
[record]: https://arxiv.org/abs/2412.11193
[aaai]: https://doi.org/10.1609/aaai.v39i9.33062
[repo]: https://github.com/qinghuannn/light-t2m/tree/ff86925696676ea227867a9b9b32a7728c4c4ec5
[project]: https://qinghuannn.github.io/light-t2m/
[fig2]: https://arxiv.org/html/2412.11193v1#S1.F2
[fig3]: https://arxiv.org/html/2412.11193v1#S3.F3
[fig4]: https://arxiv.org/html/2412.11193v1#S3.F4
[fig5]: https://arxiv.org/html/2412.11193v1#S3.F5
[local]: https://arxiv.org/html/2412.11193v1#S3.SS3
[global-sec]: https://arxiv.org/html/2412.11193v1#S3.SS4
[overview]: https://arxiv.org/html/2412.11193v1#S3.SS2
[setup]: https://arxiv.org/html/2412.11193v1#S4.SS2
[results]: https://arxiv.org/html/2412.11193v1#S4.SS3
[train-details]: https://arxiv.org/html/2412.11193v1#A3
[timing]: https://arxiv.org/html/2412.11193v1#A4.SS1
[t1]: https://arxiv.org/html/2412.11193v1#S3.T1
[t2]: https://arxiv.org/html/2412.11193v1#S4.T2
[t3]: https://arxiv.org/html/2412.11193v1#S4.T3
[t5]: https://arxiv.org/html/2412.11193v1#A4.T5
[t6]: https://arxiv.org/html/2412.11193v1#A4.T6
[t7]: https://arxiv.org/html/2412.11193v1#A4.T7
[example]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/configs/sample_motion.yaml
[io]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/src/models/nets/light_final.py#L65-L82
[local-code]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/src/models/nets/light_final.py#L85-L105
[gate]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/src/models/nets/light_final.py#L124-L131
[scan]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/src/models/nets/light_final.py#L134-L162
[clip]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/src/models/nets/text_encoder.py#L34-L62
[loss]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/src/models/light_final.py#L88-L113
[sampler]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/src/models/light_final.py#L224-L260
[generate]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/src/sample_motion.py#L65-L82
[bench]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/src/test_speed.py#L50-L119
[bench-entry]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/src/test_speed.py#L208-L242
[train-code]: https://github.com/qinghuannn/light-t2m/blob/ff86925696676ea227867a9b9b32a7728c4c4ec5/README.md#training
[momask]: https://openaccess.thecvf.com/content/CVPR2024/html/Guo_MoMask_Generative_Masked_Modeling_of_3D_Human_Motions_CVPR_2024_paper.html
[event]: https://arxiv.org/html/2602.04292v2
