// window.__game test hooks (shared/test-harness/README.md contract; MECHANICS.md §13). All results are JSON.
import { NUT_ORDER } from './sim/const.js';
import { rowOrderFor } from './gfx/backdrop.js';
import { audioState } from './ui/audio.js';

export function installHooks(App, api) {
  const summary = () => {
    const sim = App.sim, b = sim && sim.b, cam = App.renderer.cam;
    const out = {
      scene: App.scene, screen: App.screens.cur, paused: App.paused || App.testPaused, ready: App.ready, loading: App.loading,
      settings: App.save.settings, save: { story: App.save.story, stats: App.save.stats, resume: !!App.save.resume },
      camera: { x: +cam.x.toFixed(1), y: +cam.y.toFixed(1), zoom: +cam.zoom.toFixed(3), user: cam.user },
      render: { w: App.renderer.size.w, h: App.renderer.size.h, dpr: App.renderer.size.dpr, artLoaded: !!(App.renderer.art && App.renderer.art.img), backdrop: App.level ? { id: App.level.backdrop, stretch: App.level.stretch, order: App.renderer.art && App.renderer.art.img ? rowOrderFor() : App.renderer.backdrop ? App.renderer.backdrop.order : rowOrderFor() } : null },
      level: App.level ? { id: App.level.id, name: App.level.name, n: App.level.n, stretch: App.level.stretch, season: App.level.season, time: App.level.time } : null,
      setup: App.setup, steps: App.steps, showPerches: !!App.showPerches, aiActive: !!App.aiActive, lastSaid: App.lastSaid || '', audio: audioState(),
      fx: App.renderer.fx.count, targetsHit: (App.targetsHit || []).length,
    };
    if (b) {
      out.battle = {
        phase: b.phase, round: b.round, rounds: b.rounds, roundWins: b.roundWins, mode: b.mode, practice: b.practice, difficulty: b.difficulty,
        turn: { ...b.turn }, wind: +b.wind.toFixed(4), steam: b.steamLevel, result: b.result,
        teams: b.teams.map((t, i) => ({ id: t.id, human: t.human, acorns: t.acorns, inventory: { ...t.inventory }, aim: { ...t.aim }, stats: { ...t.stats }, alive: sim.alive(i) })),
        squirrels: b.squirrels.map((q) => ({ id: q.id, team: q.team, name: q.name, x: +q.x.toFixed(2), y: +q.y.toFixed(2), grip: q.grip, out: q.out, perch: q.perch, falling: !!q.fall, dummy: !!q.dummy })),
        branches: { total: b.trees.reduce((n, t) => n + t.b.length, 0), broken: b.trees.reduce((n, t) => n + t.b.filter((s) => s.broken).length, 0) },
        nuts: b.nuts.map((n) => ({ kind: n.kind, x: +n.x.toFixed(1), y: +n.y.toFixed(1), state: n.state, tapped: n.tapped })),
        craters: b.craters.length, events: b.log.slice(-20), hash: api.hashBattle(b),
        birds: { level: b.birdLevel, t: +(b.birdT || 0).toFixed(3), list: (b.birds || []).map((bd, i) => { const p = sim.birdAt(i); return { kind: bd.k, x: +p.x.toFixed(1), y: +p.y.toFixed(1), startled: !!bd.flee }; }) },
      };
    }
    return out;
  };

  window.__game = {
    seed(n) { App.nextSeed = n >>> 0; return true; },
    getState: summary,
    setState(s = {}) {
      if (s.settings) { Object.assign(App.save.settings, s.settings); api.applySettings(); api.persist(); }
      if (s.story) { Object.assign(App.save.story, s.story); api.persist(); }
      if (s.wind != null && App.sim) App.sim.b.wind = s.wind;
      if (s.aim && App.sim) App.sim.setAim(s.aim);
      if (s.inventory && App.sim) Object.assign(App.sim.b.teams[s.team ?? App.sim.b.turn.team].inventory, s.inventory);
      if (s.acorns != null && App.sim) App.sim.b.teams[s.team ?? 0].acorns = s.acorns;
      App.guideKey = ''; App.kick();
      return summary();
    },
    isIdle() { return api.idle(); },
    step(n = 1) { for (let i = 0; i < n; i++) api.stepOnce(); App.kick(); return summary(); },
    pause() { App.testPaused = true; return true; },
    resume() { App.testPaused = false; App.paused = false; App.kick(); return true; },
    scene(name, opts = {}) {
      if (name === 'title') api.showTitle();
      else if (name === 'game' || name === 'battle') api.startBattle({ mode: 'quick', levelId: opts.levelId || 'gray', team: 0, seed: App.nextSeed ?? 7, difficulty: 'medium', ...opts });
      else if (name === 'practice') App.onMenu('practice', {});
      else if (name === 'story') { if (App.save.story.team == null) App.save.story.team = 0; App.onMenu('story', {}); }
      else if (name === 'quick') App.onMenu('quick', {});
      else if (['help', 'settings', 'credits'].includes(name)) App.onMenu(name, {});
      else if (name === 'pause') { if (App.scene === 'battle') { App.paused = true; App.screens.show('pause'); } }
      else if (name === 'shop') { if (App.sim) { App.sim.forceRound(0); App.sim.drain(); App.pendingEnd = null; App.screens.show('shop', { team: 0, round: App.sim.b.result.round, winner: 0 }); } }
      else if (name === 'results') { if (App.sim) { App.sim.forceRound(App.sim.b.teams.findIndex((t) => t.human)); const r = App.sim.b; if (r.phase !== 'battleEnd') { r.phase = 'battleEnd'; r.result.done = true; r.result.battleWinner = r.result.winner; } App.sim.drain(); App.pendingEnd = null; api.battleOver(); } }
      App.kick();
      return summary();
    },
    newGame(opts = {}) { api.startBattle({ mode: 'quick', levelId: 'gray', team: 0, seed: App.nextSeed ?? 7, difficulty: 'medium', ...opts }); return summary(); },
    act(name, ...args) {
      const sim = App.sim, b = sim && sim.b;
      switch (name) {
        case 'aim': sim.setAim(args[0] || {}); App.guideKey = ''; App.kick(); return { ...b.teams[b.turn.team].aim };
        case 'fire': { const ok = sim.throwNut(args[0] || {}); App.kick(); return ok; }
        case 'tap': { const ok = sim.tap(); App.kick(); return ok; }
        case 'skipFlight': { for (let i = 0; i < 120 * 30 && sim.busy(); i++) api.stepOnce(); api.stepOnce(); App.kick(); return summary(); }
        case 'flyTo': { // step the flight until the lead nut has flown n steps (for mid-flight shots)
          for (let i = 0; i < (args[0] || 60) && b.phase === 'flight'; i++) api.stepOnce();
          api.frameCamera(true); App.kick(); return summary();
        }
        case 'move': { const r = args[0] && args[0].toNode ? sim.move(args[0].toNode) : null; App.kick(); return r; }
        case 'perches': { const m = sim.reach(); const q = sim.active(); return [...m.entries()].map(([id, cost]) => { const n = sim.graphs[q.team].byId.get(id); return { id, cost: +cost.toFixed(1), x: n.x, y: n.y, kind: n.kind }; }); }
        case 'perchScreen': { const q = sim.active(), n = sim.graphs[q.team].byId.get(args[0]); return n ? App.renderer.cam.toScreen(n.x, n.y) : null; }
        case 'screenOf': { const q = b.squirrels.find((s) => s.id === args[0]); return q ? App.renderer.cam.toScreen(q.x, q.y - 20) : null; }
        case 'buyNut': return sim.buy(args[1] ?? b.teams.findIndex((t) => t.human), args[0]);
        case 'setWind': b.wind = args[0]; App.guideKey = ''; App.kick(); return true;
        case 'setGrip': { const q = b.squirrels.find((s) => s.id === args[0]); if (q) q.grip = args[1]; return !!q; }
        case 'aiPlan': return api.planTurn(sim, args[0] || App.setup.difficulty || 'medium');
        case 'aiTurn': { const p = api.planTurn(sim, args[0] || App.setup.difficulty || 'medium'); if (p) sim.throwNut(p); App.kick(); return p; }
        case 'preview': return sim.preview(args[0] || b.teams[b.turn.team].aim, args[1] || {}).impact;
        case 'hash': return api.hashBattle(b);
        case 'clock': App.clock = args[0] == null ? null : args[0] / 1000; App.kick(); return true;
        case 'cam': {
          const c = App.renderer.cam, a = args[0];
          if (a === 'frame' || a == null) { c.user = false; api.frameCamera(true); }
          else if (typeof a === 'object') { c.set(a.x ?? c.x, a.y ?? c.y, a.zoom ?? c.zoom, true); c.user = true; }
          App.kick(); return { x: c.x, y: c.y, zoom: c.zoom };
        }
        case 'hud': document.getElementById('hud').style.visibility = args[0] === false ? 'hidden' : ''; return true;
        case 'endRound': sim.forceRound(args[0] ?? 0); App.kick(); return b.result;
        case 'menu': App.onMenu(args[0], args[1] || {}); return App.screens.cur;
        case 'fxCount': return App.renderer.fx.count;
        case 'nutOrder': return NUT_ORDER;
        case 'moveMode': App.onHud('move'); return App.showPerches;
        case 'level': return App.level;
        case 'terrainAt': return sim.terrain.at(args[0], args[1]);
        case 'surfaceY': return sim.terrain.surfaceY(args[0]);
        case 'visualAlpha': { // alpha of the visual terrain canvas at a world point (mask/visual agreement)
          const cv = App.renderer.terrain.cv, s = App.renderer.terrain.scale;
          return cv.getContext('2d').getImageData(Math.floor(args[0] * s), Math.floor(args[1] * s), 1, 1).data[3];
        }
        case 'clearSave': localStorage.removeItem && (() => { try { localStorage.removeItem('hsg-furious-squirrels-v1'); } catch (e) { /* blocked */ } })(); return true;
        default: return false;
      }
    },
  };
}
