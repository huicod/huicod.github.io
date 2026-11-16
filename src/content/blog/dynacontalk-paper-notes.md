---
title: "[SIGGRAPHAsia2026] DynaConTalk：在小波空间生成、续接与局部编辑全身伴随语音动作"
description: "详解DynaConTalk的SWT系数扩散、动态多模态门控、有符号proposal–consensus与matched-noise约束；核对十张实验表、身体/面部/根轨迹链条及公开实现，区分频带、语义与可验证控制。"
pubDate: "2026-11-16T20:10:00+08:00"
updatedDate: "2026-11-16"
badge: "Paper"
tags: ["DynaConTalk", "Co-Speech-Gesture", "Holistic-Motion", "Wavelet", "Diffusion", "Motion-Control", "Paper-Notes"]
---

<link rel="stylesheet" href="/paper-notes/paper-reading.css?v=20261026-batch" />
<div class="paper-reading" lang="zh-CN">
<nav class="reading-toc" aria-label="本文目录"><strong>阅读目录</strong><ol><li><a href="#reading-1">一句话总结</a></li><li><a href="#reading-2">研究背景与动机</a></li><li><a href="#reading-3">方法详解</a></li><li><a href="#reading-4">实验关键数据</a></li><li><a href="#reading-5">亮点与洞察</a></li><li><a href="#reading-6">局限与展望</a></li><li><a href="#reading-7">相关工作与启发</a></li><li><a href="#reading-8">来源</a></li></ol></nav>

全文入口：[arXiv HTML，可翻译阅读][html] · [原文PDF][paper] · [版本记录][record] · [官方项目][project] · [公开代码][code] · [模型权重][weights]。原生HTML已可用，无需另行转换；本文的**页码、图号和表号统一按PDF**，因为HTML的图号与PDF有偏移。

<details class="paper-meta"><summary>论文信息与阅读范围 · SIGGRAPH Asia 2026 / TOG · 小波域的整人伴随语音动作</summary>

论文：*DynaConTalk: Wavelet-Constrained Diffusion for Long-Form and Controllable Holistic Co-Speech 3D Motion*。作者：**Yifei Zhu、Yangyang Cai、Mingyi Shi、Miao Cheng、Lin Gu、Taku Komura、Yoshifumi Kitamura**，来自东北大学与香港大学。

出处已由[SIGGRAPH Asia 2026官方技术论文日程][venue]核实；[东北大学研究新闻][news]确认论文于**2026-11-09发表于ACM Transactions on Graphics**，[DOI为10.1145/3842553][doi]。技术内容依据**2026-10-07的arXiv v1，14页、11图、10表**，不将其自动等同于最终出版版本。

核查日期：**2026-11-16**。已下载全文、提取逐页文本并渲染检查方法及实验页；静态阅读官方仓库提交 [6c6fa36][code]，核实Hugging Face上身体speech-only、身体editable、face与trajectory BiGRU四组权重文件存在。**未下载运行模型、未重训、未复现任何分数**。研究领域：语音驱动动作、全身与表情生成、平稳小波变换、扩散补全、关键姿态编辑。

</details>

<span id="reading-1" class="reading-anchor"></span>
## 一句话总结

DynaConTalk把伴随语音动作变成**保持每帧对齐的多频带小波系数**，用动态语音条件驱动身体/手部与表情两套扩散模型，再把历史动作或用户姿态重新加到当前噪声等级，实现长序列续接与局部重绘。[§3，PDF第3–7页][paper]

它的价值是把“动作细节怎样表示”“语音线索怎样进入模型”“已知姿态怎样约束采样”连成一条可编辑生成链；**频带不是语义事件，门控不是任务优先级，局部重绘也不是精确接触或目标命中的证明**。

<span id="reading-2" class="reading-anchor"></span>
## 研究背景与动机

**领域现状：** 伴随语音动作已从上半身手势扩展到身体、手指、表情与全局移动。EMAGE用掩码动作先验与分部位表示，DiffSHEG用扩散生成并做长序列外延，SemTalk强调节律性基础动作与稀疏语义动作的结合。这些系统都需要处理同一句话对应多种合理动作的“一对多”问题。[§2，第2–3页][paper]

**现有痛点：** 设想角色说“不是这个，而是那边那个”：躯干可能只缓慢转向，手臂要完成短促的否定与指向，手指和表情还有细节。把这些变化一起回归时，大幅而常见的身体变化容易压过小幅而短暂的细节；把语音切成小窗独立生成，又可能在拼接处出现速度突变。论文将前者概括为动作表示与条件融合两处的“平均化”。

**核心矛盾：** 同一个姿态向量里同时包含不同时间尺度的运动，同一段语音里又混有密集声学节拍与稀疏内容线索。模型既要避免把少见手势平均成通用摆手，又要保证每个局部动作与邻近帧相容。单纯增大模型或叠加更多条件，不能直接决定哪种信息该在什么时候、以多大幅度改变当前动作。

**本文目标：** 生成长时、连贯的身体—手部—面部动画，并允许用户在指定时间调整局部姿态或引入参考动作；编辑后还应保留周围已有动作，避免为了一个关键姿态把整段重做。

**切入角度：** 使用不下采样时间轴的**平稳小波变换SWT**。每个频带仍然有每一帧的位置，因此既能显式分离慢变化与快变化，又能把历史、关键姿态和参考动作放进“时间 × 部位 × 频带”的共同索引中。这里选择的是可定位的信号表示，不是先验动作标签。

**核心 idea：** 先在SWT系数空间学习扩散，再让动态门控决定语音残差信息的参与程度，通过proposal–consensus模块调节它如何更新当前动作；推理时把已知动作加噪到与当前样本一致的等级后注入，统一处理续接与编辑。最后逆SWT恢复局部姿态，另用姿态驱动回归器补出根平移。[§3，图2–4][paper]

<span id="reading-3" class="reading-anchor"></span>
## 方法详解

### 整体框架

输入是语音、窗口转写、说话人身份和体型；可选输入是已提交的历史动作、关键姿态或参考动作。**身体/手部与面部使用独立的去噪器和检查点**，共享的是表示原则和条件接口。身体支路预测55个SMPL-X关节的6D旋转，面部支路预测100维表情系数；根平移不在这两个扩散目标中，而是局部姿态生成后由另训的BiGRU预测。[§3.1–3.4，图2，第3–5页][paper]

