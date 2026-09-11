"""Convert the exported GLB itself into a compact CPU-render scene; no source-mesh shortcuts."""
from pathlib import Path
import struct,json,io,sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent;OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'eden_gardens_model_v02'
raw=(OUT/(sys.argv[2] if len(sys.argv)>2 else 'eden_gardens_LOD0.glb')).read_bytes();jl=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jl]);blob=raw[28+jl:]
def acc(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];n={'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];start=v.get('byteOffset',0)+a.get('byteOffset',0)
 return np.ndarray((a['count'],n),dtype='<f4',buffer=blob,offset=start,strides=(v.get('byteStride',n*4),4)).copy()
out=(OUT/'render_scene.bin').open('wb')
def ui(*x):out.write(struct.pack('<'+'I'*len(x),*x))
def fl(*x):out.write(struct.pack('<'+'f'*len(x),*x))
ui(len(doc.get('images',[])))
for image in doc.get('images',[]):
 v=doc['bufferViews'][image['bufferView']];start=v['byteOffset'];data=blob[start:start+v['byteLength']];im=Image.open(io.BytesIO(data)).convert('RGB');ui(*im.size);out.write(im.tobytes())
ui(len(doc['materials']))
for m in doc['materials']:
 p=m.get('pbrMetallicRoughness',{});fl(*p.get('baseColorFactor',[1,1,1,1])[:3]);idx=doc['textures'][p['baseColorTexture']['index']]['source'] if 'baseColorTexture' in p else -1
 out.write(struct.pack('<i',idx))
ui(len(doc['meshes']))
for m in doc['meshes']:
 p=m['primitives'][0];a=p['attributes'];pos=acc(a['POSITION']);normal=acc(a['NORMAL']);uv=acc(a['TEXCOORD_0']) if 'TEXCOORD_0' in a else np.zeros((len(pos),2))
 pos=pos[:,[0,2,1]];pos[:,1]*=-1;normal=normal[:,[0,2,1]];normal[:,1]*=-1
 data=np.concatenate([pos,normal,uv],axis=1).astype('<f4');ui(len(data),p['material']);out.write(data.tobytes())
instances=[]
for node in doc['nodes']:
 if 'mesh' not in node:continue
 ext=node.get('extensions',{}).get('EXT_mesh_gpu_instancing')
 if ext:
  a=ext['attributes'];t=acc(a['TRANSLATION']);q=acc(a['ROTATION']);colors=acc(a['_COLOR_0']) if '_COLOR_0' in a else np.ones_like(t)
  for p,r,c in zip(t,q,colors):instances.append((node['mesh'],[p[0],-p[2],p[1]],2*np.arctan2(r[1],r[3]),c))
 else:instances.append((node['mesh'],[0,0,0],0,[1,1,1]))
ui(len(instances))
for mi,p,a,c in instances:ui(mi);fl(*p,float(a),*c)
out.close();print('Packed',len(instances),'mesh instances for CPU inspection')
