---
title: "[ICMI2024] Co-Speech Gesture Representations：对话手势的对比学习与内在评估"
description: "完整解读对话共语手势表征的单模态与跨模态对比学习、人工相似度评估和五类诊断探针；核对正文、补充实验、数据标注与官方代码，区分表征相关性、可读属性和动作生成控制。"
pubDate: "2026-11-17T11:10:00+08:00"
updatedDate: "2026-11-17"
badge: "Paper"
tags: ["Co-Speech-Gesture", "Motion-Representation", "Contrastive-Learning", "Gesture-Understanding", "Dialogue", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

全文入口：[arXiv HTML，可翻译阅读][html] · [10页正文PDF][paper] · [3页补充材料PDF][supp] · [正式出版DOI][doi]。代码：[作者仓库][code]。**原生HTML不含补充材料；本文已另行阅读补充全文，并核对方法图、实验图和原表。**

<details class="paper-meta"><summary>论文信息与阅读范围 · ICMI 2024 · 手势表征与内在评估</summary>

论文：*Learning Co-Speech Gesture Representations in Dialogue through Contrastive Learning: An Intrinsic Evaluation*。作者：**Esam Ghaleb、Bulat Khaertdinov、Wim Pouw、Marlou Rasenberg、Judith Holler、Aslı Özyürek、Raquel Fernández**。

正式出处：**ICMI 2024，274–283页**，会议于2024年11月4–8日在哥斯达黎加San José举行，DOI：**10.1145/3678957.3685707**。作者、页码、出版年及会议信息核对了[ACM向Crossref登记的出版记录][crossref]；本次直接访问ACM落地页受到访问限制，不将其写成已成功逐页读取。技术阅读依据为**2024-08-31的arXiv v1，10页**，以及UvA机构库的**3页补充材料**。[版本记录][abstract]、[机构正式记录][uva]

核查日期：**2026-11-17**。官方代码固定在提交 [0631b55][commit]，已静态检查骨架/语音网络、对比损失、数据加载、相似度评估、probe与训练配置。**本次没有加载模型运行推理、训练网络或重做基准实验。** 文中“原论文报告”“公开实现”和“本文分析”分别标明。

研究领域：对话共语手势、骨架表征、跨模态对比学习、内在评估、诊断探针。标题中的 *Co-Speech Gesture Representations* 是研究对象，不是作者另行命名的方法缩写。本文研究手势的表示与分析，不是语音到动作生成。

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

这篇论文把同一手势的不同骨架增强视图拉近，同时把手势与同期语音拉近，学习一个可用于**比较手势相似性、研究对话中的动作协调、探测形态属性**的向量表示；联合目标与人工形态相似度的Spearman相关系数为 **0.31**，高于手语识别初始化基线的 **0.23**。[§4–6][html]

这里得到的是连续隐向量。相似度与人工判断相关、某些属性可被分类器读出，并不意味着每个维度都是可读语义符号，更不意味着模型能生成动作、执行手势指令或保证指向目标正确。

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 手势模型经常围绕识别、分段或生成任务训练。生成研究也会借助自编码器特征计算FGD，但这些特征是否反映专家关心的形态关系，并不能从任务分数直接得到答案。本文把问题转向“手势表示本身有什么性质”，采用与词向量研究类似的内在评估。[§1、2.1][html]

**现有痛点：** 两个人都把一个陌生物体的部件比作“打开的书”，可能用不同的手、位置和轨迹来表达；同一个人描述不同物体，又可能重复个人惯用姿势。只比较关节路径容易混入身体尺度和视角差异，只学习一个下游标签也可能丢掉其他形态信息。本文图1中的“打开的书”案例贯穿了这种形态、所指对象与说话人之间的关系。

**核心矛盾：** 手势形式与意义不是一一对应。视觉相像可能来自共同所指、个人习惯或对话伙伴之间的协调；语音又与手势存在时间偏移。要把语音用作学习线索，需要同时保留骨架结构、容忍合理变形，并防止把所有相似度都解释成语义。[§1–3][html]

**本文目标：** 在面对面对话中学习具有可检验性质的手势表示：与人工形态相似度正相关；在同/不同说话人、同/不同所指、同/不同对话条件下出现理论预期的差别；还能通过轻量分类器恢复若干属性关系。论文没有把目标设为动作重建或自动生成可执行描述。

**切入角度：** 使用一个已有手语识别骨架网络和一个多语种预训练语音网络作为起点。骨架增强提供同实例的一致性监督，同期语音提供跨模态共现监督；已有的人工手势对编码则用于检查表示，而不是直接作为对比学习的类别标签。

**核心 idea：** 把“同一个手势在合理增强后应保持接近”与“手势应能匹配同期语音”合成一个训练目标，再把学出的空间交给三个层次的检验：整体形态相关性、对话条件分组和五类属性探针。这样可以判断表示具体保留了什么，而不只判断它能否把训练样本配对成功。

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练从同步的手势骨架与语音开始。视觉分支把一秒骨架窗编码成256维特征，再投影到128维；语音分支把两秒波形编码并聚合为128维，再经过投影头。两种增强骨架之间计算单模态对比损失，同期骨架与语音之间计算双向跨模态对比损失。训练后的**骨架分支可独立产生手势表示**，后续相似度分析与probe不需要用户提供一句动作指令。[图3、§4][html]

<figure class="reading-figure"><a href="/paper-notes/dialogue-gesture-representations/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/dialogue-gesture-representations/architecture.svg" alt="对话手势表征的完整教学架构：人工stroke产生骨架和语音配对窗，骨架增强经共享ST-GCN，语音经wav2vec2与CNN；两路投影通过单模态和跨模态对比学习训练；骨架投影后向量计算相似度，投影前向量供五个监督探针分类，没有动作生成解码器" loading="lazy" /></a><figcaption>本站依据原文§3–6、图3重绘的教学示意；语音骨干冻结状态来自公开代码。图中下方两条路径使用不同层的表示。点击查看大图。</figcaption></figure>

先看顶部的数据取窗，再沿蓝色骨架与绿色语音两条支路读到128维投影；中间橙色框说明正负样本和损失汇合。最后看底部：相似度使用投影后表示，probe使用ST-GCN输出。实线表示数据/表示流，橙色虚线表示损失汇合。**框架止于向量、相似度和属性关系预测，没有动作解码器，也没有约束求解器。**

### 关键设计

1. **先利用人工stroke定位，再用不同长度的视觉和语音窗口容纳上下文。**

   数据来自19组荷兰语面对面对话，共38人、超过8小时。参与者进行陌生物体指认游戏：每组完成六轮，每轮16次试验，每次交换描述者与匹配者角色；研究者未要求他们做特定手势。人工标注得到4,949个gesture stroke，平均610毫秒，并记录手势所指的物体子部件。[§3.1][html]

   Stroke是一个手势中最承载意义的动作段，但准备、回收与保持阶段也可能有用。因此作者以stroke为锚，用 <strong>一秒视觉窗、两帧步长、与stroke重叠超过50%</strong> 的规则取样，得到70,153个窗口。语音在视觉窗前后各扩0.5秒，总长两秒，容纳手势与言语不完全同步的情况。70,153是高度重叠的窗口数，不能当作独立手势数量。[§3.3][html]

   视觉使用MMPose检测的二维关键点，从133个点中保留27个上身与手部点，每点为 **x、y、检测置信度**。输入张量可写为 **3×T×27**，空间边连接身体拓扑，时间边连接相邻帧的同一关节。这里没有三维全身关节旋转、网格人体或语义动作token。

2. **用手语识别初始化骨架编码器，用多层语音特征提供跨模态线索。**

   骨架编码器采用ST-GCN路线，初始化来自Jiang等人的土耳其手语识别模型，输出256维向量；这是继承了有监督识别任务的预训练知识。语音使用wav2vec2 XLSR-300M，把24层Transformer输出作可学习加权，再经两层pointwise CNN聚合为128维。作者希望不同层共同提供内容与韵律线索，但本文没有分别测量这些线索的因果贡献。[§4.1][html]

   两个投影头将表示放入共同的128维空间，结构为线性层、ReLU、线性层；“三层”包含激活，并不是三层全连接。公开实现的wav2vec2骨干默认冻结，层权重、CNN、投影头和骨架网络可训练；骨架投影实现为256→128→128，与论文对中间层的文字说明不完全一致，复现时应核对版本。[语音实现][speech-code]、[双塔实现][model-code]

3. **单模态正样本是同实例增强，不是相同手势意义。**

   SimCLR式训练对同一骨架窗做两个随机增强，如镜像、缩放、移动、抖动与剪切。两个视图组成正样本，其余实例的视图作为批内负样本；目标是保留增强前后稳定的表示。正文写每种选用增强的应用概率为50%，补充材料进一步列出平移、旋转与尺度范围，未对语音作增强。[§4.2、式1–2][html]、[补充§B.2][supp]

   <div class="equation">单模态：正对＝同一个骨架窗的两种增强；负对＝批内其他骨架窗。<br />跨模态：正对＝同一时间实例的骨架与语音；负对＝批内错配骨架与语音。</div>

   因而，另一个人表达“打开的书”的手势不会仅因为所指相同就自动成为训练正样本。同所指、不同说话人的关系是在**训练后评估**中检验的。本文没有用referent标签构造语义正对，也没有显式排除语义相同的负样本。

4. **跨模态对齐与视觉一致性相加，而不是将两路特征拼成一个必须联合输入的表示。**

   设一批有N个同步实例，骨架投影为zᴳ，语音投影为zˢ，s为余弦相似度。以骨架i为锚，要求正确语音i比批内其他语音更接近；再反过来，以语音为锚匹配骨架。下面是原式3–4的单方向简写与联合目标：[§4.3–4.4][html]

   <div class="equation">ℓᴳ→ˢᵢ = −log { exp[s(zᴳᵢ,zˢᵢ)/τ] / Σₖ exp[s(zᴳᵢ,zˢₖ)/τ] }<br />Lₘₘ：对两个方向及批内实例取平均；L꜀ₒ = ½(Lᵤₙᵢ + Lₘₘ)。</div>

   温度τ控制相似度分布的尖锐程度。语音在训练时改变骨架表示的学习方向，使用时仍可单独编码骨架。官方实现也在仅请求骨架特征时提前返回，不执行语音分支；相似度脚本虽然构造了一个占位波形，但这条返回路径并不依赖它。[双塔forward][model-code]、[相似度脚本][similarity-code]

5. **把“整体接近”与“哪种形态关系可读出”拆开评估。**

   人工评估集含419对手势，来自同一对话的不同说话人，并指向同一个物体子部件。每对有五个二元形态相似度：handedness（用左手、右手或双手）、shape、position、movement、rotation。相似度实验将五个标签求和得到0–5分，与投影后向量的余弦相似度计算Spearman相关。[§3.2、5.1][html]

   Probe则取**投影前的256维ST-GCN特征**。论文对每个手势向量作32维线性变换和ReLU，将两路拼接，再用线性层与sigmoid预测某个属性是否相似，五种属性分别训练分类器。输入是一对表示，输出是“这两段位置是否相似”等二元关系，**不是为单段手势输出“高位/低位”“旋转多少度”或动作语句**。探针整体包含非线性层，也不能把它的成功表述为“每个语义属性已对应一个线性坐标轴”。[§6.1][html]

### 一个完整例子

原文图1展示两位参与者用双手表示一个陌生物体中像“打开的书”的部件，两段配套话语都用“打开的书”作类比。以下沿用该案例说明处理流程；**论文没有公开这对样本的128维向量、余弦分数和五个probe概率，所以下面不虚构具体输出。**

1. 人工标注两段stroke边界及同一所指部件。以其中一段为锚取一秒视觉窗，同时取得前后扩展后的两秒语音。
2. 视觉检测转成27点时空图。训练时，骨架窗的两个增强视图经过共享ST-GCN与投影头，用单模态损失约束接近；同期语音经过另一分支，用跨模态损失匹配骨架。
3. 训练完成后，分别编码A、B两段骨架。两条128维投影向量可以计算余弦相似度。这项数值表示模型空间中的接近程度，不直接等于“含义完全一致”的概率。
4. 人工将该例五种形态关系均编码为相似，因此其人工总分为5。它与其他418对一起参与相关性检验；**这对跨说话人样本不是因为同为5分而被对比目标显式拉近的**。
5. 若做probe，改取两条256维编码器特征，由五个已监督训练的分类器输出各属性的相似性预测。整个流程结束于分析结果，没有把“书”变成新的动作序列。

### 训练/推理

**表征训练。** 补充§B.1报告：两张 **NVIDIA RTX A5000，每张24 GB**；Adam，学习率 **0.001**，最多 **200 epochs**；每GPU批量 **128**，温度 **0.1**；63,137个训练窗与7,016个验证窗，即90%/10%。未披露墙钟训练时长、GPU-hours或费用，也没有报告最低显存边界；不能将这套设备写成最低配置。

**监督范围。** 对比损失不直接使用五维形态标签，但它依赖同步音视频、**人工stroke分段**和已有手语识别/语音预训练模型。因而“自监督”指这一阶段的实例对应目标，不代表从无标注原始视频到最终系统完全无需人工信息。Probe又明确使用419对人工属性标签。

**诊断训练。** 正文§6.1写probe用Adam、学习率5×10⁻⁴、50 epochs；每种属性和每种表示做100次不同随机种子实验，手势对按60%/20%/20%分为训练/验证/测试，以测试ROC-AUC衡量。使用Mann–Whitney U检验，并作Benjamini–Hochberg多重比较校正。这里是对已有表示训练分类器，不是再训练动作生成器。

**使用阶段。** 提供已分段手势骨架，提取投影后向量做检索/相似度分析，或提取投影前向量交给已训练probe。对话统计还需要说话人、所指与对话身份这些外部元数据。它没有从任意连续视频自动完成stroke检测、所指识别与手势解释的端到端接口。

**公开实现与论文配置需要区分。** 当前仓库提供模型、训练/评估脚本、两份标注CSV、姿态下载入口及SLR初始化权重 `joint_finetuned.pt`；未在本次仓库树与README中找到对应单模态、多模态、联合目标的最终模型检查点下载。README列出的预处理文件和训练入口 `main_sup_pl.py` 不在该提交中，实际可见入口为 `pre_train_main.py`。[仓库][code]

<details><summary>静态代码核查：影响直接复现的具体差异</summary>

- **训练参数：** 已查的联合配置为1000 epochs、batch 144、学习率0.0005；训练脚本实际构造SGD，而补充报告200 epochs、每GPU batch 128、Adam 0.001。配置文件中的设备列表也不能证明作者实际运行时只使用该列表，因为训练器另设为使用所有可用GPU。[配置][config-code]、[入口][train-code]
- **对比配对：** 论文图3将原始骨架送入跨模态目标；当前双增强配置下，脚本拼接两个增强视图后用前半批与原始语音配对。二者都利用共现关系，但不能说源码逐项复现了论文图示。[入口][train-code]
- **温度传参：** 跨模态损失的调用把实例温度作为辅助函数第四个位置参数传入，而该位置名为 `modalities`，实际 `temperature` 留在默认0.1。论文恰好也是0.1，但修改配置做温度扫描前应检查这一处。[损失实现][loss-code]
- **probe结构与划分：** 当前非线性probe直接对拼接特征做64→8→1网络；数据模块默认60%/10%/30%，与正文的两路32维后拼接及60%/20%/20%不同。这些默认值不是论文结果使用了它们的证据。[probe实现][probe-code]、[数据模块][probe-data]
- **评估独立性：** 训练脚本每个验证周期调用人工419对的相似度评估，并据其相关性保存检查点。这不把标签直接放进对比损失，却意味着当前代码中的模型选择可能利用同一人工评估集；应另设独立测试集再衡量泛化。[入口][train-code]

以上是静态可见差异，没有通过实际运行确认全部影响，也没有据此断言论文报告结果无法成立。

</details>

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**419个人工编码手势对，整体形态相似度相关性。** 下表重排正文§5.1及补充图1的明确数值；正文原本没有对应数值表。[正文§5.1][html]、[补充§C.1][supp]

| 表示模型 | 本文数据上的训练目标 | Spearman ρ ↑ |
|---|---|---:|
| SLR baseline | 直接使用手语识别预训练表示 | 0.23 |
| Unimodal | 骨架增强间对比 | 0.20 |
| Multimodal | 同期骨架–语音对比 | 0.24 |
| Combined | 两种目标等权联合 | **0.31** |

四个相关系数均为 **p＜0.001**。这说明各自与人工分数的相关性显著，**并不是四个模型之间差值均有统计显著性**；原文没有给这组相关系数差异的独立显著性检验。相关性衡量排序一致程度，不能解释成31%识别准确率。

**同一对话内的所指与说话人因素。** 下表直接重排正文图5标出的均值与§5.2.1给出的配对规模；这是联合模型的分析，余弦均值用于描述组间关系，并非越高越好的总排行榜。

| 手势对条件 | 配对规模（原文约数） | 平均余弦相似度 μ |
|---|---:|---:|
| 同所指、同说话人 | 7K | 0.34 |
| 不同所指、同说话人 | 455K | 0.17 |
| 同所指、不同说话人 | 5.5K | 0.10 |
| 不同所指、不同说话人 | 358K | 0.07 |

作者报告这些组之间的差异经独立t检验与Bonferroni校正均显著；脚注说明，将各组下采样至例如5.5K对，结果及显著性仍稳定。大量“手势对”由有限手势组合而来，不能等同于同样多的独立参与者。

**跨说话人时，同一对话与不同对话的比较。** 下表重排正文图6标出的均值；跨对话同所指有137K对，跨对话不同所指有10M对。[§5.2.2、图6][html]

| 所指关系 | 说话人来自 | 平均余弦相似度 μ |
|---|---|---:|
| 同所指 | 同一对话 | 0.10 |
| 同所指 | 不同对话 | 0.09 |
| 不同所指 | 同一对话 | 0.07 |
| 不同所指 | 不同对话 | 0.06 |

**五类形态关系probe，测试ROC-AUC ↑。** 原文图7没有给每个柱子的精确数值表，本文保留作者图，不从图高编造小数。

<figure class="reading-figure"><a href="/paper-notes/dialogue-gesture-representations/probing-results-original.svg" target="_blank" rel="noopener"><img src="/paper-notes/dialogue-gesture-representations/probing-results-original.svg" alt="原文图7：随机初始化、SLR基线与联合目标表示在用手、形状、位置、移动和旋转相似性探针上的测试ROC-AUC；联合模型相较SLR的显著优势在用手和位置" loading="lazy" /></a><figcaption>原文图7，Ghaleb等，arXiv:2409.10535v1；取自作者arXiv HTML图件，依该版本CC BY 4.0许可转载，未改变数据。星号为作者报告的显著差异；精确柱值未提供。</figcaption></figure>

### 消融与补充实验

**训练目标比较：** 四种模型比较就是最直接的目标变体实验：只加骨架增强对比得到0.20，并未优于0.23的SLR基线；只加跨模态目标为0.24，联合为0.31。本文没有额外的语音层数、时间窗、温度或单个增强操作的系统消融表，不能补造“去掉某层下降多少”。

**相似度分布并非单调、也不能跨模型直接比绝对值：** 补充图1在人工共享形态数从0到5时给出如下均值。表中数值按图上两位小数标注转录，反映不同表示空间的尺度与分离情况。[补充§C.1、图1][supp]

| 模型 | 0种 | 1种 | 2种 | 3种 | 4种 | 5种 |
|---|---:|---:|---:|---:|---:|---:|
| SLR | 0.47 | 0.50 | 0.51 | 0.55 | 0.57 | 0.57 |
| Unimodal | 0.29 | 0.16 | 0.22 | 0.32 | 0.29 | 0.38 |
| Multimodal | 0.45 | 0.42 | 0.45 | 0.48 | 0.54 | 0.49 |

联合模型的0种与5种均值约为 **0.04与0.31**，差0.27；原文报告两组t＝−3.855、p＜0.001。补充材料中，其他三个模型对这些分组的显著差异较少，单模态模型只有1种与5种那组比较显著。多模态模型的5种均值还低于4种，不能写成所有模型均随共享属性数严格递增。[正文图4、补充§C.1][html]

**对话分组趋势也存在于基线：** 补充图2–3显示，SLR、单模态和跨模态模型也符合H1–H3。它们都表现出同所指更近、同一说话人更近以及同一对话更近的趋势，因此这些趋势不是联合训练独有的能力。SLR与单模态模型中，“同所指不同说话人”和“不同所指同说话人”的差别不显著；加入语音的模型则更强调说话人差异。[补充§C.2][supp]

**随机表征控制：** Probe比较同结构随机初始化ST-GCN、SLR与联合模型，控制“分类器仅凭自身容量就能完成任务”的部分可能性。两种学习表示在五个属性上均显著优于随机表示；联合模型相对SLR的显著提升出现在**handedness和position**。rotation没有更好，movement也仍难，不能把图7概括成五项全面提升。[§6.2][html]

**标注数量与一致性：** 以下逐项保留补充表1原值，并并列补充§A.1报告的Cohen’s κ。0/1为原表编码；κ的样本范围与419对分类数据并不相同。

| 形态特征 | 原表编码0 | 原表编码1 | 标注者一致性 κ |
|---|---:|---:|---:|
| Handedness | 196 | 223 | 0.91 |
| Position | 90 | 329 | 0.47 |
| Shape | 290 | 129 | 0.71 |
| Movement | 326 | 93 | 0.63 |
| Rotation / orientation | 253 | 166 | 0.54 |

Shape、orientation、movement、position的一致性基于103对；handedness来自264个手势的既有左右手标注。Position的κ只有0.47，人工参照本身有噪声。[补充§A.1、表1][supp]

<details><summary>原文与公开标注中的两处不一致</summary>

正文§3.2称handedness相似最频繁、position最少，但补充表1的编码1数量以position的329最多。官方419行CSV也包含329个position＝1，因此本文保留原表，不把两个相反说法合并成同一事实。

此外，官方CSV的movement为326个0、91个1和2个9；相似度及probe代码把9作为0处理，按该实现合并后应为328个0、91个1，与补充表1的326/93不符。Shape的3个9、rotation的1个9合并到0后则与原表一致。这里报告的是公开文件静态计数，**不是重新做了模型实验**，也未自行改写作者公布的结果。[标注CSV][csv]、[相似度脚本][similarity-code]、[probe入口][probe-script]

</details>

### 关键发现

1. **联合目标最有希望，但收益不能归结为“任何对比学习都有效”。** 0.31是本文四种设置中最高的相关系数；单模态0.20低于初始化基线。视觉增强一致性与语音共现是不同约束，作用需要实验验证。
2. **学出的空间同时包含所指线索和说话人风格。** 同说话人不同所指的0.17，高于不同说话人同所指的0.10。语音可能加强了个人说话习惯相关信息，这是作者提出的解释，尚未通过去身份或内容/音色分离实验验证。
3. **同一对话的相似度优势很小但统计上显著。** 图6以两位小数报告约0.01的组间差别。它与对话协调假设一致，但仍是观察性分组，不能据此证明模型识别了模仿的因果过程。
4. **可读出的主要是相对形态关系。** Probe表明已学表示包含对五类关系有用的信息，联合模型在用手和位置上有显著优势；这不等于自动输出完整手势语义，也不等于已经获得可控生成接口。

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把评估对象从任务分数移到表示本身：** 不要求生成器配合，也不以FGD替代人工形态关系，直接检查向量空间是否符合专家的配对判断。
- **语音作为训练桥梁：** 语音影响视觉表征的学习，但表征使用时可以只需骨架；这适合已有姿态档案、缺少可用语音输入的分析场景，是否跨新数据域有效仍需测试。
- **将所指、个体与互动分别组织成对照：** 同所指不等于同说话人，同说话人不等于同对话。分组让一个相似度数值的潜在来源更清楚，而不是直接给它冠以“语义相似度”。
- **用随机网络probe控制避免过强可解释性声明：** 已学表示必须优于相同骨架结构的随机特征，才有理由认为训练贡献了属性信息；同时仍保留probe容量与数据划分的限制。
- **对动作研究的启发：** 在使用某个动作latent作为评价器、检索器或控制中介之前，可以先用人工属性关系和独立外部因素检验它。压缩或可重建本身并不保证保留了研究真正关心的事件语义。

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **作者指出：动态移动信息仍难学习。** Movement的probe收益最小；原文建议进一步编码骨骼与运动信息。本文没有验证这些后续改进，不能预先写成已解决。
- **作者指出：语音可能放大身份差异。** 表示同时反映个人风格与所指；若目标是跨说话人的语义检索，这种混合可能影响排序，需要专门去身份或控制说话人条件的实验。
- **数据范围有限。** 19组荷兰语陌生物体指认对话，不等于一般社交对话、演讲、音乐动作或多语言跨文化手势。所有内在评估集中在同一数据来源，没有证明跨语种、跨设备或新说话人的普遍泛化。
- **本文分析：切分应按更高层级验证独立性。** 训练窗大量重叠，公开训练脚本随机按窗口划分；probe按手势对切分，也未报告说话人/对话隔离。应增加按原始手势、说话人或对话分组的测试，检查相邻窗与重复个体是否让结果偏乐观；这属于待检验风险，不是已证实的数据泄漏结论。
- **本文分析：大量配对不增加独立被试数。** 同一手势可进入许多对，相似度观测之间有依赖。作者做了配对数下采样，但它并不等价于按说话人/对话重采样或层级统计模型；小的组均值差异尤其需要区分统计显著与实际效应。
- **本文分析：正负样本仍是实例级近似。** 相邻或同所指的不同窗口可能成为负样本；镜像与尺度增强也会改变部分细节。论文没有分别隔离这些因素的影响，因此不能断言表示已学会“只忽略无关差异”。
- **可解释性与生成控制边界明确。** 五个关系probe不是可读动作词典，相关性不是因果分解，骨架编码器不是连续动作发生器。若用于虚拟人，需要另外提供动作生成、语音时序、场景目标、接触/指向约束及执行验证模块；本文未实现或评测这些环节。

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **[Skeleton Aware Multi-Modal Sign Language Recognition（SAM-SLR）][samslr]（CVPR Workshops 2021）：** 本文骨架初始化与SLR基线的来源，原任务是手语识别。这里继承识别预训练，再用对话共现训练和形态评估改造表示；不能称作完全从零的无监督手势学习。正式来源是CVPR **Workshops**，不把正文参考文献的简写当作主会证据。
- **[The Primacy of Multimodal Alignment in Converging on Shared Symbols for Novel Referents][rasenberg]（Discourse Processes 2022）：** 提供指认对话、人工stroke与手势对形态编码，是本文数据与解释假设的基础。它研究人如何形成共享指称；本文进一步尝试用学习表示扩展分析，而非重新证明所有互动机制。
- **[SimCLR][simclr]（ICML 2020）：** 提供同实例双增强的单模态对比思路。本文把图像视图替换为骨架变换，并检验这种增强不变性是否符合专家形态判断；单模态结果没有自动优于原有表示。
- **[Contrastive Multiview Coding][cmc]（ECCV 2020）：** 提供跨视图/跨模态实例对应的训练思路。本文的两种视图是同期语音与骨架，联合目标再保留骨架自身的增强一致性。这里的CLIP-like表示训练形式相似，不意味着调用了CLIP文本编码器。
- **[Crossmodal Clustered Contrastive Learning: Grounding of Spoken Language to Gesture][ccnce]（ICMI Companion 2021）：** 也处理语音与手势多对一的关联，用跨模态聚类约束帮助表示及后续手势生成。本文强调骨架单模态与跨模态目标联合，并把终点放在表示的内在评估；不能将前者的生成能力移到本文框架上。
- **启发：** 若希望得到可被语言系统使用的动作表示，应先明确读出的究竟是配对相似关系、绝对形态属性、所指对象还是可执行动作条件，再分别设计独立测试。本文为前两者中的“形态关系可探测性”提供了证据，为后两者留下了明确的验证空白。

<span id="reading-8" class="reading-anchor"></span>
## 来源

1. **正文全文：** [arXiv:2409.10535v1原生HTML][html]与[10页PDF][paper]，2024-08-31。已读§1–7和参考文献，核对数据流程、式1–4、图1–7；数值表注明来自正文段落或图上标注，不伪称原文存在主结果表。
2. **补充全文：** [UvA机构库3页补充PDF][supp]，已读§A–C、表1与图1–3，核对标注一致性、硬件/训练设置、增强列表与基线分布。补充材料独立于arXiv HTML，保留原站链接。
3. **正式书目信息：** [ACM DOI][doi]、[ACM登记至Crossref的元数据][crossref]与[UvA正式记录][uva]；作者名保留论文中的重音与土耳其字符，标注正式会议年ICMI 2024。
4. **公开实现：** [官方仓库][code]，提交[0631b55][commit]；核查了[模型][model-code]、[语音编码][speech-code]、[损失][loss-code]、[训练][train-code]、[联合配置][config-code]、[相似度评估][similarity-code]、[probe][probe-code]和[标注CSV][csv]。仅静态审计与标注计数，没有模型运行验证。
5. **图片与形式：** 架构SVG为本站根据论文重绘的教学图；probe图为作者arXiv v1原图7，按该版本[CC BY 4.0][license]许可署名转载。章节结构遵循本站论文解读模板，技术事实以以上原始来源为准。核查日期：2026-11-17。

[html]: https://arxiv.org/html/2409.10535v1
[paper]: https://arxiv.org/pdf/2409.10535
[abstract]: https://arxiv.org/abs/2409.10535
[doi]: https://doi.org/10.1145/3678957.3685707
[crossref]: https://api.crossref.org/works/10.1145/3678957.3685707
[uva]: https://dare.uva.nl/id/5e7c8a8d-71b5-4502-a7c3-59c9ec5f4ed8
[supp]: https://pure.uva.nl/ws/files/273964823/Supplementary_Materials_Gestures_Representations_and_Similarities_ICMI2024_1_.pdf
[code]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations
[commit]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/tree/0631b558562f96fa9fecee9f51c5cc6a9ad64e08
[model-code]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/blob/0631b558562f96fa9fecee9f51c5cc6a9ad64e08/model/skeleton_speech_models.py
[speech-code]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/blob/0631b558562f96fa9fecee9f51c5cc6a9ad64e08/model/wav2vec2_wrapper.py
[loss-code]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/blob/0631b558562f96fa9fecee9f51c5cc6a9ad64e08/model/losses.py
[train-code]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/blob/0631b558562f96fa9fecee9f51c5cc6a9ad64e08/pre_train_main.py
[config-code]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/blob/0631b558562f96fa9fecee9f51c5cc6a9ad64e08/config/SSL/train_ssl_clip_on_gestures_augmented_combined_all.yaml
[similarity-code]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/blob/0631b558562f96fa9fecee9f51c5cc6a9ad64e08/gestures_forms_sim.py
[probe-code]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/blob/0631b558562f96fa9fecee9f51c5cc6a9ad64e08/model/probing.py
[probe-data]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/blob/0631b558562f96fa9fecee9f51c5cc6a9ad64e08/feeders/probing_datamodule.py
[probe-script]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/blob/0631b558562f96fa9fecee9f51c5cc6a9ad64e08/probing_script.py
[csv]: https://github.com/EsamGhaleb/Learning-Co-Speech-Gesture-Representations/blob/0631b558562f96fa9fecee9f51c5cc6a9ad64e08/data/gesture_form_similarity_coding.csv
[license]: https://creativecommons.org/licenses/by/4.0/
[samslr]: https://openaccess.thecvf.com/content/CVPR2021W/ChaLearn/html/Jiang_Skeleton_Aware_Multi-Modal_Sign_Language_Recognition_CVPRW_2021_paper.html
[rasenberg]: https://doi.org/10.1080/0163853X.2021.1992235
[simclr]: https://proceedings.mlr.press/v119/chen20j.html
[cmc]: https://arxiv.org/abs/1906.05849
[ccnce]: https://doi.org/10.1145/3461615.3485408

</div>
