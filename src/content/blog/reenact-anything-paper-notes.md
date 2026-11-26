---
title: "[SIGGRAPH2025] Reenact Anything：怎样把马的两种步态迁移到同一只卡通狗？"
description: "从马平稳的小跑与起伏更大的轻跑出发，理解如何为每段参考视频优化 75 个运动条件向量，再用冻结的图生视频模型把步态迁移到另一种外形。"
pubDate: "2026-11-26T20:50:00+08:00"
badge: "Paper"
tags: ["Reenact Anything", "SIGGRAPH 2025", "动作迁移", "运动风格", "图生视频", "扩散模型", "文本反演", "Stable Video Diffusion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML（含附录 A–I）][html] · [SIGGRAPH 终稿 PDF][pdf] · [补充材料 PDF][supp] · [作者视频演示][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · SIGGRAPH 2025 Conference Track</summary>

*Reenact Anything: Semantic Video Motion Transfer Using Motion-Textual Inversion*。作者为 Manuel Kansy、Jacek Naruniec、Christopher Schroers、Markus Gross 和 Romann M. Weber，来自 ETH Zürich 和 DisneyResearch|Studios。预印本初版发表于 2024 年 8 月，2025 年 5 月 v2 补充评测并注明获 SIGGRAPH 2025 Conference Track 接收。原文 v2 含附录与完整实验表，正式论文 DOI 为 10.1145/3721238.3730668。作者项目提供动态演示，所查页面未列本方法的官方训练代码或专用权重。本次未运行模型。[版本记录][record] · [正式出处][doi] · [研究机构页面][disney]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给一段马小跑的视频，作者冻结图生视频模型，只优化一小组连续向量，让模型能够重建这匹马怎样跑。随后换上卡通狗的图片，沿用优化好的向量，狗也会呈现类似的小跑节奏；换一段颠簸更明显的马步态作为参考，同一只狗的起伏随之改变。[方法图 4][f4] · [步态对照图 16][f16]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文字适合说“让角色跑”，轨迹适合指定“从左边移到右边”。如果用户想保留一次表演里的停顿、起伏和先后顺序，直接提供示范视频更方便。[引言][intro]

**现有痛点**　对单条视频微调生成器，可能把参考主体的颜色、形状或背景一起记下来。直接引入源光流或特征图，又可能在目标图的错误位置施加运动。例如参考中的动物在左边，不意味着目标也应在左边动。[挑战 1][leak] · [挑战 2][align]

**核心矛盾**　同样是“向前走”，面朝左、面朝右的两个角色应朝不同的屏幕方向移动。若将运动严格等同于源像素位移，就失去了这层相对于角色的意义。[图 17][f17]

**本文目标**　输入一段参考运动和一张新图片，保留目标图的主体、初始位置和场景，生成语义上与参考相似的运动。目标图可以复用在不同参考动作上，也可以将一个参考动作反复应用于多个目标。[任务与结果][results]

**切入角度**　Stable Video Diffusion（SVD）从两处读取首帧。一处按空间布局输入图像潜变量，另一处经交叉注意力读取 CLIP 图像编码。作者观察到，更换后者会明显改变生成动作，同时前者仍能维持大部分目标外观。它提供了一个可操作的运动入口。[两项观察，图 2–3][obs]

**核心 idea**　用可优化的运动嵌入替代原交叉注意力条件。让每个输出时刻拥有自己的条件向量，动作随时间的变化可以写入这些向量，目标图片仍通过原有的图像通路给出。[§3.3–3.4][inversion] · [交叉注意力扩展][inflate]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

模型运行两次。第一次针对一条参考片段反演，让它的去噪重建损失只更新运动嵌入；第二次让冻结的 SVD 从另一张目标首帧出发，按已经优化好的嵌入生成视频。第一次学到的是针对这段动作的条件参数，以后每换一张目标图片都可以复用。[原文图 4][f4] · [逐步实现说明][impl]

<figure class="reading-figure"><a href="/paper-notes/reenact-anything/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/reenact-anything/architecture.svg" alt="Reenact Anything 逐参考片反演和逐目标生成的示意图。参考阶段冻结 SVD，仅用原片去噪误差更新运动条件；应用时更换首帧并复用条件。" /></a><figcaption>依原文图 4 和附录 C 重绘。上半图的虚线标出究竟更新谁，下半图的两路输入标出更换目标时什么跟着换、什么继续沿用。点击可放大。</figcaption></figure>

### 关键设计

1. **把外观交给有空间布局的首帧条件。** 在 SVD 中，首帧经 VAE 编码后的潜变量沿时间复制，与每个时刻的视频噪声拼接。它为每个画面位置提供有空间结构的条件。原本还会被交叉注意力读取的 CLIP 图像嵌入，正是作者选择替换的那一路。因此名称里的 *textual* 指借用了文本反演的优化思路；执行 SVD 版本时，用户不需要为马的步态写出一句准确的描述。[SVD 基线][base] · [图 4][f4] · [§3.3 脚注][inversion]
2. **用单段视频优化运动条件。** 固定同一组 14 帧，为视频潜变量加入随机噪声，将它、参考首帧条件和运动嵌入 m 输入 SVD。去噪结果与无噪声参考构成加权重建损失，梯度只更新 m。空间向量用对应帧的 CLIP 特征初始化，共享的时间向量用全片平均特征初始化，另加少量高斯噪声。所有帧共用同一次空间与颜色增强，作者也把噪声分布向高噪声阶段移动以加快优化。[式 3][inversion] · [附录 C.2][hyper]
3. **给交叉注意力多个可选择的向量。** 查询 Q 来自当前视频潜特征，运动向量经已有的投影形成 K 和 V。只有一个条件向量时，沿条件维的 softmax 权重必然为 1，各位置读到同一份值；扩展到 N 个后，前景、背景或不同部位可以选择不同的混合。这里没有规定第几个 token 永远对应某条腿。[式 4 与图 5][inflate] · [注意力张量形状][attn]
4. **再沿时间区分各帧。** 空间交叉注意力使用 F 组各 N 个向量，使不同时刻的查询可以读不同的键和值。时间交叉注意力另外使用一组共享的 N 个向量，所有空间位置都能读取。默认 F＝14、N＝5，所以一段视频对应 14 × 5 ＋ 5＝**75 个连续向量**，每个向量的宽度沿用 SVD。它们按时间分组，内部没有三维关节或人工标注的动作词表。[§3.4.2][perframe] · [实现细节][attn]

### 一个完整例子

原文附录图 16 从两段不同的马步态出发。看项目动画比看静帧更容易发现区别：一段小跑较平稳，另一段跑步的躯干起伏更大。作者将两种运动分别迁给同一只卡通狗，同样的对照还用到了船、汽车和麦片盒。[图 16][f16] · [作者演示][project]

| 步骤 | 从马到同一只卡通狗 |
|---|---|
| 参考反演 | 对两段马的参考片分别运行优化，得到两份独立嵌入。两者都属于“跑”，但优化对象是各自的视频帧，而非共享的类别名。 |
| 保持目标相同 | 两次都给相同的卡通狗首帧，以它指定外观和起始布局，分别载入小跑或起伏更大的那份运动嵌入。 |
| 看生成过程 | 冻结的 SVD 在各个去噪步骤读取目标画面条件和对应帧的运动向量，最后解码出新 RGB 帧。生成器自行决定狗的四肢怎样实现这次跑动。 |
| 判断结果 | 在狗身上比较两种起伏和节奏。换成船或麦片盒后，仍可观察整体晃动，但没有与马腿逐关节对应的输出。图 16 是定性对照，作者没有报告蹄部接触时刻或三维步态误差。 |

### 训练与推理

每个参考运动使用批大小 1、Adam、学习率 0.01，优化 1,000 次。作者测得，1024 × 576 参考片在一张 80 GB A100 上约需 **1 小时**，峰值显存约 55 GB，也成功在一张 48 GB RTX A6000 上运行过。拿到 m* 后，每张目标图生成一段视频**少于 1 分钟**。两种时间分别对应首次学习一段动作和之后反复使用该动作。[附录 C.1–C.3][impl] · [硬件与时间][runtime]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

作者从 Something-Something V2 验证集选 10 个动作类别，分为 5 类镜头运动和 5 类物体运动。每类取 1 条参考视频，再从该类另外 10 个视频各取首帧作为目标图，每种方法生成 100 段。CLIP-Avg 比较生成帧与目标图的平均相似度；Top-1/5 检查在该数据集 174 类上训练的识别器是否找到了正确类别；Cos-Sim 比较生成片与参考片的分类器输出。这些指标分别观察外观和动作语义。[原表 1][t1] · [样例选取和 ID][eval]

| 方法 | CLIP-Avg ↑ | Top-1 ↑ | Top-5 ↑ | 动作 Cos-Sim ↑ |
|---|---:|---:|---:|---:|
| SVD（仅目标首帧） | **0.843** | 3% | 5% | 0.370 |
| VideoComposer | 0.719 | 44% | 62% | 0.497 |
| MotionClone | 0.637 | 37% | 62% | 0.523 |
| MotionDirector | 0.750 | 31% | 58% | 0.523 |
| Reenact Anything | 0.779 | **54%** | **76%** | **0.696** |

**人评。** 27 位参与者对每类随机抽取的一张目标图所生成的五种结果排序，1 为最好、5 为最差。下表摘录原表 1 的平均名次。本文方法在运动忠实度和总体任务完成度上分别有 75% 和 78% 的投票列为第一。[用户研究][user]

| 方法 | 目标外观 ↓ | 运动忠实 ↓ | 总体完成 ↓ |
|---|---:|---:|---:|
| SVD | **1.296** | 4.211 | 2.822 |
| VideoComposer | 3.785 | 3.030 | 3.552 |
| MotionClone | 4.585 | 3.137 | 4.200 |
| MotionDirector | 3.522 | 2.900 | 3.059 |
| Reenact Anything | 1.811 | **1.722** | **1.367** |

### 消融实验

**把同样数量的向量放在哪里？** 附录表 4(a) 保持评测协议不变。F′＝1 表示各帧共享一组向量；F′＝15 对应 14 份逐帧空间条件和 1 份共享时间条件。15 个共享向量与按时间分配的 15 个向量具有相同的向量总数，能够直接检验“时间索引”是否有用。[原表 4][t4] · [原文图 7][f7]

| 条件配置 | 总向量数 | Top-1 ↑ | Top-5 ↑ | 动作 Cos-Sim ↑ |
|---|---:|---:|---:|---:|
| F′＝1，N＝1 | 1 | 44% | 62% | 0.619 |
| F′＝1，N＝15 | 15 | 44% | 65% | 0.637 |
| F′＝15，N＝1 | 15 | 52% | 77% | 0.704 |
| F′＝15，N＝5（默认） | 75 | 54% | 76% | 0.696 |
| F′＝15，N＝15 | 225 | 56% | 77% | 0.705 |

### 关键发现

1. **同样 15 个向量，按时间分配更有用。** Top-1 从 44% 升至 52%，动作相似度从 0.637 升到 0.704。继续把每组增到 15 个，Top-1 增至 56%，但 Top-5 仍为 77%。默认的每组 5 个体现了作者的配置取舍，并未占据每一列第一。[原表 4][t4]
2. **保持不动也容易在外观上得高分。** SVD 的目标外观人评名次最好，但只有 3% 的生成片能被识别成指定动作。并排看两类指标，可以辨别模型究竟完成了迁移，还是主要保留了目标图片。[原表 1][t1]
3. **运镜和物体运动的难度不同。** 拆开看，本文的 Top-1 分别为 72% 和 36%。同一个整体准确率混合了镜头靠近、远离等运动，也混入了物体之间分开、合拢等动作，不能直接解释为人物步态还原率。[附录表 3][t3]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把“运动风格”变成可以比较的两次生成。** 保持狗的目标图不动，只改变运动参考，比较生成中的平稳与颠簸。换目标再试，可以区分只适用于马的腿部构型和更容易跨外形复用的整体节奏。[附录图 16][f16]
- **允许目标身体重新解释空间方向。** 图 17 中，相反朝向的目标也能做出“向自身前方移动并低头”的语义动作。它比“源和目标的二维位移是否完全相同”更贴合跨布局任务，同时也解释了为何作者用动作识别而非单纯光流评估。[附录图 17][f17] · [指标解释][user]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **细动作和接触容易丢。** 参考人物蹲下并假装打字，生成的恐龙能蹲下，手指却没有打字；人类的步态迁给袋鼠时，其腿又有时变得像人。语义能传递到什么粒度，取决于模型先验和源、目标的形态差异。[失败图 8][f8]
- **目标图片决定从哪里开始。** 不要求源、目标对象处于同一画面坐标，但目标首帧要能作为这段动作的合理开头。多人画面可能让多个对象同时照着动；论文的接口没有为不同角色逐一指定独立参考动作。[限制与未来工作][limits] · [多对象结果][results]
- **展示视频经过选样。** 作者明确说明定性实验会从多个生成样本中择优。其更难的一组定性动作中，约十分之一的参考动作能让超过半数所试目标图得到良好迁移。统计对象是“参考动作”，不能把这个比例当成逐视频成功率。[附录 I 失败率分析][failure]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **DisMo**　两篇都想留下可跨外观迁移的运动。DisMo 预先训练一个运动提取器，以后可直接编码新片；本篇针对每条示范优化与 SVD 交叉注意力兼容的条件。经常更换源动作时，两者的计算开销落在不同环节。[DisMo 站内解读][dismo] · [本文计算开销][runtime]
- **WhatMoves** 把区域选择加进参考编码和目标生成。在“马跑、旁边的人同时走”的场面里，这让读者可以进一步追问究竟取了谁的运动。Reenact Anything 的步态实验主要检验同一目标能否保留两条参考各自的动态。[WhatMoves 站内解读](/blog/eccv2026-whatmoves/) · [本文步态示例][f16]
- **VideoComposer、MotionClone 与 MotionDirector**　原文将显式视频条件、扩散模型中的运动信号和逐示范微调纳入同一评测。用同一参考配十张不同布局的首帧，可以同时观察动作迁移力和源结构残留。[比较方法与实现][compare] · [原表 1][t1]
- **对可控角色动画的启发**　如果目的是让另一角色也以相似节奏动起来，可以先比较本篇的跨主体视频；如果目的是把发生在某一帧的抬脚、落脚或抓握写进动画工程，还需要可解码的姿态和对应事件的独立检验。论文输出的 75 个向量没有给出这样的事件标注。[表示与输出][f4] · [失败案例][f8]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **发表与全文**　[SIGGRAPH 论文记录][doi] · [作者终稿 PDF][pdf] · [arXiv v2 全文与附录][html] · [单独的补充材料 PDF][supp]
- **图示与动态结果**　[作者项目][project] · [方法图 4][f4] · [两种马步态对照][f16] · [完整失败分析][failure]

</div>

[html]: https://arxiv.org/html/2408.00458v2
[record]: https://arxiv.org/abs/2408.00458
[doi]: https://doi.org/10.1145/3721238.3730668
[pdf]: https://studios.disneyresearch.com/app/uploads/2025/07/Reenact-Anything-Semantic-Video-Motion-Transfer-Using-Motion-Textual-Inversion-Paper.pdf
[supp]: https://studios.disneyresearch.com/app/uploads/2025/07/Reenact-Anything-Semantic-Video-Motion-Transfer-Using-Motion-Textual-Inversion-Supplemental-Paper.pdf
[disney]: https://studios.disneyresearch.com/2025/07/16/reenact-anything-semantic-video-motion-transfer-using-motion-textual-inversion/
[project]: https://mkansy.github.io/reenact-anything/
[intro]: https://arxiv.org/html/2408.00458v2#S1
[leak]: https://arxiv.org/html/2408.00458v2#S3.SS2.SSS1
[align]: https://arxiv.org/html/2408.00458v2#S3.SS2.SSS2
[results]: https://arxiv.org/html/2408.00458v2#S4.SS6
[obs]: https://arxiv.org/html/2408.00458v2#S3.SS2
[inversion]: https://arxiv.org/html/2408.00458v2#S3.SS3
[inflate]: https://arxiv.org/html/2408.00458v2#S3.SS4
[f4]: https://arxiv.org/html/2408.00458v2#S3.F4
[impl]: https://arxiv.org/html/2408.00458v2#A3.SS1
[base]: https://arxiv.org/html/2408.00458v2#S3.SS1.SSS3
[hyper]: https://arxiv.org/html/2408.00458v2#A3.SS2
[attn]: https://arxiv.org/html/2408.00458v2#A3.SS4
[perframe]: https://arxiv.org/html/2408.00458v2#S3.SS4.SSS2
[f16]: https://arxiv.org/html/2408.00458v2#A8.F16
[runtime]: https://arxiv.org/html/2408.00458v2#A3.SS3
[t1]: https://arxiv.org/html/2408.00458v2#S4.T1
[eval]: https://arxiv.org/html/2408.00458v2#A6.SS4
[user]: https://arxiv.org/html/2408.00458v2#S4.SS4
[t4]: https://arxiv.org/html/2408.00458v2#A7.T4
[f7]: https://arxiv.org/html/2408.00458v2#S4.F7
[t3]: https://arxiv.org/html/2408.00458v2#A6.T3
[f17]: https://arxiv.org/html/2408.00458v2#A8.F17
[f8]: https://arxiv.org/html/2408.00458v2#S4.F8
[limits]: https://arxiv.org/html/2408.00458v2#S4.SS7
[failure]: https://arxiv.org/html/2408.00458v2#A9
[compare]: https://arxiv.org/html/2408.00458v2#A6.SS1
[dismo]: /blog/neurips2025-dismo/
