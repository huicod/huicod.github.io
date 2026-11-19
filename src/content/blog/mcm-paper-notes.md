---
title: "[IJCAI2024] MCM：用动作指令和声音共同驱动舞蹈与说话手势"
description: "同一段演讲里，怎样指定左手叉腰，同时让身体跟随说话节奏？从 MWNet 的通道注意力、冻结主干和逐层音频控制，读懂 MCM 的训练方式与实验边界。"
pubDate: "2026-11-19T14:10:00+08:00"
updatedDate: "2026-11-19"
badge: "Paper"
tags: ["MCM", "MWNet", "Motion-Generation", "Dance-Generation", "Co-Speech-Gesture", "Diffusion", "Multi-Modal", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 阅读版][html] · [IJCAI 正式 PDF][pdf] · [作者演示][project] · [作者代码][repo]

<details class="paper-meta"><summary>论文信息与阅读范围 · IJCAI 2024 · 文本与音频联合控制动作</summary>

*MCM: Multi-condition Motion Synthesis Framework*。作者为 Zeyu Ling、Bo Han、Yongkang Wong、Han Lin、Mohan Kankanhalli、Weidong Geng，发表于 IJCAI 2024 主会，页码 1083–1091。下文按会议 PDF 标表号，旁附 arXiv HTML 对应表。研究方向涵盖文本生成动作、音乐生成舞蹈与语音生成手势。[正式出版记录][record] · [arXiv v1][html]

作者提供代码和视频。本文核对了去噪网络、训练配置和伪文本脚本。所查原始仓库和项目页未列出可直接下载的 MCM 预训练权重，本次未运行模型。实验数字均为作者报告。[固定版本代码][repo] · [演示][project]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给一段讲话再加一句“说话时左手叉腰”，MCM 让文字和声音共同参与每一步动作去噪。作者先训练一个理解动作文字的生成器，再复制出一条能听声音的分支，让它逐层调整原生成器，输出 22 个身体关节的连续动作。[原文图 2][fig2] · [图 4 示例][fig4]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 文本生成动作主要学习“做什么”，音乐生成舞蹈、语音生成手势则能从声音中学习“怎样随时间动”。HumanML3D 提供动作描述，AIST++ 提供音乐与舞蹈，BEAT 提供演讲及同步动作，三者的监督粒度不同。[原文 §1、§4.1][data]

**现有痛点：** 音频没有规定说话者要不要叉腰，单独一句“左手叉腰”也没有重音与停顿。已有工作可分别生成受文字和音乐控制的离散动作，再替换片段或合并预测，但同一段手臂动作如何同时满足两条线索仍难判断。[原文 §2.3][related]

**核心矛盾：** 文字通常概括整段动作，音频特征逐帧变化。能同时说明“手做了什么、何时跟着哪一拍动”的细粒度标注稀少，直接用较窄的音频动作数据微调文字模型，还有削弱它原有动作词汇的风险。[原文 §1][html]

**本文目标：** 复用已经训练好的文本动作扩散模型，加入音乐或讲话作为第二个条件。测试既包括文本单独驱动身体，也包括文字与音频同时控制舞蹈或手势。[原文 §3.1][problem]

**切入角度：** 保留文字主干的参数，复制相同结构作为可训练的控制支。学习声音时，模型只需找到在原有动作预测上应当添加哪些修正。[原文 §3.2][framework]

**核心 idea：** 音频控制支看到声音、有噪动作和动作文字。它在每层计算一次修正量，交给冻结主干的对应层。起初这些修正量全为零，后续训练才使输出随音频变化。[原文图 2][fig2]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

MCM 命名的是双分支框架，MWNet 是作者为它设计的文字动作主干之一。同样的框架也测试了 MDM、MotionDiffuse 两种主干。设整段动作有 T 帧，在每个扩散步，模型读取 T × 263 的有噪动作、动作描述及对应的音频特征，输出对干净动作的估计。采样器反复更新，得到随时间连续变化的身体姿态。[原文 §3][framework] · [原文 §4.3][impl]

