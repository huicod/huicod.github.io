---
title: "[arXiv2026] CASE：用三维嘴形教会语音编码器看见发音动作"
description: "解读 CASE: Complementary Articulation-Aware Speech Encoder to Enhance Speech-Driven 3D Facial Animation。沿五帧语音与三维唇部网格的配对过程，解释哪些语音层接受动作监督，以及四个面部生成器各自受益多少。"
pubDate: "2026-11-21"
badge: "Paper"
tags: ["CASE", "3D Facial Animation", "Speech Representation", "Audio-to-Motion", "Lip Sync", "Contrastive Learning", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 阅读版][html] · [原文 PDF][pdf] · [arXiv 记录][record]

<details class="paper-meta"><summary>论文信息与阅读范围 · arXiv 2026</summary>

*CASE: Complementary Articulation-Aware Speech Encoder to Enhance Speech-Driven 3D Facial Animation*。作者为 Jaehong Myung、Seungho Eum、Taegon Kim、Hyunjung Chung、Unsang Park。本文依据 2026 年 10 月 18 日的 arXiv v1，主题为语音驱动三维面部动画、发音动作表示及跨模态对比学习。截至 2026 年 11 月 21 日，arXiv 记录收录为预印本，论文未附 CASE 的独立代码或权重入口。实验数值来自作者报告。[版本记录][record]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

CASE 把同一瞬间的语音和三维嘴形配成对，用嘴部运动微调语音编码器的最后一个 Transformer 块，再把这一路语音特征接回现有面部动画模型。在英语 VOCASET 上，四套生成器的平均唇部顶点误差都降低了。把对照换成同样接入、但未经三维嘴形适配的编码器，额外收益随生成器而变，为 0.3% 至 4.0%。[方法图 1][fig] · [对照表 2][t2]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　说一句话，让数字人的脸跟着动，常见做法是先用 wav2vec 2.0、XLSR-53 或 WavLM 提取语音特征，再让动作解码器预测随时间变化的面部网格。语音编码器因此决定了下游容易读到哪些发音线索。[§1][intro]

**现有痛点**　声音里易区分的属性，嘴形上有时几乎相同。例如 /p/ 和 /b/ 的声带振动不同，发音都需要双唇闭合。反过来，同一个元音前后接不同辅音时，嘴唇可能提前张开或收圆。只凭音素类别，动画模型还要自己补全局部几何变化。[§1][intro]

**核心矛盾**　通用语音特征包含声学和语言信息，先前的视听预训练也已经学过声音与二维嘴唇视频的对应。可动画模型最终预测的是三维顶点，哪一小块嘴唇闭合不准，会直接反映在输出上。需要区分原有视听先验能解释多少收益，三维监督又增加了多少。[§1][intro] · [§3.3][control]

**本文目标**　用少量配对的三维嘴部数据学出一条可复用的语音特征支路，既能接入不同生成器，也能在生成新句子时仅凭音频工作。作者用韩语学习这条支路，再用英语下游任务检验能否迁移。[§2.1][adapt] · [§3.1][setup]

**切入角度**　把监督范围缩短到约 167 毫秒。每个训练样本只比较同步的五帧语音和五帧嘴部网格，模型需要从同一批候选嘴形中找回对应片段。这样可以直接使用动作捕捉数据，不必给每一帧标注音素、开合程度或唇形类别。[§2.1][adapt]

**核心 idea**　保留原生成器熟悉的语音输入，再增加一个听过短窗三维嘴形的编码器，让原特征通过注意力读取新特征。两路从不同监督中获得信息，最终仍由各自的动作解码器输出面部动画。[§2.2][fuse]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先看两阶段里同一张嘴的不同作用。训练 CASE 时，真实三维嘴唇提供语音分支的学习目标。在接入动画模型后，真实嘴唇退出，来自同一段音频的两路表示合流，再与人物模板一起进入原生成器。只有第二阶段的动作解码器输出整段面部运动。[图 1][fig]

<figure class="reading-figure"><a href="/paper-notes/case/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/case/architecture.svg" alt="CASE 的训练和下游生成流程。同步语音与嘴部网格通过双向对比损失适配语音分支。新音频同时输入两个冻结编码器，融合特征会同模板驱动面部解码器。" loading="lazy" /></a><figcaption>本站依据原文图 1 重绘，点击可放大。绿色区域追踪三维嘴形提供的监督，蓝色区域追踪新语音如何生成网格。箭头表示传递特征的方向，两个阶段各自更新的参数写在模块内。</figcaption></figure>

