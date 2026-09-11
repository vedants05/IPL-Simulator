#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>
using namespace std;
struct V{float x,y,z;V operator+(V b)const{return{x+b.x,y+b.y,z+b.z};}V operator-(V b)const{return{x-b.x,y-b.y,z-b.z};}V operator*(float s)const{return{x*s,y*s,z*s};}};
float dot(V a,V b){return a.x*b.x+a.y*b.y+a.z*b.z;}V cross(V a,V b){return{a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};}V unit(V a){return a*(1.f/sqrt(max(1e-12f,dot(a,a))));}
struct Vert{V p,n;float u,v;};struct Texture{uint32_t w,h;vector<uint8_t> rgb;};struct Material{V rgb;int32_t tex;};
struct Mesh{uint32_t mat;vector<Vert> v;V lo{1e9,1e9,1e9},hi{-1e9,-1e9,-1e9};};struct Instance{uint32_t mesh;V p;float angle;V color;};
vector<Texture> textures;vector<Material> materials;vector<Mesh> meshes;vector<Instance> instances;
template<class T>T read(ifstream&f){T t;f.read((char*)&t,sizeof(t));return t;}
V rotate(V p,float c,float s){return{c*p.x-s*p.y,s*p.x+c*p.y,p.z};}
struct Cam{V eye,fw,right,up;float focal;int w,h;bool ortho;float scale;};
Cam makecam(V eye,V target,int w,int h,float fov,bool ortho=false,float scale=400){V fw=unit(target-eye);V seed=abs(fw.z)>.99?V{0,1,0}:V{0,0,1};V right=unit(cross(fw,seed));return{eye,fw,right,cross(right,fw),w/(2*tan(fov*3.14159265/360)),w,h,ortho,scale};}
struct P{float x,y,z;V world,n;float u,v;};
P project(Vert v,const Cam&c){V d=v.p-c.eye;float z=dot(d,c.fw);return{c.w/2.f+dot(d,c.right)*(c.ortho?c.w/c.scale:c.focal/z),c.h/2.f-dot(d,c.up)*(c.ortho?c.w/c.scale:c.focal/z),z,v.p,v.n,v.u,v.v};}
V light=unit(V{-1,-1.4,2.6});Cam shadowcam=makecam(light*340,{0,0,10},2000,2000,45,true,340);vector<float> shadowdepth;
V sample(int ti,float u,float v){if(ti<0)return{1,1,1};auto&t=textures[ti];u-=floor(u);v-=floor(v);int x=min((int)t.w-1,(int)(u*t.w)),y=min((int)t.h-1,(int)(v*t.h));int k=(y*t.w+x)*3;return{pow(t.rgb[k]/255.f,2.2f),pow(t.rgb[k+1]/255.f,2.2f),pow(t.rgb[k+2]/255.f,2.2f)};}
float shadow(V p){auto q=project({p,{0,0,1},0,0},shadowcam);int x=q.x,y=q.y;if(x<1||x>=shadowcam.w-1||y<1||y>=shadowcam.h-1)return 1;float sum=0;for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++)sum+=(q.z-.20<=shadowdepth[(y+dy)*shadowcam.w+x+dx]?1:.24);return sum/9;}
void raster(P a,P b,P c,const Cam&cam,vector<float>&depth,vector<uint8_t>*pixels,const Material&m,V tint){
 int x0=max(0,(int)floor(min({a.x,b.x,c.x}))),x1=min(cam.w-1,(int)ceil(max({a.x,b.x,c.x})));int y0=max(0,(int)floor(min({a.y,b.y,c.y}))),y1=min(cam.h-1,(int)ceil(max({a.y,b.y,c.y})));
 if(x0>x1||y0>y1)return;float den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(abs(den)<.0001)return;
 for(int y=y0;y<=y1;y++)for(int x=x0;x<=x1;x++){
  float px=x+.5,py=y+.5;float aa=((b.y-c.y)*(px-c.x)+(c.x-b.x)*(py-c.y))/den,bb=((c.y-a.y)*(px-c.x)+(a.x-c.x)*(py-c.y))/den,cc=1-aa-bb;
  if(aa<0||bb<0||cc<0)continue;float z=cam.ortho?aa*a.z+bb*b.z+cc*c.z:1/(aa/a.z+bb/b.z+cc/c.z);int k=y*cam.w+x;if(z>=depth[k])continue;depth[k]=z;if(!pixels)continue;
  if(!cam.ortho){aa*=z/a.z;bb*=z/b.z;cc*=z/c.z;}
  V n=unit(a.n*aa+b.n*bb+c.n*cc),p=a.world*aa+b.world*bb+c.world*cc;float lambert=abs(dot(n,light));
  float illumination=.34+.70*lambert*shadow(p);V tex=sample(m.tex,aa*a.u+bb*b.u+cc*c.u,aa*a.v+bb*b.v+cc*c.v);
  V color={m.rgb.x*tint.x*tex.x,m.rgb.y*tint.y*tex.y,m.rgb.z*tint.z*tex.z};
  float channels[3]={color.x,color.y,color.z};for(int j=0;j<3;j++)(*pixels)[k*3+j]=(uint8_t)(255*pow(clamp(channels[j]*illumination,0.f,1.f),1/2.2f));
 }
}
void render(const Cam&cam,vector<float>&depth,vector<uint8_t>*pixels){
 depth.assign(cam.w*cam.h,1e9f);if(pixels){pixels->resize(cam.w*cam.h*3);for(int k=0;k<cam.w*cam.h;k++){(*pixels)[k*3]=220;(*pixels)[k*3+1]=230;(*pixels)[k*3+2]=235;}}
 for(auto&inst:instances){auto&m=meshes[inst.mesh];float cs=cos(inst.angle),sn=sin(inst.angle);
  // Cull entire small seat parts before transforming their triangles.
  V mid=(m.lo+m.hi)*.5f;float radius=sqrt(dot(m.hi-m.lo,m.hi-m.lo))*.5f;
  V center=rotate(mid,cs,sn)+inst.p;V delta=center-cam.eye;float cz=dot(delta,cam.fw);
  if(cz+radius<.1)continue;
  if(!cam.ortho&&radius<2&&cz>radius){float limx=cz*(cam.w/2.f)/cam.focal,limy=cz*(cam.h/2.f)/cam.focal;if(abs(dot(delta,cam.right))>limx+radius*2||abs(dot(delta,cam.up))>limy+radius*2)continue;}
  for(size_t i=0;i<m.v.size();i+=3){
   vector<Vert> poly;for(int j=0;j<3;j++){auto v=m.v[i+j];v.p=rotate(v.p,cs,sn)+inst.p;v.n=rotate(v.n,cs,sn);poly.push_back(v);}
   vector<Vert> clipped;for(int j=0;j<3;j++){Vert p=poly[j],q=poly[(j+1)%3];float zp=dot(p.p-cam.eye,cam.fw),zq=dot(q.p-cam.eye,cam.fw);bool pin=zp>=.1,qin=zq>=.1;if(pin)clipped.push_back(p);if(pin!=qin){float t=(.1-zp)/(zq-zp);clipped.push_back({p.p+(q.p-p.p)*t,p.n+(q.n-p.n)*t,p.u+(q.u-p.u)*t,p.v+(q.v-p.v)*t});}}
   for(size_t j=1;j+1<clipped.size();j++)raster(project(clipped[0],cam),project(clipped[j],cam),project(clipped[j+1],cam),cam,depth,pixels,materials[m.mat],inst.color);
  }
 }
}
int main(int argc,char**argv){if(argc<3)return 1;ifstream f(argv[1],ios::binary);uint32_t nt=read<uint32_t>(f);for(uint32_t i=0;i<nt;i++){Texture t;t.w=read<uint32_t>(f);t.h=read<uint32_t>(f);t.rgb.resize(t.w*t.h*3);f.read((char*)t.rgb.data(),t.rgb.size());textures.push_back(move(t));}uint32_t nm=read<uint32_t>(f);for(uint32_t i=0;i<nm;i++)materials.push_back(read<Material>(f));uint32_t nmesh=read<uint32_t>(f);for(uint32_t i=0;i<nmesh;i++){Mesh m;uint32_t nv=read<uint32_t>(f);m.mat=read<uint32_t>(f);m.v.resize(nv);f.read((char*)m.v.data(),nv*sizeof(Vert));for(auto&v:m.v){m.lo={min(m.lo.x,v.p.x),min(m.lo.y,v.p.y),min(m.lo.z,v.p.z)};m.hi={max(m.hi.x,v.p.x),max(m.hi.y,v.p.y),max(m.hi.z,v.p.z)};}meshes.push_back(move(m));}uint32_t ni=read<uint32_t>(f);for(uint32_t i=0;i<ni;i++)instances.push_back(read<Instance>(f));if(!f){cerr<<"Invalid scene\n";return 2;}
 cerr<<"Loaded "<<ni<<" instances\n";render(shadowcam,shadowdepth,nullptr);cerr<<"Shadow map complete\n";
 struct View{string name;V eye,target;float fov;};float a=110*3.14159265/180;
 vector<View> views={{"aerial",{240,-320,235},{0,0,14},48},{"clubhouse",{0,52,11},{0,-99,15},48},{"opposite_end",{0,-65,13},{0,99,17},52},{"c_block_detail",{sin(a)*78,cos(a)*78,4},{sin(a-.04f)*105,cos(a-.04f)*105,20},65},{"seat_closeup",{sin(a-.035f)*99,cos(a-.035f)*99,14.5},{sin(a)*96.3f,cos(a)*96.3f,11.8},58},{"traditional_scoreboard",{61,47,27},{89,80,29},42},{"north_sight_screen",{0,72,5},{0,97,5.3},62},{"clubhouse_sight_screen",{0,-68,4},{0,-91,4.5},60}};
 for(auto&v:views){Cam cam=makecam(v.eye,v.target,1600,1100,v.fov);vector<float>depth;vector<uint8_t>pixels;render(cam,depth,&pixels);string path=string(argv[2])+"/"+v.name+".ppm";ofstream o(path,ios::binary);o<<"P6\n"<<cam.w<<" "<<cam.h<<"\n255\n";o.write((char*)pixels.data(),pixels.size());cerr<<"Rendered "<<v.name<<"\n";}
}
