---
title: "[CVPR2023] T2M-GPT：先把动捕压成编号，再从一句话生成连续动作"
description: "《Generating Human Motion from Textual Descriptions with Discrete Representations》解读。沿着“向前迈步，接着倒立”追踪动作分词、带噪历史上的下一码预测与连续解码，核对码本、采样长度和两套基准的实验。"
pubDate: "2026-11-20"
badge: "Paper"
tags: ["T2M-GPT", "Text-to-Motion", "Motion Tokenizer", "VQ-VAE", "Autoregressive", "HumanML3D", "KIT-ML", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[可翻译的 HTML 全文与附录][html] · [会议终稿 PDF][pdf] · [补充材料][sup] · [项目与动作演示][project] · [作者代码与权重入口][repo]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2023</summary>

会议正式题名为 *Generating Human Motion from Textual Descriptions with Discrete Representations*，CVPR 2023，第 14730–14740 页。论文首页署名为 Jianrong Zhang、Yangsong Zhang、Xiaodong Cun、Yong Zhang、Hongwei Zhao、Hongtao Lu、Xi Shen、Shan Ying，前两位共同一作。项目和 arXiv 使用 T2M-GPT 前缀，arXiv v4 的署名与会议版有差异。以下按会议版引实验，另核对公开实现中的训练与采样路径。本次未运行模型。[会议论文记录][venue] · [arXiv 版本记录][versions] · [代码][repo]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

T2M-GPT 将“根据文字生成整段骨架运动”拆成两道题：先学会用一串短编号还原真实动捕，再让一个读过整句描述的 Transformer 逐个预测这些编号，并自己决定何时结束。论文最有说服力的实验是，只改**码本怎么训练**或**预测器在训练时看到怎样的历史**，最终动作质量就能相差很远。[原文图 2][fig2] · [码本消融][tab3] · [历史替换消融][tau]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文字中的“向前迈一步，接着倒立”只需几个词，动捕记录却要逐帧描述根节点朝向、各关节姿态和位移。2023 年已有连续潜变量、离散动作码和扩散生成等技术路线。作者想检验一套简单的离散自回归模型能走多远。[引言与相关工作][intro]

**现有痛点**　朴素量化容易出现码本坍缩。虽然准备了许多候选向量，编码器却反复选中其中很少一部分，原本不同的动作被压成相近的编号串。即使分词做得好，训练期间总看到正确历史的预测器，到了生成时也可能沿着自己选错的编号走偏。[原文 §3][method] · [原表 3][tab3]

**核心矛盾**　缩短序列能让模型少做很多次预测，但每一次离散选择都要承载一小段全身运动。若抬腿、移动重心等细节在量化时已经丢失，文字模型再准确也难以从同一组编号里恢复它们。[VQ-VAE 与原文图 3][vq]

**本文目标**　给出整句自然语言，直接生成时长可变的单人三维动作。作者既关心生成分布是否接近动捕，也关心动作能否让评估器从一组文字中找回正确描述。[原文 §4.1][settings]

**切入角度**　先让卷积自编码器学会对同一段真实动作进行编码和重建，固定这套映射后再学文字到编号的对应。两步可以分别评估，由此定位误差来自分词还是文本生成。[原文图 2][fig2] · [主表 1][human]

**核心 idea**　让常用码随当前数据平滑更新，让闲置码重新加入竞争。随后用部分错码打乱训练历史，仍要求预测器给出真实下一码。这样，文本条件与不完美历史都会参与学习。[量化策略][vq] · [下一码训练][ar] · [作者训练代码][train]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练分两次进行。第一次只需要动作，将全身运动压缩成编号，再从编号重建原序列。第二次使用配对的文字和动作编号，学习下一个编号的概率。实际生成时只需文字，用户无需提供参考动捕或真实时长。输出的编号统一送入第一阶段的解码器，恢复逐帧动作。[原文图 2][fig2] · [训练脚本][train]

<figure class="reading-figure"><a href="/paper-notes/t2m-gpt/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/t2m-gpt/architecture.svg" alt="T2M-GPT 的动作分词训练、文本条件自回归训练与生成。64 帧动作压成 16 个编号，句子与历史编号用于预测下一码；遇到结束符后查码本解码。" loading="lazy" /></a><figcaption>据原文图 2–3 和作者代码重绘。绿色框训练动作分词器，黄色框训练下一码预测器，蓝色框沿用两者生成新动作。图中尺寸对应 HumanML3D。点击可放大。</figcaption></figure>

### 关键设计

1. **用一维时间卷积把骨架序列变短。** HumanML3D 每帧是 263 维，包括根节点运动、局部关节位置与旋转、速度以及足部接触特征。两次步长为 2 的卷积把时间长度压为四分之一。64 帧输入产生 16 个 512 维向量。每个向量都描述附近一段时间的全身状态，相邻位置共享卷积上下文。[原文 §4.1][settings] · [动作表示][repr] · [编码器与解码器][codec]

2. **就近选码，靠解码后的动作来学习码本。** 码本含 512 个 512 维向量。每个编码向量选欧氏距离最近的一行，只记录行号。解码时用行号取回向量，通过残差卷积与最近邻上采样恢复动作。EMA 按被分配到的样本平滑更新码向量；Code Reset 用本批次的编码特征重新初始化低使用量条目。手指着某个码问“它等于哪一个动词”，论文没有提供这种标签表。[原文式 1–3 与图 3][vq] · [码本更新代码][quant]

3. **让整句成为预测第一码的条件，让结束成为可学习的选择。** 冻结的 CLIP ViT-B/32 产生句向量，将它投影后放在 Transformer 序列开头。因果注意力限制每个位置只能利用文字和已有前缀。输出有 513 个选择，包含 512 个动作码和一个结束符。取样可以为同一句话生成不同编号串；遇到结束符时将它排除，仅将动作编号送入解码器。公开实现在上下文长度达到上限时也会停止。[原文 §3.2][ar] · [采样实现][sample]

4. **把训练时的错误放在“历史”，保持“答案”正确。** 假设模型原本看着编号 17、82 预测 91，训练时可能把 82 换成一个随机有效编号，仍要求它预测 91。这个例子中的编号是示意。论文用 τ 表示替换概率。源码参数 `pkeep` 表示保留概率，各位置独立采样，再与原始目标计算交叉熵。训练过程不必先运行一次模型来制造错误。[论文的历史扰动策略][ar] · [训练脚本第 112–135 行][train]

### 一个完整例子

原文图 4 的提示是“向前迈步，接着倒立”。下表用这条文字、论文的分词尺寸和一组**示意长度**追踪输入输出。作者没有公布这段演示实际生成的码 ID 或倒立起始帧。[图 4][fig4] · [作者逐方法动图][project]

| 环节 | 模型拿到什么、交出什么 |
| --- | --- |
| 先在训练数据中学表示 | 假设取 64 帧 HumanML3D 片段，输入形状为 64 × 263，经编码得到 16 × 512，再压成 16 个整数。它们可重新查表恢复为 16 × 512，并解码出 64 × 263 的重建结果。 |
| 新提示开始生成 | 只有“向前迈步，接着倒立”的整句向量。模型先给第一个码分配概率，选中一个后，把它连同句向量一起用于预测第二个。 |
| 决定停在哪里 | 假设先后产生 16 个有效编号，第 17 次选择结束符。解码器处理 16 个码，生成 64 帧。在 HumanML3D 的 20 帧/秒下约为 3.2 秒。真实采样长度可以不同。 |
| 检查“倒立”是否完成 | 连续骨架轨迹里才看得到身体是否倒转、手腕是否在地面附近。原图展示了一次成功样例；如果用于动画验收，还需从轨迹测量触地、支撑与姿态保持时间。 |

### 训练与推理

两套数据的处理有所不同。HumanML3D 有 14,616 段动作、44,970 条描述，22 个关节、20 帧/秒。KIT-ML 有 3,911 段动作、6,278 条描述，21 个关节、12.5 帧/秒。论文对分词器使用 64 帧训练裁剪，用于训练文本模型的完整片段最长 196 帧，即最多 49 个有效动作码，再加结束符。单张 Tesla V100 32 GB 上，作者报告分词器训练约 14 小时，18 层、16 个注意力头、宽度 1024 的 Transformer 约 78 小时，两阶段合计约 **92 GPU 小时**。[正式版 §4.1][pdf] · [补充材料的模型规模对照][sup]

复现时有两处版本差异值得留意。会议终稿 §4.1 将量化承诺损失的系数 β 写为 1，arXiv v4 写为 0.02；公开训练脚本用 `--commit` 加权这一项，默认值为 0.02。另一个差异在重建损失。论文式 3 对相邻帧差分计算额外的 Smooth L1 误差，公开实现中的 `forward_vel` 直接比较从下标 4 开始的一段动作特征，函数里没有执行时间差分。[会议终稿][pdf] · [arXiv §4.1][settings] · [默认参数](https://github.com/Mael-zys/T2M-GPT/blob/main/options/option_vq.py) · [训练损失](https://github.com/Mael-zys/T2M-GPT/blob/main/train_vq.py#L113) · [损失实现][loss]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 给定文本生成，哪部分提升最明显？

下表摘录会议论文表 1、2 的均值。作者重复评估 20 次并给出 95% 置信区间。R@1 是让评估器在 1 条配对描述与 31 条干扰描述中找回正确文本的比例。MM-Dist 是配对文本和动作的特征距离。FID 比较生成与真实动作的特征分布。标 † 的基线按原表获得真实动作时长，T2M-GPT 自行预测结束。[HumanML3D 原表][human] · [KIT-ML 原表][kit] · [指标定义][settings]

| 数据集 | 方法 | R@1 ↑ | R@3 ↑ | FID ↓ | MM-Dist ↓ |
| --- | --- | ---: | ---: | ---: | ---: |
| HumanML3D | 真实动作 | 0.511 | 0.797 | 0.002 | 2.974 |
| HumanML3D | VQ-VAE 重建（输入真实动作） | 0.501 | 0.785 | 0.070 | 3.072 |
| HumanML3D | MLD † | 0.481 | 0.772 | 0.473 | 3.196 |
| HumanML3D | MotionDiffuse † | 0.491 | 0.782 | 0.630 | 3.113 |
| HumanML3D | T2M-GPT，τ = 0.5 | 0.491 | 0.775 | **0.116** | 3.118 |
| KIT-ML | 真实动作 | 0.424 | 0.779 | 0.031 | 2.788 |
| KIT-ML | VQ-VAE 重建（输入真实动作） | 0.399 | 0.740 | 0.472 | 2.986 |
| KIT-ML | MLD † | 0.390 | 0.734 | **0.404** | 3.204 |
| KIT-ML | MotionDiffuse † | 0.417 | 0.739 | 1.954 | 2.958 |
| KIT-ML | T2M-GPT，τ = 0.5 | 0.402 | 0.737 | 0.717 | 3.053 |
| KIT-ML | T2M-GPT，τ 从 [0, 1] 均匀采样 | 0.416 | 0.745 | 0.514 | 3.007 |

在 HumanML3D 上，T2M-GPT 与 MotionDiffuse 的 R@1 同为 0.491，FID 则从对照方法的 0.630 降到 0.116。KIT-ML 上固定和随机替换率有明显差别，且 MLD 的 FID 低于两种 T2M-GPT 配置。0.070 是给定动捕的重建 FID，用它评价只给文字的生成会混淆两个任务。[表 1][human] · [表 2][kit]

### 消融一：码本的训练方式怎样影响下游？

原表 3 固定 HumanML3D、模型架构和 τ = 0.5，改变码本更新办法。每个版本都同时评估从真实动作重建，以及从文本生成。[原表 3][tab3]

| 码本更新方式 | 重建 FID ↓ | 重建 R@1 ↑ | 生成 FID ↓ | 生成 R@1 ↑ |
| --- | ---: | ---: | ---: | ---: |
| 常规训练 | 0.492 | 0.436 | 42.797 | 0.048 |
| 仅 EMA | 0.097 | 0.499 | 0.176 | 0.490 |
| 仅 Code Reset | 0.102 | 0.494 | 0.248 | 0.461 |
| 两者同时使用 | **0.070** | **0.501** | **0.116** | **0.491** |

同一套预测器架构，普通量化训练和两种改动同时使用的生成 FID 分别为 42.797 和 0.116。另一次码本大小消融里，256、512、1024 个码的重建 FID 分别为 0.145、0.070、0.090。在这套训练条件下，把码本从 512 扩到 1024 没带来更好的重建。[主文量化消融][tab3] · [补充材料表 4][size]

### 消融二：历史中换掉多少个码？

| HumanML3D，替换概率 τ | 生成 FID ↓ | 生成 R@1 ↑ | MM-Dist ↓ |
| --- | ---: | ---: | ---: |
| 0 | 0.140 | 0.417 | 3.730 |
| 0.1 | 0.131 | 0.453 | 3.357 |
| 0.3 | 0.147 | 0.485 | 3.157 |
| 0.5 | **0.116** | 0.491 | **3.118** |
| 0.7 | 0.155 | 0.480 | 3.183 |
| [0, 1] 均匀采样 | 0.141 | **0.492** | 3.121 |

固定 τ = 0.5 将 R@1 从无扰动时的 0.417 提高到 0.491，即 **7.4 个百分点**。同时，同一文字下的动作多样性 MModality 从 3.285 降至 1.856。可见更容易认出原描述和同一句话能产生多少种动作，是两项需要分开汇报的收益与代价。[补充材料完整替换实验][tau] · [原表 1 的多样性列][human]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **训练机制比“模型也叫 GPT”更能解释结果。** 两套架构都很常见。作者固定架构单改量化策略，观察到下游生成性能巨变；再固定分词器单改前缀扰动，观察到文本匹配改善。这两组实验能帮助判断自己的模型应先排查动作表示还是历史依赖。[码本对照][tab3] · [训练历史对照][tau]
- **把真实动捕先送过分词器，是定位失败的低成本办法。** 若一段真实倒立都无法在重建后保持腕部位置，应首先检查码本与解码器；若重建稳定、只给文本就漏掉倒立，再检查语言条件、数据覆盖和采样。原文分别给出真实动作、重建和生成三行，正好支持这种诊断。[静态对照图][fig4] · [主表 1][human]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **长句的细节可能被漏掉。** 项目页的失败样例要求人物略微下蹲、前进、后退，再慢慢绕行，生成动作只覆盖部分描述。模型只取得整句条件，评估也没有逐事件的完成率或时间误差。要把它用于逐项可验收的编排，还需在解码后的关节轨迹上检查顺序、方向和接触。[作者失败样例][project] · [附录 G][limits]
- **可编码不等于能独立编辑。** 编号经全身时序卷积产生，一个码可能同时携带重心和四肢变化。4 倍下采样给出码间距，对应的感受野还能覆盖相邻帧。论文也记录了部分手腿抖动；它没有检验“只改一个码就只移动某只手”这样的局部编辑承诺。[原文图 3][vq] · [附录 G][limits]
- **配对数据规模仍有影响。** 作者用 HumanML3D 的 10%、20%、50%、80%、100% 训练子集分别训练，并在同一完整测试集比较。小数据下也能生成外观像动作的序列，但文本匹配损失明显；文中没有把这组曲线外推成更大规模上的确定收益。[原文图 5][data]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **TM2T（ECCV 2022）** 同样把动作压成可预测的编号，并学习从文字生成动作和由动作反推文字。T2M-GPT 聚焦文字到动作这一向，通过码本训练和前缀扰动把单向任务做强。TM2T 是本文主表直接列出的对照方法。[TM2T 作者项目](https://ericguo5513.github.io/TM2T/) · [T2M-GPT 对比表][human]
- **MoMask（CVPR 2024）** 也先学动作码，但采用多层残差量化，再以掩码预测补全码序列。与 T2M-GPT 顺着时间逐个生成的办法对照，可以区分两项设计：码本如何保留动作细节，以及生成器按什么顺序决定编号。[MoMask 站内解读](/blog/cvpr2024-momask/) · [T2M-GPT 的预测目标][ar]
- **DisCoRD（ICCV 2025）** 将离散码作为连续流解码器的条件。T2M-GPT 中，相同码串经过固定卷积解码器会得到相同的输出；DisCoRD 则研究给定码串时，能否通过条件连续生成补足量化细节。两者并读能追问一个常被忽略的问题：动作细节究竟在选码时决定，还是在解码时补出？[DisCoRD 站内解读](/blog/iccv2025-discord/) · [T2M-GPT 解码实现][codec]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 会议出版记录、11 页终稿和补充实验。[CVPR 2023 会议记录][venue] · [正式 PDF][pdf] · [补充 PDF][sup]
- 含正文、图表和附录的可翻译版，采用 arXiv v4。[HTML 全文][html] · [版本记录][versions]
- 作者逐方法动作对照、失败样例、代码和预训练权重入口。[项目与演示][project] · [官方仓库][repo]

</div>

[venue]: https://openaccess.thecvf.com/content/CVPR2023/html/Zhang_Generating_Human_Motion_From_Textual_Descriptions_With_Discrete_Representations_CVPR_2023_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2023/papers/Zhang_Generating_Human_Motion_From_Textual_Descriptions_With_Discrete_Representations_CVPR_2023_paper.pdf
[sup]: https://openaccess.thecvf.com/content/CVPR2023/supplemental/Zhang_Generating_Human_Motion_CVPR_2023_supplemental.pdf
[project]: https://mael-zys.github.io/T2M-GPT/
[repo]: https://github.com/Mael-zys/T2M-GPT
[versions]: https://arxiv.org/abs/2301.06052
[html]: https://arxiv.org/html/2301.06052v4
[intro]: https://arxiv.org/html/2301.06052v4#S1
[method]: https://arxiv.org/html/2301.06052v4#S3
[fig2]: https://arxiv.org/html/2301.06052v4#S2.F2
[vq]: https://arxiv.org/html/2301.06052v4#S3.SS1
[ar]: https://arxiv.org/html/2301.06052v4#S3.SS2
[fig4]: https://arxiv.org/html/2301.06052v4#S4.F4
[human]: https://arxiv.org/html/2301.06052v4#S3.T1
[kit]: https://arxiv.org/html/2301.06052v4#S3.T2
[tab3]: https://arxiv.org/html/2301.06052v4#S4.T3
[data]: https://arxiv.org/html/2301.06052v4#S4.F5
[settings]: https://arxiv.org/html/2301.06052v4#S4.SS1
[size]: https://arxiv.org/html/2301.06052v4#A4.T7
[tau]: https://arxiv.org/html/2301.06052v4#A3.T6
[repr]: https://arxiv.org/html/2301.06052v4#A5.SS2
[limits]: https://arxiv.org/html/2301.06052v4#A7
[train]: https://github.com/Mael-zys/T2M-GPT/blob/main/train_t2m_trans.py#L112-L135
[codec]: https://github.com/Mael-zys/T2M-GPT/blob/main/models/vqvae.py#L44-L75
[quant]: https://github.com/Mael-zys/T2M-GPT/blob/main/models/quantize_cnn.py#L44-L68
[sample]: https://github.com/Mael-zys/T2M-GPT/blob/main/models/t2m_trans.py#L29-L56
[loss]: https://github.com/Mael-zys/T2M-GPT/blob/main/utils/losses.py#L20-L26
