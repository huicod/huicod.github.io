---
title: "[CVPRW2026] VISTA：文字让角色拍手，视频让角色展臂，最后会听谁的？"
description: "VISTA 用一句文字指定动作，用参考视频给出表演风格。通过抱臂踢腿、拍手与展臂冲突、真实视频失败三个案例，读懂视频风格的注入位置、两种引导方式和五类风格实验的边界。"
pubDate: "2026-11-26T17:12:00+08:00"
badge: "Paper"
tags: ["VISTA", "CVPR 2026 MOMA Workshop", "Text-to-Motion", "视频风格", "动作风格化", "ViViT", "Dual-AdaLN", "掩码自回归", "扩散模型", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML][html] · [3 页原文 PDF][pdf] · [作者的动作对照动图与代码][repo]

<details class="paper-meta"><summary>论文信息与阅读范围 · CVPR 2026 MOMA Workshop</summary>

*VISTA: Video-Injected Stylized Text-to-Animation*。作者为 Monseej Purkayastha、Anindita Ghosh、Philipp Slusallek。MOMA 主办方将此文列为 CVPR 2026 Workshop 的扩展摘要报告。本文依据 2026 年 9 月 23 日的 arXiv v2、作者动图和 11 月 26 日核对的公开代码。仓库提供训练、采样、评测脚本及权重下载入口；下表使用论文报告值，本次未运行模型。[会议议程][workshop] · [版本记录][record] · [代码版本][version] · [权重说明][weights]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

VISTA 要让动画师能**用一句话交代动作，再用一段视频示范演法**。例如文字写“向前走，同时用右脚踢”，参考视频里的人抱着双臂。模型让文字参与每个动作位置的生成，把视频压成全段共用的风格向量，再解码成三维人体动作。这个分工在两个要求相容时很直观；当文字要拍手、视频要展臂时，生成角色大部分时间选择了拍手。[右脚踢与抱臂对照][repo] · [拍手与展臂实验][experiments]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　文本生成动作已经能让角色走、跑、蹲下。动画师若想让同一个“跑后蹲下”分别像机器人、像小鸡、或始终抱着手臂，直接提供一段表演参考比继续扩写文字更自然。作者用同一句提示、三种风格动图展示了这个需求。[作者演示][repo] · [原文引言][intro]

**现有痛点**　训练一个模型同时听懂这两种指令，理想数据是“文字、独立风格视频、按两者要求表演的动作”三者配套。HumanML3D 提供文字与动作，100STYLES 提供带风格的动捕。如果随机拿前者的一句“踢右腿”和后者的抱臂参考，没人为这次组合录过一段正确答案。[数据与表示][repr] · [跨批次训练][method]

**核心矛盾**　视频既拍下“怎样动”，也拍下“做了什么”。借用抱臂姿态时，若把参考中原有的走路也照搬过来，文字里的右脚踢可能消失；若把视频压得太粗，又可能只保留一个显眼姿态，丢掉风格的节奏。文字和参考同时要求控制双臂时，即使两个输入都读懂了，仍要决定角色在哪些帧听谁的。[原文方法][method] · [冲突实验][experiments]

**本文目标**　推理时接收一段 RGB 风格参考和一句动作文字，输出单人的三维关节运动。角色可以执行参考视频中从未表演的文字动作。论文用动捕渲染视频验证这一设定，分别测风格识别、文本检索和生成分布。[实验设置与表 I][table1]

**切入角度**　先让同一段动捕与其渲染视频在共享空间里接近，教视频编码器认识骨架运动；生成时再让文字保留各个动作位置的上下文，视频仅提供全段统计。这样，模型看得见“这段表演的典型姿态和变化”，又少了一条逐帧照抄参考的捷径。[图 1][figure] · [视频池化代码][pool]

**核心 idea**　先让文本条件的 Transformer 决定当前待补位置要生成什么，再让扩散去噪网络按视频风格调整这些位置的动作。推理时可以同时加强两种条件，也可以分别调整文字和视频的引导强度。[原文方法][method] · [表 II][table2]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

