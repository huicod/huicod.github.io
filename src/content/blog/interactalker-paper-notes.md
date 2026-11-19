---
title: "[WACV2026] InteracTalker：让角色边说边坐下，同时适应语音和座椅几何"
description: "同一句“坐下”，换一张椅子或一段录音，全身动作怎样跟着变？解读 InteracTalker 如何分开学习语音手势和人－物交互，在采样时融合两路预测，并区分观众偏好、穿透深度和穿透帧比例。"
pubDate: "2026-11-19T12:46:00+08:00"
updatedDate: "2026-11-19"
badge: "Paper"
tags: ["InteracTalker", "WACV", "Co-Speech-Gesture", "Human-Object-Interaction", "Motion-Diffusion", "Multimodal-Control", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 阅读版（含附录 A–E）][html] · [会议论文 PDF][pdf] · [作者项目与视频][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · WACV 2026 · 共语手势与人－物交互</summary>

*InteracTalker: Prompt-Based Human-Object Interaction with Co-Speech Gesture Generation*。Sreehari Rajan、Kunal Bhosikar（共同第一作者）、Charu Sharma，印度海得拉巴国际信息技术学院。正式发表于 WACV 2026，第 1438–1447 页，作者项目页标注 Oral。arXiv v1 于 2025 年 12 月公开。[会议记录][cvf] · [作者项目][project] · [arXiv 记录][abs]

正文对照会议版的架构图及三张实验表，训练配置取自附录 C。项目页提供演示视频，截至 2026 年 11 月 19 日，其 Code 按钮仍指回项目页。作者入口中未找到可核验的模型源码或权重，本文报告论文结果。[项目页][project] · [实验配置][setup]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

InteracTalker 让同一个动作扩散模型在生成“边说边坐下”时，同时考虑说话的节奏、独立给出的动作指令和椅子的三维形状。作者在两套数据上分别训练手势与交互分支，再让两种单独预测在每个去噪步共同引导一段全身动作。[原文图 3][arch] · [推理公式][fusion]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 语音与动作配对的数据能教角色在说话时如何摆手，带场景的人体动作能教它如何走向椅子、转身坐下。两类数据的观察对象不同，通常也在两种任务上分别评估。[原文 §1–2][intro]

**现有痛点：** 独立生成上半身手势和下半身坐姿，再在腰部拼接时，手臂轨迹与骨盆下降的时机会失去协调。图 2 给出了身体互穿或穿入椅子的例子。[原文图 2][concat]

**核心矛盾：** 语音可以鼓励上身向前摆动，椅背同时限制躯干和手肘的位置。这些条件会作用在同一组关节，而为每段录音同时采集转录、全身动作、配准椅子与接触标注的成本很高。[原文 §1、§3.3][adapt]

**本文目标：** 用户给出录音及转录、单独的动作指令和目标物体，生成一段包含根部移动的全身动作。希望改变椅子高度后坐姿跟着变，同时保留与同一段话相称的手势。[原文 §3.1、图 4][overview]

**切入角度：** 先学习文字到动作的通用先验，随后固定其权重。能得到哪一类配对监督，就训练相应的条件分支，减少对所有模态同时标注的依赖。[训练流程图 5][trainingfig]

**核心 idea：** 采样时先问模型两个问题：“只考虑椅子会怎样动”，“只考虑说话会怎样动”。把两次预测作为参照，通过加权修正同一个去噪结果，让两类条件在动作生成过程中相遇。[原文 §3.3.3][fusion]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

动作主干把带噪序列还原成连续人体姿态。动作指令通过 CLIP 进入主干，录音与转录由共语分支编码；交互分支同时读取当前估计的姿态和目标物体的几何。两个分支都能逐层影响整个人体。训练时各自利用可得到的数据，推理时才对两种条件的预测做自适应融合。[原文图 3][arch] · [附录 B 编码器图][enc]

<figure class="reading-figure"><a href="/paper-notes/interactalker/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/interactalker/architecture.svg" alt="InteracTalker 架构。语音和逐字转录进入共语分支，目标物体和带噪人体进入交互分支。两种条件可分别注入冻结的八层动作主干，采样时通过单条件预测更新融合权重，产出每帧 135 维的全身动作。" loading="lazy" /></a><figcaption>可点击放大的教学示意。先读上方两条条件通路，再读中部共用的动作主干。下方区分每步更新的两个融合权重与训练时学习的网络参数。依据原文图 3、图 5、公式 1–6 和附录 B 绘制。</figcaption></figure>

### 关键设计

1. **直接预测能送入人体模型的连续参数。** 一帧由 22 个关节（含根）的六维旋转和三维帧间全局平移组成，即 22 × 6 + 3 = 135 维。长度 N 的片段为 N × 135。主干含八个 Transformer 块，以动作文字及可选的目标骨盆终点、朝向为条件，训练时学习从带噪动作预测干净序列。恢复根部位移后可驱动 SMPL 人体，省去从预测关节再逐序列拟合 SMPL 的步骤。表示未单列手指或面部参数。[原文 §3.2][mdm] · [附录 A][pose]

2. **以同一组空间基准点度量物体和人体。** 对每个基准点，一路求它到目标物体表面的最短距离，另一路求它到当前带噪姿态下 22 个关节的最短距离。MLP 将两路距离变换为交互特征，交给八层交互分支，每层激活注入主干的对应层。在同一张椅子旁，人物尚未靠近和准备落座时，第二路距离不同，所以交互条件跟着采样中的姿态更新。[原文 §3.3.1][interaction] · [附录图 11][enc]

3. **把说了什么与想做什么分开输入。** 转录描述角色正在说的内容，和音频分别编码，经拼接、线性投影形成语音内容特征，送入八层共语分支。独立动作提示则可以只写“坐下”，无须把“坐下”编入台词。共语分支以动作重建损失训练，输出通过对应层作用于完整骨架。[原文 §3.3.2][speech] · [附录 B][enc]

4. **用单条件预测决定两种引导加多少。** 先计算条件置零的预测，再分别只开交互和只开共语条件。将每种单条件预测减去无条件预测，就得到两组修正量。作者先把共语修正量相对交互修正量做尺度归一，再以“无条件预测 + 两个加权修正量”形成候选动作。对候选动作与两种单条件动作分别计算均方偏差，每步用梯度更新相应引导权重。这里更新的是权重系数；论文未给某只手、某一帧或碰撞表面的优先级规则。[原文式 1、3–6][fusion]

5. **把接触监督集中在真的要坐上椅子的阶段。** 交互分支训练使用动作重建、末帧骨盆、接触和碰撞四项损失。对以坐姿结束的动作，后两项施加于末段；对从坐姿开始的动作，施加于开头若干帧。这样能避免要求角色在走向座椅途中就与它接触。测试时可省去额外的人体与椅子碰撞优化，但两路融合仍按上一步在线更新系数。[原文式 2][interaction] · [融合更新][fusion]

### 一个完整例子

原文图 4 固定一段讲话和“坐下”的指令，把扶手椅依次换成高凳和低踏板。动作分支提供下蹲与落座的基本过程，物体距离特征随座面形状变化；同一段录音和转录持续给出手势条件。每个采样步都会重新估计有椅子约束和有语音约束时的动作，再依照二者调整当步的全身预测。最后可以把三段人体动画放在各自的座椅上，查看骨盆高度、上身倾角与摆手节奏怎样一起变化。这组图能说明模型对座椅条件有响应；要判断右手有没有穿过某个扶手，需要另外测量手与扶手的距离。[图 4][chairs] · [作者演示][project]

### 训练 / 推理

- **先训主干。** 在 HumanML3D 和 SAMP 上用动作文字训练基础模型 50 万步，批量为 200。这一步学习通用动作，未给主干输入配准物体。[附录 C][setup]
- **冻结主干，分别训练分支。** 交互分支用 SAMP 的坐下、起身、走去坐下或起身走开等片段，人工把 3D-FRONT 的不同高度椅子与动作对齐，训练 11 万步。手势分支用 BEATX-Standard 中超过 30 小时的同步动作、录音及转录训练 60 万步。两分支批量均为 64，无须把一段 BEATX 录音人为配给一把训练椅子。[交互训练][interaction] · [共语训练][speech] · [配置][setup]
- **算力与采样。** 作者报告所有阶段使用 AdamW、学习率 0.0001，在单张 RTX 2080 Ti 上总训练约 5 天。训练和推理均设 1,000 个扩散步。附录没有报告每秒产出多少动作帧或一次完整生成的延迟。[附录 C][setup]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**表 1 · 两种条件同时开启时，观众更偏好谁？** 64 名非专业参与者观看配有录音的成对视频。Concat 独立生成上身手势和下身交互后拼接。真实感是 1–5 分，其余四列是二选一偏好比例。“穿透更少”一列记录观众选了谁，不能当成实际穿透帧的百分比。[原表 1][t1] · [附录 E][study]

| 方法 | 真实感 ↑ | 动作更自然 | 物体交互更好 | 手势质量更高 | 穿透看起来更少 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Concat | 2.77 | 29.7% | 20.3% | 26.6% | 20.3% |
| InteracTalker | **3.77** | **70.3%** | **79.7%** | **73.4%** | **79.7%** |

**表 2 · 只启用共语分支，在 BEATX 上评估手势。** 保留论文列出的全部方法与表内数值。FGD 越低，生成与真实动作在评估特征空间里的分布越接近；BC 衡量节奏一致性，Diversity 衡量生成的动作变化。FGD 和 BC 沿用论文表注的 ×10⁻¹ 口径。[原表 2][t2] · [评测说明][speechtest]

| 方法 | FGD ↓ | BC ↑ | Diversity ↑ |
| --- | ---: | ---: | ---: |
| S2G | 25.129 | 6.902 | 7.783 |
| Trimodal | 19.759 | 6.442 | 8.894 |
| HA2G | 19.364 | 6.601 | 9.671 |
| DisCo | 21.170 | 6.571 | 10.378 |
| CaMN | 8.752 | 6.731 | 9.279 |
| DiffStyleGesture | 10.137 | 6.891 | 11.075 |
| Habibie 等 | 14.581 | 6.779 | 8.874 |
| TalkShow | 7.313 | 6.783 | 12.859 |
| EMAGE | 5.423 | 6.794 | **13.057** |
| SynTalker | 6.413 | **7.971** | 12.721 |
| InteracTalker 共语分支 | **1.017** | 7.074 | 8.136 |

**表 3 · 只启用交互分支，在 SAMP 坐姿任务上评估。** 前三列分别是到达目标的位置、高度和朝向误差，后两列是穿入物体的身体顶点所对应的平均 SDF 值，以及发生穿透的姿态占全序列的比例。两种穿透指标回答不同问题。[原表 3][t3] · [指标定义][objecttest]

| 方法 | 位置 ↓ | 高度 ↓ | 朝向 ↓ | 穿透值 ↓ | 穿透帧比例 ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| DIMOS | 0.2020 | 0.1283 | 0.4731 | 0.0193 | 0.1076 |
| TeSMo | 0.1445 | **0.0120** | 0.2410 | 0.0043 | **0.0611** |
| InteracTalker 交互分支 | **0.1247** | 0.0388 | **0.0965** | **0.0010** | 0.0619 |

### 消融实验

**逐一开启分支。** 图 9 固定“坐下”及同一物体。仅用主干时角色原地做出坐姿，没有顾及椅子。加入交互分支后，角色先移向椅子再坐下。进一步加入共语分支，坐下的同时出现随讲话变化的手势。作者给出定性序列，未列三种设置的数值，也未单独比较固定融合权重与在线更新权重。[原文 §4.4、图 9][ablation]

### 关键发现

1. **联合效果与单路能力分别有证据。** 表 1 检验两路一起工作时相对于拼接基线的观众偏好。表 2、3 独立测试两支，不能据此推出开启双条件后仍保有同样的 FGD 或穿透值。[整体评测][whole] · [共语评测][speechtest] · [交互评测][objecttest]
2. **分布接近、踩准节奏和动作多样性可以分开变化。** InteracTalker 的 FGD 为 1.017，明显低于 EMAGE 的 5.423；多样性为 8.136，低于 EMAGE 的 13.057。节奏一致性最好的则是 SynTalker。[原表 2][t2]
3. **穿得浅与穿得少也可以分开变化。** 对比 TeSMo，穿透值由 0.0043 降至 0.0010，但出现穿透的帧从 6.11% 微升至 6.19%，目标高度误差也是 TeSMo 较低。复用到精确落座时，应保留这几列。[原表 3][t3]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把两种昂贵数据的互补性用到了生成过程。** 座椅配准提供几何监督，讲话录音提供手势监督。两支都在同一个冻结主干上学习如何改变全身预测，推理时才有把两种修正合在一起的共同参照。[训练图 5][trainingfig] · [融合公式][fusion]
- **每步重新查询人和物体的关系。** 单独编码“这是一把椅子”无法区分人还在远处还是骨盆已经靠近座面。基准点到当前人体的距离在采样过程中随姿势改变，让同一个物体在不同姿势下产生不同条件。[交互分支][interaction]
- **单条件预测让折中过程可以检查。** 可以分别查看仅开语音、仅开交互和同时开启后的动作，判断一次失败可能来自哪一支。论文对这种拆分提供了可解释的实验入口，仍需额外对照才能确定误差归因。[原文 §3.3.3、§4.4][fusion]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **训练交互集中在椅子与坐、起动作。** 图 10 展示对未见物体几何的适应，论文没有提供这些新物体上的成功率。由这些例子推到抓取小物体、推门或与移动物体协作，仍需要新的任务与数据。[原文 §4.5][unseen]
- **同一只手发生条件冲突时，结果取决于生成与融合。** 例如台词诱发右手挥动，右手又需要撑住扶手。当前两个权重作用于条件预测，原文没有给逐关节的优先级，也没有按这类冲突单列成功率。模型输出的 22 关节人体可用于检查手腕位置，指尖接触还需要更细的手部表示。[融合公式][fusion] · [人体表示][pose]
- **能生成静态物体旁的交流动作，离实时角色控制还有一段距离。** 一轮输出经过 1,000 个去噪步。作者给出的训练耗时不能替代运行延迟，项目演示也不能据此推出用户临时移动椅子时的响应速度。[实验配置][setup] · [项目演示][project]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **SynTalker。** 两篇都关心“讲话内容”和“指示身体做什么”能否同时起作用。InteracTalker 额外把配准后的目标物体几何送入采样过程；表 2 对 SynTalker 的比较仅涉及共语分支。[站内 SynTalker 解读](/blog/acmmm2024-syntalker/) · [原表 2][t2]
- **TeSMo。** 两者都以场景和文本引导人体动作。TeSMo 在这里是座椅交互实验的参照；InteracTalker 明确把接触与碰撞损失用于座椅训练片段，并把共语分支独立训练后接入。对目标高度、穿透发生率和穿透值应分别比较。[原文相关工作][related] · [原表 3][t3]
- **对交互式数字人的启发。** 若任务改成“角色说到某个词时扶住椅背”，可以沿用语音、独立指令、物体几何三路输入；验收时另测目标词与接触时刻之差、手腕到指定位置的距离和身体穿透帧比例。这样可以查出一次动作究竟是声音没对上，还是手没有到位。这是基于本文提出的评测建议。[原文评测][whole]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 正式出版与作者信息。[WACV 2026 会议记录][cvf] · [会议论文 PDF][pdf] · [arXiv 版本记录][abs]
- 可在线翻译的全文、附录与演示。[原生 HTML][html] · [会议补充材料（ZIP）][supp] · [作者项目][project]
- 核心方法与原始数据。[架构图 3][arch] · [融合公式][fusion] · [原表 1][t1] · [原表 2][t2] · [原表 3][t3]

</div>

[cvf]: https://openaccess.thecvf.com/content/WACV2026/html/Rajan_InteracTalker_Prompt-Based_Human-Object_Interaction_with_Co-Speech_Gesture_Generation_WACV_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/WACV2026/papers/Rajan_InteracTalker_Prompt-Based_Human-Object_Interaction_with_Co-Speech_Gesture_Generation_WACV_2026_paper.pdf
[supp]: https://openaccess.thecvf.com/content/WACV2026/supplemental/Rajan_InteracTalker_Prompt-Based_Human-Object_WACV_2026_supplemental.zip
[abs]: https://arxiv.org/abs/2512.12664
[html]: https://arxiv.org/html/2512.12664v1
[project]: https://sreeharirajan.github.io/projects/InteracTalker/
[intro]: https://arxiv.org/html/2512.12664v1#S1
[related]: https://arxiv.org/html/2512.12664v1#S2
[concat]: https://arxiv.org/html/2512.12664v1#S1.F2
[arch]: https://arxiv.org/html/2512.12664v1#S2.F3
[overview]: https://arxiv.org/html/2512.12664v1#S3.SS1
[mdm]: https://arxiv.org/html/2512.12664v1#S3.SS2
[adapt]: https://arxiv.org/html/2512.12664v1#S3.SS3
[interaction]: https://arxiv.org/html/2512.12664v1#S3.SS3.SSS1
[speech]: https://arxiv.org/html/2512.12664v1#S3.SS3.SSS2
[fusion]: https://arxiv.org/html/2512.12664v1#S3.SS3.SSS3
[enc]: https://arxiv.org/html/2512.12664v1#A2
[pose]: https://arxiv.org/html/2512.12664v1#A1
[trainingfig]: https://arxiv.org/html/2512.12664v1#S3.F5
[chairs]: https://arxiv.org/html/2512.12664v1#S3.F4
[setup]: https://arxiv.org/html/2512.12664v1#A3
[whole]: https://arxiv.org/html/2512.12664v1#S4.SS1
[speechtest]: https://arxiv.org/html/2512.12664v1#S4.SS2
[objecttest]: https://arxiv.org/html/2512.12664v1#S4.SS3
[t1]: https://arxiv.org/html/2512.12664v1#S3.T1
[t2]: https://arxiv.org/html/2512.12664v1#S3.T2
[t3]: https://arxiv.org/html/2512.12664v1#S4.T3
[ablation]: https://arxiv.org/html/2512.12664v1#S4.SS4
[unseen]: https://arxiv.org/html/2512.12664v1#S4.SS5
[study]: https://arxiv.org/html/2512.12664v1#A5
