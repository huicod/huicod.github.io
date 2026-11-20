---
title: "[Eurographics2025] LabanLab：把拉班舞谱译成多轨动作，在网页上预演编舞"
description: "从四拍交替迈步、双臂侧举的实例，追踪舞谱符号如何经过语言翻译和多轨扩散变成动作，并逐项核对 10 名新手、2 名专家对自然度、舞步细节与 DASKEL 的评价。"
pubDate: "2026-11-20"
badge: "Paper"
tags: ["LabanLab", "Eurographics 2025", "Labanotation", "Choreography", "Dance Generation", "STMC", "Qwen-Max", "Timeline Control", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 全文][html] · [原文 PDF][pdf] · [会议记录与演示视频][eg] · [配对阅读：DASKEL][daskel]

<details class="paper-meta"><summary>论文信息与阅读范围 · Eurographics 2025 短文</summary>

*LabanLab: An Interactive Choreographical System with Labanotation-Motion Preview*。作者 Zhe Yan、Borou Yu、Zeyu Wang，单位为香港科技大学（广州）、加州大学圣塔芭芭拉分校和香港科技大学。论文收录于 *Eurographics 2025 – Short Papers*，共 4 页，DOI 为 10.2312/egs.20251046。下文核对会议版全文，图 5 的计数逐色读取，图 6 的事件时间按原图记录。会议公开了演示视频，作者实验室与会议条目未列出 LabanLab 完整代码；本文未运行系统。[会议记录][eg] · [实验室条目][lab] · [出版与许可记录][university]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

编舞者在网页谱面上写下“右、左、右、左，各向前迈一步”，LabanLab 先用 Qwen-Max 把四个支撑符号概括成“四步向前走”的腿部指令，再用多轨动作生成方法 STMC 配合手臂等其他轨道，合成可观看、可据此改谱的三维预览。论文中 **11/12** 位参与者认同其动作质量优于 DASKEL，但只有 **5/12** 认同它很好地还原了肢体角度、步幅等细节。[原文图 1][p1] · [图 5、6][p4]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 拉班舞谱从下往上读，能够同时记下好几个身体部位在做什么。内侧谱列区分支撑脚和腿部动作，外侧谱列记其他身体部位，符号在纵向占据的长度表示持续时间。这使编舞者可以把同一拍内各部位的配合写在一起。[原文图 2][p2]

**现有痛点：** 初学者可以学会拖放“向前”符号，却未必能想象放在右脚支撑列和放在右腿动作列分别会发生什么。传统数字编辑器能帮助排谱，作者希望写谱的人还能直接看到自己的选择如何影响动作。[引言与图 2][p2]

**核心矛盾：** 舞谱记录的是可辨认的事件，真人动作却包含符号省略的大量细节，比如两步之间躯干怎样保持平衡。规则可以解释每个符号的字面意思，数据驱动模型擅长生成过渡，但后者通常接收自然语言，也缺少可用于直接训练的配对舞谱。[研究背景][p2] · [后端设计][p3]

**本文目标：** 让编舞者设定节拍、编排多个身体部位、预演并修改动作，也让初学者通过预览学习舞谱。作者用包含新手和拉班记谱专家的交互研究，评价工作流程和动作观感。[原文第 3、4 节][p3]

**切入角度：** 已有生成器能够处理“哪段时间、哪个身体部位、做什么”这三类条件，谱面也包含这些信息。把谱面转换成生成器认识的多轨时间表，就能借用它已经学到的连续人体运动。[原文第 3.2 节][p3] · [STMC 原文][stmc]

**核心 idea：** 让程序先从符号位置和节拍设置读取部位与时间，再让语言模型参考相似的译例，结合前后动作，把离散符号归纳成自然的动作短语。动作生成与文字翻译各负责一步，编舞者能够把最终画面和原谱逐项对看。[原文第 3.3 节][p3] · [图 6][p4]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

前端是用 Vue.js 构建的舞谱编辑器，能把谱面按 JSON 保存、重新导入。点击生成后，Python／Flask 后端读取谱面，提取事件字段，调用 Qwen-Max 翻译，再把多轨描述交给 STMC。生成的三维动作回到网页；用户发现左右、先后或动作幅度不合意时，可以回谱面修改符号再预览。[原文图 1][p1] · [图 4 及第 3 节][p3]

