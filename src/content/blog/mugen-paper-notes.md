---
title: "[arXiv2026] MUGEN：两个连续向量怎样让模型既能按文字做动作，也能看动作写描述"
description: "MUGEN: A Unified Framework for Efficient Motion Understanding and Generation。以站在原地向前指为例，解读可变长度动作自编码器、语言模型的层路由和一次联合采样，对照生成、理解、推理成本与真实残差实验。"
pubDate: "2026-11-25T01:31:00+08:00"
badge: "Paper"
tags: ["MUGEN", "Text-to-Motion", "Motion-to-Text", "Continuous Latents", "Motion Understanding", "HumanML3D", "SnapMoGen", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML，含完整附录][html] · [原文 PDF][pdf] · [作者项目与动作视频][project] · [训练代码][code] · [公开模型][model]

<details class="paper-meta"><summary>论文信息与阅读范围 · arXiv 2026</summary>

*MUGEN: A Unified Framework for Efficient Motion Understanding and Generation*，作者为 Zhankai Ye、Yukai Jin、Bingyang Wei、Bofan Li、Yusen Wu、Fangyi Li、Shangqian Gao、Xin Liu。2026 年 7 月 30 日首发，本文依据 8 月 6 日的 arXiv v2。核对至 2026 年 11 月 25 日，作者项目及论文记录均列为预印本。下文表号沿用原论文；实验数字取自作者报告，推理接口与公开代码另行核对，本次未运行模型。[版本记录][record] · [作者项目][project] · [固定版本代码][code]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

MUGEN 把整段身体动作压成少数几个连续向量，让同一个语言模型学会双向使用它们：看见文字时预测这些向量，再一次解码成动作；看见动作时读取这些向量，逐词写出描述。在 HumanML3D 上，连接两种任务的表示只有 **2 个 512 维向量**。[原文图 1][f1] · [图 2][f2]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　动作和文字之间有两种常见任务。生成要把一句话展开成许多帧；理解要从许多帧里找出值得写进一句话的动作。MotionGPT 一类方法先把动作转换为离散词表，让语言模型能读写同一种符号。[原文 §1–2][intro]

**现有痛点**　若一个动作接近两个码本条目，离散编码只能选一个；增加残差码本能保留更多细节，也增加生成阶段要预测的内容。改用连续向量能避开量化误差，但如果每个向量还要经过多轮扩散才能生成，连续表示本身并没有消除等待。[原文 §1][intro] · [推理成本比较][cost]

**核心矛盾**　“站在原地，用力向正前方指”对两种任务的要求不同。写描述时，识别出“站立”和“指向”就已抓住主要意思；生成时还要决定何时抬手、伸多远，以及做完整个动作后人是否仍在原地。一小组向量既要便于用语言读出意思，也要保留重建身体运动所需的信息。[原文附录 H.6][cases]

**本文目标**　用同一套动作表示和语言模型完成文字到动作、动作到描述两项任务，同时把生成的计算量压低。作者在配有短描述的 HumanML3D 和描述更细致的 SnapMoGen 上分别训练和评测。[原文 §4.1][setup] · [附录 H.5][capSnap]

**切入角度**　先单独回答“少数几个实数向量能不能装下一整段动作”，再让语言模型学习这些向量的条件分布。这样，当文字生成的动作质量不够好时，可以拿真值动作编码出来的向量替换生成结果，定位信息丢在哪一步。[原文 §3.1][alae] · [附录表 9][oracle]

**核心 idea**　给每个向量一个可学习的查询，让它从整段动作取信息；生成时，让每个查询所对应的位置从语言模型的不同深度读取信息，再对所有向量联合采样一次。反向任务可以直接读取真实动作编码出的同一组向量。[方法图 2][f2] · [原文 §3.2–3.3][generate]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先训练一个可变长度动作自编码器（ALAE），学会 **T 帧动作 → K 个连续向量 → T 帧动作**。随后冻结它，训练双向语言模型。生成方向由文字预测与编码器兼容的向量；理解方向把真实动作编码成向量，再投影进同一个 GPT-2。一个数据集上的两个任务共用一套参数，HumanML3D 和 SnapMoGen 则分别训练。[原文图 1][f1] · [图 2][f2] · [训练设置][setup]

