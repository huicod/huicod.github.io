---
title: "[CVPR2024] MoST：怎样从踢腿中学到趾高气扬的姿态，再让角色这样跳跃？"
description: "同一段参考动作里，自信的姿态和踢腿的动作纠缠在一起。MoST 读取两段骨架序列的动作内容，按身体部位重新分配风格。本文用跨动作实验、风格解耦消融与滑步案例检验这种分工。"
pubDate: "2026-11-26T17:52:00+08:00"
badge: "Paper"
tags: ["MoST", "Motion Style Transformer", "动作风格迁移", "身体部位", "Transformer", "风格解耦", "骨架动画", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML（含附录 A–J）][html] · [CVPR 正文 PDF][pdf] · [作者动画演示][project] · [代码与预训练权重入口][repo]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2024</summary>

*MoST: Motion Style Transformer between Diverse Action Contents*，作者为 Boeun Kim、Jungho Kim、Hyung Jin Chang、Jin Young Choi。发表于 CVPR 2024，第 1705–1714 页。本文对照会议正文、arXiv v2 所附补充材料和官方 Xia 评测实现。数字取自论文，本次未运行模型。[会议记录][cvf] · [补充材料包][supp] · [代码版本][code]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

输入一段生气的跳跃和一段趾高气扬的踢腿，MoST 要生成一段趾高气扬的跳跃。模型会**把参考动作的内容也读出来**。识别出示范者正在踢腿，有助于模型判断哪些身体姿态可以借给跳跃，哪些腿部轨迹属于踢腿本身。[跨内容失败对照，图 1][f1] · [架构图 2][f2]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　基于样例的动作风格迁移接受两段骨架动画。内容片段决定角色做什么，参考片段示范怎么做。已有方法能把一种走路方式变成另一种，Motion Puzzle 还允许从不同参考里组合各部位的风格。两段动作同是走路时，脚跟、步幅和第三步摆臂天然就有相似的功能。[引言与相关工作][intro] · [站内 Motion Puzzle 解读][puzzle]

**现有痛点**　换成跳跃与踢腿，这种对应就不再可靠。图 1 中，Motion Puzzle 将“趾高气扬的踢腿”迁移到另一段跳跃上时，输出也踢起了腿；另一个“老态踢腿 × 骄傲出拳”的例子中，已有方法产生了扭曲的姿势。作者把这种**参考动作混进输出内容**的情况作为核心测试。[原文图 1][f1]

**核心矛盾**　参考腿抬得高，一部分是因为踢腿本来就要抬腿，一部分可能属于夸张、有气势的表演。如果只拿参考特征调目标腿，网络很容易把两件事一起学走。而同样的气势，在跳跃里可以体现在胸、肩和全身的发力幅度上。[部位调制 §3.4][psm] · [定性比较图 4][f4]

**本文目标**　给定两段动作数据，把参考风格迁移到指定内容上，同时生成局部关节动作和整个人的根运动。使用者在推理时只给示范，不需输入“骄傲”之类的风格标签。训练时作者仍使用带风格和内容类别的数据构造约束。[任务定义][framework] · [训练目标][loss]

**切入角度**　分别比较“目标各部位在做什么”和“参考各部位在做什么”，再决定目标的某个部位应该从参考的哪些部位取风格。出拳动作中手臂承担的表达作用，有时能在踢腿动作中由腿来体现，因此模型允许跨部位读取。[式 10–12][psm] · [注意力示例图 7][f7]

**核心 idea**　共享编码器把每段动作都拆成逐帧内容和按部位汇总的风格。两段内容生成部位对应权重，权重用于混合参考风格，生成器沿内容片段的时间轴重建动画。训练时再换一段**同风格、不同动作**的参考，要求两次输出尽量相近，把照抄参考动作变成会被惩罚的行为。[图 2][f2] · [解耦损失，附录 D][ld]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

以图 1 的跳跃为内容、踢腿为参考。两段序列走同一个编码器。跳跃的逐帧内容直接送进生成器；两段内容各自再做时间池化，作为部位注意力的输入。注意力读取踢腿片段的风格，经调制后送入生成器的每一层，最后解码出新关节姿态、根位置、朝向和速度。[原图 2][f2] · [生成器 §3.5][decoder]

