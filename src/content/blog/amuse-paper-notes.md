---
title: "[CVPR2024] AMUSE：从语音中分离内容、情绪与个人风格，再生成可编辑的手势"
description: "解析语音内容、情绪和风格的解耦，以及动作先验与潜空间扩散的联合训练，核对实验、消融和官方模型发布状态。"
pubDate: "2026-10-24T10:03:08+08:00"
badge: "Paper"
tags: ["amuse", "Co-Speech-Gesture", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261024-stylemotif-amuse" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2024 · 正式正文与独立补充材料</summary>

- **论文：** Emotional Speech-driven 3D Body Animation via Disentangled Latent Diffusion
- **作者：** Kiran Chhatre、Radek Daněček、Nikos Athanasiou、Giorgio Becherini、Christopher Peters、Michael J. Black、Timo Bolkart。
- **出处：** CVPR 2024，1942–1953 页。
- **入口：** [CVF 正式论文](https://openaccess.thecvf.com/content/CVPR2024/html/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.html) · [完整补充材料](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Chhatre_Emotional_Speech-driven_3D_CVPR_2024_supplemental.pdf) · [项目页](https://amuse.is.tue.mpg.de/) · [官方代码](https://github.com/kiranchhatre/amuse) · [arXiv](https://arxiv.org/abs/2312.04466)。
- **当前资源：** 官方已于 2026 年 7 月发布音频模型、动作模型和处理后数据；需要取得访问权限，并受非商业科研许可约束。论文结果与新版发布接口的边界见训练／推理节。
- **领域与关键词：** 共语手势、情绪控制、音频因素分解、说话人风格、连续潜空间扩散、SMPL-X。
- **阅读版本：** 以 CVF 正式主文 12 页和正式补充 10 页为依据。arXiv 当前已更新至 2026-03-30 的 v3，本文不混用不同版本的表格。核验日期：2026-10-24；仅阅读原文与静态材料，没有运行模型。

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

**AMUSE 把语音编码为内容、情绪和个人风格三个连续潜变量，用它们驱动动作潜扩散；生成时保留一段语音的内容，替换另一段语音的情绪或风格，就能改变人物的手势表达。** 这里的参考是音频，控制是统计学习到的表达方式；它不要求输入参考 3D 动作，也没有把语言语义、指向目标或接触位置变成硬约束。

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 语音驱动动作方法已经可以让虚拟人物随讲话做手势，但“与节奏同步”和“表达正确的情绪”不是同一个问题。相同一句话可以平静地说，也可以愤怒或惊讶地说；相同情绪下，不同人的动作幅度、手臂习惯与姿态又不同。

**现有痛点：** 若模型把音频整体压成一个条件，语义、声学情绪和说话人特征会混在一起。用户想保留原句和原说话人的习惯，只把表现改得更悲伤时，往往没有直接的操作入口。另一方面，一段语音对应的合理手势并不唯一，单一回归结果容易牺牲自然变化。

**核心矛盾：** 系统既要把因素分开，才能独立编辑，又要把它们重新结合，才能生成连贯动作。仅给潜变量取名“内容”“情绪”“风格”并不能实现这种分离；训练需要知道哪些因素相同、哪些不同，以及交换以后什么结果仍应保持不变。

**本文目标：** 从语音直接生成带有情绪、说话人特征的 3D 手势，并允许在推理时替换情绪或个人风格。内容与同步信息来自驱动语音，新的表达来自另一段语音，随机噪声则提供同一条件下的多种动作。

**切入角度：** 作者利用 BEAT 中“不同人说相同脚本、同一人说不同脚本、带有情绪标签”的结构，训练三路音频表示。再把动作压到连续的 VAE 潜空间，在较紧凑的空间内学习带三路条件的扩散生成，而不是在所有关节帧上直接去噪。

**核心 idea：** 先用自重建、受约束的跨重建和分类监督学习音频三因素；随后冻结音频编码器，联合训练动作 VAE 与条件去噪器。推理时选好三个因素的来源，去噪得到动作潜变量，再解码成主要覆盖上身、骨盆和手指的 SMPL-X 姿态。[主文 §1–3](https://openaccess.thecvf.com/content/CVPR2024/papers/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.pdf#page=2)

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

AMUSE 有两个先后进行的训练阶段。第一阶段只用音频及其话语、情绪、说话人关系，学习三个编码器；第二阶段使用同步音频与动作，固定音频编码器，让动作表示和生成器共同适应条件。推理时不需要真实目标动作，音频重建解码器和动作 VAE 编码器也不再处于生成主线上。

[![amuse 完整架构示意](/paper-notes/amuse/architecture.svg)](/paper-notes/amuse/architecture.svg)

*点击图示查看大图。依据[正式论文图 2–3、§3](https://openaccess.thecvf.com/content/CVPR2024/papers/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.pdf#page=4)及补充材料重绘。教学示意，非作者原图。*

从上到下阅读：先看音频三因素如何得到监督，再看动作联合训练中三个损失路径，最后看音频替换后的实际生成。图中 sg 表示训练时停止该路径的梯度；它不是推理模块，也不代表整个动作 VAE 被冻结。箭头表示计算流程；不同阶段的同名模块表示参数复用。此图依据主文图 2、补充图 A.1–A.7 重绘，是教学示意。

### 关键设计

1. **三个音频编码器：把可编辑条件从声学信号中分开**

   每段 10 秒语音先转为 128 个 mel 频带的 filterbank。作者把它当成二维图像，用由 DeiT 改造的三个 Transformer 分别编码内容 c、情绪 e 和个人风格 s，每个输出都是 256 维连续向量。音频编码器使用图像预训练权重初始化，再针对音频任务训练；这里没有 LLM，也没有把动作量化成离散词表。

   三路编码器有相同类型的结构，但接受不同监督。内容分支需要让“不同说话人说同样话”的表示接近；情绪分支用 8 类情绪标签训练；风格分支用说话人身份分类训练。因此 s 更准确地说是**由说话人身份监督的声学个人风格表示**，不是对人物长期人格或所有动作习惯的完整刻画。c 也不是转写文本或显式的语义动作计划。

   在音频训练中，c、e、s 经 Transformer fusion 与 decoder 重建原 filterbank。这个解码目标让三路联合保留足够信息，分类和交换约束再促使各路承担不同职责。音频重建 decoder 只在训练中使用，生成动作时复用的是三个编码器。[主文 §3.2；补充 §B.1–B.5](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Chhatre_Emotional_Speech-driven_3D_CVPR_2024_supplemental.pdf#page=1)

2. **用有对应关系的四元组训练交换：不是任意拼接都天然正确**

   一个训练样本由四段音频构成：两名说话人 s₁、s₂，各说两种相同脚本 c₁、c₂，而且四段属于同一个情绪 e。可简记为：

   `a₁=(c₁,e,s₁)，a₂=(c₂,e,s₁)，a₃=(c₁,e,s₂)，a₄=(c₂,e,s₂)`。

   先做普通自重建，例如 D(c₁,e₁,s₁) 应重建 a₁。再做三类跨重建：对 a₁ 与 a₃，交换它们的内容编码，因为说的是同一句话，交换后仍应重建各自原音频；对 a₁ 与 a₂，可以交换情绪或风格编码，因为它们属于同一个人、同一种情绪，变化的只是话语。这样，模型不能简单地把整段音频全部记在某一个潜变量里而不受约束。

   **训练中的 cross-emotion 不是拿悲伤编码和愤怒编码互换后，要求生成真实的“改情绪动作”。** 这里交换的是同类情绪的不同音频表示，监督目标仍是原音频。推理时跨情绪替换，是建立在这种因素分离上的进一步使用。它有实验支持，但不是数据中为任意情绪迁移提供了逐帧真实目标。

   音频总损失包括自重建、三种跨重建、同内容向量距离，以及情绪和说话人分类。分类准确率高说明对应信息可被读出，并不单独证明其他因素完全没有泄漏；交叉重建和最终编辑实验才提供更完整的证据。[补充 §B.3–B.4、图 A.2](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Chhatre_Emotional_Speech-driven_3D_CVPR_2024_supplemental.pdf#page=2)

3. **连续动作 VAE：先学一个可解码的手势空间**

   论文把原始 mocap marker 数据通过 MoSh++ 拟合为 SMPL-X，并把旋转改为连续 6D 表示。模型忽略 8 个下身关节，保留 J=47 个关节；面部表情参数设为零。因此“3D body animation”在这里主要指带手指的上身和骨盆姿态，不能理解为完整行走、面部表情和身体的联合生成。

   动作编码器 P_E 把整段姿态 m 编码为分布参数，通过重参数化采样得到连续潜变量 z_m；动作解码器 P_D 再把它还原为姿态序列。两者都是带跳接的 Transformer，解码器用动作潜变量作为各层 cross-attention 的 memory。训练用姿态重建、SMPL-X 顶点重建和 KL 正则，让潜变量既能还原动作，又适合作为扩散空间。

   顶点损失使用根中心化的网格和平均体型 β=0，它帮助模型考虑旋转变化如何影响身体表面，但不等于加入了碰撞、平衡或地面接触求解。输出姿态可以配合指定体型生成网格，体型本身不是由音频推断出来的身份。[主文 §3.1、§3.3；补充图 A.7](https://openaccess.thecvf.com/content/CVPR2024/papers/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.pdf#page=4)

4. **三条件潜扩散：让同一语音产生多种合理动作**

   训练时在 z_m 上逐步加高斯噪声，去噪器接收带噪动作潜变量、扩散步编码，以及 c、e、s。用简化表达写成：

   `ε̂ = Δ(z_t, t, c, e, s)`，训练目标是让预测噪声 ε̂ 接近本次添加的噪声 ε。

   三个音频向量共同提供条件：c 关联当前话语和节奏，e 影响情绪表达，s 带入说话人的特征。不同噪声起点可以得到不同的动作，而不必改变指定情绪。扩散在连续动作潜空间进行，最终由 P_D 解码；动作不需要经过离散 token 的自回归采样。

   论文训练使用 1000 个扩散步，生成采用 50 步 DDIM。50 步是采样配置，不是 50 帧动作，也不是每秒性能。音频条件来自整段 10 秒块，原文没有因果流式生成或端到端延迟测量。[主文 §3.3、§4](https://openaccess.thecvf.com/content/CVPR2024/papers/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.pdf#page=5)

5. **联合训练中设置两处断梯度：分别稳住表示、去噪与解码**

   这里的“联合”只指动作 VAE 与去噪器，音频编码器已经冻结。一次训练包含三条路径：

   - **动作自重建：** m → P_E → z_m → P_D → m̂。姿态、顶点重建和 KL 损失更新动作先验。
   - **噪声预测：** z_m 先停止梯度，再加噪交给 Δ；噪声预测损失训练去噪器，不沿这条路径推动 P_E 追逐不断变化的去噪目标。
   - **生成对齐：** 从新噪声完成条件去噪，得到 z_生成后再次停止梯度，再交给 P_D。生成姿态及网格与同步真实动作比较；这条对齐损失更新解码器，不通过完整去噪链反传给 Δ。

   直觉上，第一条维护动作空间，第二条学习音频条件下的潜变量分布，第三条让解码器适应模型实际生成的潜变量，而不只适应编码真实动作得到的潜变量。它与“先独立训练并永久冻结动作 VAE，再训扩散”不同，也与“所有损失一次反传到所有网络”不同。补充的对齐损失消融支持其情绪分类收益，但联合训练并未在所有指标上压过分离训练，后文保留这项取舍。[主文图 2、§3.3](https://openaccess.thecvf.com/content/CVPR2024/papers/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.pdf#page=4)

6. **通过音频条件替换编辑表达：输入源与控制目标要分清**

   对驱动音频 A 和参考音频 B，分别提取三个因素后，可以选择：

   | 生成目的 | 提供给去噪器的条件 |
   |---|---|
   | 保留 A 的整体表达 | (c_A, e_A, s_A) |
   | 保留 A 的内容和个人风格，换情绪 | (c_A, e_B, s_A) |
   | 保留 A 的内容和情绪，换个人风格 | (c_A, e_A, s_B) |
   | 同时换成 B 的情绪和风格 | (c_A, e_B, s_B) |

   B 提供的是音频中的情绪或个人风格线索，不是其 3D 运动轨迹。所谓 editing 主要是换条件后重新生成手势；系统没有读取一段待编辑 3D 动作，并承诺保留其未修改区域。论文图 7 下半的两名男性示例同时交换了情绪和风格，不能把那个画面单独当作只换说话风格、其他一切固定的实验。[主文 §3.4、图 7](https://openaccess.thecvf.com/content/CVPR2024/papers/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.pdf#page=8)

### 一个完整例子

沿用论文图 7 上半的中性语音“I like painting a lot”与悲伤参考，可以这样理解一次编辑。以下分解为教学说明，不是本次新运行的结果。

1. **准备驱动和参考。** A 是要保留话语的中性音频，B 是同一女性说话人的悲伤音频。先按论文输入方式准备相应音频块，而不是额外提供两段动作。
2. **提取三个因素。** 从 A 得到 c_A、e_A、s_A；从 B 取 e_B。c_A 保留驱动话语的声学内容线索，s_A 尽量保留该说话人的特征。
3. **换条件，不拼姿态。** 组成 (c_A,e_B,s_A)。没有直接复制 B 的手部轨迹，也没有修改 A 中某一帧的关节。
4. **从噪声生成。** 对一个高斯噪声样本做 50 步条件 DDIM，得到连续动作潜变量，再由 P_D 解码姿态。换一个噪声种子，可以得到不同手势。
5. **查看实际表达。** 图 7 中可见上举手势减少、手臂更下垂，体现悲伤条件下的姿态变化；它说明情绪条件能影响动作，不保证精确复制参考人的每个细节。若场景要求人物指向“画作左上角”，还需要语言或空间约束机制，c_A 本身没有提供这种保证。
6. **生成可视化。** 把姿态交给 SMPL-X，指定体型并渲染。原模型的面部表情为零，也没有在这一步补出完整下身行走。

### 训练/推理

**数据与配对：** 作者并未使用整个 BEAT。先按动作表现力筛选，把 30 名说话人减到 22 名；再只保留各人都说过的 16 个脚本，即 8 种情绪各 2 个脚本，得到 5.71 小时子集。这样才能构造同话语、同情绪或同说话人的四元组。音频分解、动作先验、去噪器及评测特征模型使用这一子集和相应划分。原始 marker 数据由 120 Hz 降到 30 Hz，经 MoSh++ 得到 SMPL-X；按 10 秒切块，末尾无法对齐部分被舍弃。[主文 §4；补充 §F](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Chhatre_Emotional_Speech-driven_3D_CVPR_2024_supplemental.pdf#page=7)

**阶段一：** 音频 filterbank 使用 25 ms Hamming 窗与 10 ms 帧移，做时间／频带遮挡、噪声和循环平移等增强。三路编码器使用 DeiT 初始化；补充所述 88M 是 DeiT 骨干规模，不能当成整套 AMUSE 的总参数量。三向量各 256 维，fusion 为 2 层、4 heads，重建 decoder 为 4 层、4 heads。训练完成后冻结三个音频编码器。

**阶段二：** 动作 VAE 为 9 层、4 heads 的 Transformer，先验和去噪器使用带跳接的结构，隐藏维度 1024；KL 权重 10⁻⁴。先验与去噪器联合训练 5000 epochs，batch=64，AdamW 学习率 10⁻⁴；噪声 β 范围为 [0.00085,0.012]。原文没有披露完整的墙钟训练时长、GPU 小时或包含预处理的总费用，不能仅凭 epochs 推算成可复现预算。[主文 §4；补充 §B.5、§C](https://openaccess.thecvf.com/content/CVPR2024/papers/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.pdf#page=5)

**推理：** 使用驱动音频和可选参考音频取得条件，采样噪声并执行 DDIM，再解码为姿态。纯生成不需要动作编码器或真实目标动作。原文是块级生成；长时间连续交互、因果前视、块间衔接和完整运行速度需要另外验证。

**当前发布与复现：** 截至 2026-10-24，官方 [GitHub 固定版](https://github.com/kiranchhatre/amuse/tree/8f0ad30bbaeeaf30a53d8acc5a7a39d8db831150)（`8f0ad30bbaee`）提供训练、原研究推理与编辑代码，并在 2026-07-10 公告了 [动作模型](https://huggingface.co/kiranchhatre/amuse-lpdm)、[音频模型](https://huggingface.co/kiranchhatre/amuse-audio) 和 [AMUSE-BEAT 处理后数据](https://huggingface.co/datasets/kiranchhatre/amuse-beat)。已能核实 checkpoint 条目，不能再说“没有权重”。这些资源受访问门控和[非商业科研许可](https://amuse.is.tue.mpg.de/license.html)限制；处理后数据含训练缓存与标注，不等于原始 WAV、marker 和逐序列 SMPL-X 全源数据完整公开。

新版动作模型卡说明，可从 16 kHz 音频按 10 秒块导出 30 fps 的 NPZ，包含 55 关节轴角姿态与根平移；仅导出参数不需先下载 SMPL-X 或 Blender。但本次匿名读取该新接口脚本返回 401，核实的是官方模型卡，未读取其内部实现或运行验证。55 关节的导出容器也不意味着论文训练了全部下身和面部。旧研究脚本存在配置与预处理限制，新接口的长音频拼接、编辑行为、性能及与论文权重的逐项对应仍需获准后验证；恢复网格和渲染则另需人体模型等资源。[固定版模型卡](https://huggingface.co/kiranchhatre/amuse-lpdm/blob/44b6df6d588350b841d240012f339a840fc3e07c/README.md)

官方 README 列出的测试设备是音频模型 A100 80GB，动作模型 A100 40GB／V100 32GB；这是作者环境，不是本次测得的最低显存或训练 GPU 小时。当前代码保留 30 类说话人头，但音频缓存划分与动作筛选逻辑并不能独立还原论文的 22 人及测试风格口径，因此不据当前源码补造论文划分。[官方测试环境](https://github.com/kiranchhatre/amuse/blob/8f0ad30bbaeeaf30a53d8acc5a7a39d8db831150/README.md#L69-L79)

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

BEAT 筛选子集上的语音驱动手势生成，主文表 1 全部结果；Div 以真实动作 GT=27.83 为参照，而非无限增大。

| 方法 | SRGR ↑ | BA ↑ | FGD ↓ | Div → GT | GA（%）↑ |
|---|---:|---:|---:|---:|---:|
| GT | — | 0.83 | — | 27.83 | 64.04 |
| AMUSE | 0.36 | 0.81 | 388.63 | 25.06 | 46.76 |
| AMUSE-EmoEdit | — | 0.79 | 792.58 | 24.68 | 34.18 |
| TalkSHOW-BEAT | 0.31 | 0.64 | 808.99 | 24.16 | 22.71 |
| TalkSHOW | 0.30 | 0.60 | 762.15 | 23.19 | 29.41 |
| DiffuseStyleGesture（DSG） | 0.23 | 0.40 | 763.10 | 19.77 | 22.70 |
| Habibie 等 | 0.23 | 0.39 | 809.17 | 21.34 | 16.67 |
| MoGlow | 0.21 | 0.35 | 1097.03 | 19.50 | 16.62 |
| CaMN | 0.21 | 0.39 | 1063.87 | 18.90 | 14.17 |

| 指标 | 解释与限制 |
|---|---|
| SRGR | 用 BEAT 的真实语义相关性标注加权正确关节点召回；依赖真实动作及其标注，不等于模型读懂语句、正确指向物体的成功率 |
| BA | 手腕、肘、肩共 6 个关节的运动节拍与语音节拍匹配；方向是运动节拍找最近音频节拍，不要求每个语音节拍都产生动作 |
| FGD | 生成与真实动作在本文训练的特征模型中的分布距离；与其他评测特征空间的 FGD 不宜直接横比 |
| Div | 特征空间中的动作变化程度；表头原本为“→”，以真实动作的数值为参考 |
| GA | 另训动作情绪分类器的 top-1 准确率；真实动作也只有 64.04%，因此它同时受分类器和情绪可辨识性限制 |

评测特征模型 M 在相同训练子集上训练，并带情绪分类监督。主文写随机选择 72 条、每条 10 秒的评测动作，覆盖 8 种情绪，同时写“每个说话人、每种情绪 9 条”；该文字没有清晰解释跨说话人总量的汇总方式，本文不反推一个更大的总测试数。表中没有给出置信区间或多随机种子的离散统计。[主文 §5.1、表 1；补充 §D–E](https://openaccess.thecvf.com/content/CVPR2024/papers/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.pdf#page=6)

比较设置也影响结果含义：TalkSHOW-BEAT 是作者额外加入情绪 one-hot 条件后重训的版本；DSG 使用公开的 BEAT 骨架模型；骨架方法的输出经 IK 转到 SMPL-X，以便比较网格和相关指标。附录明确显示，这类转换可能带来异常姿态与自穿插。因此表格支持的是本文具体评测配置，不能归结为所有基线在自身原生表示中都有同等程度的问题。[补充 §C.2、§G](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Chhatre_Emotional_Speech-driven_3D_CVPR_2024_supplemental.pdf#page=4)

EmoEdit 保留中性音频的内容和个人风格，替换为其他 7 类情绪音频的情绪编码。由于编辑后没有对应的真实语义动作标注，作者不计算 SRGR；破折号不是零分。它的 BA、Div 和 GA 优于表中基线，但 FGD=792.58 差于 TalkSHOW 的 762.15，也差于 DSG 的 763.10。不能把标准生成的优势直接转成“编辑后所有指标都最好”。

**人评：** 每个方法对比招募 25 人，每人看 24 对测试动画，8 类情绪各 3 对；只选两名说话人的音频。任务分别评价情绪适宜性和与语音的同步，采用五级偏好量表。下表为补充表 A.5 的原始汇总百分比，“偏好 AMUSE”和“偏好对方”分别合并强、弱偏好，中立票保留在分母中，因此两列不一定相加为 100%。

| 对比对象 | 有效参与者 / 招募数 | 情绪：偏好 AMUSE | 情绪：偏好对方 | 同步：偏好 AMUSE | 同步：偏好对方 |
|---|---:|---:|---:|---:|---:|
| GT | 25 / 25 | 38% | 51% | 35% | 52% |
| TalkSHOW-BEAT | 22 / 25 | 46% | 39% | 62% | 27% |
| TalkSHOW | 20 / 25 | 54% | 34% | 65% | 28% |
| Habibie 等 | 23 / 25 | 48% | 42% | 66% | 28% |

显示位置随机，前三次回答丢弃后在末尾重复，并加入 3 个注意力检查。主文与补充对“失败几个检查才剔除”的文字不完全一致，本文保留图 6 与补充明确报告的最终有效人数，不自行统一该阈值。人评方向是相对基线更好、相对 GT 仍更弱；论文未给这里的显著性检验，不能把偏好差距直接写成统计显著。[主文 §5.3、图 6；补充 §H、表 A.5](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Chhatre_Emotional_Speech-driven_3D_CVPR_2024_supplemental.pdf#page=7)

### 消融实验

**动作模型组件：** 去掉音频三因素模型后，用直接处理 MFCC 的 8 层线性自编码器产生单个条件向量；去掉动作先验时，用线性投影代替 VAE。补充表 A.3 完整如下。

| 设置 | SRGR ↑ | BA ↑ | FGD ↓ | Div → 27.83 | GA（%）↑ |
|---|---:|---:|---:|---:|---:|
| GT | — | 0.83 | — | 27.83 | 64.04 |
| 完整 AMUSE | 0.36 | 0.81 | 388.63 | 25.06 | 46.76 |
| 无动作先验 | 0.25 | 0.20 | 987.90 | 13.41 | 15.42 |
| 无音频三因素模型 | 0.31 | 0.78 | 633.27 | 21.08 | 26.88 |

无音频分解时不仅 GA 降低，也失去了独立替换三个因素的接口；无动作先验的训练未能良好收敛，多为静态动作。由于前一个消融同时改变了音频网络类型与表示容量，它支持完整设计的价值，但不是严格只改变“分不分解”这一个变量的对照。

**联合训练：** 补充表 A.4 保留了一项很重要的反例。

| 训练方式 | FGD ↓ | Div → 27.83 |
|---|---:|---:|
| 联合训练 | 388.63 | 25.06 |
| 分离训练（Disjoint） | 362.33 | 24.49 |

联合训练的 Div 更接近 GT，但 FGD 更差。补充正文和表注称两项同时改善，与表格数值矛盾；这里按原表解读为指标之间的取舍，不能据此宣称联合训练全面优于分离训练。

**生成对齐损失：** 补充 §C.3 报告，去掉 L_align 与 L_Valign 后，GA 从 46.79% 降到 30.89%。其中 46.79% 是该段原值，主表是 46.76%，本文不替作者强行统一这两个细微不同的数字。该对照支持对齐项有助于生成动作的情绪可辨识性。[补充 §C.3、表 A.3–A.4](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Chhatre_Emotional_Speech-driven_3D_CVPR_2024_supplemental.pdf#page=5)

**音频分解：** 只分离内容—情绪时移除风格分类与风格跨重建；只分离内容—风格时移除情绪相关两项。补充表 A.1 给出音频分类结果，注意它不是动作情绪准确率 GA。

| 音频模型 | 情绪准确率 EA（%）↑ | 情绪 F1 ↑ | 风格准确率 SA（%）↑ | 风格 F1 ↑ |
|---|---:|---:|---:|---:|
| 三因素 AMUSE | 91.531 | 0.914 | 96.060 | 0.960 |
| 仅内容—情绪 | 91.966 | 0.918 | — | — |
| 仅内容—风格 | — | — | 96.095 | 0.961 |

三因素模型并不是每个分类分数最高；它以很小的分类差异换取同时保留三类条件。补充表 A.2 的 filterbank 重建误差如下，XCon、XEmo、XSty 分别表示交换对应因素的跨重建。

| 音频模型 | Self ↓ | XCon ↓ | XEmo ↓ | XSty ↓ |
|---|---:|---:|---:|---:|
| 三因素 AMUSE | 0.3739 | 0.3740 | 0.3816 | 0.3815 |
| 仅内容—情绪 | 0.3793 | 0.3792 | 0.3905 | — |
| 仅内容—风格 | 0.3769 | 0.3770 | — | 0.3887 |

交换后误差接近自重建，说明这些受约束交换仍能还原音频；它不是任意未知说话人、任意语句或任意情绪强度都能完美解耦的证明。[补充 §B.6、表 A.1–A.2](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Chhatre_Emotional_Speech-driven_3D_CVPR_2024_supplemental.pdf#page=3)

**平滑性补充：** 作者对同一音频对应的左右手平均 jerk 给出 DSG=1.18、AMUSE=1.10、GT=0.065 m/s³。AMUSE 比该基线稍平滑，但与真实动作仍相差很大；这是一项补充片段比较，不应扩展成全测试集通用平滑性排名。[补充 §C.3，PDF 第 5 页](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Chhatre_Emotional_Speech-driven_3D_CVPR_2024_supplemental.pdf#page=5)

### 关键发现

1. **标准生成在这组指标上领先基线，真实动作仍是明显上限。** AMUSE 的 FGD、BA、GA 与 SRGR 比较好，Div 也更接近 GT；但动作 GA 只有 46.76%，低于 GT 的 64.04%，人评同样更偏好 GT。
2. **可编辑性建立在可替换条件上，不等于编辑质量无损。** EmoEdit 的 BA 和情绪可辨识性仍有优势，但 FGD 从标准生成的 388.63 升至 792.58；换情绪是有代价的生成操作。
3. **联合训练解决的是表示与解码器适配问题，证据有取舍。** 对齐损失有助于情绪分类，而联合／分离训练的 FGD 与 Div 不同向，不能用一句“联合最好”概括。
4. **这里的“内容”更多是声学内容与节奏线索。** SRGR 高于基线不能覆盖精确的指示、隐喻或语言理解；作者在局限中明确承认这些语义手势尚未解决。

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **让控制因素具有可训练的含义：** 三路潜变量不是靠命名区分，而是用共同话语、相同情绪和说话人关系建立交换监督。数据组织本身是方法的一部分。
- **参考音频即可改变表达：** 用户不必提供一段目标 3D 动作才能换情绪或个人风格，这对已有语音素材的创作流程有价值；同时也意味着它转移的是编码出的表达特征，而非参考运动轨迹。
- **把“学表示”和“学条件生成”连接起来：** 动作 VAE 与扩散器联合训练，但通过断梯度给不同路径分配职责；生成对齐让 decoder 接触真实采样得到的潜变量，减少只适应编码器分布的问题。
- **把自动指标与人评互相校验：** 音频分类、动作分类、分布距离和人类偏好不是同一件事。本文同时展示它们，也暴露了替换情绪、平滑性和联合训练中的实际代价。

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

1. **上身情绪表达不等于完整数字人。** 模型排除了 8 个下身关节，面部表情设为零，没有联合完成行走、面部表情和口型。不同体型渲染也不是从声音恢复人物身份。作者把下身运动与面部联合生成列为后续方向。
2. **声学内容不是精确语义控制。** 主文 §5.4 明确指出，当前没有解决指示性、隐喻性手势。没有文本／场景目标输入时，不能因为手势跟随语音，就声称能正确指向屏幕对象或执行空间指令。
3. **监督依赖特殊的数据交叉结构。** 5.71 小时子集只保留 16 个共享脚本，并筛掉较不富表现力的说话人。音频分解还需要时间对应；任意野外音频、自然聊天、未见语言与说话人分布不能仅凭演示推断同样有效。补充一方面写按说话人划分，另一方面写 30 类风格分类，数据部分又写筛成 22 人；现有文字不足以构造无歧义的任意未见说话人风格泛化结论。
4. **因素分离是经验结果，不是严格独立性证明。** 分类与交叉重建有用，但不能排除潜变量泄漏其他因素。图 7 的跨人案例还同时改变情绪和风格，独立控制应继续用更严格的交叉实验检验。
5. **没有证明实时流式或几何精确性。** 论文按 10 秒音频与动作块处理，使用 50 步 DDIM，未报告完整延迟；没有已证实的零前视在线接口。姿态与顶点重建也不是接触、碰撞或目标到达约束。
6. **指标与基线转换有边界。** 评测特征模型在同一筛选数据上训练；一些基线要经过 IK 转换，可能影响姿态和网格质量。联合训练表的文字／数值冲突、动作评测样本计数和说话人类别口径需要进一步澄清，不能把这些不确定项隐藏在单一总排名后面。

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **[Motion Latent Diffusion（MLD）](https://openaccess.thecvf.com/content/CVPR2023/html/Chen_Executing_Your_Commands_via_Motion_Diffusion_in_Latent_Space_CVPR_2023_paper.html)（CVPR 2023）：** AMUSE 沿用 Transformer VAE 与连续潜扩散的结构思路，进一步把音频的三个因素作为生成条件，并引入联合训练中的生成对齐路径。条件来源与训练关系不能直接套成同一方法。
- **[TalkSHOW](https://talkshow.is.tue.mpg.de/)（CVPR 2023）：** 同样面向语音驱动的 3D 人体表达，使用离散表示等模块；AMUSE 的重点是从音频分开内容、情绪和个人风格，再显式替换条件。本文的 TalkSHOW-BEAT 是增加情绪标签并重训的比较版本，需与原模型区别。
- **[ZeroEGGS](https://doi.org/10.1111/cgf.14734)（Computer Graphics Forum 2023）：** 用参考动作示例编码风格，再由语音驱动生成。AMUSE 则用参考音频的情绪／说话人潜变量，不要求 3D 动作参考。这两种参考携带的信息不同，不能只按“都能换风格”视为相同控制。
- **[EMOTE](https://emote.is.tue.mpg.de/)（SIGGRAPH Asia 2023）：** 围绕面部动画分离语音内容与情绪；AMUSE 将相关问题推进到带手指的身体手势，并加入个人风格因素。身体姿态、节拍和接触带来不同的约束，不能靠独立面部模块就默认获得完整协调。
- **启发：** 对表达型 avatar，可以把“要传达的话语线索”“情绪表达”“个体习惯”分别作为条件来源，再检查它们在最终动作中的作用。但若系统还要讲解页面、指向图表或与场景交互，必须另外加入语言与空间目标，并验证输出几何；音频因素可编辑不等于任务动作已经可执行。

<span id="reading-8" class="reading-anchor"></span>

## 来源

- **论文与版本：** [CVF 正式论文页](https://openaccess.thecvf.com/content/CVPR2024/html/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.html)、[正式主文 PDF](https://openaccess.thecvf.com/content/CVPR2024/papers/Chhatre_Emotional_Speech-driven_3D_Body_Animation_via_Disentangled_Latent_Diffusion_CVPR_2024_paper.pdf)、[完整正式补充](https://openaccess.thecvf.com/content/CVPR2024/supplemental/Chhatre_Emotional_Speech-driven_3D_CVPR_2024_supplemental.pdf)。主文表 1、图 6 和补充表 A.1–A.5 均按原始数值整理；不将缺失指标补零，也不猜图中曲线数值。
- **官方实现与入口：** [作者项目页](https://amuse.is.tue.mpg.de/)、[GitHub](https://github.com/kiranchhatre/amuse)、[下载入口](https://amuse.is.tue.mpg.de/download.php)。论文结果与当前发布接口分别说明，本次未运行第三方模型。
- **架构图：** 根据主文图 2、§3–4 及正式补充图 A.1–A.7 制作的中文教学示意，没有将音频训练 decoder 或动作 encoder 画成推理必需路径。
- **形式参考：** 使用本网站固定八节模板，参考 [Paper-Notes 的 LaMoGen 解读](https://papernotes.org/CVPR2026/human_understanding/lamogen_language_to_motion_generation_through_llm-guided_symbolic_inference/)。这是单篇精读与必要的一跳相关工作，不是系统性综述；形式参考不作为技术事实来源。

</div>
