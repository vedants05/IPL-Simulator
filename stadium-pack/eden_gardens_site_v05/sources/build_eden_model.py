"""Eden Gardens v0.1 metric review model. Python + numpy + Pillow only.
Not a survey; uses the conversation's explicit provisional dimensions.
Run: python build_eden_model.py
"""
from pathlib import Path
import math, json, struct, zipfile, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
PARAMS=ROOT/'eden_gardens_planning'/'blockout_parameters.json'
if not PARAMS.exists(): PARAMS=ROOT/'blockout_parameters.json'
P=json.loads(PARAMS.read_text())
OUT=ROOT/'eden_gardens_model_v01'; OUT.mkdir(exist_ok=True)
materials=[]; meshes=[]
def mat(name,color,metal=0,rough=.75,emission=None):
    m={'name':name,'pbrMetallicRoughness':{'baseColorFactor':[*color,1],'metallicFactor':metal,'roughnessFactor':rough},'doubleSided':True}
    if emission:m['emissiveFactor']=emission
    materials.append(m);return len(materials)-1
CON=mat('Warm concrete',(.66,.64,.58))
CREAM=mat('Cream seating placeholder',(.78,.79,.69))
AQUA=mat('Aqua seating placeholder',(.35,.66,.64))
GREY=mat('Roof silver',(.65,.71,.73),.45,.5)
STEEL=mat('White structural steel',(.81,.82,.79),.4,.45)
DARK=mat('Dark structure',(.14,.18,.19),.4,.65)
GLASS=mat('Dark glazing placeholder',(.055,.12,.16),.3,.3)
RED=mat('Tower red and scoreboard roof',(.57,.095,.075),.15,.5)
BLACK=mat('Black sight screen',(.035,.04,.045))
AD=mat('Blank advertising slot',(.78,.80,.77))
GRASS=mat('Outfield grass',(.21,.38,.115))
GRASS2=mat('Outfield alternate cut',(.25,.43,.135))
PITCH=mat('Pitch clay',(.60,.51,.31))
CHSEAT=mat('Club House seat yellow',(.79,.60,.16))
LAMP=mat('Floodlight lens',(.91,.96,1),.15,.2, (.65,.72,.8))
ASPHALT=mat('Basic site pad',(.29,.32,.32))

class Mesh:
    def __init__(self,name,material,group):
        self.name=name;self.mat=material;self.group=group;self.verts=[];self.faces=[];meshes.append(self)
    def poly(self,pts):
        offset=len(self.verts);self.verts.extend([list(p) for p in pts])
        for i in range(1,len(pts)-1):self.faces.append((offset,offset+i,offset+i+1))
    def box(self,c,size):
        x,y,z=c;a,b,h=np.array(size)/2
        v=[(x-a,y-b,z-h),(x+a,y-b,z-h),(x+a,y+b,z-h),(x-a,y+b,z-h),
           (x-a,y-b,z+h),(x+a,y-b,z+h),(x+a,y+b,z+h),(x-a,y+b,z+h)]
        for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:self.poly([v[i] for i in f])
    def beam(self,a,b,r=.12,n=6):
        a=np.array(a,float);b=np.array(b,float);direction=b-a;l=np.linalg.norm(direction)
        if l<1e-6:return
        direction/=l;seed=np.array([0,0,1.]) if abs(direction[2])<.9 else np.array([1.,0,0])
        u=np.cross(direction,seed);u/=np.linalg.norm(u);v=np.cross(direction,u)
        av=[a+r*(u*math.cos(i*2*math.pi/n)+v*math.sin(i*2*math.pi/n)) for i in range(n)]
        bv=[p+b-a for p in av]
        self.poly(av[::-1]);self.poly(bv)
        for i in range(n):j=(i+1)%n;self.poly([av[i],av[j],bv[j],bv[i]])

def front(t):return 1/math.sqrt((math.sin(t)/76)**2+(math.cos(t)/82)**2)
def xy(t,r,z):return (r*math.sin(t),r*math.cos(t),z)
def ellipse(a,b,z,n=128):return [(a*math.sin(t),b*math.cos(t),z) for t in np.linspace(0,2*math.pi,n,endpoint=False)]
def annulus(mesh,r0,r1,z0,z1,t0,t1,n=36):
    ts=np.linspace(math.radians(t0),math.radians(t1),n+1)
    for a,b in zip(ts[:-1],ts[1:]):mesh.poly([xy(a,r0,z0),xy(b,r0,z0),xy(b,r1,z1),xy(a,r1,z1)])