按图从上往下读。训练先把“从骨架看”和“从视频看”得到的特征交给同一个动作解码器。实际生成时，左边的文字支路为每个待补位置提供不同的上下文，右边的参考视频支路给所有位置提供同一份风格。两者在预测动作潜变量的扩散网络里汇合。补全序列后，解码器输出每帧 67 维的动作表示，包含根运动信息和 21 个关节相对根的位置；骨架动画可再渲染成画面。[原文图 1][figure] · [动作表示][repr]

<figure class="reading-figure"><a href="/paper-notes/vista/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/vista/architecture.svg" alt="VISTA 两阶段架构。先用成对的动捕与渲染视频训练双通道自编码器，再让文字进入掩码 Transformer，视频经时空编码和统计池化形成一个风格向量。两路在 DiffMLP 汇合，最后解码成三维动作。" /></a><figcaption>依据原文图 1 与方法部分重绘。沿文字支路看“向前走并拍手”怎样影响每个位置；沿视频支路看“展臂”在哪一步失去逐帧索引。点击可放大。</figcaption></figure>

### 关键设计

1. **用动捕自产成对视频，给共享空间一个训练目标。** 作者把 100STYLES 动作驱动的 SMPL 人体从正面和左侧渲染成 VE-100STYLES。动作走动作编码器，视频走冻结的 ViViT-B/16×2 和视频编码器。两个分支的序列特征要彼此对齐，还要能经同一个解码器还原动作。对齐损失在动作一侧停止梯度，让视频分支向动作表示靠近。训练还使用风格分类、对抗和循环一致性目标。“无需三元组”适用于跨数据集的新组合；这一阶段仍然依赖视频与动作的精确配对。[表示与渲染][repr] · [阶段一][method]

2. **先看连续画面，再把视频变成一个向量。** 公开采样脚本默认在参考视频中均匀取 32 帧。ViViT 先编码局部时空关系，视频编码器输出形状为 **B × 512 × Tᵥ** 的特征，其中 Tᵥ 是编码后的时间长度。对每个通道沿时间分别取均值、标准差，两者拼成 1,024 维，再经两层 MLP 投影为 512 维。均值能描述常见姿态，标准差能保留特征的变化幅度。池化之后若只交换这串**已编码特征**的次序，结果相同；若把原始视频倒放，前面的时空编码本身仍可能改变。[采样代码][sample] · [池化实现][pool]

3. **文字按位置给内容，风格在去噪时调制特征。** 冻结的 CLIP 编码文本，双向掩码 Transformer 同时读取文字和当前可见的动作潜变量，为每个待补位置生成上下文。DiffMLP 根据上下文去噪，并由 Dual-AdaLN 将视频风格引入偏移、缩放和门控。实现中，两路偏移和门控相加，缩放项用有界乘数调节。风格权重沿去噪网络的**层深**逐渐变大，这个安排作用在网络内部，不代表系统要求动作“前半段听文字、后半段听视频”。[图 1][figure] · [调制代码][diffmlp]

4. **用一次“加上风格再去掉”学习未录制的组合。** 每轮训练含 HumanML3D 文本–动作任务，以及 VE-100STYLES 的文字、渲染视频条件任务。论文另以 50% 概率取不配对的文字内容与视频风格，先生成风格化潜变量，把中间结果与梯度计算断开，再将风格置空，要求模型在掩码位置恢复原内容。这样有了“原动作能否找回来”的监督；对中间那段风格化动作，仍没有逐帧真值。[方法 §III][method] · [公开训练设置][train]

### 一个完整例子

作者仓库提供了“向前走，同时用右脚踢”加 **ArmsFolded（抱臂）** 的三方法并排动图。观察时可以先遮住上半身，看腿部动作是否还在，再看双臂能否保持参考姿态。[三方法动图][repo] · [VISTA 单独动图][kick]

