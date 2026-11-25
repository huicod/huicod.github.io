---
title: "[SIGGRAPHAsia2026] Skinned Motion Retargeting：怎样让双手靠近，又不穿过彼此？"
description: "从双手举到脸前的动作出发，跟踪蒙皮后的穿插怎样经雅可比转置反馈给动作模型。对照不同骨架、未见角色、逐样本优化和脚滑实验，辨别哪些改善真正测到了。"
pubDate: "2026-11-25T19:36:00+08:00"
badge: "Paper"
tags: ["Skinned Motion Retargeting via Artifact-driven Kinematic Prior Refinement", "Skinned Motion Retargeting", "蒙皮", "动作重定向", "穿模", "Self-Penetration", "Jacobian", "Linear Blend Skinning", "Motion Embedding", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML（含附录）][html] · [作者 PDF（18 页，含补充材料）][pdf] · [演示视频][video]

<details class="paper-meta"><summary>论文信息与阅读范围 · SIGGRAPH Asia 2026</summary>

*Skinned Motion Retargeting via Artifact-driven Kinematic Prior Refinement*。作者为 KAIST 的 Seokhyeon Hong、Chaelin Kim、Inseo Jang、Soojin Choi、Junyong Noh，前两位共同一作。发表于 SIGGRAPH Asia 2026 Journal Track，收录于 *ACM Transactions on Graphics* 45(6)，Article 262。以下按作者版论文和 arXiv v1 核对，附录 A 解释检测与训练，附录 B 展示动作表示的其他用途。[会议记录][venue] · [ACM 出版记录][doi] · [作者项目][project]

作者已公开运动学和几何修正两阶段的模型权重、训练与测试代码、表 1 和表 2 的评估入口，推理结果可导出 BVH。本次核对了公开源码中的穿插检测、自动微分及指标实现；下表为论文报告值，未重新运行模型。[官方代码与权重][code]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

源角色把双手举到脸前，换到手掌更厚、脸形不同的角色，相同的手势可能让两只手穿进彼此。作者让模型**先在目标骨架上做一遍动作，再看目标皮肤实际上在哪里相交**，把穿入点需要移动的方向反传给动作表示，修正姿态后重新解码。最终交付的仍是一段关节动画，可由原来的角色绑定驱动。[几何修正图 4][fig4] · [双手案例图 6][fig6]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　动作重定向让已有动画适配新角色。SAME 一类方法可以让不同关节数的人形骨架共享动作表示；R2ET、STaR 等方法进一步把身体表面纳入考虑。前者擅长跨骨架，后者关注骨骼摆好之后的皮肤形态。[§2][related]

**现有痛点**　即使两只手腕的位置都对，手掌也可能互相穿过。关节旋转误差小，同样无法保证手臂绕得开厚躯干。反过来，把双手拉得很开就能消除穿插，却会丢掉“双手在面前靠拢”的动作意图。[§1][intro] · [原文图 6][fig6]

**核心矛盾**　问题出在目标角色的**表面顶点**上，动画师能编辑的却是**关节运动**。同一个顶点受多根骨骼加权影响，另一个顶点的穿入还可能牵涉不同的关节；单靠两表面之间的距离，无法直接决定该改肩、肘还是腕。[§3.3.1][cue]

**本文目标**　在骨架结构、骨长和体形有差别时，尽量保住动作的旋转、位移和意图，同时减少目标角色蒙皮后的自穿插。检测对象是角色自身身体部位，输入是一段源动作和已绑定的目标角色。[§3.1][rep] · [§4.1.3][metrics]

**切入角度**　从动作向量到皮肤表面有一条可微的路径：动作解码得到旋转，正向运动学得到骨骼变换，蒙皮再得到顶点。沿这条路径反向计算，就能问“如果要把这些穿入点往外挪，动作表示里的哪些变化会影响它们”。[式 14–18][cue]

