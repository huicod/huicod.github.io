---
title: "[arXiv2026] CAST：怎样从单目视频驱动不同骨架，哪些关节旋转能靠几何纠正？"
description: "从手肘弯曲和前臂拧转的区别，理解 CAST 如何沿骨架逐级纠正旋转；分别查看未见骨架、跨角色动画和单帧因果推理的证据。"
pubDate: "2026-11-26T19:15:00+08:00"
badge: "Paper"
tags: ["CAST", "GRACE", "单目动作捕捉", "跨拓扑重定向", "骨架动画", "旋转可观测性", "因果推理", "Blender", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML，含附录 A–G][html] · [原文 PDF][pdf] · [官方实现与演示][repo]

<details class="paper-meta"><summary>论文信息与阅读范围 · arXiv 2026</summary>

*CAST: Real-Time Motion Capture for Any Skeleton Topology*。作者为 Pu Pang、Zhongfei Qing、Ling-Hao Chen、Songnan Li、Hua Huang、Bo Hu。本文按 2026 年 10 月 10 日发布的 arXiv v1 解读；截至 2026 年 11 月 26 日，作者公开记录标为预印本。实验数字取自原文，另对照了开放仓库中的几何校正实现、训练及因果推理配置。此次未运行模型。[版本记录][record] · [核查的代码版本][commit] · [已发布的权重][weights]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给一段普通视频，再给一副可能和视频主角长得不一样的目标骨架，CAST 为这副骨架预测逐帧关节旋转。它还从画面另估每根骨头该指向哪里，从根往末端校正方向；只有一条子骨的地方能纠正摆动，绕骨轴拧了多少仍要靠网络判断。[任务定义][task] · [原文图 2][f2]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　固定人体骨架让每个输出位置都有既定含义。换成动物或自定义角色后，关节数量、父子关系、静止时的骨骼朝向都会变化。TopoCap 和 MoCapAnything V2 已经能接收用户给的骨架，从单目视频估计其动作。[相关工作][related] · [TopoCap][topocap] · [MoCapAnything V2][mca]

**现有痛点**　角色摆动手臂时，即使肘、腕各自的局部预测看起来合理，肩部朝向稍有偏差，沿肩、肘、腕逐级相乘后，手仍会落到错误的位置。只让网络输出一串局部旋转，很难指出这条链应该从哪里纠偏。[§4.1][theory]

**核心矛盾**　动画系统需要完整三维旋转，关节位置提供的几何证据却不总是够用。一支箭能告诉你前臂朝哪边，绕箭杆转动时，箭头朝向完全不变。如果几何求解器连这部分也强行决定，就可能把弯肘修对，却让手掌翻过去。[附录 A.2–A.3][observ] · [扭转失败示例][twist]

**本文目标**　同一模型处理两种任务。视频里就是目标角色时，希望还原原动作；给另一副骨架时，希望它能演出对应动作，推理时不用提供两副骨架的逐关节对应，也不用提供目标角色的参考动画。[§3][task] · [附录 D.3][eval]

**切入角度**　观察目标关节连出去的骨头。末端没有子骨，单链只有一根出骨，躯干等分叉点可能有多根方向不同的子骨。三种地方能支持的几何判断不同，可以在看到视频之前根据静止骨架先分析。[式 3–6][theory]

**核心 idea**　网络同时估局部旋转和相机坐标下的骨方向，再让 GRACE 比较「旋转组合后指向哪里」与「网络从图像判断应指向哪里」。方向可靠时多修，两者证据很弱时保留原预测。子节点在已经修过的父节点上继续计算。[图 2][f2] · [GRACE，式 7–8][grace]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

两路输入分别提供「画面在发生什么」和「我要驱动什么身体」。冻结的 DINOv3 编码视频，目标骨架的静止几何和父子关系生成每个关节的查询。经图像、骨架和时间注意力融合后，网络分头估计关节旋转与骨方向；GRACE 合并两路结果，输出整副目标骨架在各帧的局部旋转。[原文图 2][f2] · [附录 B.1][arch]

<figure class="reading-figure"><a href="/paper-notes/cast/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/cast/architecture.svg" alt="CAST 从单目视频和目标静止骨架得到关节特征，分别预测局部旋转、骨方向和可信度。GRACE 从父到子对齐，再用正向运动学得到目标骨架动作。" /></a><figcaption>依据原文图 2 和附录 B 绘制的教学示意。读图时，先追踪同一关节的两种方向估计，再看父关节的修正如何传给子关节。点击可放大。</figcaption></figure>

