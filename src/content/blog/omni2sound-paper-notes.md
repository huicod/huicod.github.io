---
title: "[CVPR2026] Omni2Sound：为什么给视频配音时，多加一句描述有时反而更差？"
description: "用画内的鼓点与画外的掌声，拆解 SoundAtlas 数据筛选、语义与时序双路条件和三阶段训练。对照原表区分训练任务之间的竞争与推理时的条件偏向。"
pubDate: "2026-11-19T18:04:00+08:00"
badge: "Paper"
tags: ["Omni2Sound","SoundAtlas","Video-to-Audio","Multimodal Generation","Audio Diffusion","Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 全文与补充材料][html] · [CVPR 原文 PDF][pdf] · [项目演示][project] · [代码][repo] · [权重][weights]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026</summary>

*Omni2Sound: Towards Unified Video-Text-to-Audio Generation*，作者为 Yusheng Dai、Zehua Chen、Yuxuan Jiang、Qiuhong Ke、Jianfei Cai、Jun Zhu。CVPR 2026，第 1661–1671 页。本文按会议主文及 arXiv v3 核对，补充材料用于说明编码分辨率和采集流程。作者仓库列有生成、训练和评估入口，并链接模型文件与基准数据。本次未运行模型。[会议记录][venue] · [作者仓库][repo] · [数据发布页][data]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

对同一段画面，文本能补充“场外有人鼓掌”，也可能让模型专心生成掌声而忽略画面里的击鼓节奏。Omni2Sound 给一套音频扩散模型分别训练纯文字、纯视频、视频加文字三种用法，再用不完整文字和画外声样本教它在条件不充分时利用另一边。主表里加文字后文本对齐改善，但部分音质和同步指标仍小幅退步。[主表 3、§4.2][html]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 从文字配音可以指定声源和声场，从视频配音可以参照动作发生的时刻。统一系统要接受任意一边，也要能同时接收两边，为同一段时间生成一条声音。[§1–2][html]

**现有痛点：** 画面与实录音轨经常不完全对应。看见一架乐器，真实音轨里可能只有对话；反过来，麦克风也会收到画外声。如果训练描述只跟着画面猜，系统会反复把“看见”学成“应该听到”。[图 1、§3][html]

**核心矛盾：** 训练时，固定数量的更新要分给三种任务；推理时，一条文字和一段视频对同一声轨又可能提供互补、缺失或相互牵制的线索。调整任务抽样比例和解决单条样本的条件偏向，是两个层面的问题。[§4.2、表 5–7][html]

**本文目标：** 一套模型在 T2A（文字→音频）、V2A（视频→音频）与 VT2A（视频＋文字→音频）都能工作，兼顾生成音质、视频同步、文本语义和画外声的可控性。[§1、§5–6][html]

**切入角度：** 先提高训练三元组里视频、音轨、文字互相支持的程度，再向模型提供例外：描述不足时视频仍有效，声源不在画框内时文字仍有效。[图 2–3、§4.2][html]

**核心 idea：** 用 SoundAtlas 提供对齐较好的联合训练样本，用独立的语义与时间条件通路驱动同一音频生成主干，再把通用配音、三任务平衡、缺失条件鲁棒性分到三个训练阶段。[§3–4][html]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先区分**做数据**和**生成声音**。离线标注时，系统能同时看到原视频、听到真实音轨，生成并筛选训练描述。给新视频配音时，没有目标音轨可供筛选；模型接收视频、文字或两者，从噪声逐步得到音频潜变量，再由音频 VAE 解码成波形。[原图 2–3、补充 §G][html]

<figure class="reading-figure"><a href="/paper-notes/omni2sound/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/omni2sound/architecture.svg" alt="Omni2Sound 离线生成并筛选音频描述，随后由文字和画面语义交叉注意力与视频时序 AdaLN 调节音频 DiT；三阶段训练后 VAE 解码得到单声道波形" loading="lazy" /></a><figcaption>教学示意。上部是 SoundAtlas 构建，中部是新样本的生成路径，下部是三个训练阶段。标注助手只参与做数据。依据原文图 2–3、§3–4 和补充 §G 绘制。</figcaption></figure>

### 关键设计

1. **先判断画面值不值得用来写音频描述。** 以 ImageBind 的音画相似度分流：高于 0.30 的片段由 Qwen-2.5-VL 把无声画面压成文字提示，0.20 至 0.30 的片段只让标注模型听音轨，低于 0.20 的样本丢弃。对高一致性片段，Gemini 2.5 Flash 仍要听真实音频，再参考可选的视觉提示写描述。复杂、疑似幻觉或 CLAP 不达标的文本交给 Pro 重审，最后做文音过滤和适用的三元一致性检查。这套流程得到约 47 万条，约 14 万来自 VGGSound，约 33 万来自 AudioSet。[§3、补充 §G][html]

2. **从“响什么”与“何时响”两条路调节同一主干。** Flan-T5 把文字投影成语义 token，CLIP 从按 8 fps 采样的视频中提取视觉语义，两者沿序列维拼接，经交叉注意力注入 DiT。另一路 Synchformer 从视频提取较密的时序特征，通过自适应层归一化（AdaLN）调节主干。只给文字时，语义分支保留文字；没有视频也便没有实际视觉节奏可参考。[§4.1、图 3][architecture]

3. **让共享模型先学会声音，再决定怎样分配任务。** 第一阶段用大规模文字–音频对预训练去噪；第二阶段每一次更新只抽一种任务，同一批样本都做该任务。作者在高对齐设置中按 T2A : V2A : VT2A = 0.10 : 0.35 : 0.55 抽样，让有文字又有画面的样本成为两种单条件任务的连接。表 5 里不同三元组配置也改变了抽样配比，因此不能把行间差距全部归到描述质量。[§4.2、表 5][html]

4. **最后训练两种互补的困难样本。** 随机丢掉部分文本 token，使模型学会从视频补足描述遗漏的可见事件；加入画外声并把它写进文字，使模型有机会生成画面看不到、描述中确实存在的声音。两种增强都在第三阶段加入，作者用等总步数的调度比较衡量其影响。[§4.2、表 6–7][html]

### 一个完整例子

假设视频里的人敲了两下鼓，文字还写着“背后传来掌声”。文字 token 提供鼓和掌声的语义，视觉 token 显示鼓的位置和敲击动作，时序分支传入两次接触附近的视觉变化。DiT 在每次采样更新中结合这些条件，最后输出一条同时容纳两类声音的音轨。若只给画面，画外掌声的依据就弱了；若只给文字，两次敲击应对齐哪两帧就欠缺依据。这是教学设例，论文的画外评测与同步分数要分别检验这两件事。[图 3、表 3、表 7][html]

### 训练与推理

补充材料给出 24 层、24 头、隐藏宽度 1536 的 DiT，以及 16 kHz 单声道 VAE。音频 VAE 由作者按既有架构自行训练，时间下采样率 640、潜变量宽度 64。按这些规格，10 秒、160000 个采样点的单声道音频对应约 250 个时间位置，每个位置 64 维；它们是连续音频特征。实验评估统一截取 8 秒片段，和训练中的 10 秒预处理区分开来。[补充 §G–H、主文 §6.1][html]

在公开实现中，视觉特征可在线提取，也可预先计算。仓库的微调脚本将三任务联合微调和带增强的续训编号为 0、1，对应论文的 S2、S3；使用这两个入口时，已有声音生成主干是起点。[官方仓库的推理与微调说明][repo]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

VGGSound-Omni，原表 3 节选。作者用各基线的官方权重和相同评测工具重新生成结果。FD、FAD 衡量音频特征分布距离，越低越好；DS 衡量不同步程度，越低越好；IB 和 MS-CLAP 分别衡量音画和文本–音频对齐，越高越好。[原表 3][main]

| 输入 | 方法 | FD ↓ | FAD ↓ | DS ↓ | IB ↑ | MS-CLAP ↑ |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 文字 | MMAudio | 8.62 | 1.63 | — | — | 0.50 |
| 文字 | Omni2Sound | 4.61 | 1.01 | — | — | **0.53** |
| 视频 | MMAudio | 5.65 | 0.81 | 0.48 | 0.28 | 0.43 |
| 视频 | Omni2Sound | 3.41 | **0.51** | **0.47** | **0.35** | 0.44 |
| 视频＋文字 | MMAudio | 5.28 | 0.91 | 0.49 | 0.29 | 0.49 |
| 视频＋文字 | Omni2Sound | **2.95** | 0.53 | 0.49 | 0.34 | 0.52 |

**同一模型加文字后发生了什么？** V2A→VT2A 时，文本对应性 0.44→0.52，FD 3.41→2.95；同时 FAD 0.51→0.53，DS 0.47→0.49，IB 0.35→0.34。多给条件确实改变了折中；表中是总体均值，无法据此断言某句文字与画面在某个样本中一定发生冲突。换到第三方 Kling-Audio-Eval，VT2A 的 FAD 为 2.37，纯视频为 2.55，变化方向也会随基准改变。[表 3–4][html]

### 消融实验

原表 5，节选同一第二阶段下的训练策略。星号代表用 SoundAtlas 描述，普通三元组的描述由仅听音频的 Gemini 生成。[原表 5][mix]

| 训练资料 | 文字 / 视频 / 联合的抽样比例 | T2A FAD ↓ | V2A FAD ↓ | VT2A FAD ↓ |
| --- | --- | ---: | ---: | ---: |
| 文字对＋视频对 | 0.20 / 0.80 / 0 | 1.36 | 0.56 | — |
| 文字对＋视频对 | 0.40 / 0.60 / 0 | 1.06 | 0.62 | — |
| 文字对*＋视频对＋三元组* | 0.10 / 0.35 / 0.55 | 0.94 | 0.57 | 0.53 |
| 文字对＋视频对＋普通三元组 | 0.20 / 0.30 / 0.50 | 1.13 | 0.56 | 0.62 |

**跨任务竞争。** 前两行只调任务配比，文字生成得益，视频生成退步。这是训练更新如何分配的实验证据。第三行联合任务表现更好；第四行和第三行的数据及配比都有差异，而且纯视频 FAD 略占优势，因此不能把这组对照读成“每个指标都受益”。[表 5][mix]

原表 6，四种训练方案总计均为 120 万步。方括号表示第二、三阶段合并训练。[原表 6][schedule]

| 训练方案 | T2A FAD ↓ | V2A FAD ↓ | VT2A FAD ↓ | VT2A DS ↓ |
| --- | ---: | ---: | ---: | ---: |
| 仅 S2 | 1.22 | 0.68 | 0.63 | 0.49 |
| S1 → S2 | **0.94** | 0.57 | **0.53** | 0.51 |
| S1 → [S2＋S3] | 1.11 | 0.60 | 0.61 | 0.50 |
| S1 → S2 → S3 | 1.01 | **0.51** | **0.53** | **0.49** |

**画外声。** 原表 7 比较 S1→S2 与完整模型。加入 S3 后，画外评测 FAD 从 0.97 降到 0.85，LA-CLAP 从 0.31 升到 0.32；两种模型的偏好胜率分别为 46.8% 与 53.2%。这里的裁判是多模态模型，评价的是文本–音频忠实度；这一组数字不是人工听评。[原表 7][off]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **“增加条件”有两种不同实验。** 改训练任务占比，回答固定预算怎样分配；固定权重给同一测试集多送入文字，回答条件变化后哪些指标变动。把表 3 和表 5 放在一起，比笼统地说“多模态一定更好”更能解释作者的设计。[表 3、表 5][html]
- **画外声检验了视频条件的盲区。** 如果测试里的所有声音都能从画面猜到，系统即使忽略文字也可能很强。作者另建超过 1000 项的画外测试分支，含自然事件和合成背景音乐，以检验文字能否补充看不见的声源。[§5、补充 §D][html]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **“掌声应当盖过鼓声”有多强的保证？** 论文报告了群体指标、画外评测和听感分数，没有提供遇到互斥指令时可设置的优先级，也未报告可指定的分轨音量或逐事件成功率。[§4–6][html]
- **语音与音乐的外推要看数据。** 构建 SoundAtlas 的 AudioSet 子集时，作者先筛掉语音和音乐类；其他训练来源仍包括这些类型。本文重点是音效和视频配音，声音理解或生成指标无法直接推断口型精度和可控语音合成能力。[补充 §G][html]
- **评测描述的风格会影响数值。** 同样的 VGGSound 测试片段改用 Video-LLaMA 生成的未见描述后，VT2A FD 从 2.95 变为 3.37，MS-CLAP 从 0.52 变为 0.49。训练、主测试使用相关的描述流程，替换文风和在第三方基准测试都是必要的交叉检验。[表 3–4][html]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **MMAudio。** Omni2Sound 沿用细粒度视频时序特征的思路，同时把全局语义交给交叉注意力，比较时既看配准分数，也看加入画外声描述后的变化。[§4.1、表 3][html]
- **AudioX。** 两者都支持多种输入组合。Omni2Sound 的对照说明，支持传入文字和视频只是接口能力；训练样本如何配对、什么阶段引入缺词或画外声，还会改变实际使用这两种条件的程度。[§4、表 5–7][html]
- **MJEPA。** MJEPA 用另一模态的整段特征教自己的编码器识别事件；Omni2Sound 还须恢复一条随时间变化的波形。两篇合读时，可以分别追问语义收益发生在哪里、时间信息通过哪条通路保留。[MJEPA 原文][mjepa]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 正式发表记录、页码与原始实验。[CVPR 出版记录][venue] · [会议 PDF][pdf]
- 机制、消融、数据构建、评估与附录。[arXiv v3 HTML][html]
- 生成示例、公开代码、模型及评测数据。[项目页][project] · [GitHub][repo] · [模型文件][weights] · [数据页][data]

</div>

[html]: https://arxiv.org/html/2601.02731v3
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/Dai_Omni2Sound_Towards_Unified_Video-Text-to-Audio_Generation_CVPR_2026_paper.pdf
[venue]: https://openaccess.thecvf.com/content/CVPR2026/html/Dai_Omni2Sound_Towards_Unified_Video-Text-to-Audio_Generation_CVPR_2026_paper.html
[project]: https://swapforward.github.io/Omni2Sound/
[repo]: https://github.com/omni2sound/Omni2Sound
[weights]: https://huggingface.co/Dalision/Omni2Sound
[data]: https://huggingface.co/datasets/Dalision/Omni2Sound_Benchmark
[architecture]: https://arxiv.org/html/2601.02731v3#S4
[main]: https://arxiv.org/html/2601.02731v3#S4.T3
[mix]: https://arxiv.org/html/2601.02731v3#S6.T5
[schedule]: https://arxiv.org/html/2601.02731v3#S6.T6
[off]: https://arxiv.org/html/2601.02731v3#S6.T7
[mjepa]: https://arxiv.org/html/2606.25225v1
