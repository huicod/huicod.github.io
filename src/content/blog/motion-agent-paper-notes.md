---
title: "[ICLR2025] Motion-Agent：把俯卧撑换成深蹲，语言模型怎样修改一段动作？"
description: "Motion-Agent: A Conversational Framework for Human Motion Generation with LLMs。用开合跳、俯卧撑和深蹲的多轮编辑案例，区分 GPT-4 的文字计划、MotionLLM 的离散动作码和连续骨骼输出；对照 HumanML3D 双向翻译、KIT-ML 消融和 ICLR 终稿新增实验。"
pubDate: "2026-11-25T01:55:00+08:00"
badge: "Paper"
tags: ["Motion-Agent", "MotionLLM", "Text-to-Motion", "Motion Editing", "Motion Captioning", "LoRA", "VQ-VAE", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML][html] · [ICLR 2025 正式论文 PDF][pdf] · [终稿新增附录 A.6 与表 8][finalab] · [作者项目与动作视频][project] · [官方代码][code]

<details class="paper-meta"><summary>论文信息与版本 · ICLR 2025</summary>

*Motion-Agent: A Conversational Framework for Human Motion Generation with LLMs*。作者为 Qi Wu、Yubo Zhao（共同一作）、Yifan Wang、Xinhang Liu、Yu-Wing Tai、Chi-Keung Tang。本文以 21 页的 ICLR 2025 终稿为准。arXiv v3 更新于 2024 年 10 月，HTML 至附录 A.5；终稿新增 A.6，本文在实验部分摘录了它的结果。实验数字来自原文，代码部分按作者公开版本核对，本次未运行模型。[正式会议记录][venue] · [预印本版本记录][record] · [固定版本代码][code]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

用户说“把刚才的俯卧撑换成深蹲”，Motion-Agent 让 **GPT-4 修改上一轮的片段计划**，让 **MotionLLM 把需要生成的短描述翻译成离散动作码**，最后才把整串码解码成连续运动。反过来，MotionLLM 也能把真实动作翻译成一句话，让 GPT-4 据此回答追问。[原文图 1][f1] · [架构图 2][f2]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　HumanML3D 等数据集提供了大量“短动作＋一句描述”配对。生成模型能据此学挥手、行走、下蹲，也有模型能反向给动捕片段写描述。这些能力正好可以作为对话系统的两个工具。[原文 §1–2][intro] · [实验设置][setup]

**现有痛点**　真实请求经常省略细节，还引用上一轮。例如“给我一个有氧动作和一个无氧动作”，用户没说要做哪些动作；接着说“把第二个换掉”，又没有重复第一段。只接受单句动作描述的模型，需要别人先补全任务。[原文图 1][f1]

**核心矛盾**　对话要记住用户要保留什么、允许改什么；动作模型则要生成具体姿态，还要处理两段之间的身体状态。语言模型能写出“躺下，然后走路”，但仅把这两段并列，不会自动交代人是怎样站起来的。[原文图 5][f5]

**本文目标**　复用短动作与描述的配对数据，支持长动作组合、反复编辑、动作描述和后续问答，尽量减少为每种交互专门采集指令数据的成本。[原文 §3.1][framework] · [能力对照表 1][t1]

**切入角度**　把用户对话和动作翻译交给两种不同的模型。GPT-4 选动作、排顺序、组织追问；较小的 Gemma 模型学习动作与文字之间的转换。这样“把哪一段换成什么”能以文字检查，运动细节仍由训练过的动作模型生成。[原文图 2][f2]

**核心 idea**　长动作的中间结果是一串有序的片段描述。每个片段单独生成动作码，所有码拼起来再统一解码。要编辑时先改描述清单，未改写的描述可以取回上轮对应的码。[原文 §3.1][framework] · [官方对话实现][agent]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先训练动作编解码器，再训练文字与动作码之间的双向翻译模型 **MotionLLM**。在此之上的 **Motion-Agent** 才是完整系统：它在推理时把对话交给 GPT-4，再按其计划调用 MotionLLM。原始骨骼、离散动作码、给用户看的解释，分别出现在这条链路的不同位置。[原文图 2][f2] · [§3.1–3.3][framework]

