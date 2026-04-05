// ═══════════════════════════════════════════════════════════════
// CrewCAST DEMO VIEWS — Ported from demo.html
// All demo data, helpers, and 13 render functions for admin SPA
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// CENTER GROVE ORCHARD — SPRING ON THE FARM DATA
// Based on real research: centergroveorchard.com, weather data, competing events
// ═══════════════════════════════════════════════════════════════

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
  { id:'bakeshop',   name:'Bake Shop',          icon:'🧁', open:9,  close:17, indoor:true,  revPerHr:280, peak:true,  note:'Donuts, pies, cider' },
  { id:'store',      name:'Country Store',      icon:'🏪', open:9,  close:17, indoor:true,  revPerHr:195, peak:true,  note:'Gifts, jams, honey' },
  { id:'haycafe',    name:'Hay Cafe',           icon:'☕', open:8,  close:16, indoor:true,  revPerHr:220, peak:true,  note:'Breakfast + lunch' },
  { id:'parking',    name:'Parking/Traffic',     icon:'🅿️', open:8,  close:18, indoor:false, revPerHr:0,   peak:true,  note:'Lot + shuttle' },
  { id:'grounds',    name:'Grounds/Maint.',     icon:'🔧', open:7,  close:18, indoor:false, revPerHr:0,   peak:false, note:'Trash, repairs, setup' },
  { id:'float',      name:'Float/General',      icon:'🔄', open:9,  close:17, indoor:false, revPerHr:0,   peak:false, note:'Fill gaps, breaks, surge' },
];

// ── CrowdPulse Projections ──
const DEMO_CROWD = {
  'May 2': {
    day:'Saturday', date:'May 2, 2026', dayKey:'Sat',
    weather:{ temp:73, condition:'Sunny', icon:'☀️', wind:'8 mph SW', precip:'5%' },
    projected: 2800,
    confidence: 88,
    factors: [
      { label:'Opening weekend + tulip peak', impact:'+35%', type:'up' },
      { label:'Saturday + sunny 73°', impact:'+20%', type:'up' },
      { label:'Mother\'s Day next week (early gifters)', impact:'+8%', type:'up' },
      { label:'Amana Maifest starts Sun (minimal Sat impact)', impact:'-2%', type:'down' },
    ],
    competing: [
      { event:'DSM Book Festival', location:'Des Moines (35 min)', impact:'<2%', threat:'low' },
    ],
    staffNeeded: 38,
  },
  'May 3': {
    day:'Sunday', date:'May 3, 2026', dayKey:'Sun',
    weather:{ temp:67, condition:'Partly Cloudy', icon:'⛅', wind:'12 mph NW', precip:'20%' },
    projected: 2100,
    confidence: 79,
    factors: [
      { label:'Sunday (typically 25% less than Sat)', impact:'-25%', type:'down' },
      { label:'Cooler temps, wind, cloud cover', impact:'-10%', type:'down' },
      { label:'Tulip field still peak bloom', impact:'+15%', type:'up' },
      { label:'Amana Maifest Day 1 — overlapping family crowd', impact:'-8%', type:'down' },
    ],
    competing: [
      { event:'Amana Colonies Maifest', location:'Amana (45 min E)', impact:'~8%', threat:'medium' },
    ],
    staffNeeded: 30,
  }
};

// Staffing needs per station per day (derived from CrowdPulse projections)
const DEMO_NEEDS = {
  'May 2': { admission:4, tulips:6, animals:3, bottles:2, cornpool:2, pillows:2, slide:1, train:2, beeline:1, bakeshop:3, store:2, haycafe:3, parking:4, grounds:2, float:3 },
  'May 3': { admission:3, tulips:4, animals:2, bottles:1, cornpool:1, pillows:1, slide:1, train:1, beeline:1, bakeshop:2, store:2, haycafe:2, parking:3, grounds:2, float:3 }
};

// ── 60-person roster ──
const DEMO_FIRST_NAMES = ['Emma','Jake','Riley','Morgan','Taylor','Jordan','Casey','Avery','Harper','Logan','Bailey','Quinn','Peyton','Cameron','Skyler','Dakota','Reagan','Finley','Reese','Sage','Rowan','Blake','Alex','Sam','Drew','Jamie','Hayden','Parker','Sawyer','Emery','Jesse','Kendall','Lane','Marley','Oakley','Phoenix','River','Spencer','Tatum','Val','Wren','Addison','Blair','Charlie','Devon','Ellis','Frankie','Gray','Hollis','Ira','Jules','Kit','Luca','Marin','Nico','Olive','Piper','Rory','Sloan','True'];
const DEMO_LAST_NAMES = ['Johnson','Martinez','Walker','Chen','Smith','Lee','Brown','Davis','Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Garcia','Thompson','Robinson','Clark','Lewis','Young','Allen','King','Wright','Hill','Green','Adams','Baker','Nelson','Carter','Mitchell','Roberts','Turner','Phillips','Campbell','Parker','Evans','Edwards','Collins','Stewart','Morris','Reed','Cook','Morgan','Bell','Murphy','Bailey','Rivera'];

function genDemoEmployee(i) {
  const fn = DEMO_FIRST_NAMES[i];
  const ln = DEMO_LAST_NAMES[i];
  const yrs = i < 10 ? Math.floor(Math.random()*4)+2 : i < 25 ? Math.floor(Math.random()*3)+1 : Math.random() < .3 ? 1 : 0;
  const overall = Math.min(5, Math.max(2, Math.round((yrs*.8 + Math.random()*2 + 1.5)*10)/10));
  const reliability = Math.min(5, Math.max(2, Math.round((overall + (Math.random()-.3))*10)/10));

  const skillCount = 2 + Math.floor(Math.random()*3);
  const skills = {};
  const pool = [...DEMO_STATIONS].sort(()=>Math.random()-.5).slice(0, skillCount);
  pool.forEach(st => { skills[st.id] = Math.min(5, Math.max(2, Math.round((overall + (Math.random()*2-1))*10)/10)); });

  const avail = {};
  if(Math.random() > .1) avail['Sat'] = { start: Math.random() > .7 ? 10 : (Math.random() > .5 ? 8 : 9), end: Math.random() > .7 ? 15 : 17 };
  if(Math.random() > .15) avail['Sun'] = { start: Math.random() > .6 ? 10 : 9, end: Math.random() > .6 ? 15 : 17 };

  return { id:i+1, firstName:fn, lastName:ln, phone:'(515) 555-' + String(100+i).padStart(4,'0'), years:yrs, overall, reliability, skills, availability:avail, status: i < 55 ? 'active' : 'inactive' };
}

const DEMO_EMPLOYEES = Array.from({length:60}, (_, i) => genDemoEmployee(i));

function demoAutoMatch(day) {
  const dayKey = DEMO_CROWD[day].dayKey;
  const needs = DEMO_NEEDS[day];
  const assigned = {};
  const used = new Set();

  const sortedStations = Object.entries(needs)
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
      if(rand < 0.45) {
        status = 'confirmed';
        respondedAt = ['Apr 30, 5:12 PM','Apr 30, 6:30 PM','Apr 30, 7:45 PM','Apr 30, 9:10 PM','May 1, 7:15 AM','May 1, 8:42 AM','May 1, 10:20 AM','May 1, 11:05 AM'][Math.floor(Math.random()*8)];
      } else if(rand < 0.58) {
        status = 'declined';
        declineReason = ['Family commitment','Car trouble','Already scheduled at other job','Feeling sick','Out of town'][Math.floor(Math.random()*5)];
        respondedAt = ['Apr 30, 8:20 PM','May 1, 9:05 AM','May 1, 11:30 AM'][Math.floor(Math.random()*3)];
      } else {
        status = 'pending';
      }
      return { ...a, status, respondedAt: respondedAt||null, declineReason: declineReason||null };
    });
  });
  return results;
}

// Seed random for consistency
let _seed = 42;
const _origRandom = Math.random;
Math.random = function() { _seed = (_seed * 16807 + 0) % 2147483647; return (_seed - 1) / 2147483646; };

const DEMO_RAW_SAT = demoAutoMatch('May 2');
const DEMO_RAW_SUN = demoAutoMatch('May 3');
const DEMO_ASSIGNED = {
  'May 2': demoSimulateResponses(DEMO_RAW_SAT),
  'May 3': demoSimulateResponses(DEMO_RAW_SUN)
};

Math.random = _origRandom; // restore

// ── Helpers ──
function demoGetSt(id) { return DEMO_STATIONS.find(s=>s.id===id); }
function demoFmtH(h) { return h > 12 ? (h-12)+' PM' : h === 12 ? '12 PM' : h+' AM'; }
function demoFmtHs(h) { return h > 12 ? (h-12)+'p' : h+'a'; }

