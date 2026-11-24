---
title: "[ECCV2026] LG-Tok：让文字参与动作编码，多少个动作码才够用？"
description: "Language-Guided Transformer Tokenizer for Human Motion Generation。沿着向左走、向右走、回到中间的例子，看语言如何进入动作编码与解码，读懂 49 个潜在位置、236 个离散码和 10 轮生成的区别，以及 Motion-X 上重建与生成的取舍。"
pubDate: "2026-11-24T23:40:00+08:00"
badge: "Paper"
tags: ["LG-Tok", "Text-to-Motion", "Motion Tokenizer", "Vector Quantization", "Scale-wise Autoregression", "Motion-X", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML，含附录 A–K][html] · [论文 PDF][pdf] · [ECCV 正式出版版本][doi] · [作者项目与动作视频][project] · [作者代码与权重][code]

<details class="paper-meta"><summary>论文信息与阅读范围 · ECCV 2026</summary>

*Language-Guided Transformer Tokenizer for Human Motion Generation*，作者为 Sheng Yan、Yong Wang、Xin Du、Junsong Yuan、Mengyuan Liu。ECCV 2026 正式论文集第 LXXVII 部分，第 312–332 页。下文按含扩展实验的 arXiv v2 核对表号，按作者公开实现核对文本入口、采样和权重。文中数值均为作者报告，本次未重新训练或运行模型。[会议条目][poster] · [正式章节][doi] · [预印本记录][record] · [固定版本代码][code]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

**LG-Tok 让文字参与决定一段动作怎样被压成离散码，也让解码器在还原每一帧时再读一遍文字。** 如果提示已经写明“向左走、向右走、回到中间”，动作码还需要携带步幅、姿态和转向过程。作者用两个实验检验这种分工：给定真实动作能还原多少，以及只给文字时生成器能猜对多少。[原文图 3][fig3] · [表 3][t3] · [表 6][t6]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　常见的离散文本生成动作系统分两步训练。先用动作训练编解码器，得到一套动作码；再让生成器看文字，学习预测这套码。第一步优化的是动作能否重建，第二步才引入文字。[原文 §1–2][intro]

**现有痛点**　从完整动捕里读出的细节，光凭一句描述未必猜得出来。原文表 1 的先导实验中，码数从 160 增到 236，重建 FID 从 0.110 降到 0.090，生成 FID 却从 0.205 升到 0.257。选择分词器时如果只看重建分数，很容易选错。[原文表 1][t1]

**核心矛盾**　文字交代了动作的意图和次序，却通常没有写人物用哪只脚起步、每步跨多远。码太少，步态细节会丢失；要求生成器猜出所有细节，又可能使它连与文字相关的部分都更难预测。[原文 §3.3][text] · [§4.7][budget]

**本文目标**　学习一套既能还原身体运动、又适合从文字预测的离散表示；在 HumanML3D、Motion-X 和 KIT-ML 上分别测量重建、生成质量与文本匹配程度。[原文 §4.1][setup] · [附录 C][kit]

**切入角度**　把同一句描述提前交给动作编码器，并在解码时再次提供。编码器因此可以结合全句选择表示，解码器有机会用文字补回高层动作信息，给离散码留下表达具体运动的空间。[原文 §3.2–3.3][text]

**核心 idea**　用可学习的查询位置汇集整段动作和文字的信息，按多个时间尺度逐级量化；训练时随机移除文字，让码在缺少文字时也能支撑重建。最终要用固定生成器结构和不同码数的试验，才能判断这种表示是否更好用。[原文 §3.4][drop] · [表 3][t3] · [表 6][t6]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练有两步。先让 **LG-Tok 编解码器** 看到真实动作和配文，学习把动作压成码、再还原为逐帧动作。接着拿这些码作训练目标，让**按尺度自回归的生成器（SAR）** 学会仅凭文字预测它们。实际生成时只有提示和所需长度，生成器先产生由粗到细的动作表示，解码器再把它变回连续的身体轨迹。[原文图 3][fig3] · [附录 B 完整流程图][fig7]

<figure class="reading-figure"><a href="/paper-notes/lg-tok/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/lg-tok/architecture.svg" alt="LG-Tok 架构。第一阶段将动作、文字和可学习查询编码为多尺度动作码并重建动作，第二阶段学习按尺度预测动作码，推理时从文字出发生成并解码成连续动作。" /></a><figcaption>据原文图 3、附录 B 图 7 及官方配置重绘。沿三段依次读，可以看出真值动作何时退出流程、两种文本编码器各在哪里工作，以及 49 个潜在位置为什么对应 236 个离散索引。点击可放大。</figcaption></figure>

