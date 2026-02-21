/**
 * MeshBackground — Apple-style animated mesh gradient background
 * Renders 3 floating orbs with blur and slow animation
 */
export default function MeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-background" />
      
      {/* Orb 1 — Top right, blue */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full animate-mesh-1 opacity-50"
        style={{
          top: '-8%',
          right: '8%',
          background: 'radial-gradient(circle, hsl(var(--mesh-1)) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      
      {/* Orb 2 — Bottom left, cyan */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full animate-mesh-2 opacity-45"
        style={{
          bottom: '-5%',
          left: '3%',
          background: 'radial-gradient(circle, hsl(var(--mesh-2)) 0%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />
      
      {/* Orb 3 — Center, purple */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full animate-mesh-3 opacity-35"
        style={{
          top: '40%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, hsl(var(--mesh-3)) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />
    </div>
  );
}
