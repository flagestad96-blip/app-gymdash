// Line icons — 24px, 1.6 stroke, rounded
const Icon = ({ d, size = 22, stroke = 1.6, color = 'currentColor', fill = 'none', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d}
  </svg>
);

const IconHome = (p) => <Icon {...p} d={<><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></>} />;
const IconFlame = (p) => <Icon {...p} d={<path d="M12 3c1.8 3 4.5 4.3 4.5 8a4.5 4.5 0 1 1-9 0c0-2 1-3 1-5 1.5 1 2 2 3.5 2 0-2-1-3 0-5z"/>} />;
const IconDumbbell = (p) => <Icon {...p} d={<><path d="M6.5 6.5 17.5 17.5"/><path d="M4 9l2-2 4 4-2 2z"/><path d="M20 15l-2 2-4-4 2-2z"/><path d="M2 11l2-2"/><path d="M20 13l2-2"/></>} />;
const IconHeart = (p) => <Icon {...p} d={<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>} />;
const IconUser = (p) => <Icon {...p} d={<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></>} />;
const IconPlus = (p) => <Icon {...p} d={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />;
const IconPlay = (p) => <Icon {...p} fill="currentColor" d={<path d="M7 5v14l12-7z" fill="currentColor" stroke="none"/>} />;
const IconPause = (p) => <Icon {...p} fill="currentColor" d={<><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/></>} />;
const IconArrow = (p) => <Icon {...p} d={<><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></>} />;
const IconBack = (p) => <Icon {...p} d={<><path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></>} />;
const IconCheck = (p) => <Icon {...p} d={<path d="M5 12l5 5L20 7"/>} />;
const IconBolt = (p) => <Icon {...p} d={<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>} />;
const IconCalendar = (p) => <Icon {...p} d={<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4"/><path d="M16 3v4"/></>} />;
const IconClock = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />;
const IconTarget = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>} />;
const IconMore = (p) => <Icon {...p} d={<><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></>} />;
const IconSettings = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>} />;
const IconSparkle = (p) => <Icon {...p} d={<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>} />;
const IconRun = (p) => <Icon {...p} d={<><circle cx="13" cy="4.5" r="1.5"/><path d="M6 21l3-5 4-3-2-4-3 2-2 3"/><path d="M13 13l3 2 3-1"/></>} />;
const IconYoga = (p) => <Icon {...p} d={<><circle cx="12" cy="4" r="1.5"/><path d="M4 15l4-3h8l4 3"/><path d="M8 12l4 3 4-3"/><path d="M12 15v5"/></>} />;
const IconTrend = (p) => <Icon {...p} d={<><path d="M3 17l5-6 4 4 8-10"/><path d="M14 5h6v6"/></>} />;
const IconSwipe = (p) => <Icon {...p} d={<><path d="M8 10V7a4 4 0 0 1 8 0v7"/><path d="M8 10l-2 2 2 2"/><path d="M16 14l2-2-2-2"/></>} />;

Object.assign(window, {
  Icon, IconHome, IconFlame, IconDumbbell, IconHeart, IconUser, IconPlus,
  IconPlay, IconPause, IconArrow, IconBack, IconCheck, IconBolt,
  IconCalendar, IconClock, IconTarget, IconMore, IconSettings, IconSparkle,
  IconRun, IconYoga, IconTrend, IconSwipe,
});
