---
title: "[CVPR2026] MoLingo：怎样让动作生成器知道每一小段身体在做什么？"
description: "MoLingo: Motion–Language Alignment for Text-to-Human Motion Generation。用先跑、转身、侧手翻的例子串起 BABEL 局部标签、连续动作自编码器和掩码整流流，比较语义监督对文本检索与动作分布质量的不同影响。"
pubDate: "2026-11-25T14:51:00+08:00"
badge: "Paper"
tags: ["MoLingo", "Text-to-Motion", "Motion Representation", "BABEL", "HumanML3D", "Rectified Flow", "Masked Autoregression", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML][html] · [CVPR 正式 PDF][pdf] · [补充材料 PDF][supp] · [作者演示][project] · [官方代码与权重入口][code]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026</summary>

*MoLingo: Motion–Language Alignment for Text-to-Human Motion Generation*。作者为 Yannan He、Garvita Tiwari、Xiaohan Zhang、Pankaj Bora、Tolga Birdal、Jan Eric Lenssen、Gerard Pons-Moll。发表于 CVPR 2026，页码 38387–38398。正文与表格对照会议终稿，HTML 链接为 arXiv v3。研究方向为文本生成动作、时序动作表示、掩码自回归与整流流。本次静态核对了训练和演示代码，实验数值取自论文。[会议记录][venue] · [原文 HTML][html] · [代码版本][code]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给一句“先跑、再转身、最后做侧手翻”，MoLingo 要学会让**不同时间位置的全身动作向量**各自保留相应的动作含义。它先用真实骨架和局部动作标签一起训练自编码器，再教生成器根据整句文字填出这些连续向量，最后解码成动作。语义监督提高了生成动作与文字的匹配度，但论文中动作分布 FID 最低的是另一种编码器配置。[方法图 2][f2] · [主表 1][main]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　长序列的几百帧骨架可以先压缩成几十个时间位置，再在这个空间内生成。自编码器负责把位置、旋转等动作特征压缩与还原；生成器负责按文字推测这一串表示怎么取值。[原文 §2–3][html]

**现有痛点**　重建误差很小，只说明解码器有办法还原这段动作。它仍可能把“向左斜着走”和“正常向前走”编码在对文字生成器很难区分的位置。与此同时，如果整句描述只得到一个文本向量，每个动作位置能直接读取的文字信息也相同。[原文 §1][intro] · [表 2][abl]

**核心矛盾**　两个片段都标作“跑”，标签给了它们共同的语义方向，但抬腿高度、步长和转向仍需要分别保留。一个训练目标要鼓励它们靠近，另一个训练目标却要让解码器有足够信息重建两种运动。[原文 §3.1][sae]

**本文目标**　从一条自然语言描述生成连续全身动作，使动作顺序和修饰词更符合文字，同时保持骨骼运动的质量。[原文 §3][task]

**切入角度**　BABEL 提供带时间范围的动作标签。对能与 HumanML3D 对上的序列，可以定位某个局部动作向量对应的几帧，用这些帧上的标签训练它。训练生成器时另用整句描述，让每个时间位置分别关注句中不同的词。[原文 §3.1–3.2][sae] · [实验设置][setup]

**核心 idea**　语义进入系统两次。训练动作表示时，局部标签告诉编码器一段真实动作在做什么；从文字生成时，词元序列告诉生成器用户希望整段做什么。两路文本来自不同地方，承担不同任务。[图 2][f2] · [图 3][f3]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

上半图用真实动作学习一套可重建、受语言监督的全身向量。下半图开始生成时，输入是一句文字和所需时长的空时间轴。Transformer 为待填位置组织文字与动作上下文，小型整流流网络采样向量，动作解码器才把序列还原为骨架。[原文 §3.1][sae] · [§3.2][generator]

<figure class="reading-figure"><a href="/paper-notes/molingo/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/molingo/architecture.svg" alt="训练时，BABEL 局部动作标签与真实骨架的连续向量按时间窗对齐，同时重建动作。推理时掩码 Transformer 用动作查询读取整句文字，再通过整流流 MLP 逐批填入连续向量，完成后解码成骨架。" /></a><figcaption>依据原文图 2、图 3 和附录重绘。上方虚线表示只在有局部标注时参与训练的语义损失，下方回路表示生成结果会成为下一轮可见的动作上下文。点击可放大。</figcaption></figure>

### 关键设计

1. **动作向量每隔四帧产生一次，语义监督可以覆盖更长的窗口。** 在论文主配置中，输入 N 帧，经因果一维卷积得到 N/4 个 16 维向量。下采样步幅为 4 时，代码为第 i 个向量汇总从 max(0, 4i−16) 到 4i＋4 的帧级文字特征，右端不含，内部位置共 20 帧。这个标签窗口既含当前四帧，也含先前的上下文。每个向量仍表示这段时间的全身运动。[附录的窗口说明][win] · [训练实现][labelcode]

