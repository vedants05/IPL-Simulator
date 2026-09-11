"""v03 exterior / metric OSM context. Existing v02 stadium is never regenerated.
Requires numpy, Pillow, shapely. Run from the project root.
"""
from pathlib import Path
import sys, math, json, struct, random, xml.etree.ElementTree as ET
sys.path.insert(0,str(Path(__file__).resolve().parent/'python_deps'))
import numpy as np
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import triangulate, polygonize, unary_union
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'eden_gardens_model_v03';OUT.mkdir(exist_ok=True)
ns={'__file__':str(ROOT/'build_eden_model.py')}
exec((ROOT/'build_eden_model.py').read_text().split('# Small irregularity')[0],ns)
M=ns['Mesh'];meshes=ns['meshes'];materials=ns['materials'];mat=ns['mat'];xy=ns['xy']
CON=ns['CON'];STEEL=ns['STEEL'];DARK=ns['DARK'];GLASS=ns['GLASS']
ROAD=mat('Asphalt',(.14,.16,.17));WALK=mat('Pavement',(.47,.46,.41));LAND=mat('Context ground',(.31,.37,.24))
PARK=mat('Park lawn',(.18,.31,.12));WATER=mat('Hooghly water',(.12,.25,.24),.12,.26)
ROOF=mat('Context roof',(.34,.39,.42),.15,.65);TREE=[mat('Tree crown '+str(i),c) for i,c in enumerate([(.12,.26,.075),(.17,.32,.09),(.22,.37,.12)])]
TRUNK=mat('Tree trunk',(.25,.20,.135));MARK=mat('Road markings',(.77,.76,.62));PANEL=mat('Blank exterior panels',(.20,.22,.24))
BUILD=[mat('Building mass '+str(i),c) for i,c in enumerate([(.60,.57,.49),(.64,.64,.59),(.56,.59,.58),(.70,.65,.55)])]
random.seed(34)
# Origin from mapped cricket field; yaw inferred from pavilion indentation and photos.
LON,LAT=88.34329,22.56460
AZ=math.radians(-12);cs,sn=math.cos(AZ),math.sin(AZ)
def local(e,n,z=0):return (e*cs-n*sn,e*sn+n*cs,z)
def ll(lon,lat):return ((lon-LON)*111320*math.cos(math.radians(LAT)),(lat-LAT)*111320)
def parts(g):return list(g.geoms) if hasattr(g,'geoms') else [g]
extent=box(-1400,-850,800,950)
def surface(m,g,z):
 for p in parts(g):
  if not isinstance(p,Polygon) or p.area<.02:continue
  for t in triangulate(p):
   if p.covers(t):m.poly([local(x,y,z) for x,y in list(t.exterior.coords)[:-1]])
def extrude(m,g,h,z=-.3):
 surface(m,g,z+h)
 for p in parts(g):
  if not isinstance(p,Polygon):continue
  for ring in [p.exterior,*p.interiors]:
   coords=list(ring.coords)
   for (x,y),(xx,yy) in zip(coords[:-1],coords[1:]):m.poly([local(x,y,z),local(xx,yy,z),local(xx,yy,z+h),local(x,y,z+h)])
def readmap(path):
 root=ET.parse(path).getroot();nodes={n.attrib['id']:ll(float(n.attrib['lon']),float(n.attrib['lat'])) for n in root.findall('node')}
 ways={w.attrib['id']:([nodes[n.attrib['ref']] for n in w.findall('nd') if n.attrib['ref'] in nodes],{t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}) for w in root.findall('way')}
 return root,nodes,ways