<figure class="reading-figure"><a href="/paper-notes/dynacontalk/architecture.svg" target="_blank" rel="noopener"><img src="/paper-notes/dynacontalk/architecture.svg" alt="DynaConTalk完整教学架构：语音、转写、身份经动态门控送入身体手部与表情独立小波扩散，历史及关键姿态在相同噪声等级下注入，逆SWT恢复动作后由BiGRU回归根平移，训练监督分支单独列出" loading="lazy" /></a><figcaption>本站依据PDF图2–4、§3与公开代码重绘的教学示意；点击查看大图。训练监督与推理控制分开，不把真值动作画成普通生成必需输入。</figcaption></figure>

读图时先看左上方的语音条件如何进入两条生成支路，再看右上方的控制如何改变带噪样本，最后向下读逆SWT与根平移。蓝色为语音和身体模型，紫色为表情，橙色为约束或监督，绿色为重建与输出；实线表示推理流，橙虚线表示训练联系。图中两条生成支路之间**没有face→body条件箭头**：当前源码分别调用它们，共享语音与身份不足以证明两者之间有显式跨部位约束求解。

<details><summary>对照原论文框架图</summary>

<figure class="reading-figure"><img src="/paper-notes/dynacontalk/original-framework.png" alt="DynaConTalk原论文图2框架图" loading="lazy" /><figcaption>原论文PDF第4页图2，© Zhu等，依据arXiv版本的<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>许可裁切展示；未改变图中内容。原图的Stage 1/2排布不应被扩展解释为源码中已实现face→body条件传递。</figcaption></figure>

</details>

### 关键设计

1. **SWT把每个动作通道展开为对齐频带，保留快变化的学习机会。**

   身体原始目标是N×330，即55个关节各6维旋转；表情是N×100。沿时间轴做3层db6 SWT后，每个通道有四组系数：cA₃、cD₃、cD₂、cD₁。它们**没有时间下采样**，所以身体目标变为N×1320，表情变为N×400。系数按通道交错排列，并用训练集均值、标准差归一化。[§3.1–3.2，第3页；§4.1，第8页][paper]

   <div class="equation">X₀ = W(M) = {cA₃, cD₃, cD₂, cD₁}<br />xₜ = √ᾱₜ · x₀ + √(1−ᾱₜ) · ε；x̂₀ = fθ(xₜ, t, c)</div>

   上式沿用§3.2：W是SWT，x₀是归一化系数，t是扩散时刻，c是条件。去噪器预测干净系数x₀，采样完再反归一化和逆SWT。这里没有VQ码本、可读动作词或训练得到的动作codec；SWT本身是确定性滤波变换，**连续运动由学到的扩散模型预测系数，再由逆变换恢复**。

   作者把低频与慢姿态、中频与手势、高频与手指/表情细节联系起来，是时间尺度上的解释。每个关节在所有频带都有系数，cD₁既可能包含有用细节，也可能包含噪声；一次否定、指向或握手通常跨多个频带。图8标注的0–1、1–3、3–8、8–15 Hz是解释性频段，不是理想无重叠滤波器，也不能据此给每个系数赋一个语义事件名称。

2. **身体模型先组织关节与频带，再处理局部和长程时间关系。**

   身体输入重排为N×55×4×6；频带专用时间卷积编码每条关节—频带序列，加入关节与频带嵌入。空间Transformer先在同一帧、同一频带中建模关节关系，跨频带Transformer再沟通同一关节的四种尺度，最后融合成逐帧特征。并行线性旁路让模型能先学简单投影，结构分支的残差系数ρ从0开始。[§3.3，第3–4页][paper]

   去噪主干有四个stage，每个stage包含两次局部卷积与一次patch级时间混合：以8帧为一组下采样，加入条件，再用时间Transformer处理；其前面还拼入patch序列的反向副本，最后只保留原序列对应输出。patch特征重复回逐帧分辨率，与局部分支融合。输出端用四个独立频带头，避免所有尺度必须共用同一个末端预测器。**这些token是连续结构特征，不是离散动作符号。** 表情支路较轻，直接线性投影400维系数，不做55关节token化。

3. **DGN保留常驻语音基底，用独立残差门选择其他模态。**

   HuBERT-Large提供1024维逐帧语音特征；另有3维节律描述子（振幅包络、短时能量、onset）、128维mel、512维CLIP窗口转写，以及说话人索引、可学习speaker embedding和前10维shape。HuBERT与身份组成常驻基底；节律、mel、文本作为三个残差模态，各有一个独立sigmoid门。[§3.1、3.4，第3–5页][paper]

   <div class="equation">bᵢ = eᵢᴴᵘᴮᴱᴿᵀ + eⁱᵈ<br />αᵢ,ₛᵐ = sigmoid[zᵢ,ₛᵐ + ηₘ(s/S − 1/2)]，m ∈ {节律, mel, 文本}</div>

   这是原式1的写法：S=1000，z来自语音残差特征、当前带噪动作编码和扩散时间嵌入。η允许不同模态随噪声等级改变权重。三个门不是模态softmax，所以可以同时打开，也可以同时变小；门的末层权重从0开始、bias为−3，初值约0.047，另用很小的门稀疏惩罚鼓励按需使用。

   **CLIP文本是窗口级嵌入广播到各帧，不是逐词事件标签。** HuBERT也不是可直接阅读的动作命令。门控可以随帧和噪声状态变化，但不能仅凭“文本门在某处变大”就断言模型准确识别了词级手势事件，更没有声明“文本要求右手抬起时必须覆盖音频节拍”的显式优先级。

4. **注意力池化与深度路由解决条件分辨率问题，proposal–consensus决定具体更新。**

   每个来源先独立对8帧patch做可学习注意力池化，然后每个stage用一组softmax权重混合常驻基底与三个残差来源。注意区分两种变化：**门和池化权重随输入变化；stage路由权重是每层学到、跨样本共享的参数**，不是每次生成都重新做离散路由。节律另有逐帧旁路，防止短促节拍被8帧池化稀释；身份另加到扩散时间token。[§3.4，第5页][paper]

   stage条件先通过FiLM调节当前patch特征，再提出一个有界更新p，consensus网络同时观察p和当前动作状态，产生有符号的g：

   <div class="equation">h̃ = h ⊙ (1 + tanh γ) + tanh β<br />p = tanh P([h̃; f])；g = tanh C([p; h̃])<br />h⁺ = h̃ + λℓ(g ⊙ p)</div>

   最后一行对应原式2。g的每个分量可以保留、削弱或反转提议；它调的是**隐特征更新方向**，不是求解某只手的三维目标点。尽管p、g有界，λℓ可学习，后续还有Transformer与解码，因此不能把tanh的数值范围当成最终关节误差界。CFG无条件分支使用null基底并关闭残差门，但保留独立身份token路径，使guidance主要改变语音相关更新。

