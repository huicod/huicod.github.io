---
title: "[arXiv2025] LaMoGen：用力效与形态引导扩散，让同一个动作更有力、更舒展"
description: "首尔大学 Kim 等人的 Laban Movement-Guided Diffusion。以一次跳跃走完两遍 DDIM，读懂四条可微运动学曲线、文本嵌入优化，以及高选择性得分与动作质量之间的取舍。"
pubDate: "2026-11-20"
badge: "Paper"
tags: ["LaMoGen", "Laban Movement Analysis", "Effort", "Shape", "MotionDiffuse", "Text-to-Motion", "Diffusion", "Motion Style", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 全文与附录][html] · [原文 PDF][pdf] · [CVPR 2026 同名论文：LabanLite 动作谱][other]

<details class="paper-meta"><summary>论文信息与阅读范围 · arXiv 2025</summary>

*LaMoGen: Laban Movement-Guided Diffusion for Text-to-Motion Generation*，作者为首尔大学的 Heechang Kim、Gwanghyun Kim、Se Young Chun。2025 年 9 月 29 日首次提交，本文核对 10 月 13 日的 v2。作者实验室将其列为 arXiv 报告，截至 2026 年 11 月 20 日未核实其他正式发表记录。原文给出了预训练底座 MotionDiffuse 的仓库；本次未找到可核实的 LaMoGen 专用实现或权重。下文数字来自原文，未运行模型。[版本记录][abs] · [实验室出版清单][lab] · [底座代码][base]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给定“一个人跳起来”，这篇 LaMoGen 先生成一次自然的跳跃，测出它每一帧的速度、加速度等特征，再从同一份初始噪声出发，微调**文本条件的数值向量**，让第二次跳跃更接近用户选择的力度或舒展程度。用户可以直接调强弱；原文也测出了这样做对动作质量的代价。[方法图 2][fig2] · [实验表 2][table2]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 文本到动作模型已经能把“跳起”“划船”等描述变成三维骨架序列。不过“做哪个动作”和“用什么质感做这个动作”是两个问题。拉班动作分析中的 Effort 与 Shape 给后一个问题提供了一套描述词汇。[引言][intro]

**现有痛点：** 在提示中加上“有力地”，可能只是轻微改变结果，也可能让动作内容一起变。论文图 3 的例子里，仅靠文字修饰，有一组结果甚至丢掉了原本应有的弯腰动作。[图 3][fig3]

**核心矛盾：** “有力”是人对表现方式的判断，扩散模型输出的却是连续姿态。如果不规定可以测什么，既难以让调节量连续变化，也难以发现增强一项表现时另外几项被带动了多少。[运动学定义][definitions] · [表 1][table1]

**本文目标：** 在已有动作生成器上加入轻重、突缓、收放与伸展程度的调节，同时尽量保留提示描述的动作。论文检验了各个运动学指标是否按预期改变，以及改变后是否仍和原提示相符。[评价方法][eval]

**切入角度：** 不给所有动作规定同一个绝对力度。一段慢走和一次起跳本来就有不同的能量曲线；以模型对当前文字生成的动作作为标尺，就能将“更有力”表达成“相对于这一次动作增强多少”。[第一遍采样、式 5][pass1]

**核心 idea：** 把四种描述落实为可微的逐帧特征。第二遍扩散时，每一步先估计最终动作，把它的特征与目标比较；误差沿生成模型传回文本条件，更新后的条件再指导去噪。[第二遍采样、式 6][pass2]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

系统的外部输入是动作描述和四个缩放系数。第一遍只看动作描述，保存基准动作和四条曲线。第二遍复用第一遍的初始噪声，每个 DDIM 步都从当前预测的干净动作计算误差，更新投影后的文本嵌入，然后算下一步。最终交付的是连续的三维人体动作。两遍之间传递的是与当前动作相配的**数值目标**。[原文图 2][fig2]

<figure class="reading-figure"><a href="/paper-notes/lamogen-effort-shape/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/lamogen-effort-shape/architecture.svg" alt="两遍 DDIM 共用初始噪声。第一遍得到参考动作和四条曲线，第二遍比较预测动作与缩放目标，沿误差更新文本嵌入，再生成下一步动作。" loading="lazy" /></a><figcaption>据原文图 2、式 4–6 重绘。先看目标曲线怎样由当前提示得到，再看第二遍中损失的梯度流向哪里。点击可放大。</figcaption></figure>

### 关键设计

