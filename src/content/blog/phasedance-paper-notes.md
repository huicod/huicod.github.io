---
title: "[NeurIPS2026] PhaseDance：用周期相位与拉班描述统一舞蹈生成和理解"
description: "基于32页原文完整解读：确定性运动相位、PCCA、相位门控专家与四任务训练；区分部署合成相位和真值相位oracle，核对舞蹈生成、描述、补间及消融实验。"
pubDate: "2026-11-02T16:20:00+08:00"
badge: "Paper"
tags: ["PhaseDance", "Music-to-Dance", "Motion-Phase", "Laban", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文更新：2026-11-07。** 本文已依据作者公开的32页论文重写，涵盖正文、附录A–K、原表与架构细节。[HTML 全文阅读版（可用翻译插件）][html-reader] · [作者原文 PDF][paper] · [项目演示][project]

<details class="paper-meta"><summary>论文信息与阅读范围 · NeurIPS 2026</summary>

论文：*PhaseDance: Capturing Rhythm and Expressivity in Dance Modeling*。作者：**Meongeun Kim、Taehui Lee、Soomin Park、Sung-Hee Lee**，KAIST。正式会议为**NeurIPS 2026**，官方海报条目153947；已核对会议记录与作者项目，不以PDF模板页眉代替录用证据。[会议条目][poster] · [项目页][project]

本次阅读版本为作者项目提供的 **neurips_2026.pdf，共32页**，含附录A–K及检查清单；文中公式、图表与页码均按此版本。研究方向：舞蹈生成与理解、周期相位、Laban Movement Analysis、离散动作token、多任务自回归模型。

**全文阅读：** [打开 HTML 阅读版][html-reader]。本站从原 PDF 提取英文正文并重排，支持浏览器翻译插件；公式与复杂图表保留原图，附章节目录和原页定位。此阅读版并非作者官方 HTML，技术细节以原 PDF 为准。

截至2026-11-07，项目页的Code和arXiv入口仍为 **Coming soon**；未核实公开可运行代码／权重，本次未执行训练或模型推理。DT训练数据因产业伙伴所有权不能公开再分发，主结果在公开AIST++上评测。[项目页][project] · [附录E、检查清单§5][paper]

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

**PhaseDance用持续转动的二维相位信号告诉模型“当前走到动作周期的哪里”，用拉班启发的描述告诉模型“以什么舞步和质感来跳”，再通过相位门控的共享解码器完成文字生舞、舞蹈续写、补间和舞蹈描述。** 主模型不是直接听音频跳舞：音乐主要参与训练数据的相位提取和语义设计；部署时可由用户给定名义速度合成相位，音频条件属于额外微调扩展。[§3–4、附录D.1][method]

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** Bailando、EDGE、Lodge等音乐舞蹈模型通常用动作事件与音乐拍点的接近程度描述同步。与此同时，通用动作语言模型已能读写动作token，但舞蹈文本经常只有“这是hip-hop”之类舞种标签，缺少舞步、运动质感和编舞层次。[§1–2][intro]

**现有痛点：** 两段舞都可能在拍点附近落脚，却有完全不同的跨拍组织：一个动作可以占两拍或四拍，hip-hop也会故意稍微拖拍。只奖励瞬时拍点重合，容易把“规则地延后、但保持音乐周期”的舞蹈判得很差；只有舞种标签，又说不清同一舞步是轻盈、紧促还是舒展。[§1、附录G][intro]

**核心矛盾：** 节拍对齐是离散时刻之间的距离，舞蹈律动还取决于周期、分组和舞种习惯；自然语言能说动作内容，却不天然带有逐帧推进的节奏坐标。模型需要同时获得“时间结构”和“表达方式”，不能指望单一拍点奖励或一个风格标签把二者全部补齐。[§1、§3][intro]

**本文目标：** 建立可用于多种舞蹈任务的周期表示，让用户能改变续写节奏；同时用舞蹈专属动作名称和可计算质感词，改善文字条件与动作描述。评测也要分别检查运动质量、周期相符和舞种特有的踩拍方式。[§1贡献、§5.1][intro]

**切入角度：** 作者借鉴DeepPhase的周期参数化，但不训练额外相位自编码器，而是从全身速度曲线确定性地选出运动拍链，再将每段周期映射到单位圆。另一条线从关节几何计算15个LMA启发指标，离散成可读形容词。[§3、附录A/H][representation]

**核心 idea：** 先准备动作token、连续相位和分层描述；生成时，相位一方面查询文字或动作上下文，理解这个周期对应什么内容，另一方面直接调节解码器输入、FFN专家和输出头。这样同一个解码器可以依照不同条件生成动作，也能在无相位模式下输出舞蹈文字。[§4、图2][method]

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

系统分为**数据表示准备、动作tokenizer训练、多任务模型训练与任务推理**。动作先转成每帧一个离散token；相位是独立的连续控制信号；文本与动作分别通过各自编码器提供上下文。三种动作生成任务使用相位双通路，舞蹈描述任务M2T则关闭相位并改用文字输出头。[§4、表1、附录D][method]

<figure class="paper-figure"><a href="/paper-notes/phasedance/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/phasedance/architecture.svg" alt="PhaseDance完整架构：离线相位与拉班描述构建、动作VQ-VAE、四任务编码器与共享解码器、PCCA及三处原始相位注入、动作和文本输出，以及独立音乐微调扩展" loading="lazy" /></a><figcaption>依据原文图2、表1与附录A/D/H重绘的教学架构。实线表示数据流，虚线表示监督、参数复用或自回归反馈；点击查看大图。</figcaption></figure>

**读图顺序：** 先看A区怎样从训练运动得到token、相位与文字；再看B区当前任务选择哪一路上下文、从哪里取得相位；C区展示相位的“解释通路”和三处“直接注入”，D区区分动作解码与文字解码。音乐MERT分支单独放在扩展区，避免把额外微调当成四任务主模型的默认输入。蓝色为冻结／复用组件，绿色为可训练或推理计算，橙色为数据、用户条件或监督。

### 关键设计

1. **从速度谷值提取周期：相位不依赖一个额外训练的编码器**

   输入运动采用22个关节的位置。作者先在60 Hz下计算相邻帧关节位移的平均值，经过中值滤波与高斯平滑，得到全身运动速度曲线v。局部最小值是候选运动拍，过于接近的谷值只保留更深的一个。[§3.1、附录A算法1][phase]

   有配对音乐时，用BeatNet音乐拍的中位间隔提供目标周期；没有音乐时，用v的主FFT峰估计周期，并折入40–240 BPM范围。动态规划寻找间隔落在目标周期±20%内的最长候选拍链，长度相同时偏好间隔偏差小的链；按1、2、½、¼、4倍周期依次尝试，容纳半速、倍速等结构。这里对齐的是**周期长度**，运动拍仍来自运动谷值，不要求每个运动拍与音乐拍在绝对时刻重合。[附录A/B][phase]

   对相邻选定拍b<sub>k</sub>、b<sub>k+1</sub>之间的帧t，周期角线性推进：

   <div class="equation">S<sub>t</sub> = 2π(t−b<sub>k</sub>)/(b<sub>k+1</sub>−b<sub>k</sub>)；&nbsp;ϕ<sub>t</sub> = (cos S<sub>t</sub>, sin S<sub>t</sub>)</div>

   上式是附录算法1的简化表达。提取器还计算幅度A、偏置B、频率F和静止掩码O，随后重采样到50 Hz与动作token对应；**模型主要消费二维ϕ，幅度A虽被提取但未作为生成控制量使用。** 全身22关节平均产生一条相位轨迹，不能理解成每条手臂各有独立时钟，也不显式编码八拍小节号。提取失败的片段会被丢弃，HumanML3D的成功率为94.4%。[§6、附录A/B表7][phase]

2. **用LMA启发的可计算指标，补充舞种与舞步名称之外的表达**

   每个片段的文字分四层：**genre舞种、movement舞步、description运动描述、texture运动质感**。前三层读取各语料原有标注，最后一层由关节轨迹确定性计算；指标按语料归一化到[0,1]，分成3–4个档位，再映射到固定形容词。[§3.2、附录H][lma]

   | 运动指标 | 运动侧含义／计算线索 | 对应音乐特征 | 词汇例子 |
   |---|---|---|---|
   | Vigor | 平均关节速度，活跃程度 | RMS Energy | high-energy |
   | Accent Density | 平均加速度峰的密度 | Onset Density | punchy |
   | Kinetic Energy | 关节速度平方统计 | Loudness（LUFS） | explosive |
   | Flow（Jerk） | jerk越小，流动性代理越高 | Spectral Flux | fluid |
   | Weight | 平均关节加速度，轻重感代理 | Sub-bass Energy | heavy |
   | Time Quality | jerk相对加速度的突发性 | Attack Time | sudden |
   | Expansion | 身体相对根节点的展开范围 | Spectral Spread | expansive |
   | Level Change | 低频根高度变化 | Pitch Variance | level-varied |
   | Kinesphere Usage | 关节轨迹凸包体积占比 | Arrangement Density | space-filling |
   | Bounciness | 根高度高频变化幅度 | Groove Strength | bouncy |
   | Groove Depth | 根高度变化与自相关 | Swing Ratio | deep-groove |
   | Movement Tempo | 根与关节的平均速度代理 | Tempo（BPM） | fast |
   | Symmetry | 左右关节运动相关性 | Structural Regularity | symmetric |
   | Body Independence | 上下身平均速度去相关程度 | Polyphonic Complexity | isolated |
   | Upper–Lower Contrast | 上下身运动强度相对占比 | Frequency Band Balance | upper-focused |

   表按原表13–14整理。**texture标签从运动几何计算，不要求每个样本先提取15项音频特征来监督。** 音乐列表达作者设计的共同语义轴，不是15项跨模态数值相关已逐一验证；这些也是LMA启发的工程代理量，不能把Movement Tempo直接等同于相位BPM，或把Body Independence等同于可独立控制身体部位。[附录H表13–14][lma]

   训练描述以60%丰富模板、25%舞种＋舞步模板、15%仅舞种模板混合。丰富模板再加入1–3个质感词和运动描述，例如“有力、流畅的waacking”，使模型既接触细致要求，也能应付评测时的简短提示。[附录H.2][lma]

3. **分开保存语言与动作表示，再共享解码器**

   动作VQ-VAE先在HumanML3D、AIST++、DanceDB和DT联合语料上从头训练，使用**1个1024项码本，不做时间下采样**。动作以50 Hz编码，因此5秒片段对应约250个动作token；这些ID是码本索引，不是“抬手”“下蹲”这样的人工舞步词。[§4.1、§5.1][method]

   文字通过冻结T5-small编码器，动作token进入单独的4层Transformer动作编码器E<sub>m</sub>，不先把动作ID翻译成语言词表。共享解码器从T5初始化并训练；T5文字嵌入与文字输出头保持冻结。动作输出需要另一个相位门控头，再经VQ-VAE解码回连续运动。[§4.1、附录D][architecture]

4. **PCCA：让相位先问上下文“这一轮应该表达什么”**

   相同相位在“Roger Rabbit舞步”、笼统的“hip-hop”和已知动作前缀中含义不同。PCCA先将ϕ经MLP得到H<sub>ϕ</sub><sup>raw</sup>，以它为Query，以当前文字／动作编码H<sub>c</sub>为Key和Value做交叉注意力，再经过残差与FFN，得到上下文解释过的相位H<sub>ϕ</sub><sup>fused</sup>。[§4.2.1，式1][method]

   <div class="equation">H′ = H<sub>ϕ</sub><sup>raw</sup> + MHA(LN(H<sub>ϕ</sub><sup>raw</sup>), LN(H<sub>c</sub>))；&nbsp;H<sub>enc</sub> = [H<sub>c</sub>; H<sub>ϕ</sub><sup>fused</sup>]</div>

   解码器交叉注意力读取这个拼接memory，既保留内容，又让相位与内容产生条件关联。**PCCA是可学习的融合，不是保证任何动作事件准确落在某拍上的解析运动规则。**[式1、表5][method]

5. **三处直接注入相位：逐帧表示、专家选择与输出分布共同响应节奏**

   PCCA之外，原始二维相位还进入三个位置。第一处，把当前相位嵌入加到上一动作token嵌入上。第二处，每个解码器块的FFN改成**4个专家**，门控只读取(cos S,sin S)，用softmax权重混合专家输出。第三处，**8个输出头专家**按相位混合logits，再预测下一个动作token。[§4.2.2，式2–4][method]

   <div class="equation">h<sub>t</sub><sup>in</sup> = Emb(m<sub>t−1</sub>) + φ<sub>emb</sub>(ϕ<sub>t</sub>)；&nbsp;MoE(h<sub>t</sub>,ϕ<sub>t</sub>) = Σ<sub>i=1..4</sub>g<sub>i</sub>(ϕ<sub>t</sub>)·FFN<sub>i</sub>(h<sub>t</sub>)</div>

   专家从T5的FFN初始化：第一个直接复制，其余加σ=0.01的高斯扰动。附录扫描完整圆周发现，不同专家主要负责连续相位区间；这不是预先指定“准备／发力／恢复”的语义分工，也不是每帧只选一个专家，甚至第0层始终由同一专家占优。[附录D.3、表10][architecture]

6. **限制运动历史，避免过去动作盖过当前节奏；文字任务保留长上下文**

   动作生成时，每个位置的自注意力仅看当前token和前4个token，W=4。作者希望模型依靠外部相位决定节奏，而不是从整段历史惯性复制旧时间安排；对文字描述M2T，窗口限制关闭，保留标准因果历史以支持句子连贯。[§4.2.3，式5][method]

   | 任务 | 输入条件 | 相位／FFN | 输出 |
   |---|---|---|---|
   | TP2M 文字生舞 | 文字 → 冻结T5编码器 | 使用ϕ，相位门控 | 8专家动作头 → token → 动作 |
   | MP2M 舞蹈续写 | 前20%运动 → E<sub>m</sub> | 使用ϕ，局部因果窗口 | 后80%运动 |
   | IB 舞蹈补间 | 首尾各25%运动＋段标记 → E<sub>m</sub> | 使用ϕ，局部因果窗口 | 中间50%运动 |
   | M2T 舞蹈描述 | 完整运动 → E<sub>m</sub> | 不使用ϕ，FFN专家均匀平均 | 冻结T5 LM head → 文字 |

   表按原表1及附录D整理。补间用已知首尾作条件，不等于论文证明任意接触或关节轨迹都被硬锁定。

### 一个完整例子：给同一段舞蹈前缀续出不同节奏

原文图4固定动作前缀，只改变输入相位的名义速率，展示0.5×、1×、1.5×、2×的不同续写。结合附录D的5秒评测协议，可把一次MP2M调用展开如下。[图4、附录D/J.1][example]

1. **输入同一秒动作。** 已知前20%即1秒舞蹈，VQ-VAE将其变成约50个动作token；动作编码器E<sub>m</sub>提取内容、姿态和已有节奏上下文。
2. **选择继续怎么跳。** 为待生成部分提供合成相位。假设名义速率为1周期／秒，0.5×和2×分别让单位圆每2秒和每0.5秒转一圈。这个数值解释是教学示意；图4的实际动作与倍率来自作者结果。这里不读取未来真值动作，也不必提供音频。
3. **让周期与已有动作结合。** PCCA让新相位查询前缀上下文，沿着这段舞的内容继续，但节奏条件发生变化。
4. **逐帧生成。** 上一动作token和当前ϕ进入解码器；4个FFN专家与8个输出头随相位变化，用top-k/top-p采样下一个token，再回送到下一步，直到续完4秒。
5. **还原与比较。** VQ-VAE解码为连续运动。不同速率产生不同律动续写，说明相位有控制作用；不能进一步推断动作频率总会精确按倍率变化，或转速翻倍就一定把指定舞步次数严格翻倍。[附录C表9、图4][example]

若改为M2T，同一模型读取完整舞蹈后会关闭相位路径、均匀混合FFN专家并输出文字。附录表16的House/Farmer示例生成了“有力质感、左右跳步转移重心、抬膝并反向摆臂”等细节；这是描述已有动作的结果，不是输入这些文字后已验证的逐关节执行保证。[附录J.3、表16][example]

### 训练／推理

**第一阶段训练动作tokenizer。** 在四语料的联合运动上从头训练1024项单码本VQ-VAE，50 Hz、不做时间下采样；论文报告batch size 512、学习率4×10<sup>−4</sup>，未给这一阶段的独立耗时。[§5.1、附录D.2][architecture]

**第二阶段联合训练四任务。** 固定动作tokenizer／码本和T5文字编码、共享文字嵌入、LM head；更新动作编码器、共享解码器及新增相位模块。三种动作任务预测动作token，M2T预测文字token，均使用交叉熵，任务权重TP2M=1、MP2M=1、IB=0.8、M2T=0.1。此阶段不输入音频特征。[§4.3，式6；附录D][architecture]

第二阶段报告使用**4–6张NVIDIA RTX PRO 4500 Blackwell，约2天**，每卡batch 16、梯度累积4次，标称有效batch 256；此batch数对应4卡设置，6卡时的具体配置未细分。学习率1×10<sup>−4</sup>，5000步warm-up，200000步衰减周期。这不是包含tokenizer和所有消融的完整项目成本。[附录D.2][architecture]

**推理必须区分两种相位来源。** `synthesis_phase`是部署设置：围绕名义速度合成相位，无配对音乐也能用；`gt_phase`从测试集未来真值运动提取，是**oracle参考**，生成时通常拿不到。两者用同一已训练checkpoint。主表3的部署行对应附录表9的1.0 cycles/s固定周期行，其他任务完整速度采样实现尚需公开代码核查。动作采样top-k=50、top-p=0.95、temperature=1，文字描述beam=4。[§5.1、附录C/D][protocol]

**音乐条件是单独微调扩展。** MuP2M从第二阶段checkpoint出发，用冻结MERT-v1-95M提取75 Hz、768维音频特征，经可训练适配器映射到512维并重采样至50 Hz；只更新适配器和相位条件解码器，在AIST++配对数据上训练。它不是四任务训练里的默认第五路条件，也没有证明文字、音频和动作冲突时的硬优先级。[附录D.1–D.2][architecture]

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

**AIST++文字生舞与音乐生舞：原表2。** 采用5秒切片；保留代表性音乐基线、文字基线及两种相位设置。不同输入任务分开标注，不能把跨任务结果当作条件完全相同的排名。[§5.1–5.2、表2][results]

| 输入／方法 | FID<sub>k</sub> ↓ | FID<sub>g</sub> ↓ | Div<sub>k</sub> → | Div<sub>g</sub> → | BAS → | BPS ↑ | BAS-Genre Pearson ↑ | Spearman ↑ | MAE ↓ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Ground Truth | 17.10 | 10.60 | 8.19 | 7.45 | 0.24 | 0.86 | 1.00 | 1.00 | 0.00 |
| 音乐／EDGE | 42.16 | 22.12 | 3.96 | 4.61 | 0.23 | 0.63 | 0.21 | 0.12 | 0.09 |
| 音乐／Lodge | 37.09 | 18.79 | 5.58 | 4.85 | 0.24 | 0.67 | −0.12 | −0.01 | 0.07 |
| 音乐／Bailando | 28.16 | 9.62 | 7.83 | 6.34 | 0.23 | 0.65 | 0.39 | 0.49 | 0.05 |
| 音乐／TM2D | 23.94 | 9.53 | 7.69 | 4.53 | 0.21 | 0.68 | −0.47 | −0.53 | 0.08 |
| 音乐／LMM | 22.08 | 21.97 | 9.85 | 6.72 | 0.22 | 0.70 | −0.23 | −0.36 | 0.07 |
| 音乐／UDE | 17.25 | 8.69 | 7.78 | 5.81 | 0.23 | 0.67 | 0.14 | 0.10 | 0.07 |
| 文字／UniMuMo | — | — | 9.14 | 9.37 | 0.25 | — | 0.18 | 0.32 | 0.10 |
| **文字／PhaseDance 合成相位** | **24.53** | **11.37** | **6.30** | **7.14** | **0.20** | **0.67** | **0.76** | **0.52** | **0.03** |
| 文字／PhaseDance 真值相位（oracle） | 22.61 | 9.03 | 8.39 | 7.07 | 0.22 | 0.73 | 0.47 | 0.73 | 0.05 |

FID<sub>k/g</sub>分别在动力学／几何特征上衡量分布距离，越低越好；Div与本文BAS使用“→”，关注接近GT而非无限增大。BAS衡量局部运动拍与音乐拍的接近，BPS衡量周期匹配；BAS-Genre指标比较10个舞种各自BAS组成的向量与GT向量。GT的非零FID按原表保留，不擅自改写成0。[§5.1.2、表2][metrics]

**BPS具体衡量什么？** 分别由运动拍和音乐拍的中位间隔估计BPM，允许h∈{1,2,½,4,¼,3,⅓}的整数／分数倍频，再计算最小相对速度误差e，最后BPS=exp(−e²/(2×0.2²))。因此BPS高表示允许倍频后的周期接近，不等于每拍同时发生、乐句边界一致或逐部位节奏完全同步。[§5.1.2，式7][metrics]

**AIST++续写与补间：原表3。** MP给前1秒生成后4秒；IB给首尾各25%生成中间50%。下表保留原始量级，论文未在此表注明ADE/FDE的物理单位，不另行标成cm或m。[表3、附录D][results]

| 方法 | MP FID ↓ | MP DIV → | MP ADE ↓ | MP FDE ↓ | IB FID ↓ | IB DIV → | IB ADE ↓ | IB FDE ↓ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Ground Truth | — | 2.320 | — | — | — | 2.301 | — | — |
| EDGE | 8.936 | 1.954 | 5.495 | 5.425 | 5.086 | 1.484 | 5.156 | 5.508 |
| Lodge | 1.949 | 1.403 | 1.917 | 2.156 | 2.136 | 1.382 | 1.875 | 1.934 |
| Bailando | 0.973 | 2.552 | 4.930 | 4.999 | 0.612 | 1.936 | 4.952 | 5.019 |
| MoMask | 8.731 | 2.599 | 4.154 | 5.595 | 9.808 | 2.600 | 3.846 | 5.162 |
| LMM | 5.379 | 2.126 | 6.547 | 8.856 | 3.393 | 2.357 | 6.197 | 7.230 |
| **PhaseDance 合成相位** | **2.077** | **2.315** | **2.952** | **4.127** | **1.534** | **2.392** | **2.735** | **3.070** |
| PhaseDance 真值相位（oracle） | 2.975 | 2.682 | 2.992 | 4.239 | 2.513 | 2.801 | 2.734 | 3.131 |

**AIST++舞蹈描述：原表4。** `with desc`把舞种、舞步、描述、质感合成一个训练句子，`without desc`每次使用一条原始短描述；不是“有／无相位”的对照。[§5.3、表4][captions]

| 方法 | R@1 ↑ | R@2 ↑ | R@3 ↑ | BLEU-1 ↑ | BLEU-4 ↑ | ROUGE-L ↑ | CIDEr ↑ | BERTScore ↑ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| GT描述 | 0.063 | 0.156 | 0.281 | — | — | — | — | — |
| UniMuMo | 0.094 | 0.125 | 0.250 | 45.50 | 7.20 | 33.30 | 12.80 | 29.87 |
| PhaseDance without desc | 0.125 | 0.156 | 0.219 | 57.20 | 24.80 | 50.20 | 20.30 | 34.75 |
| PhaseDance with desc | 0.063 | 0.188 | 0.250 | 55.76 | 23.93 | 62.84 | 70.58 | 35.42 |

检索每次从32条描述中找匹配项，评价器在HumanML3D动作文字上训练，GT R@1也只有0.063，说明它对舞蹈专属词汇区分有限。BLEU等列按原表量级保留，不把CIDEr与其他指标混为统一百分比；ROUGE/CIDEr改善也部分反映训练描述与参考描述的信息层次更接近，不能独立证明所有舞步细节都识别正确。[§5.3][captions]

**感知实验验证的是指标：附录表11–12。** 研究A保留29名参与者，动作不变，仅改变音频；研究B另有31名参与者评价舞种踩拍习惯。下表“选择”是去掉“无差异”后的试次计数，不是人数，更不是PhaseDance相对基线的生成偏好胜率。[附录G][perception]

| 对比 | 两条件BAS | 两条件BPS | 无差异试次 | 其余选择计数 | 结果 |
|---|---|---|---:|---|---|
| 原音乐M vs 同音乐延后20%拍P | 0.59 / 0.19 | 0.98 / 0.98 | 58% | M 59 / P 76 | p=0.17，不显著 |
| 原音乐M vs 周期不匹配音乐U | 0.59 / 0.64 | 0.98 / 0.30 | 4% | M 110 / U 1 | p<0.001 |
| 延后但同周期P vs 周期不匹配U | 0.19 / 0.64 | 0.98 / 0.30 | 2% | P 111 / U 3 | p<0.001 |

研究B中，10种舞的平均踩拍精确度评分与GT舞种BAS的Pearson相关为0.81、Spearman为0.79；它支持保留舞种差异，不意味着BPS已完整刻画舞蹈全部审美。[附录G、图3][perception]

### 消融实验

**四个结构部件与多任务：** 原表5在AIST++文字生舞、合成相位设置下替换一个组件并重新训练。[§5.4、表5][ablation]

| 变体 | FID<sub>k</sub> ↓ | FID<sub>g</sub> ↓ | Div<sub>k</sub> → | Div<sub>g</sub> → |
|---|---:|---:|---:|---:|
| GT | 17.10 | 10.60 | 8.19 | 7.45 |
| 完整PhaseDance | 24.53 | 11.37 | 6.30 | 7.14 |
| 多任务 → 只训练文字生舞 | 27.77 | 16.72 | 4.41 | 7.51 |
| W=4局部注意力 → 完整因果注意力 | 36.98 | 28.23 | 4.40 | 8.19 |
| 8专家输出头 → 普通投影 | 38.83 | 20.62 | 4.78 | 7.95 |
| 相位门控MoE → 单FFN | 55.06 | 33.26 | 2.75 | 6.09 |
| PCCA → 简单拼接 | 80.44 | 55.01 | 1.71 | 3.04 |

**组件作用与取舍：** PCCA替换带来的退化最大，FID<sub>k</sub>由24.53升到80.44；扩大到全历史并没有改善生成。MoE→单FFN同时减少专家容量并取消相位路由，不能仅凭这一行分离两者贡献。单任务Div<sub>g</sub>=7.51反而更接近GT 7.45，完整模型并非每列都最优。[表5][ablation]

**去掉变化的相位：** 原表3用同一checkpoint做推理干预。相位固定在同一个圆周点时，MP FID由2.077升至6.248，IB FID由1.534升至4.737；完全关闭相位时，MP ADE/FDE由2.952/4.127变为4.307/9.591。也要保留例外：固定相位的MP FDE=3.726，低于正常合成相位4.127，不能写成“所有指标都变差”。[表3、附录C表9][robustness]

**相位有误差时：** 附录表9将gt_phase内部拍点加入48–184 ms扰动，或改用0.5–2.0周期／秒、以固定频率持续推进的相位；轨迹指标总体仍在相近范围，明显优于完全删除相位的MP结果。它说明运动前缀提供的上下文能缓冲部分误差，不能据此保证任何音乐、任意错误速度都稳健。[附录C][robustness]

**增加分层文字：** `with desc`的ROUGE-L由50.20升至62.84，CIDEr由20.30升至70.58，但BLEU-1由57.20降至55.76、BLEU-4由24.80降至23.93。这个对照同时改变句子内容组织和texture信息，不能把全部增益归给15个指标中的某一个。[表4、§5.3][captions]

**音乐扩展更依赖正确相位：** 原表6中，额外微调的MuP2M使用合成相位时，舞种BAS的Pearson／Spearman为−0.10／−0.07；换成真值相位才到0.76／0.67。文字任务两种相位分别为0.76／0.52和0.47／0.73。这说明音乐分支尚不能概括成“直接输入任意音乐就稳定对齐”。[表6、附录D.1][ablation]

### 关键发现

1. **优势集中在周期与舞种节奏结构，运动质量是有竞争力而非全面最佳。** 合成相位BPS=0.67与音乐基线0.63–0.70同一范围，舞种BAS Pearson=0.76明显更高；但其FID<sub>k</sub>=24.53、FID<sub>g</sub>=11.37都不如UDE的17.25／8.69。[表2][results]
2. **oracle相位并不让每项指标都变好。** 它在文字生舞提升BPS和FID，在MP／IB却分别得到FID 2.975／2.513，差于部署合成相位2.077／1.534；文字任务Pearson也从0.76降到0.47。相位与上下文的关系比“越接近真值越好”复杂。[表2–3、表6][results]
3. **续写存在质量、多样性和轨迹误差的取舍。** AIST++上Lodge的ADE/FDE更低，却显著欠多样；PhaseDance的MP DIV 2.315接近GT 2.320，Bailando则有更低FID但较高轨迹误差。[表3][results]
4. **另一数据集结果不是零样本泛化。** 附录I明确先额外在FineDance训练再测其测试集。PhaseDance合成相位的MP／IB ADE=2.274／2.258低于Lodge的2.511／2.412，但FDE=3.289／3.257高于Lodge的2.879／2.721；Bailando仍有更低FID。这支持跨数据集适用性测试，不能称“未训练FineDance仍全面领先”。[附录I、表15][finedance]

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **把周期位置与舞步内容拆成可组合条件：** 相位规定连续时间结构，文字或前缀提供内容；图4因而能从同一前缀探索不同节奏，不必为每个速度重新训练模型。[§4、图4][method]
- **相位同时被解释和直接使用：** PCCA负责与当前模态关联，三处原始相位注入负责逐帧驱动；二者不是重复的条件拼接，消融也显示简单拼接难以替代这种分工。[§4.2、表5][method]
- **语言数据不只增加句子数量，也增加描述轴：** 舞种、舞步、动作说明与质感词共同表达“是什么”和“怎么做”，并在文字生成和文字理解两侧复用。[§3.2、§5.3][lma]
- **评价区分不同层次的节奏：** BAS看单次拍点，BPS看允许倍频的周期关系，舞种相关看不同舞种的踩拍习惯；人评专门构造指标分歧的例子，而不只展示总分变高。[§5.1、附录G][metrics]

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

1. **统一主模型不包含原始音频条件。** 四任务主训练不使用音频特征；MuP2M需单独微调，且合成相位下舞种相关很差。将音乐真正纳入多任务训练也是作者明确的未来方向。[§6、附录D.1][architecture]
2. **相位控制仍是学习到的条件响应。** 单一全身相位不提供逐手臂／逐腿的独立节奏，也不等于精确事件时间、接触或舞步次数的硬保证；非周期动作、停顿和大幅速度错误还会影响提取与生成。[附录A–C；基于接口的范围分析][phase]
3. **力度不能直接用未启用的幅度A旋钮控制。** 当前模型用频率／相位组织节奏，A被提取但未输入为独立控制；强弱等表达主要来自文字质感与训练先验。把A升级为额外控制轴是后续工作。[§6][conclusion]
4. **文本指标有数据构建与评价器边界。** LMA词汇是运动几何代理量和模板生成结果；caption分数受参考描述格式影响，通用HumanML3D检索器又不擅长舞蹈词汇。更细的舞步识别与指令遵循仍需独立评价。[§5.3、附录H][captions]
5. **数据与结果可复核性尚不完整。** DT训练数据不能公开，代码仍待发布；主生成表为单次训练结果，没有多次训练误差条。拍点指标继承BeatNet误差，BPS高也不验证乐句、风格和完整物理自然性。[§6、附录E/F、检查清单§7][paper]

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **[DeepPhase](https://www.ea.com/news/deepphase-periodic-autoencoders-learning-motion-phase-manifolds)（SIGGRAPH 2022）：** PhaseDance明确借鉴周期参数化，但相位来自速度曲线、音乐周期与动态规划，不训练DeepPhase式PAE；单圈全身相位也不同于可学习的多维潜在相位表示。[站内解读](/blog/siggraph2022-deepphase/)
- **[DiffusionPhase](https://arxiv.org/abs/2312.04036)：** 在相位／频域表示上做动作扩散；PhaseDance是动作token自回归生成，相位作为持续条件进入编码交互与解码门控，不是对相位latent做扩散。
- **[Bailando](https://openaccess.thecvf.com/content/CVPR2022/html/Siyao_Bailando_3D_Dance_Generation_by_Actor-Critic_GPT_With_Choreographic_Memory_CVPR_2022_paper.html)（CVPR 2022）：** 同样使用离散舞蹈表示，但强调音乐条件与拍点奖励。PhaseDance把周期关系和舞种踩拍差异单独建模、单独评价，不意味着拍点信息从此没有价值。
- **[TM2D](https://openaccess.thecvf.com/content/ICCV2023/html/Gong_TM2D_Bimodality_Driven_3D_Dance_Generation_via_Music-Text_Integration_ICCV_2023_paper.html)（ICCV 2023）：** 重点是音乐与文字条件整合；PhaseDance主模型用文字／动作上下文配连续相位完成四任务，两者的输入协议不同。
- **[UniMuMo](https://arxiv.org/abs/2410.04534)：** 统一文字、音乐和动作，是本文舞蹈描述对照。PhaseDance保留独立运动码本与动作编码器，并加强舞蹈专属文字；描述优势同时涉及训练标注丰富度和架构差异。
- **启发：** 可以把内容、时间结构与表达品质分别设计为条件，再检查它们在最终动作中是否兑现。若进一步做可编辑舞谱，还需补上部位、事件、优先级和接触验收，不能把一个相位坐标直接当作完整舞蹈符号系统。

<span id="reading-8" class="reading-anchor"></span>

## 来源

- [作者公开全文，32页][paper]：正文§3–4、图2和式1–6用于架构；§5表2–6用于主实验和消融。
- [作者项目与演示][project]、[NeurIPS 2026正式海报记录][poster]：核对题名、作者、会议身份与当前公开资料状态。
- [附录A–D，pp.14–17][phase]：相位提取、误差干预、任务协议、音乐扩展与训练配置。
- [附录G–H，pp.18–22][perception]：感知实验、15个运动指标与音乐侧语义对应、标签词汇和描述模板。
- [附录I–J，pp.22–25][finedance]：FineDance实验、相位控制图4、生成对比图5和描述案例表16。
- 架构图为依据原文重绘的教学SVG；原表数字已与PDF渲染核对，实例区分作者结果与解释性步骤；未包含本地模型复现结果。
- 结构沿用本站固定模板及最初的[Paper-Notes参考](https://github.com/zhaoyang97/Paper-Notes)，技术事实来自上述论文和官方项目。全文更新日期：**2026-11-07**。

</div>

[paper]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf
[html-reader]: /paper-notes/phasedance/fulltext/
[project]: https://meongeun.github.io/phasedance/
[poster]: https://neurips.cc/virtual/2026/poster/153947
[intro]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=1
[representation]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=3
[method]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=4
[phase]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=14
[lma]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=20
[architecture]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=17
[protocol]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=7
[results]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=8
[metrics]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=7
[captions]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=9
[ablation]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=9
[robustness]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=16
[perception]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=18
[finedance]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=22
[example]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=23
[conclusion]: https://meongeun.github.io/phasedance/assets/paper/neurips_2026.pdf#page=10
