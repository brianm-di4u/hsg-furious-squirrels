"""Bathhouse Row composition guide for the painted backdrops (Furious Squirrels).

Headless, deterministic. Builds a block-out of the backdrop view (Bathhouse Row from West Mountain's lower
east slope, looking east across Central Avenue to Hot Springs Mountain) and renders it with an orthographic
camera at the game's backdrop-panel size, so a painter can trace it and the painting lines up with the
vector fallback in src/js/gfx/backdrop.js.

Run from the game folder (C:\\Video Game Projects\\games\\Furious Squirrels):
    "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
        --python art-src/blender/scripts/row_guide.py -- --stretch middle
    --stretch north|middle|south|all   (default middle; 'all' renders the three in one run)
    --out <dir>                        (default art-src/blender/renders)
    --blend                            (also save art-src/blender/row_guide.blend)

Reads (read-only):
    games/Cart Racing/art-src/blender/export/<name>.glb  (Tub Rally bathhouse models: Z-up after import,
        origin front-centre on the street wall line at grade, facade toward Blender -Y, +X = south)
Writes: art-src/blender/renders/guide-<stretch>.png (2500x1000 RGBA, transparent sky).

Framing (all from backdrop.js): panel 2500x1000 px, street baseline y = 700, SX = 1.75 px per ft of frontage,
SY = 3 px per ft of height. Slot positions follow backdrop.js ROW (frontage + gap, north to south), and each
GLB's origin is put at its slot centre. Focus building at x = 1250: north Hale, middle Quapaw, south Buckstaff.

Camera: orthographic, tilted down TILT degrees (an elevated view, so the lawn, curb and road in front of the
wall line show as bands below the street line, and the hill behind rises above it). Building heights are
scaled by (SY/SX)/cos(TILT) about grade so that a height of h ft spans 3h px on screen, as in the vector
layout. The foreground bands are placed in depth so that they land on the vector layout's rows (lawn to
y 744, curb strip 744-760, road below, centre line at 850); the depths are therefore not true distances.

Hill: a smooth mass behind the Row whose crest height follows the DEM transects in
research/valley-profile.json (Hot Springs Mountain rises ~85 m above the Row at Hale, ~52 m at Quapaw,
~23 m at Lamar and ~127 m at the Tower latitude), compressed into the frame: crest px above the street =
220 + 3.8 * rise_m, capped at 600 px. It is fixed to the world (falls north to south), so the three
stretches join up. Tree clumps (spheres and cones) use a fixed-seed RNG. No Mountain Tower.
"""
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

# ---------------------------------------------------------------- layout (src/js/gfx/backdrop.js)
FT = 0.3048
SX, SY = 1.75, 3.0                 # px per ft (frontage, height)
BW, BH, BASE = 2500, 1000, 700     # panel size, street baseline
ROW = [  # id, frontage ft, gap ft to next (HABS AR-28, as in backdrop.js)
    ('arlington', 230, 140), ('superior', 88, 3), ('hale', 120, 58), ('maurice', 90, 43),
    ('fordyce', 105, 32), ('quapaw', 184, 30), ('ozark', 108, 18), ('buckstaff', 105, 10),
    ('lamar', 94, 11), ('admin', 45, 0)]
FOCUS = {'north': 'hale', 'middle': 'quapaw', 'south': 'buckstaff'}
ARL_SET_FT, ARL_RAISE_PX = 120, 90  # backdrop.js: Arlington set back 120 ft, base drawn 90 px higher

# ---------------------------------------------------------------- camera
TILT = 12.0                          # deg below horizontal (view from the lower east slope of West Mountain)
PXM = SX / FT                        # px per metre on the camera plane (5.7415)
ORTHO = BW / PXM                     # 435.43 m across the frame
CT, ST = math.cos(math.radians(TILT)), math.sin(math.radians(TILT))
ZEX = (SY / SX) / CT                 # vertical scale for the GLBs (1.752 at 12 deg)


