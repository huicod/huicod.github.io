---
title: "[arXiv2026] MoRAE：什么样的动作表示适合从噪声生成？"
description: "解读 MoRAE: Flow-Friendly Self-Supervised Latents for Text-to-Motion Generation，以及修订稿 MoRAE: Representation Autoencoders for Human Motion Generation。用受控实验解释为何重建误差更小，生成动作反而更差。"
pubDate: "2026-11-21"
badge: "Paper"
tags: ["MoRAE", "Text-to-Motion", "Flow Matching", "Self-Supervised Learning", "Motion Representation", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**初稿 v1（Flow-Friendly）**　[可翻译的 HTML 全文][v1] · [原文 PDF][pdf1]\
**修订稿 v2（Representation Autoencoders）**　[可翻译的 HTML 全文][v2] · [原文 PDF][pdf2]\
[作者推理代码][code] · [HumanML3D 模型权重][weights]

<details class="paper-meta"><summary>论文信息与阅读范围 · arXiv 2026</summary>

*MoRAE: Flow-Friendly Self-Supervised Latents for Text-to-Motion Generation*，arXiv:2607.29180，2026 年 7 月 31 日上传。初稿署名依次为 Yifei Zhu、Mingyi Shi、Yangyang Cai、Miao Cheng、Yoshifumi Kitamura、Taku Komura。[v1 记录][record1]

11 月 15 日修订稿的 arXiv 记录沿用原题，正文首页改题为 *MoRAE: Representation Autoencoders for Human Motion Generation*，署名为 Yifei Zhu、Dafei Qin、Zijiao Zeng、Mingyi Shi、Yangyang Cai、Taku Komura、Yoshifumi Kitamura。截至 2026 年 11 月 21 日，按 arXiv 预印本收录。下文沿初稿解释标题里的 *flow-friendly*，并单列修订稿新增的实验和生成配置。数值均为作者报告。[v2 记录][record2] · [v2 正文][v2]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

同一个动作压缩器，拿真实动作编码再解码可以重建得很好，接上从噪声生成动作的模型却可能表现很差。MoRAE 先通过遮挡关节学全身协调，再将每帧 768 维特征压到 32 维；初稿还让最终的动作重建误差一路传回压缩器，使生成器免不了犯的小错在解码成骨架后代价更低。[v1 图 1][fig1] · [v1 表 3][diag2]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文本到动作通常分成表示学习和生成两个环节。前者把一段动捕变成潜表示，并学会从中还原动作。后者读文本，从头生成相应的潜表示。写成两段，就可以固定生成器，专门问哪种表示更容易学。[v1 引言][intro]

**现有痛点**　能从可见身体推断被遮住的关节，说明表示保留了身体各部分的联系。遇到“放下箱子再跑”，生成器却是从一整段高斯噪声出发，起初连屈膝弯腰的姿态都没有。修订稿在 HumanML3D 上做了三个对照：直接生成 768 维自监督特征时，FID 为 0.3970；使用简单的 32 维瓶颈时为 0.0385；采用完整的 32 维 MoRAE 时为 0.0253。缩小维度已经解决了很大一部分困难，同样是 32 维，表示的训练方式仍会影响结果。[v2 表 2][width]

**核心矛盾**　压缩器练习的是“给定真实动作，能还原多少”。生成器要解决的是“从噪声抵达正确区域，走偏一点会怎样”。前一个问题的答案取决于真实动作能否较好地重建，后一个还取决于潜空间各方向有多难预测，以及解码器会把哪些方向的偏差放大。[v1 §3][diag]

**本文目标**　寻找既保留身体协调、又能由标准文本条件流模型可靠生成的连续表示，让文本中的多个动作可以在一段骨架序列中展开。[v1 摘要][v1]

**切入角度**　先保持真实动作的重建结果完全一致，只拉伸潜空间不同方向，检查生成是否受到影响。再比较两个重建水平相近的压缩器，测出同样大小的预测误差经过各自的解码器后代价多大。[v1 表 2][diag1] · [v1 表 3][diag2]

**核心 idea**　遮挡预测让编码器学会利用其余身体，紧凑的连续瓶颈使流模型较容易恢复动作，最终骨架的反馈又能改变压缩器保留信息的方式。两个版本都保留前两步，修订稿简化了最后的解码路径，并补做了“哪种动作信息占据易生成方向”的检验。[v1 方法][m1] · [v2 方法][m2]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

v1 把训练分三次做。第一次只用动作训练 Motion-JEPA。第二次冻结它，将每帧特征压成一个连续向量，经过特征解码器和动作解码器还原骨架。第三次固定整套动作表示，用配对的文本和动作训练流模型。生成新动作时，给一句话、指定序列长度、采样噪声，便可直接走图中的推理支路。[v1 图 1][fig1] · [v1 §4][m1]

<figure class="reading-figure"><a href="/paper-notes/morae/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/morae/architecture.svg" alt="MoRAE 初稿三阶段训练及独立生成流程。先从遮挡动作预测教师特征，再压成逐帧 32 维连续潜表示并串联解码，最后学习由文本条件引导的整段潜流。下方列出修订稿的改变。" loading="lazy" /></a><figcaption>本站依据两版图 1 重绘，点击可放大。先沿绿色和蓝色区域读表示学习，留意骨架误差传回压缩器的路径，再看暖色的流训练和紫色的生成路径。底部标出修订稿的替换部件。</figcaption></figure>

### 关键设计

1. **遮住一部分身体，从其余运动猜回上下文。** v1 在连续若干帧或跨时间的一组关节上做遮挡。学生只读残缺动作，预测教师看完干净动作得到的隐藏特征，在遮挡位置计算误差。教师由学生参数的指数移动平均更新。学好后，完整动作的每一帧都有一个结合前后文的 768 维向量。这里的“自监督”指训练目标来自动作本身。[v1 §4.1][jepa1]

2. **同时重建特征与骨架，让最终动作参与决定压缩方式。** v1 用一层注意力预测每帧 32 维高斯分布的均值和方差，采出连续向量。特征解码器先还原 768 维特征，训练时向它加入小幅高斯扰动，动作解码器再还原骨架。总损失包括特征重建、动作重建和弱 KL 正则。作者说的 *motion-coupled* 体现在梯度路径上。骨架重建误差会穿过两个解码器，回到 32 维压缩器。对照组保持结构和损失项相同，仅在动作解码器的输入处截断来自骨架的反传，让这项误差只更新动作解码器。[v1 式 12–14][compress1]

3. **在整段连续潜序列上学速度。** 取一段标准高斯噪声 ε 和真实动作潜序列 z，按时间 t 混合为 (1−t)ε + tz。DiT 同时收到混合序列、t 和冻结 CLIP 提取的句子向量，训练目标是预测从 ε 指向 z 的速度 z−ε。推理从新噪声出发，多次求速度并积分，最后把整段潜序列一次送入解码器。这里的 token 是每帧一个 32 维实数向量，生成时所有帧共同更新。[v1 式 15–16][flow1]

4. **修订稿把遮挡落到整条关节轨迹上。** v2 每次选约 30% 的关节，遮住它们在所有帧上的全部通道。例如把某只脚的位置遮掉时，速度、旋转及其接触通道也一起遮掉，防止从同一关节轻易抄回答案。预训练完成，冻结教师并取末四层特征，仍压成逐帧 32 维。新的四层动作解码器直接从潜向量重建全部动作通道，训练用动作重建和 KL，生成目标取后验均值。HumanML3D 的完整输入是 22 关节、每帧 263 维，KIT-ML 是 21 关节、251 维。[v2 图 1][fig2] · [v2 式 1–3][m2]

### 一个完整例子

作者在 v2 附图 S3 给出的描述是“男子放下箱子，接着跑起来”。以作者生成的 **64 帧**样本顺着推理路径走一遍：

1. CLIP 编码整句。采样器创建一段 **64 × 32** 的初始噪声，每行对应将来的一帧。文本没有给出放箱子的确切帧号。
2. DiT-M 结合句子在这段序列上预测速度。这个 HumanML3D 样例用 5 步四阶 Runge–Kutta 积分、引导强度 4.5。迭代结束仍是 64 × 32 的连续潜序列。
3. 动作解码器将它还原为 64 × 263 的动作特征；作者从中恢复身体并渲染第 0、10、21、40、63 帧。MoRAE 一行可以看到下俯再起跑，对照的 VAE 一行保持得更直立。两边同为 32 维，匹配生成器的训练设置、初始噪声、随机种子与采样器。图是作者从候选提示中选出的单例，渲染内容是人，手与箱子的真实接触仍缺少直接观察。[v2 附图 S3 与实验设置][figbox]

<figure class="reading-figure"><a href="/paper-notes/morae/box-and-run.webp" target="_blank" rel="noopener"><img src="/paper-notes/morae/box-and-run.webp" alt="作者对放下箱子再跑这一提示的对照。两行各显示五次取样的人体姿势，可比较起跑前躯干和膝部的弯曲程度。" loading="lazy" /></a><figcaption>Yifei Zhu 等，MoRAE 修订稿附图 S3。本站将原图由 PNG 转为 WebP。<a href="https://arxiv.org/html/2607.29180v2#S6.F3">原图及图注</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></figcaption></figure>

### 训练与推理

v1 最终使用 DiT-XL，生成器训练 800 个 epoch，batch size 64。论文写 24 步积分，官方推理实现具体取 24 个 Euler 时间点，执行相邻点之间的 23 次更新。HumanML3D 的引导强度为 8.5，KIT-ML 为 7.5。公开的 XL 权重配套 HumanML3D，可输出每帧 67 个根状态和相对关节位置特征，以及 22 个恢复到三维空间的关节。[v1 §5.1][setup1] · [作者推理实现][impl] · [权重][weights]

v2 各数据集分别训练三个阶段 600、400、500 个 epoch。生成器换为 5800 万参数的 DiT-M，HumanML3D 最终配置是 5 步 RK4、引导 4.5，KIT-ML 是 12 步、引导 9.5，分别计算 20、48 次引导速度。作者在单张 RTX 5090 上记录到 JEPA 预训练约 4 小时、DiT 训练约 6 小时；这两项尚缺中间压缩器阶段的耗时。当前公开入口提供 XL 的推理代码和权重，本文未独立运行训练或采样。[v2 附录 D][impl2] · [作者仓库][code]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**v1 表 5。** 采用 essential-dimension 评估器，HumanML3D 使用 67 维表示。下表选取原表的三个指标，FID 衡量生成动作与真实动作的分布距离，Top-1 是评估器的文本—动作检索准确率，Matching 是配对文本与动作的特征距离。作者做 20 轮评估，下列为均值，MoRAE 行保留 95% 置信区间。[v1 主表][main1]

| 数据集 | 方法 | FID ↓ | Top-1 ↑ | Matching ↓ |
| --- | --- | ---: | ---: | ---: |
| HumanML3D | MoMask | 0.116 | 0.490 | 3.353 |
| HumanML3D | MARDM（DiT-XL） | 0.114 | 0.500 | 3.270 |
| HumanML3D | **MoRAE（DiT-XL）** | **0.089 ± .004** | **0.512 ± .003** | **3.233 ± .006** |
| KIT-ML | MoMask | 0.411 | 0.369 | 3.577 |
| KIT-ML | MARDM（DiT-XL） | 0.242 | 0.387 | 3.374 |
| KIT-ML | **MoRAE（DiT-XL）** | **0.169 ± .009** | **0.410 ± .006** | **3.254 ± .020** |

**v2 表 5。** 使用标准全维动作表示及对应评估协议，主模型改为 DiT-M。以下也是 20 轮评估均值，MoRAE 保留 95% 置信区间。两个版本更换了生成器、动作表示与评估口径，各自在本表内比较。[v2 主表][main2]

| 数据集 | 方法 | FID ↓ | Top-1 ↑ | MMDist ↓ |
| --- | --- | ---: | ---: | ---: |
| HumanML3D | MoMask | 0.045 | 0.521 | 2.958 |
| HumanML3D | MotionHiFlow | 0.032 | 0.563 | 2.691 |
| HumanML3D | **MoRAE（DiT-M）** | **0.0253 ± .0015** | 0.520 ± .002 | 2.939 ± .005 |
| KIT-ML | MoMask | 0.204 | 0.433 | 2.779 |
| KIT-ML | MotionHiFlow | 0.135 | 0.482 | 2.552 |
| KIT-ML | **MoRAE（DiT-M）** | **0.1214 ± .0037** | 0.478 ± .005 | 2.552 ± .018 |

### 消融实验

**第一层诊断：同一批可解码动作，改变潜空间的伸缩。** v1 在潜空间做可逆变换，解码前抵消它。所有组的重建 FID 都是 0.068，DiT-S 同样训练 500 个 epoch。表中 κ 是流模型实际坐标的协方差条件数，数值越大，最大和最小方差方向相差越远。中度拉伸还能生成，过度拉伸后 FID 急剧上升。[v1 表 2，节选][diag1]

| 实测 κ | 重建 FID ↓ | 生成 FID ↓ |
| ---: | ---: | ---: |
| 25 | 0.068 | 0.160 |
| 793 | 0.068 | 0.163 |
| 2,200 | 0.068 | 0.534 |
| 5,400 | 0.068 | 8.05 |

**第二层诊断：骨架误差是否传回压缩器。** v1 换成正常或截断动作梯度的两套压缩器，都配同一 DiT-S 训练协议。截断组在真实动作上的重建 FID 更低，流模型留下的潜误差也更小，但残差更常落到解码器敏感的方向，导致解码代价和生成 FID 同时上升。表中的“方向放大比”衡量该残差方向相对于各向同性误差受解码器放大的程度。[v1 表 3][diag2]

| 骨架误差 | κ | 重建 FID ↓ | 潜误差 | 方向放大比 | 解码代价 | 生成 FID ↓ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 传回压缩器 | 27 | 0.068 | 0.059 | 4.85 | 0.157 | **0.160** |
| 截断反传 | 29.5 | **0.057** | **0.055** | 6.08 | 0.195 | 0.243 |

**v2 的预训练目标。** 在相同 32 维架构与 DiT-M 配置下，HumanML3D 上普通 AE、VAE、遮挡预测的生成 FID 分别为 0.0349、0.0383、0.0253。再换遮挡方式，打乱通道分组得到 0.0377，关节与连续时间段混合为 0.0271，整条关节轨迹遮挡为 0.0253。[v2 表 3][pretrain] · [v2 表 4][mask]

**v2 的同谱对照。** 作者用同帧其余关节做岭回归，估计每个关节中可由全身动作解释的部分 C。然后固定全部 32 个特征值和同一个解码器，把大方差分配给与 C 关系最强的方向，或反过来分配。两组的 κ 同为 59.70，解码前抵消各自变换，真实动作重建相同。生成 FID 分别为 **0.0279、0.0589**。另一实验把各方向白化，κ 从 59.70 降到 4.65，生成 FID 却从 0.0253 升到 0.0411。[v2 表 6][white] · [v2 表 7][fixed]

### 关键发现

1. **重建表现和生成表现要实测两次。** v1 的截断对照把这两种排名倒过来了。对同一个潜误差 δ，局部上可以把解码后的误差理解为 Jδ，J 是解码器在这个动作附近的雅可比矩阵。只看 δ 的长度，漏掉了它指向哪里。[v1 §3.2][decomp] · [v1 表 3][diag2]
2. **易恢复的方向上放了什么，会影响最终骨架。** 在从噪声到数据的中间时刻，低方差方向更容易被噪声淹没。v2 同谱实验控制了可保留的信息量和伸缩比例，仍观察到明显差距，支持让跨关节协调更多落在易预测方向的解释。[v2 §4.4][spectral]
3. **动作分布和文本一致性各自回答不同的问题。** v2 的 MoRAE 在两个数据集的主表中 FID 最低；HumanML3D 的 Top-1 为 0.520，低于 MotionHiFlow 的 0.563。改善整个数据集的动作分布，不能据此推算一句指定指令各部分的完成率。[v2 表 5][main2]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

两版连起来读，可以得到一个检验动作表示的方法：固定压缩器和解码结果，只改变生成器看到的坐标。先用可逆拉伸测试训练能容忍多大的尺度差，再用同谱的方向重排测试哪些运动信息值得占据更易恢复的方向。这样能把“真实数据是否丢失”与“生成器是否学得到”分开检验。[v1 表 2][diag1] · [v2 表 7][fixed]

对细动作尤其值得看 v2 的反例。用 32 维表示读出其余关节难以解释的局部残差时，MoRAE 的相对误差为 0.6895，VAE 为 0.5562；读出跨关节协调时，两者分别为 0.1078 和 0.1112。前者擅长从全身推断身体关系，独立于全身的细微手部变化则可能在压缩中受到不同对待。[v2 表 1][probe]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **观测来自两套骨架数据。** 主实验覆盖 HumanML3D 和 KIT-ML。跨关节协调 C 由特定回归器估计，“剩下的部分”会随骨架、所选特征与估计器改变。要外推到包含手指的共语手势，需要重新测量手指独立运动的可读出程度和生成误差。[v2 §4.1][probe] · [v2 主表][main2]
- **文本提供软条件。** 箱子示例只给文本与序列长度，接口没有传入物体位置、接触帧或目标手腕坐标。若研究问题是“手必须在第 20 帧触箱”，还需加入场景与目标测量，单个渲染样例和总体 FID 都回答不了。[v2 附图 S3][figbox] · [公开推理接口][code]
- **复现需要选对版本。** 当前公开的 DiT-XL 权重按 essential-dimension 评估器报告 FID **0.0885 ± 0.0037**，与 v1 主表四舍五入后的 0.089 对应。复核 v2 的 **0.0253** 需要它的 DiT-M、全维表示与相应评估器，公开 XL 包不能直接验证这个数字。[作者仓库][code] · [v1 表 5][main1] · [v2 表 5][main2]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **T2M-GPT** 也先训练动作表示。它把片段量化成码本编号，由语言模型逐个选编号。MoRAE 在连续向量上同时更新全部帧。研究“先抬手再后退”时，前者可以检查离散序列的预测，后者可以检查误差沿哪个潜方向传播到关节。[T2M-GPT 站内解读](/blog/cvpr2023-t2m-gpt/) · [MoRAE v1 §4.3][flow1]
- **DisCoRD** 同样用流，但以外部模型给出的离散动作 token 为条件，把细节恢复到连续动作。MoRAE 的文本条件流负责产生整段的连续潜序列，之后由动作解码器读出骨架。读这两篇时，可以先看噪声在哪里、条件从哪里来、哪一步还原连续运动。[DisCoRD 站内解读](/blog/iccv2025-discord/) · [MoRAE v2 图 1][fig2]
- **MotionSpaceFlow** 直接在逐帧动作空间建模流，为增量运动特征和全局关节坐标选择不同的时间注意力。采用全局坐标时，采样过程中可以写入指定帧的关节位置。MoRAE 通过预训练、压缩与解码决定哪些方向先被模型恢复。若要把两种表示用于关键帧控制，可以进一步做同一目标关节、同一时刻的解码后误差比较。[MotionSpaceFlow 站内解读](/blog/arxiv2026-motionspaceflow/) · [MoRAE v2 表 7][fixed]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 原题、作者、版本日期及首稿全文。[v1 书目][record1] · [v1 HTML][v1] · [v1 PDF][pdf1]
- 修订稿的直接动作解码器、全维协议、同谱实验与选例。[v2 书目][record2] · [v2 HTML][v2] · [v2 PDF][pdf2]
- 推理接口、采样配置与公开权重。[GitHub 仓库][code] · [固定版本的推理源码][impl] · [Hugging Face 权重][weights]

</div>

[v1]: https://arxiv.org/html/2607.29180v1
[v2]: https://arxiv.org/html/2607.29180v2
[pdf1]: https://arxiv.org/pdf/2607.29180v1
[pdf2]: https://arxiv.org/pdf/2607.29180v2
[record1]: https://arxiv.org/abs/2607.29180v1
[record2]: https://arxiv.org/abs/2607.29180v2
[code]: https://github.com/zhuyifeiabcd1/MoRAE
[weights]: https://huggingface.co/HAJIMIMANBO1/MoRAE-DiT-XL
[impl]: https://github.com/zhuyifeiabcd1/MoRAE/blob/d6d1282d70bb263a14f317cfb757ed1dd0ed6bc8/src/morae/pipeline.py#L113-L126
[intro]: https://arxiv.org/html/2607.29180v1#S1
[diag]: https://arxiv.org/html/2607.29180v1#S3
[decomp]: https://arxiv.org/html/2607.29180v1#S3.SS2
[diag1]: https://arxiv.org/html/2607.29180v1#S3.T2
[diag2]: https://arxiv.org/html/2607.29180v1#S3.T3
[m1]: https://arxiv.org/html/2607.29180v1#S4
[fig1]: https://arxiv.org/html/2607.29180v1#S4.F1
[jepa1]: https://arxiv.org/html/2607.29180v1#S4.SS1
[compress1]: https://arxiv.org/html/2607.29180v1#S4.SS2
[flow1]: https://arxiv.org/html/2607.29180v1#S4.SS3
[setup1]: https://arxiv.org/html/2607.29180v1#S5.SS1
[main1]: https://arxiv.org/html/2607.29180v1#S5.T5
[fig2]: https://arxiv.org/html/2607.29180v2#S0.F1
[m2]: https://arxiv.org/html/2607.29180v2#S3
[probe]: https://arxiv.org/html/2607.29180v2#S4.T1
[width]: https://arxiv.org/html/2607.29180v2#S4.T2
[pretrain]: https://arxiv.org/html/2607.29180v2#S4.T3
[mask]: https://arxiv.org/html/2607.29180v2#S4.T4
[main2]: https://arxiv.org/html/2607.29180v2#S4.T5
[spectral]: https://arxiv.org/html/2607.29180v2#S4.SS4
[white]: https://arxiv.org/html/2607.29180v2#S4.T6
[fixed]: https://arxiv.org/html/2607.29180v2#S4.T7
[impl2]: https://arxiv.org/html/2607.29180v2#S4a
[figbox]: https://arxiv.org/html/2607.29180v2#S6.F3
