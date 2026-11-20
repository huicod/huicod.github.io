---
title: "[CVPR2025] EnergyMoGen：怎样让一个人同时向前走和挥手"
description: "解读 EnergyMoGen: Compositional Human Motion Generation with Energy-Based Diffusion Model in Latent Space。用行走、挥手和抑制转身的例子，解释连续动作潜空间里的概念组合，并对照语义匹配、脚滑和动作过渡的实验。"
pubDate: "2026-11-20"
badge: "Paper"
tags: ["EnergyMoGen", "Text-to-Motion", "Compositional Motion Generation", "Latent Diffusion", "Energy-Based Models", "MTT", "HumanML3D", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[可翻译的 HTML 全文与附录][html] · [会议终稿 PDF][pdf] · [官方补充 PDF][supp] · [作者项目与动作演示][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2025</summary>

*EnergyMoGen: Compositional Human Motion Generation with Energy-Based Diffusion Model in Latent Space*。作者 Jianrong Zhang、Hehe Fan、Yi Yang，来自悉尼科技大学与浙江大学。CVPR 2025 第 17592–17602 页，作者项目标为 Highlight。本文核对会议终稿、官方补充及 arXiv v2。表中数据来自论文，未独立运行模型。截至 2026-11-20，作者项目页的 Code 按钮仍指向项目页本身，未核实到这篇工作的公开训练实现与权重。[会议记录][venue] · [作者项目][project]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

EnergyMoGen 把“向前走”和“挥动双臂”分别变成**对同一份动作草稿的修改方向**，再参考“向前走，同时挥动双臂”整句话，在每一步扩散采样时合成一次更新。它能用正、负权重鼓励或抑制概念，生成一段连续动作；实验最清楚的收益是，多概念更容易被检索出来，脚部滑动指标也有所改善。[架构图与方法][fig2] · [原表 3][t3] · [脚滑实验][t11]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　骨架空间的扩散模型保留着“第几帧、哪个关节”的位置，可以在指定时间或部位组合条件。潜空间模型则先把一段动作压成少量向量，再反复去噪，计算规模可以与动作长度分开。[引言][intro]

**现有痛点**　把 40–196 帧的不同动作都压成固定数量的向量，一个向量可能同时包含步态、手势和朝向。在这样的表示里，很难划出只属于右臂、或只属于某三帧的区域，照搬骨架上的掩码方法会失去依据。[引言][intro] · [附录 J][failure]

**核心矛盾**　“走路”和“挥手”分别生成并不难；放在同一身体上，既要看得见挥手，也要保住步态、重心转移和落脚。只强调一句话里的所有词，脚可能开始滑；只求相邻姿态平稳，又可能漏掉其中一个动作。[原文 §5.5][dissect] · [脚滑实验][t11]

**本文目标**　使用已有的文本条件动作扩散模型，把多个已学概念组合为一段单人动作。用户可以提供一条包含多个动作的描述，也可以把概念分开提供，并指定哪些需要鼓励、哪些需要抑制；论文分别评测这两种输入。[方法 §3.2][compose] · [评测设置][datasets]

**切入角度**　如果“向前走”给当前潜变量一个更新方向，“挥手”也给它一个方向，就可以在每一步合并这些方向，无需预先知道五个潜向量中的哪一个负责手臂。[式 5–8][compose]

**核心 idea**　沿三个位置保留语义。在整个去噪器的输出处组合各概念，在各层交叉注意力内部组合词义，再让完整的一句话提供概念之间的关系。三个分支最后都给出同一步的噪声预测，因此可以直接加权融合。[式 9][eq9] · [式 10][eq10]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先学动作压缩，再学文本条件去噪。第一阶段，动作 VAE 把可变长的骨架序列编码为五个连续潜向量，再从它们重建原动作。第二阶段，向潜向量加噪，让 Transformer 根据扩散步和文字估计噪声。生成时由随机噪声开始，三个分支在同一份潜变量上合作，最后由 VAE 解码出连续人体姿态。[原文图 2][fig2] · [附录 A][train]

<figure class="reading-figure"><a href="/paper-notes/energymogen/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/energymogen/architecture.svg" alt="EnergyMoGen 的动作 VAE 学习连续潜空间。生成时，分开的概念提示驱动潜变量层与注意力层两种组合，合写句驱动第三路，三路噪声预测经融合，反复更新后解码为动作。" loading="lazy" /></a><figcaption>据原文图 2 和式 2–10 重绘。沿下半部读图时，每个分支处理的都是同一扩散步、同一份动作潜变量。点击可放大。</figcaption></figure>

### 关键设计

1. **固定五个潜向量，保留整段动作。** 编码器用十个额外 token 估计均值与方差，通过重参数化得到形状为 5 × 256 的连续表示；解码器接受它并还原动作。训练使用平滑 L1 重建损失与 KL 正则。五个位置没有逐一命名为手、脚或动作阶段。附录还测了潜向量数量，因而能把“多一些向量是否有用”和“这些向量各自代表什么”分开讨论。[方法 §3.1][base] · [附录表 8][t8]

2. **在去噪器输出处加减概念贡献。** 每个条件分别作用于同一个带噪动作。以空文本的噪声预测为基准，“有走路提示的预测减去空提示的预测”就是走路在这一步带来的变化。式 7 把多个这样的差值加权叠回基准。对包含与排除的一对概念，式 8 采用“正条件预测减去负条件预测”的方向。这里的“能量”提供了组合分布的解释，实际计算的是噪声预测及其差值，数值不表示人的肌肉用力或物理能耗。[式 5–8][compose]

3. **把组合提前到每层交叉注意力。** 运动特征作查询，文字特征提供键和值。每层分别读取各个概念，所得的输出特征按带符号权重求和，再除以权重之和，从而让一个概念得到强调、另一个受到抑制。网络据此继续计算，最后输出该分支的噪声预测。论文还引入自适应梯度更新（AGD），由运动查询提供的注意力项和正则项小步修正**文字嵌入**。CLIP 参数保持冻结；原提示词不被改写。[式 3–4][base] · [式 9][eq9]

4. **让完整句子参与融合。** 如果概念只剩“走路”“抬手”，词间关系容易变弱。第三路直接用包含所有概念的完整句去噪。协同能量融合（SEF）在每步将**潜变量层预测、注意力层预测、整句预测**以三个系数混合，系数之和为 1。MTT 组合任务采用 0.1、0.7、0.2。它们是三种预测的权重；“走路比挥手重要多少”是另一层概念权重。两种权重不能互换。[式 10][eq10] · [实现设置][setup]

### 一个完整例子

读作者项目里的**合取加否定**演示。第一条提示要求向前走并掉头，第二条要求抬左手，第三条以负条件抑制转身。这个例子比单纯的“走路加举手”多了一步，还要检查第一条提示中哪些内容保住了。[项目视频，Conjunction and Negation][project] · [概念组合示例][fig4]

这里的“抑制”在两条分支里有不同的写法。潜变量分支的式 8 可直接取正、负条件预测的差。注意力分支的式 9 还要除以概念权重之和，若只给两项权重 +1 和 −1，分母便为零；这组数不能直接代入式 9。[潜变量分支][compose] · [注意力分支][eq9]

| 环节 | 本例中实际输入和输出 |
| --- | --- |
| 给定条件 | 用户提供概念文本，明确加入“抬左手”、抑制“转身”。SEF 另读合写描述。方法没有输出动作脚本，也没有先把三条文字自动分配给一组骨骼。 |
| 在同一份草稿上计算 | 在某个去噪步，分别询问空条件、正条件和负条件，把抑制转身的方向纳入组合。交叉注意力分支也按概念权重混合特征；整句分支补充概念关系。 |
| 生成连续动作 | 融合所得的是潜空间中的一次更新。从噪声开始共采样 50 步，VAE 解码后才出现根节点朝向、步态和手臂轨迹。 |
| 怎样核验 | 看根节点能否继续向前移动、朝向是否仍掉头、左腕是否抬起。项目展示了一个可观察样例，论文只报告跨样本的检索与运动质量指标，未给出这三个条件同时达标的比例。 |

### 训练与推理

作者分别用 9 层、宽度 256 的 Transformer 做 VAE 编码器、解码器和潜空间去噪器，文本由冻结的 CLIP ViT-L/14 编码。VAE 和去噪器各训练 30 万次更新，批量分别为 1024 和 512，训练去噪器时 10% 采用空条件。普通单句文本到动作评测把 AGD 步长设为 0。组合推理直接使用在 HumanML3D 预训练的模型；另行报告的 CompML 数据增强实验多做了 10 万次去噪器微调。[附录 A][train] · [主文 §5.2][setup]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 同一句包含多个动作，与分别给出多个概念，有何差别？

MTT 从 60 条带身体部位标注的描述中选取三条，按部位和持续时间组合，形成 500 个测试样例。单句任务给模型合写描述；多文本任务可以取得三条原描述及其合写句。表中 R@1、R@3 是按原表百分数尺度报告的检索率，M2T 是 TMR 嵌入中的动作—文本相似度，FID 看生成分布，过渡距离衡量相邻帧的变化。[原表 3][t3] · [附录 I][eval]

| MTT 输入与方法 | R@1 ↑ | R@3 ↑ | TMR M2T ↑ | FID ↓ | 过渡距离 ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| 合写单句 · MotionDiffuse | 10.9 | 21.3 | 0.558 | 0.621 | 1.9 |
| 合写单句 · MLD | 10.5 | 22.3 | 0.559 | 0.685 | 2.4 |
| 合写单句 · EnergyMoGen | 12.7 | 25.4 | 0.570 | 0.592 | 2.7 |
| 合写单句 · EnergyMoGen + AGD | 14.0 | 26.3 | 0.570 | 0.587 | 2.7 |
| 多文本 · 只在潜变量层组合 | 9.7 | 19.6 | 0.547 | 0.917 | 1.6 |
| 多文本 · 只在注意力层组合 | 15.1 | 27.5 | 0.585 | **0.569** | 2.2 |
| 多文本 · 三路融合 SEF | **15.9** | **28.0** | **0.591** | 0.604 | **1.6** |

在相同的单句输入下，增加 AGD 后 R@1 从 12.7 升到 14.0，过渡距离仍为 2.7。在多文本组中，SEF 相对纯注意力组合同时提高了检索率、降低了过渡距离，FID 却从 0.569 升到 0.604。融合的收益具体落在**语义匹配与过渡的折中**。单句与多文本两组获得的条件不同。[原表 3][t3]

### 对普通文本到动作任务，增益落在哪里？

节选原表 1、2 的均值。R@1 越高、MM-Dist 越低，代表文本与动作在评估器中匹配得越好。FID 越低代表生成动作的特征分布越接近真实样本。HumanML3D 原表对 20 次重复给出 95% 置信区间；下表保留报告精度。[HumanML3D 原表 1][t1] · [KIT-ML 原表 2][t2]

| 数据集 | 方法 | R@1 ↑ | R@3 ↑ | FID ↓ | MM-Dist ↓ |
| --- | --- | ---: | ---: | ---: | ---: |
| HumanML3D | MLD | 0.481 | 0.772 | 0.473 | 3.196 |
| HumanML3D | ReMoDiffuse | 0.510 | 0.795 | **0.103** | 2.974 |
| HumanML3D | EnergyMoGen | 0.523 | 0.815 | 0.188 | **2.915** |
| HumanML3D | EnergyMoGen + CompML | **0.526** | **0.815** | 0.176 | 2.931 |
| KIT-ML | MLD | 0.390 | 0.734 | 0.404 | 3.204 |
| KIT-ML | ReMoDiffuse | 0.427 | 0.765 | **0.155** | **2.814** |
| KIT-ML | EnergyMoGen | **0.436** | **0.772** | 0.495 | 2.861 |

CompML 的 5,000 对文本与动作由模型根据随机组合的描述合成，再与 HumanML3D 一起微调去噪器。与基础版相比，FID 从 0.188 降到 0.176，Top-1 增加 0.003，但 MM-Dist 从 2.915 升至 2.931。KIT-ML 上该方法的文本检索较强，FID 则高于这里列出的两个基线。[数据构造][datasets] · [原表 1][t1] · [原表 2][t2]

### 消融：五个潜向量和三条分支，各自带来了什么？

| 改动与评测对象 | 比较 | 论文结果 |
| --- | --- | --- |
| 改变 VAE 的潜向量数，HumanML3D | 1 → 3 → 5 → 7 个 | 生成 FID 依次为 0.424、0.418、0.188、0.291。由 5 增到 7 个，重建 FID 仍从 0.080 降至 0.022；能从真实动作保留更多信息，未必更容易从文字生成它。[附录表 8][t8] |
| 保留潜变量层与注意力层，加入合写句，MTT | 权重从 (0.1, 0.9, 0) 调至 (0.1, 0.7, 0.2) | R@1 从 14.2 到 15.7，FID 从 0.613 降到 0.604。这组权重的 R@1 在主表 3 写为 15.9，此处保留消融表自己的数值。[附录表 7][t7] · [主表 3][t3] |
| 改变文字嵌入的更新幅度，MTT 单句 | 步长对从 (0, 0) 到 (0.001, 0.002)，再到 (0.1, 0.2) | R@1 依次为 12.7、14.0、1.4。大幅更新会损害与提示的匹配。[附录表 9][t9] |
| 检查不同分支的脚滑，MTT | 整句、只用潜变量层、只用注意力层、三路融合 | 物理足接触指标 PFC（越低越好）依次为 0.61、0.54、1.05、**0.51**。该指标仍是代理度量，未逐帧验证足底固定。[附录表 11][t11] |

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **同一个概念可以在不同计算位置发挥作用。** 潜变量层传递“整个生成器看到这个提示后要怎样改”的方向；注意力层则保留每个概念在网络中间产生的特征。两者用的是同一批文字，单独启用后却出现不同的检索、脚滑和过渡表现。论文用消融把这层区别测了出来。[原表 3][t3] · [附录表 11][t11]
- **否定操作值得用解码后的运动去读。** 图 5 从“向右跳”中抑制“跳跃”，作者得到与“向右走”相近的样例，虽然输入里没有“走”这个词。能量等高线经过插值和平滑，只能帮助看分布变化；真正有意义的是输出有没有保住向右位移、有没有降低离地动作。[图 5 与分析][fig5]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

固定五个潜向量没有逐帧地址。项目中“拾起物体、踢球、走路、拍手”的时间拼接使用附录的**骨架空间扩散变体**；它在帧空间选择并混合重叠段。使用主方法的潜空间分支时，不能据此承诺能把拍手放在指定帧。[附录 B.2][time] · [作者演示][project]

负权重会推动采样远离一个概念，执行程度仍取决于已有动作分布。作者也报告了全新概念的失败样例。若两条提示同时要求同一只手向相反方向移动，论文没有给出部位优先级或硬约束求解器。可分别测量两个目标的误差，并检查无关部位是否保持原动作，才能判断某次冲突是如何解开的。[式 7–9][compose] · [附录 J 与失败样例][failure]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **STMC。** 两篇共同使用 MTT，但输入接口有区别。STMC 明确接收时间线与部位条件；EnergyMoGen 的主方法直接在连续潜空间组合文本概念。若应用要指定手势出现的起止时刻，先问生成器是否能访问这些帧，再比较文字匹配分数。[STMC 站内解读](/blog/cvprw2024-stmc/) · [本文的 MTT 设置][datasets]
- **T2M-GPT。** 它把动作压成可按时间逐个预测的离散码，语言条件决定下一个码的分布。EnergyMoGen 则联合更新表示整段动作的五个连续向量，再一次解码。从这个差别可以直接看出，为何两篇论文把“生成过程中的一次决策”放在不同位置。[T2M-GPT 站内解读](/blog/cvpr2023-t2m-gpt/) · [EnergyMoGen 原文图 2][fig2]
- **DeMoGen。** 同一第一作者后续把问题反过来，研究怎样从整体动作中学习可分解、可重组的语义成分。EnergyMoGen 的概念由输入文字提供，组合发生在去噪阶段。若研究目标是从已有动捕里发现组成要素，两篇的监督来源与生成方向要分别看。[DeMoGen 站内解读](/blog/cvpr2026-demogen/) · [本文的组合接口][compose]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 会议发表信息与正式版本。[CVPR 2025 会议记录][venue] · [11 页主文 PDF][pdf] · [7 页官方补充 PDF][supp]
- 正文、图表及附录 A–J，适合浏览器翻译。本文附录表号采用合并版 HTML 的编号。[arXiv v2 HTML][html]
- 单句生成、概念合取与否定，以及单独列出的骨架空间时间拼接视频。[作者项目页][project]

</div>

[html]: https://arxiv.org/html/2412.14706v2
[venue]: https://openaccess.thecvf.com/content/CVPR2025/html/Zhang_EnergyMoGen_Compositional_Human_Motion_Generation_with_Energy-Based_Diffusion_Model_in_CVPR_2025_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2025/papers/Zhang_EnergyMoGen_Compositional_Human_Motion_Generation_with_Energy-Based_Diffusion_Model_in_CVPR_2025_paper.pdf
[supp]: https://openaccess.thecvf.com/content/CVPR2025/supplemental/Zhang_EnergyMoGen_Compositional_Human_CVPR_2025_supplemental.pdf
[project]: https://jiro-zhang.github.io/EnergyMoGen/
[intro]: https://arxiv.org/html/2412.14706v2#S1
[base]: https://arxiv.org/html/2412.14706v2#S3.SS1
[compose]: https://arxiv.org/html/2412.14706v2#S3.SS2
[eq9]: https://arxiv.org/html/2412.14706v2#S3.E9
[eq10]: https://arxiv.org/html/2412.14706v2#S3.E10
[fig2]: https://arxiv.org/html/2412.14706v2#S2.F2
[fig4]: https://arxiv.org/html/2412.14706v2#S4.F4
[fig5]: https://arxiv.org/html/2412.14706v2#S5.F5
[datasets]: https://arxiv.org/html/2412.14706v2#S5.SS1
[setup]: https://arxiv.org/html/2412.14706v2#S5.SS2
[dissect]: https://arxiv.org/html/2412.14706v2#S5.SS5
[t1]: https://arxiv.org/html/2412.14706v2#S3.T1
[t2]: https://arxiv.org/html/2412.14706v2#S4.T2
[t3]: https://arxiv.org/html/2412.14706v2#S5.T3
[train]: https://arxiv.org/html/2412.14706v2#A1
[time]: https://arxiv.org/html/2412.14706v2#A2.SS2
[t7]: https://arxiv.org/html/2412.14706v2#A2.T7
[t8]: https://arxiv.org/html/2412.14706v2#A4.T8
[t9]: https://arxiv.org/html/2412.14706v2#A5.T9
[t11]: https://arxiv.org/html/2412.14706v2#A7.T11
[eval]: https://arxiv.org/html/2412.14706v2#A9
[failure]: https://arxiv.org/html/2412.14706v2#A10