<figure class="reading-figure"><a href="/paper-notes/labanlab/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/labanlab/architecture.svg" alt="从谱面输入、带时间和身体部位的符号事件，经示例检索和 Qwen-Max 翻译为多轨文字，再由 STMC 合成为三维动作，返回网页预览与改谱。" loading="lazy" /></a><figcaption>据原文图 1、4、6 和第 3 节整理。先看符号怎样取得部位与时间，再看哪些信息会在语言翻译中被合并。点击可放大。</figcaption></figure>

### 关键设计

1. **一张谱面同时充当时间轴和部位列表。** 用户选择小节数、每小节拍数、速度和每拍对应的音符时值，把方向或旋转符号拖入相应谱列。方向符号的形状表示方向，填充表示高、中、低；旋转符号另记旋向和角度。新符号默认持续一拍，拖动上下缘可调时长，最小单位是 **四分之一拍**。图 4 的示例设为两个 4/4 小节、每分钟 60 拍，在这组设置下四分之一拍等于 0.25 秒。[原文图 2、3][p2] · [原文图 4][p3]

2. **先留下可核对的事件记录。** 方向事件包含高度、方向、开始时间、结束时间和身体部位；旋转事件把前两项换成旋向和角度。前端的“右支撑”与“右腿动作”可在这一层区分。输出给 STMC 时，身体轨缩为腿、脊柱、头、左臂、右臂共五类，左右脚和承重方式若要保留，得由动作描述表达。[原文第 3.3 节][p3]

3. **把动作串译成短语，允许合并事件。** 作者建立“符号文字记录—自然语言描述”示例库，检索相关示例给 Qwen-Max 参考，温度设为 0.85。提示要求考虑前序动作、身体姿态和多部位协同。例如连续几条交替支撑记录放到一起，才能译成“向前走四步”。论文给出输入输出字段和译例，未报告示例库规模、检索准确率或每个字段的保持率。[原文第 3.2、3.3 节][p3] · [图 6][p4]

4. **让扩散模型补全连续动作。** STMC 使用动作短语、时间区间和身体部位作为条件，分别对文本所描述的片段去噪，再按身体区域和时间进行组合。因此同一时刻可以同时存在腿部行走轨和双臂侧举轨。左右脚的接触时刻、实际步长和手臂角度都可以在生成后测量；论文的系统没有报告用这些量反向校正误差的步骤。[原文第 3.2 节][p3] · [STMC 原文][stmc]

### 一个完整例子

原文图 6 给出了四拍向前走、两臂向侧方打开的例子。把图中两层文字并排读，可以看出语言模型究竟改了哪些信息。[原文图 6][p4]

<figure class="reading-figure"><a href="/paper-notes/labanlab/fulltext/assets/figure-6.png" target="_blank" rel="noopener"><img src="/paper-notes/labanlab/fulltext/assets/figure-6.png" alt="图 6 并列展示了原始谱面、六条符号记录、合并后的三条多轨描述，以及四拍预览姿态。" loading="lazy" /></a><figcaption>原文图 6。对照左侧两条手臂记录与译文中的起止时刻，可以找到偏差出现在哪个环节。© 2025 Yan、Yu、Wang，CC BY 4.0。</figcaption></figure>

| 身体部位 | 从谱面提取的事件 | 翻译后送入 STMC 的条件 |
| --- | --- | --- |
| 腿／支撑脚 | 右支撑 0–1 秒、左支撑 1–2 秒、右支撑 2–3 秒、左支撑 3–4 秒，方向均为中位向前 | 合为一条腿轨，在 0–4 秒向前走四步 |
| 左、右臂 | 两条记录分别让右臂向右、左臂向左，原图两行都标 0–1 秒 | 两臂侧举，左右臂各占一轨，原图两行都标 1–3 秒 |

