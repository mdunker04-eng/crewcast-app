// ═══════════════════════════════════════════════════════════════
// CrewCAST — CENTER GROVE ORCHARD: SPRING 2026 DEMO
// Real data from centergroveorchard.com
// Spring on the Farm — May 2026 Season
// ═══════════════════════════════════════════════════════════════

// ── Stations (real CG attractions + food + ops) ──
const DEMO_STATIONS = [
  { id:'admission',  name:'Admission/Tickets', icon:'🎟️', open:9,  close:17, indoor:false, revPerHr:420, peak:true,  note:'Gate + wristbands' },
  { id:'tulips',     name:'Tulip U-Pick',      icon:'🌷', open:9,  close:17, indoor:false, revPerHr:310, peak:true,  note:'400k bulbs, 4-acre field' },
  { id:'animals',    name:'Baby Animal Barn',   icon:'🐣', open:9,  close:17, indoor:true,  revPerHr:85,  peak:true,  note:'Goats, chicks, ducklings, bunnies' },
  { id:'bottles',    name:'Bottle Feeding',     icon:'🍼', open:10, close:16, indoor:false, revPerHr:95,  peak:false, note:'$3/bottle, baby goats' },
  { id:'cornpool',   name:'Corn Pool',          icon:'🌽', open:9,  close:17, indoor:false, revPerHr:0,   peak:false, note:'Included in admission' },
  { id:'pillows',    name:'Jumping Pillows',    icon:'🤸', open:9,  close:17, indoor:false, revPerHr:0,   peak:false, note:'Included in admission' },
  { id:'slide',      name:'Super Slide',        icon:'🛝', open:9,  close:17, indoor:false, revPerHr:0,   peak:false, note:'Included in admission' },
  { id:'train',      name:'CGO Express Train',  icon:'🚂', open:10, close:16, indoor:false, revPerHr:0,   peak:false, note:'Farm loop ride' },
  { id:'beeline',    name:'Honey Beeline',      icon:'🐝', open:10, close:16, indoor:false, revPerHr:0,   peak:false, note:'Zip line' },
  { id:'hayrides',   name:'Hayrides',           icon:'🚜', open:10, close:16, indoor:false, revPerHr:0,   peak:false, note:'Farm tour loop' },
  { id:'bakeshop',   name:'Bake Shop',          icon:'🧁', open:9,  close:17, indoor:true,  revPerHr:280, peak:true,  note:'Donuts, pies, cider' },
  { id:'store',      name:'Country Store',      icon:'🏪', open:9,  close:17, indoor:true,  revPerHr:195, peak:true,  note:'Gifts, jams, honey' },
  { id:'haycafe',    name:'Hay Cafe',           icon:'☕', open:8,  close:16, indoor:true,  revPerHr:220, peak:true,  note:'Breakfast + lunch' },
  { id:'lemonade',   name:'Lemonade Stand',     icon:'🍋', open:10, close:16, indoor:false, revPerHr:120, peak:false, note:'Fresh lemonade + slushies' },
  { id:'strawberry', name:'Strawberry U-Pick',  icon:'🍓', open:9,  close:17, indoor:false, revPerHr:260, peak:true,  note:'Opens May 23', minDate:'May 23' },
  { id:'parking',    name:'Parking/Traffic',     icon:'🅿️', open:8,  close:18, indoor:false, revPerHr:0,   peak:true,  note:'Lot + shuttle' },
  { id:'grounds',    name:'Grounds/Maint.',     icon:'🔧', open:7,  close:18, indoor:false, revPerHr:0,   peak:false, note:'Trash, repairs, setup' },
  { id:'float',      name:'Float/General',      icon:'🔄', open:9,  close:17, indoor:false, revPerHr:0,   peak:false, note:'Fill gaps, breaks, surge' },
];

// ── Spring 2026 Calendar (real CG Sat-Sun schedule) ──
const CG_SPRING_WEEKENDS = [
  { id:'w1', label:'Opening Weekend — May 2-3',               days:['May 2','May 3'],            tag:'Tulip Peak' },
  { id:'w2', label:"Mother's Day Weekend — May 9-10",         days:['May 9','May 10'],           tag:"Mother's Day" },
  { id:'w3', label:'Mid-May Weekend — May 16-17',             days:['May 16','May 17'],          tag:'Spring Fun' },
  { id:'w4', label:'Strawberry + Memorial Day — May 23-25',   days:['May 23','May 24','May 25'], tag:'Strawberry Opens' },
  { id:'w5', label:'Season Finale — May 30-31',               days:['May 30','May 31'],          tag:'Last Weekend' },
];

let DEMO_SELECTED_WEEKEND = 0;

function getDemoSelectedDays() {
  return CG_SPRING_WEEKENDS[DEMO_SELECTED_WEEKEND].days;
}

function demoChangeWeekend(idx) {
  DEMO_SELECTED_WEEKEND = idx;
  // Clear storm state
  demoDemoStormCuts = {};
  demoStormDay = getDemoSelectedDays()[0];
  // Re-render current page
  const path = window.location.hash.replace('#','') || '/admin/demo/dashboard';
  Router.navigate(path);
}

// ── Attendance Forecast Projections per day ──
const DEMO_CROWD = {
  'May 2': {
    day:'Saturday', date:'May 2, 2026', dayKey:'Sat',
    weather:{ temp:73, condition:'Sunny', icon:'☀️', wind:'8 mph SW', precip:'5%' },
    projected: 2800, confidence: 88,
    factors: [
      { label:'Opening weekend + tulip peak bloom', impact:'+35%', type:'up' },
      { label:'Saturday + sunny 73°F', impact:'+20%', type:'up' },
      { label:"Mother's Day next week (early gifters)", impact:'+8%', type:'up' },
    ],
    competing: [{ event:'DSM Book Festival', location:'Des Moines (35 min)', impact:'<2%', threat:'low' }],
    staffNeeded: 45,
  },
  'May 3': {
    day:'Sunday', date:'May 3, 2026', dayKey:'Sun',
    weather:{ temp:67, condition:'Partly Cloudy', icon:'⛅', wind:'12 mph NW', precip:'20%' },
    projected: 2100, confidence: 79,
    factors: [
      { label:'Sunday (typically 25% less than Sat)', impact:'-25%', type:'down' },
      { label:'Cooler temps, wind, cloud cover', impact:'-10%', type:'down' },
      { label:'Tulip field still peak bloom', impact:'+15%', type:'up' },
    ],
    competing: [],
    staffNeeded: 35,
  },
  'May 9': {
    day:'Saturday', date:'May 9, 2026', dayKey:'Sat',
    weather:{ temp:78, condition:'Clear', icon:'☀️', wind:'6 mph S', precip:'0%' },
    projected: 2500, confidence: 85,
    factors: [
      { label:"Mother's Day Eve — couples + families buying gifts", impact:'+15%', type:'up' },
      { label:'Perfect weather, clear sky', impact:'+12%', type:'up' },
      { label:'Tulips past peak, still colorful', impact:'-5%', type:'down' },
    ],
    competing: [],
    staffNeeded: 42,
  },
  'May 10': {
    day:'Sunday', date:'May 10, 2026', dayKey:'Sun',
    weather:{ temp:75, condition:'Sunny', icon:'☀️', wind:'5 mph SE', precip:'5%' },
    projected: 3200, confidence: 91,
    factors: [
      { label:"Mother's Day — families flock to farm for photos + brunch", impact:'+45%', type:'up' },
      { label:'Sunny 75°F — perfect outdoor weather', impact:'+15%', type:'up' },
      { label:'Hay Cafe brunch special brings extra foot traffic', impact:'+10%', type:'up' },
    ],
    competing: [],
    staffNeeded: 48,
  },
  'May 16': {
    day:'Saturday', date:'May 16, 2026', dayKey:'Sat',
    weather:{ temp:72, condition:'Partly Cloudy', icon:'⛅', wind:'10 mph W', precip:'15%' },
    projected: 2200, confidence: 80,
    factors: [
      { label:'Mid-season Saturday', impact:'+0%', type:'up' },
      { label:'Tulips winding down, spring activities in full swing', impact:'-5%', type:'down' },
      { label:'Nice weather, light breeze', impact:'+8%', type:'up' },
    ],
    competing: [{ event:'Des Moines Farmers Market', location:'Des Moines (35 min)', impact:'~3%', threat:'low' }],
    staffNeeded: 38,
  },
  'May 17': {
    day:'Sunday', date:'May 17, 2026', dayKey:'Sun',
    weather:{ temp:76, condition:'Sunny', icon:'☀️', wind:'7 mph SW', precip:'5%' },
    projected: 1800, confidence: 78,
    factors: [
      { label:'Sunday dip (typical 20% less than Sat)', impact:'-20%', type:'down' },
      { label:'Good weather helps offset', impact:'+10%', type:'up' },
    ],
    competing: [],
    staffNeeded: 30,
  },
  'May 23': {
    day:'Saturday', date:'May 23, 2026', dayKey:'Sat',
    weather:{ temp:80, condition:'Clear', icon:'☀️', wind:'5 mph S', precip:'0%' },
    projected: 3000, confidence: 87,
    factors: [
      { label:'Strawberry U-Pick opening day — major draw', impact:'+30%', type:'up' },
      { label:'Memorial Day weekend kickoff', impact:'+20%', type:'up' },
      { label:'Clear 80°F, perfect berry-picking weather', impact:'+10%', type:'up' },
    ],
    competing: [],
    staffNeeded: 48,
  },
  'May 24': {
    day:'Sunday', date:'May 24, 2026', dayKey:'Sun',
    weather:{ temp:82, condition:'Warm', icon:'☀️', wind:'8 mph SW', precip:'10%' },
    projected: 2600, confidence: 83,
    factors: [
      { label:'Memorial Day weekend — families in town', impact:'+15%', type:'up' },
      { label:'Strawberry rush continues', impact:'+20%', type:'up' },
      { label:'Heat may shorten outdoor visits', impact:'-8%', type:'down' },
    ],
    competing: [],
    staffNeeded: 42,
  },
  'May 25': {
    day:'Monday', date:'May 25, 2026', dayKey:'Mon',
    weather:{ temp:81, condition:'Sunny', icon:'☀️', wind:'6 mph S', precip:'5%' },
    projected: 2800, confidence: 85,
    factors: [
      { label:'Memorial Day holiday — peak family day', impact:'+35%', type:'up' },
      { label:'Last hurrah before school/work resumes', impact:'+10%', type:'up' },
      { label:'Some families leave town early', impact:'-5%', type:'down' },
    ],
    competing: [],
    staffNeeded: 45,
  },
  'May 30': {
    day:'Saturday', date:'May 30, 2026', dayKey:'Sat',
    weather:{ temp:79, condition:'Partly Cloudy', icon:'⛅', wind:'9 mph NW', precip:'20%' },
    projected: 1800, confidence: 75,
    factors: [
      { label:'Season winding down, lower hype', impact:'-15%', type:'down' },
      { label:'Shorter hours (9 AM - 2 PM)', impact:'-20%', type:'down' },
      { label:'Strawberry picking still available', impact:'+10%', type:'up' },
    ],
    competing: [{ event:'Iowa State Fair prep weekend', location:'Des Moines', impact:'<2%', threat:'low' }],
    staffNeeded: 32,
  },
  'May 31': {
    day:'Sunday', date:'May 31, 2026', dayKey:'Sun',
    weather:{ temp:83, condition:'Warm & Humid', icon:'🌤️', wind:'5 mph SE', precip:'30%' },
    projected: 1500, confidence: 72,
    factors: [
      { label:'Last day of spring season', impact:'-10%', type:'down' },
      { label:'Shorter hours (9 AM - 2 PM)', impact:'-20%', type:'down' },
      { label:'Afternoon storm chance may deter visitors', impact:'-10%', type:'down' },
      { label:'Loyal regulars come for final strawberries', impact:'+8%', type:'up' },
    ],
    competing: [],
    staffNeeded: 28,
  },
};

// ── Staffing needs per station per day ──
function generateNeeds(day) {
  const crowd = DEMO_CROWD[day];
  if (!crowd) return {};
  const base = crowd.staffNeeded;
  const ratio = base / 45; // normalize to opening Sat
  const hasStrawberry = day >= 'May 23';
  const isShortDay = day === 'May 30' || day === 'May 31';

  const needs = {
    admission: Math.max(2, Math.round(4 * ratio)),
    tulips:    isShortDay ? Math.max(1, Math.round(3 * ratio)) : Math.max(2, Math.round(6 * ratio)),
    animals:   Math.max(1, Math.round(3 * ratio)),
    bottles:   Math.max(1, Math.round(2 * ratio)),
    cornpool:  Math.max(1, Math.round(2 * ratio)),
    pillows:   Math.max(1, Math.round(2 * ratio)),
    slide:     Math.max(1, Math.round(1.5 * ratio)),
    train:     Math.max(1, Math.round(2 * ratio)),
    beeline:   Math.max(1, Math.round(1.5 * ratio)),
    hayrides:  Math.max(1, Math.round(2 * ratio)),
    bakeshop:  Math.max(2, Math.round(4 * ratio)),
    store:     Math.max(1, Math.round(3 * ratio)),
    haycafe:   Math.max(2, Math.round(4 * ratio)),
    lemonade:  Math.max(1, Math.round(2 * ratio)),
    parking:   Math.max(2, Math.round(4 * ratio)),
    grounds:   Math.max(2, Math.round(3 * ratio)),
    float:     Math.max(1, Math.round(3 * ratio)),
  };
  if (hasStrawberry) {
    needs.strawberry = Math.max(2, Math.round(5 * ratio));
  }
  return needs;
}

const DEMO_NEEDS = {};
Object.keys(DEMO_CROWD).forEach(day => { DEMO_NEEDS[day] = generateNeeds(day); });