**核心 idea**　让摆好姿态的网格指出**这一帧哪里出错**，用静止网格和蒙皮权重描述**这个角色各部位是什么形状**。前者修正动作向量，后者补充目标关节特征，最后交给同一个解码器生成新姿态。[图 4][fig4] · [式 19–23][refine]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先走一次骨架重定向：每帧的源关节运动被压成一个 32 维向量，目标骨架把它解成初始姿势。然后让目标皮肤真的随骨骼变形。在这个初始姿势上检测穿插，把顶点反馈变成动作向量的修正，同时从目标静止网格提取逐关节体形特征。第二次解码给出修正后的关节旋转、根部运动和接地预测。[骨架主干图 3][fig3] · [几何修正图 4][fig4]

<figure class="reading-figure"><a href="/paper-notes/skinned-motion-retargeting/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/skinned-motion-retargeting/architecture.svg" alt="蓝线将源骨架动作解码到目标并蒙皮，橙线把目标表面的穿入位移经雅可比转置送回动作向量，绿线从静止网格按蒙皮权重提取各关节的体形条件，最后重新解码目标动作。" /></a><figcaption>依据原文图 3–4 与附录 A 重绘。蓝线是第一次解码，橙线从摆好姿态的网格反馈当前穿插，绿线提供角色本身的体形。两路汇合后复用冻结的目标解码器。点击可放大。</figcaption></figure>

### 关键设计

1. **先学一个能迁给不同骨架的动作向量。** 源角色每帧构造 J 个 26 维关节输入，包括静止位置与父关节偏移、局部 6D 旋转、前后位置、速度、根运动和接触标签。与所有关节一起输入 Transformer 的还有一个可学习的动作 token。读出它就得到该帧的 32 维表示 z。网络不添加依赖关节排列序号的位置编码。目标解码器读取 z 和目标骨架各关节的静止特征，因此输出关节数由目标决定。同一动作在不同骨架上的表示在训练时被拉近，不同动作的表示则被拉开。[§3.2，式 4–13][kin] · [附录 A.1][arch]

2. **把第一次预测摆上目标角色的皮肤。** 正向运动学（FK）沿骨骼树累积旋转，线性混合蒙皮（LBS）按既有绑定权重把各根骨骼的变换合成到每个顶点。对肢体上的查询顶点，在指定的其他身体区域找最近的参考顶点。记 d 为“参考点减查询点”，结合参考表面法线 n 检查 d·n 是否为正，并用距离和两侧法线夹角过滤误报。于是模型拿到的是一组**有位置、有方向的穿入点**。公开实现分别检查臂手与头躯干、对侧臂手和双腿，以及各腿与头躯干；未穷举全部三角面或全部身体对。[式 14–16][cue] · [附录 A.2][detect] · [实际部位配对][pairs]

3. **把表面位移换成动作空间里的修正线索。** 用 J 表示“顶点位置对 z 的雅可比矩阵”。把已检测穿入点的 d 送回去，得到 **u = Jᵀ·(穿入掩码 × d)**。直观地说，如果改变 z 的某个分量能让许多问题顶点一起朝所需方向移动，它就会从这些顶点收到较强的反馈。源码用自动微分一次计算这个向量乘积，无需存整张雅可比矩阵。再把归一化后的 u 和原 z 一起送入小网络，预测残差 Δz。推理只做一次这样的学习式修正；单靠一阶方向无法确定全身唯一正确的姿势。[式 17–20][cue] · [自动微分与残差预测][gradcode]

4. **让解码器分得清手厚还是胳膊粗。** 对静止网格的每个顶点，用其位置和法线提取特征，再用蒙皮权重的转置沿顶点归一化、加权汇总。主要受腕关节影响的那些顶点，就为腕附近的形状提供更多信息。每个目标关节因此有自己的形状偏置 b。最后，冻结的目标解码器同时接收 **z + Δz** 和**目标关节特征 + b**。蒙皮权重在这里用两次：先驱动表面变形，再将表面形状归到关节。[式 21–23][refine] · [逐关节聚合实现][shape]

### 一个完整例子

看原文图 6 第一行：源角色把双手举到脸前，目标角色换成了戴大帽子的孩子。图中能看到手掌相交、双手分开以及仍靠近面部的不同结果。以下把这个动作代入算法，作者没有公布该帧各关节的具体修正角度。[放大原文图 6][fig6]

