---
title: "[arXiv2026] FlashMotion：怎样用四步生成连贯的长动作？"
description: "解读 FlashMotion: Ultra-Fast Long-Term 3D Motion Generation。沿右手挥手、下蹲、起跳的实例，拆解动作空间 MeanFlow、条件引导的双向 Mamba 与软掩码编辑，对照三项任务的长序列质量和一万帧生成吞吐量。"
pubDate: "2026-11-21"
badge: "Paper"
tags: ["FlashMotion", "MeanFlow", "BiMamba", "Text-to-Motion", "Music-to-Dance", "Co-Speech Gesture", "Motion Editing", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[可翻译的 HTML 全文][html] · [原文 PDF][pdf] · [作者分段演示][project] · [训练和推理代码][code] · [六个模型权重][weights]

<details class="paper-meta"><summary>论文信息与阅读范围 · arXiv 2026</summary>

*FlashMotion: Ultra-Fast Long-Term 3D Motion Generation*，作者为 Kaixing Yang、Xulong Tang、Ronghui Li、Xiangyue Zhang、Ziqiao Peng、Mingshuang Luo、Chenxi Zhao、Haoyu Wu、Ju Fan、Hongyan Liu、Puwei Wang、Zijiao Zeng、Jun He。工作在腾讯 IEG Motus 团队开展。2026 年 11 月 10 日首发，11 月 11 日修订了项目链接和吞吐量说明。本文采用 v2（14 页、7 图、10 表）。截至 11 月 21 日，作者项目和 arXiv 记录均以预印本引用。实验数字为作者报告，另核对了公开的采样说明和权重配置。[版本记录][record] · [作者项目][project]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

让人物先挥手、再下蹲、最后向前跳，FlashMotion 在每个采样步都同时预测整段干净动作，让后一段的起跳也能影响前一段收尾的姿势。动作空间中的 MeanFlow 减少了反复预测的次数，双向 Mamba 降低了每次处理长序列的开销。作者用同一设计分别训练了文本生成动作、音乐生成舞蹈、语音生成手势三套模型。[原文方法][overview] · [原文图 3][fig3]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　人体动作生成已有两类可用的时间组织方式。逐段生成可以边接收指令边输出，整段去噪可以在生成早期便使用后文。对已经给定时间轴的角色动画，创作者还希望改一处指令后迅速预览整段。[原文 §I][intro]

**现有痛点**　把“下蹲”和“向前跳”分开生成，接起来可能突然换重心。换成每次查看全片的注意力模型，又要为每一轮更新计算很长的帧间关系；采样几十轮时，这笔开销会反复发生。[原文 §I][intro]

**核心矛盾**　要减少采样次数，每一轮就必须跨过更大的噪声区间。但骨架各处是联动的，在姿态参数中一个看似很小的旋转偏差，传到末端就可能成为明显的抖动或脚滑。[原文 §III-B][flow]

**本文目标**　让生成器只用一到四次整段预测，就能交付可供后续重定向、动画和编辑使用的连续三维动作，并检验切换指令时的语义对应及过渡质量。[原文 §III-A][overview]

**切入角度**　总等待时间同时取决于要调用网络几次，以及每次调用处理整段要多久。前者可以从生成轨迹的训练目标入手，后者可以从依时间顺序传递状态的网络入手。[原文图 2][fig2]

**核心 idea**　一步预测整段最终动作，在它上面直接校正关节位置与速度，再由该预测推算下一噪声状态。让逐帧条件参与双向状态更新和通道调制，就能在整段上建立对应关系，同时省去逐帧生成和完整的跨帧注意力矩阵。[原文 §III-B][flow] · [§III-C][arch]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先把外部条件对齐到动作时间轴，再采样与目标动作同形的整段高斯噪声。每轮将当前动作、条件以及这轮的起止噪声时间一起送入模型。网络输出干净动作估计，采样器向它走一段。训练时骨架与动力学损失接在这个估计上，编辑时用户给定的片段则接在采样器上。[原文图 2][fig2] · [编辑公式][edit-eq]

<figure class="reading-figure"><a href="/paper-notes/flashmotion/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/flashmotion/architecture.svg" alt="FlashMotion 训练、整段生成及编辑框架。三类任务分别取得对齐条件，双向 Mamba 同时估计各帧干净动作，训练时用骨架监督，生成时按平均速度向预测端点更新。" loading="lazy" /></a><figcaption>本站依据原文图 2 与式 8–16 重绘。先沿条件和带噪动作两条输入读到干净动作预测，再区分训练用的监督支路和一至四步生成回路。待补片段或指定关节经过可选的编辑支路。点击可放大。</figcaption></figure>

### 关键设计

1. **把各类输入做成逐帧可用的条件。** 文本输入包含每条描述以及它在时间轴上的区间，区间内各帧取该句的 4,096 维 UMT5-XXL 表示。语音分支结合逐帧 1,024 维 HuBERT 和 300 维文本特征，另有说话人条件。舞蹈分支取 35 维 Librosa 音乐特征，另有舞种条件。对应输出分别是每帧 263 维的 HumanML3D 表示（20 FPS）、55 个关节的局部 6D 旋转加 3 维根运动（333 维，30 FPS）、24 个关节的 6D 旋转加根运动（147 维，30 FPS）。三套模型各自训练、使用各自的输入输出维度。[原文 §III-A][overview] · [条件编码][arch]

2. **先预测干净动作，再用它走完一个噪声区间。** 设 t 是当前噪声强度，r 是下一步，1 对应纯噪声、0 对应干净动作。网络看到当前序列 zₜ、逐帧条件和区间，输出干净动作估计 x̂。式 8 用 **u = (zₜ − x̂) / t** 表示这一区间的平均速度。按式 7 更新，就得到 **zᵣ = (r/t) zₜ + (1 − r/t) x̂**。例如第一轮从 t=1 到 r=0.75，保留当前序列的四分之三，加入预测动作的四分之一；最后一轮 r=0，直接取该轮的干净预测。实际采样无需额外计算并保存速度张量。[原文式 7–8][eq8] · [作者采样实现说明][sample]

3. **在可以解释的动作量上训练。** 用真实动作和高斯噪声按比例混合得到 zₜ，MeanFlow 损失用区间平均速度与瞬时速度间的关系监督更新。另加三项直接约束：动作特征要重建对，恢复出的三维关节位置要重建对，相邻帧位置的一阶和二阶差分也要接近真值。最后一项约束速度和加速度，能惩罚落地前后突跳。这里的“动力学”由动捕轨迹的差分构成，并未引入接触力或刚体仿真求解器。[原文式 6、9–12][losses]

4. **用两个方向传播动作变化，让条件决定记什么。** 条件支路先用双向 Mamba 编码前后文。动作支路的 CoBiMamba 再把当前帧动作特征与对齐条件放在一起，决定状态写入、读出以及旧信息保留程度。例如碰到“起跳”的边界，未来几帧的提示可通过反向分支影响当前重心。另一条 AdaIN 支路从逐帧条件预测通道的缩放与偏移，FiLM 则注入当前生成时间及步长。三者分别处理时间依赖、通道幅度和去噪进度。帧数增长时，双向扫描和逐帧条件投影按线性规模增加。[原文式 14–16][arch]

5. **在多个采样步之间逐渐放松已知动作。** 用户可以指定镜头两端或部分关节。每步先把已知动作加噪到当前尺度，与当前生成状态混合。对于掩码为 1 的部分，已知动作的权重等于 t，随生成从 1 逐渐降到 0，为接缝留出协调余地。适用的是多步编辑，作者明确指出一步采样不支持这一编辑路径。由前一个窗口末尾约束下一个窗口，还可以逐窗续写。[原文式 13][edit-eq] · [补间实验][edit]

### 一个完整例子

作者图 3 的三段指令依次是：右手向观众挥手、轻屈膝后蹲下并站起、向前大跳并稳稳落地。每段 5 秒。按 BABEL 的 20 FPS，模型要处理 **300 帧**。[作者图 3][fig3] · [定性实验说明][qual]

1. **排时间。** 将三句话分别编码，放入第 1–100、101–200、201–300 帧，形成 **300 × 4,096** 的条件。换指令的时刻是输入中给定的，模型负责生成相应过渡。
2. **整段生成。** 从 **300 × 263** 的随机噪声出发，四次运行双向网络。每次都一起修正挥手、下蹲和跳跃这三段，输出保持 **300 × 263**，累积调整到最后的骨架运动。采样步数与视频帧数是两个量。
3. **读结果。** 可以逐帧看是哪只手挥动、落地时重心是否平稳，也可用统计量测动作切换处的加加速度。论文给出样例和成组分布指标，未给这三条要求逐项满足的成功率。换成“手在第 50 帧精确碰到一个物体”时，还需要目标物几何和相应的误差测量。[数据接口][overview] · [评测定义][setup]

### 训练与推理

公开 BABEL 配置使用 200 帧窗口训练，八张 GPU、112,000 次参数更新。长序列推理时，每轮把整个目标长度送入网络。语音与舞蹈采用各自的训练入口。作者发布了三个任务各自的一步、四步权重，共六份。以 BABEL 为例，一步使用 epoch 7150，四步使用 epoch 5850，推理种子也随步数派生。因此官方的两行结果是两套已选配置的成绩，单靠对照这两行无法把全部质量差异归因于多了三次网络调用。[文本训练与评测说明][t2m-code] · [公开权重][weights]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**先确定“长”有多长。** BABEL 的质量评测使用 311 段、每段 201–1,030 帧的验证动作，约有 300 次文本切换。在 20 FPS 下，覆盖约 **10–52 秒**。FineDance 取 19 条测试录制的 84 个重叠片段，BEAT2 取英语划分中 265 条测试录制各自完整对齐的时段。速度另用 1,000 或 10,000 帧测试，以下将质量和速度分列。[原文 §IV-A][setup]

**文本生成动作，BABEL。** R@1 是配对文本—动作排第一的百分比，FID 衡量动作特征分布差异。评分程序对 621 个动作区间各取两种结果：独立生成这一段，以及生成整条序列后截出相应区间。合计 1,242 条动作表示参与 Mixed 检索与分布评估。因此 0.907 这个 FID 同时反映两种生成条件。转场另算，取整条生成中的 297 个过渡，ΔPJ、ΔAUJ 分别比较生成与真值在过渡处的加加速度峰值与曲线面积统计，越接近 0 越好。[原表 I][table1] · [作者主表评分实现][scorer]

| 方法 | R@1 ↑ | FID ↓ | ΔPJ ↓ | ΔAUJ ↓ |
|---|---:|---:|---:|---:|
| FlowMDM | 19.483 | 0.712 | 0.07197 | 0.27793 |
| DART | 26.105 | 1.241 | 0.05516 | 0.33090 |
| MotionStreamer | 23.676 | 2.216 | 0.01293 | 0.14735 |
| FloodDiffusion | 25.109 | **0.542** | 0.12539 | 1.18581 |
| FlashMotion，一步 | 26.371 | 1.630 | 0.00663 | 0.21474 |
| FlashMotion，四步 | **29.134** | 0.907 | **0.00027** | **0.01295** |

**音乐生成舞蹈，FineDance。** FIDₖ 与 FIDɡ 分别比较运动学、几何特征分布，BAS 表示音乐节拍与舞蹈节拍的对齐程度。节选原表 II。[原表 II][table2]

| 方法 | FIDₖ ↓ | FIDɡ ↓ | BAS ↑ |
|---|---:|---:|---:|
| MEGA | 50.00 | **13.02** | 0.226 |
| FlowerDance | 29.73 | 19.59 | 0.232 |
| FlashMotion，一步 | 18.32 | 28.48 | 0.237 |
| FlashMotion，四步 | **15.15** | 21.13 | **0.240** |

**语音生成手势，BEAT2。** FGD 比较生成与真实手势的分布，BC 衡量语音和动作的节拍一致性，DIV 衡量多样性。节选原表 III。[原表 III][table3]

| 方法 | FGD ↓ | BC ↑ | DIV ↑ |
|---|---:|---:|---:|
| RAG-Gesture | 0.4870 | 0.5140 | **9.9400** |
| SemTalk | 0.3560 | 0.5100 | 8.4090 |
| FlashMotion，一步 | 0.4756 | 0.4801 | 6.8688 |
| FlashMotion，四步 | **0.3242** | **0.6006** | 9.1950 |

**一万帧吞吐量。** batch size 为 1，先完整预热一次，再对五次 GPU 同步运行取平均。FPS 用输出动作帧数除以生成运行时间，计时从预定义条件特征开始，到动作表示输出为止，外部编码、重定向和逆运动学均在计时之外。v2 的计时说明未指明 GPU 型号；旧版图注写过 RTX 3090，v2 修订时已移除。下表倍数依据四步配置与各任务所列最快外部基线。[v2 计时协议][setup] · [v1 图注][oldfig] · [作者速度比较][project]

| 任务 | 最快外部基线（动作帧/秒） | FlashMotion 一步 | FlashMotion 四步 | 四步加速比 |
|---|---:|---:|---:|---:|
| 文本 → 动作 | ST2M · 3,417 | 173,172 | 46,303 | 13.6× |
| 音乐 → 舞蹈 | FlowerDance · 4,145 | 159,800 | 40,545 | 9.8× |
| 语音 → 手势 | CaMN · 7,955 | 135,179 | 34,655 | 4.4× |

<figure class="reading-figure"><a href="/paper-notes/flashmotion/benchmark.svg" target="_blank" rel="noopener"><img src="/paper-notes/flashmotion/benchmark.svg" alt="BABEL 长度与计时对照。质量评测覆盖 201 到 1030 帧，另以 1000 和 10000 帧测四步推理吞吐量。" loading="lazy" /></a><figcaption>本站依据原文 v2 §IV-A 与表 I 绘制，点击可放大。耗时由四步 FPS 换算。处理 1,000 帧约需 93 毫秒，处理 10,000 帧约需 216 毫秒。较长输入的每秒生成帧数更高，完成整段仍花了更多时间。</figcaption></figure>

### 消融实验

**换采样策略、时间主干或损失。** 以下在 BABEL 上均采用四步生成。第一组保持干净动作预测目标与主干不变，第二组比较双向与单向主干，第三组改变监督项。表格保留原表 V–VII 的关键列。[原表 V][table5] · [原表 VI][table6] · [原表 VII][table7]

| 对照配置 | R@1 ↑ | FID ↓ | ΔAUJ ↓ |
|---|---:|---:|---:|
| Diffusion | 25.954 | 1.107 | 0.20795 |
| 普通 Flow Matching | 27.460 | 1.074 | 0.16019 |
| 单向 Mamba + MeanFlow | 24.881 | 0.917 | 0.63527 |
| 移除三维关节位置监督 | 28.613 | 0.983 | 0.06503 |
| 移除速度与加速度监督 | 27.393 | 0.928 | 0.01241 |
| 仅 MeanFlow 损失 | 未收敛 | 未收敛 | 未收敛 |
| 完整配置 | **29.134** | **0.907** | 0.01295 |

**条件注入。** 只做 AdaIN，FID 为 0.973；只用条件引导状态扫描，为 1.616；合用为 0.907。采样时间的消融也有取舍：偏向两端的 Beta(0.5,0.5) 给出更低 FID（0.731），但 R@1 为 27.908，低于默认均匀采样的 29.134。[原表 VIII][table8] · [原表 IX][table9]

**四秒舞蹈补间。** 在 FineDance 的 19 条测试录制中取 30 个窗口，用三个匹配随机种子、四步采样补 120 帧。Seam 衡量接缝处的速度突变，Jerk 衡量区间内部三阶差分，Activity 是生成与真值的相对关节运动强度之比。下列为原表 X 均值。[原表 X][table10]

| 掩码 | Seam（m/s）↓ | Jerk（m/s³）↓ | Activity（理想值 1）|
|---|---:|---:|---:|
| 真实动作 | 0.222 | 155.04 | 1.000 |
| 硬掩码 | 2.066 | 254.70 | 1.337 |
| 固定软掩码 | 1.657 | 251.29 | 1.329 |
| 随时间放松的软掩码 | **0.312** | **243.88** | 1.327 |

### 关键发现

1. **双向建模的收益在文本切换处尤其明显。** 同样用四步，双向主干换成单向主干后，FID 从 0.907 变为 0.917，转场 ΔAUJ 却从 0.01295 升至 0.63527。这解释了为什么检查“挥手接下蹲”时，还值得单独量交界处的动作变化。[原表 VI][table6]
2. **动作分布、语义、节奏各算各的。** 文本主表上 FloodDiffusion 的 FID 更低，舞蹈主表上 MEGA 的几何 FID 更低。FlashMotion 的强项在于同时取得高吞吐量、较好的检索与转场统计，以及较好的音频节拍对齐。[原表 I][table1] · [原表 II][table2] · [原表 III][table3]
3. **量化的补间收益集中在交界。** 自适应软掩码把 Seam 从 2.066 降到 0.312，内部 Jerk 从 254.70 降到 243.88，区间活动强度仍比真值高约三成。它解决的是边界处突然变速这一具体问题。[原表 X][table10]
4. **观看者对不同任务的感受有差异。** 30 名评价者对每项任务的 40 个条件按五分制评价。手势动作质量均分为 3.90，最接近的基线为 3.55。舞蹈质量均分 3.98，FineNet 已达 3.97，差值远小于两组各约 0.9 的标准差。速度带来的收益更大，并不意味着每个样本都能轻易看出画质或动作质量差距。[原表 IV][table4]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **一次问全片，一步走一段。** “四步”沿噪声时间计数，“三百帧”沿角色表演时间计数。两条时间轴分开后，既能看清为何网络只运行四次，也能看清为什么即使四步仍能输出细到每帧的动作。[原文图 2][fig2]
- **动作对人的可见变化就是可用监督。** 短步长的输出误差容易在多轮更新中被纠正，大步长的错误更容易保留到结果。直接预测干净动作，把旋转误差、手脚的空间偏差和速度跳变都变成可训练的量。仅保留平均速度损失时模型在作者配置下发散，这比“多加几项损失更好”提供了更具体的证据。[原表 VII][table7]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **超长序列的质量仍有验证空间。** 以文本任务为例，10,000 帧相当于 8 分 20 秒，远长于用于文本质量评测的最长约 52 秒。若要判断角色是否在第八分钟仍能执行新指令，需要按长度分别测切换、漂移和动作重复。[评测范围][setup]
- **手势的节拍一致性与语义指向需要分开测。** BEAT2 表报告 FGD、BC、DIV。模型输入含对齐文本，但这三项指标没有逐事件检验“说出某个词时，右手是否在指定帧指向正确对象”。文本、音乐和语音也分别使用独立权重，实验没有测试二者对同一关节提出冲突要求时如何取舍。[任务接口][overview] · [原表 III][table3]
- **应用演示的时延各有条件。** 单次双向推理能读取当前窗口后文，未知未来时可通过前缀约束逐窗生成，需另测首帧等待及跨窗误差。手机演示在 iPhone 17 上用缓存文本嵌入、量化及优化算子，四步生成 200 帧约 400 毫秒；文中的 G1 案例采用重定向和 MuJoCo 仿真跟踪。[编辑流程][edit-eq] · [应用实验][applications]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **FlowerDance** 是作者明确指出的前作，已用 MeanFlow 和双向序列建模加快音乐舞蹈生成。FlashMotion 将骨架监督直接加到干净动作预测上，并让逐帧条件同时作用于状态扫描和通道调制，再用三套任务模型检验其适用范围。[FlowerDance 解读](/blog/eccv2026-flowerdance/) · [原文对前作的说明][intro]
- **MotionStreamer** 采用因果、逐步生成的动作表示，更接近持续到来的文字输入。FlashMotion 的主测试则给出整条条件时间轴，一次联动更新前后动作。做交互系统选型时，先确定用户能否提前给出后半句，两类速度就有了可比的应用背景。[MotionStreamer 解读](/blog/iccv2025-motionstreamer/) · [FlashMotion 生成协议][setup]
- **DART** 让短动作基元在给定历史上延伸，便于在线切换控制；FlashMotion 的多步软掩码能拿已有片段做上下文、填中间缺口。若任务是编辑特定手腕轨迹，适合同时比较交界速度和编辑后已知关节的逐帧误差。[DART 解读](/blog/iclr2025-dart/) · [FlashMotion 补间评测][table10]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- [arXiv v2 可翻译 HTML 全文][html] · [v2 PDF][pdf] · [版本与修订记录][record]
- [作者项目与分段动作演示][project] · [公开源码及三任务运行说明][code] · [六个预训练检查点][weights] · [预处理数据（需申请）][data]
- [文本模型训练配置与评测入口][t2m-code] · [采样数学与实现对应][sample]

</div>

[record]: https://arxiv.org/abs/2611.13626
[html]: https://arxiv.org/html/2611.13626v2
[pdf]: https://arxiv.org/pdf/2611.13626v2
[oldfig]: https://arxiv.org/html/2611.13626v1#S0.F1
[project]: https://sun-happy-ykx.github.io/FlashMotion-Project/
[code]: https://github.com/Sun-Happy-YKX/FlashMotion-release
[weights]: https://huggingface.co/yangkaixing/FlashMotion-models
[data]: https://huggingface.co/datasets/yangkaixing/FlashMotion-data
[sample]: https://github.com/Sun-Happy-YKX/FlashMotion-release/blob/bed5510b8770762f6df780bf152725d4c49c0f49/docs/sampling.md
[t2m-code]: https://github.com/Sun-Happy-YKX/FlashMotion-release/blob/bed5510b8770762f6df780bf152725d4c49c0f49/docs/t2m.md
[scorer]: https://github.com/Sun-Happy-YKX/FlashMotion-release/blob/bed5510b8770762f6df780bf152725d4c49c0f49/tasks/t2m/reproduce_main.py#L240-L255
[intro]: https://arxiv.org/html/2611.13626v2#S1
[overview]: https://arxiv.org/html/2611.13626v2#S3.SS1
[flow]: https://arxiv.org/html/2611.13626v2#S3.SS2
[arch]: https://arxiv.org/html/2611.13626v2#S3.SS3
[eq8]: https://arxiv.org/html/2611.13626v2#S3.E8
[losses]: https://arxiv.org/html/2611.13626v2#S3.E12
[edit-eq]: https://arxiv.org/html/2611.13626v2#S3.E13X
[fig2]: https://arxiv.org/html/2611.13626v2#S2.F2
[fig3]: https://arxiv.org/html/2611.13626v2#S4.F3
[qual]: https://arxiv.org/html/2611.13626v2#S4.SS3
[setup]: https://arxiv.org/html/2611.13626v2#S4.SS1
[table1]: https://arxiv.org/html/2611.13626v2#S3.T3.2.1
[table2]: https://arxiv.org/html/2611.13626v2#S3.T3.fig1
[table3]: https://arxiv.org/html/2611.13626v2#S3.T3.fig2
[table4]: https://arxiv.org/html/2611.13626v2#S4.T6.5
[table5]: https://arxiv.org/html/2611.13626v2#S4.T6.6.1
[table6]: https://arxiv.org/html/2611.13626v2#S4.T6.7.1
[table7]: https://arxiv.org/html/2611.13626v2#S4.T9.2.1
[table8]: https://arxiv.org/html/2611.13626v2#S4.T9.3.1
[table9]: https://arxiv.org/html/2611.13626v2#S4.T9.4.1
[table10]: https://arxiv.org/html/2611.13626v2#S4.F6.fig2
[edit]: https://arxiv.org/html/2611.13626v2#S4.SS6
[applications]: https://arxiv.org/html/2611.13626v2#S4.SS7