5. **Matched-noise注入把历史与新动作放在同一噪声等级，改善窗口续接。**

   已知约束首先转为与训练目标相同归一化的小波系数x₀ᶜ。在每一步t，重新给干净目标加上该等级噪声，再用掩码m混入当前样本：[式3–4，第5页][paper]

   <div class="equation">xₜᶜ = √ᾱₜ · x₀ᶜ + √(1−ᾱₜ) · ε<br />x̃ₜ = (1−m) ⊙ xₜ + m ⊙ xₜᶜ</div>

   这样模型看到的已知部分与未知部分具有一致的扩散噪声等级。历史续接每步都从**原来的干净历史**重新加噪，而不是把上一轮带噪历史继续加噪。默认窗口64帧、历史8帧、步长56帧；窗口完成后将重叠部分恢复为干净历史，只追加新帧。[§3.5，第5–6页][paper]

   公开采样器还做4帧dead blend：用上一段末速度外推，与新帧线性交叉淡化，再把已提交序列末端作为下一窗历史。因而最终平滑度来自**反复约束与显式接缝混合的组合**，不能把整套窗口结果完全归因于一个注入公式。64帧在30 fps下约2.13秒，8帧约0.27秒；这是窗口大小，不是已测得的端到端流式延迟。

6. **关键姿态先变成平滑目标，再以时间—部位—频带掩码重绘。**

   用户给出时间τ、关节集合J、目标姿态y和强度w。系统在目标附近以高斯权重g(t)=w·exp[−(t−τ)²/(2σ²)]，把原旋转沿SO(3)插向目标；公开实现用四元数SLERP。未选关节在构造目标时不改，得到整段平滑的Mkey，再做SWT。[§3.5，第6页；代码`webui/keypose.py`][code-keypose]

   <div class="equation">x₀ᵏᵉʸ = W(Mkey)；mkey = mtime ⊗ mpart ⊗ mband</div>

   第二遍扩散从原始生成动作的半加噪版本开始，仅修补有关局部片段；目标噪声在各步复用同一次随机采样，历史噪声则每步重新采样。重叠历史的优先级高于编辑，空编辑窗口直接保留原结果，修补片段边缘再与原动作crossfade。这给出了**一条明确冲突规则：历史胜过重叠区编辑**，却没有为任意两条互相冲突的语义指令提供通用裁决器。[第6页；`_sample_windows`与`sample_motion`][code-sampler]

   **注入约束的保证止于哪里？** 从式4只能直接推出x̃ₜ−xₜᶜ=(1−m)⊙(xₜ−xₜᶜ)：m=1的元素在这一瞬间等于带噪目标，软掩码则仍是混合。之后还有去噪器、采样器、逆SWT、旋转转换和局部拼接，代码也没有在末尾把所有编辑关节硬投影到目标。SWT滤波又有时间支持范围，因此“系数有帧索引”不等于“只改变这一帧”。**原文没有证明最终姿态误差上界或关键姿态必然精确通过；表10主要测边界平滑与编辑外溢，不能替代目标角度/位置成功率。** 上面的代数说明是本站解读，不是论文定理。

7. **参考控制有三种机制，style与姿态跟随不能混为一谈。**

   style控制按部位和频带计算参考系数的时间均值、标准差，把当前预测向相同统计量投影，再按强度λ与掩码融合。它约束的是统计形态，不能保证保留参考动作的事件顺序、语义或相位。hold-pose则把选中姿态重复成目标序列；follow-action把参考动作循环或伸缩为目标，再使用matched-noise注入。[§3.5，第6–7页][paper]

   因而“参考动作指导”确实有比普通文本条件更直接的数值接口，但姿态保持、时间伸缩与统计风格是不同控制。所谓无需重训，是在已有表示、扩散模型和可编辑配置上复用采样，不意味着整套系统没有训练，也不意味着speech-only检查点与editable检查点可任意互换。当前仓库已明确实现关键姿态与轨迹编辑；本次没有在公开Studio路径中定位到和论文三种参考控制一一对应的完整独立入口，因此这些扩展的运行状态仍需核查。

8. **整人输出由局部旋转、表情与根回归组合，root不是小波动作的最后三个维度。**

   N×1320身体系数逆变换得到330维旋转，包含SMPL-X完整55关节；400维表情系数逆变换得到100维expression。根回归器从生成姿态取骨盆中心关节位置、时间导数和root yaw rate，经过卷积patch编码、双向GRU、时间上采样，预测相对首帧的3D平移。[§3.1，第3页][paper]

   作者的理由是语音对全局行走轨迹约束弱，根平移维度又远小于旋转，直接联合扩散容易既被损失忽略、又与腿部动作不一致。这个设计建立了**姿态→平移**的依赖，却不是足底接触求解器；双向网络也不能直接视作零前瞻实时模块。面部评估的下颌姿态还有额外真值条件，详见实验口径。

### 一个完整例子

原图7给出“在指定时刻改成双手抬起参考姿态”的例子。下面沿用这个任务，把时间与参数具体化；**“第150帧、双臂、强度0.8、σ=6帧”是教学设定，不是作者报告的该例参数或本站运行结果**。

1. **先生成一段20秒的讲话。** 语音转为逐帧HuBERT、mel与节律，窗口转写经CLIP编码；身份指定说话人embedding与shape。speech-only任务不提供真值身体历史，Studio演示流程则另有固定seed与轨迹条件，二者不能混记。
2. **每个64帧窗分别生成身体与表情系数。** 当前带噪状态和噪声等级影响DGN门；8帧patch条件进入每个stage，proposal–consensus决定隐特征怎样改变。10步UniPC后得到四个频带的系数，后续窗以8帧历史续接。
3. **用户在第150帧选定双臂目标。** 从基底动作出发，在选中关节上做高斯时间权重SLERP，构造目标；w=0.8意味着目标中心也先做80%的姿态插值，并非直接替换为参考姿态。选择频带再决定哪些系数参与约束。
4. **只对附近片段进行第二遍生成。** 原动作加噪到半程；目标在各步加到对应噪声等级、按mask注入；模型补出周围动作。与已有历史冲突的位置使用历史，没编辑的窗口复用基底，最后交叉淡化局部边缘。
5. **重建并组合输出。** 逆SWT恢复旋转与表情，生成身体姿态输入BiGRU产生根平移，最终得到SMPL-X动画。若需求进一步变成“右手必须触到屏幕上某点”，还需要把世界坐标目标、角色朝向、骨架比例和接触条件交给额外的IK/约束层；本文没有提供这一步的精确保证。

