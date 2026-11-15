---
title: "[IJCNN2025] KETA：用运动学短语对齐动作细节，再指导扩散生成"
description: "解读KETA如何用GPT拆分动作描述、Gaussian时间权重对齐Kinematic Phrases，并用可微运动学损失改善MDM；核对两种生成骨干、原始实验、细粒度消融和公开代码的反馈接线边界。"
pubDate: "2026-11-15T12:10:00+08:00"
updatedDate: "2026-11-15"
badge: "Paper"
tags: ["KETA", "Kinematic-Phrases", "Text-to-Motion", "Motion-Alignment", "Diffusion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

完整英文阅读：[arXiv HTML，可使用翻译插件][html] · [7页原文PDF][paper] · [作者项目页][project] · [公开代码][code]。

<details class="paper-meta"><summary>论文信息与阅读范围 · IJCNN 2025 · 文本—运动学细粒度对齐</summary>

论文：*KETA: Kinematic-Phrases-Enhanced Text-to-Motion Generation via Fine-grained Alignment*。作者：**Yu Jiang、Yixing Chen、Xingyang Li**，上海交通大学致远学院，三位共同一作。研究方向为文本生成动作、运动学表示和时间对齐。

阅读版本为 **arXiv:2501.15058v1，2025-01-25，共7页**，覆盖正文、原图1–5和表I–II；该版本没有附录。本页按这份可获取全文解释方法与实验，不假定录用后论文有同样的全部细节。[原文][paper]

**发表状态更新（2026-11-15）：** 作者Xingyang Li的主页已在2025年4月记录KETA获 **IJCNN 2025** 录用，作者Yixing Chen的论文列表也将其列为IJCNN 2025。项目页仍保留“Submitted to IJCNN 2025”，与更新后的作者消息存在时间差；不能仅凭项目页旧字样将其继续归为尚未录用的预印本。本次未取得IEEE最终出版DOI，因此这里确认的是作者公布的录用状态，全文分析仍采用上述arXiv版本。[作者主页][author]、[另一作者的论文列表][authorpublications]

本次核对公开代码版本为 [a42bdf9，2025-01-31][codeversion]，早于作者公布录用的2025年4月；这份公开快照不代表未公开的最终实验实现。已检查训练、对齐损失和采样相关路径，**未下载权重、未运行训练或动作生成**；论文描述的逐步反馈机制与已核实的公开采样路径须区分，详见方法与局限。

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

KETA把一句复杂动作要求拆成有顺序的短描述，用**可计算的运动学短语KP**判断各时段的动作是否贴合这些描述，再把这个对齐目标加入MDM训练；论文还提出将当前动作与描述的差异送回扩散模型，逐步改善生成。[§III][html]

与KP原论文相比，重点从“建立可解释的运动学表示和评测”转向“**利用这一表示监督文本动作生成**”。LLM输出的是短句，连续动作仍由扩散模型产生，并没有一条必须先生成离散KP计划再解码的链路。

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 文本动作扩散模型已能根据自然语言生成较自然的人体运动。典型做法是将整句描述编码成条件，再让模型从噪声恢复动作；KP工作则提供了一套从关节运动自动抽取的运动学事实，用来连接连续动作与可读的动作描述。

**现有痛点：** “向前走，蹲下用双手拾取，站起后继续走”包含多个动作及其先后关系。生成结果可能看起来合理，却漏掉开头走路、结尾继续走，或把“倒着跑”生成成向前跑。整段相似并不意味着每个局部要求均被实现。[图5][paper]

**核心矛盾：** 输入是抽象、压缩的语言，输出是逐帧连续运动；短句所描述的运动学事实又只在某个时间范围内成立。若只将整句和整段动作对齐，局部错误可能被其他正确内容掩盖。

**本文目标：** 建立“短句—动作局部时段”的对应，让生成训练能感知空间方向与动作先后上的偏差，并探索在生成过程中利用这些偏差继续修正动作。

**切入角度：** 借用KP的运动学抽象：既不要求用户填写全部关节坐标，也不只比较黑盒整体语义向量。先从动作计算相对位置、距离变化等事实，再学习文字与这些事实之间的联系。

**核心 idea：** GPT-4o-mini拆句，Llama 3.1编码短句；对齐模型给每个短句分配随时间变化的Gaussian权重，并将其文字特征与相应加权KP拉近。生成端使用平滑KP把误差反传给MDM；decoder方案进一步引入差异引导token。[§III-B–D][html]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先用成对文字和真实动作训练 **Text–KP Alignment（AA）**：文字分解后投影到KP维度，动作经规则提取KP，再学习每个短句在时间轴上的权重。接着利用训练好的AA监督MDM的干净动作预测。论文区分两种版本：**encoder骨干主要增加对齐损失；decoder骨干还接入分解文本及差异引导token**。[图3、§III-A–D][html]

<figure class="reading-figure"><a href="/paper-notes/keta/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/keta/architecture.svg" alt="KETA完整架构：GPT拆句和Llama编码、文本KP对齐模型预训练、平滑KP损失监督MDM，以及论文提出的decoder差异反馈；特别区分论文反馈设计与公开采样接线核查" loading="lazy" /></a><figcaption>依据原图2–3、§III及公开代码教学重绘，非作者原图或运行结果。A为对齐预训练，B为生成训练，C为论文的decoder采样机制；紫色虚线反馈尚未在所核查的公开采样路径中形成完整闭环。点击查看大图。</figcaption></figure>

先沿A理解两个模态如何进入同一KP维度，再看B中误差如何回到动作生成器，最后读C的采样流程。蓝色为主要网络模块，灰色为固定输入或复用环节，绿色为动作结果；实线表示已描述的数据流，紫色虚线专门标记论文提出的反馈。这里没有VQ码本，也没有把Gaussian时间窗当成用户指定的精确事件边界。

### 关键设计

1. **文本分解：先显式展开先后关系，再进行动作对齐。**

   GPT-4o-mini将输入描述分解成 **3至20个短句**，提示它关注“然后”“两次”“再次”等顺序与重复标记，并展开初始状态、中间动作和最终状态。Llama 3.1再将这些短句编码成特征。[§III-B、§IV-A][html]

   图3以“用左腿踢东西”为例，分解结果涉及直立、重心转移至右腿、抬左腿、左腿踢出和结束状态。这里的“分解”既包含原句信息，也可能补全合理但未明确写出的过程；不能把LLM补全的每一步都当成动作数据中的真实标签。

   **LLM没有直接输出逐帧骨架，也没有输出逐帧KP真值。** 它提供的是语言序列，短句对应何时、对应怎样的运动学量，仍由后续对齐与生成模型学习。

2. **可微KP：保留运动学方向信息，让生成误差可以反传。**

   KP从关节序列计算规则函数，例如某关节相对于参考方向的位置、关节之间距离的变化。原KP将结果取符号，得到−1、0、1；KETA把用于训练的符号操作换成tanh，得到连续平滑值。[§III-C][html]

   <div class="equation">原KP：K<sub>t,k</sub> = sign(f<sub>k</sub>(X)<sub>t</sub>)；KETA平滑形式：K̃<sub>t,k</sub> = tanh(f<sub>k</sub>(X)<sub>t</sub>)。</div>

   这里t是帧，k是运动学短语通道，f是相应的几何或时序计算；上式以统一索引改写原文未编号公式。sign会阻断有效梯度，tanh让生成动作改变时，对齐误差能传到生成模型。公开提取器仍将参考坐标系计算置于不求梯度区域，因此不能把它说成所有几何运算均完整可微。它仍然是运动学代理：某些位置和速度关系吻合，不等于物理接触、平衡或任务完成已被验证。[KP提取实现][kpcode]

3. **Gaussian时间域：为每个短句计算局部KP，而不是压成一个全局平均。**

   一个短句未必贯穿整段动作。AA的两层MLP把文字特征投影到KP维度；另一条Transformer decoder分支结合文字和KP，预测该短句的时间权重。原文采用Gaussian形式，使短句在中心时段影响强，在两端逐渐减弱。[图3(a)(b)、§III-C][html]

   <div class="equation">q<sub>i</sub> = MLP(e<sub>i</sub>)；Ω<sub>i</sub> = ∑<sub>t ∈ domain(i)</sub> w<sub>i,t</sub>K<sub>t</sub>；L<sub>align</sub> = ∑<sub>i</sub> ‖Ω<sub>i</sub> − q<sub>i</sub>‖²。</div>

   e是短句嵌入，q是文字在KP空间中的预测，Ω是根据当前动作加权汇总的KP。训练使“文字预计的运动学属性”与“局部动作实际提供的运动学属性”接近；权重是学习结果，不是预先标注的短句起止时间。

   为避免所有短句的权重收敛到相似位置，论文依据**句子序号、短句总数和动作总长度**给出可行窗口，限制每个Gaussian的位置。窗口存在重叠，允许相邻动作过渡；这种按顺序安排的软对齐没有证明每个动作必须在精确时刻完成，也没有解决任意并行动作的时间编排。

4. **训练时增加运动学对齐损失，连续动作仍由MDM直接预测。**

   MDM接收噪声动作、扩散时间步和文本条件，预测干净动作。公开实现使用HumanML3D的263维逐帧动作特征，先将预测去归一化、恢复22个关节，再计算平滑KP，由AA计算与文字的误差。生成训练在原动作目标上增加加权对齐项：[§III-A、§IV-A][html]、[动作恢复与损失实现][diffusioncode]

   <div class="equation">L<sub>generator</sub> = L<sub>MDM</sub> + λ<sub>KP</sub>L<sub>align</sub>，λ<sub>KP</sub> = 0.0001。</div>

   这是便于说明的总目标写法。公开代码将已载入的AA参数冻结，但保留经过AA回到预测动作的梯度路径；因而“固定评分器”仍能监督可训练生成器。**它没有在采样后把关节硬投影到指定坐标，也没有一个必然满足全部文本条件的约束求解器。** [生成损失与AA加载代码][diffusioncode]

5. **decoder差异反馈：将“目前哪里不符合描述”送回生成过程。**

   论文的decoder方案读取分解后的文字，另外以当前动作的加权KP与文字KP特征之间的差异构造引导token。每次预测干净动作后，再按递减的扩散时间步加噪、继续去噪，差异信号用于提示后续修正。[§III-D][html]

   这里的反馈是连续特征，不是LLM重新写一份动作脚本；论文也没有证明该误差每轮严格下降。应将其理解为**学习式修正信号**，而不是具有收敛保证的约束优化。

   **公开实现边界：** 核查版本的MDM能读取`guide_token`，但自动计算该token的代码位于训练损失路径，所核查的采样循环没有同样的逐步生成与回填；相关开关默认关闭。因此本页将反馈环标为论文机制，不能说已经根据公开入口复现了完整闭环。[MDM实现][mdmcode]、[扩散实现][diffusioncode]

### 一个完整例子

沿用原图5的复合指令：**“向前走，然后蹲下用双手拾取，站起来，再继续走。”** 以下模块过程是依据方法整理的教学解释，具体短句和时间权重不是本次运行得到的结果。

1. **语言端展开过程：** 文本分解得到行走、蹲下/双手拾取、站起、恢复行走等局部描述；Llama编码，再由MLP得到相应KP空间目标。
2. **时间端安排对应：** 每个局部描述在自己的可行窗口内获得Gaussian权重。第一段应主要解释动作前部，最后一段主要解释后部，过渡处可以共同起作用。
3. **训练端检查预测：** 若预测动作始终蹲着，局部KP与“最初行走”“最后重新行走”的文字特征可能不一致，对齐项会向生成器提供误差；真实效果取决于AA学到的对应关系。
4. **生成端产生连续动作：** MDM逐步预测骨架运动。论文的decoder方案还希望将KP差异作为后续引导；公开代码的这一闭环完整性仍需补充验证。

原图5报告KETA在该例四个短句上的对齐余弦相似度为 **0.996、0.997、0.959、0.984**，MDM为 **0.788、0.801、0.902、0.145**；“倒着跑”例分别为0.9789与0.5141。这些分数来自作者自己的AA，属于两个示例的内部诊断，不能当成独立的人类评测或全测试集事件成功率。[图5、§IV-C][paper]

### 训练与推理

**数据与阶段：** 论文在HumanML3D上评估，报告14,646段动作、44,970条描述。先准备文本分解与动作KP、训练AA，再用运动学对齐目标训练MDM。公开实现加载并冻结AA，生成模型仍需训练；这不是在任意已有模型上直接添加提示词即可使用的方法。[§IV-A][html]、[代码][diffusioncode]

**训练成本：** 原文披露MDM增强模型训练 **1张NVIDIA A100、约4天、1,500 epochs**。若按单卡连续4天换算，约为96 GPU小时，但这只是时长换算；原文没有分别报告AA预训练、文字特征提取、GPT调用费用及多次实验总成本，也没有提供可直接推算总账单的完整记录。

**推理输入输出：** 用户给自然语言描述，语言端得到模型条件；扩散端从噪声生成连续人体动作。encoder与decoder的条件和反馈能力不同，不能把论文decoder路径的功能自动归到encoder版本。动作总长度参与时间域计算，短句窗口并不意味着模型自动发现了每个动作的精确持续时间。

**配置阅读提醒：** 原文未完整给出Llama型号大小、全部对齐器超参数、生成耗时与采样配置；本文的两层MLP和λ=0.0001均按论文记载，公开仓库默认配置与之存在差异。原文MDM引用条目实际指向MotionDiffuse，不能据此混同两者。此处依据正文结构及作者仓库解释MDM链路，不替论文补造缺失配置。

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**HumanML3D，原表I全部行。** R-Precision越高越好，FID越低越好，Diversity越接近真实数据9.503越好；原表只写R-Precision，没有标明Top-k，且未给误差区间，以下保留原表口径。[§IV-A–B、表I][paper]

| 方法 | R-Precision ↑ | FID ↓ | Diversity → 9.503 |
|---|---:|---:|---:|
| Real | 0.797 | 0.002 | 9.503 |
| MDM encoder | 0.611 | 0.544 | 9.559 |
| MDM decoder | 0.621 | 0.567 | 9.425 |
| MAA | 0.675 | 0.774 | 8.230 |
| OMG | **0.784** | 0.381 | 9.657 |
| KETA encoder | 0.728 | 0.279 | **9.487** |
| KETA decoder | 0.737 | **0.242** | 9.605 |

表中加粗只在生成方法之间比较。KETA作者未逐一说明MAA、OMG等基线数值是自行重跑还是引用；不能将这张表解释为已完整统一训练数据、计算预算和评测实现后的重新比较。

### 消融实验

**整句对齐与细粒度对齐，原表II全部行。** 对比在encoder骨干上加入整段KP—整句对齐，或使用本文的细粒度对齐。[§IV-D、表II][paper]

| 方案 | R-Precision ↑ | FID ↓ | Diversity → 9.503 |
|---|---:|---:|---:|
| Real | 0.797 | 0.002 | 9.503 |
| KETA encoder：fine-grained align | **0.728** | 0.279 | **9.487** |
| KETA encoder：full align | 0.707 | **0.264** | 9.536 |

**细粒度对齐：** 从整句改为局部对齐后，R-Precision由0.707升至0.728；Diversity与真实值的绝对差由0.033缩小到0.016，但FID由0.264变为0.279，出现小幅退步。

**消融覆盖范围：** 原文没有给出单独移除GPT拆句、可行窗口、tanh平滑或decoder引导token的定量表，也没有迭代轮数—效果—耗时曲线。encoder与decoder主表差异同时涉及骨干和条件方式，不能直接归因为某一个反馈模块。

### 关键发现

1. **相对同类MDM，提升幅度清楚。** encoder的R-Precision从0.611到0.728，FID从0.544到0.279；decoder对应从0.621到0.737、从0.567到0.242。后者FID降低约57.3%，旧值/新值约2.34。
2. **“细粒度更好”需要指出是哪项指标。** 它改善文字匹配和Diversity，但整句对齐的FID略优。不能把表II概括成所有指标全面胜出。
3. **没有超过OMG的文字匹配。** OMG的R-Precision为0.784，仍高于KETA decoder的0.737；KETA的优势主要体现在该表FID。Diversity则是KETA encoder最佳，decoder并非最佳。
4. **原文倍率存在算术小误差。** 文中说encoder的FID改善1.99倍；按表I的0.544/0.279计算约为1.95。此处以表格原数为准，不沿用摘要或项目页中的近似宣传数字。
5. **代理指标尚未完成精细控制验收。** 主实验没有直接统计“左右方向正确率”“重复次数”“每个事件是否按时完成”。图5能解释局部差异，但不足以证明任意复杂指令均得到精确执行。

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **给生成器增加可解释的检查对象：** 不只看最终动作是否像训练数据，还检查它在运动学层面是否接近文字要求。问题诊断可以细到某一短句、某一时段。
- **通过平滑连接规则与神经训练：** KP本来是离散符号，tanh替代将其变成可微辅助目标，展示了一种把规则提取器用于生成训练的路径。
- **将语义分解和时间对齐分开：** LLM负责把语言说清楚，AA负责在动作时间轴上建立对应，连续动作由MDM产生；三个模块的职责较易追踪。
- **保留整句对齐作为对照：** 表II说明改善并不只是“额外加一个损失”这么简单，同时也真实呈现局部语义收益与FID之间的取舍。

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **KP描述运动学，不覆盖全部行为意义。** 相同关节运动可以对应不同意图；双手靠近物体的描述也不等于物体已被握持。本文没有环境物体状态和动力学求解器，不能据“physical”措辞推导出接触或物理稳定性保证。
- **时间域来自顺序先验与学习权重。** Gaussian适合强调一个局部活动区间，但复杂重复、跨段依赖、同时动作如何处理尚缺专门实验证据。将其扩展为可编辑事件时间轴，是研究方向而非已提供功能。
- **分解可能加入错误前提。** LLM为简短指令补全初始和中间状态，可能压缩动作多样性，或给不适合的动作强加某一种执行方式。本文没有系统报告拆句错误率。
- **对齐器本身也可能偏差。** 如果文字与局部KP的学习对应不正确，生成器可能优化一个不准确的代理目标；用同一AA再评价生成例子，独立性也有限。
- **反馈收益和实现尚需独立验证。** 论文缺少decoder反馈token的单因素消融；公开代码的训练接口与采样闭环并未完全对应。本次仅静态核查，不将其当成复现成功。
- **覆盖任务与成本报告较窄。** 定量实验集中在HumanML3D文本动作生成，没有语音、音乐、交互目标控制或实时延迟测试；不能直接视为可上线的实时角色控制器。

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **[Kinematic Phrases（KP）][kp]（ECCV 2024）：** 提供可自动提取的运动学短语与白盒评测。KETA直接借用其表示思想，但主要贡献是学习短句与局部KP的对应，并用该对应训练扩散生成器；两者不是同一模型的新旧名称。
- **[Human Motion Diffusion Model（MDM）][mdm]：** 提供从噪声预测干净动作的生成骨干。KETA增加文本分解和运动学对齐，encoder与decoder使用方式不同；原文参考文献误指MotionDiffuse，不改变这项结构上的区分。
- **[TEACH][teach]：** 关注多个动作的时间组合。KETA更强调在一个扩散生成过程中，用局部运动学表示监督文字对应；它没有仅凭Gaussian权重就获得任意长动作拼接的保证。
- **[CoMo][como]：** 以语言指导可解释姿态代码编辑。KETA的KP更多用作对齐目标与差异反馈，其用户入口依旧是文字；公开流程没有展示用户直接编辑每个KP通道即可精确生成动作的能力。
- **启发：** 对可控动作系统，可以把“语言分解—运动学检查—连续生成”作为可组合的三个环节。若目标是明确接触、指定目标和按时完成动作，还需另设事件判定及环境状态检查，并在最终解码动作上验证，不能只看对齐损失变小。

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **原论文：** [arXiv:2501.15058v1 HTML][html]、[完整PDF][paper]，2025-01-25，7页。方法依据§III和图2–3；实验依据§IV、图5、表I–II；全文无附录。
- **发表与项目：** [作者主页][author]、[另一作者的论文列表][authorpublications]、[作者项目页][project]。两位作者确认IJCNN 2025录用；项目页的投稿字样较旧。本次未取得IEEE最终出版DOI，本页更新日期为2026-11-15。
- **公开实现：** [仓库][code]、[固定版本a42bdf9][codeversion]；重点核查[MDM前向][mdmcode]与[扩散训练/采样及KP损失][diffusioncode]。静态代码分析，不代表模型运行或原表复现。
- **相关原始来源：** [KP][kp]、[MDM][mdm]、[TEACH][teach]、[CoMo][como]。
- **图与表：** 架构图为本站教学重绘；两张结果表按原表I–II完整录入，保留指标口径和不利结果。原文数字、公开实现与本文推论已分别说明。

[html]: https://arxiv.org/html/2501.15058v1
[paper]: https://arxiv.org/pdf/2501.15058v1
[project]: https://polarisdane.github.io/KETA/
[author]: https://xingyangli.com/
[authorpublications]: https://polarisdane.github.io/publications/
[code]: https://github.com/PolarisDane/KETA/tree/main
[codeversion]: https://github.com/PolarisDane/KETA/tree/a42bdf9ef7063ae47724f493d671df63816b2234
[mdmcode]: https://github.com/PolarisDane/KETA/blob/a42bdf9ef7063ae47724f493d671df63816b2234/text_2_motion/model/mdm.py#L204-L220
[diffusioncode]: https://github.com/PolarisDane/KETA/blob/a42bdf9ef7063ae47724f493d671df63816b2234/text_2_motion/diffusion/gaussian_diffusion.py
[kpcode]: https://github.com/PolarisDane/KETA/blob/a42bdf9ef7063ae47724f493d671df63816b2234/text_2_motion/diffusion/kp_extract.py
[kp]: https://foruck.github.io/KP/
[mdm]: https://guytevet.github.io/mdm-page/
[teach]: https://teach.is.tue.mpg.de/
[como]: https://yh2371.github.io/como/
</div>