# Small irregularity is explicit and controllable. No fabricated micro-detail.
site=Mesh('Site_pad_basic',ASPHALT,'Context');site.poly(ellipse(146,146,-.30)[::-1])
field=Mesh('Outfield',GRASS,'Field');field.poly(ellipse(74,80,0)[::-1])
stripes=Mesh('Mowing_bands',GRASS2,'Field')
for y0 in np.arange(-80,80,12):
    ys=np.linspace(y0,min(y0+6,80),6);xs=74*np.sqrt(np.maximum(0,1-(ys/80)**2))
    stripes.poly([(x,y,.008) for x,y in zip(xs,ys)]+[(-x,y,.008) for x,y in zip(xs[::-1],ys[::-1])])
sq=Mesh('Prepared_square',PITCH,'Field');sq.box((0,0,.015),(24,28,.02))
for i,x in enumerate(np.arange(-9,10,3.1)):
    m=Mesh(f'Pitch_strip_{i:02d}',PITCH if i%2 else CREAM,'Field');m.box((x,0,.032),(2.9,24,.012))
match=Mesh('Regulation_pitch_20_1168m',PITCH,'Field');match.box((0,0,.050),(3.048,20.1168,.01))
marks=Mesh('Pitch_markings',STEEL,'Field')
for y in [-10.0584,10.0584]:
    marks.box((0,y,.066),(2.64,.06,.014));marks.box((0,y-math.copysign(1.2192,y),.066),(3.66,.06,.014))
rope=Mesh('Boundary_rope',STEEL,'Field');rp=ellipse(68,74,.09,160)
for i,a in enumerate(rp):rope.beam(a,rp[(i+1)%len(rp)],.065,5)
ads=Mesh('Blank_boundary_boards',AD,'Field')
for i in range(128):
    a=i*2*math.pi/128;b=(i+1)*2*math.pi/128-.006
    ads.poly([(73*math.sin(a),79*math.cos(a),.15),(73*math.sin(b),79*math.cos(b),.15),(73*math.sin(b),79*math.cos(b),1.05),(73*math.sin(a),79*math.cos(a),1.05)])

