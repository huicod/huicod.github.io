---
title: "论文阅读 | arXiv 2025 | R1-Omni：基于 RLVR 的可解释多模态情绪识别"
description: "R1-Omni 论文阅读笔记，整理 HumanOmni-0.5B、冷启动训练、RLVR/GRPO、DFEW、MAFW 和 RAVDESS 结果。"
pubDate: "Jul 01 2026"
badge: "Paper"
tags: ["R1-Omni", "RLVR"]
---

## 01 论文信息

- 论文题目：R1-Omni: Explainable Omni-Multimodal Emotion Recognition with Reinforcement Learning
- 论文作者：Jiaxing Zhao, Xihan Wei, Liefeng Bo
- 发表情况：arXiv 2025
- arXiv：<https://arxiv.org/abs/2503.05379>
- 代码：<https://github.com/HumanMLLM/R1-Omni>
- 基础模型：HumanOmni-0.5B
- 研究方向：多模态情绪识别、可解释情绪推理、RLVR、GRPO

这篇文章主要看一个问题：强化学习能不能提升视频/音频多模态情绪识别模型的准确率、推理过程和跨数据集泛化。它不是从零训练一个情绪模型，而是在 HumanOmni-0.5B 的基础上做 cold start 和 RLVR。

## 02 背景问题

情绪识别依赖多种线索：表情、姿态、语气、语速、音高、字幕和语义内容。普通分类模型通常只输出一个标签，无法解释它为什么选择这个情绪。

R1-Omni 关注的是 explainable omni-multimodal emotion recognition，也就是让模型同时做到：

1. 输出最终情绪类别；
2. 用 `<think></think>` 给出推理过程；
3. 用视频和音频线索解释判断依据；
4. 在训练集外的数据集上保持泛化。

论文的核心假设是：情绪分类虽然不像数学题那样有完整推导过程标注，但最终标签是可验证的，因此可以用 RLVR 对模型进行强化学习训练。

## 03 模型架构与训练方法

R1-Omni 的基础模型是 HumanOmni-0.5B。它继承了 HumanOmni 对视频、音频和文本的多模态输入处理能力，论文主要改的是训练方式，而不是重新设计一个新的大模型骨架。

整体链路可以理解成：视频帧和音频先被 HumanOmni 的多模态 encoder 处理，得到模型内部的多模态表示；文本 prompt 约束输出格式；LLM 部分生成 `<think>` 和 `<answer>`。R1-Omni 的关键在于训练阶段让这个输出同时满足“格式正确”和“情绪答案正确”。

| 模块 | 作用 |
| --- | --- |
| HumanOmni-0.5B backbone | 提供视频、音频、文本的多模态理解能力 |
| Emotion prompt | 约束模型围绕情绪识别和解释作答 |
| `<think>` output | 生成表情、语音、语义等 reasoning 线索 |
| `<answer>` output | 输出最终情绪类别，供 reward 验证 |
| RLVR / GRPO | 用可验证标签优化答案和输出格式 |

训练分两步：

| 阶段 | 数据 | 目标 |
| --- | --- | --- |
| Cold Start | EMER + 手工标注 HumanOmni 数据，共 580 个视频样本 | 让模型先学会情绪推理格式 |
| RLVR | MAFW + DFEW 训练集，共 15,306 个视频样本 | 用可验证奖励优化情绪识别 |

第一阶段解决格式和初始 reasoning 能力问题。第二阶段用标签正确性和格式约束做 reward，真正提升分类效果和泛化能力。

## 04 Cold Start

R1-Omni 先用 232 条 EMER 样本和 348 条人工标注 HumanOmni 样本做冷启动，总共 580 条。

输出格式固定为：

```plaintext
<think>根据视频、音频和文本线索分析情绪。</think>
<answer>angry</answer>
```

这个阶段的重点不是追求最终性能，而是让 HumanOmni-0.5B 先知道“应该怎么回答”。如果直接做 RLVR，模型可能只学会猜标签，但推理格式不稳定，也不容易解释音频和视觉线索。

## 05 RLVR 与 GRPO

