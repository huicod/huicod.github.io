---
title: "[PacificGraphics2023] DASKEL：在拉班舞谱和全身骨架之间双向转换"
description: "用恰恰的三步走通 DASKEL。看懂一条按拍书写的方向指令怎样变成 31 关节骨架，也看懂为何同一段动作可能对应几种合理的舞谱。"
pubDate: "2026-11-20"
badge: "Paper"
tags: ["DASKEL", "Labanotation", "Dance", "Choreography", "Motion Capture", "Inverse Kinematics", "BVH", "Pacific Graphics", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 全文][html] · [出版方 PDF][pdf] · [会议记录][record] · [相关解读：LabanLab][labanlab]

<details class="paper-meta"><summary>论文信息与阅读范围 · Pacific Graphics 2023 短文</summary>

Siyuan Luo、Borou Yu、Zeyu Wang，收录于 *Pacific Graphics Short Papers and Posters*，第 39–46 页。PDF 首页题名为 *DASKEL: An Interactive Choreographic System with Labanotation-Skeleton Translation*。出版方索引把 Choreographic 写作 Choreographical，两个拼写对应同一个 DOI。本篇依据八页原文，作者实验室提供 PDF，本次未核实到 DASKEL 的公开源码或可操作演示，未运行系统。[出版记录][record] · [作者实验室论文][labpdf]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

DASKEL 做了两件相反的事。编舞者写下某一拍哪只脚朝哪个方向走，系统通过运动学求解和插帧把它演成连续骨架动画。给系统一段骨架动画和节拍，它也能比较拍与拍之间的姿态，选出最可能主导动作的身体部位，把舞步写回谱面。[原文图 2–4][p3]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 拉班舞谱用符号的形状、所在谱栏和时间跨度记录舞者做什么。动画常用的 BVH 文件保存骨架层级、根节点位移和关节旋转。一位编舞者写下的“向左前迈步”，在动画文件里会成为很多帧不同关节的数值。[第 1、3 节][p1]

**现有痛点：** 会读谱的人能在脑中想象舞步，学习者往往需要实际看一遍。已有机器人手势工具能够处理上身，轮到脚下换重心、上下身联动时，仅按单个符号旋转一段骨骼很容易得到别扭的姿势。[第 2 节][p2] · [图 7][p6]

**核心矛盾：** 舞谱给的是身体部位、相对方向和节拍。同一个方向有许多连续轨迹能达到；相反，一段手和肘同时移动的轨迹也可能有几种合理记法。两端保留的信息不同，因此“能来回转换”和“能还原唯一原谱”是两种要求。[第 4.3–4.4 节][p5] · [第 6 节][p7]

**本文目标：** 支持全身基本舞步的双向转换。写谱时可查看相应关键姿态，已有动捕时可生成符号、再做编辑。作者用基本符号、步行和恰恰片段检查这两条路径。[第 3 节][p3] · [第 5 节][p6]

**切入角度：** 把每个动作拆成“哪个部位、到哪个相对位置、用多长时间”。先处理与指定节拍相对应的姿态，便能把一项连续运动的问题拆为按拍求解和拍间补全。[第 4.1–4.3 节][p4]

**核心 idea：** 在两个方向采用各自适合的规则。正向把符号当作姿态目标，在骨架上求一个可行解；反向从相邻姿态的关节位移挑主导部位，再映射回离散符号。[图 3–4][p3] · [图 8][p6]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

正向模块 **Laban2Skel** 接收舞谱、节拍和参考骨架，先生成每拍的关键姿态，再插出连续动画。反向模块 **Skel2Laban** 接收 BVH 动作和已知节拍，比较相邻关键姿态，推断哪一个部位应当写进哪一栏。两个方向共享编号规则。用户可以编辑编号谱，由 Laban Renderer 将它画回图形舞谱。[原文图 2–4][p3] · [编号与渲染][p4]

<figure class="reading-figure"><a href="/paper-notes/daskel/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/daskel/architecture.svg" alt="舞谱经部位映射、运动学求解和四元数插帧生成骨架动画。反向按给定节拍取相邻姿态，从关节位移和方向确定主导部位，输出数字舞谱。" loading="lazy" /></a><figcaption>根据原文图 2–4、算法 1 和第 4.4 节重绘。正向求解关节位置，反向推断谱面所指的主体。点击可放大。</figcaption></figure>

### 关键设计

1. **让一个符号有明确的空间和时间含义。** 系统支持 13 个记谱部位，分成 7 个上身部位与 6 个下身部位。相对位移有 27 种，对应高、中、低三层中的 3 × 3 方格。相对旋转有 16 种，顺、逆时针各 8 档，以八分之一圈为一级。部位、编号、持续时间合起来才是一项动作。对“占一拍”，作者采用 *performing time* 的理解，即在这段时间内移动，到结束时达到目标。[图 5–6][p4] · [第 4.3 节][p5]

