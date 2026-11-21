---
title: "[ICCV2025] Danceba：怎样让手势和步伐跟上同一段音乐"
description: "解读 Align Your Rhythm: Generating Highly Aligned Dance Poses with Gating-Enhanced Rhythm-Aware Feature Representation。沿着音乐特征、频谱相角和上下身动作码追踪生成过程，对照节拍匹配、动作质量及替代权重的结果。"
pubDate: "2026-11-21"
badge: "Paper"
tags: ["Danceba", "Music-to-Dance", "Music-Motion Alignment", "Phase", "Mamba", "AIST++", "Motion Tokenizer", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[可翻译的 HTML 全文][html] · [ICCV 终稿 PDF][pdf] · [作者项目与演示][project] · [代码与权重入口][repo]

<details class="paper-meta"><summary>论文信息与阅读范围 · ICCV 2025</summary>

*Align Your Rhythm: Generating Highly Aligned Dance Poses with Gating-Enhanced Rhythm-Aware Feature Representation*。Danceba 是方法名。作者 Congyi Fan、Jian Guan、Xuanjia Zhao、Dongli Xu、Youtian Lin、Tong Ye、Pengming Feng、Haiwei Pan。收录于 ICCV 2025，第 13193–13202 页。下文对照会议终稿、arXiv v2 与作者仓库。会议补充包是一段演示视频。实验数据来自原表，代码部分为静态核查。[会议记录][venue] · [补充视频包][supp] · [作者仓库][repo]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

同一个鼓点上，舞者可以脚下换重心，手臂继续上一拍的动作。Danceba 给音乐特征增加一条频谱相角分支，让音乐和上下身的动作历史通过门控注意力交换信息，再分别预测下一对动作码。五次训练的平均结果里，把相位分支换成普通线性层，节拍匹配分数从 **0.2779 降到 0.2474**。这个实验直接检验了相位分支在现有音乐特征之上带来的增益。[原文图 1][fig1] · [消融表 2][t2]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　Bailando 已经能把舞蹈压缩为上身、下身两串动作码。给定音乐和先前舞姿，自回归模型每步只需从两个码本中各选一个编号，之后便可解码出整段三维动作。[相关工作与基础模型][prelim]

**现有痛点**　从音乐预测的姿态可以很自然，却提前或推迟了换重心的时刻。同样，模型可以在每次重音都摆出相似的姿态，节拍跟上了，舞蹈幅度和变化却不足。论文分别用节拍匹配、动作特征分布和多样性考察这些现象。[实验设置][setup] · [动作与节拍可视化][fig6]

**核心矛盾**　上下身既要协调，又可以遵循不同的时间节奏。脚步可能按强拍落地，手臂则跨越数拍完成一个弧线。把身体完全拆开会丢失协调关系，一味共用一条时序表示，又可能把两类变化混在一起。[原文 §3.3][tgca] · [§3.4][pmmm]

**本文目标**　给定音乐和起始动作码，生成单人连续三维舞蹈，使动作转折更贴近音乐节拍，同时维持姿态与运动的多样性。论文用 AIST++ 上的音乐驱动生成来检验这个目标。[任务定义][prelim] · [原表 1][t1]

**切入角度**　原有模型已经看得到音乐特征。作者提出从这些特征的局部频谱提取相角，把与周期、时序变化相关的信息单独投影，再送回音乐和动作三路，使下一次选码更容易利用它。[相位分支][pre]

**核心 idea**　先让三路在同一拍附近互相参考，再让每一路沿自己的时间轴更新状态。门控注意力负责跨路交流，三条并行的 Mamba 分支分别处理音乐、上身、下身；最终只需输出上下身两个动作编号。[架构图][fig1] · [预测头代码][heads]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练时，预训练的两套 Pose VQ-VAE 把真实舞姿编码为监督用的编号。生成时，模型从一对起始码和预处理的音乐开始，反复预测下一对编号，最后查码本解码为逐帧舞姿。音乐分支一直提供条件，不需要预测下一个音符。[原文图 1][fig1] · [训练与推理定义][prelim]

<figure class="reading-figure"><a href="/paper-notes/danceba/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/danceba/architecture.svg" alt="Danceba 先用预训练码本从真实舞姿得到上下身监督编号。生成时，音乐相位特征进入门控因果注意力，再由音乐、上身、下身三条 Mamba 分支处理，预测两个动作码并解码为连续舞姿。" loading="lazy" /></a><figcaption>据原文图 1、式 1–12 与公开实现重绘。上半部提供训练目标，下半部沿一次推理逐步展开。虚线表示下一对动作码被送回历史。点击可放大。</figcaption></figure>

### 关键设计

1. **给音乐和身体建立共同的时间刻度。** 两套预训练动作码本分别编码上身 15 个关节和下身 9 个关节，各有 512 个候选码。配置将 60 帧/秒的动作按时间压缩 8 倍，得到每秒 7.5 对码，与每秒 7.5 组音乐特征对应。上下身各选各的编号，但预测时两者都可以读此前的全身动作。[配置][config] · [关节分组与解码][vq] · [主文式 1–5][prelim]

2. **PRE 取的是音乐特征的相角。** 仓库先提取 438 维声学特征，包括 MFCC 及其变化、色度、起音强度、自动估计的拍点和节奏谱。公开实现将输入的时间和特征维展平成一条序列，再做短时傅里叶变换（STFT，窗长参数 512、步长 256），取复数结果的相角，经裁剪、投影、归一化和 ReLU 得到节奏特征。论文用三份相位特征分别增强音乐与上下身；源码为三路各设投影，并以可学习尺度加回原嵌入。因此，这里的相角来自特征序列，不能按原始音频采样点的物理相位解读，也没有直接给出人体的步态相位。[原文式 6–8][pre] · [音乐预处理][audio] · [PRE 实现][phasecode] · [融合实现][fusion]

3. **TGCA 先让三路交流，再调节哪些信息值得传下去。** 在每个目标时刻，交叉条件因果注意力可以读取允许范围内的音乐和两路动作历史。另一条路径对输入作线性投影和 SiLU 激活，所得特征门与注意力输出逐元素相乘。这个门由当前输入算出，值可以连续变化。它没有一张预先写好的“第几拍必须出脚”的开关表。[原文式 9–10、注意力热图][tgca] · [实际门控块][gatecode]

4. **PMMM 分开更新状态，再共同预测两个码。** 经过跨路交流后，音乐、上身、下身各有一条 Mamba 状态空间分支，每条分支再经过门控前馈层与残差连接。代码在并行模块后还经过一次跨路模块，再用两个分类头预测下一上身码和下一下身码。公开采样函数对两个分布各取概率最高的一项，将它们追加到历史。多样性表衡量的是生成样本之间的差别，并不等于这条贪心采样路径每次对同一输入都会给出不同编舞。[并行模块][pmmm] · [分类头][heads] · [采样函数][sample]

### 一个完整例子

设一段 **4 秒**的音乐有明显鼓点。我们想观察舞者能否在鼓点附近完成动作转折，同时让上身手势保持连贯。下表用公开配置追踪数据尺寸；没有为这段示意音乐指定舞步或虚构动作码的含义。[训练配置][config] · [原文实验里的节拍图][fig6]

| 环节 | 此时模型实际拿到什么、产生什么 |
| --- | --- |
| 训练样本 | 4 秒动捕为 240 帧。编码器得到上、下身各 30 个编号；4 秒音乐对应约 30 个声学特征位置，每个位置 438 维。 |
| 学下一步 | 以上下身前 29 个码作历史，以后 29 个码作目标，让对应音乐参与预测，两个分类头分别计算交叉熵后求和。模型学的是下一对已观察动作码的概率。[训练循环][training] |
| 换一段音乐生成 | 公开默认评测从测试动作编码中取第一对码作起点，其余码逐步生成。每步让音乐与已有姿态交流，再选出下一对编号。仓库另有固定起始码的演示分支。[初始化与解码][evalcode] |
| 回到可见的舞步 | 两套解码器恢复子序列并按关节合并，评测路径还累加根节点速度，得到随时间移动的全身。要核对某一拍，需检查解码后的运动速度和相应帧，再看脚是否落地；单看码值无法完成这项判断。[解码实现][vq] · [节拍计算][beatcode] |

### 训练与推理

作者沿用 Bailando 的动作分词器，训练动作码预测器。公开配置使用 240 帧训练片段、批量 32，训练计划为 300 个 epoch；README 报告使用单张 NVIDIA 3090，未给出可换算总 GPU 小时的计时时长。推理的动作码历史受上下文窗口约束，音乐特征先行准备，论文没有报告从现场麦克风到舞姿输出的端到端延迟。[实验配置][config] · [采样实现][sample] · [作者说明][repo]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 节拍更齐时，哪些动作指标也变好了？

论文使用 AIST++ 的 991 段动作，951 段训练、40 段测试，每段测试生成取 20 秒评估。FIDₖ 比较运动学特征分布，FIDg 比较几何姿态特征分布，二者越低越好。Divₖ、Divg 衡量生成样本在对应空间中的分散程度。BAS 的实现从平滑后的平均关节速度局部极小值取动作拍，对每个音乐拍找最近动作拍，再对时间差给分；它不区分这次减速来自踩地、转身还是停手。[实验设置与数据划分][setup] · [BAS 实现][beatcode]

| AIST++，原表 1 节选 | FIDₖ ↓ | FIDg ↓ | Divₖ ↑ | Divg ↑ | BAS ↑ |
| --- | ---: | ---: | ---: | ---: | ---: |
| 真实动捕 | 17.10 | 10.60 | 8.19 | 7.45 | 0.2374 |
| Bailando | 28.16 | 9.62 | 7.83 | 6.34 | 0.2332 |
| Bailando++（作者用官方代码与权重复测） | 22.74 | 11.58 | 7.94 | 6.34 | 0.2263 |
| E3D2 | 26.25 | 8.94 | 7.96 | 6.49 | 0.2232 |
| Lodge | 37.09 | 18.79 | 5.58 | 4.85 | 0.2423 |
| Danceba，论文选出的最佳版本 | **11.67** | 11.90 | **8.52** | **7.55** | 0.2714 |
| Danceba，五次独立训练均值 | 15.48 | 13.57 | 7.85 | 7.49 | **0.2779** |

最佳版本的 FIDₖ 从 Bailando++ 的 22.74 降至 11.67，表明它在速度、能量相关特征上更接近参照分布。几何 FID 则高于 E3D2 的 8.94，也高于 Bailando 的 9.62。五次均值的 BAS 比“最佳版本”那一行更高，所以 **11.67 和 0.2779 属于两行不同的报告值**。论文标明 Bailando++ 由作者复测，Bailando、Lodge 等使用各自论文结果。[原表 1][t1] · [比较协议][compare]

### 消融一：相位、门控和并行时序建模各贡献多少？

下表保留作者原表 2 的五次训练均值。这里的 FID 和 Div 各自是运动学与几何两项的平均值。空缺项表示原表没有报告，对应模块究竟让 BAS 改变多少不能从这张表读出。[原表 2 与替换方案][ablation]

| 改动 | FID 均值 ↓ | Div 均值 ↑ | BAS ↑ |
| --- | ---: | ---: | ---: |
| 用普通交叉条件因果注意力替代 TGCA | 33.22 | 6.74 | — |
| 用 TGCA 层替代并行 Mamba 模块 | 25.24 | 5.78 | — |
| 用普通可学习线性层替代 PRE | 20.62 | 6.53 | 0.2474 |
| 完整 Danceba | **14.53** | **7.67** | **0.2779** |

替换 PRE 后，BAS 降低 **0.0305**，FID 上升 6.09。原始音乐特征已经包含起音、节拍等信息，因此这一对照检验的是显式相角分支的**附加作用**。另外两组对照直接支持门控和并行结构对动作分布、多样性的作用。[消融表 2][t2] · [音乐特征构造][audio]

### 消融二：一条 Mamba 能否替代并行分支？

| 原表 3 | FIDₖ ↓ | FIDg ↓ |
| --- | ---: | ---: |
| 整体建模，Danceba-Single | 82.50 | 83.97 |
| 并行建模，Danceba | **15.48** | **13.57** |

两项 FID 都大幅下降。原表 3 将 FIDg 的方向误印为 ↑，并写下降 60.40；按所列 **83.97 与 13.57** 相减应为 **70.40**。上表沿用原始均值，指标方向按论文 §4.1 的定义。这个对照支持在该架构中分路建模，但不能据此确定某一路对应人类可命名的舞步。[原表 3][t3] · [指标定义][setup]

### 用公开权重，可以预期哪组数？

作者在仓库说明最优权重在训练中被覆盖，发布的是表现接近的替代权重。README 给出的参考结果为 FIDₖ **12.92**、FIDg **14.38**、Divₖ **8.24**、Divg **7.44**、BAS **0.2902**。用仓库结果和论文最佳行逐列比较时，需要保留这个权重差异；本文没有对该权重重新推理或计分。[官方评测说明][repo]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把“听见拍点”和“看见具体舞步”放在两个可检查的环节。** PRE 是否有效，可固定其他模块看去掉它以后 BAS 怎么变；一次抬手或落脚是否真的合拍，则要回到解码后的关节轨迹。图 6 并列音乐拍与动作拍，比单看注意力热图更接近第二个问题。[节拍可视化][fig6] · [消融表 2][t2]
- **跨部位通信与部位各自的时序变化可以并存。** 门控注意力让上身知道下身此前怎样移动，随后独立的状态空间分支仍可以保留手势和步伐的不同持续时间。单分支消融说明，这个分工确实影响了输出的特征分布。[架构图][fig1] · [并行结构对照][t3]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **BAS 超过真实动捕仍有解释边界。** 舞者可以切分、延迟或提前重音，指标只看最近一次速度低谷与拍点的时间距离。若应用需要“第三拍必须右脚落地”，还需要脚部接触标签与逐事件时差，论文没有提供这样的达标率。[指标实现][beatcode] · [原表 1][t1]
- **音乐相角能帮助合拍，尚不能给每个通道命名。** PRE 消融保留了其他声学特征，论文没有做固定旋律改节奏、固定节奏改和声的成对干预。频谱里出现周期结构，与证明模型已独立分离节奏、旋律和和声，是不同的证据。[相角可视化][fig2] · [作者讨论][limitations]
- **码本限定了可以还原的动作细节。** 两套预训练码本只有有限的动作模式；本文也只在 AIST++ 的这一评测设置上比较。音乐风格变化、未见过的舞步、精细的腕部动作能否保留，需要额外评测。[局限与展望][limitations]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **Bailando。** 它提供了 Danceba 沿用的上下身动作分词与自回归框架。读两篇时可以固定“最后都是选下一对码”这一点，再看 Danceba 怎样改变音乐条件和上下身历史的处理。原表 1 中 Bailando 的几何 FID 仍低于 Danceba。[Bailando 原文](https://openaccess.thecvf.com/content/CVPR2022/html/Siyao_Bailando_3D_Dance_Generation_by_Actor-Critic_GPT_With_Choreographic_Memory_CVPR_2022_paper.html) · [直接对照][t1]
- **Lodge。** Lodge 关心长舞怎样先用舞蹈原语安排全局编排，再生成局部动作。Danceba 关心每次选上下身动作码时，音乐节奏怎样进入预测。二者对长程结构和局部合拍提出了不同的问题，Danceba 的 20 秒评测并未检验整首歌曲的编排质量。[Lodge 站内解读](/blog/cvpr2024-lodge/) · [Danceba 评测协议][setup]
- **PhaseDance。** 同样讨论“相位”，首先应问对什么信号求相位。Danceba 的 PRE 处理输入音乐特征；PhaseDance 在舞者的运动上建模周期与表达。若要编辑舞者自身的动作周期，单有 Danceba 的声学相角还缺少动作侧可读、可操作的对应量。[PhaseDance 站内解读](/blog/neurips2026-phasedance/) · [Danceba 的相角定义][pre]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 正式发表信息、终稿与官方动作演示。[ICCV 2025 会议记录][venue] · [终稿 PDF][pdf] · [补充视频包][supp] · [项目页][project]
- 可翻译的论文正文、图与三张原表。[arXiv v2 HTML][html]
- 公开配置、训练与评测实现、权重入口。[作者仓库][repo] · [本文核对的代码版本](https://github.com/fancongyi/Danceba/tree/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa)

</div>

[html]: https://arxiv.org/html/2503.17340v2
[venue]: https://openaccess.thecvf.com/content/ICCV2025/html/Fan_Align_Your_Rhythm_Generating_Highly_Aligned_Dance_Poses_with_Gating-Enhanced_ICCV_2025_paper.html
[pdf]: https://openaccess.thecvf.com/content/ICCV2025/papers/Fan_Align_Your_Rhythm_Generating_Highly_Aligned_Dance_Poses_with_Gating-Enhanced_ICCV_2025_paper.pdf
[supp]: https://openaccess.thecvf.com/content/ICCV2025/supplemental/Fan_Align_Your_Rhythm_ICCV_2025_supplemental.zip
[project]: https://danceba.github.io/
[repo]: https://github.com/fancongyi/Danceba
[fig1]: https://arxiv.org/html/2503.17340v2#S2.F1
[fig2]: https://arxiv.org/html/2503.17340v2#S3.F2
[fig6]: https://arxiv.org/html/2503.17340v2#S4.F6
[prelim]: https://arxiv.org/html/2503.17340v2#S3.SS1
[pre]: https://arxiv.org/html/2503.17340v2#S3.SS2
[tgca]: https://arxiv.org/html/2503.17340v2#S3.SS3
[pmmm]: https://arxiv.org/html/2503.17340v2#S3.SS4
[setup]: https://arxiv.org/html/2503.17340v2#S4.SS1
[compare]: https://arxiv.org/html/2503.17340v2#S4.SS2
[ablation]: https://arxiv.org/html/2503.17340v2#S4.SS3
[limitations]: https://arxiv.org/html/2503.17340v2#S5
[t1]: https://arxiv.org/html/2503.17340v2#S3.T1
[t2]: https://arxiv.org/html/2503.17340v2#S4.T2
[t3]: https://arxiv.org/html/2503.17340v2#S4.T3
[config]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/configs/cc_motion_gpt.yaml
[phasecode]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/models/LPE.py#L21-L68
[audio]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/_prepro_aistpp_music.py#L78-L115
[gatecode]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/models/cross_cond_gpt2.py#L147-L183
[fusion]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/models/cross_cond_gpt2.py#L344-L365
[heads]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/models/cross_cond_gpt2.py#L439-L456
[sample]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/models/cross_cond_gpt2.py#L35-L65
[training]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/mc_gpt_all.py#L119-L135
[evalcode]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/mc_gpt_all.py#L275-L322
[vq]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/models/sep_vqvae_root.py#L16-L86
[beatcode]: https://github.com/fancongyi/Danceba/blob/ffb5ae74b7578242e7cf95a11e122f1f8a14abfa/utils/beat_align_score.py#L17-L73
