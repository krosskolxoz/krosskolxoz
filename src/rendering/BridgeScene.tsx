import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { sim } from '../simulation/store';
import { WORLD } from '../simulation/world';

type Instrument = 'radar' | 'ecdis' | 'helm' | 'engine' | 'conning';
type Props = { view: string; onInstrument: (name: Instrument) => void };
const rad = Math.PI / 180;
const black = '#2b3a40';

function Box({ position, size, color = black, metal = .35, rotation, ...props }: {
  position: [number, number, number]; size: [number, number, number]; color?: string; metal?: number;
  rotation?: [number, number, number]; onClick?: () => void;
}) {
  return <mesh position={position} rotation={rotation} {...props} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.64} metalness={metal}/></mesh>;
}

function CameraRig({view}: {view: string}) {
  const {camera, gl} = useThree();
  const desired = useRef({yaw:0,pitch:-.03,fov:54});
  const current = useRef({yaw:0,pitch:-.03});
  useEffect(() => {
    desired.current = {yaw:view==='port'?.9:view==='starboard'?-.9:0,pitch:view==='helm'?-.48:-.03,fov:view==='helm'?50:54};
  },[view]);
  useEffect(() => {
    let dragging = false, px = 0, py = 0;
    const canvas=gl.domElement;
    const down = (e:PointerEvent) => { if(e.button!==0 && e.button!==2)return; dragging=true;px=e.clientX;py=e.clientY; };
    const move=(e:PointerEvent)=>{if(!dragging)return;desired.current.yaw=THREE.MathUtils.clamp(desired.current.yaw-(e.clientX-px)*.003,-1.5,1.5);desired.current.pitch=THREE.MathUtils.clamp(desired.current.pitch-(e.clientY-py)*.002,-.8,.5);px=e.clientX;py=e.clientY;};
    const up=()=>{dragging=false;};
    const wheel=(e:WheelEvent)=>{e.preventDefault();desired.current.fov=THREE.MathUtils.clamp(desired.current.fov+e.deltaY*.025,35,80);};
    const context=(e:MouseEvent)=>e.preventDefault();
    canvas.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('contextmenu',context);
    return()=>{canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('contextmenu',context);};
  },[gl]);
  useFrame((_,dt)=>{
    current.current.yaw=THREE.MathUtils.damp(current.current.yaw,desired.current.yaw,9,dt);
    current.current.pitch=THREE.MathUtils.damp(current.current.pitch,desired.current.pitch,9,dt);
    camera.position.set(0,16.85,7.8);
    camera.rotation.set(current.current.pitch,current.current.yaw,0,'YXZ');
    if(camera instanceof THREE.PerspectiveCamera){camera.fov=THREE.MathUtils.damp(camera.fov,desired.current.fov,9,dt);camera.updateProjectionMatrix();}
  });
  return null;
}