root,nodes,ways=readmap(ROOT/'site_map.osm')
rr,rn,rw=readmap(ROOT/'river_map.osm')
lines=[LineString(p) for p,t in rw.values() if len(p)>2]
river=unary_union(list(polygonize(unary_union(lines)))).intersection(extent)
if river.is_empty:raise RuntimeError('River boundary could not be assembled')
surface(M('Land_base',LAND,'Context_Terrain'),extent.difference(river),-.65)
surface(M('Hooghly_River_OSM_shoreline',WATER,'Context_River'),river,-1.10)
bank=river.boundary.buffer(2).intersection(extent)
extrude(M('Riverbank_edge',WALK,'Context_River'),bank,.4,-1.05)
exclude=Point(0,0).buffer(140)
roadareas=[];parks=[];buildings=[];records=[]
roadmesh=M('Mapped_roads',ROAD,'Context_Roads');pavement=M('Road_verges',WALK,'Context_Roads');marks=M('Centre_dashes',MARK,'Context_Roads')
rail=M('Circular_railway_basic',DARK,'Context_Railway')
for id,(pts,tags) in ways.items():
 if len(pts)<2:continue
 line=LineString(pts)
 if not line.intersects(extent):continue
 if 'highway' in tags:
  hw=tags['highway']
  if hw in ['proposed','construction','steps']:continue
  width={'primary':12,'primary_link':8,'secondary':9,'secondary_link':7,'tertiary':7,'residential':6,'service':4,'footway':2,'path':1.8,'pedestrian':4,'track':3}.get(hw,5)
  road=line.buffer(width/2,cap_style=2,join_style=2).intersection(extent).difference(exclude).difference(river)
  surface(roadmesh if hw not in ['footway','path','pedestrian'] else pavement,road,-.19)
  if hw not in ['footway','path','pedestrian']:
   roadareas.append(line.buffer(width/2+4));surface(pavement,line.buffer(width/2+1.5).intersection(extent).difference(exclude).difference(river),-.25)
   if width>=7:
    for d in np.arange(0,line.length,15):
     p=line.interpolate(d);q=line.interpolate(min(d+4,line.length));surface(marks,LineString([p,q]).buffer(.10).intersection(extent).difference(exclude).difference(river),-.175)
  records.append({'osm_way':id,'type':'road','name':tags.get('name',hw),'width_m_estimate':width})
 elif tags.get('railway')=='rail':
  for delta in [-.84,.84]:
   track=line.parallel_offset(abs(delta),'left' if delta<0 else 'right').intersection(extent)
   surface(rail,track.buffer(.07).difference(exclude),-.17)
 if pts[0]!=pts[-1] or len(pts)<4:continue
 poly=Polygon(pts).buffer(0).intersection(extent)
 if poly.is_empty:continue
 if ('building' in tags or tags.get('leisure')=='stadium') and id!='102784454':
  if poly.intersects(Point(0,0).buffer(146)):continue
  if tags.get('leisure')=='stadium' and 'building' not in tags:continue
  try:h=float(tags.get('height','').replace(' m',''))
  except ValueError:
   try:h=float(tags.get('building:levels',4))*3.2
   except ValueError:h=12.8
  name=tags.get('name','Building_'+id);h=min(65,max(4,h));buildings.append(poly)
  if 'Netaji' in name:h=19
  m=M(name,random.choice(BUILD),'Context_Buildings');extrude(m,poly,h)
  surface(M(name+'_roof',ROOF,'Context_Buildings'),poly,h-.25)
  records.append({'osm_way':id,'type':'building','name':name,'height_m':h,'height_status':'OSM' if 'height'in tags or 'building:levels'in tags else 'estimated'})
 if tags.get('leisure') in ['park','garden','pitch'] or tags.get('landuse') in ['grass','forest','recreation_ground'] or tags.get('natural')=='wood':
  p=poly.difference(Point(0,0).buffer(146)).difference(river)
  if not p.is_empty:
   surface(M('Green_'+id,PARK,'Context_Greenery'),p,-.48)
   if tags.get('leisure')!='pitch':parks.append(p)
 if tags.get('natural')=='water':surface(M('Pond_'+id,WATER,'Context_Water'),poly,-.40)
# Exterior family geometry: real proportions retained from v02; dressing outside rear walls.
def arc(m,r,z0,z1,a,b,n=60):
 ts=np.linspace(math.radians(a),math.radians(b),n+1)
 for aa,bb in zip(ts[:-1],ts[1:]):m.poly([xy(aa,r,z0),xy(bb,r,z0),xy(bb,r,z1),xy(aa,r,z1)])