2. **从谱栏找到骨架，再解支撑姿态。** BVH 有 31 个关节，比谱上能写的部位更细。参考姿态取上身 T 形、下身 A 形，上下身在躯干部相连。正向运动学（FK）先计算各关节的位置；系统结合上一拍的下肢和重心关系设置这一拍的目标，再用 FABRIK 逆运动学求解。在目标可达、旋转角也合理时，采用得到的关节姿态。[第 4.2 节][p4] · [算法 1][p5]

3. **目标不可达或有多解时，把骨长和关节弯曲纳入修正。** 作者采用基于位置的动力学（PBD），用牛顿迭代修正关节位置，约束依据包括初始骨架的相邻关节距离和关节弯曲关系。文中给出的最大迭代数是 1,000。各拍关键姿态确定后，用四元数插值补关节旋转、连接相邻动作。这个过程给出了重心转移时的可见姿态，文中未测量地面反力，也未给出足部接触误差。[第 4.3 节、式 1–2][p5] · [实现细节][p6]

4. **反向先选“谁在动”，再选“怎么记”。** 按给定节拍取相邻两个关键帧，计算各关节在欧氏空间中的位移向量。幅度大的关节是候选，但手腕和手肘常会一起移动。作者优先考虑远端关节，再比较它与近端关节的位移方向。文中的观察是：远端主导时，两向量夹角常小于 45°；近端主导时常大于 45°。系统依据这种关系分组选择主导关节，最后写出其相对动作。45° 是经验判据，无法由这一夹角独立读出舞者的意图。[图 4][p3] · [第 4.4 节、图 8][p6]

### 一个完整例子

图 7 的短恰恰片段有三个动作。**先左脚向左前小迈一步，再右脚向右后退一步，最后左脚移动到右脚的左后方。** 第三步特别能说明为什么要保留前一拍：同样是“左后”，目标是相对于当时右脚的位置，右脚已经在第二步换了地方。[图 7][p6]

<figure class="reading-figure"><a href="/paper-notes/daskel/fulltext/assets/figure-7.png" target="_blank" rel="noopener"><img src="/paper-notes/daskel/fulltext/assets/figure-7.png" alt="图 7 中的三个恰恰关键姿态及其舞谱符号，最后一个姿态的左脚移到右脚的左后方。" loading="lazy" /></a><figcaption>原文图 7。依次观察两脚相对位置，再看身体为换重心而做的配合。© 2023 Luo、Yu、Wang，CC BY 4.0。</figcaption></figure>

从谱面读到第三步时，系统先确定左脚这一部位及其时间区间，以前一姿态的下肢位置确定新目标，求出与腿长、关节角相容的关键姿态，再补齐这两拍之间的旋转。图 7 可见重心转移时手臂也向后移动。若要把这段动画重新记谱，反向模块需要知道切拍位置；它比较各拍的运动部位，输出一种可行写法。论文在图 8 单独示范把**行走**的相邻两帧转成左脚基本步，未逐个公布图 7 这段恰恰的反译符号。[图 7–8][p6] · [第 6 节][p7]

### 运行时需要什么

正向执行需要参考骨架给出初始关节关系和骨长，也需要当前舞谱与节拍。反向执行需要 BVH 序列和用于切分的拍点。两条路径都由规则及数值运算实现；作者把学习拍间过渡列为后续方向。因而更换舞者后，首先要核对骨架部位映射和节拍来源。[第 4 节][p4] · [结论][p7]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 原文实际检验了什么？

论文用图 7–10 展示生成姿态、反向转录和与既有工具的比较。下表按原文展示范围整理；43、12 和 1,000 分别是符号数、展示组合数和求解上限，不能拿来当成功率。[第 4.4–5.2 节][p6] · [原始实验图][p7]

| 检验 | 输入与对照 | 论文给出的结果 |
| --- | --- | --- |
| 单符号的正向生成 | 符号库 27 种相对位移、16 种旋转。图 9 展示右上、左下、向前、逆时针 45° 四组指令，各放在三个部位上，共 12 个示例 | 可查看右脚、右膝和右上肢的关键姿态。第三个部位在图内标为右手、图注写作右肩，此处按右上肢归纳。 |
| 与 Microsoft LabanSuite 比较 | 对比两套系统可共同处理的上身符号，并尝试下肢输入 | 作者报告上身的视觉结果接近；DASKEL 还能生成腿部姿态。图 9 未报告平均关节误差。 |
| 反向与扰动测试 | 把正向生成的骨架送回反向模块，并加入不改变整体姿态的小幅关节扰动 | 作者报告仍可转录，并在图 8 展示左脚基本步。未给噪声尺度、正确数、准确率或人工标谱一致性。 |
| 较长动作 | 图 10 左为向前走两步，右为两小节基本恰恰 | 谱面与若干关键姿态并排，可查看下肢随节拍的变化。图中未测触地时刻、步长误差或舞者偏好。 |

### 消融与运行表现

| 改了什么 | 文中观察 | 可作出的判断 |
| --- | --- | --- |
| 平滑插值与四元数插值 | 作者定性认为四元数插值连接关节时较自然，因此用于拍间过渡；结论仍指出两种方法都难以完整表现人体过渡动作。 | 原文未给定量对照或用户评分。 |
| 引入轻微关节扰动 | 第 5.1 节描述了反向测试仍可用。 | 测的是自生成动作在轻微扰动下的表现，未给不同噪声强度的曲线。 |
| 姿态修正的迭代上限设为 1,000 | 作者称实验中关键帧生成可实时完成。 | 1,000 是允许的最大次数，未报告单帧实际迭代数、毫秒数或帧率。 |

