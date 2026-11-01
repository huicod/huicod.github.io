---
title: "[SIGGRAPHAsia2025] Echo：先读懂两个人在谈什么，再生成角色的对话动作"
description: "一句话是在主动分享，还是回应对方？Echo 把逐帧声音、当前发言与整段意图分层接入动作生成器。结合作者架构图、对话示例和训练脚本，区分可核实的输入、实验结论与仍待核对的分数。"
pubDate: "2026-11-01T16:58:00+08:00"
badge: "Paper"
tags: ["Echo", "Conversational-Behavior", "Co-Speech-Gesture", "Human-Motion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与核查范围 · SIGGRAPH Asia 2025 Conference Papers</summary>

*Echo: Enhancing Conversational Behavior Generation via Hierarchical Semantic Comprehension with Large Language Models*，Haiwei Xue、Yanbo Fan、Xuan Wang、Zhiyong Wu，SIGGRAPH Asia 2025 Conference Papers，Article 116，9 页，DOI 10.1145/3757377.3763998。本文依据正式会议摘要、作者公开的架构图和示例、固定版本源码解读；本次未取得可核对的九页全文，原论文的主实验和消融数值待核。[大会条目][venue] · [ACM 正式记录][doi] · [作者实验室书目][lab] · [作者仓库][repo]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

两个人对话时，同一句“我喜欢交互设计”，可以是主动开启话题，也可以是对上一句提问的简短回应。声音给出了说话的节奏，却未必说明该不该用手势展开解释。Echo 先让语言模型从双方转写中提取**当前发言的意图、主动性、动作触发倾向，以及谈话的摘要和整体意图**，再把这些条件按帧、句子、整段对话三个尺度送入已有动作生成器，输出主角色的动作。[大会摘要][venue] · [作者方法总览][overview]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 双人对话动作生成通常利用主角色的声音，也可能用到谈话伙伴怎样动。它们告诉系统何时有人开口、对方何时做出反应，却不直接给出当前发言在讨论中的作用。[大会摘要][venue]

**现有痛点：** 一个短窗口可以包含一句发言的重音，却可能漏掉前面那句提问。只看当前声音，模型难以区分人物是在提出主张、回应邀请，还是简单附和。即使动作与语音节拍相配，也可能显得不合语境。[大会摘要][venue] · [作者说明][repo]

**核心矛盾：** 身体动作按帧变化，交流意图往往跨一句甚至多轮才明朗。一句谈话摘要无法替代细粒度的韵律；每帧音频也无法单独说明整段谈话想达成什么。[作者架构图][overview]

**本文目标：** 从对话语境提取对动作有用的信息，让不同的动作生成骨干都能利用同一套语义条件，更恰当地生成主角色在交流中的非语言行为。[大会摘要][venue]

**切入角度：** 对话转写已有角色和词的时间信息。作者把“这一句想表达什么”“当前是主动发起还是被动回应”“这段话围绕什么展开”拆成不同提问，让语义提取先于动作预测。[对话预处理][history] · [局部意图提示][local]

**核心 idea：** 音频等逐帧信号保留下来，句级标签解释局部发言，对话级文本嵌入补充全局语境。三个尺度逐级融合，最后仍由运动生成模型预测骨骼序列；语言模型提供可阅读的条件。[作者架构图][overview]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

[![Echo 整体架构。两人转写经过分项抽取、复核与检查，生成句级及对话级条件，再与帧级音频和伙伴动作融合，输出主角色的骨骼动作。下方区分公开脚本能核到的训练路径。](/paper-notes/echo-conversational/architecture.svg)](/paper-notes/echo-conversational/architecture.svg)

图依作者仓库的总览图重绘。上游回答“正在交流什么”，下游回答“角色应当怎样随之活动”。在作者总览里，对话伙伴的动作是逐帧输入之一，末端输出标作**主角色动作序列**。图中的生成器没有同时自由生成两个人的两条新动作。[作者原始总览][overview]

### 关键设计

1. **先确定谁在什么时候说了哪句话。** 公开预处理脚本把双人转写整理成一句一句的记录，每条保留角色、句子和词时间戳。以某句话为中心，脚本保留它前面的对话，并记录中心句第一个词的起点和最后一个词的终点。该预处理示例设置 k=10，最多可带上前十条记录。这给标签提供了时间范围，无法据此知道某个手势的起止帧。[历史窗口代码][history]

2. **把“当前句的作用”和“整个谈话的目的”拆开问。** 在句级，局部意图提示要求给每句一个意图词，或在没有特殊意图时返回空意图；主动性区分主动发问与被动回应。另一条提示要求为每句给出 1 到 10 的动作强度和理由。作者图示将这个通道称为触发或执行概率，公开提示的输出格式实际是有序强度分。对话级另取一句摘要和全局意图。代码也请求局部与双方全局情绪、话题字段，但公开融合图只给部分字段画出了清晰的注入路径。[局部意图提示][local] · [触发提示][trig] · [情绪提示][emo] · [语义抽取调用][llm]

3. **让多次分析经过复核。** 作者总览给出了多组提示、重复 M 次抽取、示例库、语言模型复核与检查模块。直观上，它用多个候选来整理“本句话在发问、回应还是表达态度”等判断。已有材料没有给出足以核对的 M 数值、投票或打分细则，也没有给出每层语义标签的人工标注准确率。复核的地位是生成语义条件，不能把其输出当作谈话者本人报告的真实心理状态。[总览图左半部分][overview] · [正式摘要][venue]

4. **分三次将不同时间尺度的信号对在一起。** 作者图的帧级原始信息包括音频、说话人标识、转写和对话伙伴动作。句级的局部意图、主动性、触发经类别编码，对话级摘要及全局意图经文本嵌入。图例把 IF 融合块展开为拼接、交叉注意力、MLP。句级与帧级合并后，再加入对话级条件，最后的特征经拼接送给动作生成器。这样，即使谈话主题相同，不同句子的作用和连续声音也仍能影响输出。[作者总览图右半部分][overview]

5. **沿公开训练入口追一次真正传进去的量。** 在 Diff 示例路径中，数据加载器读取每条样本的文字摘要，把词向量求和成 300 维向量，再沿训练片段重复。训练循环把该向量放进 `human_info`，并把种子动作、音频等条件送入扩散训练。作者配置中片段为 150 帧、30 fps，对应 5 秒；这个脚本的模型构造参数给出 30 帧种子。扩散工具里的余弦日程、1,000 步、预测干净样本与均方误差也是**这条训练路径**的设置。重复一个摘要可以提供片段级条件，却无法单独实现切换两句意图的时间边界。完整 IF 模块及其逐句效果仍需独立验证。[摘要向量与样本][diff] · [训练条件][train] · [示例配置][cfg] · [扩散定义][noise]

### 跟一条作者示例走完

作者首图用一个角色介绍自己为何喜爱交互设计作为示例，大意是“我喜欢交互设计，因为技术与艺术在这里交汇”。下表沿这句话解释数据的走向。示意图没有公布这句话的实际提示词返回值、逐帧骨骼或手势峰值。[作者首图][teaser]

| 环节 | 这句话能提供什么 |
|---|---|
| 读上下文 | 输入保留是谁说的、在什么时间说，以及此前两人讨论的内容。单句本身表达了偏好和理由；是否主动发起话题，要结合此前的发言辨别。 |
| 生成语义条件 | 局部提示询问当前句的意图与主动性、动作发生倾向；全局提示提炼谈话摘要和主角色目的。这里不替作者填写该样例未经公布的得分。 |
| 按时间融合 | 说话声提供逐帧节奏，句级条件在相应发言中提供交流作用，对话级条件提供主线。角色身份和伙伴动作也可作为总览中的帧级条件。 |
| 输出并检查 | 生成器输出主角色骨骼动作。检查语义时，可以问动作是否像在展开解释；检验可控性还需查看手势何时开始、哪只手执行、是否到达指定目标。这些答案无法从一句触发分读出。 |

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 已核验的比较与尚缺的原表

会议摘要报告 Echo 可接入多种已有动作生成模型并改善表现。作者仓库给出了第一手架构图、准备数据和训练的入口，但本次未取得论文的主实验表、消融原表或可逐项对应的实验日志。因此这篇对方法的解读可以落到具体输入输出，性能排序、提升幅度与各项消融的胜负仍待原表核实。[正式摘要][venue] · [官方仓库][repo]

| 项目 | 当前能核实什么 | 还不能据此判断什么 |
|---|---|---|
| 对话语料 | 仓库以 Talking With Hands / GENEA 2023 数据准备为例，分别整理主角色与伙伴的音频、转写和骨骼动作；列出训练与验证目录。[作者说明][repo] · [语料来源][data] | 论文各项评测实际使用的场景数、测试划分与过滤条件。 |
| 对比骨干 | 代码树可见 Diff、DSG、Co 三组成对命名的训练入口；README 将前两类分别关联 DiffSHEG 与 DiffuseStyleGesture。[实现目录][tree] · [项目说明][repo] | 名称本身不能给出性能差值，也不能确认三者分别用了同样的训练资源。 |
| 公开实现中的具体设置 | Diff 配置给 30 fps、150 帧窗口；训练代码可追到 300 维摘要向量及对扩散模型的条件传递。[配置][cfg] · [训练入口][train] | 这些数是配置或维度，无法替代动作质量、语义适配或人评得分。 |
| 方法效果 | 摘要报告接入已有模型后对话动作质量有所改善。[会议摘要][venue] | 具体指标、置信区间、用户研究人数和每项对照数值。 |

### 消融：打开和关闭 Echo 的文件能直接比较吗？

在核查的提交中，Diff、DSG、Co 三组训练入口各有一份带 `echo` 的文件和一份普通文件；对每一对逐字节比较，内容都相同。比如两份 Diff 文件都读取摘要并传入 `human_info`。因此，直接从这两个文件各训练一次，文件名的改变不会产生“去掉语义”的对照。在没有原表或独立配置的情况下，也无法为“仅句级”“仅对话级”“移除复核”填写消融结果。[Diff 入口][diff] · [普通文件同一处][base] · [三组文件清单][tree]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **动作的交流功能有了可以检查的中间量。** 若角色在对方发问后大幅挥手，可以先读局部意图、主动性与触发判断，看系统是否理解了这句话的作用，然后再看骨骼是怎样实现的。这比只看生成视频更容易区分语境判断错与动作表达错。[分项提示][local] · [作者总览][overview]
- **主动性和动作幅度是两个问题。** “主动发问”描述一句话在互动里的角色；触发强度描述这句话可能配多明显的动作。主动发问可以很克制，被动回应也可以很激动。把两者拆开，保留了这种表达空间。[局部意图提示][local] · [触发提示][trig]
- **全局摘要与逐句条件可用一次干预来区分。** 固定音轨和相同的当前文字，只换此前的对话，观察生成的姿态、幅度与时机是否改变，是检验模型究竟用了什么条件的一条路线。这里是根据架构推导的测试思路，未将它列为作者已经做过的消融。[作者架构图][overview]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

1. **一个触发强度没有指定动作几何。** 语言模型可以认为一处发言值得动作强调，但公开的这个字段没有手别、关节方向、接触对象和精确时刻。若用于虚拟角色讲解，需要另外检查动作是否在目标词处发生，以及指向是否正确。[触发提示][trig] · [作者架构图][overview]
2. **长上下文的价值与可用时机要分开。** 预处理脚本有历史窗口，语义调用可以缓存结果；发布的示例还可从一次对话汇总生成摘要，再将摘要沿片段重复。线上系统在说到某一帧时能否取得同样的信息，需要知道转写何时完成、摘要是否跨过当前时刻、抽取与去噪分别用时多少。本次材料没有给出首段延迟或在线双人对话验证。[历史窗口][history] · [整段提取示例][cache] · [摘要接入][diff]
3. **复现仍缺关键资产。** Diff 入口导入的 `sum_diff_mdm` 模块及预先计算的 `human_llm_info_sum.pkl` 未出现在所查仓库树中。作者说明实验输出仍在准备，并指向外部骨干的下载说明。本次静态核对源码，未加载 Echo 权重或重跑训练、推理与人评。[仓库说明][repo] · [代码树][tree] · [摘要输入][diff]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

| 工作 | 与 Echo 放在一起，值得比较什么 |
|---|---|
| **SIGGesture** | 两者都让语言参与共语动作。SIGGesture 会选取语义手势范例，并按词的时段注入扩散过程；Echo 给出句级交流功能和对话级意图。前者便于追问“哪段动作从哪里来”，后者便于追问“角色此刻为何这样回应”。[站内 SIGGesture 解读][siggesture] · [Echo 总览][overview] |
| **EchoAvatar** | EchoAvatar 研究声音流到身体与表情的实时生成。这里的 Echo 研究两人谈话时高层语义如何进入主角色动作生成器。两篇的输入、输出和需要验证的时延不同。[站内 EchoAvatar 解读][echoavatar] · [Echo 会议条目][venue] |
| **GENEA Challenge 2023** | 数据组织区分主角色与伙伴，提示我们评测也要区分“像真人在动”“跟自己说的话相配”“回应了对方”。GENEA 的挑战赛结果属于参赛系统，不能挪作 Echo 的实测分数。[挑战赛论文][data] · [Echo 数据说明][repo] |

<span id="reading-8" class="reading-anchor"></span>

## 来源

- **书目与研究目标。** SIGGRAPH Asia 2025 Conference Papers，DOI 10.1145/3757377.3763998；会议信息与作者实验室书目一致。[官方会议][venue] · [ACM 记录][doi] · [清华团队书目][lab]
- **方法和示例。** 本页架构图依据作者仓库的原始架构图重绘，交互设计例句来自作者首图。[总览图][overview] · [首图][teaser]
- **代码与证据范围。** 核查仓库提交 `4152e28` 的提示、对话窗口、训练与示例配置；本篇未独立核验论文定量表。[固定版本说明][repo] · [语义调用][llm] · [训练脚本][train]

</div>

[venue]: https://sa2025.conference-schedule.org/presentation/?id=papers_2382&sess=sess136
[doi]: https://doi.org/10.1145/3757377.3763998
[lab]: https://thuhcsi.github.io/publications.html
[repo]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/README.md
[overview]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/asserts/2overview.png
[teaser]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/asserts/tease4.png
[history]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/main_codes/4step_get_k_conversation.py#L66-L87
[llm]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/main_codes/6step_ChappieLLM.py#L168-L262
[cache]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/main_codes/6step_ChappieLLM.py#L369-L439
[local]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/main_codes/prompt/local_intention_prompt.txt
[trig]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/main_codes/prompt/motiontrigger_prompt.txt
[emo]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/main_codes/prompt/emotion_prompt.txt
[diff]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/Motion%20Generation%20Model/sum_diff_echo_end2end.py#L219-L275
[train]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/Motion%20Generation%20Model/sum_diff_echo_end2end.py#L367-L425
[cfg]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/Motion%20Generation%20Model/config/sum_diff.yml
[noise]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/Motion%20Generation%20Model/model_util.py#L57-L87
[tree]: https://github.com/Echo-Motion/Echo/tree/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/Motion%20Generation%20Model
[base]: https://github.com/Echo-Motion/Echo/blob/4152e28a8e6fda28da2aa09e72b4e41a3fc47f5b/Motion%20Generation%20Model/sum_diff_end2end.py#L219-L275
[data]: https://arxiv.org/abs/2308.12646
[echoavatar]: /blog/siggraph2026-echoavatar/
[siggesture]: /blog/siggraphasia2024-siggesture/
