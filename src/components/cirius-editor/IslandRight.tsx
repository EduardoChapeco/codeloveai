import { Clock, Wrench, FolderOpen, Layers, Rocket } from "lucide-react";

interface Props {
  isLive: boolean;
  onHistoryClick: () => void;
  onBuildClick: () => void;
  onFilesClick: () => void;
  onDeployClick: () => void;
  onPublishClick: () => void;
}

export default function IslandRight({ isLive, onHistoryClick, onBuildClick, onFilesClick, onDeployClick, onPublishClick }: Props) {
  return (
    <div className="ce-island">
      {isLive && (
        <>
          <div className="il-stat">
            <span className="stat-dot" />
            Live
          </div>
          <div className="il-sep" />
        </>
      )}
      <button className="il-ibtn" onClick={onHistoryClick}><Clock size={14} /></button>
      <button className="il-ibtn" onClick={onBuildClick}><Wrench size={14} /></button>
      <button className="il-ibtn" onClick={onFilesClick}><FolderOpen size={14} /></button>
      <button className="il-ibtn" onClick={onDeployClick}><Layers size={14} /></button>
      <div className="il-sep" />
      <button className="gl sm primary" onClick={onPublishClick}>
        <Rocket size={13} />
        Publicar
      </button>
    </div>
  );
}
