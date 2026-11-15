// All WGSL. H()/nd() mirror world.js exactly so CPU collision, GPU terrain and GPU plant placement agree.
import { MW, MH, MC, OX, OZ } from './world.js';
export const NEAR = .15, LR = 62, TG = 400, UG = 104, GG = 152, NPOL = 2600, NFLY = 500;
const arr = (t, a) => `array<${t},${a.length}>(${a.join(',')})`;
const COMMON = `
diagnostic(off,derivative_uniformity);
struct G{vp:mat4x4f,ivp:mat4x4f,sh:array<mat4x4f,2>,cam:vec4f,sun:vec4f,res:vec4f,fr:array<vec4f,5>,shc:array<vec4f,2>,wind:vec4f,misc:vec4f,zw:vec4f,site:array<vec4f,8>,lvl:array<vec4f,11>,imp:array<vec4f,16>}
@group(0)@binding(0)var<uniform>g:G;
@group(0)@binding(1)var macroT:texture_2d<f32>;
fn sat(x:f32)->f32{return clamp(x,0.,1.);}
fn hg(i:vec2i)->vec2f{var n=(u32(i.x)*0x27d4eb2du)^(u32(i.y)*0x165667b1u+0x9e3779b9u);n^=n>>15u;n*=0x2c1b3c6du;n^=n>>12u;n*=0x297a2d39u;n^=n>>15u;let a=f32(n>>8u)*3.7450704e-7;return vec2f(cos(a),sin(a));}
fn nd(p:vec2f)->vec3f{let i=floor(p);let f=p-i;let b=vec2i(i);
let u=f*f*f*(f*(f*6.-15.)+10.);let du=30.*f*f*(f*(f-2.)+1.);
let ga=hg(b);let gb=hg(b+vec2i(1,0));let gc=hg(b+vec2i(0,1));let gd=hg(b+vec2i(1,1));
let va=dot(ga,f);let vb=dot(gb,f-vec2f(1.,0.));let vc=dot(gc,f-vec2f(0.,1.));let vd=dot(gd,f-vec2f(1.,1.));let k=va-vb-vc+vd;
return vec3f(va+u.x*(vb-va)+u.y*(vc-va)+u.x*u.y*k,ga+u.x*(gb-ga)+u.y*(gc-ga)+u.x*u.y*(ga-gb-gc+gd)+du*(u.yx*k+vec2f(vb,vc)-va));}
fn n1(p:vec2f)->f32{let i=floor(p);let f=p-i;let b=vec2i(i);let u=f*f*f*(f*(f*6.-15.)+10.);
let va=dot(hg(b),f);let vb=dot(hg(b+vec2i(1,0)),f-vec2f(1.,0.));let vc=dot(hg(b+vec2i(0,1)),f-vec2f(0.,1.));let vd=dot(hg(b+vec2i(1,1)),f-vec2f(1.,1.));
return va+u.x*(vb-va)+u.y*(vc-va)+u.x*u.y*(va-vb-vc+vd);}
fn bw(f:f32)->vec4f{let f2=f*f;let f3=f2*f;return vec4f((1.-f)*(1.-f)*(1.-f),3.*f3-6.*f2+4.,-3.*f3+3.*f2+3.*f+1.,f3)/6.;}
fn macroH(p:vec2f)->f32{let u=(p-vec2f(${OX}.,${OZ}.))/${MC}.-.5;let i=floor(u);let f=u-i;let b=vec2i(i);let wx=bw(f.x);let wz=bw(f.y);var s=0.;
for(var j=0;j<4;j++){var r=0.;for(var k=0;k<4;k++){r+=wx[k]*textureLoad(macroT,clamp(b+vec2i(k-1,j-1),vec2i(0),vec2i(${MW - 1},${MH - 1})),0).r;}s+=wz[j]*r;}return s;}
// returns (height, distance to stream centre line, ruggedness)
fn H(p:vec2f,d:f32)->vec3f{
let hb=macroH(p);if(hb<-20.){return vec3f(hb,1e4,0.);}
var r=sat((hb-15.)/600.);r=r*r*(3.-2.*r);
let v=nd(p*vec2f(1./1700.,1./800.)+vec2f(3.1,9.2));
var h=hb+r*330.*(sqrt(v.x*v.x+9e-4)-.2);
let w=n1(p*vec2f(1./330.,1./250.)+vec2f(5.7,2.3));
h+=r*70.*(sqrt(w*w+2e-3)-.2);
h+=r*(16.*n1(p/95.+vec2f(1.3,7.1))*(1.-smoothstep(1500.,3000.,d))+3.5*n1(p/31.+vec2f(8.2,.4))*(1.-smoothstep(400.,900.,d)));
let lo=.3+.7*r;
if(d<400.){h+=lo*.8*n1(p/9.5)*(1.-smoothstep(150.,400.,d));}
if(d<60.){h+=lo*.15*n1(p/2.9)*(1.-smoothstep(25.,60.,d));}
let al=sat((h-2700.)/800.);
if(al>0.){let c=max(1.-2.2*abs(n1(p/210.+vec2f(4.4,6.6))),0.);h+=al*r*70.*c*c;}
let yd=p-g.site[7].xy;let cap=3880.+90.*exp(-dot(yd,yd)/4.9e5);
if(h>3650.){h=3650.+(cap-3650.)*tanh((h-3650.)/(cap-3650.));}
var ds=1e4;
if(r>.05){ds=abs(v.x)/max(length(v.yz*vec2f(1./1700.,1./800.)),1e-6);
let ch=exp(-ds*ds/30.)*sat(r*3.)*(1.-smoothstep(3300.,3500.,h));
let q=h/14.;let hs=(floor(q)+smoothstep(.78,1.,fract(q)))*14.;
h=h+(hs-h)*ch*.85-1.6*ch;}
var y=h*g.misc.x;
var a=p-g.site[4].xy;var a2=dot(a,a);
if(g.site[5].w>0.&&a2<12100.){y-=22.*exp(-ds*ds/90.)*smoothstep(110.,45.,sqrt(a2));}
a=p-g.site[0].xy;a2=dot(a,a);if(a2<196.){y+=(g.site[0].z-y)*smoothstep(14.,4.,sqrt(a2));}
a=p-g.site[1].xy;a2=dot(a,a);if(a2<400.){y+=(g.site[1].z-y)*smoothstep(20.,8.,sqrt(a2));}
a=p-g.site[2].xy;a2=length(a);let dl=abs(a2-g.site[2].z);
if(dl<12.&&g.site[2].z>0.){y+=(g.site[2].w-y)*smoothstep(12.,3.,dl)*smoothstep(g.site[3].z,g.site[3].z+.004,dot(a,g.site[3].xy)/a2);}
return vec3f(y,ds,r);}
fn zalt(p:vec2f,y:f32)->f32{return y+140.*n1(p/900.+vec2f(11.,3.));}
// forest density 0..1 (a = zone altitude, sl = rise/run, ds = stream distance, y = true altitude)
fn cover(p:vec2f,a:f32,sl:f32,ds:f32,y:f32)->f32{
var c=.84;let m=n1(p/170.+vec2f(2.,9.));
c*=mix(1.,smoothstep(-.06,.16,m),smoothstep(2900.,3250.,a)*.92);
c*=1.-smoothstep(3580.,3820.,a)*.62;
c*=1.-smoothstep(.95,1.6,sl);
c*=smoothstep(2.5,7.,ds)*smoothstep(1.5,10.,y);
return c;}
`;
const RENDER = `
@group(0)@binding(2)var noiseT:texture_2d<f32>;
@group(0)@binding(3)var atlasT:texture_2d<f32>;
@group(0)@binding(4)var samp:sampler;
@group(0)@binding(5)var shadowT:texture_depth_2d_array;
@group(0)@binding(6)var sampC:sampler_comparison;
@group(0)@binding(7)var impC:texture_2d<f32>;
@group(0)@binding(8)var impN:texture_2d<f32>;
@group(0)@binding(9)var noise3:texture_3d<f32>;
override CASC:u32=0u;
const SUNC=vec3f(6.4,5.7,4.6);const HH=900.;const RH=6e-4;const RB=7.5e-3;
fn tm(c:vec3f)->vec3f{return c/(1.+max(c.r,max(c.g,c.b)));}
fn amb(n:vec3f)->vec3f{return mix(vec3f(.22,.21,.15),vec3f(.6,.72,.9),n.y*.5+.5);}
fn ambc(n:vec3f,op:f32)->vec3f{return mix(vec3f(.5,.58,.3)*(.55+.45*(n.y*.5+.5)),amb(n),op);}
fn skyc(d:vec3f)->vec3f{let mu=max(d.y,0.);let sd=max(dot(d,g.sun.xyz),0.);
var c=mix(vec3f(.6,.78,1.),vec3f(.1,.27,.75),pow(mu,.5))*1.2;
c+=vec3f(1.,.85,.6)*(pow(sd,12.)*.3+pow(sd,90.)*.7);
return mix(c,vec3f(.55,.67,.8),smoothstep(0.,-.3,d.y)*.9);}
fn Rb(s:f32)->f32{if(s<0.){return 0.;}if(s<300.){return s*s/600.;}return s-150.;}
fn trap(y:f32)->f32{return sat((y-1450.)/300.)-sat((y-2250.)/300.);}
fn fogT(rel:vec3f)->f32{let t=length(rel);let y0=g.cam.y;let dy=rel.y;let x=dy/HH;
var hz=exp(-y0/HH);if(abs(x)>1e-3){hz*=(1.-exp(-x))/x;}
var bz=trap(y0);if(abs(dy)>1.){bz=(Rb(y0+dy-1450.)-Rb(y0+dy-2250.)-Rb(y0-1450.)+Rb(y0-2250.))/dy;}
return exp(-t*(RH*hz+RB*g.misc.w*bz));}
fn fog(c:vec3f,rel:vec3f)->vec3f{let T=fogT(rel);let sd=max(dot(normalize(rel),g.sun.xyz),0.);
let y=g.cam.y;
var fc=mix(vec3f(.78,.8,.74),vec3f(.62,.75,.95),sat(y/1600.));
fc=mix(fc,vec3f(.86,.89,.93),sat(g.misc.w*1.4-.2));
fc+=vec3f(1.,.8,.5)*pow(sd,8.)*.45;
return c*T+fc*(1.-T);}
// sun flecks: sparse gaps in the canopy, coherent along the sun direction so ground dapples, lit leaves and light shafts line up
fn leak(rel:vec3f)->f32{let w=rel+g.cam.xyz;let R=g.shc[1].w;
let u=vec2f(dot(w,vec3f(g.sh[1][0].x,g.sh[1][1].x,g.sh[1][2].x)),dot(w,vec3f(g.sh[1][0].y,g.sh[1][1].y,g.sh[1][2].y)))*R;let t=g.cam.w;
let a=textureSampleLevel(noiseT,samp,u/17.+vec2f(t*.0021,t*.0013),0.).x;let b=textureSampleLevel(noiseT,samp,u/4.3-vec2f(t*.006,t*.004),0.).y;
return smoothstep(.57,.68,a*.62+b*.38)*g.zw.y;}
fn shadow(rel:vec3f,n:vec3f)->vec2f{
let d0=distance(rel,g.shc[0].xyz);let d1=distance(rel,g.shc[1].xyz);
if(d1>g.shc[1].w){return vec2f(1.,0.);}
var c=1;var nb=.14;if(d0<g.shc[0].w*.93){c=0;nb=.04;}
let q=g.sh[c]*vec4f(rel+n*nb,1.);let uv=q.xy*vec2f(.5,-.5)+.5;let ts=.75/2048.;
var s=textureSampleCompareLevel(shadowT,sampC,uv+vec2f(-ts,-ts),c,q.z)+textureSampleCompareLevel(shadowT,sampC,uv+vec2f(ts,-ts),c,q.z)
+textureSampleCompareLevel(shadowT,sampC,uv+vec2f(-ts,ts),c,q.z)+textureSampleCompareLevel(shadowT,sampC,uv+vec2f(ts,ts),c,q.z);
return vec2f(max(s*.25,leak(rel)),1.-smoothstep(.8,1.,d1/g.shc[1].w));}
fn ocean(p:vec2f,depth:f32,V:vec3f,d:f32)->vec3f{
let t=g.cam.w;let a=textureSample(noiseT,samp,p*.011+vec2f(t*.006,t*.004)).xy;let b=textureSample(noiseT,samp,p*.057-vec2f(t*.013,-t*.008)).zw;
let k=1./(1.+d*.003);let n=normalize(vec3f((a.x+b.x-1.)*.7*k,1.,(a.y+b.y-1.)*.7*k));
let fr=.02+.98*pow(1.-sat(dot(n,V)),5.);
var c=mix(vec3f(.05,.3,.27),vec3f(.008,.06,.11),sat(depth/8.))*1.3;
let R=reflect(-V,n);c=mix(c,skyc(vec3f(R.x,abs(R.y),R.z)),fr);
c+=SUNC*pow(sat(dot(R,g.sun.xyz)),260.)*1.5*k;
let fo=smoothstep(1.4,0.,depth)*smoothstep(.35,.65,a.x+.25*sin(depth*4.-t*1.6));
return mix(c,vec3f(1.5,1.55,1.6),fo*.8);}

// fallen-leaf stamps: one randomly rotated leaf per 1/f m tile
fn litter(p:vec2f,f:f32,lod:f32)->vec4f{let q=p*f;let c=floor(q);let h=hg(vec2i(c)+vec2i(17,5));let u=(q-c-.5)*1.25;
let r=vec2f(u.x*h.x-u.y*h.y,u.x*h.y+u.y*h.x)+.5;
let t=textureSampleLevel(atlasT,samp,(vec2f(0.,3.)+clamp(r,vec2f(.02),vec2f(.98)))*.25,lod);
return vec4f(t.rgb*(.55+.6*abs(h.x)),t.a*step(abs(h.y),.93));}
// ---------------- terrain ----------------
struct TO{@builtin(position)pos:vec4f,@location(0)rel:vec3f,@location(1)n:vec3f,@location(2)hr:vec3f,@location(3)@interpolate(flat)lv:u32}
@vertex fn vt(@location(0)a:vec4<i32>)->TO{
let L=u32(a.z);let lv=g.lvl[L];let s=lv.z;var gp=vec2f(a.xy);
let k=smoothstep(.78,.94,max(abs(gp.x),abs(gp.y))/64.);
gp-=(gp-2.*floor(gp*.5))*k;
let rx=lv.xy+gp*s;let w=rx+g.cam.xz;let d=length(rx);
let h=H(w,d);let e=max(s*(1.+k),.6);
let hx=H(w+vec2f(e,0.),d).x;let hz=H(w+vec2f(0.,e),d).x;
var o:TO;o.rel=vec3f(rx.x,max(h.x,0.)-g.cam.y,rx.y);o.n=normalize(vec3f(h.x-hx,e,h.x-hz));o.hr=h;o.lv=L;
o.pos=g.vp*vec4f(o.rel,1.);return o;}
@fragment fn ft(i:TO)->@location(0)vec4f{
if(i.lv>0u){let pl=g.lvl[i.lv-1u];let q=abs(i.rel.xz-pl.xy);if(max(q.x,q.y)<pl.z*63.6){discard;}}
let w=i.rel+g.cam.xyz;let d=length(i.rel);let V=-i.rel/d;var col:vec3f;
if(i.hr.x<0.){col=ocean(w.xz,-i.hr.x,V,d);}else{
var n=normalize(i.n);let a=zalt(w.xz,w.y);let sl=sqrt(max(1.-n.y*n.y,0.))/max(n.y,.05);
let t1=mix(textureSample(noiseT,samp,w.xz*.31),textureSample(noiseT,samp,w.xz*1.7+vec2f(.37,.11)),.45*(1.-smoothstep(4.,30.,d)));let t2=textureSample(noiseT,samp,w.xz*.043);let t3=textureSample(noiseT,samp,w.xz*.0071);let t4=textureSample(noiseT,samp,w.xz*.09);
let nf=1.-smoothstep(25.,110.,d);
n=normalize(n+vec3f(t1.x-.5,0.,t1.y-.5)*1.2*nf+vec3f(t4.x-.5,0.,t4.y-.5)*.7*nf+vec3f(t2.z-.5,0.,t2.w-.5)*.4);
let z1=smoothstep(350.,650.,a);let z2=smoothstep(1350.,1650.,a);let z3=smoothstep(2350.,2650.,a);let z4=smoothstep(3000.,3200.,a);let z5=smoothstep(3500.,3700.,a);
var gc=mix(vec3f(.075,.062,.036),vec3f(.15,.09,.045),z1);gc=mix(gc,vec3f(.055,.1,.03),z2);gc=mix(gc,vec3f(.115,.085,.05),z3);gc=mix(gc,vec3f(.13,.1,.06),z4);gc=mix(gc,vec3f(.12,.115,.07),z5);
gc*=.35+1.3*t1.z*(.6+.8*t4.z);
gc=mix(gc,vec3f(.34,.17,.05),smoothstep(.6,.75,t1.w)*.55*(1.-z2*.7)*(1.-z3));
gc=mix(gc,vec3f(.05,.13,.03),smoothstep(.45,.7,t4.x)*(.25+.6*z2*(1.-z3)));
let cv=cover(w.xz,a,sl,i.hr.y,w.y);
if(d<30.){let lod=clamp(log2(d*1.4),0.,4.);let la=litter(w.xz,8.3,lod);let lb=litter(w.xz*mat2x2f(.8,.6,-.6,.8)+7.3,6.1,lod);let lc=litter(w.xz*mat2x2f(.6,-.8,.8,.6)+3.1,10.7,lod);
let lw=(1.-smoothstep(14.,30.,d))*(1.-z3)*(.55+.45*z1)*smoothstep(.2,.5,cv);
gc=mix(gc,la.rgb*mix(vec3f(.3,.3,.24),vec3f(.5,.36,.22),z1),la.a*lw);gc=mix(gc,lb.rgb*vec3f(.3,.27,.2),lb.a*lw*.9);gc=mix(gc,lc.rgb*vec3f(.42,.4,.22),lc.a*lw*.8);}
let rk=max(smoothstep(.85,1.45,sl+(t2.y-.5)*.6),z5*smoothstep(.44,.56,t3.x+(t2.x-.5)*.3)*.9);
let cane=smoothstep(2350.,2750.,a)*(1.-rk);
let bl=textureSample(noiseT,samp,w.xz*vec2f(2.9,.7)).x*textureSample(noiseT,samp,w.xz*vec2f(.8,3.1)).y;
gc=mix(gc,mix(vec3f(.1,.15,.045),vec3f(.2,.19,.07),z5)*(.45+1.1*t4.y)*(.5+2.2*bl),cane*.92);
let stt=textureSample(noiseT,samp,vec2f(w.y*.06+t2.x*.35,dot(w.xz,vec2f(.011,.008))));
var rc=mix(vec3f(.09,.085,.078),vec3f(.27,.25,.22),t2.x*.6+stt.y*.4)*(.5+.9*t1.y*(.5+t4.w))*(.65+.6*stt.x)*(1.-.45*smoothstep(.035,0.,abs(t4.x-.5)));
rc=mix(rc,vec3f(.06,.12,.03),smoothstep(.5,.7,t4.z)*(z2*(1.-z3)*.8+.15*(1.-z2)));
gc=mix(gc,rc,rk);
// distant canopy stands in for trees beyond the impostor range
let far=smoothstep(650.,1150.,d)*sat(cv*1.15);
var cc=mix(vec3f(.07,.15,.035),vec3f(.045,.105,.03),z1);cc=mix(cc,vec3f(.05,.1,.045),z2);cc=mix(cc,vec3f(.035,.07,.04),z3);cc=mix(cc,vec3f(.032,.068,.045),z4);cc=mix(cc,vec3f(.07,.1,.06),z5);
let cr=textureSample(noiseT,samp,w.xz*.021);let cr2=textureSample(noiseT,samp,w.xz*.0037);
cc*=.45+1.1*cr.x*(.6+.8*cr2.y);
gc=mix(gc,cc,far);n=normalize(n+vec3f(cr.y-.5,0.,cr.z-.5)*1.3*far);
let s2=shadow(i.rel,n);
let an=1.-cv*(1.-far)*(1.-leak(i.rel))*.9;
let sh=mix(an,s2.x,s2.y);
let ndl=sat(dot(n,g.sun.xyz));
let op=1.-.85*cv*(1.-far);let ao=.5+.5*op;
col=gc*(SUNC*sh*ndl+ambc(n,op)*ao);
// streams & waterfalls
if(d<900.&&i.hr.z>.05){
let v=nd(w.xz*vec2f(1./1700.,1./800.)+vec2f(3.1,9.2));let gw=v.yz*vec2f(1./1700.,1./800.);let ds=abs(v.x)/max(length(gw),1e-6);
let ww=1.3+2.6*(1.-sat(w.y/3400.));
let wm=smoothstep(ww,ww-.8,ds)*sat(i.hr.z*3.)*(1.-smoothstep(3250.,3450.,w.y))*(1.-smoothstep(600.,900.,d));
if(wm>0.){var fl=normalize(vec2f(-gw.y,gw.x));if(dot(fl,i.n.xz)<0.){fl=-fl;}
let sp=(1.2+5.*sat(sl))*g.cam.w;let u1=w.xz*.3-fl*sp*.3;
let f1=textureSample(noiseT,samp,u1).xy;let f2=textureSample(noiseT,samp,u1*2.7+vec2f(.3,.7)).zw;
let wn=normalize(vec3f((f1.x+f2.x-1.)*.5,1.,(f1.y+f2.y-1.)*.5)+vec3f(i.n.x,0.,i.n.z)*.6);
let fr=.03+.97*pow(1.-sat(dot(wn,V)),5.);let R=reflect(-V,wn);
var wc=mix(gc*.3*(SUNC*sh*.4+ambc(wn,op)*ao)+vec3f(.003,.01,.008),mix(vec3f(.02,.05,.02),skyc(vec3f(R.x,abs(R.y),R.z))*.45,op*op),fr*.8);
wc+=SUNC*sh*pow(sat(dot(R,g.sun.xyz)),120.)*.8;
let fo=sat((sl-.55)*2.2)*smoothstep(.7,1.1,f1.x+f2.y+sl*.2);
wc=mix(wc,vec3f(.55,.6,.62)*(SUNC*sh*.25+ambc(vec3f(0.,1.,0.),op)*ao),sat(fo*1.5));
col=mix(col,wc,wm);}}
}
return vec4f(tm(fog(col,i.rel)),1.);}

// ---------------- vegetation / animals / props ----------------
struct VI{@location(0)p:vec3f,@location(1)n:vec4f,@location(2)uv:vec2f,@location(3)c:vec4f,@location(4)m:vec4f,@location(5)ia:vec4f,@location(6)ib:vec4f}
struct VO{@builtin(position)pos:vec4f,@location(0)rel:vec3f,@location(1)n:vec3f,@location(2)uv:vec2f,@location(3)c:vec3f,@location(4)@interpolate(flat)m:vec2u,@location(5)af:vec3f}
fn xf(v:VI,wind:f32)->VO{
var p=v.p*v.ia.w;var n=v.n.xyz;let an=u32(v.m.w*255.+.5);let t=g.cam.w;let ck=v.ib.w;let sc=v.ia.w;
if(an==1u||an==2u){let s=sin(ck+f32(an-1u)*3.14159);let k=sat((v.uv.x-v.p.y)/v.uv.y);p.z+=s*.42*v.uv.y*k*sc;p.y+=max(s,0.)*.1*v.uv.y*k*sc;}
else if(an==3u){let gz=smoothstep(.15,.75,sin(ck*.11+v.ib.y*9.));p.y-=gz*v.uv.x*v.uv.y*.85*sc;p.z+=gz*v.uv.x*v.uv.y*.2*sc;p.x+=sin(t*.7+v.ib.y*5.)*.03*v.uv.x*sc;}
else if(an==4u){let am=select(.75,1.15,v.m.x*255.>.5);let a=sin(ck)*am;let r=abs(p.x);p.y+=r*sin(a);p.x=sign(p.x)*r*cos(a);}
else if(an==5u){p.x+=sin(ck*.35+t*1.3)*v.uv.x*sc*(1.+abs(v.p.z)*2.);}
else if(an==6u){let a=ck;let c=cos(a);let s=sin(a);p=vec3f(p.x*c-p.y*s,p.x*s+p.y*c,p.z);let b=ck*.7;p=vec3f(p.x,p.y*cos(b)-p.z*sin(b),p.y*sin(b)+p.z*cos(b));n=vec3f(0.,1.,0.);}
let c=cos(v.ia.x*0.+v.ib.x);let s=sin(v.ib.x);
p=vec3f(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);n=vec3f(c*n.x+s*n.z,n.y,-s*n.x+c*n.z);
if(an==0u&&wind>0.){
let wp=v.ia.xz+g.cam.xz;let ph=(v.ib.y+v.m.z)*6.283;let st=g.wind.z;
let gu=.5+.5*sin(t*.6+dot(wp,vec2f(.045,.06)))*sin(t*.23+wp.x*.01);
let hgt=max(p.y,0.);
var o=vec3f(g.wind.x,0.,g.wind.y)*hgt*hgt*5e-4*st*(.4+gu)*(1.+.35*sin(t*1.25+v.ib.y*40.));
let fl=v.c.a*st*(.5+gu);
o+=fl*vec3f(sin(t*2.1+ph+p.y*.6),.5*sin(t*2.9+ph*1.7+p.x*.8),cos(t*1.8+ph+p.z*.7))*.085;
p+=o;}
var o:VO;o.rel=v.ia.xyz+p;o.n=n;o.uv=v.uv;o.c=v.c.rgb;o.m=vec2u(u32(v.m.x*255.+.5),u32(v.m.y*255.+.5));o.af=vec3f(v.n.w,v.ib.z,p.y);return o;}
@vertex fn vv(v:VI)->VO{var o=xf(v,1.);o.pos=g.vp*vec4f(o.rel,1.);return o;}
@vertex fn vs(v:VI)->VO{var o=xf(v,1.);o.pos=g.sh[CASC]*vec4f(o.rel,1.);return o;}
@vertex fn vb(v:VI)->VO{var o=xf(v,0.);let e=v.ib.w;o.pos=vec4f(o.rel.x/e,o.rel.y/e-1.,.5-o.rel.z/(4.*e),1.);return o;}
fn auv(cell:u32,uv:vec2f)->vec2f{return (vec2f(f32(cell%4u),f32(cell/4u))+clamp(uv,vec2f(.012),vec2f(.988)))*.25;}
fn surf(i:VO)->vec4f{
let mat=i.m.x;let cell=i.m.y;
let t=textureSample(atlasT,samp,auv(cell,i.uv));
let nz=textureSample(noiseT,samp,i.uv*vec2f(.9,.17));let ny=textureSample(noiseT,samp,i.uv*vec2f(3.1,.055));
if(mat==1u){let lc=t.rgb*i.c*.7;return vec4f(mix(vec3f(dot(lc,vec3f(.3,.6,.1))),lc,.78),t.a);}
if(mat==0u){var k=.3+1.4*nz.x*(.5+1.*ny.z);
if(cell==1u){k=.85+.3*nz.x-.55*smoothstep(.06,0.,abs(fract(i.uv.y*2.4)-.5));}
else if(cell==2u){k=.45+1.1*ny.y*(.7+.6*nz.z);}
else if(cell==3u){k=.5+smoothstep(.35,.6,nz.z)*.9*(.7+.6*ny.x);}
else if(cell==4u){k=.75+.45*ny.y;}
return vec4f(i.c*k,1.);}
var c=i.c;if(cell==1u){c*=.55+.9*nz.x;}
return vec4f(c,1.);}
@fragment fn fv(i:VO)->@location(0)vec4f{
var s=surf(i);let mat=i.m.x;var al=1.;
if(mat==1u){al=sat((s.a-.4)/max(fwidth(s.a),.03)+.5);}
al*=i.af.y;if(al<.02){discard;}
var n=normalize(i.n);let V=normalize(-i.rel);let alt=i.rel.y+g.cam.y;
if((mat==0u&&i.m.y!=1u)||(mat==2u&&i.m.y==1u)){let bn=textureSample(noiseT,samp,i.uv*vec2f(1.3,.3)).xyz+textureSample(noiseT,samp,i.uv*vec2f(4.,.9)).yzx*.6-.8;n=normalize(n+bn*.9);}
if((mat==0u&&i.m.y!=1u)||(mat==2u&&i.m.y==1u)){
let wet=smoothstep(1250.,1700.,alt)*(1.-smoothstep(2550.,3050.,alt))*.8+(1.-smoothstep(200.,1700.,alt))*.22+.08*(1.-smoothstep(2900.,3300.,alt))+f32(mat==2u)*.3*(1.-smoothstep(2500.,3100.,alt));
let mn=textureSample(noiseT,samp,i.uv*vec2f(.35,.3)+i.rel.xz*.0).w+textureSample(noiseT,samp,i.uv*1.7).z*.5;
let mk=smoothstep(.95,.6,mn+(1.-wet)*.75-n.y*.2-.25*exp(-max(i.af.z,0.)*.5)+f32(mat==2u)*.12);
s=vec4f(mix(s.rgb,vec3f(.06,.13,.025)*(.6+.9*mn),mk*sat(wet*2.5)),1.);}
let s2=shadow(i.rel,n);let sh=mix(1.,s2.x,s2.y);let L=g.sun.xyz;let ndl=dot(n,L);
var dif=sat(ndl);var tr=0.;var sp=0.;
if(mat==1u){dif=sat(ndl*.6+.4);tr=pow(sat(dot(-V,L)),3.)*.35+sat(-ndl)*.25;sp=pow(sat(dot(n,normalize(L+V))),24.)*.05;}
let ao=i.af.x;let op=mix(g.zw.z,1.,sat(i.af.z/24.));
var col=s.rgb*(SUNC*sh*(dif*(.3+.7*ao)+tr*ao*vec3f(.8,.85,.45))+ambc(n,op)*ao*(.55+.45*op))+SUNC*sh*sp;
return vec4f(tm(fog(col,i.rel)),al);}
@fragment fn fs(i:VO){if(i.m.x==1u){if(textureSampleLevel(atlasT,samp,auv(i.m.y,i.uv),0.).a*i.af.y<.4){discard;}}else if(i.af.y<.5){discard;}}
struct BF{@location(0)c:vec4f,@location(1)n:vec4f}
@fragment fn fb(i:VO)->BF{let s=surf(i);if(i.m.x==1u&&s.a<.42){discard;}var n=normalize(i.n);if(n.z<0.){n.z=-n.z*.4;}
return BF(vec4f(s.rgb,1.),vec4f(normalize(n)*.5+.5,i.af.x));}

// ---------------- impostors ----------------
struct IO{@builtin(position)pos:vec4f,@location(0)rel:vec3f,@location(1)uv:vec2f,@location(2)rt:vec3f,@location(3)fd:vec3f}
@vertex fn vi(@builtin(vertex_index)vx:u32,@location(5)ia:vec4f,@location(6)ib:vec4f)->IO{
let k=u32(ib.x+.5);let e=g.imp[k].x*ia.w;let c=vec2f(f32(vx&1u),f32(vx>>1u));
let tc=normalize(vec2f(-ia.x,-ia.z));let rt=vec3f(tc.y,0.,-tc.x);
var p=ia.xyz+rt*(c.x*2.-1.)*e+vec3f(0.,c.y*2.*e,0.);
let wp=ia.xz+g.cam.xz;let gu=.5+.5*sin(g.cam.w*.6+dot(wp,vec2f(.045,.06)))*sin(g.cam.w*.23+wp.x*.01);
let hy=c.y*2.*e;p+=vec3f(g.wind.x,0.,g.wind.y)*hy*hy*5e-4*g.wind.z*(.4+gu)*(1.+.35*sin(g.cam.w*1.25+ib.y*40.));
let fl=select(1.,-1.,fract(ib.y*7.3)>.5);let u=select(c.x,1.-c.x,fl<0.);
var o:IO;o.rel=p;o.uv=(vec2f(f32(k%4u),f32(k/4u))+vec2f(u,1.-c.y)*.996+.002)/vec2f(4.,3.);o.rt=rt*fl;o.fd=vec3f(ib.z,c.y*2.*e/max(g.imp[k].y*ia.w,1.),hy);
o.pos=g.vp*vec4f(p,1.);return o;}
@fragment fn fi(i:IO)->@location(0)vec4f{
let t=textureSample(impC,samp,i.uv);let nm=textureSample(impN,samp,i.uv);
let al=sat((t.a-.38)/max(fwidth(t.a),.04)+.5)*i.fd.x;if(al<.02){discard;}
let nl=nm.xyz*2.-1.;let fw=normalize(vec3f(-i.rel.x,0.,-i.rel.z));
let n=normalize(i.rt*nl.x+vec3f(0.,1.,0.)*nl.y+fw*nl.z);let V=normalize(-i.rel);let L=g.sun.xyz;let ndl=dot(n,L);
let s2=shadow(i.rel,n);let dp=mix(.3,1.,smoothstep(.05,.6,i.fd.y));let sh=mix(dp,s2.x,s2.y);
let dif=sat(ndl*.6+.4);let tr=pow(sat(dot(-V,L)),3.)*.35+sat(-ndl)*.25;let ao=nm.a;
let alt=i.rel.y+g.cam.y;let ms=smoothstep(1300.,1750.,alt)*(1.-smoothstep(2550.,3000.,alt));
var a=t.rgb*mix(vec3f(1.),vec3f(.85,1.05,.8),ms*.5);
var col=a*(SUNC*sh*(dif*(.3+.7*ao)+tr*ao*vec3f(.7,.9,.25))+ambc(n,mix(.35,1.,dp))*ao*mix(.6,1.,dp));
return vec4f(tm(fog(col,i.rel)),al);}

// ---------------- sky + far ocean ----------------
struct SO{@builtin(position)pos:vec4f,@location(0)ndc:vec2f}
@vertex fn vq(@builtin(vertex_index)i:u32)->SO{let p=vec2f(f32(i&1u)*4.-1.,f32(i>>1u)*4.-1.);return SO(vec4f(p,0.,1.),p);}
fn ray(ndc:vec2f)->vec3f{let p=g.ivp*vec4f(ndc,1.,1.);return normalize(p.xyz/p.w);}
@fragment fn fsky(i:SO)->@location(0)vec4f{
let dir=ray(i.ndc);var c:vec3f;var rel=dir*6e4;
let t=g.cam.y/max(-dir.y,1e-5);
if(dir.y<0.&&t<6e4){rel=dir*t;c=ocean(rel.xz+g.cam.xz,60.,-dir,t);}
else{c=skyc(dir)+SUNC*smoothstep(.99988,.99996,dot(dir,g.sun.xyz))*6.;
let cu=dir.xz/(abs(dir.y)+.12);let ci=textureSample(noiseT,samp,cu*vec2f(.11,.3)+g.cam.w*.0007).x*textureSample(noiseT,samp,cu*.047).y;
c=mix(c,vec3f(1.25,1.25,1.3),smoothstep(.3,.62,ci)*.55*smoothstep(0.,.25,dir.y));}
return vec4f(tm(fog(c,rel)),1.);}

// ---------------- pollen + fireflies ----------------
struct PO{@builtin(position)pos:vec4f,@location(0)rel:vec3f,@location(1)c:vec2f,@location(2)k:vec2f}
@vertex fn vp(@builtin(vertex_index)vx:u32,@builtin(instance_index)ii:u32)->PO{
let c=vec2f(f32(vx&1u),f32(vx>>1u))*2.-1.;let fly=ii>=${NPOL}u;let t=g.cam.w;
var n=ii*747796405u+2891336453u;n=((n>>((n>>28u)+4u))^n)*277803737u;n^=n>>22u;
let h=vec3f(f32(n&1023u),f32((n>>10u)&1023u),f32(n>>20u))/vec3f(1023.,1023.,4095.);
var L=vec3f(16.,9.,16.);var b=h*L+vec3f(sin(t*.31+h.x*20.)*.5+g.wind.x*t*.35,sin(t*.4+h.y*30.)*.3-t*.03,cos(t*.27+h.z*25.)*.5+g.wind.y*t*.35);
var sz=.011;var wt=g.zw.x;
if(fly){L=vec3f(28.,3.2,28.);b=h*L+vec3f(sin(t*.5+h.x*40.)*1.5,sin(t*.8+h.y*40.)*.5,cos(t*.43+h.z*40.)*1.5);sz=.035;wt=g.misc.z;}
var q=(fract((b-g.cam.xyz)/L)-.5)*L;if(fly){q.y-=.9;}
let d=length(q);sz=max(sz,d*.0011)*select(1.,0.,h.x*.999>wt);
var o:PO;o.pos=g.vp*vec4f(q,1.);o.pos+=vec4f(c*sz*vec2f(g.res.y/g.res.x,1.)*g.zw.w,0.,0.);
o.rel=q;o.c=c;o.k=vec2f(f32(fly),smoothstep(.2,.9,sin(t*(1.5+h.y*2.)+h.z*60.))*smoothstep(1.5,5.,d));return o;}
@fragment fn fp(i:PO)->@location(0)vec4f{
let a=sat(1.-length(i.c));let s2=shadow(i.rel,vec3f(0.));let sh=mix(1.,s2.x,s2.y);
var col=vec3f(1.,.9,.6)*sh*a*a*.5;
if(i.k.x>.5){col=vec3f(.55,1.,.2)*a*a*i.k.y*(1.3-sh)*.7;}
return vec4f(col*fogT(i.rel),0.);}
`;
const POST = `
@group(1)@binding(0)var dT:texture_depth_multisampled_2d;
@group(1)@binding(1)var sT:texture_2d<f32>;
@group(1)@binding(2)var vT:texture_2d<f32>;
@group(1)@binding(3)var vZ:texture_2d<f32>;
struct VF{@location(0)c:vec4f,@location(1)z:vec4f}
@fragment fn fvol(i:SO)->VF{
let px=min(vec2i(i.pos.xy)*2,vec2i(g.res.xy)-1);let z=textureLoad(dT,px,0);
let dir=ray(i.ndc);let fwd=ray(vec2f(0.));
let vd=min(${NEAR}/max(z,1e-9),6e4);let t=vd/dot(dir,fwd);
let jit=fract(52.9829189*fract(dot(i.pos.xy,vec2f(.06711056,.00583715))));
var ins=vec3f(0.);var T=1.;
let sd=max(dot(dir,g.sun.xyz),0.);let ph=.22+2.6*pow(sd,6.)+.5*pow(sd,2.);
let tA=min(t,g.shc[1].w*1.5);let st=tA/14.;
for(var k=0;k<14;k++){let p=dir*((f32(k)+jit)*st);let y=p.y+g.cam.y;let s2=shadow(p,vec3f(0.));
let dn=RH*exp(-y/HH)*4.+RB*.5*g.misc.w*trap(y)+3e-4;
ins+=SUNC*s2.x*s2.y*dn*ph*st*.1;}
// sea of clouds / drifting mist in the cloud belt
let yb=1480.;let yt=2460.;let cy=g.cam.y;var t0=0.;var t1=t;
if(abs(dir.y)>1e-4){let ta=(yb-cy)/dir.y;let tb=(yt-cy)/dir.y;t0=max(min(ta,tb),0.);t1=min(max(ta,tb),t);}else if(cy<yb||cy>yt){t1=-1.;}
t1=min(t1,t0+30000.);
if(t1>t0){let sc=(t1-t0)/22.;let tw=g.cam.w;
for(var k=0;k<22;k++){let tt=t0+(f32(k)+jit)*sc;let w=dir*tt+g.cam.xyz;let hf=(w.y-yb)/(yt-yb);
let pr=smoothstep(0.,.3,hf)*smoothstep(1.,.5,hf);
var dz=textureSampleLevel(noise3,samp,w*vec3f(1./5600.,1./2100.,1./5600.)+vec3f(tw*.0011,0.,tw*.0006),0.).r;
if(tt<2500.){dz+=(textureSampleLevel(noise3,samp,w/380.+vec3f(tw*.012,tw*.002,0.),0.).r-.5)*.4*(1.-tt/2500.);}
let dn=sat((dz*pr-.3)*3.5);
if(dn>0.){let a=1.-exp(-dn*.0045*sc);
var lit=mix(vec3f(.5,.56,.66),vec3f(2.3,2.2,2.05),smoothstep(.25,.95,hf)*(.55+.45*dz));
lit=mix(lit,vec3f(.9,1.,1.15),sat(tt/45000.));
ins+=T*a*lit;T*=1.-a;if(T<.02){break;}}}}
return VF(vec4f(ins,T),vec4f(vd,0.,0.,1.));}
@fragment fn fcomp(i:SO)->@location(0)vec4f{
let px=vec2i(i.pos.xy);var c=textureLoad(sT,px,0).rgb;c=c/max(1.-max(c.r,max(c.g,c.b)),2e-3);
let vd=min(${NEAR}/max(textureLoad(dT,px,0),1e-9),6e4);
let hp=i.pos.xy*.5-.5;let b=vec2i(floor(hp));let f=hp-floor(hp);let mx=vec2i(textureDimensions(vT))-1;
var acc=vec4f(0.);var ws=0.;
for(var k=0;k<4;k++){let o=vec2i(k&1,k>>1);let q=clamp(b+o,vec2i(0),mx);
let wz=textureLoad(vZ,q,0).r;let wb=mix(1.-f.x,f.x,f32(o.x))*mix(1.-f.y,f.y,f32(o.y));
let wt=(wb+.02)/(.02+abs(wz-vd)/vd*30.);acc+=textureLoad(vT,q,0)*wt;ws+=wt;}
acc/=ws;c=c*acc.a+acc.rgb;
c*=g.misc.y;
c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);
let l=dot(c,vec3f(.2126,.7152,.0722));c=mix(vec3f(l),c,1.08);
let uv=i.pos.xy*g.res.zw;c*=1.-.3*pow(length(uv-.5)*1.3,2.6);
c=pow(max(c,vec3f(0.)),vec3f(1./2.2));
let dn=fract(52.9829189*fract(dot(i.pos.xy,vec2f(.06711056,.00583715))));
return vec4f(c+(dn-.5)/255.,1.);}
@group(1)@binding(0)var bT:texture_2d<f32>;
@fragment fn fblit(i:SO)->@location(0)vec4f{return textureSampleLevel(bT,samp,i.ndc*vec2f(.5,-.5)+.5,0.);}
`;
export const renderWGSL = COMMON + RENDER;
export const postWGSL = COMMON + RENDER + POST.replace(/@group\(1\)@binding\(0\)var bT[^]*$/, '');
export const blitWGSL = `@group(0)@binding(0)var bT:texture_2d<f32>;@group(0)@binding(1)var samp:sampler;
struct SO{@builtin(position)pos:vec4f,@location(0)ndc:vec2f}
@vertex fn vq(@builtin(vertex_index)i:u32)->SO{let p=vec2f(f32(i&1u)*4.-1.,f32(i>>1u)*4.-1.);return SO(vec4f(p,0.,1.),p);}
@fragment fn fblit(i:SO)->@location(0)vec4f{return textureSampleLevel(bT,samp,i.ndc*vec2f(.5,-.5)+.5,0.);}`;
// GPU-driven placement: every frame a compute pass scatters, culls and LODs all plants and animals.
export const computeWGSL = (NK, LB, LC, KT, KS) => COMMON + `
struct Inst{a:vec4f,b:vec4f}
@group(0)@binding(2)var<storage,read_write>inst:array<Inst>;
@group(0)@binding(3)var<storage,read_write>draws:array<atomic<u32>>;
const LB=${arr('u32', LB.map(x => x + 'u'))};const LC=${arr('u32', LC.map(x => x + 'u'))};
const KT=${arr('vec4f', KT.map(k => `vec4f(${k.map(x => x.toFixed(3))})`))};
const KS=${arr('vec4f', KS.map(k => `vec4f(${k.map(x => x.toFixed(3))})`))};
fn push(l:u32,a:vec4f,b:vec4f){let i=atomicAdd(&draws[l*5u+1u],1u);if(i>=LC[l]){atomicStore(&draws[l*5u+1u],LC[l]);return;}inst[LB[l]+i]=Inst(a,b);}
fn pcg(v:u32)->u32{let s=v*747796405u+2891336453u;let w=((s>>((s>>28u)+4u))^s)*277803737u;return (w>>22u)^w;}
fn h4(c:vec2i,k:u32)->vec4f{let a=pcg(u32(c.x)^pcg(u32(c.y)+k*0x9e3779b9u));let b=pcg(a);let d=pcg(b);let e=pcg(d);return vec4f(vec4u(a,b,d,e)>>vec4u(8u))/16777216.;}
fn vis(p:vec3f,r:f32)->bool{for(var i=0;i<5;i++){if(dot(g.fr[i].xyz,p)+g.fr[i].w<-r){return false;}}return true;}
fn emit(k:u32,p:vec3f,sc:f32,yaw:f32,seed:f32,fade:f32,aux:f32,r:f32,sc_:bool){
let a=vec4f(p,sc);let b=vec4f(yaw,seed,fade,aux);let c=p+vec3f(0.,r*.5,0.);
if(vis(c,r)){push(k*3u,a,b);}
if(sc_){if(distance(c,g.shc[0].xyz)<g.shc[0].w+r*1.3){push(k*3u+1u,a,b);}
if(distance(c,g.shc[1].xyz)<g.shc[1].w+r*1.3){push(k*3u+2u,a,b);}}}
fn excl(p:vec2f,m:f32)->f32{
if(distance(p,g.site[0].xy)<14.*m||distance(p,g.site[1].xy)<17.*m){return 0.;}
let q=p-g.site[2].xy;let r=length(q);if(abs(r-g.site[2].z)<5.*m&&dot(q/r,g.site[3].xy)>g.site[3].z-.01){return 0.;}
let b=p-g.site[4].xy;if(abs(dot(b,g.site[4].zw))<g.site[5].z+7.&&abs(b.y*g.site[4].z-b.x*g.site[4].w)<4.5*m){return 0.;}
return 1.;}
@compute @workgroup_size(8,8)fn trees(@builtin(global_invocation_id)id:vec3u){
let cs=6.;let cc=vec2i(floor(g.cam.xz/cs))+vec2i(id.xy)-${TG / 2};
let r=h4(cc,1u);let wp=(vec2f(cc)+.12+.76*r.xy)*cs;let rel=wp-g.cam.xz;let d=length(rel);
if(d>1200.){return;}
let keep=1.-.5*smoothstep(200.,1000.,d);if(r.z>keep){return;}
let hh=H(wp,d);let y=hh.x;if(y<2.5){return;}
let p=vec3f(rel.x,y-g.cam.y,rel.y);
if(d>${LR + 45}.&&!vis(p+vec3f(0.,18.,0.),45.)){return;}
let e=4.;let sl=length(vec2f(H(wp+vec2f(e,0.),d).x-y,H(wp+vec2f(0.,e),d).x-y))/e;
let a=zalt(wp,y);
if(r.w>cover(wp,a,sl,hh.y,y)*excl(wp,1.)){return;}
let q=h4(cc,2u);var tot=0.;var ws:array<f32,12>;
for(var k=0;k<12;k++){let t=KT[k];var w=t.w*sat((a-t.x)/t.z+.5)*sat((t.y-a)/t.z+.5);
if(k==2){w*=smoothstep(.02,.25,n1(wp/140.+vec2f(7.,1.)))*5.;}ws[k]=w;tot+=w;}
if(tot<1e-3){return;}
var pk=q.x*tot;var kind=0u;for(var k=0;k<12;k++){if(ws[k]>0.){kind=u32(k);if(pk<ws[k]){break;}pk-=ws[k];}}
let ks=KS[kind];var sc=ks.x+ks.y*q.y;if(kind<10u){sc*=1.-.42*smoothstep(3400.,3750.,a);}
let yaw=q.z*6.2832;let ht=ks.z*sc;let f=smoothstep(${LR - 7}.,${LR + 7}.,d);
if(f<1.){emit(kind,p,sc,yaw,q.w,1.-f,0.,ht,true);
if((kind==1u||kind==3u)&&(q.w<.16||g.sun.w>.5)&&d<110.){let c=cos(yaw);let s=sin(yaw);let l=vec3f(1.55,5.42,0.)*sc;
emit(21u,p+vec3f(c*l.x,l.y,-s*l.x),.85+q.x*.4,yaw+1.6+sin(g.cam.w*.2+q.y*20.)*.6,q.z,1.,g.cam.w*2.+q.x*30.,1.,true);}}
if(f>0.&&vis(p+vec3f(0.,ht*.5,0.),ht)){push(${NK * 3}u,vec4f(p,sc/sqrt(keep)*(1.-smoothstep(1050.,1200.,d))),vec4f(f32(kind),q.w,f,0.));}}
@compute @workgroup_size(8,8)fn under(@builtin(global_invocation_id)id:vec3u){
let cs=1.6;let cc=vec2i(floor(g.cam.xz/cs))+vec2i(id.xy)-${UG / 2};
let r=h4(cc,3u);let wp=(vec2f(cc)+.1+.8*r.xy)*cs;let rel=wp-g.cam.xz;let d=length(rel);
if(d>80.){return;}
let keep=1.-.55*smoothstep(25.,80.,d);if(r.z>keep){return;}
let hh=H(wp,d);let y=hh.x;if(y<1.2){return;}
let p=vec3f(rel.x,y-g.cam.y,rel.y);if(d>30.&&!vis(p,4.)){return;}
let e=1.5;let sl=length(vec2f(H(wp+vec2f(e,0.),d).x-y,H(wp+vec2f(0.,e),d).x-y))/e;
let a=zalt(wp,y);let q=h4(cc,4u);
let low=1.-smoothstep(450.,900.,a);let mid=smoothstep(300.,700.,a)*(1.-smoothstep(2300.,2700.,a));let alp=smoothstep(3350.,3650.,a);let hi=smoothstep(2400.,2700.,a);
var w=array<f32,5>(.13*low,.3*low+.4*mid,.09*low+.07*mid,alp*.6*smoothstep(-.12,.12,n1(wp/55.+vec2f(3.,8.)))+.04*smoothstep(2900.,3200.,a),.025+.1*alp+.45*smoothstep(16.,5.,hh.y)+.2*smoothstep(.7,1.3,sl));
if(hh.y<3.5){w[0]=0.;w[1]=0.;w[2]=0.;w[3]=0.;w[4]=.3;}
let ex=excl(wp,.65);var pk=q.x;var kind=99u;for(var k=0;k<5;k++){if(pk<w[k]*ex){kind=u32(k)+12u;break;}pk-=w[k];}
if(kind==99u){return;}
let ks=KS[kind];var sc=(ks.x+ks.y*q.y)*(1.-smoothstep(66.,80.,d))/sqrt(keep)*smoothstep(.5,2.2,d);var pp=p;
if(kind==16u){sc=(.3+1.1*q.y*q.y+1.5*smoothstep(12.,3.,hh.y)*q.w)*smoothstep(.5,4.,d);pp.y-=.12*sc;}
emit(kind,pp,sc,q.z*6.2832,q.w,1.,0.,ks.z*sc,d<45.);}
@compute @workgroup_size(8,8)fn grass(@builtin(global_invocation_id)id:vec3u){
let cs=.55;let cc=vec2i(floor(g.cam.xz/cs))+vec2i(id.xy)-${GG / 2};
let r=h4(cc,5u);let wp=(vec2f(cc)+.05+.9*r.xy)*cs;let rel=wp-g.cam.xz;let d=length(rel);
if(d>41.){return;}
let keep=1.-.62*smoothstep(10.,40.,d);if(r.z>keep){return;}
let hh=H(wp,d);let y=hh.x;if(y<1.5||hh.y<2.6){return;}
let p=vec3f(rel.x,y-g.cam.y,rel.y);if(!vis(p,2.)){return;}
let a=zalt(wp,y);let q=h4(cc,6u);
let cane=smoothstep(2350.,2750.,a)*(1.-.45*smoothstep(3650.,3900.,a))*excl(wp,.25);let low=(1.-smoothstep(2300.,2700.,a))*.32*excl(wp,.22);
let sc=(1.-smoothstep(34.,41.,d))/sqrt(keep)*smoothstep(.3,1.5,d);
if(r.w<cane){push(51u,vec4f(p,sc*(.7+.6*q.x)*mix(.95,.5,smoothstep(3150.,3800.,a))),vec4f(q.y*6.2832,q.z,1.,0.));}
else if(r.w<cane+low){push(54u,vec4f(p,sc*(.7+.9*q.x)),vec4f(q.y*6.2832,q.z,1.,0.));}}
@compute @workgroup_size(8,8,1)fn life(@builtin(global_invocation_id)id:vec3u){
let t=g.cam.w;let ty=id.z;var csa=array<f32,5>(7.,300.,30.,44.,3.4);let cs=csa[ty];
let cc=vec2i(floor(g.cam.xz/cs))+vec2i(id.xy)-8;let r=h4(cc,10u+ty);let q=h4(cc,20u+ty);
let home=(vec2f(cc)+.2+.6*r.xy)*cs;let d=distance(home,g.cam.xz);
let hh=H(home,d);if(hh.x<3.){return;}let a=zalt(home,hh.x);
let zoo=g.sun.w>.5;
if(ty==0u){if(r.z>.4*(1.-smoothstep(900.,1900.,a))&&!zoo){return;}
let o=vec2f(sin(t*.6+q.x*6.28)*2.6+sin(t*1.7+q.y*9.)*.8,cos(t*.5+q.z*6.28)*2.6+cos(t*1.4+q.w*9.)*.8);
let v=vec2f(cos(t*.6+q.x*6.28)*1.56+cos(t*1.7+q.y*9.)*1.36,-sin(t*.5+q.z*6.28)*1.3-sin(t*1.4+q.w*9.)*1.12);
let w=home+o;emit(19u,vec3f(w.x-g.cam.x,H(w,d).x+1.3+.7*sin(t*.9+q.w*6.)-g.cam.y,w.y-g.cam.z),1.+r.w,atan2(v.x,v.y),q.x,1.,t*24.+q.x*10.,.6,false);}
else if(ty==1u){if(r.z>.45&&!zoo){return;}let R=80.+70.*q.x;let om=11./R;
for(var j=0;j<9;j++){let fj=f32(j);let an=q.y*6.28+t*om-fj*.045*(1.+.3*sin(fj*1.7))+sin(fj*2.3)*.03;let rr=R+sin(fj*1.9+q.z*6.)*9.;
let w=home+rr*vec2f(cos(an),sin(an));
emit(20u,vec3f(w.x-g.cam.x,hh.x+42.+30.*q.w+sin(fj*2.7)*4.+sin(t*.4+fj)*2.-g.cam.y,w.y-g.cam.z),1.5+.5*q.z,atan2(-sin(an),cos(an)),q.x+fj*.1,1.,t*8.5+fj*1.3,1.,false);}}
else if(ty==2u){if((r.z>.55||a<250.||a>3100.)&&!zoo){return;}let R=3.+3.*q.x;let s=t*.45+1.6*sin(t*.17+q.z*6.);let an=q.y*6.28+s/R;
let w=home+R*vec2f(cos(an),sin(an));let sg=sign(.45+1.6*.17*cos(t*.17+q.z*6.));
emit(22u,vec3f(w.x-g.cam.x,H(w,d).x-g.cam.y,w.y-g.cam.z),1.+.25*q.w,atan2(-sin(an)*sg,cos(an)*sg),q.x,1.,s*11.,1.,true);}
else if(ty==3u){if((r.z>.6||a<2850.)&&!zoo){return;}let e=3.;let sl=length(vec2f(H(home+vec2f(e,0.),d).x-hh.x,H(home+vec2f(0.,e),d).x-hh.x))/e;
if((cover(home,a,sl,hh.y,hh.x)>.45||sl>.7)&&!zoo){return;}for(var j=0;j<3;j++){let fj=f32(j);let R=5.+6.*fract(q.x+fj*.37);let ph=q.z*6.+fj*2.1;let s=t*.5+3.*sin(t*.09+ph);let an=q.y*6.28+fj*2.+s/R;
let w=home+vec2f(fj*7.-7.,sin(fj*4.+q.w*6.)*6.)+R*vec2f(cos(an),sin(an));let sg=sign(.5+.27*cos(t*.09+ph));
emit(23u,vec3f(w.x-g.cam.x,H(w,d).x-g.cam.y,w.y-g.cam.z),.8+.35*fract(q.w+fj*.61),atan2(-sin(an)*sg,cos(an)*sg),fract(q.x+fj*.3),1.,s*5.5,2.,true);}}
else{if(r.z>.5*(1.-smoothstep(2000.,2700.,a))){return;}
let tt=fract(t*.05*(.7+.6*q.y)+q.z);let top=3.+15.*q.x;
let w=home+vec2f(sin(t*.8+q.x*30.),cos(t*.7+q.y*30.))*.8+g.wind.xy*tt*5.;
emit(24u,vec3f(w.x-g.cam.x,hh.x+top*(1.-tt)-g.cam.y,w.y-g.cam.z),.8+.8*q.w,q.z*6.28,q.x,1.,t*(2.+q.y*2.)+q.x*20.,.3,false);}}
`;
