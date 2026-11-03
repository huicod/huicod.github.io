---
title: "[ACMMM2026] TeMuDance：让舞蹈听音乐，也听懂转身、举手与行进指令"
description: "从两套没有三元组标注的数据出发，理解动作桥接检索、冻结音乐骨干与文字控制支路怎样协作，并用运动学谓词检查文字是否真的改变了舞蹈。"
pubDate: "2026-11-03T10:05:00+08:00"
badge: "Paper"
tags: ["TeMuDance", "Music-to-Dance", "Text-Control", "Diffusion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · ACM Multimedia 2026</summary>

*TeMuDance: Contrastive Alignment-Based Textual Control for Music-Driven Dance Generation*。作者 Xinran Liu、Diptesh Kanojia、Wenwu Wang、Zhenhua Feng。ACM Multimedia 2026 官方日程列为 Main Track，编号 mfp5805。技术内容按 2026 年 4 月 18 日提交的署名 arXiv v1 阅读，含附录 A–C。研究任务是音乐与文字共同驱动舞蹈。仓库已有训练入口，README 仍注明 HumanML3D 转换到 52 关节的预处理代码待发布。核查日期为 2026 年 11 月 3 日，本文实验数字取自论文。[会议日程][venue] · [论文记录][abs] · [全文][paper] · [官方仓库][code] · [项目演示][project]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

**TeMuDance 用动作相似性给“音乐—舞蹈”和“文字—动作”两套数据补齐缺失条件，再训练一个文字控制支路，让已有音乐舞蹈生成器同时响应“举手”“行进”“转身”等要求。** 它把音乐生成骨干冻结，用可训练残差改变去噪过程，并通过同音乐、同随机种子的空文字对照测量文字带来的实际动作变化。[§3、图 2][method]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 音乐驱动舞蹈模型已经能够学习拍点、动作分布和舞种风格。文本驱动动作模型则从“人在举手”等描述学习动作含义。两条路线分别拥有 FineDance 和 HumanML3D 一类配对数据。[§1–2][paper]

**现有痛点：** 给一首音乐能得到跟拍舞蹈，但动画师希望舞者沿圆弧移动或在舞蹈中举起双手时，仅修改舞种标签很难表达要求。直接接入文字模型又可能让人物突然停止跳舞，转而插入一段普通行走。[§1、图 7][paper]

**核心矛盾：** 要同时学习音乐和文字控制，监督样本最好同时包含三者。现实数据通常只告诉模型“这首音乐对应这段舞”或者“这句话描述这段动作”，两个数据库还存在舞蹈与日常运动的分布差异。[§3.3][bridge]

**本文目标：** 使用已有两类配对数据训练联合条件生成器，使自然语言能改变舞蹈中的运动内容，并保留音乐骨干学到的节奏与动作品质。[§3][method]

**切入角度：** 两套数据都包含动作。先让动作成为共同的检索依据，再把某段动作对应的音乐或文字带到另一套数据里，以相似度过滤明显不可靠的配对。[§3.3、附录 B][bridge]

**核心 idea：** 先建立共同动作空间和检索库，形成带置信度筛选的伪三元组，再交替用两套数据更新文字支路。推理时，音乐继续进入冻结骨干，文字通过逐层残差影响同一次去噪。[图 2、式 5–12][method]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

框架包含数据准备和条件生成两层。准备层先训练音乐舞蹈骨干和跨数据集对齐模块，再建立以动作向量为索引的两个库，补上缺失的文字或音乐。生成层以带噪动作、音乐和文字为输入，共享逐帧动作特征，分别经过冻结的音乐去噪模块与可训练文字支路，合成干净动作预测。DDPM 反复更新后输出完整舞蹈。[§3、图 2–5][method]

<figure class="paper-figure"><a href="/paper-notes/temudance/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/temudance/architecture.svg" alt="TeMuDance 完整框架，训练时通过动作桥接为两套数据库补条件，推理时文字残差逐层进入冻结音乐骨干，DDPM 迭代输出舞蹈。" /></a><figcaption>依据原文图 2–5 和式 5–12 重绘的教学示意。训练数据准备位于上方，下方展开一次生成步骤与采样回线。<a href="/paper-notes/temudance/architecture.svg" target="_blank" rel="noopener">查看大图</a></figcaption></figure>

先沿上方两套数据走到共同动作空间，再看动作库怎样为样本补齐条件。下方绿色支路学习文字残差，蓝色骨干在这一阶段冻结。金色虚线表示训练监督，实线表示计算和条件传递，右侧回线重复去噪。检索库用于构造训练监督，用户生成一段新舞蹈时直接提供音乐与文字即可。[§3.2–3.3][bridge]

### 关键设计

1. **先把音乐舞蹈生成器训练好。** 每个样本为 4 秒、120 帧，逐帧含 52 个关节的 6D 旋转、三维根位置和四个足接触通道，共 319 维。带噪动作先按七个身体组经过层级编码与跨部位融合，再进入时间自注意力、音乐交叉注意力和随扩散时刻调制的前馈模块。网络预测干净动作，训练同时约束关节位置、速度与加速度、足接触，使用 Aligned-MTL 缓解多个损失的梯度冲突。[§3.1、附录 A][backbone]

2. **用动作把两套数据库接起来。** 音乐—舞蹈与文字—动作分别做对比学习，动作编码器在两路中共享，音乐路采用带动量队列的 InfoNCE。仅共享编码器仍可能把舞蹈与日常动作放到两个分离区域，因此作者进一步约束两域动作向量的批均值和协方差接近。这个正则限制域间漂移，为跨数据库寻找相似动作提供基础。[式 7–10][bridge]

3. **检索相似动作，再取出它携带的条件。** 对 HumanML3D 的某条“举手”样本，先用其动作查询 FineDance 中最接近的舞蹈，取出该舞蹈的音乐特征。反向则用 FineDance 动作查询 HumanML3D，取出文字，并附上粗粒度音乐风格标签。相似度低于 0.8 时，用空条件替换检索结果。训练因此包含可靠配对和保留原始监督的空条件样本。附录明确检索对象是动作向量，音乐和文字是检索条目的关联内容。[§3.3.2、附录 B][bridge]

4. **让文字逐层改变去噪结果。** BERT 编码文字，控制支路复制音乐骨干前 K 层的结构，通过文字交叉注意力产生残差。零初始化线性层把残差送入对应冻结层，使支路开始训练时对已有生成器的扰动为零。论文式 5–6 可简写为下式，其中 h 是当前隐藏状态，c_M 和 c_E 分别是音乐和文字条件，Z 是零初始化投影。[§3.2][control]

<div class="equation">h<sup>ℓ+1</sup> = B<sup>ℓ</sup>(h<sup>ℓ</sup>, c<sub>M</sub>, t) + Z<sup>ℓ</sup>(B′<sup>ℓ</sup>(h<sup>ℓ</sup>, c<sub>E</sub>, t))</div>

5. **交替训练以维持文字与音乐的平衡。** 只用补音乐后的日常动作训练，模型可能越来越遵守动作指令，却失去舞蹈品质。因此作者交替使用两种伪三元组，以权重 λ_p 平衡文字控制和音乐舞蹈目标，后续只更新控制支路。推理时还可调节音乐分类器自由引导强度，控制音乐条件的影响。[式 12、图 5–6][bridge]

### 一个完整例子

以论文图 2 的“双手举过头顶”描述为例。训练时，一条带此描述的 HumanML3D 动作进入共享编码器，去音乐舞蹈库寻找近邻。相似度达到阈值后，音乐随同文字和原动作组成伪三元组。舞蹈库也可反向检索到相近描述，为一段原本只有音乐的舞蹈补上文字。这两个方向交替提供训练样本。[图 2、4–5][method]

生成时，用户输入音乐及举手要求。模型从 120 帧噪声开始，音乐交叉注意力提供节奏条件，文字支路逐层调整动作预测。DDPM 多轮更新后，输出连续关节旋转、根位置和接触通道。举手发生的具体帧并未由输入指定，实际完成情况由输出关节位置检查。论文的 `hands_up` 谓词要求双腕高于肩部至少占 8% 的帧，或者单腕满足至少 16% 的帧；该测量只覆盖作者给定的判据。[附录 C、表 10][kpsdef]

### 训练/推理

FineDance 提供 14.6 小时、16 种舞种的音乐舞蹈对，HumanML3D 提供 14,616 段动作及 44,970 条文字。音乐骨干训练 1,000 个 epoch，batch size 为 128，学习率 2×10⁻⁴。文字支路微调 200 个 epoch，batch size 为 96。对齐后的编码器冻结用于建库，音乐去噪骨干在文字微调期间冻结。推理采用 1,000 步 DDPM，默认音乐引导强度为 3。论文没有披露可据以比较的完整训练墙钟耗时。[§4.1][experiments]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

FineDance 音乐驱动舞蹈，摘录原表 1。这里评测音乐生成品质，联合文字控制另看后面的 KPS 表。保留论文原有误差项。[原表 1][table1]

| 方法 | 手部 FID ↓ | 身体 FID ↓ | PFC ↓ | PBC → 真实值 | BAS ↑ |
|---|---:|---:|---:|---:|---:|
| GT | — | — | — | 5.23 ± 0.16 | 0.2318 ± 0.0070 |
| EDGE | 25.37 ± 3.24 | 51.56 ± 3.62 | 0.21 ± 0.03 | 7.78 ± 0.07 | 0.2171 ± 0.0056 |
| FineNet | 26.88 ± 3.09 | 23.59 ± 3.56 | 0.12 ± 0.01 | 3.35 ± 0.11 | 0.2066 ± 0.0046 |
| DGFM | 20.699 ± 3.52 | 24.63 ± 3.14 | 0.20 ± 0.01 | 4.23 ± 0.06 | 0.2153 ± 0.0054 |
| LODGE | 18.36 ± 2.10 | 47.56 ± 1.37 | 0.13 ± 0.01 | 3.46 ± 0.06 | 0.2327 ± 0.0050 |
| TeMuDance | 15.90 ± 3.28 | 23.41 ± 1.78 | 0.19 ± 0.01 | 4.95 ± 0.10 | 0.2342 ± 0.0057 |

FID 比较动作特征分布，BAS 比较音乐拍点与运动拍点，PFC 衡量足接触相关的物理表现，PBC 按原表定义应接近 GT。不同指标分别衡量分布、节拍和物理表现。[§4.1][experiments]

音乐与文字共同输入时，原表 3 通过相同音乐与种子配对比较有文字和空文字结果。KPS 在 30 FPS 的 22 关节三维位置上计算，生成器本身仍输出 52 关节表示。Lift 是两种成功率之差，单位为百分点。[原表 3][table3] · [附录 C][kpsdef]

| 动作谓词 | 有文字成功率 ↑ | 空文字成功率 | Lift ↑ |
|---|---:|---:|---:|
| 下蹲 crouch | 90.0% | 50.0% | +40.0 |
| 举手 hands_up | 50.0% | 0.0% | +50.0 |
| 踢腿 kick | 60.0% | 0.0% | +60.0 |
| 拍手 clap | 20.0% | 0.0% | +20.0 |
| 行进 walk_move | 100.0% | 20.0% | +80.0 |
| 跳跃 jump | 50.0% | 10.0% | +40.0 |
| 转动 turn | 60.0% | 40.0% | +20.0 |
| 挥动 wave | 60.0% | 40.0% | +20.0 |
| 八项宏平均 | 61.3% | 20.0% | +41.3 |

### 消融实验

**动作检索库。** 去除 Motion Bank，姿态、轨迹、旋转和时间四类 KPS lift 从 42、60、20、20 降为 25、30、20、0。轨迹与周期挥动的收益明显减弱，旋转项在该表中持平。[原表 6][table6]

**身体层级编码。** 去除层级编码器，轨迹 lift 从 60 降至 35，姿态从 42 降至 40，但旋转从 20 升至 25，时间项仍为 20。正文将旋转列为主要退化项，与表 6 数字不一致，此处按表格报告。[原表 6][table6]

**双流微调。** 去除交替使用两套数据的策略，四类 lift 变为 35、20、10、20，轨迹控制退化最大。作者的可视化同时观察到舞蹈品质下降。[原表 6、图 8][table6]

**音乐引导强度。** 保持文字开启，把音乐引导从 1 增到 3，BAS 从 0.2041 升至 0.2141，但姿态 lift 从 47 降至 35，轨迹从 65 降至 30，旋转从 30 降至 10，时间项均为 20。强化音乐条件会压低部分文字影响。[原表 5][table5]

### 关键发现

1. **文字能引入音乐本身较少产生的动作。** 举手与踢腿的空文字成功率都为零，加文字后分别达到 50% 和 60%。拍手仍只有 20%，说明不同动作的控制难度差异很大。[原表 3][table3]
2. **舞蹈品质提升与语义控制需分别验证。** FineDance 主表的手部 FID 与 BAS 较好，但 PFC 高于 FineNet 和 LODGE。联合条件下提高音乐引导又会降低部分 KPS lift，单项最优配置无法概括全部用途。[原表 1][table1] · [原表 5][table5]
3. **检索接受率衡量配对置信度。** 阈值 0.8 下，FineDance 查询 HumanML3D 的接受率为 69.15%，反向为 89.51%。这说明两路都大量使用检索补条件，但相似度统计本身不能检验配来的音乐是否与动作逐拍对应。[附录 B、表 8–9][retrieval]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **共同模态能把两套不完整标注连接起来。** 动作在两套数据中都有可编码内容，因此能够作为检索索引，帮助缺文字的舞蹈获得描述、缺音乐的日常动作获得声音条件。这个方案把数据连接问题转化成可测量、可筛选的近邻匹配。[§3.3][bridge]
- **冻结骨干提供稳定的舞蹈基础。** 控制支路以零残差起步，学习文字时仍保留预训练音乐路径，使两种能力可以通过采样强度和训练比例调节。[§3.2、表 5][control]
- **用配对反事实评测检查文字作用。** 同音乐、同种子的空文字对照消除了两类随机变化，lift 更接近“这条文字是否增加了目标动作出现的概率”。动作谓词进一步把评价落到关节位置和运动规律上。[§4.1、附录 C][kpsdef]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **动作谓词覆盖有限。** KPS 检查八类预设模式。比如 `turn` 累计绝对朝向变化超过 90°，无法据此确认转向正确或完整转了一圈；`clap` 采用手腕接近比例，无法保证真实手掌接触或拍手次数。精确编舞还需要时间、方向与接触层面的额外验证。[附录 C、表 10][kpsdef]
- **伪三元组有语义和节奏误差。** 近邻相似性与域分布正则无法保证新音乐原本就与目标动作同步。论文通过过滤与双流训练缓解问题，联合条件实验仍存在 20%–60% 的单项成功率。[附录 B][retrieval] · [原表 3][table3]
- **跨数据集结论需读具体数值。** AIST++ 原表 2 中，TeMuDance 的 kinetic FID 为 32.14，高于 DiffDance 的 24.09 和 Bailando 的 28.16，kinetic diversity 为 5.92，低于 Bailando 的 7.83。正文的部分排名表述与此不一致，跨数据集优势应按各列单独判断。[原表 2][table2]
- **复现仍受预处理材料影响。** 作者仓库提供三个阶段的训练入口，但 README 将 HumanML3D 的 52 关节转换列为待发布。本文没有运行生成器，无法独立确认复现结果或延迟。[官方说明][readme]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **EDGE（CVPR 2023）。** EDGE 建立了音乐驱动的动作扩散与物理接触评测路线。TeMuDance 延续直接动作去噪和运动学损失，通过新增文字支路与伪三元组学习扩展语义控制。[EDGE 原文](https://arxiv.org/abs/2211.10658) · [本文 §3.1–3.2][backbone]
- **TM2D（ICCV 2023）。** 两者都利用音乐舞蹈和文字动作数据。TM2D 使用离散动作编码组织跨数据集生成，TeMuDance 则通过连续动作空间的检索和扩散残差融合条件。本文两者的直接对照主要是可视化与用户偏好，KPS 表没有给出 TM2D 的同协议数字。[TM2D 原文](https://openaccess.thecvf.com/content/ICCV2023/papers/Gong_TM2D_Bimodality_Driven_3D_Dance_Generation_via_Music-Text_Integration_ICCV_2023_paper.pdf) · [本文图 7、表 7][experiments]
- **UniMuMo。** UniMuMo 以统一离散表示处理文字、音乐与动作之间的多种任务。TeMuDance 聚焦音乐生成过程中具体动作指令的控制，把动作库用于构造训练配对，把冻结音乐骨干用于保持舞蹈先验。[UniMuMo 原文](https://arxiv.org/abs/2410.04534) · [本文 §2.3][paper]
- **启发。** 当自然语言需要改变已有条件模型的行为时，可以先用共享模态补监督，再以配对干预评测区分“听见指令”和“输出真的发生变化”。若用于精确演示，需要把评测谓词进一步扩展到指定帧、指定部位和目标方向。这是由本文机制推导的应用思路。[附录 C][kpsdef]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- 原始技术依据为署名 arXiv:2604.17005v1，正文及附录 A–C。数据表根据原表 1、3、5–6、8–10 整理，架构图根据原图 2–5 重绘为教学示意。[论文记录][abs] · [HTML 全文][paper] · [PDF](https://arxiv.org/pdf/2604.17005v1)
- 正式会议出处由 ACM Multimedia 2026 日程核实。作者官方仓库及项目页用于核对发布状态，更新核查于 2026 年 11 月 3 日。仓库 README 顶部还使用旧副标题 Zero-Shot Textual Control，本文题名与技术说明采用署名论文的新副标题。[会议日程][venue] · [官方代码][code] · [README][readme] · [作者演示][project]

</div>

[abs]: https://arxiv.org/abs/2604.17005
[paper]: https://arxiv.org/html/2604.17005v1
[method]: https://arxiv.org/html/2604.17005v1#S3
[backbone]: https://arxiv.org/html/2604.17005v1#S3.SS1
[control]: https://arxiv.org/html/2604.17005v1#S3.SS2
[bridge]: https://arxiv.org/html/2604.17005v1#S3.SS3
[experiments]: https://arxiv.org/html/2604.17005v1#S4
[table1]: https://arxiv.org/html/2604.17005v1#S3.T1
[table2]: https://arxiv.org/html/2604.17005v1#S4.T2
[table3]: https://arxiv.org/html/2604.17005v1#S4.T3
[table5]: https://arxiv.org/html/2604.17005v1#S4.T5
[table6]: https://arxiv.org/html/2604.17005v1#S4.T6
[retrieval]: https://arxiv.org/html/2604.17005v1#A2
[kpsdef]: https://arxiv.org/html/2604.17005v1#A3
[code]: https://github.com/surrey-nlp/TeMuDance
[venue]: https://2026.acmmm.org/site/technical-programme.html
[readme]: https://github.com/surrey-nlp/TeMuDance#data-preparation
[project]: https://xinranliu7715.github.io/temudance-page/
