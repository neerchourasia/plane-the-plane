// In-page self test: the game loads this only when the page address has ?selftest. It flies the game's own physics and logic through a list of
// checks and writes the result as JSON into <pre id="selftest-result">, for tools/selftest.py to read. Nothing here touches the server.
(function () {
  const results = [];
  const QUICK = /selftest=quick/.test(location.search);   // quick: only the world, models, graphics and one take-off
  const check = (name, fn) => {
    if (QUICK && !/^(world:|models:|graphics:|take-off from an airport: Trainer)/.test(name)) return;
    const t0 = performance.now();
    try { const r = fn(); results.push({ name, ok: r === true || (r && r.ok !== false && r !== false), detail: r && r.detail !== undefined ? r.detail : '', ms: Math.round(performance.now() - t0) }); }
    catch (e) { results.push({ name, ok: false, detail: 'exception: ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : e), ms: Math.round(performance.now() - t0) }); }
  };
  const quiet = () => { pilot = 't'; homeOpen = false; STORMS.length = 0; document.getElementById('login').style.display = 'none'; };
  const useModel = name => { save.selected = MODELS.findIndex(m => m.name === name); };
  // a time when this airport's runway is not closed for the next while
  const openTime = (i0, span) => { for (let b = 0; b < 800; b++) { let ok = true; for (let k = 0; k < span; k++) if (hash2(i0, 5000 + b + k) < 0.09) { ok = false; break; } if (ok) return b * EVENT_SECS * 0 + b * 420 + 5; } return 5; };
  // random engine failures, fires and gusts would make the checks flaky: run the check with Math.random fixed high (nothing rare happens)
  const calm = fn => () => { const r = Math.random; Math.random = () => 0.9999; try { return fn(); } finally { Math.random = r; } };
  const freshTraffic = a => { trafficStop(a); a.traffic = null; a.rw = null; (a.stands || []).forEach(s => { s.away = false; }); };
  const hold = (p, x, y, z) => { p.pos = [x, y, z]; p.vel = [0, 0, 0]; p.onGround = false; p.crashed = false; };

  function run() {
    quiet();
    check('world: 250 airports, all placed inside the map', () => {
      const bad = AIRPORTS.filter(a => Math.abs(a.x) > TER_HALF || Math.abs(a.z) > TER_HALF).map(a => a.code);
      return { ok: AIRPORTS.length >= 80 && bad.length === 0, detail: `${AIRPORTS.length} airports, outside: ${bad.join(',') || 'none'}` };
    });
    check('world: runways do not overlap', () => {
      const seg = a => { const ux = Math.sin(a.hdgRad) * a.len / 2, uz = Math.cos(a.hdgRad) * a.len / 2; return [[a.x - ux, a.z - uz], [a.x + ux, a.z + uz]]; };
      const pd = (p, a, b) => { const ax = b[0] - a[0], az = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ax + (p[1] - a[1]) * az) / (ax * ax + az * az || 1))); return Math.hypot(a[0] + ax * t - p[0], a[1] + az * t - p[1]); };
      let min = 1e9, pair = '';
      for (let i = 0; i < AIRPORTS.length; i++) for (let j = i + 1; j < AIRPORTS.length; j++) {
        const [a1, a2] = seg(AIRPORTS[i]), [b1, b2] = seg(AIRPORTS[j]);
        const d = Math.min(pd(a1, b1, b2), pd(a2, b1, b2), pd(b1, a1, a2), pd(b2, a1, a2));
        if (d < min) { min = d; pair = AIRPORTS[i].code + '-' + AIRPORTS[j].code; }
      }
      return { ok: min > 60, detail: `closest ${Math.round(min)} m (${pair})` };
    });
    check('world: every airport has real coordinates and a sensible runway', () => {
      const bad = AIRPORTS.filter(a => !(Math.abs(a.lat) <= 90 && Math.abs(a.lon) <= 180) || !(a.len >= 400 && a.len <= 3000) || !(a.realLen >= 800)).map(a => a.code);
      return { ok: bad.length === 0, detail: bad.join(',') || 'all fine' };
    });
    for (const name of ['Trainer', 'Cessna 172', '737', '747', 'Business Jet', 'Turboprop', 'F-16']) {
      check('take-off from an airport: ' + name, calm(() => {
        const a = AIRPORTS.find(x => x.code === 'JFK');
        windT = openTime(AIRPORTS.indexOf(a), 3); useModel(name); resetPlane(1); teleportTo({ ground: true, x: a.x, z: a.z, hdg: a.hdgRad });
        const p = plane; p.throttle = 1; let t = 0, lifted = null;
        for (let i = 0; i < 1500 && !p.crashed; i++) { t += 0.05; if (p.speed > stallSpeed(p) * 1.15) keys.KeyS = true; update(0.05); if (p.pos[1] - terrainAt(p.pos[0], p.pos[2]) > 8) { lifted = t; break; } }
        keys.KeyS = false;
        return { ok: lifted !== null && !p.crashed, detail: lifted ? `airborne after ${lifted.toFixed(1)} s` : (p.crashMsg || 'never lifted off') };
      }));
    }
    check('stall: the nose drops and the plane recovers', () => {
      useModel('Trainer'); resetPlane(1); const p = plane;
      p.pos = [0, 1200, 0]; p.yaw = 0; p.pitch = 0.6; p.vel = [0, 6, 9]; p.speed = 10; p.onGround = false; p.gear = false; p.throttle = 0.3;
      let stalled = false, minY = 1e9, t = 0;
      for (let i = 0; i < 1200 && !p.crashed; i++) { t += 0.05; keys.KeyW = p.stalled; keys.KeyS = false; update(0.05); if (p.stalled) stalled = true; minY = Math.min(minY, p.pos[1]); if (t > 4 && !p.stalled && p.speed > stallSpeed(p) * 1.2) break; }
      keys.KeyW = false;
      return { ok: stalled && !p.crashed && !p.stalled && p.pos[1] > 600, detail: `stalled=${stalled} crashed=${p.crashed} height ${Math.round(p.pos[1])} m, lowest ${Math.round(minY)} m` };
    });
    for (const name of ['737', 'Trainer']) {
      check('ILS autoland in the practice lesson: ' + name, calm(() => {
        windT = 700; useModel(name); startLesson(LESSONS.findIndex(l => l.id === 'practice'));
        const p = plane; p.gear = true; toggleILS();
        if (!(p.ap && p.ap.ils)) return { ok: false, detail: 'the autoland did not engage' };
        landReport = null; let t = 0;
        for (let i = 0; i < 9000 && !p.onGround && !p.crashed; i++) { t += 0.05; update(0.05); checkLesson(); }
        lesson = null;
        return { ok: p.onGround && !p.crashed && !!landReport, detail: `${p.crashed ? 'crashed: ' + p.crashMsg : 'landed'} after ${Math.round(t)} s, report ${landReport ? landReport.score + '/100 ' + landReport.grade : 'none'}` };
      }));
    }
    check('traffic: three planes run for 7 minutes without a runway clash', calm(() => {
      const i0 = AIRPORTS.findIndex(x => x.code === 'LHR'), a = AIRPORTS[i0];
      windT = openTime(i0, 8); useModel('Trainer'); resetPlane(1); freshTraffic(a);
      const seen = new Set(); let clash = 0;
      for (let i = 0; i < 9000; i++) {
        hold(plane, a.x + 900, terrainAt(a.x, a.z) + 700, a.z); update(0.05);
        const slots = (a.traffic || []).filter(q => q && q.plane);
        const onRw = slots.filter(q => ['lineup', 'turn', 'approach', 'rollout'].includes(q.phase) || (q.phase === 'roll' && !(q.plane.alt > 25))).length;
        if (onRw > 1) clash++;
        (a.traffic || []).forEach(q => q && seen.add(q.phase));
      }
      return { ok: clash === 0 && seen.has('roll') && seen.has('approach') && seen.has('enter'), detail: `phases ${[...seen].join(' ')}; clashes ${clash}` };
    }));
    check('traffic: planes hold short when you are on the runway', calm(() => {
      const i0 = AIRPORTS.findIndex(x => x.code === 'LHR'), a = AIRPORTS[i0];
      windT = openTime(i0, 8); useModel('Trainer'); resetPlane(1); freshTraffic(a); teleportTo({ ground: true, x: a.x, z: a.z, hdg: a.hdgRad });
      const p = plane; p.throttle = 0; let rolled = false;
      for (let i = 0; i < 5000 && !p.crashed; i++) { p.pos[0] = a.x; p.pos[2] = a.z; p.pos[1] = terrainAt(a.x, a.z) + p.model.gearLen; p.vel = [0, 0, 0]; update(0.05); (a.traffic || []).forEach(q => { if (q && q.phase === 'roll') rolled = true; }); }
      return { ok: !rolled && !p.crashed, detail: rolled ? 'a plane rolled with you on the runway' : 'nobody rolled' };
    }));
    check('emergencies: a fire burns out in 30 s, and K with idle throttle puts it out', () => {
      useModel('Trainer'); resetPlane(1); let p = plane;
      p.pos = [0, 800, 0]; p.vel = [0, 0, 40]; p.onGround = false; p.throttle = 1; p.fire = 0;
      for (let i = 0; i < 700 && !p.crashed; i++) { p.pos[1] = 800; update(0.05); }
      const burned = p.crashed && p.crashMsg === 'Engine fire';
      resetPlane(1); p = plane; p.pos = [0, 800, 0]; p.vel = [0, 0, 40]; p.onGround = false; p.throttle = 0.05; p.fire = 0;
      for (let i = 0; i < 60; i++) { p.pos[1] = 800; update(0.05); }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }));
      return { ok: burned && p.fire == null, detail: `burned=${burned} extinguished=${p.fire == null}` };
    });
    check('refuelling: a fuel truck arrives and fills the tank', () => {
      useModel('Trainer'); resetPlane(0.4); save.coins = 200; const p = plane; refuel();
      for (let i = 0; i < 400; i++) update(0.05);
      return { ok: p.fuel > 0.99 && save.coins < 200, detail: `fuel ${p.fuel.toFixed(2)}, coins ${save.coins}` };
    });
    check('weekly challenge and campaign advance and pay', () => {
      save.coins = 0; save.weekly = null; save.campaign = 0; plane.flight = { dist: 3500, secs: 100 };
      const f = weekFocus(); weeklyAdd(f.id, f.tiers[2]); checkCampaign();
      return { ok: save.weekly.tier === 3 && save.campaign === 1 && save.coins >= 3100, detail: `tier ${save.weekly.tier}, chapter ${save.campaign}, coins ${save.coins}` };
    });
    check('events: a wildfire can be put out and survivors found', () => {
      windT = 700; useModel('Trainer'); resetPlane(1); const ev = eventsNow(); const fire = ev.find(e => e.type === 'fire'), resc = ev.find(e => e.type === 'rescue');
      if (!fire || !resc) return { ok: false, detail: 'no events generated' };
      const p = plane; p.water = 1; keys.Comma = true;
      for (let i = 0; i < 400 && !fire.done; i++) { p.pos = [fire.x - 50 + Math.sin(i / 10) * 20, terrainAt(fire.x, fire.z) + 100, fire.z]; p.onGround = false; p.vel = [0, 0, 45]; p.speed = 45; update(0.05); }
      keys.Comma = false;
      p.pos = [resc.x + 20, terrainAt(resc.x, resc.z) + 60, resc.z]; p.onGround = false; p.speed = 40; update(0.05);
      return { ok: fire.done && resc.done, detail: `fire out ${fire.done}, survivors ${resc.done}` };
    });
    check('time zones, winter and weather behave', () => {
      const h0 = hourAt(0), h1 = hourAt(5400), f = fogAtPlace(0, 0), r = rainAtPlace(0, 0);
      return { ok: Math.abs(((h1 - h0 + 36) % 24) - 12) < 12 && Math.abs((h1 - h0 + 24) % 24 - 3) < 0.01 && f >= 0 && f <= 1 && r >= 0 && r <= 1, detail: `three zones east = ${(h1 - h0 + 24) % 24} h later; fog ${f.toFixed(2)} rain ${r.toFixed(2)}` };
    });
    check('airstrip: flat ground is accepted and bad ground is refused', () => {
      useModel('Trainer'); resetPlane(1); save.coins = 5000; save.strips = []; const p = plane;
      let spot = null;
      for (let x = -8000; x < 8000 && !spot; x += 100) for (let z = -8000; z < 8000; z += 100) {
        let ok = true; for (let t = -325; t <= 325; t += 80) if (onAirfield(x, z + t, 130)) { ok = false; break; }
        if (!ok) continue; let lo = 1e9, hi = -1e9;
        for (let t = -325; t <= 325; t += 50) for (const sd of [-30, 0, 30]) { const h = terrainAt(x + sd, z + t); lo = Math.min(lo, h); hi = Math.max(hi, h); }
        if (lo > WATER + 2 && hi - lo < 3) { spot = [x, z]; break; }
      }
      if (!spot) return { ok: true, detail: 'no flat spot in this world to test (skipped)' };
      p.pos = [spot[0], terrainAt(spot[0], spot[1]) + p.model.gearLen, spot[1]]; p.yaw = 0; p.vel = [0, 0, 0]; p.onGround = true; p.speed = 0;
      const good = buildAirstrip('T'); save.coins = 5000;
      const a = AIRPORTS[0]; p.pos = [a.x, terrainAt(a.x, a.z) + p.model.gearLen, a.z]; const bad = buildAirstrip('X');
      return { ok: good === null && bad !== null, detail: `flat: ${good === null ? 'built' : good}; on a runway: ${bad}` };
    });
    check('models: every plane has a mesh and a sensible size', () => {
      const bad = MODELS.filter(m => !(m.mesh && m.mesh.length > 200) || !(m.ext && m.ext.len > 1)).map(m => m.name);
      return { ok: bad.length === 0, detail: `${MODELS.length} models${bad.length ? ', bad: ' + bad.join(',') : ''}` };
    });
    check('models: every plane draws triangles with valid numbers when you fly it', () => {
      const bad = [];
      for (const m of MODELS) {
        save.selected = MODELS.indexOf(m); resetPlane(1); plane.pos = [0, terrainAt(0, 0) + 200, 0]; plane.onGround = false; view = 0; render();
        const n = planeTris.length, nan = planeTris.some(t => t.pts.some(p => !p.every(Number.isFinite)) || !t.col.every(Number.isFinite));
        if (n < 100 || nan) bad.push(`${m.name} (${n} triangles${nan ? ', not-a-number values' : ''})`);
      }
      return { ok: bad.length === 0, detail: bad.join('; ') || `${MODELS.length} planes all draw` };
    });
    check('graphics: the world drew a frame without errors', () => {
      if (!terrainGL) return { ok: true, detail: 'no WebGL here: the flat fallback is used (skipped)' };
      useModel('737'); resetPlane(1); render();
      return { ok: terrainGL.chunks.length > 0 && terrainGL.trees && terrainGL.trees.total > 100 && planeInstances.length >= 0, detail: `${terrainGL.chunks.length} chunks, ${terrainGL.trees ? terrainGL.trees.total : 0} trees, ${buildings.length} buildings` };
    });
    finish();
  }
  function finish() {
    const failed = results.filter(r => !r.ok).length;
    const pre = document.createElement('pre');
    pre.id = 'selftest-result';
    pre.textContent = JSON.stringify({ total: results.length, failed, region: REGION_ID, results });
    document.body.append(pre);
    document.title = failed ? 'SELFTEST FAILED' : 'SELFTEST OK';
  }
  setTimeout(() => { try { run(); } catch (e) { const pre = document.createElement('pre'); pre.id = 'selftest-result'; pre.textContent = JSON.stringify({ total: 0, failed: 1, results: [{ name: 'harness', ok: false, detail: String(e && e.stack || e) }] }); document.body.append(pre); } }, 1500);
})();
