"""Furious Squirrels: the seven birds over the valley (MECHANICS.md §6b), built and rendered to sprite frames in
the squirrels' look.

Run (from the game folder; quote the paths, they contain spaces):
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup
        --python art-src/blender/scripts/bird.py -- [--kind swift,jay|all] [--no-sheet]

Writes  art-src/birds/<kind>/flap_<i>.png, glide_0.png   256 x 256 RGBA, transparent background
        art-src/birds/birds.json                         per kind: anchor (body centre, px) and bodyPx
        art-src/birds/sheet-birds.png                    every frame of every kind
        art-src/birds/small-preview.png (+ -1x)          every frame at about game size

Look: the same toolkit as the squirrels (squirrel.py): emission toon shading with a back-top rim, a solidify
inverted-hull ink line, big cartoon eyes with a shine, the same key light and Standard view transform.
Frames: side view facing +x (screen right), turned toward the camera and seen a little from below, so both
wings read on the up- and downstroke. Six flap frames (top of the upstroke first, then the downstroke with
the wing spread, then the upstroke with the hand folded back) and one glide frame. Wings are rebuilt for
every frame from a planform and three angles (shoulder, wrist, sweep); the body, head and tail stay put.
Each kind is fitted to the frame on its own (pixels per unit vary); birds.json records where the body centre
lands and how long the body is in pixels, so the game scales the body to the sim's size.
Colours follow research/birds.md and the old vector LOOK table in src/js/gfx/birds.js. All hexes estimates.
No randomness anywhere; every run gives the same frames.
"""
import bpy
import bmesh
import json
import math
import os
import sys
import time

import numpy as np
from mathutils import Vector, Matrix

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from squirrel import (toon, flat, mixhex, tube_bm, ell_bm, catmull, Ellipsoid, reset_scene,  # noqa: E402
                      read_png, write_png, bbox, label, over, downscale, BG, RES)

ART = os.path.dirname(os.path.dirname(HERE))             # art-src
OUT = os.path.join(ART, 'birds')

YAW = -20.0          # degrees the bird turns its face toward the camera
ROLL = 16.0          # degrees the near side dips, so the view is a little from below
BODY = 20.0          # body length in model units (the sim's 2.2 * r maps to this)
LINE_PX = 1.25       # ink line width on screen at zoom 1, matching the squirrels' baked line
MARGIN = 8           # px kept clear round the union of all frames
FRAMES = ['flap_%d' % i for i in range(6)] + ['glide_0']
# hit radius per kind, from src/js/sim/const.js BIRDS (the game draws the body 2.2 * r long at zoom 1)
HIT_R = dict(swift=9, vulture=22, jay=12, crow=16, goose=20, waxwing=9, eagle=25)


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def interp(stations, t):
    """stations: [(t, a, b, ...)], piecewise linear in t."""
    for (t0, *a), (t1, *b) in zip(stations, stations[1:]):
        if t <= t1:
            u = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return [p + (q - p) * u for p, q in zip(a, b)]
    return list(stations[-1][1:])


# ------------------------------------------------------------------ the roster
# body: half length, half width, half height; head: x, z, radius; wing plan: (t, leading x, trailing x) from the
# shoulder; paints: (t, c) -> colour key, c = +1 at the leading edge and -1 at the trailing edge.
def _jay_wing(t, c):
    if c < -0.5 and 0.12 < t < 0.5:
        return 'white'
    if c < 0.35 and t < 0.75 and (t * 9) % 1 < 0.2:
        return 'bar'
    return 'tip' if t > 0.72 else 'wing'


def _jay_tail(t, c):
    if t > 0.9 and abs(c) > 0.35:
        return 'white'
    return 'bar' if 0.25 < t < 0.92 and (t * 6) % 1 < 0.2 else 'tail'


