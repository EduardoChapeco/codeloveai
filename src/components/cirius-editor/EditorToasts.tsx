import { CheckCircle2, Info } from "lucide-react";
import type { EditorToast } from "@/components/cirius-editor/types";

interface Props {
  toasts: EditorToast[];
}

export default function EditorToasts({ toasts }: Props) {
  if (!toasts.length) return null;

  return (
    <div className="ce-toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`ce-toast ${t.type}`}>
          {t.type === "success" ? (
            <CheckCircle2 size={14} className="text-[var(--green-l)]" />
          ) : (
            <Info size={14} className="text-[var(--blue-l)]" />
          )}
          {t.msg}
        </div>
      ))}
    </div>
  );
}