def depth_for_px(px_below):
    """Depth (m, toward the camera = negative) of a ground point drawn px_below the street line."""
    return -px_below / (PXM * ST)


def z_for_px(px, depth=0.0):
    """Height (m) of a point at depth that should sit px above the street line."""
    return (px / PXM - ST * depth) / CT


SRC = r"C:\Video Game Projects\games\Cart Racing\art-src\blender\export"
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', '..', '..'))


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    o = {'stretch': 'middle', 'out': os.path.join(GAME, 'art-src', 'blender', 'renders'), 'blend': False}
    i = 0
    while i < len(a):
        if a[i] == '--stretch': o['stretch'] = a[i + 1]; i += 2
        elif a[i] == '--out': o['out'] = os.path.abspath(a[i + 1]); i += 2
        elif a[i] == '--blend': o['blend'] = True; i += 1
        else: raise SystemExit('unknown arg ' + a[i])
    if o['stretch'] not in ('north', 'middle', 'south', 'all'):
        raise SystemExit('--stretch must be north, middle, south or all')
    return o


def slots():
    x, out = 0.0, {}
    for n, f, g in ROW:
        out[n] = (x, x + f)
        x += f + g
    return out


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


_mats = {}


def mat(name, hexc, rough=0.9):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*lin(hexc), 1)
    b.inputs['Roughness'].default_value = rough
    for k in ('Specular IOR Level', 'Specular'):
        if k in b.inputs:
            b.inputs[k].default_value = 0.15
            break
    m.diffuse_color = (*lin(hexc), 1)
    _mats[name] = m
    return m


def mesh_obj(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def box(name, x0, x1, y0, y1, z0, z1, m):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(x1 - x0, y1 - y0, z1 - z0), verts=bm.verts)
    bmesh.ops.translate(bm, vec=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), verts=bm.verts)
    return mesh_obj(name, bm, [m])


# ---------------------------------------------------------------- scene parts
def import_row(sl):
    info = {}
    for n, f, g in ROW:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, n + '.glb'))
        new = [o for o in bpy.data.objects if o not in before]
        ob = [o for o in new if o.type == 'MESH'][0]
        for o in new:
            if o is not ob:
                bpy.data.objects.remove(o)
        ob.parent = None
        ob.matrix_world = Matrix.Identity(4)
        vs = [v.co for v in ob.data.vertices]
        wall = [v.x for v in vs if 0.2 < v.z < 3 and abs(v.y) < 0.3]
        wall_ft = (max(wall) - min(wall)) / FT if wall else None
        x0, x1 = sl[n]
        if n == 'arlington':
            # The hotel faces the Central/Fountain junction (south-west): turn its front 45 deg toward +X (south).
            # It is 136 m across the folded-back wings, so it is wider than the 230 ft slot; its south edge is
            # kept on the slot's south edge (preserving the 140 ft lawn gap to the Superior) and it runs north.
            ob.rotation_euler = (0, 0, math.radians(45))
            bpy.context.view_layer.update()
            rv = [ob.matrix_world @ v.co for v in ob.data.vertices]
            dx = x1 * FT - max(v.x for v in rv)
            dy = ARL_SET_FT * FT - min(v.y for v in rv if v.z > -0.1)
            dz = z_for_px(ARL_RAISE_PX, ARL_SET_FT * FT) + 0.0  # front base drawn 90 px above the street
            ob.location = (dx, dy, dz)
            ob.scale = (1, 1, ZEX)
            bpy.context.view_layer.update()
            rv = [ob.matrix_world @ v.co for v in ob.data.vertices]
            info[n] = dict(obj=ob, wall_ft=None, xs=(min(v.x for v in rv), max(v.x for v in rv)),
                           ys=(min(v.y for v in rv), max(v.y for v in rv)), z0=dz)
        else:
            ob.location = ((x0 + x1) / 2 * FT, 0, 0)
            ob.scale = (1, 1, ZEX)
            info[n] = dict(obj=ob, wall_ft=wall_ft)
    bpy.context.view_layer.update()
    return info