SPECIES = {
    'swift': dict(
        line='#17120F', body=(10.0, 4.0, 3.9), tilt=-3, coat=('#4C4642', '#2C2826'),
        belly=dict(col=('#8E857A', '#625A51'), c=(4.6, -0.2, -1.0), r=(4.6, 3.2, 2.7)),
        head=(8.4, 0.9, 4.3), head_col=None, eye=1.0,
        beak=dict(len=1.7, r=1.1, col='#1A1410', hook=0.0),
        tail=dict(len=6.0, w=(2.2, 3.4), thin=0.24, tilt=4, fork=True, paint=lambda t, c: 'tail'),
        wing=dict(len=30.0, wrist=0.26, thin=0.22, shoulder=(2.4, 0.55, 0.4),
                  plan=[(0.0, 3.0, -2.6), (0.26, 2.2, -2.6), (0.55, -0.4, -4.0), (0.85, -6.0, -7.6), (1.0, -10.5, -11.0)],
                  paint=lambda t, c: 'tip' if t > 0.6 else 'wing'),
        cols=dict(wing=('#3E3936', '#25211F'), tip=('#34302D', '#1F1C1A'), tail=('#3E3936', '#25211F')),
        flap=dict(amp=42, bias=4, glide=(8, -6, 10)),
    ),
    'vulture': dict(
        line='#140F0C', body=(10.0, 5.8, 5.6), tilt=-4, coat=('#3E342D', '#241D19'), belly=None,
        neck=dict(pts=[(7.6, 0, 1.6), (10.6, 0, 2.5), (12.3, 0, 3.2)], r=[2.6, 1.9, 1.7], col='head'),
        ruff=dict(c=(7.6, 0, 1.8), r=(3.9, 4.6, 4.4)),
        head=(13.0, 3.3, 2.9), head_col=('#CC4A3C', '#97302A'), eye=0.9,
        beak=dict(len=3.0, r=1.15, col='#EDE3C8', hook=1.1),
        tail=dict(len=9.0, w=(3.0, 4.6), thin=0.2, tilt=2, paint=lambda t, c: 'tail'),
        wing=dict(len=31.0, wrist=0.33, thin=0.2, shoulder=(1.6, 0.55, 0.45),
                  plan=[(0.0, 4.6, -5.8), (0.33, 4.4, -6.6), (0.8, 3.0, -6.4), (1.0, 2.2, -5.4)],
                  paint=lambda t, c: 'flight' if c < -0.05 else 'wing', coverts=False, feathers=5,
                  fingers=dict(n=5, len=7.0, r=1.15, spread=(-6, 34))),
        cols=dict(wing=('#3E342D', '#241D19'), flight=('#A9A39B', '#78726A'), tip=('#4E463F', '#2E2823'),
                  tail=('#3A302A', '#221C18')),
        flap=dict(amp=26, bias=10, glide=(18, -2, 4)),
    ),
    'jay': dict(
        line='#151824', body=(10.0, 5.3, 5.3), tilt=-6, coat=('#4282CF', '#2B5C9E'),
        belly=dict(col=('#F4F2EC', '#C9C6BE'), c=(2.8, -0.6, -1.6), r=(7.6, 4.6, 4.2)),
        head=(9.0, 3.4, 5.3), head_col=None, eye=1.05,
        face=dict(c=(10.6, -2.4, 2.0), r=(3.4, 3.0, 3.0)),
        crest=dict(pts=[(0.9, 0.72), (-1.4, 1.42), (-4.0, 1.78)], r=[2.9, 1.9, 0.4]),
        necklace=True,
        beak=dict(len=3.4, r=1.15, col='#1A1410', hook=0.0),
        tail=dict(len=14.0, w=(2.6, 4.2), thin=0.2, tilt=-3, paint=_jay_tail),
        wing=dict(len=22.0, wrist=0.38, thin=0.22, shoulder=(1.8, 0.55, 0.45),
                  plan=[(0.0, 3.8, -4.4), (0.38, 3.6, -5.0), (0.75, 2.0, -4.6), (1.0, -1.6, -2.6)],
                  paint=_jay_wing),
        cols=dict(wing=('#4282CF', '#2B5C9E'), tip=('#2A56A0', '#1C3C74'), bar=('#1A1C26', '#101118'),
                  white=('#F6F4EE', '#CFCBC0'), tail=('#4282CF', '#2B5C9E')),
        flap=dict(amp=55, bias=4, glide=(8, -4, 8)),
    ),
    'crow': dict(
        line='#08080C', body=(10.0, 5.4, 5.3), tilt=-5, coat=('#2C2C36', '#141419'), rim='#5C6C96', belly=None,
        head=(10.0, 2.6, 5.0), head_col=None, eye=0.95,
        beak=dict(len=5.2, r=1.7, col='#24242C', hook=0.5),
        tail=dict(len=11.0, w=(2.8, 4.8), thin=0.2, tilt=-1, paint=lambda t, c: 'tail'),
        wing=dict(len=26.0, wrist=0.34, thin=0.2, shoulder=(1.8, 0.55, 0.45),
                  plan=[(0.0, 4.2, -5.0), (0.34, 4.0, -5.6), (0.85, 2.6, -5.0), (1.0, 1.8, -4.2)],
                  paint=lambda t, c: 'wing', fingers=dict(n=5, len=6.0, r=1.0, spread=(-4, 30))),
        cols=dict(wing=('#2C2C36', '#141419'), tip=('#24242C', '#111115'), tail=('#2A2A33', '#131317')),
        flap=dict(amp=45, bias=5, glide=(8, -4, 6)),
    ),
    'goose': dict(
        line='#15110D', body=(10.0, 6.2, 5.4), tilt=0, coat=('#8C7C68', '#5E5142'),
        belly=dict(col=('#DCD0BC', '#B2A68F'), c=(3.2, -0.8, -1.8), r=(7.6, 5.0, 4.0)),
        undertail=dict(c=(-8.2, 0, -2.2), r=(3.4, 3.6, 2.6)),
        neck=dict(pts=[(7.0, 0, 1.4), (12.0, 0, 3.6), (15.4, 0, 6.6), (18.2, 0, 8.8)], r=[3.0, 2.2, 1.9, 1.9],
                  col='head'),
        head=(19.4, 9.3, 3.4), head_col=('#26221F', '#141210'), eye=1.0,
        chin=True,
        beak=dict(len=3.8, r=1.25, col='#1A1A1A', hook=0.0),
        tail=dict(len=6.5, w=(2.8, 3.8), thin=0.22, tilt=3, paint=lambda t, c: 'tail'),
        wing=dict(len=28.0, wrist=0.34, thin=0.2, shoulder=(1.6, 0.6, 0.4),
                  plan=[(0.0, 4.4, -5.2), (0.34, 4.2, -5.6), (0.75, 2.6, -5.0), (1.0, -2.6, -3.6)],
                  paint=lambda t, c: 'tip' if t > 0.6 else ('edge' if c < -0.82 else 'wing')),
        cols=dict(wing=('#7C6C5A', '#54483B'), tip=('#3C322A', '#241D18'), edge=('#B0A08A', '#857762'),
                  tail=('#26221F', '#141210')),
        flap=dict(amp=40, bias=6, glide=(8, -4, 6)),
    ),
    'waxwing': dict(
        line='#17120D', body=(10.0, 4.9, 4.9), tilt=-6, coat=('#BC9E6E', '#8E724C'),
        belly=dict(col=('#E2CE8E', '#B8A46A'), c=(2.6, -0.6, -1.6), r=(7.0, 4.2, 3.8)),
        head=(9.0, 3.2, 4.9), head_col=None, eye=1.1,
        crest=dict(pts=[(0.6, 0.78), (-2.6, 1.36), (-7.6, 1.6)], r=[2.1, 1.25, 0.3]),
        mask=True,
        beak=dict(len=2.7, r=1.0, col='#1A1410', hook=0.0),
        tail=dict(len=9.0, w=(2.3, 3.4), thin=0.22, tilt=-2, paint=lambda t, c: 'band' if t > 0.82 else 'tail'),
        wing=dict(len=23.0, wrist=0.36, thin=0.22, shoulder=(1.8, 0.55, 0.45),
                  plan=[(0.0, 3.6, -4.2), (0.36, 3.4, -4.8), (0.75, 1.8, -4.2), (1.0, -1.8, -2.6)],
                  paint=lambda t, c: 'wax' if (c < -0.62 and 0.3 < t < 0.52) else ('tip' if t > 0.66 else 'wing')),
        cols=dict(wing=('#8E8E84', '#64645C'), tip=('#4C4C46', '#2E2E2A'), wax=('#D6362C', '#9E221C'),
                  tail=('#6E6E64', '#4A4A44'), band=('#EDCB3A', '#B8961E')),
        flap=dict(amp=55, bias=4, glide=(8, -4, 8)),
    ),
    'eagle': dict(
        line='#140E0A', body=(10.0, 6.3, 6.0), tilt=-4, coat=('#4C3626', '#2C1E14'), belly=None,
        neck=dict(pts=[(6.6, 0, 1.6), (9.4, 0, 2.7)], r=[4.0, 4.0], col='head'),
        head=(11.2, 3.2, 5.0), head_col=('#F7F5EF', '#CFCAC0'), eye=0.9, brow=True,
        beak=dict(len=5.0, r=1.9, col='#EDB73A', hook=1.8),
        feet=True,
        tail=dict(len=10.0, w=(3.2, 5.0), thin=0.2, tilt=2, paint=lambda t, c: 'tail'),
        wing=dict(len=32.0, wrist=0.32, thin=0.2, shoulder=(1.6, 0.55, 0.45),
                  plan=[(0.0, 5.0, -6.2), (0.32, 4.8, -7.0), (0.82, 3.4, -6.6), (1.0, 2.6, -5.6)],
                  paint=lambda t, c: 'wing', fingers=dict(n=6, len=7.5, r=1.2, spread=(-6, 32))),
        cols=dict(wing=('#4C3626', '#2C1E14'), tip=('#34261A', '#1E150E'), tail=('#F7F5EF', '#CFCAC0')),
        flap=dict(amp=32, bias=6, glide=(5, -2, 4)),
    ),
}
ORDER = ['swift', 'vulture', 'jay', 'crow', 'goose', 'waxwing', 'eagle']