<figure class="reading-figure"><a href="/paper-notes/mugen/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/mugen/architecture.svg" alt="MUGEN 两阶段与双向架构。动作自编码器先学习把可变长度的帧序列压成固定数量的连续槽，随后冻结。文字生成动作走逐槽展开、层路由、联合采样和逐帧解码；动作生成描述走编码、投影和语言模型逐词预测。" /></a><figcaption>据原文图 1、图 2 重绘。先看动作空间怎样学出来，再跟随同一组连续向量在两个方向上的去向。注意输入帧数 T、连续槽数 K 和输出文本词数各有自己的含义。点击可放大。</figcaption></figure>

### 关键设计

1. **把可变长运动收进固定容量。** 以 HumanML3D 为例，输入有 T 帧，每帧 263 维。一维卷积与带空洞卷积的残差块提取逐帧特征。K 个可学习查询作为交叉注意力的 Q，逐帧特征作为 K/V，每个查询都能读取完整时间轴。输出为 K × 512 个实数。训练时惩罚查询之间过高的余弦相似度，鼓励各自读取不同信息。论文没有为两个槽分别赋予“上身、下身”或“前半段、后半段”等含义。[原文 §3.1][alae]

2. **帧数由解码端显式接收。** 解码器沿所需的 T 帧取一组正弦位置查询，用每个查询读取全部动作槽，再经时间卷积细化为连续帧。这里的 *phase* 表示当前帧在整段序列中的相对进度；模型未从脚落地或步态周期估计相位。给同一组槽指定不同的 T，解码器就会产生相应长度的序列，动作的节拍与速度是否符合预期仍需检查。[原文 §3.1][alae] · [模型用法][model]

3. **先沿语言模型展开 K 步，才对动作采样一次。** 提示以特殊标记 `<MOT>` 结尾。第一个位置由这段提示得到；后续步骤将前一步最后一层的隐藏状态归一化，直接作为新的连续输入。每一步保留 GPT-2 全部 12 层的隐藏状态。对每个槽，路由器用“该槽的固定偏好 + 当前提示给出的修正”计算 12 个权重，再加权读出各层信息。两槽设置下，一个槽偏好第 10 层，另一个在第 5–11 层分布更广，这是对读层权重的观察。[原文 §3.2][generate] · [附录 D 图 3–4][routing]

4. **一次采样要让多个槽一起变化。** 一个提示通常容许多种做法。作者把 K 个槽拼成一个长向量，同时预测均值、逐维噪声尺度，以及作用在共享低秩基上的幅度。一次采样包括一份跨槽共享的扰动和一份逐维扰动；前者可以让不同槽的变化彼此相关。主模型低秩基有 64 个方向，温度 τ 缩放随机扰动，τ = 0 就取均值。训练时，单独更新均值，并用切断梯度的残差拟合协方差，以免模型用放大方差来掩盖均值预测不准。[原文 §3.2–3.3][joint] · [附录 E][factor] · [采样表达式][temp]

5. **看动作写描述时，直接走反方向。** 冻结的 ALAE 从真实动作提取 K 个槽，投影层将它们映射到语言模型的输入维度，GPT-2 根据这些条件逐词预测描述。这条路径跳过生成动作时的概率头。训练时同一批动作与配文提供两个方向的监督，生成侧拟合动作，描述侧用真实描述做教师强制训练。[原文 §3.3][joint] · [附录 F][jointdetails]

### 一个完整例子：站在原地，用力向正前方指

这是附录表 13 的真实提示。为说明输入与输出形状，下面假设生成 **120 帧**，即 HumanML3D 的 6 秒；论文未标出这个案例实际有多少帧。[案例与原图][case13] · [公开模型输入说明][model]