| 跟踪的信号 | 在这个例子中发生什么 |
|---|---|
| 文字内容 | 文字给出前进与右脚踢。不同动作位置有各自的上下文；用户没有指定踢腿发生在哪一帧。 |
| 视频风格 | 视频支路产出一个全段共用的向量。它没有独立的“左臂锁定”“右臂锁定”开关，也没有逐帧手腕轨迹。 |
| 生成与解码 | 从全掩码潜序列开始，逐轮预测待补位置，再把完成的连续潜序列解成根运动和三维关节。最终画面同时受文字上下文与视频调制影响。 |
| 换一个更难的要求 | 保留向前走，把文字改为“两手拍掌”，参考改为 Aeroplane（飞机式展臂）。原文报告大部分帧仍在走并拍手，到最后几帧才出现展臂风格。两条输入途径可以分开，并不能预先指定冲突时谁有优先权。 |

最后一行是作者另做的实测，而非根据架构猜出的结果。它比“抱臂踢腿”更严格：抱臂和踢腿主要占用不同部位，拍手和展臂却同时需要两条手臂。[冲突案例 §IV][experiments]

### 训练与推理

- **生成时怎样调权重。** 从全掩码开始，按余弦日程逐轮补全潜变量。二路引导（2-way CFG）比较“两种条件都给”和“两种都空”的预测，一个旋钮同时加强两者。三路引导（3-way CFG）分别预测“都空”“仅文字”“仅视频”，再从无条件预测出发，分别加上两种预测差值乘以各自权重。它给使用者两个可调参数，论文没有给用户逐帧或逐关节分配优先级的接口。[推理 §III][method] · [引导实现][cfg]
- **训练规模怎样读。** 作者仓库说明第二阶段从预训练的 HumanML3D MARDM 初始化，公开设置微调 500 个 epoch。README 将单卡 A100、阶段一约 42 小时和阶段二约 27.5 小时归于学位论文配置。这两项仅覆盖所述阶段，不能当作从零训练 ViViT、CLIP 和 MARDM 的总成本。公开评测入口使用同一生成器权重切换两种引导。[训练说明][training] · [训练配置][train] · [评测脚本][evalrun]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

原文表 I 分三个任务。**域内**使用 VE-100STYLES 的条件；**跨域**把 HumanML3D 的文字与 VE-100STYLES 的风格视频组合；**基础生成**仅测 HumanML3D 文本生成动作。风格实验覆盖 Aeroplane、ArmsFolded、Chicken、Robot、Superman 五类。[表 I][table1] · [跨域评测代码][transfer]

| 方法 | 域内风格识别 SRA ↑（%） | 域内 FID ↓ | 跨域风格识别 SRA ↑（%） | 跨域文本检索 R-P@3 ↑（%） | 基础 FID ↓ |
|---|---:|---:|---:|---:|---:|
| SMooDi（作者视频适配版） | 68.1 | 9.74 | 48.0 | **75.0** | **0.80** |
| LoRA-MDM（作者视频适配版） | 55.3 | 12.67 | 14.0 | 60.4 | 4.42 |
| VISTA 二路，联合强度 4.5 | **77.8** | 4.74 | **70.0** | 60.4 | 2.49 |
| VISTA 三路，文字 4.5、风格 2.0 | 59.7 | **4.27** | 50.0 | 68.8 | 2.49 |

SRA 是生成动作被分类器认成指定风格的 Top-1 准确率。R-P@3 衡量文本和动作能否在候选中排进前三；评估器以中性文本–动作配对为参照，原文还报出真值的 R-P@3 为 53.1%。FID 比较两组动作特征的分布。三项各答一个问题，都无法替代“这次右脚踢对了吗”的动作检查。基线沿用相同数据划分与冻结 ViViT，但接入方法不同：SMooDi 接 VISTA 双通道自编码器的视频潜变量并重训风格编码器，LoRA-MDM 将原始 ViViT 特征投影成前缀，保留 rank-5 LoRA。[原文评测与解释][experiments] · [基线适配 §IV-A][baselines]

### 消融实验

原文表 II 是**推理引导强度扫描**。固定文字强度 4.5，保持模型权重不变，只改视频风格强度。Skt. 沿用原表标签；公开评测实现统计的是足部贴近地面但仍发生水平滑动的帧比例。[表 II][table2] · [足滑计算][skate]

