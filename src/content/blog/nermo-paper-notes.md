---
title: "[ECCV2024] NeRMo：从不完整的骨架观测补回过去、预测未来"
description: "解读 NeRMo: Learning Implicit Neural Representations for 3D Human Motion Prediction。以左臂观测缺失为例，看时间傅里叶特征、关节编码与针对当前片段拟合的最后一层如何协作，并比较完整观测、缺失观测和长时预测的结果。"
pubDate: "2026-11-21"
badge: "Paper"
tags: ["NeRMo", "3D Human Motion Prediction", "Implicit Neural Representation", "Motion Completion", "Meta-Learning", "Fourier Features", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[正文 HTML（可翻译）][html] · [补充材料 HTML（可翻译）][supphtml] · [会议原文 PDF][pdf] · [补充材料 PDF][supp] · [作者报告幻灯片][slides]

<details class="paper-meta"><summary>论文信息与阅读范围 · ECCV 2024</summary>

*NeRMo: Learning Implicit Neural Representations for 3D Human Motion Prediction*。作者 Dong Wei、Huaijiang Sun、Xiaoning Sun（通讯作者）、Shengxiang Hu，来自南京理工大学。发表于 ECCV 2024，第 409–427 页。研究方向为三维人体动作预测、缺失观测修复与隐式神经表示。本文依据 ECVA 发布的正文和补充材料核对模型与数值，实验均为作者报告。[会议记录][venue] · [出版社记录][doi]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

假设录像中左臂一度被遮住，我们想知道遮挡期间手在哪里，也想知道再过 160 毫秒它会到哪里。NeRMo 给这两个问题同一个接口：输入时间和身体坐标编号，查询该位置的值。它先用当前片段能看见的骨架拟合一层线性映射，再用它填过去的空缺、推未来的姿态；短期预测较强，外推到一秒时优势减弱。[原文图 2][fig2] · [缺失观测示例][f6] · [长期结果][long]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　动作预测通常给模型连续数帧骨架，令它在固定的未来格点回归关节位置。这样的设置适合连续、完整的动捕数据，也使“缺失一帧或半条手臂”成为需要额外处理的问题。[原文 §1][intro]

**现有痛点**　缺的是左臂时，躯干和右臂仍有观测价值。先补齐左臂再预测，是把一个估计值当成下一阶段的输入；若还想查训练帧之间的姿态，固定帧模型往往又要插值。作者在缺失数据实验中保留了这种先后两步的基线。[原表 3][t3] · [补充图 1][suppfig1]

**核心矛盾**　时间可以取两个采样点之间的实数，人体关节只有离散的身份；直接给“右腕和下一编号的中点”没有解剖上的意义。另一方面，一条曲线即使完美通过所有可见坐标，也有很多种延伸到未来的方式。[原文 §3.2][enc] · [图 3][f3]

**本文目标**　训练一个预测器，接受完整或残缺的历史骨架。用户选定关节与时刻后，同一套模型既能估计过去漏测的值，也能预测未来的值。[原文 §3.5][infer]

**切入角度**　把任务拆成两件事：先从大量动作中学“哪些时间和关节特征适合预测”，再针对一个新片段，用实际看到的坐标校准这些特征与位置值之间的关系。这让不同的人做不同的动作时，共享规律仍可复用。[原文 §3.4][meta] · [补充算法 2][alg2]

**核心 idea**　把连续时间、离散关节身份送进共同的特征网络，用当前片段的观测解一次岭回归，求出最后一层权重。之后换一个查询时刻，就能在同一条动作函数上读取另一个位置。[原文图 2][fig2] · [补充式 1–3][ridge]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

NeRMo 有两条信息路径。**坐标路径**负责说明要查“哪个身体坐标、哪个时刻”，共享网络为它算出特征。**观测路径**提供这个人、这段动作的实际数值，用可见位置拟合专属于本片段的线性输出层。训练时还知道未来真值，用它更新共享网络。推理时保留学好的共享网络，用新片段重新求最后一层即可。[原文图 2][fig2] · [补充算法 1–2][alg1]

<figure class="reading-figure"><a href="/paper-notes/nermo/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/nermo/architecture.svg" alt="NeRMo 架构图。连续时间与离散坐标编号进入共享特征网络；码本与可见性掩码分别增强表征。可见历史数值通过岭回归拟合最后一层。历史缺失点和未来查询点复用该层，训练期的真实未来监督共享网络。" loading="lazy" /></a><figcaption>据原文图 2、§3.2–3.5 与补充算法 1–2 重绘。先沿上方读坐标特征，再向下看观测值怎样决定本片段的输出层。虚线表示仅在训练时使用的未来监督。点击可放大。</figcaption></figure>

### 关键设计

1. **时间用傅里叶特征，关节身份用离散编码。** 将归一化时间放进一组不同频率的正弦和余弦，得到 256 维时间表示；身体坐标编号查另一个 256 维可学习向量，两者拼接。实现设定把一个关节的三个位置分量展开，22 个关节便有 66 个标量通道。这样可以表达只漏测部分坐标的情形，最后再组装成三维关节。傅里叶映射作用在查询时间上，无需先从骨架信号估计动作周期。[原文 §3.2、式 1–2][enc] · [补充 A–C][suppa]

2. **从动作码本读取先验，增强坐标特征。** 作者预训练 VQ-VAE 得到 1,024 个、每个 512 维的动作原型。256 个可学习查询先从码本读信息，经自注意力更新；时间与关节的联合特征再通过交叉注意力读取这些原型。推理最终回归位置值，没有“选一个动作编号再解码成整段骨架”的环节。[原文 §3.2][enc] · [补充 A][suppa]

3. **让空间注意力知道哪里可信。** 共享网络含 6 个残差全连接块，并用 6 层、每层 8 头的空间注意力学习同一时刻各身体坐标之间的关系。观测掩码给每个时刻的每个坐标标记可见性。一种注意力只允许可见端点互相传信息；另一种允许全部位置交流，使缺失位置也能利用身体上下文。该掩码来自输入观测。[原文 §3.3、式 3–4][cca] · [补充 A][suppa]

4. **让“适配新片段”变成一次可解的回归。** 把可见坐标的共享特征叠成矩阵 Y，对应的真实数值记为 X。求使 YW＋b 贴近 X、同时抑制过大权重的 W、b，就是带正则项的岭回归。它有可微的闭式解。训练时梯度能穿过这一步，以未来预测误差修正共享特征；测试时只需按当前观测求解一次，再对任意查询复用 W、b。这样未来预测确实受这段历史制约。[原文 §3.4–3.5][meta] · [补充 B][ridge]

### 一个完整例子

沿用原文图 6 中“左臂观测缺失”的情形。下面的尺寸取自 Human3.6M 的设置；查询 140 毫秒用来说明非格点接口，主表报告的相邻测试点是 80 和 160 毫秒。[原文图 6][f6] · [补充 C–E][suppc]

| 环节 | 这段动作怎样进入模型 |
| --- | --- |
| 观察过去 | 25 FPS 下使用 10 帧历史，按论文协议为 400 毫秒。每帧取 22 个关节的 x、y、z，共有 10 × 66＝660 个标量观测位置。掩码标出哪些值确实来自传感器。 |
| 适配动作 | 给每个可见位置算特征。若历史完整，最后一层前的矩阵是 660 × 1,024；有遮挡时根据可见值拟合 W、b，无需先把左臂猜出来。 |
| 修复左臂 | 查询“过去某一帧、左腕的三个坐标分量”，用对应特征乘以同一组 W 并加 b，得到该时刻的三维位置估计。 |
| 预测未来 | 把时间换成最后一次观测后 140 毫秒，再查左腕或全身。无需先生成 120、160 毫秒的骨架再插值。两组查询各自都有输出，其准确度仍要用对应时刻的真值验证。 |

### 训练与推理

训练把一条动作分成过去与未来。内层用过去拟合本片段的线性层，外层用真实未来的误差更新通用网络、关节编码和回归正则强度。测试时固定这些通用参数，新片段只更新最后一层。Human3.6M、CMU-MoCap 均用 10 帧历史预测后续 25 帧；3DPW 用 10 帧预测 30 帧。补充材料报告单张 RTX 3080、Adam、批量 16、150 个 epoch，未给出训练墙钟时长。[主文 §4.1–4.2][datasets] · [输入输出设置][t1] · [补充 A、D][suppa]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 历史完整时，优势能维持多久？

原文表 1 和补充表 1 的 Human3.6M 全动作均值。表中是各未来时点的 MPJPE，数值越低表示预测关节位置越接近真值。该数据集已移除全局旋转和平移。[短期结果][t1] · [长期结果][long]

| 方法 | 80 ms ↓ | 160 ms ↓ | 320 ms ↓ | 400 ms ↓ | 560 ms ↓ | 1,000 ms ↓ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| LTD | 12.7 | 26.1 | 52.3 | 63.5 | 81.6 | 114.3 |
| PGBIG | 10.3 | 22.7 | 47.4 | 58.5 | **76.9** | 110.3 |
| SPGSN | 10.4 | 22.3 | **47.1** | **58.3** | 77.4 | **109.6** |
| NeRMo | **9.9** | **21.8** | **47.1** | 59.1 | 78.6 | 113.7 |

NeRMo 在 80、160 毫秒领先，320 毫秒与 SPGSN 持平，之后落后。在另一套 3DPW 上同样可见这个拐点：NeRMo 在 200／400／600 毫秒为 **30.8／63.2／89.4**，到 800 毫秒为 **106.2**，高于 PGBIG 的 **102.6**。连续时间解决了“到什么时刻查询”，长期趋势预测是另一项需要单独评估的能力。[原表 2][t2]

### 遮住 20% 的历史坐标，直接预测还是先修再预测？

原文表 3 在 Human3.6M 上随机遮住 20% 的历史值，分别报告四类动作。下表只取其中 walking 的四个时点，避免把该动作当成所有动作的平均。R＋LTD 先独立修复历史，再运行 LTD；作者为随机预测方法 TCD 采样五次取最好的一次。[原文 §4.4][miss] · [原表 3][t3]

| 方法 | 80 ms ↓ | 160 ms ↓ | 320 ms ↓ | 400 ms ↓ |
| --- | ---: | ---: | ---: | ---: |
| LTD，直接预测 | 24.5 | 35.5 | 51.0 | 57.7 |
| R＋LTD，先修再预测 | 19.9 | 30.8 | 47.5 | 54.3 |
| MT-GCN | 16.4 | 24.8 | 40.8 | 48.1 |
| TCD，五取一 | 18.4 | 29.8 | 46.4 | 53.1 |
| NeRMo | **14.2** | **23.7** | **38.1** | **45.7** |

walking 这一行的收益清楚，但各动作并不整齐：在 eating 的 400 毫秒，R＋LTD 为 **45.1**，NeRMo 为 **46.6**。另外，原图 5 单独评价过去缺失值的修复误差；20% 随机缺失时，MT-GCN 为 **0.712**、NeRMo 为 **0.525**。后者是修复的 L2 距离，不能拿来和上表未来位置的 MPJPE 直接比较。[原表 3][t3] · [原图 5][f5]

### 消融：连续时间编码与动作码本各贡献多少？

原文表 4 在 CMU-MoCap 保留其余结构，交叉开关两项坐标编码设计。指标为 MPJPE，越低越好。[原表 4、图 7][ablate]

| 配置 | 80 ms ↓ | 160 ms ↓ | 320 ms ↓ | 400 ms ↓ | 1,000 ms ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| 无傅里叶特征、无码本增强 | 14.83 | 25.91 | 47.45 | 58.62 | 109.77 |
| 仅码本增强 | 12.79 | 21.96 | 42.91 | 52.92 | 99.60 |
| 仅傅里叶特征 | 8.12 | 14.42 | 30.11 | 38.39 | 83.81 |
| 两者并用 | **8.05** | **14.14** | **29.43** | **37.15** | **80.46** |

400 毫秒处，单加时间傅里叶特征将误差从 **58.62** 降到 **38.39**，再加码本降到 **37.15**。图 7 还比较了仅时间与关节－时间输入、是否元优化，以及完整／缺失观测下是否使用掩码空间注意力。加入关节编号后更好预测，掩码注意力在缺失观测下帮助更明显。作者提醒，直接删掉元优化会切断数值观测影响输出的路径，这项消融不能证明元学习胜过所有其他历史编码方法。[原图 7][f7] · [补充 C][suppc]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **“知道哪个时刻”和“知道这个人正在做什么”是两个来源。** 查询坐标提供前者，已观察的骨架通过最后一层的拟合提供后者。保持时刻与身体编号不变，换一段历史，模型便应得到另一组 W、b。[补充算法 2][alg2]
- **离散的身体编号也增加了适配所拥有的约束数。** 若每一帧只提供一个时间特征，10 帧相当于用 10 行数据拟合宽 1,024 的末层；展开身体坐标后，同一窗口最多有 660 行。作者用这个差别解释仅按时间编码时岭回归较不稳定，实际改变量见图 7(a)。[补充 C][suppc] · [原图 7][f7]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **观测窗口外的轨迹存在多种合理延续。** NeRMo 针对一段输入解出一组输出层参数，评测关注一次预测与真实动作的距离。这并不评价生成多种未来的覆盖率。补充材料也将远期外推较弱列为局限。[长期结果][long] · [作者局限讨论][limit]
- **遮挡实验与真实传感器的故障仍有距离。** 定量主表模拟随机缺失，左臂缺失则以单例展示；现有实验没有量化持续整条手臂被遮挡多久仍能可靠还原。输出的三维位置也没有另行经过硬骨长、足部接触或世界坐标轨迹约束。[原图 6、原表 3][t3] · [数据预处理][datasets]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **NeRM（ICLR 2024）** 与本文有共同作者，简称只差末尾的 o。NeRM 研究如何生成高帧率动作。NeRMo 从同一个人的已知骨架出发，要求输出对得上这个人的真实未来。选论文时，先看手里是否有一段需要继续预测的观测历史。[NeRM 站内解读](/blog/iclr2024-nerm/) · [第一作者的两篇论文目录](https://cies.hhu.edu.cn/2025/0915/c21522a307274/page.htm) · [NeRMo 的输入定义][fig2]
- **NeMF** 用可查询的连续动作场表示、重建与优化运动。NeRMo 面对的额外难题是测试时只看到过去，所以训练信号必须奖励对未来的外推；仅拟合已知动作无法检验这一点。[站内 NeMF 解读](/blog/neurips2022-nemf/) · [补充 C][suppc]
- **HumanMAC** 以扩散采样从同一历史得到多种未来，评估预测的准确性与多样性。NeRMo 的比较价值在于直接选择时刻和坐标，并在同一查询机制下复用修复和预测。若任务要问“未来可能有哪些动作”，应给出多个候选及覆盖率。[站内 HumanMAC 解读](/blog/iccv2023-humanmac/) · [NeRMo 比较协议][settings]
- **LTD、MT-GCN、TCD** 提供三种处理缺失骨架的参照：用独立修复器给预测器补输入、以联合任务学修复和预测，以及用随机模型给出候选。原表 3 中先修复确实改善了 LTD；比较其他预测器时，还要对齐可见性掩码、预测时长和每段输入的采样次数。[原文 §4.2–4.4][settings]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 发表信息与正文。ECVA 提供 18 页会议论文，站内 HTML 保留原图、公式和表格，并可按页跳回 PDF。[正文 HTML][html] · [会议记录][venue] · [出版社章节][doi] · [原文 PDF][pdf]
- 实验、推导与演示。7 页补充材料的 A–D 节给出实现参数、闭式解与推理算法，E–F 节给出长期预测和局限。[补充材料 HTML][supphtml] · [补充材料 PDF][supp] · [作者报告幻灯片][slides]

</div>

[html]: /paper-notes/nermo/fulltext/
[supphtml]: /paper-notes/nermo/fulltext/supplement/
[pdf]: https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/06076.pdf
[supp]: https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/06076-supp.pdf
[venue]: https://www.ecva.net/papers/eccv_2024/papers_ECCV/html/6076_ECCV_2024_paper.php
[doi]: https://link.springer.com/chapter/10.1007/978-3-031-72784-9_23
[slides]: https://eccv2024.ecva.net/media/eccv-2024/Slides/1259.pdf
[fig2]: /paper-notes/nermo/fulltext/#figure-2
[enc]: /paper-notes/nermo/fulltext/#section-30
[cca]: /paper-notes/nermo/fulltext/#section-39
[meta]: /paper-notes/nermo/fulltext/#section-48
[infer]: /paper-notes/nermo/fulltext/#section-55
[t1]: /paper-notes/nermo/fulltext/#table-1
[t2]: /paper-notes/nermo/fulltext/#table-2
[miss]: /paper-notes/nermo/fulltext/#section-77
[t3]: /paper-notes/nermo/fulltext/#table-3
[ablate]: /paper-notes/nermo/fulltext/#table-4
[ridge]: /paper-notes/nermo/fulltext/supplement/#section-6
[alg1]: /paper-notes/nermo/fulltext/supplement/#algorithm-1
[alg2]: /paper-notes/nermo/fulltext/supplement/#algorithm-2
[long]: /paper-notes/nermo/fulltext/supplement/#table-1
[limit]: /paper-notes/nermo/fulltext/supplement/#section-f
[intro]: /paper-notes/nermo/fulltext/#section-5
[f6]: /paper-notes/nermo/fulltext/#figure-6
[suppfig1]: /paper-notes/nermo/fulltext/supplement/#figure-1
[f3]: /paper-notes/nermo/fulltext/#figure-3
[datasets]: /paper-notes/nermo/fulltext/#section-58
[settings]: /paper-notes/nermo/fulltext/#section-63
[f5]: /paper-notes/nermo/fulltext/#figure-5
[f7]: /paper-notes/nermo/fulltext/#figure-7
[suppa]: /paper-notes/nermo/fulltext/supplement/#section-4
[suppc]: /paper-notes/nermo/fulltext/supplement/#section-15