def wing_pose(S, i):
    """(shoulder elevation, wrist bend, hand sweep) in degrees for frame i (0..5 flap, 6 glide)."""
    F = S['flap']
    if i == 6:
        return F['glide']
    p = i / 6.0
    e = F['bias'] + F['amp'] * math.cos(2 * math.pi * p)
    down, up = max(0.0, math.sin(2 * math.pi * p)), max(0.0, -math.sin(2 * math.pi * p))
    return e, 14 * down - 38 * up, 34 * up


# ------------------------------------------------------------------ one bird
class Bird:
    def __init__(self, kind):
        self.kind = kind
        self.S = SPECIES[kind]
        self.R = (Matrix.Rotation(math.radians(YAW), 4, 'Z') @ Matrix.Rotation(math.radians(ROLL), 4, 'X'))
        self.ppu = None
        self.line_px = 2.0
        self.objs, self.wings = [], []
        self._materials()
        self._body()
        self._head()
        self._tail()

    def _materials(self):
        S = self.S
        rim = S.get('rim')
        light = lambda h, k=0.35: mixhex(h, '#FFFFFF', k)   # noqa: E731
        M = dict(
            coat=toon('coat', S['coat'][0], S['coat'][1], rim=rim or light(S['coat'][0])),
            line=flat('line', S['line'], cull=True),
            ink=flat('ink', S['line']),
            white=flat('eye_white', '#FFFFFF'),
            pupil=flat('pupil', '#1A120C'),
            shine=flat('shine', '#FFFFFF'),
            beak=toon('beak', S['beak']['col'], mixhex(S['beak']['col'], '#000000', 0.35),
                      rim=light(S['beak']['col'], 0.45)),
            snow=toon('snow', '#F6F4EE', '#CFCBC0'),
            black=toon('black', '#24201E', '#121010'),
            feet=toon('feet', '#EDB73A', '#B8861E'),
        )
        if S.get('belly'):
            M['belly'] = toon('belly', *S['belly']['col'])
        hc = S.get('head_col')
        M['head'] = toon('head', hc[0], hc[1], rim=light(hc[0])) if hc else M['coat']
        cols = dict(S['cols'])
        cols.setdefault('covert', (mixhex(cols['wing'][0], '#FFFFFF', 0.13), mixhex(cols['wing'][1], '#FFFFFF', 0.1)))
        for k, (lit, sh) in cols.items():
            M['c_' + k] = toon('c_' + k, lit, sh, rim=rim or light(lit, 0.3))
            # the far wing sits in the body's shadow: one step darker
            M['cf_' + k] = toon('cf_' + k, mixhex(lit, sh, 0.55), mixhex(sh, '#000000', 0.18))
        self.M = M

    # ---------------- object plumbing (meshes are written in world space: the bird's turn is baked in)
    def add(self, name, bm, mat, outline=0.0, wing=False):
        for f in bm.faces:
            f.smooth = True
        bm.transform(self.R)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        mats = mat if isinstance(mat, (list, tuple)) else [mat]
        for m in mats:
            me.materials.append(m)
        ob['outline'] = outline
        if self.ppu:
            self._outline(ob)
        (self.wings if wing else self.objs).append(ob)
        return ob

    def _outline(self, ob):
        k = ob['outline']
        if k <= 0 or ob.modifiers.get('outline'):
            return
        n = len(ob.data.materials)
        for _ in range(n):
            ob.data.materials.append(self.M['line'])
        so = ob.modifiers.new('outline', 'SOLIDIFY')
        so.thickness = k * self.line_px / self.ppu
        so.offset = 1.0
        so.use_flip_normals = True
        so.use_rim = False
        so.use_even_offset = False
        so.use_quality_normals = True
        so.material_offset = n

    def fit(self, ppu, line_px):
        self.ppu, self.line_px = ppu, line_px
        for ob in self.objs + self.wings:
            self._outline(ob)

    def painted_tube(self, name, pts, rad, nseg, xs, up, paint, outline, wing=False, far=False, rmod=None):
        """Swept tube whose faces take a colour per (t along the tube, c = cos of the angle round the section,
        +1 toward `up`)."""
        bm, rings = tube_bm(pts, rad, nseg, xs=xs, up=up, rmod=rmod)
        n = len(pts) - 1
        side = [paint((i + 0.5) / n, math.cos(2 * math.pi * (k + 0.5) / nseg)) for i in range(n) for k in range(nseg)]
        tip = paint(1.0, 0.0)
        keys = sorted(set(side) | {tip})
        idx = {k: j for j, k in enumerate(keys)}
        bm.faces.ensure_lookup_table()
        for j, f in enumerate(bm.faces):                  # side faces come first, then the two end caps
            f.material_index = idx[side[j]] if j < len(side) else idx[tip]
        return self.add(name, bm, [self.M[('cf_' if far else 'c_') + k] for k in keys], outline, wing)

    # ---------------- body
    def _body(self):
        S, M = self.S, self.M
        a, b, c = S['body']
        tilt = Matrix.Rotation(math.radians(S['tilt']), 3, 'Y')
        self.add('body', ell_bm((0, 0, 0), (a, b, c), tilt, segs=36, rings=20), M['coat'], 1.0)
        if S.get('belly'):
            B = S['belly']
            self.add('belly', ell_bm(B['c'], B['r'], tilt), M['belly'])
        if S.get('undertail'):
            self.add('undertail', ell_bm(S['undertail']['c'], S['undertail']['r']), M['snow'], 0.6)
        if S.get('feet'):
            for sy in (-1.5, 1.7):
                self.add('foot', ell_bm((-4.6, sy, -5.4), (2.4, 1.1, 1.2), Matrix.Rotation(-0.3, 3, 'Y')),
                         M['feet'], 0.5)
                for j in range(3):
                    p0 = Vector((-3.0 + 0.9 * j, sy - 0.3, -5.8))
                    self.add('talon', tube_bm([p0, p0 + Vector((0.6, 0, -0.9))], [0.35, 0.1], 6)[0], M['ink'])

    def _head(self):
        S, M = self.S, self.M
        hx, hz, hr = S['head']
        if S.get('neck'):
            N = S['neck']
            pts, prm = catmull(N['pts'], 6)
            rad = [N['r'][0] + (N['r'][-1] - N['r'][0]) * p / (len(N['pts']) - 1) for p in prm]
            self.add('neck', tube_bm(pts, rad, 18)[0], M[N['col']], 0.8)
        if S.get('ruff'):
            self.add('ruff', ell_bm(S['ruff']['c'], S['ruff']['r']), M['coat'], 0.8)
        self.add('head', ell_bm((hx, 0, hz), (hr, hr * 0.95, hr), segs=32, rings=18), M['head'], 0.9)
        H = Ellipsoid((hx, 0, hz), (hr, hr * 0.95, hr))
        if S.get('face'):
            self.add('face', ell_bm(S['face']['c'], S['face']['r']), M['snow'])
        if S.get('chin'):
            for az in (68, -68):
                p, u, v, n = H.frame(az, -28)
                self.add('chin', ell_bm(p + n * 0.05, (hr * 0.62, hr * 0.42, 0.45), Matrix((u, v, n)).transposed()),
                         M['snow'], 0.35)
        if S.get('mask'):
            # a black band from the beak through the eye toward the nape, sunk so the eye sits on top of it
            pts, _ = catmull([H.at(H.dirn(az, el), 0.1)[0] for az, el in ((10, -6), (28, 6), (46, 16), (74, 20), (104, 20))], 6)
            rad = [hr * (0.12 + 0.08 * math.sin(math.pi * j / (len(pts) - 1))) for j in range(len(pts))]
            self.add('mask', tube_bm(pts, rad, 10)[0], M['ink'])
        if S.get('necklace'):
            ring = [Vector((hx - 1.2 + 1.6 * math.cos(a) * 0.25, hr * 0.98 * math.sin(a), hz - hr * 0.42 + hr * 0.62 * math.cos(a)))
                    for a in np.linspace(0, 2 * math.pi, 25)]
            self.add('necklace', tube_bm(ring, [0.62] * len(ring), 8, caps=(False, False))[0], M['black'])
        if S.get('crest'):
            Cq = S['crest']
            pts, prm = catmull([(hx + dx * hr / 5, 0, hz + dz * hr) for dx, dz in Cq['pts']], 6)
            rad = [interp([(j, r) for j, r in enumerate(Cq['r'])], p)[0] for p in prm]
            self.add('crest', tube_bm(pts, rad, 14, xs=(0.55, 1.0))[0], M['head'], 0.7)
        # beak: a tapered tube from inside the head, the tip curled down on hooked beaks
        Bk = S['beak']
        base = H.at(H.dirn(0, -12))[0] - Vector((0.6, 0, 0))
        L, hk = Bk['len'], Bk['hook']
        ctrl = [base, base + Vector((L * 0.55, 0, 0.1 * hk)), base + Vector((L, 0, -0.5 * hk)),
                base + Vector((L + 0.15 * hk, 0, -1.3 * hk))] if hk else [base, base + Vector((L * 0.5, 0, -0.05)),
                                                                        base + Vector((L, 0, -0.25))]
        pts, prm = catmull(ctrl, 6)
        rad = [Bk['r'] * (1 - (p / (len(ctrl) - 1)) ** 1.3) + 0.12 for p in prm]
        self.add('beak', tube_bm(pts, rad, 14, xs=(0.85, 1.0))[0], M['beak'], 0.6)
        self.add('beak_line', tube_bm([base + Vector((0.8, -Bk['r'] * 0.7, -0.15)),
                                       base + Vector((L * 0.75, -0.35, -0.3 - 0.4 * hk))], [0.18, 0.12], 6)[0],
                 M['ink'])
        # the near eye, as on the squirrels (the far one would only peek over the crown as a white sliver)
        k = S['eye']
        lift = hr * 0.14 if S.get('mask') else 0.0          # eyes sit on the mask
        for side, az, el, f in (('n', 46, 16, 1.0),):
            p, u, v, n = H.frame(az, el)
            R3 = Matrix((u, v, n)).transposed()
            ew, eh = hr * 0.30 * k * f, hr * 0.38 * k
            self.add('eyewhite_' + side, ell_bm(p + n * (0.15 + lift), (ew, eh, hr * 0.12), R3), M['white'], 0.45)
            pc = p + u * ew * 0.3 + n * (0.15 + lift + hr * 0.1)
            self.add('pupil_' + side, ell_bm(pc, (ew * 0.62, eh * 0.66, hr * 0.06), R3), M['pupil'])
            self.add('shine_' + side, ell_bm(pc - u * ew * 0.18 + v * eh * 0.32 + n * hr * 0.06,
                                             (ew * 0.26, eh * 0.24, hr * 0.04), R3), M['shine'])
            if S.get('brow'):
                q = H.curve(az, el, [(-ew * 1.2, eh * 1.25), (0, eh * 1.05), (ew * 1.3, eh * 0.55)], 0.35)
                self.add('brow_' + side, tube_bm(q, [0.42, 0.5, 0.32], 8)[0], M['ink'])

    def _tail(self):
        S = self.S
        T = S['tail']
        a, b, c = S['body']
        s0 = Vector((-a * 0.7, 0, c * 0.05))
        d = Vector((-math.cos(math.radians(T['tilt'])), 0, math.sin(math.radians(T['tilt']))))
        n = 18
        pts, rad = [], []
        for i in range(n + 1):
            t = i / n
            w = T['w'][0] + (T['w'][1] - T['w'][0]) * t
            if t > 0.82:                                           # rounded fan tip (a swift's is squared off)
                u = (t - 0.82) / 0.18
                w *= 1 - 0.3 * u if T.get('fork') else math.sqrt(max(0.0, 1 - u * u))
            pts.append(s0 + d * T['len'] * t)
            rad.append(max(0.25, w))
        self.painted_tube('tail', pts, rad, 16, (T['thin'], 1.0), (0, 0, 1),
                          lambda t, cc: T['paint'](t, cc), 0.8)

    # ---------------- wings, rebuilt every frame
    def set_wings(self, e, w, f):
        for ob in self.wings:
            me = ob.data
            bpy.data.objects.remove(ob)
            bpy.data.meshes.remove(me)
        self.wings = []
        for side in ('f', 'n'):
            self._wing(side, e, w, f)

    def _wing(self, side, e, w, f):
        S, W = self.S, self.S['wing']
        a, b, c = S['body']
        sgn = -1 if side == 'n' else 1
        sx, sy, sz = W['shoulder']
        P = Vector((sx, sgn * b * sy, c * sz))
        X = Vector((1, 0, 0))
        N, L, tw = 40, W['len'], W['wrist']
        pts, rad, d = [], [], X
        for i in range(N + 1):
            t = i / N
            sm = smooth((t - (tw - 0.1)) / 0.2)
            el, sw = math.radians(e + w * sm), math.radians(f * sm)
            d = Vector((0, sgn * math.cos(el), math.sin(el))) * math.cos(sw) - X * math.sin(sw)
            if i:
                P = P + d * (L / N)
            lead, trail = interp(W['plan'], t)
            pts.append(P + X * ((lead + trail) / 2))
            rad.append(max(0.3, (lead - trail) / 2))
        K = W.get('feathers', 7)

        def scallop(i, th):
            t, c = i / N, math.cos(th)
            if c >= 0 or t < 0.12:
                return 1.0
            return 1.0 - 0.16 * (-c) * (1 - abs(math.cos(math.pi * K * t))) ** 2

        def paint(t, c):
            k = W['paint'](t, c)
            return 'covert' if k == 'wing' and c > 0.05 and t < 0.6 and W.get('coverts', True) else k
        self.painted_tube('wing_' + side, pts, rad, 24, (1.0, W['thin']), (1, 0, 0), paint, 0.7, wing=True,
                          far=side == 'f', rmod=scallop)
        Fg = W.get('fingers')
        if Fg:
            q = (X - X.dot(d) * d).normalized()
            E, r_end = pts[-1], rad[-1]
            for k in range(Fg['n']):
                u = k / (Fg['n'] - 1)
                ang = math.radians(Fg['spread'][0] + (Fg['spread'][1] - Fg['spread'][0]) * u)
                dk = d * math.cos(ang) - q * math.sin(ang)
                o = E + q * r_end * (0.85 - 1.7 * u) - d * 1.2
                ln = Fg['len'] * (1.0 - 0.3 * abs(u - 0.35))
                fp = [o, o + dk * ln * 0.55, o + dk * ln]
                bm, _ = tube_bm(fp, [Fg['r'], Fg['r'] * 0.85, 0.22], 10, xs=(1.0, 0.42), up=tuple(q))
                self.add('finger_%s%d' % (side, k), bm, self.M[('cf_' if side == 'f' else 'c_') + 'tip'], 0.5,
                         wing=True)


