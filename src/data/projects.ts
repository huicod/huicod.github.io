export type Project = {
  title: string;
  desc: string;
  url: string;
  badge?: string;
  tags?: string[];
  featured?: boolean;
};

export const projects: Project[] = [
  {
    title: "review-service",
    desc: "基于 Go/Kratos 的电商评价微服务项目，按多仓库拆分业务服务、RPC 接口、数据存储和服务治理模块。",
    url: "https://github.com/huicod/review-service",
    badge: "New",
    tags: ["Go", "Kratos", "Microservices", "RPC", "E-commerce"],
    featured: true,
  },
  {
    title: "IM-build-on-basic",
    desc: "基于 Go 的即时通讯后端骨架，覆盖 WebSocket 网关、Kafka 消息链路、MySQL/Redis 存储和会话同步。",
    url: "https://github.com/huicod/IM-build-on-basic",
    badge: "New",
    tags: ["Go", "IM", "WebSocket", "Kafka", "Redis", "MySQL"],
    featured: true,
  },
  {
    title: "VibeCoding-Template",
    desc: "Cursor、codex适用的vibeCoding模板，用文件系统记忆、工作流约束和验证管线稳定 Vibe Coding 流程。",
    url: "https://github.com/huicod/VibeCoding-Template",
    badge: "New",
    tags: ["JavaScript", "AI Coding", "Template", "Workflow", "Agents"],
    featured: true,
  },
  {
    title: "llm-model-merging-thesis",
    desc: "A cleaned research workflow for LLM model-merging experiments and thesis reproducibility.",
    url: "https://github.com/huicod/llm-model-merging-thesis",
    tags: ["Python", "LLM", "Model Merging", "Research", "Thesis"],
  },
  {
    title: "leecode_go",
    desc: "Go 算法刷leecode题目，沉淀专题笔记。",
    url: "https://github.com/huicod/leecode_go",
    tags: ["Go", "Algorithms", "LeetCode", "ACM", "Notes"],
  },
  {
    title: "HotSpotAnalyzer",
    desc: "A crawler and dashboard project for collecting and analyzing hot-spot and trending data.",
    url: "https://github.com/huicod/HotSpotAnalyzer",
    tags: ["Crawler", "Data", "Dashboard", "Analytics", "Trending"],
  },
  {
    title: "rust-software-renderer",
    desc: "A Rust software renderer with OBJ loading, triangle rasterization, Phong shading, normal maps, and shadow buffering.",
    url: "https://github.com/huicod/rust-software-renderer",
    tags: ["Rust", "Renderer", "Rasterization", "Phong", "Graphics"],
  },
  {
    title: "rubiks-cube-opencv",
    desc: "OpenCV experiments for detecting Rubik's Cube stickers from images and webcam input.",
    url: "https://github.com/huicod/rubiks-cube-opencv",
    tags: ["Python", "OpenCV", "Computer Vision", "Detection", "Rubik's Cube"],
  },
  {
    title: "regex-java",
    desc: "A Java regex engine that compiles patterns to NFA/DFA and simulates matching.",
    url: "https://github.com/huicod/regex-java",
    tags: ["Java", "Regex", "NFA", "DFA", "Compiler"],
  },
  {
    title: "rpc",
    desc: "一个基于 Python 标准库的轻量级 RPC demo，包含注册中心、服务端、客户端和远程函数调用流程。",
    url: "https://github.com/huicod/rpc",
    tags: ["Python", "RPC", "Socket", "Registry", "Demo"],
  },
  {
    title: "emtion-demo",
    desc: "A Python scaffold for AI toy emotion interaction experiments, including emotion analysis specs and roadmap.",
    url: "https://github.com/huicod/emtion-demo",
    badge: "Ongoing",
    tags: ["Python", "AI", "Emotion", "Interaction", "Demo"],
  },
  {
    title: "airi",
    desc: "A forked self-hosted AI companion project for realtime voice chat and web or desktop integrations.",
    url: "https://github.com/huicod/airi",
    badge: "Ongoing",
    tags: ["Fork", "AI", "Companion", "Voice Chat", "Self-hosted"],
  },
];