2. **标签只给软约束，动作细节由重建保住。** 将窗口内的帧标签用冻结的 T5-Large 编成特征，先平均再投影至动作潜空间。用余弦损失拉近局部动作向量和对应的文字向量；重复标注经过筛选，减少同一个“走”持续数十帧带来的重复监督。只有两套数据的有标注交集承担这一项，动作重建则利用整套训练数据，同时比较表示本身、关节位置和关节速度。最终 SAE 配置还加入 KL 正则。[原文 §3.1][sae] · [表 3][saeabl] · [补充表 6][filter]

3. **动作向文本提问。** 生成器的文本端也从冻结的 T5-Large 出发，经六层文本适配器保留一串词元。每层 Transformer 中，动作位置先相互交换信息，其输出再作为交叉注意力的 Q，文字词元作为 K 和 V。于是“向左”和“转身”可对不同时间位置起不同作用。这是一种可学习的软对应；文中没有为每个生成位置硬指派一个单词。[原文 §3.2][generator] · [补充表 5][adapter]

4. **外层选空位，内层生成连续数值。** 训练时随机遮住部分真实动作向量，被遮位置可以通过双向注意力读取已知位置。推理从全掩码开始，每轮选一个或一组尚空的位置，Transformer 给出各自的条件向量；整流流 MLP 在条件与流时间的调节下把噪声变成连续动作向量，填回后进入下一轮。这里的自回归指依赖已经生成的向量，顺序可按选中的位置推进。因果动作编码器本身不能保证整个生成过程实时流式输出。[原文 §3.2][generator] · [补充材料的两种步数][rf]

### 一个完整例子

用原文图 4“先跑、再转身、最后做侧手翻”说明。假设要生成 4 秒，沿用主评测的 20 fps、四倍压缩和 16 维潜变量，80 帧对应 **20 × 16** 的动作表示；时长与形状是教学例子。训练编码器时，如果一段有局部标注的真实动作覆盖转身，相关时间窗的动作表示会朝相应文字特征靠近。从这句话生成时，模型手里只有词元和 20 个待填位置，模型自行决定哪段开始转身，也自行安排侧手翻的准备动作。填满后解码回 80 帧。图 4 给出动作顺序的定性对比，文中未提供这句话各事件真实发生帧与生成帧的逐项误差。[原文图 4][example] · [代码里的时长输入][demo]

### 训练与推理

- **训练。** 论文报告动作自编码器训练 5,000 个 epoch，生成器约 800 个 epoch，批大小均为 256。作者给表 1 最佳配置报告的完整训练耗时约为 4 张 H100 上的 10 小时，按卡数折合约 40 GPU 小时，未逐阶段拆账。生成器训练随机丢弃 10% 的文字条件，论文推理配置使用 5.5 的无分类器引导尺度。[原文 §4.1][setup]
- **公开演示。** 仓库允许提供动作描述与时长，也可用 MoMask 的长度估计器选择时长。作者主推的 272 维演示模型用 30 fps、两倍压缩和 32 维潜变量。上面的 20 × 16 例子对应论文主评测配置；把它换成演示配置，4 秒就是 120 帧和 60 × 32 个潜变量元素。[官方运行说明][run] · [演示代码][demo]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

下表摘自原表 1，均使用 **HumanML3D 的 MARDM-67 评价器**，保留原表 20 次评估的均值。FID 越低表示生成集与真实集在该特征空间的分布越近；R@1 衡量检索时正确配对排在首位的比例；CLIP-Score 衡量文本与动作匹配；MModality 衡量同一句话下生成结果的多样性。论文另外报告 TMR-263、MS-272 结果，三种协议的绝对值应分别阅读。[原表 1][main] · [评估协议][setup]

| 方法 | FID ↓ | R@1 ↑ | CLIP-Score ↑ | MModality ↑ |
|---|---:|---:|---:|---:|
| MoMask | 0.116 | 0.490 | 0.637 | 1.309 |
| DisCoRD | 0.053 | 0.506 | 0.645 | 1.303 |
| MARDM-v | 0.114 | 0.500 | 0.642 | **2.231** |
| ACMDM-XL-PS2 | 0.058 | 0.522 | 0.652 | 2.077 |
| MoLingo（VAE） | **0.049** | 0.528 | 0.672 | 1.414 |
| MoLingo（SAE） | 0.066 | **0.544** | **0.686** | 1.226 |

