/**
 * MeshBackground — Apple-style animated mesh gradient background
 * Enhanced with 4 floating orbs, noise texture, and dynamic depth
 */
export default function MeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base gradient with subtle noise */}
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

      {/* Orb 1 — Top right, blue */}
      <div
        className="absolute w-[560px] h-[560px] rounded-full animate-mesh-1 opacity-40 dark:opacity-25"
        style={{
          top: '-10%',
          right: '5%',
          background: 'radial-gradient(circle, hsl(var(--mesh-1)) 0%, transparent 65%)',
          filter: 'blur(90px)',
        }}
      />

      {/* Orb 2 — Bottom left, cyan */}
      <div
        className="absolute w-[640px] h-[640px] rounded-full animate-mesh-2 opacity-35 dark:opacity-20"
        style={{
          bottom: '-8%',
          left: '0%',
          background: 'radial-gradient(circle, hsl(var(--mesh-2)) 0%, transparent 65%)',
          filter: 'blur(100px)',
        }}
      />

      {/* Orb 3 — Center, purple */}
      <div
        className="absolute w-[480px] h-[480px] rounded-full animate-mesh-3 opacity-25 dark:opacity-15"
        style={{
          top: '35%',
          left: '45%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, hsl(var(--mesh-3)) 0%, transparent 65%)',
          filter: 'blur(110px)',
        }}
      />

      {/* Orb 4 — Top left accent glow */}
      <div
        className="absolute w-[300px] h-[300px] rounded-full animate-mesh-1 opacity-20 dark:opacity-10"
        style={{
          top: '15%',
          left: '10%',
          background: 'radial-gradient(circle, hsl(211 100% 60% / 0.6) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animationDuration: '30s',
          animationDirection: 'reverse',
        }}
      />
    </div>
  );
}