<figure class="reading-figure"><a href="/paper-notes/most/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/most/architecture.svg" alt="MoST 两路共享编码器与部位注意力。目标跳跃的内容是查询，参考踢腿的内容是键，参考踢腿的风格是值。生成器读取逐帧跳跃内容和调制后的风格，输出关节与根运动。" /></a><figcaption>依据原文图 2 重绘。沿内容支路可以追到输出的时间轴，沿参考支路可以看到风格经过哪一步才能影响目标身体。点击可放大。</figcaption></figure>

### 关键设计

1. **给根运动一个独立位置。** 两个数据集都从 31 个骨架关节选 21 个。单关节用根相对位置的 3 个数和旋转四元数的 4 个数表示；整个人的根位置、朝向、线速度和转向速度另行编码。公开实现在每个时间位置产生六组特征——左腿、右腿、躯干、左臂、右臂、全局轨迹。这样，老人慢步与小孩快步的差异也可以作用于整体位移。[表示 §3.2][rep] · [附录 B][repapp] · [部位索引与嵌入实现][net]

2. **同一段动作同时保留快照和摘要。** 共享 Transformer 在一帧内比较身体部位，再沿时间学习帧间关系。输入多加一个可学习的风格位置，从倒数第二个块读出各部位的整段摘要；其余帧经过实例归一化和最后一个块，输出逐帧内容。以公开默认宽度 48 为例，长度为 T 的片段得到一份 **T × 6 × 48** 的内容和一份 **6 × 48** 的风格。两段输入共享参数，生成时取目标的逐帧内容以及参考的风格与内容摘要。[编码器 §3.3][encoder] · [默认参数][args]

3. **部位注意力用两份内容寻找一份风格。** 把目标逐帧内容沿时间平均，作为查询 **Q**；把参考内容沿时间平均，作为键 **K**；把参考的六组风格摘要作为值 **V**。每个注意力头形成一张 **6 × 6** 的部位权重图，行对应接收风格的目标部位，列对应提供风格的参考部位。PSM 按权重混合 V，再加入参考风格的线性残差并通过前馈层。这里压缩掉了参考的时间索引，使用者无法借这个接口要求“照着参考第 18 帧抬腿”。[部位调制器，式 10–12][psm] · [PSM 实现][implpsm]

4. **把风格作用到内容序列上。** 生成器以目标的逐帧内容为主输入。每个 Transformer 块用 AdaIN 将特征归一化，再根据调制后的风格调整通道尺度和偏移，然后做部位注意力和时间注意力。末端分别解码局部骨架与根运动。论文对 MoST 的评测使用原始生成结果；其它基线沿用各自提供的复制根轨迹、足滑修正等后处理。附录 I 展示同一段中性行走分别配上儿童式与老年式踢腿参考，生成的老年式行走移动得更慢。[式 13–16][decoder] · [根运动对照][root]

5. **在输出动作上做“换参考”实验。** 固定一段内容，取两段风格标签相同、内容标签不同的参考，各生成一次，压低两次输出之间的距离。作者用其中一支作停止梯度的目标，另有重建、循环一致性和对抗目标，避免仅靠输出相同就满足训练。足部正则根据内容片段的接触帧，在循环重建分支上惩罚脚的移动，速度与加速度项则约束抖动。它们都是软损失。[主文 §3.6][loss] · [附录 D 的双参考训练图][ld] · [损失实现][implloss]

### 一个完整例子

以论文图 1 的 **Angry Jump × Strutting Kick** 为例。以下是依据实际接口对这个案例的拆解。图 1 给出生成结果，原文另在图 7 报告其他动作对的注意力图，没有为这对跳跃与踢腿公布逐部位权重。[原文图 1][f1] · [原文图 7][f7]

| 看哪一步 | 在这对输入里会发生什么 |
|---|---|
| 内容片段 | 逐帧特征保留跳跃的运动过程。输出沿这段内容的有效帧展开，原有生气风格则要被替换。 |
| 风格片段 | 同一编码器既提取参考的整体表演方式，也提取这段踢腿的内容摘要，让后续模块知道参考腿正在执行的动作。 |
| 选择与注入 | 目标各部位依自身内容查询参考各部位，混合参考风格向量；这些向量调制目标内容的逐帧特征。 |
| 观察输出 | 先看角色是否仍然跳跃，再看躯干和四肢是否带上了参考中的趾高气扬。如果输出抬腿踢出，即使参考的姿势复现得很像，也破坏了指定内容。 |

