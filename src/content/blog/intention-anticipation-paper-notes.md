---
title: "[3DV2021] Intention-Anticipation：从过去的骨架预判下一段动作，为姿态转换留出时间"
description: "Intention-based Long-Term Human Motion Anticipation。用弯腰到站立的例子读懂无监督姿态聚类、未来意图概率与提前十帧的姿态解码。对照 Human3.6M 四秒预测、人评和静止骨架反例，理解 NDMS 究竟测量什么。"
pubDate: "2026-11-25T02:22:00+08:00"
badge: "Paper"
tags: ["Human Motion Anticipation", "Motion Prediction", "Intention Forecasting", "Motion Planning", "NDMS", "Human3.6M", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[作者公开的原文 PDF][pdf] · [补充材料 PDF][supp] · [3DV 会议论文记录][doi] · [模型实现][code] · [NDMS 指标实现][ndms]

<details class="paper-meta"><summary>论文信息与阅读范围 · 3DV 2021</summary>

*Intention-based Long-Term Human Motion Anticipation*。作者 Julian Tanke、Chintan Zaveri（共同一作）、Juergen Gall，波恩大学。发表于 2021 International Conference on 3D Vision，页码 596–605。解读依据 10 页正文和 5 页补充材料。研究方向为单人三维骨架预测、随机生成与运动质量评估。文中的“意图”指作者从姿态序列中归纳的运动类别。数值均引自作者实验。[出版记录][doi] · [原文][pdf] · [补充材料][supp]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给定一个人过去的三维骨架，模型先预测未来每帧属于八类运动状态的概率。生成当前姿态时，它会提前看约 0.4 秒的**预测概率**。这样，在运动状态即将从弯腰转向站立时，身体已经可以开始准备过渡。整个过程只需历史骨架；供解码器预读的“计划”是一串概率。[图 1、2][f1] · [公式 6][method]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　骨架预测把一段观测动作接着往后生成。预测未来几百毫秒时，拿结果与真实后续逐帧比较有意义。把时间拉长到几秒，同一段交谈可以接出多种不同手势，随机模型因此会生成多个候选。[原文 §1–2][pdf]

**现有痛点**　一个模型可能每帧都生成常见姿态，连起来却在走路时突然停下，或者把不同活动都收敛成“站着摆手”。另一种模型能给很多差异很大的结局，却在观测结束、预测开始的第一步就出现停顿。[正文图 4][abl] · [补充图 5–7][sup2]

**核心矛盾**　离最后一帧越近，肩、腿的速度越受刚才动作的约束；几秒后的实际手脚位置则有许多可能。始终追同一个记录下来的未来，容易损失多样性。完全放任每一帧变化，又很难让身体为下一个动作作准备。[原文 §3.1–3.2][method]

**本文目标**　仅观察同一人的历史骨架，生成多条局部连续、活动内容合理的未来；同时设计一个能评价整批样本、能找出动作在哪个时刻变坏的指标。[原文 §1][pdf] · [§4][metric]

**切入角度**　“接下来要站起来”和“膝盖这一帧怎样伸展”需要不同的时间分辨率。作者从训练骨架里找反复出现的姿态变化，把较慢变化的类别交给一个小网络预测，让另一个网络具体画出关节。[图 3 与 §3][framework] · [补充图 1][supp]

**核心 idea**　先让类别预测跑在姿态预测前面几帧。当计划要切换时，当前姿态就可以响应；再用随机噪声让相同历史和类别走势产生不同的关节细节。[原文图 1][f1] · [公式 6][method]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练时，先给真实骨架逐帧分配类别编号。推理时，历史骨架送入两套独立的循环网络。一条产生未来帧的类别概率，另一条保存姿态历史。姿态解码器把历史、上一帧骨架和未来几个时刻的概率结合，每次输出一帧连续骨架。[原文图 3][framework] · [补充材料 §1–2][supp]

<figure class="reading-figure"><a href="/paper-notes/intention-anticipation/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/intention-anticipation/architecture.svg" alt="训练姿态先聚为十四类，再按聚类编号的频繁循环合并为八类。推理中历史骨架分支预测未来类别概率和编码过去姿态。时间卷积聚合连续十帧的概率，姿态解码器结合随机初始化和上一姿态，循环输出未来连续骨架。" /></a><figcaption>据正文图 3、公式 6 和补充材料 §1–2 重绘。上方虚线表示训练标签的监督；沿下方实线阅读推理过程，留意“提前十帧”读的是模型自己预测的类别。右下的回路把本帧姿态带到下一步。点击可放大。</figcaption></figure>

### 关键设计

1. **用频繁循环把几何相似的姿态变成较稳定的时间标签。** 作者先在训练集上对单帧姿态做 k-means，得到 14 个簇。比如行走时左右腿交替，编号可能在几个簇之间反复跳动。沿每条序列找出编号循环，依频率贪心合并，直至剩 8 类。这给每一帧产生训练标签，但无需人手标记某一帧在“想站起来”。“弯腰”和“站立”是读图时对动作的描述，模型收到的是编号。[原文 §3.3][method] · [补充材料图 1–2][supp]

2. **分别预测“哪类状态将发生”与“关节怎样抵达”。** 意图编码器读历史姿态，意图解码器用 GRU 自回归地产生各未来帧的八维概率。姿态解码器生成第 τ 帧时，取第 τ 至 τ＋9 帧的预测概率，得到一个 10 × 8 的窗口，再用时间卷积汇总。窗口内概率从一种类别逐渐转向另一种类别时，解码器可在前一种动作尚未结束时调整姿态。γ＝1 时仅能看当前时刻的概率；γ＝10 在 25 Hz 下覆盖约 0.4 秒。[原文公式 2–6][method] · [补充材料 §1][supp]

3. **把随机性放入连续动作生成。** 姿态编码器用单层、512 隐单元的 GRU。它将历史编码传给姿态解码器，三个解码层的初始状态都接入高斯噪声 z。第一步从最后的观测姿态出发，以后每步都读自己的上一帧输出。对同一历史替换 z 可以得到不同的身体延续；论文没有把每次采样解释成一份新的文字意图。[原文 §3.2][method] · [补充材料 §1][supp]

4. **逐个短窗检查运动的方向和速度。** 作者提出 NDMS（归一化方向运动相似度）。将预测切成重叠的八帧窗口，在同活动的真实测试序列中，用腕、肘、肩、髋、膝、踝等关节位置找相近片段。再逐关节比较速度方向和速率，方向相近且快慢接近时得分高。最前面的滑窗包含观测末尾七帧，因此能发现第一步突然停顿。活动名用于挑选评估参考库；生成网络的输入仍是历史骨架。[原文 §4、公式 9–12][metric] · [作者指标实现][ndms]

### 一个完整例子

以原文图 1 的弯腰与站立过渡为例。输入由红蓝色骨架表示，到最后一帧即截止。意图网络先推出未来一串类别分布。假设在将要预测的某一帧，窗口前部仍偏向当前类别，末尾几帧已更偏向起身时常见的类别。姿态网络此时既看到上一帧仍然弯着的身体，也收到这段即将切换的概率走势，于是可以从连续姿态中逐步作出过渡。这里的概率变化是对公式 6 的教学说明，图 1 实际展示的是预测骨架和类别颜色，没有提供这一例的八维数值。[原文图 1][f1] · [公式 6][method]

### 训练与推理

**训练。** 意图分支用逐帧交叉熵对齐聚类伪标签，用标签序列判别器学习合理的类别持续和切换。姿态分支用另一判别器评价生成片段，并用关节重建误差约束初期动作。后者的权重从 1 线性衰减，在预测到第 15 帧左右归零（约 0.6 秒）；后期仍有对抗训练信号。这里省去的是额外意图标注，训练仍使用有序的真实未来骨架。[原文 §3.1–3.3][method] · [正文图 5a][abl]

**推理。** 只输入已发生的骨架。不需未来真值、动作名、文本提示或训练时的两个判别器。意图网络先算够前瞻窗口，姿态网络再递推到所需时长。主实验对本文的每段输入取 50 条预测，在所有样本上统计 NDMS。[正文表 2–3][tab] · [补充材料 §1][supp]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**预测越长，局部运动还像真实动作吗？** 下表节选原表 2，在 Human3.6M 的 15 类活动上平均。各列表示相应未来时刻的 NDMS，越高越好。最后一列是仅在“行走”活动上取 4 秒时刻，保留它便于观察平均值背后的例外。[原表 2][tab]

| 方法 | 平均 0.4 秒 ↑ | 平均 2.0 秒 ↑ | 平均 4.0 秒 ↑ | 行走 4.0 秒 ↑ |
|---|---:|---:|---:|---:|
| Seq2Seq | 0.806 | 0.445 | 0.339 | 0.418 |
| Trajectory | 0.840 | 0.389 | 0.338 | 0.453 |
| History | **0.884** | 0.337 | 0.309 | **0.630** |
| Mix&Match | 0.770 | 0.444 | — | — |
| 本文 | 0.826 | **0.484** | **0.465** | 0.603 |

**人看四秒动作，也会认为它自然吗？** 原表 4 请 28 人对随机分配的片段回答“真实／不真实”。数值是判断为真实的比例。原表中的 Mix&Match 使用 3.2 秒片段，下表仅摘录相同四秒条件的行。[原表 4 与表注][tab]

| 方法 | 行走 ↑ | 吃东西 ↑ | 抽烟 ↑ | 讨论 ↑ |
|---|---:|---:|---:|---:|
| Trajectory | 0.903 | 0.625 | 0.114 | 0.227 |
| History | 0.902 | 0.221 | 0.356 | 0.279 |
| DLow | 0.190 | 0.578 | 0.449 | 0.428 |
| 本文 | **0.938** | **0.792** | **0.633** | **0.714** |

**很多候选都彼此不同，是否就生成了好动作？** 补充表 2 使用 DLow 的骨架与两秒评估协议。APD 衡量样本两两距离，ADE/FDE 分别衡量最优候选的平均／末帧误差；NDMS 仍评价整批样本。作者专门让 50 个候选各自从头到尾静止，其中 48 个姿态直接取训练集簇中心，其余为观测末帧及观测平均姿态。[补充表 2、§3.3][sup3]

| 方法 | APD ↑ | ADE ↓ | FDE ↓ | NDMS ↑ |
|---|---:|---:|---:|---:|
| DLow | 11.741 | 0.425 | 0.518 | 0.311 |
| 本文 | 3.477 | **0.413** | 0.631 | **0.366** |
| 50 个静止候选 | **16.418** | 0.429 | **0.451** | 0.166 |

### 消融实验

- **移除意图分支。** 步行与进食的长期 NDMS 下降，预测逐渐变成训练数据中常见的站立加手势。讨论本身接近这种模式，因此该活动受影响较小。原文图 4 报告曲线。[正文 §5.2][explain] · [图 4][abl]
- **分别移除损失。** 去掉姿态对抗损失，同一输入的不同采样失去变化；去掉标签对抗损失，类别有时持续过久；去掉姿态重建损失，作者观察到不自然的骨架和运动，最后一项没有绘入曲线。[正文 §5.2][explain]
- **调整前瞻与重建时长。** 前瞻看 1、5、10、20 帧，太短难以准备转换，20 帧也低于选定的 10 帧。重建权重在 15 帧、30 帧归零或全程恒定的对照中，作者采用 15 帧，以兼顾开头连续性和长期质量。[正文图 5a、5c][abl]
- **取消聚类编号的循环合并。** 直接把 k-means 的逐帧簇号作为标签会频繁切换，解码器随之反复追逐变化。合并循环后标签与预测均更稳定。[正文图 5b][abl] · [补充图 1–2][supp]

### 关键发现

1. 在 4 秒处，本文的平均 NDMS 是 0.465，History 是 0.309；单看行走却是 History 的 0.630 高于本文的 0.603。解释高层预判的价值时，应保留运动类型这个条件。[原表 2][tab]
2. 静止候选拿到了三行里最高的 APD 和最低的 FDE。因为 FDE 可以挑中碰巧最接近终点的一帧，APD 也可以靠静止姿态之间差异来提高。NDMS 给这组候选 0.166，正好揭示“终点碰对”和“整段在合理地动”之间的距离。[补充表 2][sup3]
3. 作者实测了中间表示的可预测性。八类标签在未来 100 帧的逐帧准确率平均为 0.528，行走为 1.000，拍照为 0.157。这里对照的是自动生成的标签，与推断一个人的心理目标是两个评估问题。[补充表 1][sup2]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

**前瞻可以通过错开两个预测器的时钟完成。** 网络不必看到未来真实骨架，也能提前准备转身或起身。关键在于让较粗的状态预测先向前跑，再把一小段即将切换的分布交给生成当前帧的网络。γ＝1 的消融直接检验了这段提前量的价值。[原文公式 6][method] · [图 5c][abl]

**连接处值得单独评价。** 两段姿态首尾位置可以非常接近，脚却可能在连接处突然停一拍。让最初几个评估窗口横跨观测与预测的边界，就能看到这种速度异常。作者人评与 NDMS 的 Pearson 相关为 0.901，NPSS 为 −0.238；这一观察来自本论文所选方法和用户研究。[补充图 5–7][sup2] · [正文 §5.1][explain]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **八类意图能解释到什么程度？** 标签依据训练姿态的相似性与循环频率建立。原文可用颜色指认运动模式，尚缺带独立人工意图标注的测试，也未提供用户直接指定“拿哪件物体、何时接触”的接口。[补充表 1][sup2] · [原文 §3][framework]
- **长期有多长？** 主要同方法比较到 4 秒。原文图 6 将本文延长到 30 秒，报告自己的 NDMS 随时间变化。这不能替代 30 秒的基线对比、事件完成率或逐序列人的判断。[正文 §5.3、图 6][abl]
- **局部片段可以合理，整条动作仍需另查。** NDMS 对多个短窗分别找近邻，参考片段可以来自不同真实序列。它适合追查何时出现速度或方向异常；同一个人是否持续追随同一目标、手是否碰到指定物体，需要额外的任务标注与评估。[原文 §4][metric]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **DLow。** 两者都给一个观察前缀生成多个未来。DLow 学习怎样从潜空间采出多样结果；本文在姿态解码前插入了未来类别预测。补充表 2 允许同时看 DLow 的样本多样性、末帧误差及本文相对更高的局部动力学相似度。[原文 §2][framework] · [补充表 2][sup3]
- **ActionPlan。** 两篇都把中间计划放在连续运动之前。这篇从本人过去的骨架归纳八类概率，逐帧监督源于姿态聚类；ActionPlan 从文本生成时间对齐的连续语义计划，并可利用 BABEL 的帧级动作描述。比较两者时，先问计划的监督源和谁有权改变计划。[站内 ActionPlan 解读](/blog/eccv2026-actionplan/) · [本文 §3][framework]
- **Think-Then-React。** 它要生成 B 对 A 的反应，给中间推理加入文字语义；本文要续写 A 自己的骨架，中间结果是八个类别的预测概率。两者都适合研究“先推断，再生成”，但任务输入和输出对应的人不同。[站内 Think-Then-React 解读](/blog/iclr2025-think-then-react/) · [本文图 3][framework]
- **启发。** 研究“先计划再做动作”时，可以同时测三件事：中间状态能否准确预测、取消提前量后过渡怎样变化、最终动作在交接处有没有断速。本文分别用补充表 1、图 5c 和 NDMS 回答了这三个问题。[补充表 1][sup2] · [图 5][abl] · [指标实现][ndms]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 3DV 2021 正文，以作者实验室的十页公开版本核对架构、原表 2–4 及图 4–6。[会议记录][doi] · [原文 PDF][pdf]
- 作者补充材料，含模型规格、伪标签评估、静止对照与短期预测。[补充 PDF][supp]
- 合著者 Chintan Zaveri 的模型仓库，以及 Julian Tanke 维护的 NDMS 指标实现。本解读未运行模型或重新进行人评。[模型代码][code] · [指标代码][ndms]

</div>

[pdf]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21.pdf
[doi]: https://doi.org/10.1109/3DV53792.2021.00069
[supp]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21_supp.pdf
[code]: https://github.com/zaverichintan/Intention-based-Long-Term-Human-Motion-Anticipation
[ndms]: https://github.com/jutanke/ndms
[f1]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21.pdf#page=2
[framework]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21.pdf#page=3
[method]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21.pdf#page=4
[metric]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21.pdf#page=5
[tab]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21.pdf#page=6
[explain]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21.pdf#page=7
[abl]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21.pdf#page=8
[sup2]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21_supp.pdf#page=2
[sup3]: https://pages.iai.uni-bonn.de/gall_juergen/download/jgall_forecastintention_3dv21_supp.pdf#page=3
