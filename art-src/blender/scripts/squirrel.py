"""Furious Squirrels: one cartoon squirrel, built, rigged, posed and rendered to sprite frames.

Run (from the game folder; quote the paths, they contain spaces):
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup
        --python art-src/blender/scripts/squirrel.py -- [--team 0|1|both] [--variant 0,1,2,3|all]
        [--poses idle,aim] [--no-sheet] [--save-blend]

Writes  art-src/sprites/t<team>v<k>/<pose>_<i>.png      256 x 256 RGBA, transparent background
        art-src/sprites/sheet-t<team>-variants.png      idle_0 / aim_0 / hit_0 / cheer_0 for v0..v3
        art-src/sprites/small-preview-variants.png      every frame of all 8 members at game size, shown x3
        art-src/sprites/small-preview-variants-1x.png   the same at 1x
        art-src/blender/squirrel-t<team>v<k>.blend      with --save-blend (rest pose, for inspection)
(The older single-member folders art-src/sprites/t0/, t1/ and their sheets came from the previous version
of this script and are no longer written.)

Frame contract (see README-squirrels.md): orthographic side view, character faces +x (screen right) with a
25 degree turn toward the camera; 3.4 px per game unit; the feet centre (the perch point, origin of the
in-game vector squirrel) is at pixel (128, 236) from the top-left in every frame.

Design (original): two families of round-headed, big-eyed cartoon squirrels with small bodies and huge
bushy S-curved tails. Team 0 "West Ridge Rustlers" are eastern fox squirrels in a mustard baseball-style
cap; team 1 "Tower Top Tails" are eastern gray squirrels in a teal neck scarf. The cap (on the head, brim
forward) and the scarf (round the neck, ribbons trailing back) give each family its own silhouette.
Colours: coat / dark / belly / accessory hexes from src/js/gfx/looks.js TEAM_COLORS. Tail fringe:
gray squirrel white fringe (research/squirrels-and-nuts.md, MDC: "the fringe of the tail and belly are
white"); fox squirrel reddish-yellow fringe (same file, MDC) drawn a little lighter than the research
swatch #D58A45 (est.) so it separates from the #C8763A coat at small size. All hexes are estimates.

Build: primitives (bmesh UV spheres) and swept tubes (Catmull-Rom centre lines, parallel-transport frames)
deformed by one armature: root, spine, head, scarf, two-bone arms, thigh + foot legs, a 6-bone tail chain.
Rigid parts carry one vertex group (weight 1); the tail is weighted smoothly along its length.
Look: emission-based toon shading (diffuse -> Shader to RGB -> constant ramp between a lit and a shade
colour, plus a back-top rim), and a dark outline from a solidify inverted hull (flipped, backface-culled).
No randomness anywhere; every run gives the same frames.
"""
import bpy
import bmesh
import math
import os
import sys
import time

import numpy as np
from mathutils import Vector, Matrix

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER_DIR = os.path.dirname(HERE)            # art-src/blender
ART = os.path.dirname(BLENDER_DIR)             # art-src
SPRITES = os.path.join(ART, 'sprites')

RES = 256
ANCHOR = (128, 236)            # feet centre, pixels from the top-left corner
PPU = 3.4                      # pixels per game unit (the squirrel is ~46 units tall -> ~156 px)
TURN = 25.0                    # degrees the character turns toward the camera
SAMPLES = 16

# ------------------------------------------------------------------ palettes (hex est.)
# Family silhouettes differ, not only colours: fox squirrels (research: "heavy-bodied and larger") get an
# ~8 % larger body and a fuller, rounder, upright tail; gray squirrels ("slender and smaller") a slimmer
# body and a longer, lower, flatter-profiled tail with a wide white fringe round a darker grey core.
TEAMS = [
    dict(key='t0', name='West Ridge Rustlers', species='eastern fox squirrel',
         coat='#C8763A', coat_dk='#8E4E22', belly='#E9B27A', belly_dk='#C98E55',
         fringe='#E3A05A', fringe_dk='#B87436', tailcore_k=0.0,
         acc='#E0B23A', acc_dk='#9C7A1E', line='#3B2414', ear_in='#E9B27A',
         nose='#3A2620', blush='#E98A6E', freckle='#7A3E1C', cream='#F4E6C4', cream_dk='#C9B48A',
         body_w=1.06, body_s=1.08, fringe_k=1.10,
         tail=[(-5.0, 2.5, 8.0), (-10.5, 3.0, 12.0), (-14.0, 3.4, 19.5), (-14.5, 3.6, 28.0),
               (-12.5, 3.6, 36.0), (-8.0, 3.4, 42.0), (-2.5, 3.0, 44.0)],
         tail_r=[3.2, 6.6, 8.6, 9.4, 9.2, 8.0, 5.0]),
    dict(key='t1', name='Tower Top Tails', species='eastern gray squirrel',
         coat='#9A9A96', coat_dk='#64645F', belly='#F2EFE6', belly_dk='#C8C4B8',
         fringe='#F7F5EE', fringe_dk='#CFCBC0', tailcore_k=0.35,
         acc='#2A9D8F', acc_dk='#1F6B62', line='#2A2A2D', ear_in='#E8C9C0',
         nose='#3A3034', blush='#EBA5A5', freckle='#5E504A', cream='#F2EBD8', cream_dk='#C8BFA8',
         body_w=0.90, body_s=0.97, fringe_k=1.22,
         tail=[(-5.5, 2.5, 7.0), (-13.0, 3.0, 9.0), (-20.0, 3.4, 13.0), (-24.0, 3.6, 19.5),
               (-24.5, 3.6, 27.0), (-21.0, 3.6, 33.0), (-15.0, 3.2, 35.5)],
         tail_r=[2.6, 4.9, 6.2, 6.6, 6.4, 5.6, 3.6]),
]
# Four members per family. Headwear (Rustlers) or neckwear (Tails) is the main cue; small face extras
# (freckles, brows, lashes, blush size) separate them up close.
VARIANTS = {
    0: [dict(label='cap', wear='cap'),
        dict(label='cap back', wear='cap_back', freckles=True),
        dict(label='beanie', wear='beanie', blush=1.35),
        dict(label='visor', wear='visor', lashes=True)],
    1: [dict(label='scarf', wear='scarf'),
        dict(label='bow tie', wear='bowtie', brows='arch'),
        dict(label='bandana', wear='bandana', freckles=True),
        dict(label='long scarf', wear='longscarf', lashes=True, brows='soft')],
}
EYE_WHITE = '#FFFFFF'
PUPIL = '#1A120C'
MOUTH_IN = '#5E2430'
TONGUE = '#E57A86'
TOOTH = '#FFFDF5'

POSES = [('idle', 4), ('scamper', 4), ('aim', 1), ('throw', 2), ('hit', 1), ('fall', 2), ('out', 1),
         ('cheer', 2)]


# ------------------------------------------------------------------ small helpers
def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def lin(h):
    def f(v):
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return tuple(f(v) for v in hexc(h))


def mixhex(a, b, t):
    ca, cb = hexc(a), hexc(b)
    return '#%02X%02X%02X' % tuple(round(255 * (ca[i] + (cb[i] - ca[i]) * t)) for i in range(3))


def V(*a):
    return Vector(a)


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

    def opt(k, d=None):
        return a[a.index(k) + 1] if k in a else d
    team = opt('--team', 'both')
    teams = [0, 1] if team == 'both' else [int(team)]
    var = opt('--variant', 'all')
    variants = [0, 1, 2, 3] if var == 'all' else [int(v) for v in var.split(',')]
    poses = opt('--poses')
    return dict(teams=teams, variants=variants, poses=poses.split(',') if poses else None,
                sheet='--no-sheet' not in a, save='--save-blend' in a)


# ------------------------------------------------------------------ materials
def _sock(socks, ident):
    for s in socks:
        if s.identifier == ident:
            return s
    raise KeyError(ident)


def _new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt


RIM_DIR = Vector((-0.55, 0.2, 0.81)).normalized()


