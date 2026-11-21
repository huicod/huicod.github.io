---
title: "[ACMMM2025] Contextual Gesture：怎样让语音重音落在手势上？"
description: "解读 Contextual Gesture: Co-Speech Gesture Video Generation through Context-aware Gesture Representation。沿着语音、面部和上身的两路对齐，追踪动作监督如何进入语音适配层、动作码本和说话视频。"
pubDate: "2026-11-21"
badge: "Paper"
tags: ["Contextual Gesture", "Co-Speech-Gesture", "Audio-Motion Alignment", "WavLM", "Motion Tokenization", "Gesture Video", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[可翻译的 arXiv HTML 全文（含附录）][html] · [原文 PDF][pdf] · [ACM 会议条目][acm] · [作者视频演示][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · ACM Multimedia 2025</summary>

*Contextual Gesture: Co-Speech Gesture Video Generation through Context-aware Gesture Representation*，作者为 Pinxin Liu、Pengfei Zhang、Hyeongwoo Kim、Pablo Garrido、Ari Shapiro、Kyle Olszewski。论文收录于 ACM Multimedia 2025，第 9803–9812 页。本文按 2025 年 9 月 22 日的 arXiv v3 及附录核对架构与数字。视频生成采用 PATS，三维动作生成采用 BEAT-X，两者各有独立的输入表示和评测流程。[ACM 记录][acm] · [版本记录][abs] · [原文][html]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给一张说话人的照片和一段新语音，Contextual Gesture 先生成面部和上身的关键点，再把照片变成说话视频。它让预提取的语音特征分别去匹配脸和身体，用“同一段声音、片段次序却错了”的样本训练时间敏感性，再把学到的关系蒸馏进动作码本。[原文图 2][fig2] · [原文图 3][fig3]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　共语手势可以先生成骨架再渲染，也可以直接对说话人图像做形变。前者便于检查手势，后者能保留人物外观，本篇尝试把二者接起来。[原文 §1][intro]

**现有痛点**　仅用关键点重建误差训练的码本，知道手抬了多高，却缺少这次抬手与哪一段声音相配的信息。只看整段语音和动作是否相似，又容易忽略重音和手势峰值出现的先后。[原文 §3.1][align]

**核心矛盾**　同一句话可以配多种合理动作，但真实配对中仍有时间结构。训练既要允许说话人选择不同手势，也应分辨同一个手势在这个短语上是否合拍。[原文 §3.1][align] · [检索实验][retrieval]

**本文目标**　给定一个说话人和目标语音，生成与语音有时间关联的脸部和身体动作，并在视频中保留身份、肩部和手部轮廓。[原文图 2][fig2]

**切入角度**　分别训练“语音—脸”和“语音—身体”的对应关系，比较原始录音与按词边界重排的录音。两者音色和局部发音高度相似，只有原始顺序对应同一段录像。[原文 §3.1][align]

**核心 idea**　对齐同时影响生成器的两端。输入端获得学过脸部与身体对应关系的语音编码层，输出端的动作码本在训练时模仿对齐过的动作教师。推理时，两端通过交叉注意力和动作编号预测重新接起来。[原文图 3][fig3] · [实现细节][impl]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

沿两条线读图。第一条是训练线，先用同步录制的动作训练对齐器，再由动作教师指导量化器。第二条是生成线，从参考图的起始姿势、说话人身份与新语音出发，生成两套动作编号，解码为每帧关键点，最后渲染参考人物。[原文图 2][fig2] · [原文图 3][fig3]

<figure class="reading-figure"><a href="/paper-notes/contextual-gesture/architecture.svg" target="_blank" rel="noopener"><img loading="lazy" src="/paper-notes/contextual-gesture/architecture.svg" alt="Contextual Gesture 的训练与生成。预提取语音特征分别和面部、身体动作做对比学习。动作教师蒸馏到两套残差码本，语音编码层用于生成动作编号。二维关键点随后驱动图像形变与边缘细化。" /></a><figcaption>本站依据原文图 2、图 3 及附录 C–E 重绘。左上两路对齐的输出流向不同位置。语音编码层被用于初始化生成器的条件分支，动作编码器在训练时向量化器提供逐帧蒸馏目标。点击可放大。</figcaption></figure>

### 关键设计

1. **动作监督训练了哪些语音参数？** 附录 C 写明，WavLM 的 1024 维向量提前提取，低层 Mel 与节拍信息共 34 维，两者按通道拼接。正文还把 RoBERTa 转录文本嵌入列入语音表示，附录给出的声学维度不包括这部分。训练中，面部与身体分别配一个语音编码器和一个动作编码器，各侧使用两层 Transformer，隐藏维 384。时间均值池化后，两层 MLP 做投影，使用双向对比损失。动作监督由此进入新加的语音层。论文没有报告用这项损失更新 WavLM 主干。[输入特征][features] · [编码器与温度][enc] · [式 1][align]

2. **让真假样本只在时间组织上就能出现差别。** 批内其他录音原本就可作负例。作者再用 WhisperX 找到词与音素的时间边界，切分并重排来自同一录音的片段，把重排声音配上原始动作作为额外负例。这里训练的是判断同步片段的能力；词序重排有时也会改变句义，因此消融测到的是这种增强策略的整体效果。[原文 §3.1][align] · [附录 F][retrieval]

3. **把对应关系存进动作码本。** 视频中的 68 个脸部二维点组成 136 维向量，肩臂与双手共 48 个二维点组成 96 维向量。脸和身体分别训练 RVQ-VAE，各自有六层残差码本，每层 1024 个码，隐空间 128 维，时间上保持原帧数。在关键点重建与码本约束之外，量化输出经线性投影，逐帧与对应动作教师的特征提高余弦相似度。教师只读取真实动作，但已从第一阶段学过哪个动作片段与哪段语音相配。[原文式 2–3][align] · [附录 D 的码本设置][rvq]

4. **从一张参考图和一段语音生成连续运动。** 首帧动作 token 作为起点，其余时刻从遮罩开始。生成器用对齐得到的语音分支做交叉注意力，通过 AdaIN 注入说话人身份。基础层多轮预测，置信度最低的位置重新遮住；残差生成器再补细节，RVQ 解码器把离散编号还原成连续关键点。需要更长视频时，以前一窗口末尾若干帧为条件续写。[原文 §3.2][generator] · [附录 E][decode] · [长序列与编辑][edit]

5. **动作合理之后，画面仍可能有问题。** 薄板样条根据关键点对源图做形变，在快速手部动作附近容易模糊。作者沿人体连接绘制可微的高斯边缘热图，学习每条边的宽度，把多尺度热图送进细化网络，改善手和肩附近的结构。BEAT-X 的三维评测直接比较动作，跳过整个画面生成步骤。[原文 §3.3][render] · [附录 D][impl] · [BEAT-X 设置][beat]

### 一个完整例子

设输入是一位讲者的照片和 **3.2 秒**语音，“这两种方法，分别是……”的重音落在“两种”上。这是按 PATS 训练窗口构造的说明例子。80 帧内，脸部输出是 **80 × 136** 个坐标分量，肩臂和手部输出是 **80 × 96** 个分量。两套码本各保留 80 个时间位置，生成器在整窗里依据语音选择动作编号。解码后可以核查讲者是否在重音附近抬手。模型没有接收“伸两根手指”或“在第 32 帧指向画面右边”的目标，生成结果只能逐例检查。作者在项目页演示了替换前 7 秒语音、保留后 8 秒原片段的局部编辑。[窗口与步幅][pats] · [原文图 7][applications] · [编辑视频][project]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**PATS 的视频结果，原表 2 节选。** 作者在四位说话人的 256 × 256 视频上比较。FGD 在生成的视频上重新检测关键点后计算，越低表示生成与真实动作的特征分布越近。BAS 衡量节拍对齐，FVD 衡量视频分布距离。最后一列为生成约 10 秒视频的耗时。[原表 2][video] · [计时平台][speed]

| 方法 | FGD ↓ | 多样性 ↑ | BAS ↑ | FVD ↓ | 推理时间 ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| ANGIE | 34.13 | 7.87 | 0.78 | 515.43 | 30 秒 |
| S2G-Diffusion | 10.54 | 10.08 | 0.98 | 493.43 | 35 秒 |
| EchoMimicV2 | 13.65 | 9.85 | 0.98 | 466.84 | 1200 秒 |
| 本文动作 + AnimateAnyone 渲染 | **6.56** | 13.06 | 0.99 | 477.82 | 50 秒 |
| **Contextual Gesture** | 8.76 | **13.13** | 0.99 | **466.43** | **3 秒** |

换用 AnimateAnyone 渲染，同一动作方法得到更低的 FGD，但 FVD 和速度变差。FGD 一列也受渲染及重新检测的影响。作者还报告单张 A100 训练共约 6 天，推理在单张 RTX A6000 上测得。整段推理耗时只说明吞吐量，论文没有给出在线逐帧响应的延迟。[原文 §4.2][vsettings] · [附录表 5][speed]

**BEAT-X 的三维动作结果，原表 1 节选。** 此处直接生成 SMPL-X 动作；数值沿用原表缩放。BC 的箭头表示接近真实动作的节拍指标（0.703）更好。MSE 计算面部顶点误差。[原表 1][beat]

| 方法 | FGD ↓ | BC → | 多样性 ↑ | 面部 MSE ↓ |
| --- | ---: | ---: | ---: | ---: |
| DiffSHEG | 7.141 | 0.743 | 8.21 | 9.571 |
| TalkShow | 6.209 | 0.695 | 13.47 | 7.791 |
| EMAGE | 5.512 | 0.772 | 13.06 | 7.680 |
| 本文去掉蒸馏 | 5.079 | 0.737 | 13.24 | 7.742 |
| **Contextual Gesture** | **4.434** | 0.724 | **13.76** | **7.021** |

### 消融实验

**逐步加入码本、蒸馏与时间负例。** 作者直接在动作生成器输出的二维关键点上评测，以排除渲染误差。PCM 统计满足误差标准的动作参数比例。普通蒸馏后继续引入时间负例，FGD 从 2.75 降为 0.87，PCM 只从 0.58 升到 0.59，这两种指标对改动的反应不同。[表 3b][reprtab]

| 动作表示，逐行累加 | FGD ↓ | PCM ↑ |
| --- | ---: | ---: |
| 直接预测关键点 | 8.84 | 0.35 |
| 加残差向量量化 | 3.43 | 0.37 |
| 加普通语音—动作对齐蒸馏 | 2.75 | 0.58 |
| 加时间重排负例 | **0.87** | **0.59** |

**把已学的语音层换成随机初始化会怎样？** 表 3c 的这一行直接检验初始语音—动作对齐是否有用。同表还分别去掉残差生成器、改变条件融合方式。[表 3c][gentab]

| 生成器设置 | FGD ↓ | PCM ↑ |
| --- | ---: | ---: |
| 音频条件改为拼接 | 3.55 | 0.51 |
| 去掉残差生成器 | 1.62 | 0.51 |
| 语音编码层随机初始化 | 1.33 | 0.53 |
| 完整模型 | **0.87** | **0.59** |

**图像端的收益可以单独测。** 只做形变时 FVD 为 494.35，增加普通 U-Net 后为 478.54，加入固定骨架图后为 473.34，采用可学习的边缘热图后为 466.43。这里的改变发生在画面渲染阶段。[表 3g][rendertab]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

同一次对齐训练，能为两个后续模块提供不同的信息。语音输入分支学到哪些声学或词义线索值得关注，量化器则从动作教师学到哪些姿态差异对匹配语音有用。要判断收益来自哪边，可以并读两项消融：表 3b 的“加蒸馏”检验输出动作表示，表 3c 的“随机初始化”检验生成端语音分支的起点。把两项都概括成“微调了语音模型”，会丢掉这个区别。[表 3b][reprtab] · [表 3c][gentab]

检索提供了一个与视频观感独立的检验。仅看 32 个候选时，增加时间负例使语音检索身体动作的 R@1 从 25.542% 升至 28.732%。候选增至全部 8176 段后，这个数只有 0.132%。反过来在 32 个候选里用身体动作检索语音，R@1 还从 24.052% 降至 22.671%。对齐能帮助生成器缩小合适动作的范围，远未达到从声音唯一还原说话人当时动作的程度。[附录 F 表 4][rettab]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **同词不保证同动作。** 时间负例用错序音频训练，缺少逐词的手势类别、空间指向或接触监督。BAS 测节律，FGD 测分布。验证“讲到某个词时是否指对了屏幕目标”，还需定义词级事件、目标位置与允许的时间误差。[原文 §3.1][align] · [原表 2][video]
- **脸部和身体分开建模，精细唇形仍有误差。** 作者未加入专门的唇动同步约束。PATS 中快速手部动作本身常有运动模糊，边缘细化后仍会出现闪烁。生成的二维视频也缺少可直接导入三维角色的深度与关节旋转。[附录 L][limits]
- **长序列的效果取决于数据。** PATS 短片（≤10 秒）的 FGD 为 1.303，延长后变为 2.356；BEAT-X 上则从 4.747 变为 4.650。可在项目页观看较长的结果，同时应区分窗口接续的能力和长时间保持手势丰富度的表现。[表 3f][longtab] · [项目演示][project]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **MoMask** 给出“先并行补基础动作编号，再预测残差”的生成策略。本篇在这一步加上语音条件、说话人身份及受语音监督的面部和身体码本。从 MoMask 读过来，可以重点追踪码本在学什么，而不仅是解码需要几轮。[MoMask 站内解读](/blog/cvpr2024-momask/) · [生成方法][generator]
- **Rhythmic Gesticulator** 从语音节律切入，讨论如何挑选和组织相配的动作单元。Contextual Gesture 通过重排语音制造负例，利用真实动作片段训练对应关系。要比较“这一拍是否抬手”和“这一词是否产生正确手势”，应分开设置指标。[Rhythmic Gesticulator 站内解读](/blog/siggraph-asia2022-rhythmic-gesticulator/) · [时间对齐][align]
- **Intentional-Gesture** 进一步把转录与交际功能做成显式条件，可以追问模型怎样区分“解释”和“强调”。Contextual Gesture 的输入里没有同等的交际功能标签，语音与动作片段之间的相似度是主要的间接证据。[Intentional-Gesture 站内解读](/blog/neurips2026-intentional-gesture/) · [检索对照][rettab]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- ACM Multimedia 2025 收录信息、作者和最终页码。[ACM 会议记录][acm] · [arXiv 版本记录][abs]
- arXiv v3 全文、主表、附录与原始架构图。[可翻译 HTML][html] · [PDF][pdf] · [原架构图][fig3]
- 作者提供的语音替换、长段生成和跨身份重演演示。文中数字出自论文，本解读未独立运行训练或生成模型。[项目页][project]

</div>

[html]: https://arxiv.org/html/2502.07239v3
[pdf]: https://arxiv.org/pdf/2502.07239v3
[abs]: https://arxiv.org/abs/2502.07239
[acm]: https://doi.org/10.1145/3746027.3755140
[project]: https://andypinxinliu.github.io/Contextual-Gesture/
[intro]: https://arxiv.org/html/2502.07239v3#S1
[fig2]: https://arxiv.org/html/2502.07239v3#S2.F2
[fig3]: https://arxiv.org/html/2502.07239v3#S3.F3
[align]: https://arxiv.org/html/2502.07239v3#S3.SS1
[impl]: https://arxiv.org/html/2502.07239v3#A4
[features]: https://arxiv.org/html/2502.07239v3#A3.SS2.SSS0.Px2
[enc]: https://arxiv.org/html/2502.07239v3#A4.SS0.SSS0.Px2
[rvq]: https://arxiv.org/html/2502.07239v3#A4.SS0.SSS0.Px3
[generator]: https://arxiv.org/html/2502.07239v3#S3.SS2
[render]: https://arxiv.org/html/2502.07239v3#S3.SS3
[decode]: https://arxiv.org/html/2502.07239v3#A5
[edit]: https://arxiv.org/html/2502.07239v3#S4.SS4
[pats]: https://arxiv.org/html/2502.07239v3#A3.SS1
[applications]: https://arxiv.org/html/2502.07239v3#S4.F7
[beat]: https://arxiv.org/html/2502.07239v3#S4.T1
[video]: https://arxiv.org/html/2502.07239v3#S4.T2
[vsettings]: https://arxiv.org/html/2502.07239v3#S4.SS2
[reprtab]: https://arxiv.org/html/2502.07239v3#S4.T3.st2
[gentab]: https://arxiv.org/html/2502.07239v3#S4.T3.st3
[longtab]: https://arxiv.org/html/2502.07239v3#S4.T3.st6
[rendertab]: https://arxiv.org/html/2502.07239v3#S4.T3.st7
[retrieval]: https://arxiv.org/html/2502.07239v3#A6
[rettab]: https://arxiv.org/html/2502.07239v3#A6.T4
[speed]: https://arxiv.org/html/2502.07239v3#A8.T5
[limits]: https://arxiv.org/html/2502.07239v3#A12
