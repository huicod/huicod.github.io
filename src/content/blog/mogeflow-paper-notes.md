---
title: "[arXiv2026] MoGeFlow：在动作码本中学几何，在码与码之间生成动作"
description: "MoGeFlow: Flowing Through Motion Codebook Geometry for Text-to-Motion Generation。以单膝跪地再起身为例，解读六组身体码本、流匹配和直接解码，并对照 v3 实验与公开代码的默认行为。"
pubDate: "2026-11-23T20:38:00+08:00"
badge: "Paper"
tags: ["MoGeFlow", "Text-to-Motion", "PartVQ", "Flow Matching", "Motion Tokenizer", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[HTML 阅读版（v3）][html] · [原文 PDF（v3）][pdf] · [作者代码][repo] · [HumanML3D 权重][weights]

<details class="paper-meta"><summary>论文信息与阅读版本 · arXiv 2026</summary>

*MoGeFlow: Flowing Through Motion Codebook Geometry for Text-to-Motion Generation*。按 v3 正文首页署名，作者为 Pengcheng Fang、Tengjiao Sun、Xiaoyu Zhan、Hansung Kim、Xiaohao Cai 和 Dongjie Fu。arXiv 摘要页的作者栏列五人，正文及作者仓库均列六人。首版于 2026 年 6 月 10 日公开，本文解读 9 月 28 日发布的 v3。ICLR 2027 的公开投稿记录标注为审稿中，本站按预印本收录。核对日期为 2026 年 11 月 23 日。[版本历史][record] · [正文首页][html] · [投稿记录][forum]

版本差异影响复现。6 月的版本和仓库首页写的是采样结束后先取最近码，再解码。v3 改为直接解码连续终点，并用同一批终点比较两条路径。公开实现保留两种选项，生成脚本的默认值仍是最近码。[6 月版 §3][old] · [v3 §3.4][sampling] · [生成参数][cli]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

MoGeFlow 先验证一个前提：在训练好的身体部位码本里，相近的码通常也解码成相近的动作。它据此让文本生成器学习从噪声移动到码本向量；生成时允许终点落在码与码之间，由同一个动作解码器把这点差异传到身体姿态上。[图 1][fig1] · [几何诊断][t3] · [解码对照][t4]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文本生成动作的一条常见路线是先训练动作 tokenizer。编码器把一段动捕压缩成若干向量，每个向量找到最近的码本条目，生成器学习根据文本预测这些编号，最后由解码器还原身体运动。MoMask 等方法采用了这类离散预测。[原文 §2][related] · [MoMask][momask]

**现有痛点**　以“单膝跪地，再起身抬起双臂”为例。假设手臂码 A 表示某个抬臂阶段，B 解码后只略微改变腕部位置，C 却让双臂下落。在给正确编号 A 分配相同概率时，普通分类交叉熵给出相同损失，无论其余概率集中在 B 还是 C。对于动画，这两种错误的后果不同。[原文 §1][intro]

**核心矛盾**　码的编号只用来查表，编号相差一与动作相似性无关；表里存放的向量却是解码器训练时真正接收的输入。用向量距离做生成监督有一个前提：在去掉编号和使用频率等因素后，这个距离仍要能预测身体运动会改变多少。[原文 §3.1–3.2][diagnostics]

**本文目标**　保留离散 tokenizer 从动捕中学到的动作原型，用每个预测向量偏离目标的距离监督生成，并检验这样做能否让整段动作更贴合文本。[原文 §3.3][flow] · [表 1][t1]

**切入角度**　冻结 tokenizer，在同一段真实动作的同一时刻只替换一个身体组的码。其他输入完全相同，解码出的动作差异就能用来检验码的远近。作者还把向量沿随机方向移动相同距离，检查解码器是否特别敏感于相邻码之间的方向。[原文表 2b][t2] · [附录 A.3][a3]

**核心 idea**　从真实动作提取每个部位量化后的向量，按时间拼成全身训练目标。生成器根据文本把一整段噪声逐步变成这样的向量序列。采样最后剩下的少量偏移也交给解码器，让实验决定是否值得保留。[图 1][fig1] · [表 4][t4]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练时，动捕提供终点，配文提供条件。冻结的 PartVQ 把动捕转换为分组码本向量，可训练的 Transformer 学习怎样从噪声走向这些向量。生成时提供文本和所需时长，Transformer 迭代更新整段动作的表示，逆标准化后送入冻结解码器，恢复原时间分辨率的动作。[原文图 1][fig1] · [§3.4][sampling]

<figure class="reading-figure"><a href="/paper-notes/mogeflow/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/mogeflow/architecture.svg" alt="MoGeFlow v3 训练与生成架构。动捕经分组量化提供监督，文本和噪声进入流模型，连续终点经逆标准化交给冻结的动作解码器。"/></a><figcaption>本站依据 v3 图 1 与 §3.1–3.4 绘制，点击可放大。先沿动捕支路看一次量化如何产生训练目标，再从噪声出发看推理。第二张图放大了表 4 对比的两种解码路径。</figcaption></figure>

### 关键设计

1. **每个时间位置用六组向量描述全身。** PartVQ 先按关节运动统计和带时间滞后的关节相关性聚类，再修正被切断的运动链。在 HumanML3D 上得到根部、双臂及上身部分、右腿、上颈部、左腿、头六组。双臂同组，两腿各自一组，骨盆等边界关节的数据可以出现在相邻组里。KIT-ML 的骨架不同，作者按该数据集重新分组。[表 5 与附录 A.2][a2]

   每组用时间卷积把四帧压到一个位置，从本组的 128 个向量中选出最近的一项，每项 128 维。每组只量化一次。六组拼接后，一个时间位置是 768 维，对应最多 128⁶ 种条目组合。这个数是组合容量，真实动捕只占其中一部分。流模型使用各组码本条目逐维计算的均值与标准差，解码前再还原尺度。[原文 §3.1][token]

2. **用两种测量检验“近码产生近动作”。** 第一种利用自然出现的码。收集同一部位同一个码出现过的动作窗口，平均得到该码的局部动作原型，比较原型间距离与向量间距离的排序。第二种直接干预解码器：把某一位置的码替换为近、中、远邻居后解码，其余位置与组维持原值。第一种统计数据关联，第二种测一次替换实际引起的输出变化。这里的距离只在各自部位的表示中解释。[原文 §3.2][diagnostics] · [附录 A.3][a3]

3. **让网络回归整段连续位移。** 以标准化的量化目标为 Y₁，抽取同形状的高斯噪声 Y₀，在流时间 τ 上构造 Yτ = (1−τ)Y₀ + τY₁。网络看到当前状态、τ 和冻结 CLIP ViT-B/32 的文本特征，通过各部位输出头预测干净终点，再用“预测终点与当前位置之差 ÷ 剩余时间”得到速度，与目标速度 Y₁−Y₀ 比较。仅有效动作位置计入损失。τ 描述一次采样走了多远，动作自身的帧序号是另一条时间轴。[原文 §3.3][flow]

   六组投影后在同一动作时刻拼成一个全身 token。Transformer 在各时间位置之间协调动作，词特征参与联合注意力，句向量与流时间共同调节网络层。各组有自己的输入投影与输出头，全身轨迹由一个模型联合生成。[原文 §3.3][flow]

4. **把“训练时选码”和“推理时取整”拆开验证。** tokenizer 训练时，解码器接触的是码本向量；作为神经网络，它也能接收同样维度的连续输入。v3 将终点逆标准化后直接传给解码器，保留与最近码的差值。另一条实验路径把同一终点按组吸附回最近条目，再用同一个解码器。两条路径共用生成过程，可以单独衡量最后一次取整的影响。[原文 §3.4][sampling] · [表 4][t4]

### 一个完整例子

原文图 2 第三行要求人物“单膝跪地，摆好姿势，再站起并抬起双臂”。看这段动作时，可以分开问两个问题：身体是否依次做出了这些阶段，以及起身时的具体姿态如何形成。[作者图 2][fig2]

1. 为说明形状，假设指定 **80 帧**。训练时，配对动捕可生成一张 **20 × 6** 的编号表，查表后得到 **20 × 6 × 128** 的向量。把每组编号重新排个顺序，同时移动对应表项，解码结果仍相同；真正进入解码器的是表项里的数值。
2. 生成时，文本和长度已知，模型从 **20 × 768** 的噪声出发。一次流更新同时修改这 20 个位置的表示，双腿的起身和双臂的上举可以在全身注意力中协调。模型没有接收“第 31 帧必须离地”之类的时间标注。
3. 最后一个流步骤给出 20 个全身连续表示。在某个时刻，双臂组的向量可能靠近一个码，却保留朝另一个邻码方向的分量。v3 保留整个向量，连同其他五组解码为 80 帧动作。图 2 中从浅到深的姿态可用来观察动作次序；这里的 80 帧和中间形状是教学示例，作者没有为这条展示公开逐帧中间值。[作者图 2][fig2] · [附录 A.3][a3]

<figure class="reading-figure"><a href="/paper-notes/mogeflow/direct-decode.svg" target="_blank" rel="noopener"><img src="/paper-notes/mogeflow/direct-decode.svg" alt="二维示意对照同一个连续终点直接解码和吸附到最近码后解码，两条路径只改变解码器收到的向量。"/></a><figcaption>本站绘制的二维教学示意，点击可放大。实际每组有 128 维；点的位置用于说明两条解码路径，图中的几何关系不能直接换算成手腕位移或关节角。</figcaption></figure>

### 训练与推理

先用重建损失、局部关节位置损失和承诺损失训练 PartVQ，再冻结其编码器、码本及解码器。训练流模型时，每个数据集报告 600 个 epoch，批量 64，AdamW 基础学习率 10⁻⁴，10% 概率丢弃文本条件。采样采用 96 步均匀 Euler 积分，在速度上使用强度为 6 的无分类器引导。主表使用 L 版，论文列出约 6.90 亿参数。三个基准都提供真实动作长度，因而这些成绩衡量的是**给定时长的文本生成**。[实验设置][setup] · [附录 A.5][a5]

**读代码时要留意最后一行数据送往哪里。** 公开生成入口默认选择 <code>nearest</code>，要走 v3 的直接解码路径，需指定 <code>--decode_mode continuous</code>。采样函数在两条路径都可产生编号用于记录，但连续分支把生成的嵌入送入 <code>decode_embeddings</code>，离散分支才将编号送入 <code>decode_ids</code>。作者发布了 HumanML3D 的生成器 EMA 权重、PartVQ、分组和归一化文件。权重页的单次评估与论文主表的重复评估应分别阅读。这里核对了源码和发布清单，实验结果引自论文。[生成入口][cli] · [分支实现][branch] · [冻结解码器][decode] · [权重说明][weights]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**HumanML3D 与 KIT-ML。** 下表摘录原表 1 的均值。R@k 衡量正确描述进入检索前 k 名的比例，MM-Dist 衡量配对文本与动作特征的距离，FID 比较生成与真实动作的特征分布。作者对这两个基准做了 20 次重复；基线沿用各方法发表的结果。各行的置信区间和多样性指标见原表。[表 1][t1] · [附录 A.1][a1]

| 数据集 | 方法 | R@1 ↑ | R@2 ↑ | R@3 ↑ | FID ↓ | MM-Dist ↓ |
|---|---|---:|---:|---:|---:|---:|
| HumanML3D | MoMask | 0.521 | 0.713 | 0.807 | 0.045 | 2.958 |
| HumanML3D | SALAD | 0.581 | 0.769 | 0.857 | 0.076 | 2.649 |
| HumanML3D | MotionHiFlow | 0.563 | 0.754 | 0.843 | 0.032 | 2.691 |
| HumanML3D | **MoGeFlow-L** | **0.589** | **0.784** | **0.874** | 0.048 | **2.600** |
| KIT-ML | MoMask | 0.433 | 0.656 | 0.781 | 0.204 | 2.779 |
| KIT-ML | SALAD | 0.477 | 0.711 | 0.828 | 0.296 | 2.585 |
| KIT-ML | MotionHiFlow | **0.482** | 0.704 | 0.825 | **0.135** | 2.552 |
| KIT-ML | **MoGeFlow-L** | 0.479 | **0.712** | **0.842** | 0.145 | **2.499** |

**MotionMillion。** 沿用该基准自己的评估器，其 FID 与上表不能横向比较。[表 2a][t2]

| 方法 | R@1 ↑ | R@2 ↑ | R@3 ↑ | FID ↓ |
|---|---:|---:|---:|---:|
| ScaMo | 0.67 | 0.81 | 0.87 | 89.0 |
| MotionMillion-7B | 0.79 | 0.90 | 0.94 | **10.3** |
| MoGeFlow-L | **0.93** | **0.99** | **0.99** | 12.1 |

### 消融实验

**码距能否预测动作差异？** 在 HumanML3D 留出动作中，原始码距与局部动作原型距离的组均值 Spearman 相关为 **0.822**。改用流模型训练时的标准化距离为 **0.845**；改用冻结解码器产生的原型为 **0.834**；保持使用频率、打乱码与动作原型的配对后为 **0.014**。同架构重新随机初始化后为 0.24。分组差别明显，例如原始相关在根部为 0.962、在左腿为 0.629。[表 3a][t3] · [附录 A.3][a3]

**沿邻码方向移动有何特别？** 在 128 段动作上，每次改一个组的一个位置。表中是该局部窗口各特征通道的平均绝对变化，单位沿用动作特征。等长随机对照固定向量移动的长度，只换方向。[表 2b][t2]

| 替换距离 | 沿邻码方向的局部变化 | 等长随机方向的局部变化 |
|---|---:|---:|
| 近 | 0.062 | 0.015 |
| 中 | 0.567 | 0.079 |
| 远 | 1.285 | 0.309 |

**训练目标与推理解码各贡献多少？** 前两对固定生成器配置、改变它学习的目标并重新训练；最后一对固定 L 版生成的同一批连续终点，仅改变解码路径。这里 B 和 L 是两种不同宽度。[表 3b][t3] · [表 4][t4] · [附录 A.4][a4]

| 对照 | 改变的条件 | R@3 ↑ | FID ↓ |
|---|---|---:|---:|
| L 版训练目标 | 同一 tokenizer 量化前的编码器输出 | 0.853 | 0.082 |
| L 版训练目标 | 量化后的码本向量 | **0.874** | **0.048** |
| B 版训练目标 | 匹配身体分组和宽度的变分编码器后验均值 | 0.846 | 0.088 |
| B 版训练目标 | 量化后的码本向量 | **0.864** | **0.054** |
| 同一批生成终点 | 各组投到最近码再解码 | 0.873 ± 0.002 | 0.058 ± 0.003 |
| 同一批生成终点 | 连续终点直接解码 | 0.874 ± 0.002 | **0.048 ± 0.003** |

**规模与表示。** 同一分组码本上，S/B/L 版约 1.73/3.08/6.90 亿参数，R@3 依次为 0.856/0.864/0.874，FID 为 0.077/0.054/0.048。近似 L 版参数量的通用残差 VQ 加流模型，按层建模时为 0.833/0.062，各层求和时为 0.854/0.094（R@3/FID）。同一分组码本上的掩码分类模型为 0.826/0.083，但它只有 1.21 亿参数、用 18 轮采样；与 S 版比较仍有规模和步数差异。[表 4][t4] · [附录 A.4][a4]

### 关键发现

1. **量化在训练目标上有用，最后再取整会付出代价。** 固定其他条件后，靠近量化原型训练同时改善检索和 FID；到了推理终点，再投回码本几乎没有改变检索，FID 却从 0.048 升至 0.058。这两项实验回答的是流程中不同位置的问题。[训练目标对照][t3] · [解码对照][t4]
2. **终点偏移有一部分沿着码本学到的方向。** 在 512 条提示上，作者取最近码的八个邻居构成局部线性子空间。终点偏移的平方长度有 22.0% 落在该空间，等长随机方向只有 6.3%。这解释了为什么直接解码值得尝试，同时也说明具体某个偏移产生什么动作仍要看解码结果。[附录 A.3][a3]
3. **最稳定的收益在文本对齐。** HumanML3D 的三个检索率均居原表首位；KIT-ML 的 R@3、MM-Dist 有优势，但 R@2 只比 SALAD 高 0.001，两者的 95% 区间重叠。MotionMillion 上也出现了检索更好、FID 仍落后于 7B 基线的组合。[表 1][t1] · [表 2a][t2]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **先测量，再选择生成空间。** 仅看码本散点图，很难知道点与点的距离对动画有何意义。用真实窗口、打乱配对、等长随机位移和单码替换，可以逐一检验这个距离与真实数据及解码器的联系。[几何诊断][a3]
- **最有说服力的对照可以做得很小。** 对同一结果只改最后一步，排除了文本、随机起点、网络宽度和训练差异。要判断自己的动作 tokenizer 是否适合直接解码，这是表 4 最容易借鉴的部分。[解码消融][t4]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **部位表示的语义粒度有限。** 两个码解码出来很接近，只说明局部动作特征相近。要判断哪个码表示“左膝着地”、何时接受支撑、能否只编辑右腕，都需要事件、接触或局部编辑实验。论文图 2 提供了少量动作顺序示例。[表 5][a2] · [图 2][fig2]
- **输入时长和计算预算影响使用方式。** 论文评估时已经给出真实时长，96 次流更新作用在整段序列上。用于对话角色时，首帧延迟、时长预测和在线响应都要另外测量；原文列出了训练轮数和批量，未给出全程 GPU 小时。[实验设置][setup] · [实现细节][a5]
- **换 tokenizer 需要重新检查几何。** 同样的测量用到通用残差 VQ 时，基础层相关约 0.80，后五层仅为 0.40–0.51。六组码本上观察到的效果推广到另一种 tokenizer，取决于其解码器如何使用各层的位移。[附录 A.3][a3]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **KV-Control。** MoGeFlow 沿用其 PartVQ 身体分组与码本。KV-Control 还提供外部轨迹条件；MoGeFlow 本文的研究问题是如何利用码本几何完成给定文本和时长的生成。分组便于建模局部运动，轨迹控制仍需要相应输入和训练。[KV-Control 原文](https://arxiv.org/abs/2606.05624)
- **MoMask（CVPR 2024）。** 它通过掩码预测生成离散动作码，再补残差层。MoGeFlow 的表 4 特意将同一组部位码本交给掩码分类模型，便于比较选择编号与回归向量的效果。[MoMask 原文][momask] · [匹配码本的对照][t4]
- **SALAD（CVPR 2025）。** 它在骨架与时间结构化的变分潜空间中扩散。两篇都利用身体结构，训练目标空间的构造不同。MoGeFlow 表 3b 的变分对照是作者为控制变量训练的 PartVAE；SALAD 的已发表成绩另列在主表中。[SALAD 原文][salad] · [表 3b][t3]
- **对动作表示研究的启发。** 如果准备把一组 latent 用作控制量，可先固定整段动作，只沿一个邻码方向移动，再与等长随机扰动比较，并测量目标部位和其他部位各自变化多少。这一步能检验“模型对这个方向敏感”；要命名方向或给用户精确控制，还需要对应的动作测量。[单码替换实验][t2]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 正文、图表、实现参数与协议取自 2026 年 9 月 28 日的 arXiv v3。主实验与消融核对了 HTML 和 14 页 PDF 的表 1–4；两张本站插图均为教学重绘。[HTML 全文][html] · [PDF 全文][pdf] · [历史版本][record]
- 公开实现核对生成入口、解码分支，以及作者的 HumanML3D 权重说明。本文未运行模型，图 2 的动作由作者生成。[固定代码版本][repo] · [作者权重][weights]

</div>

[html]: https://arxiv.org/html/2606.11656v3
[pdf]: https://arxiv.org/pdf/2606.11656v3
[record]: https://arxiv.org/abs/2606.11656v3
[forum]: https://openreview.net/forum?id=nM0dMst1Yg
[old]: https://arxiv.org/html/2606.11656v2#S3
[repo]: https://github.com/PengchengFang-cs/MoGeFlow/tree/e22b679c1a131949e955b7273bb3bf15e1ab7526
[cli]: https://github.com/PengchengFang-cs/MoGeFlow/blob/e22b679c1a131949e955b7273bb3bf15e1ab7526/gen_codeflow_t2m.py#L46-L53
[branch]: https://github.com/PengchengFang-cs/MoGeFlow/blob/e22b679c1a131949e955b7273bb3bf15e1ab7526/models/codeflow/motion_code_flow.py#L678-L692
[decode]: https://github.com/PengchengFang-cs/MoGeFlow/blob/e22b679c1a131949e955b7273bb3bf15e1ab7526/models/codeflow/kv_vq.py#L269-L285
[weights]: https://huggingface.co/AmberJar/CodeFlow-HumanML3D/blob/09154c86800effea28ce388c9b4d302d8303bcd0/README.md
[intro]: https://arxiv.org/html/2606.11656v3#S1
[related]: https://arxiv.org/html/2606.11656v3#S2
[fig1]: https://arxiv.org/html/2606.11656v3#S3.F1
[fig2]: https://arxiv.org/html/2606.11656v3#S4.F2
[token]: https://arxiv.org/html/2606.11656v3#S3.SS1
[diagnostics]: https://arxiv.org/html/2606.11656v3#S3.SS2
[flow]: https://arxiv.org/html/2606.11656v3#S3.SS3
[sampling]: https://arxiv.org/html/2606.11656v3#S3.SS4
[setup]: https://arxiv.org/html/2606.11656v3#S4.SS1
[t1]: https://arxiv.org/html/2606.11656v3#S4.T1
[t2]: https://arxiv.org/html/2606.11656v3#S4.T2
[t3]: https://arxiv.org/html/2606.11656v3#S4.T3
[t4]: https://arxiv.org/html/2606.11656v3#S4.T4
[a1]: https://arxiv.org/html/2606.11656v3#A1.SS1
[a2]: https://arxiv.org/html/2606.11656v3#A1.SS2
[a3]: https://arxiv.org/html/2606.11656v3#A1.SS3
[a4]: https://arxiv.org/html/2606.11656v3#A1.SS4
[a5]: https://arxiv.org/html/2606.11656v3#A1.SS5
[momask]: https://openaccess.thecvf.com/content/CVPR2024/html/Guo_MoMask_Generative_Masked_Modeling_of_3D_Human_Motions_CVPR_2024_paper.html
[salad]: https://openaccess.thecvf.com/content/CVPR2025/html/Hong_SALAD_Skeleton-aware_Latent_Diffusion_for_Text-driven_Motion_Generation_and_Editing_CVPR_2025_paper.html