### 训练与推理

Xia 提供八种风格、六类内容。官方配置中第六类是过渡动作，测试集合覆盖走、跑、跳、踢、打五类。作者将动作降采样到 60 FPS，训练时随机裁片段，最长 200 帧；编码器和生成器各三块 Transformer，另有单块判别器。论文报告 30 万次迭代、batch size 8。公开训练采样会读取类别，推理入口只编码两段骨架，按内容片段的有效长度导出 BVH。作者给出 Xia 权重、预处理、训练与评测脚本。[实验设置][exp] · [数据划分][config] · [推理与 BVH 导出][demo] · [模型入口][repo]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

下表为论文表 1，测试集是 Xia。“同内容／异内容”按两段输入的动作类别划分，例如“踢 × 踢”与“跳 × 踢”。数值是距离，越低越好。Park 等的方法在训练与推理时都额外接收风格标签，MoST 在推理时只读两段动作。[原表 1][t1] · [对照设置][main]

| 方法 | CC 平均 ↓ | CC 同内容 ↓ | CC 异内容 ↓ | SC++ 平均 ↓ | SC++ 同内容 ↓ | SC++ 异内容 ↓ |
|---|---:|---:|---:|---:|---:|---:|
| Motion Puzzle | 51.4 | 8.6 | 66.9 | 76.0 | **58.0** | 82.5 |
| Aberman 等 | 46.0 | 42.0 | 47.0 | 189.7 | 220.8 | 178.4 |
| Park 等 | 38.4 | 22.6 | 44.1 | 65.7 | 59.6 | 67.9 |
| Wen 等 | 18.5 | **7.8** | 22.3 | 80.8 | 76.2 | 82.4 |
| **MoST** | **8.5** | 8.0 | **8.7** | **63.0** | 62.2 | **63.2** |

- **CC（内容一致性）怎么读。** 附录式 28 只选**两段输入风格标签相同**的测试对。既然无需改换风格，输出应靠近内容片段。再按输入动作类别是否相同分列，所以表里的“异内容 CC”并不等于“风格和内容同时换掉时”的误差。公开脚本对根相对关节位置算欧氏距离，按关节累加、按帧平均。[附录 E][metrics] · [CC 评测实现][cc]
- **SC++（扩展风格一致性）怎么读。** 生成“趾高气扬地跳”时，参考本身在踢，拿它当正确答案会惩罚正确的跳跃。作者改从训练集寻找目标内容与参考风格都匹配的真实片段，计算输出与这些样例的平均距离。不同表演者即使都正确，也可能在节奏上有差异，这里没有对每个输入唯一配对的真值。CC 与 SC++ 都排除了全局位移，不能用来证明脚底不滑或路线准确。[附录 E][metrics] · [SC++ 评测实现][sc]

### 消融实验

原文表 2 固定其余损失与 Transformer 主干，只开关部位调制器 PSM 和风格解耦损失 Lᴅ。指标为整个 Xia 测试集的平均距离。[原表 2][t2]

| 部位调制器 PSM | 解耦损失 Lᴅ | CC ↓ | SC++ ↓ |
|---|---|---:|---:|
| 关 | 关 | 37.4 | 69.5 |
| 开 | 关 | 19.7 | 66.1 |
| 关 | 开 | 9.3 | 63.2 |
| 开 | 开 | **8.5** | **63.0** |

**换主干。** 附录表 C 再以时间卷积、图卷积分别替换编码器、生成器和判别器。作者改造后的时间卷积组合得到 CC 39.6、SC++ 81.2，图卷积组合为 25.1、68.5，完整 Transformer 为 8.5、63.0。对照配置也有差异：时间卷积版无法提供部位风格，因此没有 PSM；两种替换版都用分开的内容、风格编码器。这组数值不能单独归功于把卷积换成注意力。[附录 F 与配置表 C][archabl]

### 关键发现

