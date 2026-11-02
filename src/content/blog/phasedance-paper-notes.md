---
title: "[NeurIPS2026] PhaseDance：同样踩在拍上，为什么舞蹈的律动仍会不同？"
description: "会议摘要导读。用同一段八拍的两种跳法，解释局部踩拍与跨拍律动的区别，以及 15 项拉班指标与舞蹈文字描述的关系。"
pubDate: "2026-11-02T16:20:00+08:00"
badge: "Paper · 摘要导读"
tags: ["PhaseDance", "Music-to-Dance", "Motion-Phase", "Laban", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**阅读版本：NeurIPS 2026 官方摘要，2026 年 11 月 2 日复核。** 截至此次更新，会议条目仅链接到 OpenReview，共同作者 Soomin Park 的论文列表也尚未附原文。本次未取得可核对的正文。下文的八拍例子和概念图均为教学示意。[会议摘要][poster] · [作者论文列表][authorpub] · [OpenReview 入口][forum]

<details class="paper-meta"><summary>论文信息与出处</summary>

*PhaseDance: Capturing Rhythm and Expressivity in Dance Modeling*。作者为 KAIST 的 Meongeun Kim、Taehui Lee、Soomin Park 和 Sung-Hee Lee。Soomin Park 于 2026 年 9 月公布录用消息。NeurIPS 将其列入悉尼海报场次，条目编号 153947。[录用公告][authornews] · [官方会议条目][poster]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

两段舞都能做到每一拍落脚，但一段每四拍回到重心下沉的姿态，另一段把第二次下沉推迟了一拍，观众感受到的律动就可能不同。PhaseDance 提出在周期相位流形上表示舞蹈，研究动作周期如何呼应音乐周期；作者还用 15 项与音乐相关的拉班动作分析指标，为舞蹈的文字描述提供依据。[会议摘要][poster]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 音乐驱动舞蹈研究已经能把音乐拍点和动作中的节奏事件相比较。Bailando 就使用拍点对齐奖励来训练舞蹈生成器。这类设计能回答舞者有没有赶上某一拍。[Bailando 原论文][bailando]

**现有痛点：** 把每一步的落点对准鼓点，仍然没有解释一整组舞步怎样展开。舞者可以改变动作幅度、重音次序和准备时长，而单个拍点仍然全部对齐。[PhaseDance 的问题定义][poster]

**核心矛盾：** 拍点是时刻，律动则取决于多个时刻之间的组织。只记录“动了几次、是否准时”，会漏掉每一次动作在整组节奏中承担的作用。

**本文目标：** 作者希望在多种舞蹈任务中，用同一个相位条件框架描述音乐与身体之间的周期关系，并使表达品质可以通过文字描述。[会议摘要][poster]

**切入角度：** 把舞蹈看成具有近似音乐结构的信号。在重复出现的运动里，除了看动作发生的绝对时刻，还可比较它位于一个周期的哪个位置。这是本文对摘要中“周期相位流形”的直观解释。[会议摘要][poster]

**核心 idea：** 用相位条件处理节奏结构，用与音乐相关的拉班指标刻画动作在用力、形态和动态上的差别。前者关注“动作在这一轮走到哪一步”，后者帮助说清“这一步是怎样做出来的”。[会议摘要][poster]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

摘要明确了两条设计线索。节奏线把舞蹈表示在周期相位流形上，以音乐与运动的周期对应指导生成。表达线从拉班动作分析中得到 15 项与音乐相关的指标，用它们支持比舞种标签更细的文字描述。图中并排呈现两条线索；两者在实际网络中如何连接仍需全文核对。[会议摘要][poster]

<figure class="paper-figure"><a href="/paper-notes/phasedance/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/phasedance/architecture.svg" alt="PhaseDance 摘要概念图。相同拍点可对应不同的跨拍重音序列，周期相位与表达描述回答两个问题。" /></a><figcaption>依据会议摘要绘制的概念关系图。第一部分是教学用的八拍例子，条高表示示意动作强调程度。<a href="/paper-notes/phasedance/architecture.svg" target="_blank" rel="noopener">查看原图</a></figcaption></figure>

顺着图的 **01** 数落点，两段动作都在八个拍点发生。再比较高条的位置，只有 A 在两组四拍中的同一位置加强。**02** 说明相位表示为什么可能分辨这一差异。**03** 换一个问题：即使时间安排不变，如何描述动作轻重、形态与动态？这里的箭头表示摘要中能确认的概念关系。[会议摘要][poster]

### 关键设计

1. **让动作周期与音乐周期建立对应。** 摘要将音乐与动作的周期对齐作为建模目标，并提出相位条件框架。“相位”的教学直觉是给重复过程标记进度：两次动作都发生在整拍上，它们在四拍循环中的位置仍可能不同。摘要没有给出相位的维数、提取公式、定义在全身还是各部位，也未披露相位由谁监督。[会议摘要][poster]

2. **用运动品质给舞蹈描述提供依据。** 舞种标签可以概括整段舞，却难以描述同一名舞者的两次摆臂有什么差别。作者用 15 项与音乐相关、源自拉班动作分析的指标来支撑文字描述，并点出用力（effort）、形态（shape）和动态（dynamics）三个描述维度。摘要只交代了指标与文字的关系。要判断能否在生成时输入“第二次摆臂更舒展”，还需知道文字如何进入模型、哪些条件可由用户指定，以及生成的姿态是否呈现了这项变化。[会议摘要][poster]

### 一个完整例子：同样八次落脚，两段舞为什么听起来不同？

以下是教学例子。设音乐以四拍为一组，每组第一拍都有鼓声重音；舞者每拍都落脚一次。只改变舞者加重下沉的时刻。[问题依据][poster]

| 连续两组四拍 | 第 1–4 拍 | 第 5–8 拍 | 观察结果 |
|---|---|---|---|
| 音乐 | **1**、2、3、4 | **5**、6、7、8 | 重音每隔四拍回到组首 |
| 动作 A | 第 **1** 拍加重下沉 | 第 **5** 拍加重下沉 | 两次下沉分别落在两组的第一拍 |
| 动作 B | 第 **1** 拍加重下沉 | 第 **6** 拍加重下沉 | 第二次下沉仍在整拍上，却移到第二组的第二拍 |

如果只核对落脚有没有正中拍点，A 与 B 都是八次。比较下沉在每组的相对位置，就能指出第二组的差别。这个例子也解释了为什么重音改变不宜一律算错：编舞者可能有意错位。真正有意义的问题是，模型能否表达音乐和运动之间的这种关系，并在评价时识别出来。

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

作者在摘要里报告了两个方向的改善，但没有给出实验表。下表把两项主张分开，便于判断日后拿到全文时哪些结果最值得看。[官方摘要][poster]

| 研究问题 | 摘要报告了什么 | 全文中值得核对的证据 |
|---|---|---|
| 编舞能否更好地呼应音乐节奏？ | 作者报告生成编舞的节奏连贯性优于已有模型。 | 评价量能否区分上例的 A 与 B？若只统计落脚和最近拍点的距离，两种跳法的结果会相同。 |
| 模型能否更好地理解舞蹈的表达品质？ | 作者报告对舞蹈表达的理解更丰富，并说明文字描述以 15 项指标为依据。 | 评价的是文字能否描述已有动作，还是生成动作能否符合文字？两种任务需要不同的对照。 |

**消融。** 摘要没有列出移除相位条件或拉班指标的对照，也没有给出数据集、基线名称或分数。表中的 **15** 是指标个数，从中无法读出任何一项设计带来的增益。[官方摘要][poster]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **从检测事件推进到比较事件之间的关系。** 若两个落脚都对准鼓点，拍点距离无法解释它们在乐句中的不同作用。周期进度给出了另一种可比较的量。这也提示评测时应把单拍同步与跨拍节奏分别观察。[会议摘要][poster]
- **相同的时机可以有不同的表达。** 同样在第一拍完成摆臂，舞者可以紧促发力，也可以舒展手臂。相位描述时间组织，拉班描述帮助解释动作品质，两者处理不同层面的差异。[会议摘要][poster]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **周期表示对哪些动作有效？** 停顿、即兴错拍与突然变速可能有编舞意义。现有摘要不足以判断模型怎样处理周期中断、不同身体部位的不同节奏，或故意偏离音乐重音的动作。[会议摘要][poster]
- **从可描述到可控制仍有距离。** “表达更丰富”与“按要求让右臂在第六拍发力”是不同层级的目标。要判断后者，需要知道用户能输入哪些条件，并在生成姿态上测实际时刻、部位和动作幅度。[会议摘要][poster]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **Bailando（CVPR 2022）。** 它用编舞记忆组织离散舞蹈单元，再以拍点对齐奖励学习音乐与动作的同步。对读两篇时可以分别追问：一个动作事件离音乐拍点多远，多个动作的重复进度是否与音乐结构相呼应。这里比较研究问题，不作两篇之间的成绩排名。[Bailando 原论文][bailando] · [PhaseDance 摘要][poster]
- **DeepPhase（SIGGRAPH 2022）。** DeepPhase 从动作学习多维相位表示；PhaseDance 的摘要则明确把音乐与动作的周期关系放到舞蹈建模中。两篇共有“周期相位”的研究视角，现有材料尚不能据此推定 PhaseDance 复用了 DeepPhase 的具体自编码器。[DeepPhase 作者页面][deepphase] · [站内 DeepPhase 解读](/blog/siggraph2022-deepphase/)

<span id="reading-8" class="reading-anchor"></span>

## 来源

- 会议公布了摘要。该条目的资源栏只指向 OpenReview，会议节目数据没有为它列出单独的 PDF 地址。[官方海报条目及摘要][poster] · [会议节目数据][program]
- 共同作者 Soomin Park 的论文列表收录了本篇。此次复核时，作者网站的书目源将资料链接标为待补。[作者论文列表][authorpub] · [对应版本的书目源][authorbib]
- 供读者自行查看的入口。本次访问收到站点的浏览器验证页，未取得论文文件。[OpenReview 论文记录][forum] · [PDF 入口][pdf]

</div>

[poster]: https://neurips.cc/virtual/2026/poster/153947
[program]: https://neurips.cc/static/virtual/data/neurips-2026-orals-posters.json
[authorpub]: https://www.soominpark.xyz/publications/
[authornews]: https://www.soominpark.xyz/news/
[authorbib]: https://github.com/soomean/soomean.github.io/blob/9a8a23f21e0892e8a9ce9d87c0ff071dfe97eba2/_bibliography/papers.bib#L3-L10
[forum]: https://openreview.net/forum?id=HN7bfQQd3M
[pdf]: https://openreview.net/pdf?id=HN7bfQQd3M
[bailando]: https://openaccess.thecvf.com/content/CVPR2022/html/Siyao_Bailando_3D_Dance_Generation_by_Actor-Critic_GPT_With_Choreographic_Memory_CVPR_2022_paper.html
[deepphase]: https://www.ea.com/news/deepphase-periodic-autoencoders-learning-motion-phase-manifolds
