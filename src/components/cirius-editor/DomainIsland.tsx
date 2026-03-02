import { useState } from "react";
import { Globe, X } from "lucide-react";

interface Props {
  onClose: () => void;
  onSave: (domain: string) => void;
}

export default function DomainIsland({ onClose, onSave }: Props) {
  const [domain, setDomain] = useState("");

  return (
    <div className="ce-domain-island">
      <div className="ce-island" style={{ gap: 8 }}>
        <Globe size={14} className="text-[var(--text-tertiary)]" style={{ flexShrink: 0 }} />
        <input
          className="domain-input"
          placeholder="meu-site.com.br"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          autoFocus
        />
        <button className="gl sm blue" onClick={() => onSave(domain)}>Salvar</button>
        <button className="gl sm ico" onClick={onClose}><X size={12} /></button>
      </div>
    </div>
  );
}
