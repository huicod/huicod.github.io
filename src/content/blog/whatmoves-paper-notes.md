---
title: "[ECCV2026] WhatMoves：画面里有三个人，怎样只让选中的那个人坐下？"
description: "把局部动作迁给指定主体，同时保留全景中的摄像机、遮挡与其他人物。结合区域内保真度、区域外泄漏和识别消融，拆解区域运动编码器。"
pubDate: "2026-11-26T21:05:00+08:00"
badge: "Paper"
tags: ["WhatMoves", "ECCV 2026", "局部运动表示", "视频动作迁移", "区域控制", "动作识别", "多主体", "轨迹监督", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML，含附录 A–C][html] · [原文 PDF][pdf] · [交互演示与视频][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · ECCV 2026</summary>

*What Moves? Localized Motion Representations for Compositional Scene Control*。作者为 Frank Fundel、Malek Ben Alaya、Thomas Ressler-Antal、Stefan Andreas Baumann 和 Björn Ommer，前三人共同第一作者，来自慕尼黑大学 CompVis 与 MCML。本文按 arXiv v2 正文与附录、公开代码和权重文件核对。v2 更新了表 4 的局部动作识别分数，下文采用更新值。论文中的生成实验和作者后来提供的生成接口采用不同的视频骨干，具体配置见下文。本次未运行模型。[会议论文][conference] · [作者机构记录][mcml] · [代码版本][repo] · [公开权重][weights]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给一段有人坐下的参考视频，再给一张有三个人的目标图，用户可以在两边各圈一个人，让指定的目标人物完成坐下动作。WhatMoves 用圈选区域说明“读谁”，仍让编码器观看完整视频，以周围的人、背景和镜头为参照判断这个人怎样动。[方法图 2][fig2] · [坐下案例，附录图 C.5][sit]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　DisMo 已经能从一段视频提取连续的运动向量，并让新角色继承参考表演。多人同框时，整段视频却只有一组全局表示。用户即使喜欢其中一个人的动作，也很难指定究竟由目标场景中的谁来表演。[相关工作][related] · [DisMo 独立解读][dismo]

**现有痛点**　把那个人裁出来，看似解决了选择问题，却切掉了判断运动的参照。仅看裁剪画面里逐渐缩小的人，很难分清是他在远离还是镜头在拉远。完整视频中地面和旁人的相对运动能帮助区分二者。[动机 §3.1][context]

**核心矛盾**　模型需要利用区域外的信息来解释区域内的运动；但如果把区域外所有动作都编进同一条向量，邻人的走动和镜头的平移也可能传给想控制的主体。[原文图 1][fig1] · [单主体迁移][attach]

**本文目标**　为用户选中的每个实体分别输出一串随时间变化的特征。给定源与目标区域的对应关系，同一个生成器能把一段动作交给指定对象，也能把不同视频的动作同时交给同一幅画面中的不同对象。[图 3][fig3] · [组合任务][compose]

**切入角度**　先从一帧和掩码形成“找谁”的内容向量，用它查询全片。训练时只对所选区域内采样点的后续轨迹评分，使模型必须从全片中挑出与当前实体有关的变化。[§3.2][reps]

**核心 idea**　把“这是哪个对象”和“这个对象正在做什么”设计成两个通道。迁移时沿用源对象的运动通道，换上目标对象的内容和空间位置，给视频生成器一个可区分的接收者。[图 2][fig2] · [条件构造式 1–2][gen]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

表示学习从整段 RGB 视频、一帧中的区域掩码以及训练用点轨迹开始。内容编码器按掩码聚合单帧外观，运动编码器用这个内容查询完整视频，轨迹解码器检验运动特征能否预测目标区域的后续位移。做视频迁移时，再把源运动与目标区域绑定，送入预训练视频生成器。[方法图 2][fig2] · [视频条件图 3][fig3]

<figure class="reading-figure"><a href="/paper-notes/whatmoves/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/whatmoves/architecture.svg" alt="WhatMoves 从区域掩码和单帧获得内容查询，读全视频提取逐区域运动；训练用点轨迹监督，将源运动和目标内容配对后生成新视频。" /></a><figcaption>依据图 2、图 3 和附录 A 重绘。先看掩码怎样选择查询对象，再看点轨迹在训练时如何监督它。生成时沿另一支把源运动分给目标区域。点击可放大。</figcaption></figure>

### 关键设计

1. **内容向量充当区域查询。** 共享的图像编码器先将每帧分成空间特征。内容编码器用一个可学习查询，经四层带掩码的交叉注意力，从单帧中聚合出每个实体的内容向量 c。把同一个 c 沿时间复制，放入运动编码器，与整段所有帧的特征交互，得到该实体各时刻的运动向量 m。这样，镜头跟着人物跑时，人物周围向后退的背景仍对编码器可见。[内容与运动编码器][reps] · [附录 A.1][arch]
2. **只为所选实体的未来轨迹计算损失。** 在源帧的掩码内采样点，用 TAPNext 获取这些点随时间的二维位置作为伪标签。解码器接收当前帧特征、点的起始位置、内容 c 和运动 m，预测未来几步相对起点的位移，仅在有效点上计算平方误差。内容另行提供，运动通道便少了一项记住人物衣服和初始位置的负担。这个解码器做确定性轨迹回归，视频扩散生成器是另一个模块。[轨迹监督][track] · [附录解码器实现][trackimpl]
3. **以目标身份和位置接收源运动。** 生成时，将源区域的逐时刻运动和目标区域的内容按通道拼接，按视频潜帧的时间尺度分组、映射。每个区域的条件 token 加入视频 Transformer 的自注意力。论文的 CogVideoX 设置中，时间位置取对应潜帧，空间位置取掩码质心，以三维旋转位置编码提示“何时、何处”；注意力仍可综合整幅画面。该位置偏置没有把区域边缘变成合成结果的硬边界。[式 1–2 与图 3][gen] · [附录条件对齐][alignment]
4. **一组对应关系负责一个动作接收者。** 组合两段参考时，分别提取两组源运动，与目标图的两个内容向量配对，再一起提供给同一个生成器。用户指定对应关系。公开接口按每组掩码内的区域索引进行匹配，支持不同长度的输入输出；长视频也可提供时序掩码来更新内容查询。[多区域实现说明][multiregion] · [公开使用接口][repo]

### 一个完整例子

附录图 C.5 中，参考人物在车站长椅前坐下，目标画面里有数人。用户希望靠左、戴安全帽的工作人员坐下，其他人保持场景中原有的状态。下列尺寸来自公开版，数值向量本身没有在原图中提供。[逐帧案例][sit] · [作者编码器接口][encoder]

| 步骤 | 模型或用户实际提供什么 |
|---|---|
| 在源视频中选择 | 在参考帧上标记将要坐下的人。运动编码器看见整段画面，包括长椅、人物与相机的相对关系，提取这个人的运动。 |
| 得到逐区域特征 | 以 8 帧、一个区域为例，公开编码器返回 5 个 384 维运动向量。一般输入 T 帧、K 个区域，运动形状为 B × (T−3) × K × 384，单帧内容为 B × K × 512。B 表示批大小。 |
| 指定接收者 | 在新图中标记戴安全帽的人，取他的内容向量和目标位置，与源人物的坐下动作配对。旁边的人可为上下文，无需把他们抠出图像。 |
| 观察输出 | 输出是一段 RGB 视频。图中 ATI 让人物出现穿地现象，DisMo 让其他人跟着动，WhatMoves 更成功地把屈身坐下交给了选中的人。这个比较是作者展示的例子；骨盆高度、椅面接触时间并未逐项测量。 |

### 训练与推理

预训练约 1,700 万段视频，其中 OpenVid-1M 约 100 万段，另有约 1,600 万段作者自收集的 YouTube 视频。附录表 A.1 给出 8 帧、256 × 256、每段 4 个掩码、每个解码步 256 条轨迹。正文和附录都写了 60 万步，批大小分别写为 128 和 64，文中未解释差异。论文主实验默认运动瓶颈为 768 维。公开检查点则在 8 帧窗口、约 6 FPS 的训练设置下，每窗口输出 5 个 384 维运动向量，编码器可以脱离生成模型独立使用。[正文设置][setup] · [附录表 A.1][train] · [数据构成][data] · [公开接口][encoder]

论文的生成实验使用 **CogVideoX-5B**，用 rank 128 的 LoRA 适配注意力和前馈层，25 帧、480 × 720、8 FPS。作者仓库发布的生成接口使用 **Wan2.2 I2V-A14B**，权重库列出区域运动编码器和该版本的适配权重。论文还展示了文字指定外观的例子，作者为此另行微调了不需要目标首帧的视频模型。下方主表数字来自论文设置。[论文视频微调][alignment] · [文本设置][textmode] · [公开代码][repo] · [模型文件][weights]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**把动作交给一个指定人物。** 作者从 MTBench 挑选源视频，用 SAM2 取主体掩码，以 Z-Image Turbo 制作有多个主体的目标首帧。区域内保真度比较源轨迹与目标主体轨迹，区域外泄漏比较源轨迹与其他主体轨迹，两者均基于跟踪点的 Chamfer 类匹配。两者之差为选择性。低层轨迹基线获得按源、目标掩码包围盒对齐的轨迹；DisMo 通过全局条件驱动场景。[评测协议][attach] · [轨迹基线的输入][trackbaseline] · [原表 1][t1]

| 方法 | 视频骨干 | 区域内保真度 ↑ | 区域外泄漏 ↓ | 选择性 ↑ |
|---|---|---:|---:|---:|
| ATI | Wan 2.1-14B | **0.8111** | 0.6108 | 0.2003 |
| WanMove | Wan 2.1-14B | 0.7438 | 0.5608 | 0.1830 |
| Tora | CogVideoX-5B | 0.7021 | **0.4738** | 0.2283 |
| DisMo | CogVideoX-5B | 0.6981 | 0.5604 | 0.1377 |
| WhatMoves | CogVideoX-5B | 0.7462 | 0.5158 | **0.2304** |

**从多段视频取动作，再组合到同一场景。** 原表 3 比较一条源运动应该落到哪个目标主体。全局 DisMo 没有按主体接收多条运动的管线，因此这张表只比较能接收多组条件的方法。[原表 3][t3] · [附录组合示例][combfig]

| 方法 | 时间一致性 ↑ | 区域内保真度 ↑ | 区域外泄漏 ↓ | 选择性 ↑ |
|---|---:|---:|---:|---:|
| ATI | 0.9634 | **0.7148** | 0.3857 | 0.3291 |
| WanMove | 0.9792 | 0.7059 | 0.4110 | 0.2949 |
| Tora | 0.9766 | 0.6520 | 0.3904 | 0.2616 |
| WhatMoves | **0.9831** | 0.6718 | **0.2604** | **0.4114** |

18 名参与者在 17 个案例上盲评。WhatMoves 在真实感、动作迁移质量与局部性、较少伪影三项的得票占比分别为 49.02%、36.60%、44.44%；DisMo 分别为 21.24%、26.80%、20.26%。其中第二项把“动作像”和“动对人”合并评分。[原表 2][t2] · [盲评细节][human]

### 消融实验

**究竟需不需要看没被圈到的区域？** 原表 4 在 A2D 多主体片段上选定一个演员，冻结表示，以带标注的近邻样本识别其动作，候选库排除同一演员实例。Accuracy 为 top-1，F1 为加权 F1（百分数）。这里的“零样本”描述冻结编码器的评测。[评测协议][a2d] · [原表 4][t4]

| 方法与可见上下文 | Accuracy ↑ | F1 ↑ |
|---|---:|---:|
| DINOv2，仅区域 RGB | 7.92 | 12.91 |
| V-JEPA2，仅区域 RGB | 14.04 | 21.67 |
| DisMo，仅区域 RGB | 27.24 | 38.96 |
| WhatMoves，仅区域 RGB | 27.98 | 39.21 |
| WhatMoves，全片作为一个查询 | 21.75 | 31.83 |
| WhatMoves，看全片、查询指定区域 | **33.90** | **46.43** |

**改变轨迹预测长度和运动维数。** 8 帧窗口内，作者分别训练预测未来 1 至 7 步的模型，每个变体 30 万步。SSv2 与 Jester 在预测超过 3 步时有所下降，因此选 3 步作为默认值。将运动瓶颈从 768 维压到 128 维，六个识别基准总体保持相近。这里比较的是动作识别表现，不能直接推出所有维数下生成画质相同。[附录图 B.1][ablen] · [附录图 B.2][abdim]

**检验特征中保留了多少外观。** 给训练用轨迹解码器额外提供内容向量后，从运动特征识别表演者身份更加困难。作者还冻结各模型的表示，训练一个探针从中重建原图。WhatMoves 与 DisMo 的 CLIP 相似度均为 0.53，WhatMoves 的 L1／LPIPS 为 0.27／0.69，DisMo 为 0.26／0.67。此处误差较高表示源外观更难恢复。[附录 B.3][abapp]

### 关键发现

1. **改进最容易在“动错了谁”上看见。** 多源任务中，WhatMoves 的区域内保真度低于 ATI 和 WanMove，但区域外泄漏显著降低。单目标下与 Tora 的选择性只差 0.0021，适合连同各分项和多源结果一起读。[原表 1][t1] · [原表 3][t3]
2. **“保留全景”与“指定实体”缺一项都会掉分。** A2D 上，给 WhatMoves 裁图会丢失参照，把整帧都当作查询又会混入其他人的动作。只有让模型同时看到全景并知道问的是谁，F1 才从 39.21 或 31.83 升到 46.43。[原表 4][t4]
3. **任务需要整体运动时，可改用整帧查询。** 全局近邻分类的 Jester 成绩为 72.8%，同协议 DisMo 为 69.8%；Diving48 上则为 17.1% 对 20.9%。使用同一个全局接口并不意味着每个任务都比专用全局表示更好。[原表 5][t5]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **训练的提问方式直接对应实际操作。** 预训练就用“这一区域的点之后去了哪里”给信号，因此推理时换个掩码，相同视频可以回答另一个主体的运动。区域选择发生在运动表示计算中，保留了查询对象之外的参照。[式 1 之前的轨迹目标][track]
- **同时测区域内和区域外。** 若镜头整体平移，某个目标的点也可能顺着参考方向移动。把其他主体的轨迹也测一遍，可以发现模型靠带动全场来获得的局部高分。这是相对全局视频相似度更贴近控制意图的检验。[局部迁移测试][attach]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

1. **“动对人”和“动作准确到厘米”是不同的测量。** 本文输出视频，监督和评测主要在二维轨迹与图像上进行。掩码指定动作接收者，无法直接给出手腕三维坐标、骨骼旋转或坐下时的椅面接触时刻。附录案例中的接触效果还需要专门的几何评测。[原表 1][t1] · [坐下示例][sit]
2. **多源组合依赖用户给对对应关系。** 接口按区域配对，论文实验为不同主体分别指定动作。若两条相互矛盾的动作同时分给同一只手，现有结果没有验证谁优先；两个主体之间的接触、遮挡后是否持续绑定也需要分别测量。[多源条件][multiregion] · [公开接口][repo]
3. **有未来上下文，同时存在配置边界。** 发布的编码器取 8 帧窗口产出 5 个有效时间位置，用到了后续画面。发布文档也建议视频生成接近适配器的 25 帧训练长度。时间上的连续特征适合分析片段，论文未以零前瞻流式动作捕捉为评测目标。[编码器发布说明][encoder] · [视频配置][repo]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **DisMo** 给动力学留出独立于源外观的通道，能把真人转头交给卡通浣熊。WhatMoves 延伸了这个问题：当同一画面里有几位候选对象时，怎样说明借谁的动作、交给谁？两者在本文相同视频骨干上的差异可直接对照表 1。[DisMo 独立解读][dismo] · [原表 1][t1]
- **ATI、WanMove、Tora** 使用更明确的点轨迹作为控制，论文把轨迹按源和目标区域的中心及尺度进行映射。若目标姿势和源相近，强几何线索可以带来较高的区域内保真；形态、起始姿势相距较大时，逐点要求也可能把目标拉入不合适的姿势。[基线协议][trackbaseline] · [附录单主体比较][onefig]
- **对动作理解的启发。** 一段视频可以保留同一份全景，却根据待识别对象生成不同表示。若目标是理解对话中某一人的手势，值得直接测试“只圈手、圈整个人、全帧查询”，并用其他人的同时动作作干扰。这里是可检验的延伸，本文 A2D 实验以演员和动作为单位。[局部识别协议][a2d]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **论文与发表记录**　[Springer 会议章节][conference] · [arXiv 全文 HTML][html] · [原文 PDF][pdf]
- **方法与实验**　[编码器和轨迹训练][reps] · [生成条件][gen] · [区域迁移主表][t1] · [局部识别][t4] · [补充消融][ablen]
- **开源与演示**　[作者项目][project] · [GitHub 固定版本][repo] · [权重文件清单][weights]

</div>

[html]: https://arxiv.org/html/2609.04383v2
[pdf]: https://arxiv.org/pdf/2609.04383v2
[conference]: https://link.springer.com/chapter/10.1007/978-3-032-37211-6_17
[mcml]: https://mcml.ai/publications/far%2B26/
[project]: https://compvis.github.io/WhatMoves/
[repo]: https://github.com/CompVis/WhatMoves/tree/5f89fea8dceb8463fb9c72a1ff478bf52ece0cb7
[weights]: https://huggingface.co/CompVis/WhatMoves/tree/daacfbfd9e840f0f9495ee38beee5882bac4e363
[encoder]: https://github.com/CompVis/WhatMoves/blob/5f89fea8dceb8463fb9c72a1ff478bf52ece0cb7/README.md#L186-L209
[dismo]: /blog/neurips2025-dismo/
[related]: https://arxiv.org/html/2609.04383v2#S2
[fig1]: https://arxiv.org/html/2609.04383v2#S0.F1
[fig2]: https://arxiv.org/html/2609.04383v2#S3.F2
[fig3]: https://arxiv.org/html/2609.04383v2#S3.F3
[context]: https://arxiv.org/html/2609.04383v2#S3.SS1
[reps]: https://arxiv.org/html/2609.04383v2#S3.SS2
[track]: https://arxiv.org/html/2609.04383v2#S3.SS2.SSS0.Px3
[gen]: https://arxiv.org/html/2609.04383v2#S3.SS3
[setup]: https://arxiv.org/html/2609.04383v2#S4.SS0.SSS0.Px1
[attach]: https://arxiv.org/html/2609.04383v2#S4.SS1.SSS0.Px1
[compose]: https://arxiv.org/html/2609.04383v2#S4.SS1.SSS0.Px2
[a2d]: https://arxiv.org/html/2609.04383v2#S4.SS2.SSS0.Px1
[t1]: https://arxiv.org/html/2609.04383v2#S4.T1
[t2]: https://arxiv.org/html/2609.04383v2#S4.T2
[t3]: https://arxiv.org/html/2609.04383v2#S4.T3
[t4]: https://arxiv.org/html/2609.04383v2#S4.T4
[t5]: https://arxiv.org/html/2609.04383v2#S4.T6.fig1
[arch]: https://arxiv.org/html/2609.04383v2#S1.SS1
[train]: https://arxiv.org/html/2609.04383v2#S1.T1
[data]: https://arxiv.org/html/2609.04383v2#S1.T2
[trackimpl]: https://arxiv.org/html/2609.04383v2#S1.SS1.SSS0.Px4
[alignment]: https://arxiv.org/html/2609.04383v2#S1.SS2
[multiregion]: https://arxiv.org/html/2609.04383v2#S1.SS2.SSS0.Px3
[trackbaseline]: https://arxiv.org/html/2609.04383v2#S1.SS3.SSS0.Px2
[ablen]: https://arxiv.org/html/2609.04383v2#S2.SS1
[abdim]: https://arxiv.org/html/2609.04383v2#S2.SS2
[abapp]: https://arxiv.org/html/2609.04383v2#S2.SS3
[sit]: https://arxiv.org/html/2609.04383v2#S3.F5
[onefig]: https://arxiv.org/html/2609.04383v2#S3.SS1a
[combfig]: https://arxiv.org/html/2609.04383v2#S3.SS2a
[textmode]: https://arxiv.org/html/2609.04383v2#S3.SS3a
[human]: https://arxiv.org/html/2609.04383v2#S3.SS4
