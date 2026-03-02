import { Folder, Globe, Search, ChevronDown } from "lucide-react";

interface Props {
  projectName: string;
  onDomainClick: () => void;
  onSeoClick: () => void;
}

export default function IslandLeft({ projectName, onDomainClick, onSeoClick }: Props) {
  return (
    <div className="ce-island">
      <div className="il-logo">C</div>
      <div className="il-sep" />
      <button className="il-proj">
        <Folder size={13} />
        <span>{projectName}</span>
        <ChevronDown size={11} />
      </button>
      <div className="il-sep" />
      <button className="gl sm" onClick={onDomainClick}>
        <Globe size={13} />
      </button>
      <button className="gl sm" onClick={onSeoClick}>
        <Search size={13} />
      </button>
    </div>
  );
}