### 关键设计

1. **让少量可学习的位置读完整段动作。** 编码器把投影后的逐帧动作、冻结的 LLaMA 3.2-1B 提取的逐词特征和一组可学习向量拼接，送入 Transformer。自注意力允许每个位置查看整段输入，最终只取可学习向量对应位置的输出，作为连续潜在表示。模型用 smooth L1 损失监督动作重建；训练数据提供整句配文，没有给每个码标出对应词或动作名称。[原文 §3.2][tok] · [§3.3][text]

2. **按时间尺度量化，每一层补上一层遗漏的量。** 先把潜在序列降采样到最粗尺度，让每个位置选择最近的码本向量；把选中的向量上采样回原潜在长度，从当前表示中减去它们。下一层在更细的尺度量化剩余误差。解码时反过来，把各尺度的码查回向量、上采样至相同长度并相加。细尺度拥有更多时间位置，具体学到哪些动作属性要靠实验检验。[附录 B][pipeline] · [原文量化伪代码][pseudo]

3. **生成器一轮预测一个尺度，同一尺度的位置并行预测。** SAR 使用 CLIP ViT-B/32 的文本条件，根据提示和已生成的粗尺度表示，预测下一尺度的码。标准配置的十层各有 3、6、10、15、20、25、30、36、42、49 个位置，合计 236 个索引，只需 10 轮按尺度预测。这套生成顺序沿用 MoSa，LG-Tok 主要改变它要预测的表示。[附录 B 式 6][pipeline] · [作者尺度配置][config]

4. **每个输出帧都能分别查询动作码和文字。** 解码器为每一帧准备一个可学习查询，用两条交叉注意力分别读取反量化后的序列与 LLaMA 逐词特征，再用线性层输出连续动作。这里的帧查询只指定需要输出多少帧，用户没有为它们填写任何关节坐标。[原文图 3][fig3] · [§3.3][text]

5. **同一组码可解码两遍，调节文字对最终姿态的影响。** 训练时以 10% 概率去掉文字。推理时固定生成码，分别得到有文字的动作 m_c 和空文字的动作 m_u，输出 m_c + g × (m_c − m_u)。g = 0 就是普通有文字解码；HumanML3D 取 g = 2，Motion-X 取 g = 1。这个差值计算发生在连续动作空间。生成器对离散码分数所做的引导发生得更早，两处系数含义不同。[原文 §3.4、式 4][drop] · [表 4][t4] · [解码实现][decoder]

### 一个完整例子：向左走，再向右走，回到中间

这是作者图 4 和项目视频中的提示。以下借用标准配置的 **196 帧** 演算表示的形状；示例视频本身的实际帧数和码值未公布。[原文图 4][fig4] · [项目视频][project] · [标准配置][config]

- **训练编解码器。** 以 HumanML3D 的 196 × 67 个输入数值为例，编码器同时读取轨迹和配文，输出 49 个连续潜在位置。量化后得到十组、合计 236 个索引。最粗层的三个位置均可看到全句，文中没有把三个位置依次指定给“左、右、中”。
- **只给文字生成。** 输入同一句话和目标长度，SAR 先生成最粗层，逐层补细。论文的离散流程将十组索引查表并叠加到 49 个位置；作者的可视化演示还启用了平滑采样分支，在每个尺度上以预测概率的软采样结果对码本向量加权，再传给后续尺度和解码器。[附录 B][pipeline] · [演示入口][demo] · [采样实现][sample]
- **查看产生的运动。** 196 个逐帧查询读取这份表示和原句，输出连续的身体姿态与根部运动。视频可检查人物是否按顺序折返。若要回答“最后离起点几厘米”，需要从根轨迹直接计算误差；原文表 2 的文本检索和分布指标没有测这一项。[原文图 4][fig4] · [表 2][t2]

### 训练与推理