| 走到哪一步 | 此时模型手里有什么 | 这一步决定什么 |
|---|---|---|
| 初次重定向 | 源关节动作、目标骨架和该帧 32 维 z | 得到目标双肩、肘、腕的初始姿势，双手大致到达面前。 |
| 蒙皮与检测 | 目标网格有 V 个顶点，受 J 个目标关节的绑定权重影响 | 找出左手哪些点进入右手表面，并给出从查询点到参考表面的局部位移。 |
| 回传与修正 | 顶点空间的位移汇总为与 z 等宽的 32 维线索；静止网格另提供关节体形特征 | 小网络学习怎样调整原姿势，修正可分摊到肩、肘、腕，算法不会把手腕指定为唯一可动关节。 |
| 二次解码 | 修正后的动作向量和目标关节特征 | 输出仍可驱动原绑定的关节运动。看片时应同时检查掌面是否穿入，以及双手是否仍在脸前靠近。 |

### 训练与推理

第一阶段从 ACCAD、LaFAN1、Mixamo、PFNN、SFU、TotalCapture 准备动作，对每段从 91 副骨架中随机抽取 5 副作目标，使用 MotionBuilder 生成配对参考，共 13.85 小时。训练 300 个 epoch，损失覆盖旋转、位置、根运动、平滑、接地及表示对比。第二阶段只用其中的 Mixamo 子集与 7 个有蒙皮网格的角色，冻住整个运动学主干，训练 3 个小网络 200 个 epoch。保留重建、平滑和接地项，并惩罚修正后仍检测到的穿入以及过大的残差。两个阶段在一张 RTX 6000 Ada 上分别耗时 7.5 和 11 小时，共约 **18.5 GPU·小时**。[§4.1.1][setup] · [几何损失，式 24–26][loss] · [附录 A.3][data]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**先单测骨架。** 表 1 对每个目标测试 95 段未参加训练的 Mixamo 动作。固定结构允许骨长不同，任意结构还允许关节数和父子层级不同。固定组用 4 个已见和 10 个未见目标；任意组各有 91 个。这里只测运动学主干 Ours-Kin。下表节选未见角色。JR 是旋转误差，JP 是全局关节位置误差，FS 测接触时的脚滑。[原文表 1][t1] · [测试设置][kinexp]

| 未见角色与方法 | JR（rad）↓ | JP（cm）↓ | FS ↓ |
|---|---:|---:|---:|
| 固定结构 · SAME | 0.2754 | 10.6295 | 0.0104 |
| 固定结构 · R2ET-Kin | **0.1096** | 7.5617 | 0.1414 |
| 固定结构 · 本文主干 | 0.1565 | **5.0958** | **0.0026** |
| 任意结构 · SAME | 0.2789 | 9.1355 | 0.0143 |
| 任意结构 · 本文主干 | **0.1579** | **4.5406** | **0.0089** |

**再测蒙皮后的穿插。** 表 2 使用另一套包含更多身体自接触的测试动作：102 段未见动作、7 个已见和 4 个未见的 Mixamo 蒙皮角色。为和 R2ET、STaR 比较，这组实验固定了骨架拓扑。MotionBuilder 用来生成目标运动参照，所以只给它报告几何指标。PR 是检测到穿入的顶点比例，PD 描述沿参考表面法线的穿入程度。两者都越低越好。[原文表 2][t2] · [§4.2.2][geoexp]

| 方法 | 已见 PR（%）↓ | 已见 PD ↓ | 未见 PR（%）↓ | 未见 PD ↓ | 未见 JP（cm）↓ | 未见 FS ↓ |
|---|---:|---:|---:|---:|---:|---:|
| MotionBuilder | 1.4981 | 1.6037 | 0.5142 | 1.4066 | — | — |
| SAME | 1.4270 | 1.6409 | 0.3791 | 1.3280 | 12.1477 | **0.0156** |
| R2ET | 1.1313 | 1.5134 | 0.2364 | 1.1317 | 13.7412 | 0.0888 |
| STaR | 0.8298 | 1.5058 | 0.2453 | 1.2868 | 26.6064 | 0.2739 |
| **本文完整方法** | **0.6434** | **1.4311** | **0.1674** | **1.0191** | **10.4406** | 0.0393 |