<figure class="reading-figure"><a href="/paper-notes/motion-agent/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/motion-agent/architecture.svg" alt="Motion-Agent 架构：VQ-VAE 学习离散动作码，Gemma 通过两个方向的适配器做文字与动作码翻译。推理时 GPT-4 依据对话组织调用，生成分支拼接片段码后解码，理解分支将动作描述送回 GPT-4。" /></a><figcaption>据原文图 1、图 2 与官方实现重绘。先看训练时动作码如何产生，再跟随生成与理解两条推理路径。编辑动作时，留意描述清单、缓存中的码和最终连续帧各在哪一步改变。点击可放大。</figcaption></figure>

### 关键设计

1. **动作码怎样产生。** VQ-VAE 编码器把 T 帧的动作特征按时间压缩 4 倍。每个潜在位置是 512 维向量，它在含 512 个条目的码本里找最近的向量，只把条目编号交给语言模型。训练使用动作重建、关节位置和量化承诺损失，码本以指数移动平均更新。训练好后冻结。以 120 帧、每帧 263 维的 HumanML3D 输入为形状示例，编码后得到 30 个 512 维向量，再得到 30 个整数编号。一个编号本身没有“深蹲”这样的人工标签。[原文 §3.2][tok] · [实现设置][setup]

2. **让同一个语言骨干能读写动作。** 作者给 Gemma 2 的词表加上 512 个动作编号和一对起止标记。文字生成动作时，用生成方向的 LoRA 适配器逐个预测动作 token，遇到结束标记便停止，因此各片段可以有不同长度。反向任务用描述方向的适配器，读真实动作编码出的编号，逐词写出描述。两套适配器分别训练，共用基础模型、动作词汇和编解码器。[原文 §3.3][translate] · [适配器与词表实现][mllm]

3. **GPT-4 写调用计划，MotionLLM 执行各段。** GPT-4 收到固定工具说明、对话历史和新请求，输出 JSON，指定调用生成或描述，以及调用的顺序、参数。生成分支的参数是可以独立执行的短动作描述。程序据此逐段调用 MotionLLM，拼接码序列，然后一次解码。官方演示再把特征反归一化，恢复为 22 个关节的运动，按 20 fps 绘制。用户能在清单里看到动作先后；持续多久、关节如何到位，要看实际生成结果。[原文 §3.1][framework] · [工具说明][prompt] · [解码与可视化代码][agent]

4. **编辑以整段描述为单位。** 公开对话演示按完整的描述字符串缓存动作码。若某条描述与此前完全相同，就复用对应的码；改写后的描述会触发新一轮生成。整个新码序列仍要重新解码。于是有两个不同的检查：保留片段的输入码是否相同，以及重新解码后接缝附近的帧是否逐帧相同。代码实现了前一种复用，论文没有报告后一种误差。[原文图 1][f1] · [缓存与拼接实现][agent]

5. **问答经由一条文字描述。** 给定已有动作，MotionLLM 对其编码，再生成描述，GPT-4 利用这句话及会话历史回答问题。论文中的例子从运动描述延伸到健身动作的类型和训练目的。前者来自动作识别，后者还用到了 GPT-4 的常识；如果描述漏掉了左右手或次数，后续回答就少了一项可观察依据。[原文图 1][f1] · [理解分支实现][agent]

### 一个完整例子：保留开合跳，把俯卧撑换成深蹲

论文图 1 给出了一段连续会话。以下沿用作者的请求与动作顺序，把图中的结果对应到公开实现；图中没有披露本次对话的逐个码值或每段帧数。[原文图 1][f1] · [作者演示][project]