<figure class="reading-figure"><img src="/paper-notes/dynacontalk/keypose-editing.png" alt="原文图7：目标关键姿态引导双手或单手的局部动作编辑，红框标记主要受影响区域" loading="lazy" /><figcaption>原论文PDF第10页图7，© Zhu等，<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>，裁切展示。它是作者的定性编辑结果，不是本站复现；帧图可说明局部改变，不能单独量化目标误差。</figcaption></figure>

### 训练/推理

**数据与监督。** 主实验用BEAT2与SHOW，均转为30 fps，主比较使用官方划分；BEAT2是动作捕捉的整人动作，SHOW来自真实视频中的SMPL-X重建。主要消融另外使用BEAT2 speaker 2，并按8:1:1划分，不能把它的FGD数值与全说话人主表直接混比。训练需要配对语音和动作；HuBERT、CLIP是已有预训练特征提取器，SWT不训练，去噪器与门控从动作监督中学习。[§4.1、4.3，第7–9页][paper]

**损失。** 两支都在归一化小波空间预测x₀并用MSE。身体另经过逆SWT与FK，计算关节位置、速度和历史—未来边界损失；editable配置额外使用足接触与关键姿态损失。按照§3.6：

<div class="equation">Lbody = Lwav + 0.2Lgeo + 0.5Lvel + Lsmo + λfootLfoot + λkpLkp + 10⁻³Lgate<br />Lface = Lwav + 10⁻³Lgate</div>

editable取λfoot=8、λkp=1，speech-only两项都为0。足接触集合由真值脚部水平位移阈值0.01/帧与离地高度0.05 m判定，损失惩罚预测接触期水平滑动；它是监督惩罚，非推理时接触锁定。可编辑训练中，无关键姿态、一个、二到三个的概率为0.5、0.25、0.25；在随机未来帧及身体部位取真值姿态，时间mask的σ=6帧。**speech-only身体和face不使用关键姿态监督。** [第7页][paper]

**公开训练配置，来源：PDF第7–8页§4.1与仓库三份YAML配置。** epoch从0计数；下表中的训练规模是公开配方，不是本站测得成本。

| 项目 | 身体speech-only | 身体editable | face |
|---|---|---|---|
| 主干 | 1024通道×4 stage | 同左 | 512通道×4 stage |
| 时间注意力头数 | 16 | 16 | 8 |
| 条件嵌入宽度 | 256 | 256 | 128 |
| 空间/跨频带层数 | 4 / 2 | 4 / 2 | 不用关节token |
| 训练结束epoch | 157 | 176 | 157 |
| 公开检查点epoch | 157 | 176 | 150，验证表情MSE选取 |
| 余弦周期改变 | epoch104：600→160 | epoch136：600→200 | epoch33：600→158 |
| 默认单GPU批量×累积 | 24×8 | 24×8 | 96×2 |

共同设置为有效batch 192、AdamW、学习率2×10⁻⁴、weight decay 0、梯度裁剪0.5、bf16 mixed precision；EMA衰减0.995，从optimizer step 1000开始；最低学习率5×10⁻⁶。学习率按绝对epoch计算，在周期切换点会发生变化，不能只用“训练158轮”重建整个调度。完整条件dropout概率0.2，部分语音模态dropout概率0.4。推理使用EMA、二阶UniPC **10步**、CFG scale **4.0**。HuBERT以全精度提取，再由50 fps对齐到30 fps；缓存特征用float16，文本编码器为CLIP ViT-B/32。[第8页；配置][code-config]

**成本与开放状态。** 公开代码有训练、预处理、评估和Studio入口；Hugging Face有四组权重及统计文件，另需按各自许可取得SMPL-X等资产。README把Studio约6 GB显存作为使用建议，并称一次生成峰值约5.3 GB；**没有下限扫描，不能称为经验证的最低硬件配置**。本次材料未披露可核对的训练GPU型号、实际墙钟时长、GPU-hours或完整账单，默认`devices: 1`也不能证明论文全部实验的原始资源消耗。README还区分早期600 epoch方案与当前发布配方，不能用旧时长或轮数替代当前版本。

<details><summary>公开实现与论文链条的静态核查：哪些已对上，哪些还需运行</summary>

- **表示与采样已找到对应实现。** [`wavelet.py`][code-wavelet]实现SWT/ISWT和交错通道排列；配置实际选择db6。即使辅助类的构造默认值是bior2.8，也不能据此说发布模型用bior2.8。[去噪网络`light_final.py`][code-net]对应关节/频带编码、四个stage与频带头；[采样器`light_final.py`][code-sampler]的`_sample_windows`、`sample_motion`与`_dead_blend`对应逐步历史注入、重绘与接缝处理。
- **Studio与speech-only主评估不同。** [`webui/generate.py`][code-generate]用editable身体与face模型，从固定BEAT2测试序列seed开始，按选定轨迹长度切块；轨迹在各块重新开始。原始输出包含轨迹条件，最终可视化版本再由[`webui/trajectory.py`][code-trajectory]的BiGRU重写平移。README说明姿态/轨迹资产来自BEAT2测试和验证集，适合作为明确给定的参考控制，不能把这种交互演示直接计为未见动作上的无提示speech-only生成。
- **条件路径存在需要实验核实的细节。** 默认[`configs/dgn/v2.yaml`][code-dgn]开启depth routing。[`audio_conditioning.py`第384–392行][code-condition]先把trajectory/keypose嵌入加到`fused_feature`，但`source_streams`只收集HuBERT＋identity基底及三个语音残差；第423–431行的stage条件随后由`source_streams`计算。这条静态路径没有把上述额外嵌入带进stage路由，需用发布配置与权重验证其实际影响。**关键姿态在采样器中的mask注入仍明确存在**，不能据此推成“所有编辑失效”或否定论文结果。
- **评估脚本有两个口径。** README分别提供EMAGE整段评估与RAG-Gesture的10秒分块评估，后者还说明真值先15 fps采样再插回30 fps。论文表1写跟随RAG-GESTURE，而§4.1描述了整段生成、BC去掉首尾2秒等设置。复现时要对照脚本、分块、真值重采样和比例因子；本次未运行，不能假设两个入口必然输出相同数字。
- **可选LLM助手是编辑计划层。** [`webui/agent.py`][code-agent]把转写、词时间、响度、停顿与姿态库目录交给外部LLM，让它返回`keypose_id`和`frame`，再进入待编辑列表。连续动作仍由重绘扩散产生。这是可检查的高层“库中姿态＋时间点”接口，不是论文训练出可读音频符号，也没有证明LLM选择与目标语义完全一致。

