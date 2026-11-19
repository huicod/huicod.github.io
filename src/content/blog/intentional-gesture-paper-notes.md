---
title: "[NeurIPS2026] Intentional-Gesture：从一句话的交际功能生成说话手势"
description: "跟着“这对我有帮助”的例子，看模型怎样区分解释、强调和指示，如何把转录推断、语音节律和全身动作码本接起来。对照早期 Intentional-Gesture 与会议题名 Reasoning Gestures，并核对未见说话人和错配意图实验。"
pubDate: "2026-11-19T13:04:00+08:00"
updatedDate: "2026-11-19"
badge: "Paper"
tags: ["Intentional-Gesture", "Reasoning Gestures", "Co-Speech-Gesture", "Gesture-Generation", "Intention", "Motion-Tokenizer", "BEAT2", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[预印本 HTML 阅读版（含附录）][html] · [预印本 PDF][pdf] · [NeurIPS 会议记录][neurips] · [作者演示与数据示例][demo]

<details class="paper-meta"><summary>题名、版本与阅读范围 · NeurIPS 2026</summary>

首次公开的题名是 *Intentional Gesture: Deliver Your Intentions with Gestures for Speech*。arXiv v1 于 2025 年 5 月 21 日公开，v2 于 9 月 26 日修订。NeurIPS 2026 以 *Reasoning Gestures: LLM-Inferred Communicative Functions for Co-Speech Gesture Generation* 收录为海报，会议页列 Pinxin Liu、Haiyang Liu、Yunlong Tang、Luchuan Song。v2 正文另列 Jason J. Corso 和 Chenliang Xu，署名和顺序以各版本为准。作者的 Reasoning-Gesture 项目入口也指向这份预印本。[会议海报记录][neurips] · [版本记录][abs] · [作者项目][project]

下文架构图、层数、训练设置及所列数表均对应 **2025 年 arXiv v2 的 27 页全文与附录 A–K**。会议版将 InG 展开为 *Interpreted Gestures*，并明确交际功能是观察者根据证据作出的解释。全文采用这一含义理解早期论文中的“意图”。作者的公开备份含标注脚本、量化器和训练器，本次查阅了源码与演示，未运行模型。[v2 全文][html] · [会议摘要][neurips] · [作者源码][code]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

听到“这对我有帮助”，数字人除了跟着重音摆手，还可以用向前摊手来表达“我在举例解释”。Intentional-Gesture 先从话语推断一种合理的交际功能，把它写成一句可读的描述，再让动作生成器同时参考这句话和语音节律。相同的交际功能可以有多种合适的动作。[预印本图 5–6][overview] · [会议摘要][neurips]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 共语手势模型已经能从声音中找到重音、停顿，再生成与节拍相合的动作。转录多提供了一层信息，例如说话人提到哪个对象。要决定此刻适合用手强调、指向还是解释，还需要知道这个词在整句话中的作用。[原文 §1–2][related]

**现有痛点：** 同一段开合手势可能出现在许多句子中。即使节拍准确，听者也未必看得出角色正在说明个人感受，还是引出一个新例子。BEAT-2 有动作、语音和转录，却缺少逐句解释这些手势为何合适的描述。[原文 §3][dataset]

**核心矛盾：** 训练时能回看真实手势，测试时恰恰需要生成这段未知动作。若借测试视频给模型提示“左手向前伸”，就把待预测的动作提前提供给了它。若完全丢掉动作证据，训练时又很难教会模型词句和手势之间的具体关系。[标注协议][protocol]

**本文目标：** 用有动作证据的训练片段学习“这段动作可能在表达什么”，再让新语音在只读转录的条件下也能获得一条合理的功能描述，用来引导全身手势。[原文 §3.1、§4][dataset]

**切入角度：** 把“手如何移动”和“这句话在做什么”分开标注。例如，“左手前伸”是可见运动，“借自身经历解释观点”是对话语作用的解释。作者用视觉语言模型联系二者，把后一个层次送给标准生成路径。[标注示例，附录 C][protocol]

**核心 idea：** 让交际功能影响两处。训练动作码本时，语义教师帮助保留与解释或强调有关的变化；真正生成时，模型还能分别查询低层节律和高层功能条件，决定这一段怎么动。[原文 §4][method]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练分三步。先用成对的语音、转录、意图文本和动作训练双塔编码器 H-AuMoCLIP。再用其动作塔监督全身动作量化器。最后训练以两级语音特征为条件的潜在动作生成器。面对新语音时，系统先从转录获得句级意图文本，生成器结合波形和文本条件产生动作潜变量，由解码器还原为连续姿态。[原文图 5][overview] · [附录 D][impl]

<figure class="reading-figure"><a href="/paper-notes/intentional-gesture/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/intentional-gesture/architecture.svg" alt="Intentional-Gesture 完整架构。训练标注可以看动作，测试标注只读转录；语义动作塔监督多码本，生成时用节律和意图两路条件预测可解码的动作表示。" loading="lazy" /></a><figcaption>依据 arXiv v2 图 2、图 5 和附录 D 重绘，点击可放大。上方比较两种标注所见的证据，中间的虚线是训练监督，下方实线展示一次生成怎样得到姿态序列。</figcaption></figure>

### 关键设计

1. **先标注动作，再推断交际功能。** 训练片段按词的时间戳划分约 1–2 秒的小窗。规则程序把关节运动转换为相对身体根部的方向和幅度描述，并选取开头、结尾和代表性关键帧。GPT-4o-mini 结合这些证据和句子，依次分析姿态、推断交际功能、给出功能与行为的对应，最后写成一句意图描述；每句话产生五个候选，由人工淘汰明显失实的解释。测试协议只给转录，省去对真实手势的观察。InG 的训练、验证、测试分别有 34,641、3,598、9,674 条话语，覆盖 16 类交际功能。[原文 §3][dataset] · [训练和测试提示][protocol]

2. **把句级意图放回语音时间线上。** 转录词先通过 CTC 对齐到语音时间轴。转录与意图描述经各自的 BERT 编码，由对齐的转录词作查询，意图文本作键和值，取回与当前词相关的功能信息，再与 wav2vec2 声学特征拼接。对比学习分别约束局部时间邻域和整段音频与动作的对应，使语音塔能输出低层节律、高层语义两种条件。动作塔在下一阶段充当教师。[原文 §4.1][alignment] · [附录 D][impl]

3. **全身共用一个编码器，在潜变量内部使用多个码本。** 编码器先联合处理全身，然后把潜在特征按通道分块，分别找最近的码字，再拼回供解码。附录选择 8 个码本、码维度 32、码数 8,192。除重建和量化损失外，作者还逐时刻比较投影后的量化特征与 H-AuMoCLIP 动作塔特征，用余弦损失拉近二者。一段“摊手解释”的动作因此同时接受几何与语义监督。码本的第几组对应哪只手、哪个交际功能，训练并未指定。[原文 §4.2][tokenizer] · [附录图 9][sweep]

4. **生成器接收两路条件，解码器负责把特征还原成动作。** 作者在 GestureLSM 路线上更换语音编码器和动作量化器。八层 DiT 的每层用同一个动作查询分别读取节律和意图，两个注意力结果相加再更新潜变量。量化表征具有可查询的码字，生成器工作在动作潜空间；公开训练器接受缓存的意图嵌入与时间信息，载入既有量化器，默认选取量化后再投影的表示。这一过程没有指定“左腕必须到达某三维坐标”的求解步骤。[原文 §4.3 与附录 D][impl] · [公开训练器][trainer]

### 一个完整例子

原文图 6 比较说到 *helpful for me* 时的动作。可以把条件沿系统走一遍：转录提供词的位置；意图文本可表达“说话者正用自己的经历作解释”（此处是对示例的中文转述）；语音提供重音和停顿。生成器把不同时间的动作潜变量分别对齐到这两类条件，再解码全身姿态。作者展示的一个结果是左手前伸。这个案例说明解释性话语可以配出一个合适手势，无法据此推出每次给同一意图都会伸左手。若需指定左右手、落点和到达时刻，仍要独立提供这些约束并测量。[原文图 6][example]

### 训练 / 推理

- **数据和优化。** 主实验使用 BEAT-2，论文给出 25 位说话人、1,762 段序列，总计约 60 小时，另在约 8 小时的 Audio2PhotoReal 双人对话数据上报告结果。生成器在单人和多人设置下各训练 800 个 epoch，使用 Adam，学习率为 0.0001。文中没有可直接换算训练总费用的 GPU 小时记录。[实验 §5][exp] · [附录 D][impl]
- **长语音怎样接续。** 滑窗用前一段生成结果末尾的约 2.13 秒作为下一段历史，主实验在完整测试序列上运行。单人设置将测试切成 8.633 秒短段后，FGD 从 0.379 降到 0.246；短段协议减少跨窗误差累计，两种设置的数值应分别比较。[原表 13][long]
- **30.4 FPS 测了哪一段。** 作者在 H100 上测得动作生成速度 30.4 FPS，测量前已经通过 API 把转录转换成意图文本。在线系统从收音、转录开始，直到获得意图、看到首个动作的等待时间，原文没有报告。[原文 §5.1][exp]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**BEAT-2。** 取 v2 表 1 的三种设置，零样本列使用 20 位说话人训练、5 位未见说话人测试。FGD 越小表示生成与真实动作在特征分布上越接近。BC 衡量动作速度极小点与语音节拍的对应，Div. 衡量动作样本间差异，两者按原表与同列真实动作参照比较。[原表 1][t1] · [指标定义][metrics]

| 方法 | 单人 FGD ↓ | 全部 FGD ↓ | 未见 5 人 FGD ↓ | 全部 BC | 全部 Div. |
| --- | ---: | ---: | ---: | ---: | ---: |
| 真实动作参照 | — | — | — | 0.477 | 7.29 |
| CaMN | 0.604 | 0.512 | 0.812 | 0.200 | 5.58 |
| EMAGE | 0.570 | 0.692 | 0.936 | 0.284 | 6.06 |
| Audio2PhotoReal | 1.020 | 0.849 | 1.012 | 0.326 | 6.24 |
| RAG-Gesture | 0.879 | 0.447 | — | 0.471 | 9.03 |
| GestureLSM | 0.408 | 0.446 | 0.664 | 0.525 | 9.23 |
| Intentional-Gesture | **0.379** | **0.256** | **0.441** | 0.534 | 6.68 |

**人能看出什么差异？** 表 2 采用 1–5 分的盲评，共 20 位参与者、160 个视频样本，每人看 8 个。问卷询问真实感、语音同步和平滑度。它补充了感知质量证据，但没有让评审逐句辨认“强调、否定、解释”是否正确。[原表 2][t2] · [附录 F][mos]

| 方法 | 真实感 ↑ | 语音同步 ↑ | 平滑度 ↑ |
| --- | ---: | ---: | ---: |
| CaMN | 1.34 | 2.23 | 2.14 |
| EMAGE | 2.01 | 2.42 | 2.31 |
| GestureLSM | 3.43 | 3.61 | 3.48 |
| Intentional-Gesture | **3.76** | **4.11** | **3.92** |

### 消融实验

**哪一层语义监督最有用？** 保留多码本结构，更换教师信号。对整段动作取均值时生成 FGD 为 0.286，用逐时刻高层特征时降到 0.256；无该监督的最佳结构重建 FGD 反而略低。能还原输入动作、能让生成器用好语义，是两个可分别测量的能力。[原表 3 左][t3]

| 多码本量化器 | 重建 FGD ↓ | 码本利用率 | 生成 FGD ↓ |
| --- | ---: | ---: | ---: |
| 优化后的量化器结构 | **0.0011** | 98.84 | 0.315 |
| 低层特征监督 | 0.0014 | 96.72 | 0.295 |
| 高层整段监督 | 0.0014 | 96.68 | 0.286 |
| 高层逐时刻监督 | 0.0012 | 97.17 | **0.256** |

**改写、错配或删掉意图会怎样？** 在同一模型中改写意图措辞，FGD 在表格精度下保持 0.256。换成时间上不匹配的意图，FGD 升到 0.284；移除意图为 0.281。模型确实会使用这条条件。若要验证一条指令能有多精确地改变具体手势，还需量化对应事件是否出现。[原表 3 右][t3]

| 测试条件 | FGD ↓ | BC | Div. |
| --- | ---: | ---: | ---: |
| 完整模型 | **0.256** | 0.534 | 6.68 |
| 意图改写 | **0.256** | 0.533 | 6.66 |
| 意图错配 | 0.284 | 0.521 | 6.47 |
| 去掉意图文本 | 0.281 | 0.523 | 6.54 |

**描述动作，还是描述功能？** 表 4 将音频 A、运动描述 M、意图 I 分开组合。同一个测试里，三者都用有最高的检索 R@1，生成 FGD 却是 A + I 最好。详细描述已经观察到的手势可以帮模型找回那段动作，未必是从头合成新动作的最佳条件。[原表 4][t4]

| 条件 | 检索 R@1 ↑ | 检索 R@10 ↑ | 生成 FGD ↓ |
| --- | ---: | ---: | ---: |
| A | 8.37 | 35.86 | 0.284 |
| A + M | 9.21 | 38.43 | 0.464 |
| A + I | 8.47 | 37.67 | **0.256** |
| A + I + M | **9.41** | **40.59** | 0.343 |

### 关键发现

1. **跨说话人的收益比只看一个人的数字更明显。** 单人 FGD 从 GestureLSM 的 0.408 降为 0.379，换成 5 名未见说话人时从 0.664 降为 0.441。这检验了未见身份的泛化；对口音、语言与文化背景的泛化还需要另外分组验证。[原表 1][t1]
2. **分布改善与节拍改善可以不同步。** 全说话人设置中，本文的 FGD 最低；在 BC 上，RAG-Gesture 的 0.471 比本文的 0.534 更接近真实值 0.477。评价交际手势时，同时报告动作分布、节律与人的观察很重要。[原表 1][t1] · [指标定义][metrics]
3. **第二套数据提供了跨基准证据。** 在 Audio2PhotoReal 上，GestureLSM 的 FGD 为 2.64、Div. 为 2.34，本文分别为 2.21 和 2.43（真实 Div. 为 2.50）。这说明方法也能用于该双人对话数据设置；表中没有测量两位角色能否针对彼此的意图完成交互。[附录表 11][second]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **可读的条件放在生成器之前。** 如果讲解数字人做错动作，可以分别检查转录、句级功能解释、节律条件和最终姿态。若系统把一句转折读成强调，即使生成器忠实遵循这条解释，动画仍然可能不合适。[标注协议][protocol] · [方法][method]
- **用训练期的真实动作教会表示理解语义。** 在制作训练标注时看到动作是有价值的；新的说话人无需先表演一遍。论文把这两种条件分开写，也使“预测出来的解释”与“从动作中总结出的解释”有了可比较的协议。[原文 §3][dataset] · [原表 4][t4]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **意图标签衡量第三方解释的合理性。** 原文附录抽查 50 条标注，报告有 3 条对语气或意图略作夸张。说话人的自评、不同文化的听者能否作出相同解释，都是不同的研究问题。NeurIPS 版本也明确将标签定义为观察者视角。[附录 C.6][protocol] · [会议摘要][neurips]
- **功能不唯一决定轨迹。** “解释”可以配摊手、点头或身体倾斜。原文承认多码本尚不能保证语义与节律完全解耦。若目标是让数字人准确指到屏幕上的某个词，需要额外给出目标位置，并在解码动作上测量指向误差和时序。[作者局限][limits]
- **长段与实时对话的约束不同。** 长段会继承前窗的动作误差；句级意图推断还依赖转录可用。已有离线生成速度与整段指标，仍不能回答说到半句话时系统何时能开始做出合适动作。[附录表 13][long] · [原文 §5.1][exp]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **GestureLSM。** 两篇共享在潜在动作空间生成共语手势的思路，也是这里最直接的基线。本文逐步替换 DiT、意图条件、分层语音模型和量化器，生成 FGD 才从 0.446 走到 0.256；读这条路线时应把结构改变和意图条件各自的贡献分开。[原表 3][t3] · [GestureLSM 站内解读](/blog/iccv2025-gesturelsm/)
- **CoordSpeaker。** 若用户已经知道角色此刻要鞠躬，可以直接提供动作描述。Intentional-Gesture 处理的输入更接近“这句话在解释什么”，具体动作可有多种。两类系统适合回答不同的问题：导演有没有明确动作要求，说话人此刻需要表达什么。[CoordSpeaker 站内解读](/blog/cvpr2026-coordspeaker/) · [本文原表 4][t4]
- **启发。** 做“边讲解边指向内容”的数字人，可以把交际功能、目标对象和时刻分开记录。前者可沿用本文的可读描述，后两者由展示任务给出。评估时分别问听者能否理解此处是举例或强调、手是否指到正确对象。这是基于论文提出的应用设想。[会议摘要][neurips] · [作者局限][limits]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 会议题名、作者、海报和交际功能定义。[NeurIPS 2026][neurips] · [会议 OpenReview][newor]
- 首发与修订日期、可在线翻译的 2025 年全文与原始 PDF。[arXiv 记录][abs] · [原生 HTML][html] · [PDF][pdf]
- 架构、具体示例、主实验与消融。[图 5][overview] · [图 6][example] · [表 1][t1] · [表 3][t3] · [表 4][t4]
- 作者公开的备份项目及实现，可查看逐段标注、可视化和动作模型。[项目示例][demo] · [源码快照][code] · [量化器][token-code]

</div>

[neurips]: https://neurips.cc/virtual/2026/poster/151121
[newor]: https://openreview.net/forum?id=cq7EnUOaLz
[abs]: https://arxiv.org/abs/2505.15197
[pdf]: https://arxiv.org/pdf/2505.15197v2
[html]: https://arxiv.org/html/2505.15197v2
[demo]: https://andypinxinliu.github.io/Intentional-Gesture-backup/
[project]: https://andypinxinliu.github.io/Reasoning-Gesture/
[code]: https://github.com/andypinxinliu/Intentional-Gesture-backup/tree/f7a01248c9a3660774ebca73ba512f400325cb6f/code
[trainer]: https://github.com/andypinxinliu/Intentional-Gesture-backup/blob/f7a01248c9a3660774ebca73ba512f400325cb6f/code/modeling/InG_trainer.py
[token-code]: https://github.com/andypinxinliu/Intentional-Gesture-backup/blob/f7a01248c9a3660774ebca73ba512f400325cb6f/code/modeling/models/vq/intentional_tokenizer.py
[related]: https://arxiv.org/html/2505.15197v2#S2
[dataset]: https://arxiv.org/html/2505.15197v2#S3
[protocol]: https://arxiv.org/html/2505.15197v2#A3
[method]: https://arxiv.org/html/2505.15197v2#S4
[overview]: https://arxiv.org/html/2505.15197v2#S4.F5
[alignment]: https://arxiv.org/html/2505.15197v2#S4.SS1
[tokenizer]: https://arxiv.org/html/2505.15197v2#S4.SS2
[example]: https://arxiv.org/html/2505.15197v2#S5.F6
[sweep]: https://arxiv.org/html/2505.15197v2#A5.F9
[exp]: https://arxiv.org/html/2505.15197v2#S5
[impl]: https://arxiv.org/html/2505.15197v2#A4
[t1]: https://arxiv.org/html/2505.15197v2#S5.T1
[t2]: https://arxiv.org/html/2505.15197v2#S5.T2
[t3]: https://arxiv.org/html/2505.15197v2#S6.T3
[t4]: https://arxiv.org/html/2505.15197v2#S6.T4
[long]: https://arxiv.org/html/2505.15197v2#A5.T13
[second]: https://arxiv.org/html/2505.15197v2#A5.T11
[metrics]: https://arxiv.org/html/2505.15197v2#A7
[mos]: https://arxiv.org/html/2505.15197v2#A6
[limits]: https://arxiv.org/html/2505.15197v2#A11
