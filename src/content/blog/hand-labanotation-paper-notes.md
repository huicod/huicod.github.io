---
title: "[ACMMM2024] Hand Labanotation：怎样把握拳的过程写成一张可读的手形谱"
description: "用六帧握拳读懂手部拉班谱。沿着 21 个关节、20 个骨段方向和 26 种符号，看 MHLFormer 如何从多视角图像写谱，以及谱面能还原多少手指细节。"
pubDate: "2026-11-19T17:35:00+08:00"
badge: "Paper"
tags: ["Hand Labanotation", "MHLFormer", "Hand Motion", "Motion Understanding", "Labanotation", "Symbolic Motion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[作者版 PDF][pdf] · [ACM 出版记录][doi] · [OpenReview 记录][record]

<details class="paper-meta"><summary>论文信息与阅读范围 · ACM Multimedia 2024</summary>

*Translating Motion to Notation: Hand Labanotation for Intuitive and Comprehensive Hand Movement Documentation*。按正式出版记录，作者为 Ling Li、WenRui Yang、Xinchun Yu、Junliang Xing、Xiao-Ping Zhang。论文发表于第 32 届 ACM Multimedia，页码 4092–4100。本文核对作者版全文的图 2–9、表 1–2 和出版元数据，实验数字均为论文报告值。[出版记录][doi] · [作者版 PDF][pdf]

原文介绍了 MHLFormer 和新标注 HLD，本次未核实到作者公开的训练代码、权重或完整 HLD 标签下载地址。底层数据集 InterHand2.6M 和 FreiHAND 各有项目入口。本文没有运行模型。[InterHand2.6M][interhand] · [FreiHAND][frei]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

一段从张手到握拳的视频，可以写成一张谱，每一列追踪一段手骨，每一行对应一帧，每一格用一个符号记录骨段朝向。作者定义了这套含 26 个方向的手部拉班谱，再训练 MHLFormer 从同一时刻的相机画面直接写谱。把谱读回骨架，能看出手如何张开或收拢，但同一个方向格里的细微角度已经合并了。[图 2–3][notation] · [图 6][example] · [图 8][ablation]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 记录一只手可以保存三维关键点、网格或 MANO 参数。这些表示适合测量、渲染和建模。拉班舞谱提供了另一种阅读方式，人可以看谱上的位置、形状和纹理，知道哪个部位朝哪里动。[§1–2][pdf]

**现有痛点：** 给两帧各 21 个关节的坐标，读者很难一眼指出食指哪一节先弯。用“握拳”概括又会漏掉运动过程。手语的词义还可以依赖手臂、表情和上下文，同一个词标签也回答不了所有这些几何问题。[§1][pdf]

**核心矛盾：** 精细记录需要保存很多连续自由度，人读谱却需要少量稳定、能区分的符号。相邻骨段彼此遮挡又加重了观察困难，尤其在手指收进掌心、正面只露出部分轮廓时。[§1–3][notation]

**本文目标：** 规定一套读者能解码的手部方向符号，给已有手部图像补上谱面标注，并检验模型能否从新图像识别出每个部位的正确符号。[§3.1–3.3][method]

**切入角度：** 用手腕和手掌定义局部坐标系，每次只关心一段骨骼从父关节指向子关节的方向。各个部位共用一套方向字典，部位身份由谱面列的位置给出。[图 2–3][notation]

**核心 idea：** 用已有三维标注制作训练答案，再让视觉模型从一个或多个视角直接预测同样的答案。预测错了多少可以逐格统计，某个错误在空间上偏了多远也可以参与训练。[图 4–5][method] · [§4.2][example]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先分清**造谱**和**读图写谱**两条路径。训练标签从三维关节出发，经过手部坐标系、骨段方向和空间分区，得到每一帧的符号。实际转录时输入同一时刻的多视角 RGB 图像，MHLFormer 汇合各视角证据，直接为每段手骨输出方向类别。视频由多帧转录结果依序排成谱；从谱恢复骨架是另一个可选步骤。[图 3、图 5][method] · [图 6][example] · [§5.3][applications]

<figure class="reading-figure"><a href="/paper-notes/hand-labanotation/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/hand-labanotation/architecture.svg" alt="训练时以三维关节构造方向符号，推理时从多视角手部图像预测每帧谱面，另可从符号近似还原骨架" loading="lazy" /></a><figcaption>教学示意，可点击放大。先看三维标注怎样变成训练目标，再沿图像端追踪跨视角融合、置信图与分类头，最后看符号怎样按时间组成谱面。依据原文图 2–6 和 §5.3 绘制。</figcaption></figure>

### 关键设计

1. **用相对方向把连续手形写成格子。** 单手模型含 21 个关节，以腕为根，手腕指向中指根的方向定义局部 Y 轴。对每个非根关节，用子关节位置减去父关节位置，得到 20 个骨段方向。作者取长方体的 8 个顶点、12 条边的中点和 6 个面的中心来定义 26 种代表方向。符号的形状对应局部 XY 平面上的投影，填充纹理对应与 Z 轴的夹角。两根骨段可以用相同符号，列号会指出各自属于哪一段。[§3.1、图 2–3][notation]

2. **把几何规则用作监督。** HLD 在 InterHand2.6M 与 FreiHAND 已有样本上加标。对坐标完整的帧，作者把骨段向量转为球坐标，再根据角度所在区域赋符号。作者报告，19.85% 的关节帧存在信息缺失，这部分逐关节人工标注，并在原有信息完整的关节上检查人工结果与计算结果是否一致。这使大部分标注可以通过规则获得，也意味着监督质量仍受原始三维坐标影响。[§3.3、式 2][method]

3. **让不同视角互相补充被挡住的骨段。** 每张图先用 CNN 提取特征，再变成可参与注意力运算的序列。单个视角内部计算自注意力，相邻视角之间再交换信息。具体地，当前视角给出查询，前一视角经过线性投影后提供键和值。图 5 另画出并行的 ResNet-50 置信图分支，它与特征图通过张量乘积结合；各视角结果再拼接，交给全局自注意力和分类头。这个“相邻”指相邻的相机视角。[§3.4、式 3–4、图 5][method]

4. **让相近方向和相反方向承担不同的训练代价。** 两个垂直方向相反的符号、两个只差一个方位的符号，都可能被普通分类记为一次错误。作者用方向中心向量的点积构造 26 × 26 的相关矩阵，方向越相背，对应的惩罚系数越大，再将这项损失与分层交叉熵 HXE 混合成 LH。测试时的完整符号准确率仍要求类别完全相同，训练时的“邻近”不会自动算作命中。[§3.5、式 5–8][loss] · [§4.2][example]

### 一个完整例子

读原文图 6 的六帧握拳。先选中食指的一段骨骼，在谱上始终盯住对应的一列。每个时刻的不同相机都在看同一个手形，模型为该段给出 26 类分数，一格里落下一个方向符号。**横看一行**，能看到这一刻整只手 20 段骨骼如何配合；**纵看一列**，从下往上可以追踪刚才那段食指何时跨到另一个方向区域。图里的一行对应一帧，六行合成这次握拳的过程。[图 6][example]

反过来读时，先给手腕一个起始位置，给每段骨骼赋成人手比例的长度，再沿谱中各符号的代表方向逐段接出骨架。图 8 另外给出两段**张手**的重建。即使每一格都识别正确，这个过程也只能恢复方向格的中心，原来落在同一格内的两个指尖位置仍可能不同。[图 8][ablation] · [§5.3][applications]

### 训练与推理

HLD 共 **4,243,136 张图像**，其中训练 2,525,049 张，验证 852,343 张，测试 865,744 张。多视角会为同一手形提供多张图片，因此数量的单位是图像。作者使用 2 张 NVIDIA RTX 3090、训练 50 个 epoch，学习率为 0.0001。推理时，每个时刻的输入是 N 张同步图像；双手对应 40 组各含 26 个类别的分数，选定类别后得到 40 格。评测用掩码处理单手或双手样本，分母为参与比较的有效格数。[§3.2、式 1][method] · [§4.1–4.2][example] · [§4.5][applications]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

HLD 测试集，原文表 1。所有方法只看**一个视角**。三种对照方法先预测三维关节，再按规则转成同一套符号；MHLFormer 直接预测方向符号。水平准确率只比较平面方向，垂直准确率只比较高度分量，完整符号准确率要求两者组成的类别正确。[表 1、§4.2–4.3][table1]

| 单视角方法 | 完整符号 ↑ | 水平 ↑ | 垂直 ↑ | 参数大小（MB） | 计算量（GFLOPs） |
| --- | ---: | ---: | ---: | ---: | ---: |
| OpenPose | 46.43% | 54.41% | 75.37% | 36.83 | 50.02 |
| InterNet | 64.72% | 68.89% | 85.44% | 143.37 | 32.81 |
| IntagHand | 59.48% | 65.42% | 76.34% | 39.04 | 17.88 |
| **MHLFormer** | **78.75%** | **81.86%** | **89.35%** | 58.20 | 15.15 |

### 消融实验

原文表 2 节选。@2 和 @4 是**输入视角数**。下面保留完整符号的准确率，便于分别读出跨视角融合、分类损失和骨干大小的影响。[表 2][ablation]

| 骨干 | 相邻视角融合 | 损失 | 双视角 ↑ | 四视角 ↑ |
| --- | --- | --- | ---: | ---: |
| ResNet-50 | 关闭 | LH | 75.13% | 82.14% |
| ResNet-50 | 开启 | LH | 83.46% | 87.71% |
| ResNet-152 | 关闭 | LH | 78.92% | 85.16% |
| ResNet-152 | 开启 | 交叉熵 CE | 80.98% | 84.88% |
| ResNet-152 | 开启 | 分层交叉熵 HXE | 82.64% | 87.45% |
| ResNet-152 | 开启 | LH | **84.17%** | **88.04%** |

**跨视角融合。** 固定 ResNet-50 与 LH，加入融合使双视角提高 8.33 个百分点、四视角提高 5.57 个百分点。固定 ResNet-152 与 LH，四视角提高 2.88 个百分点。[表 2][ablation]

**方向惩罚与骨干。** 固定 ResNet-152、四视角及融合模块，CE、HXE、LH 分别得到 84.88%、87.45%、88.04%。在 LH 和四视角条件下，将 ResNet-50 换成 ResNet-152，准确率从 87.71% 升至 88.04%。[表 2][ablation]

### 关键发现

1. 单视角直接写谱比这组最强的坐标转换基线 InterNet 高 **14.03 个百分点**。比较验证了直接优化符号识别的价值，表内没有给出相应的三维指尖误差。[表 1][table1]
2. 在最强四视角设置中，垂直、水平、完整符号准确率依次为 **95.31%、89.99%、88.04%**。垂直只有 3 档，平面分区更细，三类数字回答的是不同难度的问题。[§3.1、图 2][notation] · [表 2][ablation]
3. 作者试验了 1–6 个视角，图 9 中选四视角作为准确率和资源开销的折中。这是这套采集布置下的选择。论文没有据此建立任意四台相机摆放的精度保证。[图 9、§4.5][applications]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **字典可以独立检查。** 给定三维关节就能按规则写出参考符号，给定符号也能画出代表方向。若某一列读错，可进一步追问是相机遮挡、方向分区的边缘，还是模型把两个相似手形混淆。[图 2–6][method]
- **同一只手有两种读法。** 横向的一行保留不同手指的并发状态，纵向的一列保留一段骨骼随时间的方向变化。于是“食指先收还是小指先收”可以落成两个明确列的比较。[图 6][example]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **可辨的手形与精确接触相距多远？** 手谱只保留方向区间。恢复骨架还要给定根位置和各段骨长。同一格允许多种指尖位置，因而仅凭谱面很难判定拇指和食指是否刚好接触。[§5.3、§6][applications]
- **88.04% 的单位是有效“帧 × 骨段”格。** 一帧双手最高有 40 格，整行全对率、整段握拳成功率、时间抖动是另外的问题。作者给出了张手的重建示意，正文未提供相应的毫米级重建误差或逐序列全对率。[§4.2][example] · [图 8][ablation]
- **识别应用仍有待单独验证。** §5 讨论把手谱送入机械手控制，以及在 Sahand 上用线性层区分 10 个数字与 26 个字母。原文未报告机械手接触成功率、复现延迟或这 36 类的分类成绩，也没有对初学者识谱进行计时测试。[§5.1–5.3][applications]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **InterHand2.6M 与 FreiHAND。** 两者的三维标注让作者可以计算骨段方向。若已有三维手数据，可先检查坐标系、骨骼对应关系和缺失关节，再决定哪些样本能产生可靠手谱。[InterHand2.6M][interhand] · [FreiHAND][frei]
- **LabanFormer。** 两篇都从观测动作生成记谱。LabanFormer 利用骨骼序列的空间和时间结构预测人体拉班谱；本文从同步 RGB 视角估计每一段手骨的 26 类局部方向。研究手指和上肢的联动时，首先要约定两套谱的部位粒度与时间对应。[LabanFormer 解读][labanformer]
- **LaMoGen。** LaMoGen 从语言开始，安排带时长的部位动作，再将符号解码为三维身体动作；Hand Labanotation 能为已观测到的指节方向写谱。二者的中间表示承担不同职责，分别可用来检查“计划了什么”和“手指实际怎么动”。[LaMoGen 解读][lamogen]
- **DigitCode。** 这篇后续工作直接以固定 26 方向手谱为起点，比较每段骨骼、整根手指和分层组合的编码粒度。若目标是编辑一根手指，可以把问题从“怎样识别每一格”推进到“什么粒度的符号才足以约束多段关节协同”。[DigitCode 原文][digitcode]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 正式会议信息、作者顺序与页码。[ACM Multimedia 出版记录][doi] · [出版元数据][crossref]
- 记谱规则、数据构建、网络、原始实验及应用讨论均据 9 页作者版。两张实验表分别取自原文表 1、表 2，后者为节选。[作者版 PDF][pdf] · [OpenReview 记录][record]
- 数据集与延伸阅读。[InterHand2.6M][interhand] · [FreiHAND][frei] · [DigitCode][digitcode]

</div>

[pdf]: https://openreview.net/pdf?id=7B93ulPZ9K
[record]: https://openreview.net/forum?id=7B93ulPZ9K
[doi]: https://doi.org/10.1145/3664647.3680568
[crossref]: https://api.crossref.org/works/10.1145/3664647.3680568
[notation]: https://openreview.net/pdf?id=7B93ulPZ9K#page=3
[method]: https://openreview.net/pdf?id=7B93ulPZ9K#page=4
[loss]: https://openreview.net/pdf?id=7B93ulPZ9K#page=5
[example]: https://openreview.net/pdf?id=7B93ulPZ9K#page=6
[table1]: https://openreview.net/pdf?id=7B93ulPZ9K#page=6
[ablation]: https://openreview.net/pdf?id=7B93ulPZ9K#page=7
[applications]: https://openreview.net/pdf?id=7B93ulPZ9K#page=8
[interhand]: https://github.com/facebookresearch/InterHand2.6M
[frei]: https://lmb.informatik.uni-freiburg.de/resources/datasets/FreihandDataset.en.html
[digitcode]: https://arxiv.org/html/2608.03127v1
[labanformer]: /blog/neurocomputing2023-labanformer/
[lamogen]: /blog/cvpr2026-lamogen/