以上是截至该提交的只读代码追踪，没有加载权重或更改作者实现。

</details>

<span id="reading-4" class="reading-anchor"></span>
## 实验关键数据

### 主实验

以下均为**原论文报告的结果**，不是本站重跑；原文没有逐个列明所有基线数字的重训/转引来源。FGD度量动作特征分布，BC度量音频与动作节拍关系，Div.度量动作变化；它们都不直接测指向目标、事件顺序或接触成功。

**BEAT2全说话人，原表1，PDF第8页。** 保留原表读数；实际FGD与BC为表中读数×10⁻¹，MSE为×10⁻⁸，LVD为×10⁻⁵。本表的BC、Div.以**接近测试GT**为佳，不能按↑排名。

| 方法 | FGD ↓ | BC，近4.77为佳 | Div.，近7.29为佳 | 面部MSE ↓ | 面部LVD ↓ |
|---|---:|---:|---:|---:|---:|
| GT，测试集 | — | 4.77 | 7.29 | — | — |
| CaMN | 5.12 | 2.00 | 5.58 | — | — |
| Audio2Photoreal | 8.49 | 3.26 | 6.24 | — | — |
| ReMoDiffuse | 11.20 | 2.18 | 5.06 | — | — |
| DSG | 11.74 | 7.34 | 11.12 | — | — |
| HoloGest | 6.46 | 8.03 | 13.53 | — | — |
| EMAGE | 6.92 | 2.84 | 6.06 | 6.908 | 1.453 |
| RAG-GESTURE | 4.87 | 5.14 | 9.94 | — | — |
| SemTalk | 3.56 | **5.10** | 8.409 | 4.439 | 1.435 |
| DiffSHEG | 9.43 | 2.25 | **7.23** | 7.665 | 8.673 |
| DynaConTalk，edit | 2.97 | 6.83 | 8.09 | **3.413** | 1.422 |
| DynaConTalk，speech-only body＋face | **1.75** | 5.36 | 7.85 | 3.55 | **1.32** |

**SHOW，原表2，PDF第8页。** 比例因子同表1；这里BC与Div.沿用原表↑，原表未给SHOW测试GT参考值，不擅自换成表1的最优判据。

| 方法 | FGD ↓ | BC ↑ | Div. ↑ | 面部MSE ↓ | 面部LVD ↓ |
|---|---:|---:|---:|---:|---:|
| FaceFormer | — | — | — | 138.1 | 43.69 |
| CodeTalker | — | — | — | 140.7 | 45.84 |
| CaMN | 22.12 | 7.712 | 10.37 | — | — |
| DSG | 24.84 | 8.027 | 10.23 | — | — |
| LivelySpeaker | 32.17 | 7.844 | 10.14 | — | — |
| Habibie等 | 27.22 | 8.209 | 8.541 | 145.6 | 47.35 |
| TalkSHOW | 24.43 | 8.249 | 10.98 | 139.6 | 45.17 |
| EMAGE | 22.12 | 8.280 | **12.46** | 136.1 | 42.44 |
| SemTalk | 20.18 | 8.304 | 11.36 | 134.1 | 39.15 |
| DiffSHEG | 24.87 | 8.061 | 10.79 | 139.0 | 45.77 |
| DynaConTalk | **14.25** | **8.313** | 11.45 | **105.41** | **28.59** |

**面部指标的必要边界，来源§4.1，PDF第7页。** 面部生成用前8帧真值expression初始化；计算SMPL-X顶点时使用**真值jaw pose与body shape**，只替换预测expression。因此MSE/LVD是此协议下的表情准确度，不能当成“身体下颌、体型、表情都由语音独立预测”后的完整面部误差。身体speech-only评估则不提供真值动作历史、关键姿态或root trajectory。表1的edit与最后一行是不同配置，不能把edit行更低的MSE和最后一行更低的FGD拼成一个并不存在的单一结果。

**主观评价，原表3，PDF第8页。** 30名参与者评价15个同语音案例，三个系统匿名展示；下表为均分，均按↑。原文此处未报告置信区间、显著性检验或完整评分量表。

| 方法 | 真实感 ↑ | 语义相符 ↑ | 同步 ↑ | 多样性 ↑ |
|---|---:|---:|---:|---:|
| EMAGE | 1.67 | 1.89 | 1.76 | 1.83 |
| SemTalk | 2.05 | 1.95 | 2.05 | 2.05 |
| DynaConTalk | **2.30** | **2.15** | **2.21** | **2.15** |

**足地稳定性，原表4，PDF第9页，CAMDM协议。** Contact列原表没有方向箭头，这里不自行解释成接触识别准确率。

| 方法 | Sliding ↓ | Abs. ↓ | P95 ↓ | Contact |
|---|---:|---:|---:|---:|
| EMAGE | 2.2040 | 0.01328 | 0.01908 | 0.0008 |
| SemTalk | 1.6942 | 0.00555 | 0.01507 | 0.0109 |
| DynaConTalk | **0.7751** | **0.00233** | **0.00613** | 0.0933 |

**长序列与控制，原表10，PDF第11页，全部↓。** 窗口对照是overlap replacement；关键姿态两项对照依次为**Raw6D repaint / DiffSHEG**，前者使用相同matched-noise协议但不用SWT；参考控制对照是未控制输出。数值按原表保留，原表没有为每项完整列出物理单位与样本数，不自行补成厘米或成功率。

