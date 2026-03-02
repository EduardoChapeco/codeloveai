import { Monitor, Tablet, Smartphone } from "lucide-react";
import type { FrameMode } from "@/pages/CiriusEditor";

interface Props {
  frameMode: FrameMode;
  onFrameChange: (mode: FrameMode) => void;
}

export default function IslandCenter({ frameMode, onFrameChange }: Props) {
  const frames: { mode: FrameMode; icon: typeof Monitor; label: string }[] = [
    { mode: "desktop", icon: Monitor, label: "Desktop" },
    { mode: "tablet", icon: Tablet, label: "Tablet" },
    { mode: "mobile", icon: Smartphone, label: "Mobile" },
  ];

  return (
    <div className="ce-island">
      {frames.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          className={`frm-btn ${frameMode === mode ? "on" : ""}`}
          onClick={() => onFrameChange(mode)}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}
