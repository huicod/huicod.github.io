---
title: "[ICCV2025] StyleMotif：在单个动作扩散模型中融合内容与多模态风格"
description: "解析风格—内容交叉融合、多模态风格检索与扩散引导，展示主实验、消融原表及风格强度和内容质量的取舍。"
pubDate: "2026-10-24T10:03:08+08:00"
badge: "Paper"
tags: ["stylemotif", "Motion-Stylization", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261024-stylemotif-amuse" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · ICCV 2025 · 正式正文与补充材料</summary>

- **论文：** StyleMotif: Multi-Modal Motion Stylization using Style-Content Cross Fusion
- **作者：** Ziyu Guo、Young Yoon Lee、Joseph Liu、Yizhak Ben-Shabat、Victor Zordan、Mubbasir Kapadia。
- **出处：** ICCV 2025 主会，论文集第 13349–13359 页。
- **入口：** [CVF 正式论文页](https://openaccess.thecvf.com/content/ICCV2025/html/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.html) · [正式 PDF](https://openaccess.thecvf.com/content/ICCV2025/papers/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.pdf) · [补充材料](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Guo_StyleMotif_Multi-Modal_Motion_ICCV_2025_supplemental.pdf) · [作者项目页](https://stylemotif.github.io/) · [arXiv 2503.21775](https://arxiv.org/abs/2503.21775)。截至 2026-10-24，项目页的代码和权重按钮仍标为 Coming，尚未核实到可用的官方实现及 checkpoint。
- **领域与关键词：** 动作风格化、文本生成动作、多模态检索、潜空间扩散、内容与风格融合。
- **阅读版本：** 以正式主文 11 页及独立补充 3 页为准；arXiv 入口仅列 2025-03-27 的 v1。本文核验论文与公开资源，没有运行模型。

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

**StyleMotif 保留预训练 MLD 的单个动作扩散主干，把经过内容统计量归一化的动作风格特征注入其中；再借助 ImageBind 对齐与动作特征检索，让文本、图片、视频和音频都能作为风格入口。** 它主要生成“文本指定的动作内容＋参考指定的风格”，也能通过 DDIM 反演处理已有内容动作，但没有提供逐关节或轨迹的硬保持保证。

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 文本生成动作已经能描述“走一圈”“跳跃”“走到前面再转身”等内容。另一条研究路线则从参考动作中迁移“沮丧”“兴奋”“像鸡一样”等风格。SMooDi 将两者结合：输入内容文本与风格动作，在预训练动作生成器上加入风格适配和采样引导。

**现有痛点：** 内容和风格容易相互干扰。例如，希望角色“像鸡一样走一圈”，结果可能只学会张臂、屈膝，却丢掉圆形路径；也可能走对了路线，却没有参考风格。若先生成普通动作再运行独立迁移模型，还会增加处理环节与误差累积。使用额外扩散分支进行风格控制，也带来参数和采样计算开销。

**核心矛盾：** 风格线索需要足够强，才能明显改变动作；但风格参考中也包含自己的动作内容，注入过多会覆盖目标文本。与此同时，用户容易给出一张鸭子图片或一段鸡叫声，却未必能提供对应的人体风格动作。如何将这些语义线索变成生成器能使用的动作条件，是另一层困难。

**本文目标：** 在同一动作扩散主干中协调内容与风格，减少额外扩散分支，并允许动作、文本、图像、视频和音频提供风格参考。目标是产生符合内容要求的风格化动作，不是把视频里的每一个关节轨迹还原出来。

**切入角度：** 作者沿用 MLD 已有的内容生成能力，让风格编码器学习如何向冻结主干提供合适的扰动；通过内容特征的均值和方差调整这个扰动的尺度。对于其他模态，先将其语义与动作风格空间对齐，再检索已有动作风格特征，使生成器继续接收它熟悉的动作条件。

**核心 idea：** 先学习动作风格表示，在扩散主干中间只设置一个交叉归一化融合点；采样时结合内容／风格引导，平衡“做什么”和“怎样做”。再用 ImageBind 与单文本风格标签建立检索接口，把其他模态转换为可用的动作风格参考。[原文 §1–3](https://openaccess.thecvf.com/content/ICCV2025/papers/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.pdf#page=2)

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

常规生成有两个条件：**内容文本 c** 告诉模型生成什么动作，**风格参考 s** 提供表达方式。内容文本进入冻结的 MLD；动作参考由风格编码器得到特征。若参考来自其他模态，则先经过 ImageBind 和对齐映射，在动作风格特征库中检索，再进入同一融合接口。去噪结束后，原有动作解码器把干净 latent 还原成骨架动作。

[![stylemotif 完整架构示意](/paper-notes/stylemotif/architecture.svg)](/paper-notes/stylemotif/architecture.svg)

*点击图示查看大图。依据[正式论文图 2、§3](https://openaccess.thecvf.com/content/ICCV2025/papers/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.pdf#page=3)及补充材料重绘。教学示意，非作者原图。*

图上方区分风格编码、扩散适配和多模态对齐的训练工作；下方沿两种风格入口进入同一个采样主干。主干内部展开第 4 个 Transformer 块后的交叉归一化，并补画论文补充材料中的采样引导与内容动作反演支路。实线表示推理数据流，虚线表示训练产物、可选路径或已标注的梯度关系。图是教学重绘，依据主文图 2、实际 §3.2–3.3 与补充 C.1–C.3；原图内部的节号与正文存在偏移，本文使用正文节号。

### 关键设计

1. **内容与风格分路：风格参考不是默认要保留的源动作**

   在 motion-guided stylization 中，输入动作的职责是提供风格；输出动作的内容由另一条文本指定。例如，参考可能是带有鸡式姿态的走路，内容文本却要求角色走圆圈。模型应迁移姿态和动态特征，而不是复制参考的原始轨迹。

   这一任务与“保持给定内容动作，只修改它的风格”不同。StyleMotif 也支持后者，但要使用单独的反演入口。区分这两种输入契约，才能正确理解论文中的 content preservation：主任务首先指符合文本内容，不等于保持某个源骨架文件的全部细节。[原文 §4.2、§4.4；补充 C.3](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Guo_StyleMotif_Multi-Modal_Motion_ICCV_2025_supplemental.pdf#page=2)

2. **先训练风格编码器，再让它适应冻结的动作生成器**

   风格编码器从 MLD 的 VAE 初始化。原 VAE 已在 HumanML3D 学过多样的动作内容；作者再用 100STYLE 进行 VAE 重建式微调，使它适应风格动作分布。随后丢弃这条预训练分支的重建 decoder，留下 encoder ψ，将参考动作编码为风格特征 F_s。

   这里丢弃的是**风格编码预训练时使用的重建 decoder**，最终生成动作仍需要 MLD 的 motion decoder。后续扩散训练中，只有风格编码器可训练，其他参数保持冻结；因此不是把整个 MLD 重新训练成另一个风格模型。交叉融合操作本身没有额外学习参数，训练的工作主要是使风格表示能被现有主干有效利用。[原文 §3.2、§4.1；补充 C.1](https://openaccess.thecvf.com/content/ICCV2025/papers/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.pdf#page=4)

3. **交叉归一化：用内容统计量调整风格特征，再作残差注入**

   设第 i 个块的内容特征为 F_c，参考动作特征为 F_s。作者先沿特征维度计算内容的均值 μ_c 和方差 σ²_c，再得到：

   <div class="equation">F̃<sub>s,c</sub> = (F<sub>s</sub> − μ<sub>c</sub>) / √(σ²<sub>c</sub> + η)</div>

   <div class="equation">F<sub>fused</sub> = F<sub>c</sub> + γ · F̃<sub>s,c</sub></div>

   前一式对应原文式 4，后一式对应式 5；η 用于数值稳定，γ 控制注入幅度。**被减均值、除标准差的是风格特征，统计量却来自内容特征。** 它并非通常所说的“把内容归一化，再赋予风格均值／方差”的 AdaIN，也不等于让输出严格拥有某一方的统计分布。

   直觉上，模型保留内容主干的特征，同时增加一个经过尺度调整的风格扰动。作者把融合放在 MLD 的**第 4 个 Transformer encoder 块之后**，γ 默认取 0.6。这里的“只融合一次”指一次主干前向中只设置一个融合位置；去噪采样有多个步骤，每一步仍使用这个结构，不是整段采样只看一次风格。它减少了反复注入风格造成的内容干扰，但没有将内容保持写成硬约束。[原文式 2–5；补充 C.1](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Guo_StyleMotif_Multi-Modal_Motion_ICCV_2025_supplemental.pdf#page=1)

4. **多模态对齐服务于检索：先找到动作风格，再生成**

   作者从 100STYLE 构造“风格动作—单文本标签”配对，例如动作配标签 Old。ImageBind 的文本编码器保持冻结，后接一个可训练线性投影 π，使文本表示与动作风格表示进入可比较的空间；用批内正负配对进行双向对比学习。补充明确，这一对齐阶段只训练线性投影，并仅保留带有 forward 移动的风格动作，减少内容差异造成的干扰。

   推理时，文本、图片、视频或音频先由 ImageBind 表示，再从对齐空间中检索语义最接近的动作风格特征。原文给出的具体例子是：内容“一个人在走路”配鸭子图片，检索到与 Duckfoot 有关的动作特征，再生成相应走路风格。它利用的是跨模态语义关联，并未从鸭子图中恢复人体骨架，也未证明能逐帧复制参考视频的运动。

   主文图 2 将 π 画在多模态编码之后，而式 9 简写为 ImageBind 特征；正文没有展开完整的检索算子、候选库清单或视频采样方式。本文按图与文字说明这一语义检索流程，不补造具体实现。多个风格输入也先分别检索动作特征，再加权求和，例如 Balance＋Drunk；这不是把两套骨架轨迹逐帧相加。[原文 §3.3、§4.5–4.6；补充 C.4](https://openaccess.thecvf.com/content/ICCV2025/papers/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.pdf#page=5)

5. **融合之外还有采样引导：内容忠实度和风格强度需要共同调节**

   StyleMotif 沿用 SMooDi 的混合引导，不能仅凭“无参数融合”就把整个生成过程理解为一次前向。第一部分是 classifier-free guidance（CFG）：比较无条件、仅内容、内容加风格三种噪声预测，用 w_c 和 w_s 分别调内容与风格的贡献。将三种预测简记为 ε_∅、ε_c、ε_cs，可把补充式 9 写成：

   <div class="equation">ε̂ = ε<sub>∅</sub> + w<sub>c</sub>(ε<sub>c</sub> − ε<sub>∅</sub>) + w<sub>s</sub>(ε<sub>cs</sub> − ε<sub>c</sub>)</div>

   第二部分是 classifier-based guidance：由当前预测的干净 latent 解码动作，再用一个预训练风格特征提取器，比较生成动作与参考的风格特征距离；该距离对当前 noisy latent 的梯度用于修正噪声预测。本文将它与主风格编码器 ψ 分开标注，原文没有证明二者就是同一个网络。

   梯度引导强度 τ 与前面的融合强度 γ 不同；对比学习温度 τ₀ 又是另一项参数。补充实验选择 τ=2.3 作为权衡点，但更强的引导会损害 FID、文本匹配和足滑指标。风格“更明显”不自动意味着动作整体“更好”。[补充 C.2.1、式 9–10、附录 D](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Guo_StyleMotif_Multi-Modal_Motion_ICCV_2025_supplemental.pdf#page=2)

6. **已有动作通过反演进入：复用生成模型，而非硬拷贝源姿态**

   对 motion style transfer，输入额外包含要保留内容的动作序列。作者先使用内容动作对应的 latent，在不带风格的条件下执行 DDIM 反演，得到对应的噪声 latent z̄_T；它替代原来的随机高斯初态，再经过风格化去噪。该扩展无需额外训练，论文将其去噪步数设为 30。

   源内容因而通过反演初态影响输出，而不是在每一步强制恢复源关节、根轨迹或接触点。表 2 评估风格识别、分布质量与足滑，没有给出逐关节源动作保持误差，所以不能据此保证“未编辑部位完全不动”。[补充 C.3、式 15](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Guo_StyleMotif_Multi-Modal_Motion_ICCV_2025_supplemental.pdf#page=2)

### 一个完整例子

沿用原文图 3 的“Chicken 风格＋走圆圈”：

1. **准备两个条件。** 内容文本为“A person walks in a circle.”，动作参考提供 Chicken 风格。参考的职责是表现方式，圆形路径由内容文本要求。
2. **编码风格。** 参考动作经 ψ 得到 F_s。若改用鸡叫声，则先经 ImageBind 和语义检索取得动作风格参考；这是另一条输入路径，不能假设音频里存在可直接复制的人体轨迹。
3. **从随机 latent 开始。** 在每一步去噪中，内容文本、当前 noisy latent 和时间步进入冻结主干的前 4 个块，得到 F_c。
4. **注入经过调整的风格。** 用 F_c 的均值和方差归一化 F_s，以 γ=0.6 加到内容特征上，后续块预测噪声；内容／风格 CFG 与特征梯度引导继续平衡两类要求。
5. **重复采样并解码。** 常规设置经过 50 个采样步骤，最终 latent 经 MLD decoder 变为动作。作者展示的结果同时包含鸡式姿态与圆形行走，但这是论文案例，不是所有输入都满足精确圆形轨迹的证明。

以上说明来自论文结构与图示，本次没有运行该案例；具体中间 latent 数值与检索结果未公开。[原文图 3，PDF 第 6 页](https://openaccess.thecvf.com/content/ICCV2025/papers/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.pdf#page=6)

### 训练/推理

作者使用 HumanML3D 提供内容动作、100STYLE 提供风格动作，统一采用 HumanML3D 的 root-velocity 表示。扩散训练使用的 100STYLE 内容描述来自前作以 MotionGPT 生成的伪文本；这与多模态对齐用的单个风格标签不同。论文报告 100STYLE 经处理后包含 45,303 条风格动作，不能直接视作 45,303 种不同风格。

| 训练工作 | 数据与目标 | 训练／冻结范围 | 已披露设置 |
|---|---|---|---|
| 风格编码预训练 | 从 HumanML3D 预训练 MLD VAE 出发，在 100STYLE 做重建式适配 | 适配风格 VAE，随后只保留 encoder | 200 epochs |
| 风格化扩散适配 | 标准去噪、HumanML3D 内容 prior 保留、跨数据集 cycle prior 保留 | 只训练风格 encoder；冻结其他参数 | 50 epochs，batch 64，AdamW，学习率 10⁻⁵，单张 A100 |
| 多模态对齐 | forward 风格动作与单文本标签的双向对比学习 | 固定已有编码器，只训练线性 π | 200 epochs，温度 τ₀=1.0 |

训练时还随机置空内容文本、沿时间维遮挡 10% 的风格动作；论文没有在这里给出文本置空概率。扩散训练使用 1,000 个噪声时间步，常规推理降为 50 步，内容动作反演任务使用 30 步去噪。综合训练损失为标准去噪损失加内容 prior 与 cycle prior 两项加权项，后两者旨在避免模型只适应狭窄风格动作分布，不是源动作硬约束。[原文 §4.1；补充 C.1–C.3、式 11–14](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Guo_StyleMotif_Multi-Modal_Motion_ICCV_2025_supplemental.pdf#page=1)

论文披露了阶段 epoch、部分超参数和推理耗时，没有给出三项训练合计的 GPU 小时或完整调参预算。公开项目仍以演示与论文为主，本次没有取得可运行的官方训练配置和权重，不能把上述设置当作已经复现的训练配方。

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

主任务从 HumanML3D 选内容文本，从 100STYLE 选风格参考。SRA 是预训练分类器识别出的风格正确率，按百分数报告；当内容来自 HumanML3D 时，作者**排除了带具体动作含义的 ACT 类风格**，以避免如 TwoFootJump 与“跑步”冲突。它不是对任意开放风格、图像理解或视频动作还原的统一成功率。

FID 衡量动作特征分布差异，MM Dist 衡量文本与动作嵌入距离，R-Precision 为文本—动作检索的 Top-3 命中率。Foot Skate Ratio 衡量脚滑。Diversity 只作参考：作者说明没有相应真实风格化动作分布可供对照，因此没有将某个 Diversity 值标为最佳。下列数值均为作者结果，没有自行补充误差条。[原文 §4.1；补充 C.4](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Guo_StyleMotif_Multi-Modal_Motion_ICCV_2025_supplemental.pdf#page=3)

**动作参考引导的文本生成动作，完整主文表 1 上半部分。**

| 方法 | SRA ↑（%） | FID ↓ | MM Dist ↓ | R-Precision Top-3 ↑ | Diversity（参考） | Foot Skate Ratio ↓ |
|---|---:|---:|---:|---:|---:|---:|
| MLD + Aberman | 54.37 | 3.309 | 5.983 | 0.406 | 8.816 | 0.347 |
| MLD + Motion Puzzle | 63.77 | 6.127 | 6.467 | 0.290 | 6.476 | 0.185 |
| SMooDi | 72.42 | 1.609 | 4.477 | 0.571 | 9.235 | 0.124 |
| StyleMotif | 77.65 | 1.551 | 4.354 | 0.586 | 7.567 | 0.097 |

**文本风格标签引导，完整主文表 1 下半部分。** MLD＋ChatGPT 的做法是用 ChatGPT 合并内容与风格文本，再交给普通文本生成动作模型。

| 方法 | SRA ↑（%） | FID ↓ | MM Dist ↓ | R-Precision Top-3 ↑ | Diversity（参考） | Foot Skate Ratio ↓ |
|---|---:|---:|---:|---:|---:|---:|
| MLD + ChatGPT | 4.82 | 0.614 | 4.313 | 0.605 | 8.836 | 0.131 |
| StyleMotif | 56.71 | 0.603 | 3.684 | 0.690 | 9.101 | 0.101 |

**内容动作＋风格动作的迁移，完整主文表 2。** StyleMotif 使用反演初态；此表不包含源动作逐关节误差。

| 方法（名称按原表） | SRA ↑（%） | FID ↓ | Foot Skate Ratio ↓ |
|---|---:|---:|---:|
| MLD + Aberman | 61.01 | 3.892 | 0.338 |
| MLD + Motion Puzzle | 67.23 | 6.871 | 0.197 |
| SMooDi | 65.15 | 1.582 | 0.095 |
| StyleMotif | 68.81 | 1.375 | 0.094 |

三表均见[主文第 6 页，表 1–2](https://openaccess.thecvf.com/content/ICCV2025/papers/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.pdf#page=6)。两类生成任务和反演任务的条件与样本口径不同，不能仅因 FID 数字较小就跨表判断哪种控制方式更强。

**效率，完整补充表 1：相同扩散步数，单张 NVIDIA A100 的平均单样本耗时。**

| 方法 | 总参数 | 可训练参数 | 推理耗时 |
|---|---:|---:|---:|
| SMooDi | 468M | 13.9M | 4.0 s |
| StyleMotif | 462M | 7.8M | 3.1 s |
| 相对减少（原表） | 1.3% | 43.9% | 22.5% |

43.9% 指**可训练参数**减少，总参数仅减少约 1.3%；22.5% 是单样本**耗时下降**，不是吞吐量增加 22.5%。表中未说明固定输出帧数、重复计时次数或所有前处理是否计入，因此不能推成任意长度动作的实时性能。[补充 B、表 1](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Guo_StyleMotif_Multi-Modal_Motion_ICCV_2025_supplemental.pdf#page=1)

**主观偏好：** 补充 A 报告超过 200 组 StyleMotif 与 SMooDi 动作对，由动画师、动作研究者和相关领域博士生按合理性、平滑度与整体质量二选一，StyleMotif 获得 79.8% 的偏好。原文没有披露参与人数、各人评判数量或统计显著性检验，故只能按该人评设置解释，不能直接当作普遍用户接受率。

### 消融实验

**风格编码预训练，主文表 3 上半部分：** 下表保留所有指标；“两者都有”指沿用 HumanML3D 预训练，再用 100STYLE 适配。

| HumanML3D | 100STYLE | SRA ↑（%） | FID ↓ | MM Dist ↓ | R-Precision ↑ | Diversity（参考） | Foot Skate Ratio ↓ |
|---|---|---:|---:|---:|---:|---:|---:|
| 否 | 是 | 76.73 | 1.788 | 4.349 | 0.571 | 7.505 | 0.101 |
| 是 | 否 | 76.58 | 1.635 | 4.458 | 0.572 | 8.534 | 0.109 |
| 是 | 是 | 77.65 | 1.551 | 4.354 | 0.586 | 7.567 | 0.097 |

同时利用两种数据在 SRA、FID、R-Precision 与脚滑上较好，但 MM Dist 的 4.354 略差于只用 100STYLE 的 4.349，不能说每一项都最佳。

**对齐用的文本形式，主文表 3 下半部分：** 单标签如 Old，简短描述如“一个老人”，详细描述还加入“移动缓慢而僵硬”。

| 对齐文本 | SRA ↑（%） | FID ↓ | MM Dist ↓ | R-Precision ↑ | Diversity（参考） | Foot Skate Ratio ↓ |
|---|---:|---:|---:|---:|---:|---:|
| 简短描述 | 76.84 | 1.580 | 4.378 | 0.578 | 7.251 | 0.099 |
| 详细描述 | 75.25 | 1.622 | 4.419 | 0.563 | 7.764 | 0.102 |
| 单文本标签 | 77.65 | 1.551 | 4.354 | 0.586 | 7.567 | 0.097 |

在作者的对齐设置中，单标签的信号更有效；这不能外推成所有动作任务中短文本都优于详细描述。两张表见[主文 §4.7、表 3，第 8 页](https://openaccess.thecvf.com/content/ICCV2025/papers/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.pdf#page=8)。

**融合强度 γ，主文图 7：** 下表直接转录图上的数字标签，FID 精度按图保留。

| γ | SRA ↑（%） | FID ↓ |
|---:|---:|---:|
| 0.2 | 68.5 | 1.23 |
| 0.4 | 73.7 | 1.51 |
| 0.6 | 77.65 | 1.55 |
| 0.8 | 77.8 | 1.76 |

γ=0.2 的 FID 最低，γ=0.8 的 SRA 最高；作者选择 0.6 是权衡，而不是该点在两指标上同时最优。[主文图 7](https://openaccess.thecvf.com/content/ICCV2025/papers/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.pdf#page=8)

**风格梯度引导 τ，补充图 8：** 增强 τ 提高 SRA，但 FID、MM Dist、R-Precision 和脚滑表现会变差；作者认为超过 2.3 后收益不足以抵消损失，选 2.3 为平衡点。图没有逐点数值标签，本文不从折线位置猜造小数。论文没有单独报告移除交叉归一化、改用 AdaIN 或改变注入层数的定量对照，因此这些设计选择不能都当作已有独立消融验证。[补充 D、图 8](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Guo_StyleMotif_Multi-Modal_Motion_ICCV_2025_supplemental.pdf#page=2)

### 关键发现

1. **动作风格引导有稳定但并非无限大的提升。** 相对 SMooDi，表 1 的 SRA 从 72.42% 到 77.65%，提高 **5.23 个百分点**；FID 从 1.609 到 1.551，脚滑从 0.124 到 0.097。Diversity 同时从 9.235 降至 7.567，但缺少真实参考，不能仅凭下降判好坏。表 2 的 SRA 提高 3.66 个百分点，而非笼统相对提高 3.66%。
2. **多模态能力有清楚的证据层级。** 动作与文本风格有定量表；图像、音频、视频以及风格混合主要由图 5–6 和项目演示支持，没有各模态独立的大规模定量结果。文字标签实验的 56.71% SRA 不能当作视频风格控制的准确率。
3. **效率收益来自减少需要适配的生成结构。** 总模型仍有 462M 参数，并保留风格编码器、文本／多模态编码和采样引导；单扩散主干不代表整个系统很小或无需训练。
4. **内容和风格仍是取舍关系。** 两组强度实验都说明，提高风格识别得分可能损害内容匹配、分布质量或脚滑。交叉归一化改善了协调方式，没有消除任务本身的冲突。

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **将适配任务交给风格表示：** 冻结已有动作生成主干，让风格 encoder 学会提供适合该主干的扰动，减少为了一个条件再复制一套扩散网络的需要。
- **融合点明确且容易分析：** 内容统计量、风格特征、残差幅度分别可定位，γ 的效果也能通过实验直接观察。参数少不意味着公式具备硬约束，但有利于解释设计选择。
- **用检索连接多模态与动作生成：** ImageBind 提供语义入口，已编码动作提供生成器熟悉的风格条件。这种分工避免要求图片或音频编码器直接输出完整人体动作，同时暴露出检索覆盖范围这一实际边界。
- **保留生成与编辑两种入口：** 随机初态服务于文本生成，反演初态服务于已有动作迁移；两条路径复用模型，但应分别报告内容保持证据。

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

1. **多模态控制依赖语义检索及动作库覆盖。** 鸭子图像检索 Duckfoot 是有用的语义关联，不等于恢复鸭子的真实运动或理解任意人物视频的个人动作风格。库外风格与复杂组合能否稳定处理，论文没有系统评估。
2. **数据筛选缓解了部分冲突，也缩小了结果范围。** SRA 排除 ACT 风格，对齐仅使用 forward 子集；任意内容与任意风格冲突时如何协调，仍不能由这些结果保证。
3. **没有精确空间与源动作保持约束。** 生成器不接受逐关节硬锁、指定接触点或场景碰撞条件；源动作反演也没有给出全帧误差界限。脚滑较低不等于物理可执行或碰撞安全。
4. **关键设计仍有未隔离的因素。** 主表同时包含编码器适配、融合和混合引导的效果；没有完整的归一化形式与注入层位置对照。人评人数、重复实验置信区间及完整训练时长也未披露，限制了对稳定性与成本的进一步判断。
5. **公开发布状态限制了复现核验。** 截至本次检查，作者项目仍显示代码、checkpoint 待发布；没有可供逐行核实的官方核心实现或已验证权重。因此检索细节、全部采样超参数和版本一致性仍是未知，本次结果都来自论文，不是运行复现。

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **[MLD（CVPR 2023）](https://openaccess.thecvf.com/content/CVPR2023/html/Chen_Executing_Your_Commands_via_Motion_Diffusion_in_Latent_Space_CVPR_2023_paper.html)：** 在动作 VAE 的 latent 中做文本条件扩散，是 StyleMotif 复用的内容生成基础。本文的新增部分是风格表示、融合和多模态入口，不是重新提出 latent motion diffusion。
- **[SMooDi（ECCV 2024）](https://neu-vi.github.io/SMooDi/)：** 同样输入内容文本与风格动作，提供风格适配、混合采样引导及反演扩展。StyleMotif 继承后两类设计，主要改变风格注入结构并加入多模态对齐；比较时不能把全部能力都归因于交叉归一化。
- **[ImageBind（CVPR 2023）](https://openaccess.thecvf.com/content/CVPR2023/html/Girdhar_ImageBind_One_Embedding_Space_To_Bind_Them_All_CVPR_2023_paper.html)：** 提供跨模态共享表示与语义检索基础。StyleMotif 将动作风格与这类空间连接，但没有因此获得视频中的精确姿态、接触或时间对齐监督。
- **[STyMo（SIGGRAPH 2026）](https://joseluisponton.com/stymo-project-page/)：** 在少量中性／风格配对动作上按风格单独训练，并将静态、动态残差施加于源动作。StyleMotif 依托预训练生成器与风格数据集，主要从文本生成，再用反演扩展到源动作迁移；两者输入要求、训练方式和保持机制不同。
- **启发：** 对具有持续角色风格的动作系统，可以把“语义选择合适风格”“生成内容动作”“验证最终轨迹和接触”分成清楚的环节。StyleMotif 对前两项给出一个紧凑连接方式，第三项仍需要独立控制与检查。

<span id="reading-8" class="reading-anchor"></span>

## 来源

- **正式版本：** [CVF ICCV 2025 记录](https://openaccess.thecvf.com/content/ICCV2025/html/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.html)、[主文 PDF](https://openaccess.thecvf.com/content/ICCV2025/papers/Guo_StyleMotif_Multi-Modal_Motion_Stylization_using_Style-Content_Cross_Fusion_ICCV_2025_paper.pdf)、[独立补充 PDF](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Guo_StyleMotif_Multi-Modal_Motion_ICCV_2025_supplemental.pdf)。本次完整读取主文与补充，目视核对主文表 1–3、图 7，以及补充表 1、图 8。
- **方法定位：** 主文 §3.2、式 2–5 为交叉融合；§3.3、式 6–9 为对齐与检索；§4.1 为冻结范围；补充 C.1 为训练设置，C.2 为引导与损失，C.3 为源动作反演，C.4 为数据筛选。主文和补充的公式编号分别引用，避免两个“式 9”混淆。
- **公开资源与版本：** [作者项目](https://stylemotif.github.io/)和 [arXiv v1](https://arxiv.org/abs/2503.21775v1)，核验日期 2026-10-24。项目页视频与论文静态案例属于作者演示；本文没有运行模型，也未下载大型权重。
- **图表说明：** 架构图为自行绘制的教学示意；表格数值来自上述原始论文，不是本文实验。不使用第三方解读作为技术事实来源，也不将 CVF 可访问误写成论文原图具有任意再许可。
- **形式参考：** 沿用网站八节模板及 [Paper-Notes 的 LaMoGen 解读](https://papernotes.org/CVPR2026/human_understanding/lamogen_language_to_motion_generation_through_llm-guided_symbolic_inference/)的组织方式。本文为单篇精读及必要关联比较，不是系统性综述。

</div>