for label,a,b,r,h in [('BC',90,162,131,31),('KL',-162,-100,129,30)]:
 group='Exterior_'+label
 dark=M(label+'_recessed_outer_bays',DARK,group);white=M(label+'_diagonal_facade_structure',STEEL,group);con=M(label+'_outer_floor_bands',CON,group)
 for z0,z1 in [(3,10),(11,19),(20,h-1)]:arc(dark,r+.4,z0,z1,a,b)
 for z in [2.8,10.4,19.4,h-.4]:arc(con,r+1,z,z+.65,a,b)
 angles=np.linspace(math.radians(a),math.radians(b),15)
 for aa,bb in zip(angles[:-1],angles[1:]):
  white.beam(xy(aa,r+1.3,3),xy((aa+bb)/2,r+2,h-1),.28,6)
  white.beam(xy(bb,r+1.3,3),xy((aa+bb)/2,r+2,h-1),.28,6)
  # Neutral triangular panel, placed behind the white braces, no logos or player portraits.
  pm=M(label+'_blank_panel_'+str(round(aa,3)),PANEL,group)
  pm.poly([xy(aa+.009,r+.9,8),xy(bb-.009,r+.9,8),xy((aa+bb)/2,r+.9,h-3)])
  for z in [3,11,20]:white.beam(xy(aa,r+1.35,z),xy(aa,r+1.35,z+7),.13,5)
 railings=M(label+'_external_gallery_railings',STEEL,group)
 for z in [11,20]:
  for zz in [z,z+.6,z+1.15]:arc(railings,r+1.8,zz,zz+.045,a,b)
  for aa in np.linspace(math.radians(a),math.radians(b),85):railings.beam(xy(aa,r+1.8,z),xy(aa,r+1.8,z+1.2),.03,4)
# Open-side outer structural columns and horizontal bands, with basic stair cores.
for s in ns['P']['sectors']:
 if s['id'] in ['B','C','K','L']:continue
 group='Exterior_'+s['id'];a=s['angle_start_deg'];b=s['angle_end_deg'];r=s['rear_radius_m']+1;h=s['top_height_m'] if 'top_height_m'in s else (14 if s['id'] in ['E','J'] else 24)
 con=M(s['id']+'_external_columns_and_bands',CON,group);dark=M(s['id']+'_external_recesses',DARK,group)
 arc(dark,r,.6,h-1,a,b)
 for z in [3,9,h-1]:arc(con,r+.35,z,z+.6,a,b)
 for aa in np.linspace(math.radians(a),math.radians(b),max(4,int((b-a)/5))):con.beam(xy(aa,r+.5,0),xy(aa,r+.5,h),.4,4)
# Club House rear: plain panelled elevation consistent with aerial reference.
ch=M('ClubHouse_external_panels',PANEL,'Exterior_ClubHouse');trim=M('ClubHouse_external_piers',CON,'Exterior_ClubHouse');glass=M('ClubHouse_external_glazing',GLASS,'Exterior_ClubHouse')
ch.box((0,-113.65,13),(56,.2,20))
for x in np.arange(-28,29,7):trim.box((x,-113.95,12),(.5,.6,24))
for z in [4,11,18,22.4]:trim.box((0,-114,z),(56,.7,.45))
for x in np.arange(-24.5,25,7):
 for z in [7,14,20]:glass.box((x,-114.05,z),(5.4,.12,2.7))
canopy=M('ClubHouse_entry_canopy',STEEL,'Exterior_ClubHouse');canopy.box((0,-119,4.4),(19,10,.3))
for x in [-8,8]:canopy.beam((x,-123,0),(x,-123,4.3),.15,6)
gates=M('Perimeter_fences_and_gates',STEEL,'Exterior_Perimeter');piers=M('Perimeter_gate_piers',CON,'Exterior_Perimeter')
# Regular spacing is a substitute: no unsupported real gate numbers assigned.
for a in np.arange(-180,180,9):
 aa,bb=np.radians([a+.5,a+8.5]);r=140
 for z in [.25,1.5,2.7]:gates.beam(xy(aa,r,z),xy(bb,r,z),.045,5)
 for t in np.linspace(aa,bb,32):gates.beam(xy(t,r,.2),xy(t,r,2.9),.025,4)
 piers.box(xy(aa,r,1.5),(.55,.55,3))
# A few gatehouse masses and street furniture, all explicitly approximate.
for a in [-145,125,60,-40]:
 t=math.radians(a);x,y,z=xy(t,137,1.5);piers.box((x,y,z),(3,3,3));canopy.box((x,y,3.2),(3.8,3.8,.3))
lamps=M('Exterior_lamp_posts',DARK,'Exterior_Perimeter');heads=M('Exterior_lamp_heads',STEEL,'Exterior_Perimeter')
for a in range(-180,180,24):
 x,y,_=xy(math.radians(a),144,0);lamps.beam((x,y,0),(x,y,5),.06,5);heads.box((x,y,5),(.65,.45,.15))
