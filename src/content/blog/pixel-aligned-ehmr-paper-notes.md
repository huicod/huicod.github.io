---
title: "[SIGGRAPH2026] PEAR：怎样从一张照片恢复全身，还能对准嘴形和手指？"
description: "PEAR 用共享的视觉主干同时估计身体、双手和面部表情，把像素对齐留在训练阶段。对照原文图中的张嘴与张手案例，拆解 EHM-s、光度监督、手部消融和实时动画耗时。"
pubDate: "2026-11-26T17:23:00+08:00"
badge: "Paper"
tags: ["PEAR", "Pixel-Aligned Expressive Human Mesh Recovery", "人体网格恢复", "像素对齐", "SMPL-X", "FLAME", "EHM-s", "单目人体重建", "虚拟人动画", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML（含附录 A、B）][html] · [原文 PDF][pdf] · [作者对照演示][project] · [代码与模型][repo]

<details class="paper-meta"><summary>论文信息与阅读范围 · SIGGRAPH 2026 Conference Papers</summary>

*PEAR: Pixel-aligned Expressive humAn mesh Recovery*，作者为 Jiahao Wu、Yunfei Liu、Lijian Lin、Ye Zhu、Lei Zhu、Jingyi Li、Yu Li，来自 IDEA。正式发表于 SIGGRAPH 2026 Conference Papers，第 46 篇。本文按 arXiv v2 的章节、图号和表号解读，并核查作者项目及公开推理代码。以下数字取自作者实验，本次未运行模型。[ACM 出版记录][acm] · [arXiv 版本记录][record] · [核查的代码版本][code]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

一张演讲者的照片里，肩、肘和手腕的位置都可以估得差不多，重建出来的人却可能嘴没张够、手指也没有分开。PEAR 先用一个视觉主干预测身体、双手和脸的三维参数，再在**训练时**把估计的网格渲染回原视角，让唇线、手指等区域的图像差异反过来修正模型。部署后，一次前向计算就能给出这套可驱动动画的参数。[架构图 4][f4] · [像素监督图 5][f5] · [开关监督的画面对照图 10][f10]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　人体网格恢复从图像估计三维姿势和体形。对于虚拟人，身体骨架只解决了一部分问题：角色还要能动手指、张嘴、眨眼。SMPL-X 用一套可驱动的模板表示身体、手与脸；FLAME 专门描述头形、下颌和表情。PEAR 的目标是一次得到整个人，同时保留面部模型的表现力。[任务分类与表示][repr]

**现有痛点**　全身图里，嘴只占几个像素，手指也远小于躯干。把每只手和脸另裁一份、放大并送进专门网络，有利于看清细节，却会增加检测、裁剪和推理开销。另一条路是全身只算一次，但训练若只检查稀疏关节，一个轮廓贴不住原图的网格也可能得到不错的关节分数。[原文图 3][f3] · [方法 §3.2][arch]

**核心矛盾**　“手腕在正确位置”与“手指在图像上张开的角度正确”是两个约束。同样，两侧嘴角基本对上时，上下唇之间依然可能留出错误的空隙。稀疏点对整个人的位置很有用，点之间的大量可见像素还没参与纠错。[像素监督 §3.3][photo] · [原文图 8][f8]

**本文目标**　输入一张人物 RGB 图，输出身体和双手姿势、体形、脸形、头部姿势与表情、头部尺度及相机参数，使同一份结果既能在原图上投影检查，也能驱动三维角色。作者还展示只看得到头像或上半身的输入；这时可检查的是画面中实际可见的部位。[图 1][f1] · [作者演示][project]

**切入角度**　把昂贵的工作移到训练时做。先用专门的身体、手、脸估计器制作分部伪标签，让预测网格足够接近人物。再让可以求梯度的渲染器回答一个比“关节对上了吗”更细的问题：按这套几何和相机重画一次，跟原照片哪里不同？[标注 §3.4][labels] · [渲染 §3.3][photo]

