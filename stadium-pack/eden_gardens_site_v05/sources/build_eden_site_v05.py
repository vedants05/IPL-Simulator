"""Map-aligned roads, northern Maidan, river, stadium boundary and mapped lights."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
stage={'__file__':str(ROOT/'build_eden_frontage.py')}
exec(compile((ROOT/'build_eden_frontage.py').read_text().split('# Export, then replace')[0],'frontage_geometry','exec'),stage)
globals().update({k:v for k,v in stage.items() if not k.startswith('__')})
OUT=ROOT/'eden_gardens_site_v05';OUT.mkdir(exist_ok=True)
meshes[:]=[m for m in meshes if m.group in ['Exterior_BC','Exterior_KL','Exterior_ClubHouse'] and m.name not in ['Pavilion_side_returns','Pavilion_rear_roof_extension']]
# The previous 20m rear extension was compensating for the wrong map bearing.
for m in meshes:
 if m.group=='Exterior_ClubHouse':
  for v in m.verts:v[1]+=20
AZ=math.radians(-30);cs,sn=math.cos(AZ),math.sin(AZ)
def local(e,n,z=0):return (e*cs-n*sn,e*sn+n*cs,z)
# Previous surface/extrude helpers capture a separate execution namespace.
for fn in [surface,extrude]:fn.__globals__['local']=local
root,nodes,ways=readmap(ROOT/'surroundings_map_v05.osm')
extent=box(-1100,-2300,1050,800)
rr,rn,rw=readmap(ROOT/'river_map.osm')
river=unary_union(list(polygonize(unary_union([LineString(p) for p,t in rw.values() if len(p)>2])))).intersection(extent)
surface(M('Mapped_site_terrain',LAND,'Context_Terrain'),extent.difference(river),-.65)
surface(M('Hooghly_River_OSM_shoreline',WATER,'Context_River'),river,-1.1)
surface(M('Hooghly_bank_edge',WALK,'Context_River'),river.boundary.buffer(1.5).intersection(extent),-.5)
mr,mn,mw=readmap(ROOT/'maidan_map.osm')
maidan=unary_union(list(polygonize(unary_union([LineString(p) for p,t in mw.values() if len(p)>2])))).intersection(extent)
if maidan.is_empty:raise RuntimeError('Maidan boundary is empty')
surface(M('Maidan_mapped_park_boundary',PARK,'Context_Maidan'),maidan,-.5)
roadmesh=M('Mapped_public_roads',ROAD,'Context_Roads');paths=M('Mapped_paths_and_services',WALK,'Context_Paths');verge=M('Mapped_road_verges',WALK,'Context_Roads');marks=M('Road_centre_markings',MARK,'Context_Roads')
roadpolys=[];publicpolys=[];green=[];buildingpolys=[];records=[];publiclines=[]
for id,(pts,t) in ways.items():
 if len(pts)<2:continue
 line=LineString(pts)
 if not line.intersects(extent):continue
 if 'highway'in t and t['highway'] not in ['proposed','construction','steps','platform']:
  hw=t['highway'];minor=hw in ['path','footway','pedestrian','track','service','cycleway']
  width={'primary':12,'primary_link':8,'secondary':8,'secondary_link':7,'tertiary':7,'residential':6,'service':3.5,'footway':1.8,'path':1.5,'pedestrian':3,'track':2.5,'cycleway':2}.get(hw,5)
  try:width=float(t['width'].replace(' m',''))
  except (KeyError,ValueError):pass
  width=max(1.3,min(20,width));geom=line.buffer(width/2,cap_style=2,join_style=2).intersection(extent)
  # Real road centerlines are preserved: no circular clipping around the stadium.
  if minor:
   geom=geom.difference(Point(0,0).buffer(84));surface(paths,geom,-.26)
  else:
   surface(roadmesh,geom,-.17);surface(verge,line.buffer(width/2+1.0,cap_style=2,join_style=2).intersection(extent),-.24)
   publicpolys.append(geom);publiclines.append((id,line,width,t.get('name','unnamed road')))
   if width>=7:
    clipped=line.intersection(extent)
    for part in parts(clipped):
     if not isinstance(part,LineString):continue
     for d in np.arange(0,part.length,14):surface(marks,LineString([part.interpolate(d),part.interpolate(min(d+4,part.length))]).buffer(.09),-.155)
  roadpolys.append(geom.buffer(1.5));records.append({'osm_way':id,'type':'road','name':t.get('name',hw),'width_m':width,'width_status':'tagged' if 'width'in t else 'estimated','centerline_status':'mapped without circular exclusion'})
 if len(pts)>3 and pts[0]==pts[-1]:
  p=Polygon(pts).buffer(0).intersection(extent)
  if p.is_empty:continue
  if t.get('leisure') in ['park','garden','pitch'] or t.get('landuse') in ['grass','forest','recreation_ground']:
   p=p.difference(Point(0,0).buffer(146));surface(M('Green_area_'+id,PARK,'Context_Maidan' if p.intersects(maidan) else 'Context_Parks'),p,-.43)
   if t.get('leisure')!='pitch':green.append(p)
  if t.get('natural')=='water':surface(M('Water_'+id,WATER,'Context_Parks'),p,-.4)
  if 'building'in t:
   buildingpolys.append(p)
   # Keep only basic nearby landmark masses; distant urban detailing is not the focus.
   if p.distance(Point(0,0))<500 and not p.intersects(Point(0,0).buffer(145)):
    name=t.get('name','Building_'+id)
    try:h=float(t.get('height','').replace(' m',''))
    except ValueError:
     try:h=float(t.get('building:levels',4))*3.2
     except ValueError:h=12.8
    if 'Netaji'in name:h=19
    h=max(4,min(60,h));extrude(M(name,BUILD[int(id)%len(BUILD)],'Context_Buildings'),p,h)
    surface(M(name+'_roof',ROOF,'Context_Buildings'),p,h-.25)
public_union=unary_union(publicpolys)
# Mapped gate anchors along the pavilion road. Other perimeter vertices are inferred
# from satellite imagery and existing stadium geometry, not claimed as surveyed walls.
def at(id):return np.array(local(*nodes[id])[:2])
anchors=[('11283009245','Road_gate_W1',5),('11283009246','Road_gate_W2',6),('11283009247','Road_gate_E1',7),('11283009248','Road_gate_E2',6)]
mapped=[at(id).tolist() for id,name,w in anchors]
boundary_pts=[[-139,-72],[-122,-113],*mapped,[111,-101],[139,-54],[143,10],[139,66],[109,110],[76,143],[23,148],[-38,137],[-83,127],[-119,98],[-136,54],[-140,0]]
boundary=LineString(boundary_pts+[boundary_pts[0]])
apron=M('Stadium_site_apron',WALK,'Exterior_Boundary')
for tri in triangulate(Polygon(boundary_pts)):
 if Polygon(boundary_pts).covers(tri):apron.poly([(x,y,-.31) for x,y in list(tri.exterior.coords)[:-1]])
gate_records=[]
for id,name,width in anchors:
 p=at(id);gate_records.append({'name':name,'osm_node':id,'position_local_m':p.tolist(),'width_m':width,'position_status':'mapped node','station':boundary.project(Point(p))})
for name,p,width in [('West_access',[-138,-30],6),('Northwest_access',[-100,112],6),('North_access',[20,148],7),('Northeast_access',[100,120],6),('East_access',[142,25],6)]:
 st=boundary.project(Point(p));pos=boundary.interpolate(st);gate_records.append({'name':name,'position_local_m':list(pos.coords)[0],'width_m':width,'position_status':'inferred access opening','station':st})
wall=M('Site_boundary_masonry',WALL,'Exterior_Boundary');caps=M('Site_boundary_coping',CAP,'Exterior_Boundary');piers=M('Site_boundary_piers',CON,'Exterior_Boundary');grilles=M('Roadside_boundary_grilles',GATE,'Exterior_Boundary')
def bpoint(d,z=0):
 p=boundary.interpolate(d%boundary.length);return np.array([p.x,p.y,z])
def gap(d,extra=0):return any(abs((d-g['station']+boundary.length/2)%boundary.length-boundary.length/2)<g['width_m']/2+extra for g in gate_records)
for d in np.arange(0,boundary.length,.45):
 mid=d+.225
 if gap(mid,.12):continue
 a,b=bpoint(d),bpoint(min(d+.45,boundary.length));v=b-a;v/=np.linalg.norm(v);n=np.array([-v[1],v[0],0]);front=(a[1]<-117 and abs(a[0])<110);h=1.05 if front else 2.35
 for off in [-.18,.18]:wall.poly([a+n*off,b+n*off,b+n*off+[0,0,h],a+n*off+[0,0,h]])
 caps.poly([a-n*.28+[0,0,h],b-n*.28+[0,0,h],b+n*.28+[0,0,h],a+n*.28+[0,0,h]])
 if front:
  for z in [h+.1,2.5]:grilles.beam(a+[0,0,z],b+[0,0,z],.04,4)
  for q in [a,(a+b)/2]:grilles.beam(q+[0,0,h],q+[0,0,2.5],.023,4)
for d in np.arange(0,boundary.length,5):
 if gap(d,.6):continue
 p=bpoint(d,1.35);piers.box(p,(.6,.6,2.7));caps.box(bpoint(d,2.8),(.8,.8,.2))
for g in gate_records:
 d,w=g['station'],g['width_m'];a,b=bpoint(d-w/2),bpoint(d+w/2);m=M('Gate_'+g['name'],GATE,'Exterior_Gates')
 for p in [a,b]:piers.box(p+[0,0,1.55],(.8,.8,3.1));caps.box(p+[0,0,3.2],(1,1,.2))
 for z in [.18,1,2.65]:m.beam(a+[0,0,z],b+[0,0,z],.055,5)
 for t in np.linspace(0,1,int(w/.16)+1):
  p=a+(b-a)*t;m.beam(p+[0,0,.18],p+[0,0,2.65],.025,4)
 m.beam(a+[0,0,.18],(a+b)/2+[0,0,1],.045,5);m.beam(b+[0,0,.18],(a+b)/2+[0,0,1],.045,5)
 # Gate access aprons connect to the adjacent mapped street where nearby.
 p=np.array(g['position_local_m']);e=p[0]*cs+p[1]*sn;n=-p[0]*sn+p[1]*cs
 nearest=min(publiclines,key=lambda item:item[1].distance(Point(e,n)))[1];q=nearest.interpolate(nearest.project(Point(e,n)))
 if q.distance(Point(e,n))<35:surface(paths,LineString([(e,n),(q.x,q.y)]).buffer(w/2,cap_style=2),-.23)
# Sparse trees suggest Maidan/park structure without turning playing fields into woodland.
green_union=unary_union([maidan,*green]).difference(unary_union([*roadpolys,*buildingpolys,Point(0,0).buffer(155),river]))
trunk=M('Park_tree_trunks',TRUNK,'Context_Trees');crowns=[M('Park_tree_crowns_'+str(i),m,'Context_Trees') for i,m in enumerate(TREE)]
random.seed(505);treecount=0
for _ in range(12000):
 e=random.uniform(-550,900);n=random.uniform(-2200,600);p=Point(e,n)
 if not green_union.contains(p):continue
 # Most trees along edges and paths, broad central lawns kept open.
 edge=min((p.distance(r) for r in roadpolys),default=100)
 if edge>35 and random.random()>.08:continue
 x,y,_=local(e,n);h=random.uniform(6,12);rad=random.uniform(2.5,4.5);trunk.beam((x,y,-.4),(x,y,h*.7),.20,5);c=random.choice(crowns)
 rings=[[(x+rad*math.cos(lat)*math.cos(t),y+rad*math.cos(lat)*math.sin(t),h*.68+h*.35*math.sin(lat)) for t in np.linspace(0,2*math.pi,8,endpoint=False)] for lat in np.linspace(-math.pi/2,math.pi/2,5)]
 for ra,rb in zip(rings[:-1],rings[1:]):
  for k in range(8):j=(k+1)%8;c.poly([ra[k],ra[j],rb[j],rb[k]])
 treecount+=1
 if treecount>=450:break
# Tower coordinates are independent mapped points, not symmetric quadrant guesses.
towers=[]
for name,id,old in [('T1','12143393748',[-78,106]),('T2','12143393749',[37,116]),('T3','12143393750',[85,-103]),('T4','12143393747',[-86,-99])]:
 new=at(id).tolist();towers.append({'name':name,'osm_node':id,'old_local_xy_m':old,'new_local_xy_m':new,'height_status':'unchanged; not remeasured','position_status':'mapped lighting tower node'})
export=(ROOT/'build_eden_exterior.py').read_text().split('# Export unindexed GLB in metres, same origin as the detailed stadium.')[1]
exec(compile(export,'export_site','exec'),globals())
report.update(version='v05-map-alignment',local_positive_y_azimuth_deg=-30,azimuth_status='inferred from satellite pitch/pavilion alignment; approximately 330 degrees',extent_east_north_m=[-1100,-2300,1050,800],mapped_features=records,towers=towers,gates=gate_records,maidan_area_in_model_m2=round(maidan.area),boundary_status='inferred satellite perimeter with four mapped roadside gate anchors',pavilion_extension_removed_m=20)
report['limitations']=['Road centre-lines, Maidan outline, four floodlight positions and four roadside gates use OSM coordinates.','Stadium north bearing is inferred from satellite imagery, not surveyed.','Road widths, wall trace, untagged building heights, tree positions and other gate openings remain estimated.','Unchanged interior geometry retains its prior proportional limitations.']
(OUT/'exterior_manifest.json').write_text(json.dumps(report,indent=2));print('Site v05',report['triangles'],'triangles',len(records),'roads',len(gate_records),'gates')
