---
title: "[CVPR2026] RoboPerform：同一台人形机器人怎样随音乐跳舞、随语音打手势？"
description: "解读 Do You Have Freestyle? Expressive Humanoid Locomotion via Audio Control。追踪 FineDance 与 BEAT2 的音频特征、六层适配器、固定任务提示及扩散学生策略怎样共同产生 G1 的关节目标，并区分动作检索、仿真跟踪和实机演示。"
pubDate: "2026-11-21"
badge: "Paper"
tags: ["RoboPerform", "Co-Speech Gesture", "Music-to-Dance", "Humanoid Control", "Audio-Motion Alignment", "Diffusion Policy", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 阅读版][html] · [CVPR 原文 PDF][pdf] · [含部署细节的附录 HTML][appendix] · [作者项目与实机视频][project] · [代码][code]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026 Highlight</summary>

*Do You Have Freestyle? Expressive Humanoid Locomotion via Audio Control*，方法名为 **RoboPerform**。CVPR 版本署名为 Zhe Li、Cheng Chi、Yangyang Wei、Boan Zhu、Tao Huang、Zhenguo Sun、Yibo Peng、Pengwei Wang、Zhongyuan Wang、Fangzhou Liu、Chang Xu、Shanghang Zhang。主实验按 CVPR 论文及 arXiv v3 核对，实机频率、动作维度和分步耗时取自带附录的 v2。下文的数值来自作者实验，公开部署程序仅做静态核对。[会议论文][pdf] · [版本记录][record] · [项目页][project]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

RoboPerform 给人形机器人两种信息：固定的动作条件告诉它现在要跳舞还是演讲，随时间变化的音频条件告诉它节奏如何变化。一个在仿真里向动作跟踪教师学习的扩散策略，把这两者和机器人自身状态转换成下一步关节目标。[原文图 2][method]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　给角色配舞、给说话人配手势，都能先生成一段人体骨架。换成有重量、会跌倒的机器人，还需要把这段动作重定向到机器人，并由控制策略跟踪。[原文 §1][html]

**现有痛点**　例如鼓点处的一次侧步。动画可以直接把脚放到目标位置，机器人此时还得有足够的支撑。前端生成、重定向、跟踪三个步骤各自优化，一处误差就可能造成最后的落脚既慢又偏。[原文 §1][html]

**核心矛盾**　音频中的重拍或重音能提示“何时增强动作”，却很少唯一确定“哪个关节转多少”。机器人又必须在每个控制周期交出一个具体可执行的动作。[原文 §3.4][student]

**本文目标**　让 Unitree G1 在音乐和演讲两个任务中依据声音调整全身运动，同时维持平衡，并减少部署时逐段生成人体姿势、再做重定向的计算。[会议论文][pdf]

**切入角度**　同一首曲子允许多套舞步，但舞步与曲子的拍点之间仍有关联。可以先让音频找到同一片段的动作表示，只把适合当前机器人状态的具体关节目标交给策略决定。[原文 §3.3][align]

**核心 idea**　用配对录音和动作训练音频适配器，用仿真参考动作训练教师，再让能看到音频条件的学生模仿教师。部署后，每一步由学生读取当下可用的条件并生成控制量。[原文图 2][method]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

三条路径要分开看。配对音频与动捕教会适配器什么声音常伴随什么动作。配有参考轨迹的仿真教会教师怎样保持平衡、跟踪姿态。在线学生继承教师的控制能力，并在每一步接收音频风格、固定任务内容和自己的状态。三条路径在下面的图中汇合。[原文 §3][method] · [含部署细节的附录][appendix]

<figure class="reading-figure"><a href="/paper-notes/roboperform/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/roboperform/architecture.svg" alt="RoboPerform 的训练和执行流程。配对动作监督六层音频适配器，强化学习教师监督扩散学生。执行时学生融合音频风格、任务内容与本体状态，输出关节目标并接收状态反馈。" loading="lazy" /></a><figcaption>本站依据原文图 2、图 3 和附录重绘。先读上方的声音与动作配对，再读教师如何给学生示范，最后沿下方闭环看机器人实际收到什么。虚线表示训练监督，实线表示特征或控制量。点击可放大。</figcaption></figure>

