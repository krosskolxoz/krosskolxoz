import { useEffect, useMemo, useRef, useState } from 'react';
import { sim, useSimulation } from '../simulation/store';
import { localToGeo } from '../simulation/navigation';
import type { Vec2 } from '../simulation/types';
import { chartDepth, WORLD } from '../simulation/world';
import { nearestRouteLeg, routeCheck } from './route';
import { formatHeading, projectRelative, unprojectRelative } from './projection';
import { prepareCanvas, useCanvas } from './useCanvas';
import './instruments.css';

export function ECDIS({large=false}:{large?:boolean}) {
  const state=useSimulation();
  const [range,setRange]=useState(3);
  const [edit,setEdit]=useState(false);
  const [checked,setChecked]=useState(false);
  const [selectedWp,setSelectedWp]=useState<number|null>(null);
  const lastFix=useRef<Vec2>(state.sensors.position?{...state.sensors.position}:{east:0,north:0});
  const hasFix=useRef(state.sensors.position!==null);
  const lastFixTime=useRef(-1);
  const fixTrail=useRef<Array<Vec2 & {time:number}>>([]);
  if(state.time<lastFixTime.current){lastFixTime.current=-1;fixTrail.current=[];hasFix.current=state.sensors.position!==null;}
  if(state.sensors.position){
    lastFix.current={...state.sensors.position};hasFix.current=true;
    if(state.sensors.time>lastFixTime.current){fixTrail.current.push({...state.sensors.position,time:state.sensors.time});if(fixTrail.current.length>3600)fixTrail.current.shift();lastFixTime.current=state.sensors.time;}
  }
  const fix=lastFix.current;
  const {ref,size}=useCanvas();
  const ppm=size.height/(range*1852);
  const cx=size.width*.48,cy=size.height*.72;
  const drag=useRef<{index:number,x:number,y:number}|null>(null);
  const routeKey=state.route.map(p=>p.east+','+p.north).join(';');
  const routeStatus=useMemo(()=>routeCheck(state.route,state.own.draft),[routeKey,state.own.draft]);
  const routeLeg=nearestRouteLeg(fix,state.route);
  const geo=localToGeo(fix);

  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const ctx=prepareCanvas(canvas,size.width,size.height);if(!ctx)return;
    const project=(p:Vec2)=>{const s=projectRelative(p,fix,ppm);return {x:cx+s.x,y:cy+s.y};};
    ctx.fillStyle='#17404b';ctx.fillRect(0,0,size.width,size.height);
    // Synthetic water contours, derived from the same local coast geometry.
    for(const polygon of WORLD.coasts){
      ctx.beginPath();polygon.forEach((point,i)=>{const p=project(point);i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);});ctx.closePath();
      ctx.strokeStyle='#225762';ctx.lineWidth=70*ppm*10;ctx.stroke();ctx.strokeStyle='#2a6570';ctx.lineWidth=35*ppm*10;ctx.stroke();
      ctx.fillStyle='#73857c';ctx.fill();ctx.strokeStyle='#a2aaa0';ctx.lineWidth=1.2;ctx.stroke();
    }
    // Reference grid in local projection; geographic labels use localToGeo().
    ctx.strokeStyle='#37606a';ctx.lineWidth=.5;ctx.setLineDash([2,5]);
    const step=1000;
    const minE=fix.east-cx/ppm,maxE=fix.east+(size.width-cx)/ppm,minN=fix.north-(size.height-cy)/ppm,maxN=fix.north+cy/ppm;
    for(let e=Math.ceil(minE/step)*step;e<maxE;e+=step){const p=project({east:e,north:fix.north});ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,size.height);ctx.stroke();}
    for(let n=Math.ceil(minN/step)*step;n<maxN;n+=step){const p=project({east:fix.east,north:n});ctx.beginPath();ctx.moveTo(0,p.y);ctx.lineTo(size.width,p.y);ctx.stroke();}
    ctx.setLineDash([]);
    ctx.font='9px monospace';ctx.fillStyle='#7fa1a6';ctx.textAlign='center';
    for(let e=-1000;e<=1000;e+=500)for(let n=-1000;n<9000;n+=1000){const p=project({east:e,north:n});if(p.x>12&&p.x<size.width-12&&p.y>15&&p.y<size.height-15)ctx.fillText(chartDepth({east:e,north:n}).toFixed(0),p.x,p.y);}
    const bridgeL=project({east:-2100,north:WORLD.bridgeNorth}),bridgeR=project({east:2100,north:WORLD.bridgeNorth});
    ctx.strokeStyle='#b4b7a1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bridgeL.x,bridgeL.y);ctx.lineTo(bridgeR.x,bridgeR.y);ctx.stroke();
    ctx.fillStyle='#bac1ad';ctx.font='8px monospace';ctx.fillText('MERIDIAN BRIDGE',Math.max(65,Math.min(size.width-65,(bridgeL.x+bridgeR.x)/2)),bridgeL.y-7);
    for(const buoy of WORLD.buoys){const p=project(buoy);ctx.fillStyle=buoy.east<0?'#e68f7f':'#8ac78f';ctx.beginPath();ctx.moveTo(p.x,p.y-3);ctx.lineTo(p.x+3,p.y+3);ctx.lineTo(p.x-3,p.y+3);ctx.closePath();ctx.fill();}
    // Truth-derived trace is displayed only up to the last valid GPS sample.
    ctx.strokeStyle='#7ecbc6';ctx.lineWidth=1.25;ctx.beginPath();
    fixTrail.current.forEach((point,i)=>{const p=project(point);i===0||point.time-fixTrail.current[i-1].time>1.5?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);});ctx.stroke();
    ctx.strokeStyle='#e5b86b';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();state.route.forEach((point,i)=>{const p=project(point);i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);});ctx.stroke();ctx.setLineDash([]);
    state.route.forEach((point,i)=>{const p=project(point);ctx.strokeStyle=selectedWp===i?'#fff3b8':'#edc57f';ctx.fillStyle=selectedWp===i?'#826b3d':'#17404b';ctx.beginPath();ctx.arc(p.x,p.y,edit?6:3.5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#e1c080';ctx.textAlign='left';ctx.font='8px monospace';ctx.fillText('WP'+String(i).padStart(2,'0'),p.x+7,p.y-5);});
    for(const vessel of state.traffic){const p=project(vessel.position);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(vessel.heading*Math.PI/180);ctx.strokeStyle=state.selectedTarget===vessel.id?'#f6cf85':'#a0bfc0';ctx.fillStyle='#1a4550';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(3.5,4);ctx.lineTo(-3.5,4);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(0,-6-Math.max(8,vessel.sog*3));ctx.stroke();ctx.restore();}
    // GPS fix and gyro are sampled sensors; heading and COG are distinct.
    if(hasFix.current){ctx.save();ctx.translate(cx,cy);ctx.rotate(state.sensors.heading*Math.PI/180);ctx.strokeStyle=state.gpsFailed?'#ffc16f':'#cce9e0';ctx.fillStyle='#6ecbb5';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(4,6);ctx.lineTo(-4,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(0,-52);ctx.stroke();ctx.restore();}
    // North arrow and usable scale bar.
    ctx.strokeStyle='#c1d9d0';ctx.fillStyle='#c1d9d0';ctx.textAlign='center';ctx.font='10px monospace';ctx.fillText('N',size.width-17,17);ctx.beginPath();ctx.moveTo(size.width-17,23);ctx.lineTo(size.width-17,44);ctx.moveTo(size.width-21,29);ctx.lineTo(size.width-17,23);ctx.lineTo(size.width-13,29);ctx.stroke();
    const scaleNm=range<=1.5?.25:.5;const scalePixels=scaleNm*1852*ppm;ctx.beginPath();ctx.moveTo(12,size.height-19);ctx.lineTo(12+scalePixels,size.height-19);ctx.moveTo(12,size.height-22);ctx.lineTo(12,size.height-16);ctx.moveTo(12+scalePixels,size.height-22);ctx.lineTo(12+scalePixels,size.height-16);ctx.stroke();ctx.textAlign='left';ctx.font='8px monospace';ctx.fillText(scaleNm+' NM',12,size.height-7);
  },[state,size,range,edit,selectedWp]);

  const screenPoint=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  return <div className={`instrument ecdis-instrument ${large?'instrument-large':''}`} data-testid="ecdis">
    <div className="instrument-controls"><div className="instrument-select-group"><label>SCALE <select aria-label="ECDIS range" value={range} onChange={e=>setRange(Number(e.target.value))}>{[1.5,3,6,12].map(r=><option key={r} value={r}>{r} NM</option>)}</select></label><span className="chart-mode">N-UP · RELATIVE</span></div><button className={edit?'active':''} onClick={()=>{setEdit(v=>!v);setSelectedWp(null);}}>EDIT ROUTE</button></div>
    <div className="instrument-plot chart-plot"><canvas ref={ref} aria-label="Interactive synthetic ECDIS chart. Enable edit route to add or drag waypoints." onPointerDown={e=>{
      if(!edit)return;const p=screenPoint(e);const nearest=state.route.map((wp,index)=>{const pixel=projectRelative(wp,fix,ppm);return {index,distance:Math.hypot(cx+pixel.x-p.x,cy+pixel.y-p.y)};}).sort((a,b)=>a.distance-b.distance)[0];
      if(nearest&&nearest.distance<15){drag.current={index:nearest.index,...p};setSelectedWp(nearest.index);e.currentTarget.setPointerCapture(e.pointerId);}else{const nextIndex=state.route.length;sim.addWaypoint(unprojectRelative(p.x-cx,p.y-cy,fix,ppm));setChecked(false);setSelectedWp(nextIndex);}
    }} onPointerUp={e=>{
      if(!drag.current)return;const p=screenPoint(e);if(Math.hypot(p.x-drag.current.x,p.y-drag.current.y)>3){sim.setWaypoint(drag.current.index,unprojectRelative(p.x-cx,p.y-cy,fix,ppm));setChecked(false);}drag.current=null;
    }} onPointerCancel={()=>{drag.current=null;}}/>
    <span className="plot-label plot-label-left">SYNTHETIC TRAINING CHART</span><span className={`chart-fix ${state.gpsFailed?'fix-failed':''}`}>{state.gpsFailed?(hasFix.current?'GPS LOST · LAST FIX':'GPS LOST · NO FIX'):'GPS · VALID'}</span></div>
    <div className="instrument-bottom"><span>{hasFix.current?`${geo.lat.toFixed(4)}°N  ${Math.abs(geo.lon).toFixed(4)}°W`:'POSITION UNAVAILABLE'}</span><span>COG {state.sensors.cog===null?'—':formatHeading(state.sensors.cog)+'°'}</span></div>
    {large&&<div className="chart-navigation-data"><span>LEG <b>{routeLeg.index}</b></span><span className={Math.abs(routeLeg.xtd)>185.2?'warning':''}>XTD <b>{(Math.abs(routeLeg.xtd)/1852).toFixed(2)} NM {routeLeg.xtd<0?'P':'S'}</b></span><span>DEPTH <b>{state.sensors.depth.toFixed(1)} M</b></span><span>FIX AGE <b>{Math.max(0,state.time-lastFixTime.current).toFixed(0)} S</b></span></div>}
    <div className="chart-route-bar"><button onClick={()=>setChecked(true)}>CHECK ROUTE</button>{edit&&<button disabled={selectedWp===null||state.route.length<=2} onClick={()=>{if(selectedWp!==null)sim.removeWaypoint(selectedWp);setSelectedWp(null);setChecked(false);}}>DELETE WP</button>}<span className={checked&&!routeStatus.safe?'warning':''}>{checked?(routeStatus.safe?'CHECK CLEAR · UKC > 2 M':routeStatus.land?'DANGER · ROUTE CROSSES LAND':'DANGER · UKC BELOW 2 M'):edit?'CLICK TO ADD · DRAG TO MOVE':`${state.route.length} WAYPOINTS · ROUTE MONITOR`}</span></div>
  </div>;
}
export default ECDIS;