| 用户这轮想做什么 | GPT-4 和 MotionLLM 各做什么 | 从结果中能检查什么 |
| --- | --- | --- |
| 生成一有氧、一无氧两种运动 | GPT-4 选择开合跳与俯卧撑；MotionLLM 为两个描述分别生码，两串码按顺序合并解码。 | 视频里能否看到这两种运动，以及从站立到地面的转换。 |
| 把俯卧撑换成深蹲 | 新计划保留开合跳、将第二段改为深蹲。按公开实现，第一段描述若原样保留，就取缓存码，第二段重新生成。 | 第一段动作类别是否保留，第二段是否真的换成了深蹲。 |
| 运动完很累，坐下来休息 | 在已有计划后追加坐下休息的描述，相应的新码接到旧码之后再解码。 | 是否出现了站立到坐下的过渡。 |

图 1 的最后一轮还把深蹲改成原地跑，并把坐地改成坐到前方椅子上。这个例子尤其值得仔细看：系统能生成“坐椅子”的身体姿态，但其输入中没有椅子几何，论文也没有测量臀部与座面的接触误差。对话编辑成功与人体准确接触指定家具是两项不同的验证。[原文图 1][f1] · [作者的局限讨论][limits]

### 训练与推理

MotionLLM 在 KIT-ML 和 HumanML3D 上训练与评测。KIT-ML 有 3,911 段动作，HumanML3D 有 14,616 段动作、44,970 条文字描述，完整对话演示使用 HumanML3D 上训练的模型。主配置为 Gemma 2 2B 指令模型，生成 LoRA 秩为 64、描述为 32；附录列出批大小 6、学习率 0.00001、LoRA dropout 0.1。论文所说的“约 1%–3%”指适配语言模型的可训练参数比例；动作编解码器另行训练，GPT-4 的规划通过提示接入。作者报告使用 RTX 4090，未给出完整训练 GPU 小时。[原文 §4.1][setup] · [附录表 7][t7] · [训练脚本][train]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**文字生成动作 · HumanML3D，表 2。** R@1/R@3 看正确描述能否在 32 个候选中排入第一或前三；FID 衡量生成动作与真值的特征分布距离，MM-Dist 衡量配对文字与动作的平均特征距离。表中摘录均值，原表给出生成评估的 20 次重复和 95% 置信区间。原表斜体方法使用真值长度，包含 MoMask；MotionLLM 预测结束标记。[原文表 2][t2] · [指标定义][metrics]

| 方法 | R@1 ↑ | R@3 ↑ | FID ↓ | MM-Dist ↓ |
| --- | ---: | ---: | ---: | ---: |
| T2M-GPT | 0.491 | 0.775 | 0.116 | 3.118 |
| MotionGPT | 0.492 | 0.778 | 0.232 | 3.096 |
| MotionChain | 0.504 | 0.790 | 0.248 | 3.033 |
| MoMask | **0.521** | **0.807** | **0.045** | **2.958** |
| MotionLLM | 0.515 | 0.801 | 0.230 | 2.967 |

**动作生成描述 · HumanML3D，表 2。** 这里评的是 MotionLLM 直接输出的文字。BLEU@4 比较连续词组，ROUGE 衡量与参考描述的重合，CIDEr 强调有辨识度的词组，BERTScore 比较上下文表示。[原文表 2][t2]

| 方法 | BLEU@4 ↑ | ROUGE ↑ | CIDEr ↑ | BERTScore ↑ |
| --- | ---: | ---: | ---: | ---: |
| TM2T | 8.27 | 38.1 | 15.80 | 32.2 |
| MotionGPT | 12.47 | 37.4 | 29.20 | 32.4 |
| MotionChain | 12.56 | 33.9 | 33.70 | 36.9 |
| MotionLLM | **17.65** | **48.7** | **33.74** | **42.63** |

### 消融实验

**适配器、码本与全量微调 · KIT-ML。** 原文表 3 比较语言骨干和 LoRA 秩；终稿表 8 另外测试残差量化（RVQ）和全量微调。下表将两张表中可直接对照的行并列。“可训练参数”沿用作者统计，不能直接折算为显存、耗时或训练费用。[原文表 3][t3] · [终稿表 8][t8]

