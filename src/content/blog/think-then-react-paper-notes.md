---
title: "[ICLR2025] Think-Then-React：看到对方抬手，怎样决定握手还是击掌？"
description: "Think-Then-React: Towards Unconstrained Human Action-to-Reaction Generation。从两人击掌的例子追踪动作前缀、模型自己写的交互描述和反应动作码，核对 Inter-X 主实验、思考消融，以及代码实际给定的反应者初始状态。"
pubDate: "2026-11-25T13:50:00+08:00"
badge: "Paper"
tags: ["Think-Then-React", "Human Interaction", "Action-to-Reaction", "Motion Understanding", "Motion Generation", "VQ-VAE", "Autoregressive Model", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

**全文阅读**　[可翻译的 arXiv HTML][html] · [ICLR 终稿 PDF][pdf] · [作者项目与动作演示][project] · [官方代码][code]

<details class="paper-meta"><summary>论文信息与版本 · ICLR 2025</summary>

正式 PDF 的题名为 *Think-Then-React: Towards Unconstrained Human Action-to-Reaction Generation*，作者为 Wenhui Tan、Boyuan Li、Chuhao Jin、Wenbing Huang、Xiting Wang、Ruihua Song。会议索引将副标题记为 *Towards Unconstrained Action-to-Reaction Motion Generation*，代码仓库标题用 *Towards Better Action-to-Reaction Motion Generation*，三者指向同一篇工作。下文数值取自终稿，输入条件另据作者公开评测代码核对。本次未运行模型。[ICLR 会议记录][venue] · [终稿 PDF][pdf] · [固定版本代码][code]

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

一个人刚伸出右手，另一个人该准备握手还是击掌？**Think-Then-React（TTR）边看发起者 A 的动作，边写下一句它猜测的双人互动，再用这句话、A 已经做出的动作和 B 已生成的反应续写 B 的身体运动。** A 的手继续抬高，模型可以把“握手”改成“在头顶击掌”，后续的动作也有机会随之调整。[原文图 1][f1] · [推理实现][loop]

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状**　已有方法可以给定交互类别或一句描述，同时生成整段双人运动。在线反应任务则固定其中一人 A，让另一人 B 随 A 作出反应。例如驱动虚拟搭档时，可用的是对方刚做出的动作，接下来几秒的动作仍待观察。[原文 §1–2][html]

**现有痛点**　早期动作常有歧义。A 刚伸手时，“握手”和“击掌”都合理；等 A 把手举过头才猜对，又可能错过自然的回应时机。[原文图 1][f1]

**核心矛盾**　骨骼给出的是当前可观察的几何运动，B 却要依据尚未完全显现的互动目的立即行动。两个人的距离、朝向，以及 B 此前已经伸手到什么位置，都会限制下一步能做什么。[原文 §3.1–3.2][method]

**本文目标**　在没有用户提供交互类别、文字指令和 A 的未来动作的条件下，根据逐渐增长的 A 动作前缀，连续生成 B 的反应。作者所说的 *unconstrained* 指这种语义条件开放的设置；代码仍给定双方初始状态。[原文 §1][html] · [评测输入模板][prompts]

**切入角度**　Inter-X 已有配对双人动作和交互描述。训练时让模型只看 A 的一部分，也要试着描述两人最终形成的互动，再教它用这个可能猜错的描述生成 B。[原文 §3.3.2][fine]

**核心 idea**　用两种速度更新：每步都生成反应动作码，每隔若干步才重写文字解释。于是文字能保留一段时间的行为方向，也能随着新的观察改变。[原文 §4.6][interval]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

训练先把连续骨骼转成语言模型能读的数字编号，再让同一个 Flan-T5-base 学两件事：根据 A 写交互描述，根据描述和 A 续写 B 的动作。下图把论文图 2 的训练流程与评测代码接在一起。读推理部分时可以跟踪三样东西：持续增长的 A 前缀、间歇刷新的文字、以及逐步变长的 B 动作码序列。[原文方法图][f2] · [因果微调][fine] · [评测实现][loop]

<figure class="reading-figure"><a href="/paper-notes/think-then-react/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/think-then-react/architecture.svg" alt="训练由动作编码、三类跨模态预训练和因果微调组成。推理时从发起者 A 的已见前缀定期推测交互描述，同一模型逐步生成 B 的后续动作码，再结合 B 初始状态解码出连续反应。" /></a><figcaption>按原文图 1–2、附录 A.1 与作者评测代码重绘。蓝色表示观测到的 A，绿色表示模型生成的 B，紫色表示 B 的参考初始状态。文字更新与动作更新有不同的时间间隔。点击可放大。</figcaption></figure>

### 关键设计

1. **同时保留身体动作与两人的相对站位。** 一人运动先移到统一原点、朝向，22 个关节的位置、旋转、速度等特征由 VQ-VAE 按时间压缩 4 倍，在 256 个、每个 512 维的原型中各选最近的一项。为把人物放回共同空间，另取归一化前的初始横向位置 x、纵深位置 z、朝向 r，每个量等分为 10 档，作为序列开头的三个空间符号。以 30 fps 的 60 帧为例，时间压缩后对应 15 个姿态码，另有三个初始空间符号。姿态码要经解码才成为连续动作。[原文 §3.2][token] · [终稿附录 A.1][appendix]

2. **三种预训练各补一类知识。** 动作↔文字让模型在双人动作和描述间翻译，训练时随机去掉 B，练习只观察 A。姿态↔空间让模型从当前空间位置及动作预测下一位置，也练习反推两处位置之间的姿态码。动作↔动作把 A 的前半段和 B 的后半段交给模型，让它补其余两半，并交换两人再做一次。这种双向补全用于预训练，真正的反应生成只读取当前已见的 A 前缀。[原文 §3.3.1][pre]

3. **用一整句预测双方互动。** 微调时随机取 A 的前四分之一、前一半或整段，监督目标都是整段双人互动的人写描述。论文把这件事讲成“理解发起者、推断反应者”，公开实现用一个交互描述字段承载这两层意思。生成 B 的训练起初使用正确文字，待模型的文字预测趋稳后再采样其自己生成的描述，使动作分支也接触会出错的条件。[原文 §3.3.2][fine] · [思考调用][loop]

4. **刷新猜测，保留已生成的动作历史。** 默认评测开始时用一句泛化的“另一人对动作作出反应”。每多看到 A 的一个动作码，生成器读取 A 前缀、当前描述及 B 已生成的码，只追加一个 B 码。每积累 4 个 A 码再写一次文字。新猜测会引导后续动作，已经生成的 B 码留在历史中。以 30 fps、4 倍压缩计算，一次文字更新跨越约 16 帧，即 0.53 秒的动作时间。[推理循环][loop] · [间隔实验][interval]

5. **B 从哪里开始。** 评测模板还传入 B 的初始空间三元组和参考动作编码得到的首个姿态码。评测解码时，代码把 B 的参考首帧连续特征投影后加到量化表示，再解码生成的 B 码。因而实验测的是“给定反应者开场状态，之后如何回应”。在虚拟角色上应用它时，需能提供与模型表示一致的开场状态。[数据字段][data] · [评测模板][prompts] · [反应解码调用][decode] · [VQ 解码器][vq] · [启用首帧的配置][cfg]

### 一个完整例子：从准备握手到头顶击掌

论文图 1 展示同一个样本怎样随时间改变解释。图中离散时刻按动作码计，示意图每隔两步展示一次思考；主实验采用四步。以下是对图中文字的中文概述。[原文图 1][f1] · [实验配置][setup]

| A 已经做出了什么 | 模型当时写下的互动解释 | 对生成 B 有什么意义 |
| --- | --- | --- |
| 开始时两人相对站立 | 两人站在彼此前方 | 当前观察仍支持多种互动，B 从开场状态开始响应。 |
| A 向对方伸右手 | 两人将握手 | 给当前 B 动作码一个接近对方手部的语义方向。 |
| A 继续抬手 | 对方可能伸手同 A 击掌 | 下一步生成可改为配合更高的手势，已有 B 动作码仍留在上下文中。 |
| 双方手抬高 | 两人会在头顶击掌 | “击掌”进一步收窄到“头顶”；手掌是否真正贴合还要从输出骨骼检查。 |

### 训练与推理

主体训练使用 Inter-X（约 9,000 个训练样本、1,708 个测试样本，每个双人样本配三条描述），并把 HumanML3D 单人动作与文本加入预训练；两者统一到 30 fps。编解码器先学习重建姿态特征和速度，训练目标还包含量化承诺损失。公开实现加载训练好的编解码器并冻结其参数，再训练语言骨干。原文报告语言骨干在单机 8 张 Tesla V100 上预训练约 10 万步、微调约 4 万步，批大小为 32。[原文 §4.1][setup] · [附录 A.1][appendix] · [编解码器加载与冻结][loadvq]

作者报告默认间隔下平均每生成一步耗时小于 50 毫秒。这个计算耗时与上面的 0.53 秒分属两种量：后者是两次文字更新之间推进了多长的动作。官方评测脚本先逐码生成，再统一解码，本次未测摄像头到角色显示的端到端延迟。作者仓库提供训练与测试步骤，数据由 README 指向的 Inter-X 仓库另行获取；阅读时所核对的 README 未列出可直接下载的训练好权重。[原文 §4.6][interval] · [评测实现][loop] · [仓库说明][code]

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

**Inter-X，原文表 1。** R@1 看正确描述的检索排名是否第一，Acc. 看生成的互动能否被识别为正确类别，FID 比较生成与真实动作的特征分布，MM-Dist 是动作与配对文字的特征距离，Div. 看生成动作之间的差异。表中摘录均值；原表报告 20 个随机种子与 95% 置信区间。作者为反应任务调整了 MotionGPT 和 InterGen。[原文表 1][t1] · [基线与评价方法][setup]

| 方法 | R@1 ↑ | Acc. ↑ | FID ↓ | MM-Dist ↓ | Div. → 2.498 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 真实动作 | 0.511 | 0.463 | 0.000 | 5.348 | 2.498 |
| InterFormer | 0.172 | 0.171 | 10.468 | 7.831 | 3.505 |
| MotionGPT | 0.238 | 0.186 | 5.823 | 6.211 | 2.615 |
| InterGen | 0.326 | 0.254 | 5.506 | 6.182 | 2.284 |
| ReGenNet | 0.384 | 0.297 | 3.988 | 5.867 | **2.502** |
| Think-Then-React | **0.423** | **0.318** | **1.942** | **5.643** | 2.629 |

读表时要区分两种采样率。**评价器**只看降到 1 fps 的 A、加上正常速率的 B，目的是减少仅凭 A 猜对类别的机会。**生成器**处理的数据仍是 30 fps。[原文 §4.1][setup] · [评价器实验 §4.5][eval]

### 消融实验

**去掉思考或某项预训练，表 1。** 每行只写原文实际移除的部分；“关闭思考”发生在推理阶段。[原文表 1][t1] · [消融说明 §4.3][abl]

| 条件 | R@1 ↑ | Acc. ↑ | FID ↓ |
| --- | ---: | ---: | ---: |
| 完整模型 | **0.423** | **0.318** | **1.942** |
| 推理时关闭思考 | 0.367 | 0.230 | 3.828 |
| 去掉全部预训练 | 0.398 | 0.288 | 3.467 |
| 去掉动作↔动作预训练 | 0.408 | 0.293 | 2.874 |
| 去掉姿态↔空间预训练 | 0.417 | 0.308 | 2.685 |
| 去掉动作↔文字预训练 | 0.406 | 0.304 | 2.580 |
| 去掉单人预训练数据 | 0.414 | 0.315 | 2.007 |

去掉思考后，FID 增加 1.886；只去掉单人数据时增加 0.065。另一个直接干预是把自动描述换成测试样本的人写参考描述：FID 从 1.942 降到 1.584，Acc. 从 0.318 升到 0.361。这个条件使用了通常推理时拿不到的答案信息，说明描述质量仍会限制反应质量。[附录表 3][t3]

**看到多长的 A，文字能写多准？附录表 2。** 同一标准模型只看 A 的四分之一、一半和全部时，生成描述的 BLEU-4 依次为 16.6、18.9、20.3，ROUGE 为 43.0、45.3、46.4。另让模型看到完整 A 与 B 时，BLEU-4 为 25.4。这组结果衡量输出与标注措辞的匹配度，不能据此读出人物真正的心理意图。[附录表 2][t2]

### 关键发现

1. **反应更匹配互动，多样性仍有取舍。** 与 ReGenNet 相比，TTR 的 FID 从 3.988 降到 1.942，R@1 从 0.384 升至 0.423。ReGenNet 的多样性 2.502 却更接近真实值 2.498；选择模型时，生成分布、语义和多样性应分开判断。[原文表 1][t1]
2. **双人动作如何互补，值得专门训练。** 三个单独去除的预训练任务中，去掉双人交叉片段补全的 FID 上升最多。这支持保留双人预测任务；单人数据也有帮助，但单独移除它引起的变化较小。[原文表 1][t1] · [作者的消融分析][abl]

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **语义中间量可观测，也可以替换。** 图 1 直接展示猜测先错后改；附录表 3 进一步换掉这段文字，看生成指标怎样改变。相较于只给语言模型的隐状态起名叫“意图”，这两项证据更能说明文字在生成链路上的作用。[原文图 1][f1] · [附录表 3][t3]
- **更勤于更新，未必更及时。** 作者扫描 1 到约 100 个动作步的重新思考间隔，FID 先降后升，在 4 步附近最低。早期每来一点动作就重猜可能引入随机变化，太久才重猜又容易沿用过时解释。约半秒是此数据和配置测得的折中。[原文 §4.6][interval]

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **相似外观会诱发错误解释。** 原文图 4(d) 的真实互动是拥抱，模型却将 A 的动作解释成摔跤，生成了与真实互动不符的回应。自然语言让错误便于定位，也可能把错误一路传给动作生成器。[原文图 4][f4]
- **交互语义和身体接触是两级指标。** 表 1 没有报告击掌时两只手的最小距离、接触时差或碰撞。若要判断它能否驱动一个真正同人击掌的化身，需在双方关节轨迹上直接验证这些量，还需要检验 B 改换初始站位后的结果。[原文表 1][t1] · [评测初始条件][prompts]
- **在线性取决于检查哪一层。** 公开实现按顺序截取预先编码好的 A 动作码前缀并追加 B 码，解码时使用 B 的参考首帧。论文没有给出逐帧从未预编码的传感器流开始、一直到角色显示的完整时延，实际部署时需要再核查动作编码和渲染缓冲。[推理与解码实现][loop] · [速度实验][interval]

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **ReGenNet 与 TTR** 同样根据 A 生成 B，前者是论文中最直接的扩散基线。要单独判断“写一句猜测”有什么用，优先看同一 TTR 开关思考的消融；跨模型比较还混入了骨干、离散表示和训练任务的差异。[ReGenNet · CVPR 2024](https://openaccess.thecvf.com/content/CVPR2024/html/Xu_ReGenNet_Towards_Human_Action-Reaction_Synthesis_CVPR_2024_paper.html) · [TTR 原文 §4.1 与表 1][setup]
- **MotionMERGE 与 TTR** 都让文字处在输入动作与输出动作之间。MotionMERGE 接收用户的复合编辑请求，文字用于组织同一段源动作应怎样修改；TTR 由自己从 A 推断互动，输出属于另一个人 B。比较时可以分别问“谁给的意图”和“输出属于谁”。[站内 MotionMERGE 解读](/blog/arxiv2026-motionmerge/) · [TTR 方法][method]
- **ActionPlan 与 TTR** 都先形成某种行动表达。ActionPlan 从输入文字生成沿时间发展的语义潜变量，再生成姿态；TTR 在推理时会写出可读的交互句子，并随对方的已见动作重写。若想检查“系统此刻以为两人要做什么”，后者可以直接读出文字；定位具体身体细节仍需检查解码结果。[站内 ActionPlan 解读](/blog/eccv2026-actionplan/) · [TTR 思考与反应][fine]

<span id="reading-8" class="reading-anchor"></span>
## 来源

- [ICLR 2025 会议记录][venue] · [正式论文 PDF][pdf] · [可翻译的 arXiv 全文][html]
- [作者项目页与交互动图][project] · [官方代码、数据准备和训练入口][code]
- [原文方法图][f2] · [主结果与消融表 1][t1] · [文字质量表 2][t2] · [提示质量干预表 3][t3]

</div>

[html]: https://arxiv.org/html/2503.16451v1
[pdf]: https://proceedings.iclr.cc/paper_files/paper/2025/file/ea0b28cbbd0cbc45ec4ac38e92da9cb2-Paper-Conference.pdf
[venue]: https://proceedings.iclr.cc/paper_files/paper/2025/hash/ea0b28cbbd0cbc45ec4ac38e92da9cb2-Abstract-Conference.html
[project]: https://think-then-react.github.io/
[code]: https://github.com/AlbertTan404/Think-Then-React/tree/4ac4e5622cb359236f0747802e9d9295f7917513
[f1]: https://arxiv.org/html/2503.16451v1#S0.F1
[f2]: https://arxiv.org/html/2503.16451v1#S2.F2
[method]: https://arxiv.org/html/2503.16451v1#S3.SS1
[token]: https://arxiv.org/html/2503.16451v1#S3.SS2
[pre]: https://arxiv.org/html/2503.16451v1#S3.SS3.SSS1
[fine]: https://arxiv.org/html/2503.16451v1#S3.SS3.SSS2
[appendix]: https://arxiv.org/html/2503.16451v1#A1.SS1
[setup]: https://arxiv.org/html/2503.16451v1#S4.SS1
[t1]: https://arxiv.org/html/2503.16451v1#S4.T1
[abl]: https://arxiv.org/html/2503.16451v1#S4.SS3
[f4]: https://arxiv.org/html/2503.16451v1#S4.F4
[eval]: https://arxiv.org/html/2503.16451v1#S4.SS5
[interval]: https://arxiv.org/html/2503.16451v1#S4.SS6
[t2]: https://arxiv.org/html/2503.16451v1#A1.T2
[t3]: https://arxiv.org/html/2503.16451v1#A1.T3
[loop]: https://github.com/AlbertTan404/Think-Then-React/blob/4ac4e5622cb359236f0747802e9d9295f7917513/src/models/lm.py#L305-L383
[decode]: https://github.com/AlbertTan404/Think-Then-React/blob/4ac4e5622cb359236f0747802e9d9295f7917513/src/models/lm.py#L385-L405
[vq]: https://github.com/AlbertTan404/Think-Then-React/blob/4ac4e5622cb359236f0747802e9d9295f7917513/src/models/motion_vqvae.py#L198-L207
[cfg]: https://github.com/AlbertTan404/Think-Then-React/blob/4ac4e5622cb359236f0747802e9d9295f7917513/src/configs/models/motion_vqvae.yaml#L13
[prompts]: https://github.com/AlbertTan404/Think-Then-React/blob/4ac4e5622cb359236f0747802e9d9295f7917513/src/configs/lm_tasks.json#L474-L505
[data]: https://github.com/AlbertTan404/Think-Then-React/blob/4ac4e5622cb359236f0747802e9d9295f7917513/src/datasets/lm_dataset.py#L196-L205
[loadvq]: https://github.com/AlbertTan404/Think-Then-React/blob/4ac4e5622cb359236f0747802e9d9295f7917513/src/models/lm.py#L32-L39