# Terraces: named independent block meshes with connected BC and KL structural families.
for s in P['sectors']:
    name=s['id']; t0=s['angle_start_deg'];t1=s['angle_end_deg'];rear=s['rear_radius_m']
    group='Stand_'+name
    concrete=Mesh(name+'_terrace_risers',CON,group); cream=Mesh(name+'_cream_row_bands',CREAM,group);aqua=Mesh(name+'_aqua_row_bands',AQUA,group)
    wall=Mesh(name+'_shell',CON,group);rail=Mesh(name+'_railings_basic',STEEL,group);dark=Mesh(name+'_gallery_shadow',GLASS,group)
    ts=np.linspace(math.radians(t0),math.radians(t1),max(8,round((t1-t0)/1.8))+1)
    if name in 'BC': profile=P['profile_families']['BC']
    elif name in 'KL':profile=P['profile_families']['KL']
    else:profile=P['profile_families']['FGH_D']
    single=name in ['E','J']
    totalrun=rear-front((ts[0]+ts[-1])/2)-1
    if single:
        segments=[(0,totalrun,1.2,s['top_seating_z_m'])]
    else:
        ref_total=profile['upper_start_offset_m']+profile['upper_run_m'];scale=min(1,totalrun/ref_total)
        segments=[(0,profile['lower_run_m']*scale,1.2,1.2+profile['lower_rise_m']),
                  (profile['upper_start_offset_m']*scale,totalrun,profile['upper_start_z_m'],s['top_seating_z_m'])]
    for tier,(off0,off1,z0,z1) in enumerate(segments):
        rows=max(3,round((off1-off0)/.83))
        for k in range(rows):
            d0=off0+(off1-off0)*k/rows;d1=off0+(off1-off0)*(k+1)/rows
            za=z0+(z1-z0)*k/rows;zb=z0+(z1-z0)*(k+1)/rows
            for j,(a,b) in enumerate(zip(ts[:-1],ts[1:])):
                ra=front(a);rb=front(b)
                # Aisle bands are visual substitutes; no tiny seat geometry in blockout.
                m=concrete if j%7==0 else aqua if (j//7+ (1 if name in 'KL' else 0))%3!=0 else cream
                m.poly([xy(a,ra+d0,za),xy(b,rb+d0,za),xy(b,rb+d0,zb),xy(a,ra+d0,zb)])
                m.poly([xy(a,ra+d0,zb),xy(b,rb+d0,zb),xy(b,rb+d1,zb),xy(a,ra+d1,zb)])
        # Wall at rear and triangular end returns.
        for a,b in zip(ts[:-1],ts[1:]):
            wall.poly([xy(a,front(a)+off1,0),xy(b,front(b)+off1,0),xy(b,front(b)+off1,z1),xy(a,front(a)+off1,z1)])
        for a in [ts[0],ts[-1]]:
            wall.poly([xy(a,front(a)+off0,0),xy(a,front(a)+off1,0),xy(a,front(a)+off1,z1),xy(a,front(a)+off0,z0)])
        # Front tier railing and posts spaced at bays.
        for a,b in zip(ts[:-1],ts[1:]):
            rail.beam(xy(a,front(a)+off0,z0+1.1),xy(b,front(b)+off0,z0+1.1),.05,4)
        for a in ts[::4]:rail.beam(xy(a,front(a)+off0,z0),xy(a,front(a)+off0,z0+1.1),.065,4)
    if not single:
        # Gallery facade at the upper tier front, deliberately blank behind glazing.
        off=segments[1][0];z=segments[1][2]
        for a,b in zip(ts[:-1],ts[1:]):dark.poly([xy(a,front(a)+off,z-3.2),xy(b,front(b)+off,z-3.2),xy(b,front(b)+off,z-.3),xy(a,front(a)+off,z-.3)])
        posts=Mesh(name+'_gallery_columns',CON,group)
        for a in ts[::4]:posts.beam(xy(a,front(a)+off,z-3.2),xy(a,front(a)+off,z),.25,4)
    # Four dark rectangular access substitutes per large sector (not actual interiors).
    tunnels=Mesh(name+'_tunnel_openings',BLACK,group)
    for a in ts[4:-3:12]:
        r=front(a)+3;mid=np.array(xy(a,r,2.0)); tangent=np.array([math.cos(a),-math.sin(a),0.])
        tunnels.poly([mid-tangent*1.3,mid+tangent*1.3,mid+tangent*1.3+[0,0,3],mid-tangent*1.3+[0,0,3]])

# Roofs continuous across each paired stand; adjustable doubly-curved canopy.
for group,t0,t1,rout,zlo,zhi in [('BC',90,162,134,33,35),('KL',-162,-100,132,32,34)]:
    roof=Mesh(group+'_curved_canopy',GREY,'Roof_'+group);supports=Mesh(group+'_roof_supports',DARK,'Roof_'+group);outer=Mesh(group+'_exterior_bracing',STEEL,'Roof_'+group)
    ts=np.linspace(math.radians(t0),math.radians(t1),49)
    def roofpoint(a,u):
        ri=front(a)+21;r=ri+(rout-ri)*u
        crown=1.8*math.sin((a-ts[0])/(ts[-1]-ts[0])*math.pi)
        return xy(a,r,zlo+(zhi-zlo)*u+crown+1.0*math.sin(u*math.pi))
    for a,b in zip(ts[:-1],ts[1:]):
        for u,v in zip(np.linspace(0,1,9)[:-1],np.linspace(0,1,9)[1:]):roof.poly([roofpoint(a,u),roofpoint(b,u),roofpoint(b,v),roofpoint(a,v)])
        for u in [0,1]:
            p0=np.array(roofpoint(a,u));p1=np.array(roofpoint(b,u));roof.poly([p0,p1,p1-[0,0,1.25],p0-[0,0,1.25]])
    for a in ts[::4]:
        pos=roofpoint(a,.62);r=front(a)+21+(rout-front(a)-21)*.62
        supports.beam(xy(a,r,20),pos,.23)
        supports.beam(xy(a,r,27),roofpoint(a,.37),.14)
        supports.beam(xy(a,r,27),roofpoint(a,.86),.14)
    for a,b in zip(ts[::4][:-1],ts[::4][1:]):
        outer.beam(xy(a,rout-2,3),xy(b,rout-2,28),.35)
        outer.beam(xy(b,rout-2,3),xy(a,rout-2,28),.35)
        outer.beam(xy(a,rout-2,3),xy(a,rout-2,30),.25)

# Club House: smaller five-peak pavilion with independently editable facade bands.
ch=Mesh('ClubHouse_shell',CON,'ClubHouse');ch.box((0,-103,5.5),(56,18,11))
ch.box((0,-111.6,15.5),(56,.8,9))
for x in [-27.5,27.5]:ch.box((x,-103,15.5),(1,18,9))
glass=Mesh('ClubHouse_windows',GLASS,'ClubHouse');trim=Mesh('ClubHouse_trim',STEEL,'ClubHouse')
for z in [4.2,9,20.4]:
    glass.box((0,-93.7,z),(53,.3,2.9))
    for x in np.arange(-26,27,4):trim.box((x,-93.3,z),(.18,.22,3))
for z in [2.4,6.1,11,18.6,22.3]:trim.box((0,-93.3,z),(56,.7,.4))
chs=Mesh('ClubHouse_seating_bands',CHSEAT,'ClubHouse')
for tier,(y,z,rows,step,raiseby) in enumerate([(-82,1.5,12,.82,.36),(-94,11.4,15,.74,.4)]):
    for k in range(rows):chs.box((0,y-k*step,z+k*raiseby),(52,step,.3))
chr=Mesh('ClubHouse_peaked_roof',GREY,'ClubHouse')
for i,x in enumerate([-22,-11,0,11,22]):
    z=28 if i==2 else 26.5
    base=[(x-5.6,-92,23),(x+5.6,-92,23),(x+5.6,-113,23),(x-5.6,-113,23)]
    peak=(x,-104,z)
    for k in range(4):chr.poly([base[k],base[(k+1)%4],peak])
clock=Mesh('ClubHouse_clock_placeholder',STEEL,'ClubHouse');clock.box((0,-93,9),(3,.7,3))

# Basic screens; keep named ad slots independent from structural frame.
for s in P['screens']:
    name=s['id'];x,y=s['xy_m'];w=s['width_m'];h=s['top_z_m']-s['base_z_m'];z=s['base_z_m']+h/2
    group='Screen_'+name
    frame=Mesh(name+'_frame',CON,group)
    if name.startswith('sight'):
        frame.mat=BLACK;frame.box((x,y,z),(w,1,h));continue
    display=Mesh(name+'_display',BLACK,group)
    if name=='video_E':
        for offset in [-w/2+.6,w/2-.6]:frame.box((x+offset,y,z),(1.2,4,h))
        frame.box((x,y,z+h/2-.7),(w,4,1.4))
        scaffold=Mesh('E_screen_exposed_support_grid',DARK,group)
        for offset in np.linspace(-w/2+1,w/2-1,7):scaffold.box((x+offset,y,z),(.13,.3,h-2))
        for height in np.linspace(s['base_z_m']+1,s['top_z_m']-1,7):scaffold.box((x,y,height),(w-2,.3,.13))
        pw,ph=s['active_panel_wh_m'];pz=s['base_z_m']+1.5+ph/2
        display.box((x,y-2.06,pz),(pw,.2,ph));ad=Mesh('E_screen_blank_ad_border',AD,group)
        for dz in [-ph/2-.45,ph/2+.45]:ad.box((x,y-2.25,pz+dz),(pw+1.8,.2,.9))
        for dx in [-pw/2-.45,pw/2+.45]:ad.box((x+dx,y-2.25,pz),(.9,.2,ph))
    else:
        frame.box((x,y,z),(w,4,h))
        display.box((x,y-2.06,z),(w-2,.2,h-3))
        grid=Mesh('Traditional_scoreboard_grid',DARK,group)
        for off in np.linspace(-w/2+1,w/2-1,9):grid.box((x+off,y-2.23,z),(.09,.15,h-3))
        for off in np.linspace(-h/2+1,h/2-2,9):grid.box((x,y-2.23,z+off),(w-2,.15,.08))
        hat=Mesh('Traditional_scoreboard_red_hip_roof',RED,group)
        hat.poly([(x-w/2-1,y-3,z+h/2),(x+w/2+1,y-3,z+h/2),(x+3,y,z+h/2+2),(x-3,y,z+h/2+2)])
        hat.poly([(x-w/2-1,y+3,z+h/2),(x+w/2+1,y+3,z+h/2),(x+3,y,z+h/2+2),(x-3,y,z+h/2+2)])
        hat.poly([(x-w/2-1,y-3,z+h/2),(x-w/2-1,y+3,z+h/2),(x-3,y,z+h/2+2)])
        hat.poly([(x+w/2+1,y-3,z+h/2),(x+w/2+1,y+3,z+h/2),(x+3,y,z+h/2+2)])
        clk=Mesh('Scoreboard_clock_face',STEEL,group);clk.box((x,y-3.1,z+h/2+.4),(1.8,.15,1.8))

# Four tapered lattice masts; base and invisible engineering intentionally simplified.
for tower in P['towers']:
    name=tower['id'];x,y=tower['xy_m'];group='Floodlight_'+name
    red=Mesh(name+'_red_lattice',RED,group);white=Mesh(name+'_white_lattice',STEEL,group);base=Mesh(name+'_foundation',CON,group)
    base.box((x,y,.45),(9,9,.9))
    def corners(z):
        half=3.7-2.2*min(z,60)/60
        return [(x-half,y-half,z),(x+half,y-half,z),(x+half,y+half,z),(x-half,y+half,z)]
    for i in range(12):
        z0=1+i*4.9;z1=z0+4.9;c0=corners(z0);c1=corners(z1);m=red if i%4<2 else white
        for k in range(4):
            k1=(k+1)%4;m.beam(c0[k],c1[k],.18);m.beam(c1[k],c1[k1],.11);m.beam(c0[k],c1[k1],.085)
    # Lamp plane faces the field. Head pitched very slightly toward playing area.
    normal=np.array([-x,-y,0.]);normal/=np.linalg.norm(normal);right=np.cross(normal,[0,0,1.]);up=np.array([0,0,1.])
    centre=np.array([x,y,67.5])+normal*1.4
    back=Mesh(name+'_lamp_cage',DARK,group);lenses=Mesh(name+'_lamp_lenses',LAMP,group)
    def pt(u,v,depth=0):return centre+right*u+up*v+normal*(depth-.14*v)
    for u in np.linspace(-6,6,9):back.beam(pt(u,-7),pt(u,7),.12)
    for v in np.linspace(-7,7,11):back.beam(pt(-6,v),pt(6,v),.12)
    for u in [-6,6]:
        back.beam(pt(u,-7),pt(u,7,-3),.15);back.beam(pt(u,-7,-3),pt(u,7,-3),.15)
    for v in [-7,0,7]:
        back.beam(pt(-6,v,-3),pt(6,v,-3),.15)
        for u in [-6,0,6]:back.beam(pt(u,v),pt(u,v,-3),.12)
    for u in np.linspace(-5.5,5.5,10):
        for v in np.linspace(-6.5,6.5,12):
            c=pt(u,v,.12);radius=.28
            lenses.poly([c+right*math.cos(a)*radius+up*math.sin(a)*radius for a in np.linspace(0,2*math.pi,7,endpoint=False)])

# Simple optional player shelters, not inferred furnished rooms.
shelters=Mesh('Optional_player_shelters',CON,'OptionalProps')
for x in [-31,31]:
    shelters.box((x,-78,1),(10,4,2));shelters.box((x,-78,2.2),(11,5,.3))
    Mesh('Shelter_dark_opening_'+str(x),GLASS,'OptionalProps').box((x,-75.9,1.1),(9,.12,1.5))

# GLB writer: separate groups and meshes, metre scale; rotate Blender Z-up to glTF Y-up.
blob=bytearray();views=[];accessors=[];gmeshes=[]
def buffer(data,target,component,typ,minmax=False):
    global blob
    while len(blob)%4:blob.append(0)
    offset=len(blob);raw=data.tobytes();blob.extend(raw)
    vi=len(views);views.append({'buffer':0,'byteOffset':offset,'byteLength':len(raw),'target':target})
    a={'bufferView':vi,'componentType':component,'count':len(data),'type':typ}
    if minmax:a.update(min=data.min(axis=0).tolist(),max=data.max(axis=0).tolist())
    accessors.append(a);return len(accessors)-1
stats=[]
for mesh in meshes:
    if not mesh.faces:continue
    v=np.array(mesh.verts,dtype=np.float32);f=np.array(mesh.faces,dtype=np.uint32)
    tri=v[f];norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);ln=np.linalg.norm(norm,axis=1)
    valid=ln>1e-7;tri=tri[valid];norm=norm[valid]/ln[valid,None]
    # flat normals retain terrace edges; double-sided for concept shell review.
    pos=tri.reshape(-1,3);n=np.repeat(norm,3,axis=0)
    pos=pos[:,[0,2,1]];pos[:,2]*=-1;n=n[:,[0,2,1]];n[:,2]*=-1
    pi=buffer(pos.astype('<f4'),34962,5126,'VEC3',True);ni=buffer(n.astype('<f4'),34962,5126,'VEC3')
    gmeshes.append({'name':mesh.name,'primitives':[{'attributes':{'POSITION':pi,'NORMAL':ni},'material':mesh.mat,'mode':4}], 'extras':{'stage':'blockout','source_group':mesh.group}})
    stats.append({'name':mesh.name,'group':mesh.group,'triangles':len(tri)})
