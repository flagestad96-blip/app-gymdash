// Home — greeting, hero workout card, stats, weekly rhythm, upcoming list, bottom nav
function Home({ intensity, onStartWorkout }) {
  const [tab, setTab] = React.useState('home');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 100px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', letterSpacing: 0.02 }}>Tuesday, May 14</div>
            <div style={{ fontSize: 24, fontWeight: 500, marginTop: 2, fontFamily: "'Instrument Serif', serif", letterSpacing: -0.01 }}>
              Morning, Ava <span style={{
                background: 'linear-gradient(90deg,#60a5fa,#c084fc)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                fontStyle:'italic',
              }}>—</span>
            </div>
          </div>
          <Glass intensity={intensity} radius={999} padding={0} style={{
            width: 44, height: 44, display: 'grid', placeItems: 'center',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #c084fc, #60a5fa)',
              display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600,
            }}>A</div>
          </Glass>
        </div>

        {/* Hero today card */}
        <Glass intensity={intensity} radius={26} padding={20} strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <Pill tone="violet"><span style={{
                width:6, height:6, borderRadius:'50%', background:'#c084fc',
                boxShadow:'0 0 8px #c084fc',
              }}/> Today · Push</Pill>
              <div style={{ fontSize: 22, fontWeight: 500, marginTop: 12, fontFamily: "'Instrument Serif', serif" }}>
                Upper body power
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                6 exercises · ~52 min · intermediate
              </div>
            </div>
            <Ring progress={0} size={56} stroke={5}/>
          </div>

          {/* Exercise chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {['Bench','OH Press','Incline DB','Dips','Lateral Raise','Tri Ext'].map(e => (
              <span key={e} style={{
                fontSize: 11, padding: '5px 10px', borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--ink-1)',
              }}>{e}</span>
            ))}
          </div>

          <button onClick={onStartWorkout} style={{
            width: '100%', height: 52, borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #60a5fa, #c084fc 60%, #f472b6)',
            color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 10px 30px -8px rgba(192,132,252,0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}>
            <IconPlay size={16}/> Start workout
          </button>
        </Glass>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <Glass intensity={intensity} radius={20} padding={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 11,
                background: 'rgba(244,114,182,0.18)',
                border: '1px solid rgba(244,114,182,0.3)',
                display: 'grid', placeItems: 'center', color: '#f472b6',
              }}><IconFlame size={18}/></div>
              <div style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: 0.12, textTransform: 'uppercase' }}>Streak</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
              <Mono style={{ fontSize: 28, fontWeight: 600 }}>27</Mono>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>days</span>
            </div>
          </Glass>
          <Glass intensity={intensity} radius={20} padding={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 11,
                background: 'rgba(103,232,249,0.18)',
                border: '1px solid rgba(103,232,249,0.3)',
                display: 'grid', placeItems: 'center', color: '#67e8f9',
              }}><IconHeart size={18}/></div>
              <div style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: 0.12, textTransform: 'uppercase' }}>Resting HR</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
              <Mono style={{ fontSize: 28, fontWeight: 600 }}>58</Mono>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>bpm</span>
              <span style={{ fontSize: 11, color:'#67e8f9', marginLeft:'auto', display:'flex', alignItems:'center', gap:2 }}>
                <IconTrend size={12}/> -3
              </span>
            </div>
          </Glass>
        </div>

        {/* Weekly rhythm */}
        <Glass intensity={intensity} radius={22} padding={16} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Weekly rhythm</div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>Volume this week · <Mono>12,480 kg</Mono></div>
            </div>
            <Pill tone="accent">
              <IconTrend size={12}/> +18%
            </Pill>
          </div>
          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, height: 76 }}>
            {[
              { d:'M', v:0.62, on:true, done:true },
              { d:'T', v:0.38, done:true },
              { d:'W', v:0.84, on:true, done:true },
              { d:'T', v:0.92, on:true, today:true },
              { d:'F', v:0.0 },
              { d:'S', v:0.0, on:true },
              { d:'S', v:0.0 },
            ].map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ position:'relative', width: '100%', height: 60, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{
                    width: '100%',
                    height: d.v > 0 ? `${d.v * 100}%` : 6,
                    borderRadius: 6,
                    background: d.today
                      ? 'linear-gradient(180deg,#f472b6,#c084fc)'
                      : d.done
                      ? 'linear-gradient(180deg,#60a5fa,rgba(96,165,250,0.3))'
                      : 'rgba(255,255,255,0.06)',
                    border: d.on && !d.done ? '1px dashed rgba(255,255,255,0.2)' : 'none',
                    boxShadow: d.today ? '0 0 20px rgba(244,114,182,0.4)' : 'none',
                  }}/>
                </div>
                <div style={{ fontSize: 10, color: d.today ? '#fff' : 'var(--ink-2)', fontWeight: d.today ? 600 : 400 }}>{d.d}</div>
              </div>
            ))}
          </div>
        </Glass>

        {/* Upcoming */}
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500, letterSpacing: 0.02 }}>This week</div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>See all</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { day:'Thu', label:'Pull day', sub:'Back · Biceps · Rear delts', icon:<IconDumbbell size={18}/>, tint:'accent', done:false, active:true },
            { day:'Sat', label:'Leg day', sub:'Squats · RDL · Lunges', icon:<IconBolt size={18}/>, tint:'violet' },
            { day:'Sun', label:'Zone 2 run', sub:'45 min · 140 bpm target', icon:<IconRun size={18}/>, tint:'cyan' },
          ].map((r, i) => (
            <Glass key={i} intensity={intensity} radius={18} padding={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: r.active
                    ? 'linear-gradient(135deg,#60a5fa,#c084fc)'
                    : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  display: 'grid', placeItems: 'center', color: '#fff',
                }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</span>
                    <Pill tone="neutral" style={{ padding: '2px 8px', fontSize: 10 }}>{r.day}</Pill>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>{r.sub}</div>
                </div>
                <IconArrow size={16} color="rgba(255,255,255,0.4)"/>
              </div>
            </Glass>
          ))}
        </div>

      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 5,
      }}>
        <Glass intensity={Math.max(intensity, 70)} radius={26} padding={8} strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {[
              { id: 'home', icon: <IconHome size={22}/>, label: 'Home' },
              { id: 'stats', icon: <IconTrend size={22}/>, label: 'Stats' },
              { id: 'start', icon: <IconPlus size={22}/>, label: 'Start', fab: true },
              { id: 'log', icon: <IconCalendar size={22}/>, label: 'Log' },
              { id: 'me', icon: <IconUser size={22}/>, label: 'You' },
            ].map(t => {
              if (t.fab) return (
                <button key={t.id} onClick={onStartWorkout} style={{
                  width: 50, height: 50, borderRadius: 16, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #60a5fa, #c084fc 60%, #f472b6)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                  boxShadow: '0 8px 24px -6px rgba(192,132,252,0.6), inset 0 1px 0 rgba(255,255,255,0.3)',
                  transform: 'translateY(-8px)',
                }}>{t.icon}</button>
              );
              const on = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, height: 50, background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center',
                  color: on ? '#fff' : 'rgba(255,255,255,0.5)',
                }}>
                  {t.icon}
                  <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 0.02 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </Glass>
      </div>
    </div>
  );
}

Object.assign(window, { Home });