| 视频强度 | 域内 SRA ↑（%） | 域内 R-P@3 ↑（%） | 域内 FID ↓ | 跨域 SRA ↑（%） | 跨域 R-P@3 ↑（%） | 跨域 Skt. ↓ |
|---:|---:|---:|---:|---:|---:|---:|
| 1.0 | 38.9 | **93.8** | 6.53 | 30.0 | **87.5** | **0.11** |
| 2.0 | 59.7 | 85.9 | **4.27** | 50.0 | 68.8 | 0.14 |
| 3.0 | 66.7 | 82.8 | 5.21 | 62.0 | 64.6 | 0.16 |
| 4.0 | 70.8 | 76.6 | 5.87 | **70.0** | 60.4 | 0.17 |
| 4.5 | 73.6 | 73.4 | 5.85 | **70.0** | 50.0 | 0.18 |
| 5.0 | **75.0** | 70.3 | 5.80 | 68.0 | 54.2 | 0.19 |

作者选择 2.0 作为三路默认风格强度，因为该点域内 FID 最低，多样性 6.85 也接近真值 7.06。跨域风格识别率在 4.0–4.5 达到最高，继续推到 5.0 反而回落。正文没有分别移除视频池化、Dual-AdaLN 或跨批次循环的数值消融，因此表 II 能说明“旋钮有何效果”，无法拆出每个模块贡献了几个点。[消融 §IV-B][ablation]

### 关键发现

- **最容易认出参考风格的结果，并非文本检索最强的结果。** 跨域上，VISTA 二路比视频适配版 SMooDi 多 22.0 个百分点的风格识别率，同时少 14.6 个百分点的文本 Top-3。若只引用 70.0%，就会漏掉作者实际面对的取舍。[表 I][table1]
- **“独立调权”指可以单独改参数，生成效果仍然耦合。** 风格从 1.0 调到 2.0，跨域风格识别从 30.0% 升至 50.0%，文本检索却从 87.5% 降至 68.8%。同一个旋钮已经同时改变了两项结果。[表 II][table2]
- **复核风格分数时要记下分类器版本。** 正文称 SRA 分类器仅用真实动作训练，且与训练风格损失的网络结构、参数独立。公开版本的第二阶段风格特征损失和评测入口默认读取同一个分类器权重文件，仓库也明确写了这项复用。仅靠默认脚本还无法确认表 I 当时使用的独立评估配置；这里按原表呈现数值。[论文评测说明][experiments] · [分类器说明][cls] · [训练入口][traincls] · [评测入口][evalcls]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **视频的时间信息究竟走了多远，可以从接口读出来。** ViViT 看过连续画面，均值与标准差也能把局部变化带进风格向量。但解码器拿到的是同一份全局向量，无法直接查询“参考视频第几帧刚刚展臂”。这同时解释了它适合整段表演风格，以及它为什么难以按参考时刻切换姿态。[风格编码][pool] · [作者展望][limits]
- **这篇短文保留了真正有判别力的失败案例。** 在相容的抱臂踢腿之外，拍手与展臂让两个输入争用同一对关节。后一个例子揭示了识别准确率掩盖的问题：风格可以在末尾出现，但动画师可能要求它从头持续到尾。[作者演示][repo] · [冲突实验][experiments]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