# Low-poly crowns in mapped green spaces. No guessed trees inside the bowl or roads.
blocked=unary_union([*roadareas,*buildings,Point(0,0).buffer(150),river])
treezone=unary_union(parks).difference(blocked)
trunk=M('Context_tree_trunks',TRUNK,'Context_Trees');crowns=[M('Context_tree_crowns_'+str(i),m,'Context_Trees') for i,m in enumerate(TREE)]
treecount=0
for _ in range(6500):
 e=random.uniform(-600,600);n=random.uniform(-750,850)
 if not treezone.contains(Point(e,n)):continue
 x,y,_=local(e,n);h=random.uniform(7,13);rad=random.uniform(3,5);trunk.beam((x,y,-.4),(x,y,h*.7),.22,5);c=random.choice(crowns)
 rings=[]
 for latitude in np.linspace(-math.pi/2,math.pi/2,6):rings.append([(x+rad*math.cos(latitude)*math.cos(t),y+rad*math.cos(latitude)*math.sin(t),h*.67+h*.36*math.sin(latitude)) for t in np.linspace(0,2*math.pi,9,endpoint=False)])
 for ra,rb in zip(rings[:-1],rings[1:]):
  for k in range(9):j=(k+1)%9;c.poly([ra[k],ra[j],rb[j],rb[k]])
 treecount+=1
 if treecount>=520:break
# Export unindexed GLB in metres, same origin as the detailed stadium.
blob=bytearray();views=[];accessors=[];gm=[];stats=[]
def buf(data,typ,bounds=False):
 while len(blob)%4:blob.append(0)
 raw=data.astype('<f4').tobytes();vi=len(views);views.append({'buffer':0,'byteOffset':len(blob),'byteLength':len(raw),'target':34962});blob.extend(raw)
 a={'bufferView':vi,'componentType':5126,'count':len(data),'type':typ}
 if bounds:a.update(min=data.min(0).tolist(),max=data.max(0).tolist())
 accessors.append(a);return len(accessors)-1
for m in meshes:
 if not m.faces:continue
 tri=np.asarray(m.verts)[np.asarray(m.faces)];normal=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);length=np.linalg.norm(normal,axis=1);ok=length>1e-8;tri=tri[ok];normal=normal[ok]/length[ok,None]
 if not len(tri):continue
 p=tri.reshape(-1,3)[:,[0,2,1]];p[:,2]*=-1;n=np.repeat(normal,3,axis=0)[:,[0,2,1]];n[:,2]*=-1
 attrs={'POSITION':buf(p,'VEC3',True),'NORMAL':buf(n,'VEC3'),'TEXCOORD_0':buf(np.zeros((len(p),2)),'VEC2')}
 gm.append({'name':m.name,'primitives':[{'attributes':attrs,'material':m.mat}],'extras':{'source_group':m.group}});stats.append({'name':m.name,'group':m.group,'triangles':len(tri)})
gn=[];groups={}
for i,m in enumerate(gm):
 group=m['extras']['source_group']
 if group not in groups:groups[group]=len(gn);gn.append({'name':group,'children':[]})
 idx=len(gn);gn.append({'name':m['name'],'mesh':i});gn[groups[group]]['children'].append(idx)
doc={'asset':{'version':'2.0','generator':'Eden exterior v03 / OSM context'},'scene':0,'scenes':[{'nodes':list(groups.values())}],'nodes':gn,'meshes':gm,'materials':materials,'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':accessors}
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);blob+=b'\0'*((-len(blob))%4)
(OUT/'eden_exterior_context.glb').write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(blob))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob)
report={'units':'metres','origin_lon_lat':[LON,LAT],'local_positive_y_azimuth_deg':-12,'azimuth_status':'estimated from mapped pavilion indentation; not survey alignment','extent_east_north_m':[-1400,-850,800,950],'river_nearest_distance_from_pitch_m':round(river.distance(Point(0,0)),1),'triangles':sum(s['triangles'] for s in stats),'tree_count':treecount,'source':'OpenStreetMap contributors, ODbL 1.0, downloaded 2026-09-11','source_url':'https://www.openstreetmap.org/copyright','limitations':['Road widths, untagged building heights, tree positions and exterior gate spacing are estimates.','Existing stadium proportions and interior not revised.','Exterior photo is not calibrated; facade is a proportional reconstruction.'],'objects':stats,'mapped_features':records}
(OUT/'exterior_manifest.json').write_text(json.dumps(report,indent=2));print({k:v for k,v in report.items() if k not in ['objects','mapped_features']})
