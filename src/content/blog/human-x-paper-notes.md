---
title: "[ICCV2025] Human-X：虚拟搭档怎样跟上真人伸出的手？"
description: "Towards Immersive Human-X Interaction: A Real-Time Framework for Physically Plausible Motion Synthesis。以一次握手解释双人动作预测、接触表示与感知真人的物理跟踪，比较两个数据集上滑步、身体互穿和跟踪成功率的变化。"
pubDate: "2026-11-27T16:16:00+08:00"
badge: "Paper"
tags: ["Human-X", "ICCV 2025", "动作反应生成", "双人交互", "物理跟踪", "扩散模型", "实时角色控制", "VR", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 HTML（含补充材料）][html] · [ICCV 论文 PDF][pdf] · [补充材料 PDF][supp] · [作者演示][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · ICCV 2025 Highlight</summary>

*Towards Immersive Human-X Interaction: A Real-Time Framework for Physically Plausible Motion Synthesis*。作者为 Kaiyang Ji、Ye Shi、Zichen Jin、Kangyi Chen、Lan Xu、Yuexin Ma、Jingyi Yu、Jingya Wang。发表于 ICCV 2025，页码 10173–10183，作者项目标注为 Highlight。这里的 X 指真人的三类交互搭档：运动学虚拟角色、物理仿真人形角色、重定向后的机器人模型。[会议记录][cvf] · [作者项目][project] · [应用设置][apps]

本文依据会议正文、补充材料、作者演示和公开仓库整理。实验数值均为作者报告；代码部分核对了发布内容与配置，没有独立运行模型。[代码仓库][repo] · [规划器说明][code]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

真人伸手时，Human-X 同时预测“对方的手接下来会去哪”和“虚拟搭档该怎么迎上去”。等新一帧真人观测到来，物理跟踪器还可以偏离原计划。论文最有价值的实验证据是，这种自由度确实能减少部分身体互穿，也会降低跟准原动作的成功率。[架构图 2][fig] · [跟踪策略对照表 8][policytable]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**　给定一段发起者动作，已有模型可以生成与之配合的第二个人，例如面向对方并伸手。物理控制器也能让一个仿真人形角色跟随预先给好的关节轨迹。戴上头显以后，系统却必须在真人还没做完动作时就开始回应。[§2][related]

**现有痛点**　想象真人伸手和虚拟搭档握手。等看清整段动作再回应，两只手便错过时机。若角色提前伸手，而真人临时换了位置，执意跟随原轨迹又可能造成穿模。只评价角色单独抬手的动作是否自然，会漏掉这两个问题。[§1][intro] · [握手可视化][handshake]

**核心矛盾**　提前预测有助于同步，但预测时看不到真人的下一帧；越严格地执行预测，意外动作发生时越难调整。角色同时面对三个要求：脚下站得稳、手能与对方对上、对方改变动作时来得及让开。[§3.4][policy]

**本文目标**　只用已经采集的双方历史和可选文字，在线生成响应者的连续全身动作。运动学结果可驱动虚拟角色；需要模拟身体动力学时，再由跟踪策略执行关节目标。[§3.1][overview] · [§4][apps]

**切入角度**　把“决定未来两个人大概怎样动”和“此刻具体怎样跟”交给不同时间尺度的模型。上层保留两人之间的空间关系；下层在参考动作仍有效时跟随，在真人的位置发生变化时仍能读到最新观测。[§3.3][plan] · [§3.4][policy]

**核心 idea**　把预测的真人动作保留下来，交给控制器与实测真人动作比较。这给执行层提供了一条具体线索：如果当初支撑这次握手的预测开始失准，保持默认姿态和与真人的间距就应该比忠实复现原握手更重要。[式 9–11][reward]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

真人是发起者（actor），模型控制的角色是响应者（reactor）。RGB-D 相机采集真人，HybrIK 估计人体姿态，深度来自相机。上层扩散模型把已观察到的真人和已生成的角色动作放在同一坐标系，联合预测双方的下一段运动及接触关系。下层收到角色的参考姿势、模型预测的真人姿势、相机实际看到的真人姿势，并结合仿真角色自身的状态来执行动作。[原文图 2][fig] · [§3.2][capture] · [§3.4][policy]

<figure class="reading-figure"><a href="/paper-notes/human-x/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/human-x/architecture.svg" alt="Human-X 架构。真人实测姿态进入历史窗口，也直接进入物理跟踪器。扩散规划器预测双方未来；跟踪器根据角色自身状态和最新真人观测跟踪响应者的参考动作。" /></a><figcaption>依据论文图 2、算法 1 与附录 B.2 重绘。点击可放大。</figcaption></figure>

读图时跟着两份“真人姿态”走一遍。一份来自相机，始终属于观测；另一份来自扩散模型，代表制定计划时对未来的估计。只有响应者的预测姿态用作角色的关节目标。两份真人姿态在跟踪器重新相遇，是这个系统能在计划尚未更新时作出调整的原因。[算法 1][algo] · [附录 B.2][reward]

### 关键设计

1. **让两个人共享一个参考系。** 以响应者的根部和朝向作为坐标原点与正前方，对发起者应用同一个变换。这样即使一对人换了地点、转了方向，模型仍能读到对方在我左边还是右边、离我的手多远。每帧表示由三部分组成：响应者的全身动作、相对于响应者的真人动作、两人之间的接触矩阵。正文采用 22 关节骨架，每人从中选骨盆、头、双腕和双踝组成 **6 × 6** 矩阵，各格表示一对关节是否近于阈值。腕部间距提供接触线索，手指形态、握力和摩擦并不在这个矩阵里。[式 1][repr] · [附录 C.3][ablation]

2. **一次生成两个人可能的未来，但只控制其中一个。** 默认给定过去 **20 帧**，从噪声开始预测未来 **40 帧**的双人表示。网络是 8 层、隐藏维度 512 的扩散 Transformer，预测干净的动作表示；可选的自然语言通过冻结的 DistilBERT 提供本窗口的语义条件。进入下一窗口时，真人一侧读回已经采集到的历史，响应者一侧使用自身先前生成的动作。由此，系统能提前伸手，又能在下一轮把对真人的错误预判换成实测信息。[式 3 与算法 1][planner] · [默认设置][setup]

3. **把同步落实为可以训练的误差。** 除去噪重建，作者额外检查三件事：标记为着地的脚在世界坐标里有没有滑动、标记为接触的跨人关节是否仍隔得很远、上一段末尾与新一段开头是否跳变。三项损失分别约束脚与地面、人与人、前后时间段。接触矩阵还作为预测表示的一部分，因此运行时无需用户逐帧标注应该哪只手碰哪只手。[式 4–7][losses]

4. **把“此刻还该不该追目标”交给执行层。** 以 PHC 为基础的强化学习策略接收角色目标关键点、本体状态，以及同一时段预测和实测的真人动作。训练奖励给两种行为分配权重：一端是模仿上层动作，另一端是回到常见站立或行走姿势并与真人保持间隔。预测与观测越不一致，后一端的权重越大。这个加权发生在训练奖励中；运行时执行的是训练好的策略。论文没有定义“误差超过某值必定停手”的硬规则。[§3.4][policy] · [附录式 10–11][reward]

### 一个完整例子

**真人与虚拟 H1 握手**来自作者图 4。下面将图中动作按系统接口展开；第 4 步的临时收手是用来理解控制策略的假设情形。[原图 4][handshake]

| 时刻 | 系统已经知道什么 | 会生成或执行什么 |
|---|---|---|
| 真人开始伸手 | 相机看到手腕靠近、身体朝向和位置。历史中还有虚拟搭档刚才的动作。 | 把双方变换到搭档的根坐标系，保留两腕相对位置。 |
| 握手尚未发生 | 未来的手腕位置还不可见，当前窗口可以附文字提示。 | 扩散模型预测双方下一段动作及接触，得到搭档抬臂的参考，同时留下对真人手臂的预测。 |
| 搭档伸手 | 每次控制更新时，系统都能读取新的真人观测和角色当前姿势。 | 跟踪器尽量接近参考。H1 分支先把人体目标映射为机器人的关节目标，在虚拟环境中呈现接近、接触和结束的过程。 |
| 假设真人提前收手 | 相机看到的手臂已偏离原先的预测。 | 策略可降低对旧轨迹的服从。是否恰好收回、多快收回、是否碰到手，都需要逐事件测量；图 4 展示的是成功握手个例。 |

### 训练与推理

**训练。** 动作统一到 30 帧/秒。规划器按连续三个窗口训练：先用真实历史，再逐渐增加模型自己生成的历史，最后完全采用滚动生成的响应者历史，每阶段 10 万步。这样上一窗口的错误也会出现在下一窗口的训练输入中。论文报告规划器在单张 RTX 4090D 上约训练 30 小时；物理跟踪器另在同类设备上训练约 20 小时。[算法 2][schedule] · [§5.2][setup]

**推理。** 作者先采集约 **1 秒**真人动作初始化历史，此时跟踪器先取默认姿势。正文描述的上层规划频率为 **0.5 Hz**，采集和跟踪为 **30 Hz**，Isaac Gym 仿真为 **60 Hz**。默认八步扩散的 **13.6 毫秒**是原表 3 的规划耗时。一次计算多久、多久重新下发计划、相机到头显要等多久，是三种不同测量；论文没有给出最后一项的端到端实测。[§3.4][policy] · [§5.2][setup] · [原表 3][t3]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

Inter-X 含 11,388 条双人序列、40 类交互；InterHuman 含 6,022 条、约 170 万帧。下表摘录原表 2、4 的**在线、无文字约束**设置。FID 衡量响应动作分布；Pene 和 Skate 分别衡量角色穿入地面和滑步；IV 衡量两个身体网格互穿；FID<sub>cd</sub> 比较双人关节间距离的分布。所列指标均为越低越好，保留原表数值口径。基线为论文作者按在线任务适配和评估的结果。[数据与协议][protocol] · [表 2][t2] · [表 4][t4]

| 数据集 | 方法 | 动作 FID ↓ | Pene ↓ | Skate ↓ | 双人 IV ↓ | FID<sub>cd</sub> ↓ |
|---|---|---:|---:|---:|---:|---:|
| Inter-X | ReGenNet | 2.212 | 0.141 | 0.118 | 0.218 | 1.950 |
| Inter-X | CAMDM | 1.430 | 0.153 | 0.127 | 0.145 | 2.086 |
| Inter-X | Human-X 规划器 | **0.975** | 0.118 | 0.092 | 0.076 | **1.692** |
| Inter-X | Human-X ＋物理跟踪 | 1.220 | **0.026** | **0.007** | **0.054** | 1.833 |
| InterHuman | ReGenNet | 2.257 | 0.427 | 0.396 | 0.169 | 1.733 |
| InterHuman | CAMDM | 2.166 | 0.296 | 0.177 | 0.341 | 3.701 |
| InterHuman | Human-X 规划器 | **1.995** | 0.216 | 0.048 | **0.106** | **1.582** |
| InterHuman | Human-X ＋物理跟踪 | 2.350 | **0.064** | **0.008** | 0.134 | 1.634 |

### 消融实验

原表 3 在 Inter-X 上改变训练损失。这里并列给出 FID、滑步和双人互穿，便于看到每个改动主要影响哪类误差。[表 3][t3]

| 规划器设置 | 动作 FID ↓ | Skate ↓ | 双人 IV ↓ |
|---|---:|---:|---:|
| 完整，无文字 | 0.975 | 0.092 | 0.076 |
| 去掉双人接触损失 | 1.457 | 0.107 | 0.119 |
| 去掉足部损失 | 1.009 | 0.239 | 0.094 |
| 去掉窗口接缝损失 | 1.023 | 0.113 | 0.100 |

**坐标与采样步数。** 附表 7 中，取消以响应者为中心的共同坐标后，FID<sub>cd</sub> 从该表完整版的 1.694 升至 5.737；仅去掉接触矩阵为 3.542。表 3 中，把默认八步缩为两步，规划耗时从 13.6 降到 3.8 毫秒，动作 FID 从 0.975 升到 1.809；使用一百步时 FID 为 0.908，耗时 170 毫秒。增加步数能改善这项离线指标，也拉长单次规划时间。[表 7][t7] · [表 3][t3]

**跟踪还是避让。** 附表 8 单独比较 Inter-X 的低层策略。作者在此项测试中关闭仿真器对两人之间碰撞的自动阻挡，以便测出策略自身留下的互穿量。这个表属于单独评测，请在表内比较 IV。Succ 为参考动作的跟踪成功率。[表 8 与评测说明][policytable]

| 低层策略 | 双人 IV ↓ | 跟踪成功率 ↑ | 平均关节位置误差 ↓ |
|---|---:|---:|---:|
| PHC 基线 | 4.7 | 84.1% | 47.6 |
| 作者跟踪策略 | 1.4 | **95.6%** | **37.3** |
| 作者感知真人偏差的策略 | **0.05** | 84.0% | 51.7 |

### 关键发现

1. **站稳和接准是两件事。** 加物理跟踪后，两个数据集的滑步都大幅下降，动作 FID 却都变差。两人互穿在 Inter-X 上减少，在 InterHuman 上反而增加。只报告脚是否站稳，会让人高估系统处理另一具身体的能力。[表 2][t2] · [表 4][t4]
2. **允许偏离参考，是控制策略真正做出的选择。** 附表 8 中，感知真人偏差的策略把互穿从 1.4 降至 0.05，同时牺牲 11.6 个百分点的跟踪成功率。若目标是完成一次握手，还应该分别测量“应接触时是否接触”和“对方取消时能否及时停手”；上表两列都不能单独回答这两个问题。[表 8][policytable]
3. **人评覆盖短时互动体验。** 作者邀请 15 人，各看 20 段视频，并分别体验平均约 30 秒 VR。参与者比较了反应的多样性、真实感与接触观感。这个实验补足了数字指标看不到的观感，但没有测量握力、接触持续时间或硬件响应延迟。[附录 C.5][userstudy]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **预测对方也能帮助发现自己猜错了。** 许多生成器只把第二个人的未来当作训练信号。这里的真人预测还进入运行中的跟踪器，成为检查旧计划是否仍适用的参照。对实时角色而言，这是联合预测双方相较于只输出一个回应的具体收益。[式 9][policy] · [式 10–11][reward]
- **把接触的三个层次说清楚。** 腕部距离阈值给出训练标签，接触损失调整生成的运动学目标，物理跟踪决定角色实际走到哪。追查一次“握空了”的结果时，可以分别检查两腕的预测关系、参考姿势和执行后的姿势。[§3.3][plan] · [表 8][policytable]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **H1 的证据来自虚拟环境。** 作者在 VR 中用 Unitree H1 模型替换虚拟角色，展示了握手动作。真人佩戴头显、实时摄像以及仿真中的机器人是三个不同环节。论文把部署到实体机器人列作未来工作；图 4 无法给出实机接触力和安全距离。[§4.2 与图 4][robot]
- **短历史容易忘掉较早的约定。** 默认 20 帧历史在 30 FPS 下约为 0.67 秒。如果两人先约好稍后交换位置，再隔几秒执行，当前窗口未必保留足够的线索。作者把长时记忆及规划、更细的手指与表情、多人或道具交互列入后续方向。[附录 D][limits]
- **开源范围影响能复现哪一步。** 截至 2026 年 11 月 27 日，作者仓库已提供数据处理、扩散规划器训练、采样和评测，未找到 Human-X 的预训练权重。采集、物理跟踪及端到端演示仍列为待发布。公开的 Inter-X 复现配置默认关闭文字、使用 7 × 7 交互表示和五步 DDIM 采样；核对论文数字时需区分正文的文字设置、6 × 6 表示和八步扩散。[发布清单][repo] · [固定版本配置][config] · [论文设置][setup]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **ReGenNet（CVPR 2024）** 建立了由发起者动作生成响应者动作的任务，并用跨人距离帮助建模。Human-X 进一步要求系统在真人未来仍未知时工作，增加了联合预测和基于实测偏差的执行层。[ReGenNet 原文][regennet] · [Human-X 比较设置][baselines]
- **Think-Then-React（ICLR 2025）** 关注抬手究竟意味着握手还是击掌，先生成文字描述，再据此产生动作。Human-X 的中间结果是一段可跟踪的双人运动和接触关系，更适合追问“决定握手以后，看到对方的手偏了该怎么办”。[本站 Think-Then-React 解读][think] · [Human-X 表示][repr]
- **PHC** 提供了仿真人形角色跟随参考动作的基础。Human-X 加入预测与实测的真人姿态后，可以在跟准目标与避开意外运动间调整。比较这两类控制器时，除了检查单人关节误差，还应记录双人互穿和任务所需的接触。[PHC 作者项目][phc] · [Human-X 附表 8][policytable]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- [ICCV 2025 正式会议记录][cvf] · [会议论文 PDF][pdf] · [补充材料 PDF][supp]
- [arXiv 完整 HTML，含附录、公式和实验表][html] · [作者项目与握手视频][project]
- [作者代码与发布清单][repo] · [扩散规划器配置][code]

</div>

[html]: https://arxiv.org/html/2508.02106v1
[pdf]: https://openaccess.thecvf.com/content/ICCV2025/papers/Ji_Towards_Immersive_Human-X_Interaction_A_Real-Time_Framework_for_Physically_Plausible_ICCV_2025_paper.pdf
[supp]: https://openaccess.thecvf.com/content/ICCV2025/supplemental/Ji_Towards_Immersive_Human-X_ICCV_2025_supplemental.pdf
[cvf]: https://openaccess.thecvf.com/content/ICCV2025/html/Ji_Towards_Immersive_Human-X_Interaction_A_Real-Time_Framework_for_Physically_Plausible_ICCV_2025_paper.html
[project]: https://humanx-interaction.github.io/
[repo]: https://github.com/humanx-interaction/Human-X-Interaction
[code]: https://github.com/humanx-interaction/Human-X-Interaction/blob/main/src/humanx_diffusion/README.md
[config]: https://github.com/humanx-interaction/Human-X-Interaction/blob/b0e73acb58906bc0985183a373effcab27dab063/config/diffusion/train_interx_paper_repro_v2.yaml
[fig]: https://arxiv.org/html/2508.02106v1#S2.F2
[intro]: https://arxiv.org/html/2508.02106v1#S1
[related]: https://arxiv.org/html/2508.02106v1#S2
[overview]: https://arxiv.org/html/2508.02106v1#S3.SS1
[capture]: https://arxiv.org/html/2508.02106v1#S3.SS2
[plan]: https://arxiv.org/html/2508.02106v1#S3.SS3
[repr]: https://arxiv.org/html/2508.02106v1#S3.E1
[planner]: https://arxiv.org/html/2508.02106v1#S3.SS3.SSS2
[algo]: https://arxiv.org/html/2508.02106v1#alg1
[losses]: https://arxiv.org/html/2508.02106v1#S3.SS3.SSS2.Px1
[policy]: https://arxiv.org/html/2508.02106v1#S3.SS4
[apps]: https://arxiv.org/html/2508.02106v1#S4
[handshake]: https://arxiv.org/html/2508.02106v1#S4.F4
[robot]: https://arxiv.org/html/2508.02106v1#S4.SS2
[protocol]: https://arxiv.org/html/2508.02106v1#S5.SS1
[setup]: https://arxiv.org/html/2508.02106v1#S5.SS2
[baselines]: https://arxiv.org/html/2508.02106v1#S5.SS3
[t2]: https://arxiv.org/html/2508.02106v1#S5.T2
[t3]: https://arxiv.org/html/2508.02106v1#S5.T3
[schedule]: https://arxiv.org/html/2508.02106v1#alg2
[reward]: https://arxiv.org/html/2508.02106v1#A2.SS2
[t4]: https://arxiv.org/html/2508.02106v1#A3.T4
[t7]: https://arxiv.org/html/2508.02106v1#A3.T7
[ablation]: https://arxiv.org/html/2508.02106v1#A3.SS3
[policytable]: https://arxiv.org/html/2508.02106v1#A3.T8
[userstudy]: https://arxiv.org/html/2508.02106v1#A3.SS5
[limits]: https://arxiv.org/html/2508.02106v1#A4
[regennet]: https://openaccess.thecvf.com/content/CVPR2024/papers/Xu_ReGenNet_Towards_Human_Action-Reaction_Synthesis_CVPR_2024_paper.pdf
[phc]: https://www.zhengyiluo.com/PHC-Site/
[think]: /blog/iclr2025-think-then-react/
