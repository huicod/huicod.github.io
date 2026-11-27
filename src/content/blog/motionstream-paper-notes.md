---
title: "[ICLR2026] MotionStream：让视频跟着鼠标轨迹边画边生成"
description: "MotionStream: Real-Time Video Generation with Interactive Motion Controls。解读二维点轨迹、双向教师到因果学生的蒸馏，以及 29.5 FPS 与 0.39 秒各自衡量什么。"
pubDate: "2026-11-27T14:45:00+08:00"
badge: "Paper"
tags: ["MotionStream", "ICLR 2026", "视频生成", "轨迹控制", "流式生成", "因果蒸馏", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[HTML 阅读版][html] · [会议原文 PDF][pdf] · [作者交互演示与视频对照][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · ICLR 2026 Oral</summary>

*MotionStream: Real-Time Video Generation with Interactive Motion Controls*。作者为 Joonghyuk Shin、Zhengqi Li、Richard Zhang、Jun-Yan Zhu、Jaesik Park、Eli Shechtman、Xun Huang。研究方向为图像生成视频、二维轨迹控制与流式扩散。本文依据 ICLR 会议版本和 2026 年 3 月 5 日的 arXiv v5，实验数值均为作者报告。作者仓库截至 2026 年 11 月 27 日仅提供说明与演示图，README 表示代码仍在内部审查，尚无可独立运行的推理代码或权重。[会议记录][venue] · [版本记录][abs] · [作者仓库][code]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

给定一张首图、一句描述和用户不断更新的二维点轨迹，MotionStream 能边接收拖拽边生成后续 RGB 视频。它先训练一个能纵览整段轨迹的教师，再把教师蒸馏成只看开头和近期画面的学生。单张 H100 上，480P 学生配轻量解码器达到 29.5 FPS，每次输出一块新画面的模型延迟为 0.39 秒。[方法图 2][fig2] · [原表 A2][tiny]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**　可控视频扩散已经能让主体沿着给定路线移动。参考视频的点跟踪、根据相机位姿计算的像素位移、用户在画布上画出的路径，都能写成“这个点在各帧去了哪里”。[原文 §1–2][html]

**现有痛点**　离线方法通常要先备好整段轨迹，再等待多步去噪。用户看见大象走偏后才改变鼠标方向，此时后半段输入刚刚产生，离线生成器无法及时显示修正效果。[原文 §3.2][student]

**核心矛盾**　整段生成能同时观察过去与未来，较容易协调外观与运动。分块生成只看到当下，旧的视觉误差还会变成下一块的条件。保存全部历史则会使计算量随视频长度增加。[原图 3][attention]

**本文目标**　让新轨迹在下一块画面中生效，让用户能持续操作，同时尽量保住首图里的对象身份、背景外观和轨迹精度。[作者演示][project]

**切入角度**　作者检查视频模型的注意力，发现不少注意力头在较晚时刻仍集中于首图对应的 token。于是即使中间历史逐渐移出缓存，也给最初画面保留固定位置。[原图 3][attention]

**核心 idea**　训练时让教师学会轨迹与文字的联合引导，再让学生在自己生成的历史上接着画，按整段结果接受教师监督。交互时，学生反复使用同样大小的缓存，读入新点、生成新块并解码显示。[原文 §3][fig2]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

训练有两条相连的路径。第一条把训练视频交给 CoTracker3 得到对应点，教双向 Wan 模型在轨迹和文字条件下重建视频。第二条把教师的能力转移到因果学生。实际交互只需首图、文本和逐块到达的轨迹，学生预测视频潜变量，VAE 解码器把它变回 RGB 帧。[原图 2][fig2]

<figure class="reading-figure"><a href="/paper-notes/motionstream/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/motionstream/architecture.svg" alt="MotionStream 全流程。教师从训练视频学习轨迹条件，因果学生通过蒸馏获得参数。在线推理接收首图、文字和新到达的二维点，利用固定缓存分块生成并解码 RGB 视频。" /></a><figcaption>依据原文图 2、第 3 节及附录 A 重绘。点击可放大。</figcaption></figure>

读图时先沿轨迹分支看二维坐标怎样进入教师，再沿蒸馏分支找到学生。交互环路的关键在于上一块留下的缓存被下一块读取。教师参与训练。轻量 VAE 替换最后一步的像素解码器；附录表 A2 显示，解码加快，画面与参考视频的感知距离也略有增加。[原文 §3.1][teacher] · [附录 A][app-a]

### 关键设计

1. **让网络知道各帧中的哪些点是同一个点。** 训练从首帧 50 × 50 的网格出发跟踪，每段随机取 1,000–2,500 条轨迹。每条轨迹抽一个 ID，转换为 64 维正弦编码。在各帧下采样后的空间网格上，把同一向量填到该点当前可见的位置，其余位置填零。对网络而言，“出现在哪里”传达位置，“前后是否同一个向量”传达对应关系。轨迹编码头沿时间压缩 4 倍，再以 1 × 1 × 1 卷积投影，与视频潜变量沿通道拼接。微调阶段以 0.2 的概率遮掉随机的中途片段，让模型见过用户暂时松手的情况。[原文 §3.1][teacher] · [附录 D][train]

2. **把“往哪走”和“怎样动”交给两种条件。** 轨迹告诉教师屏幕上的点要往哪里，稀疏的拖拽常常不足以描述关节如何活动。文字可以引入迈步、形变等视觉先验。作者联合使用文本引导权重 3.0、运动引导权重 1.5。教师每次去噪需三次网络求值来计算联合引导，学生将这份引导学入权重，每个去噪步骤只求值一次，默认每块仍做三步去噪。[图 4、5][guidance] · [附录 C][interaction]

3. **让学生见到自己造成的误差。** 学生先拟合教师的去噪轨迹，适应少步采样和因果注意力，随后用自己生成的块连续向后滚动。将这些块按原时间顺序拼成一段，再让冻结的双向教师与学习学生样本分布的评分网络分别评分，用二者之差更新生成器。这样教师评分时仍能观察连续动作，学生训练时已经要承受前几块画偏的后果。[原文 §3.2][student]

4. **给开头和最近历史分配不同职责。** 默认配置 `c3s1w1` 表示每块含 3 个视频潜帧，保留 1 个开头块和 1 个最近历史块。开头块提供身份与场景参照，最近一块提供局部速度、姿态和纹理变化。旧块逐渐从键值缓存中移出，旋转位置编码依缓存中的位置分配。扩大生成长度时，每一步需要读取的历史量仍有上限。[原文 §3.2][student] · [原表 4][long]

### 一个完整例子

图 5 里，用户拖动大象，文本还要求背景中出现彩虹。首图先给出大象的轮廓与环境。拖拽给出部分图像点随时间的位移，轨迹头将每个点的位置和身份写成条件。教师的对照图显示，只加强轨迹时，大象容易像贴纸一样整体平移。加入文字后，模型在大致沿路前进的同时补出身体运动，并能在背景生成彩虹。在流式学生中，用户接下来改变方向，会影响尚待生成的块。已经显示的画面不回溯重算。最终得到的是大象的视频，系统没有输出可直接绑定角色的骨骼或脚掌接触时刻。[原图 5][elephant] · [作者演示][project]

### 训练与推理

**教师训练。** 从 VideoXFun 的 Wan 图生视频权重部分初始化。先在约 60 万个筛选后的 OpenVid 视频上训练 4,800 步，再用干净的合成片段微调。1.3B 版本使用 7 万个 81 帧片段、微调 800 步，5B 版本使用 3 万个 121 帧片段、微调 400 步。教师用条件流匹配学习从加噪潜变量恢复视频的速度场。[附录 D][train]

**蒸馏与部署。** 教师先产生 4,000 条 ODE 轨迹，学生用它们做 2,000 步因果适配，再做约 400 步分布匹配蒸馏。分布匹配阶段只用合成样本的首图、提示词和控制轨迹即可。作者报告 1.3B 教师约用 32 张 A100 训练 3 天，后续适配与蒸馏合计约 20 小时。推理速度单独在一张 H100 上测量。交互时可将完整 VAE 换成轻量解码器，原表 A2 给出了这一步的实际收益。[附录 D][train] · [原表 A2][tiny]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

**运动迁移重建，原表 1 节选。** DAVIS 验证集 30 段视频包含较多遮挡，Sora 子集 20 段视频的点通常较清楚。EPE 是可见输入轨迹与生成视频中重新跟踪出的轨迹之间的平均像素距离，统一缩放至 832 × 480 后计算。LPIPS 衡量与参考画面的感知距离。作者对各基线采用其适合的输入形式与配置。速度均在单张 H100 上测得，本表的学生使用完整 VAE。[原表 1][main] · [评测细节][metrics]

| 方法 | 输出档位 | FPS ↑ | DAVIS EPE ↓ | DAVIS LPIPS ↓ | Sora EPE ↓ | Sora LPIPS ↓ |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Go-With-The-Flow | 480P | 0.60 | 41.99 | 0.490 | 10.27 | 0.425 |
| Diffusion-As-Shader | 480P | 0.29 | 40.23 | 0.483 | 18.76 | 0.437 |
| ATI，14B | 480P | 0.23 | 17.41 | 0.473 | 6.12 | 0.366 |
| MotionStream，1.3B 教师 | 480P | 0.79 | **5.35** | **0.427** | **2.71** | 0.333 |
| MotionStream，1.3B 学生 | 480P | **16.7** | 7.80 | 0.443 | 4.21 | 0.360 |
| MotionStream，5B 教师 | 720P | 0.74 | 7.86 | **0.427** | 3.16 | **0.331** |
| MotionStream，5B 学生 | 720P | 10.4 | 11.18 | 0.438 | 4.30 | 0.343 |

**交互速度，原表 A2。** 保持同一个因果学生，只替换像素解码器。FPS 表示单位时间产出的帧数，块延迟表示等到一整块新画面的时间。两者共同决定拖拽后多快能看见反应，论文没有把浏览器与网络传输计入这些测量。[原表 A2][tiny] · [评测配置][metrics]

| 学生与解码器 | FPS ↑ | 每块延迟（秒）↓ | Sora LPIPS ↓ |
| --- | ---: | ---: | ---: |
| 1.3B，完整 VAE | 16.7 | 0.69 | 0.360 |
| 1.3B，Tiny VAE | **29.5** | **0.39** | 0.365 |
| 5B，完整 VAE | 10.4 | 1.14 | 0.343 |
| 5B，Tiny VAE | **23.9** | **0.49** | 0.349 |

**零样本相机控制。** 在 LLFF 上，作者用单目深度和已知相机运动构造二维点轨迹，再与实际目标视角图像比较。1.3B 学生获得 15.7 dB PSNR、0.38 SSIM 与 0.23 LPIPS，教师为 16.0、0.42、0.21。这项实验检验二维控制能否转化为合理的视角变化，构造评测轨迹时还使用了 COLMAP 的场景尺度信息。[原表 2][llff] · [评测细节][metrics]

### 消融实验

**轨迹编码。** 将“把轨迹画成 RGB 视频并送进 VAE”换成正弦点编码与可学习轨迹头，条件处理时间从 1,053 ms 降到 24.8 ms。DAVIS EPE 从 8.57 降到 6.54，Sora EPE 从 3.96 降到 3.13。这里计时的是轨迹表示环节。[原表 3][track-ablation]

**历史保留与分块。** Sora Extended 使用最长 241 帧、平均 194 帧的序列。去掉开头块，LPIPS 从 0.464 变为 0.501；将每块从 3 个潜帧改为 1 个，延迟降到 0.30 秒，EPE 却升至 76.21。原表 4 的完整配置对比如下。[原表 4][long]

| 历史与分块设置 | LPIPS ↓ | EPE ↓ | 每块延迟（秒，均值）↓ | FPS（均值）↑ |
| --- | ---: | ---: | ---: | ---: |
| 开头 1 块＋最近 1 块，每块 3 潜帧 | **0.464** | **25.34** | 0.70 | 16.92 |
| 去掉开头块 | 0.501 | 26.64 | 0.68 | **17.43** |
| 每块改为 1 潜帧 | 0.597 | 76.21 | **0.30** | 13.26 |
| 普通滑动窗口 | 0.480 | 28.09 | 0.80 | 14.96 |

**文本与点轨迹的引导强度。** 图 4 扫描两种引导权重，图 5 对比拖拽结果。单独强化运动引导有利于点对应，却容易退化成平面移动。增加文本引导后，自然形变改善。附录另比较每块去噪步数，作者观察到从三步减至两步有明显画质损失，继续增加步数的改善较小。[原图 4、5][guidance] · [附录 C][interaction]

### 关键发现

1. **从教师到学生，速度与轨迹精度做了交换。** 1.3B 的完整 VAE 配置从 0.79 提高至 16.7 FPS，约快 21 倍，DAVIS 上平均点误差同时从 5.35 升到 7.80 像素。29.5 FPS 还需要更换解码器。[原表 1][main] · [原表 A2][tiny]
2. **肉眼偏好与点精度衡量不同结果。** 作者就 Sora 子集收集了 2,800 次对视频画质的比较回答。14B 的 ATI 通常更受偏好，尽管其 EPE 高于 MotionStream。若用途是交互创作，最好分别看轨迹偏差与观看者对成片的评价。[附录 B][user-study]
3. **更快返回一个块，不一定让整段更流畅。** 单潜帧块有最低等待时间，却同时降低总吞吐并使长序列跟踪误差增大。对实时界面，只看单个 FPS 数字会漏掉这一点。[原表 4][long]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **一种控制接口支持三种用法。** 从视频跟踪得到的对应点可做运动迁移，从深度与相机位姿投影得到的点可做视角控制，直接拖拽的点可做交互编辑。三者共用同一轨迹头，下游生成器无需识别轨迹来自哪种设备。[原图 7][applications]
- **区别最初外观与近期运动。** 持续保存一份首图参照，给短历史窗口补上可能消失的身份信息。原表 4 把移除首块和缩短生成块分别测量，因而能看出两类信息各自的作用。[原表 4][long]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **大幅场景切换。** 固定开头块在同一环境内有助于保真，进入全新游戏场景时却容易把初始环境带回来。作者提出让参照块动态更新，现有结果只覆盖固定参照的系统。[附录 F][limits]
- **轨迹缺失与不合物理的拖拽。** 遮挡与用户主动松手在条件张量里都可能留下零值。随机遮挡微调可以缓解歧义，过快或极端的二维轨迹仍会引起形状扭曲和纹理闪烁。[原文 §3.1][teacher] · [附录 F][limits]
- **用于人体研究时的边界。** 输入点没有关节名、深度和足地接触状态，输出只含像素。作者报告的点误差与图像指标无法验证三维关节旋转、足部接触或骨骼可重定向性。若将其作为动画参考，这些需要另设实验。[评测协议][metrics]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **Motion Prompting。** 两篇都给跨帧轨迹分配可辨别的 ID。MotionStream 关注条件编码的耗时，让轨迹特征直接进入视频主干，并把原来整段优化的控制迁到在线生成。[Motion Prompting 原论文][motion-prompting] · [MotionStream §3.1][teacher]
- **Self Forcing。** 学生用自身生成历史续写，并接受整段分布监督的思路来自这项工作。MotionStream 把首块保留和缓存滚动也放进训练过程，直接针对短片训练后不断续写时出现的漂移。[Self Forcing 原论文][self-forcing] · [MotionStream §3.2][student]
- **MotionStreamer。** 这篇名称相近的 ICCV 2025 工作使用不断到达的文字生成三维人体动作序列。MotionStream 面对的在线信号是图像点的位移，最终渲染的是 RGB 画面。比较两者时，应先确定需要让用户改的是动作指令、像素轨迹还是三维关节。[本站 MotionStreamer 解读][motionstreamer] · [MotionStream 作者演示][project]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- 阅读版本和出处。[ICLR 2026 会议记录][venue] · [会议 PDF][pdf] · [arXiv v5 全文 HTML][html]
- 方法、交互实例与实验。[原图 2][fig2] · [原表 1][main] · [原表 3][track-ablation] · [原表 4][long] · [原表 A2][tiny]
- 官方发布状态与可观看结果。本页架构图为依据论文方法自行绘制的中文说明图。[项目页与演示][project] · [作者 GitHub][code]

</div>

[html]: https://arxiv.org/html/2511.01266v5
[abs]: https://arxiv.org/abs/2511.01266
[pdf]: https://proceedings.iclr.cc/paper_files/paper/2026/file/0cece806cd3d1dfad4a893f016ad3d7d-Paper-Conference.pdf
[venue]: https://proceedings.iclr.cc/paper_files/paper/2026/hash/0cece806cd3d1dfad4a893f016ad3d7d-Abstract-Conference.html
[project]: https://joonghyuk.com/motionstream-web/
[code]: https://github.com/alex4727/MotionStream
[fig2]: https://arxiv.org/html/2511.01266v5#S3.F2
[teacher]: https://arxiv.org/html/2511.01266v5#S3.SS1
[student]: https://arxiv.org/html/2511.01266v5#S3.SS2
[attention]: https://arxiv.org/html/2511.01266v5#S3.F3
[guidance]: https://arxiv.org/html/2511.01266v5#S4.F5.fig1
[elephant]: https://arxiv.org/html/2511.01266v5#S4.F5.fig2
[main]: https://arxiv.org/html/2511.01266v5#S4.T1
[llff]: https://arxiv.org/html/2511.01266v5#S4.T2
[track-ablation]: https://arxiv.org/html/2511.01266v5#S4.T3
[long]: https://arxiv.org/html/2511.01266v5#S4.T4
[applications]: https://arxiv.org/html/2511.01266v5#S4.F7
[app-a]: https://arxiv.org/html/2511.01266v5#A1
[tiny]: https://arxiv.org/html/2511.01266v5#A1.T2
[user-study]: https://arxiv.org/html/2511.01266v5#A2
[interaction]: https://arxiv.org/html/2511.01266v5#A3
[train]: https://arxiv.org/html/2511.01266v5#A4
[metrics]: https://arxiv.org/html/2511.01266v5#A5
[limits]: https://arxiv.org/html/2511.01266v5#A6
[motion-prompting]: https://openaccess.thecvf.com/content/CVPR2025/html/Geng_Motion_Prompting_Controlling_Video_Generation_with_Motion_Trajectories_CVPR_2025_paper.html
[self-forcing]: https://arxiv.org/abs/2506.08009
[motionstreamer]: /blog/iccv2025-motionstreamer/