RLVR 是 Reinforcement Learning with Verifiable Reward。它的思路比较直接：如果模型输出的情绪和 ground truth 一致，就给正确性奖励；否则不给。

R1-Omni 的 reward 由两部分组成：

| Reward | 作用 |
| --- | --- |
| Accuracy Reward | 判断 `<answer>` 中的情绪是否与真实标签一致 |
| Format Reward | 判断输出是否符合 `<think>` 和 `<answer>` 格式 |

也就是说，模型不仅要猜对，还要按要求写出结构化结果。

优化算法采用 GRPO。和 PPO 相比，GRPO 不需要额外训练 critic model，而是在同一输入下采样一组回答，用组内 reward 的均值和方差来计算相对优势。对于 0.5B 规模模型和多模态输入，这种方式工程上更轻一些。

## 06 实验设置

论文比较了四类模型：

| 模型 | 说明 |
| --- | --- |
| HumanOmni-0.5B | 原始基础模型 |
| EMER-SFT | 只经过 EMER 冷启动监督微调 |
| MAFW-DFEW-SFT | 在 MAFW 和 DFEW 上直接 SFT |
| R1-Omni | 经过 cold start + RLVR/GRPO |

评测数据集包括：

- DFEW：动态面部表情数据集；
- MAFW：电影场景中的多模态情绪数据集；
- RAVDESS：演员录制的音视频情绪数据，用作 OOD 泛化测试。

指标使用 WAR 和 UAR。论文同时强调 open-vocabulary emotion testing，即测试时不直接提供固定候选类别，而是让模型生成情绪标签。

## 07 主要结果

论文正文中给出的关键结果如下：

| 数据集 | R1-Omni | 对比 SFT |
| --- | --- | --- |
| DFEW | UAR 65.83 / WAR 56.27 | SFT 为 UAR 60.23 / WAR 44.39 |
| MAFW | UAR 57.68 / WAR 40.04 | SFT 为 UAR 50.44 / WAR 30.39 |
| RAVDESS | UAR 43.00 / WAR 44.69 | SFT 为 UAR 29.33 / WAR 30.75 |

最值得注意的是 RAVDESS。它和 MAFW/DFEW 的数据分布差异很大，更多是演员录制语音和表情，因此可以看作 OOD 测试。R1-Omni 在这里提升明显，说明 RLVR 不只是拟合训练集标签，也增强了跨数据集泛化。

## 08 Reasoning 的变化

论文给出的可视化例子表明，HumanOmni-0.5B 原始模型和普通 SFT 模型的推理容易比较浅，常常只写“表情看起来不开心”这种泛泛描述。EMER-SFT 会有一些推理过程，但有时会出现不连贯或幻觉。

R1-Omni 的变化在于：它更倾向于把视觉和音频线索分开写，并把这些线索汇总到最终情绪判断上。这个现象和 reward 设计有关。虽然 reward 只直接检查最终 answer 和格式，但在 cold start 阶段已经给了 reasoning 模板，RLVR 会间接强化那些更容易导向正确答案的推理模式。

## 09 局限

论文也列了几个限制：

1. 字幕识别不准确会影响判断。
2. reasoning 仍可能出现幻觉。
3. 模型对音频线索的利用还不充分，有时视觉线索占主导。
4. 当前 reasoning 偏机械，更像列举表情和声音变化，还没有真正接近人的心理推断。

这些问题说明 R1-Omni 适合作为“RLVR 是否能提升情绪识别”的研究样例，但还不能简单认为它已经解决了可解释情绪理解。

## 10 总结

R1-Omni 的重点是把 R1 风格的 RLVR/GRPO 引入视频-音频情绪识别。它的贡献不在于提出新的大模型结构，而在于验证了：只要任务有可验证标签，就可以用比较简单的 reward 让多模态模型在准确率、推理格式和 OOD 泛化上同时获得提升。

从工程角度看，它更适合做第二阶段优化实验：先有一个能基本理解视频/音频情绪的模型，再用 RLVR 去强化输出和泛化。直接把它作为 demo 起点并不合适，因为它依赖 HumanOmni、冷启动样本、RL 训练流程和完整视频音频输入链路，部署成本比普通推理模型高不少。
