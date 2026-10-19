---
title: "[NeurIPS2023] FineMoGen：把动作描述拆到时间段与身体部位，再用注意力组合生成"
description: "解析阶段与部位描述、SAMI 时空混合注意力和交互编辑：含完整架构图、五张原始结果表、消融及论文与公开代码的差异。"
pubDate: "2026-10-19T16:09:06+08:00"
badge: "Paper"
tags: ["FineMoGen", "Motion-Generation", "Motion-Editing", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261019-finemogen" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · NeurIPS 2023 · 正式版</summary>

**论文：** FineMoGen: Fine-Grained Spatio-Temporal Motion Generation and Editing  
**作者：** Mingyuan Zhang、Huirong Li、Zhongang Cai、Jiawei Ren、Lei Yang、Ziwei Liu  
**出处：** NeurIPS 2023 主会，Advances in Neural Information Processing Systems 36；[正式论文入口](https://papers.neurips.cc/paper_files/paper/2023/hash/2d52879ef2ba487445ca2e143b104c3b-Abstract-Conference.html)，DOI：[10.52202/075280-0616](https://doi.org/10.52202/075280-0616)。  
**原文与项目：** [正式 PDF](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf) · [arXiv v1，含附录](https://arxiv.org/html/2312.15004v1) · [作者项目页](https://mingyuan-zhang.github.io/projects/FineMoGen.html) · [官方代码](https://github.com/MotrixLab/FineMoGen)。  
**领域与关键词：** 文本驱动动作生成；时空组合；SAMI；全局注意力模板；稀疏 MoE；基于描述的交互编辑。  
**阅读版本：** NeurIPS 正式主文（12 页）与正式补充材料（5 页），并对照 arXiv v1（2023-12-22）的合订全文；公开实现状态核验于 2026-10-19。本文区分论文机制、公开代码差异与作者实验，未运行模型。

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

FineMoGen 把动作要求组织成“什么时间、哪个身体部位、做什么”的描述表，再让扩散模型通过带有时间锚点和身体分组的 SAMI 注意力生成协调的全身动作。它的交互编辑由 GPT-4 修改这张描述表后重新生成整段动作实现，**已有动作本身并不作为编辑输入，未修改区域也没有逐帧保持保证**。

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 文本动作生成已经能根据一句描述合成连续骨骼动作，扩散模型进一步改善了生成质量与多样性。但常规接口主要表达一段动作的大意，例如“一个人转身，然后边走边挥手”。这种整体描述并不天然告诉模型：头在哪个方向、哪只手在动、两条腿什么时候开始前进，各部分又如何配合。

**现有痛点：** 假设先生成“看手机并转身，接着朝右看、向前走、挥右手”，用户又提出“把后半段的手抬高，挥久一点”。把整句提示重写一次，模型可能改对手臂，却让转身顺序、腿部动作或时长发生不必要的变化；把多个动作分别生成再连接，又容易在交界处出现不自然的速度和姿态变化。这里需要的既是更细的条件接口，也是能理解条件作用范围的生成机制。

**核心矛盾：** 用户的要求是按时间和身体部位组织的，而通用生成模型往往先把全身状态混合成一个特征，再用整体文本影响整段序列。条件的组织方式与模型内部的信息流不一致。完全分开生成各部位、各阶段虽然便于控制，却又失去了全身协调和阶段过渡所需的联系。

**本文目标：** 同一框架既接受普通整体描述，也接受分阶段、分部位的细粒度描述；既能从带有组合标注的数据中学习，也能在没有相应组合训练样本时尝试新的时空组合。作者还希望用户通过日常语言持续修改动画需求，而不必手工填写每个身体部位的全部字段。[正文 §1–3](https://arxiv.org/html/2312.15004v1)

**切入角度：** FineMoGen 关注扩散网络中的注意力：文本和动作如何汇聚成全局特征，这些特征又如何作用于每一帧。作者为全局模板加入显式时间位置，为动作特征保留身体分组，同时加入有限的跨部位通信。这样既有条件分工，也能交换完成协调动作所需的信息。

**核心 idea：** 先把需求写成一张可编辑的“阶段 × 身体部位”描述表；生成时，让文本与带噪动作形成分组模板，把模板展开成随时间变化的特征，再融合身体各部分的信息。稀疏专家网络提高这些特征变换的容量。编辑时，GPT-4 负责改描述，扩散模型负责根据新描述重新合成动作，两个模块的职责明确分开。

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

FineMoGen 的生成器是一套条件扩散网络。细粒度描述经冻结的 CLIP 文本编码器和可训练文本 Transformer 形成条件特征；当前带噪动作按身体部位拆分、分别投影后进入 Motion Transformer。每层 SAMI 同时计算时间特征和跨部位特征，再由后续网络预测干净动作，供采样器逐步更新。GPT-4 位于这一生成过程之前，可帮助创建或修改描述表；它不读取源动作帧，也不直接输出关节坐标。[正文 §3.1–3.5、图 2–3](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=4)

[![FineMoGen 完整架构教学示意](/paper-notes/finemogen/architecture.svg)](/paper-notes/finemogen/architecture.svg)

*点击图片查看大图。依据[正式论文图 2–3 与 §3](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=4)和附录 D 重新绘制；教学示意，非作者原图或模型实测。*

读图时，先沿上方的描述与编辑分支进入生成主线，再看带噪动作和扩散步两个输入，最后展开 SAMI 内部的时间、空间并行分支。训练区的真实动作只用于加噪和监督；它不是推理时必须提供的参考动作。图中的扩散步表示“当前去噪到哪一步”，动作时间位置表示“序列里的第几帧”，两者不能混为一谈。该图依据作者图 2–3 和附录 D 重绘，为教学示意。

### 关键设计

1. **细粒度描述表：把作用时间和身体范围放进输入接口**

   论文把条件写成 Text<sub>i,j</sub>：i 表示动作阶段，j 表示身体分组。阶段还有对应的时间范围或持续帧数。这里的七组分别是头、躯干、左臂、右臂、左腿、右腿和骨盆轨迹；最后一项关注人在空间中的整体移动，不只是一个关节的局部姿态。

   例如，“后半段右手举过头顶、双腿继续向前走”可以拆成同一阶段中不同组的条件。模型因此知道“举过头顶”主要对应右臂，而“向前走”还涉及腿部和骨盆轨迹。它仍然学习文本与连续动作的关系，描述表不是逆运动学指令，也不包含“手必须到达某个三维坐标”的数值硬约束。[正文 §3.2–3.3](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=4)

   为了让用户不必手工填写，附录 D 用提示要求 ChatGPT-4 把一句需求分成若干阶段，并给出每阶段的整体动作、七组细节描述以及持续帧数，提示中采用 30 帧/秒。用户也可以直接提供细粒度描述，LLM 并不是运行生成器的必需条件。这个过程属于调用预训练 LLM 的提示式交互；论文没有对 GPT-4 进行动作任务微调，且把 instruction tuning 明确列为未来工作。[附录 D；正文 §5](https://arxiv.org/html/2312.15004v1)

2. **全局模板：先汇聚动作与文本，再决定每帧如何使用这些信息**

   SAMI 建立在 Mixed Efficient Attention 之上。普通两两注意力直接比较大量位置对；这里先把动作和文本的投影值 V 按权重 K 汇聚成少量全局模板 G，再把模板信息分配回动作序列。式（1）的核心可写成：

   <div class="equation">G = softmax(K) · V</div>

   V 回答“有什么信息”，K 回答“哪些输入应进入哪个模板”。普通基线随后用动作查询 Q 组合这些模板，得到注意力输出。模板是当前网络层计算出的学习特征，不是数据库中的动作片段，也不是人为命名的“走路”“挥手”动作词典。[正文 §3.3，式（1）–（2）](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=5)

   FineMoGen 的关键变化是让这些模板具有时间意义和身体分组，而不是仅依靠一个任意查询向量决定它们对每一帧的作用。文本条件与当前带噪动作都会参与形成模板，模型因而能够结合“希望做什么”和“当前生成到什么状态”进行特征更新。论文沿用了 ReMoDiffuse 的部分网络设计，但 FineMoGen 的这条主线并没有检索示例动作的数据库分支。

3. **时间建模：用时间锚点和随时间变化的特征连接多个动作阶段**

   如果每个阶段只生成自己的独立特征，再直接拼接，阶段边界处缺少交流；测试时增加阶段数也不容易统一处理。FineMoGen 将每个模板解释为围绕某个时间锚点传播的特征信号：模板经不同投影得到锚点 τ、锚点处的特征 s 和变化率 v，再计算当前动作时间 u 上的信号。以下将原式（3）–（4）的下标省略，以突出机制：

   <div class="equation">g<sub>j</sub>(u) = s<sub>j</sub> + v<sub>j</sub>(u − τ<sub>j</sub>)</div>
   <div class="equation">w<sub>j</sub>(u) = exp[−(u − τ<sub>j</sub>)² / σ²] / Σ<sub>l</sub> exp[−(u − τ<sub>l</sub>)² / σ²]</div>
   <div class="equation">Y<sup>T</sup>(u) = Σ<sub>j</sub> w<sub>j</sub>(u) · g<sub>j</sub>(u)</div>

   第一式让同一个模板在不同帧产生不同特征；第二式让距离当前帧更近的时间锚点具有更大权重；第三式把多个模板的影响平滑混合。σ 控制时间距离对权重的影响。新增阶段时，可以为这一阶段的模板锚点加入相应时间偏移，将其放到整段动作的正确位置。[正文 §3.3，图 3c、式（3）–（4）](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=6)

   直观地说，从“低头看手机”转入“朝右看并挥手”时，前后阶段的特征在边界附近共同发挥作用，后阶段的影响逐渐增强。这里混合的是网络特征，最终关节运动仍由去噪网络学习得到。论文用 state、velocity 命名 s、v，不代表模型已经显式计算了真实关节位置和速度，更不能由此推出接触、速度连续性或无穿模的数学保证。

   主文给出的是一阶时间表达式。后面介绍的公开代码进一步加入高阶项；理解论文时，应先抓住“带时间锚点的特征信号与距离加权”这个核心，而不要把它误读成先生成若干固定动作片段，再做普通线性插值。

4. **身体分组与空间协作：保留局部条件，也允许全身协调**

   FineMoGen 不把整个人体的原始向量直接投影成一个完全混合的特征，而是先按七组分别投影。对应的前馈网络也分别处理这些组，动作特征原则上进入所属组的全局模板。如果只有一句整体描述，它可以向各组提供条件；如果有分部位描述，各文本则主要进入自己的组。

   这样做能降低“抬右手”的条件被直接混到左腿特征中的机会，但完全隔离也会失去协调能力。例如大幅挥手时，躯干可能需要转动或调整重心。论文因此增加一个并行空间分支，将各部位的增强特征 B 通过可学习的关系矩阵 ω 混合：

   <div class="equation">Y<sup>S</sup><sub>k,i</sub> = Σ<sub>j</sub> ω<sub>i,j</sub> B<sub>k,j</sub>，　Y<sub>k,i</sub> = Y<sup>T</sup><sub>k,i</sub> + Y<sup>S</sup><sub>k,i</sub></div>

   k 为当前帧，i 为接收信息的部位，j 为贡献信息的部位。ω 学到的是部位间的共享关联，并非逐条由用户指定的骨骼约束。由此可见，论文的 spatial independence 指特征分组和条件分工，**并不意味着七个部位互不影响，更不意味着未被提及的部位保持原动作不变**。[正文 §3.3，式（5）与 Module Output](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=7)

5. **稀疏 MoE：增加学习容量，补偿时空拆分带来的拟合困难**

   拆分时间与身体范围后，网络必须在更细的范围内学习动作规律，原有的单一特征变换可能不够灵活。作者引入 sparsely-activated mixture of experts：门控网络根据输入特征选取少量专家，组合被选中专家的输出，而不是每次计算所有专家。

   可以把它理解为“同一个身体组在不同动作状态下，选择不同的特征处理方式”。这些专家是学习出来的网络，不是预先标注的某个关节或某类动作专家；七个身体组和 MoE 的专家数量也是两回事。正文将 MoE 用于增强来自动作特征的投影，并说明文本条件在去噪期间不变，因此不需要同样的自适应处理。[正文 §3.3，式（6）](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=7)

   MoE 是容量与计算量之间的选择，不能仅凭“每次只激活几个专家”就认定整个系统更快。论文消融支持它改善部分生成指标；本文没有实测训练或推理速度。当前公开实现对文本也使用 MoE，与主文说明存在差异，具体见后文。

6. **基于描述的编辑：LLM 改计划，生成器重新合成**

   编辑时，系统保存的交互状态是已经使用的细粒度描述。新的用户指令连同这份描述一起交给 GPT-4；GPT-4 生成修改后的描述，FineMoGen 随后根据新条件从头生成一段动作。[正文 §3.4；附录 D](https://arxiv.org/html/2312.15004v1)

   因此，这里有三个需要分开的事实：第一，GPT-4 读到的是文字状态，不是当前动画的三维关节轨迹；第二，扩散网络的带噪动作是新一轮采样状态，不是旧动作的编码；第三，保留某一阶段的文本并不等于保留该阶段的实际帧。作者在 §3.4 主动说明，示例中未修改的第一阶段也可能因重新生成而改变。

   论文的 zero-shot 也有两个相关但不同的语境。**组合实验**表示对应模型没有使用该类时序组合或空间组合训练数据，并不表示动作生成器从未训练；**交互编辑**表示利用预训练 LLM 和已经训练的生成器实现描述修改，不额外训练一套源动作—编辑指令—目标动作模型。这些结果不能直接扩展成“输入任意现有动作，就能精准修改并保持其余细节”。[正文表 4、§3.4；正式补充 §C、表 1（arXiv 合订版表 5）](https://arxiv.org/html/2312.15004v1)

### 一个完整例子

下面沿用论文图 1 的两阶段示例。原图为节省空间只展示头、手臂、腿部几类条件，下表也只整理这些已展示的内容；它不是完整七组提示词的逐字导出。

| 阶段 | 头部条件 | 手臂条件 | 腿部条件 | 持续帧数 |
|---|---|---|---|---:|
| 第一阶段 | 看手机 | 使用手机 | 转身 | 60 |
| 第二阶段，修改前 | 向右看 | 挥右手 | 向前走 | 60 |
| 第二阶段，修改后 | 向右看 | 在头顶上方挥右手 | 向前走 | 90 |

1. **组织输入。** 系统获得两阶段描述，并知道每个阶段的帧数。按附录 D 提示使用的 30 帧/秒换算，最初两阶段合计 4 秒；修改后合计 5 秒。这里的秒数只是由原图帧数换算，论文没有因此承诺所有数据集或所有运行配置都采用同一帧率。

2. **编码条件与生成状态。** 文本经 CLIP 和文本 Transformer 编码；完整动作长度对应一段待生成的带噪序列。头、手臂、腿等分组分别提供特征，阶段时长为时间建模提供相应范围。

3. **通过 SAMI 组合。** 第一阶段中，头部与手臂模板支持看手机、用手机；第二阶段模板支持向右看和挥手。模型根据帧位置对各时间模板加权，同时通过空间分支让手臂、躯干和下肢进行协调。这个过程反复出现在去噪网络中，最终得到连续骨骼动作。

4. **接收修改指令。** 用户提出“挥得高一些，而且持续更久”。GPT-4 读取当前描述与新指令，更新第二阶段手臂条件和持续帧数；在图 1 中，挥手由普通高度变为头顶上方，第二阶段由 60 帧延长到 90 帧。

5. **重新生成并检查。** 更新后的描述进入同一生成器，重新采样整段动作。预期的语义变化是“后半段挥得更高、更久”；第一阶段尽管仍是原来的文本条件，其实际转身轨迹、手的位置等仍可能变化。这是作者方法的工作方式，不是未启用某个保真开关。[图 1、正文 §3.4、附录 D](https://arxiv.org/html/2312.15004v1)

这个例子也给出一个实用判断：FineMoGen 适合在生成需求层面不断调整动画方案。如果任务是“这份已验收动画的前 60 帧绝对不许变，只修改后面的右臂”，论文中的编辑流程还不足以满足这一要求。

### 训练/推理

**训练数据与监督。** 作者在 HumanML3D、KIT-ML、BABEL 和自己补充标注的 HuMMan-MoGen 上评估。HuMMan-MoGen 从 HuMMan 中选择 160 类动作的 2,968 个视频，为各动作定义标准阶段，再给每阶段添加整体描述和七组细节描述，总计 102,336 条文本标注。这个数字是标注条目数，不能当成同等数量的独立动作视频或独立拍摄序列。附录 B 也说明原始动作主要来自健身活动。[正文 §4.1；附录 B](https://arxiv.org/html/2312.15004v1)

训练时，对真实连续动作 x<sub>0</sub> 加高斯噪声得到 x<sub>t</sub>，模型结合文本条件 c 与扩散步 t 预测干净动作。按正文所说的 MSE 目标，可规范写为下式；它补全了原文简写中省略的平方范数：

<div class="equation">L = E[‖x<sub>0</sub> − S<sub>θ</sub>(x<sub>t</sub>, t, c)‖²]</div>

文本条件有 10% 的概率被遮蔽，以学习无条件分布。CLIP 保持冻结，新增的文本 Transformer 和动作去噪网络参与训练。GPT-4 的描述改写处在外部交互流程，论文没有把它接入这一损失进行联合训练。[正文 §3.1–3.2、§3.5](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=7)

| 项目 | 论文披露的设置 |
|---|---|
| 动作 Transformer | 4 层；潜在维度 7 × 64，每组 64 维 |
| 文本编码器 | 冻结 CLIP ViT-B/32，后接 2 层可训练 Transformer |
| 扩散训练日程 | 1,000 个噪声时间步；β 从 0.0001 线性增加到 0.02 |
| 推理 | 50 步去噪，输出连续动作序列 |
| 优化器与学习率 | Adam；初始 0.0002，余弦衰减到 0.00002 |
| 硬件与批量 | 单张 Tesla V100，batch size 128 |
| 总训练时长 / GPU 小时 | 正文未披露 |

表中来自[正文 §3.5](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=7)与[§4.3，p8–9](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=8)。1,000 是扩散噪声日程的长度，不是优化器只更新 1,000 次；50 是生成整段序列的采样步数，不是只生成 50 帧，也不是按时间自回归生成 50 个动作。

**动作表示。** HumanML3D 和 KIT-ML 使用包含根节点运动、关节位置、速度和 6D 旋转的连续表示，分别对应 22 和 21 个关节；BABEL 与 HuMMan-MoGen 使用由 SMPL 参数转换的 6D 旋转与根平移。正文在这里列出的若干“表示组成项”与前面的“七个身体/轨迹组”不是同一种划分。FineMoGen 没有先把动作离散成姿势词表，再让语言模型逐个预测动作 token。[正文 §4.3](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=9)

**论文与公开实现的区别。** 截至 2026-10-19，官方仓库已发布模型实现、配置及训练/测试脚本，核验版本为 [`d5697b5`](https://github.com/MotrixLab/FineMoGen/tree/d5697b5aa6ad2de0301e77a251c7d28fb177ee23)。实现并非把主文公式原样照搬：潜在表示采用七个局部/轨迹通道加一个全身通道，共八路；时间信号加入名为 acceleration、jerk 的学习特征项，形成三次多项式；文本和动作都经过 MoE。发布的 HumanML3D 配置还使用分段学习率调度及每卡 batch size 64，与上述论文训练表不同。这些属于静态源码证据，不应混写成论文正文原先披露的设置，也不构成本文已复现论文指标的证明。[SAMI 实现](https://github.com/MotrixLab/FineMoGen/blob/d5697b5aa6ad2de0301e77a251c7d28fb177ee23/mogen/models/attentions/fine_attention.py#L63)；[配置](https://github.com/MotrixLab/FineMoGen/blob/d5697b5aa6ad2de0301e77a251c7d28fb177ee23/configs/finemogen/finemogen_t2m.py)

**当前发布范围。** 作者网盘中可见 FineMoGen 的 HumanML3D 和 KIT 权重文件，但本次没有下载或加载。公开可视化入口接受文本段和长度列表，没有 GPT-4 编辑脚本，也没有读取真实源动作再局部保持的入口；其 HumanML3D 演示还进行时间平滑，不能将演示中的全部平滑效果归因于 SAMI。[公开文件入口](https://drive.google.com/drive/folders/1utEV_NTZ14tDFPG20bGmbSRmjizCVKxF)；[可视化脚本](https://github.com/MotrixLab/FineMoGen/blob/d5697b5aa6ad2de0301e77a251c7d28fb177ee23/tools/visualize.py)

HuMMan-MoGen 后续已由作者另行公开：2024 年发布页报告 **6,264 段动作、112,112 条文本、179 位受试者**，Hugging Face 上能看到对应数据文件。这一版本与论文原始的“2,968 个视频、102,336 条文本”不是相同规模，本文没有验证其文件清单和切分是否逐项对应 2023 年实验。当前 FineMoGen 仓库及旧网盘也未见 HuMMan-MoGen / BABEL 专用权重和完整细粒度编辑评估流程。**数据已公开、代码可读、权重可见，与论文全部流程已复现是不同结论。** [作者数据页](https://caizhongang.com/projects/HuMMan/mogen.html)；[固定数据版本](https://huggingface.co/datasets/caizhongang/HuMMan/tree/56a2a9a12e21abe10744580f96989534cdbdff76/humman_release_v1.0_mogen)

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

**读表口径。** R-Precision 是在 1 条正确文本与 31 条随机错误文本中进行特征检索的命中率，不是逐条动作指令的严格成功率；FID 衡量真实与生成动作的特征分布距离，MM Dist 是配对文本与动作的特征距离。Diversity 比较不同描述下的动作变化，MultiModality 比较同一描述的多次生成。它们不是以 cm 或角度表示的关节误差。表 1 的说明给出 20 次评估、均值及 95% 置信区间；以下保留原表全部数值与箭头，未报告的项保留“—”。正文表 1–2 把 Diversity 标为 ↑，正文表 3–4 与补充表 1 则用 → 表示接近真实动作的参考值，不把两种标记悄悄统一。[正文 §4.2、表 1](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=9)；[附录 A](https://arxiv.org/html/2312.15004v1#A1)

**普通文本生成：HumanML3D，原表 1，正式 PDF p9。**

| 方法 | R@1 ↑ | R@2 ↑ | R@3 ↑ | FID ↓ | MM Dist ↓ | Diversity ↑ | MultiModality ↑ |
|---|---:|---:|---:|---:|---:|---:|---:|
| Real motions | 0.511 ± .003 | 0.703 ± .003 | 0.797 ± .002 | 0.002 ± .000 | 2.974 ± .008 | 9.503 ± .065 | — |
| Guo et al. | 0.457 ± .002 | 0.639 ± .003 | 0.740 ± .003 | 1.067 ± .002 | 3.340 ± .008 | 9.188 ± .002 | 2.090 ± .083 |
| T2M-GPT | 0.491 ± .003 | 0.680 ± .003 | 0.775 ± .002 | 0.116 ± .004 | 3.118 ± .011 | 9.761 ± .081 | 1.856 ± .011 |
| MDM | — | — | 0.611 ± .007 | 0.544 ± .044 | 5.566 ± .027 | 9.559 ± .086 | 2.799 ± .072 |
| MotionDiffuse | 0.491 ± .001 | 0.681 ± .001 | 0.782 ± .001 | 0.630 ± .001 | 3.113 ± .001 | 9.410 ± .049 | 1.553 ± .042 |
| ReMoDiffuse | 0.510 ± .005 | 0.698 ± .006 | 0.795 ± .004 | 0.103 ± .004 | 2.974 ± .016 | 9.018 ± .075 | 1.795 ± .043 |
| FineMoGen（Ours） | 0.504 ± .002 | 0.690 ± .002 | 0.784 ± .002 | 0.151 ± .008 | 2.998 ± .008 | 9.263 ± .094 | 2.696 ± .079 |

**普通文本生成：KIT-ML，原表 2，正式 PDF p9。**

| 方法 | R@1 ↑ | R@2 ↑ | R@3 ↑ | FID ↓ | MM Dist ↓ | Diversity ↑ | MultiModality ↑ |
|---|---:|---:|---:|---:|---:|---:|---:|
| Real motions | 0.424 ± .005 | 0.649 ± .006 | 0.779 ± .006 | 0.031 ± .004 | 2.788 ± .012 | 11.08 ± .097 | — |
| Guo et al. | 0.370 ± .005 | 0.569 ± .007 | 0.693 ± .007 | 2.770 ± .109 | 3.401 ± .008 | 10.91 ± .119 | 1.482 ± .065 |
| T2M-GPT | 0.416 ± .006 | 0.627 ± .006 | 0.745 ± .006 | 0.514 ± .029 | 3.007 ± .023 | 10.921 ± .108 | 1.570 ± .039 |
| MDM | — | — | 0.396 ± .004 | 0.497 ± .021 | 9.191 ± .022 | 10.847 ± .109 | 1.907 ± .214 |
| MotionDiffuse | 0.417 ± .004 | 0.621 ± .004 | 0.739 ± .004 | 1.954 ± .062 | 2.958 ± .005 | 11.10 ± .143 | 0.730 ± .013 |
| ReMoDiffuse | 0.427 ± .014 | 0.641 ± .004 | 0.765 ± .055 | 0.155 ± .006 | 2.814 ± .012 | 10.80 ± .105 | 1.239 ± .028 |
| FineMoGen（Ours） | 0.432 ± .006 | 0.649 ± .005 | 0.772 ± .006 | 0.178 ± .007 | 2.869 ± .014 | 10.85 ± .115 | 1.877 ± .093 |

两表说明 FineMoGen 具有竞争力，但不是所有指标第一：HumanML3D 的 FID 0.151 高于 ReMoDiffuse 的 0.103 和 T2M-GPT 的 0.116；KIT-ML 的检索指标较好，FID 0.178 仍高于 ReMoDiffuse 的 0.155。KIT-ML 中 ReMoDiffuse 的 R@3 置信区间 `.055` 按原表保留。[原表 1–2](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=9)

**时间组合：BABEL 与 HuMMan-MoGen，原表 3，正式 PDF p10。** Zero-shot 指没有使用时间组合数据训练，不能理解成整个动作模型无需训练。该表只写 R Precision，未指定这里取 Top-1、Top-2 还是 Top-3；下表保留原列名。原表没有为这些数值列出置信区间。

| 方法 | BABEL R Precision ↑ | BABEL FID ↓ | BABEL Diversity → | BABEL MultiModality ↑ | HuMMan R Precision ↑ | HuMMan FID ↓ | HuMMan Diversity → | HuMMan MultiModality ↑ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Real motions | 0.62 | 0.004 | 8.51 | 3.57 | 0.49 | 0.007 | 7.28 | 2.15 |
| TEACH | 0.46 | 1.12 | 8.28 | 7.14 | 0.38 | 1.59 | 7.04 | 6.37 |
| PriorMDM | 0.43 | 1.04 | 8.14 | 7.39 | 0.31 | 1.43 | 6.89 | 6.45 |
| FineMoGen（zero-shot） | 0.51 | 0.84 | 8.01 | 7.28 | 0.41 | 1.34 | 6.87 | 6.41 |
| FineMoGen（fully-supervised） | 0.56 | 0.73 | 7.94 | 7.17 | 0.43 | 1.21 | 6.71 | 6.28 |

FineMoGen 的两种设置在此表的检索和 FID 上优于所列 TEACH、PriorMDM；完整监督进一步改善这两项。但其 Diversity 离真实参考值更远，MultiModality 也不是最高。该表没有单独报告动作边界误差、过渡速度连续性或每条时间约束的满足率。[原表 3、§4.4–4.6](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=10)

### 消融实验

**时间组合消融：原表 4，HuMMan-MoGen，正式 PDF p10。** 从三个组件均关闭的基线出发，分别单独加入空间组件、时间组件或 MoE，再与完整模型对比；所有行均不使用时间组合训练数据。Spatial/Temporal 两列表头沿用此表的 Dependence 写法。

| 方法 | Spatial Dependence | Temporal Dependence | MoE | R Precision ↑ | FID ↓ | Diversity → | MultiModality ↑ |
|---|:---:|:---:|:---:|---:|---:|---:|---:|
| Real Motions | — | — | — | 0.49 | 0.007 | 7.28 | 2.15 |
| Baselines | — | — | — | 0.24 | 3.79 | 7.10 | 6.95 |
| Baselines | ✓ | — | — | 0.21 | 4.51 | 7.29 | 7.03 |
| Baselines | — | ✓ | — | 0.34 | 2.48 | 7.05 | 6.72 |
| Baselines | — | — | ✓ | 0.27 | 3.09 | 6.97 | 6.84 |
| FineMoGen | ✓ | ✓ | ✓ | 0.41 | 1.34 | 6.87 | 6.41 |

单加时间组件使 R Precision 从 0.24 升至 0.34、FID 从 3.79 降至 2.48；单加 MoE 也改善这两项。单加空间组件反而使 R Precision 降至 0.21、FID 升至 4.51。完整组合达到 0.41／1.34，但未提高全部多样性指标；此表也没有“完整模型只去掉一个组件”的三组对照，不能据此量化每个模块在完整架构中的独立贡献。[原表 4](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=10)

**空间组合消融：正式补充材料 §C、p3、原表 1（arXiv 合订版编号为表 5），HuMMan-MoGen。** 这次不给空间组合数据训练，为七个部位分别训练文本—动作比较模型，再取七个部位分数的平均值；与上表的整段时间组合评测不是同一口径。

| 方法 | Spatial Independence | Temporal Independence | MoE | R Precision ↑ | FID ↓ | Diversity → | MultiModality ↑ |
|---|:---:|:---:|:---:|---:|---:|---:|---:|
| Real motions | — | — | — | 0.61 | 0.003 | 5.94 | 1.68 |
| Baseline | — | — | — | 0.43 | 2.87 | 5.85 | 5.39 |
| Baseline | ✓ | — | — | 0.49 | 2.04 | 5.75 | 5.25 |
| Baseline | — | ✓ | — | 0.41 | 3.56 | 5.91 | 5.58 |
| Baseline | — | — | ✓ | 0.45 | 2.41 | 5.81 | 5.32 |
| FineMoGen | ✓ | ✓ | ✓ | 0.51 | 1.09 | 5.71 | 5.17 |

单加空间组件改善 R Precision 0.43→0.49、FID 2.87→2.04；单加时间组件却变为 0.41／3.56。完整组合的检索与 FID 最好，Diversity 和 MultiModality 并非最优。结果显示组件作用依任务而变，不能概括成“空间、时间模块单独加入都必然增益”。七部位平均分也没有揭示哪个部位最容易失败。[官方补充材料](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Supplemental-Conference.zip)；[可直接阅读的对应表](https://arxiv.org/html/2312.15004v1#A3.T5)

### 关键发现

1. **主要优势在组合任务。** 普通文本生成并未全面超过专用强基线；时间组合的检索与分布指标更能体现本文设计的作用。
2. **部位控制有量化证据，但精确约束尚未量化。** 空间消融使用各部位独立的特征评估，支持部位描述与动作的匹配改善；没有报告关节目标位置、动作时间边界、接触或未修改内容保持的误差。
3. **编辑证据主要是流程与示例。** 论文 §3.4 明确先让 LLM 改描述，再从头生成动作，未修改阶段也可能变化；附录 D 给出 ChatGPT-4 的提示方式，没有独立的编辑成功率、保持误差或用户研究表。[§3.4](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf#page=7)；[附录 D](https://arxiv.org/html/2312.15004v1#A4)

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **把控制粒度落实到信息流：** 论文不只要求用户写得更详细，还改变文本条件进入网络的方式。时间段、身体范围和内部特征分组相互对应，是细粒度接口真正发挥作用的关键。
- **用带时间含义的特征连接阶段：** 时间模板提供了一种可扩展的组合方式。它比简单拼接各段特征更明确地描述了前后阶段的相互影响，又保留了学习生成运动细节的空间。
- **保留分工，同时允许协作：** 独立投影、对应文本条件与跨部位关系矩阵共同存在。对可控全身运动而言，“局部能单独描述”和“身体能协调动作”需要同时解决。
- **可编辑的文本状态降低交互门槛：** GPT-4 使用户能够修改意图，而不必直接操作关节曲线。这个设计对动画方案探索有价值；使用时需要同时记住，文字状态没有保存原动作的全部运动细节。
- **补充与方法接口相匹配的数据：** HuMMan-MoGen 把阶段和身体部位落实为标注对象，使研究者能够分别检查时间组合与空间组合，不再只依赖整体一句话的匹配指标。

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

1. **编辑结果缺少源动作保真约束。** §3.4 的方法从头重生成，未修改阶段也可能改变。若要处理外部动作、保留特定帧、锁定非目标关节，需要额外的源动作输入和保持机制；这不是当前提示改写流程已经解决的问题。

2. **细粒度文字仍是软条件。** “右手举过头顶”与“右手在第 120 帧达到三维点 p”是不同要求。论文没有提供关键点误差、接触保持或碰撞约束的保证；时间特征平滑也不能自动等价为最终运动学严格连续。

3. **LLM 可能把意图分解错。** 作者在 §5 明确指出，模型依赖特定细粒度格式，预训练 LLM 也可能误解编辑要求。更准确的阶段/部位解析、结果校验和错误修正是后续方向；论文提出的 instruction tuning 尚未成为本文已经完成的步骤。

4. **不同控制模块存在适用场景。** 单独加入某个模块并非总会改善结果：时间组合与空间组合对模块的需求不同，实验部分的两组消融需要分别阅读。更细的解耦会增加拟合难度，不能把“更多控制结构”直接等同于“所有指标都更好”。

5. **数据与输出范围有限。** HuMMan-MoGen 的主要原始动作来自健身活动，不能由其覆盖面推断任意生活场景、物体交互或个人动作风格都已充分学习。附录 B.4 明确指出，方法不提供手指动作和面部表情序列，因此“使用手机”案例表达的是身体动作语义，并不意味着手机接触和精细手指操作已经生成。

6. **公开实现需要独立的对应性验证。** 当前代码与主文在通道数、时间展开和 MoE 路径等方面有差异。实际复现前需要对照具体配置、数据和权重，明确运行的是哪一套实现；本文没有安装环境或执行训练/推理。

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **[ReMoDiffuse](https://mingyuan-zhang.github.io/projects/ReMoDiffuse.html)（ICCV2023）：** FineMoGen 沿用其动作扩散 Transformer 和混合高效注意力的部分设计，再重新组织模板的时空作用。ReMoDiffuse 的特色是引入检索到的动作作为辅助知识；FineMoGen 的核心生成框架没有把检索分支作为必要输入。
- **[TEACH](https://teach.is.tue.mpg.de/)（3DV2022）：** 同样处理一串有顺序的文字动作要求。TEACH 在动作序列之间传递已生成动作的上下文，而 FineMoGen 重点研究生成网络内部的时间模板与条件组合；不能把 TEACH 的前段动作输入机制自动归到 FineMoGen 的编辑流程上。
- **[PriorMDM / DoubleTake](https://priormdm.github.io/priorMDM-page/)（ICLR2024）：** 其较早预印本已作为 FineMoGen 的对照方法。DoubleTake 通过推理阶段的两次处理连接提示区间和过渡区间；FineMoGen 则把时间建模写进 SAMI。两者的 zero-shot 都需要结合具体组合任务理解，而不是动作生成器完全不需要训练。
- **[HuMMan](https://caizhongang.com/projects/HuMMan/)（ECCV2022）：** 提供 FineMoGen 新标注数据的原始动作来源。HuMMan-MoGen 的新增价值在于阶段划分和身体组描述，并不是重新采集了 102,336 段独立动作。
- **[CoMo](https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/04203.pdf)（ECCV2024，后续工作）：** 将真实源动作转换成具有几何语义的 pose codes，修改选定时间和属性，再合并未修改的码并解码。与 FineMoGen 保存文字描述、从头采样相比，CoMo 更直接地处理源动作信息；但保留未改码也不等于连续关节轨迹、速度和接触严格保持。
- **启发：** 可控动作系统至少需要同时表达用户意图、保存动作状态、检验最终结果。FineMoGen 将第一项做成了清楚的结构化接口，也让生成网络更好地利用这种接口；若任务进一步要求保留现有动作细节，就需要把后两项补进系统，而不能仅靠更详细的语言提示。

<span id="reading-8" class="reading-anchor"></span>

## 来源

- **正式论文：** [NeurIPS2023 论文页](https://papers.neurips.cc/paper_files/paper/2023/hash/2d52879ef2ba487445ca2e143b104c3b-Abstract-Conference.html)及[正式 PDF](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Paper-Conference.pdf)。方法以 §3、图 2–3 为主；正文实验为表 1–4；图 1 提供本文完整例子的原始内容。
- **补充材料：** 已下载并阅读[NeurIPS 官方补充包](https://papers.neurips.cc/paper_files/paper/2023/file/2d52879ef2ba487445ca2e143b104c3b-Supplemental-Conference.zip)内的 5 页补充 PDF，并对照[arXiv2312.15004v1 全文](https://arxiv.org/html/2312.15004v1)。附录 A 为评估指标，B 为数据范围与使用条件，C 为部位评估及空间组合消融，D 为 GPT-4 的初始化和编辑提示。空间消融在正式补充中是表 1，在 arXiv 合订版中是表 5；本文明确区分，arXiv 版本也不是新的独立论文。
- **作者发布：** [项目页](https://mingyuan-zhang.github.io/projects/FineMoGen.html)与[固定代码版本](https://github.com/MotrixLab/FineMoGen/tree/d5697b5aa6ad2de0301e77a251c7d28fb177ee23)。公开实现的观察与正文机制分别标注；没有运行模型或把演示视为本文实测结果。
- **图示与案例：** 架构图依据作者机制重新绘制；例子按图 1 整理并解释，帧数换算为教学说明。本文没有复制作者视频作为本地复现。
- **写作形式：** 沿用网站 v2.1 论文解读模板，技术结论依据本论文正文、附录和官方实现重新核对。核验日期：2026-10-19。

</div>