1. **困难主要在两段输入做不同的事。** Motion Puzzle 在同内容时 CC 为 8.6，换成异内容就升至 66.9；MoST 分别为 8.0 和 8.7。反过来，同内容 SC++ 最低的是 Motion Puzzle 的 58.0，同内容 CC 最低的是 Wen 等的 7.8。MoST 的优势主要体现在跨动作类别这一列。[表 1][t1]
2. **训练时如何选参考，与架构同样值得复用。** 从两项都关闭的设置出发，只加 PSM，CC 从 37.4 降到 19.7；只加 Lᴅ，降到 9.3。再把两项合用得到 8.5。这组受控比较里，“固定目标、替换同风格参考”给出的约束尤其强。[表 2][t2]
3. **跨数据集结果是可视化证据。** BFA 有 16 种风格，包含没有按动作类别切开的长序列。作者展示将 BFA 的风格用于出拳等例子，以及同一段内容换成 Zombie、Heavy 等风格的差别；上表的 CC、SC++ 都来自 Xia。[图 4][f4] · [BFA 定性结果，附录 H][bfa]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **参考动作的内容是有用的条件。** 如果只提取一个风格码，再要求模型自动去掉“踢”，解码器几乎无从判断参考姿态为何形成。MoST 保留参考内容，用它决定哪些部位的风格值得读取，同时让目标逐帧内容独立通向解码器。这比单纯增加一个风格编码器更有针对性。[图 2][f2] · [PSM §3.4][psm]
- **把风格对位移的影响变成可观察输出。** 附录 I 中，内容都是中性行走，参考都是踢腿，只换儿童式和老年式风格，输出的移动速度随之改变。这个对照隔开了“换了动作所以速度不同”这一解释。若要进一步判断目标轨迹误差，还需专门测根轨迹。[附录图 D][root]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

1. **风格和内容纠缠很深时仍会失败。** 附录例子里，原内容片段的醉态摇晃减弱了，要求的愤怒感却没有充分出现。去掉旧风格与成功表达新风格是两个独立检查项。[失败案例，附录 J][failure]
2. **脚接触与时间控制都没有硬保证。** “骄傲地踢腿”仍有脚滑样例。200 帧是公开默认模型的窗口上限，60 FPS 下约 3.3 秒；部位注意力在时间池化后计算，论文没有提供让某个身体部位在指定帧开始采用新风格的接口。[结论与限制][end] · [失败图 E][failure] · [代码配置][args]
3. **注意力图支持定位，尚不能当成动作语义标注。** 图 7 可读出某些参考手臂和目标腿之间权重较高，也能看到根轨迹参与。但若想证明特定权重对某一风格动作有因果作用，还需干预单一部位、观察其余动作如何变化。公开结果主要是整套 PSM 的消融与可视化。[图 7][f7] · [表 2][t2]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **Motion Puzzle（SIGGRAPH 2022）。** Motion Puzzle 的优势是让动画师为不同部位挑选风格来源。MoST 面对的是另一项决定：给定一个完整参考，参考里表达风格的部位与目标里应表达风格的部位可能不同。因而一个方法强调显式组装，另一个方法强调由两个动作内容学习对应关系。[站内 Motion Puzzle 解读][puzzle] · [本文比较][main]
- **MotionS（ACM Multimedia 2024）。** MoST 学习两段骨架动作之间的风格迁移；MotionS 则利用规范动作空间把风格带给专门训练过的目标角色，还允许文字、图片等风格提示。选方法时，应先确认自己有的是两段兼容骨架动画，还是一段需要延展的定制角色动画。[站内 MotionS 解读][motions] · [MoST 输入表示][rep]
- **可迁移的实验设计。** 评估任何“参考视频／动作给风格”的系统，可以固定目标跳跃，先用夸张踢腿作参考，再换成同样风格的出拳。检查输出是否一直保留跳跃、两次风格表现是否接近，再单独测根速度、足滑。这样能区分复制示范、完全忽略示范和真正借到风格三种结果。这是从 MoST 的训练约束与指标边界延伸出的实验建议。[解耦损失][ld] · [评测定义][metrics]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **论文与出处**　[CVPR 2024 论文页][cvf] · [会议正文 PDF][pdf] · [可翻译全文与附录 A–J][html] · [CVF 补充材料][supp]
- **方法与数据**　[原架构图 2][f2] · [跨部位注意力][psm] · [主实验表 1][t1] · [消融表 2][t2] · [评测公式][metrics]
- **实现与演示**　[作者项目与视频][project] · [官方实现及 Xia 权重入口][repo] · [核对的代码版本][code]
</div>

