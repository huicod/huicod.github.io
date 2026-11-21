---
title: "[TMM2024] ICGN：让同一句话的手势按指定帧数生成"
description: "解读 Implicit Compositional Generative Network for Length-Variable Co-Speech Gesture Synthesis。沿着同一句话从每秒 15 帧到 60 帧的例子，追踪时间查询、语音分解、粗细姿态相加，以及高帧率、语义和情绪结论各自的实验证据。"
pubDate: "2026-11-21"
badge: "Paper"
tags: ["ICGN", "Co-Speech-Gesture", "Implicit Neural Representation", "Temporal Coordinates", "Audio-to-Motion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

[作者公开的全文 PDF][pdf] · [IEEE 期刊记录][ieee] · [通讯作者论文目录][publications]

<details class="paper-meta"><summary>论文信息与阅读范围 · IEEE Transactions on Multimedia 2024</summary>

*Implicit Compositional Generative Network for Length-Variable Co-Speech Gesture Synthesis*。作者为 Chenghao Xu、Jiexi Yan、Yanhua Yang、Cheng Deng，发表于 *IEEE Transactions on Multimedia* 第 26 卷，6325–6335 页。2023 年 12 月 29 日首次在线，正式卷版日期为 2024 年 4 月 10 日。下文依据作者在西安电子科技大学主页提供的 11 页全文，核对图 3 的条件输入、式 1–18 和表 I–V。作者主页未列出这篇的配套训练代码，数值均取自论文。[卷版首页][p1] · [作者主页][author]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

同一句约四秒的讲话，要为 15 FPS 和 60 FPS 的画面各配一段手势，ICGN 的做法是换一组疏密不同的**时间查询**。每个查询都能读取这段声音，分别预测动作的大致轮廓和局部变化，两路相加得到该时刻的姿态。论文用真实观众比较了四倍帧率下的生成效果，也检验了给两路分别施加动作监督的作用。[图 3][p3] · [图 4][p6] · [表 V][p8]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　给定一段说话声，模型可以输出上半身关键点；加入转录和说话者身份，还能利用同一句话的语言内容和个人动作风格。常见做法按固定长度的片段训练和生成。[任务定义][p3] · [Trimodal Context][tricon]

**现有痛点**　如果已经生成的两个姿态之间缺三帧，线性插值会把它们排在一条直线上。可人在重读某个词时，手腕会先加速、再收住。这三个中间时刻的动作取决于讲话和整个手势的发展。[原文图 2][p2]

**核心矛盾**　语音前端按自己的时间分辨率提取特征，动画则需要按交付帧率取样。与此同时，一次抬手的总体方向和手腕瞬间的小幅摆动都落在同一副骨架上，却在不同时间尺度上变化。[原文 §III-B–C][p3]

**本文目标**　让同一生成器按需要输出不同数量的姿态，维持动作的自然度、流畅度和与语音的节奏对应。论文把可变长度具体落实为同段语音的不同输出帧数，并用 15 与 60 FPS 作人评对照。[可变帧数定义][p4] · [人评协议][p8]

**切入角度**　把动作建模成“给定整段语音，在时间 t 会是什么姿态”的函数。使用者改变要查询的时刻，模型便可以保留相同的语音条件和权重，输出新的时间网格。[原文式 1–2][p3]

**核心 idea**　把声音的倒谱特征和音量／起音特征分开编码，将同一批时间查询送入两路注意力。一路学习经平滑得到的动作轮廓，另一路补充局部动作变化，再把两者合成为完整姿态。[原文图 3][p3] · [式 16–17][p5]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

先看**什么决定输出长度**。音频侧提供条件序列，动作侧独立选择目标帧数 T′。模型用 T′ 个时间查询从语音中读出 T′ 组特征。再看**每一个姿态怎样生成**。相同时间位置分别经过 Transformer 和一维卷积，两者预测同一组关节的两个分量，最后逐元素相加。训练所需的参考动作画在图底部。[架构图与任务定义][p3] · [生成与监督][p4]

<figure class="reading-figure"><a href="/paper-notes/icgn/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/icgn/architecture.svg" alt="ICGN 让归一化时间坐标查询两类语音特征，结合转录与说话者身份，分别经 Transformer 和卷积生成粗动作与细动作，再逐帧相加。训练侧使用参考姿态及其平滑分量与差值。" loading="lazy" /></a><figcaption>依原文图 3 与式 1–17 重绘。沿两侧实线看语音内容如何进入预测，沿虚线看用户要求的帧数在哪里生效。点击可放大。</figcaption></figure>

### 关键设计

1. **先定目标时刻，再去声音里查。** 在语音片段归一化的时间区间 [−1, 1] 上选择 T′ 个位置，经 Fourier 编码得到查询 Q。注意力的键和值来自输入条件，查询的行数决定输出的行数。原文图 3 标出两路注意力共享权重；实验令隐特征维度为 256，注意力头数为 1。这里使用 Fourier 的对象是**时间坐标**，输出是姿态特征；作者没有给每个频率分量赋予一个可命名的动作。[式 1–2][p3] · [式 2 及说明][p4] · [实验设置][p6]

2. **把三种声学线索送给两个编码器。** Ec 编码 MFCC（梅尔频率倒谱系数），Ee 编码从声音振幅取得的二值音量标记，以及反映声音起始与重音变化的起音强度包络。图 3 和式 2 还把转录特征、说话者身份特征纳入条件。作者称两路分别感知“内容”和“情绪”，但训练材料里用于后一路的直接信号是音量、起音和姿态变化，没有提供“愤怒”“开心”等情绪标签或编辑指令。论文也没有给出移除文本、身份后的推理对照。[图 3][p3] · [条件拼接][p4] · [式 15–17][p5]

3. **同一个关节有两份预测。** 内容分支用 Transformer 解码主要运动，表现分支用一维卷积预测细节。两份输出形状相同。比如腕部上抬的整体轨迹来自粗分支，某个音节附近的细部修正可由卷积分支表达。这里说明的是两支分工的设计意图，论文没有对特定词与特定腕部运动作逐帧语义标注。[式 3–5][p4]

4. **用动作本身构造训练目标。** 在每个关节的时间轨迹上取宽度 W 的滑动均值，当作粗动作。作者给粗动作、细动作和最终姿态分别施加 Huber 损失，再加入说话者风格多样性损失与对抗损失。原文有一处值得复现时核查：式 5 把粗、细动作**相加**，但式 7 将细动作目标印为**粗目标减原姿态**，两式不能同时给出严格的残差重建。公开稿未说明实际代码采用的符号；数值实验仍按原表报告。[式 5–14][p4]

### 一个完整例子

假设同一段约 4.2 秒的语音要配两版动画。沿用论文 2D 设置中报告的 **64 个姿态**，四倍密度的例子对应 **256 个姿态**。选择某个重读音节作为观察点，这个例子可从输入跟到输出。[实验配置][p6] · [15 与 60 FPS 对照][p8]

| 环节 | 约 15 FPS 的版本 | 同一录音、四倍查询密度的版本 |
| --- | --- | --- |
| 音频条件 | 提取 MFCC、音量、起音，结合转录与身份特征 | 复用同段输入和两路编码器 |
| 查询 | 在归一化时间轴上布置 64 个目标位置 | 换为 256 个目标位置；实际讲话时长相同 |
| 生成中间姿态 | 每个时刻产生一个粗动作、一个细动作，逐元素相加 | 新位置也通过注意力读取语音，再预测姿态，模型可以在两个原采样时刻之间给出非匀速轨迹 |
| 检验 | 观察动作在重音附近如何起势、减速 | 把结果和低帧率生成后线性插值的版本对照；速度是否更自然需要观看轨迹或进行人评 |

### 训练与推理

作者报告使用一张 2080 Ti，Adam 学习率 0.0001，2D 任务批量 32、3D 任务批量 128。常用设置 W=5，重建、风格多样性、对抗损失的权重依次为 50、0.01、1。数据段长度随实验而异：实现段给出约 4.2 秒／64 姿态的设置，TED Gesture 的数据预处理另外给出 15 FPS、34 帧一段、步幅 10 帧。推理时改时间查询密度即可测试四倍帧率。论文没有报告训练总时长、生成 60 FPS 动画所需的墙钟时间或流式首帧延迟。[数据设置][p5] · [实现细节][p6] · [3D 训练设置][p8]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 2D 主结果：速度轨迹与动作多样性

Speech2Gesture 使用八位说话者的上半身关键点，扩展版则包含 Oliver、Kubinec、Xing、Luo 四人，另有脸部关键点。表格合并原表 I–III 的部分列。LVD 衡量预测与参考关键点速度的差别；Diversity 用生成片段在特征空间中的距离衡量多样性。前两列来自不同数据集或不同说话者，按列比较。[数据、指标][p5] · [原表 I–III][p6]

| 方法 | Speech2Gesture，LVD ↓（原表 Average 列） | 扩展版 Oliver，LVD ↓ | 扩展版 Xing，LVD ↓ | 扩展版 Diversity ↑ | Speech2Gesture Diversity ↑ |
| --- | ---: | ---: | ---: | ---: | ---: |
| S2G | 10.5 | 5.41 | 5.63 | 31.44 | 35.73 |
| TriCon | 10.2 | 5.11 | 5.74 | 35.05 | 42.31 |
| Tmpt | 9.1 | 4.86 | 5.29 | 39.29 | 45.86 |
| **ICGN** | **8.4** | **4.53** | **5.07** | **42.51** | **50.03** |

速度误差与多样性在上述汇总列同时改善。拆到个体后仍有例外，例如原表 II 的 Conan 上 Tmpt 为 **5.7**，ICGN 为 **5.8**。另一个细节是原表 II 的 Average 列与八位说话者可见数值的简单算术平均不一致；这里保留原列值，论文未交代该列的聚合权重。[原表 II][p6]

### 3D 主结果：手指加入后怎样？

TED Gesture 采用 10 个上身关节的方向向量。TED-Expressive 用 13 个上身点和 30 个手指点描述更精细的姿态。FGD 比较生成与真实动作的整体分布，越低越好；BC 衡量声音拍点与动作减速点的对应，多样性衡量动作之间的差异。[原表 IV][p7] · [关键点定义][p5]

| 方法 | TED Gesture FGD ↓ | BC ↑ | Diversity ↑ | TED-Expressive FGD ↓ | BC ↑ | Diversity ↑ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 真实动作 | 0 | 0.698 | 108.525 | 0 | 0.703 | 178.827 |
| TriCon | 3.729 | 0.667 | 101.247 | 12.613 | 0.563 | 154.088 |
| HA2G | 3.072 | 0.672 | 104.322 | 5.306 | 0.641 | 173.899 |
| **ICGN** | **2.415** | **0.681** | **105.837** | **3.932** | **0.693** | **176.644** |

相较 HA2G，加入手指的 TED-Expressive 上 FGD 从 5.306 降到 3.932，BC 从 0.641 升到 0.693。这两列支持分布质量和节奏对应的改善；要判断“说到左边时手指是否真的指向左边”，还需带方向标注的事件评估。[原表 IV][p7]

### 消融：粗细监督和滤波窗口

W=1 时，作者保留最终姿态的重建项，不再用分量目标监督；W>1 时，同时监督粗、细和完整姿态。实验在 Speech2Gesture Extended 进行，E_lip 是以真实唇距为参照的归一化误差。训练同时改变了分解与损失项，所以此表支持二者合用，无法单独判定差异全部来自哪一种网络结构。[表 V][p8] · [消融解释][p9]

| 窗宽 W | L2 ↓ | E_lip ↓ | LVD ↓ | Diversity ↑ |
| --- | ---: | ---: | ---: | ---: |
| 1 | 51.26 | 0.171 | 5.23 | 39.86 |
| 3 | 48.59 | 0.166 | 5.11 | 41.99 |
| 5 | 47.18 | **0.165** | **5.04** | 42.51 |
| 7 | **47.03** | 0.167 | 5.09 | **42.63** |
| 9 | 48.34 | 0.168 | 5.12 | 42.60 |

以默认 W=5 为例，速度误差由 5.23 降到 5.04，多样性由 39.86 升到 42.51。W=7 在位置误差与多样性上略优。窗口的选择确实会影响“哪些变化算作细节”，且最优窗口取决于读哪一项指标。[原表 V][p8]

### 高帧率的人评测了什么？

30 位参与者为约 15 秒的片段评价自然度、流畅度、语音与手势拍点匹配程度，每项 1–5 分；每种方法生成 10 段。四倍帧率的 Tmpt 用线性插值，ICGN 使用更密的时间查询。图 4 中 ICGN 的 60 FPS 结果在三项上都高于插值后的 Tmpt，图 7 给出三维坐标轨迹实例。柱图没有标注每个柱子的精确值或误差区间。此对照同时更换底层生成器和升帧方式，不能据此估计同一模型中“只换采样器”的净效应。[图 4][p6] · [人评协议与图 7][p8]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **生成帧数可以成为接口参数。** 只要查询时还能读取整段语音，展示端就能按自己的帧数需求向同一模型取样。对虚拟演讲者而言，同一段录音可用于低帧率预览和高帧率输出。[式 1–2][p3] · [四倍帧率对照][p8]
- **粗细动作可以有廉价的训练信号。** 只需要参考关键点和一个时间窗口，便可为两条分支构造不同目标。表 V 又让读者看到，多分辨率监督在速度误差和多样性上带来的幅度。[表 V][p8]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **帧数与流式时长是两件事。** 四倍取样实验固定了语音片段的时长。整段条件参与注意力，原文没有演示讲话尚未说完时怎样持续生成，也没有测长时间播出的漂移。[图 3][p3] · [人评设置][p8]
- **“内容／情绪”仍是对信号的解释。** 音量、起音会随语气变化，也受录音增益与说话习惯影响。没有固定文本只交换情绪或固定语气只交换文本的实验，也没有验证会意手势与词义之间的逐事件一致性。[声学分路][p5] · [消融项目][p9]
- **高帧率的准确性仍可单独检验。** 图 7 展示查询曲线可以产生非线性变化。要判断新帧是否接近真实瞬间运动，最直接的测试是用高帧率动捕作参照，保留中间帧作为未见目标，再逐帧比较腕部位置、速度和峰值时刻。这里是从评测协议引出的后续检验。[图 7 与讨论][p8]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **Speech Drives Templates（Tmpt）** 用不同的模板向量为同一段语音表达多种可行手势。ICGN 将它用于二维数据和人评的直接比较。若关心的是呈现帧率，需留意实验里的 Tmpt 是先生成再插值。[Tmpt 作者项目][tmpt] · [ICGN 人评][p8]
- **HA2G、TriCon** 分别利用分层音频与身体的关联，以及文本、音频、说话者身份。两者都出现在 ICGN 三维主表。ICGN 这次增加的是可重新取样的时间查询与粗细姿态监督。[HA2G 论文][ha2g] · [TriCon 论文][tricon] · [直接对照][p7]
- **HIP** 也做伴随语音的动作分解，但选择周期和非周期分量，并利用面部、身体与手之间的层级关系。回顾两篇时可以问同一个问题：分量来自哪里？ICGN 的粗分量有可计算的滑动均值目标，HIP 则显式学习周期表示。外观相似的摆动，在这两套模型里会由不同的量描述。[站内 HIP 解读][hip] · [ICGN 分量构造][p4]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- 正式卷版、完整实验与出版时间。[作者公开的 11 页 PDF][pdf] · [IEEE 期刊记录][ieee] · [通讯作者论文目录][publications]
- 定位关键材料。[图 3，完整架构][p3] · [式 5–14，输出与监督][p4] · [二维结果与人评图][p6] · [三维主表][p7] · [表 V，分量消融][p8]

</div>

[pdf]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/Papers/Journal/TMM2024_Chenghao.pdf
[p1]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/Papers/Journal/TMM2024_Chenghao.pdf#page=1
[p2]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/Papers/Journal/TMM2024_Chenghao.pdf#page=2
[p3]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/Papers/Journal/TMM2024_Chenghao.pdf#page=3
[p4]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/Papers/Journal/TMM2024_Chenghao.pdf#page=4
[p5]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/Papers/Journal/TMM2024_Chenghao.pdf#page=5
[p6]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/Papers/Journal/TMM2024_Chenghao.pdf#page=6
[p7]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/Papers/Journal/TMM2024_Chenghao.pdf#page=7
[p8]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/Papers/Journal/TMM2024_Chenghao.pdf#page=8
[p9]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/Papers/Journal/TMM2024_Chenghao.pdf#page=9
[ieee]: https://ieeexplore.ieee.org/document/10376294/
[publications]: https://ee.xidian.edu.cn/faculty/chdeng/Welcome%20to%20Cheng%20Deng%27s%20Homepage_files/home_publications.html
[author]: https://shydyl.github.io/
[tmpt]: https://shenhanqian.github.io/sdt
[ha2g]: https://openaccess.thecvf.com/content/CVPR2022/papers/Liu_Learning_Hierarchical_Cross-Modal_Association_for_Co-Speech_Gesture_Generation_CVPR_2022_paper.pdf
[tricon]: https://arxiv.org/abs/2009.02119
[hip]: /blog/tip2026-hip/
