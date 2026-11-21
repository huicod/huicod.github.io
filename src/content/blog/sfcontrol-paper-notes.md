---
title: "[ICCV2025] SFControl：从稀疏关节点生成全身动作"
description: "解读 Motion Synthesis with Sparse and Flexible Keyjoint Control。看清指定某一帧的位置和只画一条有向路径怎样进入两阶段扩散，并对照厘米级控制误差、到达任务及采样时间。"
pubDate: "2026-11-21T20:59:27+08:00"
badge: "Paper"
tags: ["SFControl", "Controllable Motion Generation", "Keyjoint Control", "Trajectory Control", "Diffusion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[HTML 阅读版（含补充材料）][html] · [ICCV 原文 PDF][pdf] · [作者演示][project] · [代码][code]

<details class="paper-meta"><summary>论文信息与阅读范围 · ICCV 2025</summary>

*Motion Synthesis with Sparse and Flexible Keyjoint Control*，简称 **SFControl**。作者为首尔大学的 Inwoo Hwang、Jinseok Bae、Donggeun Lim 和 Young Min Kim。正式发表于 ICCV 2025，第 13203–13213 页。本文依据会议论文和 2025 年 7 月 25 日的 arXiv v2，后者同时收录补充材料第 6–8 节。研究方向为可控人体动作生成、空间轨迹约束与两阶段扩散。[会议论文][pdf] · [arXiv 记录][abstract]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

动画师可以指定“第 30 帧右手到这里”，也可以只画出“这段时间右手要走过的曲线”。SFControl 先根据这些要求生成骨盆、头、双手和双脚的逐帧轨迹，再以六个关节的轨迹为条件补出肘、肩、膝等部位怎样配合。[原文图 2][fig2]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文本能描述“跛着往前走”，全身关键帧能规定某一时刻整个人的姿态，关节轨迹还能规定手或骨盆经过的位置。这三种输入向动画师索取的信息量不同。[原文 §2][related]

**现有痛点**　做一个伸手动作时，动画师也许只知道目标在哪，尚未决定肘怎么弯、手在第几帧加速。如果接口要求先提交一条逐帧定时的轨迹，大量本来希望模型完成的工作又回到了人手里。[原文 §1][intro]

**核心矛盾**　少量已知坐标在整段全身动作中只占很小比例，却可能直接决定任务是否完成。要让右手够到目标，肩膀、躯干和支撑腿往往都得调整。整段动作看起来自然，也可能刚好在关键位置上偏了几厘米。[原文 §3][method] · [表 2][t2]

**本文目标**　用一个动作生成框架处理几类不同要求，包括已知时间的局部位置、给定起始姿态的末帧到达、手与头靠近等几何关系，以及只有时间窗口的空间路径。作者分别评估指定位置的误差、约束目标、动作分布与滑步。[原文 §4][exp]

**切入角度**　许多要求都能先在六个关节上表达。伸手需要知道手的位置，伸手碰头需要知道手和头的相对位置。这些量在世界坐标里可以直接测量，也比逐帧指定全身姿态容易编辑。[原文动作表示][repr]

**核心 idea**　把六个关节的完整轨迹设为两阶段之间的接口。有时间标注的坐标直接写进第一阶段的采样输入，只有几何要求时，通过优化采样噪声来调轨迹。两种输入最终都得到同一种稠密轨迹，交给全身模型完成动作。[原文图 2][fig2]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

第一阶段处理长度为 <code>N</code> 的动作，每帧输出六个关节的全局三维位置及根部绕竖直轴的朝向，合计 <code>6 × 3 + 1 = 19</code> 个数。全身模型使用每帧 263 维的 HumanML3D 动作特征，并将根部信息改为全局表示。两个模型衔接时，代码保留全局根部信息，将其余五个关键关节的位置转换到相对根部的坐标，再写入全身特征的对应通道。[原文 §3 动作表示][repr] · [两阶段之间的坐标转换][bridge]

<figure class="reading-figure"><a href="/paper-notes/sfcontrol/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/sfcontrol/architecture.svg" alt="SFControl 架构。显式坐标和掩码走回填分支，隐式函数走噪声优化分支，得到六关节稠密轨迹，经坐标转换送入全身动作扩散模型。" loading="lazy" /></a><figcaption>本站据原文图 2 和第 3 节绘制，点击可放大。先按已知条件选择一条输入分支，再沿六关节轨迹读到全身输出。训练全身模型时读取动捕轨迹，生成时读取第一阶段的预测轨迹。</figcaption></figure>

### 关键设计

1. **显式约束用掩码区分“已指定”和“待生成”。** 指定右手在某一帧的位置时，用掩码把该帧相应的坐标标为已知。在每一步去噪之前，模型把这些位替换成干净的指定值，其余位保留当前带噪值，再把掩码拼接到输入上。于是右手坐标恰好为零也不会与“未给右手坐标”混淆。训练时对真实动作随机选择时刻和关节，模型学习从稀疏条件还原完整轨迹；推理时换成用户给的掩码，还可带入文本条件。[原文 §3.1.1][explicit]

2. **隐式约束直接测量已生成轨迹的好坏。** “手靠近头”可以用两者间距写成可微目标。先采样一条轨迹，算出目标值，沿着从轨迹到扩散噪声的计算过程反传，迭代更新噪声并重新生成。优化集中在关键关节模型，所用网络沿用显式控制训练的权重。接入新条件的前提是能定义在这组关节上的可微函数。[原文 §3.1.2][implicit]

3. **让路径有方向、有长度，也允许变速。** 对一个指定的关节，用户给出起止时刻和一条有序空间曲线。算法截出生成轨迹对应的时间窗口，计算累计行程，并用可微三次样条按弧长重新采样。目标曲线也按弧长取相同数量的点：比较两条曲线各自走到同一比例时的位置，再加上总长度差的惩罚。这保留了起点、终点和沿途顺序，把“每一帧走多快”留给生成器。若手从终点反方向画回起点，比较的位置序列一般会改变。[原文式 1][arc] · [原文图 4][fig4]

4. **全身模型学习怎样跟随这组轨迹。** 训练时往全身动作加噪，再把对应关键关节分量替换为真实轨迹，由全身去噪器预测干净动作。推理时，相同位置换成第一阶段给出的完整轨迹。显式回填发生在模型的输入，最终输出与输入轨迹的贴合程度另有专门测量；表 4 给出的两种来源的平均距离都大于零。[原文 §3.2][completion] · [表 4][t4]

### 一个完整例子

假设动画师想让角色在一段时间内用右手沿 S 形曲线划过。原文图 4 展示了无逐帧时标的轨迹，补充图 6 展示了手工指定的 S 形等路径。下面把这两个设计放进一个教学例子。[原文图 4][fig4] · [补充图 6][fig6]

1. **给输入。** 假设片段共 81 帧，要让右手在第 20 至 60 帧之间，从曲线的一端走到另一端。输入含关节身份、起止帧和按行进方向排列的三维点。动画师可以同时给出文字描述。中间任一帧的手腕坐标都还没有指定。
2. **求六关节轨迹。** 从关键关节模型的输出 <code>81 × 19</code> 中取出该窗口的右手轨迹，得到 <code>41 × 3</code> 个坐标。用弧长对齐的目标函数更新扩散噪声。若手起初动得慢、随后加速，只要走过的空间路径与长度相符，就不必把速度调整成匀速。[原文式 1][arc]

<figure class="reading-figure"><a href="/paper-notes/sfcontrol/arc-length.svg" target="_blank" rel="noopener"><img src="/paper-notes/sfcontrol/arc-length.svg" alt="同一条有向路径在五个等时间隔上的两套位置，与按等弧长重新对齐后的示意。" loading="lazy" /></a><figcaption>本站教学示意，可点击放大。同样五个等间隔时刻，一种执行已走完路径的 0%、10%、40%、85%、100%，另一种为 0%、25%、50%、75%、100%。把两条曲线都按等弧长取点，就能比较同一进度的空间位置。百分比与帧数均为教学设定。</figcaption></figure>

3. **补成全身并验收。** 将 <code>81 × 19</code> 的预测转换坐标，把关节分量写入第二个模型的采样输入，最后得到 <code>81 × 263</code> 的连续全身动作。验收时可以从成品提取右手轨迹，分别检查空间路径偏差和开始、结束时刻。若导演还要求手在第 40 帧正好碰到拐点，这又是一条带时间的位置条件；单用弧长目标并不会指定这个到达时刻。[原文显式控制][explicit] · [原文全身补全][completion]

### 训练与推理

两阶段都用时序 U-Net 预测干净的动作或轨迹，训练扩散步数均为 50，批量均为 64，通道宽度分别为 128、512。作者报告在单张 RTX 2080 上训练，采用 AdamW、学习率 0.0001，推理的无分类器引导权重为 2.5。论文提供了采样时间，未列训练总时长或 GPU 小时。[原文实验设置][exp] · [补充表 8][t8]

目标到达另有专门训练配置。其掩码保留起始姿态与末帧目标关节，网络还读取任务动作标签和由身体尺寸得到的连续体形编码。伸手、攀爬、坐下三项合训；伸手有 2,510 段用于训练，攀爬和坐下分别有 156 段和 160 段。这里与 HumanML3D 的自由文本加稀疏轨迹实验使用了不同的训练输入。[原文图 3][fig3] · [补充 §6.3][goals]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**HumanML3D 的稀疏关节控制。** 在 20 FPS 动作中每隔 30 帧取一次条件，每次从六个关节里随机选 1–5 个，平均选中 3 个。以全部 22 个关节和所有帧为分母，标出位置的关节—帧比例约为 <code>(1/30) × (6/22) × (1/2) = 0.4545%</code>。观察到骨盆时，公开代码还会给出根部朝向。正文第 4.1 节与表 1 写 0.454%，结论段写为 0.0453%，下表采用可从采样设置复算的前者。Diversity 以接近真实数据为佳。[原文表 1][t1] · [掩码采样][maskcode] · [骨盆对应的观测通道](https://github.com/woo0818/SFControl/blob/a95b2382f850d008f2cdd2a8005167733d5768b4/utils/editing_util.py#L50-L59) · [结论段][conclusion]

| 方法 | FID ↓ | 控制误差（米）↓ | 文本 R@3 ↑ | Diversity → 9.503 | 滑步比例 ↓ |
|---|---:|---:|---:|---:|---:|
| 真实动作 | 0.002 | 0.000 | 0.797 | 9.503 | 0.000 |
| CondMDI | 0.498 | 0.507 | 0.631 | 9.013 | 0.099 |
| OmniControl | 0.689 | 0.111 | **0.689** | 9.381 | 0.091 |
| TLControl | 4.637 | 0.128 | 0.473 | 8.078 | **0.058** |
| MotionLCM | 1.013 | 0.418 | 0.676 | 8.722 | 0.141 |
| SFControl，DDIM 5 步 | 0.338 | 0.037 | 0.655 | 9.356 | 0.065 |
| SFControl，DDIM 10 步 | 0.254 | 0.037 | 0.673 | 9.621 | 0.063 |
| SFControl，DDPM 50 步 | **0.224** | **0.036** | 0.673 | 9.674 | 0.061 |

控制误差是生成关节到指定空间点的欧氏距离。表中 0.036 米即 **3.6 厘米**。作者使用 OmniControl、TLControl、MotionLCM 和 DNO 的官方权重评测；为支持任意关节条件，用全局关节位置表示重新训练了 CondMDI。[原表 1][t1] · [补充 §6.2][baselines]

**从起始姿态到指定位置。** 伸手约束右手，攀爬约束双手和双脚，坐下约束末帧双手。为便于看不同任务的难度，下表把原表 2 的单阶段与双阶段结果并排，距离均以米计。[原表 2][t2]

| 任务 | 单阶段终点误差 ↓ | 两阶段终点误差 ↓ | 单阶段起姿误差 ↓ | 两阶段起姿误差 ↓ |
|---|---:|---:|---:|---:|
| 全部 | 0.206 | 0.093 | 0.116 | 0.065 |
| 伸手 | 0.141 | 0.054 | 0.061 | 0.043 |
| 攀爬 | 0.529 | 0.288 | 0.409 | 0.185 |
| 坐下 | 0.327 | 0.156 | 0.126 | 0.064 |

### 消融实验

**在哪里优化隐式约束。** 作者比较直接在全身模型上做扩散噪声优化的 DNO、自家的单阶段版本，以及只在关键关节阶段优化再补全的版本。每个场景随机评测 10 个样例。下表的 Constraint Error 由各任务的目标定义，原表未标统一单位，应在同一行内比较。[原表 3][t3]

| 任务 | DNO 约束误差 ↓ | 单阶段约束误差 ↓ | SFControl 约束误差 ↓ |
|---|---:|---:|---:|
| 狭窄区域行走 | 0.0101 | 0.0093 | 0.0084 |
| 手靠近头 | 0.0084 | 0.0093 | 0.0036 |
| 无逐帧时标的轨迹 | 0.0412 | 0.0581 | 0.0256 |

**强行给路径分配匀速时间。** 把目标路径等距取点，再给这些点分配等间隔时刻，改用显式输入，约束误差为 **0.4827**；改用弧长目标为 **0.0256**。这个对照检验了未知速度时两种建模选择的差别。[原表 3][t3]

**全身补全保留了多少轨迹精度。** 给第二阶段输入真实关键关节轨迹，原表报告最终输出相对该输入的平均偏差为 **0.0082 米**；换成第一阶段合成的轨迹，平均偏差为 **0.0115 米**。这里测“全身输出对阶段间轨迹”，不同于表 1 的“全身输出对用户目标”。核查源码时还发现，一处用于打印补全误差的代码只取五个非根关节，平方和中两次用了 x 分量，漏掉了 y。公开材料未说明表 4 是否由该段代码统计，以上保留原表数值。[原表 4][t4] · [官方代码的补全误差打印][diagnostic]

**减少采样步数。** 在主实验的 30 帧间隔下，DDPM 50 步、DDIM 10 步、DDIM 5 步的整段采样耗时分别是 **7.1、1.4、0.7 秒**。从 50 步改成 5 步，平均位置误差只由 3.6 增至 3.7 厘米，但 FID 从 0.224 增至 0.338。控制再稀疏到每 60 帧一次时，DDPM 50 步与 DDIM 5 步的 FID 分别为 0.263 和 0.658。[原表 5][t5] · [补充表 9][t9]

### 关键发现

1. **关节越稀疏，位置和动作分布都更难恢复。** 用相同 DDPM 配置，在抽中的时刻平均保留半数关键关节，间隔从每帧一次改为每 30、60 帧一次，位置误差依次为 1.9、3.6、4.4 厘米。文本匹配和滑步也值得分别看。主实验中 OmniControl 的文本 R@3 更高，TLControl 的滑步比例更低。[原表 6][t6] · [原表 1][t1]
2. **任务越接近真实接触，平均值越值得拆开看。** 三项目标到达的汇总终点误差为 9.3 厘米；单看伸手为 5.4 厘米，要求四肢协同的攀爬为 28.8 厘米。论文报告距离，没有给定“距离小于多少算抓到岩点”的成功率。[原表 2][t2]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把中间结果做成动画师能检查的量。** 六条世界坐标轨迹可以直接画出来。若手没有走对路线，可以先看第一阶段生成的手腕轨迹，再看补全后的全身动作偏移了多少。表 4 正好提供了后一个环节的独立测量。[原文图 2][fig2] · [原表 4][t4]
- **给用户留出有意义的自由度。** 已知“必须何时到达”时，用帧索引和位置最直接。只关心“按什么路线移动”时，起止窗口加有向曲线就足够表达意图，弧长损失让角色自己选择沿途的快慢。[原文图 4][fig4] · [式 1][arc]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **关节集合固定，约束也有几何范围。** 本文直接建模的是骨盆、头、两腕、两脚的轨迹。肘尖要贴墙、指尖要捏住物体、手掌要以某个朝向接触，都需要增加可表达的量及对应的检验。攀爬结果也没有测抓握稳定性、接触力或物理平衡。[原文动作表示][repr] · [原表 2][t2]
- **时间窗口内的速度是欠确定的。** 对希望变速的动画，这是优点；对需要卡音乐节拍、在特定瞬间触碰目标或保持接触若干帧的动画，还需提供相应的时序要求。项目中的变速动画和表 3 检验的是路径跟随。[原文 §4.2][implicitEval]
- **鲁棒性和运行速度有具体测试范围。** 表 7 在每 20 或 30 帧给出的骨盆位置上加入最多 5 厘米的噪声，后者的控制误差从 3.8 增至 4.3 厘米。表 5 的秒数是作者的动作采样用时，尚不能从中推定隐式优化每次交互的延迟。作者也将实时控制列为后续方向。[原表 7][t7] · [原表 5][t5] · [原文结论][conclusion]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **CondMDI（SIGGRAPH 2024）**　两者都通过随机掩码和已知分量回填学习接受不同条件。CondMDI 直接补整段动作；SFControl 先生成固定六个关键关节的稠密轨迹，再让第二个模型补全。对照表 1 时要计入 CondMDI 的重新训练设置。[CondMDI 原文][condmdi] · [SFControl 基线细节][baselines]
- **DNO（CVPR 2024）**　DNO 展示了如何通过目标函数反传来优化扩散噪声。SFControl 把这一步放到六关节轨迹生成器上，使同一个全身补全器可以接手“手靠近头”“穿过窄通道”等不同几何任务。[DNO 项目][dno] · [SFControl 原表 3][t3]
- **Multi-level Diffusion（CVPR 2026）**　本站此前在这篇后续工作的部分关节控制实验中提过 SFControl。若需求是两帧之间保留完整姿态，可看其全身关键帧与回填设计；若动画师只给某个关节的一条路径，可对照本篇的弧长约束。两篇论文的实验条件和数字需分开阅读。[本站 Multi-level Diffusion 解读](/blog/cvpr2026-multi-level-diffusion/)
- **启发**　做指向演示时，可以先决定“必须在说到某个词时指到屏幕某处”，还是“只需沿一条曲线扫过去”。前者可用带时间的腕部目标，后者可用路径和时间窗。两者都只落实到腕部；若真正关心指尖是否指向目标，还应测指尖、手指方向及目标几何关系。[原文显式接口][explicit] · [原文路径接口][arc]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 正式会议版与可翻译的全文，含正文、补充模型配置和采样消融。[ICCV 原文 PDF][pdf] · [arXiv v2 HTML][html] · [补充材料][supp]
- 动态结果覆盖稀疏条件、到达、手与头的关系和无逐帧时标的轨迹。作者仓库给出了两阶段 HumanML3D 训练命令，README 将全局坐标的数据转换脚本列为待发布，未列出预训练权重下载。本文数值取自论文，未重新训练或计时。[作者演示][project] · [官方仓库][code]

</div>

[html]: https://arxiv.org/html/2503.15557v2
[pdf]: https://openaccess.thecvf.com/content/ICCV2025/papers/Hwang_Motion_Synthesis_with_Sparse_and_Flexible_Keyjoint_Control_ICCV_2025_paper.pdf
[abstract]: https://arxiv.org/abs/2503.15557v2
[project]: https://inwoohwang.me/SFControl/
[code]: https://github.com/woo0818/SFControl
[bridge]: https://github.com/woo0818/SFControl/blob/a95b2382f850d008f2cdd2a8005167733d5768b4/data_loaders/humanml/motion_loaders/comp_v6_model_dataset_condmdi_twostage.py#L318-L347
[maskcode]: https://github.com/woo0818/SFControl/blob/a95b2382f850d008f2cdd2a8005167733d5768b4/utils/editing_util.py#L133-L152
[diagnostic]: https://github.com/woo0818/SFControl/blob/a95b2382f850d008f2cdd2a8005167733d5768b4/data_loaders/humanml/motion_loaders/comp_v6_model_dataset_condmdi_twostage.py#L386-L401
[intro]: https://arxiv.org/html/2503.15557v2#S1
[related]: https://arxiv.org/html/2503.15557v2#S2
[fig2]: https://arxiv.org/html/2503.15557v2#S2.F2
[method]: https://arxiv.org/html/2503.15557v2#S3
[repr]: https://arxiv.org/html/2503.15557v2#S3.SS0.SSS0.Px1
[explicit]: https://arxiv.org/html/2503.15557v2#S3.SS1.SSS1
[implicit]: https://arxiv.org/html/2503.15557v2#S3.SS1.SSS2
[arc]: https://arxiv.org/html/2503.15557v2#S3.SS1.SSS2.Px1
[completion]: https://arxiv.org/html/2503.15557v2#S3.SS2
[exp]: https://arxiv.org/html/2503.15557v2#S4
[t1]: https://arxiv.org/html/2503.15557v2#S4.T1
[t2]: https://arxiv.org/html/2503.15557v2#S4.T2
[t3]: https://arxiv.org/html/2503.15557v2#S4.T3
[t4]: https://arxiv.org/html/2503.15557v2#S4.T4
[t5]: https://arxiv.org/html/2503.15557v2#S4.T5
[t6]: https://arxiv.org/html/2503.15557v2#S4.T6
[t7]: https://arxiv.org/html/2503.15557v2#S4.T7
[fig3]: https://arxiv.org/html/2503.15557v2#S4.F3
[fig4]: https://arxiv.org/html/2503.15557v2#S4.F4
[implicitEval]: https://arxiv.org/html/2503.15557v2#S4.SS2
[conclusion]: https://arxiv.org/html/2503.15557v2#S5
[supp]: https://arxiv.org/html/2503.15557v2#S6
[t8]: https://arxiv.org/html/2503.15557v2#S6.T8
[baselines]: https://arxiv.org/html/2503.15557v2#S6.SS2
[goals]: https://arxiv.org/html/2503.15557v2#S6.SS3
[t9]: https://arxiv.org/html/2503.15557v2#S7.T9
[fig6]: https://arxiv.org/html/2503.15557v2#S8.F6
[condmdi]: https://arxiv.org/html/2405.11126v2
[dno]: https://korrawe.github.io/dno-project/
