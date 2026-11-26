---
title: "[Boson2026] Higgs Realtime Duplex：数字人怎样一边听你改口，一边说话和查资料？"
description: "解读 Boson AI 的 Higgs Realtime Duplex 技术发布。拆解 160 毫秒音视频分块、45B 前台模型、异步工具和人脸渲染，核对全双工与任务完成评测，区分公开报告、演示和可复现结果。"
pubDate: "2026-11-26T22:33:00+08:00"
badge: "Research Note"
tags: ["Higgs Realtime Duplex", "Boson AI", "全双工对话", "流式数字人", "多模态模型", "语音交互", "技术解读"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[Boson AI 官方技术文章（可翻译 HTML）][release] · [模型与训练][train] · [原始评测表][bench]

<details class="paper-meta"><summary>原文、发表状态与可复现范围</summary>

Boson AI 团队于 **2026 年 11 月 5 日**发布 *Higgs Realtime Duplex: Face to Face, Working in the Background*。截至 11 月 26 日，能与这套 **45B 全双工系统**对应的一手技术来源是这篇带有交互示意图、演示和评测表的网页。文章没有附论文 PDF、arXiv 编号或会议出处。本篇沿用论文解读的阅读结构，标题中的 Boson 标明发布机构。[作者原文][release]

发布页将 Duplex API 列为候补开放；文末另外链接了已可使用的 **Higgs Realtime**。在 Boson 的公开仓库和模型目录中尚未核实 Duplex 的权重、训练实现或可复现推理配置。下文的模型结构和跑分来自团队披露，本文未调用该模型。对话时间线是帮助读图的教学示例。[发布状态][access] · [Higgs Realtime 文档][previous] · [Boson 仓库][github] · [公开模型目录][hf]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

Higgs Realtime Duplex 让数字人说话时也能听见下一句话。做法是每 **160 毫秒**读入一小段新信息，生成下一段语音和面部表示，同时允许查资料或请更大的后台模型帮忙。这样，上一件事还在等结果，用户已经可以纠正它。[官方架构][threads] · [分块时间线][chunks]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　语音助手常按轮次工作：听完一句话，再转录、推理、合成回复。全双工对话把双方声音看成可以重叠的两条流，因而能够表达附和、犹豫和插话。Moshi 已演示如何联合建模两路语音；Boson 希望把视觉和需要等待的外部任务也放进交互过程。[Moshi 论文][moshi] · [Boson 设计目标][goals]

**现有痛点**　试想你让助手查一个数据，随即说“等等，我指上一张图”。如果系统查完资料才重新听你说话，它会基于过时的问题继续回答。如果旁人只是在房间里交谈，系统又不应听到声音便立刻抢答。[官方能力演示][demos] · [重叠语音评测论文][fdb]

**核心矛盾**　交谈需要在很短时间内做一个小决定，比如继续听还是说一声“嗯”。同一轮中的检索、工具调用和复杂推理却可能跨越好几秒。把这些工作排成一条必须依次完成的队列，就容易在对话中留下长时间的沉默。[前台与后台的分工][reason]

**本文目标**　让一个前台模型持续接收用户的声音与视觉线索，自主选择是否开口、停下或发起工具调用，并同步输出数字人的声音与脸。目标体验是可长时间使用的面对面对话，系统还要控制一直运行带来的开销。[官方概述][release]

**切入角度**　用流逝的物理时间组织上下文。说话、停顿、视频更新和工具返回都能对应到时间轴上的某个位置。即便无人讲话，这条时间轴仍推进，下一次用户开口或结果到达都能成为模型的新输入。[分块示意][chunks]

**核心 idea**　每一步先读最近发生了什么，再决定下一小段做什么。紧急的倾听与回应由前台处理，耗时任务异步返回。独立的语音和视频解码器把前台输出变成可听、可看的表演。[前台结构][threads] · [音视频解码][render]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

沿一次推理看有三条路径。**实时输入**包括用户音频、间隔到达的摄像头或屏幕画面，以及恰好返回的工具结果。**前台模型**持续跟踪对话，能在说话期间思考、直接调用工具或向更大的后台模型委派任务。**输出端**把语音表示和面部潜变量分别解码，声音由参考音频指定，脸由参考图指定。[多条并行流][threads] · [解码器][render]

<figure class="reading-figure"><a href="/paper-notes/higgs-realtime-duplex/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/higgs-realtime-duplex/architecture.svg" alt="用户声音和抽样画面进入 45B 前台模型，工具和后台结果异步回到后续输入。前台按时间块输出音频表示和面部潜变量，两个因果解码器结合参考音频及图像生成语音和脸部视频。" /></a><figcaption>依据 Boson 发布页重绘。看图时可跟踪两次不同的返回：工具结果送回前台，音视频解码结果则送给用户。点击可放大。</figcaption></figure>

### 关键设计

1. **给停顿也留一个时间位置。** 每块长 160 毫秒，模型读取刚到的一块，产生随后供播放的一块。静音仍占时间位置，因而“用户想了一下继续说”和“用户把话轮交给我”可以在后续上下文中形成不同轨迹。它也允许用户与助手同时出声。官方未给出 Duplex 从用户结束发声到用户端听到回复的实测中位数或 P95，因此不能用块长充当首响应延迟。[分块时间线][chunks] · [系统设计目标][goals]

2. **给不同信号分配不同带宽。** 音频每块进 1 个表示、出 2 个表示，分别相当于每秒 6.25 和 12.5 个。摄像头约每 6 块取一帧，一帧约占 12 个 token，折合约每 0.96 秒一次视觉输入。每块另输出 2 个面部潜变量。这里数的是进入或离开模型的表示，最终播放视频的帧率、分辨率及压缩损失仍需另测。[作者的 token 预算][budget]

3. **把结果送到“现在”，而不是等到下一轮。** 前台可自行持续推理，直接调用查询或业务工具，难题才委派给接收共享上下文的更大模型。一次工具调用的文字可以跨多个块生成，一份结果也可以分批送回。返回内容进入当下的输入块，作者没有为每块规定同一个文本 token 上限。用户如果改问别的，界面仍能继续听和说。[分块示例][chunks] · [调用与委派][reason]

4. **将“说什么”和“用谁的声音与脸来演”分给不同部件。** 前台每块送出 2 个音频表示与 2 个面部潜变量。因果流匹配语音解码器使用参考音频的条件向量合成声音；因果扩散 Transformer（DiT）使用一张参考脸和最近两个潜变量持续生成脸部画面。更换参考样本时，作者报告无需对该身份重新微调。发布材料没有公开身体关节轨迹、可编辑骨架或手臂动作输出接口。[声音与人脸解码][render]

### 一个完整例子

假设你与数字人共享一页销售图表。下表沿用官网“查询返回与用户插话重叠”的时间线，替换成讲解幻灯片的场景。例子说明数据路径，未把它计为作者实际测过的任务。[原始时间线][chunks]

| 时刻 | 前台新收到的信息 | 这一刻可以发生什么 |
|---|---|---|
| 你问“查一下蓝线为什么突然上升” | 持续进入的语音，外加最近抽取的一张共享屏幕画面 | 它可以先给简短的接话反馈，同时开始查找相关数据。 |
| 第一批数据返回 | 工具把已取得的部分结果放入后续输入块 | 它可以先说明查到的内容，剩余查询继续在后台运行。 |
| 你打断说“我是指去年的那一段” | 播放自身语音的同时，输入流出现新的用户讲话 | 它可以让出话轮，按修正后的时间范围重做计划。 |
| 后台返回详细解释 | 前台同时拥有较早发出的查询、用户的更正和新结果 | 合理的行为是先判断结果还是否适用，再继续讲。官网没有单独报告这种“旧结果晚到”情形的准确率。 |

这个例子里的屏幕提供视觉条件，脸部解码器负责数字人的表演。如果目标变成“准确用手指到折线的峰值”，系统还需要暴露图表坐标、角色骨架和指向控制，并测量落点。公开的脸部演示能验证的现象是音画协同，无法据此估计指向误差。[官方演示][demos] · [输出定义][render]

### 训练与推理

作者从已做文本预训练的模型开始，为 **45B 混合专家（MoE）前台**继续训练约 **2 万亿个文字、音频和视觉 token**，使用自建 NVIDIA H100 集群，训练栈部分基于 Megatron。45B 是前台公开的模型规模；激活参数、H100 数量、训练墙钟时间、GPU 小时与账单未公开。继续训练的数据量也不等于原始音视频时长。[模型与训练][train]

后训练包括两项做法。第一项从相同基座出发，用含 GRPO 在内的强化学习训练多个专职教师，分别改善自然交谈、交互行为、动态委派和任务完成，再以多教师 on-policy 蒸馏训练一个学生。第二项让智能体在模拟环境中经历插话、语音重叠、旁人交谈与噪声，复盘失败，合成有针对性的训练样本并再次训练。作者给出了流程，未给出针对 Duplex 的教师数量、奖励公式、混合权重或循环轮数。[后训练说明][train]

推理中，音视频合计约 **2.6k token/分钟**；算入经压缩的思考和工具文字，作者估计约 **2.6k–5k/分钟**。典型的最近五分钟窗口约 13k–25k token，较早历史另外以文字保留。这个预算解释了为何要降低视觉采样频率以及压缩过程记录。它没有给出每小时服务报价或推理设备吞吐。[上下文预算][budget]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

下表摘录 Boson 发布页主表，所有指标越高越好。TML 是 Thinking Machines Lab 的 Interaction Small。保留 GPT 或 Gemini 系列作为对照时，下表逐行标出所选配置，完整原表列有更多推理档位。不同系统的数据来自公开报告和排行榜，Boson 表示复核了超过一半的对比分数，未标明逐行复核清单。这里不把外部结果写成统一硬件上的全量重跑。[原始完整表][bench] · [TML 报告][tml]

| 评测与指标 | Higgs Realtime Duplex | TML Interaction Small | 另一项已列出的对照 |
|---|---:|---:|---|
| Big Bench Audio，准确率 | **98.9** | 96.5 | Gemini 3.8 Live，Extended Thinking High，98 |
| Audio MultiChallenge，APR | **44.9** | 43.4 | GPT RT-2，xHigh，48.5 |
| Full-Duplex-Bench v1.5，平均分 | **75.5** | 77.8 | GPT-Live-1，80.1 |
| QIVD，流式准确率 | **56.0** | 54.0 | GPT RT-2，xHigh，58.2 |
| ProactiveVideoQA，PAUC（ω＝0.5） | **31.9** | 33.5 | GPT RT-2，Minimal，25.0 |
| τ-Voice，单次任务完成率（%） | **69.8** | 未测 | GPT-Live-1，Astra medium，74.5 |
| IFEval，准确率 | **94.1** | 89.7 | GPT RT-2，xHigh，95.2 |

**75.5 衡量什么？** Full-Duplex-Bench v1.5 由 Guan-Ting Lin 等提出，发表于 ICASSP 2026。它区分四类同时说话的情境：用户真要打断、用户短暂附和、用户在与别人交谈，以及背景中有人说话。一个“只要听见声音就立即停”的助手在第一类可能表现好，却会在后三类频繁误停。基准论文分析停止与响应时间、行为类别和韵律；Boson 的表只列出本模型综合分 75.5，无法据此反推出每类成功率或延迟。[基准论文][fdb] · [Boson 原表][bench]

### 消融与补充对照

发布文没有报告移除单个系统组件的数值消融。能核实的是下列设计选择及其证据范围。[架构分工][reason] · [训练设计][train] · [评测表][bench]

| 设计问题 | 作者公开了什么 | 还缺哪组对照 |
|---|---|---|
| 为什么选 45B 的前台？ | 团队说试过更大的模型，得分更高、服务成本也更高。 | 相同训练与推理预算下，各种前台规模的性能、延迟和费用曲线。 |
| 让前台直接思考、调用工具有多少收益？ | 展示异步工具与委派流程，并与其他整体系统比较。 | 在同一个 Duplex 上关掉前台调用、强制每次委派，再测等候时间和任务完成率。 |
| 多教师蒸馏与模拟失败再训练各贡献多少？ | 披露教师任务及失败样本反馈流程。 | 保持训练数据量与评测协议一致，分别移除两项训练的结果。 |

### 关键发现

1. **口语问答、交谈时机、实际办事需要分开读。** Higgs 在 Big Bench Audio 得到 98.9，在全双工综合评测上低于同表的 TML 与 GPT-Live-1，τ-Voice 的一次任务完成率为 69.8%。即使语义答案正确，模型仍可能在错误时刻抢话，或最终没有完成请求。[原始评测][bench] · [全双工评测定义][fdb]
2. **流式理解也有两个问题。** QIVD 考察连续输入下的理解，ProactiveVideoQA 还要求在观看中选择何时回应。Higgs 在前者为 56.0、后者为 31.9。两个指标定义不同，数字之间不宜直接相减；从与同一 TML 基线分别比较，则可看到两项任务的排序发生了变化。[原始评测][bench]
3. **160 毫秒、约 200 毫秒、75.5 属于三种口径。** 160 毫秒是数据块长度，约 200 毫秒是发布文引用的人类接话现象，75.5 是全双工综合分。要判断用户实际等多久，需要测量从说话结束到首段回复被播放的时间，另测打断开始到助手停声的时间。Duplex 的公开表没有提供这两组时延分布。Boson 的前一代 Higgs Realtime 产品页标注约 700 毫秒语音输入至语音输出，归属的是另一个版本。[上一代产品页][oldproduct] · [设计目标][goals] · [时间线][chunks] · [原始评测][bench]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **最值得看的接口是工具如何返回。** 将部分结果作为新的输入事件，有助于助手边等边说。若它已经收到用户更正，旧工具结果即使晚到也不应自动抢占话轮。这一接口为研究“什么信息在什么时候可以影响对话”提供了具体切入点。[八步时间线][chunks]
- **音频与视觉可以运行在不同速率。** 约一秒才进一张相机帧，期间可以发生多次语音更新；输出端也由自己的解码器维持脸部连续。这同时揭示一个可检验的问题：若用户很快指了一下屏幕又移开，关键视觉事件有没有进入被采样的那张图？[作者预算图][budget] · [脸部解码][render]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **面部质量的证据主要来自演示。** 团队说明同表其他系统缺少相应功能，故未列出声音克隆或头像克隆指标。长会话的身份保持、快速表情转换、音唇同步误差以及零样本更换参考后的稳定性，需要专门的对照和测量。[解码器][render] · [评测范围][bench]
- **推理策略与成本很难独立核验。** 前台能委派给更大模型，但公开表没有给出每个基准的委派比例、后台型号、每次调用成本及禁用委派后的表现。报告的系统得分不能直接当作独立 45B 前台的能力。[委派机制][reason] · [结果][bench]
- **端到端验证仍依赖接入条件。** 发布文提供候补登记，旧款 Higgs Realtime 有独立文档与定价。将来若获得 Duplex 接口，可用同一句插话分别模拟真正更正、附和与旁人说话，记录停声时间、误停率以及恢复对话时是否还记得原任务。[官方开放状态][access] · [评测论文][fdb]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **Full-Duplex-Bench v1.5（ICASSP 2026）** 是这篇发布文背后可追到的正式评测论文。若关心“该不该停口”及其测量方法，可直接读它的四类重叠情境；论文描述的是基准及其作者评测的代理，与 Boson 自己的模型实现分别归属不同团队。[论文记录][fdb] · [可翻译的基准全文][fdbhtml]
- **DeepSeekMath（Shao 等）** 提出组相对策略优化 GRPO。在同一问题上采样多种输出，以组内奖励比较估计每种输出的相对优势。Boson 明确点名 GRPO 被用于训练专职教师。原算法论文可以解释这一步优化的含义，Duplex 教师的对话奖励与具体实现仍应以 Boson 将来披露的材料为准。[DeepSeekMath §4.1][grpo] · [Boson 后训练说明][train]
- **Thinking Machines Lab 的 Interaction Models** 是 Boson 点名的系统对照。两者都尝试在对话不中断的前提下处理后台工作。Boson 强调前台除了接待用户，还可以自己推理并直接调工具；对照两个团队的设计说明，比单看 MoE 总参数量更能理解这个差异。[TML 原文][tml] · [Boson 的对照说明][reason]
- **Moshi 与 BASE** 各提供一个参照。Moshi 适合追踪双方语音如何同时表示；BASE 把可替换对话后端发出的语音作为全身动作生成条件，还能把身体动画重定向到 VRM。Higgs Realtime Duplex 在共享时间轴上产生音频与脸部表示。若目标包含“边讲边用手指出图表”，BASE 可帮助理解身体驱动接口，而两项工作都还需要目标坐标与指向评测。[Moshi 论文][moshi] · [本站 BASE 解读][base] · [Boson 的输出定义][render]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- Boson AI 的原始发布、消息流和公开演示。[技术原文][release] · [能力展示][demos] · [分块时间线][chunks]
- 系统训练、渲染与七项基准。架构图依据文字和原图重绘，跑分保留作者的配置与口径。[模型与训练][train] · [因果解码][render] · [完整评测表][bench]
- 独立的基准论文、对照系统与旧版文档。[ICASSP 2026 基准论文][fdb] · [TML 技术文章][tml] · [Higgs Realtime 文档][previous]

</div>

[release]: https://www.boson.ai/blog/higgs-realtime-duplex
[goals]: https://www.boson.ai/blog/higgs-realtime-duplex#what-a-good-interaction-model-needs
[demos]: https://www.boson.ai/blog/higgs-realtime-duplex#capabilities
[threads]: https://www.boson.ai/blog/higgs-realtime-duplex#one-model-many-threads
[chunks]: https://www.boson.ai/blog/higgs-realtime-duplex#slice-time-not-turns
[reason]: https://www.boson.ai/blog/higgs-realtime-duplex#improving-intelligence-thinking-tool-calls-and-delegation
[budget]: https://www.boson.ai/blog/higgs-realtime-duplex#reducing-cost-a-tight-token-budget
[render]: https://www.boson.ai/blog/higgs-realtime-duplex#zero-shot-voice-and-face
[train]: https://www.boson.ai/blog/higgs-realtime-duplex#model-and-training
[bench]: https://www.boson.ai/blog/higgs-realtime-duplex#benchmarks
[access]: https://www.boson.ai/blog/higgs-realtime-duplex#try-it
[previous]: https://docs.boson.ai/models/higgs-realtime/overview
[github]: https://github.com/boson-ai
[hf]: https://huggingface.co/bosonai
[fdb]: https://arxiv.org/abs/2507.23159
[fdbhtml]: https://arxiv.org/html/2507.23159v4
[tml]: https://thinkingmachines.ai/blog/interaction-models/
[moshi]: https://arxiv.org/abs/2410.00037
[base]: /blog/arxiv2026-base/

[oldproduct]: https://www.boson.ai/higgs-realtime
[grpo]: https://arxiv.org/html/2402.03300v3#S4.SS1
