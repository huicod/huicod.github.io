---
title: "[CVPR2026] HESP：从双臂抬起到水平伸直，文本怎样影响生成动作的细节"
description: "《Hierarchical Enhancement of Semantic Priors for Disentangled Text-Driven Motion Generation》用十个高斯成分表示动作。以双臂平举成 T 字为例，看文本如何影响局部姿态，以及“解耦”得到了哪些验证。"
pubDate: "2026-11-20"
badge: "Paper"
tags: ["HESP", "Text-to-Motion", "Motion Representation", "Latent Diffusion", "Gaussian Mixture", "HumanML3D", "KIT-ML", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[可翻译的 HTML 全文][html] · [会议终稿 PDF][pdf] · [CVPR 论文页][venue] · [补充材料与动作视频][sup]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026</summary>

*Hierarchical Enhancement of Semantic Priors for Disentangled Text-Driven Motion Generation*。作者为 Wenhan Lv、Shaopan Wang、Xiangyu Wu、Tianchu Hang、Zhongquan Jian、Qingqiang Wu。CVPR 2026，第 14844–14853 页。以下据 10 页会议终稿与 16 页补充文档整理。作者公开了 10 段动作演示，截至 2026-11-20 未核实到公开训练代码或权重。表中列的是论文报告值，本次未独立训练或运行推理。[会议记录][venue] · [会议海报](https://cvpr.thecvf.com/virtual/2026/poster/38424) · [补充材料][sup]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

让人“双臂抬起、伸直，做成 T 字”，模型可能听懂“抬手”，却把两臂伸向前方。HESP 先用十个可随时间切换权重的高斯成分学习动作表示，再让扩散模型在每步去噪时同时参考动作原型、词语和整句话。它在两个基准上都提高了文本与动作的检索匹配度；至于“只改手臂方向，其余动作保持原样”，论文留下了一个尚待验证的问题。[原文图 4](/paper-notes/hesp/fulltext/#figure-4) · [主表 1](/paper-notes/hesp/fulltext/#table-1) · [补充材料 A.2、C.2][sup]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文本到动作模型通常先把人体骨架序列压进潜空间，再根据一句描述生成潜变量，解码出逐帧姿态。这样的模型已经能生成“抬手”“走路”等动作，短句里的方向、形状和先后关系更能检验它听懂了多少。[主文引言][p1]

**现有痛点**　两段动作都可以叫“抬手”，但向前伸和向两侧平举在肩、肘、腕上有清楚的区别。统一的高斯先验容易把多种运动模式挤在一起，只给整个序列一条句子特征又容易丢掉局部修饰词。[方法动机][p2] · [定性比较][p7]

**核心矛盾**　相近的姿态需要共享信息，才能从一种动作平滑过渡到另一种；相近的文字有时又必须引出截然不同的局部姿态。把表示切得很死会阻碍过渡，把条件平均得太早会损失细节。[动作先验][p3] · [讨论][p8]

**本文目标**　输入自然语言，生成与整句语义吻合的单人三维骨架动作，同时保留对局部词语的响应。作者用文本—动作匹配、生成分布、重建误差和人评分别检验这几个环节。[方法概览][p3] · [实验设置][p6]

**切入角度**　把“动作怎样表示”和“当前这句话怎样影响动作”分开处理。第一步用有骨架结构的编码器学习多成分动作潜空间，第二步在这个空间里训练带记忆和分层注意力的文本条件去噪器。[原文图 2](/paper-notes/hesp/fulltext/#figure-2)

**核心 idea**　每个时刻都可以用不同权重组合多个运动模式。每次去噪又结合当前动作草稿和提示词，从记忆中读出相关原型，让整句给出动作方向，局部文字补上细节。[主文 §3][p4]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练时有配对的动作和文字。动作编码器与解码器先通过重建学习潜空间，随后去噪器学习怎样从加噪的潜变量恢复与文字相符的动作。生成时，用户提供描述，模型从随机潜变量出发，反复去噪后用动作解码器输出骨架序列。[原文图 2](/paper-notes/hesp/fulltext/#figure-2) · [实验配置][p5]

<figure class="reading-figure"><a href="/paper-notes/hesp/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/hesp/architecture.svg" alt="HESP 架构。先用带十个高斯成分的动作自编码器学习连续表示，再由当前动作与文本查询原型记忆，经分层注意力和门控引导去噪，最后解码为连续骨架姿态。" loading="lazy" /></a><figcaption>据原文图 2、公式 1–5 与附录算法 1 重绘。上游学习动作表示，下游从文本和噪声生成动作。点击可放大。</figcaption></figure>

### 关键设计

1. **让不同动作模式在连续空间里有各自的中心。** AG-VAE 先沿骨架连接提取关节关系，再沿时间编码和池化。编码器给每个时刻一个连续表示，以及对十个高斯成分的软分配。成分均值依赖骨架结构，协方差还考虑时间信息，混合权重可以随动作阶段变化。重建损失要求解码器还原动作，两个 KL 项分别约束成分选择和成分内的连续分布。一个成分在相邻帧间可以逐渐让位给另一个。[主文 §3.1][p3] · [补充材料 A][sup]

2. **用文字和当前动作共同查询原型。** 动态跨模态记忆 DCMM 将当前动作特征沿时间汇总，将词特征沿词序列汇总，拼合得到查询向量。把它与一组学习到的文本—动作原型比较，按相似度加权求和，再将读出的向量加回当前动作表示。因此，同一句话遇到不同的去噪中间状态，可以读出不同的先验。论文的运算对象是特征向量，不涉及把训练集某段动作原样接到输出上。[原文式 3][p4]

3. **让词语细节和整句意图都进入去噪。** 主文式 4 用运动查询分别读取词和句特征，以可学习的权重 λ 调和两路。补充材料的算法 1 给出了更具体、写法也有所不同的两支计算。一支用归一化句向量查询各词；另一支把每个时刻、每个关节的表示展平，查询加了帧位置编码的句特征。前一支的结果广播到关节与时间位置，两支相加、归一化，再做残差连接。热图可以帮助观察模型对部位或时刻的关注，精确到各头的计算应按相应版本的公式阅读。[主文式 4][p4] · [补充材料 B、算法 1][sup]

4. **区分两种门控，以及连续动作从哪里来。** 式 5 另用逐词、逐特征维的 sigmoid 门，融合记忆增强后的动作摘要与词特征。它调节两种模态的占比，作用对象与上一步的 λ 不同。SkipTransformer 随后预测扩散过程的速度参数，采样器据此更新潜变量。最后一次更新后，AG-VAE 解码器才把结果变成随时间变化的姿态。去噪器的速度参数与手腕在三维空间里的运动速度是两种量。[式 4–5 与输出层][p4] · [采样配置][p5]

### 一个完整例子

取主文图 4(c) 的意思，“把双臂抬起并伸直，做成 T 字”。这个例子同时涉及**身体部位**（双臂）、**动作过程**（抬起）、**关节姿态**（伸直）和**最终方向**（向身体两侧展开）。下面沿一次生成追踪这些信息；原文没有给这句话的逐步原型编号或每步权重。[主文图 4](/paper-notes/hesp/fulltext/#figure-4) · [补充材料 C.2][sup]

| 环节 | 这句话经过模型时发生什么 |
| --- | --- |
| 输入 | 文本编码器产生一串词特征和整句表示。生成器同时取得一个随机动作潜变量。用户无需给出手腕轨迹、肩关节角度或某一帧的姿态。 |
| 形成动作草稿 | 每个去噪步都将当前动作摘要与文字一起送去查询记忆，读出的加权原型参与本步更新。十个高斯成分描述动作潜空间，记忆槽则存放跨模态原型，两者没有一一对应关系。 |
| 保留局部区别 | 若只保留“抬双臂”，向前伸也说得通。“伸直”和“T 字”进一步限制肘部和展开方向。分层对齐让这些信息在去噪时仍可用，补充材料用这个提示展示词与关节的注意力。 |
| 看解码后的姿态 | 作者在图 4(c) 中指出，SALAD 的双臂向前呈 V 形，而 HESP 的样例更接近要求的 T 形。若要测量这种区别，可在人体自身坐标系比较双腕相对肩部的侧向与前向位移，再检查肘关节伸展角。论文展示了样例，没有报告这项几何判据的达标率。 |

<figure class="reading-figure"><a href="/paper-notes/hesp/t-pose-comparison.png" target="_blank" rel="noopener"><img src="/paper-notes/hesp/t-pose-comparison.png" alt="原文图 4(c) 同一条双臂平举提示的三组动作。从上到下为 MDM、SALAD、HESP。作者依次检查抬起、伸直和 T 形，只有最后一行满足三项。" loading="lazy" /></a><figcaption>原文图 4(c)，按原行标签裁切拼合。每行从左至右看姿态变化，再看右侧三项标记。SALAD 已做到抬起和伸直，作者把最后方向判为 V 形。Wenhan Lv 等，CVPR 2026，<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。<a href="/paper-notes/hesp/fulltext/#page-6">查看原页</a></figcaption></figure>

### 训练与推理

论文沿用 SALAD 的数据划分。HumanML3D 含 14,616 段动作、44,970 条描述，每段使用 22 个关节；KIT-ML 含 3,911 段动作、6,278 条描述。文本编码器采用 CLIP ViT-B/32。作者报告单张 RTX 3090 Ti、AdamW，VAE 训练 50 个 epoch，去噪器 500 个 epoch。训练的扩散日程为 1,000 步，推理用 50 步 DDIM，分类器自由引导权重为 7.5。没有可据以换算总 GPU 小时的实测训练时长。[实验设置 §4–4.1][p5] · [推理参数][p6]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 文本匹配和动作分布能否同时改善？

下表节选原表 1，保留均值。原表对 20 次重复给出 95% 置信区间。R@1、R@3 衡量配对的动作与描述能否在候选项中排到前 1、前 3 名。MM-Dist 是配对文本与动作在评估器中的平均距离。FID 衡量生成动作和真实动作的特征分布差异。这些指标各自回答不同的问题。[原表 1](/paper-notes/hesp/fulltext/#table-1) · [指标说明][p6]

| 数据集 | 方法 | R@1 ↑ | R@3 ↑ | MM-Dist ↓ | FID ↓ |
| --- | --- | ---: | ---: | ---: | ---: |
| HumanML3D | 真实动作 | 0.511 | 0.797 | 2.974 | 0.002 |
| HumanML3D | ReMoDiffuse | 0.510 | 0.795 | 2.974 | 0.103 |
| HumanML3D | MoMask | 0.521 | 0.807 | 2.958 | **0.045** |
| HumanML3D | SALAD | 0.581 | 0.857 | 2.649 | 0.076 |
| HumanML3D | **HESP** | **0.600** | **0.871** | **2.521** | **0.045** |
| KIT-ML | 真实动作 | 0.424 | 0.779 | 2.788 | 0.031 |
| KIT-ML | ReMoDiffuse | 0.427 | 0.765 | 2.814 | **0.155** |
| KIT-ML | MoMask | 0.433 | 0.781 | 2.779 | 0.204 |
| KIT-ML | SALAD | 0.477 | 0.828 | 2.585 | 0.296 |
| KIT-ML | **HESP** | **0.514** | **0.844** | **2.499** | 0.267 |

HESP 相比 SALAD，R@1 在 HumanML3D 上提高 **1.9 个百分点**，在 KIT-ML 上提高 **3.7 个百分点**。FID 则因数据集而异。HumanML3D 上 HESP 与 MoMask 按论文精度并列；KIT-ML 上 ReMoDiffuse 和 MoMask 的 FID 更低。HESP 的检索分数也高于真实动捕，读这个结果时要记住，评估器奖励的是动作特征能否把配对描述排到前面。[原表 1](/paper-notes/hesp/fulltext/#table-1)

### 动作潜空间分开了多少？信息还原得怎样？

原表 2 在 HumanML3D 测试集上，用 **同一个 AG-VAE 分类器给样本赋簇标签** 后比较两种潜空间。CH 衡量簇间和簇内离散程度之比，DB 衡量相邻簇有多难区分，CS 衡量簇中心的间隔。[原表 2 与图 5](/paper-notes/hesp/fulltext/#table-2) · [分簇方法][p8]

| 动作编码器 | CH ↑ | DB ↓ | CS ↑ |
| --- | ---: | ---: | ---: |
| 标准 VAE | 11.95 | 7.83 | 17.23 |
| AG-VAE | **48.81** | **5.39** | **23.50** |

原表 3 再把真实动作编码、解码，衡量重建。这个测试绕过了文本生成时从噪声到动作的过程，因而可以单独看编码与解码损失了多少信息。[原表 3](/paper-notes/hesp/fulltext/#table-3)

| 重建方法 | MM-Dist ↓ | 重建 FID ↓ | MAE ↓ |
| --- | ---: | ---: | ---: |
| MMM | 2.977 | 0.008 | 0.544 |
| SALAD | 2.685 | 0.004 | 0.450 |
| HESP | **2.520** | **0.003** | **0.344** |

这两张表合起来支持一个较具体的判断：在作者的分簇方式下，AG-VAE 拉开了潜在簇的距离，同时保留了足够的信息来重建动作。若要把某一簇命名为“只控制左右手”或“只控制速度”，还需要外部属性标注或固定其他因素的干预实验。[原表 2–4][p8]

### 消融：分别拿掉记忆与分层对齐会怎样？

| HumanML3D，原表 4 | R@3 ↑ | FID ↓ |
| --- | ---: | ---: |
| 完整 HESP | **0.871 ± 0.002** | **0.049 ± 0.002** |
| 去掉原型记忆 DCMM | 0.847 ± 0.002 | 0.167 ± 0.005 |
| 替换分层注意力 HCA | 0.839 ± 0.002 | 0.116 ± 0.005 |
| 两处同时改动 | 0.826 ± 0.002 | 0.292 ± 0.006 |

去掉记忆时 FID 从 0.049 升至 0.167。将 HCA 换成“句级 CLIP 特征与动作拼接，再做自注意力”时，R@3 从 0.871 降至 0.839，两处同时改动的结果最差。原表 4 的完整模型 FID 印为 **0.049**，主表 1 印为 **0.045**，上表分别按各自的对照组读取。[原表 4 及消融设置][p8] · [原表 1](/paper-notes/hesp/fulltext/#table-1)

### 人看动作，也觉得它更符合描述吗？

作者请 20 位参与者围绕 50 条提示，在 1–5 分上评价动作。HESP 在真实感和语义匹配上均获得三种方法中最高的平均分。这项人评补足了特征空间检索很难表达的主观观感，所列分数是均值。[主文用户研究][p8]

| 方法 | 视觉真实感 ↑ | 与文本语义匹配 ↑ |
| --- | ---: | ---: |
| MoMask | 3.8 | 3.4 |
| SALAD | 4.0 | 3.6 |
| HESP | **4.4** | **4.2** |

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把表征问题和条件问题变成了两个可检查的环节。** 对一段失败的抬手动作，先问“给编码器看真实的 T 字，解码后能还原吗”，再问“只给文字，模型能生成 T 字吗”。重建表回答第一问，主表、消融和图 4 回答第二问。如果重建已明显丢掉肘腕细节，只增强文本编码也很难修复。[图 4](/paper-notes/hesp/fulltext/#figure-4) · [表 2](/paper-notes/hesp/fulltext/#table-2) · [表 3–4][p8]
- **“怎样抬手”比“是否抬手”更能检验细粒度对齐。** 图 4(c) 里的两种方法都能把手抬起来，差别落在双臂相对躯干的方向上。做后续评估时，保留同一个动作动词，只替换方向、部位或终点，比再加一批完全不同的动作名称更能暴露这种错误。这是从论文样例引出的评测思路。[原文图 4](/paper-notes/hesp/fulltext/#figure-4)

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **“解耦”的证据目前主要落在簇的几何分离。** 附录 A.2 讨论了指定成分或在均值间插值的可能用途。论文没有逐簇验证其含义，也没有报告固定同一噪声、只改变某一成分时，目标属性改了多少、其他属性保留了多少。对于编辑应用，这是比 t-SNE 可视化更直接的下一项实验。[附录 A.2][sup] · [原表 2](/paper-notes/hesp/fulltext/#table-2)
- **由多句生成一段长动作仍以演示为主。** 附录展示从走路摆肩到举臂跳舞，再到游泳的三段指令，每段 196 帧。作者也指出，提示缺少过渡信息时，语义相距较远的动作仍容易突变。要用于时间线编排，还需要检验转场连续性、事件顺序以及动作是否在指定帧完成。[附录 C.3、图 5–6][sup] · [主文讨论][p8]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **SALAD（CVPR 2025）是最直接的参照。** 两者都把骨架结构带入连续潜空间，HESP 沿用它的数据划分，又在动作先验与文本对齐上做改动。顺着两篇的编码器、再对照 HESP 的消融表，可以看清“保留骨架结构”和“利用词语细节”各解决哪一步。[SALAD 站内解读](/blog/cvpr2025-salad/) · [HESP 表 4](/paper-notes/hesp/fulltext/#table-4)
- **MoMask（CVPR 2024）提供了离散表示的对照。** MoMask 用分层离散动作码和掩码预测生成动作。HESP 用高斯混合描述连续潜变量，即使选定成分，仍可在该成分内变化。两者在 HumanML3D 上的 FID 同为 0.045，却在文本检索上有明显差异；仅看一个分布指标会掩盖表示方式和提示跟随能力的区别。[MoMask 站内解读](/blog/cvpr2024-momask/) · [HESP 主表 1](/paper-notes/hesp/fulltext/#table-1)
- **与 DiffusionPhase 对照，可厘清这里的“动作阶段”。** DiffusionPhase 把运动的周期结构显式参数化。HESP 里会随时间改变的是各高斯成分的权重，从一个模式切换到另一个模式即可，方法没有定义供用户拨动的周期角。若任务要求在同一节拍相位拼接动作，两类表示所能提供的信息不同。[DiffusionPhase 站内解读](/blog/arxiv2023-diffusionphase/) · [HESP §3.1][p3]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 出版与正文。站内 HTML 根据 OpenReview 所链接的 10 页会议终稿排版，保留页码，方便对照图表与使用翻译插件。[站内 HTML 全文][html] · [CVF 会议记录][venue] · [终稿 PDF][pdf] · [OpenReview 许可记录](https://openreview.net/forum?id=RMlgmOAo4R)
- 附录与视频。A 部分展开动作先验，B 部分给出分层注意力伪代码，C 部分包含词与关节可视化、长动作示例，压缩包另附 10 段视频。[CVF 官方补充包][sup]

</div>

[venue]: https://openaccess.thecvf.com/content/CVPR2026/html/Lv_Hierarchical_Enhancement_of_Semantic_Priors_for_Disentangled_Text-Driven_Motion_Generation_CVPR_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/Lv_Hierarchical_Enhancement_of_Semantic_Priors_for_Disentangled_Text-Driven_Motion_Generation_CVPR_2026_paper.pdf
[sup]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Lv_Hierarchical_Enhancement_of_CVPR_2026_supplemental.zip
[html]: /paper-notes/hesp/fulltext/

[p1]: /paper-notes/hesp/fulltext/#page-1
[p2]: /paper-notes/hesp/fulltext/#page-2
[p3]: /paper-notes/hesp/fulltext/#page-3
[p4]: /paper-notes/hesp/fulltext/#page-4
[p5]: /paper-notes/hesp/fulltext/#page-5
[p6]: /paper-notes/hesp/fulltext/#page-6
[p7]: /paper-notes/hesp/fulltext/#page-7
[p8]: /paper-notes/hesp/fulltext/#page-8