1. **把拉班概念落实成四条可计算的曲线。** 对 T 帧动作，特征矩阵有 T 行、4 列。前三列在手、脚、头、躯干等选定部位上汇总，Shape 使用整副骨架。速度、加速度和 jerk（加速度的变化）用相邻帧差分近似。三个 Effort 指标与一个 Shape 指标的含义如下。[主文式 4][feature] · [附录公式][kinematics]

   | 控制量 | 每一帧测量什么 | 论文的低值 → 高值标签 |
   | --- | --- | --- |
   | Weight | 选定部位速度模长的平方和，质量权重取 1 | 轻 → 有力 |
   | Time | 选定部位加速度模长之和 | 持续、舒缓 → 突然 |
   | Flow | 选定部位 jerk 模长之和 | 受束缚 → 自由 |
   | Shape | 三维关节轴对齐包围盒的体积 | 收拢 → 舒展 |

   因而 Weight 无需力传感器，Time 也没有以秒为单位指定截止时刻。尤其要留意 Flow：jerk 衡量加速度变得有多快；一个人是否觉得动作流畅，是另一项需要感知评测的问题。[运动学定义][definitions] · [论文局限][limits]

2. **保留峰值出现的时间。** 全段只取一个峰值，优化信号会集中到极少的帧；改取整段平均，又可能掩盖起跳一刻。作者保留完整曲线，把同一个四维系数向量广播到每帧。这样增强 Weight 时，参考动作中的发力高峰仍然能给第二遍提供时间线索。连续差分会放大噪声，论文因此在差分前使用高斯平滑，核宽 11、方差 10。[逐帧特征][feature] · [图 5][smooth]

3. **缩放当前动作，其他列也参与约束。** 四维向量依次对应 Weight、Time、Flow、Shape。将参考特征逐列乘上系数便得到目标；系数为 1 的列保留参考曲线。附录表 4 的默认低／高倍率依次为 **0.5／1.5、0.8／1.2、0.8／1.2、0.5／1.5**，也可以直接指定数值。这些倍率来自作者的经验设定。[式 5][pass1] · [附录表 4][scale]

4. **保留生成先验，改变它每一步收到的条件。** 第二遍估计干净动作后，先求各帧各列的目标误差，再除以相应基准值加稳定常数，最后累加平方误差。作者让梯度更新投影后的文本向量，将其送回去噪器。对照方法则分别修改提示词、直接优化最后生成的动作，或在采样途中更新预测的干净动作。干预的位置不同，最终可能得到不同的控制精度和动作分布。[式 6][pass2] · [基线定义][baselines]

### 一个完整例子

以图 3 的跳跃为例。第一遍可能生成一段准备、离地、落地的动作。为说明尺寸，假设动作恰好 **4 秒**：按底座的 20 FPS，有 **80 × 263** 个动作特征值；提取后得到 **80 × 4** 的参考曲线。时长是教学设定，20 FPS 和每帧 263 维来自附录。[图 3][fig3] · [底座参数][backbone]

选择向量 **(1.5, 1, 1, 1)**。若某参考帧的 Weight 为 2 个示意单位，该帧的目标便是 3；若另一个参考帧只有 0.2，目标是 0.3。第二遍从同一噪声开始，用这 80 行目标引导文本嵌入。图 3 中，“有力”版本在准备和落地时摆臂更明显。这个条件既没有指定“只增大右臂的速度”，也没有指定跳高多少厘米；它允许生成器通过不同的身体配合接近目标。[式 5–6][pass2] · [图 3][fig3]

### 训练与推理

这里的零样本指**给已经训练好的 MotionDiffuse 加入这组控制时，无需新的风格标注或重新训练底座**。底座本身在 HumanML3D 上训练，使用 8 层 Transformer、8 个注意力头。论文采用 1,000 步 DDIM；引导遍每步执行 1 次 Adam 更新，学习率 0.005，在一张 NVIDIA A6000 上实验。原文未给出单条动作的用时。省去额外训练仍需付出第二遍采样和反向求导的代价。[实现设置][implementation] · [附录超参数][hyper]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 想改的属性变了，其他属性跟着变了多少？

HumanML3D 测试集，原表 1。每行从一种属性的低标签切换到高标签；每列是生成动作某个特征的平均相对变化。第一张表节选本文方法的四行，保留作者报告的均值与标准差。正数表示增大，负数表示减小。[原文表 1][table1]