### 关键设计

1. **让目标骨架的每个关节去读视频。** 设视频有 T 帧、目标有 J 个关节。静止骨架提供 J 个查询，重复到每一帧后，依次读画面特征、同帧其他关节、同一关节的前后帧。奇数层的骨架注意力只看自己和祖先，偶数层可看所有有效关节。最后一层这三个阶段各有一份 T × J × D 表示，沿通道拼接为 T × J × 3D 的共享特征。视频源角色的关节编号无需与目标逐项配对。[附录 B.1，式 29][arch]

2. **为每根骨头保留两条估计路径。** 第一条路用目标静止姿态调制旋转解码器，预测每个关节的 6D 旋转残差，与静止旋转组合，得到初始局部旋转。把它乘到父节点朝向上，就能算出其子骨在相机坐标中应指向哪里。第二条路读取父、子两端特征和骨几何，直接预测同一根骨在相机坐标中的单位方向和可信度。这样即使祖先预测有偏差，第二条路仍有机会给出纠偏信息。这里的「全局」指相机坐标系。模型输出旋转，用正向运动学可还原以根为中心的各关节位置；角色根节点在场景中的平移需另外估计。[图 2][f2] · [坐标约定][coords]

3. **先判断骨方向能约束几个自由度。** 若一个节点没有子骨，方向约束为零；只有一根或多根共线的子骨时，方向能约束两个自由度，留下绕轴扭转；有至少两根不共线的子骨时，理想、相容的方向可唯一确定三维朝向。近乎共线时，对微小方向噪声很敏感。作者把这里的可观测性限定在「出骨方向能提供什么」；图像纹理仍可能帮助网络推断扭转。[§4.1][theory] · [附录 A.2][observ]

4. **沿树递推，在可信的角度上修正。** GRACE 先取「已修正父旋转 × 当前初始局部旋转」。如果有多根可信且几何条件良好的子骨，就以可信度为权重，用 Kabsch 对齐一次求出修正旋转；条件不足时沿最可信的方向做最小摆动，完全没有方向支持就保持原朝向。另一个门控根据特征、方向分歧和骨架几何，把建议的修正角缩小到 0 至 1 倍。修正后的朝向传给下一层，最后换算回父节点相对旋转。这样既能用上祖先的修正，也允许网络保留证据不足的旋转分量。[式 7–8][grace] · [数值实现][numerical] · [作者实现][implementation]

### 一个完整例子

原文附录图 14 将同一源角色动作分别映射到五个目标角色。以下用其中所用的跨角色协议，举一个**抬臂的教学例子**，说明输出正确与否应该看哪里；具体姿势和误差数值见论文原图和原表。[跨角色结果图 14][f14] · [评测协议][eval]

| 步骤 | 换一个前臂更长的目标角色，会发生什么 |
|---|---|
| 读入 | 提供源角色视频和目标角色的静止骨架。目标自己的骨长和层级保持固定，不需要先标注「视频中的肘对应目标的第几号关节」。 |
| 两条路预测 | 网络给出目标肘的初始局部旋转，同时预测目标肘到腕在相机坐标中的方向。父层肩膀修正后，重新计算前臂的当前方向。 |
| 局部修正 | 如果肘只有腕这一条子骨，GRACE 可以把前臂朝预期方向摆过去。即使对齐完全，手掌向上还是向下仍可对应同一肘腕向量，这部分保留网络的旋转判断。 |
| 交付与检验 | 用目标骨长做正向运动学（FK），得到目标腕的位置。长前臂会让它与源角色有不同的触及距离。定量评测比较的是目标角色的预测与该角色自己的 Mixamo 参考动画。 |

### 训练与推理

训练联合使用 Truebones Zoo 与 MObjaverse。DINO 冻结，动作预测和校正分支共同训练。作者用真实关节位置之差构造骨方向标签，预测角误差越大，训练给出的可信度目标越低。对最终校正后的旋转及其 FK 位置施加监督，另设辅助位置头学习关节位置和相邻帧位移；推理时跳过这个辅助头。主实验使用 4 张 A100、批大小 256、每段 81 帧、AdamW 训练 6,000 步。作者没有报告这次训练的墙钟时长。[§5.1][setup] · [式 9–12][loss] · [附录 B.4–B.5][train]