### 关键设计

1. **用连续的三维嘴形作为语音的对照物。** 每帧从面部网格裁出 4,410 个嘴部顶点。先单独训练唇部 VQ-VAE，随后冻结，在量化之前读取 1,024 维向量。尽管网络本身有离散码本，对比学习拿到的是一段连续轨迹，因而无需先把每种开口幅度归到某个唇形编号里。[§2.1，式 1][adapt]

2. **用同步片段学习局部对应。** AV-SE 原先在英语语音与二维唇部视频上训练。作者取它的语音塔，每个网格帧对应一块 20 × 128 的滤波器组特征。语音帧特征和唇部连续向量分别经过各自的投影头映射到 512 维。对五帧中检测到发声的帧取平均，再做 L2 归一化，两边各剩一个片段向量。双向 InfoNCE 让每条语音在同一批嘴部片段中找回同步的一条，反向也从嘴部检索语音。五帧至少三帧有声才进入训练。由于匹配发生在池化之后，损失不会逐帧标出哪一瞬间应该闭嘴。[§2.1，式 2–3][adapt]

3. **明确动作监督更新哪几层。** 在上述 12 轮适配训练中，语音侧只更新 AV-SE 最后一个 Transformer 块、输出归一化和语音投影头，几何侧只更新唇部投影头。AV-SE 其余语音层以及唇部 VQ-VAE 均冻结。进入下游训练后，作者图 1 将适配后的 CASE 与基线语音编码器均标成冻结，融合模块与原动作生成通路参与训练。[§2.1][adapt] · [图 1][fig]

4. **让已有语音表示决定怎么读新分支。** CASE 在线从互不重叠的五帧块各提取一个 512 维向量，并与基线时间轴对齐。基线语音作查询 Q，CASE 作键 K 和值 V，四头注意力的输出经过投影、乘以系数 α，再加回基线表示。α 初始为 0.1，输出投影矩阵从零开始，因此训练第一步的融合结果恰好等于原基线输入。旧的模板条件、动作生成结构及其训练目标都能沿用。[§2.2，式 4][fuse]

### 一个完整例子

设一段话包含 /ba/ 的起始闭唇及随后张口。这是用来解释输入和中间表示的例子，原论文没有对这个音节做单独测试。[§1][intro]

1. **学习时**，取 30 fps 的连续五帧，音频一侧有五块 20 × 128 的输入，网格一侧有五组嘴部顶点。唇部编码器给出五个 1,024 维向量，两边经各自投影、发声掩码池化后，各得一个 512 维片段向量。两者来自同一时间窗，构成正例。[§2.1][adapt]
2. **生成时**，换成新人的音频和下游模型使用的人物模板。没有真实嘴唇供比较。CASE 从音频得到块特征，原语音塔得到自己的时间序列，融合模块将前者补入后者。下游生成器预测每一帧的整脸顶点，因而需要通过网格检查闭唇是否真的发生。[图 1][fig] · [§2.2][fuse]
3. **检查效果时**，把预测和真值逐帧对齐，在每帧取误差最大的那个唇部顶点，再对时间取平均，得到论文使用的 LVE。如果想问“闭合发生早了几帧”，还需要另外测量上下唇距离随时间的变化。论文以顶点误差和选帧图说明改善，没有给出闭唇起止时刻的误差。[式 5][setup] · [§4][limitations]

### 训练与推理

三维适配数据使用韩国 AI-Hub 公开训练分区中的 10 名说话人，按人划分训练、验证和测试，分别为 8、1、1 人。适配采用 AdamW、余弦学习率衰减和 5% 预热。下游在英语 VOCASET 上训练和比较生成器，每个基线的三种条件共享动作模型、目标和训练安排。新语音推理不再需要 VAD 或几何分支。论文披露了 RTX 3090 上的下游运行时间，未给出所有阶段的总训练 GPU 小时。[§2.1][adapt] · [§3.1][setup] · [表 3][t3]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**同一基线接入 CASE 前后。** 英语 VOCASET，作者每组运行三次并报告均值。LVE 对每一帧取嘴唇顶点中最大的平方位置误差，MVE 则对全脸顶点取平均平方误差。保留原表缩放单位，两个指标均越低越好。UniTalker 此处是仅用 VOCASET 的单输出头配置。[表 1][t1] · [§3.1][setup]

