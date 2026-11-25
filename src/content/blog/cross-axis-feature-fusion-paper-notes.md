---
title: "[CVPR2026] Cross-Axis Feature Fusion：一句编辑指令，要改哪些关节、哪些帧？"
description: "Cross-Axis Feature Fusion with Joint-Wise Motion Difference Prediction for Text-Based 3D Human Motion Editing。用双臂编辑实例拆解时间与通道两路编码、Soft-DTW 辅助监督，以及 MotionFix 上改对目标和保留源动作之间的取舍。"
pubDate: "2026-11-25T14:49:00+08:00"
badge: "Paper"
tags: ["Cross-Axis Feature Fusion", "Text-Based Motion Editing", "MotionFix", "Soft-DTW", "Diffusion Transformer", "Joint-Wise Supervision", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML，含附录][html] · [CVPR 正文 PDF][pdf] · [补充材料 PDF][supp]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026</summary>

*Cross-Axis Feature Fusion with Joint-Wise Motion Difference Prediction for Text-Based 3D Human Motion Editing*，作者 Gyojin Han、Junmo Kim，KAIST。CVPR 2026，页 30618–30628。研究问题为自然语言驱动的三维人体动作编辑。数据和数值依据会议正文及补充材料；截至本次阅读，会议条目和第一作者个人主页的该论文条目未给出模型代码入口。本次未复跑训练。[会议记录][venue] · [作者主页][author]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

要把一段动作改成“左臂别抬，右臂再抬高一点”，模型先把同一段源动作读两遍，一遍看每一帧的全身姿态，一遍看每个身体特征通道贯穿全程的变化。每帧再去读取与它有关的通道，把这份融合后的条件交给扩散模型生成编辑结果。[原文图 1][fig] · [双臂编辑实例][example]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　MotionFix 给出了真实源动作、目标动作和两者的文字差别。模型可以直接学习怎样把现有的一条表演改成另一条。SimMotionEdit 进一步教条件编码器预测源与目标的逐帧相似度，帮助它找出有编辑需求的时段。[MotionFix][motionfix] · [SimMotionEdit][sim]

**现有痛点**　左右手同时出现时，源与目标的某一整帧差别很大，只说明“这一刻要改”。同一个分数可以对应左臂放下、右臂抬高，也可以对应躯干转身，缺少哪组关节应该承担改变的提示。[原文 §3.2][fusion]

**核心矛盾**　逐帧观察能定位动作发生的时刻，却容易把身体各处的改变合并。逐通道观察能看清一条旋转轨迹的形状，却容易把同一动作早做或晚做一点也计成大幅度改变。[原文 §3.2–3.3][joint]

**本文目标**　只输入已有的三维动作与自由文本，生成一条满足修改要求、仍保留源动作结构与风格的连续动作。目标骨架用于训练和评分，实际编辑时无需提供。[原文 §3.1][dif]

**切入角度**　训练数据原本就成对出现。将两段动作的旋转轨迹按关节通道拆开比较，就能从动作本身算出哪些通道变化较大，无须额外雇人逐关节圈选编辑区域。[原文 §3.3][joint]

**核心 idea**　让“第几帧”的表示主动查询“哪个通道”的表示。训练时，通道级差异帮助模型读懂部位，融合后的逐帧相似度帮助它读懂时机。去噪器最后只需读取一串已经包含这两类信息的条件。[原文图 1][fig] · [补充 B.1][before]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

给定 N 帧源动作和一句编辑指令，两套条件编码器分别产生按帧索引、按通道索引的特征。跨轴注意力把它们合回按帧排列的序列。扩散 Transformer（DiT）在该条件下逐步去掉噪声，输出与源动作采用相同格式的连续人体姿态。[原文图 1][fig] · [扩散过程][dif]

<figure class="reading-figure"><a href="/paper-notes/cross-axis-feature-fusion/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/cross-axis-feature-fusion/architecture.svg" alt="时间分支和通道分支都读入源动作和文字。每帧用注意力查询各通道。融合特征交给扩散模型，由噪声生成人体动作。训练时另从通道和融合特征分别预测旋转距离与逐帧相似度。" /></a><figcaption>按论文图 1 与补充 B.1 重绘。沿实线从源动作读到编辑输出；右侧虚线表示训练用的两个预测头。真正推理时，去噪器可直接使用中部的逐帧融合特征。点击查看大图。</figcaption></figure>