### 关键设计

1. **配对动作直接监督六层音频适配器。** 音乐端使用 FineDance 随数据提供的 librosa 特征，作者明确没有训练音乐前端。语音端采用 EMAGE 的时序卷积网络学习 BEAT2 的语音表示，正文未交代这一前端逐层冻结或更新的清单。方法中明确指定的对齐模块是带时间注意力的六层 Transformer。它接收音频特征，把同片段的动作 VAE 表示作为正例，把批内其他片段作为负例，以 InfoNCE 学习匹配。动作目标由预训练 VAE 提取，论文给出的动作 VAE 配置为九层、四头。适配器输出仍是一串连续特征。[原文 §3.3][align] · [实现细节][setup]

2. **教师从“多一种条件能改进什么”学习跟踪。** 四个 MLP 专家逐级获得更多条件，从零输入、机器人本体状态一直到含参考动作的完整观测。门控网络给第一位专家的输出及相邻专家的动作差值分配权重。这样，看到参考姿态后作出的修正可以与基本平衡动作分开加权。教师在仿真里用 PPO 训练，可以接触部署时没有的参考信息。[原文 §3.2][experts] · [附录 §6][appendix]

3. **内容指定任务，声音调节执行。** 作者用 LaMP-T2M 从固定的“跳舞”或“演讲”提示取得任务内容表示。学生用它与本体状态限定动作，再把已经对齐的音频特征注入扩散网络的多个层。演讲模式中的固定提示不随逐句转录改变，因此“在重音处打拍子”和“听到某个名词就指向对应物体”需要不同的验证。[原文 §3.4][student] · [固定提示消融][content]

4. **学生在自己实际到达的状态上请教师示范。** 训练时先让学生在仿真中行动，再询问教师在该状态应输出的关节目标，用这个目标监督动作去噪。这样，学生练到的还包括它自己走偏后的状态。生成器使用四层 MLP 和 AdaLN 条件注入，部署时用两步 DDIM 得到一个控制周期的 23 维目标关节位置。下一步继续接收机器人状态反馈。[原文 §3.4][student] · [附录 §6][appendix]

### 一个完整例子

设想让 G1 给一段有重音的演讲配动作。以下是按论文接口推演的例子。

1. **选择任务。** 固定的演讲提示产生内容条件。无须把整段演讲逐句改写成动作指令。
2. **取得声音条件。** 语音时序特征通过适配器。训练时，同一录音片段的真实动作给过它正例。推理时，无需为这段新录音先找出真人示范。
3. **生成并反馈。** 学生结合最近的本体状态、演讲内容条件和当前音频风格，在动作空间去噪，给出下一步的关节目标。重音附近可以出现摆臂，具体选哪只手、指向谁，当前接口没有提供相应目标坐标。[原文 §3.3–3.4][align] · [附录部署][deploy]

公开实机脚本还能说明一个复用细节：它通过动作编号和时间步取出音乐特征与内容向量，分别写入观测中的 256 和 64 个位置。这个入口足以检查特征怎样进入策略。要验证任意现场麦克风输入，还需把音频采集、编码和时间同步也接起来测试。[作者部署源码][g1]

### 训练与推理

作者使用 BEAT2 的语音与动作（30 名说话人、76 小时）和 FineDance 的音乐与舞蹈（7.7 小时）。动作按 30 FPS，音频和动作同步切为 10 秒段，所以一个训练片段约含 300 帧。训练教师时用经过筛选、重定向的参考动作。部署学生时这条参考轨迹可以撤掉。附录报告 G1 上的高层控制以 50 Hz 发送目标，低层控制以 500 Hz 执行。[原文 §4.1][setup] · [附录部署][deploy]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**先问声音有没有找对动作。** 原表 1 给出配对片段检索结果。R@k 是正确动作出现在前 k 个候选的百分比，MM-Dist 是匹配音频与动作的表示距离。[原表 1][t1]