<figure class="reading-figure"><a href="/paper-notes/mcm/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/mcm/architecture.svg" alt="MCM 双分支与两阶段训练。文字和有噪动作送入两支，音频送入可训练控制支，各层通过零初始化的投影修正冻结主干，最后重复去噪得到动作。" loading="lazy" /></a><figcaption>教学示意，可点击放大。上方是先预训练、再复制和冻结的顺序。中部画出一次去噪，沿棕色箭头可见音频从哪里影响主干。下方放大 MWNet 内部的注意力顺序。依据原文图 2、3 及公开实现重绘。</figcaption></figure>

### 关键设计

1. **把文字和声音放到各自合适的时间尺度。** CLIP 提供文字特征，动作序列可以通过交叉注意力读取动作词。Jukebox 从音乐或讲话中提取连续特征，下采样至动作的 20 Hz，再投影到与动作隐向量相同的宽度，逐帧相加。这里送入的是声音的神经网络特征，模型没有显式读入逐拍事件、手势起止标签或语音转写。[原文 §4.3][impl] · [网络实现][net]

2. **在每个对应层的输入处加入修正。** 主干和控制支都从当前有噪动作出发，控制支额外收到对齐的声音。若第 i 层控制支输出为 cᵢ，桥的投影为 Bᵢ，主干层实际读到的是自身输入 hᵢ 加 Bᵢ(cᵢ)。Bᵢ 初始全零，连接时可以精确恢复原主干当时的输出。训练完成后，两种条件会持续共同影响姿态。冻结权重本身并不能保证变化后的输出仍满足任意文字。[原文图 2][fig2] · [网络实现][net]

3. **在 MWNet 中分别学习跨帧、跨通道的关系。** 时间自注意力形成帧与帧的关联，例如转身前后的身体姿势。通道自注意力把隐通道分组，在组内学习通道间的关联，有助于表达伴随转身的肩、髋协同；隐通道没有被指定为某一根骨骼。所选顺序是通道注意力、前馈、时间注意力、文本交叉注意力、前馈，各子模块后用 FiLM 注入扩散步信息。该顺序在消融中降低了 FID，同时牺牲一部分同提示多样性。[原文图 3][fig3] · [原文表 3][abl]

4. **统一输出格式，明确模型能编辑到哪里。** 三套数据都转换为 20 帧/秒、22 关节的 HumanML3D 表示。每帧 263 维包含根运动、身体局部位置与旋转、关节速度以及四个脚部接触特征。这一表示足以表现手腕抬高、左臂叉腰等全身姿态；手指屈伸、口型以及手与物体的接触没有独立控制接口。[原文 §4.1][data]

### 一个完整例子

会议版图 4a 给了一段演讲声音，附加要求是“讲话时把左手放在髋部”。文字编码保留“左手”和“髋部”的关联，声音分支提取随讲话变化的时序特征。假设为便于理解截取 4 秒，20 Hz 下就是 80 帧，待生成动作的形状为 80 × 263。采样开始时还看不出手臂姿势；每一步，控制支读取这时的动作估计、音频和文字，主干接收逐层修正。收敛后可由身体关节轨迹观察左臂的姿态。4 秒与中间形状是教学示例。作者展示了最终姿态，没有报告手腕与髋的距离、叉腰持续时间或同一条件的成功率。[原文图 4][fig4] · [作者演示][project]

### 训练 / 推理

