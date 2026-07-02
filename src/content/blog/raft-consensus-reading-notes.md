---
title: "Raft Consensus 共识算法外文资料阅读与翻译笔记"
description: "参考 Raft 官方站点、原始论文和可视化资料，整理 Raft 的核心思想、术语翻译和实现视角。"
pubDate: "Jul 01 2026"
badge: "Notes"
tags: ["Raft", "Consensus"]
---

参考文章：

1. [The Raft Consensus Algorithm](https://raft.github.io/)
2. [In Search of an Understandable Consensus Algorithm](https://raft.github.io/raft.pdf)
3. [The Secret Lives of Data: Raft](https://thesecretlivesofdata.com/raft/)

## 一句话理解 Raft

Raft 是一个分布式共识算法，用来让多台机器在可能宕机、网络延迟或消息丢失的情况下，对同一串日志达成一致。

如果把一个分布式系统想成“多台机器一起维护同一个状态机”，那么 Raft 解决的问题就是：每台机器最终都以相同顺序执行相同命令，这样它们得到的状态也会一致。

## 原文核心意思的转译

官方介绍里强调，Raft 的目标不是提出一个比 Paxos 更强的新模型，而是把共识问题拆得更容易理解。它和 Paxos 在容错能力、性能目标上相近，但组织方式不同。

可以这样翻译：

> Raft 是一种为了易于理解而设计的共识算法。它把共识拆成几个相对独立的问题，比如领导者选举、日志复制和安全性约束，因此更适合讲解和实现。

论文里的主线也很清楚：Raft 先选出一个 leader，然后把复制日志的主要责任交给 leader。客户端请求先到 leader，leader 把命令追加到自己的日志里，再复制给 follower。只要多数节点确认复制成功，这条日志就可以提交。

## 三个角色

Raft 里的节点有三种状态：

| 英文 | 中文 | 作用 |
| --- | --- | --- |
| Leader | 领导者 | 处理客户端请求，负责复制日志 |
| Follower | 跟随者 | 响应 leader 和 candidate 的 RPC |
| Candidate | 候选人 | 在超时后发起选举，争取成为 leader |

正常情况下，一个 term 里最多只有一个 leader。其他节点都是 follower。如果 follower 一段时间没有收到 leader 的 heartbeat，就会认为 leader 可能挂了，然后切到 candidate 状态发起选举。

## 领导者选举

Raft 用 term 来描述逻辑时间。每次选举都会进入一个新的 term。

大致流程是：

1. follower 等待 leader 的 heartbeat。
2. 如果 election timeout 到期还没收到 heartbeat，它变成 candidate。
3. candidate 先给自己投票，然后向其他节点发送 RequestVote。
4. 如果拿到多数票，它成为 leader。
5. 如果选票分裂，等待随机超时后重新选举。

这里的随机 election timeout 很重要。它降低了多个节点同时发起选举的概率，也让 split vote 更容易快速恢复。

## 日志复制

leader 被选出来后，系统进入正常复制流程。

客户端提交命令时，leader 会先把命令写入自己的 log，然后通过 AppendEntries RPC 发给 follower。多数节点写入成功后，这条日志才算 committed。之后 leader 和 follower 都按日志顺序把命令应用到自己的状态机。

这背后的关键约束是：日志一旦提交，就不能被未来的 leader 覆盖掉。新 leader 上任后，会强制 follower 的日志向自己的日志收敛。这样即使旧 leader 崩溃前只复制了一部分日志，系统也能重新恢复一致。

## 安全性约束

Raft 的安全性可以理解成几条硬规则：

| 英文 | 中文理解 |
| --- | --- |
| Election Safety | 同一个 term 最多只能选出一个 leader |
| Leader Append-Only | leader 只追加日志，不覆盖或删除自己的旧日志 |
| Log Matching | 如果两个日志在同一 index 和 term 上相同，那么它们之前的日志也相同 |
| Leader Completeness | 已提交日志会出现在之后所有 leader 的日志中 |
| State Machine Safety | 同一位置上，不同节点不会应用不同命令 |

这些规则共同保证了一件事：只要某条命令被某个节点应用到状态机，其他节点以后在同一位置也只能应用同一条命令。

## Raft 不是万能的

Raft 处理的是非拜占庭故障：节点可能宕机、网络可能延迟、消息可能丢失，但默认节点不会恶意伪造协议消息。如果系统里存在恶意节点，就需要 Byzantine Fault Tolerance 这一类协议，而不是普通 Raft。

另外，Raft 依赖多数派。一个 5 节点集群可以容忍 2 个节点不可用；如果只剩 2 个节点，系统不会返回错误结果，但也无法继续提交新日志。

## 为什么它适合工程实现

Raft 的优势在于把复杂问题压进一个容易调试的结构里：

- 所有写请求都经过 leader，数据流方向清晰。
- follower 基本是被动角色，状态空间更小。
- 选举、复制、安全性可以分开理解和测试。
- 日志复制和状态机模型天然适合做 KV 存储、元数据服务和配置中心。

所以 etcd、TiKV、CockroachDB 等系统都会使用 Raft 或 Raft 风格的复制协议来维护一致性。

## 我的理解

学习 Raft 时不要一开始就陷入 RPC 细节。更好的顺序是：

1. 先理解“复制状态机”为什么需要同一串日志。
2. 再理解为什么必须有多数派。
3. 然后看 leader election 如何保证每个 term 只有一个 leader。
4. 最后再看 log matching 和 committed entry 如何保证旧数据不会被覆盖。

一句话总结：Raft 的核心不是“选主”，而是用一个强 leader 模型，让多台机器对同一串命令日志形成不可回退的多数派承诺。
