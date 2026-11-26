---
title: "[NeurIPS2025] DisMo：怎样把真人转头的动作借给一只浣熊？"
description: "从真人转头到卡通浣熊，沿着帧预测、连续运动向量与视频生成器，理解哪些运动能跨角色迁移，以及怎样检验源人物的外观有没有泄漏。"
pubDate: "2026-11-26T20:14:00+08:00"
badge: "Paper"
tags: ["DisMo", "NeurIPS 2025", "视频动作迁移", "运动表示", "外观解耦", "流匹配", "自监督学习", "视频生成", "动作识别", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML（含附录 A–I）][html] · [NeurIPS 终稿 PDF][pdf] · [作者项目与迁移动画][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · NeurIPS 2025 Spotlight</summary>

*DisMo: Disentangled Motion Representations for Open-World Motion Transfer*。作者为 Thomas Ressler-Antal、Frank Fundel、Malek Ben Alaya、Stefan Andreas Baumann、Felix Krause、Ming Gui 和 Björn Ommer，来自慕尼黑大学 CompVis 与 MCML。发表于 NeurIPS 2025 主会，作者项目标为 Spotlight。本文核对正文、附录、公开权重及推理代码。数字来自论文，本次未运行模型。[会议记录][conference] · [作者项目][project] · [核对的代码版本][repo]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给一段真人转头的视频，再描述一只刚睡醒的卡通浣熊，DisMo 能让浣熊从**它自己的起始朝向**转头。它从参考视频提取一串随时间变化的向量，把“怎样在动”交给新视频；角色的脸、身体和场景则可以由目标首帧或文字来定。[论文图 2][fig2] · [真人与浣熊逐帧对照，附录图 I][raccoon]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文字可以指定“浣熊醒来”，却很难交代头先朝哪边、何时回转、镜头有没有靠近。让用户直接给一段表演，能把这些变化一并交给生成器。[引言][intro]

**现有痛点**　已有方法容易把参考视频里的静态结构也带进结果。附录图 I 中，参考者穿着条纹上衣，有些基线连这件衣服的纹路都画到了浣熊身上。另一些结果画对了角色，却没跟上头部动作。[跨类别对照][raccoon]

**核心矛盾**　参考片里，演员的身份与动作总是同时出现。若只要求网络把画面重建得像，它可以靠记脸、衣服和初始姿势降低误差；这些信息恰恰会妨碍把同一动作给另一种角色。[方法 §3.2][learn]

**本文目标**　从普通视频学到能跨人物、视角乃至物种复用的运动表示。作者同时检验两件事：这份表示能否驱动另一个主体，以及只看它时，更容易识别演员做了什么还是识别演员本人。[动作迁移][transfer] · [身份与动作测试][ident]

**切入角度**　如果帧生成器已经看见当前画面，演员长什么样、周围摆着什么都可以直接读取。此时让另一条容量受限的通路帮助它预测未来画面，这条通路更值得记录的便是当前静帧里看不到的变化。[帧预测，式 2–4][frame]

**核心 idea**　用“当前帧＋短运动向量→未来帧”来训练提取器。再把同一运动向量接到视频生成器上，改用另一张图或另一段描述提供外观。训练与迁移使用了同样的分工。[图 2][fig2]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先看训练。提取器读一小段视频，为各个源时刻提取运动特征；帧生成器只拿到某个时刻的特征、该时刻的清晰画面和预测的时间跨度，学习画出后面的帧。再看迁移。现在清晰画面可以换成新角色，而驱动它的特征仍然来自原来的表演。[原文图 2][fig2] · [§3.3][adapt]

<figure class="reading-figure"><a href="/paper-notes/dismo/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/dismo/architecture.svg" alt="DisMo 先借未来帧重建训练运动提取器，再把提取的运动向量用于逐帧预测，或通过条件低秩适配器控制冻结的视频生成器。" /></a><figcaption>依原文图 2 重绘。先沿帧预测这一支看运动向量如何学出来，再看同一串向量怎样驱动新角色。两条生成路线可以分别使用。点击可放大。</figcaption></figure>

### 关键设计

1. **用时间查询，从整段画面提取局部变化。** DINOv2 先把各帧转成图像块特征，时空 Transformer 再让可学习的查询读取整段信息，输出和源时刻关联的连续向量。一个查询可以利用相邻帧判断“正在向左转”。它不是预设的“转头”类别，也没有“浣熊颈关节角度”这样的固定分量。论文主配置使用 DINOv2-B，公开的 Large 权重用了不同尺寸，见下方实例。[图 2(a)][fig2] · [架构配置][training] · [公开提取器][extract]

2. **让静帧承担外观，让短向量解释变化。** 设当前帧为 xₜ，其运动向量为 mₜ。训练时从同一片段选一张未来帧，生成器接收 xₜ、mₜ 和时间间隔 Δ。正文用流匹配描述如何从噪声还原未来图像。公开实现先用轻量自编码器将未来帧压缩，在潜变量上加噪并计算速度预测误差，最后才解码成 RGB。“速度”指从噪声走向目标表示的方向。这个学习信号同时训练动作提取器和帧生成器，全程不需要逐帧动作类别或骨架标签。[式 2–4][frame] · [公开训练与解码实现][framecode]

3. **把同一项增强施加在整段上。** 训练时可对驱动片段改变色调、亮度、裁剪位置、旋转或长宽比。同一段里的帧共用这次变换。比如整段平移一次，改变的是画面构图；若每一帧随机平移，就会凭空制造抖动，把需要学习的真实运动也改掉。增强和有限维度共同抑制源外观进入运动表示。[增强策略][aug] · [附录表 C][ablate]

4. **按时间把运动送进视频生成器。** 最简单的做法从新角色的首帧出发，每生成一帧便作为下一步的输入。更高画质的路线保留预训练视频模型，通过映射网络和条件低秩适配器，将相应时间段的运动注入该处的视频特征。以 LTX 为例，附录将约 24 FPS 的视频每四帧取一张给运动提取器，再依视频潜变量的时间分辨率组合特征；条件作用于注意力层和前馈层。它对齐的是时间位置，无需找出人脸和浣熊脸上逐点对应的像素。[两种推理路线][adapt] · [两种输出对照，图 3][fig3] · [LTX 的时间对齐][protocol]

### 一个完整例子

附录图 I 的驱动视频记录一名男子转头，目标文本描述床上的卡通浣熊逐渐醒来。下表沿着这一次迁移走完整个流程。张量形状用公开 Large 提取器的默认接口举例；不代表论文为这个镜头保存了具体向量。[附录图 I][raccoon] · [作者用法][repo] · [滑窗实现][sliding]

| 步骤 | 这个例子里发生了什么 |
|---|---|
| 读参考 | 输入一段连续 RGB 帧。公开接口接收 B × T × H × W × 3。取一段 8 帧输入时，默认滑窗接口为前 4 个源时刻返回 4 × 128 的连续特征（省略批次维），末尾 4 帧提供未来上下文。 |
| 换目标 | 保留男子的运动特征，将外观条件换成浣熊。论文图 I 给的是文本条件；公开的 CogVideoX 图生视频示例还接收目标图片，以指定第一帧的外观与起始姿势。 |
| 生成 | 视频生成器综合运动条件和目标角色的先验，在新画面中完成相对转头。训练时预测未来帧所用的男子原画面，此时不充当浣熊的起始画面。 |
| 检验 | 对着原图分别看两件事：浣熊是否跟上了头部朝向变化，男子衣服的条纹是否出现在了浣熊身上。输出是 RGB 视频；若应用要求给角色骨架逐帧写入三维旋转，还要另加动作恢复或重定向。 |

### 训练与推理

表示预训练采用 Kinetics-710、Something-Something v2、Moments in Time、OpenVid-1M，共约 280 万段、4,900 小时视频。默认训练片段为 256 × 256、6 FPS、8 帧，批大小 32，进行 53 万次参数更新。骨干里使用预训练 DINOv2；“自监督”说的是这一步用视频自身的未来帧提供监督。作者另行训练下游视频适配器，之后新给一段驱动视频即可使用，不需要为该段动作再微调。[训练配置与数据，附录 A 表、B 表][training] · [视频适配][adapt]

论文主实验使用 **LTX-Video-2B**，作者发布的迁移示例使用 **CogVideoX-5B-I2V**。权重库提供独立的 Large 运动提取器和 CogVideoX 适配权重，训练时配对的帧生成器权重没有公开。附录 G 将表示预训练列为 192 H200 小时、LTX 适配列为 200 H200 小时，同时说明预训练主要实际使用 GH200。耗时要区分训练与生成，附录表 G 另给出了单张 A100 生成视频的计时。[官方发布说明][repo] · [权重文件][weights] · [推理效率][eff] · [训练资源][cost]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**把同一动作迁给新主体，动作、外观能否同时保住？** 作者从 DAVIS、OpenVid-1M 等来源选取驱动视频与目标描述，覆盖固定或移动镜头、相近或相差较大的内容。表中 DisMo 使用适配后的 LTX-Video-2B。动作保真度比较生成视频与驱动视频的点轨迹；另外三列用 CLIP 分别比较画面与目标描述、相邻生成帧、生成帧与驱动帧。作者希望最后一列较低，因为目标应当能呈现自己的外观。这四项是视频层面的分数，没有测量三维骨骼误差。[原表 1 与评测说明](https://arxiv.org/html/2511.23428v1#S4.SS1)

| 方法 | 动作保真度 ↑ | 提示词符合度 ↑ | 时间一致性 ↑ | 与驱动视频的视觉相似度 ↓ |
|---|---:|---:|---:|---:|
| VMC | 0.57 | 0.26 | 0.94 | 0.59 |
| DMT | 0.70 | 0.24 | 0.93 | 0.66 |
| MotionClone | 0.63 | **0.27** | 0.91 | 0.59 |
| MotionDirector | 0.70 | 0.16 | 0.92 | 0.82 |
| DisMo | **0.75** | **0.27** | **0.95** | **0.55** |

MotionDirector 能跟随参考轨迹，但输出仍相当像原视频。DisMo 的轨迹分较高、与原片的视觉相似度较低，提示词符合度与 MotionClone 并列。单看最后一列会奖励任何外观变化，需要结合第一、二列一起读。[原表 1](https://arxiv.org/html/2511.23428v1#S4.T1)

**人眼的判断与自动指标一致吗？** 下表为原文表 2 的百分比。DisMo 在真实感和提示词匹配上占比最高；只看动作迁移质量时，MotionDirector 略高。原表没有给出这一差距的置信区间。[原表 2](https://arxiv.org/html/2511.23428v1#S4.T2)

| 方法 | 真实感 ↑ | 提示词匹配 ↑ | 动作迁移质量 ↑ |
|---|---:|---:|---:|
| DMT | 10.93% | 9.60% | 17.73% |
| MotionDirector | 10.98% | 7.47% | **25.96%** |
| VMC | 20.04% | 26.13% | 16.98% |
| MotionClone | 19.91% | 19.42% | 14.62% |
| DisMo | **38.13%** | **37.38%** | 24.71% |

**动作向量里还剩多少演员身份？** IARD 有五位演员表演走、跑、跳、喝、吃五种动作。作者设计两场不同的测试：第一场用四位演员的带标签样本做近邻库，识别第五位演员的动作；第二场用吃、跑、走、跳四种动作建库，在此前留出的“喝”上猜演员身份。后者是五选一，随机基线 20%。把这两项并排看，可以区分“能识别动作且不易猜出演员”和“什么都没学到”。[原表 3](https://arxiv.org/html/2511.23428v1#S4.T3) · [具体划分与身份探针](https://arxiv.org/html/2511.23428v1#A3.SS2)

| 冻结的视频表示 | 新演员的动作准确率 ↑ | 换动作后的身份准确率 ↓ |
|---|---:|---:|
| VideoMAE | 73.44% | 99.14% |
| VideoMAEv2 | 80.25% | 58.94% |
| V-JEPA | 82.03% | 96.23% |
| DisMo | **90.74%** | **23.82%** |

原文所谓“零样本动作分类”冻结编码器，将单个 224×224 片段的特征沿时间平均，用**带类别标签的样本库**做近邻分类。DisMo 在暗光动作 ARID、手势 Jester 和物体交互 SSv2 上分别得到 **57.29%、56.66%、22.19%**，V-JEPA 对应为 25.16%、30.84%、21.11%。SSv2 本身也进入了表示预训练的数据混合；这些结果回答的是冻结表示在下游有多好用，并不要求模型在预训练时从未见过该数据域。[原表 5](https://arxiv.org/html/2511.23428v1#S4.T5) · [预训练数据表 B](https://arxiv.org/html/2511.23428v1#A3.T2)

### 消融实验

**分别加入源帧条件与数据增强。** 训练时先让帧生成器有一条直接读取源帧的支路，再对动作提取器的输入做增强。评测刻意拿走源帧，仅凭动作向量重建原画面。此时 LPIPS 越高、CLIP 相似度越低，说明越难还原原外观；MIR 是向量与动作标签的互信息除以与身份标签的互信息，越高表示相对更偏向动作。重建指标取自 HMDB51 子集，MIR 取自 IARD 子集。[附录表 C、D 与定义](https://arxiv.org/html/2511.23428v1#A3.SS3)

| 逐项加入的训练设计 | 仅凭动作重建的 LPIPS ↑ | CLIP ↓ | MIR ↑ |
|---|---:|---:|---:|
| 基础设置 | 0.47 | 0.81 | 0.47 |
| 加入前一帧条件 | 0.72 | 0.65 | 3.07 |
| 再加入增强，完整 DisMo | **0.76** | **0.65** | **5.56** |

**固定最终生成的提示与随机种子，只扰动驱动视频。** 原表 4 比较原视频驱动的输出和改变颜色或几何构图后的输出。启用训练增强后，几何扰动下的 SSIM 从 0.65 升到 0.71、LPIPS 从 0.33 降到 0.26；光度扰动下分别从 0.70 到 0.72、0.26 到 0.25。改善在裁切、旋转、平移这类几何扰动上更明显。[原表 4](https://arxiv.org/html/2511.23428v1#S4.T4)

**保留动作表示，更换视频生成器。** 把适配的 LTX 换成 CogVideoX-5B，动作保真度从 0.75 到 0.78，FID 从 88.54 到 62.99，FVD 从 298.4 到 206.3。附录用 Koala-36M 抽取参考和提示，每种模型生成 2,000 段、每段 25 帧来评估生成质量。这个样本数属于附录对照。单张 A100 上，两个版本分别约 30 秒和 2 分钟生成一段；换渲染器需要匹配的适配器。[附录表 E](https://arxiv.org/html/2511.23428v1#A3.T5) · [附录表 G](https://arxiv.org/html/2511.23428v1#A6.T7)

### 关键发现

- 迁移生成与动作识别回答不同的问题。前者要求生成器把运动落实到一个新主体上，后者只要求冻结向量能找回相似动作。IARD 身份探针接近随机的结果，能解释这些向量为什么适合跨人使用；它本身无法验证一次具体的跨物种迁移是否成功。[原表 1–3][transfer] · [身份测试][ident]
- 更换视频骨干时，比较动作保真度的同时也要看视频质量和耗时。主表同一种动作表示在附录里配了三个不同的生成器，因此网站演示、论文默认值和下载权重应按各自配置阅读。[不同视频骨干](https://arxiv.org/html/2511.23428v1#A3.T5) · [推理效率][eff]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **“只看动作，能不能猜出是谁”是另一项检验。** 重建准确和视频好看都可能来自保留源人物的细节。作者让同一组特征分别去匹配动作和身份，再把测试换到训练参考集中未出现的演员或动作。动作仍好认、身份难猜，两项结果一起才支持外观信息减弱的解释。[原表 3][classif] · [IARD 划分][protocol]
- **允许目标按自己的身体解释参考。** 附录图 J 把一名女子用双手移动杯子的片段迁移给草地上的豚鼠。输出借用了物体位移的大致方向，给没有人手的目标找到了视觉上说得通的运动。这个案例也揭示了“迁移”的粒度：若任务要求另一双手按原方式握杯，光有方向就不够。[附录图 J][guinea]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

1. **精确的关节和接触没有对应输出。** 一段动作向量能引导“转头”，却没有可直接读取的关节编号、旋转角或接触时刻。动作保真度比较的是图像轨迹；若使用场景要求手必须摸到某个物体、眼睛必须朝向某点，还需要几何表示和针对该目标的测量。[方法定义][learn] · [迁移指标][transfer]
2. **镜头也会动。** 把主体运动与相机运动叠加后，作者能从合成特征中检出两者的信息。附录表 F 中，镜头运动从弱变强时，与主体运动的互信息由 3.59 降到 1.57 nats，与镜头运动的互信息则由 1.37 升到 4.40。这个实验没有给出可分别旋钮调节的“镜头分量”和“身体分量”，快速运镜的参考片尤其要区分自己想迁移哪一种。[附录 E][compose]
3. **视频质量和时序边界仍受生成器约束。** 小帧生成器递推时会沿用自己刚画出的结果，作者报告其处理复杂场景的画质有限。滑窗可提取长参考片的特征，但公开默认提取要用后续帧作上下文；长视频可处理并不能直接推得零等待的实时动捕。[图 3][fig3] · [作者局限][limits] · [公开滑窗接口][sliding]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **V-JEPA** 同样从视频学习时序表示。DisMo 与它在同一套身份、动作近邻测试上呈现不同取舍。要决定哪种表示更合适，可以先问下游是在寻找“同一个人”，还是寻找“换个人也算同一个动作”。[原表 3][classif]
- **AnyAct** 的一条对照路线把三件事串起来：Qwen-Image 提供目标人形图像，DisMo 生成跟随参考动态的人体视频，GVHMR 将该视频还原为三维人体动作。网站以前在这里提过 DisMo；视频到三维这一步属于 GVHMR。[AnyAct 站内解读][anyact] · [AnyAct 原文][anypaper]
- **EchoMotion** 同时生成视频和显式 SMPL 人体动作；**CAST** 直接预测给定目标骨架的局部关节旋转。三者都能利用视频，但如果要把结果交给动画系统，DisMo 提供的是可驱动视频的运动特征与生成画面，另外两篇则明确建模了三维人体参数或目标骨架。[EchoMotion 站内解读][echo] · [CAST 站内解读][cast]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **论文与附录**　[NeurIPS 会议记录][conference] · [终稿 PDF][pdf] · [完整 HTML][html] · [会议补充材料][supp]
- **模型与演示**　[作者项目与视频][project] · [核对的代码版本][repo] · [公开模型文件][weights]

</div>

[html]: https://arxiv.org/html/2511.23428v1
[pdf]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e88870ec82f2469b0ddf32c817920c68-Paper-Conference.pdf
[conference]: https://proceedings.neurips.cc/paper_files/paper/2025/hash/e88870ec82f2469b0ddf32c817920c68-Abstract-Conference.html
[supp]: https://proceedings.neurips.cc/paper_files/paper/2025/file/e88870ec82f2469b0ddf32c817920c68-Supplemental-Conference.zip
[project]: https://compvis.github.io/DisMo/
[repo]: https://github.com/CompVis/DisMo/tree/1f3f8fc6c43b4394b4244bda00a183713e6cd39a
[extract]: https://github.com/CompVis/DisMo/blob/1f3f8fc6c43b4394b4244bda00a183713e6cd39a/dismo/model.py#L525-L537
[framecode]: https://github.com/CompVis/DisMo/blob/1f3f8fc6c43b4394b4244bda00a183713e6cd39a/dismo/model.py#L278-L353
[sliding]: https://github.com/CompVis/DisMo/blob/1f3f8fc6c43b4394b4244bda00a183713e6cd39a/dismo/model.py#L389-L412
[weights]: https://huggingface.co/CompVis/DisMo/tree/2d0bd98854e4f10602a3d3be79319a50a2a64a48
[fig2]: https://arxiv.org/html/2511.23428v1#S2.F2
[fig3]: https://arxiv.org/html/2511.23428v1#S4.F3
[intro]: https://arxiv.org/html/2511.23428v1#S1
[learn]: https://arxiv.org/html/2511.23428v1#S3.SS2
[frame]: https://arxiv.org/html/2511.23428v1#S3.SS2.SSS0.Px2
[aug]: https://arxiv.org/html/2511.23428v1#S3.SS2.SSS0.Px3
[adapt]: https://arxiv.org/html/2511.23428v1#S3.SS3
[training]: https://arxiv.org/html/2511.23428v1#A3.SS1
[protocol]: https://arxiv.org/html/2511.23428v1#A3.SS2
[transfer]: https://arxiv.org/html/2511.23428v1#S4.SS1
[ident]: https://arxiv.org/html/2511.23428v1#S4.SS2
[classif]: https://arxiv.org/html/2511.23428v1#S4.T3
[ablate]: https://arxiv.org/html/2511.23428v1#A3.SS3
[compose]: https://arxiv.org/html/2511.23428v1#A5
[cost]: https://arxiv.org/html/2511.23428v1#A7
[eff]: https://arxiv.org/html/2511.23428v1#A6.T7
[limits]: https://arxiv.org/html/2511.23428v1#A2
[raccoon]: https://arxiv.org/html/2511.23428v1#A9.F9
[guinea]: https://arxiv.org/html/2511.23428v1#A9.F10
[anyact]: /blog/siggraph-asia2026-anyact/
[anypaper]: https://arxiv.org/html/2605.15497v4
[echo]: /blog/iclr2026-echomotion/
[cast]: /blog/arxiv2026-cast/
