// Tweaks panel — toggles live in-design
function Tweaks({ defaults, values, onChange }) {
  const [on, setOn] = React.useState(false);

  React.useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setOn(true);
      if (e.data.type === '__deactivate_edit_mode') setOn(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const update = (patch) => {
    const next = { ...values, ...patch };
    onChange(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*');
  };

  if (!on) return null;

  return (
    <div className="tweaks on">
      <h4>Tweaks</h4>

      <div className="tweak-row">
        <label>Screen</label>
        <div className="seg">
          {['onboarding','home','workout'].map(s => (
            <button key={s} className={values.screen === s ? 'on' : ''} onClick={() => update({ screen: s })}>
              {s[0].toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="tweak-row">
        <label>Glass intensity · {values.glassIntensity}</label>
        <input type="range" min="0" max="100" step="5" className="slider"
          value={values.glassIntensity}
          onChange={(e) => update({ glassIntensity: +e.target.value })}/>
      </div>

      <div className="tweak-row">
        <label>Aurora palette</label>
        <div className="chips">
          {[
            { id:'aurora', c:'linear-gradient(135deg,#60a5fa,#c084fc)' },
            { id:'violet', c:'linear-gradient(135deg,#8b5cf6,#ec4899)' },
            { id:'emerald', c:'linear-gradient(135deg,#34d399,#22d3ee)' },
            { id:'sunset', c:'linear-gradient(135deg,#fb7185,#f59e0b)' },
          ].map(p => (
            <div key={p.id} className={'chip ' + (values.accent === p.id ? 'on' : '')} onClick={() => update({ accent: p.id })}>
              <span className="dot" style={{ background: p.c }}/> {p.id}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Tweaks });