| 用户调节 | 实际 Weight | 实际 Time | 实际 Flow | 实际 Shape |
| --- | ---: | ---: | ---: | ---: |
| 轻 → 有力 | **3.081 ± 2.033** | 0.323 ± 0.369 | 0.023 ± 0.046 | 0.163 ± 0.305 |
| 舒缓 → 突然 | 0.357 ± 0.730 | **0.418 ± 0.451** | 0.081 ± 0.101 | 0.098 ± 0.259 |
| 束缚 → 自由 | 0.065 ± 0.716 | 0.029 ± 0.371 | **0.379 ± 0.116** | −0.032 ± 0.214 |
| 收拢 → 舒展 | −0.044 ± 0.307 | −0.040 ± 0.153 | −0.012 ± 0.032 | **1.613 ± 0.470** |

第二张表摘出原表 1 的汇总指标 **Diagonality**：四个对角元素的平方和，除以整个 4 × 4 均值矩阵的平方和。当较大的变化落在目标列上，这个比值就会很高。因此读到 **0.978** 时仍要看单行：将动作调得更突然后，Time 上升 **0.418**，Weight 也上升 **0.357**。据此能判断两种特征在该干预下仍有耦合。[原文表 1][table1]

| 改动的位置 | Diagonality ↑ |
| --- | ---: |
| 改提示词 Prompt Editing | 0.445 |
| 改最后生成的动作 Raw Frame Update | 0.973 |
| 采样中改预测动作 Classifier Guidance | 0.802 |
| **采样中改文本嵌入 LaMoGen** | **0.978** |

### 选择性提高以后，生成质量怎样？

原表 2 的结果如下。R-Precision 衡量动作能否检索回正确文本，FID 衡量生成与真实动作的特征分布距离，Diversity 描述生成样本之间的差异。[原文表 2][table2]

| 方法 | R@1 ↑ | R@2 ↑ | R@3 ↑ | FID ↓ | Diversity ↑ |
| --- | ---: | ---: | ---: | ---: | ---: |
| 原始 MotionDiffuse | **0.470** | **0.662** | **0.767** | 2.21 | **9.32** |
| Prompt Editing | 0.445 | 0.630 | 0.737 | **1.67** | 8.72 |
| Raw Frame Update | 0.383 | 0.565 | 0.689 | 1.73 | 8.54 |
| Classifier Guidance | 0.432 | 0.629 | 0.720 | 1.70 | 8.59 |
| LaMoGen | 0.424 | 0.613 | 0.729 | 2.80 | 7.92 |

与直接改最后动作相比，LaMoGen 的三个检索分数均更高，FID 和 Diversity 则落后。两种方法也没有对齐优化预算：直接改动作是在生成结束后更新 100 次，本文方法是引导遍的每个采样步都更新一次。原表支持对最终表现作比较，无法据此判断在相同延迟下哪种干预更有效。[表 2][table2] · [附录超参数][hyper]

### 消融与失败例

| 作者改变了什么 | 实际观察 | 证据 |
| --- | --- | --- |
| 差分前开启或关闭高斯平滑 | 不平滑时，加速度和 jerk 曲线有明显的高频波动，Time 和 Flow 的计算会放大原动作中的噪声。 | [图 5][smooth] |
| 改变文本嵌入的更新步幅 | 学习率太小，动作几乎停留在基准版本；太大则可能产生不合理姿态。作者用较大学习率的失败样例展示后一种情况。 | [图 6][failure] |
| 在 0.5、0.8、1.0、1.2、1.5 之间改变目标倍率 | 图中展示了 Shape 与 Weight 的连续外观变化。四个指标中，作者在这里展示了两项。 | [图 4][interp] |

