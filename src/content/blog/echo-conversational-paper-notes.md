---
title: "[SIGGRAPHAsia2025] Echo：先读懂两个人在谈什么，再生成角色的对话动作"
description: "Echo 怎样用对话意图帮角色做手势？从一段关于旅行的谈话读懂三级语义融合，再看三种骨干上的动作分布、双人同步、人评、消融，以及语言分析增加的推理时间。"
pubDate: "2026-11-01T16:58:00+08:00"
badge: "Paper"
tags: ["Echo", "Conversational-Behavior", "Co-Speech-Gesture", "Human-Motion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与核查范围 · SIGGRAPH Asia 2025 Conference Papers</summary>

*Echo: Enhancing Conversational Behavior Generation via Hierarchical Semantic Comprehension with Large Language Models*，Haiwei Xue、Yanbo Fan、Xuan Wang、Zhiyong Wu，SIGGRAPH Asia 2025 Conference Papers，Article 116，9 页，DOI 10.1145/3757377.3763998。Haiwei Xue 与 Yanbo Fan 为共同一作，Yanbo Fan 为通讯作者。本文联合核读 ACM 九页正式论文及十页补充材料，重排主文表 1–4、补充表 1–4，并对照公开训练代码。“表”指主文，“附表”指补充材料。[ACM 正式记录][doi] · [会议论文][main] · [官方补充材料][supp] · [作者仓库][repo]

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

图依作者仓库的总览图重绘。上游回答“正在交流什么”，下游回答“角色应当怎样随之活动”。在作者总览里，对话伙伴的动作是逐帧输入之一，末端输出标作**主角色动作序列**。图中的生成器没有同时自由生成两个人的两条新动作。[主文图 2][m4] · [作者原始总览][overview]

### 关键设计

1. **先确定谁在什么时候说了哪句话。** 公开预处理脚本把双人转写整理成一句一句的记录，每条保留角色、句子和词时间戳。以某句话为中心，脚本保留它前面的对话，并记录中心句第一个词的起点和最后一个词的终点。附录将语义抽取的滑动窗口描述为 10 句；公开预处理示例设置 k=10，为中心句保存最多十条前序记录。这是两个环节各自的口径。这给标签提供了时间范围，无法据此知道某个手势的起止帧。[附录 §1.2][s2] · [历史窗口代码][history]

2. **把当前句的作用与整场谈话的目的拆开问。** 附录列出提问、打断、道歉、赞同等 15 类局部意图，另设 None；主动性用二值标记区分发起话题与接受、回应。触发提示让模型为每句给出 1–10 的动作强度和理由；这里的“执行概率”实际以有序等级表示。声音还由 emotion2vec 提取八类情绪标签。附录把逐句意图、情绪、主动性和动作强度归为局部类别特征，把整场谈话的话题、全局意图归为全局文本特征。[附录 §1.2][s2] · [补充提示说明][s3] · [强度提示][s5]

3. **多次抽取、挑候选，最后验格式。** 主文算法 1 以 L=10 句初始化，随机改变窗口；提示模板、采样温度也有变化。抽取 **M=3** 次，Reviewer 参考人工挑选的优质分析范例，从三个候选中留下 **K=1** 个。它按语义覆盖、内部一致性、与原对话的吻合程度、时间衔接和行为自然程度选取候选，返回编号、1–10 的信心分及理由。规则式 Checker 另查 JSON 有没有缺项、是否可解析，失败则重试。Reviewer 比较的是对话的语义解释，并不观看最终骨骼动画。[主文算法 1][m3] · [§4.1.3][m6] · [附录 §2.6][s6]

4. **从三个尺度得到三个特征，再一起送入生成器。** 帧级 Hf 保留双方声音、转写、伙伴动作和说话人标识。句级的局部意图、情绪、主动性与触发强度使用独热编码和 MLP，对话级的话题摘要、全局意图则由预训练 BERT 编码。IF 块先拼接同层特征，拼接结果作查询、各项输入作键和值进行交叉注意力，再由 MLP 统一维数。先融合 Hf 与逐句条件得到 Hs，再融合 Hs 与全局条件得到 Hc。末端拼接 **Hf、Hs、Hc 三者**，并没有丢掉原始帧级信号。以 DSG+ 为例，原骨干的帧级编码、Echo 融合模块、动作生成模块端到端训练；语言模型的语义抽取另走 API。[主文式 1–4、§3.4][m5] · [附录 §1.1–1.2][s2]

5. **论文的完整设计与公开示例能追到哪一步？** Diff 示例把每条样本的摘要编码为 300 维向量，沿片段重复，再把它放进 `human_info` 接入扩散训练。示例配置为 150 帧、30 fps，即 5 秒；脚本构造模型时给出 30 帧种子，补充材料表 1 对 DiffSHEG 的种子帧却标为“未注明”，二者分开记录。把同一摘要向量复制覆盖一个片段可以提供全局语境，无法独自表示相邻两句意图的切换；附录中的完整分层架构还另有句级局部通道。[公开摘要输入][diff] · [训练代码][train] · [示例配置][cfg] · [附表 1][s6]

### 跟一段旅行谈话走完全程

主文图 4 给了一次可核对的语义抽取。主角色说自己很想旅行，觉得日本的樱花很美；伙伴回应自己去过，那里相当不错。从字面看是陈述，从整段互动看则可以是向对方征求建议。[主文图 4][m5]

| 环节 | 这句话能提供什么 |
|---|---|
| 读上下文 | 双方转写保留下来，焦点是主角色“很想旅行”这句；全局话题被概括为旅行计划与经历，全局意图被解释为向伙伴征求建议。 |
| 生成语义条件 | 图中对焦点句的局部判断是“陈述”，情绪是“高兴”，主动性为主动，动作触发强度为 **5**。这个数字表示估计的动作强弱，并未指定身体哪一部分要怎样动。 |
| 按时间融合 | 句级条件用于表达这一刻的交流作用，话题及全局意图在更长时间上提供主线；两路都与音频韵律及伙伴动作合用。 |
| 输出并检查 | 生成器预测主角色骨骼。图 4 只展示语义抽取，没给这段旅行谈话的手势轨迹。图 5 则是另一个作者生成案例：DiffSHEG 在说到“you know”时缺少明显回应，加 Echo 后出现类似指向谈话伙伴的动作；这是一次定性展示，没有给出指向误差或成功率。[主文图 5][m7] |

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 语料与训练设置

作者采用 GENEA 2023 的双人对话数据，来自 Talking With Hands 的自然交流。附表 5 列出 30 位身份、约 20 小时身体与手部动捕；正文说明共有 785 段对话，744 段用于训练，41 段用于验证。DSG+ 与 CoDiffuseGesture 本身用于双人任务；DiffSHEG 原本面向单人，作者拼接主角色与伙伴的特征，使其能处理双人输入。在同一骨干内，Echo 沿用相应基线的训练目标和超参数。[附录 §4.3–4.4、附表 5][s9] · [附录 §3.1][s6]

| 附表 1 · 训练配置 | DSG+ | CoDiffuseGesture | DiffSHEG |
|---|---:|---:|---:|
| Batch size | 200 | 400 | 250 |
| 优化器／学习率 | AdamW／3×10⁻⁵ | AdamW／3×10⁻⁵ | AdamW／3×10⁻⁵ |
| 训练步数，保留原表写法 | 120,0000 | 250,0000 | 80,0000 |
| 扩散噪声步数／日程 | 1,000／余弦 | 1,000／余弦 | 1,000／余弦 |
| 种子帧 | 30 | 30 | 未注明 |

附表 1 另统一列出 3 张 NVIDIA H20。训练步数的逗号分组非常规，表中按印刷值保留。[原始设置表][s6]

### 主文表 1：动作分布改善，双人同步也有增益

FGD 比较动作特征分布，Div. 衡量动作多样性。**BC 在正文定义为 Behavioral Coherence**，用于评估动作转换的连贯性。另有两个指标专看双人关系：P-FD 衡量配对运动的同步一致性，rPCC 衡量生成的主角色动作与真实伙伴动作之间的相关性。Jerk 描述运动平滑度，Acce. 描述动作强度，原表未给这两列统一优劣方向。FGD 采用在 BEAT 上预训练的 GENEA 2020 评测模型。[主文表 1、§4.1.4][m6] · [附录 §3.1][s6]

| 骨干与条件 | FGD ↓ | Div. ↑ | BC ↑ | Jerk → | Acce. → | P-FD ↓ | rPCC ↑ |
|---|---:|---:|---:|---:|---:|---:|---:|
| DSG+ | 146.4464 | 192.4041 | 0.2197 | 4.1158 | 0.2077 | 58.42 | 0.712 |
| DSG+ ＋ Concat | 119.8832 | 203.1245 | 0.2189 | 3.8765 | 0.1982 | 52.31 | 0.735 |
| DSG+ ＋ Echo | 106.2341 | 221.3452 | 0.2211 | 2.3256 | 0.1819 | 48.76 | 0.789 |
| CoDiffuseGesture | 138.4127 | 96.7100 | 0.2247 | 14.6927 | 0.4859 | 65.38 | 0.684 |
| CoDiffuseGesture ＋ Concat | 121.8965 | 115.2341 | 0.2241 | 14.6829 | 0.4848 | 60.12 | 0.702 |
| CoDiffuseGesture ＋ Echo | 105.4523 | 158.2167 | 0.2271 | 14.7104 | 0.4782 | 55.49 | 0.753 |
| DiffSHEG | 124.2767 | 172.3544 | 0.2185 | 2.2622 | 0.1799 | 56.89 | 0.725 |
| DiffSHEG ＋ Concat | 120.1234 | 183.1267 | 0.2192 | 2.2417 | 0.1798 | 54.93 | 0.738 |
| DiffSHEG ＋ Echo | 104.2345 | 198.2341 | 0.2211 | 2.3211 | 0.1778 | 50.24 | 0.771 |

完整 Echo 在三个骨干上都降低 FGD 和 P-FD，提高 Div.、BC 和 rPCC。CoDiffuseGesture 的多样性从 96.7100 增至 158.2167（原表报告相对提高 63.60%），而其 BC 从 0.2247 增至 0.2271。同时，P-FD 从 65.38 降至 55.49，rPCC 从 0.684 升至 0.753，说明这一增益也出现在双人动作关系的评测中。仅把语义特征拼到输入，DSG+ 与 CoDiffuseGesture 的 FGD 也降低，BC 却都略降。三个完整模型的 BC 相对增幅以主文表 1 为准，依次为 0.64%、1.07%、1.19%；附录讨论另报了一个略有不同的范围。[主文表 1][m6] · [附表 4 与讨论][s8]

### 消融：哪种语义有用？多次抽取值不值得？

主文表 4 对 DiffSHEG 做逐项比较，附表 4 把同一实验扩到另外两个骨干。这里的 **w/** 指基线只加入列中的一种语义。下表保留全部 15 组单项对照的五个指标，基线、简单拼接和完整 Echo 行见上表。[主文表 4][m7] · [附表 4][s8]

| 骨干 | 单独加入的条件 | FGD ↓ | Div. ↑ | BC ↑ | Jerk → | Acce. → |
|---|---|---:|---:|---:|---:|---:|
| DSG+ | 话题 | 141.8765 | 196.2341 | 0.2201 | 4.0179 | 0.2069 |
| DSG+ | 全局意图 | 142.3670 | 195.3784 | 0.2199 | 4.0633 | 0.2068 |
| DSG+ | 局部意图 | 141.2873 | 194.8286 | 0.2203 | 4.0099 | 0.2070 |
| DSG+ | 主动／被动状态 | 143.9537 | 194.1067 | 0.2198 | 4.0868 | 0.2072 |
| DSG+ | 动作强度 | 142.4922 | 193.2756 | 0.2198 | 4.0714 | 0.2071 |
| CoDiffuseGesture | 话题 | 133.8756 | 100.2345 | 0.2252 | 14.5979 | 0.4849 |
| CoDiffuseGesture | 全局意图 | 134.3670 | 99.3784 | 0.2249 | 14.6633 | 0.4848 |
| CoDiffuseGesture | 局部意图 | 133.1873 | 98.9286 | 0.2253 | 14.6099 | 0.4850 |
| CoDiffuseGesture | 主动／被动状态 | 135.9537 | 98.1067 | 0.2248 | 14.6868 | 0.4852 |
| CoDiffuseGesture | 动作强度 | 134.4922 | 97.2756 | 0.2248 | 14.6714 | 0.4851 |
| DiffSHEG | 话题 | 121.8756 | 176.2345 | 0.2194 | 2.2979 | 0.1798 |
| DiffSHEG | 全局意图 | 122.3670 | 175.3784 | 0.2192 | 2.2633 | 0.1798 |
| DiffSHEG | 局部意图 | 121.1873 | 174.8286 | 0.2195 | 2.2899 | 0.1800 |
| DiffSHEG | 主动／被动状态 | 123.9537 | 174.1067 | 0.2189 | 2.2868 | 0.1802 |
| DiffSHEG | 动作强度 | 122.4922 | 173.2756 | 0.2187 | 2.2714 | 0.1801 |

**单项语义。** 三种骨干上，单独加局部意图都给出五个单项中最低的 FGD；单独加话题都得到最高的单项多样性。二者均未达到完整 Echo 的效果。这是“各自加进来会怎样”的结果，不能据此计算“从完整模型拿掉它会损失多少”。主文 §4.3.2 的一处文字将 DiffSHEG 加话题后的 FGD 写成 122.1469，主文表 4、附表 4 都是 **121.8756**；本页采用两张表一致的数值。[主文表 4、§4.3.2][m7] · [附表 4][s8]

**一次与三次采样。** 作者用不同窗口、温度和提示措辞生成候选，再由 Reviewer 择一。附录比较 M=1 与 M=3，报告多次采样使**语义抽取质量**提高 **18.7%**；这里衡量的是语义候选，没有把 18.7% 写成最终动作成功率。[附录 §4.1][s8]

### 人怎样判断动作“合适”？

30 名参与者（20–35 岁，14 男、16 女）各评 30 对匿名视频，基线版与 Echo 版随机排序，每段平均约一分钟。每个骨干各有 10 段基线和 10 段 Echo 视频。参与者分别以 1–5 分回答三个问题：动作像不像真人、是否适合主角色自己的发言、是否适合回应伙伴的状态。合计 **1,800 次视频评价，5,400 项评分**；后者是前者乘三，不是 5,400 位参与者。下表列出主文给出的三项平均意见分（MOS），满分均为 5。[主文表 2][m6] · [附录 §3.4、图 1–2][s7]

| 主文表 2 · 骨干 | 像真人 ↑ | 符合主角色发言 AAS ↑ | 符合伙伴状态 AIS ↑ |
|---|---:|---:|---:|
| DSG+ | 3.5427 | 3.6192 | 3.5289 |
| DSG+ ＋ Echo | 3.7855 | 3.6478 | 3.5712 |
| CoDiffuseGesture | 3.7716 | 3.6760 | 3.6239 |
| CoDiffuseGesture ＋ Echo | 3.8522 | 3.7331 | 3.6668 |
| DiffSHEG | 3.7813 | 3.6284 | 3.5950 |
| DiffSHEG ＋ Echo | 3.8903 | 3.7716 | 3.6764 |

三项均值在三个骨干上都提高，但幅度不同。DSG+ 的“像真人”增加 0.2428 分，而“符合自己的发言”只增加 0.0286 分；DiffSHEG 的后一项增加 0.1432 分。动作看起来更自然，与动作准确传达某个词义，仍是两件事。表 2 没有列出差异的显著性检验。[主文表 2][m6]

**语义抽取本身的人工检查。** 主文表 3 另让 30 人在五分量表上评价提取结果的一致性。这是提取结果的主观评分，与上表看动画的评分不同。[主文表 3、§4.3.1][m6]

| 主文表 3 · 特征 | MOS ± 95% 置信区间 |
|---|---:|
| 话题 | 4.6809 ± 0.1007 |
| 全局意图 | 4.6285 ± 0.1071 |
| 局部意图 | 4.3952 ± 0.1224 |
| 主动／被动状态 | 4.2095 ± 0.1320 |
| 动作触发 | 3.9571 ± 0.1209 |

同一套分析器较容易概括“他们在谈旅行”，较难判断“说到哪句时应该动得更明显”。这也解释了为什么触发强度适合做软条件，而不能直接充当动作发生时刻的可靠标注。[主文表 3][m6]

### 推理要增加多少时间和参数？

| 骨干 | 生成耗时：原模型 → 加 Echo（秒） | 生成器参数：原模型 → 加 Echo（百万） |
|---|---:|---:|
| DSG+ | 9.821 ± 2.314 → 10.474 ± 2.5510 | 26.03 → 26.95 |
| CoDiffuseGesture | 14.312 ± 1.652 → 16.114 ± 1.7721 | 37.28 → 38.39 |
| DiffSHEG | 6.745 ± 1.321 → 7.222 ± 1.5154 | 156.75 → 157.68 |

附表 2 还针对带 Echo 的设置统一列出语言模型抽取 **1.271 ± 0.7142 秒**、Reviewer **0.778 ± 0.4421 秒**。以上是分阶段平均时间；论文讨论可将不同对话片段的请求并行处理，没有给出可流式交付首帧的延迟。附表 3 的参数量对应生成器，不含外部 LLM。[附表 2–3][s6] · [并行处理][s8] · [流式限制][s9]

短于五分钟的对话采用 gpt-4o-mini-0718，较长对话用 o1-preview-0912。主文报告实验期语言模型服务总成本约 350 美元，每次推理约 0.003 美元，文本处理截至 2025 年 4 月 15 日；这些是当时的实验开销。[主文 §4.1.3][m6]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **动作的交流功能有了可以检查的中间量。** 若角色在对方发问后大幅挥手，可以先读局部意图、主动性与触发判断，看系统是否理解了这句话的作用，然后再看骨骼是怎样实现的。这比只看生成视频更容易区分语境判断错与动作表达错。[分项提示][local] · [作者总览][overview]
- **主动性和动作幅度是两个问题。** “主动发问”描述一句话在互动里的角色；触发强度描述这句话可能配多明显的动作。主动发问可以很克制，被动回应也可以很激动。把两者拆开，保留了这种表达空间。[局部意图提示][local] · [触发提示][trig]
- **全局摘要与逐句条件可用一次干预来区分。** 固定音轨和相同的当前文字，只换此前的对话，观察生成的姿态、幅度与时机是否改变，是检验模型究竟用了什么条件的一条路线。这里是根据架构推导的测试思路，未将它列为作者已经做过的消融。[作者架构图][overview]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

1. **一个触发强度没有指定动作几何。** 语言模型可以认为一处发言值得动作强调，但公开的这个字段没有手别、关节方向、接触对象和精确时刻。若用于虚拟角色讲解，需要另外检查动作是否在目标词处发生，以及指向是否正确。[触发提示][trig] · [作者架构图][overview]
2. **实时性与长上下文之间仍有代价。** Echo 以整段对话生成全局条件；附录将流式输入列作未来工作，并指出扩散计算、同时处理双方特征，以及 LLM 请求中的网络波动、拒答和重试都会增加等待时间。附表 2 给的是组件平均推理时间，尚未测到声音一来便能稳定交付首帧的延迟。[附表 2][s6] · [附录 §4.5][s9]
3. **公开实现的边界。** 在当前提交中，Diff、DSG、Co 各有两个以普通版／Echo 版命名的训练入口，每对文件逐字节相同。Diff 入口导入的 `sum_diff_mdm` 及预计算的 `human_llm_info_sum.pkl` 未见于该仓库树。因而这两个脚本的名字无法构成“去掉 Echo”的消融，论文实验和代码公开程度要分别判断。本次核读作者表格及源码，未加载权重、复跑模型或重做用户研究。[代码树][tree] · [Echo 文件][diff] · [普通文件][base]
4. **输出动作的语义仍缺直接检验。** 作者在主文 §4.4 明说，尚未正式评测生成手势传达的具体语义。有限规模的对话数据、偶发空响应、重试和意图误判也会影响结果。FGD、双人相关性和观看者的整体评分各有价值，却都不能单独核验每个“你”是否真的触发了指向对方的动作。[主文讨论][m7] · [附录 §4.5][s9]
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
- **方法与示例。** 核读主文算法 1、图 2–5、式 1–4 及十页补充材料。图 4 对应旅行对话的推理示例，图 5 是独立的生成对照；本页架构图依正式论文与附录重绘。[正式论文][main] · [附录][supp] · [作者原图][overview]
- **实验与代码。** 主文表 1、2、3 分别报告动作与同步指标、生成动作人评、语义抽取人评；主文表 4 与附表 4 比较单项条件。附表 1–3 给出训练设置、组件用时和模型规模。源码核对到提交 `4152e28`，表格数字来自作者报告，未经本机复算。[主文表 1–3][m6] · [主文表 4][m7] · [附表 1–3][s6] · [附表 4][s8] · [作者源码][repo]

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

[supp]: https://dl.acm.org/doi/suppl/10.1145/3757377.3763998/suppl_file/Supplementary%20Materials%20For%20Echo.pdf
[s2]: https://dl.acm.org/doi/suppl/10.1145/3757377.3763998/suppl_file/Supplementary%20Materials%20For%20Echo.pdf#page=2
[s3]: https://dl.acm.org/doi/suppl/10.1145/3757377.3763998/suppl_file/Supplementary%20Materials%20For%20Echo.pdf#page=3
[s4]: https://dl.acm.org/doi/suppl/10.1145/3757377.3763998/suppl_file/Supplementary%20Materials%20For%20Echo.pdf#page=4
[s5]: https://dl.acm.org/doi/suppl/10.1145/3757377.3763998/suppl_file/Supplementary%20Materials%20For%20Echo.pdf#page=5
[s6]: https://dl.acm.org/doi/suppl/10.1145/3757377.3763998/suppl_file/Supplementary%20Materials%20For%20Echo.pdf#page=6
[s7]: https://dl.acm.org/doi/suppl/10.1145/3757377.3763998/suppl_file/Supplementary%20Materials%20For%20Echo.pdf#page=7
[s8]: https://dl.acm.org/doi/suppl/10.1145/3757377.3763998/suppl_file/Supplementary%20Materials%20For%20Echo.pdf#page=8
[s9]: https://dl.acm.org/doi/suppl/10.1145/3757377.3763998/suppl_file/Supplementary%20Materials%20For%20Echo.pdf#page=9

[main]: https://dl.acm.org/doi/pdf/10.1145/3757377.3763998
[m3]: https://dl.acm.org/doi/pdf/10.1145/3757377.3763998#page=3
[m4]: https://dl.acm.org/doi/pdf/10.1145/3757377.3763998#page=4
[m5]: https://dl.acm.org/doi/pdf/10.1145/3757377.3763998#page=5
[m6]: https://dl.acm.org/doi/pdf/10.1145/3757377.3763998#page=6
[m7]: https://dl.acm.org/doi/pdf/10.1145/3757377.3763998#page=7