| 任务 | 指标 | 对照 | DynaConTalk / 加控制后 |
|---|---|---:|---:|
| 窗口续接 | Position | 0.0240 | **0.0158** |
| 窗口续接 | Velocity | 0.0069 | **0.0029** |
| 窗口续接 | Acceleration | 0.0034 | **0.0017** |
| 关键姿态 | Edge acceleration | 6.35 / 6.46 | **5.89** |
| 关键姿态 | Edge velocity | 1.84 / 1.84 | **1.72** |
| 关键姿态 | Spill | 2.131 / 1.249 | **1.242** |
| 参考控制 | Style distance | 0.822 | **0.537** |
| 参考控制 | Hold RMS | 0.298 | **0.148** |
| 参考控制 | Follow error | 0.656 | **0.360** |

### 消融实验

以下表5–8统一来自**BEAT2 speaker 2、8:1:1划分**。保留原表FGD、BC和L1-div.数值及↑/↓，不把主表的比例或GT参照未经说明地搬入消融。

**核心组件：** 原表5，PDF第9页。去掉DGN，FGD由3.107变4.465，退化最大；去掉consensus变3.951；用cross-attention代替DGN变3.747。去掉SWT的FGD变3.482，变化较小，但不能据此断言高频动态贡献小，后文有直接诊断。

| 配置 | FGD ↓ | ΔFGD | BC ↑ | L1-div. ↑ |
|---|---:|---:|---:|---:|
| 完整模型 | **3.107** | — | 7.853 | 11.0900 |
| 无DGN | 4.465 | +1.358 | 7.783 | 11.7689 |
| 无consensus | 3.951 | +0.844 | **7.911** | 11.6772 |
| DGN换为cross-attention | 3.747 | +0.640 | 7.352 | 10.8291 |
| 无SWT | 3.482 | +0.375 | 7.717 | **12.1563** |

**主干与采样：** 原表6，PDF第9页。去掉时间下采样的FGD损失最大；去掉空间Transformer、频带专用头或换成Smooth window sampling也退步。这不是“所有指标都提高”，完整模型的L1-div.反而较低。

| 配置 | FGD ↓ | ΔFGD | BC ↑ | L1-div. ↑ |
|---|---:|---:|---:|---:|
| 无downsampling | 3.643 | +0.536 | 7.572 | 11.6865 |
| 无spatial Transformer | 3.445 | +0.338 | 7.581 | 11.6986 |
| 无band-specific heads | 3.411 | +0.304 | 7.620 | 11.5354 |
| Smooth window sampling | 3.377 | +0.270 | 7.573 | **11.9420** |
| 完整模型 | **3.107** | — | **7.853** | 11.0900 |

**输入条件：** 原表7，PDF第10页。这里的ΔFGD以“All conditions”为基准，不是以完整选定条件为基准。删CLIP emotion或word index分别改善0.108、0.085；删节律主要损害BC。删CLIP text对FGD影响很小，不能用这张表证明文本语义控制的精确性。

| 条件配置 | FGD ↓ | ΔFGD | BC ↑ | L1-div. ↑ |
|---|---:|---:|---:|---:|
| All conditions | 3.325 | — | 7.681 | **11.8578** |
| 无CLIP emotion | 3.217 | −0.108 | 7.721 | 11.3341 |
| 无word index | 3.240 | −0.085 | 7.729 | 11.3781 |
| 无rhythm | 3.304 | −0.021 | 7.428 | 11.3719 |
| 无mel | 3.372 | +0.047 | 7.766 | 10.7499 |
| 无HuBERT semantics | 3.413 | +0.088 | 7.724 | 11.5954 |
| 无CLIP text | 3.305 | −0.020 | 7.720 | 11.5920 |
| Full selected set | **3.107** | −0.218 | **7.853** | 11.0900 |

**小波家族与深度：** 原表8，PDF第10页。三层db6的FGD最好，但sym4、bior2.8接近；更深不总更好，db6 L4变为3.527，甚至高于无小波3.482。

| 配置 | FGD ↓ | ΔFGD | BC ↑ | L1-div. ↑ |
|---|---:|---:|---:|---:|
| sym4 L3 | 3.162 | +0.055 | 7.672 | 11.8648 |
| bior2.8 L3 | 3.145 | +0.038 | 7.581 | 11.6986 |
| coif5 L3 | 3.348 | +0.241 | 7.658 | 11.7614 |
| bior4.4 L3 | 3.199 | +0.092 | 7.676 | 11.8984 |
| db6 L1 | 3.341 | +0.234 | 7.698 | 11.9722 |
| db6 L2 | 3.178 | +0.071 | 7.621 | 11.9938 |
| db6 L4 | 3.527 | +0.420 | 7.262 | 11.4232 |
| 无wavelet | 3.482 | +0.375 | 7.717 | **12.1563** |
| 完整：db6 L3 | **3.107** | — | **7.853** | 11.0900 |

**动态分布诊断：** 原表9，PDF第11页。它比较上半身关节加速度峰度κacc的log(1+κacc)分布，Median不是“加速度本身的中位数”；W₁与KS衡量该统计分布到GT的距离，不是逐帧运动误差。

| 方法 | Median | W₁到GT ↓ | KS到GT ↓ |
|---|---:|---:|---:|
| GT | 2.7386 | 0 | 0 |
| DynaConTalk | 2.7901 | **0.0887** | **0.0679** |
| Raw6D | 3.8911 | 1.1217 | 0.7849 |
| EMAGE | 2.2619 | 0.5540 | 0.5472 |
| SemTalk | 2.1035 | 0.8015 | 0.6906 |

**等姿态误差的表示对照：** §4.4.2，PDF第11页，给真值Raw6D或SWT系数加高斯扰动，并调节噪声，使最终姿态RMSE近似相同。Raw6D时间二阶残差为**44.10**，SWT为**4.67**，约下降**89.4%**。这是隔离表示的人工扰动实验，不是训练速度或任意模型误差的上界；噪声在哪个坐标空间加入，会改变其时间相关性。

**为什么FGD变化不大：** 同节报告，FGD对4–12 Hz同幅扰动的响应约为0.25–2 Hz的1/20；把预测3–15 Hz频带换成GT，仍保留原FGD的**99.51%**，只替换0–1 Hz则剩**9.14%**。这支持“所用FGD主要看粗尺度”的诊断，但没有证明某个频段对应具体语义。动态分布KS检验报告p=0.57，表示该检验未拒绝一致性，不等于证明生成分布与真值完全相同。[第11页，表9、图9][paper]