def ground(sl, arl):
    lawn = mat('lawn', '#6E8C45')
    xa, xb = -250.0, 900.0
    y_curb, y_road, y_line = depth_for_px(44), depth_for_px(60), depth_for_px(150)
    y_bot = depth_for_px(BH - BASE + 40)
    box('Lawn', xa, xb, y_curb, 140, -1.0, 0.0, lawn)
    box('Curb', xa, xb, y_road, y_curb, -1.0, 0.03, mat('curb', '#B8B2A4'))
    box('Road', xa, xb, y_bot, y_road, -1.0, 0.0, mat('road', '#6A6A68'))
    # dashed centre line, 40 px on / 40 px off, 4 px tall
    bm = bmesh.new()
    dash = 40 / PXM
    hh = 2 / (PXM * ST)
    k = math.floor(xa / (2 * dash))
    while k * 2 * dash < xb:
        x0 = k * 2 * dash
        r = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(dash, 2 * hh, 0.04), verts=r['verts'])
        bmesh.ops.translate(bm, vec=(x0 + dash / 2, y_line, 0.0), verts=r['verts'])
        k += 1
    mesh_obj('CentreLine', bm, [mat('paint', '#E8D27A')])
    # terrace under the set-back Arlington
    a = arl
    box('ArlingtonTerrace', a['xs'][0] - 4, a['xs'][1] + 4, a['ys'][0] - 6, a['ys'][1], -1.0, a['z0'],
        mat('terrace', '#7C8F5A'))


# crest px above the street, from the DEM transects (x in ft along the Row, 0 = Arlington's north edge)
#   rise above the Row: Tower lat 127 m (x ~ -390), Hale lat 85 m (x 521), Quapaw lat 52 m (x 958),
#   Lamar lat 23 m (x 1395); px = 220 + 3.8 * rise, capped at 600
CREST = [(-900, 600), (-390, 600), (521, 543), (958, 418), (1395, 307), (2400, 280)]


def crest_px(x_ft):
    if x_ft <= CREST[0][0]:
        p = CREST[0][1]
    elif x_ft >= CREST[-1][0]:
        p = CREST[-1][1]
    else:
        for (xa, pa), (xb, pb) in zip(CREST, CREST[1:]):
            if xa <= x_ft <= xb:
                t = (x_ft - xa) / (xb - xa)
                t = t * t * (3 - 2 * t)
                p = pa + (pb - pa) * t
                break
    return p + 14 * math.sin(x_ft / 61.0) + 9 * math.sin(x_ft / 143.0 + 1.3)  # gentle shoulders


