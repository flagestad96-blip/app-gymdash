// Onboarding — 3-step aurora welcome with goal selection and glass cards
function Onboarding({ intensity, onFinish }) {
  const [step, setStep] = React.useState(0);
  const [goals, setGoals] = React.useState(['strength']);
  const [days, setDays] = React.useState(4);

  const toggleGoal = (g) => setGoals(gs => gs.includes(g) ? gs.filter(x=>x!==g) : [...gs, g]);

  const goalList = [
    { id: 'strength', label: 'Build strength', icon: <IconDumbbell size={20}/>, tint: 'accent' },
    { id: 'endurance', label: 'Improve endurance', icon: <IconRun size={20}/>, tint: 'cyan' },
    { id: 'weight', label: 'Lose weight', icon: <IconFlame size={20}/>, tint: 'pink' },
    { id: 'mobility', label: 'Move better', icon: <IconYoga size={20}/>, tint: 'violet' },
    { id: 'consistency', label: 'Be consistent', icon: <IconSparkle size={20}/>, tint: 'accent' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 22px 24px', color: 'var(--ink-0)', overflow: 'hidden' }}>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 28 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= step ? 'linear-gradient(90deg, #60a5fa, #c084fc)' : 'rgba(255,255,255,0.12)',
            transition: 'all 350ms',
          }}/>
        ))}
      </div>

      {step === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Hero */}
          <div style={{ marginTop: 30, marginBottom: 28 }}>
            <Pill tone="accent" style={{ marginBottom: 18 }}>
              <IconSparkle size={12}/> Welcome to Gymdash
            </Pill>
            <h1 style={{
              fontSize: 42, fontWeight: 500, lineHeight: 1.02,
              letterSpacing: -0.02, margin: 0,
              fontFamily: "'Instrument Serif', serif",
            }}>
              Every rep,<br/>
              <span style={{
                background: 'linear-gradient(90deg, #60a5fa, #c084fc 60%, #f472b6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                fontStyle: 'italic',
              }}>beautifully</span> tracked.
            </h1>
            <p style={{ color: 'var(--ink-1)', fontSize: 15, lineHeight: 1.5, marginTop: 14, maxWidth: 300 }}>
              A calm, aurora-lit space for your training. Log sets, watch progress bloom.
            </p>
          </div>

          {/* Three preview glass cards stacked */}
          <div style={{ position: 'relative', flex: 1, minHeight: 240 }}>
            <Glass intensity={intensity} radius={20} padding={14} style={{
              position: 'absolute', left: 30, right: 30, top: 0,
              transform: 'rotate(-3deg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(96,165,250,0.5), rgba(192,132,252,0.5))',
                  display: 'grid', placeItems: 'center', color: '#fff',
                }}><IconFlame size={18}/></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)', letterSpacing: 0.05 }}>DAY STREAK</div>
                  <Mono style={{ fontSize: 22, fontWeight: 600 }}>27</Mono>
                </div>
              </div>
            </Glass>
            <Glass intensity={intensity} radius={20} padding={14} style={{
              position: 'absolute', left: 10, right: 50, top: 80,
              transform: 'rotate(1.5deg)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', letterSpacing: 0.05 }}>TODAY · PUSH DAY</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>Bench · Shoulders · Triceps</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i < 3 ? 'linear-gradient(90deg,#60a5fa,#c084fc)' : 'rgba(255,255,255,0.12)' }}/>
                ))}
              </div>
            </Glass>
            <Glass intensity={intensity} radius={20} padding={14} style={{
              position: 'absolute', left: 40, right: 20, top: 170,
              transform: 'rotate(-1.5deg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Ring progress={0.72} size={42} stroke={4}/>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)', letterSpacing: 0.05 }}>WEEKLY VOLUME</div>
                  <Mono style={{ fontSize: 17, fontWeight: 600 }}>12,480 <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>kg</span></Mono>
                </div>
              </div>
            </Glass>
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 20 }}>
          <h2 style={{ fontSize: 28, fontWeight: 500, margin: 0, fontFamily: "'Instrument Serif', serif" }}>
            What are you chasing?
          </h2>
          <p style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 6, marginBottom: 22 }}>
            Pick one or more. We'll tune your plan.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {goalList.map(g => {
              const on = goals.includes(g.id);
              return (
                <Glass key={g.id} intensity={intensity} radius={18} padding={14}
                  onClick={() => toggleGoal(g.id)}
                  style={{
                    border: on ? '1px solid rgba(192,132,252,0.6)' : undefined,
                    background: on ? 'linear-gradient(155deg, rgba(192,132,252,0.18), rgba(96,165,250,0.10))' : undefined,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: on ? 'linear-gradient(135deg, #60a5fa, #c084fc)' : 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      display: 'grid', placeItems: 'center', color: '#fff',
                    }}>{g.icon}</div>
                    <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{g.label}</div>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: on ? '#fff' : 'transparent',
                      border: on ? 'none' : '1.5px solid rgba(255,255,255,0.25)',
                      display: 'grid', placeItems: 'center',
                      color: '#0b0f1a',
                    }}>{on && <IconCheck size={14} stroke={2.5}/>}</div>
                  </div>
                </Glass>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 20 }}>
          <h2 style={{ fontSize: 28, fontWeight: 500, margin: 0, fontFamily: "'Instrument Serif', serif" }}>
            How often?
          </h2>
          <p style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 6, marginBottom: 26 }}>
            Days per week you'll train.
          </p>

          <Glass intensity={intensity} radius={24} padding={22}>
            <div style={{ textAlign: 'center' }}>
              <Mono style={{
                fontSize: 72, fontWeight: 600, lineHeight: 1,
                background: 'linear-gradient(180deg, #fff, #c084fc)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>{days}</Mono>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', letterSpacing: 0.12, marginTop: 4, textTransform: 'uppercase' }}>
                days per week
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'center' }}>
              {[1,2,3,4,5,6,7].map(n => (
                <button key={n} onClick={() => setDays(n)} style={{
                  width: 34, height: 34, borderRadius: 10, border: 'none',
                  cursor: 'pointer',
                  background: days === n ? 'linear-gradient(135deg, #60a5fa, #c084fc)' : 'rgba(255,255,255,0.06)',
                  color: '#fff', fontSize: 13, fontWeight: 600,
                  border: days === n ? 'none' : '1px solid rgba(255,255,255,0.1)',
                }}>{n}</button>
              ))}
            </div>
          </Glass>

          <Glass intensity={intensity} radius={18} padding={14} style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(103,232,249,0.18)',
                border: '1px solid rgba(103,232,249,0.3)',
                display: 'grid', placeItems: 'center', color: '#67e8f9',
              }}><IconSparkle size={18}/></div>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-1)', lineHeight: 1.4 }}>
                Based on your goals, we'll suggest a <strong style={{ color: '#fff' }}>{days >= 5 ? 'Push/Pull/Legs' : days >= 3 ? 'Upper/Lower split' : 'Full-body'}</strong> program.
              </div>
            </div>
          </Glass>
        </div>
      )}

      {/* Footer buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{
            flex: '0 0 auto', height: 56, padding: '0 18px',
            borderRadius: 20, border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.04)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(12px)',
          }}><IconBack size={20}/></button>
        )}
        <button
          onClick={() => step < 2 ? setStep(s => s + 1) : onFinish()}
          style={{
            flex: 1, height: 56, borderRadius: 20, border: 'none',
            background: 'linear-gradient(135deg, #60a5fa 0%, #c084fc 60%, #f472b6 130%)',
            color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 10px 30px -8px rgba(192,132,252,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          {step < 2 ? 'Continue' : 'Enter Gymdash'} <IconArrow size={18}/>
        </button>
      </div>
    </div>
  );
}

// SVG progress ring used in onboarding preview
function Ring({ progress = 0.7, size = 48, stroke = 5, color = 'url(#rg)' }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id="rg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa"/>
          <stop offset="100%" stopColor="#c084fc"/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none"/>
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - progress)}/>
    </svg>
  );
}

Object.assign(window, { Onboarding, Ring });
