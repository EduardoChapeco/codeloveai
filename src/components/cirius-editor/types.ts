export type FrameMode = "desktop" | "tablet" | "mobile";
export type ActiveMode = "build" | "task" | "debug";
export type CmdMode = "chat" | "code";

export interface Bubble {
  id: string;
  title: string;
  phase: "running" | "done" | "error";
  steps: { s: "run" | "done" | "wait"; t: string }[];
  pct: number;
  startTime: number;
}

export interface EditorToast {
  id: string;
  msg: string;
  type: "success" | "info";
}