默认模型双向读取 81 帧。另有分别微调 3,000 步的关键帧补全模型，以及块长为 1、2、4 的因果变体。单帧版本缓存历史特征，不用等未来帧；块长 4 的版本可以利用块内其他帧，但要等该块收齐。仓库给出了离线推理脚本、因果权重和 Blender 插件；公开视频流程使用预先准备的前景遮罩，或通过 SAM2 生成。[§6.1][causal] · [作者推理说明][repo] · [单帧配置][config]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

原文表 1 分两种协议。匹配骨架评测中，视频主角与目标骨架相同；MObj Unseen 表示测试结构未见。Mixamo 跨骨架评测中，6 个角色各有 10 段源动画，每段搭配其他 5 个目标，共 300 个有方向的配对。该目标的 Mixamo 重定向动画只用于评分。下表保留主要方法与数据集，MCA V2* 是作者重新实现并用相同训练集训练的版本，TopoCap 使用官方权重。[表 1][t1] · [评测协议][eval]

| 任务 / 测试集 | 方法 | MPJPE ↓ | PA-MPJPE ↓ | MPJVE ↓ | CD ↓ |
|---|---|---:|---:|---:|---:|
| 同骨架 · Zoo | MCA V2* | 105.52 | 67.04 | 10.35 | 0.077 |
| 同骨架 · Zoo | CAST-B / CAST-L | 42.68 / **39.59** | 33.23 / **31.05** | 5.48 / **5.14** | 0.036 / **0.034** |
| 同骨架 · MObj Seen | MCA V2* | 94.38 | 58.62 | 16.71 | 0.071 |
| 同骨架 · MObj Seen | CAST-B / CAST-L | 55.39 / **52.19** | 32.92 / **30.91** | 9.73 / **9.10** | 0.043 / **0.041** |
| 同骨架 · MObj Unseen | TopoCap | 191.77 | 82.11 | 38.93 | 0.109 |
| 同骨架 · MObj Unseen | MCA V2* | 103.04 | 61.98 | 16.44 | 0.074 |
| 同骨架 · MObj Unseen | CAST-B / CAST-L | 79.21 / **74.63** | 46.52 / **44.21** | 10.73 / **10.19** | 0.057 / **0.054** |
| 跨骨架 · Mixamo | TopoCap | 363.59 | 154.72 | 57.20 | 0.174 |
| 跨骨架 · Mixamo | MCA V2* | 277.35 | 127.38 | 33.64 | 0.135 |
| 跨骨架 · Mixamo | CAST-B / CAST-L | 149.50 / **125.62** | 85.79 / **71.16** | 19.60 / **15.74** | 0.087 / **0.074** |

MPJPE 是平均关节位置误差，PA-MPJPE 额外逐帧做相似变换对齐。两者按目标静止骨架包围盒最长边归一化后乘 1,000，沿用基准的毫米记法；MPJVE 比较相邻帧位移，按同一口径记毫米/帧。CD 衡量两个关节点集的距离。四项都以根为中心，因此不评测角色在真实房间里的平移精度。[指标与单位][eval]

**实时性测到了哪一步？** 原文表 5 在单张 A100 上测量，包含冻结图像编码器和运动预测，排除视频采集与网格渲染。下表中离线值是一整次 81 帧前向耗时，在线单帧使用预热后的因果缓存。[原表 5][t5] · [附录 B.5][runtime]

| 模型与输入 | 30 关节 | 52 关节 | 89 关节 |
|---|---:|---:|---:|
| CAST-B，离线 81 帧 | 142 ms | 145 ms | 154 ms |
| CAST-L，离线 81 帧 | 186 ms | 189 ms | 201 ms |
| CAST-B，在线单帧 | 19.5 ms / 51.3 FPS | 18.5 ms / 53.9 FPS | 18.9 ms / 52.9 FPS |

### 消融实验

**保留主干，移除整套 GRACE。** 表 3 在同一个 CAST-B 容量下交叉比较两种视觉编码器。下列均为 MPJPE，数值越低越好。DINOv2、DINOv3 各自打开 GRACE 后，三列都改善；换视觉编码器本身在 Zoo 上却没有一致收益。[表 3][t3] · [附录 E.2][evidence]