<figure class="reading-figure"><img src="/paper-notes/dynacontalk/wavelet-diagnostics.png" alt="原文图8：高频小波系数标准差更小，能量更集中于少数时间帧" loading="lazy" /><figcaption>原论文PDF第12页图8，© Zhu等，<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>，裁切展示。cD₁标准差比cA₃小65–101倍，69–81%的能量集中在能量最高的10%帧；统计上的短促变化不自动等同于语义事件。</figcaption></figure>

### 关键发现

1. **整体分布质量较强，但不是每个指标都领先。** BEAT2 speech-only的FGD读数1.75，相比SemTalk的3.56约低50.8%；SHOW为14.25对20.18，约低29.4%。然而BEAT2最接近GT的BC是SemTalk，多样性是DiffSHEG；SHOW原表的最高Div.是EMAGE。正文“最佳”应限定在具体指标。
2. **DGN对FGD影响大，SWT对动态形态的证据更直接。** 去DGN增加FGD 1.358，去SWT增加0.375；等误差扰动与峰度分布则显示SWT明显改变误差的时间形态。两组证据回答不同问题，不宜只排贡献大小。
3. **控制改善有可量化证据，但需要看对照。** Spill从Raw6D的2.131降到1.242约改善41.7%，与DiffSHEG的1.249相比只低约0.6%；不能把“减少42%”套到所有基线。Hold RMS、Follow error仍分别为0.148、0.360，也说明本文报告的是误差降低而非严格满足。
4. **平滑与细节可以同时改善，仍须防止“越平越好”。** 原文同时给关节加速度分布、局部编辑响应和主观评价，比单看平滑损失更完整。图10里SWT编辑的局部acceleration RMS为基底的1.3倍，Raw6D为25.8倍；但这些是该定性/诊断设置的读数，不能当作所有编辑的最坏情况界。[图10，第12页][paper]
5. **发布材料比只给demo更可检查，距离复现仍有步骤。** 代码、权重、数据配方和评估入口都可见，但不同配置、初始化、评估切块与条件路径必须对齐。本次完成的是全文与实现链条核查，没有把“存在可下载文件”写成“已经复现”。

<span id="reading-5" class="reading-anchor"></span>
## 亮点与洞察

- **把表示与控制接口统一：** 保留逐帧SWT系数，使历史、编辑和参考能用同样的时间—部位—频带索引组织。对动作编辑系统而言，这比单独加一个“风格向量”更接近可操作的接口。
- **区分“给什么信息”和“怎样改当前状态”：** DGN决定条件来源的参与程度，proposal–consensus决定对当前隐状态的修正；两个环节不是同一层softmax的不同叫法。
- **保留逐帧路径应对patch损失：** 时间patch降低长程建模成本，节律旁路补偿短事件被平均的问题。这一思路可迁移到需要兼顾粗结构与精细时序的生成器。
- **不让总体指标替代细节检查：** 用同姿态RMSE扰动、加速度峰度和频带替换分析FGD的敏感性，展示“分数差不多”时运动动态仍可能差异很大。
- **提供明确的可编辑链条：** 用户姿态→旋转插值→SWT目标→mask注入→局部重绘→拼接的路径可追踪；若上层由LLM规划，也应把LLM的姿态/时间选择与下层生成及误差验证分开。

<span id="reading-6" class="reading-anchor"></span>
## 局限与展望

- **频率分离不等于事件分解。** SWT没有自动输出“准备—击拍—收回”或“否定—指向”标签；更高频也不天然更语义重要。若要可编辑事件时间线，还需要事件表示、时间对应与解码后识别验证。
- **多模态门控不构成通用冲突裁决。** 论文没有在同一身体部位制造相反文本/音频要求并验证优先级。当前明确可查的是重叠历史对编辑mask的优先级；signed consensus只是隐特征更新，不是“文本优先”或“目标必达”的规则。
- **空间与物理控制仍有限。** 关键姿态主要指定旋转；论文没有对世界坐标指向、手物接触、无穿插、足部不滑或平衡给出硬保证。足滑损失和表4是经验改善，不能替代运动学/动力学约束求解。
- **全局移动是作者明确承认的弱项。** 共语数据中大幅行走较少，语音又难确定轨迹；root由姿态回归只能缓解局部动作与平移不一致，不能自动获得长程导航。更多说话人与locomotion-heavy场景仍待验证。[§5，第11页][paper]
- **“长时”不等于无延迟在线。** 有限窗口的条件编码、双向根回归和特征提取都可能需要上下文；10步采样说明求解步骤少，却没有完整延迟、吞吐与长时漂移曲线，不能凭任意长度拼接就称为实时交互保证。
- **评测覆盖与复现条件需要保留。** 面部依赖真值jaw/shape初始化协议，消融只在speaker 2，表10缺少充分展开的单位、样本数与目标命中分布；主观评价也缺少区间。发布Studio的测试seed/参考库与speech-only评测要分开，代码条件路由细节仍需运行确认。
- **面向演示头像的进一步工作属于系统集成。** 若用于Unity/VRM或讲解页面，需要额外解决骨架重定向、视线与屏幕目标映射、动作时间线、翻页/滚动和接触约束。DynaConTalk可作为语音驱动生成与局部修补候选，本文没有给出这些完整产品链条的验证结果。

<span id="reading-7" class="reading-anchor"></span>
## 相关工作与启发