终稿 §4.3 的叙述将 SAE 的 R@1 写作 0.542；同一终稿表 1、表 2 和表 3 均列为 **0.544**，上表与下方消融统一按表格取值。[终稿第 8 页](https://openaccess.thecvf.com/content/CVPR2026/papers/He_MoLingo_Motion-Language_Alignment_for_Text-to-Human_Motion_Generation_CVPR_2026_paper.pdf#page=8) · [原表 1][main]

**人实际看动画时选哪一个？** 作者为每个基线随机选 20 对样本、随机摆放左右位置，每组比较收集 15 位参与者的判断，请他们综合考虑动作真实感与文字符合度。MoLingo 对 DisCoRD、MoMask、MotionStreamer 的偏好比例分别为 83.75%、77.70%、84.70%。前两组用 263 维表示，与 MotionStreamer 的对比改用 272 维。这个问法同时包含两个标准，不能将比例直接读成“所有指定事件都按时完成”的准确率。[人评设计与结果][human]

### 消融实验

在同一 MARDM-67 协议下，原表 2 分开改变文本条件与动作表示。AdaLN 将文本汇总后调制网络，CrossAttn 保留多个词元。第一行是原表列入的 MARDM 结果。对照后面同为 T5 的各行，可以区分改条件接口与改自编码器的作用。[原表 2][abl]

| 文本条件 | 动作自编码器 | FID ↓ | R@1 ↑ | CLIP-Score ↑ |
|---|---|---:|---:|---:|
| CLIP 单向量，AdaLN | AE | 0.114 | 0.500 | 0.642 |
| T5 单向量，AdaLN | AE | 0.077 | 0.508 | 0.650 |
| T5 多词元，CrossAttn | AE | 0.051 | 0.533 | 0.673 |
| T5 多词元，CrossAttn | VAE | **0.049** | 0.528 | 0.672 |
| T5 多词元，CrossAttn | SAE | 0.066 | **0.544** | **0.686** |

- **重复标签过滤。** 打开过滤后，FID 从 0.096 降至 0.066，R@1 从 0.524 提到 0.544。同一个标签覆盖很多帧时，重复加入监督对生成有实际代价。[补充表 6][filter]
- **相似标签要不要当负样本推开？** 固定语义权重 0.001、关闭 KL，InfoNCE 各项为 FID 0.129、R@1 0.523；余弦监督对应 0.062 和 0.535。此处先固定 KL 再比较损失形式。最终配置加入 KL 后 R@1 又到 0.544。[原表 3][saeabl]
- **少采几轮快多少？** 内层固定 32 步，外层从默认 16 轮降到 5 轮，单段平均耗时从 2.83 秒降到 0.83 秒，FID 从 0.066 升到 0.105。单段生成耗时和流式应用中第一帧的等待时间是两个指标，论文表 7 测的是前者。[补充表 7][speed]

### 关键发现

固定生成骨干和 T5 多词元条件，普通 AE 换成 SAE 后，R@1 从 0.533 升到 0.544，FID 则从 0.051 升到 0.066。若研究问题是“能否让局部动作更容易受文字驱动”，这个同条件对照比单列全表最佳值更有解释力。若研究问题是“每个动作词准确落在哪几帧”，仍需单独的事件定位评价。[原表 2][abl]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **能在生成器真正使用的对象上加局部语义监督。** 同一个 mᵢ 既受到局部标签约束，又直接交给动作解码器重建骨架。因而可以检查一个明确环节：当生成器学着预测这些向量时，文本匹配度是否随之变化？表 2 比较了同一生成方法接 AE 与 SAE 的结果。[原文 §3.1][sae] · [表 2][abl]
- **压缩步幅和文字覆盖范围值得分开记录。** 主配置每四帧产出一个向量，内部位置的标签窗口却有二十帧。动作边界附近，一个表示可能同时受到前一动作及过渡动作的监督。这让连续变化有容身之处，也意味着不能把每个潜变量直接翻译成唯一的动作词。[补充材料][win] · [训练代码][labelcode]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **时间轴有位置，全身向量内却没有显式部位槽。** 论文没有暴露“第 2 秒只改左手”的控制接口，也未对手部精细动作建模。要检验语义是否独立落在某一身体部位，可以固定其余条件，改变局部描述后检查目标和非目标关节各自变化多大。这属于后续实验。[作者局限][limits] · [方法][sae]
- **推理时的帧边界取决于模型。** 训练的帧标签没有作为用户输入接口保留下来。文字若指定“第三秒转身”，当前的检索分数并不能判断动作是否在第三秒发生。原文例子支持动作内容与先后关系，定时、接触与空间落点需要各自的测量。[图 4][example] · [指标][setup]
- **机器人演示多了一层控制器。** 作者先把生成动作重定向到 Unitree G1，交给强化学习跟踪器得到控制轨迹，再在仿真中回放。地面接触和站立稳定性属于这条组合链路；论文的普通文本生成端输出的是运动学动作。截至本次核对，官方仓库已发布动作训练与生成脚本，G1 跟踪管线在发布清单上仍标为待提供。[补充材料的 G1 设置][g1] · [代码发布记录][code]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **MARDM** 同样在连续动作向量上做掩码生成。MoLingo 细查了两件经常混在一起的因素：文本怎样进入 Transformer，以及生成目标的动作表示是否已受语言监督。表 2 先换文本接口，再固定接口换自编码器。[原文表 2][abl]
- **DisCoRD** 从生成的离散动作码出发，用整流流解码到连续动作。MoLingo 将整流流放在另一个位置：它负责采样各个连续动作潜变量，之后再用动作解码器还原骨架。比较两篇时，可以顺着“流的输出是什么”找到两种架构的差别。[站内 DisCoRD 解读](/blog/iccv2025-discord/) · [MoLingo 生成器][generator]
- **ActionPlan** 也使用帧级动作语义。ActionPlan 为逐帧语义计划和运动分别保留表示，联合训练两路生成；MoLingo 则把语义监督加到需要重建动作的同一个向量上。若要看能否独立读出或修改计划，这个区别直接决定该检查哪个变量。[站内 ActionPlan 解读](/blog/eccv2026-actionplan/) · [MoLingo 自编码器][sae]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- [CVPR 会议记录][venue] · [正式论文 PDF][pdf] · [补充材料 PDF][supp] · [可翻译的 arXiv HTML][html]
- [作者项目与动画对比][project] · [模型、权重下载和运行说明][code] · [逐窗语义对齐的代码][labelcode]
- [原表 1 与主评测协议][main] · [原表 2 与条件对照][abl] · [补充表 7 与速度对照][speed]

</div>

[html]: https://arxiv.org/html/2512.13840v3
[venue]: https://openaccess.thecvf.com/content/CVPR2026/html/He_MoLingo_Motion-Language_Alignment_for_Text-to-Human_Motion_Generation_CVPR_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/He_MoLingo_Motion-Language_Alignment_for_Text-to-Human_Motion_Generation_CVPR_2026_paper.pdf
[supp]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/He_MoLingo_Motion-Language_Alignment_CVPR_2026_supplemental.pdf
[code]: https://github.com/hynann/MoLingo/tree/52e3b4c309256ce1bb29c8c038fe34b88682db08
[project]: https://hynann.github.io/molingo/MoLingo.html
[intro]: https://arxiv.org/html/2512.13840v3#S1
[task]: https://arxiv.org/html/2512.13840v3#S3
[sae]: https://arxiv.org/html/2512.13840v3#S3.SS1
[generator]: https://arxiv.org/html/2512.13840v3#S3.SS2
[setup]: https://arxiv.org/html/2512.13840v3#S4.SS1
[f2]: https://arxiv.org/html/2512.13840v3#S2.F2
[f3]: https://arxiv.org/html/2512.13840v3#S2.F3
[example]: https://arxiv.org/html/2512.13840v3#S3.F4
[main]: https://arxiv.org/html/2512.13840v3#S3.T1
[abl]: https://arxiv.org/html/2512.13840v3#S3.T2
[saeabl]: https://arxiv.org/html/2512.13840v3#S4.T3
[filter]: https://arxiv.org/html/2512.13840v3#S5.T6
[adapter]: https://arxiv.org/html/2512.13840v3#S5.T5
[speed]: https://arxiv.org/html/2512.13840v3#S6.T7
[human]: https://arxiv.org/html/2512.13840v3#S4.SS3.SSS0.Px3
[limits]: https://arxiv.org/html/2512.13840v3#S5
[win]: https://arxiv.org/html/2512.13840v3#S6.SS0.SSS0.Px2
[rf]: https://arxiv.org/html/2512.13840v3#S6.SS0.SSS0.Px3
[g1]: https://arxiv.org/html/2512.13840v3#S6.SS0.SSS0.Px5
[labelcode]: https://github.com/hynann/MoLingo/blob/52e3b4c309256ce1bb29c8c038fe34b88682db08/mogen/core/sae_trainer.py#L117-L161
[demo]: https://github.com/hynann/MoLingo/blob/52e3b4c309256ce1bb29c8c038fe34b88682db08/mogen/demo.py#L181-L234
[run]: https://github.com/hynann/MoLingo/blob/52e3b4c309256ce1bb29c8c038fe34b88682db08/README.md#demo