| 生成器与原语音编码器 | LVE 原始 → +CASE（×10⁻⁵）↓ | 相对降幅 | MVE 原始 → +CASE（×10⁻⁶）↓ |
| --- | ---: | ---: | ---: |
| CodeTalker · wav2vec 2.0 | 3.8744 → 3.6424 | 6.0% | 2.1171 → 1.9764 |
| FaceFormer · wav2vec 2.0 | 3.4864 → 3.3677 | 3.4% | 1.9738 → 1.9236 |
| SelfTalk · XLSR-53 | 2.9629 → 2.8213 | 4.8% | 1.7719 → 1.7653 |
| UniTalker · WavLM | 3.3778 → 3.2832 | 2.8% | 1.9342 → 1.8875 |

### 消融实验

**固定融合方式，只替换第二路语音特征。** “+AV-SE”与“+CASE”从同一个英语视听先验出发，采用相同接入位置和融合层。两者差别是 CASE 额外接受 12 轮韩语三维嘴形适配。最后一列以“+AV-SE”为分母，回答三维适配额外贡献了多少。[表 2][t2] · [§3.3][control]

| 生成器 | 仅原基线 LVE ↓ | +AV-SE ↓ | +CASE ↓ | 相对 +AV-SE 的额外降幅 |
| --- | ---: | ---: | ---: | ---: |
| CodeTalker | 3.8744 | 3.7535 | 3.6424 | 3.0% |
| FaceFormer | 3.4864 | 3.3858 | 3.3677 | 0.5% |
| SelfTalk | 2.9629 | 2.9379 | 2.8213 | 4.0% |
| UniTalker | 3.3778 | 3.2947 | 3.2832 | 0.3% |

**推理代价。** 下表是单张 RTX 3090 上 39 条 VOCASET 测试语句的整句计时，包括现场提取 CASE 特征。每句预热后跑三次取中位数，再跨句平均。末列是加入 CASE 后处理时长与音频时长之比。[表 3][t3]

| 生成器 | 原始 → +CASE（毫秒） | 额外耗时（毫秒） | 额外显存（MB） | 处理时长 / 音频时长 |
| --- | ---: | ---: | ---: | ---: |
| CodeTalker | 1,650 → 1,799 | 149 | 132 | 0.47 |
| FaceFormer | 230 → 405 | 175 | 132 | 0.10 |
| SelfTalk | 21 → 199 | 178 | 135 | 0.05 |
| UniTalker | 22 → 716 | 694 | 133 | 0.19 |

### 关键发现

- **换分母会改变对方法的判断。** UniTalker 的总体降幅是 2.8%，其中单加原 AV-SE 已下降 2.5%，适配后相对 AV-SE 又下降 0.3%。SelfTalk 上对应的额外下降达 4.0%。因此四个下游模型都能利用第二路语音，但对三维嘴形提供的新信号依赖程度不同。表 2 仅给出均值，特别是 0.3% 的差别，要判断稳定性仍需要运行间变异。[表 2][t2]
- **唇部改善可以比全脸改善更明显。** SelfTalk 在唇部误差上下降 4.8%，全脸平均误差仅下降约 0.4%。嘴唇是监督的目标，也是全部面部顶点中的局部区域，两种汇总方式回答的是不同问题。[表 1][t1] · [式 5][setup]
- **整句算得快，首帧多久出现仍要另测。** 实测四个系统处理时长都低于输入音频时长，但整句统计没有给出从第一个音频样本到可显示首帧的延迟。UniTalker 的现有实现还在 CPU 上为每个块重复计算滤波器组，作者将较高的 694 毫秒增量归因于这一点。[§3.5][speed]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

最能帮助选模型的是三组对照。若只比较原基线和 CASE，“增加一个曾看过唇部视频的编码器”与“让它再看三维嘴形”会混在一起。共享先验和融合接口以后，FaceFormer 与 SelfTalk 的额外收益有了清楚的量级。对已经有强语音编码器的动画系统，第二路特征是否值得部署，可以拿同样的三组实验回答。[表 2][t2] · [表 3][t3]

