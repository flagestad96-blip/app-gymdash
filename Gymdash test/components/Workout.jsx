// Workout in progress — live timer, rep logger, rest countdown
function Workout({ intensity, onExit }) {
  const [elapsed, setElapsed] = React.useState(1842);       // total workout seconds
  const [resting, setResting] = React.useState(false);
  const [restLeft, setRestLeft] = React.useState(90);
  const [paused, setPaused] = React.useState(false);

  const [exIndex, setExIndex] = React.useState(1);           // current exercise
  const [setIndex, setSetIndex] = React.useState(1);         // current set within exercise
  const [reps, setReps] = React.useState(8);
  const [weight, setWeight] = React.useState(72.5);

  // Exercises with logged sets
  const [exercises, setExercises] = React.useState([
    { name: 'Barbell Bench Press', target: '4 × 6-8', sets: [
      { reps: 8, weight: 70, done: true },
      { reps: 8, weight: 72.5, done: true },
      { reps: 7, weight: 72.5, done: true },
      { reps: 6, weight: 75, done: true },
    ]},
    { name: 'Overhead Press', target: '4 × 8', sets: [
      { reps: 8, weight: 42.5, done: true },
      { reps: 8, weight: 45, done: true },
      { reps: null, weight: 45, done: false },
      { reps: null, weight: 45, done: false },
    ]},
    { name: 'Incline DB Press', target: '3 × 10', sets: [
      { reps: null, weight: 24, done: false },
      { reps: null, weight: 24, done: false },
      { reps: null, weight: 24, done: false },
    ]},
    { name: 'Cable Fly', target: '3 × 12', sets: [
      { reps: null, weight: 18, done: false },
      { reps: null, weight: 18, done: false },
      { reps: null, weight: 18, done: false },
    ]},
  ]);

  // tick clocks
  React.useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setElapsed(e => e + 1);
      if (resting) {
        setRestLeft(r => {
          if (r <= 1) { setResting(false); return 90; }
          return r - 1;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [paused, resting]);

  const fmt = (s) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const currentEx = exercises[exIndex];
  const totalSetsDone = exercises.reduce((acc, e) => acc + e.sets.filter(s=>s.done).length, 0);
  const totalSets = exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const progress = totalSetsDone / totalSets;

  const logSet = () => {
    setExercises(exs => exs.map((e, i) => {
      if (i !== exIndex) return e;
      return { ...e, sets: e.sets.map((s, j) => j === setIndex ? { reps, weight, done: true } : s) };
    }));
    // advance
    if (setIndex < currentEx.sets.length - 1) {
      setSetIndex(si => si + 1);
    } else if (exIndex < exercises.length - 1) {
      setExIndex(ei => ei + 1);
      setSetIndex(0);
    }
    setResting(true);
    setRestLeft(90);
  };

  // Rest progress
  const restPct = (90 - restLeft) / 90;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '6px 18px 24px' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={onExit} style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer',
          backdropFilter: 'blur(10px)',
        }}><IconBack size={18}/></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: 0.16, textTransform: 'uppercase' }}>
            Upper body power
          </div>
          <Mono style={{ fontSize: 14, fontWeight: 500, letterSpacing: 0.04 }}>{fmt(elapsed)}</Mono>
        </div>
        <button style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}><IconMore size={18}/></button>
      </div>

      {/* Hero rest-or-active card */}
      <Glass intensity={intensity} radius={28} padding={20} strong>
        {resting ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 4px' }}>
            <div style={{ position: 'relative', width: 180, height: 180 }}>
              <Ring progress={restPct} size={180} stroke={6}/>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: 0.2, textTransform: 'uppercase' }}>Rest</div>
                <Mono style={{
                  fontSize: 54, fontWeight: 600, lineHeight: 1,
                  background: 'linear-gradient(180deg,#fff,#67e8f9)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>{fmt(restLeft)}</Mono>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>breathe · sip · reset</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={() => setRestLeft(r => r + 15)} style={restBtnStyle}>+15s</button>
              <button onClick={() => { setResting(false); setRestLeft(90); }} style={{
                ...restBtnStyle,
                background: 'linear-gradient(135deg,#60a5fa,#c084fc)',
                border: 'none',
              }}>Skip rest</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Pill tone="accent">
                  <IconTarget size={11}/> Exercise {exIndex + 1} of {exercises.length}
                </Pill>
                <div style={{ fontSize: 22, fontWeight: 500, marginTop: 10, fontFamily: "'Instrument Serif', serif", lineHeight: 1.1 }}>
                  {currentEx.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>
                  Target: {currentEx.target}
                </div>
              </div>
              <Ring progress={progress} size={52} stroke={4}/>
            </div>

            {/* Set row */}
            <div style={{ marginTop: 18, display: 'flex', gap: 6 }}>
              {currentEx.sets.map((s, i) => (
                <div key={i} style={{
                  flex: 1, height: 30, borderRadius: 10,
                  display: 'grid', placeItems: 'center',
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 500,
                  background: s.done
                    ? 'linear-gradient(135deg, rgba(96,165,250,0.35), rgba(192,132,252,0.35))'
                    : i === setIndex
                      ? 'rgba(255,255,255,0.10)'
                      : 'rgba(255,255,255,0.04)',
                  border: i === setIndex && !s.done
                    ? '1px solid rgba(192,132,252,0.55)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: s.done ? '#fff' : 'var(--ink-1)',
                }}>{s.done ? `${s.reps}×${s.weight}` : `Set ${i+1}`}</div>
              ))}
            </div>

            {/* Rep & weight adjusters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <Adjuster label="Reps" value={reps} onAdj={(d) => setReps(r => Math.max(0, r + d))} unit=""/>
              <Adjuster label="Weight" value={weight} onAdj={(d) => setWeight(w => Math.max(0, +(w + d * 2.5).toFixed(2)))} unit="kg"/>
            </div>

            <button onClick={logSet} style={{
              marginTop: 16, width: '100%', height: 52, borderRadius: 16, border: 'none',
              background: 'linear-gradient(135deg,#60a5fa,#c084fc 60%,#f472b6)',
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 10px 30px -8px rgba(192,132,252,0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}>
              <IconCheck size={16} stroke={2.5}/> Log set · start rest
            </button>
          </>
        )}
      </Glass>

      {/* Up next */}
      <div style={{ marginTop: 14, flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', letterSpacing: 0.1, textTransform: 'uppercase' }}>Up next</div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)' }}><Mono>{totalSetsDone}/{totalSets}</Mono> sets</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exercises.slice(exIndex + 1, exIndex + 3).map((e, i) => (
            <Glass key={i} intensity={intensity * 0.7} radius={16} padding={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.6)',
                }}><IconDumbbell size={18}/></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 1 }}>{e.target}</div>
                </div>
                <Pill tone="neutral" style={{ padding: '3px 8px', fontSize: 10 }}>{e.sets.length} sets</Pill>
              </div>
            </Glass>
          ))}
        </div>
      </div>

      {/* Bottom control bar */}
      <Glass intensity={Math.max(intensity, 70)} radius={20} padding={8} style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPaused(p => !p)} style={{
            flex: 1, height: 44, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13, fontWeight: 500,
          }}>
            {paused ? <><IconPlay size={14}/> Resume</> : <><IconPause size={14}/> Pause</>}
          </button>
          <button onClick={onExit} style={{
            flex: 1, height: 44, borderRadius: 14, border: 'none',
            background: 'rgba(244,114,182,0.2)',
            border: '1px solid rgba(244,114,182,0.4)',
            color: '#ffd9ec', cursor: 'pointer',
            fontSize: 13, fontWeight: 500,
          }}>Finish workout</button>
        </div>
      </Glass>
    </div>
  );
}

const restBtnStyle = {
  padding: '10px 18px', borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
};

function Adjuster({ label, value, onAdj, unit }) {
  return (
    <div style={{
      borderRadius: 14,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: 0.12, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onAdj(-1)} style={adjBtn}>−</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <Mono style={{ fontSize: 22, fontWeight: 600 }}>{value}</Mono>
          {unit && <span style={{ fontSize: 11, color: 'var(--ink-2)', marginLeft: 3 }}>{unit}</span>}
        </div>
        <button onClick={() => onAdj(1)} style={adjBtn}>+</button>
      </div>
    </div>
  );
}

const adjBtn = {
  width: 30, height: 30, borderRadius: 10,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontSize: 16, fontWeight: 500, cursor: 'pointer',
  display: 'grid', placeItems: 'center',
};

Object.assign(window, { Workout });
