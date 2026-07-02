---
title: "论文阅读 | NeurIPS 2024 | Emotion-LLaMA：多模态情绪识别与推理"
description: "一篇关于 Emotion-LLaMA 的论文阅读笔记，重点看模型结构、MERR 数据、实验结果和 demo checkpoint 部署问题。"
pubDate: "Jul 01 2026"
badge: "Paper"
tags: ["Emotion-LLaMA", "MLLM"]
---

这篇先记一下 [Emotion-LLaMA: Multimodal Emotion Recognition and Reasoning with Instruction Tuning](https://arxiv.org/abs/2406.11161)。我读它主要是因为最近在看多模态情绪识别，尤其是视频、音频、文本三路信息怎么被统一进一个 LLM 里。

相关资料：

1. 论文：[arXiv:2406.11161](https://arxiv.org/abs/2406.11161)
2. 代码：[ZebangCheng/Emotion-LLaMA](https://github.com/ZebangCheng/Emotion-LLaMA)
3. NeurIPS 2024 版本：[Proceedings](https://proceedings.neurips.cc/paper_files/paper/2024/file/c7f43ada17acc234f568dc66da527418-Paper-Conference.pdf)

## 这篇论文在做什么

Emotion-LLaMA 的目标不是简单做一个“视频分类器”，而是把情绪识别和情绪推理放到一个多模态大模型框架里。输入可以是视频、音频和文本，输出也不只是一个 emotion label，还可以解释它为什么判断成这个情绪。

这个点我觉得挺重要。传统 MER 任务很多时候只关心分类结果，比如 happy、sad、angry。但真实使用时，一个模型只说“这个人很沮丧”其实不够。更有价值的是它能指出依据：语气变慢、表情收紧、说话内容带有失落感，等等。Emotion-LLaMA 把这个过程做成 instruction tuning，算是从“识别”往“解释”走了一步。

## 方法和架构

Emotion-LLaMA 不是把原始视频、音频直接交给 LLaMA，而是先把不同模态拆开编码，再把情绪相关特征投影到语言模型的输入空间。整体流程可以概括成：

| 阶段 | 作用 |
| --- | --- |
| Audio Encoder | 从语音中抽取语速、音高、能量等情绪线索 |
| Global Visual Encoder | 建模整帧画面和全局视觉上下文 |
| Local Visual Encoder | 聚焦脸部区域和局部表情变化 |
| Temporal Encoder | 建模视频帧之间的动态变化 |
| Projection / Alignment | 把多模态特征映射成 LLaMA 可接收的 token 表示 |
| LLaMA | 根据 instruction 输出情绪标签和推理解释 |

它的架构重点在 emotion-specific encoders。和通用视觉问答模型相比，Emotion-LLaMA 在进入 LLM 前就已经把特征抽取往情绪任务上偏置了：全局视觉负责场景和整体动作，局部视觉负责表情，音频负责声音情绪，时序模块负责动态变化。

训练方式上，它更接近“多模态特征对齐 + instruction tuning”。底层 encoder 提供特征，中间 projection 完成对齐，上层 LLaMA 学习按照指令回答。输出通常包含两部分：情绪类别，以及与表情、语气、文本内容相关的解释线索。

## MERR 数据集

这篇论文另一个核心是 MERR。论文里给出的规模是 28,618 条 coarse-grained 样本和 4,487 条 fine-grained 样本。它的用途不是只给一个标签，而是让模型学习“情绪标签 + 情绪线索描述”。

我这里把 MERR 理解成一个偏私有构建的数据集。仓库里能看到标注、构建方法和相关说明，但原始视频素材并不是那种可以直接完整公开下载的开箱数据。这也比较符合情绪/视频数据的现实情况：版权、肖像、来源都比较麻烦。

MERR 的价值在于它把情绪识别做成了更接近 instruction data 的形式。模型不只是看一个样本对应什么类别，还要学会回答“为什么”。这对 EMER 这类 emotion reasoning 任务很有帮助。

## 几个实验结果

仓库 README 里列了几个结果，我先记几个关键数字，后面如果复现实验再细看配置。

MER2023-SEMI 上，Emotion-LLaMA 的 A/V/T 三模态 F1 是 0.9036。这个结果比一些传统 supervised baseline 高，说明把多模态特征映射到语言空间再做指令微调，至少在这个 benchmark 上是有效的。

DFEW 上，论文强调的是 zero-shot 结果，UAR 45.59，WAR 59.37。这个结果说明它不是只在自己的训练分布上工作，迁移到动态表情数据集时也有一定泛化能力。不过 DFEW 的 zero-shot 结果也提醒我：情绪识别的域差异很明显，不同数据集之间的分布、标注方式、场景都不一样。

EMER 是更偏 reasoning 的评测。Emotion-LLaMA 在 Clue Overlap 上是 7.83，Label Overlap 是 6.25。这个指标不是普通分类准确率，而是在看模型给出的情绪线索和标签是否与参考答案重合。也就是说，这里评的不是“猜中类别”这一件事，而是看模型解释得是否接近人工标注。

MER2024-NOISE 也很值得看。README 里写到 Emotion-LLaMA 在 MER-NOISE track 得到 84.52 F1，后续 SZTU-CMU 又用 Emotion-LLaMA 的结果做 pseudo-label，拿到 0.8530 的成绩。这个地方我觉得很工程：大模型不一定只作为最终模型，也可以作为半监督/伪标签系统里比较强的标注器。

## 我比较在意的地方

第一，Emotion-LLaMA 的亮点不是“接了 LLaMA”本身，而是把情绪任务拆成了识别和推理两部分。很多多模态 LLM 做情绪识别时会停留在描述层面，但这篇更明确地把 emotion reasoning 当成任务来训练和评估。

第二，它依赖的数据和特征处理不少。论文看起来是一个模型，但真正复现时，问题会落到数据访问、特征提取、checkpoint 路径、显存和环境版本上。尤其是 MER2023、MERR、EMER 这些数据并不是随便 pip install 一下就能跑。

第三，情绪识别本身很容易被 benchmark 带偏。模型能在数据集上解释“线索”，不等于它在真实场景里就能可靠理解人的状态。视频情绪里有文化差异、表达习惯、场景上下文，还有隐私问题。这个方向如果做产品，不能只看分数。

## Demo checkpoint 部署笔记

官方仓库的 demo 路线大概是：

1. 准备 `Llama-2-7b-chat-hf`；
2. 准备 MiniGPT-v2 checkpoint；
3. 准备 HuBERT-large，放到 `checkpoints/transformer/`；
4. 下载 Emotion-LLaMA demo model；
5. 修改配置里的 `llama_model`、`ckpt`、HuBERT 路径；
6. 运行 `python app.py` 打开 Gradio demo。

这里容易踩坑的是路径。README 里 demo checkpoint 的文件名写作 `Emoation_LLaMA.pth`，拼写看起来不是 `Emotion`，所以照着配置找不到文件时先别急着怀疑模型坏了，先看 checkpoint 实际文件名和配置是否一致。

另外，LLaMA-2 权重需要从 Hugging Face 侧单独准备，不是仓库 clone 下来就有。MiniGPT-v2、HuBERT、Emotion-LLaMA demo checkpoint 也分别是不同来源。这个项目更像研究代码，部署时最好先把 checkpoints 目录结构理清楚，再改配置。

## 总结

Emotion-LLaMA 给我的感觉是：它把多模态情绪识别从“分类任务”推向了“可解释问答任务”。这条路线对情绪交互类应用很有吸引力，因为用户真正想要的通常不是一个标签，而是模型能不能说清楚它为什么这么判断。

但我也不会把它理解成一个可以直接落地的通用情绪理解模型。它更适合作为研究基线或者原型系统：用来研究 video/audio/text 如何对齐到 LLM，以及情绪识别里的 reasoning data 应该怎么构造。真正部署时，数据许可、隐私、跨域泛化和模型解释的可靠性都还要单独处理。
