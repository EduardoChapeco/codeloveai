import { useState } from "react";
import { Search } from "lucide-react";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function DrawerSEO({ visible, onClose }: Props) {
  const [title, setTitle] = useState("Cirius — AI App Builder");
  const [desc, setDesc] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [canonical, setCanonical] = useState("");

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
        {/* Score */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--green-l)" }}>82</span>
          <div style={{ flex: 1 }}>
            <span className="ce-chip green" style={{ marginBottom: 4 }}>Bom</span>
            <div style={{ height: 3, borderRadius: 2, background: "var(--bg-4)", marginTop: 4 }}>
              <div style={{ height: "100%", width: "82%", borderRadius: 2, background: "linear-gradient(90deg, var(--green), var(--teal))" }} />
            </div>
          </div>
          <button className="gl xs green">Analisar</button>
        </div>

        {/* Fields */}
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

        <button className="gl sm blue" style={{ width: "100%", justifyContent: "center" }}>
          Salvar SEO
        </button>
      </div>
    </div>
  );
}
