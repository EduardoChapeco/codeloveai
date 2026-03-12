/**
 * MeshBackground — Now a clean, subtle dot-grid background
 * Replaces the animated mesh gradient orbs with a dev-first aesthetic
 */
export default function MeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 bg-background" />
      {/* Subtle dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `radial-gradient(hsl(var(--border)) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />
    </div>
  );
}