function demoCountAll(day, status) {
  let c = 0;
  Object.values(DEMO_ASSIGNED[day]).forEach(arr => arr.forEach(a => { if(a.status===status) c++; }));
  return c;
}
function demoTotalAssigned(day) {
  let c = 0;
  Object.values(DEMO_ASSIGNED[day]).forEach(arr => { c += arr.length; });
  return c;
}
function demoTotalNeeded(day) {
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
    const shortMap = {corn:'Corn Pool',slide:'Super Slide',train:'CGO Express Train',tulip:'Tulip U-Pick',bake:'Bake Shop',hay:'Hay Cafe',store:'Country Store',park:'Parking',admit:'Admission',animal:'Baby Animal Barn',bottle:'Bottle Feeding',jump:'Jumping Pillows',honey:'Honey Beeline',float:'Float/General',ground:'Grounds/Maint',maint:'Grounds/Maint'};
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
  const satTotal = demoTotalAssigned('May 2'), sunTotal = demoTotalAssigned('May 3');
  const allTotal = satTotal + sunTotal;
  const conf = demoCountAll('May 2','confirmed') + demoCountAll('May 3','confirmed');
  const pend = demoCountAll('May 2','pending') + demoCountAll('May 3','pending');
  const decl = demoCountAll('May 2','declined') + demoCountAll('May 3','declined');
  const confPct = Math.round(conf/allTotal*100);
  const pendPct = Math.round(pend/allTotal*100);
  const declPct = Math.round(decl/allTotal*100);

  return '<h1>Spring on the Farm — May 2-3, 2026</h1>'+
    '<div class="subtitle">Schedule published Wed Apr 30, 4 PM · 60-person roster · 15 stations · Notifications sent</div>'+

    '<div class="grid5 mb4">'+
      '<div class="stat-card"><div class="stat-label">Total Shifts</div><div class="stat-value">'+allTotal+'</div><div class="stat-sub">2 days · 15 stations</div></div>'+
      '<div class="stat-card"><div class="stat-label">Confirmed</div><div class="stat-value text-green">'+conf+'</div><div class="stat-sub">'+confPct+'% of shifts</div></div>'+
      '<div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value text-amber">'+pend+'</div><div class="stat-sub">'+pendPct+'% no response</div></div>'+
      '<div class="stat-card"><div class="stat-label">Declined</div><div class="stat-value text-red">'+decl+'</div><div class="stat-sub">need coverage</div></div>'+
      '<div class="stat-card"><div class="stat-label">Est. Visitors</div><div class="stat-value text-violet">'+(DEMO_CROWD['May 2'].projected+DEMO_CROWD['May 3'].projected).toLocaleString()+'</div><div class="stat-sub">CrowdPulse forecast</div></div>'+
    '</div>'+

    '<div class="card"><div class="card-header"><div class="card-title">📊 Response Progress</div><span class="badge badge-amber">⏰ Deadline: Thu May 1, 8 PM</span></div>'+
    '<div class="flex gap3 justify-center" style="padding:8px 0">'+
      '<div class="text-center">'+demoRing(confPct,'#34D399',conf)+'<div class="text-xs text-muted mt2">Confirmed</div></div>'+
      '<div class="text-center">'+demoRing(pendPct,'#FBBF24',pend)+'<div class="text-xs text-muted mt2">Pending</div></div>'+
      '<div class="text-center">'+demoRing(declPct,'#EF4444',decl)+'<div class="text-xs text-muted mt2">Declined</div></div>'+
    '</div></div>'+

    '<div class="grid2 mb4">'+['May 2','May 3'].map(function(day) {
      const d = DEMO_CROWD[day];
      const c=demoCountAll(day,'confirmed'), p=demoCountAll(day,'pending'), dc=demoCountAll(day,'declined'), t=demoTotalAssigned(day);
      const hasGap = dc > 0;
      return '<div class="card" style="border-color:'+(hasGap?'rgba(239,68,68,.3)':'rgba(52,211,153,.2)')+'">'+
        '<div class="flex justify-between items-center mb3"><div>'+
          '<div class="semi">'+d.day+', '+d.date+'</div>'+
          '<div class="text-xs text-muted">'+d.weather.icon+' '+d.weather.temp+'° '+d.weather.condition+' · Wind '+d.weather.wind+'</div>'+
        '</div><span class="badge '+(hasGap?'badge-red':'badge-green')+'">'+(hasGap?dc+' shortage'+(dc>1?'s':''):'On track')+'</span></div>'+
        '<div class="flex gap2 mb2"><span class="tag tag-green">✓ '+c+'</span><span class="tag tag-amber">⏳ '+p+'</span><span class="tag tag-red">✗ '+dc+'</span></div>'+
        '<div class="text-xs text-muted mb1">Projected: '+d.projected.toLocaleString()+' visitors · Need '+d.staffNeeded+' staff</div>'+
        '<div style="width:100%;height:8px;border-radius:4px;overflow:hidden;display:flex;background:#0F172A">'+
          '<div style="width:'+Math.round(c/t*100)+'%;background:#34D399"></div>'+
          '<div style="width:'+Math.round(p/t*100)+'%;background:#FBBF24"></div>'+
          '<div style="width:'+Math.round(dc/t*100)+'%;background:#EF4444"></div>'+
        '</div>'+
        (d.competing.length > 0 ? '<div class="text-xs mt2" style="color:#60A5FA">📍 Competing: '+d.competing.map(e=>e.event+' ('+e.impact+' impact)').join(', ')+'</div>' : '')+
      '</div>';
    }).join('')+'</div>'+

    '<div class="card" style="border-color:rgba(239,68,68,.3)"><div class="card-header"><div class="card-title text-red">🚨 Needs Attention</div><button class="btn btn-sm btn-secondary" onclick="Router.navigate(\'/admin/demo/alerts\')">View All →</button></div>'+
    '<div style="display:grid;gap:6px">'+
      '<div style="background:rgba(239,68,68,.05);border-radius:8px;padding:10px;border:1px solid rgba(239,68,68,.15)"><span class="semi text-red text-xs">'+decl+' declined shifts</span><span class="text-xs text-muted"> — auto-replacement ready to text qualified backups</span></div>'+
      '<div style="background:rgba(251,191,36,.05);border-radius:8px;padding:10px;border:1px solid rgba(251,191,36,.15)"><span class="semi text-amber text-xs">'+pend+' pending responses</span><span class="text-xs text-muted"> — reminder sent Thu noon, deadline 8 PM</span></div>'+
      '<div style="background:rgba(96,165,250,.05);border-radius:8px;padding:10px;border:1px solid rgba(96,165,250,.15)"><span class="semi text-blue text-xs">Amana Maifest Sunday</span><span class="text-xs text-muted"> — may reduce Sun traffic ~8%, consider trimming Tulip U-Pick by 1</span></div>'+
    '</div></div>';
}

