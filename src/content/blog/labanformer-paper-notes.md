---
title: "[Neurocomputing2023] LabanFormer：从连续骨架里读出左右脚怎样换重心"
description: "用一个四步舞段读懂 LabanFormer。沿着 26 关节骨架、一跳与两跳邻域、双端 GRPE 和符号解码器，理解舞步转录的 94.86% 究竟测量了什么。"
pubDate: "2026-11-19T17:36:00+08:00"
badge: "Paper"
tags: ["LabanFormer", "Labanotation", "Dance", "Motion Understanding", "Graph Attention", "Symbolic Motion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 全文阅读版][html] · [期刊版 PDF][pdf] · [期刊记录][doi]

<details class="paper-meta"><summary>论文信息与阅读范围 · Neurocomputing 2023</summary>

*LabanFormer: Multi-scale graph attention network and transformer with gated recurrent positional encoding for labanotation generation*。Min Li、Zhenjiang Miao、Yuanyao Lu，发表于 *Neurocomputing* 第 539 卷，文章号 126203。本文依据 14 页正式期刊版，核对图 3、6–8、14 和表 1–5。SSRN 另列有 2022 年作者稿。文中成绩均取自期刊版。[正式记录][doi] · [作者稿记录][ssrn]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给 LabanFormer 一段舞者的三维骨架，它把数百个姿态转写成较短的一串舞步，逐步指出哪条腿向哪个方向、在哪个高度换支撑。模型先从同一帧内的关节配合读出肢体动作，再用整段的前后关系判断应该写几个符号、按什么次序写。[原文 §2、图 3][method]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 拉班舞谱从下向上读，谱栏区分身体部位。谱心两侧的支撑栏记录负重变化。概括一个人“向前走”，读者知道动作类型；把左右脚每一步向哪里转移重心写进支撑栏，读者才可以按次序复习这段舞。[§1、图 1–2][intro]

**现有痛点：** 动捕设备每秒记录 150 帧，谱上一个舞步却只需一个符号。传统的两阶段方法要先分割动作，再识别每段。若把同一步误切成两段，后面的分类器可能将两段都识别得很像，最终仍会多写一步。[§1、§3.1][datasets]

**核心矛盾：** 单帧里脚踝朝哪里走，取决于髋、膝和相邻关节的配合。两个姿态看起来相似，又可能属于前后两个不同的支撑事件。写出谱既需要局部骨架信息，也需要看整串舞步。[§2.3–2.4][method]

**本文目标：** 从连续动捕直接输出**左右支撑栏的方向符号序列**。完整设置由两侧、八个水平方向、三个高度组成，共 48 类。手臂栏、面部和上身姿态不在这两套测试标签中。[§1、§3.1][datasets]

**切入角度：** 骨架本来就是由骨骼连接的图。先限制一个关节能向哪些邻居取信息，再学习每个邻居在当前动作中应占多大权重；帧间的顺序和重复则单独交给时序网络处理。[§2.3、图 5–6][graph]

**核心 idea：** 空间端的多尺度图注意力 MS-GAT 把每帧整理成一个动作特征。时间端用门控循环位置编码 GRPE 给特征加入上下文，Transformer 再把长动作序列翻译成短符号序列。[图 3、7][method]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

动作端读取整段 BVH 骨架。符号端读取已经写出的步子；每预测下一步，都能通过交叉注意力回看动作端。若输入有 L 帧，空间编码后依然有 L 份特征，而输出长度取决于识别到多少步。原文图 14 的动作最后压缩成四个符号。[图 3、图 7][method] · [图 14][case]

<figure class="reading-figure"><a href="/paper-notes/labanformer/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/labanformer/architecture.svg" alt="连续骨架经多尺度图注意力和动作端 GRPE 编码，符号前缀经独立 GRPE，解码器读取两者生成左右支撑符号" loading="lazy" /></a><figcaption>据原文图 3、6–8、14 绘制。绿色一路保留动作帧，黄色一路积累已写出的舞步。底部的四步对应原文展示的舞段。点击可放大。</figcaption></figure>

### 关键设计

1. **先把关节放进可比较的坐标系。** BVH 的关节旋转相对于父关节。作者沿层级转换为三维关节坐标，做相对位置与朝向归一化。每帧 26 个关节，每个关节 3 个数，形成 78 维输入。模型因此可以基于相邻关节的变化学习，而不用直接比较不同朝向下的局部欧拉角。[§2.2、图 4][method]

2. **把“骨架上离多远”和“此刻有多重要”分开。** 对一个关节，先选骨架图中一跳或两跳能到达的邻居，再对各自邻域内的关节特征计算注意力、归一化并加权求和。不同尺度的结果拼接，经过非线性变换后组成这一帧的表示。例如脚踝可以同时利用沿腿直接相连和再远一节的关节。表 4 还专门检查继续扩大邻域是否划算。[§2.3、图 5–6][graph] · [表 4][ablation]

3. **让位置编码随正在读的舞段而更新。** GRPE 用单向 GRU 逐项更新隐藏状态，当前位置的表示携带此前输入的信息。动作端和符号端各有一套同结构、不同权重的 GRPE。两端分别处理稠密骨架和稀疏步子，不需要预先知道二者如何对齐。这里的门控状态不能直接读成音乐节拍或舞步相位。[§2.4.1、图 7][temporal]

4. **生成可插入、遗漏或写错的事件序列。** 编码器在整个动作序列上使用自注意力；解码器通过掩码自注意力读符号前缀，再通过交叉注意力读取编码器输出，逐个给出符号。注意力可以借用多个动作帧，并未被监督成每一步起止时刻的精确标注。[§2.4.2、图 8][temporal]

### 一个完整例子

图 14 里，舞者先左脚向前、右脚向前，然后左脚向右前、右脚向右前。四步都在中位。转写时，前两步的“前”和“中位”相同，**支撑侧**将两步区分开；第三步仍是左脚和中位，**水平方向**却从前方改为右前方。读者可以沿两条支撑栏检查这两个变化。[图 14][case]

假设一个模型把第三步写成“左脚向前、中位”，其余三步全对，按编辑距离就要修改一个符号。四步样例的得分是 1 − 1/4 = 75%。这是指标的演算示例；论文图 14 展示的四步都转录正确。即使侧别、方向、顺序全部正确，谱仍没有给出精确落脚坐标、足底压力或触地帧。[§3.1、图 14][datasets]

### 训练与推理

训练数据是动捕片段与参考谱的配对，推理给模型新的骨架序列。报告配置采用四头注意力、128 维 Transformer，编码器 10 层、解码器 5 层；GRPE 输入、隐藏和输出维度均为 64。实验使用两张 RTX 2080 Ti，论文没有给出累计 GPU 小时。[§3.1][setup]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 数据与计分

四位参与者在四种朝向下录制。每段通常含 3–8 个动作，每个数据集一半用于训练、一半用于测试。LabanSeq16 只含中位，LabanSeq48 增加低位和高位。符号生成分数为 100 × (1 − WER)，按预测串相对于参考串的替换、插入、删除计错。[表 1、§3.1][setup]

| 数据集 | 动作序列 | 已标注符号数 | 动捕帧数 | 类别数 |
| --- | ---: | ---: | ---: | ---: |
| LabanSeq16 | 1,600 | 7,121 | 1,119,706 | 16 |
| LabanSeq48 | 4,800 | 22,654 | 3,067,156 | 48 |

### 主实验

下面节选原表 2。已有方法在 LabanSeq16 上引用原论文结果；LabanSeq48 的已有方法数值由作者使用相应代码获得。两阶段基线使用自动分段。[表 2][setup]

| 方法 | LabanSeq16 ↑ | LabanSeq48 ↑ |
| --- | ---: | ---: |
| 自动分段 + C-GRU | 78.92 | 73.96 |
| DFGNN-CTC | 87.79 | 82.02 |
| GS-GCN + RA-Attention Seq2seq | 89.84 | 89.40 |
| 融合特征 + CRNN 注意力 Seq2seq | 90.65 | 93.29 |
| 标准 Transformer | 93.16 | 92.24 |
| **LabanFormer** | **94.44** | **94.86** |

相对标准 Transformer，完整模型分别提高 **1.28 和 2.62 个百分点**。在 48 类任务上，标准 Transformer 还低于融合特征 CRNN 的 93.29；直到加入论文设计的骨架与时序模块，排序才翻转。[表 2][setup]

### 消融实验

原表 3 将两个模块逐一加入同一个基线。48 类任务上，仅加 MS-GAT 提高 1.83 个百分点，仅换 GRPE 提高 1.56 个百分点；同时使用得到 94.86。两项增益有重叠。[表 3][ablation]

| 空间编码与位置编码 | LabanSeq16 ↑ | LabanSeq48 ↑ |
| --- | ---: | ---: |
| 基线 + 正弦位置编码 | 93.16 | 92.24 |
| MS-GAT + 正弦位置编码 | 93.37 | 94.07 |
| 基线 + GRPE | 93.74 | 93.80 |
| **MS-GAT + GRPE** | **94.44** | **94.86** |

把注意力邻域从一跳扩大到两跳，两列均有改善；三跳以上在两个测试集上都未超过两跳。表 5 另比较了六种编解码深度，10 层编码、5 层解码在所测组合中两项最高，12/6 层则为 91.56 和 94.15。[表 4–5][ablation]

| 纳入的骨架邻域 | LabanSeq16 ↑ | LabanSeq48 ↑ |
| --- | ---: | ---: |
| 一跳 | 92.88 | 93.91 |
| 一至两跳 | **94.44** | **94.86** |
| 一至三跳 | 93.89 | 93.47 |
| 一至四跳 | 92.17 | 94.05 |
| 一至五跳 | 93.26 | 93.25 |

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把动作识别的单位选在“哪一步”。** 左右脚都朝前时，整段动作名称可能始终是“前进”。支撑栏仍有两个先后发生的事件，模型会因漏掉其中一步而被扣分。这使舞谱适合用来检查动作计划里的顺序。[§1、§3.1][datasets]
- **空间归纳偏置有可检查的范围。** 表 4 对邻接阶数做了干预。局部两跳邻域比只看直连关节好，继续扩大也会稀释有用信息。这个结果只覆盖本文的骨架、数据和标签粒度。[表 4][ablation]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **输出覆盖两条支撑栏。** 可以知道先由哪只脚朝哪个方向换重心；同一步发生时手臂怎样摆、躯干如何弯、舞者是何种风格，均需要额外的符号、训练数据和评测。[§3.4、§4][case]
- **短片段上的转录给不了整支舞的成绩。** 测试主要覆盖四位参与者和 3–8 步片段。GRPE 可以接收变长序列，但整支舞的长程漏记、陌生舞者泛化与长达几分钟的节拍漂移仍需单测。[§3.1、局限][datasets]
- **符号对齐与物理对齐是两种评测。** 插入、删除、替换可以检查舞步顺序。若目的是精确编辑身体动作，还需另外验证触地时刻、支撑稳定性与关节轨迹。[§3.1][setup]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **Hand Labanotation** 把同步图像写成每帧每段手骨的局部方向；LabanFormer 将全身动捕归纳为少量支撑步。同样写着“准确率”，前者数骨段方向格，后者数舞步序列的编辑错误。[Hand Labanotation 解读](/blog/acmmm2024-hand-labanotation/)
- **LabanDancer** 展示如何从已有舞谱解释非承重动作和支撑变化，再合成三维动画。两篇沿相反方向读谱；若要串起来，还需处理符号兼容性、缺失的上肢信息与动作时长。[LabanDancer 解读](/blog/vast2003-labandancer/)
- **LaMoGen** 从文本出发编排带部位和时长的符号计划，再解码身体动作。LabanFormer 提供的是观察已有骨架后识别支撑事件的思路，可启发对生成结果的独立检查。[LaMoGen 解读](/blog/cvpr2026-lamogen/)

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 期刊信息与作者稿记录。[Neurocomputing][doi] · [SSRN][ssrn]
- 方法、公式、原始对照与消融均据 14 页期刊版。HTML 根据该版重排，可按页回看原图与公式。[全文 HTML][html] · [期刊版 PDF][pdf]

</div>

[doi]: https://doi.org/10.1016/j.neucom.2023.03.064
[ssrn]: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4272377
[html]: /paper-notes/labanformer/fulltext/
[pdf]: /paper-notes/labanformer/fulltext/source.pdf
[intro]: /paper-notes/labanformer/fulltext/#page-2
[method]: /paper-notes/labanformer/fulltext/#page-4
[graph]: /paper-notes/labanformer/fulltext/#page-5
[temporal]: /paper-notes/labanformer/fulltext/#page-6
[datasets]: /paper-notes/labanformer/fulltext/#page-8
[setup]: /paper-notes/labanformer/fulltext/#page-9
[ablation]: /paper-notes/labanformer/fulltext/#page-10
[case]: /paper-notes/labanformer/fulltext/#page-12