1. **随手拍的视频仍是最明显的缺口。** 主实验的参考视频有固定机位、干净背景和统一体形。作者另试了一段真实 YouTube 飞机式动作，文字要求“向前走，再坐下”，结果却是超人式绕圈跑，两个要求都偏离了。作者推测噪声风格向量干扰了内容支路；这是一次实测和一种原因解释，真实视频上的总体成功率仍未知。[实验 §IV][experiments]
2. **五类风格的跨域组合，不能回答未见风格的效果。** 这里变化的是内容文字与风格视频的组合，公开训练脚本列出了相同五种风格。作者把连续风格插值、组合以及改善陌生风格泛化列为后续研究方向。[训练类别][train] · [结论 §V][limits]
3. **逐帧控制和身体部位优先级仍缺接口。** 视频风格没有时间索引，也没有部位掩膜。作者设想开放整串视频 token，让动作位置用交叉注意力查询参考帧。即使加上这种能力，仍要实测拍手与展臂各自执行了哪些帧，才能判断是否解决冲突。[结论 §V][limits]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **MotionS（ACM Multimedia 2024）。** MotionS 用目标角色自己的源动作确定“做什么”，VISTA 从文字生成动作内容。处理参考视频时，MotionS 随机取五帧并平均图像编码，VISTA 先做时空编码，再取均值与标准差。两者都能借用全段姿态风格，但若要在视频指定的时刻抬手，需要额外的时序控制。[站内 MotionS 解读](/blog/acmmm2024-motions/) · [VISTA 的风格表示][method]
- **SMooDi（ECCV 2024）。** 原方法接收参考动作，把风格引入预训练文本动作生成器。VISTA 表 I 中的 SMooDi 增加了视频输入适配，还更换并重训了风格编码器的输入路径。读两篇时应区分原方法具备的能力和这次受控比较得出的分数。[站内 SMooDi 解读](/blog/eccv2024-smoodi/) · [视频适配细节][baselines]
- **一个可复用的评测思路。** 对同时接收文字和参考视频的模型，准备两对输入：一对作用在不同部位，例如右腿踢与双臂抱胸；另一对作用在同一部位，例如拍掌与展臂。分别测文字动作完成的帧数、参考姿态持续的帧数，再扫同一组权重。这样才看得出，分数变化来自整段风格自然变强，还是模型轮流放弃两个要求。这是从论文案例引出的实验设计。[冲突实验与权重扫描][experiments]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- **论文与出处**　[MOMA 主办方议程][workshop] · [arXiv 记录][record] · [原生 HTML][html] · [PDF][pdf]
- **方法与实验**　[原架构图][figure] · [主实验表 I][table1] · [引导强度表 II][table2] · [作者局限与未来方向][limits]
- **实现与演示**　[作者动图与仓库][repo] · [核对的代码版本][version] · [权重入口][weights] · [视频采样][sample] · [去噪调制][diffmlp]
</div>

[html]: https://arxiv.org/html/2609.23817v2
[pdf]: https://arxiv.org/pdf/2609.23817v2
[record]: https://arxiv.org/abs/2609.23817
[workshop]: https://hri.iit.it/cvpr2026-workshop
[intro]: https://arxiv.org/html/2609.23817v2#S1
[repr]: https://arxiv.org/html/2609.23817v2#S2
[method]: https://arxiv.org/html/2609.23817v2#S3
[figure]: https://arxiv.org/html/2609.23817v2#S3.F1
[experiments]: https://arxiv.org/html/2609.23817v2#S4
[baselines]: https://arxiv.org/html/2609.23817v2#S4.SS1
[ablation]: https://arxiv.org/html/2609.23817v2#S4.SS2
[table1]: https://arxiv.org/html/2609.23817v2#S4.T1
[table2]: https://arxiv.org/html/2609.23817v2#S4.T2
[limits]: https://arxiv.org/html/2609.23817v2#S5
[repo]: https://github.com/humma-humma/VISTA
[version]: https://github.com/humma-humma/VISTA/tree/552972bb6a32619468a8b4f36a2c03e053e2fcdf
[weights]: https://github.com/humma-humma/VISTA#checkpoints
[training]: https://github.com/humma-humma/VISTA#training
[kick]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/assets/gifs/Kick_ArmsFolded_vist.gif
[sample]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/sample_new.py#L147-L189
[pool]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/models/MARDM.py#L110-L124
[cfg]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/models/MARDM.py#L574-L631
[diffmlp]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/models/DiffMLPs.py#L224-L245
[train]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/scripts/03_train_stage2_vista.sh
[evalrun]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/scripts/04_eval_native.sh
[transfer]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/evaluate_vista.py#L763-L778
[skate]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/evaluate_vista.py#L186-L229
[cls]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/scripts/02_train_style_classifier.sh
[traincls]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/train_vista.py#L417-L426
[evalcls]: https://github.com/humma-humma/VISTA/blob/552972bb6a32619468a8b4f36a2c03e053e2fcdf/evaluate_vista.py#L1115-L1124