def toon(name, lit, shade, rim=None, thr=0.30):
    """Two-tone cel shading from a white diffuse (Shader to RGB), output as emission so colours stay
    exactly the authored hexes under the Standard view transform."""
    m, nt = _new_mat(name)
    N, L = nt.nodes.new, nt.links.new
    out = N('ShaderNodeOutputMaterial')
    dif = N('ShaderNodeBsdfDiffuse')
    dif.inputs['Color'].default_value = (1, 1, 1, 1)
    s2r = N('ShaderNodeShaderToRGB')
    L(dif.outputs[0], s2r.inputs[0])
    ramp = N('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.interpolation = 'CONSTANT'
    cr.elements[0].position, cr.elements[0].color = 0.0, (0, 0, 0, 1)
    cr.elements[1].position, cr.elements[1].color = thr, (1, 1, 1, 1)
    L(s2r.outputs['Color'], ramp.inputs['Fac'])
    mix = N('ShaderNodeMix')
    mix.data_type = 'RGBA'
    L(ramp.outputs['Color'], _sock(mix.inputs, 'Factor_Float'))
    _sock(mix.inputs, 'A_Color').default_value = (*lin(shade), 1)
    _sock(mix.inputs, 'B_Color').default_value = (*lin(lit), 1)
    col = _sock(mix.outputs, 'Result_Color')
    if rim:
        lw = N('ShaderNodeLayerWeight')
        lw.inputs['Blend'].default_value = 0.5
        g1 = N('ShaderNodeMath')
        g1.operation = 'GREATER_THAN'
        L(lw.outputs['Facing'], g1.inputs[0])
        g1.inputs[1].default_value = 0.60
        geo = N('ShaderNodeNewGeometry')
        dot = N('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        L(geo.outputs['Normal'], dot.inputs[0])
        dot.inputs[1].default_value = RIM_DIR
        g2 = N('ShaderNodeMath')
        g2.operation = 'GREATER_THAN'
        L(dot.outputs['Value'], g2.inputs[0])
        g2.inputs[1].default_value = 0.30
        mul = N('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        L(g1.outputs[0], mul.inputs[0])
        L(g2.outputs[0], mul.inputs[1])
        mix2 = N('ShaderNodeMix')
        mix2.data_type = 'RGBA'
        L(mul.outputs[0], _sock(mix2.inputs, 'Factor_Float'))
        L(col, _sock(mix2.inputs, 'A_Color'))
        _sock(mix2.inputs, 'B_Color').default_value = (*lin(rim), 1)
        col = _sock(mix2.outputs, 'Result_Color')
    em = N('ShaderNodeEmission')
    L(col, em.inputs['Color'])
    em.inputs['Strength'].default_value = 1.0
    L(em.outputs[0], out.inputs['Surface'])
    return m


def flat(name, hexcol, cull=False):
    m, nt = _new_mat(name)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*lin(hexcol), 1)
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    m.use_backface_culling = cull
    return m


# ------------------------------------------------------------------ geometry
def catmull(pts, n=8):
    """Centripetal-free uniform Catmull-Rom through pts; returns (points, params) with params in
    control-point index units (0 .. len-1)."""
    P = [Vector(p) for p in pts]
    ext = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]
    out, prm = [], []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            q = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                       (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append(q)
            prm.append(i + t)
    out.append(P[-1])
    prm.append(len(P) - 1.0)
    return out, prm


def tube_bm(pts, radii, nseg=18, xs=(1.0, 1.0), up=(0, 1, 0), rmod=None, caps=(True, True)):
    """Swept tube. xs scales the cross-section along (n, b): with up=(0,1,0) n is the depth axis, so
    xs[0] < 1 flattens a tube toward the view plane (ears, ribbons). rmod(i, theta) multiplies radius."""
    bm = bmesh.new()
    P = [Vector(p) for p in pts]
    n = len(P)
    T = []
    for i in range(n):
        d = P[min(i + 1, n - 1)] - P[max(i - 1, 0)]
        T.append(d.normalized())
    upv = Vector(up)
    nrm = (upv - upv.dot(T[0]) * T[0])
    if nrm.length < 1e-4:
        nrm = Vector((0, 0, 1)) - T[0].z * T[0]
    nrm.normalize()
    rings = []
    for i in range(n):
        if i:
            nrm = (nrm - nrm.dot(T[i]) * T[i]).normalized()
        b = T[i].cross(nrm)
        ring = []
        for k in range(nseg):
            th = 2 * math.pi * k / nseg
            r = radii[i] * (rmod(i, th) if rmod else 1.0)
            ring.append(bm.verts.new(P[i] + r * (math.cos(th) * xs[0] * nrm + math.sin(th) * xs[1] * b)))
        rings.append(ring)
    for i in range(n - 1):
        a, c = rings[i], rings[i + 1]
        for k in range(nseg):
            bm.faces.new((a[k], a[(k + 1) % nseg], c[(k + 1) % nseg], c[k]))
    if caps[0]:
        cv = bm.verts.new(P[0] - T[0] * radii[0] * 0.2)
        for k in range(nseg):
            bm.faces.new((rings[0][(k + 1) % nseg], rings[0][k], cv))
    if caps[1]:
        cv = bm.verts.new(P[-1] + T[-1] * radii[-1] * 0.2)
        for k in range(nseg):
            bm.faces.new((rings[-1][k], rings[-1][(k + 1) % nseg], cv))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm, rings


def ell_bm(center, radii, M3=None, segs=28, rings=16, half=False):
    """Ellipsoid; M3 is a 3x3 orientation (columns = local axes). half keeps local z >= 0."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    if half:
        kill = [v for v in bm.verts if v.co.z < -1e-4]
        bmesh.ops.delete(bm, geom=kill, context='VERTS')
    S = Matrix.Diagonal((radii[0], radii[1], radii[2], 1.0))
    R = (M3 or Matrix.Identity(3)).to_4x4()
    bm.transform(Matrix.Translation(Vector(center)) @ R @ S)
    return bm


def capsule_pts(a, b, r0, r1, n=6):
    """Centre line and radii for a tube with rounded ends between points a and b."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    pts, rad = [], []
    for k in range(n, 0, -1):                      # start hemisphere
        ang = (math.pi / 2) * k / n
        pts.append(a - d * r0 * math.sin(ang) * 0.97)
        rad.append(max(r0 * math.cos(ang), 0.25 * r0))
    for k in range(5):
        t = k / 4
        pts.append(a.lerp(b, t))
        rad.append(r0 + (r1 - r0) * t)
    for k in range(1, n + 1):
        ang = (math.pi / 2) * k / n
        pts.append(b + d * r1 * math.sin(ang) * 0.97)
        rad.append(max(r1 * math.cos(ang), 0.25 * r1))
    return pts, rad


class Ellipsoid:
    """Analytic surface used to place face features (eyes, mouth, blush) on the head and muzzle."""
    def __init__(self, c, r):
        self.c, self.r = Vector(c), Vector(r)

    def at(self, d, off=0.0):
        d = Vector(d).normalized()
        t = 1.0 / math.sqrt(sum((d[i] / self.r[i]) ** 2 for i in range(3)))
        p = self.c + d * t
        nrm = Vector(((p - self.c)[i] / self.r[i] ** 2 for i in range(3))).normalized()
        return p + nrm * off, nrm

    def dirn(self, az, el):
        """az: degrees from +x (forward) toward -y (near side); el: degrees up."""
        a, e = math.radians(az), math.radians(el)
        return Vector((math.cos(e) * math.cos(a), -math.cos(e) * math.sin(a), math.sin(e)))

    def frame(self, az, el, off=0.0):
        p, n = self.at(self.dirn(az, el), off)
        u = Vector((1, 0, 0)) - n.x * n
        if u.length < 1e-3:
            u = Vector((0, -1, 0)) - n.y * n
        u.normalize()
        v = n.cross(u)
        if v.z < 0:
            v = -v
        return p, u, v, n

    def project(self, q, off):
        return self.at(Vector(q) - self.c, off)[0]

    def curve(self, az, el, uv, off):
        """2D polyline (u, v) in the tangent plane at (az, el), wrapped onto the surface."""
        p, u, v, n = self.frame(az, el)
        return [self.project(p + u * a + v * b, off) for a, b in uv]


# ------------------------------------------------------------------ the squirrel
class Squirrel:
    def __init__(self, team, variant=0):
        self.team = team
        self.C = TEAMS[team]
        self.VAR = VARIANTS[team][variant]
        self.parts = {}            # name -> object
        self.variants = {}         # group -> {state: [objects]}
        self.scene = bpy.context.scene
        self._materials()
        self._rig()
        self._body()
        self._head()
        self._face()
        self._face_extras()
        self._tail()
        wear = self.VAR['wear']
        if wear in ('cap', 'cap_back'):
            self._cap(backwards=wear == 'cap_back')
        elif wear == 'beanie':
            self._beanie()
        elif wear == 'visor':
            self._visor()
        elif wear == 'scarf':
            self._scarf()
        elif wear == 'bowtie':
            self._bowtie()
        elif wear == 'bandana':
            self._bandana()
        elif wear == 'longscarf':
            self._longscarf()

    # ---------------- materials
    def _materials(self):
        C = self.C
        light = lambda h, k=0.30: mixhex(h, '#FFFFFF', k)   # noqa: E731
        sh = lambda h, k=0.62: mixhex(h, C['coat_dk'], k) if h == C['coat'] else h   # noqa: E731
        self.M = dict(
            coat=toon('coat', C['coat'], mixhex(C['coat'], C['coat_dk'], 0.75), rim=light(C['coat'], 0.35)),
            coat_far=toon('coat_far', mixhex(C['coat'], C['coat_dk'], 0.35), C['coat_dk']),
            belly=toon('belly', C['belly'], C['belly_dk']),
            paw=toon('paw', C['belly'], C['belly_dk']),
            paw_far=toon('paw_far', C['belly_dk'], mixhex(C['belly_dk'], C['coat_dk'], 0.5)),
            fringe=toon('fringe', C['fringe'], C['fringe_dk']),
            tailcore=toon('tailcore', mixhex(C['coat'], C['coat_dk'], C['tailcore_k']),
                          mixhex(C['coat'], C['coat_dk'], 0.75 + 0.25 * C['tailcore_k']),
                          rim=light(C['coat'], 0.35)),
            cream=toon('cream', C['cream'], C['cream_dk']),
            freckle=flat('freckle', C['freckle']),
            ear_in=toon('ear_in', C['ear_in'], mixhex(C['ear_in'], C['coat_dk'], 0.4)),
            acc=toon('acc', C['acc'], mixhex(C['acc'], C['acc_dk'], 0.7), rim=light(C['acc'], 0.4), thr=0.2),
            acc_dk=toon('acc_dk', C['acc_dk'], mixhex(C['acc_dk'], '#000000', 0.25)),
            nose=toon('nose', C['nose'], C['nose'], rim=mixhex(C['nose'], '#FFFFFF', 0.45)),
            line=flat('line', C['line'], cull=True),
            ink=flat('ink', C['line']),
            white=flat('eye_white', EYE_WHITE),
            pupil=flat('pupil', PUPIL),
            shine=flat('shine', '#FFFFFF'),
            mouth=flat('mouth_in', MOUTH_IN),
            tongue=flat('tongue', TONGUE),
            tooth=flat('tooth', TOOTH),
            blush=flat('blush', C['blush']),
        )

    # ---------------- armature
    def _rig(self):
        bw = self.C['body_w']
        tail = self.tail_pts()
        B = {
            'root': ((0, 0, 0), (0, 0, 4), None),
            'spine': ((-1, 0, 6), (1, 0, 22), 'root'),
            'head': ((1.5, 0, 23), (3, 0, 31), 'spine'),
            'scarf': ((-4, 0, 24), (-10, 0, 18), 'spine'),
            'arm_n1': ((4.4, -6.6 * bw, 20.8), (5.6, -7.0 * bw, 13.6), 'spine'),
            'arm_n2': ((5.6, -7.0 * bw, 13.6), (11.2, -6.5 * bw, 16.4), 'arm_n1'),
            'arm_f1': ((4.4, 6.0 * bw, 20.8), (5.6, 6.4 * bw, 13.6), 'spine'),
            'arm_f2': ((5.6, 6.4 * bw, 13.6), (11.2, 5.9 * bw, 16.4), 'arm_f1'),
            'leg_n1': ((-2.5, -4.8, 8.5), (-3.8, -4.8, 1.6), 'root'),
            'leg_n2': ((-4.2, -4.8, 1.3), (4.6, -4.8, 1.3), 'leg_n1'),
            'leg_f1': ((-2.5, 4.8, 8.5), (-3.8, 4.8, 1.6), 'root'),
            'leg_f2': ((-4.2, 4.8, 1.3), (4.6, 4.8, 1.3), 'leg_f1'),
        }
        for k in range(len(tail) - 1):
            B['tail%d' % (k + 1)] = (tail[k], tail[k + 1], 'root' if k == 0 else 'tail%d' % k)
        ad = bpy.data.armatures.new('rig')
        rig = bpy.data.objects.new('rig', ad)
        self.scene.collection.objects.link(rig)
        rig.rotation_euler = (0, 0, math.radians(-TURN))
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        eb = {}
        for name, (h, t, par) in B.items():
            b = ad.edit_bones.new(name)
            b.head, b.tail = Vector(h), Vector(t)
            b.roll = 0.0
            eb[name] = b
        for name, (h, t, par) in B.items():
            if par:
                eb[name].parent = eb[par]
                if name.startswith('tail') and name != 'tail1':
                    eb[name].use_connect = True
        bpy.ops.object.mode_set(mode='OBJECT')
        self.rig = rig
        self.bones = list(B)

    # ---------------- object plumbing
    def add(self, name, bm, mat, bone=None, weights=None, outline=0.0, group=None, state=None):
        for f in bm.faces:
            f.smooth = True
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        nv = len(bm.verts)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        self.scene.collection.objects.link(ob)
        ob.parent = self.rig
        mats = mat if isinstance(mat, (list, tuple)) else [mat]
        for m in mats:
            me.materials.append(m)
        if weights is None:
            vg = ob.vertex_groups.new(name=bone)
            vg.add(list(range(nv)), 1.0, 'REPLACE')
        else:
            groups = {}
            for vi, wd in enumerate(weights):
                for bn, w in wd.items():
                    if w <= 0:
                        continue
                    if bn not in groups:
                        groups[bn] = ob.vertex_groups.new(name=bn)
                    groups[bn].add([vi], w, 'REPLACE')
        am = ob.modifiers.new('rig', 'ARMATURE')
        am.object = self.rig
        if outline > 0:
            for _ in mats:                      # one outline slot per surface slot (offset = len(mats))
                me.materials.append(self.M['line'])
            so = ob.modifiers.new('outline', 'SOLIDIFY')
            so.thickness = outline
            so.offset = 1.0
            so.use_flip_normals = True
            so.use_rim = False
            so.use_even_offset = False          # even offset spikes at the narrow tips (ears, tail tip)
            so.use_quality_normals = True
            so.material_offset = len(mats)
        self.parts[name] = ob
        if group:
            self.variants.setdefault(group, {}).setdefault(state, []).append(ob)
        return ob

    # ---------------- body, limbs
    def _body(self):
        M, bw, bs = self.M, self.C['body_w'], self.C['body_s']
        tilt = Matrix.Rotation(math.radians(-8), 3, 'Y')
        self.add('body', ell_bm((0.2, 0, 13.0), (9.0 * bw * bs, 8.4 * bw * bs, 11.6 * bs), tilt), M['coat'], 'spine',
                 outline=1.0)
        self.add('belly', ell_bm((4.6 + 3.0 * (bw * bs - 1), -0.6, 12.6), (5.2 * bw * bs, 6.6 * bw * bs, 9.2 * bs),
                                 tilt), M['belly'], 'spine')
        for side, sy, mat, pawm in (('n', -1, M['coat'], M['paw']), ('f', 1, M['coat_far'], M['paw_far'])):
            self.add('haunch_' + side, ell_bm((-3.0, sy * 4.9 * bw, 6.2), (5.8 * bs, 3.6 * bs, 5.6 * bs)), mat,
                     'leg_%s1' % side, outline=0.9)
            self.add('foot_' + side, ell_bm((0.2, sy * 4.8, 1.35), (4.9, 2.1, 1.45)), mat, 'leg_%s2' % side,
                     outline=0.7)
            # arms: upper (shoulder -> elbow), forearm + paw
            b1 = self._bone_pts('arm_%s1' % side)
            b2 = self._bone_pts('arm_%s2' % side)
            pts, rad = capsule_pts(b1[0], b1[1], 2.0, 1.75)
            self.add('arm_%s_up' % side, tube_bm(pts, rad, 14)[0], mat, 'arm_%s1' % side, outline=0.6)
            pts, rad = capsule_pts(b2[0], b2[1], 1.75, 1.55)
            self.add('arm_%s_lo' % side, tube_bm(pts, rad, 14)[0], mat, 'arm_%s2' % side, outline=0.6)
            paw = b2[1] + (b2[1] - b2[0]).normalized() * 0.6
            # paws in the light belly tone so raised paws read against the head and tail
            self.add('paw_' + side, ell_bm(paw, (2.3, 2.1, 2.2)), pawm, 'arm_%s2' % side, outline=0.6)

    def _bone_pts(self, name):
        b = self.rig.data.bones[name]
        return b.head_local.copy(), b.tail_local.copy()

    # ---------------- head
    HEAD_C = (3.2, 0, 31.8)
    HEAD_R = (10.6, 10.2, 9.4)
    MUZ_C = (11.0, -0.3, 28.6)
    MUZ_R = (4.7, 5.0, 3.9)

    def _head(self):
        M = self.M
        self.add('head', ell_bm(self.HEAD_C, self.HEAD_R, segs=36, rings=20), M['coat'], 'head', outline=1.0)
        self.add('muzzle', ell_bm(self.MUZ_C, self.MUZ_R), M['belly'], 'head', outline=0.45)
        # cheek fluff: a light patch on the near cheek blending into the muzzle
        self.add('cheek', ell_bm((7.6, -5.2, 27.6), (4.2, 3.4, 3.4)), M['belly'], 'head')
        self.add('nose', ell_bm((15.4, -0.6, 30.0), (1.7, 2.1, 1.35)), M['nose'], 'head', outline=0.3)
        # ears: flattened swept leaves with a lighter inner ear (near ear only shows the inner)
        for side, sy, mat in (('n', -1, M['coat']), ('f', 1, M['coat_far'])):
            base = V(-0.6, sy * 4.6, 38.6)
            mid = V(-1.6, sy * 5.4, 43.2)
            tip = V(-2.4, sy * 5.6, 47.0)
            pts, prm = catmull([base, mid, tip], 4)
            rad = [3.2 * (1 - (p / 2.0) ** 1.6) + 0.25 for p in prm]
            bm, _ = tube_bm(pts, rad, 14, xs=(0.42, 1.0))
            self.add('ear_' + side, bm, mat, 'head', outline=0.7)
            if side == 'n':
                pts2 = [p + V(0.35, -1.0, 0.0) for p in pts[:-2]]
                rad2 = [max(0.2, r * 0.55) for r in rad[:-2]]
                bm, _ = tube_bm(pts2, rad2, 12, xs=(0.3, 1.0))
                self.add('ear_in_n', bm, M['ear_in'], 'head')

    # ---------------- face (variants per expression)
    def _face(self):
        M = self.M
        H = Ellipsoid(self.HEAD_C, self.HEAD_R)
        Mz = Ellipsoid(self.MUZ_C, self.MUZ_R)
        eyes = [('n', 40.0, 9.0, 1.0), ('f', -30.0, 9.0, 0.82)]
        for side, az, el, k in eyes:
            p, u, v, n = H.frame(az, el)
            R3 = Matrix((u, v, n)).transposed()
            # white
            self.add('eyewhite_' + side, ell_bm(p - n * 0.2, (3.3 * k, 4.4, 1.5), R3), M['white'], 'head',
                     outline=0.45, group='eyes', state='open')
            self.variants['eyes'].setdefault('spiral', []).append(self.parts['eyewhite_' + side])
            self.variants['eyes'].setdefault('wide', []).append(self.parts['eyewhite_' + side])
            # normal pupil (big, looking forward) + shine
            pc = p + u * 0.7 * k - v * 0.25 + n * 0.85
            self.add('pupil_' + side, ell_bm(pc, (2.3 * k, 3.1, 1.0), R3), M['pupil'], 'head',
                     group='eyes', state='open')
            self.add('shine_' + side, ell_bm(pc - u * 0.4 * k + v * 1.2 + n * 0.75, (0.85 * k, 0.95, 0.5), R3),
                     M['shine'], 'head', group='eyes', state='open')
            # wide: small pupil, centred
            pc2 = p + u * 0.35 * k + n * 0.9
            self.add('pupil_w_' + side, ell_bm(pc2, (1.25 * k, 1.6, 0.8), R3), M['pupil'], 'head',
                     group='eyes', state='wide')
            self.add('shine_w_' + side, ell_bm(pc2 - u * 0.25 + v * 0.6 + n * 0.6, (0.5, 0.5, 0.4), R3),
                     M['shine'], 'head', group='eyes', state='wide')
            # spiral (dazed)
            sp = []
            for i in range(40):
                t = i / 39
                a = t * 2.4 * 2 * math.pi
                r = 0.25 + 2.3 * t
                sp.append((r * math.cos(a) * k * 0.95, r * math.sin(a) * 1.15))
            pts = H.curve(az, el, sp, 1.25)
            self.add('spiral_' + side, tube_bm(pts, [0.36] * len(pts), 8)[0], M['ink'], 'head',
                     group='eyes', state='spiral')
            # shut (squeezed, > on the near eye, < on the far eye)
            sgn = 1 if side == 'n' else -1
            chev = [(-1.7 * sgn * k, 1.9), (1.3 * sgn * k, 0.1), (-1.7 * sgn * k, -1.6)]
            pts, _ = catmull([V(a, b, 0) for a, b in chev], 4)
            pts = H.curve(az, el, [(q.x, q.y) for q in pts], 0.55)
            self.add('shut_' + side, tube_bm(pts, [0.5] * len(pts), 8)[0], M['ink'], 'head',
                     group='eyes', state='shut')
            # happy (^)
            arc = [(-2.0 * k + 4.0 * k * i / 10, 0.2 + 1.6 * (1 - ((i - 5) / 5.0) ** 2)) for i in range(11)]
            pts = H.curve(az, el, arc, 0.55)
            self.add('happy_' + side, tube_bm(pts, [0.55] * len(pts), 8)[0], M['ink'], 'head',
                     group='eyes', state='happy')
        # blush on the near cheek
        p, u, v, n = H.frame(58, -20)
        bk = self.VAR.get('blush', 1.0)
        self.add('blush', ell_bm(p + n * 0.05, (2.2 * bk, 1.3 * bk, 0.4), Matrix((u, v, n)).transposed()),
                 M['blush'], 'head', group='blush', state='on')
        # mouths on the muzzle
        az, el = 22.0, -42.0
        smile = [(-1.6 + 0.32 * i, 0.55 * ((-1.6 + 0.32 * i) / 1.6) ** 2 - 0.25) for i in range(11)]
        pts = Mz.curve(az, el, smile, 0.3)
        self.add('mouth_smile', tube_bm(pts, [0.36] * len(pts), 8)[0], M['ink'], 'head',
                 group='mouth', state='smile')
        p, u, v, n = Mz.frame(az, el)
        R3 = Matrix((u, v, n)).transposed()
        self.add('teeth', ell_bm(p - v * 1.05 + u * 0.15 + n * 0.1, (1.2, 0.9, 0.5), R3), M['tooth'], 'head',
                 outline=0.22, group='mouth', state='smile')
        self.add('mouth_open', ell_bm(p - v * 0.9 + n * 0.1, (2.3, 1.9, 0.9), R3), M['mouth'], 'head',
                 outline=0.3, group='mouth', state='open')
        self.add('tongue', ell_bm(p - v * 1.85 + n * 0.55, (1.5, 0.8, 0.5), R3), M['tongue'], 'head',
                 group='mouth', state='open')
        self.add('teeth_o', ell_bm(p - v * 0.0 + n * 0.75, (1.1, 0.6, 0.4), R3), M['tooth'], 'head',
                 group='mouth', state='open')
        self.add('mouth_o', ell_bm(p - v * 0.9 + n * 0.1, (0.95, 1.2, 0.8), R3), M['mouth'], 'head',
                 outline=0.3, group='mouth', state='o')
        wav = [(-1.6 + 0.2 * i, 0.35 * math.sin(i * math.pi / 4) - 0.3) for i in range(17)]
        pts = Mz.curve(az, el, wav, 0.3)
        self.add('mouth_wavy', tube_bm(pts, [0.34] * len(pts), 8)[0], M['ink'], 'head',
                 group='mouth', state='wavy')

    # ---------------- face extras per variant (freckles, brows, lashes)
    def _face_extras(self):
        M, VAR = self.M, self.VAR
        H = Ellipsoid(self.HEAD_C, self.HEAD_R)
        if VAR.get('freckles'):
            p, u, v, n = H.frame(56, -14)
            R3 = Matrix((u, v, n)).transposed()
            for j, (a, b) in enumerate(((-1.3, 0.5), (0.0, -0.1), (1.2, 0.6), (0.5, 1.4))):
                q = H.project(p + u * a + v * b, 0.15)
                self.add('freckle_%d' % j, ell_bm(q, (0.42, 0.42, 0.25), R3), M['freckle'], 'head')
        for side, az, el, k in (('n', 40.0, 9.0, 1.0), ('f', -30.0, 9.0, 0.82)):
            if VAR.get('brows'):
                if VAR['brows'] == 'arch':          # high round arch: curious / dapper
                    uv = [(-1.9 * k + 3.8 * k * i / 8, 5.9 + 0.8 * (1 - ((i - 4) / 4.0) ** 2)) for i in range(9)]
                    r = 0.42
                else:                               # soft, short and slightly tilted up toward the front
                    uv = [(-1.5 * k + 3.0 * k * i / 6, 5.7 + 0.35 * i / 6 + 0.25 * (1 - ((i - 3) / 3.0) ** 2))
                          for i in range(7)]
                    r = 0.55
                pts = H.curve(az, el, uv, 0.45)
                self.add('brow_' + side, tube_bm(pts, [r] * len(pts), 8)[0], M['ink'], 'head')
            if VAR.get('lashes'):
                # three short lashes flicking up and back from the outer (rear) top of each eye white
                for j, ang in enumerate((112, 132, 152)):
                    t = math.radians(ang)
                    a0, b0 = 3.3 * k * math.cos(t) * 0.95, 4.4 * math.sin(t) * 0.95
                    d = Vector((math.cos(t) * k, math.sin(t) * 1.25, 0)).normalized()
                    uv = [(a0 + d.x * 1.5 * s / 3, b0 + d.y * 1.5 * s / 3) for s in range(4)]
                    pts = H.curve(az, el, uv, 0.75)
                    self.add('lash_%s%d' % (side, j), tube_bm(pts, [0.3, 0.3, 0.26, 0.2], 6)[0], M['ink'], 'head')

    # ---------------- tail (shape per family)
    def tail_pts(self):
        # base inside the hips, sweeping back and up, curling forward over the top (S-curve)
        return [V(*p) for p in self.C['tail']]

    def _tail(self):
        cp = self.tail_pts()
        pts, prm = catmull(cp, 8)
        # extend a rounded tip
        d = (pts[-1] - pts[-2]).normalized()
        R = self.C['tail_r']
        rad = []
        for s in prm:
            i = min(int(s), len(R) - 2)
            t = s - i
            rad.append(R[i] + (R[i + 1] - R[i]) * t)
        tip_r = rad[-1]
        for k in range(1, 6):
            a = (math.pi / 2) * k / 5
            pts.append(cp[-1] + d * tip_r * math.sin(a))
            rad.append(max(tip_r * math.cos(a), 0.3 * tip_r))
            prm.append(prm[-1])
        nb = len(cp) - 1

        def weights(s):
            s = min(max(s, 0.5), nb - 0.5)
            w = {}
            for k in range(nb):
                x = max(0.0, 1.0 - abs(s - (k + 0.5)))
                if x > 0:
                    w['tail%d' % (k + 1)] = x
            tot = sum(w.values())
            return {k: v / tot for k, v in w.items()}

        def fluff(amp, lobes):
            return lambda i, th: 1.0 + amp * max(0.0, math.cos(lobes * th + i * 0.9)) ** 2

        for name, scale, dy, mat, outline, rm in (
                ('tail_fringe', self.C['fringe_k'], 1.4, self.M['fringe'], 1.0, fluff(0.07, 5)),
                ('tail_core', 1.0, -0.4, self.M['tailcore'], 0.0, fluff(0.04, 4))):
            P = [p + V(0, dy, 0) for p in pts]
            bm, rings = tube_bm(P, [r * scale for r in rad], 24, rmod=rm)
            wts = []
            for i, ring in enumerate(rings):
                wts += [weights(prm[i])] * len(ring)
            wts += [weights(prm[0]), weights(prm[-1])]       # cap centres
            self.add(name, bm, mat, weights=wts, outline=outline)

    # ---------------- headwear (Rustlers): all mustard, all on the head bone
    def _cap(self, backwards=False):
        M = self.M
        tilt = Matrix.Rotation(math.radians(-10 if not backwards else 6), 3, 'Y')
        self.add('cap_crown', ell_bm((3.0, 0, 35.6), (10.2, 9.9, 7.4), tilt, half=True), M['acc'], 'head',
                 outline=0.9)
        # band where the crown meets the head (darker), slightly larger than the crown rim
        ring = []
        for i in range(25):
            a = 2 * math.pi * i / 24
            ring.append(Vector((10.35 * math.cos(a), 10.05 * math.sin(a), 0)))
        bm, _ = tube_bm([tilt @ q + V(3.0, 0, 35.6) for q in ring], [0.75] * 25, 8, caps=(False, False))
        self.add('cap_band', bm, M['acc_dk'], 'head')
        if not backwards:
            # brim: a flattened half-disc reaching forward over the eyes
            brim_tilt = Matrix.Rotation(math.radians(-14), 3, 'Y')
            self.add('cap_brim', ell_bm((11.8, -0.4, 36.4), (8.3, 8.0, 1.2), brim_tilt), M['acc_dk'], 'head',
                     outline=0.7)
            self.add('cap_brim_top', ell_bm((11.6, -0.4, 36.95), (7.7, 7.5, 0.95), brim_tilt), M['acc'], 'head')
        else:
            # worn backwards: the brim sticks out behind the head, angled down over the neck, and the
            # strap opening shows as a dark arc over the forehead
            brim_tilt = Matrix.Rotation(math.radians(8), 3, 'Y')
            self.add('cap_brim', ell_bm((-8.6, 0.4, 36.4), (9.0, 7.8, 1.25), brim_tilt), M['acc_dk'], 'head',
                     outline=0.7)
            self.add('cap_brim_top', ell_bm((-8.4, 0.4, 36.95), (8.4, 7.2, 0.95), brim_tilt), M['acc'], 'head')
            H = Ellipsoid((3.0, 0, 35.6), (10.2, 9.9, 7.4))
            arc = [(-2.2 + 0.44 * i, 1.3 * (1 - ((i - 5) / 5.0) ** 2)) for i in range(11)]
            pts = [tilt @ (q - V(3.0, 0, 35.6)) + V(3.0, 0, 35.6) for q in H.curve(6, 14, arc, 0.25)]
            self.add('cap_gap', tube_bm(pts, [0.75] * len(pts), 8)[0], M['acc_dk'], 'head')
        self.add('cap_button', ell_bm(tilt @ V(0, 0, 7.3) + V(3.0, 0, 35.6), (1.5, 1.5, 1.0)), M['acc_dk'],
                 'head', outline=0.4)

    def _beanie(self):
        """Knit beanie: tall ribbed dome, rolled cuff, pom-pom on top."""
        M = self.M
        c = V(3.0, 0, 35.0)
        tilt = Matrix.Rotation(math.radians(-8), 3, 'Y')
        bm = ell_bm((0, 0, 0), (10.5, 10.2, 10.0), half=True, segs=48, rings=20)
        for v in bm.verts:                        # vertical knit ribs
            az = math.atan2(v.co.y, v.co.x)
            k = 1.0 + 0.035 * math.cos(16 * az) * min(1.0, (10.0 - v.co.z) / 4.0)
            v.co.x *= k
            v.co.y *= k
        bm.transform(Matrix.Translation(c) @ tilt.to_4x4())
        self.add('beanie_dome', bm, M['acc'], 'head', outline=0.9)
        ring = []
        for i in range(33):
            a = 2 * math.pi * i / 32
            ring.append(tilt @ Vector((10.7 * math.cos(a), 10.4 * math.sin(a), 0.6)) + c)
        rm = lambda i, th: 1.0 + 0.10 * math.cos(i * 2.0)   # noqa: E731  (rib bumps on the cuff)
        bm, _ = tube_bm(ring, [1.9] * 33, 12, rmod=rm, caps=(False, False))
        self.add('beanie_cuff', bm, M['acc_dk'], 'head', outline=0.7)
        top = tilt @ V(0, 0, 10.0) + c
        pc = top + V(0, 0, 2.2)
        pom = ell_bm(pc, (3.1, 3.1, 2.9), segs=32, rings=16)
        for v in pom.verts:                       # fluffy pom-pom lobes
            d = v.co - pc
            az = math.atan2(d.y, d.x)
            el = math.asin(max(-1.0, min(1.0, d.z / max(d.length, 1e-6))))
            v.co = pc + d * (1.0 + 0.09 * math.cos(6 * az) * math.cos(3 * el))
        self.add('beanie_pom', pom, M['acc'], 'head', outline=0.6)

    def _visor(self):
        """Sun visor: an open-top band round the head (fur and ears show) with a big forward brim."""
        M = self.M
        tilt = Matrix.Rotation(math.radians(-10), 3, 'Y')
        c = V(3.0, 0, 35.4)
        ring = []
        for i in range(33):
            a = 2 * math.pi * i / 32
            ring.append(tilt @ Vector((10.2 * math.cos(a), 9.95 * math.sin(a), 0)) + c)
        bm, _ = tube_bm(ring, [1.9] * 33, 10, xs=(0.5, 1.0), up=(0, 0, 1), caps=(False, False))
        self.add('visor_band', bm, M['acc'], 'head', outline=0.6)
        brim_tilt = Matrix.Rotation(math.radians(-6), 3, 'Y')      # jaunty: brim nearly level
        self.add('visor_brim', ell_bm((14.2, -0.4, 35.4), (11.0, 9.4, 1.25), brim_tilt), M['acc_dk'], 'head',
                 outline=0.7)
        self.add('visor_brim_top', ell_bm((14.0, -0.4, 35.95), (10.4, 8.8, 0.95), brim_tilt), M['acc'], 'head')

    # ---------------- neckwear (Tails): all teal
    def _neck_ring(self, r=2.6, rx=7.0, ry=7.4, z=23.6, tiltd=14, n=33, bulge=0.12):
        tilt = Matrix.Rotation(math.radians(tiltd), 3, 'Y')
        ring = [tilt @ Vector((rx * math.cos(2 * math.pi * i / (n - 1)), ry * math.sin(2 * math.pi * i / (n - 1)), 0))
                + V(2.4, 0, z) for i in range(n)]
        rm = lambda i, th: 1.0 + bulge * math.cos(i * 0.8)   # noqa: E731  (soft knit bulges)
        return tube_bm(ring, [r] * n, 14, rmod=rm, caps=(False, False))

    def _scarf(self):
        M = self.M
        bm, _ = self._neck_ring()
        self.add('scarf_loop', bm, M['acc'], 'spine', outline=0.9)
        self.add('scarf_knot', ell_bm((-4.8, -1.0, 24.6), (2.8, 2.9, 2.8)), M['acc'], 'spine', outline=0.7)
        # two ribbons trailing back from the knot, on the scarf bone so they can flutter
        for k, (dz, ln, wd) in enumerate(((1.2, 12.0, 2.5), (-1.6, 10.0, 2.3))):
            P = [V(-5.0, -1.4 - 0.4 * k, 24.6 + dz)]
            for j in range(1, 6):
                t = j / 5
                P.append(V(-5.0 - ln * t, -1.4 - 0.4 * k, 24.6 + dz - 6.0 * t * t + 0.9 * math.sin(t * 5 + k)))
            rad = [wd * (1.0 - 0.15 * j / 5) for j in range(6)]
            bm, _ = tube_bm(P, rad, 12, xs=(0.35, 1.0))
            self.add('scarf_tail%d' % k, bm, M['acc'] if k == 0 else M['acc_dk'], 'scarf', outline=0.6)
            e0, e1 = P[-1], P[-1] + (P[-1] - P[-2]).normalized() * 1.4
            bm, _ = tube_bm([e0, e1], [rad[-1] * 1.02] * 2, 12, xs=(0.4, 1.0))
            self.add('scarf_end%d' % k, bm, M['acc_dk'] if k == 0 else M['acc'], 'scarf', outline=0.5)

    def _bowtie(self):
        """Bow tie at the throat on a thin collar strap. The bow is turned toward the camera a little more
        than the body (a cartoon cheat) so both wings read in the 3/4 view."""
        M = self.M
        bm, _ = self._neck_ring(r=0.9, rx=6.6, ry=7.0, z=23.0, tiltd=16, bulge=0.0)
        self.add('collar', bm, M['acc_dk'], 'spine', outline=0.4)
        knot = V(8.2, -1.6, 21.6)
        axis = Vector((-0.45, -0.89, 0.0)).normalized()        # near wing direction
        nrm = Vector((0.89, -0.45, 0.0))                        # bow faces forward and toward the camera
        for side, sgn in (('n', 1), ('f', -1)):
            P = [knot + axis * sgn * 6.2 * t for t in (0.0, 0.25, 0.5, 0.75, 0.92, 1.0)]
            rad = [1.1, 2.2, 3.3, 3.9, 3.7, 2.6]
            bm, _ = tube_bm(P, rad, 14, xs=(0.42, 1.0), up=tuple(nrm))
            self.add('bow_' + side, bm, M['acc'], 'spine', outline=0.6)
        self.add('bow_knot', ell_bm(knot + nrm * 0.6, (1.5, 1.4, 1.7),
                                    Matrix((nrm, axis, Vector((0, 0, 1)))).transposed()), M['acc_dk'], 'spine',
                 outline=0.5)

    def _bandana(self):
        """Neckerchief: thin band, a triangle flap down the chest, knotted at the near side, cream dots."""
        M = self.M
        bm, _ = self._neck_ring(r=1.5, rx=6.8, ry=7.2, z=23.2, tiltd=12, bulge=0.05)
        self.add('bandana_band', bm, M['acc'], 'spine', outline=0.6)
        flap = [V(5.4, -0.8, 23.0), V(7.9, -0.9, 19.6), V(9.6, -1.0, 16.2), V(10.4, -1.0, 13.2),
                V(10.5, -1.0, 10.6)]
        rad = [6.6, 5.6, 4.0, 2.2, 0.8]
        P, prm = catmull(flap, 4)
        R = []
        for s in prm:
            i = min(int(s), len(rad) - 2)
            R.append(rad[i] + (rad[i + 1] - rad[i]) * (s - i))
        bm, _ = tube_bm(P, R, 16, xs=(0.32, 1.0), up=(1, 0, 0))
        self.add('bandana_flap', bm, M['acc'], 'spine', outline=0.6)
        for j, q in enumerate((V(9.5, -3.6, 18.4), V(10.5, 0.8, 16.8), V(11.0, -1.6, 13.4))):
            self.add('bandana_dot_%d' % j, ell_bm(q, (0.5, 0.75, 0.75)), M['cream'], 'spine')
        kn = V(3.2, -7.6, 23.4)
        self.add('bandana_knot', ell_bm(kn, (1.7, 1.5, 1.6)), M['acc_dk'], 'spine', outline=0.5)
        for j, end in enumerate((V(0.6, -8.4, 19.8), V(2.8, -8.6, 19.2))):
            P = [kn, kn.lerp(end, 0.5) + V(0, -0.3, 0), end]
            bm, _ = tube_bm(P, [1.1, 1.3, 0.6], 10, xs=(0.4, 1.0), up=(0, 1, 0))
            self.add('bandana_end%d' % j, bm, M['acc'], 'spine', outline=0.45)

    def _striped(self, P, rad, nseg, period, xs=(1.0, 1.0), up=(0, 1, 0), caps=(True, True), rmod=None):
        """Tube whose side faces alternate material 0 / 1 every `period` rings (stripes)."""
        bm, rings = tube_bm(P, rad, nseg, xs=xs, up=up, caps=caps, rmod=rmod)
        side = (len(rings) - 1) * nseg
        for fi, f in enumerate(bm.faces):
            f.material_index = ((fi // nseg) // period) % 2 if fi < side else 0
        return bm

    def _longscarf(self):
        """Long teal-and-cream striped scarf: one end hangs down the chest, the other trails behind."""
        M = self.M
        mats = [M['acc'], M['cream']]
        tilt = Matrix.Rotation(math.radians(14), 3, 'Y')
        n = 41
        ring = [tilt @ Vector((7.0 * math.cos(2 * math.pi * i / (n - 1)), 7.4 * math.sin(2 * math.pi * i / (n - 1)), 0))
                + V(2.4, 0, 23.6) for i in range(n)]
        bm = self._striped(ring, [2.5] * n, 14, 3, caps=(False, False))
        self.add('lscarf_loop', bm, mats, 'spine', outline=0.9)
        front = [V(5.6, -4.2, 22.2), V(7.6, -4.6, 19.0), V(9.0, -4.8, 15.5), V(9.6, -4.9, 12.0), V(9.5, -4.9, 8.5)]
        P, _ = catmull(front, 4)
        bm = self._striped(P, [2.4] * len(P), 12, 3, xs=(0.4, 1.0), up=(1, 0, 0))
        self.add('lscarf_front', bm, mats, 'spine', outline=0.6)
        back = [V(-5.0, -1.6, 24.8)]
        for j in range(1, 9):
            t = j / 8
            back.append(V(-5.0 - 16.0 * t, -1.6, 24.8 - 8.0 * t * t + 1.0 * math.sin(t * 6)))
        P, _ = catmull(back, 3)
        bm = self._striped(P, [2.4 * (1 - 0.1 * i / len(P)) for i in range(len(P))], 12, 3, xs=(0.38, 1.0))
        self.add('lscarf_back', bm, mats, 'scarf', outline=0.6)
        # little tassels on both ends
        for nm, ends, bone in (('f', front, 'spine'), ('b', back, 'scarf')):
            e, d = ends[-1], (ends[-1] - ends[-2]).normalized()
            side = d.cross(Vector((1, 0, 0)) if nm == 'f' else Vector((0, 1, 0))).normalized()
            for j in (-1, 0, 1):
                a = e + side * 1.4 * j
                bm, _ = tube_bm([a, a + d * 1.8], [0.45, 0.35], 6)
                self.add('tassel_%s%d' % (nm, j + 1), bm, M['acc_dk'], bone, outline=0.3)

    # ---------------- posing
    def _rest_angle(self, name):
        h, t = self._bone_pts(name)
        return math.degrees(math.atan2(t.z - h.z, t.x - h.x))

    def apply(self, P):
        rig = self.rig
        for pb in rig.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
        # arms may be given as screen angles of the upper arm and forearm (CCW degrees, 0 = facing
        # direction, 90 = up); convert to bone rotations relative to the rest pose and the spine lean
        sp = P['bones'].get('spine', {}).get('a', 0.0)
        # optional extras: abduction (degrees the arm swings out sideways, so raised arms clear the wide
        # head instead of passing inside it), stretch (cartoon arm length factor) and lift (shoulder moved
        # up the body, in units) so "arms up" reaches above the eyes despite the short chibi arms
        for side, spec in P.get('arms', {}).items():
            wu, wf = spec[0], spec[1]
            abd = spec[2] if len(spec) > 2 else 0.0
            stretch = spec[3] if len(spec) > 3 else 1.0
            lift = spec[4] if len(spec) > 4 else 0.0
            ru = self._rest_angle('arm_%s1' % side)
            rf = self._rest_angle('arm_%s2' % side)
            P['bones']['arm_%s1' % side] = {'a': wu - ru - sp, 'roll': -abd if side == 'n' else abd,
                                             's': (1.0, stretch, 1.0),
                                             'loc': (0.0, lift)}
            P['bones']['arm_%s2' % side] = {'a': (wf - rf) - (wu - ru)}
        for name, spec in P['bones'].items():
            pb = rig.pose.bones[name]
            R0 = pb.bone.matrix_local.to_3x3()
            Q = (Matrix.Rotation(math.radians(spec.get('yaw', 0)), 3, 'Z') @
                 Matrix.Rotation(math.radians(-spec.get('a', 0)), 3, 'Y') @
                 Matrix.Rotation(math.radians(spec.get('roll', 0)), 3, 'X'))
            pb.rotation_quaternion = (R0.inverted() @ Q @ R0).to_quaternion()
            if 'loc' in spec:
                dx, dz = spec['loc']
                pb.location = R0.inverted() @ Vector((dx, 0, dz))
            if 's' in spec:
                pb.scale = spec['s']
        for group, states in self.variants.items():
            want = P.get(group, {'eyes': 'open', 'mouth': 'smile', 'blush': 'on'}[group])
            for state, obs in states.items():
                for ob in obs:
                    ob.hide_render = True
            for ob in states.get(want, []):
                ob.hide_render = False
        bpy.context.view_layer.update()


# ------------------------------------------------------------------ pose library (angles: screen CCW degrees)
def tailwave(base, amp, ph, curl=0.0, k=0.9):
    """6 tail bone angles: base tilt on the first bone, a travelling wave, extra curl on the tip."""
    out = {}
    for i in range(6):
        a = (base if i == 0 else 0.0) + amp * math.sin(ph - i * k) + (curl if i >= 3 else 0.0)
        out['tail%d' % (i + 1)] = {'a': a}
    return out


def pose(name, i, n):
    """Pose for frame i of n. Bone angles are screen CCW degrees about the depth axis; 'arms' gives
    screen angles of upper arm and forearm directly (0 = facing direction, 90 = straight up)."""
    ph = 2 * math.pi * i / n
    B = {}
    P = {'bones': B}
    if name == 'idle':
        s = math.sin(ph)
        B['spine'] = {'a': 1.2 * s, 's': (1 + 0.012 * s, 1 + 0.025 * s, 1 + 0.012 * s)}
        B['head'] = {'a': -1.6 * s}
        B['arm_n1'] = {'a': 3 * s}
        B['arm_f1'] = {'a': 3 * s}
        B.update(tailwave(-2.0, 4.0, ph))
        B['scarf'] = {'a': 3 * math.sin(ph + 1)}
    elif name == 'scamper':
        # bounding gait: push (hind back, fore reach), gather, flight, land
        F = [dict(z=0.0, sp=-30, hd=20, an=(-20, -40), af=(-35, -55), ln=-38, lf=-28, fn=-25, ff=-20, t=-24),
             dict(z=1.8, sp=-24, hd=16, an=(-115, -50), af=(-100, -40), ln=30, lf=22, fn=15, ff=10, t=-14),
             dict(z=3.0, sp=-34, hd=22, an=(0, -10), af=(-12, -25), ln=-48, lf=-40, fn=-35, ff=-30, t=-30),
             dict(z=1.2, sp=-28, hd=18, an=(-55, -75), af=(-65, -85), ln=12, lf=6, fn=5, ff=0, t=-20)][i]
        B['root'] = {'loc': (0, F['z'])}
        B['spine'] = {'a': F['sp']}
        B['head'] = {'a': F['hd']}
        P['arms'] = {'n': F['an'], 'f': F['af']}
        B['leg_n1'] = {'a': F['ln']}
        B['leg_n2'] = {'a': F['fn']}
        B['leg_f1'] = {'a': F['lf']}
        B['leg_f2'] = {'a': F['ff']}
        B.update(tailwave(F['t'], 8.0, ph, curl=-4))
        B['scarf'] = {'a': -12 + 8 * math.sin(ph)}
    elif name == 'aim':
        B['spine'] = {'a': 10}
        B['head'] = {'a': -6}
        P['arms'] = {'n': (150, 105, 40), 'f': (15, 20)}
        B['leg_n1'] = {'a': -8}
        B['leg_f1'] = {'a': 8}
        B.update(tailwave(-6, 3.0, 0.5))
    elif name == 'throw':
        if i == 0:
            B['spine'] = {'a': -14}
            B['head'] = {'a': 8}
            P['arms'] = {'n': (12, 8), 'f': (-150, -120)}
            B['leg_n1'] = {'a': 6}
            B['leg_f1'] = {'a': -12}
            B.update(tailwave(8, 6.0, 1.5))
            B['scarf'] = {'a': 10}
            P['mouth'] = 'open'
        else:
            B['spine'] = {'a': -22}
            B['head'] = {'a': 14}
            P['arms'] = {'n': (-30, -45), 'f': (-160, -135)}
            B['leg_n1'] = {'a': 14}
            B['leg_f1'] = {'a': -16}
            B.update(tailwave(12, 6.0, 2.6))
            B['scarf'] = {'a': -6}
    elif name == 'hit':
        B['root'] = {'s': (1.16, 0.80, 1.16)}
        B['spine'] = {'a': 10}
        B['head'] = {'a': 10, 'roll': -6}
        P['arms'] = {'n': (60, 110, 30), 'f': (70, 115, 30)}
        B.update(tailwave(4, 5.0, 0.0, curl=6))
        B['scarf'] = {'a': 18}
        P['eyes'], P['mouth'] = 'shut', 'o'
    elif name == 'fall':
        w = 1 if i == 0 else -1
        B['root'] = {'loc': (0, 1.0 + i)}
        B['spine'] = {'a': 6 + 2 * w}
        B['head'] = {'a': 6}
        P['arms'] = {'n': (86 + 6 * w, 98 + 8 * w, 30, 1.25, 3.5), 'f': (62 - 6 * w, 76 - 6 * w, 28, 1.25, 3.5)}
        B['leg_n1'] = {'a': 22 + 6 * w}
        B['leg_n2'] = {'a': -30}
        B['leg_f1'] = {'a': 6 - 6 * w}
        B['leg_f2'] = {'a': -24}
        B.update(tailwave(-10, 8.0, 1.0 + 1.6 * i, curl=-10))
        B['scarf'] = {'a': 30 + 10 * w}
        P['eyes'], P['mouth'] = 'wide', 'o'
    elif name == 'out':
        B['root'] = {'loc': (0, -1.0)}
        B['spine'] = {'a': 12}
        B['head'] = {'a': -14, 'roll': -10}
        P['arms'] = {'n': (-95, -100), 'f': (-92, -100)}
        B['leg_n1'] = {'a': 42}
        B['leg_n2'] = {'a': -12}
        B['leg_f1'] = {'a': 34}
        B['leg_f2'] = {'a': -8}
        for k, a in enumerate((28, 6, -4, -6, -8, -6)):
            B['tail%d' % (k + 1)] = {'a': a}
        B['scarf'] = {'a': 28}
        P['eyes'], P['mouth'] = 'spiral', 'wavy'
    elif name == 'cheer':
        up = i == 1
        B['root'] = {'loc': (0, 2.2 if up else 0.0)}
        B['spine'] = {'a': 4 if up else 2}
        B['head'] = {'a': 10 if up else 6}
        P['arms'] = {'n': (92, 104, 30, 1.3, 3.5) if up else (84, 96, 30, 1.25, 3.5),
                     'f': (66, 80, 28, 1.3, 3.5) if up else (58, 72, 28, 1.25, 3.5)}
        if up:
            B['leg_n1'] = {'a': 14}
            B['leg_n2'] = {'a': -20}
            B['leg_f1'] = {'a': -6}
            B['leg_f2'] = {'a': -14}
        B.update(tailwave(6 if up else 2, 7.0, 0.8 + 2.0 * i, curl=6))
        B['scarf'] = {'a': -10 if up else 4}
        P['eyes'], P['mouth'] = 'happy', 'open'
    return P


# ------------------------------------------------------------------ scene, camera, render
def reset_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.cameras,
                 bpy.data.lights, bpy.data.images):
        for d in list(coll):
            coll.remove(d)
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    try:
        sc.eevee.taa_render_samples = SAMPLES
    except Exception:
        pass
    r = sc.render
    r.resolution_x = r.resolution_y = RES
    r.resolution_percentage = 100
    r.film_transparent = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    r.image_settings.color_depth = '8'
    try:
        r.image_settings.compression = 90
    except Exception:
        pass
    # no PNG metadata (date, time, render time, host...), so repeated runs give byte-identical files
    r.use_stamp = False
    for k in dir(r):
        if k.startswith('use_stamp') and isinstance(getattr(r, k), bool):
            try:
                setattr(r, k, False)
            except Exception:
                pass
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0
    sc.view_settings.gamma = 1
    w = bpy.data.worlds.new('black')
    sc.world = w
    w.color = (0, 0, 0)
    try:
        w.use_nodes = True
    except Exception:
        pass
    if w.node_tree:
        for nd in w.node_tree.nodes:
            if nd.type == 'BACKGROUND':
                nd.inputs[1].default_value = 0.0
    # orthographic camera on -Y looking +Y; pixel (128, 236) <- world origin
    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cd.ortho_scale = RES / PPU
    cd.clip_start, cd.clip_end = 1.0, 600.0
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    zc = (ANCHOR[1] - RES / 2) / PPU
    xc = (RES / 2 - ANCHOR[0]) / PPU
    cam.location = (xc, -300.0, zc)
    cam.rotation_euler = (math.radians(90), 0, 0)
    sc.camera = cam
    # key light from upper front, camera side; no shadows (clean cel terminator)
    ld = bpy.data.lights.new('key', 'SUN')
    ld.energy = 1.0
    ld.use_shadow = False
    sun = bpy.data.objects.new('key', ld)
    sc.collection.objects.link(sun)
    to_light = Vector((0.45, -0.75, 0.62)).normalized()
    sun.rotation_euler = (-to_light).to_track_quat('-Z', 'Y').to_euler()


def read_png(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)[::-1].copy()        # top-down rows


def write_png(path, arr):
    h, w = arr.shape[:2]
    img = bpy.data.images.new('out', w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1], dtype=np.float32).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def bbox(arr, thr=0.02):
    ys, xs = np.nonzero(arr[..., 3] > thr)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


# ------------------------------------------------------------------ contact sheets
GLYPH = {
    'A': '01110 10001 10001 11111 10001 10001 10001', 'C': '01111 10000 10000 10000 10000 10000 01111',
    'D': '11110 10001 10001 10001 10001 10001 11110', 'E': '11111 10000 10000 11110 10000 10000 11111',
    'F': '11111 10000 10000 11110 10000 10000 10000', 'G': '01111 10000 10000 10011 10001 10001 01111',
    'H': '10001 10001 10001 11111 10001 10001 10001', 'I': '01110 00100 00100 00100 00100 00100 01110',
    'K': '10001 10010 10100 11000 10100 10010 10001', 'L': '10000 10000 10000 10000 10000 10000 11111',
    'M': '10001 11011 10101 10101 10001 10001 10001', 'N': '10001 11001 10101 10011 10001 10001 10001',
    'O': '01110 10001 10001 10001 10001 10001 01110', 'P': '11110 10001 10001 11110 10000 10000 10000',
    'R': '11110 10001 10001 11110 10100 10010 10001', 'S': '01111 10000 10000 01110 00001 00001 11110',
    'T': '11111 00100 00100 00100 00100 00100 00100', 'U': '10001 10001 10001 10001 10001 10001 01110',
    'W': '10001 10001 10001 10101 10101 11011 10001', 'B': '11110 10001 10001 11110 10001 10001 11110',
    'Y': '10001 10001 01010 00100 00100 00100 00100', 'X': '10001 10001 01010 00100 01010 10001 10001',
    'V': '10001 10001 10001 10001 10001 01010 00100', 'Q': '01110 10001 10001 10001 10101 10010 01101',
    '0': '01110 10011 10101 10101 11001 10001 01110', '1': '00100 01100 00100 00100 00100 00100 01110',
    '2': '01110 10001 00001 00110 01000 10000 11111', '3': '11110 00001 00001 01110 00001 00001 11110',
    '_': '00000 00000 00000 00000 00000 00000 11111', ' ': '00000 00000 00000 00000 00000 00000 00000',
    '-': '00000 00000 00000 11111 00000 00000 00000',
}


def label(img, text, x0, y0, scale=2, col=(0.15, 0.15, 0.17)):
    x = x0
    for ch in text.upper():
        for r, bits in enumerate(GLYPH.get(ch, GLYPH[' ']).split()):
            for c, b in enumerate(bits):
                if b == '1':
                    img[y0 + r * scale:y0 + (r + 1) * scale, x + c * scale:x + (c + 1) * scale, :3] = col
        x += 6 * scale


def over(dst, src, x, y):
    h, w = src.shape[:2]
    d = dst[y:y + h, x:x + w]
    a = src[..., 3:4]
    d[..., :3] = d[..., :3] * (1 - a) + src[..., :3] * a


BG = np.array([0.80, 0.87, 0.90], dtype=np.float32)       # soft sky
BG2 = np.array([0.74, 0.82, 0.86], dtype=np.float32)


def contact_sheet(title, frames, path, cols=4):
    """frames: list of (label, 256x256 RGBA array), laid out row-major in `cols` columns."""
    lab = 22
    rows = (len(frames) + cols - 1) // cols
    W, H = cols * RES, rows * (RES + lab) + 30
    sheet = np.ones((H, W, 4), dtype=np.float32)
    sheet[..., :3] = 0.96
    label(sheet, title, 8, 8, 2)
    for k, (fname, arr) in enumerate(frames):
        cx, cy = (k % cols) * RES, 30 + (k // cols) * (RES + lab)
        cell = sheet[cy:cy + RES, cx:cx + RES]
        cell[..., :3] = BG
        cell[ANCHOR[1]:, :, :3] = BG2                      # ground below the feet line
        over(sheet, arr, cx, cy)
        ax, ay = cx + ANCHOR[0], cy + ANCHOR[1]
        sheet[ay, ax - 6:ax + 7, :3] = (0.85, 0.1, 0.1)    # anchor cross
        sheet[ay - 6:ay + 7, ax, :3] = (0.85, 0.1, 0.1)
        sheet[cy:cy + RES, cx, :3] = 0.6                   # cell border
        label(sheet, fname, cx + 4, cy + RES + 4, 2)
    write_png(path, sheet)


def downscale(arr, f):
    h, w = arr.shape[:2]
    pm = arr.copy()
    pm[..., :3] *= pm[..., 3:4]
    s = pm.reshape(h // f, f, w // f, f, 4).mean(axis=(1, 3))
    out = s.copy()
    a = np.maximum(s[..., 3:4], 1e-6)
    out[..., :3] = np.where(s[..., 3:4] > 0, s[..., :3] / a, 0)
    return out


def small_preview(rows, path, f=4, mag=3):
    """One row per (team, variant): every frame at 1/4 size (the squirrel ~40 px tall, its in-game size).
    mag > 1 enlarges with nearest-neighbour so single pixels can be judged."""
    c = RES // f
    n = max(len(v) for v in rows)
    img = np.ones((len(rows) * c, n * c, 4), dtype=np.float32)
    img[..., :3] = BG
    for r, frames in enumerate(rows):
        for k, (fname, arr) in enumerate(frames):
            over(img, downscale(arr, f), k * c, r * c)
    if mag > 1:
        img = img.repeat(mag, axis=0).repeat(mag, axis=1)
    write_png(path, img)


SHEET_POSES = ['idle_0', 'aim_0', 'hit_0', 'cheer_0']


# ------------------------------------------------------------------ main
def main():
    A = args()
    t_all = time.time()
    os.makedirs(SPRITES, exist_ok=True)
    rows = []
    for team in A['teams']:
        t_team = time.time()
        picks = []
        for var in A['variants']:
            t0 = time.time()
            reset_scene()
            sq = Squirrel(team, var)
            tag = 't%dv%d' % (team, var)
            if A['save']:
                sq.apply({'bones': {}})
                bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLENDER_DIR, 'squirrel-%s.blend' % tag))
            outdir = os.path.join(SPRITES, tag)
            os.makedirs(outdir, exist_ok=True)
            frames = []
            for name, n in POSES:
                if A['poses'] and name not in A['poses']:
                    continue
                for i in range(n):
                    sq.apply(pose(name, i, n))
                    path = os.path.join(outdir, '%s_%d.png' % (name, i))
                    bpy.context.scene.render.filepath = path
                    bpy.ops.render.render(write_still=True)
                    arr = read_png(path)
                    bb = bbox(arr)
                    edge = bb is None or bb[0] < 2 or bb[1] < 2 or bb[2] > RES - 3 or bb[3] > RES - 3
                    print('@@FRAME %s %s_%d bbox=%s h=%dpx %s' % (tag, name, i, bb, (bb[3] - bb[1] + 1) if bb else 0,
                                                                   'CLIPPED' if edge else 'ok'))
                    frames.append(('%s_%d' % (name, i), arr))
            rows.append(frames)
            short = VARIANTS[team][var]['label']
            picks += [('V%d %s %s' % (var, short, fn), a) for fn, a in frames if fn in SHEET_POSES]
            print('@@VARIANT %s (%s) frames=%d seconds=%.1f' % (tag, short, len(frames), time.time() - t0))
        if A['sheet'] and picks:
            contact_sheet('%s  %s - variants' % (TEAMS[team]['key'], TEAMS[team]['name']), picks,
                          os.path.join(SPRITES, 'sheet-t%d-variants.png' % team))
        print('@@TEAM t%d seconds=%.1f' % (team, time.time() - t_team))
    if A['sheet'] and len(rows) == 8:
        small_preview(rows, os.path.join(SPRITES, 'small-preview-variants.png'))
        small_preview(rows, os.path.join(SPRITES, 'small-preview-variants-1x.png'), mag=1)
    print('@@DONE seconds=%.1f' % (time.time() - t_all))


main()