这些对照提供了信号曲线和生成示例。论文没有报告平滑开关的平均 FID 差值，也没有给学习率扫描的成功率。[消融部分][ablations]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **每段动作有自己的标尺。** 强化“落地的一瞬间”可以通过放大原曲线已有的峰来实现，不用先有人替每个跳跃标注发力帧。相应地，要把发力峰从落地移到起跳，仅调整整段共用的倍率就不够。[式 4–5][pass1]
- **先看干预矩阵，再看汇总分。** 同样是提升一个目标，Shape 一行的另外三项变化很小，而 Time 会明显带动 Weight。若关心具体控制指令能否分开生效，两行数据比一个总分更能回答问题。[表 1][table1]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **运动学代理与观感之间还隔着一项实验。** 更大的包围盒可以来自张开双臂，也可以来自拉开双腿；相同体积允许不同姿态。作者把基于用户研究的感知映射与感知解耦评测列为后续工作。[附录公式][kinematics] · [局限][limits]
- **可控粒度是整段动作的四种特征。** 系数在时间上广播，前三条曲线还汇总了多个身体部位。要验证局部事件、手指触碰或落脚点，需要动作输出上的独立检测与度量；本文的实验并未验证这些条件。[式 4–6][feature] · [表 1][table1]
- **更强的引导和更自然的生成存在取舍。** 学习率过大有姿态失败例，默认设置的 FID 也从底座的 2.21 升至 2.80。作者提出把控制蒸馏为单遍生成，实际速度和质量仍须实验验证。[图 6][failure] · [表 2][table2] · [局限][limits]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **同名的 CVPR 2026 LaMoGen。** 香港浸会大学 Jiang 等把文字转成带身体部位和时长的 LabanLite 事件，补齐细节后解码出三维动作。它可以在中间谱上查“哪只手在什么时候抬起”。首尔大学 Kim 等的接口则适合问“同一个抬手动作怎样做得更有力”；要检查改变了什么，可回看 Weight 和另外三条实测曲线。[CVPR 2026 站内解读][other] · [CVPR 论文项目][otherproject]
- **MotionDiffuse。** 它提供文字条件、去噪器与连续动作生成能力。Kim 等的贡献在两遍运行之间如何定义表现目标，以及第二遍怎样利用梯度。复用基础模型时，这两部分需要单独实现和核对。[底座代码][base] · [附录表 3][backbone]
- **LabanFormer。** 这篇方法从已有骨架转录出左右支撑步，评测舞步次序的编辑距离。同一次跳跃既可以问“哪条腿支撑”，也可以问“发力有多明显”；两种拉班表示给出的是不同层次的证据。[LabanFormer 解读](/blog/neurocomputing2023-labanformer/)

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 论文版本、作者及发表身份。[arXiv 记录][abs] · [作者实验室出版清单][lab]
- 方法、实验证据、默认倍率和实现设置均依据 arXiv v2 正文与附录。[HTML 全文][html] · [PDF][pdf]
- 与同名论文的比较依据独立作者组各自的公开材料。[CVPR 2026 项目][otherproject] · [CVPR 2026 站内解读][other]

</div>

[abs]: https://arxiv.org/abs/2509.24469
[html]: https://arxiv.org/html/2509.24469v2
[pdf]: https://arxiv.org/pdf/2509.24469v2
[lab]: https://icl.snu.ac.kr/publications
[base]: https://github.com/mingyuan-zhang/MotionDiffuse
[intro]: https://arxiv.org/html/2509.24469v2#Sx1
[fig2]: https://arxiv.org/html/2509.24469v2#Sx3.F2
[definitions]: https://arxiv.org/html/2509.24469v2#Sx3.SSx1.SSSx2
[feature]: https://arxiv.org/html/2509.24469v2#Sx3.SSx2
[pass1]: https://arxiv.org/html/2509.24469v2#Sx3.SSx3.SSSx1
[pass2]: https://arxiv.org/html/2509.24469v2#Sx3.SSx3.SSSx2
[fig3]: https://arxiv.org/html/2509.24469v2#Sx3.F3
[implementation]: https://arxiv.org/html/2509.24469v2#Sx4.SSx1
[eval]: https://arxiv.org/html/2509.24469v2#Sx4.SSx2
[baselines]: https://arxiv.org/html/2509.24469v2#Sx4.SSx2.SSSx2.Px1
[table1]: https://arxiv.org/html/2509.24469v2#Sx4.T1
[table2]: https://arxiv.org/html/2509.24469v2#Sx4.T2
[interp]: https://arxiv.org/html/2509.24469v2#Sx4.F4
[smooth]: https://arxiv.org/html/2509.24469v2#Sx4.F5
[failure]: https://arxiv.org/html/2509.24469v2#Sx4.F6
[ablations]: https://arxiv.org/html/2509.24469v2#Sx4.SSx3
[limits]: https://arxiv.org/html/2509.24469v2#Sx5
[backbone]: https://arxiv.org/html/2509.24469v2#A0.T3
[kinematics]: https://arxiv.org/html/2509.24469v2#A0.SSx1.SSSx2
[scale]: https://arxiv.org/html/2509.24469v2#A0.T4
[hyper]: https://arxiv.org/html/2509.24469v2#A0.SSx1.SSSx3
[other]: /blog/cvpr2026-lamogen/
[otherproject]: https://jjkislele.github.io/LaMoGen/