- **预训练与音频适配。** 先做文本生成动作，再复制主干加入音频控制。作者将 AIST++ 与 BEAT 的音频动作样本补上伪文本。公开的舞蹈脚本从舞种、表演形式等拼出句子；演讲脚本为每段随机抽取三条“人在演讲、伴随身体动作”一类表述，且不提供局部时间区间。这说明模型能借用预训练已有的动作语义，并没有从这些模板获得“哪一个词对应哪一次指向”的标注。[原文 §4.1][data] · [舞蹈伪文本][dancecode] · [演讲伪文本][speechcode]
- **训练设置。** 论文报告 1,000 步 DDPM、线性噪声日程（β 从 0.0001 到 0.02）、两阶段均用 Adam，学习率 0.0002，网络预测干净动作。公开仓库的 MWNet 示例配置则写 AdamW、0.0001；音乐控制与语音控制分别有训练配置。应区分论文配方和仓库默认值。原文未给完整训练用时或 GPU 小时。[原文 §4.3][impl] · [主干配置][cfg] · [音乐配置][musiccfg] · [语音配置][speechcfg]
- **推理接口。** 仅使用文字时由文字主干生成。双条件时，在匹配任务的控制配置下输入动作描述和对应声音，从高斯噪声迭代得到动作。公开训练配置分别指向 AIST++ 和 BEAT，仅凭它们无法确认一份权重同时完成音乐与讲话两种音频任务。[原文 §3.2][framework] · [网络实现][net]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**文本 → 动作，HumanML3D 测试集。** 对应会议版与 arXiv 表 1，节选方法和均值。R@1 / R@3 检查检索时正确文字是否排在前 1 / 3 名；FID 越低，动作特征分布越接近真实数据。MultiModality 衡量同一句文字多次生成的变化幅度。这张表评的是单独的文字主干。[原表 1][texttable]

| 方法 | R@1 ↑ | R@3 ↑ | FID ↓ | 文本动作距离 ↓ | MultiModality ↑ |
| --- | ---: | ---: | ---: | ---: | ---: |
| MDM | 0.320 | 0.611 | 0.544 | 5.566 | 2.799 |
| MotionDiffuse | 0.491 | 0.782 | 0.630 | 3.113 | 1.553 |
| ReMoDiffuse | **0.510** | **0.795** | 0.103 | **2.974** | 1.795 |
| MWNet | 0.502 | 0.788 | **0.053** | 3.037 | 0.8104 |

**音乐 → 舞蹈，AIST++ 验证集和测试集。** 对应会议版表 4、arXiv 表 2。FIDₖ、FIDᵍ 分别使用运动学与几何特征；BAS 衡量音乐节拍和动作速度局部低点的接近程度。作者训练时每段最长 196 帧，评测把 20 Hz 生成动作线性插值到 60 Hz。[会议表 4][pdf7] · [HTML 表 2][dancetable]

| 方法 | FIDₖ ↓ | FIDᵍ ↓ | BAS ↑ |
| --- | ---: | ---: | ---: |
| 真实动作（参照） | 17.10 | 10.60 | 0.2374 |
| UDE | 17.25 | **8.69** | 0.231 |
| TM2D | 19.01 | 20.09 | 0.204 |
| EDGE | — | 23.04 | 0.270 |
| MotionDiffuse 单支微调 / MCM | 45.22 / 44.27 | 13.21 / 13.43 | 0.273 / 0.266 |
| MDM 单支微调 / MCM | 47.39 / 39.21 | 22.07 / 19.55 | 0.258 / 0.265 |
| MWNet 单支微调 / MCM | 34.73 / **15.57** | 20.25 / 25.85 | 0.249 / **0.275** |

**文字＋音乐 → 舞蹈，20 人匿名二选一。** 对手是 TM2D，AIST++ 取 10 段音乐，另取 5 段库外音乐，每段配舞蹈描述。数值是偏好 MCM 的比例。这是对舞蹈的人工比较；论文为文字＋讲话展示了手势案例，没有给出与此对称的共语手势定量表。[会议表 2][pdf6] · [HTML 表 4][users] · [图 4][fig4]

| 音乐来源 | 节拍对齐偏好 | 文字匹配偏好 | 整体动作质量偏好 |
| --- | ---: | ---: | ---: |
| AIST++ | 95.0% | 95.5% | 93.0% |
| 库外音乐 | 69.0% | 74.0% | 62.0% |

### 消融实验