def smooth01(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def hill_frame(x_m, arl):
    """Return (y0 foot, yc crest, zc crest height) for a slice of the hill at x (m)."""
    a0, a1 = arl['xs']
    inside = smooth01((x_m - (a0 - 30)) / 30) * (1 - smooth01((x_m - (a1 + 5)) / 30))
    y0 = 32 + inside * (arl['ys'][1] - 32 - 10)   # the hotel backs into the slope
    yc = y0 + 120
    zc = z_for_px(crest_px(x_m / FT), yc)
    return y0, yc, zc


def hill_z(x_m, y, arl):
    y0, yc, zc = hill_frame(x_m, arl)
    if y <= y0:
        return 0.0
    if y <= yc:
        t = (y - y0) / (yc - y0)
        return zc * (1 - (1 - t) ** 2.2)   # steep foot, rounded crest
    return zc - (y - yc) * 0.6             # back side falls away (never seen)


def hill(arl):
    xs = [-220 + 5 * i for i in range(int((880 + 220) / 5) + 1)]
    NT = 24
    bm = bmesh.new()
    grid = []
    for x in xs:
        y0, yc, zc = hill_frame(x, arl)
        col = []
        for j in range(NT + 1):
            y = y0 - 2 + (yc + 30 - (y0 - 2)) * j / NT
            col.append(bm.verts.new((x, y, hill_z(x, y, arl) - (0.5 if j == 0 else 0))))
        grid.append(col)
    for i in range(len(xs) - 1):
        for j in range(NT):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    ob = mesh_obj('HotSpringsMountain', bm, [mat('hill', '#6F8064')])
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def trees(arl, row_info):
    """Sphere and cone clumps on the slope, fixed seed. Kept off the hotel's footprint."""
    rng = random.Random(1924)
    greens = [mat('leaf_a', '#4F6B35'), mat('leaf_b', '#5C7A3A'), mat('leaf_c', '#3E5A2E'),
              mat('leaf_d', '#6E8C45')]
    pine = mat('pine', '#2F4A2C')
    bm = bmesh.new()
    a0, a1 = arl['xs']
    x = -215.0
    while x < 875:
        y0, yc, zc = hill_frame(x, arl)
        for _ in range(9):
            t = rng.random() ** 0.8
            y = y0 + 6 + (yc + 4 - y0 - 6) * t
            xx = x + rng.uniform(-3, 3)
            if a0 - 6 < xx < a1 + 6 and y < arl['ys'][1] + 4:
                continue
            z = hill_z(xx, y, arl)
            r = rng.uniform(3.0, 5.6)
            if rng.random() < 0.22:
                h = r * 3.2
                res = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r * 0.85, radius2=0.0,
                                            depth=h, matrix=Matrix.Translation((xx, y, z + h / 2 - 1)))
                mi = 4
            else:
                M = Matrix.Translation((xx, y, z + r * 0.55)) @ Matrix.Diagonal((1, 1, 0.9, 1))
                res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r, matrix=M)
                mi = rng.randrange(4)
            for f in {f for v in res['verts'] for f in v.link_faces}:
                f.material_index = mi
        x += 6.0
    ob = mesh_obj('SlopeTrees', bm, greens + [pine])
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def magnolias():
    """One row along the curb, 50 ft apart at x = 6 + 50n ft (backdrop.js), crowns sized from its px."""
    yb = depth_for_px(44)
    trunk, dark, mid = mat('bark', '#4E3A28'), mat('magnolia', '#1F3A26'), mat('magnolia_hi', '#2F5233')
    bm = bmesh.new()
    sxm = lambda px: px / PXM          # horizontal px -> m
    szm = lambda px: px / (PXM * CT)   # vertical px -> m (same depth)
    for n in range(-12, 50):
        x = (6 + 50 * n) * FT
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=sxm(3), radius2=sxm(2.5), depth=szm(34),
                                  matrix=Matrix.Translation((x, yb, szm(17))))
        for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = 0
        M = Matrix.Translation((x, yb, szm(46))) @ Matrix.Diagonal((sxm(19), sxm(17), szm(27), 1))
        r = bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0, matrix=M)
        for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = 1
        M = Matrix.Translation((x - sxm(4), yb - sxm(6), szm(52))) @ Matrix.Diagonal((sxm(13), sxm(12), szm(18), 1))
        r = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0, matrix=M)
        for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = 2
    ob = mesh_obj('Magnolias', bm, [trunk, dark, mid])
    for p in ob.data.polygons:
        p.use_smooth = True


def lamps():
    """Five-globe lamp posts every 100 ft, 12 ft south of every other magnolia (backdrop.js)."""
    yb = depth_for_px(50)
    szm = lambda px: px / (PXM * CT)
    bm = bmesh.new()
    gm = []
    for n in range(-12, 50):
        if n % 2 == 0:
            continue
        x = (6 + 50 * n + 12) * FT
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.35, radius2=0.35, depth=szm(92),
                                  matrix=Matrix.Translation((x, yb, szm(46))))
        for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = 0
        for dx, dy in ((0, 98), (-16, 84), (16, 84), (-9, 76), (9, 76)):
            r = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.9,
                                           matrix=Matrix.Translation((x + dx / PXM, yb, szm(dy))))
            for f in {f for v in r['verts'] for f in v.link_faces}: f.material_index = 1
    mesh_obj('LampPosts', bm, [mat('iron', '#1F2A24'), mat('globe', '#F6F3EC', 0.5)])