// ── 60-person roster (real seasonal scale for CG) ──
const DEMO_FIRST_NAMES = ['Emma','Jake','Riley','Morgan','Taylor','Jordan','Casey','Avery','Harper','Logan','Bailey','Quinn','Peyton','Cameron','Skyler','Dakota','Reagan','Finley','Reese','Sage','Rowan','Blake','Alex','Sam','Drew','Jamie','Hayden','Parker','Sawyer','Emery','Jesse','Kendall','Lane','Marley','Oakley','Phoenix','River','Spencer','Tatum','Val','Wren','Addison','Blair','Charlie','Devon','Ellis','Frankie','Gray','Hollis','Aria','Brody','Caleb','Dani','Eli','Faith','Grant','Holly','Ivan','Jade','Kai'];
const DEMO_LAST_NAMES = ['Johnson','Martinez','Walker','Chen','Smith','Lee','Brown','Davis','Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Garcia','Thompson','Robinson','Clark','Lewis','Young','Allen','King','Wright','Hill','Green','Adams','Baker'];

function genDemoEmployee(i) {
  const fn = DEMO_FIRST_NAMES[i % DEMO_FIRST_NAMES.length];
  const ln = DEMO_LAST_NAMES[i % DEMO_LAST_NAMES.length];
  const yrs = i < 10 ? Math.floor(Math.random()*4)+2 : i < 25 ? Math.floor(Math.random()*3)+1 : Math.random() < .3 ? 1 : 0;
  const overall = Math.min(5, Math.max(2, Math.round((yrs*.8 + Math.random()*2 + 1.5)*10)/10));
  const reliability = Math.min(5, Math.max(2, Math.round((overall + (Math.random()-.3))*10)/10));

  // Each employee trained on 2-4 stations
  const skillCount = 2 + Math.floor(Math.random()*3);
  const skills = {};
  const pool = [...DEMO_STATIONS].filter(s=>!s.minDate).sort(()=>Math.random()-.5).slice(0, skillCount);
  pool.forEach(st => { skills[st.id] = Math.min(5, Math.max(2, Math.round((overall + (Math.random()*2-1))*10)/10)); });
  // Strawberry skill for some employees
  if (Math.random() > .5) skills['strawberry'] = Math.min(5, Math.max(2, Math.round((overall + (Math.random()*2-1))*10)/10));

  const avail = {};
  if(Math.random() > .1)  avail['Sat'] = { start: Math.random() > .7 ? 10 : (Math.random() > .5 ? 8 : 9), end: Math.random() > .7 ? 15 : 17 };
  if(Math.random() > .15) avail['Sun'] = { start: Math.random() > .6 ? 10 : 9, end: Math.random() > .6 ? 15 : 17 };
  if(Math.random() > .3)  avail['Mon'] = { start: Math.random() > .5 ? 10 : 9, end: Math.random() > .5 ? 15 : 17 };

  return { id:i+1, firstName:fn, lastName:ln, phone:'(515) 555-' + String(1000+i).padStart(4,'0'), years:yrs, overall, reliability, skills, availability:avail, status: i < 55 ? 'active' : 'inactive' };
}

const DEMO_EMPLOYEES = Array.from({length:60}, (_, i) => genDemoEmployee(i));

// ── Auto-match algorithm ──
function demoAutoMatch(day) {
  const dayKey = DEMO_CROWD[day].dayKey;
  const needs = DEMO_NEEDS[day];
  const assigned = {};
  const used = new Set();

  const activeStations = DEMO_STATIONS.filter(st => {
    if (st.minDate && day < st.minDate) return false;
    return (needs[st.id] || 0) > 0;
  });

  const sortedStations = activeStations
    .map(st => [st.id, needs[st.id] || 0])
    .filter(([_,n]) => n > 0)
    .sort(([a],[b]) => {
      const sa = DEMO_STATIONS.find(s=>s.id===a);
      const sb = DEMO_STATIONS.find(s=>s.id===b);
      return (sb.revPerHr||0) - (sa.revPerHr||0);
    });

  sortedStations.forEach(([stId, need]) => {
    assigned[stId] = [];
    const st = DEMO_STATIONS.find(s=>s.id===stId);

    const candidates = DEMO_EMPLOYEES
      .filter(e => e.status === 'active' && !used.has(e.id) && e.availability[dayKey])
      .map(e => {
        const skill = e.skills[stId] || 0;
        const reliScore = e.reliability;
        const availStart = e.availability[dayKey].start;
        const availEnd = e.availability[dayKey].end;
        const overlapStart = Math.max(st.open, availStart);
        const overlapEnd = Math.min(st.close, availEnd);
        const overlapHrs = Math.max(0, overlapEnd - overlapStart);
        const stationHrs = st.close - st.open;
        const coveragePct = overlapHrs / stationHrs;
        const score = (skill * 3) + (reliScore * 2) + (coveragePct * 5) + (e.years * 0.5);
        return { employee:e, score, skill, overlapStart, overlapEnd, overlapHrs, full: overlapHrs >= stationHrs - 0.5 };
      })
      .filter(c => c.overlapHrs >= 3 && (c.skill > 0 || stId === 'float'))
      .sort((a,b) => b.score - a.score);

    candidates.slice(0, need).forEach(c => {
      used.add(c.employee.id);
      assigned[stId].push(c);
    });
  });

  return assigned;
}

function demoSimulateResponses(assignments) {
  const results = {};
  Object.entries(assignments).forEach(([stId, arr]) => {
    results[stId] = arr.map((a, i) => {
      const rand = Math.random();
      let status, respondedAt, declineReason;
      if(rand < 0.50) {
        status = 'confirmed';
        respondedAt = ['5:12 PM','6:30 PM','7:45 PM','9:10 PM','7:15 AM','8:42 AM','10:20 AM','11:05 AM'][Math.floor(Math.random()*8)];
      } else if(rand < 0.62) {
        status = 'declined';
        declineReason = ['Family commitment','Car trouble','Already scheduled at other job','Feeling sick','Out of town'][Math.floor(Math.random()*5)];
        respondedAt = ['8:20 PM','9:05 AM','11:30 AM'][Math.floor(Math.random()*3)];
      } else {
        status = 'pending';
      }
      return { ...a, status, respondedAt: respondedAt||null, declineReason: declineReason||null };
    });
  });
  return results;
}

// Generate assignments for ALL dates using seeded random
let _seed = 42;
const _origRandom = Math.random;
Math.random = function() { _seed = (_seed * 16807 + 0) % 2147483647; return (_seed - 1) / 2147483646; };

const DEMO_ASSIGNED = {};
Object.keys(DEMO_CROWD).forEach(day => {
  DEMO_ASSIGNED[day] = demoSimulateResponses(demoAutoMatch(day));
});

Math.random = _origRandom; // restore

// ── Helpers ──
function demoGetSt(id) { return DEMO_STATIONS.find(s=>s.id===id); }
function demoFmtH(h) { return h > 12 ? (h-12)+' PM' : h === 12 ? '12 PM' : h+' AM'; }
function demoFmtHs(h) { return h > 12 ? (h-12)+'p' : h+'a'; }

function demoCountAll(day, status) {
  let c = 0;
  if (!DEMO_ASSIGNED[day]) return 0;
  Object.values(DEMO_ASSIGNED[day]).forEach(arr => arr.forEach(a => { if(a.status===status) c++; }));
  return c;
}
function demoTotalAssigned(day) {
  let c = 0;
  if (!DEMO_ASSIGNED[day]) return 0;
  Object.values(DEMO_ASSIGNED[day]).forEach(arr => { c += arr.length; });
  return c;
}
function demoTotalNeeded(day) {
  if (!DEMO_NEEDS[day]) return 0;
  return Object.values(DEMO_NEEDS[day]).reduce((s,v)=>s+v, 0);
}

function demoCbar(filled, need) {
  const pct = need > 0 ? Math.min(100, filled/need*100) : 100;
  const color = pct >= 100 ? '#34D399' : pct >= 50 ? '#FBBF24' : '#EF4444';
  return '<div class="cbar"><div class="cfill" style="width:'+pct+'%;background:'+color+'"></div></div>';
}

function demoRing(pct, color, label) {
  return '<div class="ring" style="background:conic-gradient('+color+' '+Math.round(pct*3.6)+'deg, #334155 0)"><div class="ring-inner"><span style="color:'+color+'">'+label+'</span></div></div>';
}

function demoStatusColor(s) { return s==='confirmed'?'#34D399':s==='declined'?'#F87171':'#FBBF24'; }
function demoStatusIcon(s) { return s==='confirmed'?'✓':s==='declined'?'✗':'⏳'; }
function demoBadgeCls(s) { return s==='confirmed'?'badge-green':s==='declined'?'badge-red':'badge-amber'; }

// ── Weekend Selector ──
function demoDateSelector() {
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">'+
    '<label class="text-xs semi text-muted">Weekend:</label>'+
    '<select onchange="demoChangeWeekend(parseInt(this.value))" style="padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text);font-size:13px;cursor:pointer;min-width:220px">'+
    CG_SPRING_WEEKENDS.map((w, i) =>
      '<option value="'+i+'"'+(i===DEMO_SELECTED_WEEKEND?' selected':'')+'>'+w.label+'</option>'
    ).join('')+
    '</select>'+
    '<span class="badge badge-violet">'+CG_SPRING_WEEKENDS[DEMO_SELECTED_WEEKEND].tag+'</span>'+
  '</div>';
}

function demoParseCustomMsg(msg) {
  const lower = msg.toLowerCase();
  const numMatch = lower.match(/(\d+)/);
  const count = numMatch ? numMatch[1] : null;
  const stationNames = DEMO_STATIONS.map(s=>s.name);
  let foundStation = null;
  for(let i=0;i<stationNames.length;i++){
    if(lower.indexOf(stationNames[i].toLowerCase()) > -1){ foundStation = stationNames[i]; break; }
  }
  if(!foundStation){
    const shortMap = {corn:'Corn Pool',slide:'Super Slide',train:'CGO Express Train',tulip:'Tulip U-Pick',bake:'Bake Shop',hay:'Hay Cafe',store:'Country Store',park:'Parking',admit:'Admission',animal:'Baby Animal Barn',bottle:'Bottle Feeding',jump:'Jumping Pillows',honey:'Honey Beeline',float:'Float/General',ground:'Grounds/Maint',maint:'Grounds/Maint',strawberr:'Strawberry U-Pick',lemon:'Lemonade Stand',hayride:'Hayrides'};
    for(const key in shortMap){ if(lower.indexOf(key) > -1){ foundStation = shortMap[key]; break; } }
  }
  const action = lower.indexOf('remove')>-1||lower.indexOf('cut')>-1||lower.indexOf('trim')>-1||lower.indexOf('pull')>-1||lower.indexOf('reduce')>-1 ? 'remove' : 'add';
  return {count:count, station:foundStation, action:action};
}