- **[EMAGE（CVPR 2024）][emage]：** 提供BEAT2与整人共语动作的重要基线，用掩码动作提示和组合VQ-VAE组织生成。DynaConTalk直接扩散连续SWT系数，并把已知动作以matched-noise方式注入；两者都能接受动作信息，但“掩码重建先验”与“采样时小波约束”是不同机制。
- **[DiffSHEG（CVPR 2024）][diffsheg]：** 同样关注表情、手势与任意长生成，原方法明确使用expression→gesture单向信息流和outpainting。DynaConTalk则使用独立body/face分支、对齐小波域与反复重加噪历史；不能把DiffSHEG的跨分支依赖直接移植为DynaConTalk已实现的结构。
- **[SemTalk（ICCV 2025）][semtalk]：** 把节律基础动作与稀疏语义动作分开学习，再用语义强调融合。DynaConTalk在条件特征层保留常驻基底、动态开启残差信息，并在动作状态更新时加consensus；它没有显式输出一套可读的语义动作事件序列。
- **[MotionWavelet][motionwavelet]：** 同样利用小波域建模动作，但重点是人类未来运动预测与小波空间引导；DynaConTalk重点是语音驱动的整人生成、逐帧对齐控制与局部编辑。使用同一种信号工具，不代表任务、条件输入和约束能力相同。
- **[RePaint（CVPR 2022）][repaint]：** 提供在扩散采样中把已知区域加噪后重新注入的基础思想，DynaConTalk在正文明确引用。本文的推进是把该接口落到时间对齐的动作频带、续接与姿态修补；matched-noise本身不应写成从未出现过的原则，也没有自动带来最终姿态硬约束。
- **启发：** 对可控演示角色，值得保留三层接口：上层给出姿态/时间或参考意图，中层把它转成有明确作用域的数值约束，下层用生成先验修补连续运动；最后还需要对实际解码动作检查目标误差。本文较好地展示了中下层如何连接，也清楚暴露出语义计划与物理执行之间仍需补上的验证环节。

<span id="reading-8" class="reading-anchor"></span>
## 来源

1. [arXiv v1 PDF，14页][paper]与[原生HTML][html]：§3、第3–7页及图2–4用于方法；§4、第7–12页、表1–10用于实验；§5用于作者局限。本文图表定位统一按PDF；已对方法和表格所在页做渲染核对。
2. [arXiv版本记录][record]：题名、作者、2026-10-07版本与[CC BY 4.0许可][license]。原图2、7、8在文中注明出处并裁切展示；总架构SVG为本站教学重绘，非运行结果。
3. [SIGGRAPH Asia 2026官方日程][venue]、[东北大学2026-11-13研究新闻][news]与[TOG DOI][doi]：正式出处依据；不以预印本模板页眉判断录用。
4. [官方GitHub仓库][code]，核查提交[6c6fa36][code]：模型、条件、采样与编辑实现；[Hugging Face检查点目录][weights]已核实四组模型文件存在。未做权重加载、训练或推理。
5. 相关工作链接为CVF、arXiv等原始入口；比较范围限于与本文机制相关的工作，不是穷尽文献综述。检索于2026-11-16，使用题名、arXiv编号及“DynaConTalk wavelet controllable code”等查询，另追踪论文引用；核对来源包括arXiv、官方会议与机构、GitHub、Hugging Face及CVF。
6. 方法保证边界、代数混合说明、代码路由风险与演示系统适用性属于本站分析；实验表均为作者原数值，不以静态阅读代替运行验证。

</div>

[html]: https://arxiv.org/html/2610.09846v1
[paper]: https://arxiv.org/pdf/2610.09846v1
[record]: https://arxiv.org/abs/2610.09846
[project]: https://zhuyifeiabcd1.github.io/DynaConTalk/
[venue]: https://sa2026.conference-schedule.org/presentation/?id=papers_1907&sess=sess132
[news]: https://www.tohoku.ac.jp/en/press/ai_helps_digital_humans_move_more_naturally_as_they_speak.html
[doi]: https://doi.org/10.1145/3842553
[license]: https://creativecommons.org/licenses/by/4.0/
[code]: https://github.com/zhuyifeiabcd1/DynaConTalk/tree/6c6fa369836859005b2d022ce6e8cdaa42c64b4a
[weights]: https://huggingface.co/HAJIMIMANBO1/DynaConTalk/tree/main/checkpoints
[code-config]: https://github.com/zhuyifeiabcd1/DynaConTalk/tree/6c6fa369836859005b2d022ce6e8cdaa42c64b4a/configs
[code-dgn]: https://github.com/zhuyifeiabcd1/DynaConTalk/blob/6c6fa369836859005b2d022ce6e8cdaa42c64b4a/configs/dgn/v2.yaml
[code-wavelet]: https://github.com/zhuyifeiabcd1/DynaConTalk/blob/6c6fa369836859005b2d022ce6e8cdaa42c64b4a/src/models/wavelet.py
[code-net]: https://github.com/zhuyifeiabcd1/DynaConTalk/blob/6c6fa369836859005b2d022ce6e8cdaa42c64b4a/src/models/nets/light_final.py
[code-condition]: https://github.com/zhuyifeiabcd1/DynaConTalk/blob/6c6fa369836859005b2d022ce6e8cdaa42c64b4a/src/models/nets/audio_conditioning.py#L384-L431
[code-sampler]: https://github.com/zhuyifeiabcd1/DynaConTalk/blob/6c6fa369836859005b2d022ce6e8cdaa42c64b4a/src/models/light_final.py#L588-L736
[code-keypose]: https://github.com/zhuyifeiabcd1/DynaConTalk/blob/6c6fa369836859005b2d022ce6e8cdaa42c64b4a/webui/keypose.py
[code-generate]: https://github.com/zhuyifeiabcd1/DynaConTalk/blob/6c6fa369836859005b2d022ce6e8cdaa42c64b4a/webui/generate.py
[code-trajectory]: https://github.com/zhuyifeiabcd1/DynaConTalk/blob/6c6fa369836859005b2d022ce6e8cdaa42c64b4a/webui/trajectory.py
[code-agent]: https://github.com/zhuyifeiabcd1/DynaConTalk/blob/6c6fa369836859005b2d022ce6e8cdaa42c64b4a/webui/agent.py
[emage]: https://openaccess.thecvf.com/content/CVPR2024/html/Liu_EMAGE_Towards_Unified_Holistic_Co-Speech_Gesture_Generation_via_Expressive_Masked_CVPR_2024_paper.html
[diffsheg]: https://openaccess.thecvf.com/content/CVPR2024/html/Chen_DiffSHEG_A_Diffusion-Based_Approach_for_Real-Time_Speech-driven_Holistic_3D_Expression_CVPR_2024_paper.html
[semtalk]: https://openaccess.thecvf.com/content/ICCV2025/html/Zhang_SemTalk_Holistic_Co-speech_Motion_Generation_with_Frame-level_Semantic_Emphasis_ICCV_2025_paper.html
[motionwavelet]: https://arxiv.org/abs/2411.16964
[repaint]: https://openaccess.thecvf.com/content/CVPR2022/html/Lugmayr_RePaint_Inpainting_Using_Denoising_Diffusion_Probabilistic_Models_CVPR_2022_paper.html
