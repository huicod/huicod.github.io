---
title: "[ECCV2026] LaCT-Motion：把文字动作规划内化为连续潜在推理"
description: "先用显式动作分解训练 Qwen2.5-3B，再渐进替换为连续隐藏状态，并以 GRPO 优化动作生成；完整核对主表、消融、效率、人评与当前公开实现。"
pubDate: "2026-10-26T14:31:04+08:00"
badge: "Paper"
tags: ["lact-motion", "Human Motion", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />

<div class="paper-reading" lang="zh-CN">

<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

<details class="paper-meta"><summary>论文信息与阅读范围 · ECCV 2026 · 全文与公开资源核查</summary>

论文：*Practice Makes Perfect: From Explicit Decomposition to Reinforced Latent Planning in Text-to-Motion Generation*  
作者：Ronghao Yu、Yang Liu、Juncheng Wang、Chao Xu、Yimo Shao、Baigui Sun、Yong Liu、Shan Luo  
出处：ECCV 2026，LNCS 17067，pp. 455–473；出版社上线日期为 2026-09-19。作者顺序以出版社和会议 PDF 为准。  
入口：[出版社与 DOI](https://doi.org/10.1007/978-3-032-37174-4_27) · [会议公开全文](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf) · [正式补充材料](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf) · [官方代码](https://github.com/Erwin2233/LaCT-Motion) · [公开 SFT 权重](https://huggingface.co/RHYu2233/LaCT-Motion-SFT)  
领域：文本驱动人体动作生成、连续潜在推理、强化学习。阅读版本为会议正文 19 页及独立补充 6 页；代码与资源核查日期：2026-10-26。

</details>

<span id="reading-1" class="reading-anchor"></span>

## 一句话总结

LaCT-Motion 先让 Qwen2.5-3B 学会“写动作分解，再输出动作码”，随后逐步把文字步骤替换为可递推的连续隐藏状态，最后用动作与文本相似度奖励优化生成策略。部署时仍先做潜在规划，但不再生成显式推理文字；在 HumanML3D 上，它改善了文本匹配指标，同时保留了生成质量、计算量和可解释性方面的取舍。

<span id="reading-2" class="reading-anchor"></span>

## 研究背景与动机

**领域现状：** 文本到动作可以把人体运动压缩成 VQ-VAE 离散码，再由语言模型预测这些动作码。Motion-R1、UniMo 等工作进一步让模型先生成动作分解文字，以便处理“转身、前进、再向右滑步”这种多阶段描述。

**现有痛点：** 显式分解需要逐词生成。最终用户要的是动作，但模型可能先花大量时间输出数十乃至上百个解释 token；如果直接删掉这个环节，又未必保留已经学到的分解能力。

**核心矛盾：** 训练时有用的可读步骤，不一定是部署时最经济的中间表示。人体动作还包含同时发生的关节协调和连续变化，强制把这些关系全部串成文字，既增加序列长度，也引入语言表达的限制。

**本文目标：** 保留显式 CoT 提供的学习监督，把生成阶段的中间计算转到更紧凑的连续空间，并让动作结果继续指导这个潜在策略的优化。目标是语义驱动的动作生成，不是提供逐帧关节、接触点或路径的硬约束控制器。

**切入角度：** 作者采用类似 Coconut 的隐藏状态回注：不把模型的中间状态解码成一个词，而是把它直接作为下一个输入向量。为了让这些向量学到有用内容，先训练完整文字步骤，再渐进替换，而不是一开始只放入缺少语义的潜在占位符。

**核心 idea：** “练习—内化—完善”分别对应显式 CoT 监督学习、渐进连续潜在监督学习、全潜在 GRPO。动作输出始终是离散 VQ 码；变化的是动作生成前的规划表示与训练方式。[主文 §1、§3](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=2)

<span id="reading-3" class="reading-anchor"></span>

## 方法详解

### 整体框架

训练数据有两条支路：文本和动作视频用于构建原子推理步骤，真实动作经预训练 VQ-VAE 编成动作码。语言模型先学习完整步骤和动作码，再用前一位置的末层隐藏状态逐个填充潜在位置，最终只凭这些连续状态预测动作。GRPO 从同一潜在前缀采样多条动作，用固定评估器给出奖励；测试阶段只需输入动作描述。

[![lact-motion 完整架构示意](/paper-notes/lact-motion/architecture.svg)](/paper-notes/lact-motion/architecture.svg)

*点击图示查看大图。LaCT-Motion 教学架构：数据构建、显式与潜在 SFT、全潜在 GRPO，以及仅文本输入的推理。依据主文图2–3与正式补充重绘；不是运行结果。教学示意，非作者原图。*

图按“数据构建 → 监督学习 → 强化学习 → 推理”阅读。实线表示数据与状态流，虚线表示训练更新或参数复用；奖励中的真实动作只在训练时出现。图为依据主文图 2–3、附录图 5 与 §A.2 重绘的教学示意，连续潜在向量与最终离散动作码是两种不同表示。

### 关键设计

1. **先固定动作语言：让输出保持为可解码的离散运动码。**

   输入动作采用 HumanML3D 的 22 关节、每帧 263 维表示，先做均值方差归一化，再由预训练 VQ-VAE 编码。码本大小为 512，时间下采样倍数为 4；长度为 L 的动作得到约 ⌊L/4⌋ 个动作码。每个码映射到专用的 motion token，外层用动作起止标记包围。论文报告常见样本为 10–50 个动作码。[主文 §3.2，式 1](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=6)

   这一步不把人体运动变成连续“思考向量”。**VQ 动作码负责最终运动表示，连续 latent 负责生成前的规划。** 模型结束规划后，仍需自回归地产生可查码本的动作序列，再由 VQ decoder 还原为运动。

2. **从文字分解开始，再渐进移除前面的步骤。**

   数据构建从 HumanML3D 的文本与运动出发。附录图 5 标注由 Qwen 接收文本和视频生成连续描述，随后进行分句、步骤提取与索引；主文 §3.3 还说明用 DeepSeek-R1 验证链条完整性。具体 Qwen 视觉模型版本、人工复核比例和完整标注成本未披露。最终有 66,515 个带 CoT 的训练实例，每条原始链包含 1–9 个原子步骤。[主文 §3.3](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=6)、[附录图 5](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf#page=4)

   对有 N 个步骤的样本，课程阶段 k 会移除前 min(k,N) 步，每移除一步分配 c 个连续潜在位置；剩余步骤继续保留为文字。论文默认 c=2、最大阶段 K=8。在渐进阶段，以 0.1 的概率为样本改采一个随机替换阶段，以减轻对固定课程边界的依赖。最后的巩固阶段移除全部显式步骤，把潜在长度统一到 8×2=16，并关闭随机阶段采样。[主文 §3.4，式 2–3](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=8)

   这里不是用独立编码器一次性把整段 CoT 压成 16 个向量，也不是要求每个向量重建某一句原话。训练通过“逐渐拿掉文字，仍完成后续预测”让隐藏状态承担中间计算。附录说明只有 5 个样本超过 8 步，将它们截为前 8 步；这是预算选择，不是证明 16 个位置足以覆盖任意复杂动作。[附录 §A.1](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf#page=1)

3. **连续状态通过多轮前向形成，而非从固定 soft token 表里查出。**

   输入中先放入潜在标记作为占位。到第 i 个潜在位置时，模型取得紧邻它之前位置的末层隐藏状态 h，把该状态写回当前输入 embedding：

   <div class="equation">e(lᵢ) ← h<sub>i−1</sub></div>

   因为 h 已依赖前面的文本和潜在状态，写入后的下一个向量又会影响后续计算，形成连续递推链。论文使用 KV cache 复用已经算过的前缀，M 个潜在位置需要 M 轮注入，再处理剩余文字与动作。没有额外的投影或归一化模块，也没有把这里的连续向量量化到 motion codebook。[主文 §3.4，式 4–5](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=9)

   监督损失只覆盖尚未移除的文字步骤和动作 token；问题、潜在位置、潜在边界与 padding 的标签为 −100。**这只是没有直接的 token 交叉熵监督，不等于隐藏状态被停止梯度。** 正文明示写入操作不 detach，因此下游动作损失仍可沿潜在递推链回传。图 3 的“no gradient”应结合这一正文解释，不能把 latent 分支画成冻结。[主文式 6、图 3](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=7)

4. **全潜在 GRPO：从生成结果优化策略，不给每个思考向量单独打分。**

   监督学习结束后，每个输入生成 G=8 条候选动作。先执行一次确定性的 16 位置潜在前向，再把缓存用于 8 次不同的随机动作解码；多样性来自动作 token 采样，而不是 8 条随机潜在推理链。[主文 §3.5、附录 §A.2](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf#page=2)

   每个候选经 VQ decoder 还原后，获得三种奖励：合法动作标记格式、与真实动作的嵌入余弦相似度、与输入文本的嵌入余弦相似度。论文式 7–9 可概括为：

   <div class="equation">R = λ₁ r<sub>format</sub> + λ₂ cos(f<sub>motion</sub>(生成动作), f<sub>motion</sub>(真实动作)) + λ₃ cos(f<sub>motion</sub>(生成动作), f<sub>text</sub>(描述))</div>

   用组内标准化奖励形成优势，再以含 KL 惩罚的 GRPO 目标更新策略；参考策略来自 SFT，β=0.001。动作／文本奖励编码器保持冻结，更新的是语言模型策略参数，新的参数再影响下一次潜在状态计算。[主文 §3.5](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=10)

   三种奖励中没有直接的接触力、碰撞、足滑或关节约束求解项。“可验证奖励”在此是可计算的格式和嵌入分数，不代表物理规则已经逐项被验证。真实动作相似度也意味着 RL 训练仍依赖配对动作，不能理解为只凭文本自我练习。

5. **部署复用潜在缓存，但并未消除全部顺序计算。**

   测试时输入文本与固定 16 个潜在位置，不再输入或生成显式 CoT。先完成连续隐藏状态递推，再复用缓存自回归生成 motion tokens；主文 §3.6 描述贪心解码，RL rollout 则采用随机采样。最后由预训练 VQ-VAE 解码动作。[主文 §3.6](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=11)

   因此本文减少的是长篇推理文字的逐词生成，不是把规划变成零成本。16 轮潜在处理、运动码解码和 VQ decoder 都仍存在；它也没有因此变成零前视的流式动作系统。

### 一个完整例子

采用附录表 5 的原始描述：“一个人做出表示安全的动作。”作者的示例分解可意译为：

| 原子步骤 | 训练文字所描述的阶段 |
|---|---|
| 1 | 站立，双臂向身体两侧展开 |
| 2 | 双手向身体中央移动，在胸前交叉双臂 |
| 3 | 暂时保持交叉姿态 |
| 4 | 双臂返回开始的位置 |

这些是作者给出的样本注释，不是对所有“安全”手势含义的通用定义。[附录表 5，纸面 p.20](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf#page=1)

显式阶段，模型看到这个描述，学习先输出四步说明再输出真实动作码。到 k=1 时，第一步文字被移除、换成两个潜在位置，后三步仍可读；到 k=2 时，前两步由四个潜在位置代替。到 k≥4 时，这个样本已经没有显式步骤，最后统一补足到 16 个潜在位置进行巩固。

部署时，输入仍只是那句描述。16 个隐藏状态并不自动显现为“展开、交叉、保持、复位”这四个可读标签，也没有逐项姿态验收；它们只是影响随后生成的动作码。上面的课程展开是依据论文规则对同一示例的教学说明，不是公开模型的实测推理轨迹。

### 训练/推理

以下采用正式补充 §A.1–A.2 的设置，不用当前仓库默认配置覆盖论文。

| 环节 | 论文披露设置 |
|---|---|
| 数据与表示 | HumanML3D；66,515 个带 CoT 训练实例；22 关节、263 维运动；VQ 码本 512、时间下采样 4 |
| LLM 与参数训练 | Qwen2.5-3B-Instruct；扩展 512 个动作 token、动作／思考／潜在边界标记；微调策略模型，复用预训练运动 tokenizer |
| 显式练习 | 2 epochs：0.5 epoch 的阶段 0，加 1.5 epochs 额外 warm-up |
| 渐进内化 | 8 个替换阶段，每阶段 0.5 epoch；c=2，随机阶段概率 0.1 |
| 全潜在巩固 | 1 epoch，16 个潜在位置，无显式步骤；SFT 总计 7 epochs |
| SFT 硬件／优化 | 2×H200；每卡 batch 24；BF16、Flash Attention 2、DDP；AdamW，峰值学习率 8×10⁻⁵，200 warm-up steps，cosine 最低 10⁻⁶；weight decay 0.01；梯度裁剪 1.0；最大序列 512 |
| 课程切换 | 每次阶段转换重置优化器状态，避免沿用上一阶段动量 |
| GRPO | 8×H200，1 epoch；每卡 batch 8，梯度累积 8，有效 prompt batch 512；学习率 5×10⁻⁵；G=8；β=0.001；三项奖励权重各 0.33 |
| RL 采样 | 温度 0.7、top-p 0.9；一次潜在前向，共享缓存后采样 8 条动作 |
| 测试生成 | 固定 16 位置潜在递推，复用缓存贪心生成动作码，再用 VQ decoder 解码 |

论文没有给出训练总墙钟小时数或可直接核算的 GPU-hours；“SFT 用两张 H200”不能扩展成所有阶段都只用两卡。[附录 §A.1–A.2](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf#page=1)

<details>
<summary>展开：当前官方代码、权重与论文设置的区别</summary>

本次固定官方仓库提交为 [9efafced（2026-09-17）](https://github.com/Erwin2233/LaCT-Motion/tree/9efafced4c8d558be4803772cd1f7aa68873364f)。仓库有 SFT、GRPO、评估和文本生成 demo 入口；推理代码实际实现隐藏状态回注与缓存复用。数据目录中的五个处理后 JSON 在 GitHub 树中是真实文件条目，不是 README 规划目录；本次未下载这些大数据文件，也未运行模型。

官方链接的 [LaCT-Motion-SFT](https://huggingface.co/RHYu2233/LaCT-Motion-SFT/tree/12d80f7359b8eda8d5d00b840bce21b8920355d3) 为公开、非门控的 SFT checkpoint，两个 safetensors 分片元数据合计约 6.17 GB。模型卡明确说它用于初始化 GRPO，不能当作主表最终 RL 模型。当前所核官方入口未提供可确认的最终 GRPO checkpoint。运动 VQ-VAE、评估器与 GloVe 依赖另有下载脚本，原始 HumanML3D 仍需按其来源获取。模型发布附 Qwen Research License 及 NOTICE；仓库未见适用于整个项目的顶层 LICENSE，第三方目录许可不能自动覆盖所有资源。

当前默认配置与论文存在明确差异：

| 项目 | 正式论文／补充 | 当前仓库默认 |
|---|---|---|
| SFT 总 epochs／巩固 epochs | 7／1 | 11／5 |
| RL epochs／采样温度 | 1／0.7 | 2／1.0 |
| RL 损失选择 | GRPO | loss_type=dapo，同时支持其他选项 |
| 三项奖励权重 | 各 0.33 | 各 1.0；格式无效时总奖励归零 |

此外，论文渐进阶段以 min(k,N) 分配 latent 数；当前数据构建在常规阶段使用 k×c，短链可能在文字已经移除后继续增加 latent 位置。这些差异是静态配置／代码观察，未量化它们对主表指标的影响。[SFT 配置](https://github.com/Erwin2233/LaCT-Motion/blob/9efafced4c8d558be4803772cd1f7aa68873364f/options/sft/t2m_coconut.yaml)、[RL 配置](https://github.com/Erwin2233/LaCT-Motion/blob/9efafced4c8d558be4803772cd1f7aa68873364f/options/grpo/t2m_grpo.yaml)、[课程构造](https://github.com/Erwin2233/LaCT-Motion/blob/9efafced4c8d558be4803772cd1f7aa68873364f/dataset/sft/dataset.py#L140-L204)

当前 README 作者行另列 Xiyue Bai，而正式出版社、会议 PDF 和仓库 BibTeX 为前述八人；本文采用正式书目。公开代码、数据条目和权重访问存在，不等于所有阶段已完整复现。

</details>

<span id="reading-4" class="reading-anchor"></span>

## 实验关键数据

### 主实验

HumanML3D：14,616 段原始动作、44,970 条文本，采用标准训练／验证／测试划分。表 1 的 ± 为 20 次评估的 95% 置信区间。R-Precision 是共享嵌入空间的检索命中率，不是严格指令执行成功率；FID 衡量运动特征分布差异，MM-Dist 是文本与运动嵌入的平均欧氏距离；Diversity 是生成动作间的特征距离，原表标 ↑，不能把它当作物理真实性分数。[主文 §4.1](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=11)、[附录 §A.3](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf#page=2)

<details open>
<summary>原表 1：HumanML3D 全部方法与指标（纸面 p.12）</summary>

| 方法 | R Top-1 ↑ | R Top-2 ↑ | R Top-3 ↑ | FID ↓ | MM-Dist ↓ | Diversity ↑ |
|---|---:|---:|---:|---:|---:|---:|
| MDM | 0.320±0.005 | 0.498±0.004 | 0.611±0.007 | 0.544±0.044 | 5.566±0.027 | 9.559±0.086 |
| MLD | 0.481±0.003 | 0.673±0.003 | 0.772±0.002 | 0.473±0.013 | 3.196±0.010 | 9.724±0.082 |
| MotionDiffuse | 0.491±0.001 | 0.681±0.001 | 0.782±0.001 | 0.630±0.001 | 3.113±0.001 | 9.410±0.049 |
| T2M | 0.457±0.002 | 0.559±0.007 | 0.740±0.003 | 1.067±0.002 | 3.340±0.008 | 9.188±0.002 |
| TM2T | 0.424±0.003 | 0.618±0.003 | 0.729±0.002 | 1.501±0.017 | 3.467±0.011 | 8.589±0.076 |
| T2M-GPT | 0.491±0.003 | 0.680±0.003 | 0.775±0.002 | 0.116±0.004 | 3.118±0.011 | 9.761±0.081 |
| MotionGPT | 0.492±0.003 | 0.681±0.003 | 0.778±0.002 | 0.232±0.008 | 3.096±0.008 | 9.528±0.071 |
| MoMask | 0.521±0.002 | 0.713±0.002 | 0.807±0.002 | 0.045±0.002 | 2.958±0.008 | 9.620±0.064 |
| MotionChain | 0.504±0.003 | 0.617±0.002 | 0.790±0.003 | 0.248±0.009 | 3.033±0.010 | 9.470±0.075 |
| MotionAgent | 0.515±0.004 | 0.691±0.003 | 0.801±0.004 | 0.230±0.009 | 2.967±0.020 | 9.908±0.102 |
| MotionGPT-2 | 0.496±0.002 | 0.691±0.003 | 0.782±0.004 | 0.191±0.004 | 3.080±0.013 | 9.860±0.026 |
| MotionGPT-3 | 0.542±0.003 | 0.741±0.003 | 0.839±0.002 | 0.065±0.003 | 2.768±0.008 | 9.744±0.082 |
| MG-MotionLLM | 0.523±0.003 | 0.718±0.003 | 0.814±0.002 | 0.090±0.002 | 2.926±0.009 | 9.632±0.076 |
| Motion-R1 | 0.515±0.003 | 0.719±0.002 | 0.818±0.002 | 0.201±0.004 | 2.854±0.010 | 10.026±0.075 |
| UniMo | 0.539±0.003 | 0.738±0.002 | 0.831±0.002 | 0.177±0.004 | 2.768±0.010 | 10.042±0.076 |
| TBYM | 0.537±0.005 | 0.721±0.004 | 0.810±0.005 | 0.040±0.002 | 2.895±0.017 | 9.668±0.077 |
| LaCT-Motion | **0.577±0.002** | **0.783±0.002** | **0.873±0.002** | 0.167±0.004 | **2.506±0.005** | 9.507±0.098 |

数值忠实保留 LaCT-Motion 原表，包括 T2M／MotionChain 的 Top-2；不以其他论文的表值替换。主文说明 Motion-R1 和 TBYM 使用引自相应论文的数字，并非统一重训对照。本表沿用原文引用的名称与数值，是本论文的比较记录，不是跨论文统一重训排名。[原表 1](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=12)

</details>

**计算效率：** 附录表 6 报告单 H200、batch 32、HumanML3D 测试集平均；Peak Mem. 用 max_memory_allocated 记录。以下是作者报告的整段生成统计，不是单帧生成延迟。[附录表 6，纸面 p.22](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf#page=3)

| 方法 | FLOPs（TFLOPs）↓ | Peak Mem.（GB）↓ | 平均生成 token 数 ↓ | Latency（ms）↓ |
|---|---:|---:|---:|---:|
| 无规划：MotionAgent | 1.064 | 12.94 | 35.31 | 138.8 |
| 显式规划：Motion-R1 | 0.914 | 7.03 | 115.23 | 256.3 |
| 潜在规划：LaCT-Motion | 1.056 | 8.54 | 48.41 | 93.0 |

附录按该表计算约 2.8 倍于显式规划的速度，但 LaCT-Motion 的 FLOPs 和显存都高于该显式基线。表中没有充分展开 token 统计是否计入 16 个潜在位置，也未逐模块列出 VQ 解码、输入准备与渲染是否计时；因此不将 93 ms 写成任意长度、单用户端到端或实时交互保证。

主文图 1 另给整套评估耗时：MotionAgent 11.5 分钟、LaCT-Motion 7 分钟均标 H200，而 Motion-R1 1 小时被该图标为 A100。这是不同的报告口径，不能直接用 60/7 推出同硬件加速；Motion-R1 自身正式文献的硬件说明也与此标签不一致。附录表 6 是作者另行声称的同 H200 比较，本文保留其原值，不替作者补出未披露的基线复现细节。[主文图 1](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=3)

**人类偏好：** 10 名不了解方法的参与者观看 6 个选定提示下的三方法匿名随机排序视频，每项问题共 60 次强制三选一判断；不是大规模随机提示测试。[附录 §A.6、表 7，纸面 pp.24–25](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf#page=5)

| 方法 | 文本—动作匹配偏好（%）↑ | 动作自然性偏好（%）↑ |
|---|---:|---:|
| MoMask | 3.3 | 5.0 |
| MotionAgent | 5.0 | 8.3 |
| LaCT-Motion | 91.7 | 86.7 |

### 消融实验

**训练阶段：** 原表 2 分开列出“完整流程中的中间 checkpoint”和“独立训练至收敛的基线”。不能用只完成短期练习的第一行证明充分训练的显式 CoT 无效。以下各行原表均未给 ±。[原表 2，纸面 p.13](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=13)

| 组别与设置 | R Top-1 ↑ | R Top-2 ↑ | R Top-3 ↑ | FID ↓ | MM-Dist ↓ | Diversity ↑ |
|---|---:|---:|---:|---:|---:|---:|
| 中间 checkpoint：I 显式 SFT | 0.167 | 0.240 | 0.289 | 24.119 | 7.069 | 5.655 |
| 中间 checkpoint：I+II 潜在 SFT | 0.453 | 0.640 | 0.736 | 0.466 | 3.344 | 10.216 |
| 完整流程：I+II+III | 0.577 | 0.783 | 0.873 | 0.167 | 2.506 | 9.507 |
| 独立收敛：UniMo SFT-only（原表 *） | 0.438 | 0.613 | 0.702 | 0.201 | 3.588 | 9.748 |
| 独立收敛：I+II | 0.486 | 0.660 | 0.756 | 0.244 | 3.190 | 9.915 |
| 独立收敛：UniMo 显式 CoT+GRPO（原表 †） | 0.529 | 0.739 | 0.832 | 0.203 | 2.743 | 9.780 |
| 独立收敛：I+单轮 latent 蒸馏+III（原表 ‡） | 0.520 | 0.716 | 0.822 | 0.221 | 2.838 | 9.924 |

**多轮课程机制：** 同预算的单轮 latent 蒸馏同时去掉渐进课程和多轮状态注入，再接相同 GRPO，Top-1 0.520、FID 0.221；完整流程为 0.577、0.167。这个对照支持两项机制合起来的作用，但没有单独拆出课程与多轮注入各自贡献。完整流程的 Diversity 9.507 也低于这条基线 9.924。

**每步 latent 数：** 原表 3 在 Stage II 后、GRPO 前比较 c。c=2 的 FID、Top-2/3、MM-Dist 和 Diversity 最好；c=1 的 Top-1 更高且更快。时间是完整 4,646 样本测试集评估一次的墙钟秒数，不是每个动作的时延。[原表 3，纸面 p.14](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=14)

| 每步 latent 数 c | R Top-1 ↑ | R Top-2 ↑ | R Top-3 ↑ | FID ↓ | MM-Dist ↓ | Diversity ↑ | 整套评估时间（s）↓ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.458 | 0.629 | 0.724 | 0.536 | 3.357 | 9.802 | 369 |
| 2 | 0.453 | 0.640 | 0.736 | 0.466 | 3.344 | 10.216 | 387 |
| 4 | 0.451 | 0.630 | 0.729 | 0.529 | 3.381 | 9.873 | 455 |

**奖励组成：** 原表 4 分别移除 motion 或 semantic 相似度。完整奖励获得更低 FID 和 MM-Dist、以及更高 Top-2/3；只用格式+动作相似度的 Top-1 和 Diversity 反而更高。原表没有“仅格式”一行，不将正文对此的泛述补造成一个未展示的实验。[原表 4，纸面 p.14](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf#page=14)

| 格式 r_f | 动作 r_m | 语义 r_s | R Top-1 ↑ | R Top-2 ↑ | R Top-3 ↑ | FID ↓ | MM-Dist ↓ | Diversity ↑ |
|---|---|---|---:|---:|---:|---:|---:|---:|
| ✓ | ✓ | — | 0.581 | 0.768 | 0.861 | 0.217 | 2.543 | 9.745 |
| ✓ | — | ✓ | 0.576 | 0.771 | 0.859 | 0.261 | 2.529 | 9.641 |
| ✓ | ✓ | ✓ | 0.577 | 0.783 | 0.873 | 0.167 | 2.506 | 9.507 |

附录的其余分析是数据统计与示例，不是新模型消融：图 6 显示原始描述多在约 100–300 字符，CoT 增强文本可长达约 1,400 字符；CoT 文本的 type-token ratio 较低，但绝对词型更多。这个现象支持标注增加了描述上下文，不能单独证明推理质量或因果分解正确。[附录 §A.5、图 6](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf#page=4)

### 关键发现

1. **语义匹配更强，不等于生成分布全面领先。** 原表 1 中 LaCT-Motion 的 Top-1/2/3 与 MM-Dist 最好，但 FID 0.167 明显高于 TBYM 0.040、MoMask 0.045 和 MotionGPT-3 0.065，Diversity 也并非最高。
2. **RL 有明显收益，也伴随多样性取舍。** 同一流程的 Stage II 到 III，FID 从 0.466 降至 0.167、Top-1 从 0.453 升至 0.577，但 Diversity 从 10.216 降到 9.507，不能复述成“所有指标都提升”。
3. **收益来自训练路线与顺序开销的改变。** 课程、多轮注入与 RL 的组合优于单轮 latent 对照；时延降低却没有对应同幅度的 FLOPs 降低。结果更支持“用较短的连续中间计算替代较长文字解码”，而非“潜在规划天然更省所有资源”。

<span id="reading-5" class="reading-anchor"></span>

## 亮点与洞察

- **把学习监督与部署表示分开：** 文字步骤方便构建监督，连续状态适合承接模型内部计算。文章最有价值的设计是渐进转换这两种角色，而不是给输出换一个“潜在推理”的名字。
- **区分了规划 latent 与动作 code：** 前者是随输入变化的隐藏状态，后者是固定码本中的可解码符号。这使模型可以改变规划机制，而不必重做整套运动 tokenizer。
- **利用候选之间可共享的确定性计算：** GRPO 的八条动作候选共用同一潜在前缀，只对运动解码进行采样，减少重复规划。这个优化针对 rollout，不意味着八条候选没有各自动作生成成本。
- **对照保留了实用取舍：** latent 数、奖励组成和阶段实验能看到 Top-1、FID、Diversity 并不总同向变化，有助于依据任务需求选择预算，而非默认潜在位置越多越好。

<span id="reading-6" class="reading-anchor"></span>

## 局限与展望

1. **潜在“规划”没有可直接检查的语义标签。** 不生成文字降低了文字开销，也失去逐步可读解释。论文没有逐 latent 解释或因果干预实验来证明某个位置专门表示某个动作阶段；这仍是受下游损失训练的中间状态。
2. **奖励与评测都依赖学习到的特征空间。** 高文本／动作相似度不能直接保证接触稳定、无碰撞或严格执行每个子动作。本文也没有硬轨迹、固定关键帧、源动作局部保持等接口或保证。
3. **主要量化结果来自单一动作域。** 核心实验是 HumanML3D；人评只有 6 个选定提示与 10 名参与者。长时功夫、转身滑步等展示提供案例证据，还不能替代广泛的组合泛化和长序列专项测试。
4. **潜在预算与课程规则仍固定。** 统一 16 个位置可能对简单动作多算、对复杂描述不足；作者也将自适应课程与扩展训练列为未来工作。本文没有测试任意长推理链、交互场景或多人物规划。
5. **速度与公开复现需分开判断。** 批处理平均时延不等于应用首帧延迟；最终 GRPO 权重未在所核入口确认，当前默认训练参数也与正式论文不同。后续复现应先固定配置和模型版本，再比较质量与计算成本。

<span id="reading-7" class="reading-anchor"></span>

## 相关工作与启发

- **[Coconut](https://arxiv.org/abs/2412.06769)：** 直接把 LLM 末层隐藏状态反馈为下一输入，是本文连续状态递推的关键来源。LaCT-Motion 将它用于动作生成，并加入适应变长动作分解的课程与奖励优化。
- **[T2M-GPT](https://openaccess.thecvf.com/content/CVPR2023/html/Zhang_Generating_Human_Motion_From_Textual_Descriptions_With_Discrete_Representations_CVPR_2023_paper.html)：** 提供离散运动表示的基础路线。本文沿用预训练 VQ-VAE，把主要变化放在动作码生成之前的语言／潜在规划，而非提出新运动码本。
- **[Motion-R1](/blog/iclr2026-motion-r1/)：** 显式动作分解与强化学习是直接相关路线。LaCT-Motion 让推理时不再输出分解文字；两篇的表格和时间统计需保留各自版本、硬件与协议，不能拼成统一复现排名。[正式论文](https://proceedings.iclr.cc/paper_files/paper/2026/hash/7a4cf58610e1c911e06970c8d75b86dc-Abstract-Conference.html)
- **[UniMo](/blog/aaai2026-unimo/)：** 同样利用 CoT 与 GRPO，并覆盖动作生成和理解。LaCT-Motion 借鉴其数据与奖励路线，重点研究把显式 CoT 内化；不应把 UniMo 整体概括为“只有 SFT”，尽管本文表 2 含其 SFT-only 对照。[原论文](https://arxiv.org/abs/2601.12126)
- **[TBYM](https://arxiv.org/abs/2512.24100)：** 另一条潜在动作推理路线，本文将其描述为 motion-native 的自回归 Transformer，与基于预训练 LLM 的文字内化不同。原表中它的 FID 更低，LaCT-Motion 的检索与匹配指标更好，说明表示选择仍有取舍。
- **启发：** 评估“先想再动”时，应分别检验中间表示、训练监督、RL 奖励与解码成本。把文字移除只是一个可测的计算结构变化，是否获得更可靠的动作分解还需要针对子动作、顺序和物理约束的独立评价。

<span id="reading-8" class="reading-anchor"></span>

## 来源

1. [Springer 正式章节与书目](https://link.springer.com/chapter/10.1007/978-3-032-37174-4_27)：ECCV 2026、作者、LNCS 卷页和上线日期。
2. [会议公开正文 PDF](https://media.eventhosts.cc/Conferences/ECCV2026/pdfs/13122.pdf)：完整阅读 19 页；方法 §3、图 2–3，主表 1，消融表 2–4，定性图 4。文中页码采用 PDF 自身纸面编号。
3. [出版社正式补充 PDF](https://media.springernature.com/original/springer-static/esm/chp%3A10.1007%2F978-3-032-37174-4_27/MediaObjects/714128_1_En_27_MOESM1_ESM.pdf)：完整阅读 6 页（纸面 pp.20–25）；表 5 示例、§A.1–A.2 训练与 rollout、表 6 效率、表 7 人评、图 5–7。
4. [官方代码固定提交](https://github.com/Erwin2233/LaCT-Motion/tree/9efafced4c8d558be4803772cd1f7aa68873364f)及[官方 SFT 模型发布](https://huggingface.co/RHYu2233/LaCT-Motion-SFT/tree/12d80f7359b8eda8d5d00b840bce21b8920355d3)：仅静态核查必要代码、配置、文件条目和许可，没有下载大权重或运行模型。
5. 本文架构图为原创教学重绘；实验数字直接对照正文和补充原表，并目视核对表格页面。阅读与核查日期：2026-10-26。

</div>