function demoBuildSmartReply(msg) {
  const p = demoParseCustomMsg(msg);
  const safe = msg.replace(/</g,'&lt;');
  let detail = '';
  if(p.count && p.station) {
    if(p.action === 'add') {
      detail = 'I\'ll find '+p.count+' qualified people for <strong>'+p.station+'</strong> and text them now. First to confirm are in — I\'ll update you as they lock in.';
    } else {
      detail = 'Pulling '+p.count+' from <strong>'+p.station+'</strong>. I\'ll reassign them to Float or let them know they\'re off. Schedule updates in a sec.';
    }
  } else if(p.count) {
    detail = 'Looking for '+p.count+' people now. I\'ll score by skill match and reliability, text the top candidates, and confirm once they\'re locked in.';
  } else if(p.station) {
    detail = 'Adjusting <strong>'+p.station+'</strong> staffing now. I\'ll text affected employees and update the schedule.';
  } else {
    detail = 'On it — I\'ll adjust the schedule, text the right people, and confirm once everything\'s locked in.';
  }
  return '<div style="background:rgba(167,139,250,.06);border-radius:8px;padding:10px;border:1px solid rgba(167,139,250,.2);margin-top:8px">'+
    '<div class="text-xs semi" style="color:#A78BFA;margin-bottom:6px">💬 "'+safe+'"</div>'+
    '<div class="text-xs text-green semi">✅ '+detail+'</div></div>';
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO DASHBOARD
// ═══════════════════════════════════════════════════════
function renderDemoDashboardContent() {
  const days = getDemoSelectedDays();
  const wk = CG_SPRING_WEEKENDS[DEMO_SELECTED_WEEKEND];
  let allTotal = 0, conf = 0, pend = 0, decl = 0, projTotal = 0;
  days.forEach(day => {
    allTotal += demoTotalAssigned(day);
    conf += demoCountAll(day,'confirmed');
    pend += demoCountAll(day,'pending');
    decl += demoCountAll(day,'declined');
    projTotal += (DEMO_CROWD[day]||{}).projected || 0;
  });
  const confPct = allTotal > 0 ? Math.round(conf/allTotal*100) : 0;
  const pendPct = allTotal > 0 ? Math.round(pend/allTotal*100) : 0;
  const declPct = allTotal > 0 ? Math.round(decl/allTotal*100) : 0;

  return demoDateSelector() +
    '<h1>Spring on the Farm — '+wk.label.split(' — ')[1]+'</h1>'+
    '<div class="subtitle">Center Grove Orchard · 60-person roster · '+DEMO_STATIONS.length+' stations · '+wk.tag+'</div>'+

    '<div class="grid5 mb4">'+
      '<div class="stat-card"><div class="stat-label">Total Shifts</div><div class="stat-value">'+allTotal+'</div><div class="stat-sub">'+days.length+' days · '+DEMO_STATIONS.length+' stations</div></div>'+
      '<div class="stat-card"><div class="stat-label">Confirmed</div><div class="stat-value text-green">'+conf+'</div><div class="stat-sub">'+confPct+'% of shifts</div></div>'+
      '<div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value text-amber">'+pend+'</div><div class="stat-sub">'+pendPct+'% no response</div></div>'+
      '<div class="stat-card"><div class="stat-label">Declined</div><div class="stat-value text-red">'+decl+'</div><div class="stat-sub">need coverage</div></div>'+
      '<div class="stat-card"><div class="stat-label">Est. Visitors</div><div class="stat-value text-violet">'+projTotal.toLocaleString()+'</div><div class="stat-sub">Attendance forecast</div></div>'+
    '</div>'+

    '<div class="card"><div class="card-header"><div class="card-title">📊 Response Progress</div><span class="badge badge-amber">⏰ Deadline: 8 PM Thursday before</span></div>'+
    '<div class="flex gap3 justify-center" style="padding:8px 0">'+
      '<div class="text-center">'+demoRing(confPct,'#34D399',conf)+'<div class="text-xs text-muted mt2">Confirmed</div></div>'+
      '<div class="text-center">'+demoRing(pendPct,'#FBBF24',pend)+'<div class="text-xs text-muted mt2">Pending</div></div>'+
      '<div class="text-center">'+demoRing(declPct,'#EF4444',decl)+'<div class="text-xs text-muted mt2">Declined</div></div>'+
    '</div></div>'+

    '<div class="grid2 mb4">'+days.map(function(day) {
      const d = DEMO_CROWD[day];
      if (!d) return '';
      const c=demoCountAll(day,'confirmed'), p=demoCountAll(day,'pending'), dc=demoCountAll(day,'declined'), t=demoTotalAssigned(day);
      const hasGap = dc > 0;
      return '<div class="card" style="border-color:'+(hasGap?'rgba(239,68,68,.3)':'rgba(52,211,153,.2)')+'">'+
        '<div class="flex justify-between items-center mb3"><div>'+
          '<div class="semi">'+d.day+', '+d.date+'</div>'+
          '<div class="text-xs text-muted">'+d.weather.icon+' '+d.weather.temp+'° '+d.weather.condition+' · Wind '+d.weather.wind+'</div>'+
        '</div><span class="badge '+(hasGap?'badge-red':'badge-green')+'">'+(hasGap?dc+' shortage'+(dc>1?'s':''):'On track')+'</span></div>'+
        '<div class="flex gap2 mb2"><span class="tag tag-green">✓ '+c+'</span><span class="tag tag-amber">⏳ '+p+'</span><span class="tag tag-red">✗ '+dc+'</span></div>'+
        '<div class="text-xs text-muted mb1">Projected: '+d.projected.toLocaleString()+' visitors · Need '+d.staffNeeded+' staff</div>'+
        (t > 0 ? '<div style="width:100%;height:8px;border-radius:4px;overflow:hidden;display:flex;background:#0F172A">'+
          '<div style="width:'+Math.round(c/t*100)+'%;background:#34D399"></div>'+
          '<div style="width:'+Math.round(p/t*100)+'%;background:#FBBF24"></div>'+
          '<div style="width:'+Math.round(dc/t*100)+'%;background:#EF4444"></div>'+
        '</div>' : '')+
        (d.competing.length > 0 ? '<div class="text-xs mt2" style="color:#60A5FA">📍 Competing: '+d.competing.map(e=>e.event+' ('+e.impact+' impact)').join(', ')+'</div>' : '')+
      '</div>';
    }).join('')+'</div>'+

    '<div class="card" style="border-color:rgba(239,68,68,.3)"><div class="card-header"><div class="card-title text-red">🚨 Needs Attention</div><button class="btn btn-sm btn-secondary" onclick="Router.navigate(\'/admin/demo/alerts\')">View All →</button></div>'+
    '<div style="display:grid;gap:6px">'+
      (decl > 0 ? '<div style="background:rgba(239,68,68,.05);border-radius:8px;padding:10px;border:1px solid rgba(239,68,68,.15)"><span class="semi text-red text-xs">'+decl+' declined shifts</span><span class="text-xs text-muted"> — auto-replacement ready to text qualified backups</span></div>' : '')+
      (pend > 0 ? '<div style="background:rgba(251,191,36,.05);border-radius:8px;padding:10px;border:1px solid rgba(251,191,36,.15)"><span class="semi text-amber text-xs">'+pend+' pending responses</span><span class="text-xs text-muted"> — reminder sent Thu noon, deadline 8 PM</span></div>' : '')+
    '</div></div>';
}

function renderDemoDashboard(app) {
  app.innerHTML = UI.adminShell('demo-dashboard', `<div class="page">${renderDemoDashboardContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO CROWDPULSE
// ═══════════════════════════════════════════════════════
function renderDemoCrowdPulseContent() {
  const days = getDemoSelectedDays();
  return demoDateSelector() +
    '<h1>🎯 Attendance Forecast</h1>'+
    '<div class="subtitle">AI-powered staffing projections based on weather, events, history, and local competition</div>'+

    days.map(function(day) {
      const d = DEMO_CROWD[day];
      if (!d) return '';
      const confColor = d.confidence >= 85 ? '#34D399' : d.confidence >= 70 ? '#FBBF24' : '#F87171';
      return '<div class="card">'+
        '<div class="card-header"><div><div class="card-title">'+d.weather.icon+' '+d.day+', '+d.date+'</div><div class="text-xs text-muted">'+d.weather.temp+'°F '+d.weather.condition+' · Wind '+d.weather.wind+' · Precip '+d.weather.precip+'</div></div>'+
          '<div class="text-center"><div class="text-xs text-muted">Confidence</div><div class="semi" style="font-size:20px;color:'+confColor+'">'+d.confidence+'%</div></div></div>'+

        '<div class="grid3 mb3">'+
          '<div class="stat-card"><div class="stat-label">Projected Visitors</div><div class="stat-value text-violet">'+d.projected.toLocaleString()+'</div></div>'+
          '<div class="stat-card"><div class="stat-label">Staff Recommended</div><div class="stat-value text-cyan">'+d.staffNeeded+'</div><div class="stat-sub">of 60 roster</div></div>'+
          '<div class="stat-card"><div class="stat-label">Revenue Forecast</div><div class="stat-value text-green">$'+Math.round(d.projected*12.50).toLocaleString()+'</div><div class="stat-sub">at ~$12.50/visitor avg</div></div>'+
        '</div>'+

        '<div class="text-xs semi mb2">📈 Demand Factors</div>'+
        '<div style="display:grid;gap:4px;margin-bottom:12px">'+
          d.factors.map(f => {
            const color = f.type==='up' ? '#34D399' : '#F87171';
            return '<div style="background:#0F172A;border-radius:6px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center">'+
              '<span class="text-xs">'+f.label+'</span>'+
              '<span class="text-xs semi" style="color:'+color+'">'+f.impact+'</span></div>';
          }).join('')+
        '</div>'+

        (d.competing.length > 0 ? '<div class="text-xs semi mb2">🏁 Competing Events</div>'+
          '<div style="display:grid;gap:4px">'+
          d.competing.map(e => {
            const tc = e.threat==='high'?'text-red':e.threat==='medium'?'text-amber':'text-green';
            return '<div style="background:#0F172A;border-radius:6px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center">'+
              '<div><span class="text-xs semi">'+e.event+'</span><span class="text-xs text-muted"> · '+e.location+'</span></div>'+
              '<span class="badge '+(e.threat==='medium'?'badge-amber':'badge-green')+'">'+e.impact+' impact</span></div>';
          }).join('')+'</div>' : '')+

        '<div style="background:rgba(167,139,250,.06);border-radius:8px;padding:10px;margin-top:12px;border:1px solid rgba(167,139,250,.2)">'+
          '<div class="text-xs semi text-violet mb1">📋 Staffing Recommendation</div>'+
          '<div class="text-xs text-muted">Based on '+d.projected.toLocaleString()+' projected visitors, Forecast recommends <strong class="text-violet">'+d.staffNeeded+' staff</strong> with emphasis on high-traffic areas like Admission, '+(day >= 'May 23' ? 'Strawberry U-Pick, ' : 'Tulip U-Pick, ')+'and Hay Cafe.</div>'+
        '</div>'+
      '</div>';
    }).join('');
}

function renderDemoCrowdPulse(app) {
  app.innerHTML = UI.adminShell('demo-crowdpulse', `<div class="page">${renderDemoCrowdPulseContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO STATION VIEW
// ═══════════════════════════════════════════════════════
let demoStationViewMode = 'card'; // 'card' or 'grid'

function demoSwitchStationMode(mode) {
  demoStationViewMode = mode;
  renderDemoStationView(document.getElementById('app'));
}

// Show modal to add/remove employees for a station on a given day
function demoStationManage(stId, day) {
  const st = DEMO_STATIONS.find(s=>s.id===stId);
  if(!st) return;
  const dayKey = DEMO_CROWD[day].dayKey;
  const arr = DEMO_ASSIGNED[day][stId] || [];
  const assignedIds = new Set(arr.map(a=>a.employee.id));

  // All employees assigned across all stations this day
  const allUsed = new Set();
  Object.values(DEMO_ASSIGNED[day]||{}).forEach(as => as.forEach(a=>allUsed.add(a.employee.id)));

  // Available employees: active, available this day, not assigned elsewhere, have skill for this station (or float)
  const available = DEMO_EMPLOYEES.filter(e =>
    e.status === 'active' && !assignedIds.has(e.id) && !allUsed.has(e.id) && e.availability[dayKey] && (e.skills[stId] || stId === 'float')
  ).sort((a,b) => (b.skills[stId]||0) - (a.skills[stId]||0));

  let body = '<div style="margin-bottom:12px"><div class="semi text-sm">Currently Assigned ('+arr.length+')</div>';
  if(arr.length === 0) body += '<div class="text-xs text-muted" style="padding:8px 0">No one assigned yet</div>';
  else {
    body += '<div style="display:grid;gap:4px;margin-top:6px">';
    arr.forEach(a => {
      const e = a.employee;
      const bgA = a.status==='confirmed'?'52,211,153':a.status==='pending'?'251,191,36':'239,68,68';
      body += '<div class="flex items-center justify-between" style="padding:6px 8px;background:rgba('+bgA+',.08);border-radius:6px;border:1px solid rgba('+bgA+',.2)">'+
        '<div><span class="semi text-sm">'+e.firstName+' '+e.lastName+'</span>'+
        ' <span class="text-xs text-muted">'+demoStatusIcon(a.status)+' '+(e.skills[stId]?'★'+Math.round(e.skills[stId]):'')+'</span></div>'+
        '<button class="btn btn-ghost btn-sm" style="color:#F87171;font-size:10px;padding:2px 8px" onclick="demoRemoveFromStation(\''+stId+'\',\''+day+'\','+e.id+')">Remove</button></div>';
    });
    body += '</div>';
  }

  // Quick-add dropdown: all qualified employees (even if assigned elsewhere)
  const qualified = DEMO_EMPLOYEES.filter(e =>
    e.status === 'active' && !assignedIds.has(e.id) && e.availability[dayKey] && (e.skills[stId] || stId === 'float')
  ).sort((a,b) => (b.skills[stId]||0) - (a.skills[stId]||0));

  body += '<div style="margin-top:14px;border-top:1px solid #334155;padding-top:12px"><div class="semi text-sm" style="margin-bottom:6px">Quick Add</div>';
  body += '<div class="flex gap2" style="margin-bottom:10px">'+
    '<select id="demo-quick-add-select" style="flex:1;background:#0F172A;border:1px solid #475569;border-radius:6px;padding:6px 8px;color:#E2E8F0;font-size:12px">'+
    '<option value="">— Select qualified employee —</option>'+
    qualified.map(e => {
      const skill = e.skills[stId] || 0;
      const inUse = allUsed.has(e.id);
      return '<option value="'+e.id+'">'+e.firstName+' '+e.lastName+' (★'+Math.round(skill)+(inUse?' · busy':'')+')</option>';
    }).join('')+
    '</select>'+
    '<button class="btn btn-success btn-sm" onclick="var s=document.getElementById(\'demo-quick-add-select\');if(s.value)demoAddToStation(\''+stId+'\',\''+day+'\',parseInt(s.value))">+ Add</button>'+
  '</div>';

  // Manual entry: create a brand new employee on the fly
  body += '<div class="flex gap2">'+
    '<input type="text" id="demo-new-emp-name" placeholder="Or type new name (e.g. John Smith)" style="flex:1;background:#0F172A;border:1px solid #475569;border-radius:6px;padding:6px 8px;color:#E2E8F0;font-size:12px">'+
    '<button class="btn btn-success btn-sm" onclick="demoAddNewEmployee(\''+stId+'\',\''+day+'\')">+ Create & Add</button>'+
  '</div>';
  body += '</div>';

  // Available list
  body += '<div style="margin-top:14px;border-top:1px solid #334155;padding-top:12px"><div class="semi text-sm">Available — Not Assigned Elsewhere ('+available.length+')</div>';
  if(available.length === 0) body += '<div class="text-xs text-muted" style="padding:8px 0">No unassigned employees with skills for this station</div>';
  else {
    body += '<div style="display:grid;gap:4px;margin-top:6px;max-height:200px;overflow-y:auto">';
    available.slice(0, 15).forEach(e => {
      const skill = e.skills[stId] || 0;
      const cls = skill >= 4 ? 'tag-green' : skill >= 3 ? 'tag-amber' : 'tag-red';
      body += '<div class="flex items-center justify-between" style="padding:6px 8px;background:rgba(30,41,59,.5);border-radius:6px;border:1px solid #334155">'+
        '<div><span class="semi text-sm">'+e.firstName+' '+e.lastName+'</span>'+
        ' <span class="tag '+cls+'" style="font-size:9px">★'+Math.round(skill)+'</span>'+
        ' <span class="text-xs text-muted">'+demoFmtHs(e.availability[dayKey].start)+'-'+demoFmtHs(e.availability[dayKey].end)+'</span></div>'+
        '<button class="btn btn-success btn-sm" style="font-size:10px;padding:2px 8px" onclick="demoAddToStation(\''+stId+'\',\''+day+'\','+e.id+')">+ Add</button></div>';
    });
    if(available.length > 15) body += '<div class="text-xs text-muted" style="padding:4px;text-align:center">+'+(available.length-15)+' more available</div>';
    body += '</div>';
  }
  body += '</div>';

  UI.showModal(st.icon+' '+st.name+' — '+day, body, '<button class="btn btn-secondary" onclick="UI.closeModal()">Done</button>');
}

function demoAddToStation(stId, day, empId) {
  const e = DEMO_EMPLOYEES.find(em=>em.id===empId);
  if(!e) return;
  if(!DEMO_ASSIGNED[day]) DEMO_ASSIGNED[day] = {};
  if(!DEMO_ASSIGNED[day][stId]) DEMO_ASSIGNED[day][stId] = [];
  DEMO_ASSIGNED[day][stId].push({ employee:e, status:'confirmed' });
  UI.closeModal();
  demoStationManage(stId, day);
}

function demoAddNewEmployee(stId, day) {
  const input = document.getElementById('demo-new-emp-name');
  if (!input || !input.value.trim()) return;
  const parts = input.value.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || 'New';
  const newId = DEMO_EMPLOYEES.length + 1 + Math.floor(Math.random() * 1000);
  const dayKey = DEMO_CROWD[day].dayKey;
  const newEmp = {
    id: newId, firstName, lastName,
    phone: '(515) 555-' + String(9000 + newId).padStart(4, '0'),
    years: 0, overall: 3.0, reliability: 3.0,
    skills: { [stId]: 3.0 },
    availability: { Sat: {start:9,end:17}, Sun: {start:9,end:17}, Mon: {start:9,end:17} },
    status: 'active'
  };
  DEMO_EMPLOYEES.push(newEmp);
  demoAddToStation(stId, day, newId);
}

function demoRemoveFromStation(stId, day, empId) {
  if(!DEMO_ASSIGNED[day] || !DEMO_ASSIGNED[day][stId]) return;
  DEMO_ASSIGNED[day][stId] = DEMO_ASSIGNED[day][stId].filter(a=>a.employee.id !== empId);
  UI.closeModal();
  demoStationManage(stId, day);
}

function renderDemoStationViewContent() {
  const days = getDemoSelectedDays();
  const mode = demoStationViewMode;

  let h = demoDateSelector() +
    '<div class="flex justify-between items-center"><div><h1>🏗️ Station View</h1><div class="subtitle">Employees assigned per station — click a station to manage staff</div></div>'+
    '<div class="flex gap1">'+
      '<button class="btn btn-sm '+(mode==='card'?'btn-primary':'btn-secondary')+'" onclick="demoSwitchStationMode(\'card\')">📋 Detail</button>'+
      '<button class="btn btn-sm '+(mode==='grid'?'btn-primary':'btn-secondary')+'" onclick="demoSwitchStationMode(\'grid\')">📈 Grid</button>'+
    '</div></div>';

  if(mode === 'grid') {
    // Coverage grid view
    const hours = [7,8,9,10,11,12,13,14,15,16,17];
    h += days.map(day => {
      const d = DEMO_CROWD[day];
      if (!d) return '';
      return '<div class="card"><div class="card-header"><div class="card-title">'+d.weather.icon+' '+d.day+', '+d.date+'</div>'+
        '<div class="flex gap2">'+
          '<span class="text-xs"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:rgba(52,211,153,.3);vertical-align:middle"></span> Full</span>'+
          '<span class="text-xs"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:rgba(251,191,36,.3);vertical-align:middle"></span> Partial</span>'+
          '<span class="text-xs"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:rgba(239,68,68,.2);vertical-align:middle"></span> Gap</span>'+
        '</div></div>'+
        '<div style="overflow-x:auto">'+
        '<div style="display:grid;grid-template-columns:140px repeat('+hours.length+', 1fr);gap:2px;margin-bottom:4px;min-width:600px">'+
          '<div></div>'+hours.map(h=>'<div style="text-align:center;font-size:8px;color:#64748B">'+demoFmtHs(h)+'</div>').join('')+
        '</div>'+
        DEMO_STATIONS.map(st => {
          if (st.minDate && day < st.minDate) return '';
          const need = DEMO_NEEDS[day][st.id] || 0;
          if(need === 0) return '';
          const arr = DEMO_ASSIGNED[day][st.id] || [];
          return '<div style="display:grid;grid-template-columns:140px repeat('+hours.length+', 1fr);gap:2px;margin-bottom:2px;min-width:600px;cursor:pointer" onclick="demoStationManage(\''+st.id+'\',\''+day+'\')">'+
            '<div class="flex items-center gap1" style="padding-right:6px;overflow:hidden"><span style="font-size:10px">'+st.icon+'</span><span class="text-xs semi" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+st.name+'</span></div>'+
            hours.map(h => {
              if(h < st.open || h >= st.close) return '<div class="hcell h-empty">—</div>';
              const active = arr.filter(a=>a.status!=='declined').length;
              const confirmed = arr.filter(a=>a.status==='confirmed').length;
              const hasDecl = arr.some(a=>a.status==='declined');
              if(active === 0 && hasDecl) return '<div class="hcell h-gap">GAP</div>';
              if(active === 0) return '<div class="hcell h-empty">—</div>';
              if(confirmed === active && active >= need) return '<div class="hcell h-full">'+active+'</div>';
              return '<div class="hcell h-partial">'+active+'</div>';
            }).join('')+
          '</div>';
        }).join('')+
        '</div></div>';
    }).join('');
  } else {
    // Card/detail view
    h += days.map(function(day) {
      const d = DEMO_CROWD[day];
      if (!d) return '';
      const dayLabel = d.day+', '+d.date;
      return '<div class="card"><div class="card-header"><div class="card-title">📅 '+dayLabel+'</div>'+
        '<div class="flex gap2"><span class="tag tag-green">✓ '+demoCountAll(day,'confirmed')+'</span><span class="tag tag-amber">⏳ '+demoCountAll(day,'pending')+'</span><span class="tag tag-red">✗ '+demoCountAll(day,'declined')+'</span></div></div>'+
        '<div style="overflow-x:auto"><table><thead><tr><th>Station</th><th>Need</th><th>Staff</th><th>Coverage</th><th>Status</th><th></th></tr></thead><tbody>'+
        DEMO_STATIONS.map(st => {
          if (st.minDate && day < st.minDate) return '';
          const need = DEMO_NEEDS[day][st.id] || 0;
          if(need === 0) return '';
          const arr = DEMO_ASSIGNED[day][st.id] || [];
          const active = arr.filter(a=>a.status!=='declined');
          const hasDecl = arr.some(a=>a.status==='declined');
          const allConf = arr.length > 0 && arr.every(a=>a.status==='confirmed');
          const badge = hasDecl ? '<span class="badge badge-red">⚠ Gap</span>' : allConf ? '<span class="badge badge-green">✓ Full</span>' : '<span class="badge badge-amber">⏳</span>';

          const reportH = Math.max(st.open - (st.peak ? 0.5 : 0.25), 7);
          return '<tr style="cursor:pointer" onclick="demoStationManage(\''+st.id+'\',\''+day+'\')"><td style="white-space:nowrap"><span class="semi">'+st.icon+' '+st.name+'</span><div class="text-xs text-muted">Opens '+demoFmtH(st.open)+'–'+demoFmtH(st.close)+' · <span style="color:var(--amber)">Report '+demoFmtH(reportH)+'</span></div></td>'+
            '<td class="semi" style="text-align:center">'+need+'</td>'+
            '<td><div class="flex gap1 flex-wrap">'+
              arr.map(a => {
                const bgA = a.status==='confirmed'?'52,211,153':a.status==='pending'?'251,191,36':'239,68,68';
                const fn = (a.employee && a.employee.firstName) || '?';
                const ln = (a.employee && a.employee.lastName) || '';
                return '<span class="tag" style="background:rgba('+bgA+',.12);color:'+demoStatusColor(a.status)+';font-size:10px;padding:2px 6px">'+fn+' '+(ln?ln.charAt(0)+'. ':'')+demoStatusIcon(a.status)+'</span>';
              }).join('')+
            '</div></td>'+
            '<td style="white-space:nowrap">'+demoCbar(active.length, need)+' <span class="text-xs">'+active.length+'/'+need+'</span></td>'+
            '<td>'+badge+'</td>'+
            '<td><button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px" onclick="event.stopPropagation();demoStationManage(\''+st.id+'\',\''+day+'\')">✏️</button></td></tr>';
        }).join('')+
        '</tbody></table></div></div>';
    }).join('');
  }

  return h;
}

function renderDemoStationView(app) {
  app.innerHTML = UI.adminShell('demo-stations', `<div class="page">${renderDemoStationViewContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO COVERAGE GRID
// ═══════════════════════════════════════════════════════
function renderDemoCoverageContent() {
  const hours = [7,8,9,10,11,12,13,14,15,16,17];
  const days = getDemoSelectedDays();

  return demoDateSelector() +
    '<h1>📈 Hourly Coverage Grid</h1><div class="subtitle">Station-by-station staffing per hour</div>'+
    days.map(day => {
      const d = DEMO_CROWD[day];
      if (!d) return '';
      return '<div class="card"><div class="card-header"><div class="card-title">'+d.weather.icon+' '+d.day+', '+d.date+'</div>'+
        '<div class="flex gap2">'+
          '<span class="text-xs"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:rgba(52,211,153,.3);vertical-align:middle"></span> Full</span>'+
          '<span class="text-xs"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:rgba(251,191,36,.3);vertical-align:middle"></span> Partial</span>'+
          '<span class="text-xs"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:rgba(239,68,68,.2);vertical-align:middle"></span> Gap</span>'+
        '</div></div>'+
        '<div style="overflow-x:auto">'+
        '<div style="display:grid;grid-template-columns:140px repeat('+hours.length+', 1fr);gap:2px;margin-bottom:4px;min-width:600px">'+
          '<div></div>'+hours.map(h=>'<div style="text-align:center;font-size:8px;color:#64748B">'+demoFmtHs(h)+'</div>').join('')+
        '</div>'+
        DEMO_STATIONS.map(st => {
          if (st.minDate && day < st.minDate) return '';
          const need = DEMO_NEEDS[day][st.id] || 0;
          if(need === 0) return '';
          const arr = DEMO_ASSIGNED[day][st.id] || [];
          return '<div style="display:grid;grid-template-columns:140px repeat('+hours.length+', 1fr);gap:2px;margin-bottom:2px;min-width:600px">'+
            '<div class="flex items-center gap1" style="padding-right:6px;overflow:hidden"><span style="font-size:10px">'+st.icon+'</span><span class="text-xs semi" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+st.name+'</span></div>'+
            hours.map(h => {
              if(h < st.open || h >= st.close) return '<div class="hcell h-empty">—</div>';
              const active = arr.filter(a=>a.status!=='declined').length;
              const confirmed = arr.filter(a=>a.status==='confirmed').length;
              const hasDecl = arr.some(a=>a.status==='declined');
              if(active === 0 && hasDecl) return '<div class="hcell h-gap">GAP</div>';
              if(active === 0) return '<div class="hcell h-empty">—</div>';
              if(confirmed === active && active >= need) return '<div class="hcell h-full">'+active+'</div>';
              return '<div class="hcell h-partial">'+active+'</div>';
            }).join('')+
          '</div>';
        }).join('')+
        '</div></div>';
    }).join('');
}

function renderDemoCoverage(app) {
  app.innerHTML = UI.adminShell('demo-coverage', `<div class="page">${renderDemoCoverageContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO REPLACEMENT ENGINE
// ═══════════════════════════════════════════════════════
function renderDemoReplacementContent() {
  const days = getDemoSelectedDays();
  const gaps = [];
  days.forEach(day => {
    if (!DEMO_ASSIGNED[day]) return;
    Object.entries(DEMO_ASSIGNED[day]).forEach(([stId, arr]) => {
      arr.forEach(a => {
        if(a.status === 'declined') {
          const st = demoGetSt(stId);
          const usedIds = new Set();
          Object.values(DEMO_ASSIGNED[day]).forEach(sa => { sa.forEach(x=>{if(x.status!=='declined') usedIds.add(x.employee.id);}); });

          const dayKey = DEMO_CROWD[day].dayKey;
          const candidates = DEMO_EMPLOYEES.filter(e => {
            return e.status==='active' && !usedIds.has(e.id) && e.availability[dayKey] && (e.skills[stId] || 0) >= 2;
          }).map(e => {
            const skill = e.skills[stId] || 0;
            return { employee:e, skill:skill, reliability:e.reliability, score: skill*3 + e.reliability*2 + e.years };
          }).sort((a,b)=>b.score-a.score).slice(0,5);

          gaps.push({ day:day, stId:stId, station:st, declined:a, candidates:candidates });
        }
      });
    });
  });

  return demoDateSelector() +
    '<h1>⚡ Auto-Replacement Engine</h1>'+
    '<div class="subtitle">'+gaps.length+' open shifts — CrewCast found qualified replacements ranked by skill + reliability</div>'+

    '<div class="card" style="border-color:rgba(167,139,250,.3)"><div class="card-header"><div class="card-title text-violet">How Auto-Replace Works</div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">'+
      [
        {n:'1', t:'Decline detected', d:'Employee says NO or doesn\'t respond by deadline'},
        {n:'2', t:'Score candidates', d:'Rank available employees by skill rating + reliability + experience'},
        {n:'3', t:'Text top 5', d:'"Can you fill in at [Station] on [Day]? Reply YES to claim."'},
        {n:'4', t:'First YES wins', d:'Auto-assign, notify Steve, tell the other 4 it\'s filled'},
      ].map(s => {
        return '<div style="background:#0F172A;border-radius:8px;padding:10px;text-align:center">'+
          '<div class="semi text-violet" style="font-size:18px;margin-bottom:4px">'+s.n+'</div>'+
          '<div class="text-xs semi mb1">'+s.t+'</div>'+
          '<div class="text-xs text-muted">'+s.d+'</div></div>';
      }).join('')+
    '</div></div>'+

    gaps.map(g => {
      const dayLabel = DEMO_CROWD[g.day] ? DEMO_CROWD[g.day].day : g.day;
      return '<div class="card" style="border-color:rgba(239,68,68,.2)">'+
        '<div class="card-header"><div>'+
          '<div class="card-title">'+g.station.icon+' '+g.station.name+' — '+dayLabel+'</div>'+
          '<div class="text-xs text-muted">'+(g.declined.employee?g.declined.employee.firstName+' '+(g.declined.employee.lastName||''):'Someone')+' declined: "'+g.declined.declineReason+'"</div>'+
        '</div><span class="badge badge-red">Open</span></div>'+

        '<div class="text-xs semi mb2">Top Replacement Candidates</div>'+
        (g.candidates.length > 0 ?
          '<table><thead><tr><th>Rank</th><th>Employee</th><th>'+g.station.name+' Skill</th><th>Reliability</th><th>Experience</th><th>Score</th><th></th></tr></thead><tbody>'+
          g.candidates.map((c, i) => {
            let stars = '';
            for(let s=0;s<5;s++) stars += s < Math.round(c.skill) ? '★' : '☆';
            return '<tr><td class="semi text-violet">#'+(i+1)+'</td>'+
              '<td><div class="semi">'+(c.employee?c.employee.firstName+' '+(c.employee.lastName||''):'Unknown')+'</div><div class="text-xs text-muted">'+(c.employee?c.employee.phone:'')+'</div></td>'+
              '<td><span style="color:#FBBF24;font-size:10px">'+stars+'</span></td>'+
              '<td class="text-xs">'+c.reliability.toFixed(1)+'/5</td>'+
              '<td class="text-xs">'+(c.employee.years > 0 ? c.employee.years+' yr'+(c.employee.years>1?'s':'') : 'New')+'</td>'+
              '<td class="semi text-violet">'+c.score.toFixed(1)+'</td>'+
              '<td><button class="btn btn-primary btn-sm">📱 Text</button></td></tr>';
          }).join('')+'</tbody></table>' :
          '<div class="text-xs text-muted text-center" style="padding:12px">No qualified candidates available — consider cross-training</div>')+

        '<div style="margin-top:10px;display:flex;gap:8px">'+
          '<button class="btn btn-primary">📱 Text All '+g.candidates.length+' Candidates</button>'+
          '<button class="btn btn-secondary">Assign Floater Instead</button>'+
        '</div></div>';
    }).join('');
}

function renderDemoReplacement(app) {
  app.innerHTML = UI.adminShell('demo-replacement', `<div class="page">${renderDemoReplacementContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO CASCADE (LIVE DEMO)
// ═══════════════════════════════════════════════════════
const demoCascadeSteps = [
  { time:'6:45 AM', icon:'📱', color:'#F87171', title:'Day-Of Callout Received',
    detail:'Jake Martinez texts: "Sorry can\'t make it today, feeling sick"',
    system:'', badge:'Incoming' },
  { time:'6:45 AM', icon:'🤖', color:'#A78BFA', title:'CrewCast Detects Cancellation',
    detail:'Jake was assigned to Hay Cafe (Saturday 8 AM - 4 PM). Skill rating: 4 stars. Shift is in 1 hour 15 minutes.',
    system:'Cancellation auto-detected from SMS keyword "can\'t make it"', badge:'Processing' },
  { time:'6:45 AM', icon:'🔍', color:'#22D3EE', title:'Scanning Replacement Pool',
    detail:'Searching 60-person roster for: available today + Hay Cafe skill 3+ + not already scheduled + reliability 3.5+',
    system:'Found 7 qualified candidates. Ranking by composite score (skill x3 + reliability x2 + experience)...', badge:'Searching' },
  { time:'6:46 AM', icon:'📊', color:'#A78BFA', title:'Candidates Ranked',
    detail:'Top 5 selected:',
    candidates: [
      { name:'Morgan Chen', skill:4.2, reliability:4.5, years:3, score:28.1, phone:'(515) 555-0104' },
      { name:'Casey Brown', skill:3.8, reliability:4.1, years:2, score:24.7, phone:'(515) 555-0107' },
      { name:'Sage Robinson', skill:3.5, reliability:4.3, years:2, score:23.4, phone:'(515) 555-0129' },
      { name:'Rowan Clark', skill:3.2, reliability:3.8, years:1, score:19.8, phone:'(515) 555-0130' },
      { name:'Phoenix Lewis', skill:3.0, reliability:4.0, years:1, score:19.0, phone:'(515) 555-0135' },
    ],
    system:'Candidates ranked. Ready to send.', badge:'Ranked' },
  { time:'6:46 AM', icon:'📤', color:'#60A5FA', title:'Texts Sent to Top 5',
    detail:'Message: "Hey [Name]! Opening at Hay Cafe today (8 AM - 4 PM) due to a callout. You\'re qualified and available. Reply YES to claim this shift. First reply gets it!"',
    system:'5 SMS messages delivered successfully', badge:'Sent' },
  { time:'6:46 AM', icon:'📤', color:'#60A5FA', title:'Steve Notified',
    detail:'To Steve: "Jake Martinez called out from Hay Cafe today. Auto-Replace activated — texted 5 qualified candidates. Will update you when filled."',
    system:'Manager notification sent. No action required from Steve.', badge:'FYI' },
  { time:'6:52 AM', icon:'✅', color:'#34D399', title:'Morgan Chen Replies YES!',
    detail:'Morgan Chen (Hay Cafe skill: 4.2 stars, reliability: 4.5, 3 years experience) claimed the shift.',
    system:'Shift auto-assigned to Morgan. Schedule updated.', badge:'Claimed' },
  { time:'6:52 AM', icon:'📤', color:'#A78BFA', title:'Confirmation Sent to Morgan',
    detail:'To Morgan: "You\'re confirmed for Hay Cafe today, 8 AM - 4 PM. Report 15 min early. Thanks for stepping up!"',
    system:'Shift details + map link sent', badge:'Confirmed' },
  { time:'6:52 AM', icon:'🔕', color:'#64748B', title:'Other 4 Candidates Notified',
    detail:'To Casey, Sage, Rowan, Phoenix: "Thanks for being available! The Hay Cafe shift has been filled. We\'ll keep you in mind for future openings."',
    system:'4 "shift filled" notifications sent', badge:'Closed' },
  { time:'6:53 AM', icon:'✅', color:'#34D399', title:'Steve Gets the All-Clear',
    detail:'To Steve: "Jake\'s Hay Cafe shift covered by Morgan Chen (4.2 star rating). No action needed. Enjoy your coffee."',
    system:'', badge:'Resolved' },
  { time:'—', icon:'🏆', color:'#34D399', title:'Result: 8 Minutes, Zero Manager Effort',
    detail:'From callout to covered shift in 8 minutes. Steve was notified but never had to make a call, send a text, or check a spreadsheet. The system handled everything.',
    system:'Jake\'s reliability score adjusted: 4.1 to 3.8 (callout recorded). Morgan\'s score gets +0.2 bonus for accepting a day-of fill.',
    badge:'Complete' }
];

let demoCascadeAnimStep = 0;
let demoCascadeTimer = null;

function initDemoCascade() {
  demoCascadeAnimStep = 0;
  if(demoCascadeTimer) { clearInterval(demoCascadeTimer); demoCascadeTimer = null; }
}

function startDemoCascade() {
  const btn = document.getElementById('cascade-play-btn');
  if(btn) btn.innerHTML = '⏸ Playing...';
  if(btn) btn.disabled = true;
  demoCascadeAnimStep = 0;
  demoCascadeSteps.forEach((_, i) => {
    const el = document.getElementById('cascade-step-'+i);
    if(el) { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; }
  });
  function showNext() {
    if(demoCascadeAnimStep >= demoCascadeSteps.length) {
      if(demoCascadeTimer) { clearInterval(demoCascadeTimer); demoCascadeTimer = null; }
      if(btn) { btn.innerHTML = '✓ Complete'; btn.disabled = false; }
      return;
    }
    const el = document.getElementById('cascade-step-'+demoCascadeAnimStep);
    if(el) { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; el.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
    demoCascadeAnimStep++;
  }
  showNext();
  demoCascadeTimer = setInterval(showNext, 1500);
}

function resetDemoCascade() {
  if(demoCascadeTimer) { clearInterval(demoCascadeTimer); demoCascadeTimer = null; }
  demoCascadeAnimStep = 0;
  demoCascadeSteps.forEach((_, i) => {
    const el = document.getElementById('cascade-step-'+i);
    if(el) { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; }
  });
  const btn = document.getElementById('cascade-play-btn');
  if(btn) { btn.innerHTML = '▶ Play Scenario'; btn.disabled = false; }
}

function renderDemoCascadeContent() {
  let flowSteps = '<div class="card" style="border-color:rgba(167,139,250,.3);margin-bottom:16px">'+
    '<div class="card-header"><div class="card-title text-violet">The Auto-Fill Cascade — How It Works</div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px">'+
    [
      {n:'1',t:'Decline/Callout',d:'Employee says NO, no-shows, or calls out day-of',c:'#F87171'},
      {n:'2',t:'Score & Rank',d:'Algorithm scores all available qualified employees',c:'#22D3EE'},
      {n:'3',t:'Text Top 5',d:'Instant SMS to best candidates. First YES wins.',c:'#60A5FA'},
      {n:'4',t:'Auto-Assign',d:'Winner confirmed, others notified, schedule updated',c:'#34D399'},
      {n:'5',t:'Manager FYI',d:'Steve gets a summary. Zero effort required.',c:'#A78BFA'},
    ].map(s => {
      return '<div style="background:#0F172A;border-radius:8px;padding:10px;text-align:center;border-top:3px solid '+s.c+'">'+
        '<div class="bold" style="font-size:18px;color:'+s.c+';margin-bottom:4px">'+s.n+'</div>'+
        '<div class="text-xs semi mb1">'+s.t+'</div>'+
        '<div style="font-size:8px;color:#64748B">'+s.d+'</div></div>';
    }).join('')+
    '</div></div>';

  let scenario = '<div class="card"><div class="card-header">'+
    '<div><div class="card-title">🎬 Live Scenario: Saturday Morning Callout</div>'+
    '<div class="text-xs text-muted">Watch the system handle a day-of cancellation in real time</div></div>'+
    '<div class="flex gap2">'+
      '<button class="btn btn-primary" onclick="startDemoCascade()" id="cascade-play-btn">▶ Play Scenario</button>'+
      '<button class="btn btn-secondary" onclick="resetDemoCascade()">↺ Reset</button>'+
    '</div></div>'+
    '<div style="position:relative;padding-left:28px" id="cascade-timeline">';

  demoCascadeSteps.forEach((step, i) => {
    const isResult = i === demoCascadeSteps.length - 1;
    scenario += '<div class="cascade-step" id="cascade-step-'+i+'" style="opacity:0;transform:translateY(10px);transition:all 0.4s ease;margin-bottom:12px;position:relative">'+
      '<div style="position:absolute;left:-22px;top:6px;width:12px;height:12px;border-radius:50%;background:'+step.color+';border:2px solid #0F172A;z-index:1"></div>'+
      (i < demoCascadeSteps.length-1 ? '<div style="position:absolute;left:-17px;top:18px;width:2px;height:calc(100% + 4px);background:#334155"></div>' : '')+
      '<div style="background:'+(isResult?'rgba(52,211,153,.06)':'#0F172A')+';border-radius:10px;padding:12px;border:1px solid '+(isResult?'rgba(52,211,153,.3)':'#334155')+'">'+
        '<div class="flex justify-between items-center mb1">'+
          '<div class="flex items-center gap2"><span style="font-size:16px">'+step.icon+'</span><span class="semi text-sm" style="color:'+step.color+'">'+step.title+'</span></div>'+
          '<div class="flex items-center gap2"><span class="text-xs text-muted">'+step.time+'</span>'+
            '<span class="badge" style="background:rgba('+(step.color==='#F87171'?'239,68,68':step.color==='#34D399'?'52,211,153':step.color==='#22D3EE'?'34,211,238':step.color==='#60A5FA'?'96,165,250':step.color==='#64748B'?'100,116,139':'167,139,250')+',.15);color:'+step.color+'">'+step.badge+'</span></div></div>'+
        '<div class="text-xs" style="color:#CBD5E1;line-height:1.5">'+step.detail+'</div>';

    if(step.candidates) {
      scenario += '<table style="margin-top:8px"><thead><tr><th>Rank</th><th>Name</th><th>Cafe Skill</th><th>Reliability</th><th>Exp</th><th>Score</th></tr></thead><tbody>';
      step.candidates.forEach((c, ci) => {
        let stars = '';
        for(let s=0;s<5;s++) stars += s < Math.round(c.skill) ? '★' : '☆';
        scenario += '<tr style="'+(ci===0?'background:rgba(52,211,153,.05)':'')+'"><td class="semi text-violet">#'+(ci+1)+'</td><td class="semi">'+c.name+'</td><td><span style="color:#FBBF24;font-size:9px">'+stars+'</span> <span class="text-xs">'+c.skill+'</span></td><td class="text-xs">'+c.reliability+'/5</td><td class="text-xs">'+c.years+' yr'+(c.years>1?'s':'')+'</td><td class="semi text-violet">'+c.score+'</td></tr>';
      });
      scenario += '</tbody></table>';
    }
    if(step.system) {
      scenario += '<div style="margin-top:6px;background:rgba(167,139,250,.05);border-radius:6px;padding:6px 8px;border:1px solid rgba(167,139,250,.1)"><span class="text-xs text-violet">🤖 '+step.system+'</span></div>';
    }
    scenario += '</div></div>';
  });
  scenario += '</div></div>';

  let summary = '<div class="card" style="border-color:rgba(52,211,153,.3);background:rgba(16,185,129,.03)">'+
    '<div class="card-title text-green mb3">📊 Cascade Performance Metrics</div>'+
    '<div class="grid4">'+
      '<div class="stat-card"><div class="stat-label">Avg Fill Time</div><div class="stat-value text-green">8m</div><div class="stat-sub">from callout to covered</div></div>'+
      '<div class="stat-card"><div class="stat-label">Manager Actions</div><div class="stat-value text-violet">0</div><div class="stat-sub">fully autonomous</div></div>'+
      '<div class="stat-card"><div class="stat-label">Fill Rate</div><div class="stat-value text-green">94%</div><div class="stat-sub">shifts auto-filled</div></div>'+
      '<div class="stat-card"><div class="stat-label">Texts Per Fill</div><div class="stat-value text-cyan">7</div><div class="stat-sub">avg messages sent</div></div>'+
    '</div></div>';

  let escalation = '<div class="card"><div class="card-title mb3">🔄 Full Cascade Tiers — What If Nobody Bites?</div>'+
    '<div style="display:grid;gap:8px">'+
    [
      { tier:'Tier 1 — Immediate (0-2 min)', desc:'Text top 5 qualified candidates. First YES wins. 94% of fills happen here.', color:'#34D399', timing:'Instant' },
      { tier:'Tier 2 — Widen Pool (2 hours)', desc:'Lower skill threshold from 3+ to 2+, include employees who listed "maybe" availability.', color:'#FBBF24', timing:'If Tier 1 fails' },
      { tier:'Tier 3 — Floater Redirect (4 hours)', desc:'Pull a scheduled floater from another station. Reduce Float/General coverage temporarily.', color:'#F59E0B', timing:'If Tier 2 fails' },
      { tier:'Tier 4 — Overtime Offer (6 hours)', desc:'Offer overtime to someone already working a different shift that day.', color:'#F87171', timing:'If Tier 3 fails' },
      { tier:'Tier 5 — Manager Decision (12 hrs before)', desc:'Escalate to Steve with 3 options: approve OT, merge station, or accept reduced staffing.', color:'#EF4444', timing:'Last resort' },
    ].map(t => {
      return '<div style="background:#0F172A;border-radius:8px;padding:12px;border-left:3px solid '+t.color+'">'+
        '<div class="flex justify-between items-center mb1"><span class="semi text-sm" style="color:'+t.color+'">'+t.tier+'</span><span class="badge badge-gray">'+t.timing+'</span></div>'+
        '<div class="text-xs text-muted">'+t.desc+'</div></div>';
    }).join('')+
    '</div></div>';

  return flowSteps + scenario + summary + escalation;
}

function renderDemoCascade(app) {
  app.innerHTML = UI.adminShell('demo-cascade', `<div class="page">${renderDemoCascadeContent()}</div>`);
  initDemoCascade();
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO SWAPS
// ═══════════════════════════════════════════════════════
function renderDemoSwapsContent() {
  const days = getDemoSelectedDays();
  const d0 = days[0], d1 = days[1] || days[0];
  const swaps = [
    { from:DEMO_EMPLOYEES[3], fromDay:d0, fromSt:'animals', to:DEMO_EMPLOYEES[8], toDay:d1, toSt:'animals', status:'pending', reason:'Dentist appointment' },
    { from:DEMO_EMPLOYEES[12], fromDay:d1, fromSt:'parking', to:DEMO_EMPLOYEES[18], toDay:d1, toSt:'parking', status:'approved', reason:'Family event' },
    { from:DEMO_EMPLOYEES[7], fromDay:d0, fromSt:'store', to:null, toDay:d0, toSt:'store', status:'open', reason:'Birthday lunch' },
  ];

  return demoDateSelector() +
    '<h1>🔄 Shift Swap Board</h1>'+
    '<div class="subtitle">Employees can trade shifts — manager approves to ensure coverage</div>'+

    '<div class="grid3 mb4">'+
      '<div class="stat-card"><div class="stat-label">Open Requests</div><div class="stat-value text-amber">'+swaps.filter(s=>s.status==='open').length+'</div></div>'+
      '<div class="stat-card"><div class="stat-label">Pending Approval</div><div class="stat-value text-violet">'+swaps.filter(s=>s.status==='pending').length+'</div></div>'+
      '<div class="stat-card"><div class="stat-label">Approved</div><div class="stat-value text-green">'+swaps.filter(s=>s.status==='approved').length+'</div></div>'+
    '</div>'+

    '<div class="card"><div class="card-header"><div class="card-title">📋 Swap Requests</div><span class="badge badge-violet">This Weekend</span></div>'+
    '<div style="display:grid;gap:10px">'+
    swaps.map(s => {
      const stObj = demoGetSt(s.fromSt);
      const borderColor = s.status==='approved' ? 'rgba(52,211,153,.3)' : s.status==='pending' ? 'rgba(167,139,250,.3)' : 'rgba(251,191,36,.3)';
      const statusBadge = s.status==='approved' ? '<span class="badge badge-green">✓ Approved</span>' : s.status==='pending' ? '<span class="badge badge-violet">Needs Approval</span>' : '<span class="badge badge-amber">Looking for Taker</span>';
      const dayLabel = DEMO_CROWD[s.fromDay] ? DEMO_CROWD[s.fromDay].day : s.fromDay;

      return '<div class="swap-card" style="border-color:'+borderColor+'">'+
        '<div class="flex justify-between items-center mb2">'+
          '<div class="semi text-sm">'+stObj.icon+' '+stObj.name+' — '+dayLabel+'</div>'+statusBadge+
        '</div>'+
        '<div class="grid2" style="gap:8px;margin-bottom:8px">'+
          '<div style="background:#0F172A;border-radius:6px;padding:8px;border-left:3px solid #F87171">'+
            '<div class="text-xs text-muted">Giving up shift</div>'+
            '<div class="text-xs semi">'+s.from.firstName+' '+s.from.lastName+'</div>'+
            '<div class="text-xs text-muted">Reason: '+s.reason+'</div></div>'+
          '<div style="background:#0F172A;border-radius:6px;padding:8px;border-left:3px solid '+(s.to?'#34D399':'#FBBF24')+'">'+
            '<div class="text-xs text-muted">Taking shift</div>'+
            (s.to ? '<div class="text-xs semi">'+s.to.firstName+' '+s.to.lastName+'</div>' : '<div class="text-xs text-amber semi">No taker yet — posted to swap board</div>')+
          '</div>'+
        '</div>'+
        (s.status==='pending' ? '<div class="flex gap2"><button class="btn btn-success btn-sm">✓ Approve Swap</button><button class="btn btn-danger btn-sm">✗ Deny</button></div>' :
         s.status==='open' ? '<div class="flex gap2"><button class="btn btn-primary btn-sm">📱 Text Qualified Staff</button><button class="btn btn-secondary btn-sm">Post to Group</button></div>' : '')+
      '</div>';
    }).join('')+
    '</div></div>';
}

function renderDemoSwaps(app) {
  app.innerHTML = UI.adminShell('demo-swaps', `<div class="page">${renderDemoSwapsContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO SMS CENTER
// ═══════════════════════════════════════════════════════
function renderDemoSmsContent() {
  const wk = CG_SPRING_WEEKENDS[DEMO_SELECTED_WEEKEND];
  const dayRange = wk.label.split(' — ')[1] || 'May 2-3';
  const msgs = [
    { dir:'out', to:'All scheduled staff', count:42, msg:'🌷 Spring on the Farm — '+dayRange+' schedule is live! Check your shifts and reply YES to confirm or NO if you can\'t make it. Respond by Thursday 8 PM.', time:'Wednesday, 4:00 PM' },
    { dir:'in', from:'Emma Johnson', msg:'YES — both days! See you there 🌷', time:'Wednesday, 5:12 PM' },
    { dir:'in', from:'Morgan Chen', msg:'Yes Saturday works!', time:'Wednesday, 5:30 PM' },
    { dir:'out', to:'Morgan Chen', msg:'✅ Sat confirmed: Baby Animal Barn 9 AM–5 PM.', time:'Wednesday, 5:31 PM' },
    { dir:'in', from:'Jordan Lee', msg:'Sorry can\'t do this weekend — family thing', time:'Wednesday, 8:20 PM' },
    { dir:'out', to:'Steve (You)', msg:'⚠️ Jordan Lee declined. Auto-Replace found 5 candidates. Text them?', time:'Wednesday, 8:21 PM' },
    { dir:'in', from:'Taylor Smith', msg:'Confirmed for Sunday!', time:'Thursday, 7:30 AM' },
    { dir:'in', from:'Riley Walker', msg:'I can do Sat but not Sun', time:'Thursday, 8:45 AM' },
    { dir:'out', to:'Riley Walker', msg:'✅ Sat confirmed. Sun shift released — finding replacement.', time:'Thursday, 8:46 AM' },
    { dir:'out', to:'12 pending staff', count:12, msg:'⏰ Reminder: Your shifts need confirmation. Reply YES or NO by tonight 8 PM.', time:'Thursday, 12:00 PM' },
    { dir:'in', from:'Avery Davis', msg:'YES for both days 👍', time:'Thursday, 12:18 PM' },
    { dir:'in', from:'Casey Brown', msg:'Can\'t do it, picked up shift at HyVee', time:'Thursday, 1:30 PM' },
    { dir:'out', to:'Steve (You)', msg:'⚠️ Casey Brown declined Hay Cafe. 3 qualified replacements found. Texting now.', time:'Thursday, 1:31 PM' },
  ];

  return demoDateSelector() +
    '<h1>📱 SMS Center</h1><div class="subtitle">Automated messaging — notifications, confirmations, and reminders</div>'+
    '<div class="grid3 mb4">'+
      '<div class="stat-card"><div class="stat-label">Messages Sent</div><div class="stat-value text-violet">'+msgs.filter(m=>m.dir==='out').reduce((s,m)=>s+(m.count||1),0)+'</div></div>'+
      '<div class="stat-card"><div class="stat-label">Replies Received</div><div class="stat-value text-green">'+msgs.filter(m=>m.dir==='in').length+'</div></div>'+
      '<div class="stat-card"><div class="stat-label">Response Rate</div><div class="stat-value text-amber">58%</div><div class="stat-sub">replied so far</div></div>'+
    '</div>'+

    '<div class="card"><div class="card-header"><div class="card-title">Message Thread</div><button class="btn btn-primary btn-sm">+ New Broadcast</button></div>'+
    '<div style="display:grid;gap:8px;max-height:500px;overflow-y:auto">'+
    msgs.map(m => {
      if(m.dir==='out') {
        return '<div style="margin-left:auto"><div class="sms sms-out"><div class="text-xs">'+m.msg+'</div><div class="sms-time">'+m.time+'</div></div></div>';
      } else {
        return '<div style="margin-right:auto"><div style="font-size:9px;color:#64748B;margin-bottom:2px">'+m.from+' ('+m.time+')</div><div class="sms sms-in"><div class="text-xs">'+m.msg+'</div><div class="sms-time">'+m.time+'</div></div></div>';
      }
    }).join('')+
    '</div></div>';
}

function renderDemoSms(app) {
  app.innerHTML = UI.adminShell('demo-sms', `<div class="page">${renderDemoSmsContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO COSTS
// ═══════════════════════════════════════════════════════
function renderDemoCostsContent() {
  const days = getDemoSelectedDays();
  const gaps = [];
  let totalLost = 0;
  let projTotal = 0;
  days.forEach(day => {
    projTotal += (DEMO_CROWD[day]||{}).projected || 0;
    if (!DEMO_ASSIGNED[day]) return;
    Object.entries(DEMO_ASSIGNED[day]).forEach(([stId, arr]) => {
      const st = demoGetSt(stId);
      const declined = arr.filter(a=>a.status==='declined').length;
      if(declined > 0 && st && st.revPerHr > 0) {
        const hrs = st.close - st.open;
        const lost = st.revPerHr * hrs * (declined / (DEMO_NEEDS[day][stId]||1));
        totalLost += lost;
        gaps.push({ day:day, station:st, declined:declined, need:DEMO_NEEDS[day][stId], hrs:hrs, lost:lost });
      }
    });
  });

  const safetyGaps = [];
  days.forEach(day => {
    if (!DEMO_ASSIGNED[day]) return;
    Object.entries(DEMO_ASSIGNED[day]).forEach(([stId, arr]) => {
      const st = demoGetSt(stId);
      const declined = arr.filter(a=>a.status==='declined').length;
      if(declined > 0 && st && st.revPerHr === 0) {
        safetyGaps.push({ day:day, station:st, declined:declined, need:DEMO_NEEDS[day][stId] });
      }
    });
  });

  const weekendRev = Math.round(projTotal * 12.50);

  return demoDateSelector() +
    '<h1>💰 Cost of Gaps</h1><div class="subtitle">Estimated revenue impact when stations are understaffed</div>'+

    '<div class="grid3 mb4">'+
      '<div class="stat-card"><div class="stat-label">Revenue at Risk</div><div class="stat-value text-red">$'+Math.round(totalLost).toLocaleString()+'</div><div class="stat-sub">if gaps unfilled</div></div>'+
      '<div class="stat-card"><div class="stat-label">Weekend Revenue Target</div><div class="stat-value text-green">$'+weekendRev.toLocaleString()+'</div><div class="stat-sub">at $12.50 avg/visitor</div></div>'+
      '<div class="stat-card"><div class="stat-label">Gap % of Revenue</div><div class="stat-value text-amber">'+(weekendRev > 0 ? Math.round(totalLost/weekendRev*100) : 0)+'%</div><div class="stat-sub">recoverable with coverage</div></div>'+
    '</div>'+

    (gaps.length > 0 ? '<div class="card"><div class="card-title mb3">💸 Revenue-Generating Stations with Gaps</div>'+
    '<table><thead><tr><th>Station</th><th>Day</th><th>Rev/Hour</th><th>Gap</th><th>Hours</th><th>Est. Lost</th></tr></thead><tbody>'+
    gaps.map(g => {
      const dayLabel = DEMO_CROWD[g.day] ? DEMO_CROWD[g.day].day.substring(0,3) : g.day;
      return '<tr><td class="semi">'+g.station.icon+' '+g.station.name+'</td>'+
        '<td>'+dayLabel+'</td><td class="text-green">$'+g.station.revPerHr+'</td>'+
        '<td><span class="badge badge-red">-'+g.declined+' of '+g.need+'</span></td>'+
        '<td>'+g.hrs+' hrs</td><td class="semi text-red">$'+Math.round(g.lost).toLocaleString()+'</td></tr>';
    }).join('')+
    '<tr style="background:rgba(239,68,68,.05)"><td colspan="5" class="semi" style="text-align:right">Total Revenue at Risk:</td><td class="semi text-red bold">$'+Math.round(totalLost).toLocaleString()+'</td></tr>'+
    '</tbody></table></div>' : '')+

    '<div class="card" style="border-color:rgba(52,211,153,.3);background:rgba(16,185,129,.03)">'+
      '<div class="card-title text-green mb2">💡 The CrewCast ROI</div>'+
      '<div class="text-xs text-muted">By auto-filling gaps within minutes, CrewCast recovers <strong class="text-green">$'+Math.round(totalLost).toLocaleString()+'</strong> in at-risk revenue this weekend alone. Over a 10-weekend spring season, that compounds to <strong class="text-green">$'+Math.round(totalLost*6).toLocaleString()+'+ annually</strong> in protected revenue.</div>'+
    '</div>';
}

function renderDemoCosts(app) {
  app.innerHTML = UI.adminShell('demo-costs', `<div class="page">${renderDemoCostsContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO ALERTS
// ═══════════════════════════════════════════════════════
function renderDemoAlertsContent() {
  const days = getDemoSelectedDays();
  let decTotal = 0, pendTotal = 0;
  days.forEach(day => { decTotal += demoCountAll(day,'declined'); pendTotal += demoCountAll(day,'pending'); });
  const firstDay = DEMO_CROWD[days[0]] || {};

  return demoDateSelector() +
    '<h1>🚨 Alerts</h1><div class="subtitle">Issues requiring your attention</div>'+

    '<div class="card" style="border-color:rgba(167,139,250,.4);border-width:2px"><div class="card-header"><div class="card-title text-violet">🔔 Needs Your Decision</div></div>'+
    '<div style="display:grid;gap:10px">'+

    (decTotal > 0 ?
    '<div style="background:#0F172A;border-radius:10px;padding:14px;border:1px solid rgba(239,68,68,.3)">'+
      '<div class="flex justify-between items-center mb2"><span class="semi text-red text-sm">🚨 '+decTotal+' employees declined — should I find replacements?</span><span class="badge badge-red">High Priority</span></div>'+
      '<p class="text-xs text-muted mb2">I\'ve already ranked qualified candidates for each open slot. Say the word and I\'ll text the top 5 for each gap.</p>'+
      '<div class="flex gap2" id="alert-decline-btns">'+
        '<button class="btn btn-success btn-sm" onclick="alertDecisionDemo(\'decline\',true)">👍 Yes, Text Replacements Now</button>'+
        '<button class="btn btn-secondary btn-sm" onclick="Router.navigate(\'/admin/demo/replacement\')">Let Me Review First</button>'+
      '</div><div id="alert-decline-result" style="display:none"></div></div>' : '')+

    (pendTotal > 0 ?
    '<div style="background:#0F172A;border-radius:10px;padding:14px;border:1px solid rgba(251,191,36,.3)">'+
      '<div class="flex justify-between items-center mb2"><span class="semi text-amber text-sm">⏰ '+pendTotal+' employees still haven\'t responded</span><span class="badge badge-amber">Deadline 8 PM</span></div>'+
      '<p class="text-xs text-muted mb2">Want me to send a final "last chance" text? After 8 PM, I\'ll auto-release their shifts.</p>'+
      '<div class="flex gap2" id="alert-pending-btns">'+
        '<button class="btn btn-success btn-sm" onclick="alertDecisionDemo(\'pending\',true)">👍 Send Final Reminder</button>'+
        '<button class="btn btn-secondary btn-sm" onclick="alertDecisionDemo(\'pending\',false)">👎 Skip It, Release at 8 PM</button>'+
      '</div><div id="alert-pending-result" style="display:none"></div></div>' : '')+

    '<div style="background:#0F172A;border-radius:10px;padding:14px;border:1px solid rgba(52,211,153,.3)">'+
      '<div class="flex justify-between items-center mb2"><span class="semi text-green text-sm">☀️ '+firstDay.day+' looking strong — want extra floaters?</span><span class="badge badge-green">Recommendation</span></div>'+
      '<p class="text-xs text-muted mb2"><b>'+(firstDay.projected||2800).toLocaleString()+' visitors</b> projected. I\'d recommend adding <b>2 more floaters</b>.</p>'+
      '<div class="flex gap2" id="alert-surge-btns">'+
        '<button class="btn btn-success btn-sm" onclick="alertDecisionDemo(\'surge\',true)">👍 Do it — add 2 floaters</button>'+
        '<button class="btn btn-secondary btn-sm" onclick="alertDecisionDemo(\'surge\',false)">Nah, we\'ll manage</button>'+
      '</div><div id="alert-surge-result" style="display:none"></div></div>'+

    '</div></div>';
}

function alertDecisionDemo(type, approved) {
  const btns = document.getElementById('alert-'+type+'-btns');
  const result = document.getElementById('alert-'+type+'-result');
  if(btns) btns.style.display = 'none';
  if(!result) return;
  result.style.display = 'block';
  const responses = {
    decline: { yes:'Done! Texting top 5 candidates for each open shift now. Average fill time: 8 minutes.', no:'' },
    pending: { yes:'Final reminder sent to all pending employees. I\'ll start auto-filling at 8:01 PM.', no:'Skipping the reminder. At 8 PM I\'ll release all pending shifts automatically.' },
    surge: { yes:'Texting 4 qualified floaters now. First 2 to reply YES are in.', no:'Got it — sticking with current floaters. I\'ll ping you if lines get long.' }
  };
  const msg = approved ? responses[type].yes : responses[type].no;
  const cls = approved ? 'rgba(52,211,153' : 'rgba(100,116,139';
  result.innerHTML = '<div style="background:'+cls+',.06);border-radius:6px;padding:8px 10px;border:1px solid '+cls+',.2);margin-top:8px"><div class="text-xs '+(approved?'text-green':'text-muted')+' semi">'+(approved?'✅ On it.':'👍 Noted.')+'</div><div class="text-xs text-muted mt1">'+msg+'</div></div>';
}

function renderDemoAlerts(app) {
  app.innerHTML = UI.adminShell('demo-alerts', `<div class="page">${renderDemoAlertsContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO ROSTER
// ═══════════════════════════════════════════════════════
function renderDemoRosterContent() {
  const active = DEMO_EMPLOYEES.filter(e=>e.status==='active');
  const inactive = DEMO_EMPLOYEES.filter(e=>e.status!=='active');

  return '<h1>👥 Employee Roster</h1>'+
    '<div class="subtitle">'+active.length+' active · '+inactive.length+' inactive · 60 spring season roster</div>'+

    '<div class="card" style="padding:0;overflow-x:auto">'+
    '<table><thead><tr><th>Employee</th><th>Overall</th><th>Reliability</th><th>Experience</th><th>Station Skills</th><th>Sat Avail</th><th>Sun Avail</th><th>Mon Avail</th><th>Status</th></tr></thead>'+
    '<tbody>'+
    active.map(e => {
      return '<tr><td><div class="semi">'+e.firstName+' '+e.lastName+'</div><div class="text-xs text-muted">'+e.phone+'</div></td>'+
        '<td><span style="color:#FBBF24;font-size:9px">'+Array(Math.round(e.overall)).fill('★').join('')+Array(5-Math.round(e.overall)).fill('☆').join('')+'</span></td>'+
        '<td class="text-xs">'+e.reliability.toFixed(1)+'</td>'+
        '<td class="text-xs">'+(e.years > 0 ? e.years+' yr'+(e.years>1?'s':'') : 'New')+'</td>'+
        '<td><div class="flex gap1 flex-wrap">'+
          Object.entries(e.skills).map(([stId, r]) => {
            const st = demoGetSt(stId);
            const cls = r >= 4 ? 'tag-green' : r >= 3 ? 'tag-amber' : 'tag-red';
            return st ? '<span class="tag '+cls+'">'+st.icon+Math.round(r)+'★</span>' : '';
          }).join('')+
        '</div></td>'+
        '<td>'+(e.availability.Sat ? '<span class="tag tag-green">'+demoFmtHs(e.availability.Sat.start)+'-'+demoFmtHs(e.availability.Sat.end)+'</span>' : '<span class="tag tag-red">Off</span>')+'</td>'+
        '<td>'+(e.availability.Sun ? '<span class="tag tag-green">'+demoFmtHs(e.availability.Sun.start)+'-'+demoFmtHs(e.availability.Sun.end)+'</span>' : '<span class="tag tag-red">Off</span>')+'</td>'+
        '<td>'+(e.availability.Mon ? '<span class="tag tag-green">'+demoFmtHs(e.availability.Mon.start)+'-'+demoFmtHs(e.availability.Mon.end)+'</span>' : '<span class="tag tag-red">Off</span>')+'</td>'+
        '<td><span class="badge badge-green">active</span></td></tr>';
    }).join('')+
    '</tbody></table>'+
    '<div style="padding:10px;text-align:center"><span class="text-xs text-muted">'+active.length+' active · '+inactive.length+' inactive</span></div>'+
    '</div>';
}

function renderDemoRoster(app) {
  app.innerHTML = UI.adminShell('demo-roster', `<div class="page">${renderDemoRosterContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO EMPLOYEE VIEW
// ═══════════════════════════════════════════════════════
function renderDemoEmployeeContent() {
  const emp = DEMO_EMPLOYEES[0];
  const days = getDemoSelectedDays();
  const d0 = DEMO_CROWD[days[0]] || {};
  const d1 = DEMO_CROWD[days[1]] || {};

  return '<h1>👤 Employee View</h1><div class="subtitle">What employees see via their SMS schedule link</div>'+

    '<div class="card" style="max-width:400px;margin:0 auto;border-color:rgba(167,139,250,.3)">'+
      '<div class="text-center mb3"><div class="text-xs text-muted">📱 Phone View</div><div class="semi" style="font-size:15px;margin-top:4px">Spring on the Farm</div><div class="text-xs text-muted">'+CG_SPRING_WEEKENDS[DEMO_SELECTED_WEEKEND].label.split(' — ')[1]+' · Center Grove Orchard</div></div>'+
      '<div style="background:#0F172A;border-radius:10px;padding:12px;margin-bottom:10px">'+
        '<div class="flex justify-between items-center mb2"><div class="semi">'+emp.firstName+' '+emp.lastName+'</div><span class="badge badge-green">✓ Confirmed</span></div>'+
        (d0.day ? '<div class="text-xs text-muted semi mb1" style="text-transform:uppercase;letter-spacing:.5px">'+d0.day+', '+d0.date+'</div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Station</span><span class="text-xs semi">🌷 Tulip U-Pick</span></div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Shift</span><span class="text-xs semi">9:00 AM – 5:00 PM</span></div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Weather</span><span class="text-xs semi">'+d0.weather.icon+' '+d0.weather.temp+'° '+d0.weather.condition+'</span></div>' : '')+
        (d1.day ? '<div style="height:8px"></div>'+
        '<div class="text-xs text-muted semi mb1" style="text-transform:uppercase;letter-spacing:.5px">'+d1.day+', '+d1.date+'</div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Station</span><span class="text-xs semi">🐣 Baby Animal Barn</span></div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Shift</span><span class="text-xs semi">9:00 AM – 5:00 PM</span></div>'+
        '<div style="padding:5px 0" class="flex justify-between"><span class="text-xs text-muted">Weather</span><span class="text-xs semi">'+d1.weather.icon+' '+d1.weather.temp+'° '+d1.weather.condition+'</span></div>' : '')+
      '</div>'+
      '<div style="background:rgba(52,211,153,.06);border-radius:8px;padding:8px;text-align:center;border:1px solid rgba(52,211,153,.2)">'+
        '<div class="text-xs text-green semi">✓ You\'re confirmed!</div>'+
        '<div class="text-xs text-muted mt1">Report by 8:45 AM · Wear sunscreen 🌷</div></div>'+
    '</div>';
}

function renderDemoEmployee(app) {
  app.innerHTML = UI.adminShell('demo-employee', `<div class="page">${renderDemoEmployeeContent()}</div>`);
}

// ═══════════════════════════════════════════════════════
// STORM MODE STATE & FUNCTIONS
// ═══════════════════════════════════════════════════════
let demoDemoStormCuts = {};
let demoStormDay = 'May 2';
let demoStormExecuted = false;

function demoGetStationStaff(day) {
  const assigned = {};
  DEMO_STATIONS.forEach(s=>{
    const arr = DEMO_ASSIGNED[day] && DEMO_ASSIGNED[day][s.id] ? DEMO_ASSIGNED[day][s.id] : [];
    assigned[s.id] = arr.length;
  });
  return assigned;
}

function refreshDemoStorm() {
  const app = document.getElementById('app');
  if(app) renderDemoStorm(app);
}

function demoStormToggle(stationId, scheduled) {
  if(demoDemoStormCuts[stationId] >= scheduled) { demoDemoStormCuts[stationId] = 0; }
  else { demoDemoStormCuts[stationId] = scheduled; }
  refreshDemoStorm();
}

function demoStormSetKeep(stationId, scheduled, keepVal) {
  const keep = Math.max(0, Math.min(scheduled, parseInt(keepVal) || 0));
  demoDemoStormCuts[stationId] = scheduled - keep;
  refreshDemoStorm();
}

function demoStormCloseOutdoor() {
  const staffCounts = demoGetStationStaff(demoStormDay);
  DEMO_STATIONS.forEach(s=>{
    if(!s.indoor) demoDemoStormCuts[s.id] = staffCounts[s.id];
    else demoDemoStormCuts[s.id] = 0;
  });
  refreshDemoStorm();
}

function demoStormCutByPct(pct) {
  const staffCounts = demoGetStationStaff(demoStormDay);
  DEMO_STATIONS.forEach(s=>{
    demoDemoStormCuts[s.id] = Math.round(staffCounts[s.id] * (pct / 100));
  });
  refreshDemoStorm();
}

function demoStormKeepEssential() {
  const staffCounts = demoGetStationStaff(demoStormDay);
  DEMO_STATIONS.forEach(s=>{
    if(s.indoor || s.id === 'parking' || s.id === 'grounds') demoDemoStormCuts[s.id] = 0;
    else demoDemoStormCuts[s.id] = staffCounts[s.id];
  });
  refreshDemoStorm();
}

function demoStormReset() {
  demoDemoStormCuts = {};
  DEMO_STATIONS.forEach(s=>{ demoDemoStormCuts[s.id] = 0; });
  refreshDemoStorm();
}

function demoStormCustom() {
  const inp = document.getElementById('storm-custom-input');
  const reply = document.getElementById('storm-custom-reply');
  if(!inp || !inp.value.trim()) return;
  const msg = inp.value.trim();
  const lower = msg.toLowerCase();
  const staffCounts = demoGetStationStaff(demoStormDay);

  const exceptMatch = lower.match(/close (?:everything|all)(?:.*?)except (.*)/);
  if(exceptMatch) {
    const keepNames = exceptMatch[1];
    DEMO_STATIONS.forEach(s=>{
      const shortNames = [s.id, s.name.toLowerCase().split('/')[0].trim(), s.name.toLowerCase().split(' ')[0]];
      const shouldKeep = shortNames.some(n=>keepNames.indexOf(n) > -1);
      demoDemoStormCuts[s.id] = shouldKeep ? 0 : staffCounts[s.id];
    });
    demoDemoStormCuts['grounds'] = 0;
  } else {
    const p = demoParseCustomMsg(msg);
    if(p.station) {
      const sid = DEMO_STATIONS.find(s=>s.name === p.station);
      if(sid) {
        if(p.action === 'remove' || lower.indexOf('close') > -1 || lower.indexOf('shut') > -1) {
          demoDemoStormCuts[sid.id] = staffCounts[sid.id];
        } else if(p.count) {
          demoDemoStormCuts[sid.id] = Math.max(0, staffCounts[sid.id] - parseInt(p.count));
        }
      }
    }
  }
  reply.style.display = 'block';
  reply.innerHTML = demoBuildSmartReply(msg);
  setTimeout(() => { refreshDemoStorm(); }, 1500);
}

function demoStormExecute(count) {
  if(demoStormExecuted) return;
  demoStormExecuted = true;
  const result = document.getElementById('storm-execute-result');
  if(!result) return;
  result.style.display = 'block';
  const changes = [];
  DEMO_STATIONS.forEach(s=>{
    const cut = demoDemoStormCuts[s.id] || 0;
    if(cut > 0) {
      const staffCounts = demoGetStationStaff(demoStormDay);
      const scheduled = staffCounts[s.id];
      if(cut >= scheduled) changes.push(s.icon + ' ' + s.name + ' — <strong class="text-red">CLOSED</strong>');
      else changes.push(s.icon + ' ' + s.name + ' — reduced by ' + cut);
    }
  });
  result.innerHTML = '<div style="background:rgba(52,211,153,.06);border-radius:8px;padding:14px;border:1px solid rgba(52,211,153,.2)">'+
    '<div class="text-sm text-green semi" style="margin-bottom:8px">✅ Storm Mode Activated</div>'+
    '<div class="text-xs text-muted" style="margin-bottom:8px">Texting '+count+' employees now.</div>'+
    '<div class="text-xs text-muted" style="line-height:1.8">'+changes.join('<br>')+'</div>'+
    '<div class="text-xs text-green semi" style="margin-top:8px">📱 All notifications sent.</div></div>';
}

function renderDemoStormContent() {
  demoStormExecuted = false;
  const days = getDemoSelectedDays();
  if (!DEMO_CROWD[demoStormDay] || !days.includes(demoStormDay)) demoStormDay = days[0];
  const staffCounts = demoGetStationStaff(demoStormDay);
  let totalScheduled = 0;
  DEMO_STATIONS.forEach(s=>{ totalScheduled += staffCounts[s.id]; });

  if(Object.keys(demoDemoStormCuts).length === 0) {
    DEMO_STATIONS.forEach(s=>{ demoDemoStormCuts[s.id] = 0; });
  }

  let totalCut = 0;
  DEMO_STATIONS.forEach(s=>{ totalCut += demoDemoStormCuts[s.id]; });
  const remaining = totalScheduled - totalCut;
  const pctCut = totalScheduled > 0 ? Math.round((totalCut / totalScheduled) * 100) : 0;
  const outdoor = DEMO_STATIONS.filter(s=>!s.indoor);
  const indoor = DEMO_STATIONS.filter(s=>s.indoor);

  let h = demoDateSelector() +
    '<div class="page-header"><h1>🌧️ Storm Mode</h1>'+
    '<p class="text-muted text-sm">Rapidly downsize staff when weather or emergencies hit.</p></div>';

  h += '<div class="card" style="border-color:rgba(248,113,113,.4);border-width:2px"><div class="card-header">'+
    '<div><div class="card-title">⚡ Quick Setup</div><div class="text-xs text-muted">Which day needs the cut?</div></div>'+
    '<div class="flex gap2 flex-wrap">'+
    days.map(d => {
      const label = DEMO_CROWD[d] ? DEMO_CROWD[d].day+' '+d.replace('May ','May ') : d;
      return '<button class="btn btn-sm '+(demoStormDay===d?'btn-danger':'btn-secondary')+'" onclick="demoStormDay=\''+d+'\';demoDemoStormCuts={};refreshDemoStorm()">'+label+'</button>';
    }).join('')+
    '</div></div>';

  h += '<div style="display:grid;gap:8px;margin-top:12px">'+
    '<div class="flex gap2 flex-wrap">'+
      '<button class="btn btn-sm btn-danger" onclick="demoStormCloseOutdoor()">🌧️ Close All Outdoor</button>'+
      '<button class="btn btn-sm btn-secondary" style="border-color:rgba(251,191,36,.4);color:#FBBF24" onclick="demoStormKeepEssential()">🏠 Indoor Only</button>'+
      '<button class="btn btn-sm btn-secondary" onclick="demoStormReset()">↩️ Reset</button>'+
    '</div>'+
    '<div class="flex gap2 flex-wrap" style="margin-top:4px">'+
      '<span class="text-xs text-muted semi" style="align-self:center">Cut by %:</span>'+
      '<button class="btn btn-sm btn-secondary" onclick="demoStormCutByPct(25)">25%</button>'+
      '<button class="btn btn-sm btn-secondary" onclick="demoStormCutByPct(33)">33%</button>'+
      '<button class="btn btn-sm btn-secondary" onclick="demoStormCutByPct(50)">50%</button>'+
      '<button class="btn btn-sm btn-secondary" onclick="demoStormCutByPct(75)">75%</button>'+
      '<button class="btn btn-sm btn-secondary" style="border-color:rgba(248,113,113,.4);color:#F87171" onclick="demoStormCutByPct(100)">100%</button>'+
      '<input type="number" id="storm-custom-pct" min="0" max="100" placeholder="Custom %" style="width:80px;background:#0F172A;border:1px solid #475569;border-radius:4px;padding:4px 6px;color:#E2E8F0;font-size:12px;text-align:center">'+
      '<button class="btn btn-sm btn-secondary" onclick="var v=document.getElementById(\'storm-custom-pct\').value;if(v)demoStormCutByPct(parseInt(v))">Apply</button>'+
    '</div></div></div>';

  const cutColor = pctCut > 50 ? '#F87171' : pctCut > 20 ? '#FBBF24' : '#34D399';
  h += '<div class="card" style="background:linear-gradient(135deg,rgba(248,113,113,.08),rgba(248,113,113,.02));border-color:rgba(248,113,113,.3)">'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center">'+
      '<div><div class="text-xs text-muted">Scheduled</div><div class="semi" style="font-size:24px;color:#E2E8F0">'+totalScheduled+'</div></div>'+
      '<div><div class="text-xs text-muted">Cutting</div><div class="semi" style="font-size:24px;color:#F87171">'+totalCut+'</div></div>'+
      '<div><div class="text-xs text-muted">Remaining</div><div class="semi" style="font-size:24px;color:#34D399">'+remaining+'</div></div>'+
      '<div><div class="text-xs text-muted">Reduction</div><div class="semi" style="font-size:24px;color:'+cutColor+'">'+pctCut+'%</div></div>'+
    '</div></div>';

  h += '<div class="card"><div class="card-header"><div class="card-title">Station-by-Station</div></div>';

  function stationRow(s) {
    const scheduled = staffCounts[s.id];
    if (scheduled === 0) return '';
    const cut = demoDemoStormCuts[s.id] || 0;
    const keeping = Math.max(0, scheduled - cut);
    const isClosed = cut >= scheduled;
    const bgColor = isClosed ? 'rgba(248,113,113,.08)' : cut > 0 ? 'rgba(251,191,36,.06)' : 'rgba(30,41,59,.5)';
    const borderColor = isClosed ? 'rgba(248,113,113,.3)' : cut > 0 ? 'rgba(251,191,36,.2)' : '#334155';
    return '<div style="background:'+bgColor+';border:1px solid '+borderColor+';border-radius:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between">'+
      '<div style="flex:1"><div class="flex items-center gap2"><span>'+s.icon+'</span><span class="semi text-sm" style="color:'+(isClosed?'#F87171':'#E2E8F0')+'">'+s.name+'</span>'+
      (isClosed ? '<span class="badge badge-red" style="font-size:9px">CLOSED</span>' : cut > 0 ? '<span class="badge badge-amber" style="font-size:9px">REDUCED</span>' : '') +'</div>'+
      '<div class="text-xs text-muted" style="margin-top:2px">Scheduled: '+scheduled+' · Keeping: <strong style="color:'+(isClosed?'#F87171':'#34D399')+'">'+keeping+'</strong></div></div>'+
      '<div class="flex gap2 items-center">'+
        '<button class="btn btn-sm '+(isClosed?'btn-success':'btn-danger')+'" style="font-size:10px;padding:4px 10px" onclick="demoStormToggle(\''+s.id+'\','+scheduled+')">'+(isClosed?'Reopen':'Close')+'</button>'+
        '<input type="number" min="0" max="'+scheduled+'" value="'+keeping+'" style="width:50px;background:#0F172A;border:1px solid #475569;border-radius:4px;padding:4px 6px;color:#E2E8F0;font-size:12px;text-align:center" onchange="demoStormSetKeep(\''+s.id+'\','+scheduled+',this.value)">'+
      '</div></div>';
  }

  h += '<div class="text-xs semi text-muted" style="margin:8px 0 6px">☀️ OUTDOOR</div><div style="display:grid;gap:6px">';
  outdoor.forEach(s => { h += stationRow(s); });
  h += '</div><div class="text-xs semi text-muted" style="margin:12px 0 6px">🏠 INDOOR</div><div style="display:grid;gap:6px">';
  indoor.forEach(s => { h += stationRow(s); });
  h += '</div></div>';

  h += '<div class="card" style="border-color:rgba(167,139,250,.3)"><div class="card-header"><div class="card-title">💬 Or Just Tell Me</div></div>'+
    '<div class="flex gap2">'+
      '<input type="text" id="storm-custom-input" placeholder="e.g. Close everything except Bake Shop and Country Store..." style="flex:1;background:#0F172A;border:1px solid #475569;border-radius:6px;padding:8px 10px;color:#E2E8F0;font-size:12px">'+
      '<button class="btn btn-success btn-sm" onclick="demoStormCustom()">Send</button>'+
    '</div><div id="storm-custom-reply" style="display:none;margin-top:8px"></div></div>';

  h += '<div class="card" style="border-color:rgba(248,113,113,.4);border-width:2px"><div style="text-align:center;padding:8px 0">'+
      '<div class="text-sm text-muted" style="margin-bottom:8px">'+(totalCut > 0 ? '⚠️ This will text <strong class="text-amber">'+totalCut+' employees</strong> that their shift is cancelled.' : 'Make your cuts above, then hit Execute.')+'</div>'+
      '<button class="btn btn-danger" style="font-size:14px;padding:10px 32px;'+(totalCut===0?'opacity:.4;pointer-events:none':'')+'" onclick="demoStormExecute('+totalCut+')">🌧️ Execute Storm Mode — Notify '+totalCut+' People</button>'+
      '<div id="storm-execute-result" style="display:none;margin-top:12px"></div>'+
    '</div></div>';

  return h;
}

function renderDemoStorm(app) {
  app.innerHTML = UI.adminShell('demo-storm', `<div class="page">${renderDemoStormContent()}</div>`);
}
