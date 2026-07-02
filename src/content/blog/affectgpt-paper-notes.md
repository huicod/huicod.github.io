---
title: "论文阅读 | ICML 2025 | AffectGPT：面向多模态情绪理解的数据集、模型与基准"
description: "AffectGPT 论文阅读笔记，整理 MER-Caption 数据集、预融合模型结构、MER-UniBench 评测方式和实验结论。"
pubDate: "Jul 01 2026"
badge: "Paper"
tags: ["AffectGPT", "MLLM"]
---

## 01 论文信息

- 论文题目：AffectGPT: A New Dataset, Model, and Benchmark for Emotion Understanding with Multimodal Large Language Models
- 论文作者：Zheng Lian, Haoyu Chen, Lan Chen, Haiyang Sun, Licai Sun, Yong Ren, Zebang Cheng, Bin Liu, Rui Liu, Xiaojiang Peng, Jiangyan Yi, Jianhua Tao
- 发表会议：ICML 2025
- arXiv：<https://arxiv.org/abs/2501.16566>
- 代码与数据：<https://github.com/zeroQiaoba/AffectGPT>
- 研究方向：多模态情绪理解、开放词表情绪识别、MLLM-based MER

这篇论文可以看作 AffectGPT 系列中更完整的一版：不只是提出一个模型，而是同时补了数据集、模型结构和统一评测基准。它和早期的 EMER/AffectGPT 工作有继承关系，但本文更强调 MLLM 场景下的自由文本情绪描述。

## 02 背景问题

传统多模态情绪识别通常是闭集分类任务。模型看视频、音频、文本，然后从固定标签里选一个，例如 happy、sad、angry。这个设定比较清楚，也方便评测，但它对真实情绪的表达能力有限。

论文指出的问题主要有三个：

1. 真实情绪往往不是单一类别，可能同时包含多个细粒度状态。
2. 现有 MER 数据集多数只给离散标签，缺少自然语言描述式标注。
3. 多模态大模型虽然可以生成文本，但现有模型通常把音频、视频的融合过程留给 LLM 本身，缺少针对情绪任务的显式融合设计。

因此，本文的目标是把 MER 从“判别式分类”推进到“多模态情绪理解”：模型不仅输出标签，也能用自然语言描述更细粒度的情绪状态。

## 03 论文主要贡献

### 3.1 MER-Caption 数据集

论文构建了 MER-Caption 和 MER-Caption+。根据论文表格，MER-Caption 有 115,595 个样本、2,932 个情绪类别；MER-Caption+ 有 31,327 个样本、1,972 个情绪类别。

它们的特点是“descriptive emotion annotation”，也就是每个样本不仅有情绪标签，还有与情绪相关的自然语言描述。这个设定更适合训练 MLLM，因为模型输出本来就是自由文本。

### 3.2 AffectGPT 模型

AffectGPT 的核心不是换一个更大的 LLM，而是在音频和视频进入语言模型前加入 pre-fusion operation。论文认为，情绪识别里的音频、视觉信息需要更明确的跨模态交互，不能完全依赖 LLM 自己在 token 层面做融合。

### 3.3 MER-UniBench 基准

MER-UniBench 统一覆盖三类任务：

| 任务 | 目标 |
| --- | --- |
| Fine-grained Emotion Recognition | 预测开放词表/细粒度情绪 |
| Basic Emotion Recognition | 在基础情绪类别上评估命中情况 |
| Sentiment Analysis | 判断正负向情感倾向 |

这个基准的意义在于：MLLM 的输出是自由文本，不能完全沿用传统分类准确率。论文因此设计了适配自由文本输出的解析和评测方式。

## 04 数据集构建

MER-Caption 的标注策略叫 model-led human-assisted。这个名字可以直译为“模型主导、人工辅助”。

整体流程大致是：

1. 先用少量人工先验帮助选择合适的生成模型。
2. 使用 SALMONN 生成音频线索。
3. 使用 Chat-UniVi 生成视觉线索。
4. 使用 GPT-3.5 合并音频、视频和文本内容，生成情绪描述。
5. 再通过低层过滤和高层过滤清理低质量样本。

低层过滤主要处理音视频不匹配、描述过短或过长等问题。高层过滤则训练多个情绪/情感分类器，用类似 model-based crowdsourcing 的方式交叉检查标签质量。

这个流程和纯人工标注相比更容易扩展，和纯模型标注相比又多了一些质量控制。论文也承认 MER-Caption+ 仍然可能存在自动标注误差，但实验上它比一些已有描述式数据集更有效。

