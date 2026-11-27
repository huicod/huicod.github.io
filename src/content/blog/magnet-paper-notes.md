---
title: "[arXiv2025] MAGNet：给定一人的整段动作，或只给两人的过去，怎样生成下一步互动？"
description: "Diffusion Forcing for Multi-Agent Interaction Sequence Modeling。用双人舞拆解 MAGNet 的人物与时间条件、多人动作词元和联合去噪，核对长序列、穿模与公开补全代码中的未来相对位姿。"
pubDate: "2026-11-27T16:40:00+08:00"
badge: "Paper"
tags: ["MAGNet", "Diffusion Forcing", "多人动作生成", "交互预测", "动作补全", "双人舞", "自回归扩散", "VQ-VAE", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[arXiv HTML（正文与附录，可翻译）][html] · [同版 PDF][pdf] · [作者项目与动作演示][project] · [代码及权重][code]

<details class="paper-meta"><summary>论文信息与阅读范围 · arXiv 2025，2026 年修订</summary>

正式题名为 *Diffusion Forcing for Multi-Agent Interaction Sequence Modeling*，方法名 MAGNet（Multi-Agent Generative Network）。Vongani H. Maluleke 与 Kie Horiuchi 共同一作，其他作者为 Lea Wilken、Evonne Ng、Jitendra Malik、Angjoo Kanazawa。首版发表于 2025 年 12 月 19 日，本文按 2026 年 3 月 26 日的 v2 解读。截至 2026 年 11 月 27 日，第一作者主页将其列为审稿中。[版本记录][versions] · [第一作者主页][author]

下文的数字均为论文报告值。已核对作者公开的训练与推理源码、配置和权重目录，未独立运行模型或重算指标。文中专门区分论文给出的任务定义与公开离线示例实际读取的字段。[附录 A.3][arch] · [公开实现快照][code]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

**MAGNet 把多人动作排成一张“人 × 时间”的表。** 给定甲完整的舞步，填乙那一行，就是舞伴补全；只给两人开头几步，同时填后面的列，就是联合续写。它能用同一个去噪器做这些事，靠的是两处设计：每个格子既记录自己怎么动，也记录伙伴相对自己在哪里；训练时，每个格子分别加噪，推理时就能指定哪些格子可见、哪些需要生成。[方法总图][fig3] · [采样方式][sampling]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状**　多人动作研究常见两种设置。一种拿到一位舞者的完整动作，为其配舞；另一种只有截至当前的观测，让虚拟角色做下一步反应。两者都输出三维人体动作，但决策时能看到的信息不同。[表 1][scope]

**现有痛点**　为舞伴补全训练的模型可以提前看到甲转向哪里。拿它驱动实时角色时，那段未来动作尚未发生。反过来，让两个只会各自续写的模型同时行动，它们即使各自走得合理，也可能对下一步向哪边转做出不相容的选择。[§2][related] · [§3.3][sampling]

**核心矛盾**　两个人的未来彼此相关，但某个人的未来有时已知，有时未知，有时又刚由模型生成。把甲永久固定为输入、把乙永久固定为输出，很难在这三种情况下复用同一套模型。[原图 3][fig3]

**本文目标**　从已有的骨骼动作出发，补全某个人、预测单人或多人的未来，并把短预测窗口滚动成较长的连续互动。实验覆盖双人舞、双人运动和最多四人的社交动作。输入条件主要是人的动作；本文的舞蹈实验无需文本提示或音乐轨道。[数据与设置][data] · [基线设置][baselines]

**切入角度**　把问题改写为“这一个时间块里，哪些人的动作已知”。再把每个人与伙伴的相对位置和朝向写进格子，模型便有了推断下一步的空间依据。例如，向右侧身时，舞伴位于身前还是侧后方，会改变合适的后续动作。[原图 2][fig2] · [式 6][token]

**核心 idea**　训练中，同一时刻的甲可以几乎清晰，乙可以几乎全是噪声；两个都模糊也可以。推理时固定观测，将未观测部分从噪声逐步还原。决定“由谁先动”的是采样顺序；共同去噪则允许两人的未来在生成中一起调整。[§3.2][model] · [附录采样图][schedules]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

先训练单人的姿态编码器，把每四帧压成一个姿态向量。随后为每人加上自己的移动量和到其他人的相对变换，将所有人的词元交给一个 Transformer。推理时先选可见条件，再选择由谁和谁一起去噪，最后把姿态向量和预测的根部运动还原成连续三维动作。[原图 2][fig2] · [原图 3][fig3]

<figure class="reading-figure"><a href="/paper-notes/magnet/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/magnet/architecture.svg" alt="MAGNet 完整架构。每位舞者的姿态先经单人编码，加入自身根部运动和伙伴相对变换，交给共享去噪器；人物和时间掩码决定是补全舞伴还是共同预测未来，最后逐人解码。" /></a><figcaption>按原文图 2、图 3 和附录 A.3 重绘。读下半部时，先看每一行是谁，再看哪几列可见。方格表示论文定义的任务；公开舞伴补全实现还需检查格子内部的相对位姿字段，见下文。</figcaption></figure>

### 关键设计

**1. 把局部姿态、自己的位移和人与人的站位分开。** 以每人骨盆在地面上的投影和身体水平朝向建立局部坐标系。第一组量描述关节旋转、骨盆高度和倾斜；第二组量描述自己的坐标系从上一帧到当前帧如何平移、转向；第三组量记录当前帧从自己到每一位伙伴的坐标变换。因此，整个双人舞台一起平移后，甲仍能读到“乙在我左前方”。[§3.1 与式 1–3][representation]

**2. 去噪器同时预测姿态向量与连续几何。** 单人 VQ-VAE 的码本有 1,024 项，每项 512 维，每四帧取一个量化向量。编解码时给定体形和自身跨帧变换；训练这个 VQ-VAE 时，重建目标是局部姿态。到了第二阶段，去噪器还要生成自己的跨帧变换和伙伴关系。它预测干净向量，公开代码直接将预测的姿态向量交给解码器。因此，“用了离散码本”并不意味着生成时逐个分类预测码本编号。[VQ 编码][vq] · [架构表 A.2][arch] · [解码实现][decoder]

**3. 用噪声等级表达每个格子有多少信息。** Transformer 依次读入“第一块的甲、乙，第二块的甲、乙……”；它同时获知格子属于谁、对应哪个时刻、受了多少噪声。论文对每个“人 × 时间块”分别抽取训练噪声等级，模型学习预测干净词元。联合采样时，同一时刻的人可以按相同噪声等级推进，仍各自保留随机扰动。[式 7–9][model] · [附录 A.6.2][noise]

**4. 让两条路径对同一相对位置给出相容的预测。** 假设上一帧乙在甲前方。模型既能直接预测这一帧的甲乙关系，也能从上一帧的关系出发，考虑甲自己怎么动、乙自己怎么动，推算出新关系。训练损失惩罚这两条路径的分歧。这个损失检查根部几何的一致性；两只手是否接触、鞋底是否打滑，还要在解码出的动作上另行衡量。[式 10–11][consistency] · [失败案例][failure]

### 一个完整例子

以两人八帧为一个**尺寸示例**。四倍下采样后，每人两个时间块，一共四个词元。双人设置下，每个词元有 584 个数：512 个姿态特征，加上四帧各 9 个自身变换量、四帧各 9 个到舞伴的变换量。9 个量由 6 维旋转表示和 3 维平移组成。因此，清除乙的词元时，还要问甲的词元里面有没有关于乙的信息。[式 6][token] · [词元的代码定义][tokcode]

设甲准备转身、乙准备跟步。下表按论文 §3.3 的条件分布说明，几种生成方式使用相同的动作表示，却在不同时间得到不同信息。[采样定义][sampling] · [各种时间表图示][schedules]

| 任务 | 生成下一步前，哪些动作可见？ | 模型生成什么？ |
|---|---|---|
| 舞伴补全 | 甲的整段，包含转身之后 | 乙与这段舞步配合的动作 |
| 单人未来预测 | 甲、乙截至上一时刻的历史 | 只生成乙的未来；此时尚未看到甲真正往哪转 |
| 联合未来预测 | 同样只有两人的历史 | 在一次联合采样中形成甲、乙相关的未来 |
| 同步、逐人独立采样 | 甲与乙都只读双方历史 | 各自同时决定当前动作，这一轮看不到对方刚生成的动作 |
| 异步、轮流采样 | 甲先读双方历史；乙额外看到甲刚生成的当前块 | 先出甲，再出乙，乙可以跟随这次已经生成的转向 |

**公开补全示例究竟知道多少？** 在作者的 DD100 离线脚本里，预处理用同一时刻两人的真实位置和朝向计算甲→乙变换；补全时读取整段记录，把甲的**完整词元**逐步固定为真值，同时只固定乙最初的历史。掩码作用在“人 × 时间”上，甲词元中的关系字段随之保留。这样，程序可从甲的已知词元读到乙未来相对甲的地面位置和朝向；乙未来四肢怎样摆动仍是待生成的。公开配置还给乙 32 帧开头动作。若实际只录到甲一个人，后续甲→乙字段从哪里来，就成了部署时要单独解决的问题。此处核对的是公开代码的数据路径，论文未报告遮掉该字段的对照，因此无法量化它对表 2 的贡献，也不能据此归因其他任务。[相对变换的计算][preprocess] · [整段数据的读取][prepare] · [关系字段][relcode] · [真值掩码][mask] · [DD100 配置][example]

### 训练与推理

两阶段分别训练。论文给出的去噪器是 6 层、8 头的 Transformer，使用 1,000 级训练噪声。作者报告，一个完整配置的 **DFoT 阶段**在一张 48 GB RTX A6000 上训练约一天；这个时间未包括 VQ-VAE、各数据集模型以及所有实验的训练总量。附录的通用设置为 30 步 DDIM，公开 DD100 补全示例设为 50 步并启用平滑与脚滑引导。复现实验时需记录采用的具体配置。[附录 A.3][arch] · [DD100 推理配置][example]

长序列推理会保留上一窗口末端的已生成动作作为新历史，然后继续采样。论文分别在各数据集训练；“一个模型切换多种任务”指固定权重后可以换采样方式。Embody3D 的混合人数模型在训练中随机遮掉人物，作者用同一套权重评估两人、三人和四人，公开实现按配置限定最多可容纳的人数。[实现设置][mixed] · [基线训练设置][baselines] · [公开权重][weights]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

**读表口径。** FD 越低，生成动作特征的整体分布越接近真实数据；MPJPE 是对应关节的位置误差。IP 用身体各部位的胶囊近似量估计互穿深度，FS 测量脚在接地时的滑动速度，两者越低越好。DIV 越大表示采样变化越大，本身无法判断动作是否合理。下表节选原文指标，列名和方向保留。[原文实验与指标][experiments]

### 主实验

**① 给定一人整段动作，补另一人。** 以下均为双人舞。作者为这项实验重新训练了不带音乐条件的 Duolando。在 DD100 上，MAGNet 的 FD、互穿和关节误差都更低；换到 ReMoCap，这三项均由专门的 ReMoS 更好，MAGNet 采样的多样性略高。[原表 2][t2] · [基线设置][baselines]

| 数据集 | 方法 | FD ↓ | DIV ↑ | IP ↓ | MPJPE ↓ |
|---|---|---:|---:|---:|---:|
| DD100 | Duolando（去音乐重训） | 18.180 | 0.000 | 0.560 | 1.680 |
| DD100 | MAGNet | 0.048 | 0.130 | 0.120 | 0.110 |
| ReMoCap | ReMoS | 0.002 | 0.000 | 0.162 | 0.026 |
| ReMoCap | MAGNet | 0.029 | 0.028 | 0.176 | 0.074 |

**② 只给双方历史，预测一人或两人。** DuoBox 上，预测一个人时 MAGNet 的 FD、IP、MPJPE 都低于 Ready-to-React。两个人一起生成时，MAGNet 的 FD 和 IP 仍较低，但脚滑和对齐唯一真值的关节误差均更大。后者与“两个未来都需要猜”相容，单靠此表无法区分合理的另一种未来与真正的错误。[原表 3][t3]

| 目标 | 方法 | FD ↓ | DIV ↑ | FS ↓ | IP ↓ | MPJPE ↓ |
|---|---|---:|---:|---:|---:|---:|
| 预测一人 | Ready-to-React | 0.181 | 0.318 | 0.255 | 0.309 | 0.580 |
| 预测一人 | MAGNet | 0.067 | 0.669 | 0.270 | 0.019 | 0.218 |
| 共同生成两人 | Ready-to-React | 0.337 | 0.395 | 0.249 | 0.162 | 0.624 |
| 共同生成两人 | MAGNet | 0.118 | 5.622 | 0.407 | 0.101 | 0.714 |

**③ 从两人扩到四人。** Embody3D 主实验使用随机抽样和最近邻检索作对照。下面并排给出 FD 与 MPJPE。四人时这两项改善最明显；三人时，MAGNet 与最近邻的关节误差只差 0.013。这个实验说明混合人数模型优于这两种对照，尚未给出与其他专用四人生成器的直接比较。[原表 4][t4]

| 人数 | 随机抽样 FD / MPJPE ↓ | 最近邻 FD / MPJPE ↓ | MAGNet FD / MPJPE ↓ |
|---|---:|---:|---:|
| 2 | 0.885 / 0.668 | 0.659 / 0.646 | 0.298 / 0.561 |
| 3 | 0.431 / 0.617 | 0.566 / 0.539 | 0.293 / 0.526 |
| 4 | 2.039 / 0.894 | 2.143 / 0.880 | 0.590 / 0.546 |

### 消融实验

| DuoBox 消融设置 | FD ↓ | FS ↓ | IP ↓ |
|---|---:|---:|---:|
| 完整模型 | 0.052 | 0.423 | 0.116 |
| 去掉姿态 VQ-VAE | 4.476 | 5.682 | 0.057 |
| 去掉人物间相对变换 | 0.126 | 0.367 | 0.342 |

去掉 VQ-VAE 后脚滑从 0.423 升到 5.682，动作分布也明显变差，但互穿值反而更低。去掉人与人的相对变换时，互穿从 0.116 升到 0.342。两项实验分别支持姿态压缩对单人运动质量、相对几何对多人空间协调的作用。这里使用原表 5 自身的完整模型作对照，避免把不同表的评测数值混用。[原表 5][t5]

作者还单独比较了**联合预测时**两人各用各的噪声等级，和两人按同一等级推进。后者将 FD 从 0.716 降到 0.052，IP 从 0.231 降到 0.116，但 FS 从 0.223 升到 0.423。训练时让格子的噪声等级各自变化，赋予模型切换条件的能力；推理时具体采用哪种等级安排，仍然影响生成质量。[原表 A.6][noise]

### 关键发现

长序列是这篇很有辨识度的一项实验。在 DuoBox 上，给定开头 **4 帧**，滚动生成 **1,800 帧**，MAGNet 的 FD 为 **2.781**，Ready-to-React 为 **24.810**；对应的 IP 为 **0.116** 和 **0.345**。图 7 画出了误差随长度的变化。这支持 MAGNet 在该设置下积累的分布偏移较小，具体一次接触是否实现仍需逐帧查看。[§4.2 与图 7][long] · [长序列演示][longdemo]

在单张 A6000 的速度测量中，关闭平滑后，舞伴补全、单人未来预测、双人联合预测分别达到 **54、56、54 帧/秒**。这里统计的是模型生成吞吐量。角色要跟随摄像机中的真人时，还要计入人体追踪、上下文积累和首块动作输出的延迟；完整舞伴补全更预设了一条已知的未来轨迹。[原表 A.3][speed] · [采样定义][sampling]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **同一段录像可以提三个不同的问题。** 遮掉乙的一整行，考察配舞；遮掉两人末尾，考察共同续写；在同一时刻先揭晓甲，再生成乙，考察跟随。这个视角适合设计真人与虚拟角色的实验，因为每项实验都能写清系统做决定时究竟得到了什么。[采样图][schedules]
- **人与人的关系值得单独占用表示空间。** 两套局部姿态各自都能重建得很好，仍可能把人物放得过近。显式关系被移除时，脚滑略有改善，互穿却接近原来的三倍。把这两个指标分开看，才能判断改动究竟帮到了哪一部分。[原表 5][t5]
- **把“轮流”变成可以操作的推理变量。** 先生成甲，再把甲刚生成的动作给乙，就能研究信息到达先后对动作的影响。这个设置规定的是计算的先后；谁在舞蹈语义上发起邀请、乙是否理解了邀请，还需另有标注或实验。[轮流采样定义][agentic] · [表 3 的去噪偏移实验][t3]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

- **相对根部正确，四肢仍可能穿过身体。** 附录直接展示一人的手穿过另一人躯干。模型在动捕上学习，没有显式求解网格碰撞或接触约束。如果要生成精确牵手，应该分别记录手间距离、持续时间和身体互穿；单看 FD 无法回答这个问题。[附录 A.2 与失败图][failure]
- **模型需要一个人数上限。** 每人要保存到其余每位伙伴的变换，整组的有向关系项随人数按 P(P−1) 增长。当前公开配置的输入宽度和人物嵌入也依赖人数。论文直接验证的是二至四人，更多参与者、角色随时进出场仍有待检验。[式 6][token] · [人数设置][mixed] · [模型实现][capacity]
- **离线补全与真人跟随之间还差一个对照。** 对部署问题最有解释力的实验，是保留甲自身的完整动作和乙相同的起始历史，仅遮住甲词元中依赖乙未来的字段，再重报 DD100 指标。这是据公开实现提出的对照，原文没有给出它的结果。[真值注入][mask] · [原表 2][t2]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **Ready-to-React** 是理解本文贡献最直接的基线。两种方法都能从双方历史生成反应。看 MAGNet 的新增能力，应看“给双方同一段历史，在同一次采样中共同决定未来”，以及这种差异在长序列里如何积累。DuoBox 的短窗和长窗结果可以接着读。[原表 3][t3] · [长窗实验][long]
- **ARFlow、Human-X** 更集中于由已知动作驱动对应角色。ARFlow 在采样中校正互穿，适合研究空间约束；MAGNet 更适合研究谁的动作可见、什么时候让另一人看到。需要精确人体接触时，两条路线提供了不同的实验切入点，MAGNet 的表 2、表 3 没有给出对这两篇的数值比较。[站内 ARFlow 解读][arflow] · [站内 Human-X 解读][humanx] · [论文任务对照表][scope]
- **给交互式虚拟角色的启发。** 可把“听到的话”“观测到的真人动作”“角色自己刚生成的动作”分别标清时间。如果想测系统能否在真人抬手后及时回应，就只提供抬手发生前后真实可获得的观测，并测首次响应延迟。MAGNet 提供了改变动作可见性的办法；语音意图理解与指定手势语义，还需其他条件和评估。[单人预测与异步采样][sampling]

<span id="reading-8" class="reading-anchor"></span>

## 来源

- Vongani H. Maluleke、Kie Horiuchi 等，*Diffusion Forcing for Multi-Agent Interaction Sequence Modeling*。[arXiv 版本记录][versions] · [HTML v2][html] · [PDF v2][pdf]
- 逐项查看补全、联合预测、去噪顺序以及长时间生成效果。[作者项目与视频][project]
- 核对训练、公开采样路径、条件字段和预训练模型。[作者代码快照][code] · [模型权重清单][weights] · [DD100 补全配置][example]

</div>

[html]: https://arxiv.org/html/2512.17900v2
[pdf]: https://arxiv.org/pdf/2512.17900v2
[versions]: https://arxiv.org/abs/2512.17900
[author]: https://von31.github.io/
[project]: https://von31.github.io/MAGNet/
[longdemo]: https://von31.github.io/MAGNet/#ultralong
[code]: https://github.com/Von31/MAGNet-code/tree/98b4ca14bf05690e7eea8e737738a4b929a8e329
[weights]: https://github.com/Von31/MAGNet-code/blob/98b4ca14bf05690e7eea8e737738a4b929a8e329/README.md#dfot-checkpoints
[tokcode]: https://github.com/Von31/MAGNet-code/blob/98b4ca14bf05690e7eea8e737738a4b929a8e329/libs/model/dfot/diffusion_transformer.py#L15-L37
[capacity]: https://github.com/Von31/MAGNet-code/blob/98b4ca14bf05690e7eea8e737738a4b929a8e329/libs/model/dfot/diffusion_transformer.py#L197-L228
[decoder]: https://github.com/Von31/MAGNet-code/blob/98b4ca14bf05690e7eea8e737738a4b929a8e329/libs/model/dfot/network.py#L1715-L1721
[preprocess]: https://github.com/Von31/MAGNet-code/blob/98b4ca14bf05690e7eea8e737738a4b929a8e329/libs/dataloaders/preprocess_data.py#L340-L347
[prepare]: https://github.com/Von31/MAGNet-code/blob/98b4ca14bf05690e7eea8e737738a4b929a8e329/libs/model/dfot/network.py#L1923-L1940
[relcode]: https://github.com/Von31/MAGNet-code/blob/98b4ca14bf05690e7eea8e737738a4b929a8e329/libs/model/dfot/network.py#L1728-L1734
[mask]: https://github.com/Von31/MAGNet-code/blob/98b4ca14bf05690e7eea8e737738a4b929a8e329/libs/model/dfot/network.py#L1013-L1023
[example]: https://github.com/Von31/MAGNet-code/blob/98b4ca14bf05690e7eea8e737738a4b929a8e329/configs/inference/dfot/dd100_partner_inpainting.yaml
[scope]: https://arxiv.org/html/2512.17900v2#S2.T1
[related]: https://arxiv.org/html/2512.17900v2#S2
[fig2]: https://arxiv.org/html/2512.17900v2#S3.F2
[fig3]: https://arxiv.org/html/2512.17900v2#S3.F3
[representation]: https://arxiv.org/html/2512.17900v2#S3.SS1
[vq]: https://arxiv.org/html/2512.17900v2#S3.SS1.SSS0.Px1
[model]: https://arxiv.org/html/2512.17900v2#S3.SS2
[token]: https://arxiv.org/html/2512.17900v2#S3.E6
[consistency]: https://arxiv.org/html/2512.17900v2#S3.E11
[sampling]: https://arxiv.org/html/2512.17900v2#S3.SS3
[agentic]: https://arxiv.org/html/2512.17900v2#S3.SS3.SSS0.Px4
[schedules]: https://arxiv.org/html/2512.17900v2#S8.F3
[data]: https://arxiv.org/html/2512.17900v2#S4.SS0.SSS0.Px1
[baselines]: https://arxiv.org/html/2512.17900v2#S4.SS1.SSS0.Px2
[mixed]: https://arxiv.org/html/2512.17900v2#S4.SS0.SSS0.Px2
[experiments]: https://arxiv.org/html/2512.17900v2#S4
[t2]: https://arxiv.org/html/2512.17900v2#S4.T2
[t3]: https://arxiv.org/html/2512.17900v2#S4.T3
[t4]: https://arxiv.org/html/2512.17900v2#S4.T4
[t5]: https://arxiv.org/html/2512.17900v2#S4.T5
[noise]: https://arxiv.org/html/2512.17900v2#S6.T6
[long]: https://arxiv.org/html/2512.17900v2#S4.SS2.SSS0.Px5
[speed]: https://arxiv.org/html/2512.17900v2#S4.T3a
[failure]: https://arxiv.org/html/2512.17900v2#S2.F1
[arch]: https://arxiv.org/html/2512.17900v2#S3a
[arflow]: /blog/acmmm2026-arflow/
[humanx]: /blog/iccv2025-human-x/
