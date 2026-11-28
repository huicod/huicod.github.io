---
title: "[SIGGRAPHAsia2026] ProAct：社交机器人怎样边听边动，又在合适的时候主动开口？"
description: "用真机讲解海报的连续案例拆解 ProAct。区分双路语音驱动的手势、基于记忆的主动干预和机器人步态控制，核对动作生成用时、触发准确率，以及机器人应当保持沉默时的失败案例。"
pubDate: "2026-11-28T15:48:00+08:00"
badge: "Paper"
tags: ["ProAct", "SIGGRAPH Asia 2026", "ACM TOG", "共语手势", "主动社交交互", "Unitree G1", "Flow Matching", "ControlNet", "流式动作生成", "ProActBench", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[arXiv HTML（含附录 A–F，可翻译）][html] · [原文 PDF][pdf] · [作者项目与真机演示][project] · [公开代码][repo]

<details class="paper-meta"><summary>论文信息与阅读版本 · SIGGRAPH Asia 2026 / ACM Transactions on Graphics</summary>

*ProAct: Harnessing Streaming Motion Generation and Agentic Reasoning for Real-Time Embodied Social Interaction*。北京大学 Zeyi Zhang、Zixi Kang、Ruijie Zhao、Yusen Feng、Biao Jiang、Hanyu Ji、Libin Liu，前三位共同一作。正式刊于 *ACM Transactions on Graphics* 45 卷 6 期，列入 SIGGRAPH Asia 2026。2026 年 2 月的 v1 题为 *A Dual-System Framework for Proactive Embodied Social Agents*；本篇使用 9 月 3 日的 v2，含主动触发基准 ProActBench。[出版记录][doi] · [会议日程][venue] · [版本历史][abs]

证据包括论文原表、作者真机演示和公开实现。核查日期为 2026 年 11 月 28 日，本文未运行模型或复测机器人。[模型权重][weights] · [数据发布页][dataset]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

ProAct 让机器人在等人说完时也能自然地动，同时保留主动发起交流的能力。**快系统**听用户和机器人自己的声音，连续生成机器人的手势；**慢系统**结合画面、对话和记忆，判断这一刻是否值得招手、转身或开口，并把具体意图送给快系统。海报演示中，机器人从看见路人、主动邀请，到转身指向展板，再到摆手纠正误解，四步各有不同的触发理由。[系统概览][overview] · [海报讲解原图][poster]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**　语音驱动手势已经能让身体随语调和节拍变化，实时对话模型也能在人说完后接话。但站在展板旁的机器人还有一个决定要做：路人没有提问时，要不要先招呼对方？这需要利用声音以外的线索。[原文引言][intro]

**现有痛点**　“观众看向手机”可能表示分心，也可能是在接紧急消息。只看当下的一帧容易打断对方；等语言模型把整段历史读完再生成所有动作，机器人又会在倾听时长时间静止。作者在基准中专门配对了表面行为相似、合适反应相反的情形。[负例与配对设计][benchdesign]

**核心矛盾**　手势要跟着声音连续更新，社交干预却应当稀疏，而且理由可能来自几轮前发生的事。身体需要持续有输出，并不等于机器人需要持续找理由发言。[架构概览][overview] · [认知循环][cognitive]

**本文目标**　在同一个真人与机器人交互过程中，维持讲话和倾听两种状态下的身体动作，并检验系统是否能在该介入时主动、在该安静时克制。两部分分别用动作指标、决策回放和真机用户研究评价。[动作评测][motioneval] · [主动决策评测][bencheval]

**切入角度**　把“这几帧怎样动”和“现在要不要做一件有明确含义的事”交给两个不同速度的系统。慢系统只传递简短的手势意图、对话提示或移动命令，生成连续关节运动的工作仍在快系统内完成。[规划输出][channels] · [原文图 2][fig2]

**核心 idea**　把语音生成动作作为默认行为，再训练一条能接收文字意图的控制分支。这样，机器人可以持续听着对方；一旦规划器决定“摆手表示否定”，这个意图就能加入正在进行的动作生成。[语义控制设计][control] · [原文图 9][fig9]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

读图时可以跟踪两条信号。**声音**一直流向动作生成器，区分“用户在说”和“机器人在说”；**主动计划**只在触发时出现，还会分成三条去向。想换个话题，提示进入语音对话模型；想摆手，文字意图进入手势生成器；想转向观众，移动命令进入 G1 步态控制器。[系统总览][overview] · [认知架构图][fig3] · [真机执行][robot]

<figure class="reading-figure"><a href="/paper-notes/proact/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/proact/architecture.svg" alt="ProAct 中文架构图。用户和机器人的语音连续驱动手势，画面、转写和历史进入较慢的认知循环。达到阈值后，计划分别控制对话、手势意图与步态，最终在 G1 上执行。" /></a><figcaption>根据论文图 2、3、9 和真机部署部分重绘，可点击放大。用户与机器人的双路音频共同作为条件，输出的是机器人一方的动作。</figcaption></figure>

### 关键设计

1. **连续生成身体动作，单独处理发言轮次。** 头部相机与用户麦克风给实时对话模型提供视觉和声音；常规回复在语音活动检测判定用户结束发言后开始，用户也可以打断机器人。动作不必等这个信号。每路音频逐帧提取 181 维特征，包括 MFCC、起音和节奏特征；将两路按通道拼接，与流时间嵌入一起通过 AdaLN-Zero 调节 DiT。轮到用户说话时，生成器仍能用用户音频生成机器人一方的倾听行为。[§4.1][verbal] · [§4.2.1][flow] · [特征定义][data]

2. **让相邻动作段在求解过程中就接上。** 每次从噪声出发，用学习到的速度场逐步积分，得到一段连续关节运动。下一段开头与上一段尾部重叠，每个求解步都将重叠位置覆写成缓存的旧姿态。已生成的身体历史因此能保持连续。论文列出窗口 150 帧、重叠 30 帧，动作时间轴为 30 Hz；效率实验另外按生成 **1 秒动作**计时。原文未把这两种口径等同，也未报告任意时刻发出指令后多少帧一定能看到新手势。[公式 1 与图 2][fig2] · [缓存机制][flow] · [运行设置][settings]

3. **把动作意图写成“身体部位＋动作”。** 如“抬起一只手，横向摆动”。原始音频动作主干先训练再冻结；旁边的 ControlNet 用冻结的 CLIP 文本编码器和可训练层处理意图，将信息通过零初始化的残差连接注入主干。语音持续提供时序条件，规划器不必写关节角、轨迹或动作时长。原文以文字回译分数检查意图是否可辨认，未给出语音与文字同时争用同一只手时的逐帧优先级。[§4.2.2][control] · [附录图 9][fig9] · [文本评测][motioneval]

4. **规划器与记忆更新器并行。** 每轮中，记忆更新器看最近五个周期间的转写、上一周期内抽取的三张图及旧计划，用短句更新用户状态、场景事件和机器人行为历史。规划器取最新转写、一张最新画面、**上一轮**的记忆与计划，直接决定当前行为。它不必等待本轮记忆压缩完成，也能检查近期是否已经说过、做过同一件事。[§5.1][context] · [§5.2][planner]

5. **用不同门槛控制身体与对话。** 规划器对场景变化、用户意图、对话状态、社交礼节、情绪需要五个维度各打 1–5 分。任一维度达到 **4**，就可进入行为规划；达到 **5** 才允许主动干预对话。手势通道接受简短描述，移动通道输出带距离的前进／后退、带角度的转身或待机。适配器把移动指令换成速度与持续时间，G1 自带的步态控制器执行；上身接收平滑、限幅后的关节目标。[动机评估][motive] · [三条输出通道][channels] · [部署细节][robot]

### 一个完整例子

**机器人怎样讲一张海报？** 原图 4 展示了同一段连续真机交互。作者预先告诉系统展板讲解员的角色与目标，演示中的动作为系统在线产生。图中没有给每次触发的具体分数，以下按已展示的观察、触发和动作复述。[海报讲解原图][poster] · [场景设置][demo]

1. 路人看着手机走近。认知系统将新来访者识别为可以主动招呼的社交情境，规划招手并邀请对方注意机器人。这里的“招手”有明确的交流目的。
2. 路人走向海报。新的视觉变化触发转身，移动通道负责调整机器人的展示朝向。等对方停下来等待介绍时，系统又生成指向展板的手势。转身与指板走的是两条执行路径。
3. 观众说自己认为交流型智能体都是被动的。系统把这句话与展示任务联系起来，主动纠正说法，并用横向摆手表达否定。摆手的意图来自对话推理；姿态和节奏仍由动作生成器结合语音生成。

这段演示展示了**何时选择指、何时选择摆手**。规划器给出的手势条件是文字描述。论文没有把海报上指定图块的世界坐标交给末端求解器，也没有测指向角误差；若要做“精确指到幻灯片第三列”的应用，这一步仍需单独验证。[原图 4][poster] · [手势与移动接口][channels]

### 训练与推理

**动作主干先学听说双方的节奏。** 作者从 Photoreal 的 PXB 说话人取 2.5 小时同步语音和动作，训练音频骨干 50 万步。随后固定骨干，用 SeG 的 544 段手势训练控制分支；每段由 Gemini 2.5 Pro 根据渲染和原类别资料补成意图、姿态、过程三条文字，共 1,632 条。SeG 没有语音，第二阶段用高斯噪声填充音频输入，不混入 Photoreal。由此可以理解，组合能力来自两阶段学习，而逐拍文字口令与真实语音同时出现的配对样本仍很有限。[数据与训练][data] · [训练设置][settings] · [附录 B 标注示例][annotation]

**运行时有三个时间尺度。** 单张 RTX 4090 用 50 步 Euler 积分生成 1 秒动作，纯音频平均 **0.425 秒**，加入意图控制后 **0.648 秒**。认知系统使用 GPT-4.1-mini，单周期约 **4 秒**、约 3,800 tokens。用户说完到第一句口头回复约 **2 秒**，受实时语音模型、串联处理和网络影响。训练部分报告双 RTX 4090，动作骨干约 19 小时，控制分支约 4 小时；这些开销仅覆盖动作模型。[运行配置][settings] · [生成速度对照][efficiency] · [响应延迟讨论][conclusion]

**论文和下载到的 G1 权重使用不同的特征口径。** 原文用每关节 3 维指数映射，另加 6 维根位置与速度，人体 57 个关节对应 177 维，机器人 23 个关节对应 75 维。发布的 G1 权重则读取 **31 个腰、臂、手部标量特征**。论文将网络隐藏宽度记作 1280，公开配置分别列出动作隐藏宽度 512 和时间嵌入宽度 1280。实际融合路径中，机器人自己的语音条件与文字条件按可学习权重组合，对方语音单独保留，控制残差按层加入骨干。复用这些权重时，动作输入须与其配套预处理一致。[论文表示][data] · [发布配置][config] · [预处理代码][preproc] · [条件融合代码][fusion]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

**动作听起来是否合拍、看起来是否像文字？** 原表 2，使用原始 Photoreal 人体骨架。FGD 衡量动作特征分布距离，BeatAlign 衡量语音节奏与动作重音的对齐，Div-k 衡量动作多样性。BERT Score 是把生成动作重新描述为文字后，与输入意图比较的相似度。LDA、EMAGE 由作者重训，Photoreal 用公开权重，SocialAgent 采用其作者提供的结果；LMM Base 按原有策略在 Photoreal 与 SeG 上重训。[原表 2][t2] · [评测协议][motioneval]

| 方法 | FGD ↓ | BeatAlign ↑ | Div-k ↑ | BERT Score ↑ |
| --- | ---: | ---: | ---: | ---: |
| LDA | 79.71 | 0.732 | 1.416 | — |
| EMAGE | 82.29 | 0.767 | 1.847 | — |
| Photoreal | 69.44 | 0.746 | 1.986 | — |
| SocialAgent | 72.57 | 0.812 | 2.014 | — |
| LMM | 78.37 | 0.726 | 1.583 | 0.4355 |
| ProAct，共享主干联合训练 | 73.31 | 0.752 | 1.871 | 0.5082 |
| ProAct，冻结主干加控制分支 | **66.53** | **0.823** | **2.230** | **0.5930** |

**旁观者能感到机器人更主动吗？** 原表 1，150 名线上观察者按同一情境比较两段 60 秒录像；偏好强度为 0–2，落选系统记相反数，故均值可以为负。星号表示该项与完整系统的差异显著，按原表保留。这些分数仅在本实验中解释。[原表 1][t1] · [评分方法][observer]

| 系统 | 动作自然度 ↑ | 感知主动性 ↑ | 临场感 ↑ |
| --- | ---: | ---: | ---: |
| a　仅语音，身体静止 | −0.523* | −0.341* | −0.589* |
| b　加入连续动作 | 0.175 | −0.218* | 0.045* |
| c　加入规划器，直接读未压缩历史 | 0.159* | 0.148* | 0.169* |
| d　完整系统，加入压缩记忆 | 0.187 | 0.417 | 0.370 |

**该打招呼时会不会打，不该时能否沉默？** 原表 3，ProActBench 有 30 个应介入和 10 个应保持安静的案例，同一录制输入对每个系统回放三遍。触发还要求规划器给出非空行动。三名人工评估者另评行动是否合宜，总体分满分 5。表中延迟基于标注者估计，失败用 10 秒计入，与动作模型的 GPU 计时口径不同。[原表 3][t3] · [评价协议][protocol]

| 设置 | 触发精确率 ↑ | 触发召回率 ↑ | 延迟（秒）↓ | 行动总体分 ↑ | 失败率 ↓ |
| --- | ---: | ---: | ---: | ---: | ---: |
| 完整 ProAct | **0.878** | **0.800** | **3.7** | **4.35** | **16.7%** |
| 移除动机评估 | 0.730 | 0.722 | 3.8 | 3.79 | 27.5% |
| GPT-5.1 直接决定行动 | 0.600 | 0.500 | 5.4 | 3.69 | 32.5% |
| 仅行为系统 | — | — | 4.7 | 3.57 | 30.0% |

### 消融实验

- **文字和音频共用主干，还是分两阶段训练？** 换成单一主干联合训练后，BeatAlign 从 0.823 降至 0.752，回译 BERT Score 从 0.5930 降至 0.5082。这组对照支持在现有两套非三元配对数据上保留语音主干，再额外学习文字控制。[原表 2][t2]
- **保留规划器，只移除触发打分。** 直接根据记忆和观察规划动作，精确率由 0.878 降到 0.730，失败率由 16.7% 升到 27.5%。相比 3.7 与 3.8 秒的微小时间差，这组实验对“筛选干预时机”的支持更直接。[原表 3][t3]
- **动作生成改用扩散对照。** 对 1 秒动作，200 步 DDIM 用 1.597 秒，超过播放时长；50 步流匹配的纯音频与意图控制条件分别用 0.425 和 0.648 秒。不同方法、不同步数同时变化，数据描述的是这几套实际配置的速度。[§6.3 效率比较][efficiency]

### 关键发现

1. **让身体动起来与让人感觉“它在主动交流”，是两个可以单独改善的目标。** 观察研究中，从静止到加入动作，自然度由 −0.523 升到 0.175；从已有动作到完整系统，主动性由 −0.218 升到 0.417，自然度之差未标显著。真机交互另有 10 人，每人做两个场景、每场景体验两种系统，得到 20 对评价。完整系统在主动性、临场感、舒适度、再次互动意愿上显著更好，动作自然度与感知响应及时性差异未达显著。[原表 1][t1] · [真机结果图 6][fig6] · [参加者流程][participant]
2. **系统最容易误读的是安静。** 在“用户只是安静思考”的负例中，三次回放只有一次正确保持沉默。在“起身只是去取水”中，三次有两次克制住了提醒。这样的配对比只收集成功招手或成功安慰的演示更能揭示过度打扰。[附表 6][t6]
3. **动作能跟上播放，与机器人及时理解你，是不同的评测。** 有意图时 0.648 秒能生成 1 秒动作，说明这一配置能供给连续播放；约 4 秒的认知节奏仍可能错过很短的眼神、犹豫或指示。ProActBench 的 30 个正例中，三轮在全部检查项上一致的有 9 个，13 个为多数一致，另有 8 个不一致。[运行设置][settings] · [一致性与判定口径][t7]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **给动作模型发“意图”，给机器人另发“去哪里”。** 对讲解员，“摆手否定”可以由语义控制分支合成，“向左转一定角度”却能落到有单位的步态命令。把这两件事拆开，便于追查故障究竟在规划、手势生成还是行走执行。[三通道计划][channels] · [真机控制接口][robot]
- **把“本该沉默”纳入评测。** 同样是用户说话带有悲伤色彩，讲电影情节和谈自己的遭遇对应不同回应。用最小情境变化构造正负对照，使错误安慰、重复招呼等问题能被单独计数。[基准设计][benchdesign] · [配对失败分析][t6]
- **连续动作也有虚拟角色出口。** 作者还把 Photoreal 骨架上的 BVH 和同步语音流送到 Blender，重定向到带蒙皮的角色。做虚拟讲解员时，可以复用论文的高层意图与动作接口；真机实验中的步态稳定性需要按虚拟角色自己的执行方式重新评估。[附录 C][blender]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **语义动作与精确指向之间还差空间验证。** “指海报”的动作可以被重新描述为指向，也可以得到较高的 BERT Score，但这没有测量指尖射线是否命中海报某个区域，也未检验指尖到位是否与某个词同步。面向幻灯片讲解，目标区域、口播词的时间戳和手部轨迹适合分别记录。[动作指标][motioneval] · [讲解案例][poster]
- **单实验室的回放难以代表长对话。** ProActBench 每例一个决策点，固定回放能公平比较输入，但用户不会根据回放中机器人的动作改变后续反应。它没有测量连续多次打断、干预冷却期或长期个体偏好。作者也明确指出微表情、细微语调和情绪判断的局限。[附录 D.3.3][benchlimits] · [原文讨论][conclusion]
- **物理执行和训练覆盖都有边界。** 上身输出会平滑、限幅，移动依赖平移、转向、待机三个基本动作；精细避障和接触感知的全身控制仍是局限。语音动作训练仅取一名说话人，跨说话人风格、复杂空间和近距离互动的可靠性尚需另测。[真机部署][robot] · [数据说明][data]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **SocialAgent。** 这项前作让对话导演指导虚拟场景中两位角色的非语言行为。ProAct 面对一个独立行动的真人，只生成机器人自己的运动，还必须判断什么时候值得介入。SocialAgent 是原表 2 中有作者供数的动作基线。[SocialAgent 作者项目][social] · [ProAct 比较设置][motioneval]
- **LMM。** 原表 2 把可接受音频和文字的 LMM Base 在相同数据来源上重训，用它检验通用多模态模型与专门语义分支的差异。对同一手臂发生冲突时谁优先这个问题，两者在这里都没有逐事件的优先级实验。[本站 LMM 解读](/blog/eccv2024-lmm/) · [原表 2][t2]
- **StreamTalk 与 BASE。** 这两篇适合对照阅读“音频怎样变成连续且可播放的动作”，尤其是窗口、重叠和缓冲。ProAct 在这一层之外还要决定是否主动说话或改变身体行为。这是功能对照，二者均未列入 ProAct 原表 2 的对比。[本站 StreamTalk 解读](/blog/eccv2026-streamtalk/) · [本站 BASE 解读](/blog/arxiv2026-base/)
- **对讲解型角色的启发。** 可以沿用论文的海报场景，固定同一段讲解词，分别改变“听众正在看海报”“听众在思考”“听众明确提问”三种状态。记录是否介入、哪一帧发出意图、指向位置是否命中，以及动作与关键词差多少毫秒。这是基于论文提出的后续测试。

<span id="reading-8" class="reading-anchor"></span>

## 来源

- 正式题名、作者和发表状态见 [ACM 出版记录][doi] 与 [SIGGRAPH Asia 会议日程][venue]。方法、案例与表格按 [arXiv v2 全文][html] 和 [20 页 PDF][pdf] 核对。
- 架构图依据原文图 2、3、9 和 §6.1 中文重绘。主实验摘自表 1–3，真机直接体验见图 6，负例与一致性见附表 6–7。[原文附录][fig9] · [真机视频与项目页][project]
- 作者公开了 [代码快照][repo]、[音频骨干与文字控制权重][weights]、[处理后的 SeG 和重定向 Photoreal 子集][dataset]。权重卡注明公开版音频骨干还用到 ZEGGS；论文实验段描述的是 PXB 的 2.5 小时数据，因此不要把发布权重直接当成原表复现记录。

</div>

[html]: https://arxiv.org/html/2602.14048v2
[pdf]: https://arxiv.org/pdf/2602.14048v2
[doi]: https://doi.org/10.1145/3842576
[venue]: https://sa2026.conference-schedule.org/presentation/?id=papers_2366&sess=sess129
[project]: https://proactrobot.github.io/
[abs]: https://arxiv.org/abs/2602.14048
[repo]: https://github.com/ProActRobot/ProAct-Official/tree/6b3affccfdb3809da1ae06b6c68b1a44d6cb9118
[config]: https://github.com/ProActRobot/ProAct-Official/blob/6b3affccfdb3809da1ae06b6c68b1a44d6cb9118/configs/inference/controlnet.yaml#L59-L84
[preproc]: https://github.com/ProActRobot/ProAct-Official/blob/6b3affccfdb3809da1ae06b6c68b1a44d6cb9118/src/motion/data_process/extract_features.py#L88-L96
[fusion]: https://github.com/ProActRobot/ProAct-Official/blob/6b3affccfdb3809da1ae06b6c68b1a44d6cb9118/src/motion/model/model_for_interaction_7_cfg_mfcc.py#L474-L490
[weights]: https://huggingface.co/UsanoCoCr/ProAct
[dataset]: https://huggingface.co/datasets/UsanoCoCr/ProAct-Data
[intro]: https://arxiv.org/html/2602.14048v2#S1
[overview]: https://arxiv.org/html/2602.14048v2#S3
[fig2]: https://arxiv.org/html/2602.14048v2#S4.F2
[fig3]: https://arxiv.org/html/2602.14048v2#S4.F3
[verbal]: https://arxiv.org/html/2602.14048v2#S4.SS1
[flow]: https://arxiv.org/html/2602.14048v2#S4.SS2.SSS1
[control]: https://arxiv.org/html/2602.14048v2#S4.SS2.SSS2
[cognitive]: https://arxiv.org/html/2602.14048v2#S5
[context]: https://arxiv.org/html/2602.14048v2#S5.SS1
[planner]: https://arxiv.org/html/2602.14048v2#S5.SS2
[motive]: https://arxiv.org/html/2602.14048v2#S5.SS2.SSS1
[channels]: https://arxiv.org/html/2602.14048v2#S5.SS2.SSS2
[data]: https://arxiv.org/html/2602.14048v2#S6.SS1.SSS1
[settings]: https://arxiv.org/html/2602.14048v2#S6.SS1.SSS2
[robot]: https://arxiv.org/html/2602.14048v2#S6.SS1.SSS3
[poster]: https://arxiv.org/html/2602.14048v2#S6.F4
[demo]: https://arxiv.org/html/2602.14048v2#S6.SS2.SSS1
[t1]: https://arxiv.org/html/2602.14048v2#S6.T1
[fig6]: https://arxiv.org/html/2602.14048v2#S6.F6
[motioneval]: https://arxiv.org/html/2602.14048v2#S6.SS3
[t2]: https://arxiv.org/html/2602.14048v2#S6.T2
[efficiency]: https://arxiv.org/html/2602.14048v2#S6.SS3.SSS0.Px2
[benchdesign]: https://arxiv.org/html/2602.14048v2#S6.SS4.SSS1
[bencheval]: https://arxiv.org/html/2602.14048v2#S6.SS4
[protocol]: https://arxiv.org/html/2602.14048v2#S6.SS4.SSS2.Px1
[t3]: https://arxiv.org/html/2602.14048v2#S6.T3
[conclusion]: https://arxiv.org/html/2602.14048v2#S7
[fig9]: https://arxiv.org/html/2602.14048v2#A1.F9
[annotation]: https://arxiv.org/html/2602.14048v2#A2
[blender]: https://arxiv.org/html/2602.14048v2#A3
[observer]: https://arxiv.org/html/2602.14048v2#A4.SS2.SSS2
[participant]: https://arxiv.org/html/2602.14048v2#A4.SS2.SSS3
[t6]: https://arxiv.org/html/2602.14048v2#A4.T6
[t7]: https://arxiv.org/html/2602.14048v2#A4.T7
[benchlimits]: https://arxiv.org/html/2602.14048v2#A4.SS3.SSS3
[social]: https://pku-mocca.github.io/Social-Agent-Page/
