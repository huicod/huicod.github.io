---
title: "[CVPR2026] SynMotion：从真人示例学拍手，怎样让狐狸用自己的爪子拍？"
description: "从狐狸拍手的逐步消融，理解 SynMotion 怎样用主体和动作两组语义嵌入、主体先验视频及视觉适配器定制视频动作，并核对 MotionBench、图生视频对照和已发布的推理权重。"
pubDate: "2026-11-28T01:20:00+08:00"
badge: "Paper"
tags: ["SynMotion", "CVPR 2026", "视频动作迁移", "动作定制", "主体与动作解耦", "图生视频", "文生视频", "HunyuanVideo", "LoRA", "MotionBench", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[arXiv v2 HTML（可翻译）][html] · [CVPR 终稿 PDF][pdf] · [正式补充材料 PDF][supp] · [早期版附录 HTML（含图生视频和递进消融）][oldapp] · [动作演示][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026</summary>

*SynMotion: Semantic-Visual Adaptation for Motion Customized Video Generation*，CVPR 2026，页 30477–30489。终稿作者为 Shuai Tan、Biao Gong、Yujie Wei、Shiwei Zhang、Zhuoxin Liu、Ke Ma、Yan Wang、Kecheng Zheng、Xing Zhu、Yujun Shen、Hengshuang Zhao。首版预印本发表于 2025 年 6 月，本文以会议终稿和补充材料为准；可翻译的正文采用 2026 年 4 月更新的 arXiv v2。早期版附录可对照阅读，正式补充材料另含 FlexiACT 对比和训练策略消融。[CVF 出版记录][cvf] · [arXiv 版本记录][abs]

截至 2026 年 11 月 28 日，作者已公开推理代码和按动作提供的权重。下文将论文的训练方法与公开推理入口分别说明；实验数值来自作者报告，本次核查了源码和权重目录，未运行模型。[官方实现][repo] · [权重目录][weights]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

给 SynMotion 几段真人拍手的视频，它可以为“拍手”学一套参数，以后让狐狸用爪、海狮用鳍做出可辨认的拍手动作。它在文字条件中分别学习“谁”和“做什么”，又在视频生成器中学习“这个动作在连续画面里怎样展开”。最终交付的是新主体表演该动作的视频。[框架图 2][fig2] · [作者演示][project]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**　视频生成器可以按常见文字描述合成动作。用户若想复用一组示例里更具体的动作，又允许角色、画风和背景改变，就需要从示例中学出可迁移的动作概念。已有方法有的优化文字嵌入，有的直接适配视频模型。[原文引言][intro]

**现有痛点**　两种失败很直观：生成的兔子外形对了，却没有做出示例动作；或者动作对了，兔子身上却长出了真人的手臂。作者还展示了把“挥手”误生成整体身体下沉的情况。仅看一张代表帧，很难发现这些错误。[正文图 3][fig3] · [正式补充材料图 8][suppabl]

**核心矛盾**　拍手的可辨认性依赖肢体靠近、接触、分开的过程，但爪、手与鳍的形状和活动范围各异。照搬参考视频的外观与空间布局会限制迁移；只记住“拍手”这个词，又可能只产生一个静态姿势或很小的摆动。[原文方法][method] · [拍手消融图 5][fig5]

**本文目标**　让不同角色表演从少量实例学来的同一种动作。文生视频（T2V）用文字指定新主体；图生视频（I2V）再给一张目标主体的图像，要求输出保留它的外观。两项任务都评估动作表现，也评估主体是否正确。[任务与架构][fig2] · [I2V 补充材料][supp]

**切入角度**　“狐狸”与“拍手”在提示词中有不同作用，在视频里却必须协同实现。作者将这两种条件分别保留为可调整的表示，并用一组“斑马行走、狗吠叫”等通用视频提醒模型，学习拍手时仍要保留生成其他主体的能力。[主体先验与训练策略][training] · [先验视频示例][prior]

**核心 idea**　每个目标动作学习两部分参数：一部分修正主体与动作的文字条件，另一部分调整视频 Transformer 中与运动表现相关的计算。训练时，真实动作示例更新两种语义残差；通用主体先验样本则暂停更新目标动作残差，避免把“斑马走路”也记进“拍手”。[原文 §3.2][method] · [§3.3][training]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

可以沿两条路径读图。**学习新动作时**，示例视频和主体先验视频为扩散训练提供监督，模型为这个动作保存语义参数与视觉适配器。**使用已学动作时**，载入对应权重，输入新提示词；图生视频还输入目标图。视频生成器在压缩后的视频表示上去噪，最后由 VAE 解码为连续画面。[正文图 2][fig2] · [I2V 补图 1][supp] · [公开推理入口][entry]

<figure class="reading-figure"><a href="/paper-notes/synmotion/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/synmotion/architecture.svg" alt="SynMotion 中文架构图，区分目标动作示例与主体先验视频的训练用途、主体和动作两路语义残差、视频骨干的视觉适配器，以及文生视频和图生视频的推理输入。" /></a><figcaption>根据正文图 2、§3.2–3.3 和补图 1 重绘，可点击放大。先看哪些视频参与学习，再沿新主体的文字或图像读到输出。参考动作在定制阶段进入模型，部署时可直接选择已有的动作权重。</figcaption></figure>

### 关键设计

**1. 在已经编码的文字中，给主体和动作各留一份可学的修正量。** 以“一只狐狸拍手”为例，模型先编码完整提示，再按提示词的位置和作用取主体与动作表示。动作残差由上下文中的动作表示初始化：作者使用相当于“一个人拍手”的完整短语，使其带有前文信息；主体残差随机初始化。两路修正分别经初始为零的投影加回原特征，随后由 Embedding Refiner 让二者交互，再通过第二个零初始化投影加回。刚开始训练时，新增分支对原条件的扰动为零；之后才学到某个动作特有的偏移。[正文 §3.2 与式 2][eq2]

**2. 把“谁在动”和“怎样动”送进同一套视频去噪过程。** 语义条件能提示模型这是拍手，但很难只靠文字规定两爪张合的幅度。作者在 HunyuanVideo 的文本块、视频块和单流块加入低秩视觉适配器。论文用注意力的 Q、K、V 投影解释其作用：实际权重等于冻结的原权重加上学出的低秩增量 BA。负责读写这些条件的是视频生成器，输出的是视频潜变量；这些参数里没有按“左腕第几帧到哪个坐标”排列的关节轨迹。[正文 §3.1–3.2][method] · [公开视觉适配器][adapter]

**3. 用不同训练数据控制动作残差何时更新。** 每一步以 0.75 的概率采真实目标动作示例，同时更新主体和动作残差；其余步骤采主体先验视频（SPV），在语义分支中只更新主体一侧。SPV 的文字搭配由作者构造，视频由冻结的基座合成，例如让斑马行走。它提供的监督是“保持模型生成一只斑马的能力”，不需要这个先验视频恰好包含拍手。补充材料将两类样本写成加权扩散损失，明确冻结的是先验样本路径上的**动作语义参数**。[训练策略][training] · [补充材料目标函数][suppstrategy]

**4. 图生视频多了一张目标图，原理与发布代码可以分开读。** 论文将图像特征与修正后的文字条件结合，再引导视频生成。公开 I2V 实现的顺序更具体：先分出前 144 个图像条件位置，对文字片段的固定位置加主体、动作残差，让文字经过两层 Refiner，再把图像片段拼回去。因此，论文的词义分解不宜理解为现有代码能自动解析任意长句，并给每个角色绑定各自的动作。[正式补图 1][supp] · [固定版本的语义分支源码][code]

### 一个完整例子

**让狐狸拍手。** 这是作者用来观察各模块贡献的案例。它同时提出两个可分别检查的问题：狐狸做出的动作像不像拍手？在这个过程中，两只爪还像不像狐狸的爪？[正文图 5][fig5] · [递进消融数据][suppabl]

1. **定制。** 用多段人拍手的参考视频训练拍手概念；再穿插不同动物做普通动作的先验视频。前者提供反复张合的视觉证据，后者帮助保留新主体的外形。最终得到该动作的语义权重和视觉适配器。
2. **换主体。** 在 T2V 中提供描述狐狸拍手的提示；在 I2V 中还可给定狐狸图像。加载拍手权重后，模型要在狐狸的身体上生成这个动作。给它的控制量是所选动作、文字及可选目标图，用户无需逐帧指定两爪位置。
3. **检查。** 在作者图 5 中，仅加入动作残差时，狐狸做出了动作，却带有人手特征。加上主体残差后，爪的外形改善，但动作表现变弱；语义 Refiner 和视频适配器加入后，主体外形与动作幅度才较好地兼顾。单看终稿的一张成功图，容易漏掉这次取舍。[图 5][fig5] · [补充材料表 3][suppabl]

若想对应到**公开代码实际能接受的输入**，作者给出的例子是“一只企鹅跳舞”：选择 `dance` 权重，输入企鹅图片和文字提示，输出 MP4。README 使用 129 帧、50 个采样步和固定种子。拍手是论文中的训练与消融案例；本次核对的公开模型目录里可直接下载的是舞蹈、双手挥动、抬臂、祈祷、敬礼、深蹲六套权重。README 还列出投掷和挥手两个目录名，模型库该版本未列出对应文件。[官方示例][repo] · [已发布的权重文件][weights]

### 训练与推理

MotionBench 从 GPT-4 给出的 30 个候选动作出发，先用“指定主体做指定动作”的提示测试基座，保留基座难以做好的 **26 类**。会议终稿写明每类收集 **20 段真实示例**，按此口径共 520 段。作者另使用 FlexiACT。每个动作单独用 AdamW 训练 2,000 步，学习率 2 × 10⁻⁵，报告硬件为 8 张 H20；未披露可换算总 GPU 小时的训练时长。推理复用已学动作时，公开入口只加载该动作的两份权重和 HunyuanVideo-I2V 基座。代码中 720p 推荐 80 GB 显存是推理建议。[MotionBench 构建][bench] · [训练设置][setup] · [推理说明][repo]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

**① 只给新主体的文字，动作和主体能否同时正确？** 下表摘自会议正文表 1。动作准确率、主体准确率由 QwenVL 对生成视频回答“是否出现了指定动作／主体”得到；每种动作重复评估 10 次。动态程度来自 VBench，衡量画面运动，FVD 衡量视频特征分布的距离。作者将 Textual Inversion、DreamBooth 适配到 HunyuanVideo 后比较。[正文表 1][t1] · [指标与基线设置][setup]

| T2V 方法 | 动作准确率 ↑ | 主体准确率 ↑ | 动态程度 ↑ | FVD-3DRN50 ↓ |
|---|---:|---:|---:|---:|
| VMC | 53.64% | 38.43% | 20.60% | 395.32 |
| DMT | 51.16% | 34.88% | 12.50% | 390.06 |
| MotionDirector | 41.67% | 71.93% | 3.51% | 465.60 |
| MotionInversion | 59.31% | 73.21% | 3.57% | 213.04 |
| Textual Inversion | 21.43% | 62.94% | 47.06% | 456.23 |
| DreamBooth | 37.56% | 69.76% | 69.77% | 385.82 |
| **SynMotion** | **68.60%** | **97.67%** | **88.24%** | **212.05** |

**② 给定新主体的图片，动作能否做出来？** 补充材料表 1 的三个基线为原生图生视频模型，SynMotion 另有针对目标动作学习的参数。“与首图主体匹配”比较输出与输入图，“跨帧主体一致”检查生成片段内外观是否稳定。两者可能一个高、另一个低。[正式补充材料表 1][suppi2v] · [可翻译的早期附表][oldi2v]

| I2V 方法 | 动作准确率 ↑ | 与首图主体匹配 ↑ | 跨帧主体一致 ↑ |
|---|---:|---:|---:|
| CogVideoX-I2V | 44.29% | 97.65% | 93.22% |
| HunyuanVideo-I2V | 27.81% | 97.32% | 93.38% |
| Wan2.1-I2V | 53.25% | 94.02% | 90.36% |
| **SynMotion** | **78.30%** | **99.83%** | **98.28%** |

与同样处理示例动作的 **FlexiACT** 比较时，补充材料另设了成对实验。MotionBench 上，两者动作准确率为 **69%／76%**、主体准确率为 **88%／97%**（FlexiACT／SynMotion）；换到 FlexiACT 数据上，动作准确率为 **62%／72%**。这些数字属于单独的对照设置，应与上表分开读。[正式补充材料表 2][flex]

**③ 人的判断是否支持自动指标？** 20 位志愿者评估 20 组结果。每组给出提示、参考视频及五种方法的输出。SynMotion 在动作对齐、主体对齐、整体画质上的偏好占比分别为 **78.3%、81.9%、83.9%**。这些是五种方法间的相对选择比例，不能解作 78.3% 的样本逐帧复现了参考动作。[正文表 2][t2]

### 消融实验

**只学动作，再把主体约束逐项加回来。** 下表为正式补充材料表 3 中的中心结果，对应正文图 5 的狐狸拍手。[正式补充材料表 3][suppabl] · [可翻译的消融表][oldabl]

| 在上一步基础上加入 | 动作准确率 ↑ | 主体准确率 ↑ | 动态程度 ↑ | 背景一致 ↑ |
|---|---:|---:|---:|---:|
| HunyuanVideo 基座 | 22.22% | 81.34% | 85.00% | 95.01% |
| 动作残差 | 61.43% | 57.77% | 91.11% | 96.39% |
| 主体残差 | 43.14% | 91.11% | 71.11% | 97.69% |
| 语义 Refiner | 65.53% | 95.55% | 62.22% | **98.29%** |
| 视觉适配器（完整模型） | **68.60%** | **97.67%** | 88.24% | 97.59% |

动作残差使动作更容易被认出，但主体准确率从 81.34% 降至 57.77%；加主体残差时，两个指标又向相反方向移动。语义精炼后两项才一起升高。视觉适配器最显著的改变是把动态程度从 **62.22% 提到 88.24%**，同时背景一致性略有回落。[补充材料表 3][suppabl]

**只加 LoRA，以及取消按样本选择更新分支。** 正式补充材料表 4 按整数列出两项准确率，下表沿用原精度。完整模型与取消训练策略的模型相比较，直接检验了主体先验和更新安排在这一设置中的整体贡献。[正式补充材料表 4][suppstrategy]

| 设置 | 动作准确率 ↑ | 主体准确率 ↑ | FVD-3DRN50 ↓ |
|---|---:|---:|---:|
| 基座只加 LoRA | 52% | 76% | 389.59 |
| 移除专门的训练策略 | 48% | 82% | 365.28 |
| 完整模型 | **68%** | **97%** | **212.05** |

### 关键发现

1. **主体比动作更容易做对。** 文生视频中，完整模型的主体准确率已接近 98%，动作准确率仍为 68.60%。若只检查第一帧是不是狐狸，会高估整个定制任务的完成度。[正文表 1][t1]
2. **大幅运动和正确动作是两个维度。** 仅加动作残差时，动态程度 91.11% 甚至高于完整模型，主体准确率却低近 40 个百分点。选择某个模块时，至少应把动作判别、主体识别与运动量放在一起看。[补充材料表 3][suppabl]
3. **类别判对不等于表演细节都保留。** 自动判据问的是“它有没有拍手”，没有直接问“何时接触、拍了几次、左右爪相差几帧”。人工偏好补上了整体观感，但论文仍没有给出逐帧关节或接触误差。[指标说明][setup] · [用户研究][t2]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **跨主体迁移把外观泄漏变得可见。** 从一个人迁移到另一个人，即使“复制了人手”也难察觉。换成狐狸或海狮，一旦出现人手，问题立刻显形。作者用这种例子配合消融，把主体形态与动作类别之间的竞争展示出来。[正文图 3][fig3] · [正文图 5][fig5]
- **普通动作的视频也能帮助学习罕见组合。** 一段斑马走路的视频没有拍手信息，却可以约束学拍手时对主体的更新。这里最值得迁移的设计是给不同数据分配不同的监督职责。[主体先验与训练][training]
- **同一个动作概念可以被反复调用。** 对已经适配的动作，改变主体、场景或输入图即可生成新结果，无需为每只新动物重新提供一套动作示例。新增一种未收录的特殊动作，则回到按动作训练的阶段。[训练设置][setup] · [推理入口][entry]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **首图缺少动作必需的部位时，模型可能选择静止。** 作者展示了图生视频中的拍手失败：目标图缺少可见的手或爪，生成主体没有完成动作。后空翻也容易在腾空和翻转时失去姿态连贯性。[正式补充材料图 12][fail] · [早期版失败分析 HTML][oldfail]
- **动作从一组示例中概括而来。** 多个对象同时运动、镜头或场景变化较大时，系统可能学错要迁移的运动。当前设置围绕单个动作概念，未给出多个角色的分轨控制、多个动作的精确起止帧或目标关节约束。[作者局限][limits] · [训练任务][bench]
- **视频的视觉可信度与可执行的三维动画之间仍有距离。** 本文生成 RGB 帧，没有提供目标角色骨架、绑定、足底接触或手部碰撞解算。若问题是“让 VRM 的两只手在指定拍点接触”，仅凭这些视频结果还无法交付那段动画。[原文输出定义][pre] · [公开推理代码][entry]
- **基准特意挑了基座不擅长的组合。** 这样更容易观察定制是否有用，也限定了 68.60% 的适用范围。作者指出 VLM 判断有时与人对定制质量的感受不一致，且目前没有用该指标区分同一动作类别内的不同表演风格。[MotionBench 构建][bench] · [作者局限][limits]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **MotionInversion** 是正文直接比较的视觉定制方法。它在表 1 的 FVD-3DRN50 上与 SynMotion 接近（213.04 对 212.05），但动作识别、主体识别和动态程度差距更大。单看分布距离，难以判断角色究竟学到了什么动作。[正文表 1][t1]
- **DisMo** 同样研究换外形后还能保留什么运动，用预训练的运动编码器从参考视频提取连续运动表示；SynMotion 为一个目标动作从多段示例定制参数。两条路线分别适合研究逐段提取运动和反复调用一个动作概念。[站内 DisMo 解读][dismo] · [SynMotion 的训练设置][setup]
- **Reenact Anything** 为单段参考视频优化运动条件，可以比较同一类动作内部的不同步态。SynMotion 则从一组同动作示例中寻找共性。若要判断后者能否区分两种拍手节奏，需要专门设置同主体、同类别、不同节奏的对照；现有类别准确率不足以回答。[站内 Reenact Anything 解读][reenact] · [SynMotion 的评估方式][setup]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- Shuai Tan 等，*SynMotion: Semantic-Visual Adaptation for Motion Customized Video Generation*，CVPR 2026。[正式出版记录][cvf] · [可翻译原文][html] · [论文 PDF][pdf]
- I2V 对照、逐项消融、训练策略消融与失败案例取自会议补充材料。早期 arXiv 的部分同项表格也可在浏览器中翻译。[正式补充材料][supp] · [早期附录 HTML][oldapp]
- 项目展示参考视频与生成片段；公开源码和权重目录用于核查推理输入与已发布动作。[项目演示][project] · [代码版本][repo] · [权重版本][weights]

</div>

[cvf]: https://openaccess.thecvf.com/content/CVPR2026/html/Tan_SynMotion_Semantic-Visual_Adaptation_for_Motion_Customized_Video_Generation_CVPR_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/Tan_SynMotion_Semantic-Visual_Adaptation_for_Motion_Customized_Video_Generation_CVPR_2026_paper.pdf
[supp]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Tan_SynMotion_Semantic-Visual_Adaptation_CVPR_2026_supplemental.pdf
[suppi2v]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Tan_SynMotion_Semantic-Visual_Adaptation_CVPR_2026_supplemental.pdf#page=2
[flex]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Tan_SynMotion_Semantic-Visual_Adaptation_CVPR_2026_supplemental.pdf#page=3
[prior]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Tan_SynMotion_Semantic-Visual_Adaptation_CVPR_2026_supplemental.pdf#page=5
[suppabl]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Tan_SynMotion_Semantic-Visual_Adaptation_CVPR_2026_supplemental.pdf#page=7
[suppstrategy]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Tan_SynMotion_Semantic-Visual_Adaptation_CVPR_2026_supplemental.pdf#page=8
[fail]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Tan_SynMotion_Semantic-Visual_Adaptation_CVPR_2026_supplemental.pdf#page=10
[limits]: https://arxiv.org/html/2506.23690v1#A3.SS2
[abs]: https://arxiv.org/abs/2506.23690
[html]: https://arxiv.org/html/2506.23690v2
[oldapp]: https://arxiv.org/html/2506.23690v1#A1
[oldi2v]: https://arxiv.org/html/2506.23690v1#A1.T2
[oldabl]: https://arxiv.org/html/2506.23690v1#A2.T3
[oldfail]: https://arxiv.org/html/2506.23690v1#A2.SS3
[intro]: https://arxiv.org/html/2506.23690v2#S1
[pre]: https://arxiv.org/html/2506.23690v2#S3.SS1
[method]: https://arxiv.org/html/2506.23690v2#S3.SS2
[fig2]: https://arxiv.org/html/2506.23690v2#S3.F2
[fig3]: https://arxiv.org/html/2506.23690v2#S3.F3
[fig5]: https://arxiv.org/html/2506.23690v2#S4.F5
[eq2]: https://arxiv.org/html/2506.23690v2#S3.E2
[training]: https://arxiv.org/html/2506.23690v2#S3.SS3
[bench]: https://arxiv.org/html/2506.23690v2#S3.SS4
[setup]: https://arxiv.org/html/2506.23690v2#S4.SS1
[t1]: https://arxiv.org/html/2506.23690v2#S4.T1
[t2]: https://arxiv.org/html/2506.23690v2#S4.T2
[project]: https://lucaria-academy.github.io/SynMotion/
[repo]: https://github.com/Lucaria-Academy/SynMotion/tree/1af7f99b46e88732215a1252aed3196528771f1c
[entry]: https://github.com/Lucaria-Academy/SynMotion/blob/1af7f99b46e88732215a1252aed3196528771f1c/sample_synmotion.py#L17-L70
[code]: https://github.com/Lucaria-Academy/SynMotion/blob/1af7f99b46e88732215a1252aed3196528771f1c/hyvideo/modules/models.py#L473-L514
[weights]: https://huggingface.co/Shuaishuai0219/SynMotion/tree/42bfecc5ab14ace1c053dbef52d3a0f4a8f160ac
[adapter]: https://huggingface.co/Shuaishuai0219/SynMotion/blob/42bfecc5ab14ace1c053dbef52d3a0f4a8f160ac/dance/visual_adapter.safetensors
[dismo]: /blog/neurips2025-dismo/
[reenact]: /blog/siggraph2025-reenact-anything/