对未见角色，本文的 PR 比 MotionBuilder 低约 **67%**，比 R2ET 低约 **29%**。这个比例的分母值得留意：正文将 PR 描述为查询顶点的穿入百分比；公开表 2 脚本用检测出的穿入顶点数除以**全部有效、未填充的顶点数**，再乘 100。脚本里的 PD 对截为非负的法向位移取整体平均，和训练时只按穿入点数量归一化的惩罚项也有区别。表中的 0.1674% 不代表只有 0.1674% 的帧可见穿模。[论文指标定义][metrics] · [表 2 评估代码][eval] · [训练式 25][loss]

**观众是否更喜欢修正结果？** 20 位参与者观看 10 对源–目标动作、每对 5 种方法，共 50 段视频。下表是 5 分量表的平均分。MotionBuilder 的语义保留已有 3.965，伪影规避只有 3.115，正好说明“能看懂这个动作”和“皮肤表现可信”可以分开评分。[原文表 3][t3] · [用户研究协议][study]

| 方法 | 语义保留 ↑ | 伪影规避 ↑ | 整体质量 ↑ |
|---|---:|---:|---:|
| MotionBuilder | 3.965 | 3.115 | 3.420 |
| SAME | 3.685 | 3.325 | 3.400 |
| R2ET | 3.875 | 3.420 | 3.545 |
| STaR | 2.805 | 2.620 | 2.465 |
| **本文** | **4.275** | **4.385** | **4.295** |

### 消融实验

**只看身形，和看见实际穿入，有什么差别？** 表 4 在固定骨架的未见角色上，分别更改静止几何特征、按蒙皮权重聚合和雅可比反馈。单用静止几何时，各关节共享一个全身形状特征。[原文表 4][t4]

| 保留的组件 | PR（%）↓ | PD ↓ | JP（cm）↓ | FS ↓ |
|---|---:|---:|---:|---:|
| 只用全身静止几何 | 0.2258 | 1.1307 | 11.8455 | 0.0309 |
| 只用雅可比反馈 | 0.2328 | 1.1410 | **8.0256** | **0.0257** |
| 全身静止几何 + 雅可比反馈 | 0.1897 | 1.1028 | 12.7437 | 0.0296 |
| 静止几何按蒙皮权重分给关节 | 0.1956 | 1.0431 | 9.4648 | 0.0312 |
| **逐关节静止几何 + 雅可比反馈** | **0.1674** | **1.0191** | 10.4406 | 0.0393 |

在已经知道各关节体形的前提下，加上穿插反馈使 PR 从 0.1956% 降到 0.1674%，同时 JP 从 9.4648 升到 10.4406 cm，脚滑也上升。换句话说，模型确实为避免穿入而偏离了参考动作；是否值得这点偏离，要结合画面与任务要求判断。对骨架主干的单独消融中，在任意结构未见角色上，用可学习 token 代替池化使 JP 从 4.8084 降到 4.5406 cm；去掉对比表示损失则升至 5.0315 cm。[表 4][t4] · [表 5][t5] · [表 6][t6]

### 关键发现

**直接迭代优化能修得更干净，代价是时间。** 作者还固定其他参数，用 100 步 Adam 针对每个样本优化动作残差与关节偏置。在未见角色上，优化法在穿插和运动学误差上均更低，学习式方法的平均用时约为它的 1/108。作者在图 8 另展示了整体动作观感的差异。[表 7][t7] · [对照设置][opt]