合并腿轨保留了四步的总体意图，但交替支撑的每个一秒区间已无法从这条译文单独读回。手臂的例子更直接：原图前后的时间窗不一致，作者没有解释原因，不能据此推断模型总会这样改写。若一次预览看起来慢了一拍，先对照谱面记录与译文，再检查生成骨架何时抬臂，才能定位偏差出现在哪一步。[原文图 6][p4]

### 训练与推理

论文报告的实现复用了 Qwen-Max 和 STMC。检索到的谱面译例在生成时送入提示，使用者每次改谱后，后端重新翻译并合成动作。作者把收集专门的舞谱—舞蹈配对数据、按舞种微调 STMC 列为后续工作。由此看，评测覆盖的是这套组合后的预览系统，无法从问卷分数单独估计译例检索或扩散生成器的贡献。[第 3 节][p3] · [第 5 节][p4]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 用户实际做了什么？

研究招募 **12 人**，其中 10 名新手、2 名拉班记谱专家，年龄 22–30 岁。任务先让人观察一个符号如何驱动单一部位，再要求同时编排多个部位，最后填写七级量表并接受访谈。[原文第 4 节][p3] · [任务与问卷][p4]

| 阶段 | 原文给定时间 | 操作 |
| --- | ---: | --- |
| 介绍 | 5 分钟 | 了解拉班记谱基础和系统用法 |
| 单符号任务 | 5 分钟 | 拖入单个符号，为一个身体部位编动作 |
| 多部位任务 | 10 分钟 | 组合多个身体部位，编排更复杂的动作 |

### 哪些评价一致，哪些分歧最大？

图 5 按组给出七档评分和人数。下表将 **5–7 分合计为赞同**，据原图逐格相加。表内是人数；例如“2/2”表示两名专家都选择了赞同一侧。[原文图 5][p4]

<figure class="reading-figure"><a href="/paper-notes/labanlab/fulltext/assets/figure-5.png" target="_blank" rel="noopener"><img src="/paper-notes/labanlab/fulltext/assets/figure-5.png" alt="原文图 5 的七道问卷题，分别列出十名新手和两名专家在七档评分中的人数分布。" loading="lazy" /></a><figcaption>原文图 5。颜色从橙到蓝表示从不同意到同意，色块内是该档人数。© 2025 Yan、Yu、Wang，CC BY 4.0。</figcaption></figure>

| 评价陈述（按原题意译） | 新手赞同 | 专家赞同 | 合计 |
| --- | ---: | ---: | ---: |
| Q1 界面布局合理、易于操作 | 10/10 | 2/2 | 12/12 |
| Q2 系统功能容易理解和掌握 | 9/10 | 2/2 | 11/12 |
| Q3 动作自然、流畅 | 7/10 | 2/2 | 9/12 |
| Q4 动作与自己想通过舞谱表达的意图相符 | 8/10 | 2/2 | 10/12 |
| Q5 肢体角度、步幅等细节还原得好 | 5/10 | 0/2 | 5/12 |
| Q6 系统适用于不同类型的舞步 | 2/10 | 1/2 | 3/12 |
| Q7 LabanLab 的动作质量优于 DASKEL | 9/10 | 2/2 | 11/12 |

参与者对一般意图匹配（10/12）与具体细节还原（5/12）的判断相差明显。两名专家在 Q5 上分别给了低于中点和中点的评分。Q7 是对两套系统整体动作质量的主观判断，原文没有交代盲评、配对刺激的构造或逐事件真值，也没有提供步数、接触、关节角度等误差。[原文图 5 与访谈][p4]

### 消融与失败例