FABRIK 与 PBD 在算法中各有职责，但论文没有逐项关闭 PBD、骨长约束、弯曲约束或关节优先级并重跑的消融表。因此从这些结果可以判断系统处理过哪些动作，还无法给某个模块分配单独的性能增益。[算法 1][p5] · [实验与局限][p7]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **谱面越简明，执行端需要决定的细节越多。** 一个“移到右脚左后”的符号之所以能跨舞者使用，正因为它不用写死世界坐标。代价是骨架端要根据当时两脚位置、骨长和关节弯曲算出落点与姿态。图 7 把这种信息分工展示得很清楚。[算法 1][p5] · [图 7][p6]
- **反向转换揭示了哪些信息可观察。** 摄像或动捕可以测得手、肘如何位移，却很难凭一小段相似轨迹判断舞者原意是“伸臂”还是“将手移向胸前”。用关节优先级可以生成可编辑的候选谱；独立舞者能否同意该记法，需要另行标注和检验。[第 4.4 节][p6]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **节拍来源决定反向路径的适用条件。** 第 3 节概述提到用能量峰找节拍，但第 4.4 节和结论明确以输入的拉班节拍抽取关键帧，并把能量函数自动选帧列为替代方案。本文实证应按“已知节拍下的骨架转录”理解。[图 4][p3] · [第 6 节][p7]
- **全身覆盖有明确的词表边界。** 13 部位和 43 种基础位移／旋转可表示不少步型，更复杂的多部位关联、力度和表演风格仍有大量自由度。作者也指出上下身耦合、拍间过渡和同一舞步的不同演绎需要进一步处理。[图 5–6][p4] · [第 6 节][p7]
- **误差要在对应的层面测量。** 正向若关注脚是否滑移，要量脚与地面的相对运动；反向若关注转录质量，要有真实动捕与独立舞谱可比。本文两条路径共享自生成的测试动作，这让基本回环容易核查，也限制了对真实舞者泛化的判断。[第 5 节][p6] · [第 5.1–6 节][p7]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **LabanSuite 是文中的直接对照。** 微软工具面向机器人上身手势，可从观测中提取动作并编辑拉班记谱。DASKEL 增加下肢、支撑与重心转移；如果问题是“脚迈过去时骨架怎样配合”，应重点看 DASKEL 的图 7 和图 9。[微软工具说明][ms] · [DASKEL 对比][p7]
- **LabanLab 把相同的谱输入接到生成模型。** 两篇有两位共同作者。DASKEL 用编号直接构造关节目标，可以追到每拍的求解过程；LabanLab 把谱转换成含部位和时间的文字条件，再生成动作预览。读两篇时，可以对准同一个“右脚前迈”，分别追到关节目标和文本条件，比较哪一步还能检查谱面要求。[LabanLab 解读][labanlab] · [LabanLab 原文][llpdf]
- **LabanFormer 给出另一种反向路径。** 它从骨架序列预测记谱，专门评估下肢支撑步。DASKEL 在给定拍点后依靠运动幅度和相邻关节方向选主导部位。研究问题若是“动作能否自动记谱”，两者的输入条件、符号范围和评价方式都要一同考虑。[LabanFormer 解读][former] · [DASKEL 图 8][p6]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 正式出版记录及 DOI 10.2312/pg.20231269。[Eurographics Digital Library][record] · [Pacific Graphics 会议日程][program]
- 算法、实验和局限采用同一版八页论文。网页版由出版方 PDF 转制，保留原页码和图表入口。[HTML 全文][html] · [出版方 PDF][pdf] · [作者实验室 PDF][labpdf]

</div>

[html]: /paper-notes/daskel/fulltext/
[pdf]: https://diglib.eg.org/server/api/core/bitstreams/d92889d4-ecbc-450d-bad2-7ba24d438b67/content
[record]: https://diglib.eg.org/items/62a04a2c-7c74-4393-977c-7d5bb0358245
[program]: https://pg2023.org/program
[labpdf]: https://cislab.hkust-gz.edu.cn/media/documents/PG2023_DASKEL.pdf
[p1]: /paper-notes/daskel/fulltext/#page-1
[p2]: /paper-notes/daskel/fulltext/#page-2
[p3]: /paper-notes/daskel/fulltext/#page-3
[p4]: /paper-notes/daskel/fulltext/#page-4
[p5]: /paper-notes/daskel/fulltext/#page-5
[p6]: /paper-notes/daskel/fulltext/#page-6
[p7]: /paper-notes/daskel/fulltext/#page-7
[labanlab]: /blog/eurographics2025-labanlab/
[llpdf]: https://diglib.eg.org/bitstream/handle/10.2312/egs20251046/egs20251046.pdf
[former]: /blog/neurocomputing2023-labanformer/
[ms]: https://github.com/microsoft/AppliedRoboticsResearchLibrary