| 骨干与配置 | 可训练参数（百万） | R@1 ↑ | FID ↓ | MM-Dist ↓ |
| --- | ---: | ---: | ---: | ---: |
| Gemma 2 2B，LoRA 秩 16，VQ | 20.8 | 0.411 | 0.745 | 2.994 |
| Gemma 2 2B，LoRA 秩 32，VQ | 41.5 | 0.415 | 0.712 | 2.938 |
| Gemma 2 2B，LoRA 秩 64，VQ | 83.1 | 0.422 | 0.658 | 2.929 |
| Gemma 2 2B，LoRA 秩 64，RVQ | 83.1 + 13.4 | 0.429 | 0.647 | **2.857** |
| Gemma 2 2B，全量微调，VQ | 2697.4 | 0.423 | 0.591 | 2.913 |
| Gemma 2 9B，LoRA 秩 32，VQ | 108.0 | **0.439** | **0.438** | 2.872 |

**换分词器。** 从普通 VQ 换到 RVQ 时，语言模型仍只预测基础层动作码，另加一个 13.4M 参数的非自回归网络预测残差层。在 2B、秩 64 下，FID 从 0.658 降到 0.647，MM-Dist 从 2.929 降到 2.857；这部分收益伴随一次额外的网络训练。[终稿附录 A.6][finalab]

<figure class="reading-figure"><a href="/paper-notes/motion-agent/results.svg" target="_blank" rel="noopener"><img src="/paper-notes/motion-agent/results.svg" alt="KIT-ML 终稿表 8 的模型配置对照，比较 Gemma 2 两种骨干、低秩适配、全量微调及残差量化的可训练参数量和动作分布 FID。" /></a><figcaption>据 ICLR 终稿表 8 重绘。比较普通 VQ 与 RVQ 时固定 2B 骨干和 LoRA 秩；比较 2B 全量微调与 9B 低秩适配时，骨干和更新方式都改变了。点击可放大。</figcaption></figure>

**换动作执行模型。** 图 6 固定 GPT-4 拆出的两段要求：先仰面休息，再从仰面起身。以 MotionGPT 替代 MotionLLM 后，示例中的第二段从俯卧开始，接缝处翻了个面。这个对照直接暴露了失败的部位，但只报告案例，没有全测试集的转场成功率。[原文图 6][f6]

**换对话模型。** 附录表 5 给不同模型相同的两轮请求，比较第一轮的动作拆解、第二轮对动作情境的解释。部分模型能列出开合跳、俯卧撑等可执行片段，有的小模型会漏掉任务或输出不符合约定的格式。表中是各模型的实际回答，未报告 JSON 解析率或动作执行成功率。[附录表 5][t5]

### 关键发现