[html]: https://arxiv.org/html/2403.06225v2
[pdf]: https://openaccess.thecvf.com/content/CVPR2024/papers/Kim_MoST_Motion_Style_Transformer_Between_Diverse_Action_Contents_CVPR_2024_paper.pdf
[cvf]: https://openaccess.thecvf.com/content/CVPR2024/html/Kim_MoST_Motion_Style_Transformer_Between_Diverse_Action_Contents_CVPR_2024_paper.html
[supp]: https://openaccess.thecvf.com/content/CVPR2024/supplemental/Kim_MoST_Motion_Style_CVPR_2024_supplemental.zip
[project]: https://boeun-kim.github.io/page-MoST/
[repo]: https://github.com/Boeun-Kim/MoST
[code]: https://github.com/Boeun-Kim/MoST/tree/7b70aee97865de556e968d593e99129d184a57f9
[intro]: https://arxiv.org/html/2403.06225v2#S1
[f1]: https://arxiv.org/html/2403.06225v2#S1.F1
[f2]: https://arxiv.org/html/2403.06225v2#S1.F2
[framework]: https://arxiv.org/html/2403.06225v2#S3.SS1
[rep]: https://arxiv.org/html/2403.06225v2#S3.SS2
[encoder]: https://arxiv.org/html/2403.06225v2#S3.SS3
[psm]: https://arxiv.org/html/2403.06225v2#S3.SS4
[decoder]: https://arxiv.org/html/2403.06225v2#S3.SS5
[loss]: https://arxiv.org/html/2403.06225v2#S3.SS6
[t1]: https://arxiv.org/html/2403.06225v2#S3.T1
[exp]: https://arxiv.org/html/2403.06225v2#S4
[main]: https://arxiv.org/html/2403.06225v2#S4.SS1
[f4]: https://arxiv.org/html/2403.06225v2#S4.F4
[t2]: https://arxiv.org/html/2403.06225v2#S4.T2
[f7]: https://arxiv.org/html/2403.06225v2#S4.F7
[end]: https://arxiv.org/html/2403.06225v2#S5
[repapp]: https://arxiv.org/html/2403.06225v2#S2a
[ld]: https://arxiv.org/html/2403.06225v2#S4a
[metrics]: https://arxiv.org/html/2403.06225v2#S5a
[archabl]: https://arxiv.org/html/2403.06225v2#S6
[bfa]: https://arxiv.org/html/2403.06225v2#S8
[root]: https://arxiv.org/html/2403.06225v2#S9
[failure]: https://arxiv.org/html/2403.06225v2#S10
[args]: https://github.com/Boeun-Kim/MoST/blob/7b70aee97865de556e968d593e99129d184a57f9/arguments.py#L8-L28
[config]: https://github.com/Boeun-Kim/MoST/blob/7b70aee97865de556e968d593e99129d184a57f9/xia_dataset.yml
[net]: https://github.com/Boeun-Kim/MoST/blob/7b70aee97865de556e968d593e99129d184a57f9/model/networks.py#L10-L93
[implpsm]: https://github.com/Boeun-Kim/MoST/blob/7b70aee97865de556e968d593e99129d184a57f9/model/transformer.py#L187-L217
[implloss]: https://github.com/Boeun-Kim/MoST/blob/7b70aee97865de556e968d593e99129d184a57f9/model/loss.py#L36-L100
[cc]: https://github.com/Boeun-Kim/MoST/blob/7b70aee97865de556e968d593e99129d184a57f9/evaluation_CC.py#L59-L115
[sc]: https://github.com/Boeun-Kim/MoST/blob/7b70aee97865de556e968d593e99129d184a57f9/evaluation_SCpp.py#L101-L130
[demo]: https://github.com/Boeun-Kim/MoST/blob/7b70aee97865de556e968d593e99129d184a57f9/demo.py
[puzzle]: /blog/siggraph2022-motion-puzzle/
[motions]: /blog/acmmm2024-motions/
