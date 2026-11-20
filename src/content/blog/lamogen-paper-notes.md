---
title: "[CVPR2026] LaMoGen：让语言模型编排动作谱，再把符号解码成三维动作"
description: "用“返回前抬起左手”走通 LaMoGen。看 LabanLite 如何把部位、动作含义与秒数展开成 20 Hz 的符号条件，以及为什么写进计划的事件仍需要在生成动作上重新验证。"
pubDate: "2026-11-19T17:05:00+08:00"
updatedDate: "2026-11-20"
badge: "Paper"
tags: ["LaMoGen", "LabanLite", "Labanotation", "Text-to-Motion", "Symbolic Motion", "Motion Editing", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[HTML 全文（含补充材料）][html] · [会议 PDF][pdf] · [正式补充 PDF][supp] · [作者演示][project] · [官方代码][repo]

**同名论文导航。** 本页是 Jiang 等在 CVPR 2026 发表的 LabanLite 动作谱工作。Kim 等在 2025 年提出的另一篇 LaMoGen，通过扩散采样中的文本嵌入调节动作的力度、突缓与舒展程度。[阅读首尔大学的 LaMoGen](/blog/arxiv2025-lamogen/)

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026</summary>

*LaMoGen: Language to Motion Generation Through LLM-Guided Symbolic Inference*，作者为香港浸会大学的 Junkun Jiang、Ho Yin Au、Jingyu Xiang、Jie Chen。发表于 CVPR 2026，第 9364–9373 页。研究对象是带部位和时间要求的文本到三维人体动作生成与编辑。本文核对会议主文、22 页补充材料、arXiv v1 及作者实现。[会议记录][venue] · [全文][html]

作者仓库提供训练、采样和符号转换代码，训练／测试数据和预训练权重均标为已发布，完整 LLM 数据仍列在待发布项。下文左手例子的秒数转帧数已用官方解析器验证；生成质量、耗时和用户评测数字取自原文，本次未运行模型权重。[固定代码版本][repo] · [解析器][digits] · [权重说明][readme]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

给角色一句“走出去，返回前抬起左手”，LaMoGen 先让语言模型为左右脚和双手编写带时长的动作谱，再让一个学过人体运动的模型补足屈肘、朝向等细节，解码成连续姿态。这样，读者既能检查“抬手排在哪一段”，也能另看成片里手是否真的在那时抬起。[主文图 2][fig2] · [补充图 13][edit]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 文本动作生成已能从自然语言得到连贯的走路、挥手等动作。常用的跨模态检索指标能检查整段动作是否像描述的类别，对“先迈哪只脚、重复几次、另一只手同时在做什么”则缺少直接读数。[主文 §1–2][background]

**现有痛点：** 两段视频都可以很像“走路并挥手”，却分别用了左手和右手，或把挥手放在返回之后。仅凭整句文本和整段动作的相似度，很难追查错误出在指令理解、动作顺序还是姿态还原。[主文图 1、图 3][fig3]

**核心矛盾：** 人倾向于用少数有意义的事件描述动作，而动画需要每一帧上许多关节的数值。语言指令可以确定“抬手 0.5 秒”，却经常没有规定手肘弯几度、骨盆都朝向哪里；另一方面，这些数值仍会影响动作是否自然。[主文 §3.1][concept] · [补充 §1.2][litelayers]

**本文目标：** 在可阅读的表示中安排身体部位、方向和持续时间，把这份安排转换成三维动作；还要能从生成的动作反向识别出事件，与参考动作的顺序、持续时间和四肢配合逐项比较。[主文 §3–4][bench]

**切入角度：** 拉班舞谱原本就通过谱面位置、符号形状和长度记录哪个部位怎样移动、持续多久。作者把这种事件记谱扩展成 LabanLite，把较粗的部位动作交给语言模型编排，把更稠密的运动学属性交给动作模型学习。[主文 §3.1][concept] · [补充图 3–4][inst]

**核心 idea：** 为每种概念动作准备可解析的短语，再补上时长；语言模型就能像改时间表一样改谱。把事件展开成共同的帧时间轴后，左右肢体可以在同一时刻使用不同符号，解码器也可以利用整段上下文恢复关节协同。[概念描述与词典][db] · [生成过程][gen]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

LaMoGen 有两个方向。**从动作到谱**时，规则检测器把训练动作转换成逐帧符号，用来建检索库、训练解码器和评测。**从文本到动作**时，先检索示例，语言模型编排新谱，解析器展开时间，细节增强器预测完整符号码，最后由学习到的解码器输出三维动作特征。测试时输入新的动作描述，检索库取自训练集。[主文图 2][fig2] · [补充 §4.1][training]

<figure class="reading-figure"><a href="/paper-notes/lamogen/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/lamogen/architecture.svg" alt="LaMoGen 的动作标注、示例检索、概念动作编排、逐帧补全和三维姿态解码架构" loading="lazy" /></a><figcaption>教学示意，可点击放大。先沿文本输入找到语言模型输出的概念谱，再沿帧级条件找到细节增强器与动作解码器。训练动作提供的符号标注同时服务于检索、训练和评测。依据主文图 2 及作者实现绘制。</figcaption></figure>

### 关键设计

1. **把动作含义拆到各个部位，并保留同一时刻的并发事件。** 左右支撑脚和左右上肢分别可以记录概念性的方向、高低、运动或保持，再加事件时长。例如左手升到高处的同时，右手可以保持在低处。完整谱还编码骨盆朝向、关节弯曲及骨盆运动强度。具体字段由部位决定，左手的高度是概念字段，而肘部的方向与高度也可作为细节字段。完整词表合计 37 个属性类别、158 个带定义的码位，每帧可激活多个码位。[补充 §1.2][litelayers] · [字段表 15][fields]

2. **从已有三维动作提取可以训练、也可以反查的谱。** 检测器分别处理身体部位，先按运动与保持划时间段，再依据身体几何离散化方向、高度等属性。例如手相对骨盆的位置帮助确定手向哪边抬；髋部欧拉角用于朝向，关节夹角用于屈曲，骨盆速度用于运动强度。随后把区间中的观测聚合为代表符号。离散规则决定了“两个姿态何时算同一动作”，也会带来检测误差。[主文 §3.2][detect] · [补充 §2][detectdetails]

3. **检索的是写谱范例，语言模型负责重新编排。** 概念描述库用动作文字作键、带部位和时长的事件列表作值。CLIP 取最相近的训练条目，主设置取三条；提示还规定哪些部位可以使用哪些动作词。语言模型结合新指令调整事件、顺序和时长，按固定词典解析回符号。它交付的是一份动作计划；检索到的三维动画无需拼接到输出。[主文 §3.3.1][compose] · [补充提示模板][prompts]

4. **细节增强器预测整份逐帧符号码。** 概念谱只确定部分字段。一个因果 Transformer 结合文字和概念条件，预测每帧全套属性的激活状态及结束标记。训练时用已知完整标注监督预测，并掩去部分输入以提高容错性。作者实现从预测值按属性分组取值，再送往解码器；没有在最后把语言模型给出的概念字段逐项硬写回。因此，计划里的方向和持续时间是可检查的条件，实际运动仍需核验。[主文 §3.3.2][gen] · [生成器][generator] · [采样入口][sample]

5. **把同时激活的符号组合成一帧，再恢复轨迹。** 码位的含义由人工定义，每个码位对应的 512 维向量则由数据学习。若某帧的多热向量为 v，码本为 C，形状分别是 158 与 158 × 512，则 vC 就是所有激活向量之和。Transformer 用整段向量序列恢复连续特征，训练损失同时比较姿态和相邻帧速度。HumanML3D 输出每帧 263 维动作特征，KIT-ML 为 261 维；158 维是条件与中间符号表示。[主文 §3.2.2][decode] · [补充训练设置][training] · [解码源码][decoder]

### 一个完整例子

补充图 13 的初始动作是慢慢向前走再返回，左手全程保持低位 2.8 秒。修改要求是**返回前抬左手**。语言模型把左手改成三段，右手仍保持低位。用作者词典记录这三个事件，左手依次是动作编号 46、10、37；这些编号属于概念动作的查找表，与完整 158 维码中的位置是两套编号。[补充图 13][edit] · [左、右臂动作表][armdict] · [公开解析器][digits]

| 左手概念事件 | 时长 | 在 20 帧/秒条件中占据的帧（从 0 计） |
| --- | ---: | --- |
| 保持低位 | 1.4 秒 | 0–27 |
| 向上抬 | 0.5 秒 | 28–37 |
| 保持高位 | 0.9 秒 | 38–55 |

用官方解析器作了一次小测试，固定右手与脚的描述，只更换上表左手计划，确实得到 **56 × 158** 的概念条件矩阵，左肘和左肩的弯曲槽位在此时都为零，表示计划尚未指定细节。下一步增强器才预测这些码位，解码器才给出连续姿态。因此帧 28 是**计划开始抬手**的时刻。要检验成片，可用生成骨架计算手腕相对骨盆的高度曲线，测实际起抬帧和到达高位的帧。[概念转换][digits] · [帧级生成][generator] · [作者编辑案例][edit]

### 训练 / 推理

- **先学会读谱还原动作。** 用规则把训练动作转换为完整码，联合训练码本向量与解码器，姿态与速度的 L1 损失权重为 1 和 0.5。再训练条件生成器，用逐帧真实完整码监督其概率输出。附录报告一张 NVIDIA L40、AdamW、批量 512、学习率 0.0001，解码器训练 20 万步、生成器 10 万步。[补充 §4.1][training]
- **测试不需要目标三维动作。** 文字可直接作为查询，也可在已有对话中修改概念描述。仓库把这条链分为编排计划和从已编排计划采样两个阶段，默认批量采样入口读取预先保存的文本特征和概念码。论文报告 512 维码本平均每句生成耗时 0.45 秒，明确排除了语言模型编排、模型加载和数据准备。补充表 2 估算一次概念编排约 5,000 个文本 token，编辑一次另约 5,000 个；这些是推理用量，文中未披露总训练 GPU 小时。[采样配置][cfg] · [补充推理时间][time] · [token 用量][usage]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**细粒度指令，主文表 1 节选。** HumanML3D-Laban 从 HumanML3D 选取适合写成指令的动作，以行走、迈步、跳跃为主。人工先记步数、左右顺序与动作类型，再用 GPT-4.1 把记录改写成指令。作者报告 2,748 对文本与动作；测试用在 HumanML3D 上训练的模型，没有在该基准上另行微调。表中数字均来自论文。[数据构建][benchdata] · [原表 1][t1]

| 方法 | 左支撑语义 SMT ↑ | 左支撑时序 TMP ↑ | 右臂时序 TMP ↑ | 两支撑脚配合 HMN ↑ | R@3 ↑ | FID ↓ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| MDM | 0.380 | 0.316 | 0.231 | 0.258 | 0.180 | 22.81 |
| ReMoDiff | 0.470 | 0.377 | 0.322 | 0.351 | 0.192 | 7.121 |
| CoMo | 0.358 | 0.211 | 0.250 | 0.252 | 0.176 | 21.94 |
| MotionGPT | 0.488 | 0.353 | 0.340 | 0.378 | 0.195 | 2.072 |
| LaMoGen，无概念编排 | 0.523 | 0.337 | 0.385 | 0.393 | 0.199 | 5.562 |
| LaMoGen，Qwen3 | 0.571 | 0.401 | 0.448 | 0.450 | 0.212 | 1.903 |
| LaMoGen，DeepSeekV3 | 0.552 | 0.475 | 0.486 | 0.463 | 0.206 | 1.859 |
| LaMoGen，GPT-4.1 | 0.583 | 0.507 | 0.492 | 0.508 | 0.208 | 1.861 |
| LaMoGen，来自真实标注的概念计划（Human） | 0.648 | 0.619 | 0.632 | 0.558 | 0.211 | 1.769 |

这些符号分数先对参考动作和生成动作分别提谱。**SMT** 折叠时长，比较某一部位的事件次序；**TMP** 把符号按持续时间铺成逐帧序列，再算归一化最长公共子序列；**HMN** 先把两个部位同时发生的事件配成一组，再比较组合出现的次序。因此，配合得分反映生成动作与参考谱的接近程度。要知道手离某个目标多少厘米，还需测量关节轨迹。表内 Human 行使用从真实动作标注取得的概念，展示给定更好计划时的表现。[指标定义][metrics] · [实验条件][conditions]

复核 HMN 时有一处口径值得保留。补充材料以两个事件时间区间的交并比超过 0.5 判定同步；公开评估脚本计算的是“参考部位活动区间中，另一部位也活动的帧占比”，分母取参考区间长度。两种算法对长短相差较大的事件可能给出不同配对。上表照录论文数字，其原始评测使用的脚本版本未披露。[补充 §3.1][metrics] · [公开 HMN 实现][evaluator]

**常规文本生成动作，主文表 2 节选。** R@3 衡量动作与配对文本的检索匹配，FID 衡量生成和真实动作的特征分布差异。下表取原表均值；原表同时列出波动范围。两套基准分别比较。[原表 2][t2]

| 方法 | HumanML3D R@3 ↑ | HumanML3D FID ↓ | KIT-ML R@3 ↑ | KIT-ML FID ↓ |
| --- | ---: | ---: | ---: | ---: |
| ReMoDiff | 0.795 | 0.103 | 0.765 | 0.155 |
| CoMo | 0.790 | 0.262 | 0.765 | 0.332 |
| MotionGPT | 0.778 | 0.232 | 0.680 | 0.510 |
| LaMoGen，无概念编排 | 0.755 | 1.091 | 0.750 | 0.685 |
| LaMoGen，GPT-4.1 mini | 0.779 | 0.561 | 0.761 | 0.550 |
| LaMoGen，GPT-4.1 | 0.796 | 0.252 | 0.775 | 0.415 |
| LaMoGen，来自真实标注的概念计划 | 0.813 | 0.206 | 0.782 | 0.254 |

**反向检测，主文表 3。** 在 21 段经拉班专家标注的步行动作上，作者将自动提取的谱与标注谱比较。这个实验检验“能否读出已有动作”，与“能否从文本生成动作”是两项任务。[原表 3][t3] · [评测数据][setup]

| 检测方法 | 平均 SMT ↑ | 平均 TMP ↑ | 平均 HMN ↑ |
| --- | ---: | ---: | ---: |
| Ikeuchi 等的方法，作者扩展到全身 | 0.751 | 0.632 | 0.611 |
| LaMoGen 规则检测器 | 0.871 | 0.852 | 0.786 |

### 消融实验

**检索示例与符号条件。** 补充表 6 给出两组配对实验。第一组保留 GPT-4.1 和动作词典，只移除检索示例；第二组向已有 MDM 的扩散过程加入由语言模型编排的符号条件。该实验中的 MDM 与 LaMoGen 的主解码器结构不同。[补充表 6][t6]

| 模型与条件（HumanML3D-Laban） | 平均 SMT ↑ | 平均 TMP ↑ | 平均 HMN ↑ | R@3 ↑ | FID ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| GPT-4.1，仅指令和规则 | 0.496 | 0.467 | 0.328 | 0.200 | 3.408 |
| GPT-4.1，加入检索范例 | 0.533 | 0.501 | 0.392 | 0.208 | 1.861 |
| MDM | 0.338 | 0.298 | 0.201 | 0.180 | 22.81 |
| MDM 加符号引导 | 0.475 | 0.438 | 0.271 | 0.204 | 1.932 |

**提示中放几条范例、训练时遮掉多少条件。** 在 HumanML3D 上，检索数取 1、3、5、7 时，FID 依次是 0.595、0.252、0.371、0.324。掩码比例取 0.1、0.3、0.5、0.7、0.9 时，FID 依次是 0.258、0.252、0.299、0.345、0.457。作者选用三条范例、0.3 掩码比例。[补充表 4][t4]

**细分符号要付出多少代价。** 将方向与高度的等距分档从 3 档提高到 5 档、7 档，HumanML3D FID 从 0.252 降至 0.198、0.184，每次编排的估算 token 用量从 5.0k 升至 7.7k、10.3k。分档变细带来更丰富的条件，也拉长语言模型需要处理的提示。[补充表 7][t7]

### 关键发现

1. **计划的价值在细粒度基准上尤其明显。** 无概念编排与 GPT-4.1 编排共用符号生成路线，左支撑时序由 0.337 提至 0.507。换到常规 HumanML3D，GPT-4.1 版 R@3 达 0.796，但 FID 为 0.252，高于 ReMoDiff 的 0.103。指令组织与动作分布质量应分别判断。[主文表 1][t1] · [主文表 2][t2]
2. **看计划与看成片会得到不同的时长。** 补充图 12 要求“向前走 5 秒”，语言模型分配了 10 个各 0.5 秒的步伐，图中最终片段标为 **5.2 秒**。这个实例既说明时长可操纵，也给出了从规划到输出的实际偏差。[补充图 12][timedemo]
3. **观察者能看出差异，但样本规模有限。** 35 位研究生对 15 组匿名随机排列的三段动画按指令匹配程度排序。LaMoGen、CoMo、ReMoDiff 的平均秩分别为 2.80、1.733、1.457，3 分表示排第一。它是整段匹配偏好，无法据此读出某只脚每次落地的时间误差。[补充用户研究][study]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **错误可以定位到不同环节。** 如果原话说左手、计划却写右手，问题已经出现在编排阶段；如果计划正确、输出手腕却一直很低，就要检查增强器预测的码和解码动作。反向提谱又提供了一条独立于文本嵌入的检查路径。[主文图 2][fig2]
- **检索范例还提供时长经验。** 动作词典能告诉模型“有什么可写”，真实范例还能告诉它一步通常持续多久、与哪条手臂动作重叠。移除范例后平均 TMP 由 0.501 降至 0.467，说明在这组实验中，规则和范例各自携带了信息。[补充表 6][t6]
- **可读词义与可学习向量可以同时保留。** “左手保持高位”在词典中始终能读懂，其数值嵌入仍可通过重建学习。时间、部位、状态因此有可编辑的入口，而身体如何自然衔接仍由数据学习。[主文 §3.2][decode]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **同一谱可以对应多种表演。** 两个人都在同样长的时间内抬手，起始加速度和末端缓冲还可能不同。离散高度、方向和速度区间会合并这些差别；作者把进一步分离动作内容与个人风格列为后续方向。[补充 §7.3][style]
- **测试范围偏向四肢大动作和位移。** 符号检测的专业人工对照集中在步行，细粒度指令集也偏向移动类。精细手指、人与道具的接触，以及指向真实物体时的指尖与目标距离，都需要专门的表示、数据和评测。[数据构成][benchdata] · [补充 §7.4][limits]
- **符号对齐度仍有参考动作和检测器两层依赖。** 一句自然语言可能有多种成立的演法。与某一参考谱不同的演法可能仍忠实于指令，检测器也可能认错。用于实际控制时，可像左手例子那样，从解码后的关节直接测量起止时刻、目标方向或空间距离。[指标定义][metrics] · [检测结果][t3]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **LabanDancer。** 它研究怎样把现成的拉班舞谱转成可观看的三维舞蹈。LaMoGen 向前接上了从自然语言编谱的步骤，同时用学习到的码本与解码器还原姿态。阅读两篇时，可以分别追踪“谁写谱”和“谁从谱产生运动”。[LabanDancer 站内解读](/blog/vast2003-labandancer/) · [LaMoGen 方法][gen]
- **CoMo。** CoMo 让语言模型在人体姿态码上执行修改。LaMoGen 把部位、动作短语与时长放到同一事件接口，修改一段左手描述即可重排该段的时间。两者的生成结果都需要回到连续动作上检查。[CoMo 站内解读](/blog/eccv2024-como/) · [补充编辑对照][timedemo]
- **Kinematic Phrases。** KP 也从三维动作提取可读的运动学关系；LaMoGen 的独特环节在于先由语言模型编写定时的概念谱，再利用它引导完整符号生成，并比较不同身体部位之间的共现顺序。[KP 论文](https://doi.org/10.1007/978-3-031-73242-3_13) · [拉班指标][metrics]
- **对可控动作系统的启发。** 对“返回前抬左手”，可以分别记录计划中的左手事件、从成片检测到的抬手、成片开始返回的时刻。这样才能区分语言模型是否排对了顺序，以及生成器是否把它执行出来。[补充图 13][edit]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 正式发表与全文。[CVPR 会议记录][venue] · [会议 PDF][pdf] · [正式补充材料][supp] · [arXiv 全文 HTML][html]
- 作者实现与演示。[项目页][project] · [代码与下载说明][readme] · [概念展开][digits] · [完整码预测][generator] · [姿态解码][decoder]
- 主结果、评测与消融。[拉班基准][t1] · [HumanML3D 和 KIT-ML][t2] · [检测评估][t3] · [检索与掩码][t4] · [引导实验][t6]

</div>

[venue]: https://openaccess.thecvf.com/content/CVPR2026/html/Jiang_LaMoGen_Language_to_Motion_Generation_Through_LLM-Guided_Symbolic_Inference_CVPR_2026_paper.html
[pdf]: https://openaccess.thecvf.com/content/CVPR2026/papers/Jiang_LaMoGen_Language_to_Motion_Generation_Through_LLM-Guided_Symbolic_Inference_CVPR_2026_paper.pdf
[supp]: https://openaccess.thecvf.com/content/CVPR2026/supplemental/Jiang_LaMoGen_Language_to_CVPR_2026_supplemental.pdf
[html]: https://arxiv.org/html/2603.11605v1
[project]: https://jjkislele.github.io/LaMoGen/
[repo]: https://github.com/jjkislele/LaMoGen/tree/2d7b31ac97d9fd700a1c3fcc421180a894f2d00d
[readme]: https://github.com/jjkislele/LaMoGen/blob/2d7b31ac97d9fd700a1c3fcc421180a894f2d00d/README.md
[digits]: https://github.com/jjkislele/LaMoGen/blob/2d7b31ac97d9fd700a1c3fcc421180a894f2d00d/utils/lbn_utils/lbn_digit_description.py
[generator]: https://github.com/jjkislele/LaMoGen/blob/2d7b31ac97d9fd700a1c3fcc421180a894f2d00d/network/lbnCodeGen.py
[sample]: https://github.com/jjkislele/LaMoGen/blob/2d7b31ac97d9fd700a1c3fcc421180a894f2d00d/sample/t2m_llm_compose.py
[decoder]: https://github.com/jjkislele/LaMoGen/blob/2d7b31ac97d9fd700a1c3fcc421180a894f2d00d/network/decoder.py
[cfg]: https://github.com/jjkislele/LaMoGen/blob/2d7b31ac97d9fd700a1c3fcc421180a894f2d00d/cfgs/eval/t2m_llm_compose.yaml
[evaluator]: https://github.com/jjkislele/LaMoGen/blob/2d7b31ac97d9fd700a1c3fcc421180a894f2d00d/utils/lbn_utils/lbn_evaluator.py#L101-L121
[background]: https://arxiv.org/html/2603.11605v1#S1
[concept]: https://arxiv.org/html/2603.11605v1#S3.SS1
[fig2]: https://arxiv.org/html/2603.11605v1#S2.F2
[fig3]: https://arxiv.org/html/2603.11605v1#S3.F3
[litelayers]: https://arxiv.org/html/2603.11605v1#S1.SS2
[inst]: https://arxiv.org/html/2603.11605v1#S1.F4
[db]: https://arxiv.org/html/2603.11605v1#S1.SS2.SSS4
[fields]: https://arxiv.org/html/2603.11605v1#S7.T15
[detect]: https://arxiv.org/html/2603.11605v1#S3.SS2.SSS1
[detectdetails]: https://arxiv.org/html/2603.11605v1#S2a
[decode]: https://arxiv.org/html/2603.11605v1#S3.SS2.SSS2
[compose]: https://arxiv.org/html/2603.11605v1#S3.SS3.SSS1
[gen]: https://arxiv.org/html/2603.11605v1#S3.SS3.SSS2
[prompts]: https://arxiv.org/html/2603.11605v1#S7.T8
[armdict]: https://arxiv.org/html/2603.11605v1#S7.T17
[training]: https://arxiv.org/html/2603.11605v1#S4.SS1
[usage]: https://arxiv.org/html/2603.11605v1#S5.T2
[time]: https://arxiv.org/html/2603.11605v1#S5.SS2.SSS2
[setup]: https://arxiv.org/html/2603.11605v1#S5.SS1
[bench]: https://arxiv.org/html/2603.11605v1#S4
[benchdata]: https://arxiv.org/html/2603.11605v1#S3.SS2a
[metrics]: https://arxiv.org/html/2603.11605v1#S3.SS1a
[conditions]: https://arxiv.org/html/2603.11605v1#S5.SS3
[t1]: https://arxiv.org/html/2603.11605v1#S3.T1
[t2]: https://arxiv.org/html/2603.11605v1#S3.T2
[t3]: https://arxiv.org/html/2603.11605v1#S5.T3
[t4]: https://arxiv.org/html/2603.11605v1#S5.T4
[t6]: https://arxiv.org/html/2603.11605v1#S5.T6
[t7]: https://arxiv.org/html/2603.11605v1#S5.T7
[timedemo]: https://arxiv.org/html/2603.11605v1#S5.F12
[edit]: https://arxiv.org/html/2603.11605v1#S5.F13
[study]: https://arxiv.org/html/2603.11605v1#S5.SS1a
[style]: https://arxiv.org/html/2603.11605v1#S7.SS3
[limits]: https://arxiv.org/html/2603.11605v1#S7.SS4