第一阶段的目标是重建真值动作，文字编码器冻结，训练动作编解码器与量化表示。第二阶段用第一阶段提取的目标码监督 SAR，在各尺度预测对应的码本类别。原文的推理可以从文字与期望帧数直接开始，无需先检索一段动作。核对官方实现时要选对入口：重建评测可以输入真值动作，可视化演示则只需要文字与长度。[附录 B 训练流程][pipeline] · [演示入口][demo]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**数据和指标。** HumanML3D 含 14,616 段动作、44,970 条描述。Motion-X 按长度筛选后的基准含 37,751 段动作、61,637 条描述，去掉手指和面部通道，以统一的紧凑身体表示训练和评测；作者另在附录 E 研究了长序列的训练利用方式。**rFID** 比较重建动作和真值动作的特征分布，**gFID** 比较只凭文字生成的动作和真实动作的特征分布，两者均越低越好。**R@1** 衡量检索时匹配描述排在首位的比例，越高越好。下表摘录原文均值，表 2 的完整结果另含 20 次评估的 95% 置信区间。[实验设置][setup] · [Motion-X 评估器][evaluator] · [附录 E][ood]

**主结果 · 原文表 2。** HumanML3D 上标准版在表中取得最低 gFID 和最高 R@1；换到 Motion-X，按 gFID 会选 mini，按 R@1 则会选 mid。MoSa 的两个数据集结果和 MARDM 的 Motion-X 结果均标为作者按统一表示复现，MARDM 的 HumanML3D 数值来自原表未加复现标记的行。[完整表 2][t2]

| 方法 | 码数 | HumanML3D gFID ↓ | HumanML3D R@1 ↑ | Motion-X gFID ↓ | Motion-X R@1 ↑ |
| --- | ---: | ---: | ---: | ---: | ---: |
| MARDM | — | 0.114 | 0.500 | 0.147 | 0.528 |
| MoSa | 236 | 0.064 | 0.518 | 0.210 | 0.513 |
| LG-Tok-mini | 104 | 0.085 | 0.521 | **0.071** | 0.588 |
| LG-Tok-mid | 160 | 0.109 | 0.537 | 0.076 | **0.591** |
| LG-Tok 标准版 | 236 | **0.057** | **0.542** | 0.088 | 0.582 |

### 消融实验

**消融一 · 改变离散码数量。** 三种设置采用 25、36、49 个潜在位置，十层合计 104、160、236 个索引。码数变多，两个数据集的重建 FID 都下降；Motion-X 的生成 FID 连续上升，HumanML3D 则先升后降。在作者测试的三个设置中，Motion-X 的 mini 只用标准版约 44% 的索引，并取得最低生成 FID。[原文表 6][t6]

| 配置 | HumanML3D rFID ↓ | HumanML3D gFID ↓ | Motion-X rFID ↓ | Motion-X gFID ↓ |
| --- | ---: | ---: | ---: | ---: |
| mini · 104 码 | 0.094 | 0.085 | 0.094 | **0.071** |
| mid · 160 码 | 0.052 | 0.109 | 0.051 | 0.076 |
| 标准版 · 236 码 | **0.022** | **0.057** | **0.041** | 0.088 |

<figure class="reading-figure"><a href="/paper-notes/lg-tok/tradeoff.svg" target="_blank" rel="noopener"><img src="/paper-notes/lg-tok/tradeoff.svg" alt="Motion-X 的离散码从 104、160 增至 236，重建 FID 从 0.094 降到 0.041，生成 FID 从 0.071 升到 0.088。" /></a><figcaption>按表 6 的六个 Motion-X 均值重绘。两条线共用纵轴，均为越低越好；横轴是三种实测配置。</figcaption></figure>

**消融二 · 编解码器是否接收文字。** 保留同一种生成器设计，比较去掉与保留文字引导的两套表示。标准版在 Motion-X 上的 rFID 从 0.090 降至 0.041、gFID 从 0.257 降至 0.088。再看另一种生成器，作者自己的 MoMask 复现换用 LG-Tok 后，HumanML3D 的 gFID 从 0.180 降至 0.111；MoMask 原论文列出的 0.116 属于另一行，不能当作这组受控替换的起点。[原文表 3][t3]

| 标准码数的语言条件 | HumanML3D rFID ↓ | HumanML3D gFID ↓ | Motion-X rFID ↓ | Motion-X gFID ↓ |
| --- | ---: | ---: | ---: | ---: |
| 去掉编解码文字引导 | 0.025 | 0.062 | 0.090 | 0.257 |
| 完整 LG-Tok | **0.022** | **0.057** | **0.041** | **0.088** |