### 关键设计

1. **同一份输入沿两条轴读出。** 每帧为 207 维，含 21 个关节的 126 维六维旋转、22 个关节的 66 维位置、3 维全局位移和 12 维全局朝向相关量。时间分支将每帧映射成一个 512 维向量；另一分支沿时间整合每个输入通道，得到 207 个 512 维向量。论文称后一支为 *joint-anchored*，其中每个位置实际对应一个标量通道，一个关节的六个旋转分量占六个位置。两条分支都读取 CLIP 编码后的指令。[原文 §3.1–3.2][fusion] · [模型设置][setting]

2. **帧为 Q，通道为 K 和 V。** 每个时间位置用自己的特征查询 207 个通道，由一次八头交叉注意力汇总。输出仍有 N 个位置，可以和加噪动作一起拼入 DiT。每个注意力头内部会计算帧与通道的关联权重；送进生成器的是加权后的 512 维向量，没有把这组权重作为显式关节编辑掩码下发。[原文 §3.2][fusion] · [显式条件消融][t4]

3. **训练模型判断整条旋转曲线改了多少。** 从通道分支中取出 126 个旋转通道。对每个通道，比较真实源动作和真实目标动作中该通道的两条时间序列。Soft-DTW 允许局部伸缩时间，用平滑的最小值汇总对齐代价。一个回归头读取通道特征，以均方误差学习 126 个距离。每个数概括整段有多不同；具体往高处抬还是向后摆，仍要由文字、源动作和去噪学习共同决定。[原文 §3.3，式 4–8][joint]

4. **融合后再判断每帧改了多少。** 第二个预测头接在跨轴融合之后，用源与目标的逐帧相似度监督它。于是计算每帧差异时已经能参考身体通道。将这一预测头挪回融合之前，保持其余框架时，批内目标检索 R@1 从 74.38% 降到 70.00%。这项对照直接检验了相似度监督应放在哪一层。[补充 B.1][before] · [补充表 B][tb]

### 一个完整例子

原文图 2 的一条指令要求**左臂别抬，让右臂比原先略抬高一点**。假设这段源动作有 60 帧，以下形状由论文定义推得，60 是为了便于跟踪而取的示例长度。[原文图 2][example]

| 阶段 | 此时有什么 | 在双臂编辑中起什么作用 |
| --- | --- | --- |
| 读取源动作 | 60 × 207 个连续特征，加上指令 | 提供原先两臂何时抬起、身体怎样移动的记录。 |
| 形成条件 | 60 × 512 的逐帧特征、207 × 512 的逐通道特征 | 抬臂发生的帧可以查询肩肘等通道，同一条通道在不同帧可有不同的注意力权重。 |
| 生成并检查 | 60 × 512 的融合条件引导去噪，输出 60 × 207 的连续动作 | 可比较左右臂的轨迹、检查右臂抬高的幅度，也可核对未点名的腿部。原图展示渲染结果，没有公布这个样例的注意力数值或逐关节误差。 |

### 训练与推理

训练用 MotionFix 的 6,730 条标注三元组数据集。条件分支各为 4 层 Transformer，去噪器为 8 层，特征宽度均为 512。主损失学习预测加在目标动作上的噪声，另有上述两项辅助监督。作者报告 batch size 64，AdamW 学习率 0.0001，训练 1,500 epochs，在单张 RTX 4090 上约 12 小时。[原文 §4.1][setting]

推理时保留源动作与文字，以纯高斯噪声作为待编辑结果的初值，使用 300 步 DDPM 和余弦噪声调度生成连续动作。文本与源动作两种条件的引导强度均设为 2.0；论文没有报告能实时运行的端到端延迟。[原文 §3.1][dif] · [原文 §4.1][setting]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

