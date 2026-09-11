"""Focused v04: photographed pavilion rear, adjacent road, perimeter walls/gates."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
source=(ROOT/'build_eden_exterior.py').read_text()
prefix,export=source.split('# Export unindexed GLB in metres, same origin as the detailed stadium.')
ns={'__file__':str(ROOT/'build_eden_exterior.py')}
exec(compile(prefix,'build_eden_exterior.py','exec'),ns)
globals().update({k:v for k,v in ns.items() if not k.startswith('__')})
OUT=ROOT/'eden_gardens_frontage_v04';OUT.mkdir(exist_ok=True)
# Retain only the photographed roofed facade families. Other edges stay behind walls.
meshes[:]=[m for m in meshes if m.group in ['Exterior_BC','Exterior_KL']]
BLUE=mat('Pavilion blue glazing',(.24,.48,.62),.32,.24)
BLUE2=mat('Pavilion blue glazing variation',(.29,.53,.66),.3,.26)
FRAME=mat('Pavilion metal mullions',(.39,.43,.43),.48,.4)
WALL=mat('Boundary painted masonry',(.80,.78,.68))
MURAL=mat('Blank pavilion display panels',(.64,.68,.65))
CAP=mat('Boundary coping',(.48,.47,.42))
GATE=mat('Gate light painted steel',(.73,.77,.75),.35,.6)
def panel(m,x0,x1,z0,z1,y):m.poly([(x0,y,z0),(x1,y,z0),(x1,y,z1),(x0,y,z1)])
def fy(x):return -115.2-1.6*(1-(x/28)**2)
group='Exterior_ClubHouse'
frame=M('Pavilion_major_frame',FRAME,group);columns=M('Pavilion_ground_columns',CON,group)
gl=[M('Pavilion_upper_blue_glass',BLUE,group),M('Pavilion_upper_blue_glass_variation',BLUE2,group)]
blank=M('Pavilion_blank_mural_panels',MURAL,group);recess=M('Pavilion_recessed_ground_glazing',GLASS,group)
slab=M('Pavilion_floor_bands',CON,group);fine=M('Pavilion_glass_mullions',FRAME,group)
xs=np.linspace(-28,28,11)
for i,(a,b) in enumerate(zip(xs[:-1],xs[1:])):
 y=fy((a+b)/2)
 for z0,z1 in [(15,20.4),(20.7,26.4)]:
  panel(gl[i%2],a+.15,b-.15,z0,z1,y)
  for x in np.linspace(a,b,5)[1:-1]:fine.box((x,y-.08,(z0+z1)/2),(.06,.14,z1-z0))
  fine.box(((a+b)/2,y-.09,(z0+z1)/2),(b-a,.14,.065))
 # Side bays left open at this facade plane, matching the photographed recessed landings.
 if 1<=i<=8:panel(blank,a+.16,b-.16,4.8,14.7,y-.01)
 else:
  for z in [4.7,9.7,14.7]:slab.box(((a+b)/2,y+1,z),(b-a,2.5,.32))
  for z in [5.2,10.2]:
   fine.beam((a+.2,y-.1,z),(b-.2,y-.1,z),.05,5)
   fine.beam((a+.2,y-.1,z+.6),(b-.2,y-.1,z+.6),.04,5)
 panel(recess,a+.25,b-.25,.3,4.25,y+1.5)
 for x in np.linspace(a+.3,b-.3,5):fine.box((x,y+1.4,2.3),(.07,.15,3.8))
 for z in [1.4,2.8,4.2]:fine.box(((a+b)/2,y+1.4,z),(b-a-.5,.15,.07))
 for z in [4.45,14.85,20.55,26.55]:frame.box(((a+b)/2,y-.12,z),(b-a+.1,.34,.28))
for x in xs:
 y=fy(x);frame.box((x,y-.22,15.5),(.27,.46,22.5));columns.box((x,y+.3,2.15),(.5,1,4.3))
sign=M('CAB_sign_fascia',FRAME,group);sign.box((0,-117.15,4.55),(46,.32,.7))
# Doorway frames and low frontage railings; no invented projecting canopy.
rail=M('Pavilion_frontage_railings',GATE,group)
for a,b in [(-28,-3.4),(3.4,28)]:
 for z in [.15,.85,1.25]:rail.beam((a,-122,z),(b,-122,z),.04,5)
 for x in np.arange(a,b,.17):rail.beam((x,-122,.12),(x,-122,1.27),.019,4)
planters=M('Pavilion_front_planters',WALL,group);shrubs=M('Pavilion_front_shrubs',TREE[1],group)
for x in [-24,-18,-12,-6,6,12,18,24]:
 planters.box((x,-120,.3),(2.8,1.2,.6));shrubs.box((x,-120,.95),(2.5,1.0,.9))
for x in [-18,-6,6,18]:
 fine.beam((x,-121,0),(x,-121,2.6),.07,5);frame.box((x,-121,2.65),(.55,.35,.3))
# Extend the pavilion rear to the roadside frontage rather than leaving a broad forecourt.
# Rear depth is provisional; this keeps the glazed elevation and low rail near the road.
for m in meshes:
 if m.group==group:
  for v in m.verts:v[1]-=20
returns=M('Pavilion_side_returns',CON,group);roof=M('Pavilion_rear_roof_extension',ns['GREY'] if 'GREY'in ns else ns['ns']['GREY'],group)
for x in [-28,28]:returns.poly([(x,-113,0),(x,-135.2,0),(x,-135.2,26.7),(x,-113,24)])
for a,b in zip(xs[:-1],xs[1:]):roof.poly([(a,-113,24.2),(b,-113,24.2),(b,fy(b)-20,26.65),(a,fy(a)-20,26.65)])
# A continuous boundary with selected different gate widths, not a ring of identical gates.
# Locations are provisional except the pavilion-front opening evidenced by the images.
R=142.0
gate_specs=[(-179,10,'Pavilion'),(-151,7,'West_pavilion'),(-120,6,'West_roof'),(-83,5,'West'),(-46,8,'Northwest'),(-12,6,'North'),(27,8,'Northeast'),(65,5,'East'),(100,7,'East_roof'),(132,7,'East_pavilion'),(159,5,'Southeast')]
openings=[(math.radians(a),w/R,name) for a,w,name in gate_specs]
def angle_diff(a,b):return (a-b+math.pi)%(2*math.pi)-math.pi
wall=M('Boundary_masonry_panels',WALL,'Exterior_Boundary');coping=M('Boundary_coping',CAP,'Exterior_Boundary');posts=M('Boundary_piers',CON,'Exterior_Boundary');bars=M('Boundary_upper_grilles',GATE,'Exterior_Boundary')
for deg in np.arange(-180,180,.75):
 a,b=np.radians([deg,deg+.75]);mid=(a+b)/2
 if any(abs(angle_diff(mid,g))<width/2+.008 for g,width,name in openings):continue
 # Pavilion roadside uses a lower wall/grille, other boundaries use solid masonry.
 front=abs(angle_diff(mid,math.pi))<math.radians(45)
 h=1.05 if front else 2.35
 for r in [R-.2,R+.2]:wall.poly([xy(a,r,0),xy(b,r,0),xy(b,r,h),xy(a,r,h)])
 coping.poly([xy(a,R-.3,h),xy(b,R-.3,h),xy(b,R+.3,h),xy(a,R+.3,h)])
 if front:
  for t in np.linspace(a,b,8):bars.beam(xy(t,R,h),xy(t,R,2.55),.023,4)
  for z in [h+.1,2,2.55]:bars.beam(xy(a,R,z),xy(b,R,z),.038,4)
for deg in np.arange(-180,180,3):
 a=math.radians(deg)
 if any(abs(angle_diff(a,g))<w/2+.013 for g,w,name in openings):continue
 posts.box(xy(a,R,1.35),(.6,.6,2.7));coping.box(xy(a,R,2.77),(.75,.75,.14))
for angle,width,name in openings:
 m=M('Gate_'+name,GATE,'Exterior_Gates');p=M('Gate_piers_'+name,WALL,'Exterior_Gates');radius=R
 a,b=angle-width/2,angle+width/2
 for t in [a,b]:p.box(xy(t,radius,1.6),(.8,.8,3.2));coping.box(xy(t,radius,3.3),(1.0,1.0,.18))
 # Twin gate leaves with centre seam, rectangular frames and diagonal lower bracing.
 for left,right in [(a,angle-.0015),(angle+.0015,b)]:
  for z in [.18,1.0,2.65]:m.beam(xy(left,radius,z),xy(right,radius,z),.055,5)
  for t in np.linspace(left,right,max(4,int((right-left)*R/.16))):m.beam(xy(t,radius,.18),xy(t,radius,2.65),.025,4)
  m.beam(xy(left,radius,.18),xy(right,radius,1.0),.045,5)
 # Unnumbered blank gate sign plate, not a guessed real gate number.
 plate=M('Gate_sign_'+name,PANEL,'Exterior_Gates');plate.poly([xy(a,radius,2.85),xy(b,radius,2.85),xy(b,radius,3.18),xy(a,radius,3.18)])
# Ground and the mapped road beside the pavilion only. Wider surroundings deferred.
surface(M('Immediate_site_ground',LAND,'Context_Terrain'),Point(0,0).buffer(225),-.65)
surface(M('Stadium_perimeter_pavement',WALK,'Context_Roads'),Point(0,0).buffer(149).difference(Point(0,0).buffer(137)),-.22)
road=M('Pavilion_road_Gostha_Pal_Sarani',ROAD,'Context_Roads');verge=M('Pavilion_road_pavements',WALK,'Context_Roads');dash=M('Pavilion_road_markings',MARK,'Context_Roads')
for id,(pts,t) in ways.items():
 if 'Eden Garden Road' not in t.get('name',''):continue
 line=LineString(pts).intersection(Point(0,0).buffer(225))
 surface(verge,line.buffer(7).difference(Point(0,0).buffer(145)),-.24)
 surface(road,line.buffer(4.5).difference(Point(0,0).buffer(147)),-.17)
 for part in parts(line):
  if not isinstance(part,LineString):continue
  for d in np.arange(0,part.length,12):
   p,q=part.interpolate(d),part.interpolate(min(d+3.5,part.length));surface(dash,LineString([p,q]).buffer(.1).difference(Point(0,0).buffer(147)),-.15)
# Export, then replace the broad-area manifest with the focused scope.
exec(compile(export,'exterior_export','exec'),globals())
report.update(version='v04-frontage',scope='Pavilion exterior, immediate road, perimeter walls and gates; wider context deferred',tree_count=0,extent_east_north_m=[-225,-225,225,225],references=['2c1efaea-880d-4821-bab9-4d102b282b05.png','674ead91-a995-45fa-9d28-ad5d35be8e90.png','eba6ddb0-7d3e-4b09-9011-8e604ea4e2f7.png','db1dcc22-48b1-48ed-b63b-65861a3b9042.png'],gate_count=len(gate_specs),gate_location_status='approximate, no verified gate numbering',river_included=False,mapped_features=[r for r in records if 'Eden Garden Road' in r.get('name','')])
report.pop('river_nearest_distance_from_pitch_m',None)
report['limitations']=['Pavilion geometry follows the three supplied street photos; dimensions are estimated within the existing stadium scale.','Gate locations, widths and unphotographed wall treatments are approximate.','No interior seating corrections in this exterior iteration.','Road bearing uses provisional -12 degree stadium alignment.']
(OUT/'exterior_manifest.json').write_text(json.dumps(report,indent=2))
print('Focused frontage:',len(meshes),'meshes;',report['triangles'],'triangles')
