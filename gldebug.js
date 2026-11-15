// Diagnostics: open the game with ?gldebug=1 and a text box shows what the graphics are doing (for chasing bugs that only happen on some computers).
(function () {
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;max-width:60vw;margin:0;padding:8px;background:rgba(0,0,0,.8);color:#9fffb0;font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap;pointer-events:none';
  document.body.append(box);
  let drawn = { tris: 0, inst: 0, err: 0, n: 0 };
  const orig = window.drawPlaneGL;
  window.drawPlaneGL = function (cam) {
    drawn.tris = planeTris.length; drawn.inst = planeInstances.length; drawn.n++;
    const r = orig.apply(this, arguments);
    try { drawn.err = gl ? gl.getError() : -1; } catch (e) { drawn.err = 'x'; }
    return r;
  };
  const info = () => {
    let renderer = '?';
    try { const e = gl.getExtension('WEBGL_debug_renderer_info'); renderer = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { /* none */ }
    return renderer;
  };
  const renderer = info();
  setInterval(() => {
    const p = plane, lines = [];
    lines.push('GL DEBUG  ' + navigator.userAgent.replace(/\(.*?\)/, '').slice(0, 90));
    lines.push('renderer: ' + renderer);
    lines.push('gl context: ' + (gl ? (gl.isContextLost() ? 'LOST' : 'ok') : 'NONE') + '   terrainGL: ' + (terrainGL ? 'ok' : 'none'));
    if (gl && planeProg) {
      lines.push('plane program linked: ' + gl.getProgramParameter(planeProg, gl.LINK_STATUS) + '  log: ' + (gl.getProgramInfoLog(planeProg) || 'none'));
      const sh = gl.getAttachedShaders(planeProg) || [];
      lines.push('shaders: ' + sh.map(s => gl.getShaderParameter(s, gl.COMPILE_STATUS) + ' ' + (gl.getShaderInfoLog(s) || '')).join(' | '));
      lines.push('uniforms: ' + ['uPos', 'uRt', 'uUp', 'uFw', 'uEye', 'uFocal'].map(n => n + '=' + (planeUni[n] ? 'ok' : 'MISSING')).join(' '));
    } else lines.push('plane program: ' + (planeProg ? 'no gl' : 'NONE'));
    lines.push(`drawPlaneGL calls ${drawn.n}  plane triangles/frame ${drawn.tris}  instances ${drawn.inst}  getError ${drawn.err}`);
    lines.push(`view ${VIEW_NAMES[view]}  gfx ${gfxMode}${gfxLow ? ' (lowered)' : ''}  canvas ${glCanvas.width}x${glCanvas.height} css ${glCanvas.clientWidth}x${glCanvas.clientHeight}`);
    lines.push(`plane ${p.model.name} at ${p.pos.map(Math.round)}  crashed ${p.crashed}  wreck ${!!wreck}  photoMode ${photoMode}`);
    lines.push(`model mesh ${p.model.mesh.length} faces, gear ${p.model.gear.length}`);
    box.textContent = lines.join('\n');
  }, 700);
})();
