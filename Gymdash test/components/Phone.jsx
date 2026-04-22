// Phone — dark Android-style shell that hosts the aurora app
function Phone({ children, bgAccent = 'aurora' }) {
  const W = 390, H = 820;
  return (
    <div style={{
      position: 'relative',
      width: W + 24, height: H + 24,
      padding: 12,
      borderRadius: 58,
      background: 'linear-gradient(160deg, #1a1d2b 0%, #0b0d16 100%)',
      boxShadow: `
        0 50px 120px -20px rgba(0,0,0,0.75),
        0 0 0 1px rgba(255,255,255,0.06),
        inset 0 0 0 2px rgba(255,255,255,0.03),
        inset 0 2px 0 rgba(255,255,255,0.06)
      `,
    }}>
      {/* side buttons */}
      <div style={{ position: 'absolute', left: -2, top: 140, width: 3, height: 46, background: '#1a1d2b', borderRadius: 2 }}/>
      <div style={{ position: 'absolute', left: -2, top: 200, width: 3, height: 80, background: '#1a1d2b', borderRadius: 2 }}/>
      <div style={{ position: 'absolute', right: -2, top: 170, width: 3, height: 100, background: '#1a1d2b', borderRadius: 2 }}/>

      <div style={{
        position: 'relative',
        width: W, height: H,
        borderRadius: 46,
        overflow: 'hidden',
        background: '#04050b',
      }}>
        <Aurora accent={bgAccent} />
        {/* App content sits above aurora */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          display: 'flex', flexDirection: 'column',
        }}>
          {children}
        </div>
        {/* Punch-hole camera */}
        <div style={{
          position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)',
          width: 10, height: 10, borderRadius: '50%', background: '#000',
          zIndex: 10, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
        }}/>
      </div>
    </div>
  );
}

// Status bar for inside the phone (transparent, white text)
function StatusBar() {
  return (
    <div style={{
      height: 36, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 22px',
      fontFamily: 'Inter', fontSize: 13, fontWeight: 600,
      color: '#fff', letterSpacing: 0.02,
      flexShrink: 0,
    }}>
      <span>9:41</span>
      <div style={{ width: 10 }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* signal */}
        <svg width="16" height="11" viewBox="0 0 16 11"><g fill="#fff">
          <rect x="0" y="8" width="2.5" height="3" rx="0.5"/>
          <rect x="3.5" y="6" width="2.5" height="5" rx="0.5"/>
          <rect x="7" y="3.5" width="2.5" height="7.5" rx="0.5"/>
          <rect x="10.5" y="0.5" width="2.5" height="10.5" rx="0.5"/>
        </g></svg>
        {/* wifi */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="#fff" strokeWidth="1.3">
          <path d="M1 4a10 10 0 0 1 13 0"/>
          <path d="M3 6.5a7 7 0 0 1 9 0"/>
          <path d="M5 9a4 4 0 0 1 5 0"/>
        </svg>
        {/* battery */}
        <div style={{
          width: 24, height: 11, borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.7)',
          padding: 1, display: 'flex',
          position: 'relative',
        }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 1 }}/>
          <div style={{ position: 'absolute', right: -3, top: 3, width: 2, height: 5, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }}/>
        </div>
      </div>
    </div>
  );
}

// Bottom gesture bar
function HomeBar({ dark = false }) {
  return (
    <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ width: 120, height: 4, borderRadius: 2, background: '#fff', opacity: 0.7 }}/>
    </div>
  );
}

Object.assign(window, { Phone, StatusBar, HomeBar });