# ------------------------------------------------------------------ framing and output
def extent(objs):
    xs, zs = [], []
    for ob in objs:
        for v in ob.data.vertices:
            xs.append(v.co.x)
            zs.append(v.co.z)
    return min(xs), max(xs), min(zs), max(zs)


def aim_camera(cx, cz, ppu):
    cam = bpy.context.scene.camera
    cam.data.ortho_scale = RES / ppu
    cam.location = (cx, -300.0, cz)


def sheet(rows, path):
    lab, cols = 22, len(FRAMES)
    H = 30 + len(rows) * (RES + lab)
    img = np.ones((H, cols * RES, 4), dtype=np.float32)
    img[..., :3] = 0.96
    label(img, 'BIRDS - FLAP 0-5 AND GLIDE', 8, 8, 2)
    for r, (kind, frames, anc) in enumerate(rows):
        for k, (fname, arr) in enumerate(frames):
            cx, cy = k * RES, 30 + r * (RES + lab)
            img[cy:cy + RES, cx:cx + RES, :3] = BG
            over(img, arr, cx, cy)
            ax, ay = cx + int(round(anc[0])), cy + int(round(anc[1]))
            img[ay, ax - 5:ax + 6, :3] = (0.85, 0.1, 0.1)
            img[ay - 5:ay + 6, ax, :3] = (0.85, 0.1, 0.1)
            img[cy:cy + RES, cx, :3] = 0.6
            label(img, '%s %s' % (kind, fname), cx + 4, cy + RES + 4, 2)
    write_png(path, img)


