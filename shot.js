// Scene setup for tools/shot.py: loaded only when the page address has ?shot=NAME. It builds a scene, hides the on-screen text, and leaves the game running
// so headless Chrome can take a picture after a few frames.
(function () {
  const name = (location.search.match(/[?&]shot=([\w-]+)/) || [])[1] || 'planes';
  const look = (from, to) => { photoCam.pos = [...from]; const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]; photoCam.yaw = Math.atan2(dx, dz); photoCam.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
  setTimeout(() => {
    pilot = 't'; document.getElementById('login').style.display = 'none'; const loading = document.getElementById('loading'); if (loading) loading.remove();
    STORMS.length = 0; windT = 700; simHour = 12; homeOpen = false;
    for (const id of ['soundBtn', 'gfxBtn', 'setBtn', 'help']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    gfxMode = 'high'; resize();
    const y = terrainAt(0, 0) + 220;
    resetPlane(1);
    const yLow = terrainAt(0, 0) + 6;   // low enough that the landing gear shows (a plane over 25 m high has it up)
    if (name.startsWith('plane-')) {
      // one plane, close up, gear down, seen from the front quarter: e.g. ?shot=plane-737
      const model = name.slice(6).replace(/_/g, ' ');
      const m = MODELS.find(q => q.name.toLowerCase() === model.toLowerCase()) || MODELS[0];
      plane.pos = [0, yLow - 4, 300];
      others.length = 0;
      others.push({ name: 'x', callsign: '', plane: m.name, x: 0, y: yLow, z: 0, yaw: 0.0, v: 0, t0: performance.now() });
      const d = Math.max(m.ext.len, m.ext.span) * 1.9;
      photoMode = true; look([d * 0.8, yLow + m.ext.len * 0.12, d * 0.55], [0, yLow + m.ext.len * 0.04, 0]);
      window.__gear = true;
    } else if (name.startsWith('horizon')) {
      // a level look at the horizon from 250 m up; horizon-N looks toward the Nth compass quarter
      const q = Number(name.slice(8) || 0), yaw = q * Math.PI / 2, h0 = terrainAt(0, 0) + 250;
      plane.pos = [0, h0 - 300, 0];
      photoMode = true; photoCam.pos = [0, h0, 0]; photoCam.yaw = yaw; photoCam.pitch = 0;
    } else if (name === 'apron') {
      const a = AIRPORTS.find(x => x.code === 'LHR'), h = a.hdgRad, side = a.complex.side, ux = Math.sin(h), uz = Math.cos(h), sx = Math.cos(h) * side, sz = -Math.sin(h) * side;
      plane.pos = [a.x - ux * 80, a.apron.y + 40, a.z - uz * 80];
      photoMode = true; look([a.x - ux * 70 - sx * 25, a.apron.y + 14, a.z - uz * 70 - sz * 25], [a.x + sx * 90, a.apron.y + 4, a.z + sz * 90]);
    }
    // let the game draw the scene for a few frames; the gear of the shown plane stays down (a parked plane has it down)
    document.title = 'SHOT READY';
  }, 2500);
})();
