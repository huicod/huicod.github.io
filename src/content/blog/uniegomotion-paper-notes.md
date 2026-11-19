---
title: "[ICCV2025] UniEgoMotion：从第一视角重建、预测和生成佩戴者的全身动作"
description: "同一副眼镜，整段视频、前两秒视频和单张照片能支持三种不同的推断。结合 EE4D-Motion 原表、EgoAllo 评测勘误和公开代码，读懂头部坐标、视觉条件与动作扩散。"
pubDate: "2026-11-19T12:10:00+08:00"
updatedDate: "2026-11-19"
badge: "Paper"
tags: ["UniEgoMotion", "Egocentric-Motion", "Motion-Reconstruction", "Motion-Forecasting", "Motion-Diffusion", "SMPL-X", "EE4D-Motion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 阅读版（arXiv v2，含附录）][html] · [原文 PDF][pdf] · [ICCV 会议记录][venue] · [作者项目与演示][project] · [代码][repo] · [权重与数据][data]

<details class="paper-meta"><summary>论文信息与阅读范围 · ICCV 2025 · 第一视角人体动作</summary>

*UniEgoMotion: A Unified Model for Egocentric Motion Reconstruction, Forecasting, and Generation*。作者为 Chaitanya Patel、Hiroki Nakamura、Yuta Kyuragi、Kazuki Kozuka、Juan Carlos Niebles、Ehsan Adeli，来自斯坦福大学、松下控股及 Panasonic R&D Company of America。发表于 ICCV 2025，页码 10318–10329。[会议记录][venue] · [作者项目][project]

本文依据 2025 年 10 月 16 日的 arXiv v2，核对了表 1–3、附录 A–G、作者对 EgoAllo 评测的公开更正及代码版本 580c92c。数字为作者报告。本次检查了代码、数据和权重发布入口，未运行模型。[版本记录][abs] · [评测更正][issue] · [源码快照][snapshot]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

UniEgoMotion 学的是**佩戴摄像眼镜的那个人怎么动**。给它整段画面和眼镜轨迹，它估计刚才发生的全身动作。只保留开头两秒，它能续写后六秒。只留第一张照片，同一模型也能从场景里采样一种可能的八秒动作。[原文图 1、§3.1][html]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 头显可以通过视觉惯性 SLAM 记录眼镜在空间里的位置和朝向。以往的第一视角动作重建方法已经能用头部运动推断部分身体姿态。另一类场景条件动作生成方法可以借助三维房间、物体网格或点云推断动作。

**现有痛点：** 眼镜经常拍不到佩戴者的腿，头部轨迹也无法说明他在操作什么。面对自行车时，低头可能意味着蹲下修车。相似的头部运动放在球场，可能是俯身运球。摄像眼镜拍到了这一区别，单用轨迹会将它丢掉。

**核心矛盾：** 画面传递“面前有什么”，设备轨迹传递“头走过哪里”。两者都只间接描述四肢。对于已发生的动作可以检查逐帧误差，对于未来动作，同一张图往往容许好几种合理的续写。

**本文目标：** 用同一套参数完成已观测动作重建、从部分观测预测未来，以及从一张图生成全身动作。三种任务都使用佩戴设备能提供的信息，测试时无需显式三维场景或动作指令。

**切入角度：** 三种问题都可以写成“给定目前可见的画面和轨迹，采样完整动作”。改变条件可见的时间范围，就可以改变问题，而保留同一个学习人体运动规律的去噪器。

**核心 idea：** 把动作改写到以头部地面投影为基准的坐标系，方便用设备轨迹定位人体。让扩散模型逐帧接收轨迹并读取图像上下文，再把缺失观测换成可学习的掩码，输出一段连贯的三维全身动作。[原文 §3.1–3.5][method]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练时，作者有同步的第一视角画面、眼镜运动轨迹和通过多视角拟合得到的三维动作。去噪器从带噪动作预测干净动作，图像和设备轨迹从两条不同路径进入网络。推理时从随机噪声开始，三种任务的差别在于哪些时刻还有观测。[原文图 2][fig2]

<figure class="reading-figure"><a href="/paper-notes/uniegomotion/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/uniegomotion/architecture.svg" alt="UniEgoMotion 的数据构建、两路条件和扩散去噪，以及全序列、历史窗口、单帧三种观测方式" loading="lazy" /></a><figcaption>本站据论文图 2、图 7 和作者代码重绘。先看训练时从哪里取得全身动作，再沿图像、设备轨迹两条支路进入去噪器，最后比较三种观测窗口。点击可放大。</figcaption></figure>

### 关键设计

1. **把身体姿态和人在地上的行进拆开。** 每一帧都取一个参考系，原点在头部正下方的地面，保留头部的水平朝向，去掉俯仰、侧倾和离地高度。存下参考系相对上一帧的移动与转向，再存各关节在当前参考系里的位置与朝向。这样，人在另一处做同样的下蹲时，局部姿态仍然相似。解码时把相邻参考系依次接回去，便可恢复在空间里移动的人体。[原文 §3.5、附录 D][repr]

2. **把快速变化的设备运动与画面语义送进不同位置。** 连续的眼镜位姿转换为每帧 18 维的轨迹特征，投影后与同一时刻的动作特征相加。预训练 DINOv2 提取图像特征，训练时缓存，保留可训练的投影层。12 层 Transformer 解码器通过交叉注意力读取视觉特征，隐层宽度为 768。举例来说，轨迹提供低头的时间和幅度，画面则可能提供轮胎或球篮的线索。[原文 §3.4、附录 F][train] · [模型实现][model]

3. **同一个去噪器接受三种观测窗口。** 重建保留全部画面及轨迹，预测只开放历史帧，单帧生成只开放首帧图像，整段设备轨迹均被遮住。论文将训练概括为等概率模拟重建与生成两端。发布实现对每路条件分别随机采样掩码，因此也会遇到混合缺失。标准预测入口用历史条件直接采样整段。论文还描述了可选的 RePaint 做法，先重建历史身体动作，第二次采样时逐步覆盖已重建的前缀。[原文 §3.3][method] · [条件掩码][model] · [评测入口][eval] · [采样实现][sample]

4. **用场外摄像机制作训练标签。** EE4D-Motion 源自 EgoExo4D。首先在多个外部视角追踪眼镜佩戴者，利用二维关节和人体网格模型初始化三维姿态。随后拟合 SMPL-X，使三维关节投回各视角时与二维检测一致，再在序列上固定体型并抑制抖动。作者共获得 208 小时同步动作和视频，筛除严重遮挡、拟合抖动等片段后保留约 110 小时。外部机位承担训练数据制作，实际模型预测只用第一视角输入。[附录 G][dataset]

### 一个完整例子

原文图 4 展示了一个人蹲下修自行车轮胎。从这个例子可以看清“看到了什么”和“猜出了什么”。[作者预测示例][fig4]

1. 输入 2 秒历史，也就是 20 帧第一视角图像及相应的设备位置和朝向。轮胎等物体提供场景线索，眼镜的姿态变化提供运动线索。接下来的 60 帧没有视频和轨迹输入。
2. 为整个 80 帧窗口准备带噪动作，以历史视觉和轨迹为条件去噪。发布模型每帧有 **243 个连续数值**，包括 22 个关节的旋转与位置 198 维、平面参考系变换 9 维、双手姿态的主成分系数 24 维、双脚接触 2 维，以及体型 10 维。[表示实现][repcode]
3. 将预测结果还原为运动中的人体，读出后 60 帧，这是一种可能的下蹲维修动作。模型没有得到未来的真实膝角、车轮表面或手的目标点。可检查预测与参考动作有多接近，手是否实际触碰轮胎则需要另外测量。
4. 若只保留第一张照片，任务变成单帧生成。若提供全程 80 帧图像和设备轨迹，任务变成对刚才那次维修动作的重建。三次使用相同参数，所依据的证据量不同。

### 训练/推理

EE4D-Motion 沿用 EgoExo4D 的拍摄段落划分，防止同一拍摄段的重叠时间窗跨到验证集。窗口是 8 秒、10 Hz。训练每 2 秒取一窗，约 14.3 万个样本。验证每 20 秒取一窗，约 4,400 个样本。三项任务在同一模型上评估。[原文 §4][exp]

扩散训练给干净动作加高斯噪声，要求模型预测原来的动作向量。附录 F 报告余弦噪声日程、1,000 个扩散步、AdamW、批大小 64、350 轮训练。作者缓存 DINOv2 特征，报告单张 NVIDIA L40S 训练约 2 天。该时长描述动作模型训练，不能据此估算采集、多视角拟合和视觉预训练的全部开销。[附录 F][train] · [训练配置][cfg]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**1. 重建。** 以下选自 v2 表 1，所有方法在同一 EE4D-Motion 划分上训练评估。MPJPE 是 22 个身体关节的位置误差，PA 是每帧对齐后的关节误差，单位均为米。足滑衡量脚靠近地面时的滑移，语义相似度比较预测与参考动作在 TMR 空间的特征。[原表 1][table1]

| 方法 | MPJPE ↓ | MPJPE-PA ↓ | 足滑 ↓ | 语义相似度 ↑ | FID ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| AvatarPoser | 0.116 | 0.068 | 7.85 | 0.872 | 0.082 |
| EgoEgo | 0.130 | 0.075 | 3.90 | 0.858 | 0.068 |
| EgoAllo | 0.163 | 0.071 | 4.10 | 0.885 | 0.043 |
| **UniEgoMotion** | **0.100** | **0.053** | **3.62** | **0.918** | **0.027** |

这些行都是作者在该数据集上的重训结果。AvatarPoser 的手跟踪输入被设为常量。EgoEgo 和 AvatarPoser 使用从动作标注导出的头轨迹。UniEgoMotion 使用设备轨迹。EgoAllo 的评测后来经过更正。最早的评测使用了真实根轨迹对齐，作者后来改为训练和评测一致使用设备轨迹，并列出新的完整结果。v2 表 1 保留上表所列的身体指标，省略基线头跟踪数值。比较头跟踪时应参考更正里的具体设置，不能沿用 v1 的旧排名。[附录 B][baselines] · [作者勘误及新旧对照][issue]

**2. 预测与单帧生成。** 以下选自表 2。预测先看 2 秒，生成后 6 秒，关节误差只考查第 2–4 秒。单帧生成输出 8 秒，关节误差只考查第 0–2 秒。足滑和 FID 来自原表对应任务，数值越低越好。两阶段基线先生成身体的根轨迹，再以它为条件生成姿态。[原表 2][table2]

| 方法 | 预测 MPJPE ↓（m） | 预测足滑 ↓ | 预测 FID ↓ | 单帧生成 MPJPE ↓（m） | 生成足滑 ↓ | 生成 FID ↓ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| LSTM | 0.238 | 7.23 | 0.058 | **0.216** | 6.83 | 0.090 |
| 两阶段基线 | 0.253 | 3.55 | **0.038** | 0.222 | 4.35 | **0.037** |
| UniEgoMotion | **0.206** | **2.60** | 0.047 | 0.226 | **2.89** | 0.043 |

单帧生成最能说明指标间的取舍。LSTM 与记录下来的那次动作更接近，UniEgoMotion 的脚在地面附近滑得更少，两阶段模型在特征分布 FID 上更好。输入只有一张图时，距离那一次真实未来更远，也可能是因为采样选了另一条合理的动作路径。

### 消融实验

**1. 改变同一个完整模型在测试时能看到的信息。** 以下摘自附表 3。拿掉轨迹后，全身在世界坐标中的误差升至 29.0 cm，而做过逐帧对齐的误差仅从 5.3 升到 5.9 cm。局部身体形状仍能由画面推断，全局位置和朝向更容易漂移。去掉单帧生成唯一的视觉条件，和参考动作的语义相似度明显下降。[附表 3][table3]

| 测试时可用条件 | 重建 MPJPE ↓（m） | 重建 MPJPE-PA ↓（m） | 重建双手关节误差 ↓（m） | 单帧生成语义相似度 ↑ |
| --- | ---: | ---: | ---: | ---: |
| 按各任务给足条件 | **0.100** | **0.053** | **0.180** | **0.817** |
| 去掉图像 | 0.115 | 0.066 | 0.234 | 0.696 |
| 去掉设备轨迹 | 0.290 | 0.059 | 0.352 | 0.816 |

单帧生成原本就不提供设备轨迹，最后一列的 0.817 与 0.816 不能解释为轨迹带来的增益。作者还单独重训了单一模态模型，仅用视频训练和评估时重建 MPJPE 为 0.299 m，仅用设备轨迹训练和评估时为 0.119 m。它们与上表“遮住输入但复用原模型”的两行是不同实验。[附录 C][cond]

**2. 更换网络、动作表示和图像编码器。** 下表节选主文表 1 的重建消融，每行改动一个设计。骨盆中心表示的全身误差增加明显。全局表示在本组数据上的 MPJPE 与头部表示相近。Transformer 编码器版本的 FID 更好，同时产生更大的关节误差，架构选择仍取决于使用目标。[表 1 下半部分][table1]

| 改动 | 重建 MPJPE ↓（m） | 足滑 ↓ | FID ↓ |
| --- | ---: | ---: | ---: |
| 完整模型 | **0.100** | **3.62** | 0.027 |
| 换成 Transformer 编码器 | 0.115 | 4.48 | **0.017** |
| 换成 1D U-Net | 0.145 | 5.86 | 0.019 |
| 使用全局动作表示 | 0.101 | 3.73 | 0.024 |
| 使用骨盆中心表示 | 0.166 | 3.66 | 0.030 |
| DINOv2 换成 CLIP | 0.107 | 4.03 | 0.021 |
| DINOv2 换成 EgoVideo | 0.132 | 4.73 | 0.041 |

### 关键发现

- **头轨迹主要约束全局定位，画面帮助恢复场景相关的肢体动作。** 完整模型遮掉图像时，身体 MPJPE 增加 1.5 cm，手部误差增加 5.4 cm。遮掉轨迹时，身体 MPJPE 增加 19.0 cm。两种传感信息提供了不同的证据。[附表 3][table3]
- **预测近两秒和生成整段是两种测量口径。** 表 2 的 0.206 m 对应看到两秒后的下一段两秒。论文生成六秒未来，但未用这个数概括全部六秒的逐关节误差。[表 2 表注][table2]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **通过改变同一窗口的已知信息，把三个任务放到可比较的位置。** 在一段维修视频上依次遮掉末尾画面和全部设备轨迹，就能从动作重建过渡到预测、再到场景条件生成。比较结果时，观测的时间覆盖范围和模态都可以说清楚。
- **局部姿势与全局路径可以分别诊断。** 设备轨迹缺失后，世界坐标误差和对齐后误差差距增大。仅看一个平均关节误差，会把“人体摆错姿势”和“姿势大致正确，但人物站错位置”混在一起。[附录 C][cond]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **场景线索并不足以确定人的意图。** 看见篮筐可能意味着投篮、运球或转身。训练没有显式的文本动作条件。模型也未求解场景碰撞、手与球接触、进球轨迹。TMR 分数对照的是预测与参考动作，无法单独证明手伸到了画面中那个物体。[附录 E][text]
- **地平面和数据质量会影响可用范围。** 动作表示以上下方向和地面为依据。数据管线排除了攀岩，保留的健身房、厨房和球场片段仍可能因人体离外部相机太远或遮挡而出现标签误差。文中的厘米差值包含对拟合伪真值的偏差。[附录 G][dataset]
- **研究结果针对离线的八秒窗口。** 实验给出固定前缀上的续写效果。在线头显所关心的持续运行时延、临时改变意图后的修正，以及长序列漂移，需要各自评估。

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **同样是预测迈下一步，已知条件可以完全不同。** UniEgoMotion 能看到起步前眼镜拍到的地面、眼镜的移动和朝向，还要由此推断佩戴者双腿的状态。Superman 的预测任务直接给出过去的三维骨架，接下来要预测的是已知姿势如何延续。两篇的预测误差对应不同的观测难度。[本站 Superman 解读](/blog/cvpr2026-superman/)
- **EgoEgo 与 AvatarPoser。** 这两种基线适合观察头部运动能约束多少全身姿态。论文统一了训练数据，同时对输入做了调整，尤其是 AvatarPoser 使用常量手部输入。应结合附录 B 来解释表 1 的差值。[基线设置][baselines]
- **EgoAllo。** 同样关注佩戴设备与人体姿态，但保留从设备、头部到骨盆的几何关系和骨架链。可以分别比较局部姿态是否合理、测得的设备轨迹与人体参考点是否对齐，以及是否使用了推理后的引导优化。论文的基线直接取扩散输出。原作者和复现作者就对齐方式的讨论解释了这一点。[两组作者的公开讨论][issue]
- **对第一视角角色驱动的启发。** 已经观测到的眼镜轨迹可以用来定位，尚未发生的手脚动作适合保留为多种候选。如果应用还要求手准确落到按钮或轮胎上，目标的三维位置和接触误差应单独建模、测量。这样可以分别评价跟踪准确度、动作自然度与交互成功率。

<span id="reading-8" class="reading-anchor"></span>
## 来源

- [ICCV 2025 会议记录][venue] · [开放获取 PDF][pdf] · [arXiv v2 全文与附录][html]。任务定义见 §3.1，架构与表示见 §3.3–3.5、图 2 和图 7，指标、主结果与消融见表 1–3。
- [项目页和运动演示][project] · [官方代码][repo] · [模型与数据下载][data]。代码库分别提供训练、三任务评测和验证集可视化入口。运行需要准备数据和 SMPL-X 模型。
- [作者的 EgoAllo 评测更正][issue] · [发布版本的任务掩码][taskcode] · [模型及扩散采样][sample]。材料核对日期为 2026 年 11 月 19 日。

[html]: https://arxiv.org/html/2508.01126v2
[pdf]: https://openaccess.thecvf.com/content/ICCV2025/papers/Patel_UniEgoMotion_A_Unified_Model_for_Egocentric_Motion_Reconstruction_Forecasting_and_ICCV_2025_paper.pdf
[venue]: https://openaccess.thecvf.com/content/ICCV2025/html/Patel_UniEgoMotion_A_Unified_Model_for_Egocentric_Motion_Reconstruction_Forecasting_and_ICCV_2025_paper.html
[project]: https://chaitanya100100.github.io/UniEgoMotion/
[repo]: https://github.com/chaitanya100100/UniEgoMotion
[data]: https://huggingface.co/datasets/chaitanya100100/uniegomotion/tree/main
[abs]: https://arxiv.org/abs/2508.01126
[issue]: https://github.com/chaitanya100100/UniEgoMotion/issues/2
[snapshot]: https://github.com/chaitanya100100/UniEgoMotion/tree/580c92c6d70a91672c4106bab30ca82cdd80f379
[model]: https://github.com/chaitanya100100/UniEgoMotion/blob/580c92c6d70a91672c4106bab30ca82cdd80f379/model/uniegomotion.py
[repcode]: https://github.com/chaitanya100100/UniEgoMotion/blob/580c92c6d70a91672c4106bab30ca82cdd80f379/dataset/representation_utils.py
[taskcode]: https://github.com/chaitanya100100/UniEgoMotion/blob/580c92c6d70a91672c4106bab30ca82cdd80f379/dataset/ee4d_motion_dataset.py#L230-L252
[eval]: https://github.com/chaitanya100100/UniEgoMotion/blob/580c92c6d70a91672c4106bab30ca82cdd80f379/eval/save_uem_preds.py
[sample]: https://github.com/chaitanya100100/UniEgoMotion/blob/580c92c6d70a91672c4106bab30ca82cdd80f379/module/uem_module.py
[cfg]: https://github.com/chaitanya100100/UniEgoMotion/blob/580c92c6d70a91672c4106bab30ca82cdd80f379/config/uem.yaml
[method]: https://arxiv.org/html/2508.01126v2#S3.SS3
[fig2]: https://arxiv.org/html/2508.01126v2#S3.F2
[repr]: https://arxiv.org/html/2508.01126v2#A4
[train]: https://arxiv.org/html/2508.01126v2#A6
[dataset]: https://arxiv.org/html/2508.01126v2#A7
[fig4]: https://arxiv.org/html/2508.01126v2#S3.F4
[exp]: https://arxiv.org/html/2508.01126v2#S4
[table1]: https://arxiv.org/html/2508.01126v2#S3.T1
[table2]: https://arxiv.org/html/2508.01126v2#S3.T2
[table3]: https://arxiv.org/html/2508.01126v2#A0.T3
[baselines]: https://arxiv.org/html/2508.01126v2#A2
[cond]: https://arxiv.org/html/2508.01126v2#A3
[text]: https://arxiv.org/html/2508.01126v2#A5
</div>