| 音频查询 → 动作 | R@1 ↑ | R@2 ↑ | R@3 ↑ | MM-Dist ↓ |
|---|---:|---:|---:|---:|
| FineDance 音乐 | 66.7 | 78.8 | 83.5 | 1.154 |
| BEAT2 语音 | 64.6 | 76.5 | 82.1 | 1.232 |

**再问机器人能否跟得上。** 原表 2 比较两种仿真器上的同一任务。基线先用 EMAGE 或 FineNet 生成人体动作，再重定向并跟踪。下表抽取成功率及关节误差；关节误差单位按作者附录为弧度。作者以跟踪过程中是否失稳、平均轨迹偏差是否越过 0.5 米等条件判定成功。[原表 2][t2] · [指标定义][metrics]

| 数据与策略 | IsaacGym 成功率 ↑ | IsaacGym 关节误差 ↓ | MuJoCo 成功率 ↑ | MuJoCo 关节误差 ↓ |
|---|---:|---:|---:|---:|
| BEAT2 · 先生成再跟踪 | 0.98 | 0.07 | 0.94 | 0.13 |
| BEAT2 · RoboPerform | 0.99 | 0.05 | 0.96 | 0.10 |
| FineDance · 先生成再跟踪 | 0.88 | 0.24 | 0.61 | 0.32 |
| FineDance · RoboPerform | 0.93 | 0.18 | 0.67 | 0.26 |

### 消融实验

下表取原表 3–5 的 MuJoCo 成功率。每一行相对完整系统改动一个设计。[专家消融][t3] · [内容消融][content] · [适配器消融][t5]

| 条件 | BEAT2 ↑ | FineDance ↑ |
|---|---:|---:|
| 完整系统 | 0.96 | 0.67 |
| 移除音频适配器 | 0.83 | 0.51 |
| 移除固定任务内容 | 0.91 | 0.66 |
| 将残差专家换成常规 MoE | 0.94 | 0.61 |

**音频怎样注入。** 附录将音频与其他输入直接拼接的基线，与逐层调制的完整方法比较。在成功运行的样本上，FineDance 的节拍对齐分数 BAS 从 0.176 变为 0.214，BEAT2 从 0.163 变为 0.197。[附录表 11][beat]

**去噪多少步。** 附录表 12 中，两步、四步、十步的平均单次动作推理耗时分别为 5.3、11.6、18.9 毫秒。这组数描述策略采样，麦克风采集、前端音频缓冲和网络传输需单独计时。[附录表 12][speed]

### 关键发现

