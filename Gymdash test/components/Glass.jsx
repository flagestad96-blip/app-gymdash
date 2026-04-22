// Glass — the workhorse glassmorphism card
function Glass({
  children, style, className = '', radius = 22, padding = 18,
  intensity = 65, strong = false, onClick,
  active = false,
}) {
  const blur = 8 + (intensity / 100) * 24;           // 8..32px
  const sat = 120 + (intensity / 100) * 60;          // 120..180%
  const fillA = 0.04 + (intensity / 100) * 0.10;     // 0.04..0.14
  const fillB = 0.02 + (intensity / 100) * 0.06;
  const strokeA = 0.12 + (intensity / 100) * 0.22;   // 0.12..0.34

  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        position: 'relative',
        borderRadius: radius,
        padding,
        cursor: onClick ? 'pointer' : 'default',
        background: `linear-gradient(155deg, rgba(255,255,255,${fillA}) 0%, rgba(255,255,255,${fillB}) 100%)`,
        backdropFilter: `blur(${blur}px) saturate(${sat}%)`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(${sat}%)`,
        border: `1px solid rgba(255,255,255,${strokeA})`,
        boxShadow: strong
          ? `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.25), 0 18px 40px -12px rgba(0,0,0,0.55)`
          : `inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(0,0,0,0.18), 0 10px 26px -10px rgba(0,0,0,0.45)`,
        transition: 'transform 200ms cubic-bezier(.2,.8,.2,1), box-shadow 200ms',
        transform: active ? 'translateY(-1px)' : undefined,
        ...style,
      }}
    >
      {/* top-left specular highlight */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit',
        background: 'radial-gradient(240px 120px at 20% 0%, rgba(255,255,255,0.18), transparent 60%)',
        pointerEvents: 'none', mixBlendMode: 'screen',
      }}/>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

// Tiny frosted pill
function Pill({ children, tone = 'neutral', style }) {
  const tones = {
    neutral: { bg: 'rgba(255,255,255,0.08)', color: 'var(--ink-0)', stroke: 'rgba(255,255,255,0.14)' },
    accent:  { bg: 'rgba(96,165,250,0.16)', color: '#cfe0ff', stroke: 'rgba(96,165,250,0.35)' },
    violet:  { bg: 'rgba(192,132,252,0.16)', color: '#ecd7ff', stroke: 'rgba(192,132,252,0.35)' },
    cyan:    { bg: 'rgba(103,232,249,0.16)', color: '#d2fbff', stroke: 'rgba(103,232,249,0.35)' },
    pink:    { bg: 'rgba(244,114,182,0.16)', color: '#ffd9ec', stroke: 'rgba(244,114,182,0.35)' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 500, letterSpacing: 0.02,
      background: t.bg, color: t.color, border: `1px solid ${t.stroke}`,
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      ...style,
    }}>{children}</span>
  );
}

// Mono numeric readout
const Mono = ({ children, style }) => (
  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontFeatureSettings: "'tnum'", ...style }}>{children}</span>
);

Object.assign(window, { Glass, Pill, Mono });