def lights():
    sc = bpy.context.scene
    w = bpy.data.worlds.new('guide_world')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (*lin('#C9D6E0'), 1)
    bg.inputs[1].default_value = 0.9
    # afternoon sun from behind the painter (west), a little from the south, fairly high
    sd = bpy.data.lights.new('Sun', 'SUN')
    sd.energy = 3.2
    sd.angle = math.radians(6)
    sd.color = lin('#FFF4E2')
    so = bpy.data.objects.new('Sun', sd)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(52), 0, math.radians(-28))


def camera(focus_x_m):
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('GuideCam')
    cd.type = 'ORTHO'
    cd.ortho_scale = ORTHO
    cd.sensor_fit = 'HORIZONTAL'
    cd.clip_start = 1.0
    cd.clip_end = 4000.0
    cam = bpy.data.objects.new('GuideCam', cd)
    sc.collection.objects.link(cam)
    f = Vector((0, CT, -ST))
    u = Vector((0, ST, CT))
    P = Vector((focus_x_m, 0, 0))
    cam.location = P + u * ((BASE - BH / 2) / PXM) - f * 1500
    cam.rotation_euler = (math.radians(90 - TILT), 0, 0)
    sc.camera = cam
    return cam


def setup_render():
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    try:
        sc.eevee.taa_render_samples = 32
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = BW, BH, 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    try:
        sc.view_settings.view_transform = 'Standard'
        sc.view_settings.look = 'None'
    except Exception:
        pass


def px(cam, p):
    sc = bpy.context.scene
    c = world_to_camera_view(sc, cam, Vector(p))
    return c.x * BW, (1 - c.y) * BH


def main():
    o = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sl = slots()
    info = import_row(sl)
    ground(sl, info['arlington'])
    hill(info['arlington'])
    trees(info['arlington'], info)
    magnolias()
    lamps()
    lights()
    setup_render()
    os.makedirs(o['out'], exist_ok=True)
    for n, f, g in ROW:
        x0, x1 = sl[n]
        w = info[n]['wall_ft']
        print('@@SLOT %-10s slot %6.1f-%6.1f ft (%3d ft)  glb wall %s' % (
            n, x0, x1, f, ('%.0f ft (%+.0f)' % (w, w - f)) if w else 'n/a (rotated 45 deg)'))
    stretches = ['north', 'middle', 'south'] if o['stretch'] == 'all' else [o['stretch']]
    for s in stretches:
        x0, x1 = sl[FOCUS[s]]
        cam = camera((x0 + x1) / 2 * FT)
        bpy.context.view_layer.update()
        sx, sy = px(cam, ((x0 + x1) / 2 * FT, 0, 0))
        print('@@FRAME %s focus %s centre (%.1f, %.1f) px' % (s, FOCUS[s], sx, sy))
        for n, f, g in ROW:
            ob = info[n]['obj']
            bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
            xs = [px(cam, p)[0] for p in bb]
            top = min(px(cam, p)[1] for p in bb)
            a, b = sl[n]
            print('@@BLD %s %-10s slot x %7.1f-%7.1f px, bbox x %7.1f-%7.1f, top y %6.1f' % (
                s, n, a * SX + 1250 - (x0 + x1) / 2 * SX, b * SX + 1250 - (x0 + x1) / 2 * SX,
                min(xs), max(xs), top))
        bpy.context.scene.render.filepath = os.path.join(o['out'], 'guide-%s.png' % s)
        bpy.ops.render.render(write_still=True)
        print('@@FILE', bpy.context.scene.render.filepath)
        bpy.data.objects.remove(cam)
    if o['blend']:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(GAME, 'art-src', 'blender', 'row_guide.blend'))


main()