论文没有拆除示例检索、改用逐条字典翻译或替换 STMC 的模块消融。访谈与作者讨论记录了更具体的失败现象：部分动作成分缺失或与指令不符，舞蹈的艺术性和精细动作不足。作者推测这与 HumanML3D 以日常动作为主、文本标注粒度粗于舞谱译文有关；文中没有更换数据集来检验该解释。[原文第 5 节][p4]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **抽象层次会影响生成器听懂什么。** “向前走四步”给了文本动作模型一个熟悉的行为概念，比四条孤立的支撑记录更容易表达连贯行走。代价也清楚：独立指定右脚在某拍承重的能力，在翻译合并后减弱了。图 6 把这笔交换放在同一幅图里。[原文图 6][p4]
- **交互预览的价值可以和动作精度分开评价。** 全部参与者认同界面布局易于操作，只有五人认同角度和步幅细节还原得好。对教初学者理解“符号和可见动作怎样关联”，第一项有价值；对要精确复排专业舞段的人，第二项更值得看。[原文图 5][p4]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **谱面能写多细，和动画能做到多准，是两个可测的问题。** 用户能把边界调到四分之一拍；论文展示的生成结果是若干拍上的画面，未给逐关节起止时间、落脚点或接触误差。作者提出加入节拍计数器，便于暂停并对照动作与谱面。[原文第 3.1 节][p3] · [原文第 5 节][p4]
- **符号和动作先验共同限制舞种覆盖。** 系统聚焦基本方向、旋转等符号，专业舞种需要的细节更丰富。作者建议拓展词汇、按舞种建立配对数据并微调生成模型。这些是后续设想，本次研究展示的是通用动作模型上的预览。[原文第 5 节][p4]
- **对于创作效率和生成速度，现有证据是初步的。** 文章描述点击后数秒出现预览；没有给出硬件、延迟分布或同一编舞者使用不同编辑器所需时间。两名专家的访谈可以指出问题，尚难代表不同舞种和工作流程。[原文第 3.1 节][p3] · [用户研究][p4]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **DASKEL（Pacific Graphics 2023）。** 它把舞谱和骨架关键姿态放在可双向转换的编辑流程里。LabanLab 改从舞谱出发，借助语言和生成模型补足连续表演；两者在问卷里比较的是最终动作观感。若关心“改完某个关节，舞谱上的哪个符号会随之改变”，更适合先看 DASKEL。[DASKEL 解读][daskel] · [DASKEL 会议论文][daskel-doi]
- **STMC。** 想理解“下身走路、上身举臂”为何能同时生成，可从 STMC 的分部位、分时间组合去噪读起。LabanLab 的新工作主要在 STMC 之前，即让编舞者用熟悉的舞谱构造它需要的条件。[STMC 解读][stmc-note] · [STMC 全文][stmc]
- **CVPR 2026 的 LaMoGen。** 对比两者时，先确定谁提供最早的动作计划。LabanLab 从人写的谱面出发，再把符号变成语言条件；LaMoGen 从文字出发，让模型编写中间动作谱，再解码回人体动作。两条路线把可编辑、可检查的位置放在不同阶段。[CVPR 2026 LaMoGen 解读][lamogen]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 会议版全文、作者、卷册、DOI 及补充演示。[Eurographics 正式条目][eg] · [原文 PDF][pdf] · [可翻译的 HTML 全文][html]
- 论文单独出版记录和开放许可。[作者实验室条目][lab] · [香港科技大学记录][university]
- 上游多轨合成方法与前作。[STMC 原文][stmc] · [DASKEL 原文][daskel-doi]

</div>

[html]: /paper-notes/labanlab/fulltext/
[eg]: https://diglib.eg.org/items/0c8f6ddd-d97d-4d00-85df-d9786924979a
[pdf]: https://cislab.hkust-gz.edu.cn/media/documents/LabanLab.pdf
[p1]: /paper-notes/labanlab/fulltext/#page-1
[p2]: /paper-notes/labanlab/fulltext/#page-2
[p3]: /paper-notes/labanlab/fulltext/#page-3
[p4]: /paper-notes/labanlab/fulltext/#page-4
[university]: https://researchportal.hkust.edu.hk/en/publications/labanlab-an-interactive-choreographical-system-with-labanotation-/
[lab]: https://cislab.hkust-gz.edu.cn/publications/labanlab-an-interactive-choreographical-system-with-labanotation-motion-preview/
[daskel]: /blog/pacificgraphics2023-daskel/
[daskel-doi]: https://doi.org/10.2312/pg.20231269
[stmc]: https://arxiv.org/html/2401.08559v2
[stmc-note]: /blog/cvprw2024-stmc/
[lamogen]: /blog/cvpr2026-lamogen/
