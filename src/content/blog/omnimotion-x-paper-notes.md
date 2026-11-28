---
title: "[CVPR Findings 2026] OmniMotion-X：文字说向后走，轨迹却向前，角色会听谁的？"
description: "解读 OmniMotion-X: Versatile Multimodal Whole-Body Motion Generation。沿着同一段行走，看文本、语音、音乐、参考动作与关节轨迹怎样进入全身扩散模型，核对多条件冲突、手势与舞蹈的实验结果。"
pubDate: "2026-11-28T20:10:00+08:00"
badge: "Paper"
tags: ["OmniMotion-X", "OmniMoCap-X", "CVPR 2026 Findings", "统一多模态", "全身动作生成", "自回归扩散", "语音手势", "音乐舞蹈", "时空控制", "动作续写", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[arXiv HTML（可翻译）][html] · [会议终稿 PDF][pdf] · [正式补充材料 PDF（含条件冲突实验）][supp] · [动作示例][fig4] · [模型仓库][repo] · [数据文件清单][data]

<details class="paper-meta"><summary>论文信息与阅读版本 · CVPR 2026 Findings</summary>

*OmniMotion-X: Versatile Multimodal Whole-Body Motion Generation*。作者为 Guowei Xu、Yuxuan Bian、Ailing Zeng、Zhuo Chen、Mingyi Shi、Shaoli Huang、Wen Li、Lixin Duan、Qiang Xu。正式发表于 **CVPR 2026 Findings**，3641–3652 页。预印本初版发表于 2025 年 10 月，v2 更新于 2026 年 7 月。本文以会议终稿、七页正式补充材料和 v2 HTML 为依据。另有一篇名称相近的 *OmniMotion*，其连续掩码自回归架构有独立解读。[会议记录][venue] · [版本记录][abs] · [站内 OmniMotion 解读](/blog/arxiv2025-omnimotion/)

截至 2026 年 11 月 28 日，模型仓库的文件树仅有 README 和许可文件，训练、推理、评测脚本及权重仍在待发布清单中。OmniMoCap-X 数据页面已列出九个来源的文件目录，下载需登录并接受访问条件。本次核对了论文与发布记录，未运行生成模型。[核查时的模型文件树][repo] · [数据目录][data]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

OmniMotion-X 每次生成约五秒全身动作，通过参考动作衔接前后片段，并能在同一段里接收文字、语音、音乐或关节轨迹。作者做了一个直接的冲突测试：文字全程要求“向后走”，开头和结尾却启用一条向前再向右的轨迹。角色在轨迹生效时跟随路径，中段撤去轨迹后按文字倒走。[主文图 1][fig1] · [补充材料 §5、图 6][conflict]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**　文字适合描述“起身、转向、离开”等动作意图，语音和音乐提供随时间变化的韵律，关节轨迹则能指定某个部位在某一刻的位置。分别训练的生成器往往使用不同的骨架、帧率和标注，即使都能生成好动作，也不容易在同一个角色身上一起使用。[主文 §1][intro]

**现有痛点**　只告诉模型“抬手”，手可能抬对了却没有经过指定位置。只给手腕路径，又说不清角色是在打招呼还是伸手取物。开始新片段时只给一个起姿，还会丢掉上一段的速度和蓄势。[主文 §4.1][model]

**核心矛盾**　训练时，文字对姿态的约束比较宽，一段相邻的真实动作或精确轨迹对下一帧的提示很强。如果第一天就把所有提示一起交给模型，它可以利用空间线索降低重建误差，却很少需要读懂文字。增加条件既可能提高控制精度，也可能削弱另一种输入的作用。[主文 §4.2][progressive] · [原表 7][tab7]

**本文目标**　用同一套全身生成器做文本生成动作、语音生成手势、音乐生成舞蹈，以及续写、补间和轨迹控制。输入条件可缺省，也可在时间上启停，让一段较长的动作可以分段编排。[任务定义与主文图 1][fig1]

**切入角度**　“接下去怎样动”和“现在必须经过哪里”分别用两种信号表示。参考动作提供过去一段时间的运动趋势，全局控制则给出当前目标段里已知的关节和时刻。二者分开输入，就可以沿用同一段历史，尝试新的路线或指令。[主文图 2][fig2] · [补充架构图][archsupp]

**核心 idea**　各模态先分别编码，再一起送进共享的动作去噪器。训练顺序从文字开始，逐步开放参考动作、空间约束和音频。生成时先完成当前片段，再把它作为下一段的可选参考。[主文图 2][fig2] · [训练图 3][fig3]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

读架构图时先区分两个时间尺度。**段内**反复去噪，逐步得到同一批帧的连续动作。**段间**才是自回归，上一段的结果可以进入下一段的参考通道。默认参考段和目标段各 150 帧，按 30 FPS 各约 5 秒。初次生成允许没有参考，也可以直接给一段用户设计的动作。[主文图 1–2][fig2] · [实现设置][impl]

<figure class="reading-figure"><a href="/paper-notes/omnimotion-x/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/omnimotion-x/architecture.svg" alt="文字、语音、音乐、全局关节轨迹与参考动作各自编码，作为可选条件与带噪动作进入 Transformer；片段内按部位解码并迭代去噪，片段间可反馈为参考。另示四阶段训练顺序。" loading="lazy" /></a><figcaption>根据主文图 1–3 与正式补充材料图 3–5 教学重绘。先看各路条件如何汇合，再沿段内去噪和段间反馈两条路径读图。全局轨迹还可参与采样时的梯度引导。点击可查看大图。</figcaption></figure>

### 关键设计

1. **五种条件保留不同的时间结构。** 文字由冻结的 T5-XXL 编码；语音以 16 kHz 波形送进一维卷积 WavEncoder；音乐用 Librosa 提取 35 维逐时刻特征，含起音强度、MFCC、色度、起音峰和拍点。全局位置编码器读指定关节的三维坐标；参考动作编码器读整段全身运动。各路分别投影到同一宽度，原本属于文字、音频或动作的多个位置仍然保留。这里的文本可以是独立动作描述，语音是驱动动作的输入。[主文式 1][model] · [补充材料 §4][encoders]

2. **全身按部位编码，再由一个网络共同决定怎样动。** 每帧的身体、脸、手等特征通过各部位自己的线性层，12 组各 128 维，拼成 1,536 维。由此，默认目标段在主干里的动作表示可写成 150 × 1,536（省略批次维）。扩散步、可用条件和带噪动作的序列一起进入 8 层、8 个注意力头的 Transformer Encoder。自注意力在整条拼接序列上计算 Q、K、V，最后只取**原先带噪动作所在位置**的输出，由各部位解码器还原。训练用均方误差让它直接预测干净动作。模型生成的是连续姿态参数，不需要把舞步先查成离散码。[主文式 2][model] · [补充材料图 3–5][archsupp]

3. **参考动作和全局轨迹承担不同约束。** 表 4 测参考动作时，喂给模型的是测试序列中紧邻目标段的**真实前段**，其中已经包含动作内容、风格和速度线索。逐段生成时它也可以接收模型自己刚生成的结果。全局轨迹则描述目标段内哪些关节、哪些位置已经给定。时空掩码标识观测区域，同一接口由此表达“看见开头，预测未来”“看见两端，补出中间”和“只指定少数关节的路径”。全局信号既能编码成条件，也能在采样中用作梯度引导；执行精度要对照最终关节误差。[主文图 2][fig2] · [动作示例][fig4] · [原表 5][tab5]

4. **让文字先获得生成能力，再加入更具体的线索。** 四个阶段依次保留文字、加入参考动作、加入全局时空约束、最后加入语音和音乐条件。条件缺失时，注意力掩码屏蔽缺失的输入。在某个数据源没有手部真值时，重建损失另行屏蔽这些关节，防止缺项被当成某种真实手形。二者解决的是不同的问题：前者决定网络能读哪些条件，后者决定哪些输出有资格参与训练误差。[主文图 3][fig3] · [补充材料 §4][masks]

### 一个完整例子

沿着补充图 6 看同一次生成。**文字一直是“这个人向后走”**。另一路给出先往前、再往右的全局路径，并只在开头和结尾启用。文字编码在三个时段都可读；时空掩码决定哪段能看到路径。作者观察到，开头和结尾人物跟着指定路线走，中间轨迹撤去后，动作回到倒走。这个对照比展示三条彼此相容的输入更有辨识力，因为两种要求真的冲突了。论文没有在同一个手腕上制造“文本要求保持不动、语音却强烈带动手势”的对应测试，也没有暴露让用户调节两者优先级的接口。[正式补充材料 §5、图 6][conflict]

### 训练与推理

- **动作与文字从哪里来。** OmniMoCap-X 汇合 28 个来源，统一到 SMPL-X、30 FPS。共享表示覆盖根节点运动、关节位置与速度、身体及手部旋转、足部接触特征和 100 维面部表示。作者将骨架渲染成视频，让 GPT-4o 同时参考视频与原有文字或类别，为动作生成分层描述；补充表 1 统计了 321,967 条描述。GPT-4o 用于制作训练标注，推理时的条件文本由 T5 编码。[主文 §3][dataset] · [补充表 1][capstats]
- **数据规模的口径。** 主文汇总行报告 286.2 小时、6,430 万帧，并注明帧数按来源的原始帧率计。我们把表 3 的 28 行小时数直接相加，得到 430.5 小时；论文未解释分项与汇总的差额。引用总体规模宜写“作者报告 286.2 小时”，也不宜把原始帧数按模型的 30 FPS 倒推时长。[原表 2][tab2] · [原表 3][tab3]
- **训练量与推理方式。** 四阶段各训练 46 万、46 万、23 万和 92 万步，合计 207 万步，批大小分别为 48、48、48、16。作者报告单张 H800，未披露总训练时长。每次采样可使用新的文字或音频，再决定是否传入上一段动作；长序列能这样续写，其首帧延迟和长期漂移仍需单独测量。[主文 §5.1][impl] · [主文 §6][limits]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

**文字生成动作。** 表 4 在 OmniMoCap-X 测试集上评估。文本生成和全局控制两项任务都从各来源数据集均匀抽取样例，每个来源 10 条。带星号的基线在 OmniMoCap-X 上重新训练。下表摘录 20 次评测的均值，原表另列 95% 置信区间。R@3 衡量文本与动作的检索匹配，FID 越低表示生成动作与真实动作的特征分布越接近。评测用的文本、动作特征提取器在该数据集上重新训练。[原表 4](https://arxiv.org/html/2510.19789v2#S3.T4) · [评测设置](https://arxiv.org/html/2510.19789v2#S5.SS2)

| 方法或测试条件 | R@3 ↑ | FID ↓ | 文本–动作距离 ↓ | Diversity（趋近真实值） | 同提示多样性 ↑ |
|---|---:|---:|---:|---:|---:|
| 真实动作 | 0.821 | 0.013 | 2.493 | 9.194 | — |
| MoMask* | 0.530 | 17.428 | 5.661 | 6.772 | 0.811 |
| MotionCraft* | 0.489 | 47.428 | 7.424 | 2.820 | 0.863 |
| OmniMotion-X，仅文本 | 0.571 | 5.040 | 4.678 | 8.650 | 1.696 |
| OmniMotion-X，文本 + 真实前段动作 | 0.629 | 3.199 | 4.106 | 8.009 | 1.143 |

**语音生成手势、音乐生成舞蹈。** 表 6 在 BEAT2 上测语音，在 AIST++、FineDance、PhantomDance 合并的测试序列上测音乐。原文对每项任务只给一组汇总结果。下表将两项任务分行，便于看到全身、手和脸是否同时受益。[原表 6](https://arxiv.org/html/2510.19789v2#S5.T6)

| 任务 | 方法 | 全身 FID ↓ | 手部 FID ↓ | 面部 MSE ↓ | Diversity ↑ |
|---|---|---:|---:|---:|---:|
| 语音 → 手势 | MotionCraft | 3.422 | **5.370** | 0.182 | 1.003 |
| 语音 → 手势 | OmniMotion-X | **2.641** | 9.095 | **0.045** | **1.664** |
| 音乐 → 舞蹈 | MotionCraft | **9.875** | 7.099 | — | 3.798 |
| 音乐 → 舞蹈 | OmniMotion-X | 16.209 | **5.827** | — | **4.716** |

**全局时空控制。** 表 5 沿用 OmniControl 的跨关节评测，用所有关节模拟空间上密集的控制。作者同时记录文本匹配、关节位置偏差、滑步和两档失败率。这里按原表保留 Fail@20 和 Fail@50 的标记及数值。[原表 5](https://arxiv.org/html/2510.19789v2#S5.T5)

| 方法 | FID ↓ | R Precision ↑ | 控制 L2 ↓ | 滑步 ↓ | Fail@20 ↓ | Fail@50 ↓ |
|---|---:|---:|---:|---:|---:|---:|
| OmniControl | 63.725 | 0.392 | 0.820 | 0.089 | 0.844 | 0.794 |
| OmniMotion-X | 4.224 | 0.682 | 0.424 | 0.004 | 0.516 | 0.330 |

### 消融实验

- **从一开始混合所有条件，还是逐步加入？** 表 7 的 w/o TrSt 去掉由弱到强的训练顺序。改用分阶段训练后，文本生成的 FID 从 9.574 降至 5.040，R@3 从 0.232 升至 0.571；全局控制的 FID 从 10.247 降至 4.224，R@3 从 0.491 升至 0.686。全局控制的 R Precision 在主表 5 写作 0.682、消融表 7 写作 0.686，此处保留各表数值。[原表 7](https://arxiv.org/html/2510.19789v2#S5.T7)
- **文字和轨迹发生冲突时听谁的？** 补充图 6 给出“向后走”的文本，在序列开头和结尾启用先向前、再向右的全局轨迹。角色在轨迹启用时跟随路径，中段撤去轨迹后按文字倒走。这一例子明确展示了两种条件冲突时的行为；同一只手同时受文字和音频驱动时如何取舍，仍需独立试验。[正式补充材料 §5、图 6](https://openaccess.thecvf.com/content/CVPR2026F/supplemental/Xu_OmniMotion-X_Versatile_Multimodal_CVPRF_2026_supplemental.pdf#page=6)
- **扩大模型怎样影响速度？** 补充表 2 的单位是秒／样例，越低越快。27.22M 参数的小模型为 2.14 秒，355.13M 参数的大模型为 3.00 秒，增加 0.86 秒。同表的 MDM 为 26.42M、0.65 秒。该表没有给出在线交互的首帧延迟。[正式补充材料表 2](https://openaccess.thecvf.com/content/CVPR2026F/supplemental/Xu_OmniMotion-X_Versatile_Multimodal_CVPRF_2026_supplemental.pdf#page=6)

### 关键发现

1. **真实前段让下一段更可预测，也收窄了可选动作。** 给定测试序列中真实的前段动作后，FID 从 5.040 降至 3.199，同一提示下的多样性从 1.696 降至 1.143。需要区分续写条件：逐段生成时递归使用模型自己的历史，可能积累误差；表 4 没有测量这种累积误差。[原表 4](https://arxiv.org/html/2510.19789v2#S3.T4)
2. **不同任务、不同身体部位的得失相反。** 共语动作的全身 FID 和面部误差改善，手部 FID 却更高；舞蹈的手部 FID 改善，全身 FID 却更高。作者提出训练分布更广可能影响 FID，这一解释尚缺单独的对照实验。表中也没有直接计量手势是否表达了某个具体词义，或脚是否正好踩中某个乐拍。[原表 6](https://arxiv.org/html/2510.19789v2#S5.T6)
3. **空间控制更准，但仍有偏差。** 相比 OmniControl，控制 L2 由 0.820 降至 0.424，滑步指标由 0.089 降至 0.004。两档失败率仍非零。如果任务要求手一定到达指定点，还要检查解码后的关节位置和容差。训练数据和文本编码器也随模型而变化，跨方法的分差无法全部归因于某个模块。[原表 5 与比较设置](https://arxiv.org/html/2510.19789v2#S5.SS2)

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **两种时间尺度让长动作可以分段改条件。** 主文图 1 画出连续五个片段：有的用文字和语音，有的用文字和路径，后面还能加入音乐。段间参考使运动有延续依据，段内条件则允许下一段改变任务。对交互系统而言，可以明确区分“沿用上一段怎么动”与“下一段收到什么新要求”。[主文图 1][fig1]
- **把空间条件开关做成了可观察的干预。** 固定文字、切换路径是否生效，使同一个结果中出现能对照的时段。若要迁移到讲话角色，值得照搬的是这个实验设计：固定语音，只在一个词的时窗启用手腕目标，分别量轨迹误差与节奏变化。后一个实验是延伸想法。[补充图 6][conflict]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **真实历史带来的增益尚不能直接外推到长时间自生成。** 测试中的真实前段不会累积模型误差。原表 4 的分数可以说明历史信息有用，要量化递归十段、二十段后的方向漂移或风格保持，还需要相应的长序列实验。[主文 §5.1–5.2][impl]
- **交互数据与显式场景控制有距离。** 数据集中有双人互动、人与物体或场景互动样例，模型却没有单独接收场景几何、物体状态或第二人的约束。图 4 中“坐下再站起”能检验动作外形；把角色放到新的椅子前，是否恰好坐中并保持接触，是另一项任务。[主文图 4][fig4] · [作者对局限的讨论][limits]
- **音频覆盖面仍需用任务指标来解释。** 一条面部误差或动作 FID 无法指出某个关键词是否配上了语义恰当的手势。若应用是讲解型数字人，重要的补测是同一只手同时受语音节奏、明确手势指令和目标位置约束时，各项要求的完成率。[原表 6][tab6]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **OmniMotion。** 这篇同名相近的研究从连续动作隐表示出发，用自回归规划和局部扩散生成动作。OmniMotion-X 的辨识点是片段级续写、显式全局关节条件，以及分阶段加入的多个条件前缀。查阅或引用时，两者的 arXiv 编号分别是 2510.14954 和 2510.19789。[OmniMotion 原文][omni] · [站内解读](/blog/arxiv2025-omnimotion/)
- **MotionCraft（AAAI 2025）。** 两者都覆盖文字、共语手势与舞蹈。MotionCraft 将音频控制接到文本训练得到的动作骨干；OmniMotion-X 把各路条件排进共享 Transformer 的输入序列。两者在同一张表里实测过，手部和全身的胜负随任务变化。[MotionCraft 原文][mc] · [本文表 6][tab6]
- **OmniControl。** 它用空间控制引导扩散采样，是本文全局控制的实测基线。比较时尤其要保留具体设置：表 5 测跨关节的密集控制，稀疏的单腕控制或逐时刻精确接触仍应各自报告误差。[OmniControl 论文][oc] · [本文 §5.2][results]
- **方法启发。** 如果系统要求“文本指定手势含义、语音决定出手时机”，可借鉴这里的分阶段训练和条件开关。要验证系统确实学到这种分工，可以固定音频替换指令，再固定指令改变重音，并分别检查动作含义、起始帧与目标误差。本文给出了做这种干预所需的接口思路。

<span id="reading-8" class="reading-anchor"></span>

## 来源

- 正式发表信息与主文。[CVPR 2026 Findings 记录][venue] · [会议终稿][pdf] · [可翻译的 arXiv v2 HTML][html]
- 编码器、条件冲突与速度实验。[正式补充材料][supp] · [较早版本的部分附录 HTML][oldapp]
- 模型与数据发布情况。[模型仓库][repo] · [数据仓库说明][datarepo] · [可见数据目录][data]
- 架构图依据原文重新绘制；表格整理自论文实验，未重新训练或运行模型。

</div>

[abs]: https://arxiv.org/abs/2510.19789v2
[venue]: https://openaccess.thecvf.com/content/CVPR2026F/html/Xu_OmniMotion-X_Versatile_Multimodal_Whole-Body_Motion_Generation_CVPRF_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2026F/papers/Xu_OmniMotion-X_Versatile_Multimodal_Whole-Body_Motion_Generation_CVPRF_2026_paper.pdf
[html]: https://arxiv.org/html/2510.19789v2
[supp]: https://openaccess.thecvf.com/content/CVPR2026F/supplemental/Xu_OmniMotion-X_Versatile_Multimodal_CVPRF_2026_supplemental.pdf
[conflict]: https://openaccess.thecvf.com/content/CVPR2026F/supplemental/Xu_OmniMotion-X_Versatile_Multimodal_CVPRF_2026_supplemental.pdf#page=6
[encoders]: https://openaccess.thecvf.com/content/CVPR2026F/supplemental/Xu_OmniMotion-X_Versatile_Multimodal_CVPRF_2026_supplemental.pdf#page=3
[archsupp]: https://openaccess.thecvf.com/content/CVPR2026F/supplemental/Xu_OmniMotion-X_Versatile_Multimodal_CVPRF_2026_supplemental.pdf#page=4
[masks]: https://openaccess.thecvf.com/content/CVPR2026F/supplemental/Xu_OmniMotion-X_Versatile_Multimodal_CVPRF_2026_supplemental.pdf#page=5
[capstats]: https://openaccess.thecvf.com/content/CVPR2026F/supplemental/Xu_OmniMotion-X_Versatile_Multimodal_CVPRF_2026_supplemental.pdf#page=2
[intro]: https://arxiv.org/html/2510.19789v2#S1
[fig1]: https://arxiv.org/pdf/2510.19789v2#page=1
[fig2]: https://arxiv.org/html/2510.19789v2#S3.F2
[fig3]: https://arxiv.org/html/2510.19789v2#S4.F3
[fig4]: https://arxiv.org/html/2510.19789v2#S4.F4
[tab2]: https://arxiv.org/html/2510.19789v2#S1.T2
[tab3]: https://arxiv.org/html/2510.19789v2#S3.T3
[tab5]: https://arxiv.org/html/2510.19789v2#S5.T5
[tab6]: https://arxiv.org/html/2510.19789v2#S5.T6
[tab7]: https://arxiv.org/html/2510.19789v2#S5.T7
[impl]: https://arxiv.org/html/2510.19789v2#S5.SS1
[dataset]: https://arxiv.org/html/2510.19789v2#S3
[model]: https://arxiv.org/html/2510.19789v2#S4.SS1
[progressive]: https://arxiv.org/html/2510.19789v2#S4.SS2
[results]: https://arxiv.org/html/2510.19789v2#S5.SS2
[limits]: https://arxiv.org/html/2510.19789v2#S6
[repo]: https://github.com/GuoweiXu368/OmniMotion-X/tree/22c6d50eb3ddf266acec6c5320e829c4b1f7c861
[data]: https://huggingface.co/datasets/DIG-UESTC/OmniMocap-X/tree/main/data
[datarepo]: https://github.com/GuoweiXu368/OmniMocap-X
[omni]: https://arxiv.org/html/2510.14954v1
[mc]: https://arxiv.org/html/2407.21136v3
[oc]: https://proceedings.iclr.cc/paper_files/paper/2024/hash/7827290f07f63485b849b66cfa3e5dd0-Abstract-Conference.html
[oldapp]: https://arxiv.org/html/2510.19789v1#Sx7