const skyVertex=`varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`;
const skyFragment=`varying vec3 vWorld; uniform float night; uniform float mist; uniform vec3 sunDir;
void main(){vec3 d=normalize(vWorld-vec3(0.,15.,0.)); float h=max(d.y,0.);vec3 top=mix(vec3(.22,.43,.59),vec3(.025,.055,.13),night);vec3 horizon=mix(vec3(1.,.75,.49),vec3(.23,.27,.36),night);vec3 col=mix(horizon,top,smoothstep(0.,.30,h));float glow=pow(max(dot(d,normalize(sunDir)),0.),35.);col+=vec3(.4,.16,.02)*glow*(1.-night);float sun=1.-smoothstep(.007,.011,distance(d,normalize(sunDir)));col=mix(col,vec3(1.,.92,.65),sun*(1.-night));col=mix(col,vec3(.52,.61,.63),mist*.75);gl_FragColor=vec4(col,1.);}`;
function Sky(){
  const mat=useRef<THREE.ShaderMaterial>(null);
  useFrame(()=>{if(mat.current){mat.current.uniforms.night.value=sim.state.weather==='night'?1:0;mat.current.uniforms.mist.value=sim.state.weather==='fog'?1:0;const h=sim.state.own.heading*rad;mat.current.uniforms.sunDir.value.set(-.37*Math.cos(h)-Math.sin(h),.045,.37*Math.sin(h)-Math.cos(h));}});
  return <mesh><sphereGeometry args={[38000,32,20]}/><shaderMaterial ref={mat} side={THREE.BackSide} depthWrite={false} vertexShader={skyVertex} fragmentShader={skyFragment} uniforms={{night:{value:0},mist:{value:0},sunDir:{value:new THREE.Vector3(-.37,.045,-1)}}}/></mesh>;
}
const seaVertex=`uniform float time; varying vec3 vWorld;varying float vWave;void main(){vec3 p=position;p.z+=sin(p.x*.035+time*.8)*.27+sin(p.y*.057-time*1.1)*.18;vWave=p.z;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const seaFragment=`uniform float time;uniform float night;uniform float mist;uniform float heading;varying vec3 vWorld;varying float vWave;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.;v+=noise(p)*.5;p=mat2(.8,-.6,.6,.8)*p*2.1;v+=noise(p)*.25;p=mat2(.6,-.8,.8,.6)*p*2.2;v+=noise(p)*.125;return v;}
void main(){
 vec2 p=vWorld.xz;vec3 eye=normalize(cameraPosition-vWorld);vec2 drift=vec2(time*.07,-time*.045);
 float broad=fbm(p*.025+drift);float fine=fbm(p*.31-drift*1.5);float aa=1.-smoothstep(4.,50.,length(fwidth(p)));
 float nx=sin(dot(p,vec2(.09,.06))+time*.7)*.07+sin(dot(p,vec2(-.05,.12))-time*.8)*.06+(broad-.45)*.26;
 float nz=cos(dot(p,vec2(.08,-.07))-time*.55)*.06+sin(dot(p,vec2(.03,.17))+time*.6)*.035+(fine-.45)*.12*aa;
 vec3 normal=normalize(vec3(nx,1.,nz));float fres=pow(1.-max(dot(eye,normal),0.),4.);
 vec3 col=mix(vec3(.035,.115,.14),vec3(.42,.53,.57),fres);col+=(broad-.45)*.085+(fine-.43)*.035*aa;
 vec2 light=mat2(cos(heading),-sin(heading),sin(heading),cos(heading))*normalize(vec2(-.37,-1.));vec3 sun=normalize(vec3(light.x,.045,light.y));
 float shine=pow(max(dot(normal,normalize(eye+sun)),0.),90.);float soft=pow(max(dot(normal,normalize(eye+sun)),0.),12.);
 col+=vec3(1.3,.75,.30)*shine*.72+vec3(.4,.23,.095)*soft*.16;
 float haze=1.-exp(-length(cameraPosition.xz-vWorld.xz)*.000075);col=mix(col,vec3(.72,.62,.50),haze*.50);
 col=mix(col,col*vec3(.18,.28,.48),night);col=mix(col,vec3(.53,.61,.63),mist*min(.92,length(cameraPosition.xz-vWorld.xz)*.0007));gl_FragColor=vec4(col,1.);}`;
function Ocean(){
  const material=useRef<THREE.ShaderMaterial>(null);
  useFrame(()=>{if(material.current){material.current.uniforms.time.value=sim.state.time;material.current.uniforms.night.value=sim.state.weather==='night'?1:0;material.current.uniforms.mist.value=sim.state.weather==='fog'?1:0;material.current.uniforms.heading.value=sim.state.own.heading*rad;}});
  return <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]}><planeGeometry args={[50000,50000,180,180]}/><shaderMaterial ref={material} vertexShader={seaVertex} fragmentShader={seaFragment} uniforms={{time:{value:0},night:{value:0},mist:{value:0},heading:{value:0}}}/></mesh>;
}

function Beam({a,b,r=.3,color='#754037'}:{a:number[];b:number[];r?:number;color?:string}){
  const {pos,quat,length}=useMemo(()=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);return {pos:av.clone().add(bv).multiplyScalar(.5),quat:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.clone().sub(av).normalize()),length:av.distanceTo(bv)};},[a.join(','),b.join(',')]);
  return <mesh position={pos} quaternion={quat}><cylinderGeometry args={[r,r,length,5]}/><meshStandardMaterial color={color} roughness={.7}/></mesh>;
}
function SuspensionBridge(){
 const cables=useMemo(()=>Array.from({length:49},(_,i)=>{const x=-1500+i*62.5;const y=78+118*Math.pow(Math.abs(x)/950,2);return {x,y:Math.min(190,y)};}),[]);
 return <group position={[0,0,-WORLD.bridgeNorth]} scale={[1,1.55,1]}>
   <Box position={[0,53,0]} size={[4200,11,34]} color="#6f6c64"/>
   <Box position={[0,59,-17]} size={[4200,2,1]} color="#8a5444"/>
   <Box position={[0,59,17]} size={[4200,2,1]} color="#8a5444"/>
   {[-950,950].map(x=><group key={x} position={[x,0,0]}>
     {[-25,25].map(z=><group key={z}><Box position={[0,103,z]} size={[28,206,18]} color="#ba6451"/><Box position={[0,18,z]} size={[29,36,24]} color="#8c382b"/></group>)}
     {[80,148,196].map(y=><Box key={y} position={[0,y,0]} size={[14,9,68]} color="#ba6451"/>)}
   </group>)}
   {[-19,19].map(z=><group key={z}>{cables.slice(1).map((p,i)=><Beam key={i} a={[cables[i].x,cables[i].y,z]} b={[p.x,p.y,z]} r={2.2}/>)}{cables.map((p,i)=><Beam key={i} a={[p.x,57,z]} b={[p.x,p.y,z]} r={.55} color="#544c43"/>)}</group>)}
   {[-1,1].map(s=><Beam key={s} a={[s*950,196,0]} b={[s*2050,59,0]} r={1.8}/>)}
   {[-950,950].map(x=><mesh key={x} position={[x,207,0]}><sphereGeometry args={[2.7,6,6]}/><meshBasicMaterial color="#ff5d47"/></mesh>)}
 </group>;
}
function Land(){
 const geometry=useMemo(()=>{
   const geom=new THREE.BufferGeometry();const vertices:number[]=[];
   for(const poly of WORLD.coasts){
     const contour=poly.map(p=>new THREE.Vector2(p.east,p.north));
     const triangles=THREE.ShapeUtils.triangulateShape(contour,[]);
     for(const tri of triangles)for(const index of tri){const p=poly[index];const height=Math.abs(p.east)>4000?260:Math.abs(p.east)>2400?110:5;vertices.push(p.east,height,-p.north);}
   }
   geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.computeVertexNormals();return geom;
 },[]);
 return <group><mesh geometry={geometry}><meshStandardMaterial color="#414e48" roughness={1} side={THREE.DoubleSide}/></mesh>
  {[-1,1].map(side=>Array.from({length:18},(_,i)=><Box key={`${side}-${i}`} position={[side*(2040+(i%4)*73),8+(i%3)*3,-2400-i*260]} size={[35+(i%3)*18,16+(i%3)*6,32]} color={i%3===0?'#b7b0a0':'#777e78'}/>))}
 </group>;
}
function Ship({id}:{id:string}){
 const ref=useRef<THREE.Group>(null);
 useFrame(()=>{const v=sim.state.traffic.find(t=>t.id===id);if(ref.current&&v){ref.current.position.set(v.position.east,0,-v.position.north);ref.current.rotation.y=-v.heading*rad;}});
 const ship=sim.state.traffic.find(t=>t.id===id);const length=ship?.length??150;const beam=ship?.beam??24;
 const hull=useMemo(()=>{const s=new THREE.Shape();s.moveTo(-beam*.5,length*.4);s.lineTo(-beam*.5,-length*.35);s.lineTo(-beam*.3,-length*.5);s.lineTo(0,-length*.55);s.lineTo(beam*.3,-length*.5);s.lineTo(beam*.5,-length*.35);s.lineTo(beam*.5,length*.4);s.closePath();return s;},[length,beam]);
 return <group ref={ref}><mesh rotation={[Math.PI/2,0,0]} position={[0,7,0]}><extrudeGeometry args={[hull,{depth:9,bevelEnabled:false}]}/><meshStandardMaterial color="#333f41" roughness={.65}/></mesh>
 <Box position={[0,7.3,0]} size={[beam*.9,2,length*.78]} color="#955d43"/>
 <Box position={[0,16,length*.27]} size={[beam*.8,16,length*.12]} color="#c6c2af"/>
 <Box position={[0,26,length*.26]} size={[beam*.88,5,length*.1]} color="#c6c2af"/>
 <Box position={[0,27.2,length*.205]} size={[beam*.78,1.8,.3]} color="#263e48"/>
 <Box position={[0,32,length*.29]} size={[3,9,4]} color="#d3aa6b"/>
 {[-.22,0,.22].map((z,i)=><Box key={i} position={[0,9,length*z]} size={[beam*.77,3,length*.15]} color={i%2?'#8c5540':'#ac8d61'}/>)}
 <mesh position={[0,.08,length*.82]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[beam*2,length]}/><shaderMaterial transparent depthWrite={false} vertexShader={`varying vec2 uvW;void main(){uvW=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec2 uvW;void main(){float line=abs(abs(uvW.x-.5)-(.08+(1.-uvW.y)*.4));float alpha=(1.-smoothstep(.005,.035,line))*uvW.y*.18;gl_FragColor=vec4(.74,.82,.76,alpha);}`}/></mesh>
 <Beam a={[0,9,-length*.35]} b={[0,22,-length*.35]} r={.5} color="#9e9c8a"/>
 <mesh position={[-beam*.48,25,length*.23]}><sphereGeometry args={[.8,5,5]}/><meshBasicMaterial color="#fa5141"/></mesh>
 <mesh position={[beam*.48,25,length*.23]}><sphereGeometry args={[.8,5,5]}/><meshBasicMaterial color="#83fc98"/></mesh>
 </group>;
}
function Buoy({east,north,color}:{east:number;north:number;color:string}){return <group position={[east,0,-north]}><mesh position={[0,1,0]}><cylinderGeometry args={[1.5,3,3,7]}/><meshStandardMaterial color={color}/></mesh><mesh position={[0,5,0]}><cylinderGeometry args={[.15,.15,7,5]}/><meshStandardMaterial color={color}/></mesh><mesh position={[0,9,0]}><sphereGeometry args={[.65,5,5]}/><meshBasicMaterial color={color}/></mesh></group>;}
function Exterior(){
 const root=useRef<THREE.Group>(null);
 const {scene}=useThree();
 const fog=useMemo(()=>new THREE.FogExp2('#d2a479',.000028),[]);
 useEffect(()=>{scene.fog=fog;return()=>{scene.fog=null;};},[scene,fog]);
 useFrame(()=>{
   if(root.current){const o=sim.state.own;root.current.rotation.y=o.heading*rad;root.current.position.set(0,0,0);const c=Math.cos(o.heading*rad),s=Math.sin(o.heading*rad);root.current.position.x=-o.position.east*c+o.position.north*s;root.current.position.z=o.position.east*s+o.position.north*c;}
   const weather=sim.state.weather;fog.color.set(weather==='night'?'#14202f':weather==='fog'?'#879c9f':'#d2a479');fog.density=weather==='fog'?.0007:.000028;
 });
 return <group ref={root}><Ocean/><SuspensionBridge/><Land/>{sim.state.traffic.map(v=><Ship key={v.id} id={v.id}/>)}{WORLD.buoys.map((b,i)=><Buoy key={i} east={b.east} north={b.north} color={b.east<0?'#dd4a35':'#4ba781'}/>)}</group>;
}

function makeScreen(kind:Instrument){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=320;
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;
 return {canvas,texture,kind};
}
function paintScreen(ctx:CanvasRenderingContext2D,kind:Instrument,time:number){
 const s=sim.state;ctx.fillStyle=kind==='ecdis'?'#bdcfca':'#0a2835';ctx.fillRect(0,0,512,320);
 ctx.fillStyle='#132c39';ctx.fillRect(0,0,512,28);ctx.font='bold 13px monospace';ctx.fillStyle='#accbd0';ctx.fillText(kind==='radar'?'BRIDGE MASTER  /  RADAR':kind==='ecdis'?'BRIDGE MASTER  /  ECDIS':'CONNING  /  NAVIGATION',15,19);
 if(kind==='radar'){
  const cx=199,cy=174,r=127;ctx.strokeStyle='#31534c';ctx.lineWidth=1;
  for(let i=1;i<5;i++){ctx.beginPath();ctx.arc(cx,cy,r*i/4,0,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy+r);ctx.stroke();
  const a=time*.35;ctx.strokeStyle='#4ec49c';ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.sin(a)*r,cy-Math.cos(a)*r);ctx.stroke();
  ctx.fillStyle='#a7f4a4';for(const t of s.traffic){let e=t.position.east-s.own.position.east,n=t.position.north-s.own.position.north;const x=cx+e/5556*r,y=cy-n/5556*r;if(Math.hypot(x-cx,y-cy)<r)ctx.fillRect(x-2,y-2,5,5);}
  ctx.fillStyle='#b3e9d1';ctx.font='14px monospace';ctx.fillText('N UP',360,65);ctx.fillText('3.0 NM',360,91);ctx.fillText('HDG',360,139);ctx.fillText(s.own.heading.toFixed(1)+'°',360,161);ctx.fillText('SOG',360,205);ctx.fillText(s.own.sog.toFixed(1)+' kn',360,227);
 }else if(kind==='ecdis'){
  const scale=512/12000;
  const map=(p:{east:number;north:number})=>[256+(p.east-s.own.position.east)*scale,245-(p.north-s.own.position.north)*scale];
  ctx.fillStyle='#9bad85';ctx.strokeStyle='#617c65';ctx.lineWidth=1;
  for(const poly of WORLD.coasts){ctx.beginPath();poly.forEach((p,i)=>{const [x,y]=map(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.fill();ctx.stroke();}
  ctx.strokeStyle='#779995';ctx.lineWidth=1;for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(i*70,29);ctx.lineTo(i*70,320);ctx.moveTo(0,45+i*50);ctx.lineTo(512,45+i*50);ctx.stroke();}
  ctx.strokeStyle='#b14d9d';ctx.lineWidth=2;ctx.setLineDash([7,4]);ctx.beginPath();s.route.forEach((p,i)=>{const [x,y]=map(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#257b85';ctx.beginPath();s.trail.forEach((p,i)=>{const [x,y]=map(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
  ctx.save();ctx.translate(256,245);ctx.rotate(s.own.heading*rad);ctx.fillStyle='#263f49';ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(-5,8);ctx.lineTo(5,8);ctx.fill();ctx.restore();
  for(const t of s.traffic){const [x,y]=map(t.position);ctx.fillStyle='#226c5f';ctx.fillRect(x-2,y-2,4,4);}
  ctx.fillStyle='#263f49';ctx.font='12px monospace';ctx.fillText('SAN FRANCISCO BAY',175,79);ctx.fillText('TRAINING CHART',337,306);
 }else{
  ctx.textAlign='center';ctx.font='11px monospace';ctx.fillStyle='#83a8af';ctx.fillText('HEADING / GYRO',137,64);ctx.fillText('SPEED OVER GROUND',380,64);ctx.font='48px monospace';ctx.fillStyle='#e2ede5';ctx.fillText(s.own.heading.toFixed(1)+'°',137,121);ctx.fillStyle='#68d5b5';ctx.fillText(s.own.sog.toFixed(1),380,121);ctx.font='14px monospace';ctx.fillStyle='#8ba7ae';ctx.fillText('RUDDER ANGLE',256,179);
  ctx.strokeStyle='#65838c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(256,272,77,Math.PI,Math.PI*2);ctx.stroke();ctx.strokeStyle='#7ce3b2';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(256,272);const a=(-90+s.own.rudder*2)*rad;ctx.lineTo(256+Math.cos(a)*67,272+Math.sin(a)*67);ctx.stroke();ctx.font='16px monospace';ctx.fillStyle='#d5e5df';ctx.fillText(s.own.rudder.toFixed(1)+'°',256,303);ctx.textAlign='left';
 }
}
function Screen({kind,position,width=2.15,onClick,rotation=[-.12,0,0]}:{kind:Instrument;position:[number,number,number];width?:number;onClick:()=>void;rotation?:[number,number,number]}){
 const data=useMemo(()=>makeScreen(kind),[kind]);const last=useRef(-1);
 useEffect(()=>()=>data.texture.dispose(),[data]);
 useFrame(()=>{if(sim.state.time-last.current>.12||sim.state.time<last.current){const ctx=data.canvas.getContext('2d');if(ctx)paintScreen(ctx,kind,sim.state.time);data.texture.needsUpdate=true;last.current=sim.state.time;}});
 return <group position={position} rotation={rotation} onClick={e=>{e.stopPropagation();onClick();}} onPointerOver={()=>document.body.style.cursor='pointer'} onPointerOut={()=>document.body.style.cursor=''}>
  <Box position={[0,0,0]} size={[width+.16,width*.625+.16,.13]} color="#091317"/>
  <mesh position={[0,.025,.072]}><planeGeometry args={[width,width*.625]}/><meshBasicMaterial map={data.texture} toneMapped={false}/></mesh>
  <Box position={[0,-width*.39,-.12]} size={[.28,.45,.2]} color="#18252a"/>
  <mesh position={[width*.43,-width*.34,.08]}><sphereGeometry args={[.017,6,6]}/><meshBasicMaterial color="#86d9a8"/></mesh>
 </group>;
}
function Helm({onClick}:{onClick:()=>void}){
 const wheel=useRef<THREE.Group>(null);
 useFrame(()=>{if(wheel.current)wheel.current.rotation.z=-sim.state.own.rudder*rad*2.6;});
 return <group position={[0,14.2,3.4]} rotation={[-.7,0,0]} onClick={e=>{e.stopPropagation();onClick();}}>
 <group ref={wheel}><mesh><torusGeometry args={[.58,.056,12,48]}/><meshStandardMaterial color="#684c30" roughness={.4} metalness={.12}/></mesh>
 {[0,120,240].map(a=><group key={a} rotation={[0,0,a*rad]}><Box position={[0,.28,0]} size={[.047,.55,.07]} color="#a7aa9f" metal={.8}/><Box position={[0,.62,0]} size={[.07,.2,.08]} color="#60462f"/></group>)}
 <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.13,.13,.16,20]}/><meshStandardMaterial color="#8c9697" metalness={.8} roughness={.3}/></mesh></group></group>;
}
function Interior({onInstrument}:{onInstrument:Props['onInstrument']}){
 const lighting=useRef<THREE.PointLight>(null);
 useFrame(()=>{if(lighting.current){lighting.current.color.set(sim.state.weather==='night'?'#ef6d48':'#e0ceaf');lighting.current.intensity=sim.state.weather==='night'?9:38;}});
 return <group>
  <Box position={[0,12.5,2]} size={[35,.25,18]} color="#354248" metal={.05}/>
  <Box position={[0,20.8,1]} size={[35,.35,16]} color="#263840"/>
  <Box position={[0,13.45,-2.25]} size={[35,2,1]} color="#343d3d"/>
  <Box position={[0,14.2,-2]} size={[35,.12,.4]} color="#85918d" metal={.8}/>
  {[-16.8,-12.6,-8.4,-4.2,4.2,8.4,12.6,16.8].map(x=><Box key={x} position={[x,17.55,-2.3]} size={[.12,6.65,.24]} color="#14242a" metal={.7}/>)}
  <Box position={[0,20.58,-2.3]} size={[35,.2,.28]} color="#101d23"/>
  <Box position={[0,14.3,-2.3]} size={[35,.25,.28]} color="#101d23"/>
  {[-1,1].map(side=><group key={side}>
    <Box position={[side*17.5,16.55,3]} size={[.25,8.5,13]} color="#293e45"/>
    <Box position={[side*9.1,13.15,.5]} size={[5,1.3,3.6]} color="#202d31"/>
    <Box position={[side*9.1,13.86,.5]} size={[5.3,.16,3.8]} color="#2a3639"/>
  </group>)}
  <Box position={[-5.6,13.4,-.4]} size={[5.8,1.8,2.5]} color="#263942"/>
  <Box position={[5.6,13.4,-.4]} size={[5.8,1.8,2.5]} color="#263942"/>
  <Box position={[-5.6,14.36,-.2]} size={[6,.18,2.8]} color="#3b515b"/>
  <Box position={[5.6,14.36,-.2]} size={[6,.18,2.8]} color="#3b515b"/>
  {[-1,1].map(side=><group key={'trim'+side}>
    <Box position={[side*5.6,14.23,1.12]} size={[5.7,.07,.055]} color="#82989c" metal={.8}/>
    {[-1.5,0,1.5].map(offset=><group key={offset}><Box position={[side*5.6+offset,13.35,.91]} size={[1.3,1.28,.025]} color="#2e454e"/><Box position={[side*5.6+offset,13.65,.95]} size={[.38,.055,.06]} color="#91a1a1" metal={.8}/></group>)}
  </group>)}
  <Box position={[0,13.1,3]} size={[2.8,1.2,2.5]} color="#263942"/>
  <Box position={[0,13.85,3]} size={[3.1,.2,2.6]} color="#3b515b" rotation={[-.08,0,0]}/>
  <Box position={[0,12.9,2.7]} size={[1.9,1.5,1.5]} color="#22343e"/>
  <Screen kind="radar" position={[-5.1,15.35,-.65]} width={2.5} rotation={[-.12,.11,0]} onClick={()=>onInstrument('radar')}/>
  <Screen kind="ecdis" position={[-2.4,15.25,-.7]} width={2.25} onClick={()=>onInstrument('ecdis')}/>
  <Screen kind="conning" position={[.05,15.23,-.65]} width={2.16} onClick={()=>onInstrument('conning')}/>
  <Screen kind="radar" position={[2.56,15.25,-.7]} width={2.3} onClick={()=>onInstrument('radar')}/>
  <Screen kind="ecdis" position={[5.35,15.35,-.65]} width={2.5} rotation={[-.12,-.11,0]} onClick={()=>onInstrument('ecdis')}/>
  <Screen kind="conning" position={[0,14.18,2.44]} width={1.32} rotation={[-.8,0,0]} onClick={()=>onInstrument('helm')}/>
  <Helm onClick={()=>onInstrument('helm')}/>
  <group position={[2.12,14.1,3.0]} onClick={e=>{e.stopPropagation();onInstrument('engine');}}>
   <Box position={[0,0,0]} size={[.8,.25,1.3]} color="#26383d"/>
   <Box position={[0,.2,-.1]} size={[.12,.5,.12]} color="#a9b5b2" metal={.8}/>
   <Box position={[0,.48,-.1]} size={[.6,.15,.23]} color="#161f21"/>
   {[-.35,0,.35].map(z=><Box key={z} position={[.32,.14,z]} size={[.08,.02,.04]} color="#d5ddc6"/>)}
  </group>
  {[[-6.3,14.52,.65],[-4,14.52,.65],[3.5,14.52,.65],[6.4,14.52,.65]].map((p,i)=><group key={i} position={p as [number,number,number]}>{Array.from({length:6},(_,j)=><mesh key={j} position={[j*.14,0,0]} rotation={[-Math.PI/2,0,0]}><cylinderGeometry args={[.043,.043,.024,8]}/><meshStandardMaterial color={j===0?'#be6750':'#6c8988'} roughness={.5}/></mesh>)}</group>)}
  <Box position={[-8.7,14.07,.4]} size={[.8,.2,.5]} color="#131d21" rotation={[0,.3,0]}/>
  <Box position={[-8.7,14.24,.4]} size={[.85,.12,.15]} color="#1b2324" rotation={[0,.3,0]}/>
  <pointLight ref={lighting} position={[0,17.8,3]} color="#e0ceaf" intensity={24} distance={23} decay={2}/>
  <pointLight position={[-4.5,15.3,1]} color="#51b8bc" intensity={2} distance={5}/>
  <pointLight position={[4,15.3,1]} color="#51b8bc" intensity={2} distance={5}/>
 </group>;
}
function Lighting(){
 const ambient=useRef<THREE.AmbientLight>(null),sun=useRef<THREE.DirectionalLight>(null);
 useFrame(()=>{const night=sim.state.weather==='night';if(ambient.current)ambient.current.intensity=night?.3:1.9;if(sun.current)sun.current.intensity=night?.12:2.6;});
 return <><ambientLight ref={ambient} color="#aabac0" intensity={1.25}/><directionalLight ref={sun} position={[-1200,800,-5000]} color="#ffd3a0" intensity={2.2}/><hemisphereLight color="#bdd5de" groundColor="#746453" intensity={1.2}/><directionalLight position={[7,22,10]} color="#c8e2ef" intensity={1.3}/></>;
}
export function BridgeScene({view,onInstrument}:Props){
 return <Canvas dpr={[1,1.6]} camera={{position:[0,16.85,7.8],fov:54,near:.1,far:50000}} gl={{antialias:true,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.16}} style={{background:'#b9a284',touchAction:'none'}}>
  <Suspense fallback={null}><CameraRig view={view}/><Sky/><Lighting/><Exterior/><Interior onInstrument={onInstrument}/></Suspense>
 </Canvas>;
}