**消融三 · 去文字训练与解码引导各贡献多少。** 第一行在训练中总能看到文字；第二行随机清空文字，但解码时仅使用普通有文字输出；第三行再引入有、无文字两次解码的差值。Motion-X 上前两行的生成 FID 很接近，明显改善出现在加入解码引导之后。三组数据不支持“光靠随机去文字就能普遍提高生成质量”。[原文表 4][t4]

| 训练与解码设置 | HumanML3D gFID ↓ | Motion-X gFID ↓ | KIT-ML gFID ↓ |
| --- | ---: | ---: | ---: |
| 训练一直保留文字 | 0.132 | 0.136 | 0.251 |
| 训练随机去文字，g = 0 | 0.061 | 0.139 | 0.241 |
| 随机去文字，解码时开启引导 | **0.057** | **0.088** | **0.185** |

### 关键发现

1. **文本匹配和整体动作分布选出的配置也可能不同。** 在 Motion-X 上，mini 的生成 FID 最低，而 mid 的 R@1 最高。给数字人选模型时，应先确定更在意生成分布，还是文字与动作的匹配。[原文表 2][t2]
2. **提升集中在什么环节，要看成组的对照。** 表 3 说明整套编解码器加入语言后有收益；表 4 进一步把训练时随机去文字和推理时放大条件差异拆开。Motion-X 的结果提示，选择怎样解码同一组码也会实质改变生成表现。[原文表 3][t3] · [表 4][t4]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **选动作码时，要把“看过答案”和“只读题目”分开。** 重建时编码器见过原动作，细码可以记录实际发生的运动；生成时只有描述，细节往往有多种合理取值。表 6 在同一个 Motion-X 评估器下展示了两条相反的趋势，也解释了为什么要把分词器接上生成器再选码数。[原文表 6][t6]
- **文字从哪里进入，比系统有没有文字输入更有解释力。** 附录 I 把生成器的文字条件拿掉，只在解码侧增加引导。Motion-X 的 R@1 从 0.048 到 0.101，仍远低于完整系统的 0.582。解码阶段可以调整已经采出的动作，早期生成的粗尺度内容也强烈影响结果。[附录 I 表 11][free] · [表 2][t2]
- **重建误差和可预测性可以同时记录。** HumanML3D 和 Motion-X 上，作者报告去掉文字与加入文字时，生成器预测码的困惑度分别从 160.6 降到 155.9、从 146.5 降到 103.1。它提供了比单看动作视频更直接的证据，说明在这套生成器和数据上，新表示更容易预测。[原文 §4.3][rec]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **索引的语义粒度仍未确定。** 作者用降维散点图、码本使用率和注意力图观察模型。若要把某个索引当成可编辑的“向左转”指令，还需要固定文字、替换该码，测转向是否稳定改变，以及其他时间段是否保持。论文展示了时间窗内的文字编辑样例，未报告这类单码干预或精确落点误差。[图 6][clusters] · [附录 F][editing] · [附录 I][free]
- **身体动作结论有数据边界。** Motion-X 实验特意移除了手指和脸部。对数字人应用，手形、视线、表情与身体同步的保真度需要另行测试。检索分数同样不足以判断脚是否滑动、手是否接触目标。[原文 §4.1][setup]
- **压缩码数和加快端到端推理是两件事。** 作者报告在单张 24 GB RTX 4090 上训练分词器约两天；这个时长只覆盖分词器。附录 G 的 100 样本计时中，LG-Tok 每样本 0.121 秒，MoSa 为 0.045 秒。即使两者都按尺度生成，解码和条件处理仍有成本。[附录 G][latency] · [附录 K][limits]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **MoSa** 提供多尺度残差量化和由粗到细的生成顺序，是最接近的对照。两种方法的标准版都生成 236 个索引，因此可以观察生成器改为预测语言参与学习的表示后，Motion-X 的结果发生多大变化。[MoSa 原文](https://arxiv.org/abs/2511.01200) · [原文表 2][t2]
- **MoMask** 同样预测离散动作表示。作者在这一生成器上单独替换分词器，让读者看到换用另一类生成器后，LG-Tok 的收益还能保留多少。[MoMask 原文](https://arxiv.org/abs/2312.00063) · [站内解读](/blog/cvpr2024-momask/) · [替换实验][t3]
- **DisCoRD** 保留离散条件，研究如何用连续流模型解码动作。LG-Tok 把文字同时送入编码、生成和逐帧解码。两篇并读时可以把问题拆开：如何选择可预测的表示，以及如何在给定表示后还原运动细节。[DisCoRD 作者代码](https://github.com/whwjdqls/DisCoRD) · [站内解读](/blog/iccv2025-discord/)
- **启发。** 对可控动作研究，可以固定生成的十组码，只在解码侧把“回到中间”改成“停在右边”，同时测末端落点、转向时刻和未编辑区间的关节偏移。它能区分解码器究竟只调整了步态，还是确实改写了事件结果。这是依据本文架构提出的后续实验。[时间窗编辑样例][editing] · [解码侧分析][free]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **论文与正式出版信息。** [arXiv v2 全文 HTML][html] · [PDF][pdf] · [ECCV 正式章节][doi] · [会议海报条目][poster]
- **方法、实验与附录。** [架构图 3][fig3] · [训练与推理流程图 7][fig7] · [主结果][t2] · [分词器替换][t3] · [去文字消融][t4] · [码数对照][t6]
- **演示与复现资源。** 作者仓库提供 HumanML3D、Motion-X 标准模型的下载入口，并将 mini、mid 与 KIT-ML 权重列为待发布。项目视频可直接对照折返行走样例。[作者项目][project] · [固定版本仓库][code] · [推理入口][demo]

</div>

[html]: https://arxiv.org/html/2602.08337v2
[pdf]: https://arxiv.org/pdf/2602.08337v2
[record]: https://arxiv.org/abs/2602.08337
[doi]: https://doi.org/10.1007/978-3-032-37041-9_17
[poster]: https://eccv.ecva.net/virtual/2026/poster/5046
[project]: https://eanson023.github.io/LG-Tok/
[code]: https://github.com/eanson023/LG-Tok/tree/37f83f60a4738536e2e5279d498ec4008ab816b2
[demo]: https://github.com/eanson023/LG-Tok/blob/37f83f60a4738536e2e5279d498ec4008ab816b2/demo.py#L183-L207
[sample]: https://github.com/eanson023/LG-Tok/blob/37f83f60a4738536e2e5279d498ec4008ab816b2/models/t2m/mosa/transformer.py#L291-L322
[decoder]: https://github.com/eanson023/LG-Tok/blob/37f83f60a4738536e2e5279d498ec4008ab816b2/models/tokenizer/tokenizer.py#L280-L317
[config]: https://github.com/eanson023/LG-Tok/blob/37f83f60a4738536e2e5279d498ec4008ab816b2/options/tok_option.py#L55-L72
[intro]: https://arxiv.org/html/2602.08337v2#S1
[t1]: https://arxiv.org/html/2602.08337v2#S1.T1
[tok]: https://arxiv.org/html/2602.08337v2#S3.SS2
[text]: https://arxiv.org/html/2602.08337v2#S3.SS3
[drop]: https://arxiv.org/html/2602.08337v2#S3.SS4
[fig3]: https://arxiv.org/html/2602.08337v2#S3.F3
[fig4]: https://arxiv.org/html/2602.08337v2#S4.F4
[fig7]: https://arxiv.org/html/2602.08337v2#A2.F7
[pipeline]: https://arxiv.org/html/2602.08337v2#A2
[pseudo]: https://arxiv.org/html/2602.08337v2#A11.F12
[setup]: https://arxiv.org/html/2602.08337v2#S4.SS1
[rec]: https://arxiv.org/html/2602.08337v2#S4.SS3
[budget]: https://arxiv.org/html/2602.08337v2#S4.SS7
[t2]: https://arxiv.org/html/2602.08337v2#S4.T2
[t3]: https://arxiv.org/html/2602.08337v2#S4.T3
[t4]: https://arxiv.org/html/2602.08337v2#S4.T4
[t6]: https://arxiv.org/html/2602.08337v2#S4.T6
[kit]: https://arxiv.org/html/2602.08337v2#A3
[evaluator]: https://arxiv.org/html/2602.08337v2#A4
[ood]: https://arxiv.org/html/2602.08337v2#A5
[editing]: https://arxiv.org/html/2602.08337v2#A6
[latency]: https://arxiv.org/html/2602.08337v2#A7
[free]: https://arxiv.org/html/2602.08337v2#A9.T11
[clusters]: https://arxiv.org/html/2602.08337v2#S4.F6
[limits]: https://arxiv.org/html/2602.08337v2#A11
