// Aurora — animated color blobs behind the phone glass
function Aurora({ accent = 'aurora', animate = true }) {
  const palettes = {
    aurora: ['#60a5fa', '#c084fc', '#67e8f9', '#f472b6'],
    violet: ['#8b5cf6', '#ec4899', '#6366f1', '#a78bfa'],
    emerald: ['#34d399', '#22d3ee', '#a7f3d0', '#60a5fa'],
    sunset: ['#fb7185', '#f59e0b', '#ef4444', '#e879f9'],
  };
  const [a, b, c, d] = palettes[accent] || palettes.aurora;

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      borderRadius: 'inherit', zIndex: 0,
    }}>
      {/* base gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(160deg, #0a0d1a 0%, #070814 60%, #040510 100%)`,
      }}/>
      {/* aurora blobs */}
      <div className="blob blob-a" style={{ background: `radial-gradient(closest-side, ${a}, transparent)` }}/>
      <div className="blob blob-b" style={{ background: `radial-gradient(closest-side, ${b}, transparent)` }}/>
      <div className="blob blob-c" style={{ background: `radial-gradient(closest-side, ${c}, transparent)` }}/>
      <div className="blob blob-d" style={{ background: `radial-gradient(closest-side, ${d}, transparent)` }}/>
      {/* fine grain */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '3px 3px',
        opacity: 0.25,
        mixBlendMode: 'overlay',
      }}/>
      {/* top vignette shimmer */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 30%, transparent 70%, rgba(0,0,0,0.5))',
      }}/>

      <style>{`
        .blob { position: absolute; width: 520px; height: 520px; filter: blur(40px); opacity: 0.55; mix-blend-mode: screen; }
        .blob-a { top: -160px; left: -120px; ${animate ? 'animation: floatA 18s ease-in-out infinite;' : ''} }
        .blob-b { top: -80px; right: -180px; ${animate ? 'animation: floatB 22s ease-in-out infinite;' : ''} }
        .blob-c { bottom: -200px; left: -100px; ${animate ? 'animation: floatC 26s ease-in-out infinite;' : ''} }
        .blob-d { bottom: -140px; right: -120px; ${animate ? 'animation: floatD 20s ease-in-out infinite;' : ''} }
        @keyframes floatA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px, 120px) scale(1.12); } }
        @keyframes floatB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-80px, 80px) scale(1.08); } }
        @keyframes floatC { 0%,100% { transform: translate(0,0) scale(1.05); } 50% { transform: translate(100px, -80px) scale(0.95); } }
        @keyframes floatD { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-60px, -100px) scale(1.1); } }
      `}</style>
    </div>
  );
}

Object.assign(window, { Aurora });