MotionFix 上使用预训练 TMR 将生成动作作为查询，寻找配对的目标动作。R@1 表示真正的目标排在首位的百分比；候选集分别为一个 32 样本批次或整个测试集。AvgR 为目标平均排名。FID 比较全体生成动作和真实目标动作的特征分布。下表节选原表 1 的列与行，破折号为原表未报告。[原表 1][t1]

| 方法 | 批内目标 R@1 ↑ | 全测试集目标 R@1 ↑ | 全测试集目标 AvgR ↓ | FID ↓ |
| --- | ---: | ---: | ---: | ---: |
| TMED | 62.90 | 14.51 | 56.63 | 0.167 |
| MotionReFit | 66.33 | — | — | — |
| SimMotionEdit | 70.62 | 25.49 | 23.49 | 0.110 |
| Cross-Axis Feature Fusion | **74.38** | **29.45** | **16.42** | **0.097** |

### 消融实验

保持双轴结构，改变两种辅助监督。原表 2 的六个组合均列于下表。[原表 2][t2]

| 逐帧相似度 | 旋转通道差异监督 | 批内目标 R@1 ↑ | 全测试集目标 R@1 ↑ | FID ↓ |
| --- | --- | ---: | ---: | ---: |
| 关 | 无 | 72.08 | **30.24** | 0.122 |
| 关 | L2 | 71.46 | 29.25 | 0.113 |
| 关 | Soft-DTW | 72.92 | 28.85 | 0.108 |
| 开 | 无 | 71.04 | 29.45 | 0.143 |
| 开 | L2 | 71.04 | 26.48 | 0.113 |
| 开 | Soft-DTW | **74.38** | 29.45 | **0.097** |

- **是否要给 DiT 再传一份文字？** 在融合条件之外，额外加入时间分支或通道分支的文字特征，全测试集目标 R@1 分别为 24.11% 和 27.67%，均低于只用融合条件的 29.45%。此处的比较仍然对所有模型提供文字指令。[原表 4][t4]
- **时间对齐有多平滑？** Soft-DTW 的 γ 从 0.1 扫到 50，γ＝10 时 FID 最低，为 0.097；γ＝50 时批内 R@1 略高（74.79%），FID 回升至 0.108。[原表 3][t3]
- **融合层加深会如何？** 交替堆叠四层时间自注意力和四层跨轴注意力后，FID 从 0.097 变为 0.103，批内 R@1 从 74.38% 降至 72.92%；全测试集 R@2、R@3 却略升。加深的收益取决于指标。[补充表 B][tb]

### 关键发现

