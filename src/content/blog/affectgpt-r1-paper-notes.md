---
title: "论文阅读 | arXiv 2025 | AffectGPT-R1：面向开放词表情绪识别的强化学习方法"
description: "AffectGPT-R1 论文阅读笔记，整理 OV-MER、GRPO、EW-based reward、reward hacking、MER-UniBench 结果和 demo 依赖取舍。"
pubDate: "Jul 01 2026"
badge: "Paper"
tags: ["AffectGPT-R1", "RL"]
---

## 01 论文信息

- 论文题目：AffectGPT-R1: Leveraging Reinforcement Learning for Open-Vocabulary Multimodal Emotion Recognition
- 论文作者：Zheng Lian, Fan Zhang, Yazhou Zhang, Jianhua Tao, Rui Liu, Haoyu Chen, Xiaobai Li, Bin He
- 发表情况：arXiv 2025，v3 revised on 2026-02-09
- arXiv：<https://arxiv.org/abs/2508.01318>
- 相关代码仓库：<https://github.com/zeroQiaoba/AffectGPT>
- 研究方向：开放词表多模态情绪识别、强化学习、GRPO、reward design

这篇可以接在 AffectGPT 后面看。AffectGPT 解决的是数据集、模型结构和统一评测问题；AffectGPT-R1 进一步问：既然 OV-MER 的评价指标不是 token-level loss，能不能直接用强化学习优化评价指标本身。

## 02 背景问题

OV-MER 指 Open-Vocabulary Multimodal Emotion Recognition。它不再限制模型只能从固定情绪集合中选标签，而是允许输出任意数量、任意类别的情绪词。

这个设定更接近真实情绪描述，但训练和评测都更麻烦。AffectGPT 这类方法主要还是用 token-level loss 训练，即让模型生成的文本尽量接近标注文本。问题是，token 相似不等于情绪语义相似。

论文举的思路是：sadness 和 madness 在 token 层面相似，但在情绪语义上并不接近；happy 和 joyful 在 token 层面不同，但语义上很接近。因此，OV-MER 更适合用 emotion wheel based metrics，而不是简单 token loss。

## 03 论文主要贡献

### 3.1 用 RL 直接优化 OV-MER 指标

AffectGPT-R1 把 emotion wheel based metrics 作为 reward，通过 GRPO 做策略优化。这样训练目标和评测指标更加一致。

### 3.2 系统分析 reward 设计

论文没有只给一个 reward，而是比较了 format、accuracy、alignment、dual、perception 五类 reward，并分析它们单独使用和组合使用的效果。

### 3.3 处理 reward hacking

模型在 RL 中会倾向于输出很多情绪词，因为多输出词更容易覆盖 ground truth。论文把这个现象视为 reward hacking，并加入 length penalty 来限制冗余情绪词。

## 04 方法

### 4.1 Base 模型与架构

AffectGPT-R1 不是重新提出一个多模态 backbone，而是在 AffectGPT 的基础上继续训练。也就是说，它继承了 AffectGPT 的音频/视频 encoder、pre-fusion operation、projector 和 LLM generation 结构，主要变化发生在训练目标和 reward 设计上。

整体结构可以概括为：

| 模块 | 作用 |
| --- | --- |
| Audio / Visual Encoders | 抽取音频和视觉特征 |
| Pre-fusion Operation | 在进入 LLM 前融合音视频 latent features |
| Projector | 将融合表示映射到 LLM token space |
| LLM Decoder | 生成开放词表情绪词或 reasoning 文本 |
| GRPO Training | 按 reward 优化输出分布 |

因此，AffectGPT-R1 的重点不是“架构更复杂”，而是“训练目标更贴近 OV-MER 评测”。它把 AffectGPT 原本的监督生成目标，进一步改成可以直接用 emotion wheel 指标给 reward 的强化学习目标。

### 4.2 两阶段训练

AffectGPT-R1 分两阶段：

| 阶段 | 数据 | 作用 |
| --- | --- | --- |
| Cold Start | MER-Caption+，31,327 个样本 | 学习情绪理解、输出格式和初始生成能力 |
| Reinforcement Learning | MER2025-OV，1,000 个样本 | 用 reward 优化开放词表情绪识别 |

测试集包括 OV-MERD+ 和 MER-UniBench。论文说明做了 overlap check，避免训练和测试样本重叠。

### 4.3 GRPO

论文采用 GRPO，而不是 PPO。GRPO 的优势是不用额外训练 value/critic model，而是对同一输入采样多组输出，用组内 reward 做相对归一化。

对于 AffectGPT-R1 这种多模态生成模型，GRPO 的好处主要是工程成本低一些。尤其是在 batch size 已经被显存限制到比较小的时候，少一个 critic model 会实际减轻训练压力。

### 4.4 Reward 设计

论文设计了五种 reward：