| 固定骨架、未见角色 | PR（%）↓ | PD ↓ | JP（cm）↓ | 平均秒/样本 ↓ |
|---|---:|---:|---:|---:|
| 100 步逐样本优化 | **0.1265** | **0.7556** | **8.2005** | 98.7563 |
| 一次学习式修正 | 0.1674 | 1.0191 | 10.4406 | **0.9157** |

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把已经发生的错误当作输入。** 两个外形相同的角色做不同动作，需要同一份静止形状特征，却可能只有一帧发生手掌穿入。解码后检测让模型拿到这一帧特有的信号，也解释了为什么静态体形和动态反馈合用优于只看其中之一。[图 4][fig4] · [表 4][t4]
- **修正发生在动作空间，可以保留角色原有的绑定。** 作者还让源和目标取同一角色，演示修复原动画已有的穿插。这个例子剥离了换骨架的因素，展示出同一反馈机制也可以用于动画清理。该用途在论文中给出的是定性示例。[图 12][self]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **减少穿入与保留有意接触仍会冲突。** 手臂交叠、手贴腰或多处同时接触时，模型可能拉开本该相触的部位。图 13 展示了极端体形上的失败。当前检测使用部位配对、距离与法向筛选，较深的穿入可能漏掉，公开配对规则也没有检查左右腿彼此交叉。用它制作拥抱、交叉腿或手握道具的动画，应另做针对性的接触检查。[图 13][failure] · [附录 A.2][detect] · [部位配对代码][pairs]
- **能接收不同骨架，不等于任意拓扑的表面误差已经测过。** 表 1 支持不同关节数与层级下的骨架重定向。最后蒙皮效果在非对称手臂、LaFAN1、SMPL、RigNet 等角色上另有可视化，表 2 的穿插数字只来自固定拓扑。实际接入自定义角色还需提供网格、蒙皮权重与供检测使用的部位划分；公开预处理脚本含人形关节命名和分组规则。[图 10–11][ood] · [几何测试协议][geoexp] · [自定义角色预处理][prep]
- **耗时主要花在找穿入点。** 表 9 单测 64 帧序列，5,750 顶点时总耗时 0.0263 秒，其中检测占 55.51%；24,798 顶点时总耗时增至 0.5321 秒，其中 0.5153 秒花在检测，占 96.84%。这是整段组件计时，测试协议与表 7 的每样本对比不同，不能直接当作交互应用的单帧延迟。[运行时间表 9][t9]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **SAME、R2ET 与 STaR** 分别揭示了骨架运动和几何控制的差别。SAME 作为骨架基线，在表 2 未见角色上的脚滑低；R2ET 的旋转误差小；STaR 也利用身体部位之间的几何关系。本文的新意是让当前姿势上的穿入位移通过可微蒙皮，明确反馈到共享动作表示。对贡献大小，表 4 的同主干消融比方法间的总排名更有解释力。[§2][related] · [表 2][t2] · [表 4][t4]
- **Unified Conditional Flow** 通过切换同拓扑骨架条件来改角色比例，以目标骨架上的关节误差和接触指标检验结果。本篇进一步读取蒙皮后的表面，能发现“骨骼摆放合理、手掌却已穿进身体”的问题。两篇分别适合回答“身材变化后动作像不像”和“角色表面实际发生了什么”。[站内 Unified Conditional Flow 解读](/blog/siggraphasia2026-unified-conditional-flow/) · [本文几何检测][cue]
- **SATA** 通过关节功能描述和图编码学习跨拓扑表示，演示还包括跨物种迁移。本篇同样用固定宽度表示连接不同骨架，最具说服力的穿插实验集中在人形蒙皮角色。如果目标是让一个现有化身举手贴近脸部，本文提供了直接关联到目标表面的反馈；若还要精准触碰指定位置，则需另外输入接触目标并验证误差。[站内 SATA 解读](/blog/icml2026-sata/) · [本文任务与指标][metrics]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **出版与原文**　[会议日程][venue] · [ACM DOI][doi] · [arXiv 版本记录][abs] · [HTML 全文][html] · [作者 PDF 与附录][pdf]
- **复看方法和实验**　[骨架模型][fig3] · [蒙皮反馈][fig4] · [几何主表][t2] · [组件消融][t4] · [优化对照][t7] · [失败案例][failure]
- **演示与实现**　[作者项目][project] · [视频][video] · [官方仓库与权重说明][code] · [几何修正源码][gradcode] · [评估实现][eval]