1. 完整模型相对直接前作 SimMotionEdit，批内和全测试集的目标 R@1 分别提高 **3.76、3.96 个百分点**。但在模型内部，关闭两个辅助头的变体反而取得更高的全测试集 R@1。两项监督的优势在批内检索和 FID 上更清晰。[原表 1][t1] · [原表 2][t2]
2. 把检索对象改成**源动作**，可看到编辑保真的另一面。本法的批内源 R@1 为 78.96%，低于 MotionReFit 的 83.47%；源 R@3 为 93.33%，略高于后者的 92.84%。这些数字衡量语义上能否找回原动作，无法直接说明未编辑关节偏移了多少厘米。[补充表 A][ta]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **用互补监督保留两种时间信息。** 每通道的 Soft-DTW 对局部快慢差异较宽容，适合比较轨迹形状；逐帧相似度仍能提示某帧与目标的差距。只需已有动作对即可构造两者。[关节差异定义][joint] · [逐帧监督位置][before]
- **可以用生成前的表示诊断条件模块。** 接在通道分支上的小任务提出了一个具体问题：只看源动作与指令，能否预测目标里哪条旋转曲线改得多？它把“理解编辑”落实成可训练的中间量，也保留了通道距离本身无法表达的方向和时刻问题。[原文图 1][fig]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **定位编辑区域的证据有限。** 图 1(b) 用源与真实目标算出的距离说明这种监督信号存在。它没有给出模型逐帧逐关节的编辑命中率。若要验证“只改右臂”，可另测右臂轨迹偏差和其余关节相对源动作的偏移，并分开报告。[原文图 1][fig] · [评测设置][setting]
- **动作表示限制了精细控制。** 旋转辅助监督覆盖 21 个 SMPL 关节的六维通道，手指动作和物体接触未由这一监督直接建模。注意力输出也没有强制保持某一帧的脚底位置。[运动表示][dif] · [差异预测][joint]
- **跨数据集还缺证据。** 作者在补充材料说明，因 STANCE 的完整训练评估流程当时未公开，未能做可公平比较的实验。当前主要数值来自 MotionFix，推广到另一套动作分布仍需验证。[补充 E][future]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **MotionFix / TMED。** MotionFix 提供成对动作及其编辑说明。TMED 将文字与线性投影后的源动作直接交给去噪器；本文把交互提前，并增加了关节通道监督。[MotionFix 项目][motionfix] · [原文 §3.2][fusion]
- **SimMotionEdit。** 它已让文字和源动作先融合、已引入逐帧相似度监督。本文在此基础上加入逐通道表征与距离预测，使时间位置能主动查询全程的局部轨迹。[SimMotionEdit 原文][sim] · [本文 §3.2][fusion]
- **TMR。** 它在这里充当评测器。检索能回答生成结果更像哪条动作，不能代替一条手臂是否精确达到指定高度的测量。[站内 TMR 解读](/blog/iccv2023-tmr/) · [本文 §4.1][setting]
- **对局部控制的启发。** 若关心同一身体部位在不同时段接受不同指令，可以沿用本文的分轴读法，再明确测试每一时段该改哪里、改动方向对不对、其他部位是否被牵动。这三件事在单一的检索名次里难以区分。[原文表 1][t1] · [源动作叠加可视化][overlay]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- Gyojin Han、Junmo Kim，CVPR 2026 会议收录记录、正文及官方补充材料。[CVF 论文页][venue] · [正文 PDF][pdf] · [补充 PDF][supp]
- arXiv:2606.01014v1，含正文、三张补充表和动作叠加图。[HTML 全文][html] · [补充材料入口][ta]

</div>

[html]: https://arxiv.org/html/2606.01014v1
[venue]: https://openaccess.thecvf.com/content/CVPR2026/html/Han_Cross-Axis_Feature_Fusion_with_Joint-Wise_Motion_Difference_Prediction_for_Text-Based_CVPR_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/Han_Cross-Axis_Feature_Fusion_with_Joint-Wise_Motion_Difference_Prediction_for_Text-Based_CVPR_2026_paper.pdf
[supp]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Han_Cross-Axis_Feature_Fusion_CVPR_2026_supplemental.pdf
[author]: https://hangyojin.github.io/
[fig]: https://arxiv.org/html/2606.01014v1#S3.F1
[example]: https://arxiv.org/html/2606.01014v1#S4.F2
[dif]: https://arxiv.org/html/2606.01014v1#S3.SS1
[fusion]: https://arxiv.org/html/2606.01014v1#S3.SS2
[joint]: https://arxiv.org/html/2606.01014v1#S3.SS3
[setting]: https://arxiv.org/html/2606.01014v1#S4.SS1
[t1]: https://arxiv.org/html/2606.01014v1#S4.T1
[t2]: https://arxiv.org/html/2606.01014v1#S4.T2
[t3]: https://arxiv.org/html/2606.01014v1#S4.T3
[t4]: https://arxiv.org/html/2606.01014v1#S4.T4
[ta]: https://arxiv.org/html/2606.01014v1#S1.T1
[tb]: https://arxiv.org/html/2606.01014v1#S1.T2
[before]: https://arxiv.org/html/2606.01014v1#S2.SS1a
[overlay]: https://arxiv.org/html/2606.01014v1#S1.F1
[future]: https://arxiv.org/html/2606.01014v1#S5a
[motionfix]: https://motionfix.is.tue.mpg.de/
[sim]: https://openaccess.thecvf.com/content/CVPR2025/html/Li_SimMotionEdit_Text-Based_Human_Motion_Editing_with_Motion_Similarity_Prediction_CVPR_2025_paper.html