**核心 idea**　用一个共享视觉主干回归几何，把擅长刻画表情的 FLAME 头接到能驱动全身的 SMPL-X 上。粗网格由参数和关键点学出来，可见细节由重渲染误差补上。上线后保留回归和网格生成这条短路径。[原文图 4][f4] · [头身融合算法][fusion]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先沿推理路径读：人物图像经共享 ViT 编码和解码，分别预测身手参数、脸部参数、头尺度与相机。EHM-s 将前面三组组装成一张全身网格，相机负责把三维结果投影回画面。再看训练路径：第一阶段用伪标签和关键点教它摆出大致正确的姿势；第二阶段增加渲染的图像误差，继续更新 PEAR。推理新照片时，不需要再让 GUAVA 反复比较和优化这张照片。[图 4][f4] · [图 5][f5] · [附录图 17][f17]

<figure class="reading-figure"><a href="/paper-notes/pixel-aligned-ehmr/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/pixel-aligned-ehmr/architecture.svg" alt="PEAR 中文架构图。单图经过共享 ViT，输出身体与手、FLAME 头、头尺度和相机；EHM-s 将头身融合为全身网格。训练支路先用分部伪标签监督，再经 GUAVA 重渲染与原图比较。" /></a><figcaption>依据原文图 4、5、17 重绘。读“像素对齐”时看训练支路，读“实时”时只沿图像到参数的推理支路。点击可放大。</figcaption></figure>

### 关键设计

1. **共享一次图像编码，分头读出身体和脸。** 同一份视觉特征交给解码器。SMPL-X 输出负责躯干、四肢及手指姿势和体形；FLAME 输出负责脸形、表情和头部姿势。另有头部缩放与相机输出。公开实现左右手各预测 15 个关节旋转。网络能从头像估计表情，也能从全身照估计身体；它看到的证据取决于输入构图。[图 4 与式 1–5][arch] · [参数解码实现][headcode]

2. **EHM-s 把 FLAME 的表情真正接到会动的身体上。** 先在规范姿势下分别产生身体模板和带表情的头。用头部关节作参照，将 FLAME 头配准到 SMPL-X 的头区；三轴尺度 **s** 允许头的比例独立于身体体形。随后按预先建立的顶点对应替换头区，再对融合模板做全身线性混合蒙皮（LBS）。所以同一帧里，下颌可以张开，头也会随颈和身体转动。“换成小头或大头”落在显式参数上，无须让表情系数兼任头身比例。[附录图 17][f17] · [算法 1][fusion] · [参数变化图 18][f18]

3. **让专家产训练标签，让共享主干承担推理。** ProHMR 估身体，HaMeR 估手，TEASER 估脸。作者发现将 SMPL 的身体姿态直接抄到 SMPL-X 会产生偏移，于是先对齐两者的 T 形规范姿势，再转换身体参数。DWPose 给出二维关键点，协助调整各部分对图像的投影。标签缺失时按有效性掩膜计算损失，例如有人脸标签的样本仍能训练脸部输出。这些专家产出的是伪标签，会继承各自的误差。[原文图 6 与式 9][labels] · [附录图 19][f19] · [掩膜与关键点监督][mask]

4. **用渲染误差训练几何，先决条件是网格已经大致对准。** 把预测的 EHM-s 网格、输入图像和相机送入基于 3D Gaussian Splatting 的 GUAVA，渲染同一视角。训练目标将逐像素的 **L1** 差异与衡量视觉特征差异的 **LPIPS** 相加，误差信号经渲染路径传回姿态网络。若一开始网格就离人物太远，高斯可能绑错部位，外观还能掩饰错误几何。因此作者先训练粗回归器、适配全身渲染器，再固定渲染器做像素监督。“对齐”指借可见图像监督网格，训练数据并没有给照片中每个像素标一个真实三维顶点。[图 5、式 6–8][photo] · [训练顺序][train]

### 一个完整例子

看原文图 10 右侧：绿幕前的人双手举到胸前，几根手指彼此分开。作者给出输入图、关闭光度损失的网格叠图、开启后的叠图。阅读时先遮住脸，只看白框里的指尖和指缝，比较就集中在“轮廓具体贴在哪里”。[图 10 原图][f10]

