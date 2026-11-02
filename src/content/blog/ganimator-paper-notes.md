---
title: "[SIGGRAPH2022] GANimator：怎样用一段示范生成新的舞步，再让角色沿指定轨迹走？"
description: "从 371 帧《Gangnam Style》舞蹈到 600 帧新舞步，读懂七层运动金字塔、足接触和单样本评测，再看粗层编辑与条件轨迹控制各需要什么。"
pubDate: "2026-11-02T11:10:00+08:00"
badge: "Paper"
tags: ["GANimator", "Single-Motion-Synthesis", "Character-Animation", "Motion-Control", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息 · SIGGRAPH 2022 / ACM Transactions on Graphics</summary>

*GANimator: Neural Motion Synthesis from a Single Sequence*。作者为 Peizhuo Li、Kfir Aberman、Zihan Zhang、Rana Hanocka、Olga Sorkine-Hornung。发表于 *ACM Transactions on Graphics* 41(4)，Article 138，SIGGRAPH 2022，DOI 10.1145/3528223.3530157。以下依据 12 页正式稿、作者演示与公开实现。实验数值来自论文，本次未运行模型。[正式记录][doi] · [全文][paper] · [项目与逐项视频][demo] · [代码与预训练模型入口][repo]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

GANimator 把一段动画变成七个不同帧率的训练目标，让粗层安排动作的大致变化，细层逐次补出示范里熟悉的关节运动。原文从 **371 帧《Gangnam Style》舞蹈生成 600 帧新舞步**。同一个粗层还给了动画师一个编辑入口：先改低帧率的姿势，再让细层把改动变成连续表演。[架构图 2][p4] · [舞蹈示例图 4][p6] · [关键帧示例图 9][p9]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 人体生成模型通常汇集许多演员、许多动作来学习运动规律。若角色是一只六足螃蟹，艺术家能给出的数据可能只有为这套骨架做的一段舞蹈，连脚有几个、各自何时着地都与人不同。[§1、图 1][paper]

**现有痛点：** 循环播放可以延长舞蹈，但每一遍中的停顿、摆臂、转向仍完全同步。把片段剪开后重排也不容易。作者在《Gangnam Style》舞蹈示例中展示，手工选择 MotionTexture 的片段转换路径后会出现手部速度突变和脚接触不良。[§4.2、图 4][p6]

**核心矛盾：** 单片学习既要保留示范的动作方式，又要让下一次生成有自由变化的余地。看整段，模型容易记住既有顺序；只看极短的邻域，又很难分辨一个姿势是在抬手、放手还是准备转身。[§3.2][p4] · [§4.4、YMCA 案例][p8]

**本文目标：** 用一条短动作，为这条动作及其骨架训练一个生成器。它能生成不同长度的动作变体，接受粗层姿态编辑，经过条件训练还可沿指定的根轨迹移动。换一套新骨架时可以沿用训练方法，每套模型依其示范骨架建立连接。[§3.1–3.2][p3] · [§5][p8]

**切入角度：** 同一秒的舞蹈在低帧率下能看到躯干怎样转，在高帧率下能看到转身时手腕和脚怎样配合。单条示范虽没有第二遍完整表演，却能在多个帧率和多个时间位置提供可比较的局部片段。[图 2–3][p4]

**核心 idea：** 每个帧率各训一对生成器和局部判别器。生成从粗到细推进，细层只需预测上一级缺失的变化；判别器只看局部时间窗。同时保留一组能重建整条示范的固定噪声，让较少出现的动作也有机会被学到。[§3.2、式 1–8][p4]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

示范先被转成关节旋转、根位移和足接触，再沿时间做出不同帧率的版本。自由生成时，最粗层直接从噪声产生动作，后续各层在前一层的上采样结果上补细节。训练时的判别器、重建与接触监督负责学参数，推理时只需运行生成链；做轨迹控制时才额外引入专门的条件模型。[图 2、3][p4] · [图 10][p9]

[![GANimator 架构图。输入动作形成时间金字塔，每级通过局部判别和重建学习；自由生成逐级细化，粗层编辑与条件轨迹控制从不同位置接入。](/paper-notes/ganimator/architecture.svg)](/paper-notes/ganimator/architecture.svg)

先沿主线看低帧率动作怎样到达最终帧率，再看针对编辑的分支：风格和稀疏关键帧改的是粗尺度动作，轨迹控制则要在多个尺度反复写入根部条件。图为根据原文架构与编辑机制重绘的教学示意，可点击放大。[图 2–3][p4] · [图 8–11][p9]

### 关键设计

1. **让卷积知道哪些关节相连。** 每帧表示包含相对父节点的 6D 关节旋转、三维根位移，以及选定末端的二值接触标签。训练标签由正向运动学（FK）求出的末端速度是否足够小来估计。生成器按骨架邻接关系交换信息，又把接触通道当成虚拟关节，与对应足部和全局位移通道相连。这样，模型能同时处理一只脚的姿态、是否着地以及身体是否还在移动。[§3.1–3.2][p3] · [骨架连接设计][p4]

2. **每一层只补它能看到的细节。** 主架构有七个时间尺度，相邻尺度按 **4/3** 倍线性上采样。细层接收「上一层动作上采样结果＋本层噪声」，用骨架卷积预测残差，并把残差加回上采样动作。每层的噪声幅度依据真实细层动作与真实粗层上采样之间的差异设定。这个分工给编辑留下空间：若替换最粗层的动作，其余层仍然可以完成原先学到的细化过程。[式 1–4、图 2–3][p4]

3. **局部判别与整段重建解决两个不同问题。** 各尺度的 PatchGAN 为时间窗逐一打分，然后取平均，以 WGAN-GP 目标训练。它约束局部片段像示范，却不要求每次都按原来的顺序表演。重建时另设一条路径：粗层输入固定噪声，细层的重建噪声取零，用 L1 损失要求还原对应分辨率的示范。随机生成与固定噪声重建分别回答“还能怎样动”和“原来那些动作有没有被学到”。[§3.2.2、式 5–6][p4]

4. **把“脚不该滑”落到可测的量上。** 接触一致性损失在模型预测脚应着地时惩罚该脚的世界空间速度。生成后的接触标签还用于逆向运动学（IK）后处理。若标签与运动不一致，强行固定脚可能让身体在转换处倾斜。表 2 给出了去掉一致性损失的对照。[式 7–8][p5] · [§4.4][p7]

### 一个完整例子：从一段《Gangnam Style》舞蹈到另一段表演

图 4 的训练片只有 371 帧，目标输出 600 帧。下表依次对应作者的输入、方法和图中可观察的结果。[图 2][p4] · [图 4][p6]

| 环节 | 《Gangnam Style》舞蹈例子中发生了什么 |
|---|---|
| 示范 | 七个尺度都来自同一位角色的同一段舞蹈，低帧率的版本保留大尺度运动，高帧率版本提供手和脚的细节。 |
| 学习 | 每个尺度在许多局部窗口中学习，固定噪声路径则要求重建原舞。训练输入没有舞步名称或分段标注。 |
| 新采样 | 按所需输出长度采噪声，由粗层生成运动轮廓，再逐级补出关节变化。生成器是全卷积网络，可以接受与训练片不同的长度。 |
| 验证 | 图 4 用右手速度着色比较生成方法。acRNN 很快收敛到静止姿势；手工重排的 MotionTexture 有不自然的过渡。GANimator 展示了顺序有变化而局部仍像示范的动作。图中的 **600 帧**是这一可视化案例的长度。 |

### 三种编辑，分别在哪里介入？

| 操作 | 用户给什么 | 从哪里起作用 | 原文证据 |
|---|---|---|---|
| 关键帧编辑 | 最粗时间尺度上的姿势。图 9 编辑了三个关键帧，包括让角色面向观众 | 细层生成过渡和细节。图中给出姿态对照，未报告世界坐标关键帧误差 | [图 9][p9] |
| 风格迁移 | 风格示范为自豪地走路，内容参考为另一段走路 | 在风格示范上训练，把内容动作下采样后替换第一层输出。结果沿用内容的步调，同时呈现较高的肘位。作者要求两段动作内容相近 | [风格示例图 8][p9] |
| 轨迹控制 | 连续的根位置与朝向 | 先训练普通生成器，再从它的样本抽出约束训练条件生成器。在每个尺度的输入和输出处，用约束覆盖对应通道，使判别器能检查根和肢体是否协调 | [图 10–12][p9] · [官方训练入口][cond] |

**交互轨迹有一段暂缓显示的尾部。** 设全网络的时间感受野为 R，取 r = ⌈R/2⌉。新约束到来时，只需保留此前最后 2r 帧的条件和噪声，与新数据一起计算。原输出末尾 r 帧仍可能变化，显示端先扣住它们。论文据此演示了人形和六足螃蟹的轨迹控制；官方示例按段喂入条件，没有测量游戏手柄输入到角色画面的延迟。[图 11–12、算法 1][p10] · [官方交互示例][cond]

### 训练与复现口径

作者使用艺术家制作的动画和来自 Mixamo、Truebones 的材料，示范长 140–800 帧，采样率为 30 fps。训练将相邻两级组成一块，逐块推进，以减轻低分辨率结果过度平滑的问题。在一张 RTX 2080 Ti 上，一条约 600 帧的人体示范训练约 4 小时，每级 15,000 次迭代。这个数值描述特定素材的训练开销。[§3.2.3、4.1][p5]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验：像示范的程度，能否与变化分开看？

表 1 有三个量。**覆盖率**从示范取 30 帧窗口，在生成结果中统计能找到足够接近匹配的比例。**全局多样性**将生成动作分成至少 30 帧的连续片段，与示范做最优分段匹配（PNN）。**局部多样性**则取生成动作的 15 帧窗口，测到示范中最近邻的平均距离。论文以局部关节旋转计算距离，后两列衡量偏离程度，因此沿用原表、不加优劣箭头。[式 9–13、图 6、表 1][p7]

| 原表 1 | 覆盖率 ↑ | 全局多样性 | 局部多样性 |
|---|---:|---:|---:|
| MotionTexture，多 texton | 84.6% | 1.03 | 1.04 |
| MotionTexture，单 texton | **100%** | 0.21 | 0.33 |
| acRNN | 11.6% | 5.63 | 6.69 |
| GANimator | 97.2% | 1.29 | 1.19 |

单 texton 几乎照着原片重现，因而覆盖最好，两种偏离都很小。acRNN 的偏离最大，却是因为输出很快停在一个示范里没有的姿势。GANimator 的 97.2% 可以解释为大部分示范窗口仍能在新动画中找到，不能解释为 97.2% 的帧在指定时刻准确落位。[图 4][p6] · [表 1 及原文解释][p7]

<details><summary>图 4 与评测代码的长度设置</summary>

图 4 的 371→600 帧用于可视化。作者 README 将表 1、2 的完整模型对应到《Gangnam Style》舞蹈权重；公开评测脚本对单条示范按其两倍长度取样，生成 200 个结果求均值，覆盖函数默认门槛为 2.0。脚本展示重建结果时计算 MSE 再乘 10⁵；这与训练式 6 采用的 L1 是两个口径。以上是对代码的静态核查。[评测脚本][eval] · [覆盖计算][coverage] · [README][repo]

</details>

### 混合训练：模型有没有保留两段大象动作？

图 7 用同一只大象的两段动画，一段比较静，另一段活动幅度大。联合训练给每条示范各自的重建噪声，并平均它们的重建损失。表中每一列都问对应示范的局部窗口能否在生成结果中找到。[§5、式 14、表 3][p8]

| 原表 3 · 训练数据 | 对序列 1 的覆盖率 ↑ | 对序列 2 的覆盖率 ↑ |
|---|---:|---:|
| 只用序列 1 | 100.0% | 1.5% |
| 只用序列 2 | 2.4% | 100% |
| 两段一起训练 | 100.0% | 97.8% |

两段一起训练时覆盖了两种活动，单段训练在另一段上只有 1.5% 或 2.4%。这是覆盖能力的对照，表中没有用户指定片段切换时刻的实验。[原表 3、图 7][p8]

### 消融实验

| 原表 2 · 配置 | 重建指标 Rec. Loss ↓ |
|---|---:|
| 去掉接触一致性损失 | 4.04 |
| 以欧拉角表示关节旋转 | 23.6 |
| 以四元数表示关节旋转 | 9.25 |
| 完整方法（6D 旋转＋接触一致性） | **2.85** |

- **旋转与接触。** 换成欧拉角或四元数时重建指标均变差，去掉接触一致性后则从 2.85 升到 4.04。作者在视频中还观察到接触转换时的不自然倾斜；原表报告重建值，没有单列足滑距离。[表 2、§4.4][p7]
- **重建约束。** 去掉固定噪声的重建损失后重新训练，作者观察到动作质量下降。表 2 没有为这一配置给数值。[§4.4][p7]
- **时间感受野。** 在 YMCA 舞蹈上，大感受野容易记住全局结构并在生成中停住；小感受野缺少上下文而产生抖动。合适的宽度允许重排舞步又维持过渡，原文给的是定性比较。[§4.4][p8]

### 关键发现

1. **两个方向的最近邻要一起读。** 从示范找生成片段评覆盖，从生成片段找示范评偏离。前者可能奖励原片重播，后者可能奖励不合理的新姿势，图 4 的过渡与脚接触帮助排除这两种误读。[图 4][p6] · [表 1][p7]
2. **编辑能力取决于条件放在哪里。** 粗层内容替换和关键帧编辑由已有生成链完成；根轨迹约束则依赖专用条件训练。图 8–12 给出定性实例，三张定量表分别评生成、重建和多示范覆盖。[§5][p8] · [条件训练图 10][p9]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **分辨率也可以是编辑接口。** 训练时粗层负责较慢变化，因而生成时能在这一层换入新的内容动作。普通走路换上自豪步态的例子，把粗层和细层各自贡献什么变成了可观察的实验。[图 8][p9]
- **小数据任务需要专门的反例。** 原表中的单 texton 与静止的 acRNN 是两个极端，有它们作对照，才能看清“覆盖很高”和“生成得很不一样”究竟意味着什么。[§4.2–4.4][p7]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **可变化的范围取决于示范。** 风格迁移依赖风格示范提供的多尺度片段。作者演示了两种走路之间的迁移，并指出内容需相近。模型也须预先离线学习本条动作和骨架。[§5][p8] · [§6][p10]
- **足接触只处理了部分物理问题。** FK、速度一致性和 IK 有助于减少滑脚，复杂地形、人与物交互、身体形变仍超出本文模型。螃蟹群体演示展示同一示范能产生多个角色变体，没有给出群体避碰结果。[图 5][p6] · [§6][p10]
- **事件和空间控制需要另外验证。** 本文没有显式舞步词表。若任务是“某一拍手指精确指向物体”，还需要说明怎样标出该事件，并在解码后测指向与时序误差。本文数值衡量的是运动覆盖、多样性和重建。[表 1–2][p7]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **SinGAN。** 单张图像中有许多可学习的局部图块。GANimator 把这一路径移到多个时间分辨率，又为动作补上骨架邻接、足接触与 FK，一条示范因此能在自己的骨架上提供监督。[SinGAN 原文][singan] · [GANimator §3][p3]
- **SinMDM（ICLR 2024）。** 两者都用受限的时间感受野学习单片中的局部规律。GANimator 为不同帧率分别训练 GAN，编辑可替换粗层动作，指定根轨迹需条件生成器。SinMDM 训练一个扩散去噪器，在反向采样中按帧或关节写回参考；两者的控制入口和训练开销不能直接互换。[SinMDM 原文与演示][sinmdm] · [站内 SinMDM 解读](/blog/iclr2024-sinmdm/)
- **GenMM（SIGGRAPH 2023）。** 同样从少量示范出发，GenMM 把多尺度最近邻匹配用于合成本身。GANimator 学的是连续生成器，此处的分段最近邻是评测工具。二者即使都谈“片段”，片段在算法中的职责也不同。[GenMM 项目][genmm] · [站内 GenMM 解读](/blog/siggraph2023-genmm/)
- **与动作基元发现对读。** GANimator 的窗口提供局部训练信号，没有动作名称、边界或类别输出。*Discovery and recognition of motion primitives in human activities* 则从关节组运动中切出片段、聚成类别，并在新序列中识别。可以分别用这两条思路研究“怎样生成可信变化”和“怎样给变化找出可复用的名称与时段”。[站内动作基元解读](/blog/plosone2019-motion-primitive-discovery/) · [动作基元发现原文][primitives]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- [ACM 正式记录][doi] · [作者公开正式 PDF][paper] · [项目动画][demo]
- [官方代码与权重入口][repo] · [评测脚本][eval] · [条件通道实现][mask]
- 文章架构图为教学重绘，实验数值取自正式稿表 1–3。图像案例依据原文图 4、5、7–12；本文未重新训练或运行权重。

</div>

[doi]: https://doi.org/10.1145/3528223.3530157
[paper]: https://peizhuoli.github.io/ganimator/paper/ganimator-camera-ready.pdf
[p3]: https://peizhuoli.github.io/ganimator/paper/ganimator-camera-ready.pdf#page=3
[p4]: https://peizhuoli.github.io/ganimator/paper/ganimator-camera-ready.pdf#page=4
[p5]: https://peizhuoli.github.io/ganimator/paper/ganimator-camera-ready.pdf#page=5
[p6]: https://peizhuoli.github.io/ganimator/paper/ganimator-camera-ready.pdf#page=6
[p7]: https://peizhuoli.github.io/ganimator/paper/ganimator-camera-ready.pdf#page=7
[p8]: https://peizhuoli.github.io/ganimator/paper/ganimator-camera-ready.pdf#page=8
[p9]: https://peizhuoli.github.io/ganimator/paper/ganimator-camera-ready.pdf#page=9
[p10]: https://peizhuoli.github.io/ganimator/paper/ganimator-camera-ready.pdf#page=10
[demo]: https://peizhuoli.github.io/ganimator/
[repo]: https://github.com/PeizhuoLi/ganimator
[cond]: https://github.com/PeizhuoLi/ganimator/blob/2943064b456d13f0357e23e3c37fb43b6aa3fdaa/README.md#training-a-conditional-generator
[mask]: https://github.com/PeizhuoLi/ganimator/blob/2943064b456d13f0357e23e3c37fb43b6aa3fdaa/models/utils.py#L9-L23
[eval]: https://github.com/PeizhuoLi/ganimator/blob/2943064b456d13f0357e23e3c37fb43b6aa3fdaa/evaluate.py
[coverage]: https://github.com/PeizhuoLi/ganimator/blob/2943064b456d13f0357e23e3c37fb43b6aa3fdaa/evaluations/perwindow_nn.py
[singan]: https://openaccess.thecvf.com/content_ICCV_2019/html/Shaham_SinGAN_Learning_a_Generative_Model_From_a_Single_Natural_Image_ICCV_2019_paper.html
[sinmdm]: https://sinmdm.github.io/SinMDM-page/
[genmm]: https://igl.ethz.ch/projects/genmm/
[primitives]: https://doi.org/10.1371/journal.pone.0214499