1. **直接翻译和多轮编辑需要分开评价。** MotionLLM 在 HumanML3D 的生成 R@1 为 0.515，高于 MotionGPT 的 0.492，FID 则接近（0.230 与 0.232）。描述的 BLEU@4 从 12.47 升到 17.65；与 MotionChain 相比，CIDEr 只差 0.04。表 2 支持的是这些单次翻译结果，完整 Agent 的长序列编辑由图 1、4–6 等案例展示。[原文表 2][t2] · [长序列案例][f4]
2. **更大的骨干配小适配器，是值得单独检验的选择。** 在 KIT-ML，9B 骨干加秩 32 适配器，更新 108M 参数，FID 为 0.438；2B 骨干全量微调，更新 2697.4M，FID 为 0.591。这个结果比较的是两种完整配置。若单问“在同一骨干上提高秩有没有帮助”，应看表中 2B 的前三行。[原文表 3][t3] · [终稿表 8][t8]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **能区分是计划错了，还是身体没做出来。** 如果计划里写着“仰面起身”，身体却从俯卧开始，错误已经落在执行阶段。若清单里原本就缺少“起身”，则应先改拆解。相比只看最终动画，这种中间表示给出了能检查的具体位置。[原文图 5][f5] · [图 6][f6]
- **把过渡也写成动作，有助于处理长序列。** 从倒地到行走，中间缺的常常是具有独立含义的“站起来”。GPT-4 可以显式补上这一段，让动作模型生成中间过程；是否从上一段的准确末姿出发，仍取决于执行模型。[原文图 5][f5]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **片段复用没有给出几何保证。** 当前接口传递的是描述和动作码，没有逐帧锁定关节、求足部接触或检验空间目标的位置。评价“只改第二段”时，除了看动作类别，还应量第一段保留区的关节偏移和接缝前后的速度差。这是依照其编辑机制提出的后续检验。[编辑实现][agent] · [原文图 6][f6]
- **一条描述可能加进观察不到的东西。** 附录表 4 中，有个参考描述只写人物慢慢向前走、右手略微抬起，MotionLLM 写成了走平衡木。另一例正确写出了倒退走出之字形。两例放在一起能看出，读出运动方向和判断道具是否真实存在，是不同能力。[原文表 4][t4]
- **空间交互和多人动作尚处早期。** 作者明确指出模型不读取 3D 场景，也不建模精细手指与面部。双人挥手示例为两个人分别生成动作，另指定第二人的初始位置和朝向；它展示了如何摆放两个人，尚未验证接触、避碰或多人协同的可靠性。[原文局限][limits] · [附录 A.3][multi]
- **复现实验应核对推理入口。** 作者确认公开对话演示调用的一条束搜索路径存在取错候选束的问题，独立生成示例和评测则使用另一条路径。默认演示得到的动作因此不宜直接用作主表复测。另有一处配置差异：正文与代码默认生成方向的 LoRA alpha 为 64，附录表 7 填的是 32。[作者对束搜索的说明][issue] · [两个生成入口][sampling] · [训练配置][opts] · [附录表 7][t7]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **T2M-GPT** 提供了先量化动作、再预测码序列的直接参照。Motion-Agent 沿用这个动作接口，进一步让预训练语言骨干承担双向翻译，让另一层对话模型组织片段。[站内 T2M-GPT 解读](/blog/cvpr2023-t2m-gpt/) · [原文 §3.2][tok]
- **MoMask** 用掩码预测和残差量化提高生成质量，在原文表 2 的 FID 上有明显优势。它的技术路线在这里还有第二个用途：终稿用 MoMask 风格的残差预测头做替换实验，直接检验改进分词器能带来多少收益。[站内 MoMask 解读](/blog/cvpr2024-momask/) · [终稿附录 A.6][finalab]
- **MUGEN** 让语言模型读写少量连续向量，共享同一动作表示来生成和理解；Motion-Agent 使用离散码和两个方向的适配器，另有一份可显式改写的多轮片段计划。并读时，先看论文测的是一次文字与动作转换，还是一个指代明确、能保留旧内容的编辑会话。[MUGEN 原文](https://arxiv.org/html/2607.27581v2) · [站内解读](/blog/arxiv2026-mugen/)
- **启发。** 如果要把这类系统接入可编辑的数字人时间线，第一步可以保留原有片段清单，再为每段记录稳定标识、时间边界和生成码。这样“修改第二段”便能跟踪到一个明确对象，也能量化其余片段究竟保留了多少。这是基于公开缓存机制的设计延伸。[原文框架][framework] · [作者实现][agent]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **论文与演示。** [ICLR 会议记录][venue] · [会议终稿 PDF][pdf] · [arXiv HTML][html] · [作者项目与视频][project]
- **方法与证据。** [多轮会话图 1][f1] · [架构图 2][f2] · [双向实验表 2][t2] · [转场对照图 6][f6] · [终稿新增表 8][t8]
- **复现资源。** 作者仓库提供训练、评测、终端演示及配套权重下载入口。完整对话演示另需配置 Azure OpenAI 服务并取得 Gemma 基座访问权限。[固定版本仓库][code] · [作者权重入口][weights] · [评测入口][eval]

</div>

[html]: https://arxiv.org/html/2405.17013v3
[record]: https://arxiv.org/abs/2405.17013
[pdf]: https://proceedings.iclr.cc/paper_files/paper/2025/file/77c6ccacfd9962e2307fc64680fc5ace-Paper-Conference.pdf
[venue]: https://proceedings.iclr.cc/paper_files/paper/2025/hash/77c6ccacfd9962e2307fc64680fc5ace-Abstract-Conference.html
[finalab]: https://proceedings.iclr.cc/paper_files/paper/2025/file/77c6ccacfd9962e2307fc64680fc5ace-Paper-Conference.pdf#page=20
[t8]: https://proceedings.iclr.cc/paper_files/paper/2025/file/77c6ccacfd9962e2307fc64680fc5ace-Paper-Conference.pdf#page=21
[project]: https://knoxzhao.github.io/Motion-Agent/
[code]: https://github.com/szqwu/Motion-Agent/tree/8a5c7b669751dfc21b9348f6bf2193c1732e8643
[agent]: https://github.com/szqwu/Motion-Agent/blob/8a5c7b669751dfc21b9348f6bf2193c1732e8643/models/motion_agent.py#L32-L102
[prompt]: https://github.com/szqwu/Motion-Agent/blob/8a5c7b669751dfc21b9348f6bf2193c1732e8643/example_prompt.txt
[mllm]: https://github.com/szqwu/Motion-Agent/blob/8a5c7b669751dfc21b9348f6bf2193c1732e8643/models/mllm.py
[train]: https://github.com/szqwu/Motion-Agent/blob/8a5c7b669751dfc21b9348f6bf2193c1732e8643/train_mllm.py
[opts]: https://github.com/szqwu/Motion-Agent/blob/8a5c7b669751dfc21b9348f6bf2193c1732e8643/options/option_train.py#L21-L26
[sampling]: https://github.com/szqwu/Motion-Agent/blob/8a5c7b669751dfc21b9348f6bf2193c1732e8643/models/mllm.py#L118-L168
[issue]: https://github.com/szqwu/Motion-Agent/issues/10
[weights]: https://drive.google.com/file/d/1Tagt2xUwv_h0JNMtrM_Ty1rWemkLF5jH/view
[eval]: https://github.com/szqwu/Motion-Agent/blob/8a5c7b669751dfc21b9348f6bf2193c1732e8643/utils/evaluation.py#L47-L52
[intro]: https://arxiv.org/html/2405.17013v3#S1
[f1]: https://arxiv.org/html/2405.17013v3#S1.F1
[f2]: https://arxiv.org/html/2405.17013v3#S2.F2
[framework]: https://arxiv.org/html/2405.17013v3#S3.SS1
[tok]: https://arxiv.org/html/2405.17013v3#S3.SS2
[translate]: https://arxiv.org/html/2405.17013v3#S3.SS3
[setup]: https://arxiv.org/html/2405.17013v3#S4.SS1
[t1]: https://arxiv.org/html/2405.17013v3#S4.T1
[f4]: https://arxiv.org/html/2405.17013v3#S4.F4
[f5]: https://arxiv.org/html/2405.17013v3#S4.F5
[t2]: https://arxiv.org/html/2405.17013v3#S4.T2
[f6]: https://arxiv.org/html/2405.17013v3#S4.F6
[t3]: https://arxiv.org/html/2405.17013v3#S4.T3
[limits]: https://arxiv.org/html/2405.17013v3#S5
[t4]: https://arxiv.org/html/2405.17013v3#A1.T4
[t5]: https://arxiv.org/html/2405.17013v3#A1.T5
[multi]: https://arxiv.org/html/2405.17013v3#A1.SS3
[metrics]: https://arxiv.org/html/2405.17013v3#A1.SS4
[t7]: https://arxiv.org/html/2405.17013v3#A1.T7