nodes=[{'name':'Eden_Gardens_v01_BLOCKOUT','children':[],'extras':{'units':'metres','accuracy':'provisional; not photo-fitted','north':'unresolved','stage':'Review geometry before detailed modelling'}}]
group_indices={}
for i,m in enumerate(gmeshes):
    group=m['extras']['source_group']
    if group not in group_indices:
        gi=len(nodes);group_indices[group]=gi;nodes.append({'name':group,'children':[]});nodes[0]['children'].append(gi)
    ix=len(nodes);nodes.append({'name':m['name'],'mesh':i});nodes[group_indices[group]]['children'].append(ix)
doc={'asset':{'version':'2.0','generator':'Eden procedural metric blockout v0.1'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':nodes,'meshes':gmeshes,'materials':materials,'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':accessors}
js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);blob+=b'\0'*((-len(blob))%4)
glb=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(blob),0x004e4942)+blob
(OUT/'eden_gardens_blockout.glb').write_bytes(glb)
(OUT/'geometry_report.json').write_text(json.dumps({'stage':'v0.1 blockout','triangles':sum(s['triangles'] for s in stats),'mesh_count':len(stats),'glb_bytes':len(glb),'meshes':stats,'not_yet_included':['individual seats/GPU seat instancing','four production LODs','Meshopt/KTX2 compression','high-resolution PBR textures','photo-matched cameras','verified as-built dimensions']},indent=2))
shutil.copy2(PARAMS,OUT/'blockout_parameters.json')