| 跟着这一帧走 | 能从中检查什么 |
|---|---|
| 输入一张半身图，ViT 共享编码 | 手与躯干处于同一图像坐标系，图中可直接判断手在胸前哪一侧、手腕约在什么高度。 |
| 回归关节、表情、尺度和相机，生成 EHM-s | 手指旋转负责张合，手腕和两臂决定整只手的位置。仅把手腕投影到正确位置，指尖仍可能偏。 |
| 训练阶段比较渲染图与原图 | 若重画的指边和输入轮廓错开，图像损失会提供稀疏手腕点之外的误差。作者的开关实验展示了这一训练对局部叠合的影响。 |
| 部署时输出网格 | 可从侧面查看模型推测的深度，但照片只提供一个视角。图中前视轮廓更贴合，仍不能证明被遮住的指节或手与胸口的距离正确。 |

同图左侧给了另一个观察窗口：戴眼镜者的嘴形。再看图 8 中紧闭双眼与张大嘴的样例，可以把“头在画面哪个位置”和“头上发生什么表情”分开比较。[图 10][f10] · [图 8][f8]

### 训练与推理

| 阶段 | 作者实际做了什么 |
|---|---|
| 粗回归 | 用身体、手、脸部参数和二维、三维关键点训练。约 20 万次迭代，batch size 40，8 张 NVIDIA A6000，约 10 天。 |
| 像素增强 | 先把预训练 GUAVA 适配到全身数据，再用其像素监督细化 PEAR。后一个阶段约 2 万次迭代，batch size 2，同为 8 张 A6000，约 1 天。论文未单列制作伪标签和适配 GUAVA 的耗时。 |
| 新图像 | 共享网络一次输出人体和相机参数。默认图片示例先检测人物框，再逐人推理；另有跳过检测、直接对整幅输入缩放补边的入口。两者都不要求为每只手和脸分别跑一遍特写网络。 |

一个容易影响复现的细节是输入尺寸。原文 §4.2 提到 256 × 256，表 2 列给 PEAR 的是 256 × 192。公开推理代码能串起两者：先将人物图整理成 256 方图，送进主干前沿宽度左右各去掉 32 像素。另一个版本差异仍需保留：论文称主干为 ViT-B，公开默认配置写的是 32 层、宽度 1,280。下文速度采用原表口径，不能直接视为这份默认权重在读者设备上的测速。[训练 §3.5][train] · [免检测入口][nodetect] · [主干输入][pipeline] · [默认配置][config] · [带人物检测的入口][detector]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**身体。** 原文表 3 比较同样估计身体、手和脸的开源模型。下表选较严格的二维 PCK@0.05、两项 3DPW 关节误差和 AGORA 身体顶点误差。PCK 越高，表示更多关键点投影落入规定距离阈值；PA-MPJPE 会先做相似变换对齐。速度列的测试卡是 L40S。[表 3][t3]

| 方法 | FPS ↑ | COCO PCK ↑ | LSP-Ext. PCK ↑ | PoseTrack PCK ↑ | 3DPW MPJPE ↓ | 3DPW PA-MPJPE ↓ | AGORA 身体 MVE ↓ |
|---|---:|---:|---:|---:|---:|---:|---:|
| OSX | 20 | 0.70 | 0.42 | 0.82 | 74.7 | **45.1** | 80.2 |
| Multi-HMR | 10 | 0.65 | 0.43 | — | 78.0 | 45.9 | 59.6 |
| SMPLest-X | 20 | 0.71 | 0.40 | 0.82 | 74.8 | 45.8 | 63.5 |
| **PEAR** | **100** | **0.81** | **0.55** | **0.87** | **71.3** | 45.3 | **59.3** |

原表未列 Multi-HMR 的 PoseTrack 值，因为该方法检出额外人物，作者没有报告可比结果。PEAR 在三个数据集的二维投影得分均最高；3DPW 做过对齐后，OSX 略优。由此可见，把关节在照片上放得更准，与提高每个三维指标是两件需要分别验证的事。[表 3 与 §4.2][bodyeval]

