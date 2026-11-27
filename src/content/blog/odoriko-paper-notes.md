---
title: "[ECCV2026] Odoriko：同一句动作指令，换一种体形，人会怎样动？"
description: "Odoriko: A Shape-Aware Multimodal Diffusion Framework for Human Motion。拆解体形如何进入动作去噪、视频如何反向估计体形，以及文本、舞蹈和视频三组实验分别验证了什么。"
pubDate: "2026-11-27T22:10:00+08:00"
badge: "Paper"
tags: ["Odoriko", "ECCV 2026", "多模态动作生成", "体形条件", "SMPL", "文本生成动作", "音乐生成舞蹈", "视频人体姿态估计", "扩散模型", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[arXiv HTML（含附录，可翻译）][html] · [ECCV 会议 PDF][paper] · [Springer 正式记录][springer] · [固定随机种子的体形对照演示][demo]

<details class="paper-meta"><summary>论文信息与阅读范围 · ECCV 2026</summary>

正式题名为 *Odoriko: A Shape-Aware Multimodal Diffusion Framework for Human Motion*。Dongseok Shim、Julian Tanke、Kengo Uchida、Christian Simon、Koichi Saito、Takashi Shibuya、Shusuke Takahashi、Yuki Mitsufuji，Sony Group Corporation 与 Sony AI。论文发表于 ECCV 2026，页码 479–497，DOI 10.1007/978-3-032-37435-6_26。本文核对了会议 PDF 的主实验；架构细节、训练成本和扩展消融取自 2026 年 6 月 19 日的 arXiv v1 附录。[会议海报][poster] · [出版记录][springer] · [版本记录][abs]

截至 2026 年 11 月 27 日，作者已公开文本、音乐和视频任务的动画示例。已核实的 GitHub 仓库承载演示网页，未找到作者公开的训练代码或模型权重。下文数值均为论文报告值。[项目页][project] · [网页仓库][repo] · [Sony 研究索引][sony]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

**Odoriko 把“谁在动”的身体参数送进动作生成器。** 给定同一句“沿窄木梁走，张开双臂保持平衡”，可以固定随机种子、替换人物体形，观察模型是否生成不同的姿态和重心调整。换到视频任务，同一框架反过来从画面估计镜头里人物的体形与三维动作。[作者窄梁对照演示][beam] · [原文方法图][fig3]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**　文本可以表达“做什么”，音乐可以指定动作的节奏，视频则提供人物已经怎样动的观测。已有模型开始把这几种任务放进同一框架。常用的文本动作数据还会把不同人的动作重定向到标准身体，便于统一训练和评估。[原文引言][intro] · [数据设置][settings]

**现有痛点**　统一身体也会抹去一部分问题本身。把同一组关节旋转套到不同长度的手臂上，指尖位置本来就会不同；实际的人要完成同一个高处够物任务，还可能改变肩、肘或躯干的动作。只在结果上更换人体网格，难以学到后一种变化。[体形对照图 2][fig2] · [举臂演示][overhead]

**核心矛盾**　生成时，人物体形是创作者希望指定的条件；从单目视频重建时，体形却往往未知，还是关节位置能否估准的影响因素。同一个框架需要区分哪些量由用户给定，哪些量由视频推断。[§3.3][arch] · [视频实验][t3]

**本文目标**　在 SMPL 人体范围内，用一套骨干支持文本生成动作、音乐生成舞蹈、视频估计三维人体。训练时保留可用的人物体形；使用时，有形体参数就用于生成，需要从视频重建就连同动作一起估计。[任务总览][fig1] · [§3.3][arch]

**切入角度**　SMPL 的形体有层次。先选人体模板及其形变基底，再由十维系数 β 决定该基底中的具体体形。作者因此把两个条件放在去噪器的不同深度。论文将模板标签记作 gender；下文的分类分数均指数据集所用的模板标签。[形体建模][arch] · [附录讨论][ethics]

**核心 idea**　扩散模型每次估计干净动作时，前半段结合模板、任务条件和动作，后半段结合 β 修正运动细节。于是体形可以影响生成的关节旋转和根部运动。视频没有给定体形时，则让网络从可学习的占位向量读出模板和 β。[原文图 3][fig3] · [损失与推理][loss]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

Odoriko 在连续动作上直接加噪、去噪，每一帧都是一个动作向量。文本词元保留自己的位置，与动作词元共同做注意力；有时间轴的音乐、视频与二维关键点则重采样后加到对应动作帧。整段条件的摘要与扩散步嵌入合成一个全局条件。体形通过另外的输入进入前后两组 Transformer。[图 3][fig3] · [数据域扩散][diff]

<figure class="reading-figure"><a href="/paper-notes/odoriko/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/odoriko/architecture.svg" alt="Odoriko 完整架构。文本、逐帧条件和全局条件进入动作去噪器；前八层注入 SMPL 模板，后八层注入十维体形。生成时提供体形，重建视频时另行估计体形和镜头下的三维动作。" /></a><figcaption>按论文图 3、§3 和附录 A 重绘，可点击放大。先看文字和有时间轴的条件在哪里进入，再沿体形支路比较“用户给定”与“从视频估计”两种走法。紫色虚线表示训练监督。</figcaption></figure>

### 关键设计

**1. 对连续人体运动直接预测干净样本。** 每帧描述骨盆离地高度、地面内两个方向的根速度、绕竖直轴的角速度，以及用连续 6D 表示的关节旋转。模型读入带噪动作、当前扩散步、任务条件和体形，预测去噪后的原始动作。视频任务额外处理相机坐标系中的根朝向。文中的 token 指帧向量或条件嵌入，这条生成路径不需要离散动作码本。[表示与式 1][repr] · [预测目标与式 2][diff]

**2. 词和节拍采用不同的对齐方式。** “抬起双臂”不自带起止帧，所以 T5 的词元与运动序列拼接，模型用全自注意力学习对应关系；CLIP 另提供整句描述。音乐用 Jukebox、EDGE 提取特征，视频用冻结的 TRAM 编码器，同时用 DWPose 提取 18 个 OpenPose 风格的二维关键点。这些随时间变化的特征经投影、时间对齐后，直接加到相应动作帧。非文本模态还会通过时间池化提供全局摘要。视频任务中没有文本时，相应词元被掩蔽。[§3.3 多模态条件][arch] · [架构参数][impl]

**3. 先注入模板 g，再注入 β。** 前 8 个多模态块中，可学习的模板嵌入与全局条件、文字和运动共同参与计算。后 8 个动作细化块不再保留文字词元，改用十维 β 经 MLP 投影所得的体形词元细化动作。主干的特征宽度为 512。视频任务为相机对齐的根朝向另设宽度 256、4 层的轻量模块。论文消融中称为“non-causal”的变体指把两种形体信息提前合并，讨论的是条件进入的先后，与流式视频的时间因果性无关。[§3.3][arch] · [附录 A.1][impl] · [架构消融][t9]

**4. 区分“给定体形”“估计体形”和“缺少体形标注”。** 给定体形时，训练目标是干净动作，额外的体形预测损失关闭。视频重建时，学习出的估计词元分别送分类头与回归头，监督模板和 β，两项辅助损失权重均为 0.1；推理将各去噪步的体形预测取平均。FineDance 又是第三种情况：目标仍是音乐生成舞蹈，但没有舞者的个体体形标注，模型使用学习出的占位向量。这一成绩不能当成精确控制某位舞者体形的成绩。[§3.3–3.4][loss] · [FineDance 设置][standard]

### 一个完整例子

沿用作者的**窄木梁行走**。给两次采样相同的文字和随机种子，只改 SMPL 形体条件。作者项目明确说明了固定种子的设置。下面用 60 帧举例说明数据流，60 是示意长度。[项目体形对照][demo] · [原图 2][fig2]

1. 文本编码器提取“沿窄梁”“脚跟接脚尖”“张臂平衡”等词的特征，并产生整句特征。给定长度后，两次都从相同的 60 帧噪声动作开始。
2. 前半网络读模板 g 与文字、运动；后半网络读 β 并细化这 60 帧的连续动作。给定的 β 是十个形体系数，不是一条逐帧的“应在第几帧张臂多少度”指令。
3. 推理完成后，可比较两人的关节角、骨盆运动与手部轨迹。**手伸得更远至少有两种来源**：手臂本来更长，或者肩肘的运动变了。要把后者单独量出来，可以把两次预测的旋转都套回同一个标准身体，再比较关节角和平衡动作。论文给出了固定种子的并排演示，没有报告这项剥离骨长后的定量对照。[窄梁演示][beam] · [形体评价输入][evalinput]

如果改为输入一个真人走木梁的视频，任务目标随之改变：模型要恢复**画面中此人的动作**，还要估计其体形。使用观察者第一视角、另生成一个观看者的合理反应，是另一种问题。作者演示页也说明，视频展示中的全局位置使用真值平移来还原；视频主表测的是去掉根平移后的局部姿态。[作者视频演示][project] · [视频评估协议][evalvideo]

### 训练与推理

| 任务 | 主要观测与形体来源 | 需要输出什么 |
|---|---|---|
| 文本 → 动作 | 文字；HumanML3D 有标注的测试样本另外给定 g 和 β | 符合文字和指定体形的一段动作 |
| 音乐 → 舞蹈 | 音乐；FineDance 用占位向量，AIST++ 另提供舞者模板标签 | 与音乐节奏配合的舞蹈 |
| 视频 → 三维人体 | 视频帧和检测到的二维关节；体形未知 | 镜头中人物的三维姿态、相机系根朝向、模板和 β |

训练文本任务时，作者跳过 HumanML3D 原有的统一骨架重定向，从 AMASS 保留原始人体形态，并排除缺少相应标注的 HumanAct12 训练样本。测试遇到这类缺标样本时，使用 male 模板与零 β。舞蹈使用 FineDance 与 AIST++；视频使用 EMDB、3DPW、Human3.6M，留出 EMDB Sequence 1 做评估。[数据与划分][settings] · [各任务测试设置][standard]

作者报告模型参数量为 44M，训练使用一张 NVIDIA A6000、批量 128、约 8 天，折合约 **192 GPU 小时**。冻结特征提取器此前的预训练不在该时长内。文本、音乐、视频训练片段最长分别为 196、150、16 帧，统一补齐后掩蔽。训练扩散设 50 步，采样默认用 25 步 UniPC；生成任务用 CFG 2.5，视频重建用 1，即保留观测条件。论文分别评估三种任务，没有给出文字和音乐同时要求同一肢体做冲突动作时的优先规则。[训练配置][train] · [CFG][cfg] · [采样步数实验][steps]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

**① 文本生成动作。** HumanML3D 上，Top-3 衡量配对文本能否进入检索前三；FID 衡量生成动作与真实动作的特征分布距离；MM-Dist 衡量动作和对应文本的嵌入距离。表中取原表中心值。Odoriko 的检索与文本距离优于列出的多模态基线，但 MCM 和专门做文本动作的 MoMask 都取得更低的 FID。比较时也要记住，Odoriko 可使用有标注测试样本的真实体形。[原表 1][t1] · [评估协议][evaltext]

| HumanML3D | 参数量 | Top-3 ↑ | FID ↓ | MM-Dist ↓ |
|---|---:|---:|---:|---:|
| MoMask（文本专用） | 45M | 0.807 | 0.045 | 2.958 |
| MCM | — | 0.788 | 0.053 | 3.037 |
| MotionCraft | 77M | 0.796 | 0.173 | 3.025 |
| GENMO | 504M | 0.632 | 0.216 | 3.466 |
| **Odoriko** | **44M** | **0.805** | **0.103** | **2.930** |

**② 音乐生成舞蹈。** FineDance 的 FID 分别从运动学特征（k）和几何特征（g）衡量分布差异，BAS 衡量动作节拍与音乐节拍的一致性。Odoriko 在这几项上都表现良好；MotionCraft、VerMo 在表中某些多样性指标更高。这里的 MotionCraft 数字由作者用官方权重重新评测。原文没有将其他所有基线都标记为同样重跑。[原表 2][t2] · [舞蹈评估协议][evaldance]

| FineDance | FIDk ↓ | FIDg ↓ | Divk ↑ | BAS ↑ |
|---|---:|---:|---:|---:|
| LODGE++ | 40.77 | 30.79 | 5.53 | 0.2423 |
| MotionCraft（作者重测） | 53.61 | 46.14 | 10.74 | 0.2143 |
| VerMo | 42.89 | — | 14.61 | 0.2162 |
| M³GPT | 42.66 | — | 8.24 | 0.2261 |
| **Odoriko** | **37.73** | **25.36** | **7.33** | **0.2496** |

**③ 视频恢复镜头里的身体。** 两个测试集都去掉全局根平移。MPJPE 是关节位置误差，PA-MPJPE 还允许做相似变换对齐，单位均为毫米。Odoriko 在 EMDB 的两项关节误差优于 GENMO；换到 3DPW，反而是 GENMO 更准。也不能从此表推断世界坐标中的根轨迹精度。[原表 3][t3] · [视频评价协议][evalvideo]

| 视频模型 | EMDB PA-MPJPE ↓ | EMDB MPJPE ↓ | 3DPW PA-MPJPE ↓ | 3DPW MPJPE ↓ |
|---|---:|---:|---:|---:|
| GVHMR | 42.7 | 72.6 | 36.2 | 55.6 |
| GENMO | 42.5 | 73.0 | 34.6 | 53.9 |
| **Odoriko** | **41.1** | **70.2** | **41.1** | **69.9** |

### 消融实验

| 在相同测试协议中改了什么 | 主要结果 | 可以读出的作用 |
|---|---|---|
| 文本保持不变，把真实 g、β 都换成标准身体 | Top-3 从 **0.805** 降到 **0.768**，FID 从 **0.103** 升到 **0.592** | 给定的个体形体确实影响生成结果与测试分布的匹配 |
| 把 g、β 合成同一个条件，两组网络都使用它 | Top-3 **0.774**，FID **0.118**；EMDB MPJPE **71.0**，完整模型为 **70.2 mm** | 先给模板、后给连续体形的分层设计有收益 |
| 视频重建时替换预测体形 | EMDB MPJPE：真实形体 **70.0**，模型估计 **70.2**，换中性模板 **76.3**，零 β **72.7 mm** | 形体会影响解算出的三维关节位置 |
| 视频中移除专用的相机系根朝向 | EMDB 的 PA-MPJPE 均为 **41.1**，MPJPE 却从 **70.2** 升到 **285.9 mm** | 允许旋转对齐的指标几乎完全掩盖了这次朝向错误 |

以上分别取自主表 3、6 与附录表 9。另一个采样对照中，UniPC 从 5 步增到 25 步，文本 FID 从 **0.906** 改善到 **0.103**，FineDance FIDk 从 **38.65** 改善到 **37.73**；增至 50 步后两项为 **0.113／37.85**。更多步数在这里没有继续改善测试结果。[视频消融][t3] · [形体消融][t6] · [架构消融][t9] · [采样对照][steps]

### 关键发现：体形到底体现在哪里？

作者训练并冻结独立评估器，让它从生成动作的**去根三维关节位置**反推模板标签、体形类别和连续 β。按附录，体形分类先把十维 β 用 PCA 降至三维，再用 K-means 分成十类，报告整个样本的类别命中率。ShapeMove 使用由真实形体生成的文字描述；Odoriko 直接得到数值参数。普通文本基线以其标准模板和形体作为参照，几行的条件接口并不等价。[原表 4][t4] · [类别构造与评价输入][evalshape]

| HumanML3D 上从关节反推属性 | 模板标签准确率 ↑ | 体形十类准确率 ↑ | β 平均绝对误差 ↓ |
|---|---:|---:|---:|
| 真实动作 | 96.9% | 93.0% | 0.102 |
| MoMask | 78.6% | 26.3% | 0.614 |
| ShapeMove | 74.5% | 52.0% | 0.574 |
| **Odoriko** | **92.0%** | **71.8%** | **0.279** |

在有舞者模板标签的 AIST++ 上，从真实舞蹈识别该标签的准确率为 **88.5%**，从生成舞蹈识别为 **61.5%**。三个髋部或侧向运动指标的组间差异方向均与参考数据一致，但幅度未必相近。例如，髋部椭圆半长轴在真实两组为 **0.085／0.156**，生成两组为 **0.247／0.251**。方向相同，但差距从 **0.071** 缩到 **0.004**，且两组生成值都偏高。这个对照比一句“保留了生物力学特征”更能说明结果的程度。[原表 5][t5] · [舞蹈体形指标定义][danceattrs]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **用同一套人体参数把生成与估计接起来。** 创作时把已有角色的 β 交进去；重建时希望系统把 β 从视频里估出来。两个任务共享“姿态落在怎样的身体上”这一问题，因此能共用动作表示和去噪骨干。[原文图 3][fig3]
- **“相同内容、换身体”的实验可以直接观察。** 项目页固定随机种子，提供双臂上伸、连续纵跳和沿窄梁行走的对照。看动画时可以分别盯住关节弯曲角度、根部高度和末端到达位置；它们对形体改变的敏感性并不相同。[作者形体对照][demo]
- **对齐方式有时比模型排名更有解释力。** 去掉相机根朝向后，一项指标原地不动，另一项误差却超过原来的四倍。把姿态本身和“整个人朝哪个方向”分开评估，才知道模型失去了什么。[原表 3][t3]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **从关节位置读出体形，尚未分离骨长和动作习惯。** 减去根平移之后，肢段长度和比例仍留在关节坐标中。92.0% 的模板标签准确率说明评估器能读出条件信息，不能据此估计有多少信息来自关节角随时间的变化。统一骨长后再测一次，是更直接的后续对照。[评估输入][evalinput] · [原表 4][t4]
- **适用范围是 SMPL 能表示的人体。** 模型改变同一人体拓扑上的模板和形体基底。对于多肢、非人形、比例极端或没有 SMPL 参数的角色，不能直接把一张任意网格送进这个接口。作者把从网格几何提取条件列为后续工作。[作者局限][limit]
- **任务共用骨干，控制能力仍应按输入验证。** 本文分别测了文本动作、音乐舞蹈和视频重建。音乐引导舞蹈的成绩不能外推到语音驱动手势；现有表格也没有回答音乐要求手在这一拍抬起、文字却要求手臂放下时怎样取舍。[三项标准实验][standard]
- **群体趋势不直接决定某个人的动作。** AIST++ 的模板标签和髋部统计量描述的是特定样本中的平均差异。即使两组均值方向保留，也不足以要求某个角色按照所属类别形成固定风格，更不能从动作推断个人的性别认同。[AIST++ 对照][t5] · [作者讨论][ethics]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **ShapeMove / Shape My Moves** 最接近“身体形态怎样影响文本生成动作”这个问题。它把体形信息放进文字描述；Odoriko 多提供了一条可直接填写 SMPL 参数的接口，也把模型用于音乐和视频。比较表 4 时应同时比较两个系统得到了怎样的条件。[Shape My Moves 原文][shapemove] · [Odoriko 对比协议][shapeprotocol]
- **GENMO / GEM、MotionCraft** 适合对照多任务覆盖。GENMO 同样涉及生成和估计，Odoriko 在 EMDB 与 3DPW 上的相对结果恰好相反；MotionCraft 是文本和音乐主表中的直接参照。横向比较时最好先固定任务与可见条件，再比较模型大小与得分。[站内 GEM 解读][gem] · [站内 MotionCraft 解读][motioncraft] · [视频主表][t3]
- **SAMoR** 关心人、鸟等不同拓扑如何共享部位表示，需要目标骨架和参考姿势；Odoriko 关心同一类人体骨架内，给定或估计体形之后动作会怎样变。若研究目标是把真人动作给非人形角色，SAMoR 的“目标关节怎样读源动作”和 Odoriko 的“给谁生成动作”对应的是两个不同的环节。[站内 SAMoR 解读][samor] · [Odoriko 形体适用范围][limit]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- Dongseok Shim 等，*Odoriko: A Shape-Aware Multimodal Diffusion Framework for Human Motion*，ECCV 2026。[Springer 正式版][springer] · [会议 PDF][paper] · [可翻译的 HTML 与附录][html]
- 作者展示了同文本、同随机种子更换体形的动作，以及视频重建时使用的全局平移条件。[作者项目与演示][project]
- 核对实验可从三张表开始。[文本形体识别][t4] · [舞蹈的方向与幅度][t5] · [给定真实形体与标准身体的消融][t6]

</div>

[html]: https://arxiv.org/html/2606.21135v1
[abs]: https://arxiv.org/abs/2606.21135
[paper]: https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/216.pdf
[springer]: https://link.springer.com/chapter/10.1007/978-3-032-37435-6_26
[poster]: https://eccv.ecva.net/virtual/2026/poster/3176
[sony]: https://sony.github.io/creativeai/
[repo]: https://github.com/dsshim0125/odoriko.github.io
[project]: https://dsshim0125.github.io/odoriko.github.io/
[demo]: https://dsshim0125.github.io/odoriko.github.io/#t2m-shape
[beam]: https://dsshim0125.github.io/odoriko.github.io/#heel
[overhead]: https://dsshim0125.github.io/odoriko.github.io/#overhead
[intro]: https://arxiv.org/html/2606.21135v1#S1
[fig1]: https://arxiv.org/html/2606.21135v1#S1.F1
[fig2]: https://arxiv.org/html/2606.21135v1#S1.F2
[fig3]: https://arxiv.org/html/2606.21135v1#S2.F3
[repr]: https://arxiv.org/html/2606.21135v1#S3.SS1
[diff]: https://arxiv.org/html/2606.21135v1#S3.SS2
[arch]: https://arxiv.org/html/2606.21135v1#S3.SS3
[loss]: https://arxiv.org/html/2606.21135v1#S3.SS4
[settings]: https://arxiv.org/html/2606.21135v1#S4.SS1
[standard]: https://arxiv.org/html/2606.21135v1#S4.SS2
[shapeprotocol]: https://arxiv.org/html/2606.21135v1#S4.SS3
[t1]: https://arxiv.org/html/2606.21135v1#S4.T1
[t2]: https://arxiv.org/html/2606.21135v1#S4.T2
[t3]: https://arxiv.org/html/2606.21135v1#S4.T3
[t4]: https://arxiv.org/html/2606.21135v1#S4.T5.fig1
[t5]: https://arxiv.org/html/2606.21135v1#S4.T5.fig2
[t6]: https://arxiv.org/html/2606.21135v1#S4.T7.fig1
[steps]: https://arxiv.org/html/2606.21135v1#S4.T7.fig2
[impl]: https://arxiv.org/html/2606.21135v1#Pt0.A1.SS1
[train]: https://arxiv.org/html/2606.21135v1#Pt0.A1.SS2
[cfg]: https://arxiv.org/html/2606.21135v1#Pt0.A1.SS3
[evaltext]: https://arxiv.org/html/2606.21135v1#Pt0.A2.SS1
[evaldance]: https://arxiv.org/html/2606.21135v1#Pt0.A2.SS2
[evalvideo]: https://arxiv.org/html/2606.21135v1#Pt0.A2.SS3
[evalshape]: https://arxiv.org/html/2606.21135v1#Pt0.A3.SS1
[evalinput]: https://arxiv.org/html/2606.21135v1#Pt0.A3.SS1.SSSx3
[danceattrs]: https://arxiv.org/html/2606.21135v1#Pt0.A3.SS2
[t9]: https://arxiv.org/html/2606.21135v1#Pt0.A4.T9
[ethics]: https://arxiv.org/html/2606.21135v1#Pt0.A6.SS2
[limit]: https://arxiv.org/html/2606.21135v1#Pt0.A6.SS3
[shapemove]: https://openaccess.thecvf.com/content/CVPR2025/html/Liao_Shape_My_Moves_Text-Driven_Shape-Aware_Synthesis_of_Human_Motions_CVPR_2025_paper.html
[gem]: /blog/iccv2025-gem/
[motioncraft]: /blog/aaai2025-motioncraft/
[samor]: /blog/neurips2026-samor/