| Reward | 作用 |
| --- | --- |
| Format Reward | 检查是否输出规定格式 |
| Accuracy Reward | 用 OV-MER 的 EW-based metrics 计算最终答案得分 |
| Alignment Reward | 检查 reasoning 中的情绪词和 answer 是否一致 |
| Dual Reward | 检查 reasoning 中的情绪词是否匹配 ground truth |
| Perception Reward | 用 MLLM 对同一视频下不同输出做偏好比较 |

实验结果显示，最有效的组合不是越多越好，而是 accuracy reward + format reward。加入更多 reward 反而会相互干扰。

## 05 实验结果

### 5.1 Reward 选择

在 OV-MERD+ 上，关键结果如下：

| 设置 | OV-MERD+ |
| --- | ---: |
| 无 RL | 62.52 |
| 只用 Accuracy Reward | 63.35 |
| 只用 Dual Reward | 64.98 |
| Accuracy + Format | 66.49 |
| 五个 reward 全部使用 | 59.53 |

这个结果很清楚：reward 不是越复杂越好。Accuracy 和 Dual 都直接对齐 EW-based metrics，因此有效；Perception Reward 和过多辅助 reward 会引入噪声或目标冲突。

### 5.2 是否需要 reasoning

论文比较了带 think 和不带 think 的输出：

| 模型 | OV-MERD+ |
| --- | ---: |
| AffectGPT | 62.52 |
| AffectGPT-R1 w/ think | 66.49 |
| AffectGPT-R1 w/o think | 68.39 |

结果比较反直觉：去掉 thinking 后效果更好。论文解释是，thinking 来自粗粒度描述数据，本身可能带噪声；同时让模型生成额外 reasoning 会增加训练难度，并分散模型对 OV-MER 指标的优化。

这点对 demo 也有启发：如果第一阶段只想做稳定的情绪标签输出，不一定要强行要求模型展示 reasoning。reasoning 有解释价值，但它也可能引入幻觉和不稳定输出。

### 5.3 Reward hacking 与长度惩罚

RL 训练后，模型容易输出很长的情绪词列表。原因是 EW-based metrics 会处理同义词，多预测几个词可能更容易命中答案。

论文加入长度惩罚后，OV-MERD+ 仍保持在 67.44、67.79、68.05 附近，并能减少 overlong output。也就是说，适度惩罚可以降低冗余输出，同时不明显牺牲性能。

### 5.4 MER-UniBench 主结果

在 Audio + Video + Text 输入下，论文给出的 Mean 结果如下：

| 模型 | Mean |
| --- | ---: |
| R1-Omni | 59.61 |
| Emotion-LLaMA | 64.17 |
| AffectGPT | 74.77 |
| AffectGPT-R1 | 79.48 |

AffectGPT-R1 在 MER-UniBench 上整体最好。它尤其提升 basic emotion recognition 和 fine-grained emotion detection；但 sentiment analysis 上有时略低于 AffectGPT。论文的解释是：reward 主要围绕 OV-MER 和 emotion words 设计，而 sentiment analysis 关注的是正负情感极性，目标不完全一致。

## 06 为什么效果最好

AffectGPT-R1 的效果强，主要不是因为换了更大的模型，而是因为训练目标和评测目标更一致。

可以拆成三点：

1. AffectGPT 已经通过 MER-Caption+ 建立了比较强的情绪描述能力。
2. AffectGPT-R1 用 EW-based reward 直接优化开放词表情绪识别指标。
3. GRPO 让模型在多个候选输出中偏向高 reward 的情绪词组合。

也就是说，AffectGPT 提供了强 base，R1 阶段负责把输出进一步对齐到 OV-MER 指标。

## 07 为什么不适合作为第一阶段 demo 依赖

我不太建议把 AffectGPT-R1 作为第一阶段 demo 的核心依赖，原因主要有几个：

1. 它是强化学习后的研究模型，部署链路比普通 checkpoint 更复杂。
2. 论文里最强结果依赖 cold start + RL 两阶段训练，不只是下载一个模型就能稳定复现。
3. 当前 reward 主要针对 OV-MER 和 emotion wheel metrics，demo 用户未必需要开放词表指标最优。
4. reasoning 版本并不是最优，w/o think 反而效果更好；如果 demo 主打“可解释”，还需要额外处理解释质量。
5. RL 后的模型可能更容易受 reward 设计影响，输出风格和长度需要再做约束。

因此，第一阶段 demo 更适合先用稳定、可部署、输入输出格式清楚的模型。AffectGPT-R1 可以作为后续增强方向，用于优化开放词表情绪标签、评估 RL reward，或者做对比实验。

## 08 总结

AffectGPT-R1 的核心价值在于把开放词表情绪识别从 token-level training 推向 metric-level optimization。它证明了在 OV-MER 里，强化学习不是简单套 R1，而是要围绕 emotion wheel、同义词、标签数量和输出格式重新设计 reward。

这篇论文对后续实验的启发是：如果任务的评价指标和训练 loss 不一致，RL 可能是有效补充；但 reward 一旦设计不好，也会出现输出冗长、目标冲突和解释噪声。因此它适合做第二阶段优化，而不适合过早绑定到 demo 主流程。