从表示学习角度，CASE 的选择是让声音去预测“同一时段可能出现的三维发音姿态”。监督短到能够对准局部动作，也宽到让数帧共享一个训练目标。这个折中解释了它为什么适合作为辅助条件，也解释了为什么还要让原动画模型决定每一帧的嘴唇形状。[§2.1][adapt] · [§2.2][fuse]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **跨语言证据有清楚的起点和终点。** 初始 AV-SE 已在英语视听数据上训练，三维适配用韩语，动画评估又回到英语 VOCASET。实验支持韩语几何监督能迁移到这个英语下游环境。检验多语言普适性，还需要非英语初始先验、更多下游语言或韩语动画测试。[§4][limitations]
- **唇部顶点误差难以定位具体发音错误。** 选帧可以看开口和收圆，整段平均误差却不能告诉人哪些音素受益，或双唇闭合是提前还是滞后。逐音素闭合率、唇间距曲线及事件时间误差会给出更直接的检验。论文将这类发音轨迹分析列为后续方向。[图 2 与表 3][t3] · [§4][limitations]
- **身体动作需要不同的监督对象。** 此处每个正例只含嘴部顶点，实验集也只评估面部。若迁移到“说到上方时手向上指”的任务，还需建立语音到手部动作或指向事件的配对，并分别评估语义和时序。文中的四组 LVE 结果只能支撑对嘴部运动的判断。[§2.1][adapt] · [§3.1][setup]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **Perceptually Accurate 3D Talking Head Generation（CVPR 2025）** 提供了 CASE 采用的 AV-SE 先验。前作研究语音与动作的感知表示和评价，CASE 取其中先从二维唇部视频学到的语音分支，以新的三维嘴部短片继续适配，再将它作为生成器输入。[前作原文][avse] · [CASE §2.1][adapt]
- **FaceFormer（CVPR 2022）** 使用预训练语音表示和自回归 Transformer，综合较长的语音上下文生成三维面部序列。CASE 在 FaceFormer 原有表示上叠加局部发音线索，正好能测出短窗几何信息带来的增量。[FaceFormer 原文][faceformer] · [CASE 表 2][t2]
- **唇读专家监督（Interspeech 2024）** 从另一个位置施加约束。该工作把唇读模型用作训练动画的感知监督；CASE 先适配一个可以独立提取的语音表示，部署时还要为它付出额外推理成本。比较这两类方法，需要同时问“训练时谁给谁监督”和“生成时还有哪些网络在线”。[唇读专家原文][lipreader] · [CASE 表 3][t3]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- Jaehong Myung 等，arXiv:2610.25342v1，2026 年 10 月 18 日。书目、可翻译全文和 PDF 均来自作者上传版本。[书目记录][record] · [HTML 阅读版][html] · [PDF][pdf]
- 两个阶段的网络结构、参数更新和公式见方法部分，性能、消融和时间开销分别见原表 1、2、3。[框架图][fig] · [表 1][t1] · [表 2][t2] · [表 3][t3]

</div>

[record]: https://arxiv.org/abs/2610.25342v1
[html]: https://arxiv.org/html/2610.25342v1
[pdf]: https://arxiv.org/pdf/2610.25342v1
[intro]: https://arxiv.org/html/2610.25342v1#S1
[fig]: https://arxiv.org/html/2610.25342v1#S2.F1
[adapt]: https://arxiv.org/html/2610.25342v1#S2.SS1
[fuse]: https://arxiv.org/html/2610.25342v1#S2.SS2
[setup]: https://arxiv.org/html/2610.25342v1#S3.SS1
[t1]: https://arxiv.org/html/2610.25342v1#S2.T1
[t2]: https://arxiv.org/html/2610.25342v1#S3.T2
[t3]: https://arxiv.org/html/2610.25342v1#S3.T3
[control]: https://arxiv.org/html/2610.25342v1#S3.SS3
[speed]: https://arxiv.org/html/2610.25342v1#S3.SS5
[limitations]: https://arxiv.org/html/2610.25342v1#S4
[avse]: https://openaccess.thecvf.com/content/CVPR2025/html/Chae-Yeon_Perceptually_Accurate_3D_Talking_Head_Generation_New_Definitions_Speech-Mesh_Representation_CVPR_2025_paper.html
[faceformer]: https://arxiv.org/abs/2112.05329
[lipreader]: https://www.isca-archive.org/interspeech_2024/eungi24_interspeech.html