def small(rows, path, mag):
    f = 4
    c = RES // f
    img = np.ones((len(rows) * c, len(FRAMES) * c, 4), dtype=np.float32)
    img[..., :3] = BG
    for r, (kind, frames, anc) in enumerate(rows):
        for k, (fname, arr) in enumerate(frames):
            over(img, downscale(arr, f), k * c, r * c)
    if mag > 1:
        img = img.repeat(mag, axis=0).repeat(mag, axis=1)
    write_png(path, img)


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    kind = a[a.index('--kind') + 1] if '--kind' in a else 'all'
    return dict(kinds=ORDER if kind == 'all' else kind.split(','), sheet='--no-sheet' not in a)


def main():
    A = args()
    t_all = time.time()
    os.makedirs(OUT, exist_ok=True)
    meta_path = os.path.join(OUT, 'birds.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    meta.update(res=RES, frames=FRAMES, order=ORDER)
    meta.setdefault('species', {})
    rows = []
    for kind in A['kinds']:
        t0 = time.time()
        reset_scene()
        bd = Bird(kind)
        # pass 1: the union of every frame's silhouette sets the scale and the camera centre
        x0 = z0 = 1e9
        x1 = z1 = -1e9
        for i in range(len(FRAMES)):
            bd.set_wings(*wing_pose(bd.S, i))
            ex = extent(bd.objs + bd.wings)
            x0, x1, z0, z1 = min(x0, ex[0]), max(x1, ex[1]), min(z0, ex[2]), max(z1, ex[3])
        ppu = (RES - 2 * MARGIN) / max(x1 - x0, z1 - z0)
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        # ink as wide on screen as the squirrels' line: the game draws this body 2.2 * r px long at zoom 1
        line_px = LINE_PX * BODY * ppu / (2.2 * HIT_R[kind])
        bd.fit(ppu, line_px)
        aim_camera(cx, cz, ppu)
        anchor = (RES / 2 - cx * ppu, RES / 2 + cz * ppu)
        meta['species'][kind] = dict(anchor=[round(anchor[0], 2), round(anchor[1], 2)],
                                     bodyPx=round(BODY * ppu, 2), linePx=round(line_px, 2))
        outdir = os.path.join(OUT, kind)
        os.makedirs(outdir, exist_ok=True)
        frames = []
        for i, fname in enumerate(FRAMES):
            bd.set_wings(*wing_pose(bd.S, i))
            path = os.path.join(outdir, fname + '.png')
            bpy.context.scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            arr = read_png(path)
            bb = bbox(arr)
            edge = bb is None or bb[0] < 2 or bb[1] < 2 or bb[2] > RES - 3 or bb[3] > RES - 3
            print('@@FRAME %s %s bbox=%s %s' % (kind, fname, bb, 'CLIPPED' if edge else 'ok'))
            frames.append((fname, arr))
        rows.append((kind, frames, anchor))
        print('@@KIND %s ppu=%.2f bodyPx=%.1f line=%.1fpx seconds=%.1f' % (kind, ppu, BODY * ppu, line_px,
                                                                         time.time() - t0))
    with open(meta_path, 'w') as fh:
        json.dump(meta, fh, indent=1, sort_keys=True)
    if A['sheet'] and len(rows) == len(ORDER):
        sheet(rows, os.path.join(OUT, 'sheet-birds.png'))
        small(rows, os.path.join(OUT, 'small-preview.png'), 3)
        small(rows, os.path.join(OUT, 'small-preview-1x.png'), 1)
    print('@@DONE seconds=%.1f' % (time.time() - t_all))


if __name__ == '__main__':
    main()
