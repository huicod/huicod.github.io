---
title: "工具库介绍 | EmotiEffLib：高效面部情绪识别与表情分析"
description: "EmotiEffLib 使用笔记，介绍它的定位、Python/C++ 接口、PyTorch/ONNX 后端、预训练模型、适用场景和局限。"
pubDate: "Jul 01 2026"
badge: "Library"
tags: ["EmotiEffLib", "FER"]
---

## 01 基本信息

- 项目名称：EmotiEffLib
- 原名/相关名：HSEmotion
- 官方仓库：<https://github.com/sb-ai-lab/EmotiEffLib>
- 文档：<https://sb-ai-lab.github.io/EmotiEffLib/>
- PyPI：<https://pypi.org/project/emotiefflib/>
- License：Apache-2.0
- 最新 release：v1.1.1
- 主要方向：face emotion recognition、facial expression recognition、engagement recognition

EmotiEffLib 更像一个工程工具库，而不是一篇单独的方法论文。它提供了一组已经训练好的面部表情/情绪识别模型，并把推理接口封装成 Python 和 C++ 两套实现。仓库里也保留了不少训练和比赛相关代码。

## 02 它解决什么问题

如果只想快速在图片或视频里跑人脸情绪识别，直接从头训练 AffectNet 或 ABAW 模型成本很高。EmotiEffLib 的定位就是降低这个成本：提供轻量模型、推理接口、ONNX/PyTorch 后端，以及一些视频级情绪分析示例。

它适合处理这类需求：

1. 输入一张人脸图片，输出表情类别。
2. 输入一段视频，逐帧做人脸表情识别。
3. 把 frame-level 情绪特征聚合成 video-level 特征。
4. 在 C++ 或移动端环境里部署较轻量的表情识别模型。

它不是多模态大模型，也不做开放式情绪推理。它主要处理“脸部表情识别”这个更明确的视觉任务。

## 03 安装方式

Python 侧可以直接从 PyPI 安装：

```bash
pip install emotiefflib
```

如果需要 PyTorch 后端：

```bash
pip install "emotiefflib[torch]"
```

如果需要 engagement prediction 相关依赖：

```bash
pip install "emotiefflib[engagement]"
```

如果想一次安装所有可选依赖：

```bash
pip install "emotiefflib[all]"
```

官方也提供 C++ 版本。C++ 推理前需要先准备模型：

```bash
python models/prepare_models_for_emotieffcpplib.py
```

## 04 模型与后端

EmotiEffLib 支持两类主要推理后端：

| 后端 | 说明 |
| --- | --- |
| PyTorch | 方便研究、调试和二次开发 |
| ONNX Runtime | 更适合部署和跨平台推理 |

仓库中预训练模型主要放在 `models/affectnet_emotions`。模型包括 EfficientNet 系列、MobileNet、MobileFaceNet、MobileViT 等。README 里列了 AffectNet、AFEW、VGAF、LSD、MTL 等验证集结果，也给了 Samsung Fold 3 上的平均推理时间。

几个比较典型的模型：

| 模型 | 特点 |
| --- | --- |
| `mobilenet_7.h5` | 轻量，适合移动端或低资源场景 |
| `enet_b0_8_best_afew.pt` | EfficientNet-B0，兼顾速度和效果 |
| `enet_b2_8.pt` | 更大一些，效果通常更好但推理更慢 |
| `enet_b0_8_va_mtl.pt` | 多任务模型，涉及 valence-arousal / MTL |

选择模型时不能只看准确率。视频应用里还要考虑人脸检测开销、帧率、CPU/GPU 环境和模型大小。

## 05 和 ABAW / HSEmotion 的关系

EmotiEffLib 和 HSEmotion 团队的 ABAW 竞赛工作关系很密切。官方 README 里提到，这些模型在 ABAW 多届比赛中被用来做 expression recognition、action unit detection、ambivalence/hesitancy recognition、emotional mimicry intensity estimation 等任务。

在 ABAW-8 相关论文里，HSEmotion 团队也把 EmotiEffLib 作为面部情绪 descriptor 提取器，再结合声学特征和文本 embedding，用简单 MLP 做下游任务。这一点说明它不仅可以直接输出表情类别，也可以作为一个 feature extractor 接到别的系统里。

## 06 适合怎么用

我会把 EmotiEffLib 当成一个“轻量视觉情绪 baseline”：

1. 做 demo 时，用它快速跑通图片/视频的 face emotion recognition。
2. 做多模态系统时，用它提取 frame-level facial emotion descriptors。
3. 做视频情绪分析时，把逐帧结果聚合成 clip-level 特征。
4. 做移动端原型时，优先考虑 MobileNet / ONNX 这类更轻的配置。

如果目标只是“先看脸部表情大概是什么”，它比上来部署一个多模态大模型更直接。

## 07 局限

EmotiEffLib 的边界也比较清楚：

1. 它主要看脸，不等于理解人的真实情绪。
2. 人脸检测失败、遮挡、侧脸、低清视频都会影响结果。
3. 视频级情绪需要额外聚合策略，单帧结果容易抖动。
4. 它不直接处理语音语调、文本语义和上下文。
5. 表情识别类别通常比较固定，不适合开放词表情绪描述。

所以它更适合作为视觉侧基础模块，而不是完整情绪理解系统。

## 08 总结

EmotiEffLib 的价值在于工程可用性。它把常用的面部表情识别模型、Python/C++ 推理接口、PyTorch/ONNX 后端和一些视频示例整理到了一起，适合快速做 baseline 或 demo。

如果第一阶段只需要一个稳定的视觉情绪识别组件，EmotiEffLib 是比较合适的选择；如果目标是解释“为什么是这个情绪”、融合音频/文本，或者做开放词表情绪推理，就需要再接 Emotion-LLaMA、AffectGPT 或其他多模态模型。
