---
title: "[CVPR2026] MoCoDiff：换了动作和风格，下一段怎样接得上？"
description: "从飞机式步态、翻滚和僵尸式上楼，读懂文本、风格示范和前段尾帧如何分别进入去噪器，以及长序列里风格保真与接缝平滑的取舍。"
pubDate: "2026-11-26T21:08:00+08:00"
badge: "Paper"
tags: ["MoCoDiff", "A Controllable Autoregressive Diffusion Model for Expressive Motion Generation", "CVPR 2026", "风格化动作生成", "文本到动作", "长序列", "自回归扩散", "历史条件", "100Style", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[正文 HTML 阅读器][html] · [CVPR 正式版 PDF][pdf] · [补充 HTML 阅读器][supphtml] · [补充材料与演示视频（ZIP）][supp]

首次使用阅读器时，选择对应的会议 PDF 或补充 ZIP，浏览器会按双栏顺序生成可选择、可翻译的正文。

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026</summary>

*MoCoDiff: A Controllable Autoregressive Diffusion Model for Expressive Motion Generation*，作者为 Wenfeng Song、Xuehan Wang、Shuai Li、Yi Chen、Yuting Guo、Zhenyu Wu、Xingliang Jin、Chenglizhao Chen、Fei Hou、Hongyu Wu 和 Aimin Hao。发表于 CVPR 2026，23528–23537 页。本文对照会议终稿和七页补充材料，实验数字采用作者报告。核查于 2026 年 11 月 26 日，论文链接的官方仓库主分支只有说明、许可和忽略文件，未列出骨架模型代码或权重。另有未合并的草稿 PR，其示例以 RGB 视频帧为输入。本次没有运行骨架模型。[会议记录][cvf] · [仓库快照][repo] · [草稿 PR][pr]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

角色刚用张开双臂的姿势走过来，接下来要翻滚，再换成僵尸步态上楼。MoCoDiff 让文本规定每段做什么，从参考动作读取怎样做，再让前一段末尾的姿态与运动趋势参与下一段的逐步去噪。[原文图 1][first] · [框架图 3][model]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**　文本动作生成擅长给一句话配一个动作，风格迁移可以把一种步态借给另一种动作。要生成一整段表演，系统还得处理指令变化的那一刻。[相关工作 §2][background]

**现有痛点**　把“走路”和“上楼”分别生成再拼接，角色可能突然改变重心或步速。直接沿用前段，又可能把本应结束的动作和风格带进新段落。[图 5 的动作过渡][results]

**核心矛盾**　后段需要继承前段的运动趋势，也需要服从新文本和新风格。历史太弱会让接缝突兀，历史太强则可能把角色锁在旧姿态上。[附录 §2.1–2.2、表 1–2][supp]

**本文目标**　输入依次排列的动作文本和可选风格示范，分段生成连续人体动作，同时检验指令能否辨认、参考风格是否可见、接缝处是否有突变。[§3.1][background] · [评测协议 §4.1][results]

**切入角度**　同一份带噪动作可以分别查询“这段要做什么”“参考怎么动”“上一段怎样收尾”。三类条件各有入口，使模型能够单独调节风格强度或历史影响。[式 1–4][model]

**核心 idea**　让预训练去噪主干保留生成动作的能力，在其编码块加入条件修正。上一段末尾被编码成有限长度的历史，在下一段各个去噪步骤上发挥不同强度的作用。训练后期让模型练习接续自己生成的历史。[式 4–9][rollout]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

一个片段有两条时间轴。外层按用户给出的顺序处理动作片段，内层将当前片段从噪声逐步还原为动作。首段使用文本与可选参考风格，后续每段另接收上一段最后若干帧。[图 3][model] · [式 5–6][rollout]

<figure class="reading-figure"><a href="/paper-notes/mocodiff/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/mocodiff/architecture.svg" alt="文本、参考动作和前段末十帧分别编码为注意力的键和值，带噪动作产生查询；三路残差注入冻结的 U-Net，当前段结束时把尾帧回送给下一段。下方是训练时真实历史与模型历史的替换安排。" /></a><figcaption>按原文图 3–4、式 4–8 与补充表 8 重绘。蓝、黄、绿三列分别追踪文本、风格与历史。实线表示推理数据流，右侧折线只在生成完一段后走一次。虚线下方单列训练过程。点击可查看大图。</figcaption></figure>

### 关键设计

1. **三种条件分别编码，当前动作主动查询。** 文本通过冻结的 CLIP 及文本层，参考动作通过冻结的 MotionCLIP 编码器及投影，历史通过可学习编码器汇集前段尾帧。三种条件都映射为 256 维特征。式 2–3 先做归一化，再让当前带噪动作特征产生查询 Q，各条件分别产生自己的键 K 和值 V。因而同样的“上楼”文本能配不同风格，从风格示范中读取的特征也会受当前动作状态影响。[图 3、式 1–3][model] · [补充表 8][supp]

2. **在冻结的 U-Net 编码块内加回三份残差。** 语义控制器 SIMC 引导内容，风格控制器 STIMC 调节姿态和节奏，时序控制器 TIMC 注入历史修正。式 4 把三份输出相加回当前动作特征，历史项还乘以屏蔽过期信息的掩码。作者把语义和风格分别解释为偏重低频整体运动与高频局部细节；文中没有显式傅里叶分频操作。分支仍在同一特征空间中相遇，彼此会产生取舍。[式 4 与三类控制器][model] · [消融表 4][diagnostic]

3. **每一段都有固定的历史，但历史的权重随去噪过程变化。** 第 i 段只取第 i−1 段最后 k 帧，默认 k＝10；首段省去这条支路。TIMC 在当前片段的去噪过程中反复读取这段历史。按补充材料的采样步骤编号，前 10 步历史强度为 1，第 10 到 20 步之间线性降至 0，从第 20 步起关闭历史影响。这样先让起始动态接住前一段，再给新文本和局部细节更多调整空间。[式 5–6][rollout] · [补充 §2.2、表 2][supp]

4. **给风格强度留出独立的推理参数。** 作者用无分类器引导（CFG）调整风格强度 λ，并在训练中按一定概率丢弃风格条件，所选配置为丢弃概率 0.25、λ＝1.0。它与历史调度 λₕ(t) 作用在不同位置。设置风格强度提供了可操作的调节手段，却没有定义“当风格与文本冲突，哪个身体部位优先”的硬规则。[正文表 4][diagnostic] · [补充 §2.2、§2.4][supp]

### 一个完整例子

图 1 有一条多段指令，从“走路＋飞机风格”开始，经由无指定风格的翻滚，接到“上楼＋僵尸风格”，后面还有下楼和坐下。以下跟踪前三段，说明它们之间实际传了什么。[原文图 1][first]

| 时刻 | 输入、内部变化与输出 |
|---|---|
| 走路 | 文本提供走路语义，一段张开双臂的风格示范提供姿态线索。当前片段从噪声出发，首段没有前一段历史。 |
| 切换到翻滚 | 文本改为翻滚，风格条件留空。刚生成的走路末十帧被送入历史编码器，让模型在开始翻滚时读到之前的姿态和移动趋势。 |
| 切换到上楼 | 改用上楼文本与僵尸风格参考。历史来自刚刚生成的翻滚片段，因此即使回到相同的风格强度，人物起身时的姿态仍取决于上一段。 |
| 查看结果 | 解码得到连续的人体动作序列。可以检验接缝有没有突然加速、步态是否像示范。论文没有提供楼梯网格或指定每只脚的着地点，脚底是否踏中某个真实台阶要另行验证。 |

### 训练与推理

文本与动作数据来自 HumanML3D 和 BABEL，100Style 提供提取风格特征的示范。前 30% 训练步骤使用真实历史，接下来 50% 将使用模型历史的概率从 0 线性提高到 1，最后 20% 完全使用模型历史。更新历史缓冲时取参数滑动平均模型的预测。损失由动作重建、时间平滑与动态变化三项组成。默认冻结 U-Net；风格和历史控制路径可学习，图 3 将语义交叉注意力标为冻结。附录架构表给出的 U-Net 输入、输出均为每帧 263 维的动作特征。[§3.2–3.3][rollout] · [架构表 8][supp]

论文报告批量 64、8,000 次迭代，在单张 RTX 3090 上约 2 小时。这一配置对应论文报告的训练过程；CLIP、MotionCLIP 和预训练主干的取得成本需另计。推理时可替换各段的文本和参考样例，上一段的预测会成为后续条件。[§4.1][results] · [官方仓库快照][repo]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

**长序列同时换内容与风格。** 随机配对 HumanML3D 的文本和 100Style 的参考动作，后续段评估 60 帧过渡。下表摘录正文表 1 的均值。SRA 是预训练分类器识别参考风格的准确率；R-Top-3 衡量文本与动作检索；FID 分别在风格生成和过渡两组中报告。PJ 衡量局部突变，目标是接近真实动作，AUJ 衡量累积运动突变。作者为原本只做风格化的基线加上历史，为长序列基线增加风格控制，并重新训练相关版本。[原表 1][results] · [基线改造 §4.2][diagnostic] · [补充材料][supp]

| 方法 | SRA ↑ | 风格生成 FID ↓ | R-Top-3 ↑ | 过渡 FID ↓ | PJ → 真实 | AUJ ↓ |
|---|---:|---:|---:|---:|---:|---:|
| 真实动作 | 100.00 | 0.00 | 0.768 | 0.00 | 0.04 | 0.08 |
| AutoMDM＋PersonaBooth | 14.33 | 6.45 | 0.473 | 10.83 | 0.74 | 2.71 |
| AutoMLD＋SMooDi | 19.28 | **2.24** | 0.537 | **4.25** | 0.33 | 2.04 |
| AutoMLD＋MCM LDM | 18.42 | 7.34 | 0.444 | 11.59 | 0.83 | 3.95 |
| ControlNet＋FlowMDM | 9.01 | 3.93 | 0.552 | 7.38 | 0.45 | 1.89 |
| CAMDM | 11.82 | 5.48 | 0.315 | 9.96 | 0.71 | 1.99 |
| MoCoDiff | **26.37** | 5.95 | **0.564** | 8.03 | **0.27** | **1.58** |

**单个动作与生成速度。** 正文表 2 单独考察风格控制，下面节选单动作的两个直接对照。另在表 3 的效率评测中，MoCoDiff 为 **136.89 FPS、每帧 7.31 毫秒、每个动作 0.72 秒**；最快的改造基线 AutoMLD＋MCM LDM 为 28.57 FPS、35.13 毫秒和 3.57 秒。按 FPS 约快 4.8 倍。这是分段生成的吞吐量，论文未给出实时交互从用户发出新指令到看到第一帧的延迟。[原表 2–3][results]

| 单动作方法 | FID ↓ | R-Top-3 ↑ | SRA ↑ |
|---|---:|---:|---:|
| PersonaBooth | 5.98 | 0.492 | 16.75 |
| SMooDi | **1.12** | **0.615** | 20.65 |
| MoCoDiff（风格分支） | 5.56 | 0.581 | **27.21** |

### 消融实验

**自回归、控制器与冻结位置。** 正文表 5 保持同一评测口径，分别取消分段自回归、用 ControlNet 替代 IMC、解冻 U-Net，以及允许在编码块以外注入条件。以下为均值。[原表 5][ablation]

| 设置 | FID ↓ | R-Top-3 ↑ | SRA ↑ | AUJ ↓ |
|---|---:|---:|---:|---:|
| 取消受控自回归扩散 | 6.48 | 0.507 | 25.69 | 2.96 |
| 用 ControlNet 替代 IMC | 7.50 | 0.431 | 15.38 | 2.48 |
| 解冻 U-Net | 18.42 | 0.281 | 27.15 | 1.85 |
| 放宽注入位置 | 16.56 | 0.273 | 29.46 | 1.79 |
| 完整配置 | **5.95** | **0.564** | 26.37 | **1.58** |

- **历史多长、多强？** 图 8 将窗口从 5 帧增至 10 帧时，AUJ 下降，窗口继续扩大后回升，作者选 10 帧。补充表 2 中，关闭历史、全程强历史、全程弱历史、逐步退火的 AUJ 依次为 6.96、2.05、1.70、1.58。[原图 8][ablation] · [补充表 2][supp]
- **风格更强会牺牲什么？** 正文表 4 将 λ 从 0.5 调到 1.0、1.5，SRA 从 7.82 升至 27.21、32.15，但 R-Top-3 从 0.722 降至 0.581、0.347。λ＝1.0 是作者选定的折中值，最高风格识别率出现在 1.5。[原表 4][diagnostic]
- **风格编码器本身有贡献吗？** 补充表 5 用取消 CLIP 对齐训练的自编码器替换 MotionCLIP，SRA 从 26.37 降到 23.21，R-Top-3 从 0.564 降到 0.548。[补充表 5][supp]

### 关键发现

1. **继承历史，最直接改善的是接缝。** 去掉受控自回归后，SRA 从 26.37 只降至 25.69，AUJ 却从 1.58 升至 2.96。图 7 还按段追踪了连续生成 32 个片段时的 SRA 和 AUJ；这种测试观察的是各段分数的稳定程度。[原表 5][ablation] · [原图 7][diagnostic]
2. **风格容易辨认与整体动作逼真有不同排序。** 长序列中 MoCoDiff 的风格识别和接缝指标领先，AutoMLD＋SMooDi 的两项 FID 更低；单动作条件下，SMooDi 的 FID 和文本检索也更好。补充材料的 40 人评测覆盖 6 组长序列，MoCoDiff 在 5 分量表中的内容保持、风格表现、流畅性均值分别为 4.27、4.49、4.38。[原表 1–2][results] · [补充表 6][supp]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **让接缝进入生成过程。** 每一步去噪都可以查询此前怎样收尾。附录的直接对照把历史改用 AdaIN 注入，AUJ 由 1.58 升至 2.31。这比只看一段流畅的演示更能说明“历史怎样进模型”会影响输出。[补充表 1][supp]
- **分开操作的旋钮能暴露冲突。** 保持动作指令和风格示范不变，仅增大 λ，就能观察风格分类和文本检索的反向变化。如果用它做角色创作，可以同时看两项指标来判断哪一侧被牺牲。[正文表 4][diagnostic]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **局部连续与全局计划的距离。** 固定 10 帧历史可以延续近期姿态，却无法直接记住几十段前的人物位置或尚未执行的事件。作者在结论中也指出超长展开可能继续积累误差。[§5][ablation]
- **风格控制到身体哪一处仍不确定。** 三个控制器读取不同输入，但训练没有提供逐关节冲突裁决；SRA、R-Top-3 和 jerk 指标也不直接测指定手脚的到点误差、接触或足底打滑。若目标是某一帧抓住扶手，还需给出物体位置、接触约束和逐帧评估。[方法式 4][model] · [实验指标][results]
- **迁移到另一套输入表示要付代价。** 附录的 CMU 训练、Xia 测试改用 BVH 动作和预训练 VAE 风格编码器。与 AdaIN＋Motion Puzzle 相比，MoCoDiff 的 AUJ 为 0.69 对 2.41，但 SRA 为 21.11 对 27.41。主实验的风格优势没有直接复现在这个设置里。[补充表 7][supp]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **SMooDi** 也是从文本与风格参考生成动作，正文表 2 直接比较其单段结果。表 1 的 AutoMLD＋SMooDi 增加了作者构建并训练的历史通路；对照两张表时要区分这两个版本。[SMooDi 独立解读][smoodi] · [正文表 1–2][results]
- **DART** 为连续动作片段提供自回归生成框架。MoCoDiff 明确借鉴其逐步引入模型预测历史的训练思路，又在下一段的每一步去噪里用 TIMC 调整历史影响。[DART 独立解读][dart] · [式 7–8][rollout]
- **COMET** 同样研究长时控制，但用户能为选定关节指定空间目标，适合问“手离要碰的位置还有多远”。MoCoDiff 主要接收文本、风格示范和前段尾帧，实验回答的是“这段动作像不像所选风格，接到下一段顺不顺”。两篇可以放在一起区分空间命中与运动连续性。[COMET 独立解读](/blog/wacv2026-comet/) · [COMET 论文][comet] · [MoCoDiff 评测][results]
- **一个可延伸的检验。** 固定一份内容文本，选择会改变同一条手臂姿态的两种风格，分别测手部轨迹、文本动作完成度与接缝 jerk。这样能进一步定位“提高风格强度为何损伤内容”；这项局部干预是从原表 4 引出的设想。[风格强度对照][diagnostic]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- **正式原文**　[CVPR 会议记录与作者列表][cvf] · [正文 HTML 阅读器][html] · [正文 PDF][pdf] · [补充论文与演示视频][supp]
- **复核入口**　[官方仓库固定版本][repo] · [正文方法图 3、式 4][model] · [主结果表 1–3][results] · [消融表 5][ablation]

</div>

[html]: /paper-notes/mocodiff/fulltext/
[supphtml]: /paper-notes/mocodiff/fulltext/?part=supplement
[repo]: https://github.com/Xuehan0530/MoCoDiff-code/tree/210dfffa5ca8d8bc0857e6b8640d6a19386d0436
[pr]: https://github.com/Xuehan0530/MoCoDiff-code/pull/1
[cvf]: https://openaccess.thecvf.com/content/CVPR2026/html/Song_MoCoDiff_A_Controllable_Autoregressive_Diffusion_Model_for_Expressive_Motion_Generation_CVPR_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/Song_MoCoDiff_A_Controllable_Autoregressive_Diffusion_Model_for_Expressive_Motion_Generation_CVPR_2026_paper.pdf
[supp]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Song_MoCoDiff_A_Controllable_CVPR_2026_supplemental.zip
[first]: https://openaccess.thecvf.com/content/CVPR2026/papers/Song_MoCoDiff_A_Controllable_Autoregressive_Diffusion_Model_for_Expressive_Motion_Generation_CVPR_2026_paper.pdf#page=1
[background]: https://openaccess.thecvf.com/content/CVPR2026/papers/Song_MoCoDiff_A_Controllable_Autoregressive_Diffusion_Model_for_Expressive_Motion_Generation_CVPR_2026_paper.pdf#page=3
[model]: https://openaccess.thecvf.com/content/CVPR2026/papers/Song_MoCoDiff_A_Controllable_Autoregressive_Diffusion_Model_for_Expressive_Motion_Generation_CVPR_2026_paper.pdf#page=4
[rollout]: https://openaccess.thecvf.com/content/CVPR2026/papers/Song_MoCoDiff_A_Controllable_Autoregressive_Diffusion_Model_for_Expressive_Motion_Generation_CVPR_2026_paper.pdf#page=5
[results]: https://openaccess.thecvf.com/content/CVPR2026/papers/Song_MoCoDiff_A_Controllable_Autoregressive_Diffusion_Model_for_Expressive_Motion_Generation_CVPR_2026_paper.pdf#page=6
[diagnostic]: https://openaccess.thecvf.com/content/CVPR2026/papers/Song_MoCoDiff_A_Controllable_Autoregressive_Diffusion_Model_for_Expressive_Motion_Generation_CVPR_2026_paper.pdf#page=7
[ablation]: https://openaccess.thecvf.com/content/CVPR2026/papers/Song_MoCoDiff_A_Controllable_Autoregressive_Diffusion_Model_for_Expressive_Motion_Generation_CVPR_2026_paper.pdf#page=8
[smoodi]: /blog/eccv2024-smoodi/
[dart]: /blog/iclr2025-dart/
[comet]: https://openaccess.thecvf.com/content/WACV2026/html/Lee_Controllable_Long-term_Motion_Generation_with_Extended_Joint_Targets_WACV_2026_paper.html