| CAST-B 配置 | Zoo | MObj Seen | MObj Unseen |
|---|---:|---:|---:|
| DINOv2，关闭 GRACE | 49.58 | 64.56 | 93.32 |
| DINOv2，开启 GRACE | **42.41** | 57.34 | 83.15 |
| DINOv3，关闭 GRACE | 50.41 | 63.71 | 86.64 |
| DINOv3，开启 GRACE | 42.68 | **55.39** | **79.21** |

**改变可看的帧数。** 表 4 中，MObj Unseen 的 MPJPE 从双向密集输入的 79.21 变为单帧因果的 80.79、四帧因果的 79.62。改做缺帧补全，每 4 帧只观察 1 帧时为 85.93；每 32 帧只观察 1 帧时升至 118.54。两个实验分别检验等不等未来帧、画面观测有多稀，所用模型分别微调。[表 4][t4] · [§6.1][causal]

### 关键发现

1. **跨骨架确实单独测过。** 在 Mixamo 的 300 对上，CAST-L 与目标参考动作的 MPJPE 为 125.62，作者重训的 MCA V2 为 277.35。Zoo 和 MObj 之间更悬殊的拓扑迁移另有可视化；手头的 300 对定量证据来自这六个 Mixamo 角色。[表 1][t1] · [跨数据集可视化][transfer]
2. **骨架分数与观看者判断在这一批样例上一致。** 18 名参与者各为 20 组三选结果排序，360 次排序中 CAST-L 获得 63.3% 第一选票，TopoCap 为 19.7%，MCA V2* 为 16.9%。这是跨两种任务汇总的偏好，评分关注整体动画观感。[表 2][t2] · [用户研究协议][users]
3. **几何校正整体有收益，原因还可以拆得更细。** 同样用 DINOv3，MObj Unseen 上开启 GRACE 后 MPJPE 从 86.64 降到 79.21。作者没有逐项关闭方向监督、置信度门控或父节点递推，也没有按树深度分别测旋转误差。由此能确认整套模块有用，尚无法把差值全归给其中一项。[表 3][t3] · [附录 E.2][evidence]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把几何求解的权限说清楚了。** 同一个肘到腕向量，既是纠正前臂摆动的有力证据，也是解释「为什么手掌仍可能翻错」的反例。理论分析直接告诉动画师应当检查哪类错误。[附录 A.3][ideal] · [图 7][twist]
- **从跨角色目标本身来评分。** 给源角色换一副骨架后，源角色的关节位置已不适合作为答案。作者另取目标角色对同一动作的参考动画，使预测与参考有相同骨架，也保留了参照动作来自 Mixamo 重定向这一前提。[附录 D.3][eval]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **末端位置对了，表面仍会扭错。** 旋转叶节点不会改变任何骨架关节的位置，却能改变绑在上面的网格。附录图 7 里角色的整体姿态接近，头的轴向朝向仍出现偏差。若下游关心手掌翻转、头部朝向或蒙皮变形，需要另外评价朝向或表面。[图 7][twist] · [附录 F][limits]
- **固定骨长、只预测旋转。** 目标需提供有根的父子树及静止姿态。部分资产通过平移子骨改变父子间偏移来做拉伸，当前表示无法复现这种运动。输出也没有世界坐标下的行走根轨迹。[任务定义][task] · [坐标约定][coords] · [附录 F][limits]
- **从模型到实时角色，还有采集和渲染。** 论文给出单帧模型耗时及 Blender 实例。实际摄像头到屏幕的延迟还取决于采集、预处理、传输和渲染；帧率表没有测量这条完整链路。[原表 5][t5] · [Blender 附录][blender]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **MoCapAnything V2** 将视频估姿和角色旋转预测联合训练，是 CAST 改造的直接主干。CAST 增加了从视频预测骨方向、按目标层级校正旋转的环节。文中的 MCA V2* 表示作者在相同数据上重新实现及训练。[原项目][mca] · [CAST 对照设置][setup]
- **TopoCap** 同样从单目视频驱动未见拓扑，学习可跨骨架使用的运动先验。CAST 沿用了它的 MObj 划分及归一化评测口径，另外在 Mixamo 上引入目标角色的动作参考。[TopoCap 原文][topocap] · [CAST 评测协议][eval]
- **Motion2Motion** 的源输入已经是骨架动画，跨拓扑迁移时提供稀疏对应。CAST 的起点是视频和目标静止骨架。要区分两类难度，可以先问系统在推理时是否已经看到了源角色的三维运动。[Motion2Motion 站内解读][m2m] · [CAST 任务定义][task]
- **对角色动画的启发**　如果捕捉目标是让虚拟人准确翻掌，单独统计肘、腕位置误差会漏掉核心失败。可同时比较前臂方向、手掌法线和最终蒙皮画面，把每个评价指标对应到实际想传达的动作。这是从可观测性分析推得的评价建议。[附录 F][limits]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **论文与版本**　[arXiv 记录][record] · [HTML 全文][html] · [PDF][pdf]。
- **方法与实验**　[总架构图][f2] · [GRACE][grace] · [主实验][t1] · [消融][t3] · [单卡推理时间][t5] · [失败示例][twist]。
- **复现入口**　[作者代码与权重列表][repo] · [GRACE 实现][implementation] · [因果模型配置][config] · [公开权重][weights]。资料核查于 2026 年 11 月 26 日。