## 05 方法

### 5.1 模型总体架构

AffectGPT 仍然沿用 MLLM 的基本框架：视频和音频先经过各自的 encoder，得到 latent features；文本输入作为 prompt 进入语言模型；最后由 LLM 生成情绪描述或标签。但它和普通“模态特征拼接”模型的区别在于，音频和视频不会直接各自投影成 token 后再交给 LLM，而是先进行 pre-fusion。

可以把它拆成四步：

| 步骤 | 说明 |
| --- | --- |
| Modality Encoding | 分别抽取 audio feature 和 visual feature |
| Pre-fusion | 在进入 projector 前融合音频和视频 latent features |
| Projection | 将融合后的表示映射到 LLM embedding space |
| Generation | LLM 根据 prompt 生成开放词表情绪描述 |

论文的出发点是：情绪识别里音调、表情和语义之间的关系比较细。如果完全依赖 LLM 在 token 层面自己融合，跨模态交互可能发生得太晚。因此 AffectGPT 把融合位置前移，让模型在语言生成前先得到一个更统一的情绪表示。

### 5.2 Pre-fusion Operation

AffectGPT 把跨模态融合前移，在进入 LLM 之前先融合音频和视频特征。论文实现了两种形式：

| 方式 | 说明 |
| --- | --- |
| Q-Former pre-fusion | 保留时间信息，用 learnable query 从音视频特征中抽取融合表示 |
| Attention pre-fusion | 先池化压缩单模态特征，再通过注意力计算模态权重 |

论文默认把 pre-fusion 用在音频/视频的 latent feature 上，而不是 projector 后的 token 上。作者实验发现，在 projector 之后再融合效果会下降。

## 06 实验结果

### 6.1 主结果

在 MER-UniBench 上，AffectGPT 相比现有 MLLM 有明显提升。论文主表里给出的最好 AffectGPT 结果均值为 74.77，明显高于 Emotion-LLaMA 的 64.17，也高于 SALMONN、PandaGPT、VideoChat 等模型。

主结果里比较有代表性的几项：

| 模型 | MER-UniBench Mean |
| --- | ---: |
| SALMONN | 57.89 |
| Emotion-LLaMA | 64.17 |
| AffectGPT | 74.77 |

论文给出的解释是：提升不只是来自 LLM 本身，而主要来自更大规模、更贴近情绪描述的数据集，以及额外的 pre-fusion 结构。

### 6.2 数据集对比

论文固定模型结构，只替换训练数据。结果显示：

| 训练数据 | MER-UniBench |
| --- | ---: |
| MERR-Coarse | 49.85 |
| MERR-Fine | 64.55 |
| MER-Caption | 68.91 |
| MER-Caption+ | 74.77 |

这个实验说明数据质量和规模都很关键。MER-Caption+ 样本数比 MER-Caption 少，但经过过滤后性能更好。

### 6.3 模型消融

pre-fusion 的消融结果也比较直接：

| 结构 | MER-UniBench |
| --- | ---: |
| 无 pre-fusion | 72.95 |
| Q-Former | 74.16 |
| Attention | 74.77 |

可以看出 pre-fusion 是有效的，但 Q-Former 未必比简单 attention 更强。论文的解释是，在 MER 任务里，保留完整时间特征并不总是收益更高，压缩后的情绪相关信息反而可能更稳定。

## 07 与 Emotion-LLaMA 的关系

Emotion-LLaMA 更强调情绪识别与情绪推理，使用 MERR 数据来训练模型生成情绪线索和解释。AffectGPT 则进一步把问题扩展到更开放的情绪理解，重点放在大规模描述式数据、开放词表标签和统一评测上。

从论文脉络看，AffectGPT 不是简单替代 Emotion-LLaMA，而是在它所代表的“情绪描述/情绪推理”方向上继续往数据规模和评测体系推进。

## 08 总结

AffectGPT 的核心价值可以概括为三点：

1. 用 MER-Caption / MER-Caption+ 扩展描述式情绪数据规模。
2. 用 pre-fusion operation 显式加强音视频融合。
3. 用 MER-UniBench 重新组织 MLLM 情绪理解任务的评测方式。

这篇论文最值得记录的地方不是某个复杂模块，而是它把“数据集、模型、评测”三件事放在同一套框架里处理。对于多模态情绪理解这种任务，仅有模型结构通常不够；没有足够细粒度的数据和合适的自由文本评测，模型很难真正从闭集分类走向开放式情绪理解。