**把通道注意力放在哪里？** 作者在 HumanML3D 上固定训练 500 个 epoch，更换 MWNet 解码块的组成与顺序。T 表示时间自注意力，C 表示文本交叉注意力，S 表示通道自注意力，F 表示前馈网络。结果按论文表 3 均值，训练预算与表 1 不同。[会议表 3][pdf7] · [HTML 表 3][abl]

| 块内顺序 | R@1 ↑ | FID ↓ | 文本动作距离 ↓ | MultiModality ↑ |
| --- | ---: | ---: | ---: | ---: |
| T / C / F | 0.389 | 1.081 | 3.772 | **3.033** |
| T / C / F / T / F | 0.423 | 0.825 | 3.577 | 2.788 |
| T / F / T / C / F | 0.431 | 0.586 | 3.472 | 2.152 |
| T / C / F / S / F | **0.455** | 0.751 | 3.399 | 1.707 |
| S / F / T / C / F（MWNet） | **0.455** | **0.377** | **3.349** | 1.481 |

**双分支与直接微调。** 同一个 MWNet 加双支后，FIDₖ 从 34.73 降至 15.57，BAS 从 0.249 升至 0.275，FIDᵍ 却从 20.25 升至 25.85。换成 MotionDiffuse，双支的 BAS 为 0.266，还略低于单支的 0.273。双支改善哪些性质，与所选主干和指标有关。[会议表 4][pdf7]

### 关键发现

1. **文字主干的优势主要在分布质量。** MWNet 的 FID 最低，ReMoDiffuse 的 R@1、R@3 仍更高；同一提示下，MWNet 的生成变化也小于其余三个列出的方法。[原表 1][texttable]
2. **舞步踏准和几何姿态像真可以分开。** MWNet＋MCM 在运动学 FID 和节拍指标上表现好，几何 FID 却明显落后于 UDE。BAS 甚至高于真实动作参照，不能把它直接换算成自然舞蹈的成功率。[会议表 4][pdf7]
3. **域内舞蹈的高偏好没有等幅延伸到库外音乐。** 库外的动作质量偏好回落到 62%，而该组只有 5 段曲目。对演讲手势的文字遵循程度，还需要单独测量。[会议表 2][pdf6]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **可做一个有意义的对照。** 在同一主干上关闭音频支、直接微调、添加逐层桥接，分别对应“原模型会什么”“将全部参数改成听声音如何”“保留文字主干还能学到什么”。论文对后两者给出了同一数据集下的舞蹈测量。[原文 §4.7][ablation]
- **动作表征可以统一，监督仍有强弱。** 数据都转成 263 维后可以共享姿态生成器，但“人在演讲”对具体动作的约束远弱于“左手叉腰”。代码中训练标签的生成方式解释了为什么动作指令的细节主要还得借助文字主干。[演讲伪文本脚本][speechcode] · [原文图 4][fig4]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **同一身体部位发生冲突时，优先权未测。** 例如动作描述要求左手整句保持在髋部，语音强调处通常伴随挥手。两路特征都会影响左臂，文中没有指定谁优先，也没有报告保持时长、逐关节误差或冲突指令成功率。[原文 §4.6][both]
- **讲话与舞蹈的证据量不同。** 语音侧定性演示支持生成可能性，整段模板无法检验词义和手势的一一对应；舞蹈侧才有成对偏好与节拍指标。22 关节输出也无法回答手指形状或语音口型问题。[原文图 4][fig4] · [数据与指标][data]
- **公开材料与论文训练配方有差别。** 独立仓库能核对逐层修正和条件数据流；默认优化器、学习率与正文不同，且该快照中的训练损失函数末尾止于构造目标张量。要复核原表还需确定实际训练入口、权重和运行配置。[模型代码][net] · [默认配置][cfg] · [论文设置][impl]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **TM2D。** 两者都允许音乐和动作文字共同控制舞蹈。TM2D 在动作 token 的生成预测上进行时序组合；MCM 在连续动作去噪的每一层注入声音。它是论文双条件人工评测实际对照的方法。[站内 TM2D 解读](/blog/iccv2023-tm2d/) · [MCM 双条件实验][both]
- **SynTalker。** 同样可以把讲话声音和额外的全身动作要求一起输入。SynTalker 对身体分区并组合条件，MCM 的音频修正覆盖整段动作隐特征；比较时可以问同一个具体问题——一只手被指定动作占用时，另一只手与身体还能否自然跟随讲话。[站内 SynTalker 解读](/blog/acmmm2024-syntalker/) · [MCM 架构][fig2]
- **对演讲角色的启发。** 可固定同一段声音，分别要求左手叉腰、右手叉腰、双手自然垂下，测指定手的位置、保持时长及自由手在重音处的活动。这样能分别检验文字改变了哪个部位，以及节奏还保留多少。这是本篇解读根据作者演示提出的测试思路。[MCM 演示][project]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 会议正式记录与两个全文版本。[IJCAI 2024][record] · [正式 PDF][pdf] · [arXiv HTML][html]
- 原文方法与实验。[架构图 2][fig2] · [HumanML3D][texttable] · [AIST++][dancetable] · [人工偏好][users] · [结构消融][abl]
- 作者材料。[项目页及四组演示][project] · [原始仓库固定版本][repo] · [控制网络][net] · [数据处理脚本][speechcode]

