---
title: "[ICLR2026] EchoMotion：让视频里的人和三维骨架一起学会挥杆"
description: "同一句挥杆指令如何同时生成视频和 SMPL 动作？沿着双分支注意力与两条时间轴看 EchoMotion，并比较联合生成、给动作生成视频、给视频恢复动作三种设置。"
pubDate: "2026-11-26T18:23:00+08:00"
badge: "Paper"
tags: ["EchoMotion", "ICLR 2026", "视频与动作联合生成", "人体动作恢复", "SMPL", "流匹配", "多模态扩散", "HuMoVe", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML，含附录][html] · [ICLR 会议终稿 PDF][pdf] · [作者项目与动作示例][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · ICLR 2026</summary>

*EchoMotion: Unified Human Video and Motion Generation via Dual-Modality Diffusion Transformer*，作者为 Yuxiao Yang、Hualian Sheng、Sijia Cai、Jing Lin、Jiahao Wang、Bing Deng、Junzhe Lu、Haoqian Wang 和 Jieping Ye，来自清华大学、阿里巴巴、南洋理工大学和西安交通大学。论文发表于 ICLR 2026。本文以会议终稿核对实验，章、图、表链接指向 arXiv v1。作者已公开推理代码、动作提取流程和模型权重，未完整公开训练视频。本次查阅了实现，未运行模型。[会议记录][conference] · [官方代码][code] · [权重][weights]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给一句“球员在草地上挥杆”，EchoMotion 同时生成球员的视频和他的三维人体动作。画面与骨架在每次去噪时都能交换信息。训练时也让模型轮流只补全其中一路，于是同一模型还可以根据骨架拍一段新视频，或从给定视频估计人体动作。[架构图 2][f2] · [三种任务图 3][f3] · [挥杆示例图 7][f7]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文生视频模型能画出草场、衣服和球杆。已有动画方法还可以额外输入人体姿势，让生成的角色跟随一段已有表演。[相关工作 §2.2][related]

**现有痛点**　镜头和服装都自然，挥杆的人依然可能扭曲手臂。对视频生成器来说，大面积稳定的背景影响许多像素，但动作最关键的变化有时只发生在肘、腕附近。[原文图 1][f1]

**核心矛盾**　要学习关节如何在三维空间运动，训练数据需要提供可对齐的人体结构；用户从文字发起生成时，往往恰恰没有预先排好的三维动作。只会接受姿势条件的模型解决不了这个起点问题。[引言][intro]

**本文目标**　让一个模型既能从文字提出视频和人体动作，也能在获得一段动作或一段视频之后，生成与之相配的另一种表示。[图 3][f3]

**切入角度**　给每段单人视频配上逐帧 SMPL 人体参数和文本。这样，同一次转身在训练中有两份记录：一份记衣服、光影与运动投影，另一份记人体怎样转动。[HuMoVe 构建][data]

**核心 idea**　两种表示各有编码器和输出头，中间允许它们互相读取。同一个时刻用同一把时间尺标记，再改变哪一路可见、哪一路需要去噪，即可切换任务。[方法 §3.1][method] · [训练 §3.2][train]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

视频通过 Wan 的视频自编码器进入压缩空间；动作保持逐帧分辨率，以连续的人体参数进入动作分支。两路特征进入双模态 Transformer，共同计算注意力，再交给各自的输出头。联合生成时，两路都从噪声开始逐步更新；跨模态生成时，给定的一路保持可读，更新另一路。[模型图 2][f2] · [训练与任务图 3][f3]

<figure class="reading-figure"><a href="/paper-notes/echomotion/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/echomotion/architecture.svg" alt="EchoMotion 教学架构图。视频 VAE 和逐帧 SMPL 参数进入两条分支，以同步的位置编码在联合注意力中交换信息，两阶段训练支持联合生成、动作到视频、视频到动作。" /></a><figcaption>依据原文图 2、3 重绘。先看两路各自如何编码，再看联合注意力如何交换信息。最后按任务区分哪一路由用户给定、哪一路需要生成。点击可放大。</figcaption></figure>

### 关键设计

1. **把一个人的每帧动作展开成 51 个连续 token。** 作者按三类数值分别投影：三维位置（根与关节）、六维旋转表示、十维体形参数。每类使用自己的小型网络，输出头按类型读回连续参数。模型因此可以单独关注某一帧里的局部姿态，无须把整个动作压成一个离散编号。官方 5B 配置保留每帧 51 个 token，动作输入为 232 维，具体打包还包含根平移速度。[表示与式 1][method] · [公开配置][config] · [编码实现][encoder]
2. **在联合注意力里，画面能查骨架，骨架也能查画面。** 两路先用各自的权重产生查询、键和值，再沿序列拼接。这样，一个球员上半身的图像块可以读取不同时间的肩、肘旋转，动作 token 也能读取身体周边的视觉上下文。注意力之后再拆回两路，各自通过文本交叉注意力与前馈网络。动作 token 的编号区分参数组，但不直接规定某个肘关节必须对应图像中的哪个像素。[图 2(a) 与式 1][method] · [联合注意力实现][attention]
3. **MVS-RoPE 让两条速度不同的时间轴可以互查。** 视频在时间上压缩约四倍，动作保留每一帧。如果直接使用序号，视频潜帧 5 和动作原帧 5 会被当成同时发生。原文式 3 把原动作帧序号除以 4，因此动作第 20 帧与视频潜帧 5 落在同一个时间位置。空间上又将第 i 个动作 token 的坐标放到视频网格外，防止关节与图像块共用同一位置编码。这里对齐的是索引；生成的人和骨架是否真的做了同一动作，还要看输出。[图 2(b) 与式 2–3][method] · [时间注意力图 8][f8]
4. **用“哪一路保持干净”来改变推理任务。** 文本联合生成时，视频与动作都加噪。动作到视频时保留干净骨架，文字可规定人物外观和场景；视频到动作时保留干净视频，文中始终丢弃文本条件。任务标记告诉网络当前要预测什么，训练时有选择地丢弃条件，以便推理时分别调节文字、动作或视频的引导强度。[图 3 与式 4–6][train] · [推理实现][infer]

### 一个完整例子

沿用作者图 7 的高尔夫挥杆，下面三行说明同一个动作问题在不同入口会发生什么。第一行为论文联合生成案例，后两行用同一场景说明接口。[图 7][f7] · [双向补全实例图 9][f9]

| 任务 | 已知信息 | 一轮采样以及最终输出 |
|---|---|---|
| 从文字联合生成 | 一句描述球员挥杆的话 | 视频和动作各有一份带噪状态。联合注意力交换信息后分别更新，最后输出带外观的视频和可渲染的三维人体参数。 |
| 保留挥杆动作，换到室内练习场 | 一段挥杆 SMPL 序列和新的场景描述 | 干净动作在各轮可读，视频分支从噪声生成。场景和衣服可以改变，姿势跟随程度由实验衡量。 |
| 从实拍估计挥杆 | 一段球员视频 | 视频保持为条件，动作分支逐步生成 SMPL 参数。被身体遮住的手臂仍需模型推断。 |

公开脚本中，联合生成会输出画面视频和预测动作的网格渲染视频；动作分支内部保有数值张量。如需把它导入动画工程，需读取这些数值并另做骨架映射。球杆属于画面内容，模型给出的 SMPL 中不包含球杆姿态或握杆接触参数。[联合生成与保存][jointcode]

### 训练与推理

HuMoVe 约有 8 万组配对数据，覆盖 9 大类、38 个细类。作者先切分镜头，筛掉多主体和身体大量不可见的片段，再用 CameraHMR 逐帧估计人体参数并平滑，用 Qwen-VL-Narrator 生成文字。因而视频与人体参数虽共享时间轴，骨架监督的精度仍取决于估计器。[§3.3][data] · [附录 A.4][dataapp]

第一阶段冻结并停用视频分支，用 HuMoVe 的动作和 HumanML3D 训练动作分支 15,000 步。第二阶段激活并解冻两路，在 HuMoVe 配对数据上混合三种任务，再训练 12,000 步。文中的“1.3B / 5B”指 Wan 骨干规模。加入动作通路后，完整模型分别为 2.6B 和 7.5B，较大版本的 30 层中有 15 层采用双模态块。附录披露约 2,300 / 4,000 A100 GPU 小时，正文另将大模型训练描述为 32 张 A100、约 4 天，两个数是不同口径的近似值。公开实现提供 5B 骨干配置，权重库列出一份 DiT 检查点；论文比较的两个规模不能据此都算作已发布。HuMoVe 原始视频也未完整公开。[§4.1][impl] · [附录 A.9][settings] · [代码与数据说明][code] · [公开权重][weights]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**文字到人体视频。** 原文表 1 节选同一骨干下的对照。人体解剖和美学质量来自自动评测，后三列由人观看生成视频评分；均为越高越好。[原表 1][t1] · [评测协议][videoeval]

| 模型 | 人体解剖 ↑ | 美学质量 ↑ | 人评画质 ↑ | 人评指令符合度 ↑ | 人评姿态合理性 ↑ |
|---|---:|---:|---:|---:|---:|
| Wan 1.3B | 78.1 | 60.1 | 68.2 | 70.3 | 64.0 |
| 只用视频微调，1.3B | 77.4 | 59.7 | 69.3 | 73.2 | 65.5 |
| EchoMotion，1.3B 骨干 | 79.6 | 60.0 | 71.3 | 73.2 | 66.1 |
| Wan 5B | 83.0 | 58.3 | 72.8 | 78.9 | 68.9 |
| 只用视频微调，5B | 83.1 | 57.9 | 72.3 | 79.6 | 70.2 |
| EchoMotion，5B 骨干 | 85.1 | 58.3 | 81.0 | 81.5 | 81.6 |

**给定动作生成视频。** 附录表 4 节选 VACE-Benchmark 对照。Wan2.2-Animate 需要参考图，作者为它提供经图像编辑器处理的真值首帧，它没有文字输入，所以指令符合度留空。其余模型的输入也依各自接口提供。[原表 4 与比较设置][m2v]

| 模型 | 自动动作平滑度 ↑ | 人评指令符合度 ↑ | 人评姿态一致性 ↑ | 人评整体质量 ↑ |
|---|---:|---:|---:|---:|
| VACE-14B | 98.6 | 79.2 | 82.4 | 66.9 |
| Wan2.2-Animate-14B | 98.9 | — | 87.2 | 68.9 |
| EchoMotion，5B 骨干 | 99.1 | 78.2 | 82.2 | 65.2 |

**给定视频恢复动作。** 附录表 5 在 3DPW 测试集的 200 个样例上比较。MPJPE 衡量三维关节位置误差，PA-MPJPE 先做 Procrustes 对齐；单位为毫米。[原表 5 与协议][v2m]

| 模型 | 类型 | PA-MPJPE ↓ | MPJPE ↓ |
|---|---|---:|---:|
| SPIN | 专门重建 | 62.9 | 102.9 |
| HMR2.0 | 专门重建 | 58.4 | 91.0 |
| ChatHuman | 生成式 | 58.7 | 91.3 |
| EchoMotion | 生成式 | 59.8 | 94.1 |

### 消融实验

- **同批视频，只微调视频分支。** 5B 骨干上，人评姿态合理性从纯视频微调的 70.2 升到联合建模的 81.6，自动美学质量仅从 57.9 到 58.3。1.3B 骨干的相应姿态人评分从 65.5 到 66.1，模型规模会影响改善幅度。[表 1][t1]
- **去掉时间同步，或让位置编码重叠。** 图 8 中，去掉时间同步后，跨模态注意力原先对应 4∶1 时间关系的斜带变得分散。另在相同设置下各训练 1,600 步，把动作空间编号从视频原点开始时，画面出现结构崩解。作者给出的是注意力图与生成案例，没有逐帧同步误差数值。[图 8][f8] · [附录 A.8.1 与图 14][collision]
- **跳过动作预训练，或让两路共用投影。** 直接联合训练的流匹配损失下降更慢，最终也更高。另将两种模态的 Q/K/V 投影和前馈网络改为共享，损失高于保留两组参数的模型。原文用训练曲线展示这两项，未报告它们各自使姿态评分变化多少。[附录图 15][f15]

### 关键发现

1. **姿态评分比美学评分更能解释联合训练的收益。** 5B 骨干在加入动作分支后比原始 Wan 高出 12.7 个姿态人评分点，两者的自动美学分同为 58.3。数字支持的是用户能观察到的姿态改善。[表 1][t1]
2. **自生成的骨架与给定真骨架是两个测试。** 从文字共同生成时，模型可以共同选择画面和骨架；要求它服从外部给定动作时，EchoMotion 的人评姿态一致性为 82.2，略低于 VACE 的 82.4，也低于条件不同的 Wan2.2-Animate。前一种任务做得好，不能替代后一种对照。[表 4][m2v]
3. **视频反推人体提供了独立几何检验。** EchoMotion 的 94.1 mm 与 ChatHuman 的 91.3 mm 接近，专门重建方法 HMR2.0 为 91.0 mm。另有 50 条描述的动作生成人工评测，5B 版本在指令符合度上为 82.3，MotionGPT 为 72.3。两者训练数据不同，作者未作跨模型 FID 比较。[表 5][v2m] · [动作质量协议与表 6][motionq]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把同一动作的两种观测作为相互可见的生成目标。** 没有外部骨架时，动作分支也能参与视频去噪；已有骨架时，它又能成为外部控制的入口。数据构建、训练任务和推理接口彼此对应。[图 2][f2] · [图 3][f3]
- **复杂运动保留原帧率，视频仍享受压缩。** 方法用位置编码处理两路速率差，无须把每帧视频都展开成稠密特征。附录报告 5B 骨干版相对于纯视频模型的单次前向计算量约增加 10.3%；这是 FLOPs 比较，不能直接换算为实测生成耗时。[附录 A.10][cost]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **单人和固定人体模板。** 数据有意过滤多主体，动作头依据固定 SMPL 参数设计。作者将多人交互及逐人标注留给后续工作；对动画师给定的新角色骨架，还需另行验证关节对应与重定向。[作者局限讨论][limits] · [数据筛选][dataapp]
- **视频里的道具不在动作输出里。** 例如高尔夫球杆的朝向、双手握杆时刻、脚是否打滑，都没有独立控制量。姿态合理性是观看者评分，3DPW 测的是人体关节误差；若用于精确接触动画，仍需单独检验这些量。[图 7][f7] · [表 1][t1] · [表 5][v2m]
- **时间索引对应不能替代输出一致性测量。** 注意力图说明模型会利用同一时刻附近的信息，但要回答“视频里击球瞬间和 SMPL 相差几帧”，还需在生成视频上定位事件，与对应骨架逐帧比较。[图 8][f8]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **Wan** 提供预训练的视频外观与运动先验。原始 Wan、同数据纯视频微调和双模态模型构成直接实验对照，适合分清训练视频选择与加入骨架目标的作用。[原文对照][t1]
- **CameraHMR** 用于制作训练标签。EchoMotion 的视频到动作测试则由自己的生成分支执行；发布代码也另设了 CameraHMR 提取脚本，供用户用自有视频制作动作条件。[数据流程][dataapp] · [官方仓库][code]
- **Joints, Camera, Action!（JCA）** 同样把视频和动作成对生成，但把用户提供的角色骨架作为输入，面向不同绑定。EchoMotion 给定的是固定人体模板，两篇适合对照“随视频一起生成什么”和“输出骨架由谁指定”。[JCA 站内解读][jca]
- **启发。** 若研究目标是可编辑的虚拟角色，可分别验证“动作条件能否改变画面”“原本不要求改变的姿势是否保留”“两路输出在同一帧是否一致”。三种量测的是不同能力；EchoMotion 已给出动作条件实验和视频恢复实验，但精确的事件级编辑仍需另外设计测试。[双向生成实验][cross]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- [ICLR 2026 论文集][conference] · [会议终稿 PDF][pdf] · [arXiv 全文与附录][html]
- [作者项目与视频][project] · [官方推理仓库][code] · [公开模型文件][weights]
- [架构与位置编码][method] · [训练与三种条件设置][train] · [主实验][t1] · [消融曲线][f15]

</div>

[html]: https://arxiv.org/html/2512.18814v1
[pdf]: https://proceedings.iclr.cc/paper_files/paper/2026/file/a774503daed55eb53c634847ae071ec7-Paper-Conference.pdf
[conference]: https://proceedings.iclr.cc/paper_files/paper/2026/hash/a774503daed55eb53c634847ae071ec7-Abstract-Conference.html
[project]: https://yuxiaoyang23.github.io/EchoMotion-webpage/
[code]: https://github.com/D2I-ai/EchoMotion
[weights]: https://huggingface.co/Yuxiao319/EchoMotion/tree/main
[config]: https://github.com/D2I-ai/EchoMotion/blob/fed3a53de8d814418c7293ccba114ed4a8804c02/configs/echomotion_wan5b_config.py#L20-L30
[encoder]: https://github.com/D2I-ai/EchoMotion/blob/fed3a53de8d814418c7293ccba114ed4a8804c02/models/echomotion.py#L919-L955
[attention]: https://github.com/D2I-ai/EchoMotion/blob/fed3a53de8d814418c7293ccba114ed4a8804c02/models/echomotion.py#L438-L486
[infer]: https://github.com/D2I-ai/EchoMotion/blob/fed3a53de8d814418c7293ccba114ed4a8804c02/generate.py#L513-L551
[jointcode]: https://github.com/D2I-ai/EchoMotion/blob/fed3a53de8d814418c7293ccba114ed4a8804c02/generate.py#L309-L398
[intro]: https://arxiv.org/html/2512.18814v1#S1
[f1]: https://arxiv.org/html/2512.18814v1#S1.F1
[related]: https://arxiv.org/html/2512.18814v1#S2.SS2
[f2]: https://arxiv.org/html/2512.18814v1#S3.F2
[f3]: https://arxiv.org/html/2512.18814v1#S3.F3
[f7]: https://arxiv.org/html/2512.18814v1#S4.F7
[f8]: https://arxiv.org/html/2512.18814v1#S4.F8
[f9]: https://arxiv.org/html/2512.18814v1#S4.F9
[method]: https://arxiv.org/html/2512.18814v1#S3.SS1
[train]: https://arxiv.org/html/2512.18814v1#S3.SS2
[data]: https://arxiv.org/html/2512.18814v1#S3.SS3
[impl]: https://arxiv.org/html/2512.18814v1#S4.SS1
[videoeval]: https://arxiv.org/html/2512.18814v1#S4.SS2
[t1]: https://arxiv.org/html/2512.18814v1#S4.T1
[cross]: https://arxiv.org/html/2512.18814v1#S4.SS3
[limits]: https://arxiv.org/html/2512.18814v1#S5
[dataapp]: https://arxiv.org/html/2512.18814v1#A1.SS4
[m2v]: https://arxiv.org/html/2512.18814v1#A1.SS7.SSS2
[v2m]: https://arxiv.org/html/2512.18814v1#A1.SS7.SSS3
[motionq]: https://arxiv.org/html/2512.18814v1#A1.SS7.SSS4
[collision]: https://arxiv.org/html/2512.18814v1#A1.SS8.SSS1
[f15]: https://arxiv.org/html/2512.18814v1#A1.F15
[settings]: https://arxiv.org/html/2512.18814v1#A1.SS9
[cost]: https://arxiv.org/html/2512.18814v1#A1.SS10
[jca]: /blog/arxiv2026-jca/
