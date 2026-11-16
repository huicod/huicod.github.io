---
title: "[SIGGRAPHAsia2026] Kinematic Frequency Motion：用运动频段分开粗风格与细节"
description: "项目与代码解读，未取得论文全文。核查MEMD自适应频段、粗细风格条件、潜在扩散训练与编辑接口，区分公开配置、作者演示、定量证据缺口与脚部后处理。"
pubDate: "2026-11-16T10:03:00+08:00"
updatedDate: "2026-11-16"
badge: "Paper"
tags: ["Motion-Style-Transfer", "Motion-Editing", "Frequency", "Diffusion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**项目与代码解读，未取得论文全文。** 截至2026-11-16，作者项目的Paper入口尚未开放。本文依据官方会议条目、项目架构图、公开实现与演示说明展开，保留固定解读模板；实验部分列出可核查材料和配置，不补造论文的主表或消融结果。

[作者项目与视频][project] · [正式会议记录][venue] · [官方代码][code] · [在线演示入口][demo] · [模型权重][weights] · [FineMotion-Style数据][data]。

<details class="paper-meta"><summary>论文信息与阅读范围 · SIGGRAPH Asia 2026 · 项目与代码解读</summary>

论文：*Learning Kinematic Frequency-Aware Disentanglement for Motion Style Transfer and Editing*。作者：**Ran Dong、Haoran Xie、Xi Yang**，分别来自Chukyo University、JAIST、吉林大学。SIGGRAPH Asia 2026官方日程已将其列入**Technical Papers / Motion Synthesis & Style**，报告时间为2026-12-03；作者BibTeX标为Conference Papers、to appear。本次未核得正式DOI与论文页码。[会议记录][venue]、[项目][project]

研究方向：动作风格迁移、动作编辑、运动频率表示、潜在扩散。本文使用项目短名 **Kinematic Frequency Motion** 方便阅读。源码固定在2026-11-13提交的[827f3dba][version]，检查输入、条件分支、训练目标、采样和后处理；**没有下载约2.4GB权重、运行推理或复现指标**。作者演示是公开结果，本文架构图是源码教学重绘。原文未取得，不能确认当前发布实现与投稿版本的每一处对应关系。

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

这项工作让一段已有动作提供“做什么”，让参考动作提供“怎样动”，通过学习**高、中、低三个自适应运动频段**，分别组织整体风格、细微运动变化和轨迹条件，再用潜在扩散生成连续动作。[项目][project]、[条件与生成代码][dual]

它最值得研究的是风格控制如何接入生成器：高频不是可读动作词，低频也不天然等于纯内容；这里的分离来自条件结构和训练目标，而非一种有严格语义保证的信号分解。

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 动作风格迁移希望保留源动作的基本过程，再把另一段动作的姿态习惯、节奏或表现方式迁移过来。公开视频中的应用包括人物风格迁移、运动细节夸张和舞蹈编辑。[项目][project]

**现有痛点：** 让走路人物变得更弓背或更活泼，比较容易从整体姿态上看见变化；短促顿挫、局部震颤、落脚前后的细小变化却可能被抹平。反过来，过强的风格条件又可能把原本的行走过程改坏。

**核心矛盾：** “风格”并不只存在于一个时间尺度：慢变化的体态与快变化的细节可以同时存在。把它们压进同一个控制量，难以分别调节；但单纯将高频当风格、低频当内容，也会错过跳跃、急转等动作本身必需的快速变化。

**本文目标：** 作者希望在保持内容结构的同时，提高细风格的迁移和控制能力，并用FineMotion-Style组织相关数据与评价。官方摘要声称取得改善，但改善幅度和比较协议尚无原表可核。[会议摘要][venue]

**切入角度：** 从运动随时间变化的尺度入手，用多变量经验模态分解提供可追踪的频率监督，再训练一个可学习提取器。这样推理时不必重复整套离线分解，同时能为不同条件分支提供不同频率的运动信息。[频段构建][bands]、[提取器配置][extractor-config]

**核心 idea：** 内容动作提供潜在表示与根运动，风格参考提供完整风格嵌入和三频段信息。较低频摘要补充粗风格，高中频进入细风格及轨迹细节支路；生成器在这些条件共同作用下去噪，并解码为新的关节动作。[发布架构图][author-figure]、[实现][dual]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

完整链条分三部分：**离线构造频率监督 → 学习并冻结前端 → 条件潜在扩散生成**。模型输入是已有的内容、粗风格、细风格动作；粗细参考可以相同，也可以分开提供。输出是连续动作及22关节位置，公开演示接口没有把文字或音乐作为直接生成条件。[演示入口实现][demo-code]、[模型forward][dual]

<figure class="reading-figure"><a href="/paper-notes/kinematic-frequency-motion/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/kinematic-frequency-motion/architecture.svg" alt="项目与代码教学架构：离线MEMD对齐训练频率提取器，内容潜在表示与根运动、粗细风格和接触条件进入Dual-Style DiT，DDIM迭代后VAE解码；原始输出与可选软接触清理分开，训练为同片段条件去噪" loading="lazy" /></a><figcaption>依据作者公开架构图与固定源码827f3dba教学重绘，非论文原图；尚未取得全文。实线表示数据流，虚线表示训练关系。点击查看大图；可与<a href="https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/asset/model-all.jpg" target="_blank" rel="noopener">作者原图</a>对照。</figcaption></figure>

先看上方频段监督如何建立，再沿中部从内容与风格两路读到生成输出，最后看底部训练。**离线MEMD不是每次推理的必经步骤；脚部清理也不属于扩散去噪主干。** 图内冻结提取器与可训练条件编码器是不同模块，后者仍需学习如何使用频率信息。

### 关键设计

1. **先定义数据集共享的频率位置，再讨论高、中、低频。**

   离线把SMPL动作变成69维时间信号：根旋转3维、21个身体关节轴角63维、根平移3维，在20Hz下进行多变量经验模态分解（MEMD）。其输出是若干模态对齐的IMF；不同动作得到的模态数量不同，不能直接规定“第一个IMF永远对应同一种风格”。[信号构建][pose69]、[对齐算法][bands]

   当前算法移除最后的残差模态，保留幅值加权频率至少0.5Hz的候选；每段取幅值最大的三个模态并按频率排序，再在数据集上对各排序位置求平均，得到三个目标频率。随后让每段动作的有效模态与这些目标做最近频率匹配，且不能重复使用同一个模态；不足三个合格模态的片段被排除。[对齐代码][bands]

   因此这里的“三频段”更准确地说是**三个数据自适应的模态位置**，不是三个固定FFT区间。0.5Hz只是候选过滤门槛，不是粗细风格的统一分界。README记录发布标签用了160个MEMD投影方向；69维分解要求输入至少70帧，这与下游训练时截取40–196帧窗口是不同步骤。[准备说明][readme]

2. **学习提取器替代重复分解，但保留根、身体、平移分组。**

   可学习IMF提取器接收HumanML263动作，输出三组69维时间信号。共享时间卷积编码器之后，每个频段有适配器，再分根旋转、身体、根平移解码支路。当前发布配置还包含身体63维分支的残差细化器。[提取器][extractor]、[配置][extractor-config]

   这种结构提供的是连续运动信号，没有生成“挥手”“冲击”等离散语义词。它学的是离线MEMD伪目标；提取误差会传入后续模型，因此不能把网络预测的IMF当作每个输入的精确数学分解。

3. **内容与根运动分路，给风格变化留下空间。**

   内容条件不是简单保留原数组：代码将标准化动作的前三个根运动通道置零，经冻结VAE编码；原前三通道另交根运动编码器。后续对内容latent做Instance Normalization，加入时间步信息并编码成内容token，再与带噪latent拼接送入DiT。[内容路径][base]、[去噪器][denoiser]

   这样可以让主干分别接收身体过程和根运动条件，减少一条表示同时承担所有信息的负担。但“前三通道置零”发生在标准化特征里，不能逐字解释成把世界坐标轨迹锁在零点；内容token也没有证明已经完全去除源风格。最终整个动作重新生成，没有逐帧拷回源关节的硬保持步骤。

4. **粗风格是完整动作嵌入加低频摘要，不是低频直接进入MotionCLIP。**

   README有一句话容易造成混淆：它把低频摘要与MotionCLIP连成了一条路径。实际代码先对粗风格参考做反标准化、清除前三个根运动通道，再用冻结MotionCLIP编码完整参考动作；另一路从同一参考提取低频IMF，将其编码和投影后相加。作者公开图也画出了这两条支路。[MotionCLIP输入][base]、[低频融合][dual]、[作者图][author-figure]

   <div class="equation">粗风格条件 = MotionCLIP(处理后的参考动作) + 投影(低频IMF嵌入)</div>

   这是源码流程的教学简写，不是论文编号公式。**粗风格分支仍然看到了完整动作信息**，所以“粗风格只含低频、绝不含细节”不是当前实现能支持的结论。

5. **高中频先压成条件嵌入，再调制去噪器后段。**

   细风格分支保留高、中频IMF，经过时间卷积与有效帧平均池化，形成512维条件嵌入；低频以相同类型的编码路径形成摘要。高中频的根平移部分，即69维中的66:69切片，还单独编码为轨迹细节条件。[频率条件编码][frequency]、[频段选择][dual]

   默认DiT共有九层：粗风格参与注意力支路的平移、缩放和门控调制；细风格从索引6开始，即最后三层参与调制；内容根运动、参考平移IMF及内容接触条件则汇合后调制MLP支路。代码是对latent的条件生成，**没有把一条高频曲线直接加到最终关节上**。[DiT实现][denoiser]

   平均池化也意味着细风格不是一条逐帧照搬的编辑时间线。参考里的某次顿挫是否落到目标的指定时刻，仍需要额外的事件对齐或输出测量，不能仅凭“时间频率信息”就认为已保证。

6. **两个编辑旋钮作用不同，不能把界面名称当成严格解耦。**

   演示把全局尺度称为global或coarse scale，默认示例为2.5；它实际进入最终的classifier-free guidance：以保留内容条件的基准预测为起点，放大带风格条件与基准预测之间的差。细尺度则直接乘在高中频条件嵌入上，默认演示为1.5。它们不是两个对称、互不影响的CFG分支。[演示脚本][demo-code]、[条件缩放][dual]、[采样循环][sampling]

   <div class="equation">ε̂ = ε基准 + s全局 · (ε带条件(α细节 · e细节, …) − ε基准)</div>

   此式仅说明代码中的两种作用位置。调大α会改变模型收到的细风格条件，调大s则放大总体条件差；两个量会共同影响结果。作者展示细尺度10的舞蹈强调，但它没有物理单位，不等于关节幅度或频率严格变为10倍。

7. **接触条件、生成结果和可视化清理是三个层次。**

   当前配置从内容动作预测接触时序，通过可训练编码器加入轨迹条件；`phase_timing_enabled`为false，不能把仓库里的可选phase分支当成发布模型已经采用的核心机制。[配置][config]、[接触条件实现][dual]

   生成之后另有默认开启的foot-contact cleanup：从原始输出的脚部高度与速度判断接触，优化全部22关节坐标，以脚点、骨长、根位置和运动平滑等加权损失改善显示。代码使用800步Adam软优化，不是精确接触约束或物理模拟。[后处理][foot]

   作者将扩散原始输出存为`joints_raw`，清理结果存为`joints`，并说明论文数字使用前者。本文只能确认公开代码和作者声明的这一区分，尚不能核对论文每张表的具体评测路径。[README][readme]、[保存流程][demo-code]

### 一个完整例子

作者仓库展示“**转弯行走＋舞蹈踢腿风格**”。下面沿这一设置追踪数据流，**本次没有运行模型，具体观感请看[官方示例][walk-demo]**：

1. 内容是转弯行走片段，风格是舞蹈踢腿片段，均转换为20Hz、未标准化的`[T,263]`特征；模型内部再按训练统计量标准化。
2. 内容提供VAE latent、独立根运动条件及预测接触时序。输出长度采用内容片段长度，而不是照搬参考的时长。[forward][dual]
3. 参考动作经MotionCLIP提供整体嵌入，低频IMF补充粗风格；高中频提供细风格嵌入，其平移部分另补充轨迹条件。
4. 使用全局2.5、细节10的公开展示设置，从随机latent进行50步DDIM去噪；模型尝试让行走带上参考的细节表现。这里没有“第几秒必须踢腿”的事件指令。
5. VAE解码为动作特征和22关节位置，首先保存原始结果；可选软接触清理随后产生展示版本。仓库中的棍棒人和网格示例使用了清理结果，不能据视频直接推算raw输出的脚滑指标。

公开代码还支持分别输入粗、细参考。例如用一段人物动作提供整体姿态、另一段提供局部节奏，是该接口允许的教学使用方式；其所有组合的效果并没有在本次得到验证。

### 训练/推理

**阶段一：准备表示和前端。** README给出的路线是SMPL统一、HumanML263转换、MEMD频段对齐，再训练VAE、IMF提取器和接触预测器；MotionCLIP使用MCM-LDM的预训练版本。下游扩散训练冻结这些前端，但频率条件编码、低频投影与DiT仍可训练。新的动作数据集需要重新估计频段并适配提取器，不能只替换文件夹就假定原模型完全适用。[训练说明][readme]

**阶段二：当前配置是同片段条件去噪。** `train_diffusion_forward`从同一`batch['motion']`构造目标latent、内容、粗风格、细风格及接触输入；源码虽支持跨样本风格混合，`style_source_mix_enabled`默认false，发布scratch配置没有开启。可核实的默认训练因此是同一片段的条件去噪重建，**不能描述为已有“内容A＋风格B→人工目标A×B”的成对迁移监督**。不同参考的重组发生在推理入口。[训练路径][dual]、[配置][config]

**阶段三：去噪与频率一致性联合训练。** 对目标latent随机加噪，预测噪声；由预测噪声估计干净latent并解码，再通过冻结IMF提取器计算信号、振幅、瞬时频率和嵌入相关损失。当前`HHT_TARGET_MODE: online`的目标IMF也由冻结提取器生成；离线MEMD主要负责此前的提取器监督，而非每个扩散训练batch实时分解。[目标生成][base]、[辅助损失][dual]

**推理：** 内容与参考分别编码，从随机latent开始50步DDIM迭代，VAE恢复连续动作，可选软接触清理。没有LLM规划、可执行动作程序或物理约束求解器。代码中的`condition: text`名称及`t2m_eval`文本评测字段也不等于公开demo支持文本生成：该评测函数同样把同一动作作为内容和风格，文本词向量进入后续评价器。[评测路径][dual]

**训练成本与复现范围：** 单设备、batch128、2000epoch是公开配置，不能由此推算真实GPU小时。原文未取得，当前材料没有可核的GPU型号、实际训练总时长和显存峰值。IMF训练配置还引用`imf_pose69_init.pt`，发布五个权重列出的是最终`imf_extractor.pt`；初始化来源尚需确认，所以README命令齐全也不等于已完成从零训练复现。[配置][config]、[提取器配置][extractor-config]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**未取得论文全文，尚无可核的原始主表。** 以下两类表格分别记录公开证据与实现数值，既不冒充论文结果，也不把参数配置当成性能。会议摘要所称的细风格识别、动作质量和控制改善，暂不能给出基线、数值或统计显著性。[会议摘要][venue]

**公开材料核查表（核查日期2026-11-16）：**

| 项目 | 公开材料能确认什么 | 目前不能据此确认什么 |
|---|---|---|
| 正式会议记录 | SIGGRAPH Asia 2026 Technical Papers收录、作者、报告安排 | 论文全文、原表、最终DOI |
| 项目与架构图 | 内容/风格条件、三频段提取器、迁移和编辑应用 | 每个模块的独立性能贡献 |
| 官方代码 | 输入、冻结部件、实际分支、损失及采样流程 | 本机推理成功或指标复现 |
| 作者定性示例 | 转弯行走＋舞蹈踢腿；楼梯行走＋活力风格 | 大样本成功率、精确接触与原始脚滑指标 |
| FineMotion-Style | 四类风格Impact、Strike、Balance、Shake；公开数据与协议入口 | 单次下载已包含完整六来源语料 |
| 模型权重 | 五个模型文件与下载、校验入口 | 已下载验证、特定GPU可运行及实时性 |

**固定代码版本中的数值，不是论文实验表：**[配置][config]、[调度器][scheduler]、[README][readme]

| 设置 | 发布值 | 用途 / 比较边界 |
|---|---:|---|
| 动作特征 / 帧率 | 263维 / 20Hz | 用户输入表示，原始外部数组不预先标准化 |
| IMF目标 | 3频段 × 69维 | 根旋转3＋身体63＋平移3 |
| 候选模态频率门槛 | 0.5Hz | 非高/中/低三段的分界 |
| 发布MEMD投影方向 | 160 | 离线数据准备 |
| VAE latent配置 | 7 × 256 | 连续latent，不是7个动作词 |
| DiT层数 / 注意力头 | 9 / 4 | 细风格默认在最后3层进入 |
| DDPM训练步数 / DDIM采样步数 | 1000 / 50 | 不是1000次或50次模型训练 |
| 去噪器batch / 训练epoch | 128 / 2000 | 配置，不是实际GPU耗时 |
| AdamW学习率 | 0.0001 | 去噪器公开训练配置 |
| 演示全局 / 细尺度 | 2.5 / 1.5 | 运行示例默认值；不同于yaml的5 / 1 |
| 舞蹈强调 / 楼梯展示细尺度 | 10 / 3 | 两个定性展示设置，不是消融最优点 |

**公开损失配置：** 这些是生成结果经过频率监督支路后的权重，没有对应消融表可推断哪项带来多少收益。[辅助损失实现][dual]

| 损失项 | 权重 | 实际比较对象 |
|---|---:|---|
| IMF信号 | 0.1 | 预测与目标IMF的有效帧L1差 |
| HHT振幅 | 0.02 | 预测与目标模态的振幅特征 |
| HHT频率 | 0.02 | 预测与目标模态的瞬时频率特征 |
| 全局频率嵌入 | 0.01 | 提取器全局表示的余弦距离 |
| 细频率分支 | 0.1 | 生成动作嵌入与目标IMF嵌入的MSE |

**数据与权重的数量口径：** 数据卡区分完整研究语料和当前可下载包：Hugging Face主要提供同一Bandai来源的两个表示包，其余来源需分别取得；保存的可用motion池为59,038个ID，作者说明论文59,039计数仍有一个ID差异。67,907个基础文本/特征ID与13,357个严格风格标签是不同范围，不能相加或互相替代。[数据卡][data-card]

五个权重在README中列为VAE 929MB、IMF提取器91MB、接触预测器1MB、MotionCLIP 217MB、去噪器1.03GB，总量约2.4GB；**文件大小不是运行显存需求**。首次调用CLIP还涉及另行加载ViT-B/32。[权重说明][readme]

### 消融实验

**粗/细频段分支：** 公开源码存在分支开关和注入层参数，但没有取得与之对应的原始对照表。不能写成“移除细分支下降多少”或据默认值宣布九层/后三层最优。

**频率损失与分解方式：** 仓库包含其他频率处理选项及相关损失，当前发布配置采用IMF；代码可切换不等于作者已经用一致协议完成并公布FFT、DWT、MEMD的性能比较。

**接触与脚部清理：** 训练中的内容接触条件与推理后的软优化可以分别辨认，但目前没有相同输入上“有/无”两者的量化表。公开清理后的演示不构成生成器消融结果。

### 关键发现

1. **目前最扎实的结论是控制路径可追踪。** 低频摘要、细风格嵌入和根运动进入不同位置，且发布代码允许分别提供参考；这证明接口存在，尚不证明因素完全独立。
2. **细节放大与细节精确指定不同。** 细尺度改变条件嵌入，最终仍由扩散模型综合生成。它适合研究风格强度，却不能直接代替逐时刻、逐关节的编辑曲线。
3. **定性结果要保留后处理口径。** 作者展示包括脚部软优化后的输出；正式定量提升需要在论文协议及原始输出上继续核查。
4. **性能判断仍然开放。** 尚不能排名比较其与MCM-LDM、其他风格模型的质量、速度或成本；同片段条件评测也不能自动代表跨内容、跨风格迁移能力。

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **频率监督有来源：** 通过真实运动的MEMD结果训练提取器，让“细风格”不只依赖一个任意命名的latent，也能回到信号变化进行分析。
- **内容、风格和轨迹分别进入模型：** 哪些信息用于保持过程、哪些信息用于改变表现，有了具体可检查的位置；这为后续设计干预和失效测试提供了基础。
- **离线慢分解与在线学习提取分开：** 复杂的频段准备可以预先完成，推理用网络提取参考条件。但没有实际计时，不能据结构宣布其适合实时系统。
- **允许粗细参考分开：** 用户可以探索同一内容下不同来源的组合，比只有一个风格标签多了操作空间；组合是否协调仍需评价。

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **频率不提供唯一语义。** 同样的高频变化可能是风格震颤、动作本身的快速摆动，也可能是噪声。三个模态位置不能直接命名为通用动作原语。
- **内容保持是学习目标，非输出硬约束。** 原动作通过latent与根条件影响去噪，源关节没有逐点锁定；若应用要求指定脚点、精确根路径或动作事件不变，需要另设约束与输出检查。
- **局部时间控制仍有缺口。** 频率条件被卷积与池化汇总，公开入口没有显式“第2秒增加一次强调”的时间表。内容接触预测也只是软条件。
- **频段依赖数据与预处理。** 原始骨架要重定向、转换、统一帧率；目标频率由数据集估计，缺少三个有效模态的样本被过滤。跨来源泛化不能从表示名称直接推出。
- **公开训练配方尚有复现问题待解决。** IMF初始化文件、完整多来源数据取得与实际训练成本仍需补证。当前源码比摘要更具体，但不代替完整论文协议及运行验证。
- **缺少原表限制了评价深度。** 不能确定性能增益来自频率表示、额外条件、模型容量还是后处理，也无法核查失败例分布。这些是本篇证据范围的限制，不预先断定方法无效。

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **[MCM-LDM][mcm]：** 本项目明确复用其训练好的MotionCLIP权重，整体风格表示存在预训练前提。这里重点增加可学习频率提取器及粗细条件路径，不能把全部前端都当作本篇从零提出或训练。
- **[HumanML3D][humanml]：** 本实现沿用HumanML263的动作特征和转换路线；与同一表示兼容不代表任意BVH、SMPL参数和角色骨架可以不经处理互换。
- **[DeepPhase](/blog/siggraph2022-deepphase/)：** 两者都关注动作中的时间变化结构。本文公开实现用MEMD监督的连续模态条件服务于风格迁移，不应将它等同于一个可直接控制角色周期状态的相位流形。
- **[FineMotion-Style][data]：** 它是这项工作的配套风格数据与协议，含Impact、Strike、Balance、Shake等评价分组；这些数据类别不能反过来证明每个IMF就对应一个类别，也应与其他同名FineMotion工作区分。
- **启发：** 可以分别评价“内容事件有没有保留”“风格变化有没有迁移”“接触和轨迹有没有满足”，再研究可读控制接口。仅证明某个频段或风格嵌入发生变化，仍不够证明目标动作正确完成。

<span id="reading-8" class="reading-anchor"></span>
## 来源

1. [SIGGRAPH Asia 2026正式会议记录][venue]、[作者项目][project]：论文身份、收录状态、研究目标、作者公开图与视频。核查时Paper按钮未开放；本篇没有原文页码、公式号和实验表号。
2. [固定源码827f3dba][version]：[README][readme]、[频段对齐][bands]、[SMPL69信号][pose69]、[提取器][extractor]与[提取器配置][extractor-config]。
3. [基础条件与在线监督][base]、[Dual-Style模型][dual]、[DiT调制][denoiser]、[频率条件编码][frequency]、[扩散采样][sampling]：本文方法细节与训练/推理区分的直接依据。
4. [发布配置][config]、[DDPM/DDIM调度器][scheduler]、[演示脚本][demo-code]、[脚部软优化][foot]：参数、输入输出、展示后处理口径。
5. [数据仓库][data]、[数据卡][data-card]与[权重][weights]：公开数据范围、计数差异、下载入口。本文未执行模型或重建完整语料。

架构图为依据公开材料重绘的教学图；示例链接指向作者结果。本文涉及控制保证、时间池化、同片段训练及泛化边界的判断属于静态实现分析，不能当成作者未公开的实验结论。

</div>

[project]: https://www.dr-lab.org/projects/kinematic-frequency-motion/
[venue]: https://sa2026.conference-schedule.org/presentation/?id=papers_1496&sess=sess129
[code]: https://github.com/dongran/kinematic-frequency-motion
[version]: https://github.com/dongran/kinematic-frequency-motion/tree/827f3dba9a58e4493e6621e9f83ddb4afddd82b2
[readme]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/README.md
[author-figure]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/asset/model-all.jpg
[bands]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/prep/frequency_bands/alignment.py
[pose69]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/prep/frequency_bands/pose69.py
[extractor]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/imf_extractor/models/imf_extractor.py
[extractor-config]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/configs/imf_pose69_teacher.yaml
[base]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/mld/models/modeltype/mld_hht_base.py
[dual]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/mld/models/modeltype/mld_hht_dual_style.py
[denoiser]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/mld/models/architectures/mld_denoiser_dual_style.py
[frequency]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/mld/models/architectures/frequency_branch.py
[sampling]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/mld/models/modeltype/mld.py
[config]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/configs/dual_style_finemotion_scratch.yaml
[scheduler]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/configs/dual_style/scheduler.yaml
[demo-code]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/demo_dual_style.py
[foot]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/mld/postprocess/foot_fix.py
[walk-demo]: https://github.com/dongran/kinematic-frequency-motion/blob/827f3dba9a58e4493e6621e9f83ddb4afddd82b2/asset/turning_walk.gif
[demo]: https://huggingface.co/spaces/randong/kinematic-frequency-motion
[weights]: https://huggingface.co/randong/kinematic-frequency-motion-weights
[data]: https://github.com/dongran/finemotion-style
[data-card]: https://huggingface.co/datasets/randong/FineMotion-Style
[mcm]: https://xingliangjin.github.io/MCM-LDM-Web/
[humanml]: https://github.com/EricGuo5513/HumanML3D