</div>

[html]: https://arxiv.org/html/2609.06517v1
[abs]: https://arxiv.org/abs/2609.06517
[pdf]: https://seokhyeonhong.github.io/projects/kinematic-refinement/static/paper.pdf
[doi]: https://doi.org/10.1145/3842552
[venue]: https://sa2026.conference-schedule.org/presentation/?id=papers_1897&sess=sess131
[project]: https://seokhyeonhong.github.io/projects/kinematic-refinement/
[video]: https://www.youtube.com/watch?v=gpWf8LOA6eQ
[code]: https://github.com/seokhyeonhong/kinematic-refinement
[gradcode]: https://github.com/seokhyeonhong/kinematic-refinement/blob/cdadbfd188beb4030726b670cd21a2bdb82bff61/src/kinref/geo_model.py#L118-L148
[shape]: https://github.com/seokhyeonhong/kinematic-refinement/blob/cdadbfd188beb4030726b670cd21a2bdb82bff61/src/kinref/geo_model.py#L151-L166
[pairs]: https://github.com/seokhyeonhong/kinematic-refinement/blob/cdadbfd188beb4030726b670cd21a2bdb82bff61/src/utils/geo_utils.py#L93-L105
[eval]: https://github.com/seokhyeonhong/kinematic-refinement/blob/cdadbfd188beb4030726b670cd21a2bdb82bff61/src/task/geo_eval/table2.py#L25-L83
[prep]: https://github.com/seokhyeonhong/kinematic-refinement/blob/cdadbfd188beb4030726b670cd21a2bdb82bff61/src/preprocess/preprocess_mesh.py#L98-L145
[intro]: https://arxiv.org/html/2609.06517v1#S1
[related]: https://arxiv.org/html/2609.06517v1#S2
[rep]: https://arxiv.org/html/2609.06517v1#S3.SS1
[kin]: https://arxiv.org/html/2609.06517v1#S3.SS2
[fig3]: https://arxiv.org/html/2609.06517v1#S3.F3
[fig4]: https://arxiv.org/html/2609.06517v1#S3.F4
[cue]: https://arxiv.org/html/2609.06517v1#S3.SS3.SSS1
[refine]: https://arxiv.org/html/2609.06517v1#S3.SS3.SSS2
[loss]: https://arxiv.org/html/2609.06517v1#S3.SS3.SSS3
[t1]: https://arxiv.org/html/2609.06517v1#S3.T1
[setup]: https://arxiv.org/html/2609.06517v1#S4.SS1.SSS1
[metrics]: https://arxiv.org/html/2609.06517v1#S4.SS1.SSS3
[kinexp]: https://arxiv.org/html/2609.06517v1#S4.SS2.SSS1
[geoexp]: https://arxiv.org/html/2609.06517v1#S4.SS2.SSS2
[t2]: https://arxiv.org/html/2609.06517v1#S4.T2
[t3]: https://arxiv.org/html/2609.06517v1#S4.T3
[study]: https://arxiv.org/html/2609.06517v1#S4.SS2.SSS3
[fig6]: https://arxiv.org/html/2609.06517v1#S4.F6
[t4]: https://arxiv.org/html/2609.06517v1#S4.T4
[t5]: https://arxiv.org/html/2609.06517v1#S4.T5
[t6]: https://arxiv.org/html/2609.06517v1#S4.T6
[t7]: https://arxiv.org/html/2609.06517v1#S4.T7
[opt]: https://arxiv.org/html/2609.06517v1#S4.SS4.SSS3
[ood]: https://arxiv.org/html/2609.06517v1#S4.SS5
[self]: https://arxiv.org/html/2609.06517v1#S4.F12
[failure]: https://arxiv.org/html/2609.06517v1#S5.F13
[t9]: https://arxiv.org/html/2609.06517v1#S5.T9
[arch]: https://arxiv.org/html/2609.06517v1#A1.SS1
[detect]: https://arxiv.org/html/2609.06517v1#A1.SS2
[data]: https://arxiv.org/html/2609.06517v1#A1.SS3
