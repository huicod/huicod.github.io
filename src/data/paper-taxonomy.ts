import assignments from "./paper-facets.json";

export type PaperFacets = { topics: string[]; methods: string[]; controls: string[] };
export type FacetId = keyof PaperFacets;
export const FACET_GROUPS: { id: FacetId; param: string; label: string; options: { id: string; label: string }[] }[] = [
  { id: "topics", param: "topic", label: "研究主题", options: [
    { id: "generation", label: "通用动作生成" },
    { id: "gesture", label: "语音与手势" },
    { id: "dance", label: "音乐与舞蹈" },
    { id: "editing", label: "编辑与补间" },
    { id: "understanding", label: "理解与检索" },
    { id: "character", label: "角色与物理控制" },
    { id: "representation", label: "动作表示与压缩" },
    { id: "multimodal", label: "统一多模态" },
    { id: "video", label: "视频与图像" },
    { id: "other", label: "其他研究与笔记" },
  ] },
  { id: "methods", param: "method", label: "方法线索", options: [
    { id: "phase-frequency", label: "相位与频域" },
    { id: "tokens", label: "离散编码与 Token" },
    { id: "diffusion", label: "扩散模型" },
    { id: "flow", label: "流匹配 / Flow Matching" },
    { id: "language", label: "语言模型与符号规划" },
    { id: "retrieval", label: "检索与动作匹配" },
    { id: "physics", label: "物理仿真与强化学习" },
  ] },
  { id: "controls", param: "control", label: "控制与应用", options: [
    { id: "time", label: "时序与长动作" },
    { id: "space", label: "轨迹与关键帧" },
    { id: "parts", label: "身体部位控制" },
    { id: "style", label: "风格与情绪" },
    { id: "interaction", label: "多人及场景交互" },
    { id: "streaming", label: "流式与实时" },
  ] },
];

const papers: Record<string, PaperFacets> = assignments;

export function getPaperFacets(slug: string): PaperFacets {
  return papers[slug] ?? { topics: ["other"], methods: [], controls: [] };
}
