## PLT: Part-Wise Latent Tokens as Adaptable Motion Priors for Physically

## Simulated Characters Hybrid Latent Representation Revisited

JINSEOK BAE, Seoul National University, Republic of Korea

YOUNGHWAN LEE, Seoul National University, Republic of Korea

DONGGEUN LIM, Seoul National University, Republic of Korea

[YOUNG MIN KIM ∗](https://orcid.org/0000-0002-6735-8539)

, Seoul National University, Republic of Korea

<!-- image -->

Fig. 1. Our method allows physically simulated characters to gradually update part-wise motion priors from the multiple datasets, namely part-wise adaptation.

Beginning with a whole-body motion prior featuring aiming motions, we sequentially adapt the lower-body motion using an assassin-movement dataset,

followed by updating upper-body skills with a handball motion dataset. For each stage, we visualize the kinematic reference (left) and the simulated character

(right), where the bounding boxes indicate the updated body parts.

Physically simulated characters can learn highly natural full-body motion guided by motion capture datasets. However, the range of motion is limited to the existing high-quality datasets, and cannot effectively adapt to challenging scenarios. We propose a novel policy architecture that learns part-wise motion skills, where individual parts can be separately extended and combined for unobserved settings. Our method employs a set of part-specific codebooks, which robustly capture motion dynamics without catastrophic collapse or forgetting. This structured decomposition allows intuitive control over the character's behavior and dynamic exploration for a novel combination of part-wise motion. We further incorporate a refinement network compensating for subtle discrepancies in the disjoint discrete tokens, thus improving motion quality and stability. Our extensive evaluations show that our part-wise latent token achieves superior performance in imitating motions, even those from unseen distribution. We also validate our method in challenging tasks, including body tracking, navigation on complex terrains, and point-goal navigation with damaged body parts. Finally, we introduce a

∗ Corresponding author.

Authors' Contact Information: Jinseok Bae, Seoul National University, Seoul, Republic of Korea, capoo95@snu.ac.kr; Younghwan Lee, Seoul National University, Seoul, Republic of Korea, frredy99@snu.ac.kr; Donggeun Lim, Seoul National University, Seoul, Republic of Korea, rms2836@snu.ac.kr; Young Min Kim, Seoul National University, Seoul, Republic of Korea, youngmin.kim@snu.ac.kr.

<!-- image -->

This work is licensed under a Creative Commons Attribution 4.0 International License. SIGGRAPH Conference Papers '25, Vancouver, BC, Canada

© 2025 Copyright held by the owner/author(s).

ACM ISBN 979-8-4007-1540-2/25/08

[https://doi.org/10.1145/3721238.3730637](https://doi.org/10.1145/3721238.3730637)

<!-- image -->

part-wise expansion of motion priors, where the physically simulated character incrementally adapts partial motion and produces unique combinations of whole-body motion, significantly diversifying motions.

## CCS Concepts: · Computing methodologies → Physical simulation; Motion processing.

Additional Key Words and Phrases: Computer Animation, Physics-based Simulation, Deep Reinforcement Learning, Large-scale Motion Imitation

## ACM Reference Format:

Jinseok Bae, Younghwan Lee, Donggeun Lim, and Young Min Kim. 2025. PLT: Part-Wise Latent Tokens as Adaptable Motion Priors for Physically Simulated Characters. In Special Interest Group on Computer Graphics and Interactive Techniques Conference Conference Papers (SIGGRAPH Conference Papers '25), August 10-14, 2025, Vancouver, BC, Canada. ACM, New York, NY, USA, 10 pages. https://doi.org/10.1145/3721238.3730637

## 1 Introduction

Physically-based animation has significantly improved the realism of simulated character motions by replicating human motions in motion capture datasets [Hassan et al. 2023; Wang et al. 2024a; Zhang et al. 2023]. Hierarchical control pipelines learn general motion priors from a large collection of motion data and exploit the latent priors to obtain task-specific policy [Bohez et al. 2022; Merel et al. 2020]. Despite their success, these pipelines often struggle with discovering novel motion skills and task adaptability. The available high-quality datasets [Fussell et al. 2021; Peng et al. 2018, 2021] cannot extensively encompass the wide range of daily human motions.

SIGGRAPH Conference Papers '25, August 10-14, 2025, Vancouver, BC, Canada.

## 2 · Bae et al.

We argue that the aforementioned challenge in the generalization stems from the rigidity of the motion priors, which can only consume the provided set of whole-body motions. Some studies have proposed combining part-wise motions from different sources to improve data efficiency and expand the diversity of generated motions [Bae et al. 2023; Khoshsiyar et al. 2024; Xu et al. 2023a]. However, the part-specific priors are either ignorant of compatibility between part-level motions or not reusable for further scenarios.

To enrich the adaptability of motion prior, we propose a novel policy architecture that learns part-wise motion skills using discrete latent tokens. Part-specific codebooks contain discrete latent tokens representing specialized motion skills for designated body parts, constituting structured motion decomposition. The policy architecture trains a high-level policy that combines tokens from multiple body parts. The rich combinations of part-wise latent tokens increase the diversity of generated motions and significantly improve generalization compared to whole-body motion representation with the same number of tokens. Prior work on continuous latent spaces [Luo et al. 2023b; Peng et al. 2022; Won et al. 2022] could be extended to decompose part-wise motion priors. However, this requires multiple high-level policies, increasing training complexity, or a single unified policy, which loses the benefits of decomposition. In contrast, our method allows stable yet efficient training using a single high-level policy with a multi-discrete action space. By dynamically combining tokens from multiple body parts, the agent discovers optimal movements tailored to task goals.

We introduce a refinement network within the policy architecture to enhance the fidelity of generated motions. While part-wise codebooks provide structured motion decomposition, naïve combinations of discrete embeddings can result in jerky movements. Previous methods combining part-wise motions [Bae et al. 2023; Xu et al. 2023a] often rely solely on physical plausibility from simulation engines, limiting their applicability to complex scenarios. Our refinement network adds continuous offsets to discrete latent tokens, effectively ensuring coherence across body parts. Empirically, combining discrete tokens with continuous refinement improves stability and adaptability across diverse scenarios.

Through experiments, we demonstrate that our part-wise method dramatically enhances motion fidelity, task adaptability, and scalability. First, our approach achieves state-of-the-art results on fullbody imitation. The imitation performance is stable even for out-ofdistribution targets, indicating the robustness and expressiveness of part-wise latent tokens in capturing diverse motion skills. Next, we validate our approach in task scenarios without extensive reward engineering. In 𝑁-body tracking, our model consistently achieves high accuracy across varying tracker configurations, even without full-body imitation rewards. For navigation tasks, including pointgoal scenarios with damaged body parts, our method demonstrates superior performance, showcasing its adaptability to challenging scenarios. We further demonstrate the feasibility of our proposed method on an extremely large-scale dataset [Mahmood et al. 2019], addressing conventional tasks [Luo et al. 2023b] such as striking and navigating rough terrain. Finally, we introduce part-wise motion adaptation, a novel scheme for incrementally updating motion priors by integrating data from multiple datasets while maintaining physical plausibility. For example, an agent can adapt its lower body to assassin-like movements and later refine its upper body for handball motion. Such adaptability liberates the physics-based animation from the predefined full-body motion dataset, providing a systematic approach to broaden the scope of generated motions.

## 2 RelatedWorks

## 2.1 Kinematics-Based Motion Generation

Large-scale motion capture datasets [Harvey et al. 2020; Mahmood et al. 2019; Mason et al. 2022] have incurred massive advancements in kinematics-based motion generation. While recent generative models can synthesize high-quality motions [Chen et al. 2023; Guo et al. 2024; Tevet et al. 2023], these approaches only account for skeletal movements and lack physical plausibility, resulting in apparent artifacts such as foot sliding or penetration to the scene objects.

## 2.2 Physics-Based Hierarchical Control Pipelines

Hierarchical control pipelines efficiently use offline dataset while training a simulated character to move such that it performs a range of tasks [Bohez et al. 2022; Merel et al. 2018, 2020]. Most existing pipelines rely on latent models to represent dynamics, which can be broadly categorized into continuous and discrete models.

Continuous latent models [Ling et al. 2020; Luo et al. 2023b; Peng et al. 2022; Won et al. 2022; Yao et al. 2022] encode motions in a smooth latent space with regularization like variational inference [Kingma 2013]. However, these models are susceptible to hyperparameter tuning, which often results in unstable training and suboptimal task learning. On the other hand, discrete latent models [Han et al. 2024; Yao et al. 2024; Zhu et al. 2023] offer greater robustness by representing motion priors as tokenized latent spaces [Van Den Oord et al. 2017]. While discrete models mitigate some challenges of continuous representations, their models are highly dependent on the number of tokens and suffer from artifacts like abrupt motions. MoConVQ [Yao et al. 2024] presents an advanced discrete latent model that integrates a model-based approach with differentiable simulation layers and Residual Vector Quantization (RVQ) [Lee et al. 2022; Zeghidour et al. 2021]. In contrast, our method fundamentally differs as it eliminates the need to train simulation layers. Both continuous and discrete latent models remain heavily dependent on the training dataset, limiting their adaptability to novel or unseen motions. To address this, we propose a method that effectively decomposes part-wise motion priors that significantly enhances generalization to the novel scenarios.

## 2.3 Part-Wise Motion Combination

Physically-based animation often requires motion capture data to train an agent for reasonable training efficiency and motion fidelity. To further expand the diversity of generated motions, several works demonstrated combining part-wise motion skills [Bae et al. 2023; Xu et al. 2023a]. These approaches lack hierarchical structures of motion priors and can only perform the original task for which they are trained. Another stream of works enforces low-level physical constraints, such as contact constraints [Khoshsiyar et al. 2024], but it is not generalizable to the other scenarios. In contrast, our method introduces a hierarchical framework for part-wise motion PLT: Part-Wise Latent Tokens as Adaptable Motion Priors for Physically Simulated Characters · 3

Fig. 2. Policy architecture of the discrete latent model. (a) During the imitation-learning phase, the joint architecture of encoder and low-level

<!-- image -->

## policy 𝜋low output action 𝑎 based on the current state 𝑠 and reference state ˜ 𝑠. Here, the vector quantization layer tokenizes the continuous latent vector

𝑦 into 𝑧. (b) In the task-learning phase, the high-level policy 𝜋high selects the appropriate index 𝑛 of the latent token from the pre-trained codebook.

combinations, where discrete latent tokens can be dynamically composed to discover task-adaptive skills. The structured motion prior may evolve incrementally, expanding the agent's motion repertoire with part-wise integrations of diverse datasets. Since our method explicitly uses a dedicated motion embedding for each body part, such a part-wise adaptation process is much more straightforward compared to the techniques that use whole-body latent priors [Won et al. 2020; Xu et al. 2023b]. Our findings resonate with the recent works in the robotics field [Liu et al. 2024; Wang et al. 2024b], which indicates that combinatorial motion skills can enhance task performance.

## 3 Background: Hierarchical Control with Discrete Prior

Hierarchical control pipelines provide a practical framework for learning and reusing motion skills from large datasets [Bohez et al. 2022; Merel et al. 2020]. The pipeline is composed of two phases. First, the imitation-learning phase acquires a latent space of motion priors by imitating a large collection of motion data. Second, the task-learning phase trains a task-specific reinforcement learning framework exploiting the hierarchical structure. The high-level policy from the task-learning phase samples a sequence of latent vectors, which are decoded into a sequence of actions with low-level policy using the decoder trained from the imitation-learning phase.

The use of a discrete action space in hierarchical control can benefit reinforcement learning. The latent motion embedding using a continuous vector space is subject to posterior collapse, making downstream tasks less effective, as addressed in a prior work [Peng et al. 2022]. While models like PULSE [Luo et al. 2023b] mitigate this issue by carefully tuning hyperparameters, such as KL-divergence scheduling and exploration rates, these adjustments are time-consuming and impractical for large-scale training. In contrast, discrete latent vectors, commonly used in image generation [Esser et al. 2021; Razavi et al. 2019; Van Den Oord et al. 2017] or video [Tan et al. 2021; Yu et al. 2022], naturally avoid such issues. They simplify the training process, alleviating extensive hyperparameter tuning, while maintaining high-quality representations. It reduces the complexity of the action selection process by limiting the number of possible actions, which simplifies exploration and optimization. Neural Categorical Prior (NCP) [Zhu et al. 2023] employs discrete latent space into a hierarchical control pipeline for motion generation. We first describe the policy architecture for the discrete latent model in NCP.

Figure 2 (a) depicts the imitation-learning phase. The encoder first outputs a continuous latent vector 𝑦 based on the current state 𝑠 and the reference future state ˜ 𝑠. The vector quantization (VQ) layer converts the continuous vector 𝑦 to a discrete one 𝑧 by finding the nearest neighbor token 𝑒 from the codebook B:

<!-- formula-not-decoded -->

To train the encoder and the codebook, the authors utilize commitment loss originated from VQ-VAE framework [Van Den Oord et al.

2017]:

<!-- formula-not-decoded -->

where sg(·) represents the stop-gradient operation. The low-level policy 𝜋low then computes the whole-body action vector 𝑎 using the latent token 𝑧 and the current state 𝑠.

During the subsequent task-learning phase (Figure 2 (b)), the task-specific high-level policy 𝜋high is trained by leveraging the motion priors. Here, the codebook and the parameters of low-level policy remain frozen, while the high-level policy substitutes the encoder. While the encoder in the imitation-learning phase outputs a continuous vector 𝑦, the high-level policy outputs categorical distribution over the indices of the discrete codebook, and samples an index 𝑛 of a latent token as 𝑧 = 𝑒𝑛.

Our Part-wise Latent Tokens (PLT) extend the latent structure as a set of discrete vectors to build highly adaptable motion prior for a simulated character. NCP has not been extensively validated on large-scale datasets or tested for generalization, leaving its broader applicability unverified. As noted in previous works on advanced quantization techniques [Mentzer et al. 2023; Yu et al. 2023], simply increasing the codebook size does not guarantee NCP to improve the fidelity of the latent representation. In contrast, our method explicitly combines part-wise latent tokens, which significantly improves robustness and adaptability of the policies. We further modify the training process in NCP to enhance scalability. Between the imitation and task-learning stages, NCP introduces a prior-shifting stage, in which a prior network predicts token indices based only on the current state 𝑠. While this step tries to regularize the high-level policy, we observe that it limits the performance when scaling to large motion datasets. Our method eliminates this stage with only the imitation and task-learning phases.

## 4 Method

In this section, we describe a novel policy architecture to learn part-wise motion priors (Sec. 4.1, 4.2) and the training procedure (Sec. 4.3), respectively.

## 4.1 Part-wise Latent Tokens (PLT)

Our policy architecture decomposes latent motion priors into partwise components. The proposed policy design enforces the agent to learn latent tokens that focus on the motion dynamics of the individual body parts. We first divide body parts of the agent into 𝐾 groups, e.g. upper and lower bodies for 𝐾 = 2. We also spatially split

<!-- image -->

4 · Bae et al.

Fig. 3. Policy architecture of the part-wise latent token (PLT) model. (a) During the imitation-learning phase, we first spatially split the output of the encoder. Then, we employ multiple codebooks to extract latent token 𝑧𝑘 for each body part. A refinement network calculates continuous offset Δ𝑧 and split it into 𝐾 segments as {Δ𝑧𝑘 }𝐾 . Each part-wise refinement Δ𝑧𝑘 is applied to each latent token 𝑧𝑘 , and corresponding part-wise low-level policy 𝜋low,𝑘 computes actions 𝑎𝑘 subsequently. (b) In the task-learning phase, a high-level policy 𝜋high selects indices for latent tokens from the pretrained codebooks. (c) Our policy design allows part-wise adaptation by updating only the minimal set of parameters associated with the queried body part.

<!-- image -->

the latent vector into 𝐾 segments, which correspond to the divided body part. Extending the discrete latent model (Sec. 3), our policy architecture employs 𝐾 codebooks {B𝑘 }𝐾 and corresponding lowlevel policies {𝜋low,𝑘 }𝐾 , respectively. During the imitation-learning phase, the encoder splits its output 𝑦 into 𝐾 segments {𝑦𝑘 }𝐾 . Similar to Eq. (1), we map each continuous latent vector 𝑦𝑘 to the nearest latent token 𝑧𝑘 in the corresponding codebook:

<!-- formula-not-decoded -->

To train all the codebooks simultaneously, we modify the commitment loss (Eq. (2)) as follows:

<!-- formula-not-decoded -->

After the quantization, the low-level policy 𝜋low,𝑘 predicts bodyspecific actions 𝑎𝑘 based on the latent token 𝑧𝑘 and the full-body state 𝑠. Each action 𝑎𝑘 specifies proportional-derivative (PD) target positions for the actuators associated with the corresponding body part, such as the right shoulder and elbow joints for the right arm. Our spatially splitting strategy of latent representations enhances the expressiveness of decoded motion and enables the imitation policy to effectively track unseen targets. This approach aligns with the findings of Group-RVQ [Yang et al. 2023], where spatially splitting latent vectors and quantizing them with separate codebooks improve code efficiency.

In the task-learning phase, we freeze the parameters of the codebooks and the low-level polices to leverage the part-wise motion priors. Then, we train a unified high-level policy 𝜋high using multidiscrete action space. The high-level policy outputs multiple categorical distributions, each representing the probabilities of latent tokens in a corresponding codebook. We sample 𝐾 indices {𝑛𝑘 }𝐾 from these distributions to retrieve appropriate tokens from the pretrained codebooks as 𝑧𝑘 = 𝑒𝑘,𝑛𝑘 . Therefore, the agent can experience novel combinations of part-wise motion prior during the exploration, which leads significant gain in the task performance.

## 4.2 Refinement Network

In addition to the Part-wise Latent Tokens (PLT), we introduce a refinement network to complement the discrete vector with a continuous refinement vector Δ𝑧 and maintain whole-body consistency. While PLT improves motion diversity and task performance, simply combining part motions may lack global coordination. The sampled motion sometimes introduces jerky artifacts or degrade adaptability during balance-critical scenarios. The refinement network outputs a continuous vector Δ𝑧, given the concatenated latent tokens (𝑧1, 𝑧2, · · · , 𝑧𝐾) and the current state 𝑠. The refinement Δ𝑧 is split into segments {Δ𝑧𝑘 }𝐾 , each serving as an offset to its corresponding latent token as ˆ 𝑧𝑘 = 𝑧𝑘 +Δ𝑧𝑘 . Low-level policy 𝜋low,𝑘 then calculates action based on the refined token ˆ 𝑧𝑘 and the current state 𝑠. To allow only minimal modifications, we introduce a refinement loss term:

<!-- formula-not-decoded -->

This loss encourages the refinement network to predict subtle adjustments, ensuring smoother and more adaptable motions without sacrificing part-wise flexibility. From the ablated studies, we find this adjustment broadly helps combine part-wise latent tokens by enhancing the physical stability. We illustrate the overall policy architecture in Figure 3 (a) and (b).

## 4.3 Training

Imitation-Learning Phase. Rather using DRL, we utilize the online distillation pipeline [Luo et al. 2023b] to train the imitation policy. Conventional DRL algorithms often suffer from sample inefficiency and instability due to the complexity of its optimization process, which involves intricate loss terms. These challenges are further exacerbated when training policies that rely on latent space regularization, as additional terms are required to manage and structure the latent space effectively. In contrast, online distillation offers a more stable and efficient framework by simplifying the optimization process. This simplification leads to better convergence and more reliable policy as training outcomes. The process begins by training an expert policy 𝜋expert using PPO [Schulman et al. 2017]. Notably, the expert policy does not involve latent space regularization, allowing it to be stably trained with the conventional DRL algorithm. The expert policy then guides the training of a student policy by providing trajectories generated through the student's own exploration. For our method, the student policy corresponds to our PLT model, which primarily minimizes the action loss Laction:

<!-- image -->

<!-- formula-not-decoded -->

To adapt the loss formulation from PULSE [Luo et al. 2023b] to our approach, we incorporate additional terms tailored to PLT model. Specifically, we include the commitment loss Lcommit (Eq. (4)) and refinement loss Lrefine (Eq. (5)):

<!-- formula-not-decoded -->

Here, we also integrate the regularization term Lreg, which ensures temporal smoothness in latent vectors, as described in [Luo et al. 2023b]. We provide further details including structure of expert policy in Appendix.

Task-Learning Phase. Our method maintains light-weight training scheme for the high-level policy (Sec. 3). We use PPO [Schulman et al. 2017] to train the discrete high-level policy 𝜋high as described in Sec. 3. Along with the codebooks and low-level polices, we fix the parameters of refinement network during the task-learning phase. Unlike to NCP [Zhu et al. 2023], our high-level policy uses multi-discrete action space, each corresponding to the index of partwise latent token. For each task, we define the task-specific goal observation 𝑔 and goal-related rewards without extensive tuning.

Part-Wise Adaptation. We propose a scalable approach to adapt motion priors in a continual and spatially localized manner, enabling the combination of multiple datasets. Since our agent uses explicitly decomposed priors for body parts, we can update only the motion priors related to a specific body part. For instance, when modifying the motion style of the first body segment (Figure 3 (c)), we update only the parameters of the first codebook B1 and the corresponding low-level policy 𝜋low,1. Additionally, we unfreeze the first layer of the refinement network, which we find that it empirically stabilizes the training process. We use PPO to perform this adaptation, as training an expert policy for such a mixed motion setting is nontrivial. This approach is particularly useful for animators who need to refine motion styles for specific body parts without affecting others. Furthermore, we observe that the agent retains a significant portion of its previous motion priors after adaptation, ensuring both flexibility and continuity in its motion capabilities.

## 5 Implementation

Dataset. We use three motion datasets for training and evaluation: LaFAN1 [Harvey et al. 2020], AMASS [Mahmood et al. 2019], and the Assassin dataset. LaFAN1 provides 2.9 hours of high-quality training motions, including balance-critical actions like sprints, jumps, and transitions. On the other hand, AMASS offers a larger dataset with 40 hours of training motions, prioritizing variety over dynamics but predominantly featuring simpler motions like walking or running. Following PHC [Luo et al. 2023a], we filter out invalid motions (e.g., stair climbing) for physically simulated agents. The Assassin dataset, a custom dataset from ActorCore [Reallusion 2025], contains

46 stylized sequences (5 minutes total) of assassin-like movements (e.g., crouching, side-stepping) and is used for out-of-distribution evaluation and part-wise adaptation experiments.

Baselines. To evaluate our model, we compare PLT with two state-of-the-art baselines: PULSE [Luo et al. 2023b] and NCP [Zhu et al. 2023], representing continuous and discrete latent models, respectively. Due to differences in training pipelines and humanoid models, direct comparisons with respective released codebases are non-trivial. We address this by synchronizing all baselines in two unified environments, one for LaFAN1 and Assassin, and another for AMASS. For LaFAN1, we re-implement PULSE and NCP to standardize the training setup, fine-tuning hyperparameters like loss weights for fair comparison. For AMASS, we directly use the original PULSE codebase and implement our PLT model alongside it for evaluation under consistent criteria.

Training Details. We train agents using Isaac Gym [Makoviychuk et al. 2021], a GPU-accelerated simulator supporting parallel training, with both low-level and high-level policies running at 30 Hz. For LaFAN1, we use the AMP humanoid [Peng et al. 2021] with 28 degrees of freedom (DoF), and for AMASS, we use the SMPL-based humanoid [Luo et al. 2023b] with 69 DoF. All reference motions are retargeted to their respective humanoid models for consistency. Our method supports three body partitioning modes: (1) PLT-1 (single, non-partitioned group), (2) PLT-2 (upper and lower body groups), and (3) PLT-5 (trunk, two arms, and two legs). We note NCP is equivalent to PLT-1 without the refinement network. For fairness, we allocate the same number of parameters for codebook tokens across all configurations. We incorporate RVQ [Lee et al. 2022; Zeghidour et al. 2021] as an advanced VQ layer for NCP and PLT. Consistent with prior works [Guo et al. 2024; Yao et al. 2024], RVQ improves imitation quality over conventional VQ [Van Den Oord et al. 2017]. The high-level policy predicts token indices only in the first RVQ codebook, as most information is concentrated in its first layer [Yang et al. 2023]. Additional details, including RL hyperparameters and codebook configurations, are provided in Appendix.

## 6 Experiments

In this section, we demonstrate the effectiveness of the proposed PLT model. We showcase the robustness of our imitation policy (Sec. 6.1), and the improved task performance and adaptability across diverse downstream tasks (Sec. 6.2), subsequently. Lastly, we present the results of the part-wise adaptation (Sec. 6.3). We include additional samples in the supplementary video. We also provide ablation studies, such as the difference between the vector quantization methods or a number of codebook tokens, and the different body part configurations (e.g. PLT-2 with right and left bodies) in Appendix.

## 6.1 Imitation-Learning Results

The imitation policy trained with our PLT model demonstrates exceptional robustness to unseen imitation targets. After the imitationlearning phase, we evaluate the tracking performance using four conventional metrics: Mean Per Joint Position Error (MPJPE) with the aligned root, MPJPE in a global coordinate system (G-MPJPE), root velocity error, and root acceleration error. For agents trained on LaFAN1 dataset, we assess imitation accuracy on unseen trajectories randomly sampled from three datasets. These include LaFAN1 test split as a held-out set and two out-of-distribution datasets: AMASS and the Assassin dataset. To compute the metrics, we use 8192 trajectories, each tracking 4-second reference motions independently.

Table 1. Evaluation on full-body tracking using imitation policy. We train all the models with LaFAN1 [Harvey et al. 2020] train set, and measure their ability to track unseen targets. We additionally include AMASS [Mahmood et al. 2019] and Assassin datasets to compare the generalizability toward out-of-distribution samples. We use conventional metrics including local and global pose errors (MPJPE, G-MPJPE) and root trajectory errors (velocity error, acceleration error). We also compare our ablated models with different number of body groups (PLT-K) and without refinement network (PLT-5-noR).

| Dataset - Metrics   |   LaFAN1 [Harvey et al. 2020] - MPJPE ↓ |   LaFAN1 [Harvey et al. 2020] - G-MPJPE ↓ |   LaFAN1 [Harvey et al. 2020] - Vel E. ↓ |   LaFAN1 [Harvey et al. 2020] - Accel E. ↓ |   AMASS [Mahmood et al. 2019] - MPJPE ↓ |   AMASS [Mahmood et al. 2019] - G-MPJPE ↓ |   AMASS [Mahmood et al. 2019] - Vel E. ↓ |   AMASS [Mahmood et al. 2019] - Accel E. ↓ |   Assassin - MPJPE ↓ |   Assassin - G-MPJPE ↓ |   Assassin - Vel E. ↓ |   Assassin - Accel E. ↓ |
|---------------------|-----------------------------------------|-------------------------------------------|------------------------------------------|--------------------------------------------|-----------------------------------------|-------------------------------------------|------------------------------------------|--------------------------------------------|----------------------|------------------------|-----------------------|-------------------------|
| PULSE               |                                   64.13 |                                     113.5 |                                    13.34 |                                      9.105 |                                   76.09 |                                     137.4 |                                    10.35 |                                      6.493 |                100.8 |                  175.6 |                 12.86 |                   8.544 |
| NCP                 |                                   61.00 |                                     112.2 |                                    13.06 |                                      8.902 |                                   65.53 |                                     120.3 |                                    9.500 |                                      5.982 |                91.04 |                  153.4 |                 11.89 |                   8.155 |
| PLT-2               |                                   55.33 |                                     94.09 |                                    12.12 |                                      8.419 |                                   60.28 |                                     107.3 |                                    8.713 |                                      5.462 |                77.51 |                  122.7 |                 10.74 |                   7.540 |
| PLT-5               |                                   55.41 |                                     92.78 |                                    11.90 |                                      8.157 |                                   61.01 |                                     106.0 |                                    8.523 |                                      5.247 |                76.04 |                  123.1 |                 10.13 |                   6.961 |
| PLT-5-noR           |                                   58.59 |                                     104.6 |                                    12.48 |                                      8.403 |                                   59.07 |                                     103.1 |                                    8.446 |                                      5.271 |                93.07 |                  156.8 |                 11.53 |                   7.577 |

Table 2. Additional evaluation on imitation policies trained with AMASS [Mahmood et al. 2019] dataset. We leverage the training environment and humanoid model from the original codebase of PULSE [Luo et al. 2023b]. To ensure comparability, we also include the success rate metric as reported in the original results.

| Dataset - Metrics   |   AMASS-Test [Mahmood et al. 2019] - MPJPE ↓ |   AMASS-Test [Mahmood et al. 2019] - G-MPJPE ↓ |   AMASS-Test [Mahmood et al. 2019] - Vel E. ↓ |   AMASS-Test [Mahmood et al. 2019] - Accel E. ↓ |   AMASS-Test [Mahmood et al. 2019] - Success (%) ↑ |
|---------------------|----------------------------------------------|------------------------------------------------|-----------------------------------------------|-------------------------------------------------|----------------------------------------------------|
| PULSE               |                                        43.06 |                                          52.61 |                                         8.976 |                                           5.613 |                                              97.83 |
| PLT-2               |                                        30.56 |                                          40.47 |                                         7.390 |                                           5.017 |                                              97.83 |
| PLT-5               |                                        28.39 |                                          38.90 |                                         7.199 |                                           4.890 |                                              97.83 |
| PLT-5-noR           |                                        28.80 |                                          40.04 |                                         7.225 |                                           4.909 |                                              97.10 |

As shown in Table 1, our PLT model outperforms the two baselines (PULSE and NCP) in tracking accuracy. Furthermore, we observe that increasing the number of body parts enhances both motion quality and robustness, highlighting the benefits of our bodypartitioning strategy. The refinement network further improves tracking quality, as evidenced by the ablated model (PLT-5-noR), which performs poorly on balance-critical datasets like LaFAN1 and Assassin. We observe similar results in experiments with the larger AMASS dataset and a more complex humanoid model, as demonstrated in Table 2. In short, our novel policy design builds highly proficient motion priors, providing a strong foundation for diverse downstream tasks.

## 6.2 Task-Learning Results

𝑁-Body Tracking. To evaluate the effectiveness during the tasklearning phase, we consider the 𝑁 -body tracking problem, where an agent tracks sparsely chosen trackers. Following prior works [Luo et al. 2023b; Winkler et al. 2022], we generate synthetic tracker trajectories sampled from the motion capture dataset. Unlike fullbody imitation rewards, our reward terms and early termination conditions depend solely on the sparse trackers. This setup does not require full-body reference motion when training the high-level policy, such that we can evaluate the exploitation of motion prior for the task execution. Using the imitation policy pretrained on LaFAN1 dataset, we train high-level polices with LaFAN1 train set and evaluate their tracking performance on unseen trajectories from the test set. The evaluation uses the same full-body tracking metrics and number of trajectories as in Table 1. As shown in Table 3, our PLT model significantly outperforms the baselines in both motion quality (tracking metrics, e.g. MPJPE) and tracking accuracy (normalized return). As the number of trackers (𝑁) increases, introducing more complex constraints, the use of more body groups and the refinement network leads to notable improvements in the task performance. Notably, as illustrated in Figure 4, our model with 5 body parts reliably tracks rapidly moving targets while maintaining balance and naturalness. The 𝑁-body tracking results highlight the effectiveness of our part-wise approach in achieving robust task performance while faithfully preserving the motion patterns from the original dataset.

Point-Goal Navigation. For the point-goal navigation task, we train an agent to reach a specified goal on the ground as quickly as possible. In the plain setup where the agent navigates flat terrain, our partitioned body groups effectively combine part-wise skills to enhance stability and speed, as shown in Figure 5 (a). To test adaptability, we introduce a novel environment where the agent must navigate with a randomly damaged body, namely damaged point-goal navigation. During training, we randomly reduce the torque limits in the joints on one side of an arm and leg by 90-100%, creating 4096 distinct damage configurations across parallel environments. A unified policy is then trained to handle all configurations simultaneously. In this challenging setup, the advantages of our part-wise approach become more evident, as shown in Figure 5 (b). Notably, the model with the refinement network (PLT-5) significantly outperforms the model without it (PLT-5-noR), demonstrating improved physical stability and adaptability through enhanced body coordination. Figure 5 (c) shows a single policy discovering optimal movements for each damage configuration, often mirroring real-world compensatory behaviors.

Conventional Tasks with AMASS dataset. We demonstrate the feasibility and versatility of our model on a large-scale motion capture dataset by testing it on five conventional tasks from PULSE: VR-tracking (tracking head and hand targets), Reach (targeting arbitrary points), Strike (punching objects), Speed (following speed commands), and Terrain (navigating rough terrain with velocity commands). For these examples, we use AMASS dataset for the imitation-learning phase and construct motion priors. We compare the performance of our PLT model with the original PULSE model PLT: Part-Wise Latent Tokens as Adaptable Motion Priors for Physically Simulated Characters · 7

Fig. 4. Visualization of 𝑁-body tracking scenarios. (Top) NCP [Zhu et al. 2023] struggles to track rapidly moving targets, whereas our agent, partitioned into five body parts (PLT-5), achieves precise tracking while maintaining balance. (Bottom) Ablation studies demonstrate that finer partitioning in the PLT model leads to more accurate alignment with target trajectories.

<!-- image -->

Table 3. Evaluation on 𝑁-body tracking examples. We train agent with three different configurations of trackers, where tracker is attached to head (𝑁 = 1), trackers are attached to head, right hand, foot (𝑁 = 3) and trackers are attached to head, two hands and feet (𝑁 = 5). The imitation policies are equally trained with LaFAN1 [Harvey et al. 2020] train set. We sample the unseen target trajectories from test set, and employ the same metrics as Table 1. Additionally, we provide normalized return since this value indicates how the agent faithfully follows the given sparse targets.

| Dataset - Metrics   |   𝑁 = 1 - MPJPE ↓ |   𝑁 = 1 - G-MPJPE ↓ |   𝑁 = 1 - Vel ↓ |   𝑁 = 1 - Accel ↓ |   𝑁 = 1 - Return ↑ |   𝑁 = 3 - MPJPE ↓ |   𝑁 = 3 - G-MPJPE ↓ |   𝑁 = 3 - Vel ↓ |   𝑁 = 3 - Accel ↓ |   𝑁 = 3 - Return ↑ |   𝑁 = 5 - MPJPE ↓ |   𝑁 = 5 - G-MPJPE ↓ |   𝑁 = 5 - Vel ↓ |   𝑁 = 5 - Accel ↓ |   𝑁 = 5 - Return ↑ |
|---------------------|-------------------|---------------------|-----------------|-------------------|--------------------|-------------------|---------------------|-----------------|-------------------|--------------------|-------------------|---------------------|-----------------|-------------------|--------------------|
| PULSE               |             185.6 |               209.8 |           27.94 |             21.48 |              0.882 |             116.2 |               166.0 |           21.93 |             16.33 |              0.602 |             71.91 |               160.3 |           17.73 |             12.34 |              0.414 |
| NCP                 |             126.9 |               153.5 |           23.51 |             13.51 |              0.827 |             86.51 |               131.3 |           18.51 |             11.67 |              0.525 |             65.91 |               127.8 |           16.42 |             10.77 |              0.387 |
| PLT-2               |             123.2 |               146.1 |           22.83 |             13.38 |              0.876 |             80.50 |               115.5 |           16.94 |             11.24 |              0.638 |             55.69 |               102.4 |           14.25 |             10.29 |              0.510 |
| PLT-5               |             125.4 |               144.6 |           23.79 |             15.34 |              0.894 |             79.10 |               104.2 |           16.75 |             11.91 |              0.702 |             50.87 |               84.76 |           12.91 |             10.44 |              0.596 |
| PLT-5-noR           |             137.4 |               157.7 |           24.31 |             15.59 |              0.909 |             82.15 |               116.9 |           17.43 |             12.58 |              0.715 |             59.31 |               95.48 |           13.79 |             10.97 |              0.586 |

across all tasks. In addition to the original tasks, we slightly modify the VR-tracking example to further assess the effectiveness of our model when the rewards are sparsely given. While the original VR-tracking environment employs full-body imitation rewards, we introduce a variant where rewards and termination conditions only account for the errors between sparse trackers and the corresponding body parts. The training curves for all tasks are shown in Figure 6. In the VR-tracking task with full-body imitation rewards (Figure 6 (a)), PULSE demonstrates superior tracking performance. However, in the sparsely rewarded VR-tracking task (Figure 6 (b)), our PLT model achieves better tracking ability. This result underscores the strength of our approach in scenarios that align with the core objective of task-learning: efficiently reusing pretrained motion priors without depending on full-body imitation rewards. For the remaining tasks (Figure 6 (c-f)), our PLT model consistently outperforms PULSE, demonstrating its robustness and scalability on a large-scale dataset.

## 6.3 Part-Wise Adaptation Results

As described in Sec. 4.3, PLT lets animators combine motion datasets efficiently without relying on predefined full-body databases. We demonstrate this with a two-step adaptation example. First, the agent is pretrained on LaFAN1 dataset, then adapted to Assassin dataset for lower-body motion, and BML Handball dataset [Helm et al. 2015] for upper-body motion. To qualitatively verify the effectiveness of motion combination, we constrain LaFAN1 dataset to aiming motions in adaptation phase, as LaFAN1 already includes diverse body movements. As shown in Figure 1, the simulated character successfully integrates different motions into cohesive, natural full-body movements. Additional samples, such as combining two distinct dance styles, are included in the supplementary video.

8 · Bae et al.

Fig. 5. Results from the navigation task. (a) For the plain point-goal navigation task, agents with more partitioned body parts reach the goal faster and achieve

<!-- image -->

higher returns. (b) When joints are randomly damaged, the five-part agent (PLT-5) demonstrates superior performance by effectively utilizing part-wise

motion priors for limbs. (c) The trained single policy adapts seamlessly to different body damage configurations, enabling optimal movements toward the goal.

Fig. 6. Task-learning results for agents trained with the AMASS [Mahmood et al. 2019] dataset. We evaluate task performance across all downstream tasks introduced by PULSE [Luo et al. 2023b], along with two types of VR tracking tasks: (a) one with full-body imitation rewards and (b) another with sparse tracking rewards calculated based on the alignment only between trackers and corresponding body parts. PULSE outperforms PLT with full-body imitation rewards, while PLT shows superior performance with sparse rewards. In all other generative tasks (c-f), our agent achieves better task performance than PULSE.

<!-- image -->

PLT: Part-Wise Latent Tokens as Adaptable Motion Priors for Physically Simulated Characters · 9

Fig. 7. Evaluation of part-wise adaptation in a continual manner. Starting with motion priors pretrained on the LaFAN1 [Harvey et al. 2020] dataset, we perform a two-step adaptation: (1) updating lower-body motion priors to adopt assassin-like movements and (2) incrementally adapting upper-body motions to imitate those in the BML Handball dataset [Helm et al. 2015]. To measure the tracking ability of the imitation policy, we report the normalized return calculated from full-body imitation reward. (a) Compared to training from scratch (Scratch), our agent with 5 body parts (Adapt) achieves comparable performance on the combined dataset while avoiding catastrophic forgetting on the original dataset (Dataset A). Additionally, we compare with an ablated model (Adapt-NoR) that excludes the refinement network, showing that the refinement network provides improved imitation quality. (b) After completing whole steps for two-step adaptation, we find that higher part granularity improves adaptation, as shown by better performance with five parts (Adapt-5) compared to two parts (Adapt-2).

<!-- image -->

Compared to training from scratch on combined datasets, our part-wise adaptation offers two key advantages. First, adaptation requires only a few hours of training on an RTX 3090, as it updates significantly fewer parameters. This efficiency allows for repeated and continual refinement of motion priors. Second, the adapted model retains reasonable fidelity to the original dataset, as shown in Figure 7 (a). We attribute this to our efficient update scheme, where non-updated part-wise latent tokens and low-level policies remain unchanged. Also, we additionally observe that the refinement network contributes to the better adaptation result.

We further evaluate the impact of body partitioning by comparing models with two body parts (PLT-2) and five body parts (PLT-5), as shown in Figure 7 (b). For PLT-5, we update the motion priors of the legs during the lower-body adaptation phase, and the trunk and arms during the upper-body adaptation phase, respectively. The results indicate that increasing the granularity of body partitioning enhances the adaptability and quality of the adapted motions.

## 7 Conclusion

This work introduces a novel policy architecture that leverages part-wise latent tokens to enhance motion fidelity, adaptability, and scalability in physically-based animation. By decomposing motion priors into part-specific codebooks, our method dynamically combines part-wise latent tokens to generate diverse and task-optimal motions. This approach addresses limitations in whole-body motion representations, enabling more efficient and generalizable solutions compared to existing methods. The inclusion of a refinement network further ensures coherence across body parts, mitigating issues like unstable motions observed in naïve part-wise combinations.

Through extensive experiments, we demonstrate the effectiveness of our model across a wide range of scenarios. In the imitationlearning phase, our PLT model outperforms state-of-the-art baselines in tracking accuracy and robustness, even when tested on out-of-distribution targets. During task-learning, our approach exhibits superior performance in challenging environments, including 𝑁 -body tracking and point-goal navigation with damaged body configurations. Additionally, our method demonstrates scalability on the large-scale AMASS dataset and excels in tasks like striking and navigating rough terrain. We also highlight the flexibility of our partwise motion priors with a novel adaptation pipeline that supports incremental updates to specific body parts without compromising previously learned motions. This capability unlocks new possibilities for combining motion styles, liberating physics-based animation from the constraints of predefined full-body motion datasets.

Limitations. While our method provides a versatile framework for complex motion tasks, it has certain limitations. First, our approach relies on manually defined body decompositions. Although we show that a five-part configuration generally outperforms a two-part configuration, the optimal setup may vary depending on the task. One may benefit from an automatic partitioning strategy to identify the most effective configurations with more complex humanoid models. Second, using separate codebooks and low-level policies for each body part can create redundancies, such as duplicating skill priors for both arms, which unnecessarily increases the parameter count. We could address this by exploring shared codebook systems, as suggested in prior work [Li et al. 2024]. For future applications, we can further explore utilizing the part-wise latent token across broader domains such as multi-agent scenarios or real-time control applications.

## Acknowledgments

This work was supported by the National Research Foundation of Korea(NRF) grant funded by the Korea government(MSIT) (No. RS-2023-00208197 and RS-2023-00218601).

## References

- Jinseok Bae, Jungdam Won, Donggeun Lim, Cheol-Hui Min, and Young Min Kim. 2023. Pmp: Learning to physically interact with environments using part-wise motion priors. In ACM SIGGRAPH 2023 Conference Proceedings. 1-10.
- Steven Bohez, Saran Tunyasuvunakool, Philemon Brakel, Fereshteh Sadeghi, Leonard Hasenclever, Yuval Tassa, Emilio Parisotto, Jan Humplik, Tuomas Haarnoja, Roland Hafner, et al. 2022. Imitate and repurpose: Learning reusable robot movement skills from human and animal behaviors. arXiv preprint arXiv:2203.17138 (2022).
- Xin Chen, Biao Jiang, Wen Liu, Zilong Huang, Bin Fu, Tao Chen, and Gang Yu. 2023. Executing your commands via motion diffusion in latent space. In Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition. 18000-18010.
- Patrick Esser, Robin Rombach, and Bjorn Ommer. 2021. Taming transformers for highresolution image synthesis. In Proceedings of the IEEE/CVF conference on computer vision and pattern recognition. 12873-12883.
- Levi Fussell, Kevin Bergamin, and Daniel Holden. 2021. Supertrack: Motion tracking for physically simulated characters using supervised learning. ACM Transactions on Graphics (TOG) 40, 6 (2021), 1-13.
- Chuan Guo, Yuxuan Mu, Muhammad Gohar Javed, Sen Wang, and Li Cheng. 2024. Momask: Generative masked modeling of 3d human motions. In Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition. 1900-1910.
- Lei Han, Qingxu Zhu, Jiapeng Sheng, Chong Zhang, Tingguang Li, Yizheng Zhang, He Zhang, Yuzhen Liu, Cheng Zhou, Rui Zhao, et al. 2024. Lifelike agility and play in quadrupedal robots using reinforcement learning and generative pre-trained models. Nature Machine Intelligence 6, 7 (2024), 787-798.
- Félix G. Harvey, Mike Yurick, Derek Nowrouzezahrai, and Christopher Pal. 2020. Robust Motion In-Betweening. 39, 4 (2020).
- Mohamed Hassan, Yunrong Guo, Tingwu Wang, Michael Black, Sanja Fidler, and Xue Bin Peng. 2023. Synthesizing physical character-scene interactions. In ACM SIGGRAPH 2023 Conference Proceedings. 1-9.
- Fabian Helm, Nikolaus Troje, Mathias Reiser, and Jörn Munzert. 2015. Bewegungsanalyse getäuschter und nicht-getäuschter 7m-Würfe imHandball. 47. Jahrestagung der Arbeitsgemeinschaft für Sportpsychologie, Freiburg.
- Niloofar Khoshsiyar, Ruiyu Gou, Tianhong Zhou, Sheldon Andrews, and M van de Panne. 2024. PartwiseMPC: Interactive Control of Contact-Guided Motions. In Computer Graphics Forum, Vol. 43. Wiley Online Library, e15174.
- Diederik P Kingma. 2013. Auto-encoding variational bayes. arXiv preprint arXiv:1312.6114 (2013).
- Doyup Lee, Chiheon Kim, Saehoon Kim, Minsu Cho, and Wook-Shin Han. 2022. Autoregressive image generation using residual quantization. In Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition. 11523-11532.
- Peizhuo Li, Sebastian Starke, Yuting Ye, and Olga Sorkine-Hornung. 2024. WalkTheDog: Cross-Morphology Motion Alignment via Phase Manifolds. In ACM SIGGRAPH 2024 Conference Papers. 1-10.
- Hung Yu Ling, Fabio Zinno, George Cheng, and Michiel Van De Panne. 2020. Character controllers using motion vaes. ACM Transactions on Graphics (TOG) 39, 4 (2020), 40-1.
- Qi Liu, Jingxiang Guo, Sixu Lin, Shuaikang Ma, Jinxuan Zhu, and Yanjie Li. 2024. MASQ: Multi-Agent Reinforcement Learning for Single Quadruped Robot Locomotion. arXiv preprint arXiv:2408.13759 (2024).
- Zhengyi Luo, Jinkun Cao, Kris Kitani, Weipeng Xu, et al. 2023a. Perpetual humanoid control for real-time simulated avatars. In Proceedings of the IEEE/CVF International Conference on Computer Vision. 10895-10904.
- Zhengyi Luo, Jinkun Cao, Josh Merel, Alexander Winkler, Jing Huang, Kris Kitani, and Weipeng Xu. 2023b. Universal humanoid motion representations for physics-based control. arXiv preprint arXiv:2310.04582 (2023).
- Naureen Mahmood, Nima Ghorbani, Nikolaus F. Troje, Gerard Pons-Moll, and Michael J. Black. 2019. AMASS: Archive of Motion Capture as Surface Shapes. In International Conference on Computer Vision. 5442-5451.
- Viktor Makoviychuk, Lukasz Wawrzyniak, Yunrong Guo, Michelle Lu, Kier Storey, Miles Macklin, David Hoeller, Nikita Rudin, Arthur Allshire, Ankur Handa, et al. 2021. Isaac gym: High performance gpu-based physics simulation for robot learning. arXiv preprint arXiv:2108.10470 (2021).
- Ian Mason, Sebastian Starke, and Taku Komura. 2022. Real-time style modelling of human locomotion via feature-wise transformations and local motion phases. Proceedings of the ACM on Computer Graphics and Interactive Techniques 5, 1 (2022), 1-18.
- Fabian Mentzer, David Minnen, Eirikur Agustsson, and Michael Tschannen. 2023. Finite scalar quantization: Vq-vae made simple. arXiv preprint arXiv:2309.15505 (2023).
- Josh Merel, Leonard Hasenclever, Alexandre Galashov, Arun Ahuja, Vu Pham, Greg Wayne, Yee Whye Teh, and Nicolas Heess. 2018. Neural probabilistic motor primitives for humanoid control. arXiv preprint arXiv:1811.11711 (2018).
- Josh Merel, Saran Tunyasuvunakool, Arun Ahuja, Yuval Tassa, Leonard Hasenclever, Vu Pham, Tom Erez, Greg Wayne, and Nicolas Heess. 2020. Catch &amp; carry: reusable neural controllers for vision-guided whole-body tasks. ACM Transactions on Graphics (TOG) 39, 4 (2020), 39-1.
- Xue Bin Peng, Pieter Abbeel, Sergey Levine, and Michiel van de Panne. 2018. DeepMimic: Example-guided Deep Reinforcement Learning of Physics-based Character Skills. ACM Trans. Graph. 37, 4, Article 143 (July 2018), 14 pages. doi:10.1145/3197517. 3201311
- Xue Bin Peng, Yunrong Guo, Lina Halper, Sergey Levine, and Sanja Fidler. 2022. Ase: Large-scale reusable adversarial skill embeddings for physically simulated characters. ACM Transactions On Graphics (TOG) 41, 4 (2022), 1-17.
- Xue Bin Peng, Ze Ma, Pieter Abbeel, Sergey Levine, and Angjoo Kanazawa. 2021. Amp: Adversarial motion priors for stylized physics-based character control. ACM Transactions on Graphics (ToG) 40, 4 (2021), 1-20.
- Ali Razavi, Aaron Van den Oord, and Oriol Vinyals. 2019. Generating diverse highfidelity images with vq-vae-2. Advances in neural information processing systems 32 (2019).
- Reallusion. 2025. ActorCore Motion Dataset. https://actorcore.reallusion.com/
- John Schulman, Filip Wolski, Prafulla Dhariwal, Alec Radford, and Oleg Klimov. 2017. Proximal policy optimization algorithms. arXiv preprint arXiv:1707.06347 (2017).
- Hao Tan, Jie Lei, Thomas Wolf, and Mohit Bansal. 2021. Vimpac: Video pre-training via masked token prediction and contrastive learning. arXiv preprint arXiv:2106.11250 (2021).
- Guy Tevet, Sigal Raab, Brian Gordon, Yoni Shafir, Daniel Cohen-or, and Amit Haim Bermano. 2023. Human Motion Diffusion Model. In The Eleventh International Conference on Learning Representations. https://openreview.net/forum?id=SJ1kSyO2jwu
- Aaron Van Den Oord, Oriol Vinyals, et al. 2017. Neural discrete representation learning. Advances in neural information processing systems 30 (2017).
- JiashunWang, Jessica Hodgins, and JungdamWon. 2024a. Strategy and skill learning for physics-based table tennis animation. In ACM SIGGRAPH 2024 Conference Papers. 1-11.
- Yuliu Wang, Ryusuke Sagawa, and Yusuke Yoshiyasu. 2024b. Learning Advanced Locomotion for Quadrupedal Robots: A Distributed Multi-Agent Reinforcement Learning Framework with Riemannian Motion Policies. Robotics 13, 6 (2024), 86.
- Alexander Winkler, JungdamWon, and Yuting Ye. 2022. Questsim: Human motion tracking from sparse sensors with simulated avatars. In SIGGRAPH Asia 2022 Conference Papers. 1-8.
- JungdamWon, Deepak Gopinath, and Jessica Hodgins. 2020. A scalable approach to control diverse behaviors for physically simulated characters. ACM Transactions on Graphics (TOG) 39, 4 (2020), 33-1.
- JungdamWon, Deepak Gopinath, and Jessica Hodgins. 2022. Physics-based character controllers using conditional vaes. ACM Transactions on Graphics (TOG) 41, 4 (2022), 1-12.
- Pei Xu, Xiumin Shang, Victor Zordan, and Ioannis Karamouzas. 2023a. Composite motion learning with task control. ACM Transactions on Graphics (TOG) 42, 4 (2023), 1-16.
- Pei Xu, Kaixiang Xie, Sheldon Andrews, Paul G Kry, Michael Neff, Morgan McGuire, Ioannis Karamouzas, and Victor Zordan. 2023b. Adaptnet: Policy adaptation for physics-based character control. ACM Transactions on Graphics (TOG) 42, 6 (2023), 1-17.
- Dongchao Yang, Songxiang Liu, Rongjie Huang, Jinchuan Tian, Chao Weng, and Yuexian Zou. 2023. Hifi-codec: Group-residual vector quantization for high fidelity audio codec. arXiv preprint arXiv:2305.02765 (2023).
- Heyuan Yao, Zhenhua Song, Baoquan Chen, and Libin Liu. 2022. Controlvae: Modelbased learning of generative controllers for physics-based characters. ACM Transactions on Graphics (TOG) 41, 6 (2022), 1-16.
- Heyuan Yao, Zhenhua Song, Yuyang Zhou, Tenglong Ao, Baoquan Chen, and Libin Liu. 2024. Moconvq: Unified physics-based motion control via scalable discrete representations. ACM Transactions on Graphics (TOG) 43, 4 (2024), 1-21.
- Lijun Yu, Yong Cheng, Kihyuk Sohn, José Lezama, Han Zhang, Huiwen Chang, Alexander G Hauptmann, Ming-Hsuan Yang, Yuan Hao, Irfan Essa, et al. 2022. MAGVIT: Masked Generative Video Transformer. arXiv (2022). (2022).
- Lijun Yu, José Lezama, Nitesh B Gundavarapu, Luca Versari, Kihyuk Sohn, David Minnen, Yong Cheng, Vighnesh Birodkar, Agrim Gupta, Xiuye Gu, et al. 2023. Language Model Beats Diffusion-Tokenizer is Key to Visual Generation. arXiv preprint arXiv:2310.05737 (2023).
- Neil Zeghidour, Alejandro Luebs, Ahmed Omran, Jan Skoglund, and Marco Tagliasacchi. 2021. Soundstream: An end-to-end neural audio codec. IEEE/ACM Transactions on Audio, Speech, and Language Processing 30 (2021), 495-507.
- Haotian Zhang, Ye Yuan, Viktor Makoviychuk, Yunrong Guo, Sanja Fidler, Xue Bin Peng, and Kayvon Fatahalian. 2023. Learning Physically Simulated Tennis Skills from Broadcast Videos. ACM Trans. Graph. 42, 4, Article 95 (jul 2023), 14 pages. doi:10.1145/3592408
- Qingxu Zhu, He Zhang, Mengting Lan, and Lei Han. 2023. Neural categorical priors for physics-based character control. ACM Transactions on Graphics (TOG) 42, 6 (2023), 1-16.