---
title: "[IEEE-TMM2026] Fine-Grained Motion Retrieval：用文字、口令或视频在动作库里找对片段"
description: "Multi-Modal Motion Retrieval by Learning a Fine-Grained Joint Embedding Space。以左右腿踢动为例，解读四模态动作检索、分部位时序编码与双向局部匹配，并核对全库检索、语音数据及原表消融。"
pubDate: "2026-11-26T21:48:00+08:00"
badge: "Paper"
tags: ["Motion Retrieval", "HumanML3D", "KIT-ML", "Speech-to-Motion Retrieval", "Video-to-Motion Retrieval", "Contrastive Learning", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[arXiv HTML（可翻译）][html] · [作者稿 PDF][pdf] · [IEEE 期刊记录][venue]

<details class="paper-meta"><summary>论文信息与阅读范围 · IEEE Transactions on Multimedia 2026</summary>

英文题名为 *Multi-Modal Motion Retrieval by Learning a Fine-Grained Joint Embedding Space*。作者为 Shiyao Yu、Zi-An Wang、Kangning Yin、Zheng Tian、Mingyuan Zhang、Weixin Si、Shihao Zou。正式发表于 *IEEE Transactions on Multimedia* 第 28 卷，3694–3708 页，DOI 为 10.1109/TMM.2026.3654382。方法和数字按 2025 年 7 月 31 日公开的 arXiv v1 核对，全文 15 页。作者在表中分别用 Ours (3-modal) 和 Ours (4-modal) 标记本文模型。[期刊记录][venue] · [作者版本][record]

研究范围包括动作库检索、多模态表征和弱监督局部匹配。截至 2026 年 11 月 26 日，在该作者稿和 arXiv 记录中未找到本文四模态模型的官方代码、权重或合成音频下载链接。下文区分论文报告、图中示例与教学推演。[作者稿][html]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

用户可以输入文字、念一条动作口令，或给一段示范视频，模型把动作库中最匹配的骨架片段排到前面。它把候选动作拆成“哪个部位、哪段时间”的局部向量，让查询里的每个词、语音片段或视频帧各自寻找最相似的动作向量，再汇总成整段的匹配分数。[原图 1–3][pipeline] · [原式 8][score]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**　动捕库里已有可直接使用的真人动作，难点是找到想要的那一条。TMR 能用一句话找动作，作者团队此前的 LAVIMO 还允许拿示范视频来查询。[TMR 项目][tmr] · [三模态前作][lavimo]

**现有痛点**　“用右腿踢”和“用左腿踢”描述的是同一大类动作。若整句话和整段骨架各自压缩为一个向量，“踢”的整体相似性容易盖过决定答案的“右”。原图 7 正好展示了这样的左右腿混淆。[原图 7][kick]

**核心矛盾**　用户要的是整段动捕，但决定排名的证据可能只在一个词、一条腿、少数几帧。真实查询又有长短与语速差异，口令中“请你”“能不能”等词对动作选择的贡献很小。[原图 2][why] · [语音编码][enc]

**本文目标**　让文本、语音、视频都能做动作库的查询入口，并保留足以区分部位和短时动作的线索。反过来给动作找对应文字、录音和视频的能力也在测试范围内。[原表 II][hml]

**切入角度**　先单独编码每个身体部位的时间变化，再允许不同部位交流。查询侧保留一串局部向量，这样“右腿”相关的表示有机会直接同候选中的腿部证据比较。[原图 3][pipeline] · [§III-A][enc]

**核心 idea**　让查询的每个局部去候选里找最相近的伙伴，也从候选反向找回查询证据。模型学习哪些局部对排名更重要，训练只需知道整段是否配对，无需手标某个词落在第几帧。[§III-B、式 4–9][align]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

训练时，一条动作及其对应的文字、视频、合成口令组成配对材料。四个编码器都输出宽度为 512 的向量序列，长度可不同。模型比较任意两种模态的局部序列，学习给配对样本更高的总分。上线查询只需编码一种输入，逐条为候选动作打分，返回前 K 个已有片段。[原图 1、3][pipeline] · [训练目标][align] · [评测与推理][discussion]

<figure class="reading-figure"><a href="/paper-notes/fine-grained-motion-retrieval/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/fine-grained-motion-retrieval/architecture.svg" alt="四种模态各自编码，动作按时间及部位保留局部向量，查询与候选经过双向局部匹配产生排序。训练另用四模态对比及动作掩码重建。" /></a><figcaption>依原文图 3、5、6 与式 4–12 重绘。先读四路输入怎样变成局部向量，再读单条查询与候选动作如何打分。四模态配对数据和遮盖重建分支用于训练。点击可看大图。</figcaption></figure>

### 关键设计

1. **骨架编码保留“部位 × 时间”。** 每帧拆成八个部位，每个部位包含二至四个关节，分别做线性投影。编码器先沿时间建模同一部位，再沿部位建模同一时间的身体协调，间插时间池化。最后把八个部位与降采样后的时间轴展平成一个序列。若保留 24 个时间位置，候选就有 8 × 24＝192 个局部向量可参与比较。这里的 24 是按表 VI 的 192 个 token 换算。[§III-A][enc] · [表 VI][length]
2. **三种查询各用适合自己的编码器。** 文本经 DistilBERT 和两层 Transformer，保留词元序列。视频均匀取帧，用 CLIP ViT-B/32 提取帧特征，再用六层时间 Transformer 读取先后关系。语音由 WavLM 提特征，输入特征投影后充当注意力的查询，可学习的记忆条目充当键和值，得到长度一致的语音表示。这里的“记忆检索”发生在语音编码器内部；最后返回动捕文件时，查询的是外部候选动作库。[§III-A、原图 5][audio]
3. **一对序列怎样压成一个分数？** 对每个查询 token，算它与每个候选 token 的点积，在这一行取最大值。不同查询 token 经过线性层和 softmax 获得不同权重，用它们加权求和。交换两边再做一次，两个方向各占一半。举例，描述中“转身”可以命中中段，其他词可命中别处。同一个动作 token 也可被多个词选中；式 8 没有施加单调时间匹配或一对一匹配。[原图 2][why] · [式 8][score]
4. **同时学习跨模态排序与动作特征重建。** 四种模态共形成六种无序组合。每一组在批内双向打分，配对样本位于目标相似度矩阵的对角线，以双向 KL 损失训练。另随机遮住动作 token，用文字、视频、语音和剩余动作 token 重建被遮盖的动作特征；重建损失权重为 0.1。推理返回库中原有的骨架序列，训练中的重建头预测的是特征。[式 4–12][align]

### 一个完整例子

以原图 7 的“右腿踢动”为例。下列中间步骤是按公式对该案例的推演，图中没有公布词与某个关节之间的具体点积分数。[原图 7][kick]

1. 用户输入描述；文本分支为左右侧、踢动及其他上下文产生一串向量。候选库中两条动作都出现抬腿，其中一条抬右腿，另一条抬左腿。
2. 每条候选的八个部位分别编码。比较右腿动作时，有关“踢”的词元可以在动作发生的那几帧找到高分项。有关左右的局部证据是否也支持这个候选，会影响加权后的整段分数。
3. 反向再让动作局部寻找文字证据，然后按与每条候选的最终得分排序。原图 7 第一行中，本文检索到踢右腿的动作，LAVIMO 返回的示例踢了左腿。图 7 展示的是文字查询，语音查询另见图 8。这个结果没有给出全库逐样本的左右侧正确率。[原图 7][kick] · [原图 8][voicefig]

### 训练与推理

**语音监督从哪里来。** Original 直接把 HumanML3D 和 KIT-ML 原描述交给 Tortoise，用随机说话人音色合成语音。Oral 再用 ChatGPT-3.5 把描述改为更接近口头指令的表达，随后合成单声道 16 kHz WAV。作者报告 HumanML3D 和 KIT-ML 分别产生 87,384 和 12,696 对 Oral 语音—动作样本。口令的时长由朗读决定，训练配对发生在整句与整段动作之间。[原图 6、表 I][data]

**训练设置与速度。** 实现段报告 AdamW、批量 64、200 轮和 8 张 A6000，四模态效率段另写 4 张 A6000、HumanML3D 每轮 0.47 小时和总计 24.2 小时，KIT-ML 每轮 0.253 小时和总计 5.96 小时。每轮数值乘 200 与相应总时长不符，公开稿未交代二者如何对应。单张 A6000 上，HumanML3D 全测试集的平均逐样本检索延迟报告为文字 92.6 毫秒、语音 49 毫秒；适用范围是该候选库和作者的测量设置。[§IV 实现设置][exp] · [§IV-D 效率分析][discussion]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

下表节选原表 II、III 的 **All** 协议，候选为整个测试集。R@K 是正确配对排入前 K 名的查询百分比，越高越好。前三种任务都返回动作，表中三模态训练使用文字、视频和动作。论文还测试了相似度阈值 0.80 放宽匹配、以及每批 32 对的小候选集，两种设置的成绩应单独阅读。[表 II，HumanML3D][hml] · [表 III，KIT-ML][kit]

| 数据集 | 方法 | 文字→动作 R@1 ↑ | 文字→动作 R@10 ↑ | 视频→动作 R@1 ↑ | 语音→动作 R@1 ↑ |
|---|---|---:|---:|---:|---:|
| HumanML3D | TMR | 5.68 | 30.94 | — | — |
| HumanML3D | LAVIMO | 6.37 | 33.67 | 39.35 | — |
| HumanML3D | 本文三模态 | 8.78 | 40.69 | 60.10 | — |
| HumanML3D | 本文四模态 | **9.41** | **43.83** | **64.78** | **16.19** |
| KIT-ML | TMR | 7.23 | 47.00 | — | — |
| KIT-ML | LAVIMO | 10.16 | 49.80 | 59.76 | — |
| KIT-ML | 本文三模态 | 12.26 | 53.95 | 64.85 | — |
| KIT-ML | 本文四模态 | **13.44** | **60.22** | **65.40** | **11.98** |

原表 IV 单独测试**口语改写后的 Oral 测试集**。这组实验把 LAVIMO 和本文模型都设为**动作、文字、语音三模态**，与上表的三模态配置不同。这里只摘录语音→动作；MedR 是正确结果的中位名次，越低越好。[表 IV 与 §IV-B][oral]

| 模型 | 训练语音 | R@1 ↑ | R@10 ↑ | MedR ↓ |
|---|---|---:|---:|---:|
| LAVIMO | Original | 6.19 | 34.99 | 21 |
| LAVIMO | Oral | 7.78 | 39.06 | 18 |
| 本文 | Original | 7.91 | 44.45 | 13 |
| 本文 | Oral | **11.55** | **48.95** | **11** |

### 消融实验

HumanML3D 全库检索，节选原表 V。去掉分部位时，编码器直接处理完整骨架；去掉序列级对齐时，失去逐 token 匹配。破折号表示该项在原表没有报告。[表 V][ablation]

| 设置 | 文字→动作 R@1 ↑ | 文字→动作 R@10 ↑ | 视频→动作 R@1 ↑ |
|---|---:|---:|---:|
| 完整四模态 | **9.41** | **43.83** | **64.78** |
| 去掉序列级对齐 | 9.15 | 42.82 | 50.36 |
| 去掉身体分区 | 7.77 | 37.51 | 34.04 |
| 去掉跨模态对齐损失 | 0.00 | 0.54 | — |

**局部相似度如何聚合。** 表 VIII 的文字→动作 R@10，单个全局向量为 33.67，把所有局部两两相似度直接平均降至 18.06，每个 token 取自身最佳匹配再汇总升至 40.69；再结合全局分数可达 44.29。表 VII 用于语音压缩的对照里，平均池化两种设置的语音→动作 R@1 为 9.33 和 10.00，1D 卷积为 9.03，记忆注意力为 16.19。[表 VII][compression] · [表 VIII][similarity]

### 关键发现

1. 摘要的两个提升都以 HumanML3D 全库上的 LAVIMO 为参照。文字→动作 R@10 从 33.67 到 43.83，相差 **10.16 个百分点**；视频→动作 R@1 从 39.35 到 64.78，相差 **25.43 个百分点**。若只比较本文三模态和四模态，文字 R@10 的差为 **3.14 个百分点**，更接近读者想问的“新增语音后提升多少”。[原表 II][hml]
2. 各查询对局部建模的敏感度不同。去掉序列对齐，视频 R@1 少 14.42 个百分点，文字 R@1 少 0.26 个百分点；去掉身体分区，视频 R@1 少 30.74 个百分点。全库排序结果支持保留部位信息，但无法从这些数值还原词与关节的逐帧真值对应。[原表 V][ablation]
3. 在同一次 Oral 测试上，本文模型用 Oral 训练比用 Original 训练高 3.64 个百分点的语音 R@1。这个对照改变了口语改写和相应合成录音的分布，能回答训练指令与使用场景匹配的价值；跨说话人、口音或真实场馆的稳定性需要另外测量。[原表 IV][oral] · [真实语音演示][discussion]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **局部证据和整段检索可以共存。** 用户最终要一个完整片段，评分时仍可让部位和不同时段分别参与。图 7 的左右腿例子说明，动作类别已相同的两个候选，仍可能因局部区别改变排序。[原图 7][kick] · [原式 8][score]
- **训练时多一种模态，查询时仍可少一种输入。** 增加合成语音后，用户仅持一段视频也能查询同一模型。HumanML3D 视频→动作 R@1 从本文三模态的 60.10 升至四模态的 64.78，为这种跨模态收益提供了直接对照。[原表 II][hml]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **动作的先后顺序还可能被漏掉。** 编码器包含上下文，但式 8 允许两个词选中同一个最相似片段，对“先抬手后转身”和相反顺序没有硬约束。作者图 12 给出长描述检索失败的案例；20 FPS 下 196 帧约为 9.8 秒，作者建议拆句检索再拼接。拼接后的长动作连续性还需另行评测。[式 8][score] · [原图 12、§IV-D][discussion]
- **口令和共语手势的配对关系不同。** 这里只有“说出一个动作要求→找相应动捕”，合成声音源于描述。对于同一句话该在哪个重音做手势、说话人的韵律是否决定动作幅度，这组数据缺少说话表演与骨架同步的监督。[§III-C][data]
- **真实录音证据有限。** 作者以两名用户在安静室内录制的语音做演示，还人工加入 10 dB 信噪比的高斯白噪声。图 10–11 可检查具体检索结果，但未报告大规模自然会话、真实环境噪声下的全库召回率。[§IV-D][discussion]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **TMR（ICCV 2023）** 也把动作检索作为独立任务，在文本—动作对齐之外保留生成监督。本文把查询扩展到视频与语音，并用双向局部最大相似度为候选排序。TMR 的多种候选池协议值得保留，因为 32 选 1 和全库第 1 名难度相差很大。[TMR 作者项目][tmr] · [本文表 II][hml]
- **Tri-Modal Motion Retrieval（CVPR 2024）** 是作者明确指出的前作，本文表中标作 LAVIMO。它把人体视频引入文本和动捕的共同空间。期刊稿先比较新的三模态方法，再加入第四种语音模态，使局部匹配和额外模态的影响可以分开观察。[前作][lavimo] · [本文引言与版本关系][intro]
- **对动作素材库的启发。** 若部署场景在意“左还是右”“先做哪一步”，可利用现有分部位表示设计专门的困难候选集，让相同动作类别、不同侧别或不同顺序的条目相互竞争。这是根据图 7 和图 12 推出的评测建议，论文报告的是整库排名。[左右侧案例][kick] · [长指令案例][discussion]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- 正式刊载记录与作者公开稿。论文架构、示例、实验数字按 arXiv v1 的 §III–IV、图 2–12、表 I–VIII 核对。[IEEE TMM][venue] · [arXiv 版本][record] · [HTML 全文][html] · [PDF][pdf]
- 细粒度评分、语音压缩和训练重建的原始说明。架构图为本站重绘，性能来自论文报告。[图 3][pipeline] · [图 5][audio] · [式 4–12][align]
- 文字检索与三模态检索的对照来源。核对日期为 2026 年 11 月 26 日。[TMR][tmr] · [三模态前作][lavimo]

</div>

[html]: https://arxiv.org/html/2507.23188v1
[record]: https://arxiv.org/abs/2507.23188
[pdf]: https://arxiv.org/pdf/2507.23188v1
[venue]: https://doi.org/10.1109/TMM.2026.3654382
[intro]: https://arxiv.org/html/2507.23188v1#S1
[why]: https://arxiv.org/html/2507.23188v1#S1.F2
[pipeline]: https://arxiv.org/html/2507.23188v1#S2.F3
[enc]: https://arxiv.org/html/2507.23188v1#S3.SS1
[audio]: https://arxiv.org/html/2507.23188v1#S3.F5
[align]: https://arxiv.org/html/2507.23188v1#S3.SS2
[score]: https://arxiv.org/html/2507.23188v1#S3.E8
[data]: https://arxiv.org/html/2507.23188v1#S3.SS3
[exp]: https://arxiv.org/html/2507.23188v1#S4
[hml]: https://arxiv.org/html/2507.23188v1#S4.T2
[kit]: https://arxiv.org/html/2507.23188v1#S4.T3
[kick]: https://arxiv.org/html/2507.23188v1#S4.F7
[voicefig]: https://arxiv.org/html/2507.23188v1#S4.F8
[oral]: https://arxiv.org/html/2507.23188v1#S4.SS2
[ablation]: https://arxiv.org/html/2507.23188v1#S4.T5
[length]: https://arxiv.org/html/2507.23188v1#S4.T6
[compression]: https://arxiv.org/html/2507.23188v1#S4.T7
[similarity]: https://arxiv.org/html/2507.23188v1#S4.T8
[discussion]: https://arxiv.org/html/2507.23188v1#S4.SS4
[tmr]: https://mathis.petrovich.fr/tmr/
[lavimo]: https://openaccess.thecvf.com/content/CVPR2024/html/Yin_Tri-Modal_Motion_Retrieval_by_Learning_a_Joint_Embedding_Space_CVPR_2024_paper.html