**手。** 原文表 2 测量对齐后手部顶点误差（PA-PVE，越低越好）。它主要检查手自身的几何形状；一只形状正确的手是否落在相机空间的正确位置，需要另测。[表 2][t2] · [手部样例图 7][f7]

| 方法 | 输入设置（原表） | EHF ↓ | UBody-intra ↓ |
|---|---|---:|---:|
| PIXIE | 手部裁剪 | 11.1 | 12.2 |
| Hand4Whole | 手部裁剪 | **10.8** | **8.9** |
| OSX | 256 × 192 | 15.9 | 10.8 |
| SMPLer-X | 256 × 192 | 15.0 | 10.3 |
| Multi-HMR | 896 × 896 | 16.4 | 11.2 |
| **PEAR** | **256 × 192** | **12.8** | **9.8** |

**脸。** 原文表 1 将 PEAR 与专门的面捕方法对比。保留原表的列名和量纲，均为误差、越低越好。LVE 衡量唇部顶点；整体脸部误差在表头写作 MLE，正文称 MVE。参考值来自按 GUAVA 方法对 UBody、3DPW 测试序列拟合的跟踪结果。[表 1][t1] · [评测设置][bodyeval]

| 方法 | UBody MLE（10⁻³ m） | UBody LVE（10⁻⁵ m） | 3DPW MLE（10⁻³ m） | 3DPW LVE（10⁻⁴ m） |
|---|---:|---:|---:|---:|
| SMIRK（面捕） | 2.81 | 8.02 | 4.25 | 2.77 |
| TEASER（面捕） | 1.92 | 4.23 | 3.95 | 5.60 |
| SMPLest（原表名称） | 8.93 | 15.6 | 13.3 | 9.38 |
| **PEAR** | **0.72** | **1.22** | **3.36** | **0.99** |

### 消融实验

**把预测网格渲染回原图有没有帮助？** 原文表 6 在同一设置下开关光度损失。以下保留原表数值，各列都越低越好。表 6 对面部 MLE、LVE 统一标作 10⁻⁴ m、10⁻⁵ m，与表 1 部分列的单位标注不一致；两表应各自纵向比较。[表 6][t6] · [图 10][f10]

| 设置 | UBody 脸部 MLE | UBody 唇部 LVE | 3DPW 脸部 MLE | 3DPW 唇部 LVE | EHF 手部 PA-PVE | UBody-intra 手部 PA-PVE |
|---|---:|---:|---:|---:|---:|---:|
| 关闭光度损失 | 7.92 | 1.43 | 3.43 | 1.24 | 13.3 | 12.8 |
| 开启光度损失 | **7.19** | **1.22** | **3.36** | **0.99** | **12.8** | **9.8** |

**把训练集从 300 多万图像或帧扩到 600 多万呢？** 表 4 的 Part 1 包含 Human3.6M、COCO、MPII 等；Part 2 加入 Ego-Exo4D、Ego-Humans、SA-1B、Harmony4D、AI Challenger。按同表对比，严格阈值下的二维身体关键点有所改善，UBody-intra 手部反而退步。[数据划分][setup] · [表 4][t4]

| 训练数据 | COCO PCK@0.05 ↑ | LSP-Ext. PCK@0.05 ↑ | PoseTrack PCK@0.05 ↑ | EHF 手部 ↓ | UBody-intra 手部 ↓ |
|---|---:|---:|---:|---:|---:|
| Part 1，3M+ | 0.79 | 0.52 | 0.87 | 13.3 | **9.5** |
| Part 1 + Part 2，6M+ | **0.81** | **0.55** | 0.87 | 13.3 | 12.8 |

### 关键发现

