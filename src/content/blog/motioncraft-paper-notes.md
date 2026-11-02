---
title: "[AAAI2025] MotionCraft：共用全身动作骨干，分别接入语音和音乐控制"
description: "一段动作怎样同时接受整句文本与逐帧音频的引导？沿一段爵士舞看 MC-Bench 如何统一 SMPL-X，MC-Attn 如何建模身体协同，并核对三个生成任务与冻结策略的实验。"
pubDate: "2026-11-01T16:39:00+08:00"
badge: "Paper"
tags: ["MotionCraft", "Whole-Body-Motion", "Co-Speech-Gesture", "Music-to-Dance", "Diffusion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读版本 · AAAI 2025</summary>

*MotionCraft: Crafting Whole-Body Motion with Plug-and-Play Multimodal Controls*。作者为 Yuxuan Bian、Ailing Zeng、Xuan Ju、Xian Liu、Zhaoyang Zhang、Wei Liu、Qiang Xu。发表于 *Proceedings of the AAAI Conference on Artificial Intelligence* 39(2)，1880–1888 页，DOI 10.1609/aaai.v39i2.32183。本文以正式论文核对主实验，以 arXiv:2407.21136v3 补充数据、训练与消融。关键词包括 SMPL-X、动作扩散、人体拓扑、共语手势、音乐舞蹈。核查日期 2026-11-01。[AAAI 正式论文][venue] · [作者稿与附录][paper] · [作者项目][project] · [代码][code]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

MotionCraft 先用文本训练一个能生成连续全身动作的扩散骨干，再分别接入语音或音乐控制器。文本负责整段动作大致做什么，随时间变化的音频特征则在去噪时影响各帧。三类任务借用同一种身体参数和部位关系，仍各自使用与任务匹配的监督和评测。[原文图 3][framework]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 文本动作数据描述“一个人怎么动”，共语数据记录“讲话时手、身体和脸怎么动”，编舞数据记录“舞步怎样配合一首歌”。这些数据通常分别建模，原始骨架格式、动作幅度和可观察的身体部位都不相同。[原文图 2][distribution]

**现有痛点：** 一句“跳爵士舞”可以描述整段视频，却没有告诉模型哪一拍抬手。在音乐数据里可以找到具体的拍点，但很难找到同一时刻手和脚各在做什么的文字标注。把音频压缩成一个全局条件，会丢掉这类先后变化。[原文方法与数据构建][paper]

**核心矛盾：** 身体结构在各任务间相近，实际的协调方式却随动作变化。讲话时手跟着上身摆动，跳舞时手可能与支撑腿配合。只学习一种固定的部位关系会限制表现，完全分开学习又难以利用其他数据里的协调经验。[原文图 2、图 3][framework]

**本文目标：** 在相同的全身表示里完成文本生成动作（T2M）、语音生成共语手势（S2G）、音乐生成舞蹈（M2D），同时利用序列级文本与更细时间尺度的音频条件。[AAAI 正式论文][venue]

**切入角度：** 先把三个动作库投到 SMPL-X，用文本作为共同训练入口。再把“整段意思”和“逐帧变化”分配给训练的不同阶段，让音频控制器继承一个已经会生成人体动作的骨干。[原文图 3][framework]

**核心 idea：** 让身体各部分有三条交换信息的路径：跨样本共享的空间关系、根据当前帧计算的空间关系，以及每个部位沿时间变化的关系。语音或音乐再通过独立分支向骨干加入逐层修正，使同一种身体结构能够响应不同条件。[原文 MC-Attn][attention]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

MotionCraft 先把不同来源的动作转为统一的 SMPL-X 序列，训练文本条件去噪器。骨干在每层同时计算身体部位之间的两种空间关系和跨帧关系。随后，语音和音乐分别利用各自的配对数据训练控制分支，把音频引起的变化注入对应主干层；纯文本任务直接使用文本骨干。[原文图 3][framework] · [MC-Attn][attention] · [控制器实现][controller]

<figure class="paper-figure"><a href="/paper-notes/motioncraft/architecture.svg?v=arch-20261102-r2" target="_blank" rel="noopener"><img src="/paper-notes/motioncraft/architecture.svg?v=arch-20261102-r2" alt="MotionCraft 第一阶段训练文本条件骨干；MC-Attn 的静态图、动态图和时间支路相加；第二阶段为语音与音乐分别训练控制层，并将残差加入冻结主干。" /></a><figcaption>01 区分 Basic 与 Mix 的数据，02 看同一层中的三条并行计算，03 才接入与当前任务匹配的音频。金色虚线表示从预训练骨干复制初始参数。 <a href="/paper-notes/motioncraft/architecture.svg?v=arch-20261102-r2" target="_blank" rel="noopener">查看原图</a></figcaption></figure>

从图中 01 到 03 要分清同一段音乐的两种用途。Mix 预训练时，FineDance 的舞种与曲名写成模板文字；逐拍的音频并未进入 01。训练音乐控制器时才从同一类数据提取按时刻对齐的音乐特征，让控制层逐层改变姿势预测。02 中的“时间注意力”是身体沿帧交换信息的路径，与 03 中外部音频提供的时间信号分工不同。[附录数据构建][data] · [控制分支][controller]

### 关键设计

1. **统一运动格式，同时保留监督缺失的信息。** HumanML3D 从对应 AMASS 序列重取旋转；BEAT2 已有 SMPL-X；FineDance 的 SMPL-H 6D 旋转转成轴角并映射到 SMPL-X。每帧统一为 322 个连续数，包含根旋转和平移、躯干与手指的局部关节旋转、下颌、脸部形状与表情、身体形状。缺少脸部观测的来源用默认值填充，测评时缺失表情的生成和真值对应项均置零。因此同一输出格式可以容纳脸、手和身体，各数据集实际提供的监督仍有差异。[附录数据构建][data] · [官方数据处理说明][code]

2. **用同一文本入口预训练，Basic 与 Mix 的差别在数据。** Basic 只训练 HumanML3D 的文本–动作配对，Mix 还加入另外两域。BEAT2 用说话场景及转写生成模板句，FineDance 用舞种和曲名生成模板句，随后把这些训练样本当作文本–动作对。这样第一阶段也能看到挥手、讲话和舞蹈的身体运动；同一首曲子的不同片段可能拥有相同文字，不能靠它区分哪一拍发生了哪次转身。[原文实验设置][paper] · [附录数据构建][data]

3. **MC-Attn 分开计算稳定结构、当前姿态和跨帧关系。** 标准骨干把每帧编码为 12 个身体槽，每槽 64 维。实现中除左右手脚、头和躯干等区域，也有根部、平移和全身汇总槽。静态图学习一张跨样本共享的 12 × 12 权重表；动态图为每个样本、每一帧重新算部位间权重；时间注意力则让同一部位沿序列读取动作和文本特征。三条结果相加，再进入后续网络层。共享的是连续特征和学习出的相关性，注意力大小不能直接读成“左手在这帧接触右膝”。正文将静态图的起点描述为单位阵；所查公开版本的参数声明使用随机初始化再做归一化，这两处的初始化描述有差异。[原文 MC-Attn][attention] · [固定版本注意力实现][attention-code] · [部位编码器][pose-code]

4. **把对齐后的声音特征作为逐层残差注入。** 第二阶段的方法描述冻结主分支，从其中复制若干层初始化可训练控制器。对应任务的音频编码器把特征映射到动作隐空间，位置掩码为缺失时段补零；控制层经零初始化的线性投影，把输出加到对应主干层的输入。初始化时新分支对主干贡献为零，经过训练才逐渐起作用。附录另比较身体编码器和解码器全部或部分解冻的策略；主干 Transformer、文本路径和时间嵌入的冻结与身体输入输出层的配置要分开看。[原文图 3][framework] · [附录表 6][t6] · [固定版本控制器][controller]

### 一个完整例子：一段带配乐的舞蹈怎样进入生成器？

沿附录中的 FineDance 样本走一遍：音乐名含 *wildfire*，舞种元数据给出爵士街舞。以下拆解解释数据怎样流动，舞步并非一次实测输出。[附录数据构建][data]

1. **整理训练样本。** 把原来的舞蹈转为 SMPL-X，元数据组成一条描述曲名和舞种的模板句。Mix 的第一阶段可用这句话和动作学习爵士舞的整体运动特征；歌词、拍点或逐帧动作没有写入这句模板。
2. **学习时间条件。** 到音乐适配阶段，取配对曲目的 35 维时序音乐特征与 120 帧动作窗。控制器在对应时间位置读特征，经过零初始化投影，在每次去噪中向相应主干层加入修正。训练窗步幅为 30 帧。[附录音乐子集][data]
3. **从噪声生成舞步。** 给模型一段相应音乐和场景文字，选择音乐控制器。去噪时文本提供舞种背景，声音提供节奏变化，各帧的动态图允许手臂、躯干、双腿采取不同的协同方式。采样得到一段 SMPL-X 序列，可据此驱动身体。作者展示了配乐舞蹈，但表 3 音乐栏只报告手部 FID、身体 FID 和多样性，无法从这里读出某一拍抬手的误差。[原文图 4][qual] · [原文表 3][t3]

### 训练与推理

- **训练目标。** 将噪声加到真实动作上，用文本、噪声级别和受噪动作预测干净动作。附录设置 1000 个前向加噪步，方差线性从 0.0001 增至 0.02，模型预测干净样本。文本走冻结的 CLIP ViT-B/32 文本编码器和额外两层 Transformer。标准配置的骨干有 4 层，控制分支复制其中 2 层。作者报告 Adam、每卡 batch 64、8 张 V100 32GB、训练约 48 小时，未把成本逐任务拆开。[附录实现细节][implementation]
- **按任务选数据和窗口。** T2M 只给文本。S2G 以 BEAT2 配对训练，从声音提取二维韵律特征，动作窗口 64 帧、步幅 64 帧，可用外推采样接续较长语段。M2D 以 FineDance 配对训练，用 35 维音乐特征。论文验证三种任务接口，未报告让同一片段同时遵循独立讲话与独立音乐两条音轨的实验。[附录数据构建][data]
- **公开实现。** 仓库给出训练、评测和可视化脚本。作者公开目录实际列有 T2M 的 `epoch_12.pth`、S2G 的 `epoch_24.pth`、M2D 的 `epoch_48.pth`。README 说明语音、音乐权重分别已合并控制器与主网；音乐版用所发布的 T2M 骨干，语音版用更大模型。公开配置也有不同层数和复制层数。这里核查了实现、说明与目录，未加载权重或复算下列表格。[固定版本 README][code] · [模型下载目录][weights] · [语音配置][speech-cfg] · [音乐配置][music-cfg]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

三个测试分别回到目标任务的数据。作者仓库区分 HumanML3D 的训练／验证与测试清单，BEAT2 评测脚本加载其测试子集，FineDance 测试脚本选择 `cross_genre` 划分。下表衡量在这些评测协议下的生成能力；语音、音乐控制器都见过各自目标域的训练配对。[文本数据清单与准备说明][code] · [语音测试脚本](https://github.com/cure-lab/MotionCraft/blob/a72b1327b5ffefa4f1a9e3ffa2427b9b83f840f9/tools/s2g_test.py) · [音乐测试脚本](https://github.com/cure-lab/MotionCraft/blob/a72b1327b5ffefa4f1a9e3ffa2427b9b83f840f9/tools/m2d_test.py)

**文本生成动作。** MC-Bench 的 HumanML3D 子集，原表 2。为适配全身轴角表示，作者重新训练文本–动作检索编码器。R@k 是检索命中率，MM Dist 是配对文本与动作嵌入的距离，FID 衡量生成与真实动作特征分布的差异，Div 衡量样本之间的差异。[原文表 2][t2]

| 方法 | R@1 ↑ | R@2 ↑ | R@3 ↑ | FID ↓ | Div ↑ | MM Dist ↓ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 真实动作 | .663±.006 | .807±.002 | .864±.002 | .000±.000 | 36.423±.183 | 15.567±.036 |
| T2M-GPT | .529±.004 | .652±.003 | .732±.003 | 10.457±.108 | 36.114±.098 | 17.029±.039 |
| MDM | .383±.010 | .527±.012 | .604±.009 | 18.671±.370 | 36.156±.103 | 18.785±.054 |
| MotionDiffuse | .525±.004 | .675±.009 | .743±.009 | 9.982±.379 | 36.187±.160 | 17.314±.066 |
| FineMoGen | .565±.001 | .710±.004 | .775±.004 | 7.323±.143 | 36.324±.069 | 16.679±.029 |
| MCM | .407±.002 | .559±.003 | .636±.001 | 15.540±.443 | 35.813±.137 | 18.673±.029 |
| MotionCraft-Basic | .590±.003 | .743±.002 | .804±.004 | 8.477±.102 | 36.210±.089 | **16.252±.035** |
| MotionCraft-Mix | **.600±.003** | **.747±.004** | **.812±.006** | **6.707±.081** | **36.419±.047** | 16.334±.059 |

**语音生成手势。** MC-Bench 的 BEAT2 子集，原表 3 左。FID 分别在手部与身体特征上计算。Face L2 和节拍对齐沿用原表单位，数值不可直接与未缩放结果比较。[原文表 3][t3]

| 方法 | 手 FID ↓ | 身体 FID ↓ | Face L2 ↓（×10⁻⁸） | Beat Align ↑（×10⁻¹） | Div ↑ |
| --- | ---: | ---: | ---: | ---: | ---: |
| TalkSHOW | 26.713 | 74.824 | 7.791 | 6.947 | 13.472 |
| EMAGE | 39.094 | 90.762 | **7.680** | 7.727 | 13.065 |
| MCM | 23.946 | 71.241 | 16.983 | 7.993 | 13.167 |
| MotionCraft-Basic | 18.486 | 27.023 | 10.097 | 8.098 | 10.334 |
| MotionCraft-Mix | **12.882** | **25.187** | 8.906 | **8.226** | 12.595 |

**音乐生成舞蹈。** MC-Bench 的 FineDance 子集，原表 3 右。[原文表 3][t3]

| 方法 | 手 FID ↓ | 身体 FID ↓ | Div ↑ |
| --- | ---: | ---: | ---: |
| EDGE | 93.430 | 108.507 | 13.471 |
| FineDance | 10.747 | 72.229 | 13.813 |
| MCM | 4.717 | 78.577 | 14.890 |
| MotionCraft-Basic | 3.858 | 76.248 | 16.667 |
| MotionCraft-Mix | **2.849** | **67.159** | **18.483** |

### 消融实验

要检验图 02 的空间支路，先看“无静态图、无动态图”一行，再比较逐项补回后的同列数值。时间支路仍在工作；这个对照隔离的是空间关系建模，不是移除整个时序网络。[原表 4][t4]

原表 4 的图结构消融，节选分布指标，并保留方向。其余结构沿用 Tiny 档。[原文表 4][t4]

| 同时启用的空间关系 | T2M FID ↓ | S2G 手 FID ↓ | S2G 身体 FID ↓ | M2D 手 FID ↓ | M2D 身体 FID ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| 无静态图、无动态图 | 8.911 | 15.587 | 31.839 | 7.088 | 150.733 |
| 仅静态图 | 9.041 | 12.929 | 27.928 | 5.104 | 112.186 |
| 仅动态图 | 8.455 | 15.517 | 28.631 | 4.972 | 102.103 |
| 静态图＋动态图 | **6.707** | **12.882** | **25.187** | **2.849** | **67.159** |

- **静态与动态关系。** 单独加入静态图使 S2G 手 FID 从 15.587 降到 12.929，T2M FID 却从 8.911 升到 9.041。在这组比较里，同时加入两类关系才使三个任务的上述指标都改善。[原文表 4][t4]
- **模型规模。** 77M Tiny 扩至 130M Small（4 层，每槽 128 维），T2M FID 从 6.707 降到 5.593，M2D 身体 FID 从 67.159 降到 59.471。但 478M Large 的相应数值回升到 7.872 和 77.341；S2G 手 FID 最好的仍是 Tiny 的 12.882。[原文表 4][t4]
- **时间分块。** 附录以 130M 档做额外比较。在全量解冻身体编解码器的设置下，改用时间分块后，T2M FID 从 5.593 升到 5.944，S2G 手 FID 从 15.346 升到 17.583，M2D 身体 FID 从 59.471 升到 64.784。[附录表 6][t6]
- **解冻哪些身体部位。** 关闭时间分块时，把身体编解码器从全量解冻改为所选部位解冻，S2G 身体 FID 从 27.140 降到 26.556，手 FID 从 15.346 升到 17.962；M2D 身体 FID 从 59.471 降到 56.847，手 FID 从 2.370 升到 2.493。表 6 的“未启用局部解冻”对应全量解冻身体编解码器，不能据此推断解冻整个 Transformer 的效果。[附录表 6 及其说明][t6]

### 关键发现

1. **混合数据首先改变了动作分布。** 在同一全身评测空间内，Mix 相对 Basic 的 FID 从 8.477 降到 6.707，R@1 从 .590 升到 .600；MM Dist 略升。不同检索与分布指标衡量的对象不同。[原文表 2][t2]
2. **换回传统 HumanML3D 表示，排名也会变化。** 在只评身体的原始 H3D 基准，Basic 的 R@3 为 .796，FID 为 .173；MCM 和 T2M-GPT 的 FID 分别为 .075 和 .116。两套评测采用不同表示和编码器，不能将 .173 与 6.707 作绝对质量比较。[附录表 5][t5]
3. **手和身体受益，脸与节拍需要单独核对。** Mix 在 BEAT2 的手、身体 FID 和节拍对齐领先表列基线，脸部 L2 仍落后 EMAGE。FineDance 表的手和身体 FID 均改善；原文 M2D 结果讨论有一句称 Mix 的 FID 比 Basic 上升，与表 3 两项数字相反，本解读据表列值。[原文表 3 与对应正文][t3]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **把跨域迁移拆成两次可比较的学习。** Basic/Mix 的对照改变第一阶段的数据来源；另一组消融改变相同骨干中的身体关系。这样可以分别追问“见过更多种动作是否有用”和“哪一种结构帮助迁移”。[原文表 2][t2] · [原文表 4][t4]
- **为身体各部位保留两种协调尺度。** 共享的空间权重能够复用稳定协同，逐帧动态图保留场景差异。两张图是否都有必要，可以在语音、音乐等目标域分别检查，而不用仅凭可视化判断。[原文 MC-Attn][attention] · [原文表 4][t4]
- **评测随表示一起重建。** 三维人体格式有了手和脸，原有仅身体的评估器无法直接覆盖新增参数；作者重训检索网络，并把手部、身体和面部指标分开呈现。这比仅展示完整角色的渲染更有助于判断哪部分真正有数据支撑。[附录评估器][implementation] · [原文表 3][t3]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **段级模板文本缺少局部动作语义。** 同曲不同段可能共用一条标签，转写表达说了什么而很少标记动作怎样实施。要评测“这个词是否触发右手指向”，还需要词级时间、身体部位及解码姿态的对应证据。[附录数据构建][data]
- **帧级注入仍是软条件。** 位置掩码解决不同长度的特征排布，分支输出修正的是去噪特征。论文未给出指定关节位置、确切拍点、脚接触或手势语义必然满足的约束；语音节拍对齐的总体得分，也不能回答某一帧的右手是否落在目标上。[原文图 3][framework] · [原文表 3][t3]
- **根部误差会传到整个角色。** 作者指出，根旋转与根轨迹占六个参数，却会显著影响整段运动的质量并使训练波动。他们提出把投影后的三维关节位置也加入表示，为根部运动增加约束；这是展望，本文没有给出这一改动的实验。[附录局限讨论](https://arxiv.org/html/2407.21136v3#Sx7.SSx5.SSSx4.Px2)
- **“插件”仍需对应任务的配对数据和训练。** 本文有 T2M、S2G、M2D 三套实验。要扩展到新音频条件，或让独立语音和配乐同时牵引同一动作，还需验证条件冲突和合成同步。另外，作者将三维动作投成二维骨架接 MimicMotion 做视频示例，这一演示和三维动作质量表衡量的对象不同。[原文应用与图 5][application] · [官方运行入口][code]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **FineMoGen。** 也按时间与身体空间学习细粒度运动，强调文本对部位与时间的局部控制。MotionCraft 官方说明沿用了它的代码基础，再把重点放到多数据集的身体格式和按任务训练的音频分支上。[FineMoGen 项目](https://github.com/mingyuan-zhang/FineMoGen) · [MotionCraft 官方代码][code]
- **EMAGE。** 从语音产生包含脸、手和身体的动作，提供 BEAT2 和共语对照。MotionCraft 借这个任务验证由文本骨干迁移的效果；两者在手部 FID 和面部误差上的排序不同。[EMAGE 官方项目](https://pantomatrix.github.io/EMAGE/) · [原文表 3][t3]
- **FineDance。** 为音乐和带手部的编舞提供配对样本及风格元数据。MotionCraft 将其转换到 SMPL-X，元数据用于第一阶段的段级文字，音轨用于第二阶段的时间控制，两种监督来自同一数据但承担不同作用。[FineDance 作者仓库](https://github.com/li-ronghui/FineDance) · [附录数据构建][data]
- **启发。** 若希望语音手势与音乐舞蹈共用可编辑的“抬手–停留–收回”，可以从 MotionCraft 已解决的共享身体参数开始，但下一步应检验跨域部位、事件和时间是否有同一解释，及修改事件后输出动作是否遵守它。本文提供了共享格式和骨干的证据，这个更强的问题仍需新的干预实验。[原文表 2–4][t4]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- 正式出版信息、主方法、主表 2–4。[AAAI 条目][venue] · [AAAI 正式 PDF][official-pdf]
- 数据构建、身体表示和附录表 5–6。阅读版本 arXiv:2407.21136v3。[作者稿全文][paper] · [附录数据构建][data] · [附录实现细节][implementation]
- 项目、权重说明和静态代码。源码核查版本 `a72b132`，权重与运行结果未独立复验。[作者项目][project] · [仓库固定版本][code] · [模型权重入口][weights]
- 本页架构图为依据论文图 3 和源码重新绘制的教学示意，表格摘录自作者评测。核查日期 2026-11-01。[原文图 3][framework] · [图示大图](/paper-notes/motioncraft/architecture.svg?v=arch-20261102-r2)

</div>

[venue]: https://ojs.aaai.org/index.php/AAAI/article/view/32183
[official-pdf]: https://ojs.aaai.org/index.php/AAAI/article/view/32183/34338
[paper]: https://arxiv.org/html/2407.21136v3
[project]: https://cure-lab.github.io/MotionCraft/
[distribution]: https://arxiv.org/html/2407.21136v3#Sx3.F2
[framework]: https://arxiv.org/html/2407.21136v3#Sx3.F3
[attention]: https://arxiv.org/html/2407.21136v3#Sx4.SSx2
[qual]: https://arxiv.org/html/2407.21136v3#Sx4.F4
[t2]: https://arxiv.org/html/2407.21136v3#Sx5.T2
[t3]: https://arxiv.org/html/2407.21136v3#Sx5.T3
[t4]: https://arxiv.org/html/2407.21136v3#Sx5.T4
[t5]: https://arxiv.org/html/2407.21136v3#Sx7.T5
[t6]: https://arxiv.org/html/2407.21136v3#Sx7.T6
[data]: https://arxiv.org/html/2407.21136v3#Sx7.SSx3
[implementation]: https://arxiv.org/html/2407.21136v3#Sx7.SSx4
[application]: https://arxiv.org/html/2407.21136v3#Sx5.F5
[code]: https://github.com/cure-lab/MotionCraft/tree/a72b1327b5ffefa4f1a9e3ffa2427b9b83f840f9
[controller]: https://github.com/cure-lab/MotionCraft/blob/a72b1327b5ffefa4f1a9e3ffa2427b9b83f840f9/mogen/models/transformers/controlnet.py
[pose-code]: https://github.com/cure-lab/MotionCraft/blob/a72b1327b5ffefa4f1a9e3ffa2427b9b83f840f9/mogen/models/transformers/stmogen.py
[attention-code]: https://github.com/cure-lab/MotionCraft/blob/a72b1327b5ffefa4f1a9e3ffa2427b9b83f840f9/mogen/models/attentions/st_attention.py
[speech-cfg]: https://github.com/cure-lab/MotionCraft/blob/a72b1327b5ffefa4f1a9e3ffa2427b9b83f840f9/configs/stmogen/S2G_Beats2_no_face_loss_025b.py
[music-cfg]: https://github.com/cure-lab/MotionCraft/blob/a72b1327b5ffefa4f1a9e3ffa2427b9b83f840f9/configs/stmogen/M2D_finedance_no_face_loss_0125b.py
[weights]: https://drive.google.com/drive/folders/1cY7JFtmqBEsI2R_UKcIzxcsLETw1OXwF

