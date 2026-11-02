---
title: "[ICCV2025] MotionMillion：百万级动作数据如何改变文本生成动作的零样本表现"
description: "从持剑转身的例子，拆解 MotionMillion 的视频重建、动作小波与标量量化、自回归生成，以及 126 条提示上的人工评测。"
pubDate: "2026-11-01T14:44:00+08:00"
badge: "Paper"
tags: ["MotionMillion", "Text-to-Motion", "Motion-Tokenizer", "Zero-Shot", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · ICCV 2025</summary>

*Go to Zero: Towards Zero-shot Motion Generation with Million-scale Data*，作者 Ke Fan、Shunlin Lu、Minyue Dai、Runyi Yu、Lixing Xiao、Zhiyang Dou、Junting Dong、Lizhuang Ma、Jingbo Wang。发表于 ICCV 2025，第 13336–13348 页。MotionMillion 是数据集，MotionMillion-Eval 是评测提示集，正文另报告 1B、3B、7B 三种生成模型。以下基于正式主文 13 页、独立补充 6 页、作者公开代码与数据卡，核查日期为 2026-11-01。[CVF 会议页][cvf] · [主文][paper] · [补充][supp] · [作者项目页][project]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

作者将已有动作库与网络视频重建的人体动作汇合，制作 MotionMillion，用它训练一个从文字逐个预测动作码的模型。在 126 条开放提示上，从 1B 扩到 7B 带来的提升主要体现在**动作更符合文字**。例如，模型要表达“先停住，再迅速转身挥刀”的动作顺序，身体是否平顺、是否真正满足物理约束，则需要另外评估。[表 4–6、图 6][paper]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** HumanML3D 等数据集让模型学到短文本与动捕片段之间的对应。固定测试集上的检索得分能说明模型有没有生成接近描述的动作，却很难回答它能否执行陌生的风格或长组合。[§1–2][paper]

**现有痛点：** “走路”容易被概括成一段步态，“僵尸缓慢拖着脚、双臂僵硬前伸”还要求同时改变速度、姿态和风格。模型若认出了行走，却漏掉拖步或伸臂，单个总体指标很难指出漏了哪一项。[图 6、§5.4][paper]

**核心矛盾：** 扩大数据要靠单目视频和已有动作库，视频切镜、主体遮挡及错误的三维重建也可能随规模放大。生成器还要把高频变化压成离散码，编码误差会传到最后的关节轨迹。[图 2、表 3][paper]

**本文目标：** 扩充训练动作和描述的覆盖范围，扩大生成器，并通过专门的提示集检验域外指令和复杂组合。训练、动作重建和开放提示评测分别回答不同的问题。[§1、§4–5][paper]

**切入角度：** 在采集端用镜头、轨迹和关节信号清洗数据。建模端先训练动作编解码器，再让自回归模型预测离散码。评价端让人分别观察文本一致性、平滑度和物理合理性。[图 2、图 5、表 5][paper]

**核心 idea：** 给模型看更多不同的身体动作和表达同一动作的多种句子，并让更大的生成器学习“给定这段文字和刚才已经做的动作，下一小段身体运动应该是什么”。最后检查扩容究竟改善了哪一种能力。[§3.3、§4.3、表 4–5][paper]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

给一句新提示时，MotionMillion 先预测动作码，再把码解回骨骼；训练时这两个能力分开学习。编解码器先从连续动作得到可重建的离散码，文本生成器随后把这些真实码作为监督，学习根据整句文字与已有动作前缀预测下一枚码。[主文图 5、式 3–5][paper]

<figure class="paper-figure"><a href="/paper-notes/motionmillion/architecture.svg?v=arch-20261102-r2" target="_blank" rel="noopener"><img src="/paper-notes/motionmillion/architecture.svg?v=arch-20261102-r2" alt="MotionMillion 先汇合新视频与既有数据，训练小波与 FSQ 动作编解码器，再用真实码监督下一码预测；新提示通过生成器和解码器得到骨骼。" /></a><figcaption>图据正式主文图 2、5–6 和补充图 2 重绘。实线为数据或索引，虚线是重建或下一码监督；小波路径按正文配置绘制。 <a href="/paper-notes/motionmillion/architecture.svg?v=arch-20261102-r2" target="_blank" rel="noopener">查看原图</a></figcaption></figure>

在 **01** 看清成对的动作与文字从哪里来。沿 **02** 的上排读到 FSQ 码，再沿下排逆向看到重建误差从何处计算。**03** 的输入前缀来自真实示范，**04** 同一位置换成模型自己生成的码。这样的区分也对应表 2–3 的重建测试和表 4–6 的文字生成测试。[主文图 5、表 2–6][paper] · [公开量化器][fsq] · [示例采样函数][sample]

### 关键设计

1. **先从视频中取到可用的三维人体轨迹，再与现有动作库汇合。**

   新采集分支依次处理镜头切分、人物检测与跟踪、检测框置信度过滤、镜头过渡过滤、SMPL 运动估计和动作质量过滤。Grounding DINO 找人、SAM2 延续人物身份，再用 GVHMR 从单目视频估计身体姿态、根朝向、平移及形状。逐帧根朝向变化和关节位置的三阶时间导数（jerk）用于找突变，Isolation Forest 筛掉异常。最后统一到 30 fps。这里得到的是视觉估计的三维动作，快速转身也可能带来较大变化，过滤分数本身不是动捕精度。[§3.1–3.2、图 2][paper]

   数据还纳入 BABEL、AIST、Motion-X、Inter-Human 等既有来源。表 1 的约 200 万条、超过 2,000 小时是**整个数据集**的口径，主文称片段超过 1 秒。作者数据卡区分自采的 MotionGV、既有数据与镜像目录，没有按同一套口径公布独立原始视频数、演员数，或各来源去重后的份额。论文处理主体身体，未建模细致的手指和面部表情。[§3、表 1][paper] · [数据卡][data]

2. **把身体运动与描述配对，再扩充说法。**

   在新采视频分支，GPT-4o 看裁定目标人物的片段，标题有关联时也可作为线索。补充图 2 的提示要求指出主要部位、先后顺序和时间演变，可选描述风格、环境或情绪。随后 Llama-3.1-8B 在尽量保留原意的条件下改写 20 次。表 1 的文字多样性“>20”反映同一运动的多种配文，不会增加新的独立动作，也不提供某个动词对应哪几帧的人工区间。描述提到人物年龄或舞台场景，不等于身体轨迹里有这些属性的真值。[§3.3、表 1][paper] · [补充图 2][supp]

3. **让每个动作码来自一组量化坐标，并保留从码返回关节运动的路径。**

   每帧表示记录地面上根节点的两个线速度、6D 根角速度，以及 22 个关节相对根部的局部位置、速度和 6D 旋转，合计 272 维。保留旋转使输出可转回骨骼相对旋转，减少从位置重新做逆运动学的依赖。这是表示可转换的性质，经过离散压缩的整条序列仍有可测的重建误差。[补充 §1.1][supp] · [表 2–3][paper]

   论文在运动时间轴上先做小波变换，把慢变化与快变化分开交给编码器。FSQ（有限标量量化）将编码器的每个潜坐标限制在有限范围，再将其四舍五入到该维的档位。把一组档位编号组合起来即是一个动作 token。解码时从编号还原这组坐标，经运动解码器和逆小波变回动作。若若干相邻帧中的细节被抹平，重建误差和加速度会分别反映姿态偏差和抖动程度。这里的码描述局部运动，论文没有赋予某一位“挥刀”或某个频带“左臂相位”的语义。[图 5、式 3–4、表 3][paper]

   在固定作者代码里，示例参数名为 65,536，实际选用档位为 8×8×8×5×5×5，即 **64,000** 种组合。FSQ 对各维作带偏置的 tanh 限幅并舍入，生成头从量化器实际大小确定动作词表。能表示这么多组合，不意味着训练中它们都被等频使用。[档位配置][vq] · [FSQ 实现][fsq] · [推理入口][infer]

4. **让文本读完整句，让动作只读已经发生的部分。**

   T5-XL 产生词级条件，混合注意力块允许文字之间双向交互，动作预测则依赖全句文字和先前动作码。模型在每一步把下一个码看作分类目标，以交叉熵学习条件概率。训练可用真实前缀；生成过程中，一旦模型选错前一个码，后续步骤也会看到这个选择。生成器并没有拿到指定“第 60 帧开始挥刀”的动作脚本。[§4.3、式 5][paper]

   作者发布的单条推理入口使用冻结的 Flan-T5-XL，可分别对改写提示与原句推理。其实际采样调用选用最大概率的码，遇结束标记停止，该函数最多返回 50 个动作码，然后调用解码器并反归一化。这是该提交示例的输出边界，论文图 6 没有披露每个样例的逐步采样日志。[单条 7B 参数][single] · [推理入口][infer] · [采样函数][sample]

### 一个完整例子：给出持刀动作的描述之后

取图 6 中的持刀动作，意为“持刀者先停住，随后迅速转身、举刀并挥砍”。作者展示了这段提示对应的生成姿态，以下中间步骤用来解释机制，没有重跑样例。[图 6][paper] · [项目展示][project]

- **输入。** T5 将整段话变成一串文本特征。表示“停住”和“迅速”的词都可参与各步动作预测，文本没有为它们指定起止时间。
- **生成。** 起初只有文字。分类头先产生第一个动作码，然后在文字和已选码的共同条件下继续预测。动作码携带肩、躯干和腿的协调变化，训练目标来自编码后的完整动作，未要求模型按动词逐一吐出标签。
- **解码。** 所有生成码经动作解码器还原为连续身体序列。可以从骨架观察转体、上肢抬升和挥动。数据没有输出一把刀的独立位置、握持接触或刀尖轨迹。
- **验收。** “是否先停再转、再挥”要在输出时间线上检查。图 6 是定性例子，表 5 报告整句匹配的人工评分，未提供这几个子动作的分项命中率或持续时间误差。[表 5–6][paper] · [评分标准][supp]

### 训练、推理与公开状态

FSQ 按论文式 4 优化重建，生成器在预先提取的动作码上训练。公开 tokenizer 训练脚本采用 96 帧窗口、4 张 GPU、Smooth L1 及加权速度项，与正文简化的平方重建损失应区别阅读。3B 和 7B 训练脚本分别采用 ZeRO-1 与 ZeRO-2。本文核查的是固定提交中的配置，未取得复现原表的完整日志、训练总 GPU 小时或同硬件推理时延。[训练说明][repo] · [tokenizer 参数][train] · [训练损失][loss]

**小波配置有一处值得复核。** 正式图 5 和表 3 分别定义小波路径和有／无小波消融。固定提交的 tokenizer 训练和 7B 单条推理示例虽传入 Haar 选项，却同时指定 `patch_size=1`。其中正、逆 Haar 模块均循环 `log₂(patch_size)` 层，取 1 时是零层，模块直接返回输入。照这份脚本运行不能据此确认论文中的小波实验已被重现，也不能倒推作者训练所有历史权重时都采用该参数。[正式表 3][paper] · [Haar 正逆变换][wave] · [训练示例][train] · [推理示例][single]

截至 2026-11-01，作者仓库公开训练、推理、后处理和测评入口，下载脚本列出 FSQ 以及分别按 `train.txt`、`all.txt` 训练的 3B、7B 权重链接，README 将 7B-all 标为其推荐的开放提示模型。不能用 all 版本推出严格留出集成绩。数据卡要求授权，并说明只提供可再分发的部分 272 维动作及配文等材料，BABEL、AIST、HumanML3D 需分别取得并转换。本次未申请数据权限、下载大权重或实际运行模型。[权重清单][weights] · [数据卡][data] · [作者 README][repo]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 前提：MotionMillion 的规模

主文表 1 摘取与规模判读直接有关的三个数值列。“—”表示原表未报。文字多样性沿用原表口径。[正式表 1][paper]

| 数据集 | 片段数 | 小时数 | 文字多样性 |
|---|---:|---:|---:|
| KIT-ML | 3,911 | 11.2 | 1–3 |
| BABEL | 13,220 | 43.5 | 1 |
| HumanML3D | 14,616 | 28.6 | 1–3 |
| Motion-X | 81,084 | 144.2 | 1 |
| MotionBase | 1M | — | — |
| MotionMillion | 2M | >2,000 | >20 |

### 主实验一：能否把已有动作压成码再还原？

主文表 2，各列是在相应数据上的重建 MPJPE（平均关节位置误差），越低越好。原表未标物理单位。ScaMo 的 FSQ 在 MotionUnion 上训练，本文 FSQ 在 MotionMillion 上训练；两者参数量相同，训练集和表示设计仍有差异。[正式表 2][paper]

| 方法 | HumanML3D | MotionX | MotionMillion |
|---|---:|---:|---:|
| ScaMo | 63.3 | 84.1 | 88.9 |
| 本文 | 41.9 | 57.4 | 45.5 |

### 主实验二：增大模型后，文本生成改善多少？

主文表 4 使用在 MotionMillion 上训练的评估器。FID 越低越好，R@k 是检索正确文本进入前 k 的比例，越高越好。[正式表 4][paper]

| 方法 | FID ↓ | R@1 ↑ | R@2 ↑ | R@3 ↑ |
|---|---:|---:|---:|---:|
| ScaMo | 89.0 | .67 | .81 | .87 |
| 本文 1B | 31.3 | .74 | .87 | .92 |
| 本文 3B | 10.8 | .79 | .91 | .94 |
| 本文 7B | 10.3 | .79 | .90 | .94 |

**改变模型规模。** 1B 到 3B 的 FID 降低 20.5，3B 到 7B 仅再降 0.5。后两者的 R@1 和 R@3 相同，R@2 从 .91 降到 .90。文本检索靠近不等于逐个满足文字提及的部位、次序与时间要求。[正式表 4][paper]

### 主实验三：MotionMillion-Eval 的开放提示人工评分

主文表 5，在 126 条提示上人工评价文本一致性、物理合理性和平滑度。补充 §3 规定每项逐例打 1–4 分，而表 5 列出的是整组汇总尺度（如 261），不能当成单个样本的均分或成功率。作者未给出逐提示评分、置信区间或从原始打分到小数汇总值的完整算式。[正式表 5][paper] · [补充评判标准][supp]

| 方法 | 文本一致性 ↑ | 物理合理性 ↑ | 动作平滑度 ↑ |
|---|---:|---:|---:|
| MDM | 195.5 | 478.5 | 416.5 |
| MotionGPT | 170 | 497 | 501.5 |
| T2M-GPT | 207 | 495.5 | 500 |
| ScaMo-3B | 226.6 | 477.5 | 494 |
| 本文 1B | 170.3 | 497 | 501 |
| 本文 3B | 238.6 | 496 | 499.5 |
| 本文 7B | 261 | 495.5 | 501 |

**改变规模，分项看结果。** 1B 到 7B 文本一致性持续上升。物理合理性从 497 变成 495.5，平滑度两端均为 501。论文所称物理合理性由人目测，未测碰撞穿透、接触力或脚底滑移。

正式表 6 对 7B 和 ScaMo-3B 作偏好投票。每格依次是本文模型的**胜／平／负**，按原表分别列出三位专业标注者。[正式表 6][paper]

| 提示类别（条数） | 标注者 1 | 标注者 2 | 标注者 3 |
|---|---:|---:|---:|
| 全部（126） | 45／49／32 | 32／76／18 | 47／53／26 |
| 艺术／舞蹈（2） | 1／0／1 | 0／2／0 | 1／0／1 |
| 格斗（6） | 3／2／1 | 2／2／2 | 3／2／1 |
| 交流（20） | 5／13／2 | 3／16／1 | 8／11／1 |
| 日常生活（74） | 24／27／23 | 21／40／13 | 25／31／18 |
| 非人类行为（2） | 2／0／0 | 0／2／0 | 0／1／1 |
| 体育（16） | 6／6／4 | 5／9／2 | 7／6／3 |
| 工作（6） | 4／1／1 | 1／5／0 | 3／2／1 |

三位标注者的总胜数均高于负数，三人各自的平局数也都高于胜数。日常生活占 74／126，艺术／舞蹈和非人类行为各只有两条。固定作者提示文件有 126 个非空条目；去掉首尾空白按字符串去重为 124 条，例如“喝水”原句出现两次。这个核查只说明清单条目如何计数，不能证明其他提示语义互异或与训练描述完全不重叠。[公开提示清单][prompts] · [补充 §4][supp]

### 消融实验：小波究竟改变了什么？

主文表 3 的加速度指标比较重建动作的平均、最大加速度。GT 是参考动作，用它判断重建的高频变化是否偏离参考。[正式表 3][paper]

| 变体 | MPJPE ↓ | 平均加速度 ↓ | 最大加速度 ↓ |
|---|---:|---:|---:|
| GT | — | 2.0 | 9.0 |
| 无小波 | 46.8 | 6.0 | 15.0 |
| 有小波 | 45.5 | 4.0 | 12.0 |

**加入小波。** 关节误差从 46.8 降到 45.5，平均加速度从 6.0 降到 4.0，更接近参考动作的 2.0。这个对照支持作者关于抑制重建抖动的判断。它没有测量高速动作细节是否全部保真，也没有评价生成文字的遵循程度。

### 关键发现

1. **重建质量和文本遵循需要分开验证。** 小波消融改变的是已有动作压缩再还原的误差。它能检验编解码器，却不能单独说明一句新提示中的每个子动作都被执行。[主文表 2–3][paper]
2. **模型扩展的边际收益会变。** 1B 到 3B 时 FID 为 31.3 → 10.8，到 7B 后为 10.3。三者在同一评估器上比较，后一次扩展的改善较小。[主文表 4][paper]
3. **人工偏好留下了大量平局。** 在 126 条提示上，三位标注者各自判为平局的次数都多于判本文胜出的次数。对某个小类别下结论时，还应查看它究竟含几条提示。[主文表 5–6][paper] · [开放提示文件][prompts]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **先区分数据、编码和生成三个误差来源。** 原视频可能重建错，编码器可能压掉高频，生成器还可能误读句子。表 2–3 从真实动作出发测重建，表 4–6 从文字出发测生成，各自能定位不同问题。
- **开放提示弥补检索指标的盲区。** 3B 和 7B 的 R@1 都是 .79，人在开放提示上给出的文本一致性评分却由 238.6 上升到 261。两组数据和量尺不同，解读它们时应问“这个测试看见了什么”，而不应把它们换算成同一种提升。
- **描述变丰富与动作变丰富可分别检验。** 将“挥剑”改写二十次会扩展语言表达；引入捕捉到不同身体运动的新片段才真正扩展运动样本。文章贡献两条路径，目前的实验未独立拆出每条路径对生成的净收益。[§3、表 2–5][paper]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **零样本的证据范围。** 本文用训练后的通用模型处理开放提示，展示陌生风格、抽象概念和动作组合。未报告逐提示与训练文本／动作去重后的最近邻分析，也没有按未见动词、未见组合和未见场景分别给出通过率。可将结果读作开放指令上的泛化证据。
- **文字顺序靠模型学习。** 混合注意力保证动作生成时只读已有动作码，但不保证“先静止再挥刀”一定按这个顺序发生。模型没有显式的分段时间线、逐部位锁定、用户指定目标帧或保留源动作的编辑接口。
- **身体、场景与物理证据分开。** 输入的描述可提及武器、声音、情绪和环境，主要解码目标仍是人体骨骼运动。三维视频重建误差、遮挡与清洗偏差也会进入训练数据。论文没有验证武器接触、手指握持、声音或环境几何与动作同时生成。
- **对照没有隔离所有因素。** 做 ScaMo 对比时数据源、模型和表示差异均存在。更强的数据覆盖、GPT 配文、多次改写、小波和参数规模各自贡献多少，仍缺同一数据、相同训练预算下的系统对照。[§3–5][paper] · [公开配置][repo]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **ScaMo。** 两者都希望放大离散动作生成模型。对照本文表 2，要记得 ScaMo 使用 MotionUnion 训练，MotionMillion 使用另一套训练数据；比较同一测试集的误差很有价值，但不是仅替换一个量化器的消融。[本文表 2、4–6][paper]
- **SeMoCo。** SeMoCo 会给语义与运动细节分配不同的码，而 MotionMillion 的 FSQ 档位按潜坐标量化，没有给每一档规定动作语义。站内 SeMoCo 的实验把 MotionMillion 列为基线，读这两篇可以分别看“规模扩展”和“表示分工”两个问题。[SeMoCo 解读](/blog/arxiv2026-semoco/#reading-4)
- **DeepPhase。** 它从动作中学习周期变量，适合研究相位及动作同步；MotionMillion 的时间小波将变化分到不同频带，再经通用网络编码。分出高低频并不能直接得到身体部位的周期位置。DeepPhase 也出现在本篇补充材料的人物控制表示参考中。[DeepPhase 作者页][deepphase] · [补充 §1.1][supp]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- 正式论文的图 2、5–6 和表 1–6，另核对独立补充的表示定义、数据分布、描述提示、人工打分规则与评测清单。架构图按论文重绘，实验数据按正式表转录，另行注明的算术和清单统计为本次复核。[CVF][cvf] · [正式主文 PDF][paper] · [独立补充 PDF][supp] · [arXiv][arxiv]
- 实现依据作者仓库固定提交 `8a2a7dfa66ec`，数据可用范围依据 Hugging Face 作者数据卡。小波配置、档位乘积、采样停止条件均来自静态代码核查；本文未运行生成模型，也未复算作者表格。[代码][repo] · [数据卡][data] · [作者演示][project]

</div>

[cvf]: https://openaccess.thecvf.com/content/ICCV2025/html/Fan_Go_to_Zero_Towards_Zero-shot_Motion_Generation_with_Million-scale_Data_ICCV_2025_paper.html
[paper]: https://openaccess.thecvf.com/content/ICCV2025/papers/Fan_Go_to_Zero_Towards_Zero-shot_Motion_Generation_with_Million-scale_Data_ICCV_2025_paper.pdf
[supp]: https://openaccess.thecvf.com/content/ICCV2025/supplemental/Fan_Go_to_Zero_ICCV_2025_supplemental.pdf
[arxiv]: https://arxiv.org/abs/2507.07095
[project]: https://vankouf.github.io/MotionMillion/
[repo]: https://github.com/VankouF/MotionMillion-Codes/tree/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c
[data]: https://huggingface.co/datasets/InternRobotics/MotionMillion
[vq]: https://github.com/VankouF/MotionMillion-Codes/blob/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c/models/vqvae.py
[fsq]: https://github.com/VankouF/MotionMillion-Codes/blob/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c/models/FSQ.py
[infer]: https://github.com/VankouF/MotionMillion-Codes/blob/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c/inference_single.py
[single]: https://github.com/VankouF/MotionMillion-Codes/blob/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c/scripts/inference/single_inference/test_t2m_7B.sh
[sample]: https://github.com/VankouF/MotionMillion-Codes/blob/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c/models/lit_llama/model_hf.py
[train]: https://github.com/VankouF/MotionMillion-Codes/blob/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c/scripts/train/train_tokenizer.sh
[loss]: https://github.com/VankouF/MotionMillion-Codes/blob/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c/train_tokenizer.py
[wave]: https://github.com/VankouF/MotionMillion-Codes/blob/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c/models/modules.py
[weights]: https://github.com/VankouF/MotionMillion-Codes/blob/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c/prepare/download_pretrained_models.sh
[prompts]: https://github.com/VankouF/MotionMillion-Codes/blob/8a2a7dfa66ecb6a1533d3d9cb49c743a697e1e1c/assets/infer_batch_prompt.txt
[deepphase]: https://www.ea.com/news/deepphase-periodic-autoencoders-learning-motion-phase-manifolds