1. **最清楚的像素监督证据来自同模型的开关实验。** 开启后，UBody-intra 手部 PA-PVE 从 12.8 降到 9.8，而 EHF 从 13.3 到 12.8，说明不同测试集的受益幅度不同。表 2 同时表明，能单独裁手的 Hand4Whole 在这两个手部测试上仍更准。[表 6][t6] · [表 2][t2]
2. **100 FPS 要问计时到哪一步。** 表 5 用 FP32 逐项计时。下表把原文的秒换成毫秒。L40S 单算参数约 9 ms，加入作者的动画环节为 23 ms，即约 43 帧/秒；RTX 4090 总计约 33 帧/秒。这里没有单列摄像头采集、多人检测或网络传输耗时。[原表 5][t5]

| 毫秒/帧 | L40S | A100 | RTX 5090 | RTX 4090 | RTX 3090 |
|---|---:|---:|---:|---:|---:|
| 回归 EHM-s 参数 | 9 | 13 | 10 | 11 | 15 |
| 动画 | 14 | 13 | 16 | 19 | 20 |
| 两者合计 | **23** | **26** | **26** | **30** | **35** |

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把错误画出来，比再加几个稀疏点更有针对性。** 如果错误是“嘴张得不够大”，下颌大致位置正确仍会留下可见的嘴形差异。PEAR 把这种误差用于训练，同时让预测结果保持为可编辑的脸部参数。表 6 的唇部误差给这个机制提供了比单张展示图更直接的支持。[图 8][f8] · [表 6][t6]
- **输出可以直接交给动画系统。** 手指、体形和表情都有各自的参数，EHM-s 又确保头在规范模板里正确接回躯干。对需要“跟着摄像头做动作”的角色，这是比一段渲染视频更实用的接口。作者展示了从相机画面驱动角色的应用。[融合算法][fusion] · [作者实时动画演示][demo]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

1. **单视角约束不了被挡住的部分。** 手被躯干挡住时，一些深度配置投影出来几乎一样。原文承认严重遮挡和复杂交互仍难处理。需要可靠接触的应用还应测手与物体的相对距离；论文的手部 PA-PVE 或原视角叠图无法代替该项测试。[局限 §5][limits] · [附录的新视角展示][views]
2. **逐帧恢复与视频级动作捕捉的要求不同。** 项目展示了视频驱动，模型的核心输入仍是单张图。本文的表格测单帧位置、网格误差或速度；要判断脚步是否滑动、遮挡后身份能否保持、嘴角会不会逐帧抖动，还需要时序指标。[架构 §3.2][arch] · [下游演示][project]
3. **复现应区分推理和完整训练。** 作者公开了推理权重、训练入口和数据样例；仓库说明完整训练集尚未公开。当前入口足以核查预测参数、输入尺寸等实现细节，但本次没有独立复现两阶段训练或论文的硬件速度。[作者仓库][repo] · [模型权重][weights]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **DanceHMR（SIGGRAPH Asia 2026）。** 两篇都关心全身画面里很小的手。PEAR 从单图回归身、手、脸，用重渲染收紧可见细节；DanceHMR 从视频联合恢复身体和手，更适合追问手指出画、再入画时动作能否接得上。比较前先选定关心的是单帧投影还是跨帧连续性。[站内 DanceHMR 解读](/blog/siggraphasia2026-dancehmr/) · [PEAR 手部实验][t2]
- **GVHMR（SIGGRAPH Asia 2024）。** PEAR 用相机参数把网格对回当前照片。GVHMR 处理移动相机下人物在世界中怎么走、地面朝哪边。前者的唇形和手指误差，回答不了后者关心的世界坐标轨迹问题。[站内 GVHMR 解读](/blog/siggraphasia2024-gvhmr/) · [PEAR 投影监督][arch]
- **对动作数据制作的启发。** 用 PEAR 从普通视频提取伪动作时，可以把“可见关节投影是否贴住人物”“跨帧运动是否稳定”“被遮住的关节有无可靠证据”分开记录。前一项最贴近 PEAR 的训练信号，后两项值得另外验证，尤其是在要把提取结果送入生成模型训练时。[原文伪标签流程][labels] · [有效性掩膜][mask]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **出版与阅读**　[ACM 正式记录][acm] · [作者 arXiv 记录][record] · [全文与附录 HTML][html] · [PDF][pdf]
- **方法与实验**　[论文总图][f4] · [像素级训练][f5] · [EHM-s 融合伪代码][fusion] · [身体指标][t3] · [光度损失消融][t6] · [硬件耗时][t5]
- **演示与复现**　[项目与公开对比][project] · [实时驱动视频][demo] · [作者实现][code] · [官方模型][weights]
</div>