# Deterministic CPU preview renderer: no generated imagery and no dependency on GPU availability.
V=[];F=[];C=[]
for m in meshes:
    if not m.faces:continue
    off=len(V);V.extend(m.verts);F.extend([(a+off,b+off,c+off) for a,b,c in m.faces]);C.extend([m.mat]*len(m.faces))
V=np.array(V,float);F=np.array(F,int);C=np.array(C,int)
def render(name,eye,target,ortho=None,w=1440,h=1000):
    eye=np.array(eye,float);target=np.array(target,float)
    forward=target-eye;forward/=np.linalg.norm(forward)
    up=np.array([0.,0,1.]) if abs(forward[2])<.99 else np.array([0.,1,0.])
    right=np.cross(forward,up);right/=np.linalg.norm(right);up=np.cross(right,forward)
    v=V-eye;cx=v@right;cy=v@up;cz=v@forward
    if ortho:sx=w/2+cx*w/ortho;sy=h/2-cy*w/ortho
    else:
        foc=w/(2*math.tan(math.radians(55)/2));sx=w/2+cx*foc/np.maximum(cz,.01);sy=h/2-cy*foc/np.maximum(cz,.01)
    pixels=np.zeros((h,w,3),dtype=np.uint8);pixels[:]=[224,233,237]
    depth=np.full((h,w),np.inf,dtype=np.float32)
    light=np.array([-.45,-.6,1]);light/=np.linalg.norm(light)
    palette=np.array([m['pbrMetallicRoughness']['baseColorFactor'][:3] for m in materials])
    tri=V[F];norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);norm/=np.maximum(1e-9,np.linalg.norm(norm,axis=1))[:,None]
    # Two-sided concept shading; sRGB-like conversion for neutral readable previews.
    intensity=.48+.52*np.abs(norm@light)
    cols=np.clip((palette[C]*intensity[:,None])**(1/1.7)*255,0,255).astype(np.uint8)
    for i,(a,b,c) in enumerate(F):
        if min(cz[a],cz[b],cz[c])<=.2:
            # Clip against the near plane instead of discarding large field faces.
            polygon=[np.array([cx[j],cy[j],cz[j]]) for j in (a,b,c)]
            clipped=[]
            for p,q in zip(polygon,polygon[1:]+polygon[:1]):
                pin=p[2]>=.2;qin=q[2]>=.2
                if pin:clipped.append(p)
                if pin!=qin:clipped.append(p+(q-p)*((.2-p[2])/(q[2]-p[2])))
            projected=[]
            for j in range(1,len(clipped)-1):
                pts=np.array([clipped[0],clipped[j],clipped[j+1]])
                projected.append((w/2+pts[:,0]*foc/pts[:,2],h/2-pts[:,1]*foc/pts[:,2],pts[:,2]))
        else:
            projected=[(np.array([sx[a],sx[b],sx[c]]),np.array([sy[a],sy[b],sy[c]]),np.array([cz[a],cz[b],cz[c]]))]
        for xs,ys,zs in projected:
            x0=max(0,int(math.floor(min(xs))));x1=min(w-1,int(math.ceil(max(xs))));y0=max(0,int(math.floor(min(ys))));y1=min(h-1,int(math.ceil(max(ys))))
            if x0>x1 or y0>y1:continue
            den=(ys[1]-ys[2])*(xs[0]-xs[2])+(xs[2]-xs[1])*(ys[0]-ys[2])
            if abs(den)<.01:continue
            xx,yy=np.meshgrid(np.arange(x0,x1+1)+.5,np.arange(y0,y1+1)+.5)
            aa=((ys[1]-ys[2])*(xx-xs[2])+(xs[2]-xs[1])*(yy-ys[2]))/den
            bb=((ys[2]-ys[0])*(xx-xs[2])+(xs[0]-xs[2])*(yy-ys[2]))/den;cc=1-aa-bb
            zz=aa*zs[0]+bb*zs[1]+cc*zs[2] if ortho else 1/(aa/zs[0]+bb/zs[1]+cc/zs[2])
            dst=depth[y0:y1+1,x0:x1+1];mask=(aa>=0)&(bb>=0)&(cc>=0)&(zz<dst)
            dst[mask]=zz[mask];pixels[y0:y1+1,x0:x1+1][mask]=cols[i]
    img=Image.fromarray(pixels);d=ImageDraw.Draw(img)
    try:font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
    except OSError:font=ImageFont.load_default()
    d.rectangle((0,0,w,64),fill='#192d3a');d.text((25,18),'EDEN GARDENS  /  v0.1 GEOMETRY REVIEW  /  '+name.upper(),font=font,fill='white')
    d.rectangle((0,h-38,w,h),fill='#192d3a');d.text((20,h-28),'Provisional dimensions | seating bands are placeholders | no high-detail materials yet',fill='white')
    img.save(OUT/(name+'.png'))
    print('Rendered',name,flush=True)
render('aerial_pavilion',(230,-300,235),(0,0,13))
render('aerial_opposite',(-230,270,210),(0,0,12))
render('club_house_view',(0,52,11),(0,-99,15))
render('opposite_end_view',(0,-65,13),(0,100,18))
render('top_down',(0,0,350),(0,0,0),ortho=520)
print(json.dumps({'output':str(OUT),'triangles':sum(s['triangles'] for s in stats),'mesh_count':len(stats),'bytes':len(glb)},indent=2))
