---
title: "[CVPR2026] LiveGesture：只听到当前语音，怎样让脸、手和身体同步做动作"
description: "沿一个语音块追踪四个身体区域的动作码，区分零前瞻、单块耗时与首帧延迟，并对照 BEAT2 的节拍同步、动作质量和用户评分。"
pubDate: "2026-11-20"
badge: "Paper"
tags: ["LiveGesture", "Co-Speech Gesture", "Streaming", "SMPL-X", "BEAT2", "Autoregressive", "Motion Tokenizer", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 全文与附录][html] · [会议 PDF][pdf] · [补充材料][sup] · [作者项目与演示][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026</summary>

*LiveGesture: Streamable Co-Speech Gesture Generation Model*。作者 Muhammad Usama Saleem、Mayur Jagdishbhai Patel、Ekkasit Pinyoanuntapong、Zhongxing Qin、Li Yang、Hongfei Xue、Ahmed Helmy、Chen Chen、Pu Wang。收录于 CVPR 2026，第 2264–2273 页。下文核对会议论文、补充材料与 arXiv v1。作者公开了项目页与示例；截至 2026-11-20，本次未核实到公开的模型训练代码、推理实现或权重，实验数值均取自论文。[会议记录][venue] · [作者项目][project]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

数字人一边说话，一边要决定这一刻怎样动手、摆臂、转移重心和做表情。LiveGesture 让四个身体区域各自根据**已经听到的语音和已经生成的动作**提出下一步，再让它们在同一时刻交换信息，最后解码成连续的全身动作。原文的优势主要体现在跟随说话节奏，离线对照在部分动作质量指标上仍有优势。[原文图 3][fig3] · [主表 1][tab1]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 给一整段讲话配动作时，模型可以提前知道重读词落在哪里，也能前后调整手势。对话中的数字人只能随着语音产生而行动。模型即使能很快处理一段录音，也可能得先等这段录音到齐。[引言与图 1][fig1]

**现有痛点：** 节奏合拍和全身配合是两件事。手在重音处抬起来了，肩和躯干仍可能停在上一拍；分别训练脸、手、上身和下身，给了每个区域足够容量，却没有告诉它们其他区域准备怎么动。[方法概览][fig3] · [局部专家对照][tab2b]

**核心矛盾：** 当前手势既依赖先前的姿态，也依赖这一刻其他部位的状态。可以利用这两类信息，却不能为改善当前姿态而偷看下一块语音。论文把空间依赖和时间依赖分开处理。[融合模块][fusion]

**本文目标：** 让连续到达的语音增量驱动 SMPL-X 的身体、双手和面部，并让同一套系统持续生成长于训练窗口的动作。作者分别评估了节拍同步、生成动作分布、多样性、面部误差及人的观感。[实验][experiments] · [指标定义][metrics]

**切入角度：** 离线学习动作表示时，真实动捕的上下文已经齐全；在线播出时，要用的是动作解码器。作者因此给训练端编码器双向视野，同时要求解码器只看已经产生的动作码。[动作分词器][svq]

**核心 idea：** 把“这个区域下一步可能怎么动”和“四个区域的选择合起来是否协调”交给两级网络。用显式时间掩码限制音频和动作历史，再用带缺损的历史训练融合层，让模型有机会从自己先前的预测偏差中恢复。[原文图 2][fig2] · [掩码训练][mask]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练时从真实动作建立四套离散词表；推理时只需让语音向前流动。原始波形经过因果音频编码器，到达当前动作步的四个区域专家。融合层读取它们的状态，为每个区域选一个动作码，各自解码并拼成 SMPL-X 参数。转录文字是可选条件，实时使用时也只允许读取已到达的部分。[原文图 2–3][fig3] · [推理设置][harimpl]

<figure class="reading-figure"><a href="/paper-notes/livegesture/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/livegesture/architecture.svg" alt="LiveGesture 的离线动作分词和在线生成。当前音频与区域动作历史输入四个专家，经当前步跨区域融合，得到四个离散动作码，再因果解码为连续动作。" loading="lazy" /></a><figcaption>据原文图 2、3 与附录 B 重绘。先看训练时如何得到动作码，再顺着在线路径找到唯一能够读取同一时刻其他身体部位的融合层。点击可放大。</figcaption></figure>

### 关键设计

1. **把四个身体区域压到同一个时间步上。** 上身是 13 个关节的 78 维旋转，双手是 30 个关节的 180 维旋转；面部由 100 维表情和 3 维下颌旋转组成；下身含 9 个关节的 54 维旋转、3 维全局平移和 4 个足接触标记。训练时每区输入 16 帧，经过两次步长为 2 的卷积，变成 4 个时间步。每个时间步在各自区域的码本里查找一个编号。一个编号对应学习到的 128 维向量，它的含义要通过解码后的动作来观察。[附录 B.1][svqimpl]

2. **用双向运动编码器学习，用因果运动解码器播出。** 第一阶段先重建连续动作。第二阶段固定编码器和解码器，学习量化码本和投影层，把有限的离散向量送回解码器原先熟悉的空间。在线时真实动捕无需到场：预测的编号查表后经投影、逐级上采样和仅左填充的卷积，即可生成当前一组动作帧。之前已经播出的帧无需等下一个码才能确定。[原文图 2][fig2] · [附录 B.1][svqimpl]

3. **让声音和动作共用时钟。** 语音波形先转为短窗 log-mel 特征，再经过仅左填充的卷积和多尺度因果膨胀卷积，按动作码的时间步长聚合。每个区域专家 xAR 共享这一音频编码器，但分别读取自己的历史动作码，可用时再读取当前及以前的转录。它们产生的是当前动作的候选状态；专家的局部历史窗口上限是 32 个动作码。[音频编码器][audio] · [区域专家配置][harimpl]

4. **在当前步横向交换信息，沿时间只向后看。** PILOR 是将四路专家状态映射到融合空间的适配层。融合网络 xAR-Fuse 做三件事：让同一时刻的区域彼此注意，读取已有的全身状态缓存，再对齐截至当前的音频。四个分类头据此为各区预测动作码。例如，同一重音可以同时影响手势幅度与上身姿态，而下一词的音频仍不可见。[融合模块][fusion] · [附录 B.2][harimpl]

5. **训练时有意给出不完美的历史。** 局部专家先在真实动作历史上学习预测下一个编号，并在部分历史嵌入上加噪。训练融合层时，作者优先遮住专家信心较低的码，也会随机遮住整个区域的一段输入，让融合层从可用的历史、语音和其他区域重建。部署时继续逐步生成，训练用的真实未来动作和随机遮挡都不属于在线输入。[掩码训练][mask] · [附录 J][regionmask]

### 一个完整例子

图 4 有一段讲话含有 “few seconds”。假设它是数字人正在说出的回复。听到当前重音时，在线系统已经知道说话者此前的音量变化，也记得自己上一刻把手放在哪里。它可以据此生成一个与重音同拍的手势。以下尺寸来自作者的分词器；示例不为某个单词指定固定手势。[原文图 4][fig4] · [附录 B][svqimpl]

| 这一环节 | 数据怎样变化 |
| --- | --- |
| 音频到达 | 对话演示中，VITA-Audio 分块送入数字人**自己的回复语音**。因果音频编码器把已到达的波形变成与动作步对齐的音频特征。 |
| 区域预测 | 手部专家读此前的手部码，上身专家读此前的上身码；下身和面部也各自产生当前状态。四个状态都可读取当前语音。 |
| 全身协调 | 融合四路状态后，每一步输出上身、下身、双手、面部各一个编号。按四倍时间下采样计算，16 帧训练片段对应 4 个时刻、共 16 个区域编号。 |
| 连续输出 | 每一区域查自己的码本并因果解码，合成动作、位移和表情。下一步把生成历史接回去，不需要等整句话结束。 |

<figure class="reading-figure"><a href="/paper-notes/livegesture/figure-4.png" target="_blank" rel="noopener"><img src="/paper-notes/livegesture/figure-4.png" alt="原文图 4 将同一音频下的真实姿态与四种方法并排比较。三组示例中间一组含有 few seconds。" loading="lazy" /></a><figcaption>原文图 4，Saleem 等，2026，<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。快照可以比较姿态与手臂活动幅度；要判断是否跟上重音，还需结合音频与时序评测。</figcaption></figure>

### 训练与推理

作者在 BEAT2 上训练和评测，文中列出 25 位说话者、1,762 段对话、约 60 小时，沿用 EMAGE 的训练／测试划分。动作分词器训练完成后，先训练各区域专家，再冻结分词器、音频编码器和专家，更新适配层、融合网络及输出分类头。论文报告了训练设置，本次未运行模型或独立复测端到端延迟。[主文实验][experiments] · [附录 B.2][harimpl]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 在零前瞻条件下，哪些指标仍然有竞争力？

下表节选原表 1，保留作者的数值尺度。FGD 越低表示生成动作的特征分布越接近动捕；BC 比较上身运动节拍与语音韵律峰的时间关系，依原表标为 →，本组结果中作者将较高值解释为更同步。Diversity 比较同一音频下不同生成结果的差别，面部 MSE 比较预测与真实面部顶点。[原表 1][tab1] · [指标定义][metrics]

| 方法 | 表中标为零前瞻 | FGD ↓ | BC → | Diversity ↑ | 面部 MSE ↓ |
| --- | --- | ---: | ---: | ---: | ---: |
| EMAGE | 否 | 5.512 | 0.772 | 13.06 | 7.680 |
| MambaTalk | 否 | 5.366 | 0.781 | 13.05 | 7.680 |
| SynTalker | 否 | 4.687 | 0.736 | 12.43 | — |
| GestureLSM | 否 | **4.247** | 0.729 | 13.76 | **1.021** |
| LiveGesture | 是 | 4.57 | **0.794** | **13.91** | 1.241 |

在这张表里，LiveGesture 的节拍同步和多样性最高；GestureLSM 的 FGD 和面部误差更低。作者还让 15 位参与者观看匿名、随机排序的片段，用 1–5 分评价。人评也呈现类似取舍，尤其是同步和平滑度两列。论文给出平均值，未报告这两种方法之间的显著性检验。[附录 E，原表 2][mos]

| 方法 | 自然真实 ↑ | 语音同步 ↑ | 动作平滑 ↑ |
| --- | ---: | ---: | ---: |
| CaMN | 3.3 | 3.2 | 3.6 |
| EMAGE | 3.5 | 3.5 | 3.7 |
| GestureLSM | **4.2** | 4.1 | **4.3** |
| LiveGesture | 4.1 | **4.3** | 3.9 |

### “实时”具体量了哪段时间？

| 原文披露量 | 数值 | 起止点或含义 |
| --- | ---: | --- |
| 语音块步长 | 200 ms | 对话原型中，上游语音系统送来音频块的节奏。[附录 B.3][conversation] |
| 单块生成耗时 | < 50 ms | 图 1 对每个 200 ms 音频块报告的手势推理耗时。[原文图 1][fig1] |
| 首帧延迟 | 250 ms | 主文定义为收到首个音频 token 至输出首个动作帧。[主文实验][experiments] |

**零前瞻说的是时刻 t 的预测可以用哪些输入。** 第一帧仍要计算，也要先有输入。三项数字的计时起点不同，原文未给出一条从用户开口、语音代理构思回复、生成语音到最终画面显示的完整计时记录。[对话原型][application]

### 消融实验

原表 2(a) 直接移除模块，其他各行使用作者的对应设定。此表的完整版 Diversity 记为 **13.97**，主表 1 记为 **13.91**，下表保留各自出处的原值。[原表 2(a)][tab2a]

| 改动 | FGD ↓ | BC → | Diversity ↑ |
| --- | ---: | ---: | ---: |
| 移除专家适配层 PILOR | 4.89 | 0.774 | 13.41 |
| 移除按置信度遮挡的训练 | 4.98 | 0.723 | 13.64 |
| 移除融合层跨部位注意力 | 6.64 | 0.732 | 11.56 |
| 移除融合层时间注意力 | 15.52 | 0.712 | 10.40 |
| 去掉文字提示 | 4.60 | 0.796 | 13.96 |
| 完整模型 | 4.57 | 0.794 | 13.97 |

- **四个专家独立输出够不够？** 原表 2(b) 中，仅用各区专家的 FGD 为 **6.458**，加入融合后降至 **4.57**。表 2(a) 进一步表明，对 FGD 影响最大的是融合层读取全身历史的能力。只让四个部位在当前时刻彼此协调，还缺少运动如何延续的信息。[原表 2(b)][tab2b] · [原表 2(a)][tab2a]
- **量化与解码要一起学吗？** 单阶段联合训练得到 FGD **4.691**；先训练自编码器，再只训练量化与投影，结果为 **4.557**。两阶段设置里允许解码器一起更新，结果为 **4.610**。作者据此选择固定已经学好的因果解码器。[原表 2(c)][tab2c]
- **音频编码器需要多大？** 专用因果音频编码器的参数量为 **0.5M**，FGD **4.57**；Magic-Codec 为 **103M**，FGD **4.51**。这些参数量只计算音频编码器。去掉文字后 BC 仍为 0.796，说明纯音频足以支撑这里的节奏评测；这项消融没有逐词检查手势语义。[原表 2(d)][tab2d] · [原表 2(a)][tab2a]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **决定因果性的，是上线时真正走过的路径。** 双向运动编码器可以在训练时看完整动捕窗口，部署时由语音和动作历史直接预测编号。只要音频特征、预测器和解码器在输出时都只用现有信息，就可以借助离线上下文学习表示并在线解码。[图 2][fig2] · [附录 B.1][svqimpl]
- **“怎样动得连贯”与“听上去是否合拍”有不同证据。** 人评把同步和平滑分成两道题，结果在两种方法间出现相反排序。这比笼统地问“哪一个动作更好”更能判断，一个对话系统换成流式生成究竟得到了什么。[附录 E][mos]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **描述性手势仍需单独验证。** 强读某个词时，抬手可以让节拍指标改善。要检验“提到第二个选项就伸两根手指”或“说到屏幕左图就指向它”，还需要目标物、指向方向、手形与发生时刻的真值。BEAT2 主表没有测试这些能力。[指标定义][metrics] · [定性示例][fig4]
- **长时间运行与长时间稳定是两个测量问题。** 因果解码与缓存允许后续语音继续到达，无需预设整段长度。论文未给出按会话时长分组的姿态漂移、足滑率或资源占用曲线；下身编码中包含足接触标记，也还需要输出端的接触误差来验证实际效果。[因果解码与缓存][harimpl] · [分区输入][svqimpl]
- **可复现的速度还需要部署条件。** 250 ms 是作者在特定原型上的首帧数字。硬件、音频采集、上游语音生成、渲染和播放都会影响使用者真正看到动作的时刻。作者项目可查看演示，本次未核实到可独立复测的作者权重。[图 1][fig1] · [作者项目][project]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **GestureLSM（ICCV 2025）。** 它在连续动作潜空间中做少步生成，是 LiveGesture 主表里的直接对照。对一段已备好的语音，减少采样步数可以显著提速；对仍在产生的语音，还要检查当前输出依赖多长的音频上下文。[站内解读](/blog/iccv2025-gesturelsm/) · [直接比较][tab1]
- **MIBURI（CVPR 2026）。** 两篇都关注数字人边说边动。MIBURI 把动作生成接入流式语音模型的内部表示，LiveGesture 的原型则把 VITA-Audio 已输出的回复波形传给手势模型。选择方案时，一个实际区别是能否取得语音模型的内部状态，还是只能拿到输出音频。[MIBURI 解读](/blog/cvpr2026-miburi/) · [LiveGesture 对话接口][conversation]
- **GestureFAR（2026）。** 它同样按时间逐步发出动作，但以连续动作潜变量和流解码器代替这里的分区离散码本。两者适合一起看，用来区分在线生成所需的因果依赖，以及模型为表示手势细节所选的编码方式。[GestureFAR 解读](/blog/arxiv2026-gesturefar/) · [LiveGesture 的动作分词器][svq]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 发表信息、终稿、补充材料。[CVPR 2026 会议记录][venue] · [主文 PDF][pdf] · [补充 PDF][sup]
- 可在线翻译的全文，含正文图表和 A–L 附录。[arXiv HTML][html]
- 作者展示、机构与论文资源。[作者项目与演示][project] · [项目网页文件][sitefiles]

</div>

[venue]: https://openaccess.thecvf.com/content/CVPR2026/html/Saleem_LiveGesture_Streamable_Co-Speech_Gesture_Generation_Model_CVPR_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/Saleem_LiveGesture_Streamable_Co-Speech_Gesture_Generation_Model_CVPR_2026_paper.pdf
[sup]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Saleem_LiveGesture_Streamable_Co-Speech_CVPR_2026_supplemental.pdf
[html]: https://arxiv.org/html/2604.10927v1
[project]: https://m-usamasaleem.github.io/publication/LiveGesture/LiveGesture.html
[sitefiles]: https://github.com/m-usamasaleem/m-usamasaleem.github.io/tree/main/publication/LiveGesture
[fig1]: https://arxiv.org/html/2604.10927v1#S0.F1
[fig2]: https://arxiv.org/html/2604.10927v1#S2.F2
[fig3]: https://arxiv.org/html/2604.10927v1#S2.F3
[fig4]: https://arxiv.org/html/2604.10927v1#S3.F4
[svq]: https://arxiv.org/html/2604.10927v1#S3.SS1
[fusion]: https://arxiv.org/html/2604.10927v1#S3.SS2.SSS2
[audio]: https://arxiv.org/html/2604.10927v1#S3.SS2.SSS3
[mask]: https://arxiv.org/html/2604.10927v1#S3.SS3
[experiments]: https://arxiv.org/html/2604.10927v1#S4
[tab1]: https://arxiv.org/html/2604.10927v1#S4.T1
[tab2a]: https://arxiv.org/html/2604.10927v1#S4.T2.st1
[tab2b]: https://arxiv.org/html/2604.10927v1#S4.T2.st2
[tab2c]: https://arxiv.org/html/2604.10927v1#S4.T2.st3
[tab2d]: https://arxiv.org/html/2604.10927v1#S4.T2.st4
[application]: https://arxiv.org/html/2604.10927v1#S4.SS2
[svqimpl]: https://arxiv.org/html/2604.10927v1#A2.SS1
[harimpl]: https://arxiv.org/html/2604.10927v1#A2.SS2
[conversation]: https://arxiv.org/html/2604.10927v1#A2.SS3
[metrics]: https://arxiv.org/html/2604.10927v1#A3
[mos]: https://arxiv.org/html/2604.10927v1#A5.T2
[regionmask]: https://arxiv.org/html/2604.10927v1#A10
