---
title: "[CVPR2026] SFD：让语义先形成，再协同细化图像纹理"
description: "通过独立语义与纹理潜变量、双时钟和三阶段去噪解释 SFD，并核对收敛提速、无引导反例与公开资源。"
pubDate: "2026-10-26T11:18:03+08:00"
badge: "Paper"
tags: ["sfd", "论文解读", "图像生成", "潜空间扩散", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026 · 全文与公开资源核查</summary>

**论文**：Semantics Lead the Way: Harmonizing Semantic and Texture Modeling with Asynchronous Latent Diffusion。**作者**：Yueming Pan、Ruoyu Feng、Qi Dai、Yuqi Wang、Wenfeng Lin、Mingyu Guo、Chong Luo、Nanning Zheng。**出处与版本**：CVPR 2026，正式论文第 43664–43674 页；本文以 CVF 正式主文和独立补充为准，并核对 arXiv:2512.04926v2（2025-12-05）。**研究对象**：图像生成，主要为 ImageNet 256×256。核查日期：2026-10-26。

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

SFD 将图像表示拆成语义潜变量与纹理潜变量，用同一个扩散 Transformer 联合生成两者，但让语义的去噪时钟领先一点；这样模型可以在较清楚的整体结构引导下补充纹理，又保留两路共同调整的阶段，最终只把纹理潜变量解码成图像。

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

- **领域现状**：潜空间扩散先用 VAE 压缩图像，再学习从噪声恢复潜变量。DiT、LightningDiT 将扩散网络换成 Transformer；REPA 等方法利用 DINOv2 的视觉表征帮助模型学习结构。
- **现有痛点**：像素重建导向的 VAE 擅长保留颜色和细节，但扩散模型仍要同时学会对象是什么、各部分怎样排列、纹理如何呈现。只向模型注入语义特征，并没有规定这些信息应该何时形成。
- **核心矛盾**：纹理生成需要结构引导，可是同步去噪会让两者同时处于很嘈杂的状态；若强制先完整生成语义、再生成纹理，训练时的干净语义与推理时预测出来的语义又可能不一致。
- **本文目标**：在保持图像重建能力的同时，提高图像生成质量和达到给定质量所需的训练效率。
- **切入角度**：保留独立的语义与纹理表示，为它们设置不同噪声水平，使语义更早清晰，但不切断联合生成。
- **核心 idea**：不是把扩散完全拆成两个模型，而是在一个联合模型内安排“语义先启动—两路错时协作—纹理收尾”的生成顺序。这里的“语义”是视觉特征，不是自然语言计划或离散动作标签。

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

[![sfd 完整架构示意](/paper-notes/sfd/architecture.svg)](/paper-notes/sfd/architecture.svg)

*点击图示查看大图。依据文中注明版本的论文全文及方法图重绘。教学示意，非作者原图。*

图从上往下分成三部分。首先用真实图像准备两种连续潜变量：冻结的 DINOv2 提供高维 patch 特征，SemVAE 将其压缩成语义表示；独立的 SD-VAE 保留可重建图像的纹理表示。其次训练一个接收两路噪声潜变量、两种时间和类别标签的 LightningDiT。最后在推理时从两路随机噪声开始，按不同时间表联合更新，丢弃最终语义潜变量，只解码纹理。

“语义先行”发生在同一幅图像的扩散进程中，不是视频帧之间的自回归，也没有语言模型生成计划。图中的 DINOv2 和 SemVAE 编码器用于准备训练表示；普通类别条件生成不需要输入参考图像。[正式主文 §3，PDF 第 3–5 页](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=3)

### 关键设计

1. **用专门的 SemVAE 压缩语义，保留独立纹理解码通路。**

   DINOv2-B-reg 提取的 patch 特征每个位置有 768 维。SemVAE 的编码器和解码器各用四个 Transformer 块，将特征压缩成每位置 16 维的连续随机变量，再学习重建原始视觉特征。训练目标是 MSE、余弦距离与很小的 KL 正则，KL 权重为 10⁻⁷。MSE 约束数值大小，余弦项约束方向；SemVAE 学完后冻结。

   另一条路采用 LightningDiT 使用的 SD-VAE f16d32：256×256 图像变成 16×16×32 的纹理潜变量。两路在通道维拼接，得到 16×16×48，即 256 个空间位置，每位置 16 个语义通道和 32 个纹理通道。这里的 token 是连续 patch 表示，未使用离散码本。保持独立纹理 VAE 的好处是不用为了语义对齐而改坏图像重建通路。[主文 §3.2、§4.1](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=4)

2. **让两个时钟错开，而不是让语义完全做完再交给纹理。**

   论文使用流匹配记号：时间 0 是噪声，时间 1 是干净数据。设全局进度为 u，语义领先量为 Δ：

   <div class="equation">t<sub>s</sub> = min(u, 1)，t<sub>z</sub> = max(u − Δ, 0)，u ∈ [0, 1 + Δ]。</div>

   <div class="equation">s(t<sub>s</sub>) = t<sub>s</sub>s₁ + (1 − t<sub>s</sub>)s₀；z(t<sub>z</sub>) = t<sub>z</sub>z₁ + (1 − t<sub>z</sub>)z₀。</div>

   默认 Δ=0.3。例如全局进度 u=0.6 时，语义的时间是 0.6，而纹理只有 0.3。模型看到的不是完整语义答案，而是较清楚的语义状态，因此训练和推理都能保留共同修正的空间。Δ=0 恢复同步生成；Δ=1 则几乎变成严格串行的两阶段生成，实验反而变差。

   主文式 12 用均匀采样说明时间构造；补充 A.2 和当前训练配置实际采用 logit-normal 采样，再做伸缩与截断。这个实现细节不改变谁领先，但复现时不能只照均匀公式采样。[主文式 12–14](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=4)

3. **同一个网络联合预测两路速度，双时间嵌入说明各自噪声程度。**

   LightningDiT 接收拼接潜变量、类别 y 和两个时间，输出语义速度与纹理速度。两个时间分别经过宽度减半的嵌入器，再拼接回原隐藏宽度；并不是复制两个完整 DiT。

   <div class="equation">[v̂<sub>s</sub>, v̂<sub>z</sub>] = DiT([s(t<sub>s</sub>), z(t<sub>z</sub>)], t<sub>s</sub>, t<sub>z</sub>, y)。</div>

   速度回归分别以 s₁−s₀、z₁−z₀ 为目标，语义项权重 β=2。再用 REPA 将较浅层的隐藏特征对齐到干净 DINOv2 特征。语义 latent 负责作为显式建模对象，REPA 负责约束中间特征，二者承担的作用不同；消融也显示只保留其中一部分不足以达到完整结果。主文给出 MSE 速度损失加 REPA；当前公开训练代码还启用 LightningDiT 的速度余弦损失，属于复现配置需要注意的补充。[主文式 15–18；补充 A.3](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=5)

4. **用三段更新掩码执行日程，最终只解码纹理。**

   u 从 0 到 0.3：只更新语义；从 0.3 到 1：两路都更新，但语义始终领先；从 1 到 1.3：语义保持不变，只更新纹理。掩码作用在网络输出速度上，使尚未启动或已经完成的通路暂停更新。语义在第三段仍是模型可见的条件，只是不继续移动。

   结束时图像为 SD-VAE 解码器的输出 D<sub>z</sub>(z₁)。SemVAE 解码器用于训练语义压缩器，并不是最终图像解码器。论文通过相应放大固定步长来保持采样步数预算；主结果使用的 dopri5 则是自适应求解器，不能把配置里的“250”直接理解为 250 次网络求值。[主文式 19–20；补充 B.2](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=5)

### 一个完整例子

以生成一张 ImageNet“茶壶”类别图像为例。以下是按算法构造的教学流程，不是一次实跑记录。

1. 输入茶壶的类别标签，随机采样 16×16×16 的语义噪声和 16×16×32 的纹理噪声。此时没有真实茶壶图像，也没有外部文字描述。
2. 当 u=0.15 时，语义时间为 0.15、纹理时间为 0。模型开始形成与茶壶整体组织相关的表示，但纹理路仍保留其初始噪声。
3. 当 u=0.6 时，语义时间为 0.6、纹理时间为 0.3。网络同时处理两路：较清楚的语义帮助纹理路形成与壶身、壶嘴等结构相容的细节；这些具体部件的解释是直观说明，算法没有显式壶嘴坐标或部件检测器。
4. 当 u=1.15 时，语义已到 1、纹理到 0.85。模型保持语义状态，继续细化纹理。最终 u=1.3 时，只把 z₁ 送入 SD-VAE 解码器，得到 256×256 图像。
5. 若固定语义噪声而改变纹理噪声，作者补充图 1 中的狗图像大体保留相似构图，但毛发、围巾等细节会变化。这是定性展示，不等于对布局或身份的严格保持保证。[补充 E、图 1，第 7 页](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf#page=7)

### 训练/推理

**训练分两步。** SemVAE 先在 ImageNet-1K 上训练 100 万 iteration，batch=64、学习率 5×10⁻⁵；其编码器和解码器各约 29M，总计 58M。随后冻结表示提取部分，训练扩散骨干；完整配置 batch=256、学习率 10⁻⁴、最多 800 epoch，约 400 万 iteration。400K 消融改用学习率 2×10⁻⁴、AdamW β₂=0.95，因此不能把其 FID 3.03 与常规训练的 3.53 当成同一配置结果。[补充 A，表 1–2](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf#page=1)

**推理还要区分是否使用 AutoGuidance。** 最优 FID 使用主模型和较弱的 LightningDiT-B 引导模型共同采样；例如训练 800 epoch 的 XL 使用 70K iteration 的 B 模型，引导系数 1.5。它不是不增加模型调用的免费提升。论文的 100×/33.3× 指达到可比无引导 FID 的训练迭代数之比，没有包含 SemVAE 预训练、特征提取和引导模型的完整端到端耗时。[补充表 3；主文 §4.2](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf#page=2)

**公开资源已具备训练与推理入口。** 本次固定检查官方仓库 [273f058895c6](https://github.com/yuemingPAN/SFD/tree/273f058895c6a616bf3d736fb440b3bec8fcdee8)：包含 SemVAE 训练、扩散训练、推理、评估脚本及配置，代码为 MIT 许可；[官方 Hugging Face](https://huggingface.co/SFD-Project/SFD/tree/main) 可见 SemVAE、XL/XXL、弱引导模型权重及 latent 统计文件。训练仍需要自行准备 ImageNet，README 提醒特征预提取空间超过 1 TB。作者报告论文在 16 张 NPU 上训练/评估，并列出 8 张 A100 的数值差异；这不是本文复跑结果。本次仅核查文件和代码，未下载大权重、未运行训练或生成。

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

下表完整保留正式主文表 2 的 ImageNet 256×256 **有引导**系统比较。各方法模型、训练时长和引导方式可能不同，不是只替换一个模块的等预算比较。[主文第 7 页，表 2](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=7)

| 方法 | Epoch | 参数 | FID↓ | sFID↓ | IS↑ | Precision↑ | Recall↑ |
|---|---:|---:|---:|---:|---:|---:|---:|
| VAR | 350 | 2.0B | 1.80 | — | 365.4 | 0.83 | 0.57 |
| MAR | 800 | 943M | 1.55 | — | 303.7 | 0.81 | 0.62 |
| xAR | 800 | 1.1B | 1.24 | — | 301.6 | 0.83 | 0.64 |
| DiT-XL | 1400 | 675M | 2.27 | 4.60 | 278.2 | 0.83 | 0.57 |
| MaskDiT | 1600 | 675M | 2.28 | 5.67 | 276.6 | 0.80 | 0.61 |
| SiT-XL | 1400 | 675M | 2.06 | 4.50 | 270.3 | 0.82 | 0.59 |
| FasterDiT | 400 | 675M | 2.03 | 4.63 | 264.0 | 0.81 | 0.60 |
| MDT | 1300 | 675M | 1.79 | 4.57 | 283.0 | 0.81 | 0.61 |
| MDTv2 | 1080 | 675M | 1.58 | 4.52 | 314.7 | 0.79 | 0.65 |
| DDT | 400 | 675M | 1.26 | — | 310.6 | 0.79 | 0.65 |
| VA-VAE | 800 | 675M | 1.35 | 4.15 | 295.3 | 0.79 | 0.65 |
| REPA | 800 | 675M | 1.42 | 4.70 | 305.7 | 0.80 | 0.65 |
| REPA-E | 800 | 675M | 1.12 | 4.09 | 302.9 | 0.79 | 0.66 |
| ReDi | 800 | 675M | 1.61 | 4.66 | 295.1 | 0.78 | 0.64 |
| REG | 800 | 677M | 1.36 | 4.25 | 299.4 | 0.77 | 0.66 |
| RAE（DiT-XL） | 800 | 676M | 1.41 | — | 309.4 | 0.80 | 0.63 |
| RAE（DiTᴰᴴ-XL） | 800 | 839M | 1.13 | — | 262.6 | 0.78 | 0.67 |
| SFD XL | 80 | 675M | 1.30 | 3.87 | 233.4 | 0.78 | 0.64 |
| SFD XL | 800 | 675M | 1.06 | 3.89 | 267.0 | 0.78 | 0.67 |
| SFD XXL | 80 | 1.0B | 1.19 | 4.00 | 240.4 | 0.78 | 0.65 |
| SFD XXL | 800 | 1.0B | 1.04 | 3.75 | 264.2 | 0.78 | 0.66 |

| 指标 | 应怎样理解 |
|---|---|
| FID / sFID | 分别比较 Inception 表征分布及空间特征分布，越低越好；不是逐图的语义正确率。 |
| IS | 分类置信与跨样本类别多样性的综合指标，越高越好。 |
| Precision / Recall | 生成分布的保真与覆盖指标，不是文本检索准确率。 |
| rFID / PSNR / LPIPS / SSIM | 下文用于输入图像的重建，和从噪声生成的 FID 分开理解。 |

主评测使用 ADM pipeline 和 50K 张生成图像。SFD 采用每类 50 张的 class-balanced 采样；表中部分旧方法使用原论文协议，补充表 7 专门统一比较随机与均衡类别采样。表值未给出重复训练的置信区间。SFD 的优势集中在有引导 FID、sFID；其 IS 264.2 低于 VAR 的 365.4，Precision 0.78 也不是最高，不能概括成所有指标领先。

<details>
<summary>无引导训练收敛：完整主文表 1</summary>

以下均为无引导 FID；参数与训练迭代数保持原表。[主文第 7 页，表 1](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=7)

| 方法 | 参数 | Iteration | FID↓ |
|---|---:|---:|---:|
| DiT-B/2 | 130M | 400K | 43.47 |
| LightningDiT-B/1 | 130M | 400K | 22.86 |
| +REPA | 130M | 400K | 21.45 |
| +SFD | 130M | 400K | 10.40 |
| DiT-L/2 | 458M | 400K | 23.33 |
| LightningDiT-L/1 | 458M | 400K | 10.08 |
| +REPA | 458M | 400K | 7.48 |
| +SFD | 458M | 400K | 3.89 |
| DiT-XL/2 | 675M | 400K | 19.47 |
| DiT-XL/2 | 675M | 7M | 9.62 |
| LightningDiT-XL/1 | 675M | 400K | 9.29 |
| LightningDiT-XL/1 | 675M | 1M | 7.48 |
| LightningDiT-XL/1 | 675M | 2M | 6.88 |
| LightningDiT-XL/1 | 675M | 4M | 6.50 |
| LightningDiT-XL/1 +REPA | 675M | 400K | 6.94 |
| LightningDiT-XL/1 +REPA | 675M | 1M | 6.17 |
| LightningDiT-XL/1 +REPA | 675M | 2M | 5.87 |
| LightningDiT-XL/1 +REPA | 675M | 4M | 5.84 |
| LightningDiT-XL/1 +SFD | 675M | 70K | 8.79 |
| LightningDiT-XL/1 +SFD | 675M | 120K | 6.22 |
| LightningDiT-XL/1 +SFD | 675M | 400K | 3.53 |
| LightningDiT-XL/1 +SFD | 675M | 1M | 2.82 |
| LightningDiT-XL/1 +SFD | 675M | 2M | 2.74 |
| LightningDiT-XL/1 +SFD | 675M | 4M | 2.54 |

100× 来自 7M/70K：SFD 的 8.79 已优于 DiT 的 9.62；33.3× 来自 4M/120K：6.22 已优于 LightningDiT 的 6.50。它们是达到可比 FID 所需迭代数的比较，不是单步或端到端生成速度。补充总表中 80 epoch XL 无引导 FID 是 3.43，与此表 400K 的 3.53 不同；本文保留各表原值，不擅自归并。

</details>

<details>
<summary>无引导最终质量与类别采样：补充表 4、7 的对照摘录</summary>

第一表只摘录同为 800 epoch、视觉表征相关模型的无引导结果。[补充第 4 页，表 4](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf#page=4)

| 方法 | FID↓ | sFID↓ | IS↑ | Precision↑ | Recall↑ |
|---|---:|---:|---:|---:|---:|
| VA-VAE | 2.17 | 4.36 | 205.6 | 0.77 | 0.65 |
| REPA | 5.90 | — | — | — | — |
| REPA-E | 1.69 | 4.17 | 219.3 | 0.77 | 0.67 |
| ReDi | 3.30 | 4.80 | 188.9 | 0.74 | 0.68 |
| REG | 1.80 | 4.59 | 230.8 | 0.77 | 0.66 |
| RAE DiT-XL | 1.87 | — | 209.7 | 0.80 | 0.63 |
| RAE DiTᴰᴴ-XL | 1.51 | — | 242.9 | 0.79 | 0.63 |
| SFD XL | 2.54 | 4.38 | 191.7 | 0.75 | 0.67 |
| SFD XXL | 2.38 | 4.37 | 197.9 | 0.75 | 0.67 |

SFD 在这一设定没有最低 FID。作者归因于 f16d32 纹理潜空间更难收敛；这是一种解释，表格本身只确立质量取舍。

第二表摘录所有方法的两类采样 FID。均为有引导，原表还有 sFID、IS、Precision、Recall。[补充第 5 页，表 7](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf#page=5)

| 方法 | 随机类别 FID↓ | 均衡类别 FID↓ |
|---|---:|---:|
| SiT | 2.06 | 1.95 |
| REPA | 1.42 | 1.29 |
| REPA-E | 1.26 | 1.12 |
| DDT | 1.40 | 1.26 |
| VA-VAE | 1.35 | 1.23 |
| ReDi | 1.61 | 1.60 |
| REG | 1.36 | 1.19 |
| RAE DiTᴰᴴ-XL | 1.28 | 1.13 |
| SFD XL | 1.18 | 1.06 |

</details>

**生成与重建要分开。** 表 6 比较的是 VAE 重建输入图像的能力，支持保留 SD-VAE 通路的选择，不证明生成图像可以精确写出指定文字。[主文第 8 页，表 6](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=8)

| 表示 | rFID↓ | PSNR↑ | LPIPS↓ | SSIM↑ |
|---|---:|---:|---:|---:|
| VA-VAE | 0.28 | 27.96 | 0.096 | 0.79 |
| RAE | 0.57 | 18.86 | 0.256 | 0.42 |
| SD-VAE | 0.26 | 28.59 | 0.089 | 0.80 |

<details>
<summary>采样步数、无类别生成和计算成本</summary>

**固定步数采样。** 下表为 400K 训练、Euler、**FID-10K、无引导**，不能与主表 FID-50K 数值横比。[补充第 4 页，表 5](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf#page=4)

| 方法 | 250步 | 200步 | 150步 | 100步 | 80步 | 60步 |
|---|---:|---:|---:|---:|---:|---:|
| LightningDiT | 12.50 | 12.58 | 12.67 | 12.91 | 13.03 | 13.40 |
| +REPA | 10.00 | 10.10 | 10.23 | 10.50 | 10.67 | 10.94 |
| +VA-VAE | 7.66 | 7.66 | 7.68 | 7.70 | 7.76 | 7.83 |
| +ReDi | 8.58 | 8.63 | 8.72 | 8.86 | 9.02 | 9.32 |
| +SFD | 6.32 | 6.26 | 6.41 | 6.35 | 6.81 | 6.77 |

下面改为 4M 训练、**FID-50K、有引导**。dopri5 为自适应求解，其他列为 Euler 固定步数。[补充第 5 页，表 6](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf#page=5)

| 方法 | dopri5 | 250 | 200 | 150 | 100 | 80 | 60 | 50 | 40 | 30 | 25 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SVG | — | — | — | — | — | — | — | — | — | — | 1.920 |
| SFD XL | 1.064 | 1.051 | 1.050 | 1.048 | 1.045 | 1.086 | 1.102 | 1.206 | 1.510 | 1.447 | 1.865 |
| SFD XXL | 1.040 | 1.035 | 1.040 | 1.041 | 1.058 | 1.080 | 1.106 | 1.190 | 1.429 | 1.456 | 1.844 |

**无类别生成。** 训练和采样都使用 null label，和有类别但没有 guidance 是两件事。以下完整保留补充表 8；训练预算和引导方法不同。[补充第 5 页，表 8](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf#page=5)

| 方法 | Epoch | 参数 | FID↓ | IS↑ |
|---|---:|---:|---:|---:|
| DiT-XL | 400 | 675M | 30.68 | 32.7 |
| ReDi | 80 | 675M | 25.10 | — |
| ReDi +RG | 80 | 675M | 22.60 | — |
| RAE +AG | 200 | 839M | 4.96 | 123.1 |
| RCG DiT-XL/2 | 400 | 675M | 4.89 | 143.2 |
| RCG MAGE-L | 800 | 502M | 3.44 | 186.9 |
| RCG-G MAGE-L | 800 | 502M | 2.15 | 253.4 |
| SFD 无AG | 80 | 675M | 10.24 | 78.5 |
| SFD 有AG | 80 | 675M | 3.77 | 127.9 |
| SFD 无AG | 200 | 675M | 8.46 | 89.9 |
| SFD 有AG | 200 | 675M | 2.90 | 148.5 |

200 epoch 的 SFD 有 AG 明显优于它自己的无 AG 结果，但没有优于表中训练更久的 RCG-G。

**骨干计算量。** 这里的精确参数数不同于主表约称的 675M，保持原表口径。[补充第 5 页，表 10](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf#page=5)

| 方法 | 参数M↓ | GFLOPs↓ | 400K FID↓ |
|---|---:|---:|---:|
| LightningDiT-XL | 683.39 | 116.479 | 9.29 |
| +SFD | 682.77 | 116.487 | 3.53 |

FLOPs 增幅约 0.0069%，说明主干每次前向的增量小；它不包括额外表示模型的预训练、离线特征提取、引导模型及完整采样全过程。论文没有给出可据此换算的端到端 GPU 小时或单图墙钟延迟。

</details>

### 消融实验

**显式语义和异步时钟分别贡献多少。** 固定 400K 的加速训练配置，逐步加入 REPA、SemVAE 和语义先行；每一项都有改善。最后一行比同步双潜变量更好，说明收益不能只归因于增加语义通道。[主文第 8 页，表 3](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=8)

| REPA | SemVAE | 语义先行 | FID↓ |
|---|---|---|---:|
| 无 | 无 | 无 | 8.17 |
| 有 | 无 | 无 | 7.08 |
| 有 | 有 | 无 | 5.24 |
| 有 | 有 | 有 | 3.03 |

**领先多少。** 主文图 5 明确标出的三点是 Δ=0 → 5.24、Δ=0.3 → 3.03、Δ=1 → 5.41。完全串行还差于同步生成；其余曲线点没有数字标注，不从图上估造精确值。[主文第 6 页，图 5](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=6)

**压缩器与可迁移性。** 在相同对照中，PCA 语义压缩 FID 4.06、SemVAE 3.03；将异步机制加到 ReDi，FID 5.33→4.41。VA-VAE 的作者复现版本为 4.52→4.14，仍差于 SD-VAE 路线的 3.03。这些是同类图像生成模型之间的迁移，不是人体动作领域验证。[主文表 4–5；补充表 9](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf#page=8)

<details>
<summary>语义表征、通道数、损失和对齐设置：补充消融</summary>

以下来自补充表 11、13：分别改变目标视觉编码器、同家族大小、语义通道和速度语义权重，不能把不同行同时变化解释成一次联合实验。[补充第 6 页](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf#page=6)

| 消融轴 | 设置→FID↓ |
|---|---|
| 视觉表征 | DINOv2-B 3.03；MAE-B 6.29；CLIP-B 4.89；SigLip-B 4.15 |
| DINOv2 规模 | S 4.14；B 3.03；L 2.97 |
| 语义通道数 | 2→3.90；4→3.67；8→3.16；16→3.03 |
| 语义权重 β | 0.25→3.46；0.5→3.26；1→3.08；2→3.03；4→3.28；8→3.96 |

**SemVAE 重建目标。** 正式补充新增表 12：只用 MSE 为 10.79，只用 cosine 为 10.71，两者结合为 10.14。原表只标 FID，未充分交代这一组不同于 3.03 系列的实验配置；保留为组内对比，不把 10.14 当成完整 SFD 的主结果。

**REPA 对齐配置。** 表 14 的默认消融组合为 depth=2、λ=0.5、cosine+MSE；下表完整保留各组，重复的默认行按原表保留。

| 对齐深度 | λ | 相似度目标 | FID↓ |
|---:|---:|---|---:|
| — | — | 无 REPA | 4.15 |
| 2 | 0.5 | cosine+MSE | 3.03 |
| 4 | 0.5 | cosine+MSE | 3.07 |
| 6 | 0.5 | cosine+MSE | 3.24 |
| 8 | 0.5 | cosine+MSE | 3.16 |
| 10 | 0.5 | cosine+MSE | 3.19 |
| 12 | 0.5 | cosine+MSE | 3.28 |
| 2 | 0.25 | cosine+MSE | 3.30 |
| 2 | 0.5 | cosine+MSE | 3.03 |
| 2 | 1.0 | cosine+MSE | 3.18 |
| 2 | 2.0 | cosine+MSE | 3.25 |
| 2 | 4.0 | cosine+MSE | 3.20 |
| 2 | 0.5 | cosine | 3.16 |
| 2 | 0.5 | MSE | 3.13 |
| 2 | 0.5 | cosine+MSE | 3.03 |

400K 的最优消融设置与完整训练的 λ=1、cosine 不同。补充第 7 页明确解释：4M 长训练中后者更好，因此没有把短训练最优配置机械沿用到最终模型。

</details>

### 关键发现

1. **中等领先优于同时开始，也优于完全串行。** 最直接的机制证据是 Δ=0/0.3/1 对应 5.24/3.03/5.41，而不只是最终榜单。
2. **收敛加速与最终最优质量需要分开。** 在早期迭代 SFD 明显有效；在完整无引导比较中，RAE、REPA-E 等仍有更低 FID。
3. **高保真重建通路可以独立于语义建模。** 语义帮助生成，纹理 VAE 保留细节，但这没有自动变成精确文字渲染、布局控制或编辑保持能力。
4. **指标和资源口径决定结论范围。** 10K/50K、类别随机/均衡、有无类别、有无引导都需分开；100× 不是实时推理指标，骨干 FLOPs 几乎不变也不代表全系统成本为零。

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

最有价值的地方是把“粗到细”从观察变成可调机制。作者没有仅靠更强语义教师，也没有引入一个完全独立的上游规划模型，而是直接修改两类表示的相对噪声日程，并用 Δ 扫描验证过早完成语义也会有害。

另一个清楚的设计是把生成能力与像素重建责任拆开：SemVAE 不需要学会生成 RGB，SD-VAE 也不需要被迫完全成为语义编码器。两者通过一个生成模型合作，最终图像仍由已经具备细节重建能力的通路输出。这种责任划分比笼统要求“一个 latent 同时最好重建、最好生成、最好表达语义”更容易做有针对性的消融。

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

**验证范围集中于 ImageNet 256×256。** 本文没有文本生成图像、长视频或人体骨架生成的定量结果。类别标签也远比复杂文字指令简单；不能把低 FID 解释成对任意多事件描述的遵循能力。

**固定 Δ 和辅助 REPA 仍依赖任务选择。** Δ=0.3 是这组表示与骨干上的实验结论；较大领先、过高语义损失权重都会退步。作者把动态时间差和减少辅助监督列为后续方向。

**并未证明严格解耦或硬控制。** 补充的固定语义噪声示例说明局部外观存在变化空间，却没有证明所有结构、身份、位置完全保持。更低 FID、相似构图与可执行约束是不同层级的证据。

**系统代价高于主干表格。** DINOv2、SemVAE 训练、ImageNet 特征缓存和 AutoGuidance 都有额外成本；主表没有统一折算这些预算。公开入口和权重提供了复现基础，本次静态核查不代表已复现表中结果。

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **REPA**（[论文](https://arxiv.org/abs/2410.06940)）：用预训练视觉表征对齐扩散中间层，帮助语义学习；SFD 继续使用这种辅助监督，同时把语义作为显式生成变量，并调整其时间。两者不是互斥替代。
- **ReDi**（[论文](https://arxiv.org/abs/2504.16064)）：同样联合建模图像 latent 与视觉特征，但采用 PCA 压缩和同步过程。SFD 对应改变压缩方式与相对去噪时间，消融分别检验这两部分。
- **VA-VAE / LightningDiT**（[官方代码](https://github.com/hustvl/LightningDiT)）：改善 latent 的可生成性并提供高效 DiT 骨干。SFD 使用该工程基础中的纹理 VAE 和 Transformer，重点贡献不在从零设计骨干。
- **Diffusion Forcing**（[论文](https://arxiv.org/abs/2407.01392)）：允许不同序列 token 处于不同噪声水平；SFD 把异步思想用于语义与纹理两个表示子空间，控制对象不同。
- **启发**：对动作生成，可以提出“全局动作语义较早形成、局部运动细节随后完善”的假设，但这是本解读的研究推论。动作的接触、关节几何、时间顺序和最终解码误差均未由 SFD 验证；若迁移，仍需同步/异步/严格串行对照，并在最终动作上测控制误差与自然度。

<span id="reading-8" class="reading-anchor"></span>

## 来源

- [CVF 正式论文，11 页，含参考文献](https://openaccess.thecvf.com/content/CVPR2026/papers/Pan_Semantics_Lead_the_Way_Harmonizing_Semantic_and_Texture_Modeling_with_CVPR_2026_paper.pdf)：正文机制、主表 1–6、图 1–7。
- [CVF 独立补充，13 页](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Pan_Semantics_Lead_the_CVPR_2026_supplemental.pdf)：训练、采样、表 1–14、局限和视觉结果。本文引用“补充表”均采用这一文件的独立编号。
- [arXiv v2](https://arxiv.org/html/2512.04926v2)：用户指定的预印本，20 页；附录表连续编号，与正式补充不同，正式版还新增 SemVAE 重建目标实验。
- [作者项目页](https://yuemingpan.github.io/SFD.github.io/)、[固定版本官方代码](https://github.com/yuemingPAN/SFD/tree/273f058895c6a616bf3d736fb440b3bec8fcdee8)、[官方模型仓库](https://huggingface.co/SFD-Project/SFD)：公开资源与实现核对。

本文依据一手全文、图表目视和静态源码检查整理。图为重新绘制的教学示意；未运行模型，未将作者演示或 README 数值视为本次复现实验。

</div>