</div>

[record]: https://www.ijcai.org/proceedings/2024/120
[pdf]: https://www.ijcai.org/proceedings/2024/0120.pdf
[pdf6]: https://www.ijcai.org/proceedings/2024/0120.pdf#page=6
[pdf7]: https://www.ijcai.org/proceedings/2024/0120.pdf#page=7
[html]: https://arxiv.org/html/2404.12886v1
[related]: https://arxiv.org/html/2404.12886v1#S2.SS3
[problem]: https://arxiv.org/html/2404.12886v1#S3.SS1
[framework]: https://arxiv.org/html/2404.12886v1#S3.SS2
[fig2]: https://arxiv.org/html/2404.12886v1#S3.F2
[fig3]: https://arxiv.org/html/2404.12886v1#S3.F3
[data]: https://arxiv.org/html/2404.12886v1#S4.SS1
[impl]: https://arxiv.org/html/2404.12886v1#S4.SS3
[fig4]: https://arxiv.org/html/2404.12886v1#S4.F4
[both]: https://arxiv.org/html/2404.12886v1#S4.SS6
[ablation]: https://arxiv.org/html/2404.12886v1#S4.SS7
[texttable]: https://arxiv.org/html/2404.12886v1#S4.T1
[dancetable]: https://arxiv.org/html/2404.12886v1#S4.T2
[abl]: https://arxiv.org/html/2404.12886v1#S4.T3
[users]: https://arxiv.org/html/2404.12886v1#S4.T4
[project]: https://fluide1022.github.io/MCM/
[repo]: https://github.com/fluide1022/MCM/tree/ac0a5832df69e1bdf3817b70c8abbb75db31ae49
[net]: https://github.com/fluide1022/MCM/blob/ac0a5832df69e1bdf3817b70c8abbb75db31ae49/mcm/models/mcm.py
[cfg]: https://github.com/fluide1022/MCM/blob/ac0a5832df69e1bdf3817b70c8abbb75db31ae49/configs/mcm/mcm_no_control.py
[musiccfg]: https://github.com/fluide1022/MCM/blob/ac0a5832df69e1bdf3817b70c8abbb75db31ae49/configs/mcm/mcm_control_m2d.py
[speechcfg]: https://github.com/fluide1022/MCM/blob/ac0a5832df69e1bdf3817b70c8abbb75db31ae49/configs/mcm/mcm_control_speech.py
[dancecode]: https://github.com/fluide1022/MCM/blob/ac0a5832df69e1bdf3817b70c8abbb75db31ae49/scripts/data_preprocess/aist/gen_text.py
[speechcode]: https://github.com/fluide1022/MCM/blob/ac0a5832df69e1bdf3817b70c8abbb75db31ae49/scripts/data_preprocess/beat/gen_text.py