function renderDemoDashboard(app) {
  app.innerHTML = UI.adminShell('demo-dashboard', `
    <div class="page">
      ${renderDemoDashboardContent()}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO CROWDPULSE
// ═══════════════════════════════════════════════════════
function renderDemoCrowdPulseContent() {
  return '<h1>🎯 CrowdPulse — Attendance Forecast</h1>'+
    '<div class="subtitle">AI-powered staffing projections based on weather, events, history, and local competition</div>'+

    ['May 2','May 3'].map(function(day) {
      const d = DEMO_CROWD[day];
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
          '<div class="text-xs text-muted">Based on '+d.projected.toLocaleString()+' projected visitors and '+DEMO_STATIONS.length+' active stations, CrowdPulse recommends <strong class="text-violet">'+d.staffNeeded+' staff</strong> with emphasis on Admission ('+DEMO_NEEDS[day].admission+'), Tulip U-Pick ('+DEMO_NEEDS[day].tulips+'), Parking ('+DEMO_NEEDS[day].parking+'), and Hay Cafe ('+DEMO_NEEDS[day].haycafe+').</div>'+
        '</div>'+
      '</div>';
    }).join('');
}

function renderDemoCrowdPulse(app) {
  app.innerHTML = UI.adminShell('demo-crowdpulse', `
    <div class="page">
      ${renderDemoCrowdPulseContent()}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO STATION VIEW
// ═══════════════════════════════════════════════════════
function renderDemoStationViewContent() {
  return '<h1>🏗️ Station View</h1><div class="subtitle">Employees assigned per station — confirmed, pending, and declined</div>'+
    ['May 2','May 3'].map(function(day) {
      const dayLabel = DEMO_CROWD[day].day+', '+DEMO_CROWD[day].date;
      return '<div class="card"><div class="card-header"><div class="card-title">📅 '+dayLabel+'</div>'+
        '<div class="flex gap2"><span class="tag tag-green">✓ '+demoCountAll(day,'confirmed')+'</span><span class="tag tag-amber">⏳ '+demoCountAll(day,'pending')+'</span><span class="tag tag-red">✗ '+demoCountAll(day,'declined')+'</span></div></div>'+
        '<div style="overflow-x:auto"><table><thead><tr><th>Station</th><th>Need</th><th>Staff</th><th>Coverage</th><th>Status</th></tr></thead><tbody>'+
        DEMO_STATIONS.map(st => {
          const need = DEMO_NEEDS[day][st.id] || 0;
          if(need === 0) return '';
          const arr = DEMO_ASSIGNED[day][st.id] || [];
          const active = arr.filter(a=>a.status!=='declined');
          const hasDecl = arr.some(a=>a.status==='declined');
          const allConf = arr.length > 0 && arr.every(a=>a.status==='confirmed');
          const badge = hasDecl ? '<span class="badge badge-red">⚠ Gap</span>' : allConf ? '<span class="badge badge-green">✓ Full</span>' : '<span class="badge badge-amber">⏳</span>';

          return '<tr><td style="white-space:nowrap"><span class="semi">'+st.icon+' '+st.name+'</span><div class="text-xs text-muted">'+demoFmtH(st.open)+'–'+demoFmtH(st.close)+'</div></td>'+
            '<td class="semi" style="text-align:center">'+need+'</td>'+
            '<td><div class="flex gap1 flex-wrap">'+
              arr.map(a => {
                const bgA = a.status==='confirmed'?'52,211,153':a.status==='pending'?'251,191,36':'239,68,68';
                return '<span class="tag" style="background:rgba('+bgA+',.12);color:'+demoStatusColor(a.status)+';font-size:10px;padding:2px 6px">'+a.employee.firstName+' '+a.employee.lastName.charAt(0)+'. '+demoStatusIcon(a.status)+'</span>';
              }).join('')+
            '</div></td>'+
            '<td style="white-space:nowrap">'+demoCbar(active.length, need)+' <span class="text-xs">'+active.length+'/'+need+'</span></td>'+
            '<td>'+badge+'</td></tr>';
        }).join('')+
        '</tbody></table></div></div>';
    }).join('');
}

function renderDemoStationView(app) {
  app.innerHTML = UI.adminShell('demo-stations', `
    <div class="page">
      ${renderDemoStationViewContent()}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO COVERAGE GRID
// ═══════════════════════════════════════════════════════
function renderDemoCoverageContent() {
  const hours = [7,8,9,10,11,12,13,14,15,16,17];

  return '<h1>📈 Hourly Coverage Grid</h1><div class="subtitle">Station-by-station staffing per hour</div>'+
    ['May 2','May 3'].map(day => {
      return '<div class="card"><div class="card-header"><div class="card-title">'+DEMO_CROWD[day].weather.icon+' '+DEMO_CROWD[day].day+', '+DEMO_CROWD[day].date+'</div>'+
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
  app.innerHTML = UI.adminShell('demo-coverage', `
    <div class="page">
      ${renderDemoCoverageContent()}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO REPLACEMENT ENGINE
// ═══════════════════════════════════════════════════════
function renderDemoReplacementContent() {
  const gaps = [];
  ['May 2','May 3'].forEach(day => {
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

  return '<h1>⚡ Auto-Replacement Engine</h1>'+
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
      return '<div class="card" style="border-color:rgba(239,68,68,.2)">'+
        '<div class="card-header"><div>'+
          '<div class="card-title">'+g.station.icon+' '+g.station.name+' — '+(g.day==='May 2'?'Saturday':'Sunday')+'</div>'+
          '<div class="text-xs text-muted">'+g.declined.employee.firstName+' '+g.declined.employee.lastName+' declined: "'+g.declined.declineReason+'"</div>'+
        '</div><span class="badge badge-red">Open</span></div>'+

        '<div class="text-xs semi mb2">Top Replacement Candidates</div>'+
        (g.candidates.length > 0 ?
          '<table><thead><tr><th>Rank</th><th>Employee</th><th>'+g.station.name+' Skill</th><th>Reliability</th><th>Experience</th><th>Score</th><th></th></tr></thead><tbody>'+
          g.candidates.map((c, i) => {
            let stars = '';
            for(let s=0;s<5;s++) stars += s < Math.round(c.skill) ? '★' : '☆';
            return '<tr><td class="semi text-violet">#'+(i+1)+'</td>'+
              '<td><div class="semi">'+c.employee.firstName+' '+c.employee.lastName+'</div><div class="text-xs text-muted">'+c.employee.phone+'</div></td>'+
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
  app.innerHTML = UI.adminShell('demo-replacement', `
    <div class="page">
      ${renderDemoReplacementContent()}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO CASCADE (LIVE DEMO)
// ═══════════════════════════════════════════════════════
const demoCascadeSteps = [
  { time:'6:45 AM', icon:'📱', color:'#F87171', title:'Day-Of Callout Received',
    detail:'Jake Martinez texts: "Sorry can\'t make it today, feeling sick"',
    system:'',
    badge:'Incoming'
  },
  { time:'6:45 AM', icon:'🤖', color:'#A78BFA', title:'CrewCast Detects Cancellation',
    detail:'Jake was assigned to Hay Cafe (Saturday 8 AM - 4 PM). Skill rating: 4 stars. Shift is in 1 hour 15 minutes.',
    system:'Cancellation auto-detected from SMS keyword "can\'t make it"',
    badge:'Processing'
  },
  { time:'6:45 AM', icon:'🔍', color:'#22D3EE', title:'Scanning Replacement Pool',
    detail:'Searching 60-person roster for: available today + Hay Cafe skill 3+ + not already scheduled + reliability 3.5+',
    system:'Found 7 qualified candidates. Ranking by composite score (skill x3 + reliability x2 + experience)...',
    badge:'Searching'
  },
  { time:'6:46 AM', icon:'📊', color:'#A78BFA', title:'Candidates Ranked',
    detail:'Top 5 selected:',
    candidates: [
      { name:'Morgan Chen', skill:4.2, reliability:4.5, years:3, score:28.1, phone:'(515) 555-0104' },
      { name:'Casey Brown', skill:3.8, reliability:4.1, years:2, score:24.7, phone:'(515) 555-0107' },
      { name:'Sage Robinson', skill:3.5, reliability:4.3, years:2, score:23.4, phone:'(515) 555-0129' },
      { name:'Rowan Clark', skill:3.2, reliability:3.8, years:1, score:19.8, phone:'(515) 555-0130' },
      { name:'Phoenix Lewis', skill:3.0, reliability:4.0, years:1, score:19.0, phone:'(515) 555-0135' },
    ],
    system:'Candidates ranked. Ready to send.',
    badge:'Ranked'
  },
  { time:'6:46 AM', icon:'📤', color:'#60A5FA', title:'Texts Sent to Top 5',
    detail:'Message: "Hey [Name]! Opening at Hay Cafe today (8 AM - 4 PM) due to a callout. You\'re qualified and available. Reply YES to claim this shift. First reply gets it!"',
    system:'5 SMS messages delivered successfully',
    badge:'Sent'
  },
  { time:'6:46 AM', icon:'📤', color:'#60A5FA', title:'Steve Notified',
    detail:'To Steve: "Jake Martinez called out from Hay Cafe today. Auto-Replace activated — texted 5 qualified candidates. Will update you when filled."',
    system:'Manager notification sent. No action required from Steve.',
    badge:'FYI'
  },
  { time:'6:52 AM', icon:'✅', color:'#34D399', title:'Morgan Chen Replies YES!',
    detail:'Morgan Chen (Hay Cafe skill: 4.2 stars, reliability: 4.5, 3 years experience) claimed the shift.',
    system:'Shift auto-assigned to Morgan. Schedule updated.',
    badge:'Claimed'
  },
  { time:'6:52 AM', icon:'📤', color:'#A78BFA', title:'Confirmation Sent to Morgan',
    detail:'To Morgan: "You\'re confirmed for Hay Cafe today, 8 AM - 4 PM. Report 15 min early. Thanks for stepping up!"',
    system:'Shift details + map link sent',
    badge:'Confirmed'
  },
  { time:'6:52 AM', icon:'🔕', color:'#64748B', title:'Other 4 Candidates Notified',
    detail:'To Casey, Sage, Rowan, Phoenix: "Thanks for being available! The Hay Cafe shift has been filled. We\'ll keep you in mind for future openings."',
    system:'4 "shift filled" notifications sent',
    badge:'Closed'
  },
  { time:'6:53 AM', icon:'✅', color:'#34D399', title:'Steve Gets the All-Clear',
    detail:'To Steve: "Jake\'s Hay Cafe shift covered by Morgan Chen (4.2 star rating). No action needed. Enjoy your coffee."',
    system:'',
    badge:'Resolved'
  },
  { time:'—', icon:'🏆', color:'#34D399', title:'Result: 8 Minutes, Zero Manager Effort',
    detail:'From callout to covered shift in 8 minutes. Steve was notified but never had to make a call, send a text, or check a spreadsheet. The system handled everything.',
    system:'Jake\'s reliability score adjusted: 4.1 to 3.8 (callout recorded). Morgan\'s score gets +0.2 bonus for accepting a day-of fill.',
    badge:'Complete'
  }
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
    if(el) {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      el.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
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
          '<div class="flex items-center gap2">'+
            '<span style="font-size:16px">'+step.icon+'</span>'+
            '<span class="semi text-sm" style="color:'+step.color+'">'+step.title+'</span>'+
          '</div>'+
          '<div class="flex items-center gap2">'+
            '<span class="text-xs text-muted">'+step.time+'</span>'+
            '<span class="badge" style="background:rgba('+(step.color==='#F87171'?'239,68,68':step.color==='#34D399'?'52,211,153':step.color==='#22D3EE'?'34,211,238':step.color==='#60A5FA'?'96,165,250':step.color==='#64748B'?'100,116,139':'167,139,250')+',.15);color:'+step.color+'">'+step.badge+'</span>'+
          '</div>'+
        '</div>'+
        '<div class="text-xs" style="color:#CBD5E1;line-height:1.5">'+step.detail+'</div>';

    if(step.candidates) {
      scenario += '<table style="margin-top:8px"><thead><tr><th>Rank</th><th>Name</th><th>Cafe Skill</th><th>Reliability</th><th>Exp</th><th>Score</th></tr></thead><tbody>';
      step.candidates.forEach((c, ci) => {
        let stars = '';
        for(let s=0;s<5;s++) stars += s < Math.round(c.skill) ? '★' : '☆';
        scenario += '<tr style="'+(ci===0?'background:rgba(52,211,153,.05)':'')+'">'+
          '<td class="semi text-violet">#'+(ci+1)+'</td>'+
          '<td class="semi">'+c.name+'</td>'+
          '<td><span style="color:#FBBF24;font-size:9px">'+stars+'</span> <span class="text-xs">'+c.skill+'</span></td>'+
          '<td class="text-xs">'+c.reliability+'/5</td>'+
          '<td class="text-xs">'+c.years+' yr'+(c.years>1?'s':'')+'</td>'+
          '<td class="semi text-violet">'+c.score+'</td></tr>';
      });
      scenario += '</tbody></table>';
    }

    if(step.system) {
      scenario += '<div style="margin-top:6px;background:rgba(167,139,250,.05);border-radius:6px;padding:6px 8px;border:1px solid rgba(167,139,250,.1)">'+
        '<span class="text-xs text-violet">🤖 '+step.system+'</span></div>';
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
      { tier:'Tier 2 — Widen Pool (2 hours)', desc:'Lower skill threshold from 3+ to 2+, include employees who listed "maybe" availability. Text next 5.', color:'#FBBF24', timing:'If Tier 1 fails' },
      { tier:'Tier 3 — Floater Redirect (4 hours)', desc:'Pull a scheduled floater from another station. Reduce Float/General coverage temporarily.', color:'#F59E0B', timing:'If Tier 2 fails' },
      { tier:'Tier 4 — Overtime Offer (6 hours)', desc:'Offer overtime to someone already working a different shift that day. Flag labor law compliance.', color:'#F87171', timing:'If Tier 3 fails' },
      { tier:'Tier 5 — Manager Decision (12 hrs before shift)', desc:'Escalate to Steve with 3 options: approve OT, merge station with neighbor, or accept reduced staffing. One-tap choice.', color:'#EF4444', timing:'Last resort' },
    ].map(t => {
      return '<div style="background:#0F172A;border-radius:8px;padding:12px;border-left:3px solid '+t.color+'">'+
        '<div class="flex justify-between items-center mb1">'+
          '<span class="semi text-sm" style="color:'+t.color+'">'+t.tier+'</span>'+
          '<span class="badge badge-gray">'+t.timing+'</span>'+
        '</div>'+
        '<div class="text-xs text-muted">'+t.desc+'</div></div>';
    }).join('')+
    '</div></div>';

  let prevention = '<div class="card"><div class="card-title mb3">🧠 Smart Prevention — Reduce Callouts Before They Happen</div>'+
    '<div style="display:grid;gap:6px">'+
    [
      { rule:'Over-assign high-turnover stations by 10%', desc:'If Corn Pool historically has 15% decline rate, schedule 1 extra. Buffer absorbs cancellations silently.', icon:'📈' },
      { rule:'Reliability-weighted scheduling', desc:'Employees with 90%+ show rate get primary shifts. Lower reliability employees get backup/floater roles where their absence has less impact.', icon:'⭐' },
      { rule:'Advance availability collected weekly', desc:'Employees update availability every Sunday night for the coming week. CrewCast never assigns someone who marked themselves unavailable.', icon:'📅' },
      { rule:'Post-weekend auto-learning', desc:'After each weekend: who showed up, who called out, who was late. Reliability scores auto-adjust. Next week\'s predictions improve.', icon:'🔄' },
      { rule:'Proactive weather alerts', desc:'If forecast worsens significantly, proactively message outdoor-station staff: "Rain expected Saturday. Your Tulip shift may be reassigned. Stand by."', icon:'🌧️' },
    ].map(r => {
      return '<div style="background:#0F172A;border-radius:6px;padding:10px;display:flex;gap:10px;align-items:flex-start">'+
        '<span style="font-size:16px">'+r.icon+'</span>'+
        '<div><div class="text-xs semi">'+r.rule+'</div><div class="text-xs text-muted mt1">'+r.desc+'</div></div></div>';
    }).join('')+
    '</div></div>';

  return flowSteps + scenario + summary + escalation + prevention;
}

function renderDemoCascade(app) {
  app.innerHTML = UI.adminShell('demo-cascade', `
    <div class="page">
      ${renderDemoCascadeContent()}
    </div>
  `);
  initDemoCascade();
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO SWAPS
// ═══════════════════════════════════════════════════════
function renderDemoSwapsContent() {
  const swaps = [
    { from:DEMO_EMPLOYEES[3], fromDay:'May 2', fromSt:'animals', to:DEMO_EMPLOYEES[8], toDay:'May 3', toSt:'animals', status:'pending', reason:'Dentist appointment Saturday morning' },
    { from:DEMO_EMPLOYEES[12], fromDay:'May 3', fromSt:'parking', to:DEMO_EMPLOYEES[18], toDay:'May 3', toSt:'parking', status:'approved', reason:'Want to attend Maifest in afternoon' },
    { from:DEMO_EMPLOYEES[7], fromDay:'May 2', fromSt:'store', to:null, toDay:'May 2', toSt:'store', status:'open', reason:'Family birthday lunch' },
  ];

  return '<h1>🔄 Shift Swap Board</h1>'+
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

      return '<div class="swap-card" style="border-color:'+borderColor+'">'+
        '<div class="flex justify-between items-center mb2">'+
          '<div class="semi text-sm">'+stObj.icon+' '+stObj.name+' — '+(s.fromDay==='May 2'?'Saturday':'Sunday')+'</div>'+statusBadge+
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
    '</div></div>'+

    '<div class="card"><div class="card-title mb2">⚡ Swap Rules (Auto-Enforced)</div>'+
    '<div style="display:grid;gap:4px">'+
    [
      'Both employees must be qualified for the station (skill rating 3+)',
      'Swaps within 24 hours of shift require manager approval',
      'Employee can\'t exceed 10 hours in a single day after swap',
      'Overtime implications flagged automatically',
    ].map(r => {
      return '<div style="background:#0F172A;border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:8px">'+
        '<span class="text-green text-xs">✓</span><span class="text-xs">'+r+'</span></div>';
    }).join('')+
    '</div></div>';
}

function renderDemoSwaps(app) {
  app.innerHTML = UI.adminShell('demo-swaps', `
    <div class="page">
      ${renderDemoSwapsContent()}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO SMS CENTER
// ═══════════════════════════════════════════════════════
function renderDemoSmsContent() {
  const msgs = [
    { dir:'out', to:'All 48 scheduled staff', count:48, msg:'🌷 Spring on the Farm — May 2-3 schedule is live! Check your shifts and reply YES to confirm or NO if you can\'t make it. Respond by Thursday 8 PM.', time:'Wed Apr 30, 4:00 PM' },
    { dir:'in', from:'Emma Johnson', msg:'YES — both days! See you there 🌷', time:'Wed Apr 30, 5:12 PM' },
    { dir:'in', from:'Morgan Chen', msg:'Yes Saturday works!', time:'Wed Apr 30, 5:30 PM' },
    { dir:'out', to:'Morgan Chen', msg:'✅ Sat confirmed: Baby Animal Barn 9 AM–5 PM.', time:'Wed Apr 30, 5:31 PM' },
    { dir:'in', from:'Jordan Lee', msg:'Sorry can\'t do this weekend — family thing', time:'Wed Apr 30, 8:20 PM' },
    { dir:'out', to:'Steve (You)', msg:'⚠️ Jordan Lee declined Sat Tulip & Sun Animals. Auto-Replace found 5 candidates. Text them?', time:'Wed Apr 30, 8:21 PM' },
    { dir:'in', from:'Taylor Smith', msg:'Confirmed for Sunday!', time:'Thu May 1, 7:30 AM' },
    { dir:'in', from:'Riley Walker', msg:'I can do Sat but not Sun — going to Maifest with family', time:'Thu May 1, 8:45 AM' },
    { dir:'out', to:'Riley Walker', msg:'✅ Sat confirmed. Sun shift released — finding replacement.', time:'Thu May 1, 8:46 AM' },
    { dir:'out', to:'23 pending staff', count:23, msg:'⏰ Reminder: Your May 2-3 shifts need confirmation. Reply YES or NO by tonight 8 PM. If we don\'t hear back, we\'ll need to find coverage.', time:'Thu May 1, 12:00 PM' },
    { dir:'in', from:'Avery Davis', msg:'YES for both days 👍', time:'Thu May 1, 12:18 PM' },
    { dir:'in', from:'Casey Brown', msg:'Can\'t do it, already picked up shift at HyVee', time:'Thu May 1, 1:30 PM' },
    { dir:'out', to:'Steve (You)', msg:'⚠️ Casey Brown declined Sat Hay Cafe. 3 qualified replacements found. Texting now.', time:'Thu May 1, 1:31 PM' },
  ];

  return '<h1>📱 SMS Center</h1><div class="subtitle">Automated messaging — notifications, confirmations, and reminders</div>'+
    '<div class="grid3 mb4">'+
      '<div class="stat-card"><div class="stat-label">Messages Sent</div><div class="stat-value text-violet">'+msgs.filter(m=>m.dir==='out').reduce((s,m)=>s+(m.count||1),0)+'</div></div>'+
      '<div class="stat-card"><div class="stat-label">Replies Received</div><div class="stat-value text-green">'+msgs.filter(m=>m.dir==='in').length+'</div></div>'+
      '<div class="stat-card"><div class="stat-label">Response Rate</div><div class="stat-value text-amber">54%</div><div class="stat-sub">26 of 48 replied</div></div>'+
    '</div>'+

    '<div class="card"><div class="card-header"><div class="card-title">Message Thread</div><button class="btn btn-primary btn-sm">+ New Broadcast</button></div>'+
    '<div style="display:grid;gap:8px;max-height:500px;overflow-y:auto">'+
    msgs.map(m => {
      if(m.dir==='out') {
        return '<div style="margin-left:auto">'+
          '<div class="sms sms-out"><div class="text-xs">'+m.msg+'</div><div class="sms-time">'+m.time+'</div></div>'+
          '</div>';
      } else {
        return '<div style="margin-right:auto">'+
          '<div style="font-size:9px;color:#64748B;margin-bottom:2px">'+m.from+' ('+m.time+')</div>'+
          '<div class="sms sms-in"><div class="text-xs">'+m.msg+'</div><div class="sms-time">'+m.time+'</div></div>'+
          '</div>';
      }
    }).join('')+
    '</div></div>';
}

function renderDemoSms(app) {
  app.innerHTML = UI.adminShell('demo-sms', `
    <div class="page">
      ${renderDemoSmsContent()}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO COSTS
// ═══════════════════════════════════════════════════════
function renderDemoCostsContent() {
  const gaps = [];
  let totalLost = 0;
  ['May 2','May 3'].forEach(day => {
    Object.entries(DEMO_ASSIGNED[day]).forEach(([stId, arr]) => {
      const st = demoGetSt(stId);
      const declined = arr.filter(a=>a.status==='declined').length;
      if(declined > 0 && st.revPerHr > 0) {
        const hrs = st.close - st.open;
        const lost = st.revPerHr * hrs * (declined / (DEMO_NEEDS[day][stId]||1));
        totalLost += lost;
        gaps.push({ day:day, station:st, declined:declined, need:DEMO_NEEDS[day][stId], hrs:hrs, lost:lost });
      }
    });
  });

  const safetyGaps = [];
  ['May 2','May 3'].forEach(day => {
    Object.entries(DEMO_ASSIGNED[day]).forEach(([stId, arr]) => {
      const st = demoGetSt(stId);
      const declined = arr.filter(a=>a.status==='declined').length;
      if(declined > 0 && st.revPerHr === 0) {
        safetyGaps.push({ day:day, station:st, declined:declined, need:DEMO_NEEDS[day][stId] });
      }
    });
  });

  return '<h1>💰 Cost of Gaps</h1>'+
    '<div class="subtitle">Estimated revenue impact when stations are understaffed</div>'+

    '<div class="grid3 mb4">'+
      '<div class="stat-card"><div class="stat-label">Revenue at Risk</div><div class="stat-value text-red">$'+Math.round(totalLost).toLocaleString()+'</div><div class="stat-sub">if gaps unfilled</div></div>'+
      '<div class="stat-card"><div class="stat-label">Weekend Revenue Target</div><div class="stat-value text-green">$'+(Math.round((DEMO_CROWD['May 2'].projected+DEMO_CROWD['May 3'].projected)*12.50)).toLocaleString()+'</div><div class="stat-sub">at $12.50 avg/visitor</div></div>'+
      '<div class="stat-card"><div class="stat-label">Gap % of Revenue</div><div class="stat-value text-amber">'+(totalLost > 0 ? Math.round(totalLost/((DEMO_CROWD['May 2'].projected+DEMO_CROWD['May 3'].projected)*12.50)*100) : 0)+'%</div><div class="stat-sub">recoverable with coverage</div></div>'+
    '</div>'+

    (gaps.length > 0 ? '<div class="card"><div class="card-title mb3">💸 Revenue-Generating Stations with Gaps</div>'+
    '<table><thead><tr><th>Station</th><th>Day</th><th>Rev/Hour</th><th>Gap</th><th>Station Hours</th><th>Est. Lost Revenue</th></tr></thead><tbody>'+
    gaps.map(g => {
      return '<tr><td class="semi">'+g.station.icon+' '+g.station.name+'</td>'+
        '<td>'+(g.day==='May 2'?'Sat':'Sun')+'</td>'+
        '<td class="text-green">$'+g.station.revPerHr+'</td>'+
        '<td><span class="badge badge-red">-'+g.declined+' of '+g.need+'</span></td>'+
        '<td>'+g.hrs+' hrs</td>'+
        '<td class="semi text-red">$'+Math.round(g.lost).toLocaleString()+'</td></tr>';
    }).join('')+
    '<tr style="background:rgba(239,68,68,.05)"><td colspan="5" class="semi" style="text-align:right">Total Revenue at Risk:</td><td class="semi text-red bold">$'+Math.round(totalLost).toLocaleString()+'</td></tr>'+
    '</tbody></table></div>' : '')+

    (safetyGaps.length > 0 ? '<div class="card" style="border-color:rgba(251,191,36,.3)"><div class="card-title text-amber mb3">⚠️ Non-Revenue Gaps (Safety & Experience)</div>'+
    '<div style="display:grid;gap:6px">'+
    safetyGaps.map(g => {
      const risk = g.station.id==='parking' ? 'Safety risk: traffic management, ADA access, emergency lanes' :
                   g.station.id==='grounds' ? 'Maintenance delays: trash overflow, broken equipment, porta-potties' :
                   g.station.id==='float' ? 'No break coverage: employee burnout, station shutdowns during lunch' :
                   'Reduced guest experience, longer wait times';
      return '<div style="background:#0F172A;border-radius:8px;padding:10px">'+
        '<div class="flex justify-between items-center"><span class="semi text-sm">'+g.station.icon+' '+g.station.name+' — '+(g.day==='May 2'?'Sat':'Sun')+'</span><span class="badge badge-amber">-'+g.declined+' of '+g.need+'</span></div>'+
        '<div class="text-xs text-muted mt1">'+risk+'</div></div>';
    }).join('')+
    '</div></div>' : '')+

    '<div class="card" style="border-color:rgba(52,211,153,.3);background:rgba(16,185,129,.03)">'+
      '<div class="card-title text-green mb2">💡 The CrewCast ROI</div>'+
      '<div class="text-xs text-muted">By auto-filling gaps within minutes instead of hours of phone tag, CrewCast recovers <strong class="text-green">$'+Math.round(totalLost).toLocaleString()+'</strong> in at-risk revenue this weekend alone. Over a 20-weekend spring+fall season, that compounds to <strong class="text-green">$'+Math.round(totalLost*12).toLocaleString()+'+ annually</strong> in protected revenue — before accounting for reduced manager time and improved employee satisfaction.</div>'+
    '</div>';
}

function renderDemoCosts(app) {
  app.innerHTML = UI.adminShell('demo-costs', `
    <div class="page">
      ${renderDemoCostsContent()}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO ALERTS
// ═══════════════════════════════════════════════════════
function renderDemoAlertsContent() {
  const decSat = demoCountAll('May 2','declined'), decSun = demoCountAll('May 3','declined');
  const pendSat = demoCountAll('May 2','pending'), pendSun = demoCountAll('May 3','pending');

  return '<h1>🚨 Alerts</h1><div class="subtitle">Issues requiring your attention — approve, dismiss, or let CrewCast handle it</div>'+

    '<div class="card" style="border-color:rgba(167,139,250,.4);border-width:2px"><div class="card-header"><div class="card-title text-violet">🔔 Needs Your Decision</div><span class="badge badge-violet">'+(decSat+decSun > 0 ? '3' : '2')+' pending</span></div>'+
    '<div style="display:grid;gap:10px">'+

    (decSat+decSun > 0 ?
    '<div style="background:#0F172A;border-radius:10px;padding:14px;border:1px solid rgba(239,68,68,.3)">'+
      '<div class="flex justify-between items-center mb2"><span class="semi text-red text-sm">🚨 '+(decSat+decSun)+' employees declined — should I find replacements?</span><span class="badge badge-red">High Priority</span></div>'+
      '<p class="text-xs text-muted mb2">'+decSat+' on Saturday, '+decSun+' on Sunday. I\'ve already ranked qualified candidates for each open slot. Say the word and I\'ll text the top 5 for each gap — first YES gets it, you get a confirmation.</p>'+
      '<div class="flex gap2" id="alert-decline-btns">'+
        '<button class="btn btn-success btn-sm" onclick="alertDecisionDemo(\'decline\',true)">👍 Yes, Text Replacements Now</button>'+
        '<button class="btn btn-secondary btn-sm" onclick="Router.navigate(\'/admin/demo/replacement\')">Let Me Review First</button>'+
      '</div>'+
      '<div id="alert-decline-result" style="display:none"></div>'+
    '</div>' : '')+

    '<div style="background:#0F172A;border-radius:10px;padding:14px;border:1px solid rgba(251,191,36,.3)">'+
      '<div class="flex justify-between items-center mb2"><span class="semi text-amber text-sm">⏰ '+(pendSat+pendSun)+' employees still haven\'t responded</span><span class="badge badge-amber">Deadline 8 PM</span></div>'+
      '<p class="text-xs text-muted mb2">First reminder went out at noon. Want me to send a final "last chance" text? After 8 PM, I\'ll auto-release their shifts to the replacement pool and start filling them.</p>'+
      '<div class="flex gap2" id="alert-pending-btns">'+
        '<button class="btn btn-success btn-sm" onclick="alertDecisionDemo(\'pending\',true)">👍 Send Final Reminder</button>'+
        '<button class="btn btn-secondary btn-sm" onclick="alertDecisionDemo(\'pending\',false)">👎 Skip It, Release at 8 PM</button>'+
      '</div>'+
      '<div id="alert-pending-result" style="display:none"></div>'+
    '</div>'+

    '<div style="background:#0F172A;border-radius:10px;padding:14px;border:1px solid rgba(52,211,153,.3)">'+
      '<div class="flex justify-between items-center mb2"><span class="semi text-green text-sm">☀️ Saturday\'s looking big — want extra floaters?</span><span class="badge badge-green">Recommendation</span></div>'+
      '<p class="text-xs text-muted mb2"><b>2,800 visitors</b> projected — your best spring day yet. You\'ve got <b>3 Floaters</b> scheduled. I\'d recommend adding <b>2 more</b> — I\'ve got 4 qualified people available, and I\'ll text the first 2 who can make it.</p>'+
      '<div class="flex gap2" id="alert-surge-btns">'+
        '<button class="btn btn-success btn-sm" onclick="alertDecisionDemo(\'surge\',true)">👍 Do it — add 2 floaters</button>'+
        '<button class="btn btn-secondary btn-sm" onclick="alertDecisionDemo(\'surge\',false)">Nah, we\'ll manage with 3</button>'+
      '</div>'+
      '<div id="alert-surge-result" style="display:none"></div>'+
    '</div>'+

    '</div></div>'+

    '<div class="card"><div class="card-header"><div class="card-title">📋 FYI — No Action Needed</div><span class="badge badge-gray">Info only</span></div>'+
    '<div style="display:grid;gap:8px">'+

    '<div style="background:rgba(96,165,250,.04);border-radius:10px;padding:12px;border:1px solid rgba(96,165,250,.15)">'+
      '<div class="flex justify-between items-center mb1"><span class="semi text-blue text-sm">🏁 Amana Maifest — Sunday</span><span class="text-xs text-muted">~8% overlap</span></div>'+
      '<p class="text-xs text-muted">Maifest starts Sunday in Amana (45 min east). I\'ve already factored the ~8% attendance dip into Sunday\'s projection. Riley Walker is going — her shift was released. No staffing changes needed unless you want them — check CrowdPulse for options.</p></div>'+

    '<div style="background:rgba(251,191,36,.04);border-radius:10px;padding:12px;border:1px solid rgba(251,191,36,.15)">'+
      '<div class="flex justify-between items-center mb1"><span class="semi text-amber text-sm">🌤️ Sunday Weather Shift</span><span class="text-xs text-muted">67°F, windy</span></div>'+
      '<p class="text-xs text-muted">Down from Saturday\'s 73° and sunny. 12 mph NW winds, 20% precip chance. Outdoor stations may see lighter traffic. I\'ve flagged a trim recommendation in CrowdPulse if you want to adjust.</p></div>'+

    '<div style="background:rgba(167,139,250,.04);border-radius:10px;padding:12px;border:1px solid rgba(167,139,250,.15)">'+
      '<div class="flex justify-between items-center mb1"><span class="semi text-violet text-sm">🔄 1 Swap Request Open</span><span class="text-xs text-muted">Shift Board</span></div>'+
      '<p class="text-xs text-muted">Avery Davis posted her Sat Country Store shift — no taker yet. I\'ll auto-text 4 qualified people if nobody grabs it by tonight. <a style="color:#A78BFA;cursor:pointer" onclick="Router.navigate(\'/admin/demo/swaps\')">View swap board →</a></p></div>'+

    '<div style="background:rgba(16,185,129,.04);border-radius:10px;padding:12px;border:1px solid rgba(16,185,129,.15)">'+
      '<div class="flex justify-between items-center mb1"><span class="semi text-green text-sm">✅ Saturday AM Core — All Confirmed</span><span class="text-xs text-muted">Good news</span></div>'+
      '<p class="text-xs text-muted">Admission, Tulip U-Pick, Bake Shop, and Hay Cafe morning crews are locked in. Your highest-revenue stations are fully covered for the peak Saturday window.</p></div>'+

    '</div></div>';
}

function alertDecisionDemo(type, approved) {
  const btns = document.getElementById('alert-'+type+'-btns');
  const result = document.getElementById('alert-'+type+'-result');
  if(btns) btns.style.display = 'none';
  if(!result) return;
  result.style.display = 'block';

  const responses = {
    decline: {
      yes: 'Done! Texting top 5 candidates for each open shift now. You\'ll get a notification as each one fills. Average fill time: 8 minutes.',
      no: ''
    },
    pending: {
      yes: 'Final reminder sent to all ' + (demoCountAll('May 2','pending') + demoCountAll('May 3','pending')) + ' pending employees: "Last call — respond by 8 PM or your shift goes to someone else." I\'ll start auto-filling at 8:01 PM.',
      no: 'Skipping the reminder. At 8 PM I\'ll release all pending shifts and start texting replacements automatically. You\'ll get a summary by 9 PM.'
    },
    surge: {
      yes: 'Texting 4 qualified floaters now. First 2 to reply YES are in. I\'ll confirm the final Saturday Float count once they respond.',
      no: 'Got it — sticking with 3 Floaters for Saturday. If lines get long at Admission or Bake Shop, I\'ll ping you with a real-time heads-up so you can redirect someone.'
    }
  };

  if(approved) {
    result.innerHTML = '<div style="background:rgba(52,211,153,.06);border-radius:6px;padding:8px 10px;border:1px solid rgba(52,211,153,.2);margin-top:8px">'+
      '<div class="text-xs text-green semi">✅ On it.</div>'+
      '<div class="text-xs text-muted mt1">' + responses[type].yes + '</div></div>';
  } else {
    result.innerHTML = '<div style="background:rgba(100,116,139,.06);border-radius:6px;padding:8px 10px;border:1px solid rgba(100,116,139,.2);margin-top:8px">'+
      '<div class="text-xs text-muted semi">👍 Noted.</div>'+
      '<div class="text-xs text-muted mt1">' + responses[type].no + '</div></div>';
  }
}

function renderDemoAlerts(app) {
  app.innerHTML = UI.adminShell('demo-alerts', `
    <div class="page">
      ${renderDemoAlertsContent()}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO ROSTER
// ═══════════════════════════════════════════════════════
function renderDemoRosterContent() {
  const active = DEMO_EMPLOYEES.filter(e=>e.status==='active');
  const inactive = DEMO_EMPLOYEES.filter(e=>e.status!=='active');

  return '<h1>👥 Employee Roster</h1>'+
    '<div class="subtitle">'+active.length+' active · '+inactive.length+' inactive · 60 total spring season roster</div>'+

    '<div class="card" style="padding:0;overflow-x:auto">'+
    '<table><thead><tr><th>Employee</th><th>Overall</th><th>Reliability</th><th>Experience</th><th>Station Skills</th><th>Sat Avail</th><th>Sun Avail</th><th>Status</th></tr></thead>'+
    '<tbody>'+
    active.slice(0,35).map(e => {
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
        '<td><span class="badge badge-green">active</span></td></tr>';
    }).join('')+
    '</tbody></table>'+
    '<div style="padding:10px;text-align:center"><span class="text-xs text-muted">Showing 35 of '+active.length+' active employees</span></div>'+
    '</div>';
}

function renderDemoRoster(app) {
  app.innerHTML = UI.adminShell('demo-roster', `
    <div class="page">
      ${renderDemoRosterContent()}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════
// RENDER: DEMO EMPLOYEE VIEW
// ═══════════════════════════════════════════════════════
function renderDemoEmployeeContent() {
  const emp = DEMO_EMPLOYEES[0];

  return '<h1>👤 Employee View</h1><div class="subtitle">What employees see via their SMS schedule link</div>'+

    '<div class="card" style="max-width:400px;margin:0 auto;border-color:rgba(167,139,250,.3)">'+
      '<div class="text-center mb3"><div class="text-xs text-muted">📱 Phone View</div><div class="semi" style="font-size:15px;margin-top:4px">Spring on the Farm</div><div class="text-xs text-muted">May 2-3 · Center Grove Orchard</div></div>'+
      '<div style="background:#0F172A;border-radius:10px;padding:12px;margin-bottom:10px">'+
        '<div class="flex justify-between items-center mb2"><div class="semi">'+emp.firstName+' '+emp.lastName+'</div><span class="badge badge-green">✓ Confirmed</span></div>'+
        '<div class="text-xs text-muted semi mb1" style="text-transform:uppercase;letter-spacing:.5px">Saturday, May 2</div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Station</span><span class="text-xs semi">🌷 Tulip U-Pick</span></div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Shift</span><span class="text-xs semi">9:00 AM – 5:00 PM</span></div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Weather</span><span class="text-xs semi">☀️ 73° Sunny</span></div>'+
        '<div style="height:8px"></div>'+
        '<div class="text-xs text-muted semi mb1" style="text-transform:uppercase;letter-spacing:.5px">Sunday, May 3</div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Station</span><span class="text-xs semi">🐣 Baby Animal Barn</span></div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Shift</span><span class="text-xs semi">9:00 AM – 5:00 PM</span></div>'+
        '<div style="padding:5px 0" class="flex justify-between"><span class="text-xs text-muted">Weather</span><span class="text-xs semi">⛅ 67° Partly Cloudy</span></div>'+
      '</div>'+
      '<div style="background:rgba(52,211,153,.06);border-radius:8px;padding:8px;text-align:center;border:1px solid rgba(52,211,153,.2)">'+
        '<div class="text-xs text-green semi">✓ You\'re confirmed for both days!</div>'+
        '<div class="text-xs text-muted mt1">Report 15 min early · Wear sunscreen 🌷</div></div>'+
    '</div>'+

    '<div class="card" style="max-width:400px;margin:14px auto 0;border-color:rgba(251,191,36,.3)">'+
      '<div class="text-center mb2"><div class="text-xs text-muted">Pending employee view:</div></div>'+
      '<div style="background:#0F172A;border-radius:10px;padding:12px">'+
        '<div class="flex justify-between items-center mb2"><div class="semi">Riley Walker</div><span class="badge badge-amber">⏳ Needs Response</span></div>'+
        '<div style="padding:5px 0;border-bottom:1px solid #1E293B" class="flex justify-between"><span class="text-xs text-muted">Saturday</span><span class="text-xs semi">🎟️ Admission · 9 AM – 5 PM</span></div>'+
        '<div style="padding:5px 0" class="flex justify-between"><span class="text-xs text-muted">Sunday</span><span class="text-xs semi">🌷 Tulip U-Pick · 9 AM – 5 PM</span></div>'+
        '<div class="flex gap2 justify-center mt3"><button class="btn btn-success btn-sm">✓ I\'ll Be There</button><button class="btn btn-danger btn-sm">✗ Can\'t Make It</button></div>'+
        '<div class="text-xs text-muted text-center mt2">⏰ Respond by Thu 8 PM</div>'+
      '</div>'+
    '</div>';
}

function renderDemoEmployee(app) {
  app.innerHTML = UI.adminShell('demo-employee', `
    <div class="page">
      ${renderDemoEmployeeContent()}
    </div>
  `);
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
      const sLower = s.name.toLowerCase();
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
    '<div class="text-xs text-muted" style="margin-bottom:8px">Texting '+count+' employees now: <em>"Hi — due to weather, your '+demoStormDay+' shift has been cancelled. Stay safe, and we\'ll see you next time!"</em></div>'+
    '<div class="text-xs text-muted" style="line-height:1.8">'+changes.join('<br>')+'</div>'+
    '<div class="text-xs text-green semi" style="margin-top:8px">📱 All notifications sent. Affected employees will get a confirmation text within 2 minutes.</div>'+
  '</div>';
}

function renderDemoStormContent() {
  demoStormExecuted = false;
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

  let h = '<div class="page-header"><h1>🌧️ Storm Mode</h1>'+
    '<p class="text-muted text-sm">Rapidly downsize staff when weather or emergencies hit. Pick a day, choose what to cut, and hit Execute — CrewCast texts everyone at once.</p></div>';

  h += '<div class="card" style="border-color:rgba(248,113,113,.4);border-width:2px"><div class="card-header">'+
    '<div><div class="card-title">⚡ Quick Setup</div><div class="text-xs text-muted">Which day needs the cut?</div></div>'+
    '<div class="flex gap2">'+
      '<button class="btn btn-sm '+(demoStormDay==='May 2'?'btn-danger':'btn-secondary')+'" onclick="demoStormDay=\'May 2\';demoDemoStormCuts={};refreshDemoStorm()">Saturday May 2</button>'+
      '<button class="btn btn-sm '+(demoStormDay==='May 3'?'btn-danger':'btn-secondary')+'" onclick="demoStormDay=\'May 3\';demoDemoStormCuts={};refreshDemoStorm()">Sunday May 3</button>'+
    '</div></div>';

  h += '<div style="display:grid;gap:8px;margin-top:12px">'+
    '<div class="text-xs semi text-muted" style="margin-bottom:2px">Quick Actions:</div>'+
    '<div class="flex gap2 flex-wrap">'+
      '<button class="btn btn-sm btn-danger" onclick="demoStormCloseOutdoor()">🌧️ Close All Outdoor</button>'+
      '<span class="flex items-center gap1" style="display:inline-flex"><select id="storm-pct-select" style="width:70px;background:#0F172A;border:1px solid rgba(248,113,113,.4);border-radius:4px;padding:4px 6px;color:#F87171;font-size:11px;text-align:center">'+
        Array.from({length:19},(_,i)=>{const v=(i+1)*5; return '<option value="'+v+'"'+(v===50?' selected':'')+'>'+v+'%</option>';}).join('')+
      '</select>'+
      '<button class="btn btn-sm btn-secondary" style="border-color:rgba(248,113,113,.4);color:#F87171" onclick="demoStormCutByPct(parseInt(document.getElementById(\'storm-pct-select\').value))">📉 Cut All</button></span>'+
      '<button class="btn btn-sm btn-secondary" style="border-color:rgba(251,191,36,.4);color:#FBBF24" onclick="demoStormKeepEssential()">🏠 Indoor Only + Parking</button>'+
      '<button class="btn btn-sm btn-secondary" onclick="demoStormReset()">↩️ Reset</button>'+
    '</div>'+
  '</div></div>';

  const cutColor = pctCut > 50 ? '#F87171' : pctCut > 20 ? '#FBBF24' : '#34D399';
  h += '<div class="card" style="background:linear-gradient(135deg,rgba(248,113,113,.08),rgba(248,113,113,.02));border-color:rgba(248,113,113,.3)">'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center">'+
      '<div><div class="text-xs text-muted">Scheduled</div><div class="semi" style="font-size:24px;color:#E2E8F0">'+totalScheduled+'</div></div>'+
      '<div><div class="text-xs text-muted">Cutting</div><div class="semi" style="font-size:24px;color:#F87171">'+totalCut+'</div></div>'+
      '<div><div class="text-xs text-muted">Remaining</div><div class="semi" style="font-size:24px;color:#34D399">'+remaining+'</div></div>'+
      '<div><div class="text-xs text-muted">Reduction</div><div class="semi" style="font-size:24px;color:'+cutColor+'">'+pctCut+'%</div></div>'+
    '</div></div>';

  h += '<div class="card"><div class="card-header"><div class="card-title">Station-by-Station</div><span class="text-xs text-muted">Tap a station to close it, or type the number to keep</span></div>';

  h += '<div class="text-xs semi text-muted" style="margin:8px 0 6px">☀️ OUTDOOR STATIONS</div>';
  h += '<div style="display:grid;gap:6px">';
  outdoor.forEach(s=>{
    const scheduled = staffCounts[s.id];
    const cut = demoDemoStormCuts[s.id] || 0;
    const keeping = Math.max(0, scheduled - cut);
    const isClosed = cut >= scheduled;
    const bgColor = isClosed ? 'rgba(248,113,113,.08)' : cut > 0 ? 'rgba(251,191,36,.06)' : 'rgba(30,41,59,.5)';
    const borderColor = isClosed ? 'rgba(248,113,113,.3)' : cut > 0 ? 'rgba(251,191,36,.2)' : '#334155';

    h += '<div style="background:'+bgColor+';border:1px solid '+borderColor+';border-radius:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between">'+
      '<div style="flex:1">'+
        '<div class="flex items-center gap2"><span>'+s.icon+'</span><span class="semi text-sm" style="color:'+(isClosed?'#F87171':'#E2E8F0')+'">'+s.name+'</span>'+
        (isClosed ? '<span class="badge badge-red" style="font-size:9px">CLOSED</span>' : cut > 0 ? '<span class="badge badge-amber" style="font-size:9px">REDUCED</span>' : '') +'</div>'+
        '<div class="text-xs text-muted" style="margin-top:2px">Scheduled: '+scheduled+' · Keeping: <strong style="color:'+(isClosed?'#F87171':'#34D399')+'">'+keeping+'</strong></div>'+
      '</div>'+
      '<div class="flex gap2 items-center">'+
        '<button class="btn btn-sm '+(isClosed?'btn-success':'btn-danger')+'" style="font-size:10px;padding:4px 10px" onclick="demoStormToggle(\''+s.id+'\','+scheduled+')">'+(isClosed?'Reopen':'Close')+'</button>'+
        '<input type="number" min="0" max="'+scheduled+'" value="'+keeping+'" style="width:50px;background:#0F172A;border:1px solid #475569;border-radius:4px;padding:4px 6px;color:#E2E8F0;font-size:12px;text-align:center" onchange="demoStormSetKeep(\''+s.id+'\','+scheduled+',this.value)">'+
      '</div>'+
    '</div>';
  });
  h += '</div>';

  h += '<div class="text-xs semi text-muted" style="margin:12px 0 6px">🏠 INDOOR STATIONS</div>';
  h += '<div style="display:grid;gap:6px">';
  indoor.forEach(s=>{
    const scheduled = staffCounts[s.id];
    const cut = demoDemoStormCuts[s.id] || 0;
    const keeping = Math.max(0, scheduled - cut);
    const isClosed = cut >= scheduled;
    const bgColor = isClosed ? 'rgba(248,113,113,.08)' : cut > 0 ? 'rgba(251,191,36,.06)' : 'rgba(30,41,59,.5)';
    const borderColor = isClosed ? 'rgba(248,113,113,.3)' : cut > 0 ? 'rgba(251,191,36,.2)' : '#334155';

    h += '<div style="background:'+bgColor+';border:1px solid '+borderColor+';border-radius:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between">'+
      '<div style="flex:1">'+
        '<div class="flex items-center gap2"><span>'+s.icon+'</span><span class="semi text-sm" style="color:'+(isClosed?'#F87171':'#E2E8F0')+'">'+s.name+'</span>'+
        (s.revPerHr > 0 ? '<span class="text-xs text-muted">$'+s.revPerHr+'/hr</span>' : '')+
        (isClosed ? '<span class="badge badge-red" style="font-size:9px">CLOSED</span>' : cut > 0 ? '<span class="badge badge-amber" style="font-size:9px">REDUCED</span>' : '') +'</div>'+
        '<div class="text-xs text-muted" style="margin-top:2px">Scheduled: '+scheduled+' · Keeping: <strong style="color:'+(isClosed?'#F87171':'#34D399')+'">'+keeping+'</strong></div>'+
      '</div>'+
      '<div class="flex gap2 items-center">'+
        '<button class="btn btn-sm '+(isClosed?'btn-success':'btn-danger')+'" style="font-size:10px;padding:4px 10px" onclick="demoStormToggle(\''+s.id+'\','+scheduled+')">'+(isClosed?'Reopen':'Close')+'</button>'+
        '<input type="number" min="0" max="'+scheduled+'" value="'+keeping+'" style="width:50px;background:#0F172A;border:1px solid #475569;border-radius:4px;padding:4px 6px;color:#E2E8F0;font-size:12px;text-align:center" onchange="demoStormSetKeep(\''+s.id+'\','+scheduled+',this.value)">'+
      '</div>'+
    '</div>';
  });
  h += '</div></div>';

  h += '<div class="card" style="border-color:rgba(167,139,250,.3)"><div class="card-header"><div class="card-title">💬 Or Just Tell Me</div></div>'+
    '<div class="text-xs text-muted" style="margin-bottom:8px">Type what you want in plain English — I\'ll figure out the rest.</div>'+
    '<div class="flex gap2" id="storm-custom-wrap">'+
      '<input type="text" id="storm-custom-input" placeholder="e.g. Close everything except Bake Shop and Country Store, or just cut Tulips and Slide..." style="flex:1;background:#0F172A;border:1px solid #475569;border-radius:6px;padding:8px 10px;color:#E2E8F0;font-size:12px">'+
      '<button class="btn btn-success btn-sm" onclick="demoStormCustom()">Send</button>'+
    '</div>'+
    '<div id="storm-custom-reply" style="display:none;margin-top:8px"></div>'+
  '</div>';

  h += '<div class="card" style="border-color:rgba(248,113,113,.4);border-width:2px" id="storm-execute-card">'+
    '<div style="text-align:center;padding:8px 0">'+
      '<div class="text-sm text-muted" style="margin-bottom:8px">'+
        (totalCut > 0 ? '⚠️ This will text <strong class="text-amber">'+totalCut+' employees</strong> that their shift is cancelled for '+demoStormDay+'.' : 'Make your cuts above, then hit Execute.')+'</div>'+
      '<button class="btn btn-danger" style="font-size:14px;padding:10px 32px;'+(totalCut===0?'opacity:.4;pointer-events:none':'')+'" onclick="demoStormExecute('+totalCut+')">🌧️ Execute Storm Mode — Notify '+totalCut+' People</button>'+
      '<div id="storm-execute-result" style="display:none;margin-top:12px"></div>'+
    '</div></div>';

  return h;
}

function renderDemoStorm(app) {
  app.innerHTML = UI.adminShell('demo-storm', `
    <div class="page">
      ${renderDemoStormContent()}
    </div>
  `);
}