- **给定文字和长度。** GPT-2 读完提示，围绕 `<MOT>` 展开两步。模型保留两步各 12 层的隐藏状态，分别混合成两个读出向量。线索“原地”和“向前指”都在整句里，系统没有收到根节点坐标或指尖目标点。
- **生成连续运动。** 概率头在 2 × 512 维表示上联合抽样一次。120 个位置查询从两个槽中取出所需信息，解码器输出 120 × 263 的动作特征。若输入换成真实的同长度动作，反向路径可以将它压成相同形状的槽，再生成描述；理解时并不需要模型重新表演一次。
- **检查“原地”兑现了多少。** 在论文展示的这条动作上，真值与 MUGEN 的根节点水平位移均为 **0.04 米**，MoMask++ 为 **2.30 米**，MotionGPT3 为 **2.55 米**。这个量能检验明显的整体漂移；要判断手指朝向，还需要手部或指向误差。作者从物理指标均不逊于两个基线的 128 个样本中选取图示，因此这组数值只解释这一例。[附录表 13 与样本选择说明][cases]

反向路径可以在项目页的楼梯片段中直接观察。输入是真实动作，人类描述写的是“右手扶栏，向上走四级台阶”。模型也写出了上楼、扶栏和右手，漏掉了“四级”。这个差别说明，即使一句描述检索得分较高，动作计数仍值得单独检查。[作者的动作与描述对照](https://jye16.github.io/mugen-page/#understanding) · [这段动作的视频](https://jye16.github.io/mugen-page/static/videos/m2t/008653.mp4)

### 训练与推理

第一阶段用逐帧重建、关节位置、冻结动作编码器提供的感知特征以及查询正交损失学习 ALAE。第二阶段固定其编码器与解码器，训练 GPT-2 主干、路由器、概率头和描述投影层。生成侧同时监督真实动作的标准化潜向量及预测均值解码后的运动。两个阶段各 500 轮，作者报告每次训练使用一张 NVIDIA B200：第一阶段每次少于 6 GPU 小时，第二阶段 HumanML3D 约 6 GPU 小时，SnapMoGen 在最大槽数设置下约 21 GPU 小时。[实验设置与硬件][training] · [超参数表 7][hparams]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**文字生成动作。** 从原文表 1、2 摘录均值。R@1 表示在评估器的候选中将正确配对排到第一的比例；FID 衡量生成与真实动作的特征分布距离，越低越好。两数据集的评估器不同，只在各自列内比较。质量基线引用已发表结果，MUGEN 按各数据集官方协议做 20 次重复。[完整表 1][t1] · [表 2][t2] · [评估指标][metrics]

| 方法 | HumanML3D R@1 ↑ | HumanML3D FID ↓ | SnapMoGen R@1 ↑ | SnapMoGen FID ↓ |
| --- | ---: | ---: | ---: | ---: |
| MoMask | 0.521 | **0.045** | 0.777 | 17.40 |
| MoMask++（交叉注意力） | 0.517 | 0.069 | 0.802 | **15.06** |
| MotionGPT3 | 0.553 | 0.208 | — | — |
| UniMo | 0.539 | 0.177 | — | — |
| MUGEN | **0.579** | 0.087 | **0.815** | 21.05 |

**动作生成描述。** HumanML3D 的同一份 MUGEN 权重用于双向评估。BLEU@4 看连续词组是否匹配，CIDEr 更强调参考描述中有辨识度的词组，BERTScore 在表示空间中比较文字。三者对什么算“说对了”有不同偏好。[原文表 3][t3]

| 方法 | 动作–描述 R@1 ↑ | BLEU@4 ↑ | CIDEr ↑ | BERTScore ↑ |
| --- | ---: | ---: | ---: | ---: |
| MotionGPT3 | 0.573 | 19.41 | 28.72 | 35.23 |
| UniMo | — | 19.74 | 46.69 | **54.26** |
| MUGEN | **0.586** | **21.98** | **50.41** | 43.37 |

**生成一条动作的实际成本。** 与前面的质量表不同，这一表是作者把三份公开模型放到同一张 NVIDIA L4 上实测。单条延迟取预热后 64 次生成的中位数，吞吐量用批大小 32。范围从文字到 GPU 上的动作特征，不含反归一化、正向运动学、文件读写或渲染。[原文表 4][cost] · [计时协议][timing]

| 方法 | 参数量（百万） | 每条动作 GFLOPs ↓ | 单条延迟（毫秒）↓ | 批处理吞吐（条/秒）↑ |
| --- | ---: | ---: | ---: | ---: |
| MoMask++ | 150.2 | 105.5 | 55 | 55.1 |
| MotionGPT3 | 299.7 | 95.5 | 136 | 53.2 |
| MUGEN | 222.3 | **11.1** | **9** | **325.2** |

### 消融实验

**槽数与读层位置。** 在 HumanML3D 增加槽数、保持其余训练配方，或固定 K = 2、只读取 GPT-2 末层。2 槽的 FID 优于 1 槽，继续增至 16 槽反而变差；在同为 2 槽时，引入深度路由把 FID 从 0.123 降到 0.087。SnapMoGen 选用 4 槽，R@1 为 0.815；该数据集测试的 16 槽 FID 略低，但检索精度也下降。[原文表 5][budget] · [附录表 8][snapbudget]

| HumanML3D 设置 | 1 槽 | 2 槽 | 4 槽 | 8 槽 | 16 槽 | 2 槽只读末层 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| FID ↓ | 0.109 | **0.087** | 0.091 | 0.111 | 0.143 | 0.123 |
| R@1 ↑ | 0.574 | **0.579** | 0.577 | 0.567 | 0.566 | 0.574 |

**双向训练的收益。** HumanML3D 上，仅训练生成时 FID 为 0.107；加入描述任务、描述损失权重取 1 时降到 0.087，CIDEr 为 50.4。把该权重降到 0.25，FID 为 0.089、CIDEr 升到 53.5；增到 4 则变成 0.111 和 49.7。双向学习存在合适的权重区间。[原文表 6][abjoint]

**给概率头怎样的监督、选什么温度。** SnapMoGen 验证集上，采用相同低秩概率头，均值与方差直接联合拟合时 FID 为 47.5、R@1 为 0.13；解耦两者的梯度后得到 22.97 和 0.775。另在 HumanML3D 测试集，确定性均值解码、τ = 1、验证集选出的 τ = 0.6 三者的 FID 分别为 0.131、0.151、0.087；均值解码的 R@1 反而最高，为 0.585。每条提示只采一次，没有事后挑选最佳样本。[附录表 10][headtest] · [表 11][tauab]

**如果给模型一部分正确答案，问题会出在哪里？** 作者在 SnapMoGen 上取到真实动作编码 z★，从预测均值 μ 出发，沿真实残差 z★ − μ 走一段再解码。走一半，FID 就从均值解码的 23.54 降到 6.89，R@1 从 0.828 升到 0.962。把真实残差打乱、配给别的样本，即使保留这些变化的总体分布，R@1 也只有 0.422。这个诊断需要真实动作，说明条件采样仍有改进空间；6.89 不能列作只给文字时的生成成绩。[附录 H.2 表 9][oracle]

<figure class="reading-figure"><a href="/paper-notes/mugen/results.svg" target="_blank" rel="noopener"><img src="/paper-notes/mugen/results.svg" alt="SnapMoGen 真实残差诊断。把预测均值向正确动作的潜表示移动，FID 大幅下降；将真实残差分给错误样本，文本检索精度下降。" /></a><figcaption>据原文附录表 9 重绘。各点使用不同份额的真值残差，打乱配对用于检验残差方向与当前文字的对应关系。点击可放大。</figcaption></figure>

### 关键发现

1. **文字吻合与动作分布可以给出不同排名。** MUGEN 在两个数据集上都取得表中最高的生成 R@1，离散生成器 MoMask 和 MoMask++ 则分别取得所列方法中更低的 FID。HumanML3D 上 MUGEN 的生成 R@1 甚至高于真值参考的 0.510；这个数值描述的是评估器检索表现，无法据此断定生成动作比动捕更真实。[原文表 1][t1] · [表 2][t2]
2. **9 毫秒来自生成路径短，不要求模型参数最少。** MUGEN 比 MoMask++ 多约 7200 万参数，却只需两步语言模型展开、一次联合抽样和一次动作解码。不同目标长度和硬件下应重新计时，表中的 9 毫秒也不能解释为逐帧在线响应延迟。[原文表 4][cost] · [附录 H.10][timing]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把“压缩不够”和“预测不准”分开验证。** 真实残差实验固定了解码器。即便只补入一半正确的变化方向，解码结果也有明显提升。这比单纯追加槽数更能判断下一步该改表示还是改文字条件下的采样器。[附录 H.2][oracle]
- **共享接口可以有不同的读写方式。** 写入动作时需要概率分布来表达同一句话的多种演法；读取动作时，真实运动已经确定，模型可以直接从槽生成文字。统一的是两条路径传递的表示和训练的语言主干。[原文图 2][f2] · [联合训练消融][abjoint]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **理解的证据主要来自描述和检索。** 在作者展示的右手下手投掷例子中，模型保留了“右手”和“投掷”，漏掉了投掷方式。在 SnapMoGen，模型描述与输入动作的 R@1 是 0.600，人类参考描述为 0.945。该数据集每条动作有 6 条、平均约 49 个英文词的描述，HumanML3D 则为 3 条、平均约 13 词；CIDEr 要在各数据集内部解读。[附录表 15][case15] · [附录 H.5][capSnap]
- **长度可调，事件时间和物理约束仍需验证。** 公开接口接受文字和目标帧数。HumanML3D 模型卡建议使用 20–196 帧、4 的倍数；解码端可接受其他长度，训练分布外的效果尚待验证。若用途要求第 45 帧指到屏幕某处，需要额外的事件、目标点与逐帧误差检查。论文案例只量了部分运动属性。[模型卡][model] · [附录 H.6][cases]
- **复现时要区分论文温度和发布默认值。** 原文表 11 将 τ = 0.6 的主结果和 τ = 1 的结果分行报告；公开 HumanML3D 模型配置默认 1.0，采样代码把该值直接乘到扰动上。对照论文主表时应显式指定 `temperature=0.6`，同时核对权重和评测协议。当前模型库提供 HumanML3D 权重，训练仓库另有 SnapMoGen 配置。[原文表 11][tauab] · [公开配置][hfconfig] · [采样代码][hfsample] · [训练仓库][code]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **LG-Tok** 把文字引入编解码器，以多尺度离散码连接运动与生成器。MUGEN 的动作编码器只读真实动作，训练好后冻结，再让文字模型预测连续分布。两篇并读时，先问文字在哪一阶段进入，再问所谓“两个槽”和“若干离散索引”各有多大容量。[LG-Tok 原文](https://arxiv.org/html/2602.08337v2) · [站内解读](/blog/eccv2026-lg-tok/)
- **MotionGPT3** 同样把连续运动引入生成和理解，但动作预测走逐位置生成和迭代扩散头。MUGEN 把整段动作的随机性集中到一次联合采样。两者同卡计时提供了直接的成本对照。[站内 MotionGPT3 解读](/blog/iclr2026-motiongpt3/) · [MUGEN 计时协议][timing]
- **MoMask++** 用多尺度离散表示与掩码解码生成动作，是 SnapMoGen 上重要的质量对照。它在 FID 上占优，MUGEN 在检索精度和计算量上占优；应结合要解决的是动作分布、文字遵从还是交互等待时间来读这组数。[站内 MoMask++ 解读](/blog/neurips2025-momask/) · [原文表 2][t2]
- **启发。** 对“原地向前指”这样的可控任务，可以固定长度和噪声，只将“正前方”改为“左方”，分别测根位移、手臂方向及其余关节的扰动。这样能检验模型是否对指定语义作局部响应。这是由本文引出的后续实验。[作者案例与测量范围][cases]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **原论文与视频。** [arXiv v2 全文 HTML][html] · [原文 PDF][pdf] · [版本记录][record] · [作者项目演示][project]
- **数据与证据。** [方法总图][f2] · [HumanML3D 生成][t1] · [SnapMoGen 生成][t2] · [动作描述][t3] · [真实残差实验][oracle] · [推理计时协议][timing]
- **公开实现。** [作者训练与评测仓库][code] · [HumanML3D 模型与用法][model] · [推理代码][hfimpl] · [发布权重的配置][hfconfig]

</div>

[html]: https://arxiv.org/html/2607.27581v2
[pdf]: https://arxiv.org/pdf/2607.27581v2
[record]: https://arxiv.org/abs/2607.27581
[project]: https://jye16.github.io/mugen-page/
[code]: https://github.com/JYe16/MUGEN/tree/059cc270d23eae2e3c86c0e2de5ce7f442429b2e
[model]: https://huggingface.co/zy22b/MUGEN
[hfconfig]: https://huggingface.co/zy22b/MUGEN/blob/cdfdd8a56d727227646560611aa1d8a968d39a88/config.json
[hfimpl]: https://huggingface.co/zy22b/MUGEN/blob/cdfdd8a56d727227646560611aa1d8a968d39a88/modeling_mugen.py
[hfsample]: https://huggingface.co/zy22b/MUGEN/blob/cdfdd8a56d727227646560611aa1d8a968d39a88/modeling_mugen.py#L688-L744
[intro]: https://arxiv.org/html/2607.27581v2#S1
[f1]: https://arxiv.org/html/2607.27581v2#S3.F1
[f2]: https://arxiv.org/html/2607.27581v2#S3.F2
[alae]: https://arxiv.org/html/2607.27581v2#S3.SS1
[generate]: https://arxiv.org/html/2607.27581v2#S3.SS2
[joint]: https://arxiv.org/html/2607.27581v2#S3.SS3
[setup]: https://arxiv.org/html/2607.27581v2#S4.SS1
[t1]: https://arxiv.org/html/2607.27581v2#S4.T1
[t2]: https://arxiv.org/html/2607.27581v2#S4.T2
[t3]: https://arxiv.org/html/2607.27581v2#S4.T3
[cost]: https://arxiv.org/html/2607.27581v2#S4.T4
[budget]: https://arxiv.org/html/2607.27581v2#S4.T5
[abjoint]: https://arxiv.org/html/2607.27581v2#S4.T6
[training]: https://arxiv.org/html/2607.27581v2#A1
[metrics]: https://arxiv.org/html/2607.27581v2#A2
[hparams]: https://arxiv.org/html/2607.27581v2#A3.T7
[routing]: https://arxiv.org/html/2607.27581v2#A4
[factor]: https://arxiv.org/html/2607.27581v2#A5
[jointdetails]: https://arxiv.org/html/2607.27581v2#A6
[temp]: https://arxiv.org/html/2607.27581v2#A7
[snapbudget]: https://arxiv.org/html/2607.27581v2#A8.T8
[oracle]: https://arxiv.org/html/2607.27581v2#A8.T9
[headtest]: https://arxiv.org/html/2607.27581v2#A8.T10
[tauab]: https://arxiv.org/html/2607.27581v2#A8.T11
[capSnap]: https://arxiv.org/html/2607.27581v2#A8.SS5
[cases]: https://arxiv.org/html/2607.27581v2#A8.SS6
[case13]: https://arxiv.org/html/2607.27581v2#A8.T13
[case15]: https://arxiv.org/html/2607.27581v2#A8.T15
[timing]: https://arxiv.org/html/2607.27581v2#A8.SS10
