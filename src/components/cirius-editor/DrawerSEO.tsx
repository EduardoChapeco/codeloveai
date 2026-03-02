import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  visible: boolean;
  onClose: () => void;
  projectId?: string;
  project?: any;
}

export default function DrawerSEO({ visible, onClose, projectId, project }: Props) {
  const seo = (project?.deploy_config as any)?.seo || {};

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [canonical, setCanonical] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(seo.title || "Cirius — AI App Builder");
    setDesc(seo.description || "");
    setOgImage(seo.ogImage || "");
    setCanonical(seo.canonical || "");
  }, [project?.id, seo.title, seo.description, seo.ogImage, seo.canonical]);

  const score = useMemo(() => {
    let points = 0;
    if (title.trim()) points += 20;
    if (desc.trim()) points += 20;
    if (ogImage.trim()) points += 20;
    if (canonical.trim()) points += 20;
    const t = title.trim().length;
    const d = desc.trim().length;
    if (t >= 50 && t <= 60) points += 10;
    if (d >= 150 && d <= 160) points += 10;
    return points;
  }, [title, desc, ogImage, canonical]);

  const rating = score >= 80 ? "Bom" : score >= 60 ? "Médio" : "Baixo";

  async function saveSeo() {
    if (!projectId) return;
    setSaving(true);

    const nextDeployConfig = {
      ...((project?.deploy_config as Record<string, unknown>) || {}),
      seo: {
        title: title.trim(),
        description: desc.trim(),
        ogImage: ogImage.trim(),
        canonical: canonical.trim(),
      },
    };

    const { error } = await supabase
      .from("cirius_projects" as any)
      .update({ deploy_config: nextDeployConfig })
      .eq("id", projectId);

    if (error) toast.error("Falha ao salvar SEO");
    else toast.success("SEO salvo com sucesso");

    setSaving(false);
  }

  return (
    <div
      className={`s-drawer ${visible ? "visible" : "hidden to-left"}`}
      style={{ bottom: 88, left: 18, width: 300 }}
    >
      <div className="sdh">
        <div className="sdh-title">
          <Search size={14} className="text-[var(--blue-l)]" /> SEO
        </div>
        <button className="sd-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--green-l)" }}>{score}</span>
          <div style={{ flex: 1 }}>
            <span className="ce-chip green" style={{ marginBottom: 4 }}>{rating}</span>
            <div style={{ height: 3, borderRadius: 2, background: "var(--bg-4)", marginTop: 4 }}>
              <div style={{ height: "100%", width: `${score}%`, borderRadius: 2, background: "linear-gradient(90deg, var(--green), var(--teal))" }} />
            </div>
          </div>
          <button className="gl xs green">Analisar</button>
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".05em" }}>Título da página</label>
          <input className="seo-input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginTop: 4 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".05em" }}>Meta description</label>
          <textarea className="seo-textarea" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ marginTop: 4 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".05em" }}>OG Image URL</label>
          <input className="seo-input" value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://..." style={{ marginTop: 4 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".05em" }}>Canonical URL</label>
          <input className="seo-input" value={canonical} onChange={(e) => setCanonical(e.target.value)} placeholder="https://meu-site.com" style={{ marginTop: 4 }} />
        </div>

        <button className="gl sm blue" style={{ width: "100%", justifyContent: "center" }} onClick={saveSeo} disabled={saving || !projectId}>
          {saving ? "Salvando..." : "Salvar SEO"}
        </button>
      </div>
    </div>
  );
}