</div>

[html]: https://arxiv.org/html/2610.14856v1
[pdf]: https://arxiv.org/pdf/2610.14856v1
[record]: https://arxiv.org/abs/2610.14856
[repo]: https://github.com/fankewen/CAST
[commit]: https://github.com/fankewen/CAST/tree/095c4a6ce4f63254eaba1b51e6ecb436e322d996
[weights]: https://huggingface.co/CAST-mocap/CAST/tree/main
[implementation]: https://github.com/fankewen/CAST/blob/095c4a6ce4f63254eaba1b51e6ecb436e322d996/models/grace/observability_rotation_correction.py
[config]: https://github.com/fankewen/CAST/blob/095c4a6ce4f63254eaba1b51e6ecb436e322d996/configs/experiment/CAST_B_dinov3_causal.yaml
[related]: https://arxiv.org/html/2610.14856v1#S2
[task]: https://arxiv.org/html/2610.14856v1#S3
[f2]: https://arxiv.org/html/2610.14856v1#S4.F2
[theory]: https://arxiv.org/html/2610.14856v1#S4.SS1
[grace]: https://arxiv.org/html/2610.14856v1#S4.SS2
[loss]: https://arxiv.org/html/2610.14856v1#S4.SS3
[arch]: https://arxiv.org/html/2610.14856v1#A2.SS1
[coords]: https://arxiv.org/html/2610.14856v1#A2.SS2
[numerical]: https://arxiv.org/html/2610.14856v1#A2.SS3
[train]: https://arxiv.org/html/2610.14856v1#A2.SS4
[runtime]: https://arxiv.org/html/2610.14856v1#A2.SS5
[observ]: https://arxiv.org/html/2610.14856v1#A1.SS2
[ideal]: https://arxiv.org/html/2610.14856v1#A1.SS3
[setup]: https://arxiv.org/html/2610.14856v1#S5.SS1
[causal]: https://arxiv.org/html/2610.14856v1#S6.SS1
[eval]: https://arxiv.org/html/2610.14856v1#A4.SS3
[users]: https://arxiv.org/html/2610.14856v1#A4.SS4
[blender]: https://arxiv.org/html/2610.14856v1#A3
[t1]: https://arxiv.org/html/2610.14856v1#S5.T1
[t2]: https://arxiv.org/html/2610.14856v1#S5.T2
[t3]: https://arxiv.org/html/2610.14856v1#S5.T3
[t4]: https://arxiv.org/html/2610.14856v1#S5.T4
[t5]: https://arxiv.org/html/2610.14856v1#S5.T5
[twist]: https://arxiv.org/html/2610.14856v1#A4.F7
[evidence]: https://arxiv.org/html/2610.14856v1#A5.SS2
[limits]: https://arxiv.org/html/2610.14856v1#A6
[f14]: https://arxiv.org/html/2610.14856v1#A7.F14
[transfer]: https://arxiv.org/html/2610.14856v1#A7.SS4
[topocap]: https://arxiv.org/abs/2606.12153
[mca]: https://animotionlab.github.io/MoCapAnythingV2/
[m2m]: /blog/siggraphasia2025-motion2motion/