1. **动作配对给声音特征带来了可执行的收益。** 去掉适配器后，FineDance 的 MuJoCo 成功率从 0.67 降至 0.51，BEAT2 从 0.96 降至 0.83。对选择音频前端而言，这项消融比检索排名更直接，因为它观察到了最终控制策略。[原表 5][t5]
2. **舞蹈比共语动作更难跨仿真器维持。** 完整策略从 IsaacGym 到 MuJoCo，舞蹈成功率由 0.93 降至 0.67，语音手势由 0.99 降至 0.96。实机视频展示两类任务的可行样例，这两组成批成功率均测自仿真。[原表 2][t2] · [实机演示][project]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **定位动作监督的落点。** 这篇适合作为“用动作教音频”的中间情形：已有音乐特征不动，另训可学习的时序适配器，再看它能否改善最终控制。做类似实验时，可依次测“检索到了哪个动作”和“机器人能否随它站稳”，两个读数提供不同证据。[原表 1][t1] · [原表 5][t5]
- **同一任务可以自由变奏。** 将“正在演讲”固定下来以后，换音频、保留同一内容条件，便能比较节奏带来的变化。若进一步研究某个词是否会触发指定手势，还需要改变词义、保留韵律并标注目标事件，这属于可延伸的实验。[原文 §4.5][content]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- 现有任务只给“跳舞”“演讲”两类固定内容。节拍分数和跟踪成功率都不直接测指代、手形或手与目标物的接触精度。[原文 §4.5][content]
- 定量跟踪成绩来自 IsaacGym 与 MuJoCo。附录的真实 G1 示例能说明系统已经上机，还不能据此给特定舞种或任意长语音算出实机成功率。[附录 §9][real]
- 作者公开了教师与学生权重、部署引擎以及预计算音乐和动作表示。将这些文件接入已有控制器，与直接把任意新录音送入一条完整低延迟管线，是两个可分别验证的复现步骤。[发布文件][weights] · [实机脚本][g1]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **LaMP** 学习语言与动作表示。这里复用的是其文本生成动作分支提供的粗任务内容，实际音频由另一条支路注入。它说明一句固定的动作提示也能当机器人策略的先验。[LaMP 解读](/blog/iclr2025-lamp/) · [内容条件实验][content]
- **RoboGesture** 同样把语音接到人形机器人，重点在语义对应的上身和手部社交手势。RoboPerform 让整机兼顾跳舞、演讲和物理跟踪，两篇的目标关节、输入条件及评价单位各有侧重。[RoboGesture 解读](/blog/eccv2026-robogesture/)
- **Intentional Gesture** 从转录中推断交际功能，并评估更换意图后的手势。把它与固定“演讲”条件的 RoboPerform 一起读，可以区分“什么时候加强动作”和“为什么做这个动作”。[Intentional Gesture 解读](/blog/neurips2026-intentional-gesture/)

<span id="reading-8" class="reading-anchor"></span>
## 来源

- [CVPR 论文 PDF][pdf] · [arXiv v3 HTML][html] · [含完整附录的 v2 HTML][appendix] · [版本记录][record]
- [作者项目与实机视频][project] · [代码仓库][code] · [发布的权重和特征][weights] · [固定版本的实机策略入口][g1]

</div>

[html]: https://arxiv.org/html/2512.23650v3
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/Li_Do_You_Have_Freestyle_Expressive_Humanoid_Locomotion_via_Audio_Control_CVPR_2026_paper.pdf
[record]: https://arxiv.org/abs/2512.23650
[project]: https://gentlefress.github.io/RoboPerform-proj/
[code]: https://github.com/gentlefress/RoboPerform
[weights]: https://huggingface.co/datasets/SanQing1/RoboPerform/tree/main
[g1]: https://github.com/gentlefress/RoboPerform/blob/e6e2a0e4cdb20f081c1a3d46d648d7a202816779/deploy/deploy_real/Roboperform_real.py#L339-L360
[method]: https://arxiv.org/html/2512.23650v3#S3
[experts]: https://arxiv.org/html/2512.23650v3#S3.SS2
[align]: https://arxiv.org/html/2512.23650v3#S3.SS3
[student]: https://arxiv.org/html/2512.23650v3#S3.SS4
[setup]: https://arxiv.org/html/2512.23650v3#S4.SS1
[t1]: https://arxiv.org/html/2512.23650v3#S4.T1
[t2]: https://arxiv.org/html/2512.23650v3#S4.T2
[t3]: https://arxiv.org/html/2512.23650v3#S4.T3
[content]: https://arxiv.org/html/2512.23650v3#S4.T4
[t5]: https://arxiv.org/html/2512.23650v3#S4.T5
[appendix]: https://arxiv.org/html/2512.23650v2#S6
[metrics]: https://arxiv.org/html/2512.23650v2#S7
[deploy]: https://arxiv.org/html/2512.23650v2#S7.SS1
[beat]: https://arxiv.org/html/2512.23650v2#S8.T11
[speed]: https://arxiv.org/html/2512.23650v2#S8.T12
[real]: https://arxiv.org/html/2512.23650v2#S9
