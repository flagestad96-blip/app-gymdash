// App entry — picks the screen, wraps it in the phone, mounts Tweaks
function App() {
  const defaults = JSON.parse(document.getElementById('tweaks-defaults').textContent);
  const [values, setValues] = React.useState(defaults);

  const goto = (screen) => setValues(v => ({ ...v, screen }));

  let screen;
  if (values.screen === 'onboarding') {
    screen = <Onboarding intensity={values.glassIntensity} onFinish={() => goto('home')}/>;
  } else if (values.screen === 'workout') {
    screen = <Workout intensity={values.glassIntensity} onExit={() => goto('home')}/>;
  } else {
    screen = <Home intensity={values.glassIntensity} onStartWorkout={() => goto('workout')}/>;
  }

  return (
    <div className="stage">
      <div className="shell" data-screen-label={`Gymdash · ${values.screen}`}>
        <Phone bgAccent={values.accent}>
          <StatusBar/>
          {screen}
          <HomeBar/>
        </Phone>
      </div>
      <Tweaks defaults={defaults} values={values} onChange={setValues}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
