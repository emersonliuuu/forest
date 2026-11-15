import {genWorld,H,W,site,macro,MW,MH,OX,OZ,MC,LL,slopeAt} from '../source/src/world.js';
let t=Date.now();genWorld();console.log('gen ms',Date.now()-t,'S',W.S);
console.log('summit',site.slice(0,3),'sacred',site.slice(4,7),'rail',site.slice(8,15),'bridge',site.slice(16,24));
let s='';for(let j=0;j<MH;j+=20){for(let i=0;i<MW;i+=10){const h=macro[j*MW+i];s+=h<=0?' ':h<100?'.':h<500?':':h<1500?'o':h<2500?'O':h<3100?'#':h<3600?'%':'@';}s+='\n';}console.log(s);
// profile west->east through Yushan
const y=LL(120.957,23.47);let p='';for(let x=-12000;x<=8000;x+=500){p+=Math.round(H(x,y[1],0))+' ';}console.log(p);
let mx=0;for(let z=-22000;z<22000;z+=40)for(let x=-12000;x<12000;x+=40){const h=H(x,z,0);if(h>mx)mx=h;}console.log('global max',mx, 'summit H',H(site[0],site[1],0));
let sl=0,n=0;for(let i=0;i<4000;i++){const x=-6000+Math.random()*8000,z=-5000+Math.random()*10000;if(H(x,z,0)>500){sl+=slopeAt(x,z);n++}}console.log('mean slope',sl/n);
