---
title: "[ACMMM2026] ARFlow：从一个人的动作生成另一个人的反应"
description: "ARFlow: Real-time Human Action-Reaction Synthesis with Reprojection Guidance。以双人握手为例，解释动作到反应的流匹配、重投影如何校正采样方向，以及互穿减少后为何仍可能握空。"
pubDate: "2026-11-27T16:29:00+08:00"
badge: "Paper"
tags: ["ARFlow", "ACM MM 2026", "双人交互", "动作反应生成", "Flow Matching", "实时生成", "穿模", "重投影引导", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[作者公开版 HTML（含附录，可翻译）][html] · [对应版本 PDF][pdf] · [ACM 正式版][acm] · [作者视频对照][project]

<details class="paper-meta"><summary>论文信息与版本 · ACM Multimedia 2026</summary>

正式题名为 *ARFlow: Real-time Human Action-Reaction Synthesis with Reprojection Guidance*。作者为 Wentao Jiang、Jingya Wang、Kaiyang Ji、Baoxiong Jia、Siyuan Huang、Ye Shi。发表于第 34 届 ACM International Conference on Multimedia，页码 3853–3862，DOI 为 10.1145/3767308.3835005。[ACM 正式记录][acm] · [ACM 登记元数据][metadata] · [会议日程（mfp0639）][program]

作者项目链接到 arXiv:2503.16973v3，题为 *ARFlow: Human Action-Reaction Flow Matching with Physical Guidance*。会议摘要确认了双向生成、起点偏移和重投影方法。下文公式、主实验、消融和失败案例取自 v3，反向生成实验另标稿源。ACM 排版终稿未能逐表核对。作者的公开仓库目前提供说明与示意图，未见可运行的训练、推理代码或模型权重。本文未独立运行模型。[作者主页][author] · [作者项目][project] · [仓库快照][repo]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

给定甲的动作，ARFlow 直接把这段动作作为流匹配的起点，生成与它相配的乙的反应。每次采样，模型先猜乙的完整姿势，检查它是否穿进甲的身体，修正姿势，再参照甲的原始动作决定下一步往哪走。[原图 2][fig2] · [重投影算法][alg]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**　双人动作生成可以给一句话，同时生成两个人。本文关心另一个常见场景：一位真人已经在动，系统只负责另一位角色。已有扩散模型会从噪声生成响应者，把发起者的动作作为额外条件输入。[§2.2][related]

**现有痛点**　握手时，两个人各自抬臂都可以显得自然，合在一起却可能一只手穿进另一只手。如果只把预测的姿态往外推，手在几何上分开了，却又可能偏离原本合适的回应。[原文图 3][fig3] · [失败案例][failure]

**核心矛盾**　生成器需要维持“这个回应适合眼前这位发起者”，采样时又需要为了两具身体的空间关系改变姿态。改变得太少，穿模仍在；改变以后从错误的位置继续采样，动作质量也会下降。[§3.2][guide] · [表 1][t1]

**本文目标**　输入甲的三维动作序列，输出乙的连续三维反应。主要在线实验中，乙在每一帧只能使用截至当下已见的动作，也得不到甲的意图标签。离线实验另外允许模型看完整段甲的动作。[§4.1][setup] · [附录 E][network]

**切入角度**　真实交互数据已经把甲与乙按动作发生的时间配成对。作者据此选择一条两端都有身体含义的生成路径：起点是甲的动作，目标是乙的反应。这样，每次校正后都有一个已知且固定的起点可供参照。[式 4][eq4] · [式 14][eq14]

**核心 idea**　模型直接预测乙的干净姿态，以便在可还原为关节位置的动作上计算穿模梯度。更新当前预测后，重新连接“校正过的起点”和“修正过的反应”，再沿这条线取下一步。这是 RE-GUID 名称中“重投影”的含义。[图 3][fig3] · [算法 2][alg]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

训练时取同一段双人交互，记甲的动作片段为 <i>x</i><sub>0</sub>、乙同期的反应为 <i>x</i><sub>1</sub>。在两段动作表示之间插值，让网络从中间状态恢复乙的动作。推理时只有甲这一端已知。网络逐步估计另一端，几何引导在每次迭代中借助甲的身体表面修正乙的姿态。最后交付乙的三维动作序列。[作者架构图][fig2] · [算法 2][alg]

<figure class="reading-figure"><a href="/paper-notes/arflow/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/arflow/architecture.svg" alt="ARFlow 训练和推理架构。训练用配对的动作和反应构造插值状态，预测响应者的干净姿态。推理从发起者动作出发，在每一步用身体距离修正预测，并用已知发起者动作校正重投影方向。" /></a><figcaption>依据作者公开版图 2、图 3 和算法 2 重绘，可点击放大。</figcaption></figure>

读图时要区分两种“时间”。**动作时间**是甲先伸手、乙随后回应的帧顺序，在线模型不能偷看甲下一帧。**流时间**是模型对同一片段从起点到反应反复修正的进度；五步采样指五个求解步，并不表示角色要等五帧才移动。“插值”也发生在两段动作的数值表示上，中间状态无需作为动画播放。[附录 E][network] · [采样步数对照][t4]

### 关键设计

1. **把甲的动作作为生成起点。** 省略原式中的小残差项，训练插值可以读作“中间状态 ≈ (1−t) × 甲动作 ＋ t × 乙反应”。每个动作片段按帧组织，身体姿态采用 6D 旋转表示。经过线性层和时间位置编码，中间状态进入 Transformer；流时间与可选的类别条件被编码为条件 token。即使不给“握手”这个标签，甲的动作仍然保留在输入中。[式 4–5][train] · [网络结构][network]

2. **每一步直接预测完整反应。** 网络预测干净的乙动作，再由它和当前状态算出流速度，用 Euler 法更新。训练除了拟合真实乙动作，还把预测还原成关节位置，比较甲乙之间的相对姿态、朝向和位移。这样，手臂角度看似合理、但乙整体站错位置的样本也会产生误差。[式 5–9][train]

3. **先改可能穿模的姿态，再改下一步的方向。** 给甲逐帧建立有符号距离场，用乙预测关节的位置查询它与甲身体表面的距离。足够远时不再施加梯度；太近时，在预测出的干净姿态上沿减小惩罚的方向调整，无需对生成网络反向传播。随后，算法由当前状态和流方向倒推出一个起点。由于这个估计可能已偏离真实输入，作者按默认权重将 **70% 的估计起点与 30% 的真实起点**混合，再与修正后的终点插值。一次只改终点的普通引导缺少这一步。[式 10–14][guide] · [算法 2][alg] · [默认权重][impl]

4. **把可见信息和多样性分开控制。** 在线生成用因果注意力限制每个动作时刻可见的发起者帧；离线对照可以读取整段输入。响应不只有一种，作者另允许把随机方向以系数 β 混入采样方向，为同一来源产生变化。随机性过强时动作分布也会变差。会议摘要还报告这套建模支持从反应反推可能的发起动作；下文主表衡量的是正向生成。[附录 E][network] · [随机性对照][random] · [会议摘要][program]

### 一个完整例子

以作者补充材料专门讨论过的**双人握手**为例。下列步骤解释信号如何流动，其中的中间姿态是教学示意；作者实际指出，握手是仍会失败的情况。[附录 I 与图 I.2][failure]

| 到了哪一步 | 此时系统知道什么 | 怎样形成乙的反应 |
|---|---|---|
| 甲抬手 | 在线模式能看到甲截至当前的动作；无意图标签设置中没人告诉模型“这是握手”。 | 甲的运动给出起点。网络根据训练中过去的动作配对，估计乙可能怎样迎上去。 |
| 第一次检查姿态 | 甲该时刻的身体位置已知，乙的肩、肘、腕等姿态已有预测。 | 若乙的预测关节落入甲身体内或过于接近，距离场产生梯度，调整乙的预测姿势。 |
| 继续采样 | 新的乙姿势改善了几何关系，但由当前流方向倒推的起点可能已偏。 | 将估计起点拉向甲的真实动作，用这一起点与修正后的乙动作确定下一步。 |
| 输出动作 | 得到乙逐帧的三维骨骼姿态，可与甲一起重建、渲染。 | 两只手相隔几厘米也可能没有互穿；确认握手成功还需要检查手掌有没有在应接触的时间相遇。 |

### 训练与推理

作者公开版使用 8 层、宽度 512 的 Transformer。在线采用带因果遮罩的解码器，离线对照改用 8 层编码器。训练每个模型 50 万步，采用单张 NVIDIA RTX 4090，作者报告在 48 小时内完成；这里的时间按单个模型计。默认推理用五步采样，几何引导发生在推理阶段，无需为这项修正额外训练网络。[§4.2][compare] · [附录 E–F][impl]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

主要设置是**在线，且不给发起者意图标签**。NTU120-AS、Chi3D-AS、InterHuman-AS 分别含 8,118、373、6,022 条交互序列。AS 版本区分发起者与响应者。前两个数据集用预训练动作识别网络提取特征，每轮生成 1,000 个反应，以 20 个随机种子重复评测，原表给出 95% 置信区间。基线比较数字沿用 ReGenNet 的对应表格。下表保留 FID 的区间，后两列列均值。[实验协议][setup] · [对照来源][compare] · [指标定义][metrics]

| 数据集 | 方法 | 动作 FID ↓ | 动作类别准确率 ↑ | 类内多样性，越接近真实越好 |
|---|---|---:|---:|---:|
| NTU120-AS | 真实数据 | 0.09 ± 0.00 | 0.867 | 25.03 |
| NTU120-AS | ReGenNet | 11.00 ± 0.74 | **0.749** | 22.90 |
| NTU120-AS | ARFlow | **7.89 ± 0.18** | 0.743 | **24.11** |
| Chi3D-AS | 真实数据 | 0.75 ± 0.18 | 0.691 | 12.94 |
| Chi3D-AS | ReGenNet | 13.76 ± 4.78 | **0.601** | 12.02 |
| Chi3D-AS | ARFlow | **10.92 ± 3.70** | 0.600 | **12.74** |

粗体只比较表中两种生成方法。NTU120-AS 的 FID 改善清楚，分类准确率则略低于 ReGenNet。Chi3D-AS 样本较少，两种方法的 FID 区间重叠。第三个数据集 InterHuman-AS 使用其相应评测协议，附表 B.1 中 ReGenNet 与 ARFlow 的 FID 分别为 2.265 和 1.637，不宜把这个绝对值与前两组横比。[表 2][t2] · [表 3][t3] · [表 B.1][inter]

**反过来给乙的反应，能推测甲做了什么吗？** 会议摘要把这称为双向生成。作者另一个公开投稿版本单独做了“反应 → 发起动作”实验：在 NTU120-AS 上，ReGenNet 与 ARFlow 的 FID 分别为 36.12 和 12.81。这个结果来自该稿的表 4，与上面 v3 的正向表分开阅读。用结果分布判断，可以说明模型能合成与乙相配的甲动作；仅凭乙伸手，仍无法唯一还原甲当时做的动作。[会议摘要][program] · [另版反向生成实验，表 4][reverse]

### 消融实验

**重投影到底贡献了什么？** 公开版表 1 在 NTU120-AS 上给出了三种采样方式。IF 是出现互穿的帧数占总帧数的比例，IV 是逐帧将两具人体网格体素化后，计算共同占据的平均体积。它们分别回答“发生得多频繁”和“重叠有多深”。论文为互穿指标另生成 260 个样本。[表 1][t1] · [式 18–19][ifmetric] · [附录 G][metrics]

| 设置 | 采样方式 | 反应 FID ↓ | 互穿帧比例 IF ↓ | 平均互穿体积 IV ↓ |
|---|---|---:|---:|---:|
| 在线 | 无几何引导 | **7.89** | 8.39% | 3.26 |
| 在线 | 普通梯度引导 | 8.61 | 3.29% | 1.44 |
| 在线 | 重投影引导 RE-GUID | 8.07 | **3.23%** | **0.53** |
| 离线 | 无几何引导 | **5.00** | 9.67% | 1.94 |
| 离线 | 普通梯度引导 | 5.19 | 6.37% | 0.31 |
| 离线 | 重投影引导 RE-GUID | 5.05 | **3.73%** | **0.23** |

**预测目标与求解步数。** 在线 NTU120-AS 上，把网络的预测目标从流速度换成干净反应姿态，FID 从 14.726 降到 7.894，动作识别准确率同为 0.743。表 4 还单独扫描了 Euler 步数；这里的时间是作者报告的**在线生成每帧耗时**，论文没有把带几何引导的完整系统延迟单独列出。[表 4][t4]

| 求解步数 | 2 | 5 | 10 | 100 |
|---|---:|---:|---:|---:|
| 在线 FID ↓ | 15.965 | **7.894** | 8.273 | 8.259 |
| 每帧耗时（毫秒）↓ | **0.055** | 0.111 | 0.232 | 2.273 |

### 关键发现

1. **在线时，重投影更多改善了穿进去的程度。** 相比普通引导，IF 只从 3.29% 降到 3.23%，IV 却从 1.44 降到 0.53，同时 FID 从 8.61 改善到 8.07。只看“穿了几帧”，会漏掉这项方法的大部分收益。[表 1][t1]
2. **FID 与几何修正衡量不同目标。** 真实数据本身测得 IF 为 21.96%、IV 为 5.35。总体动作最像数据的模型，不一定两具身体重叠最少；反之，让两人始终离开彼此也可能取得很低的互穿指标，却无法完成握手。[表 1][t1] · [握手失败案例][failure]
3. **五步是这个设置中测出来的折中。** 两步最省计算，但 FID 明显较差。十步和一百步都没有超过五步的 FID。这里的 0.111 毫秒不能换算为从摄像头捕捉真人到头显显示反应的时延。[表 4][t4]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **给生成过程选一个有用的起点。** 配对数据里的甲动作已经含有此时此地的时序信息。以它为起点，除了省掉单独注入整段发起动作的分支，还允许采样器事后检查自己是否偏离了实际输入。第二项用途正是重投影能够利用的额外信息。[式 4][eq4] · [式 14][eq14]
- **把生成器和几何检查接在能解释的位置。** 端点预测可以通过正向运动学得到乙的关节位置，直接回答“哪里离甲太近”。训练时的人际相对几何监督、推理时的关节到身体表面惩罚、评测时的网格体积是三种不同的量，可以分别定位误差。[相对姿态损失][train] · [距离场引导][guide] · [附录 G][metrics]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **避开重叠与建立必要接触是两个目标。** 握手、搀扶等交互既要靠近，又要在指定部位和时刻接上。现有距离惩罚擅长把过近的点移开；论文展示了握手时接触与不穿透仍无法同时保证的案例。原文也没有报告手掌接触成功率或握力。[附录 I][failure]
- **“物理引导”的证据主要是几何。** 系统输出三维人体动作，使用关节、网格和距离场校正互穿。正文没有低层力矩控制、外力反馈或机器人实机闭环评测。若用于机器人，还需要独立验证执行后的动作和接触。[§3.2][guide] · [附录 J][outlook]
- **复现要区分论文版次与材料。** 能查到会议摘要、作者公开版全文和并排演示视频；固定版本的官方仓库只有说明、许可证与两张示意图。在线每帧耗时、互穿和握手失败均应按论文实验理解。[会议节目][program] · [作者仓库][repo] · [视频与失败案例][project]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **ReGenNet（CVPR 2024）** 给出了区分发起者和响应者的任务与在线评测。它用发起动作给扩散模型提供条件；ARFlow 选用同样的反应任务，把发起动作放到流的起点，因此能在采样途中直接用它校正方向。[ReGenNet 论文][regen] · [ARFlow 基线协议][compare]
- **Human-X（ICCV 2025）** 同样在意“能不能跟真人配合”，却把修正放在执行环节。Human-X 同时预测双方动作，低层控制器对比预测和实测的真人姿态；ARFlow 在生成响应动作的采样过程中直接修正几何。一个用来研究角色如何临场调整，另一个用来研究如何在输出前减少穿模。[本站 Human-X 解读][humanx] · [ARFlow 算法 2][alg]
- **ARMFlow（CVPR 2026）** 是另一篇在线反应生成论文，使用自回归 MeanFlow 和生成历史，关注怎样减少连续生成的求解开销。阅读 ARFlow 时应留意名字里的 AR 指 **Action–Reaction**；其在线模式另外使用因果注意力。[本站 ARMFlow 解读][armflow] · [ARFlow 架构说明][network]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- [ACM MM 2026 正式论文][acm] · [出版登记与作者信息][metadata] · [会议节目][agenda]
- [作者公开版 HTML（含附录）][html] · [对应 PDF][pdf] · [作者项目与可视化][project]
- [官方仓库固定版本][repo] · [直接查看重投影对照表][t1] · [失败案例][failure]

</div>

[acm]: https://doi.org/10.1145/3767308.3835005
[metadata]: https://api.crossref.org/works/10.1145/3767308.3835005
[agenda]: https://2026.acmmm.org/site/technical-programme.html
[program]: https://2026.acmmm.org/site/program-data.json
[reverse]: https://openreview.net/pdf?id=wyK7RH9jf5#page=9
[author]: https://peteriverson.github.io/
[html]: https://arxiv.org/html/2503.16973v3
[pdf]: https://arxiv.org/pdf/2503.16973v3
[project]: https://arflow2025.github.io/
[repo]: https://github.com/PeterIverson/ARFlow/tree/c335347518bbd31583a792bbea8c99bea9978059
[related]: https://arxiv.org/html/2503.16973v3#S2.SS2
[fig2]: https://arxiv.org/html/2503.16973v3#S3.F2
[fig3]: https://arxiv.org/html/2503.16973v3#S3.F3
[train]: https://arxiv.org/html/2503.16973v3#S3.SS1
[eq4]: https://arxiv.org/html/2503.16973v3#S3.E4
[eq14]: https://arxiv.org/html/2503.16973v3#S3.E14
[alg]: https://arxiv.org/html/2503.16973v3#alg2
[guide]: https://arxiv.org/html/2503.16973v3#S3.SS2
[ifmetric]: https://arxiv.org/html/2503.16973v3#S3.E19
[setup]: https://arxiv.org/html/2503.16973v3#S4.SS1
[compare]: https://arxiv.org/html/2503.16973v3#S4.SS2
[t1]: https://arxiv.org/html/2503.16973v3#S3.T1
[t2]: https://arxiv.org/html/2503.16973v3#S4.T2
[t3]: https://arxiv.org/html/2503.16973v3#S4.T3
[t4]: https://arxiv.org/html/2503.16973v3#S4.T4
[inter]: https://arxiv.org/html/2503.16973v3#A2.T1
[random]: https://arxiv.org/html/2503.16973v3#A3.T1
[network]: https://arxiv.org/html/2503.16973v3#A5
[impl]: https://arxiv.org/html/2503.16973v3#A6
[metrics]: https://arxiv.org/html/2503.16973v3#A7
[failure]: https://arxiv.org/html/2503.16973v3#A9.F2
[outlook]: https://arxiv.org/html/2503.16973v3#A10
[regen]: https://openaccess.thecvf.com/content/CVPR2024/papers/Xu_ReGenNet_Towards_Human_Action-Reaction_Synthesis_CVPR_2024_paper.pdf
[humanx]: /blog/iccv2025-human-x/
[armflow]: /blog/cvpr2026-armflow/
