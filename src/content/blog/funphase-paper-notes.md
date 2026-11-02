---
title: "[ICML2026] FunPhase：把一段运动编码成周期函数，再按时间和关节读取姿态"
description: "对照 DeepPhase、无周期的函数自编码器与动作扩散基线，从稀疏关键帧和缺失右腿的例子看清连续查询、条件采样及其误差边界。"
pubDate: "2026-11-02T16:22:00+08:00"
badge: "Paper"
tags: ["FunPhase", "Motion-Generation", "Phase-Manifolds", "Motion-Completion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读版本 · ICML 2026</summary>

正式题名 *FunPhase: A Periodic Functional Autoencoder for Motion Generation via Phase Manifolds*。作者为 Marco Pegoraro、Evan Atherton、Bruno Roy、Aliasghar Khani、Arianna Rampini。论文发表于第 43 届 ICML，PMLR 第 306 卷，97624–97642 页。本文依据 19 页正式稿及作者公开实现解读，表中数值来自论文，本次未运行训练、补间或生成模型。[会议记录][venue] · [正式全文][paper] · [作者研究页][autodesk] · [官方代码][code]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

FunPhase 把一小段身体运动压成多个通道的振幅、频率、相移和偏置，再把解码做成按“时刻、关节”查询的函数。同一套解码器既能从已观测片段重建更密的姿态，也能接收扩散模型采样的新周期参数，生成另一段动作。[图 2、§4][arch] · [图 3–5][apps]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 角色走路或跑步时，不同时刻的姿势可以很像，运动方向却可能完全不同。DeepPhase 用多个周期通道描述“运动到了周期的哪一步”，给动作匹配和运动预测提供了比单帧姿势更有用的坐标。[§3][deep] · [站内 DeepPhase 解读](/blog/siggraph2022-deepphase/)

**现有痛点：** 逐帧卷积模型的输出与训练帧格、骨架拓扑紧密绑定。若只观测每隔几帧的姿态，或只知道上身而缺右腿，应用真正需要的是“在这个缺失的时刻或关节上，输出什么”。[§3.2–4.1][arch] · [图 3–4][apps]

**核心矛盾：** 编码要足够紧凑，才能让生成模型在有限样本中学会运动分布；解码又要保留局部关节姿态、根轨迹和接触变化，不能因只保留周期轮廓而把细节抹平。[§4.1–4.2][ae] · [表 1–2][mainresults]

**本文目标：** 在同一种相位表示上完成片段重建、变采样率查询和条件生成，并检验这种表示能否用于人类步态、犬类运动和多种动物骨架。[§4–5][arch] · [图 3–5、表 3][apps]

**切入角度：** 把“看到了什么”和“要读出什么”分开。编码器接收已知姿态及其坐标，解码器用目标时刻与关节的坐标作为查询。增加输出帧只需要增加查询点，片段本身的运动参数仍然共用。[图 2][arch] · [解码定义][ae]

**核心 idea：** 先让周期瓶颈学习可解码的动作函数，再冻结这套自编码器，训练扩散模型去生成函数参数。重建与生成可以共用一个解码器，但前者的参数来自观测，后者的参数来自采样。[§4.1–4.2][ae] · [附录 A][impl]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

一段运动包含两类动态量：根节点在世界坐标中怎样移动，各关节相对父节点怎样转动。FunPhase 先分别编码两路观测，再联合提取一组周期参数。重建时，根据所问的时刻与关节恢复姿态；生成时，则先在变换后的参数空间中扩散采样，再走同一条解码路径。[图 2、§4.1][arch] · [式 9][diff]

<figure class="paper-figure"><a href="/paper-notes/funphase/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/funphase/architecture.svg" alt="FunPhase 的根与关节双编码路径、通道正弦瓶颈、时空查询解码，以及冻结自编码器后的条件相位扩散训练。" /></a><figcaption>图据正式稿图 2、式 1、4–9 和附录 A 重绘。实线传递特征或查询，虚线表示训练监督。 <a href="/paper-notes/funphase/architecture.svg" target="_blank" rel="noopener">查看原图</a></figcaption></figure>

先沿 **01 → 02** 看自编码器：目标时刻是解码器的输入，因此增加一次查询能多读出一帧。再从 **03 返回 02**：DiT 每一步更新的是一整段的函数参数，得到参数后才解码为运动。图 4 的“给定关键帧”和“已知其余身体、补右腿”走的是有局部观测的生成支路。[图 2][arch] · [图 4][apps]

### 关键设计

1. **根平移和关节旋转有不同的观测坐标。**

   每个时刻的根位置是一个三维世界坐标，而每个关节有一组 6D 旋转。根编码器接收时间的傅里叶特征；关节编码器同时接收时间和骨架图的位置编码。固定骨架用图拉普拉斯特征向量，多种尺寸的骨架改用图热扩散编码，以表示关节间的连接结构。两个 Perceiver 用各自的潜在查询从观测点汇集信息，再拼接、经一维卷积进入共享瓶颈。[§4.1][ae] · [附录 A.1][impl]

2. **一个周期通道存四个数，整个片段共用一份。**

   对每个潜在通道，模型用可微 FFT 从频谱中取出频率、振幅和偏置，并由学习的回归层估计相移。按式 1 的记号，一条潜在曲线可写作 **a·sin(2π(f·T−s))＋b**，其中 a、f、s、b 分别描述振幅、频率、相移和偏置。最大模型有 256 个通道，因此一个片段只需 1,024 个标量。这个正弦约束作用在潜在特征上；最终腕关节或脚踝的轨迹仍由非线性解码器产生。一个通道也没有预先对应“落左脚”或某一块肌肉。[式 1–3][deep] · [图 2][arch]

3. **给解码器坐标，就能指定读哪一帧、哪一个关节。**

   解码器先从四元组还原各通道的正弦特征，经逆瓶颈映射拆成关节和根特征。关节解码器以目标关节的图编码和目标时刻的时间编码作查询，根解码器只需时间查询。训练时随机抽取帧与骨架节点，监督包含旋转测地距离、根位置误差、正向运动学（FK）得到的关节位置误差，以及足滑、穿地惩罚。因此系统既可以增密同一片段的采样，也可以在缺少某些关节观测时查询它们；答案是否接近真实动作要分别检验。[§4.1、式 4–8][ae] · [附录 A.1][impl]

4. **给周期参数加噪前，先处理相位的首尾接缝。**

   一圈中的 0.99 和 0.01 很近，但作为两个标量直接加高斯噪声，数值距离很远。作者将振幅和相移改写为 **a·cos(2πs)、a·sin(2πs)** 两个坐标，将归一化的有界频率经 probit 变换映射到实数轴，偏置保持不变。DiT 在这些每通道 4 维的坐标上预测扩散速度目标 v。生成结束后做逆变换恢复相位参数，再交给解码器。人类生成用风格类别作条件，动物用物种类别；已知关键帧或关节也可以先编码并作为附加条件。[§4.2、式 9][diff] · [附录 A.2][dit]

### 一个完整例子：只看到稀疏关键帧，怎样把它补密？

以附录表 10 的 50 帧窗口为例。这里追踪的是自编码器的重建实验；主文图 4 的关键帧条件扩散是另一项应用。[表 10][kfs] · [图 3–4][apps]

| 步骤 | 在这一例子中发生的事 |
|---|---|
| 给观测 | 按固定间隔保留关键帧。每个被观测到的关节带着自己的时间与骨架图坐标。 |
| 得到片段参数 | 两路编码器汇集稀疏输入，周期瓶颈给出整段共用的一组四元组。缺失时刻没有独立的真值输入。 |
| 恢复完整窗口 | 向解码器查询窗口中每个目标时刻的关节旋转和根位置，形成完整的 50 帧结果。 |
| 评价 | 间隔 5 帧时 FunPhase 的重建误差是 0.39，SLERP 是 0.43；间隔 25 帧时分别是 151.24、14.79。两种稀疏程度下，方法的排序反转。 |

### 训练与推理

正式稿通常以 60 帧、1 秒为窗口训练，跨物种 ZOO 数据使用 30 帧、1 秒窗口。第一阶段约 3,400 万参数，学习重建运动函数。第二阶段冻结自编码器，约 1,000 万参数的 DiT 用 8 个 Transformer 块，在 1,000 个扩散步的日程上训练，作者报告用 900 步采样；实验配置为 4 张 A100。正文 60 帧训练、表 10 的 50 帧评测窗口，以及 README 中 50 帧训练示例是三个不同出处的设置。[附录 A.1–A.3][impl] · [表 10][kfs] · [实现说明][code]

图 5 还展示了单独训练的自回归运动控制器。它用相位向量驱动混合专家的门控，再结合风格或期望轨迹预测后续动作。这与上面的 DiT 采样是两条独立路径，图 5 提供的是犬类动画的定性对照。[§5.3、图 5][apps]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验一：同通道数重建，改进有多大？

表 1 比较 DOG 与 100STYLE 的自编码器。Position 为平均关节位置误差（厘米），Orientation 为旋转误差，NPSS 衡量频谱差异。Sliding 与 Penetration 分别衡量足滑和穿地，ACL 按附录定义为平均关节加速度幅值。下列均越低越好，C 表示周期通道数。[正式稿表 1][mainresults] · [指标定义][metrics]

| 数据集 | 方法 | Position ↓ | Orientation ↓ | NPSS ↓ | Sliding ↓ | Penetration ↓ | ACL ↓ |
|---|---|---:|---:|---:|---:|---:|---:|
| DOG | DeepPhase，16C | 144 | 0.54 | 3.58 | 1.76 | 0.912 | 1.768 |
| DOG | FunPhase，16C | 61.4 | 0.34 | 1.83 | 0.21 | 0.351 | 1.062 |
| 100STYLE | DeepPhase，32C | 92.9 | 0.35 | 3.68 | 1.47 | 0.414 | 1.504 |
| 100STYLE | MLD-VAE | 59.8 | 0.29 | 2.93 | 0.88 | 0.211 | 1.380 |
| 100STYLE | ACMDM-AE | 0.32 | 0.01 | 0.28 | 0.33 | 0.003 | 1.412 |
| 100STYLE | Function AE，256C | 0.74 | 0.05 | 0.59 | 0.23 | 0.001 | 1.383 |
| 100STYLE | FunPhase，32C | 1.93 | 0.10 | 1.18 | 0.16 | 0.001 | 1.371 |
| 100STYLE | FunPhase，256C | 0.36 | 0.20 | 0.75 | 0.21 | 0.001 | 1.378 |

DOG 上，同为 16 通道，新结构把位置误差从 144 降到 61.4 厘米，降幅约 57%。但摘要所称“各指标至少改善 45%”不能当作表 1 逐列结论：同一对模型的旋转误差从 0.54 到 0.34，约降 37%；100STYLE 的 ACMDM-AE 在位置、方向与 NPSS 上还取得了更小的数值。[会议摘要][venue] · [原表 1][mainresults]

### 主实验二：生成得像真实动作，还是符合指定类别？

100STYLE 按风格条件生成。FID 衡量动作特征分布，Accuracy 由预训练分类器判断生成结果属于指定风格的比例。原表 2 中 FID 和 Diversity 带 ± 项，按原表精度列出。[表 2][mainresults] · [指标定义][metrics]

| 方法 | FID ↓ | Accuracy (%) ↑ | Diversity ↑ | Foot Sliding ↓ | Coherence ↑ | ACL ↓ |
|---|---:|---:|---:|---:|---:|---:|
| MLD | 1.99 ± 1.22 | 41.88 | 0.65 ± 0.01 | 1.16 | 1.06 | 1.34 |
| ACMDM | 5.45 ± 3.04 | 15.67 | 0.75 ± 0.01 | 1.74 | 1.53 | 2.46 |
| CAMDM | 0.91 ± 0.62 | 88.22 | 0.69 ± 0.01 | 0.69 | 1.08 | 6.02 |
| Function Diff. | 1.19 ± 0.43 | 34.27 | 0.54 ± 0.01 | 1.23 | 1.14 | 1.25 |
| FunPhase | **0.51 ± 0.16** | 76.17 | 0.64 ± 0.01 | **0.52** | 1.17 | 1.33 |

### 主实验三：同一种方法处理多种动物骨架

TRUEBONES ZOO 含 70 种动物骨架、1,219 段序列。Coverage 衡量生成样本对真实动作分布的覆盖；Local/Inter Diversity 分别衡量局部窗口到真实最近邻的距离、不同生成结果的差异；最后一列比较生成与真实序列内部多样性的差距。论文表 3 的单序列基线印为 SMDM，对照方法在正文中列为 SinMDM。[表 3][apps] · [评测协议][metrics]

| 方法 | Coverage ↑ | Local Diversity ↑ | Inter Diversity ↑ | Intra Diversity Diff. ↓ |
|---|---:|---:|---:|---:|
| SMDM | 89 ± 15 | 0.08 ± 0.13 | 0.28 ± 0.13 | 0.14 ± 0.09 |
| AnyTop | 80 ± 22 | 0.26 ± 0.12 | 0.37 ± 0.18 | 0.14 ± 0.08 |
| FunPhase | **96 ± 7** | 0.11 ± 0.04 | 0.21 ± 0.05 | **0.06 ± 0.03** |

### 消融与补充实验

**函数解码和周期瓶颈各贡献什么？** 表 4 在自身口径下做三种组合。由 DeepPhase 改为无周期 Function AE 后，位置误差降幅最大；再加入周期分解，根与足滑改善，但旋转误差从 0.041 升到 0.31。附录表 4 的若干值与主表 1 不同，此处各按原表报告，不把两表交叉计算增益。[表 4][abl] · [表 1][mainresults]

| 原表 4 配置 | Joint Position ↓ | Rotation ↓ | Root ↓ | Sliding ↓ | Penetration ↓ |
|---|---:|---:|---:|---:|---:|
| DeepPhase：仅周期 | 92.06 | 0.15 | 0.44 | 0.69 | 1.07 |
| Function AE：仅函数 | 0.74 | 0.041 | 0.41 | 0.052 | 0.028 |
| FunPhase：函数＋周期 | 0.36 | 0.31 | 0.17 | 0.027 | 0.016 |

**骨干容量与损失。** 在 100STYLE 训练集的 20% 上训练 60 轮。附录表 5 中，同用 256 通道，根与关节合用一个编码器时位置误差 3.37，分开时 3.15；但根误差从 0.92 降到 0.86 的同时，参数由 26.1M 增至 34.2M。表 6 去除 FK 损失，位置误差从 3.14 升到 26.8；单去足惩罚时，足滑与穿地在报告精度下仍为 0.078 和 0.00005。后两项不能从表中读出严格改善。[表 5][abl] · [表 6–7][loss]

**相位坐标变换。** 在 20% 的 100STYLE 训练数据和 2M 参数的扩散模型上，启用式 9 后，FID 从 1.28 ± 0.44 到 1.27 ± 0.48，分类准确率从 34.83% 到 37.6%，Diversity 保持 0.56。这个对照检验的是加噪前的坐标处理；不要把完整模型与 Function Diff. 之间的差距都归给这一步。[表 8][abldiff]

**关键帧间距。** 表 10 报告固定 50 帧窗口的重建误差，未在表内标注单位。表按原列顺序排列。[表 10][kfs]

| 方法 | 间隔 25 帧 ↓ | 间隔 15 帧 ↓ | 间隔 10 帧 ↓ | 间隔 5 帧 ↓ |
|---|---:|---:|---:|---:|
| SLERP | **14.79** | **4.11** | 1.32 | 0.43 |
| Function AE | 126.21 | 6.02 | 1.29 | 0.76 |
| FunPhase | 151.24 | 11.61 | **0.99** | **0.39** |

**弱周期片段。** 表 9 将测试动作按频谱熵分四组。从最低到最高，足滑从 0.49 ± 0.42 升到 0.662 ± 0.439，ACL 从 1.18 ± 1.02 升到 2.19 ± 0.99，位置误差却没有单调增大。作者在最高熵组看到拍手、手势和不同动作间的过渡。较复杂的动作首先损失的是时间平顺性与接触稳定性。[表 9、附录 D][entropy]

### 关键发现

1. **函数表示与周期约束应分别评价。** 表 1、4 中，无周期的 Function AE 也能显著降低重建误差；加入周期参数进一步改变了根轨迹、足滑和旋转误差之间的取舍。[重建主表][mainresults] · [组件对照][abl]
2. **动作分布与类别忠实度有不同赢家。** 100STYLE 上 FunPhase 的 FID 与足滑最低，CAMDM 的类别准确率更高，为 88.22% 对 76.17%。ZOO 上 FunPhase 覆盖率较高，而 AnyTop 的局部与样本间多样性更高。[表 2][mainresults] · [表 3][apps]
3. **能在中间时刻取值，不等于能恢复长时间缺失的动作。** 表 10 给出明确反例。作者推测训练时很少看到这样大的关键帧空档，文中未提供增加稀疏训练后的复测。[附录 E][kfs]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **查询坐标本身就是输出接口。** 改变时刻决定输出帧率，改变关节索引决定读哪一部位；潜在参数仍描述整个片段。这样可以把同一表示拿去做重建、增帧或部分身体补全，而每种任务的实际可靠程度可以单独测。[图 2–4][arch] · [补间误差][kfs]
- **把圆周上的相邻关系保存在加噪坐标里。** 振幅与相位的二维表示让相位绕回零点时保持连续，同时保留频率和偏置来解码整段运动。它和仅画相位流形时使用的振幅－相移投影功能不同。[式 2–3][arch] · [式 9][diff]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **人类语言语义的验证范围有限。** 主生成实验使用步态风格和动物物种条件。拍手、共语手势、突然转换等弱周期动作还会遇到接触与平顺性的困难；论文将 HumanML3D、KIT-ML 等文本任务列作后续研究。[结论][end] · [表 9][entropy]
- **补全是由条件引导的预测。** 图 4 展示缺失右腿时能生成合理的腿部动作，但主表没有给出该任务上的逐关节误差、已知关键帧最大误差，或“脚必落在指定世界坐标”的成功率。需要精确控制时，应对解码后的骨骼直接检查。[图 4][apps] · [附录 E][kfs]
- **跨骨架实验与交互性能有各自边界。** 多骨架 ZOO 结果支持在异构骨架上开展训练与生成；表 3 不提供“完全未见过的新骨架”单列成绩。图 5 的自回归控制器也不能用来推算 900 步扩散采样的实时延迟。[表 3、图 5][apps] · [附录 A.2–3][sampling]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **DeepPhase（SIGGRAPH 2022）。** FunPhase 沿用多通道局部周期参数，将固定时间格上的重建换成坐标查询，并用冻结的表示训练新的生成模型。图 7 中，两种模型在犬类跑动上的相位投影都呈环状；环状结构支持周期解释，还需用重建、类别和接触指标评价动作质量。[FunPhase 附录 C][abldiff] · [站内 DeepPhase 解读](/blog/siggraph2022-deepphase/)
- **AnyTop（SIGGRAPH 2025）。** 两篇都面对骨架拓扑变化。AnyTop 是主文多骨架生成基线；FunPhase 以图坐标查询连续函数。覆盖率和多样性体现的是不同要求，直接看表 3 的两类结果比只给一个排名更有意义。[原表 3][apps] · [站内 AnyTop 解读](/blog/siggraph2025-anytop/)
- **与 TransPhase 对读。** 两篇都在相位空间中采样。TransPhase 用相邻语义段交换信息，让“走路接坐下”的边界前后共同调整；FunPhase 则把一段运动的参数变成可查询的连续函数。把它用于动画编辑时，应分别检查指定时刻能否取样、该样本是否恢复了真实的中间运动。附录 E 的稀疏关键帧实验检验了后一个问题。[附录 E][kfs] · [站内 TransPhase 解读](/blog/neurips2025-transphase/)

<span id="reading-8" class="reading-anchor"></span>

## 来源

- [ICML 2026 / PMLR 正式记录][venue] · [正式论文与附录][paper] · [Autodesk 作者研究页][autodesk] · [arXiv 版本记录][arxiv]
- [官方代码][code] · [核查版本的周期瓶颈实现][pfcode] · [数据、训练与推理入口][readme]。README 给出了预处理、训练与使用已有 checkpoint 的示例；本次检视的 Git 树内未见模型权重文件，未实跑模型。
- 教学架构图依正式稿图 2、式 1、4–9 和附录 A 重绘。重建、生成与消融数值按正式版表格分别报告。

</div>

[venue]: https://proceedings.mlr.press/v306/pegoraro26a.html
[paper]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf
[deep]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=3
[arch]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=4
[ae]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=5
[diff]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=6
[mainresults]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=7
[apps]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=8
[end]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=9
[impl]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=12
[dit]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=13
[sampling]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=14
[metrics]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=15
[abl]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=15
[loss]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=16
[abldiff]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=17
[entropy]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=18
[kfs]: https://raw.githubusercontent.com/mlresearch/v306/main/assets/pegoraro26a/pegoraro26a.pdf#page=19
[autodesk]: https://www.research.autodesk.com/publications/funphase-periodic-functional-autoencoder-motion-generation/
[arxiv]: https://arxiv.org/abs/2512.09423
[code]: https://github.com/Marco-Peg/FunPhase
[pfcode]: https://github.com/Marco-Peg/FunPhase/blob/4c8c1a57c2f40df908854bce73ebf0f500b44aea/Models/FAE.py#L203-L258
[readme]: https://github.com/Marco-Peg/FunPhase/blob/4c8c1a57c2f40df908854bce73ebf0f500b44aea/README.md