[html]: https://arxiv.org/html/2601.22693v2
[pdf]: https://arxiv.org/pdf/2601.22693v2
[record]: https://arxiv.org/abs/2601.22693
[acm]: https://doi.org/10.1145/3799902.3811096
[project]: https://wujh2001.github.io/PEAR/
[demo]: https://wujh2001.github.io/PEAR/static/videos/Realtime_animations.mp4
[repo]: https://github.com/Pixel-Talk/PEAR
[code]: https://github.com/Pixel-Talk/PEAR/tree/8e915f8c3dfae4063d66763e6296b2b0b02eb303
[weights]: https://huggingface.co/BestWJH/PEAR_models
[pipeline]: https://github.com/Pixel-Talk/PEAR/blob/8e915f8c3dfae4063d66763e6296b2b0b02eb303/models/pipeline/ehm_pipeline.py#L29-L52
[headcode]: https://github.com/Pixel-Talk/PEAR/blob/8e915f8c3dfae4063d66763e6296b2b0b02eb303/models/smplx/smplx_head.py#L259-L305
[detector]: https://github.com/Pixel-Talk/PEAR/blob/8e915f8c3dfae4063d66763e6296b2b0b02eb303/inference_images.py#L297-L343
[nodetect]: https://github.com/Pixel-Talk/PEAR/blob/8e915f8c3dfae4063d66763e6296b2b0b02eb303/inference_wo_detect.py#L76-L94
[config]: https://github.com/Pixel-Talk/PEAR/blob/8e915f8c3dfae4063d66763e6296b2b0b02eb303/configs/infer.yaml#L10-L25
[f1]: https://arxiv.org/html/2601.22693v2#S0.F1
[f3]: https://arxiv.org/html/2601.22693v2#S3.F3
[repr]: https://arxiv.org/html/2601.22693v2#S3.SS1
[arch]: https://arxiv.org/html/2601.22693v2#S3.SS2
[photo]: https://arxiv.org/html/2601.22693v2#S3.SS3
[labels]: https://arxiv.org/html/2601.22693v2#S3.SS4
[train]: https://arxiv.org/html/2601.22693v2#S3.SS5
[f4]: https://arxiv.org/html/2601.22693v2#S3.F4
[f5]: https://arxiv.org/html/2601.22693v2#S3.F5
[t1]: https://arxiv.org/html/2601.22693v2#S4.T2.fig1
[t2]: https://arxiv.org/html/2601.22693v2#S4.T2.fig2
[t3]: https://arxiv.org/html/2601.22693v2#S4.T3
[t4]: https://arxiv.org/html/2601.22693v2#S4.T4
[t5]: https://arxiv.org/html/2601.22693v2#S4.T5
[t6]: https://arxiv.org/html/2601.22693v2#S4.T6
[f7]: https://arxiv.org/html/2601.22693v2#S4.F7
[f8]: https://arxiv.org/html/2601.22693v2#S4.F8
[f10]: https://arxiv.org/html/2601.22693v2#S4.F10
[bodyeval]: https://arxiv.org/html/2601.22693v2#S4.SS2
[setup]: https://arxiv.org/html/2601.22693v2#S4.SS1
[limits]: https://arxiv.org/html/2601.22693v2#S5
[f17]: https://arxiv.org/html/2601.22693v2#A1.F17
[f18]: https://arxiv.org/html/2601.22693v2#A1.F18
[fusion]: https://arxiv.org/html/2601.22693v2#alg1
[f19]: https://arxiv.org/html/2601.22693v2#A1.F19
[mask]: https://arxiv.org/html/2601.22693v2#A2.SS1
[views]: https://arxiv.org/html/2601.22693v2#A2.SS2
