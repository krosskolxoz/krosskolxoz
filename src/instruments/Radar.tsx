import { useEffect, useRef, useState } from 'react';
import { sim, useSimulation } from '../simulation/store';
import { rangeBearing, vesselCpa } from '../simulation/navigation';
import { WORLD } from '../simulation/world';
import { formatHeading, formatMinutes, projectRelative, unprojectRelative } from './projection';
import { prepareCanvas, useCanvas } from './useCanvas';
import './instruments.css';

export function Radar({ large = false }: { large?: boolean }) {
  const state = useSimulation();
  const [range, setRange] = useState(3);
  const [headUp, setHeadUp] = useState(false);
  const [gain, setGain] = useState(75);
  const [measure, setMeasure] = useState(false);
  const [cursor, setCursor] = useState<{ rangeM: number; bearing: number } | null>(null);
  const { ref, size } = useCanvas();
  // Ideal, deterministic 1 Hz training tracking. No ARPA convergence/noise claims.
  const sampledRef = useRef({ time: -1, own: state.own, traffic: state.traffic });
  if (state.time < sampledRef.current.time || Math.floor(state.time) > Math.floor(sampledRef.current.time)) {
    sampledRef.current = { time: state.time, own: { ...state.own, position: { ...state.own.position }, velocity: { ...state.own.velocity } }, traffic: state.traffic.map(v => ({ ...v, position: { ...v.position }, velocity: { ...v.velocity } })) };
  }
  const sampled = sampledRef.current;
  const selected = sampled.traffic.find(v => v.id === state.selectedTarget);
  const cpa = selected ? vesselCpa(sampled.own, selected) : null;
  const targetBearing = selected ? rangeBearing(sampled.own.position, selected.position, sampled.own.heading) : null;
  const orientation = headUp ? sampled.own.heading : 0;
  const radius = Math.max(1, Math.min(size.width, size.height) / 2 - 20);
  const ppm = radius / (range * 1852);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = prepareCanvas(canvas, size.width, size.height); if (!ctx) return;
    const cx = size.width / 2, cy = size.height / 2;
    ctx.fillStyle = '#081b1b'; ctx.fillRect(0, 0, size.width, size.height);
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.clip();
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    bg.addColorStop(0, '#0b2928'); bg.addColorStop(1, '#071c1e'); ctx.fillStyle = bg; ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.strokeStyle = '#24514a'; ctx.lineWidth = .7;
    for (let ring = 1; ring <= 4; ring++) { ctx.beginPath(); ctx.arc(0, 0, radius * ring / 4, 0, Math.PI * 2); ctx.stroke(); }
    for (let bearing = 0; bearing < 360; bearing += 30) {
      const a = (bearing - orientation) * Math.PI / 180;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a) * radius, -Math.cos(a) * radius); ctx.stroke();
    }
    // Real coast polygons share exactly the 3D scene's local coordinates.
    ctx.fillStyle = `rgba(70,149,92,${gain / 170})`; ctx.strokeStyle = `rgba(108,207,130,${gain / 105})`; ctx.lineWidth = 1.1;
    for (const polygon of WORLD.coasts) {
      ctx.beginPath(); polygon.forEach((point, index) => { const p = projectRelative(point, sampled.own.position, ppm, orientation); if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    const bridgeLeft = projectRelative({east:-2100,north:WORLD.bridgeNorth}, sampled.own.position, ppm, orientation);
    const bridgeRight = projectRelative({east:2100,north:WORLD.bridgeNorth}, sampled.own.position, ppm, orientation);
    ctx.strokeStyle = `rgba(145,190,109,${gain / 160})`; ctx.beginPath(); ctx.moveTo(bridgeLeft.x,bridgeLeft.y);ctx.lineTo(bridgeRight.x,bridgeRight.y);ctx.stroke();
    for (const buoy of WORLD.buoys) { const p = projectRelative(buoy, sampled.own.position, ppm, orientation); ctx.fillStyle = `rgba(124,238,131,${gain / 100})`; ctx.fillRect(p.x-1,p.y-1,2,2); }
    // Sweep is driven by simulation time, so pause and acceleration are coherent.
    const sweep = state.time * Math.PI / 2;
    for (let i = 0; i < 18; i++) { const a = sweep - i * .025; ctx.strokeStyle = `rgba(89,239,167,${.12 * (1-i/18)})`; ctx.beginPath(); ctx.moveTo(0,0);ctx.lineTo(Math.sin(a)*radius,-Math.cos(a)*radius);ctx.stroke(); }
    ctx.strokeStyle = '#72c8b4'; ctx.setLineDash([4,4]);
    const headingA = (sampled.own.heading - orientation) * Math.PI / 180;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.sin(headingA)*radius,-Math.cos(headingA)*radius);ctx.stroke();ctx.setLineDash([]);
    for (const vessel of sampled.traffic) {
      const p = projectRelative(vessel.position,sampled.own.position,ppm,orientation);
      const isSelected = vessel.id === state.selectedTarget;
      const alpha = Math.max(.08, gain / 100);
      ctx.fillStyle = `rgba(151,255,173,${alpha})`; ctx.shadowColor = '#83ef98';ctx.shadowBlur = gain > 60 ? 5 : 0;
      ctx.beginPath();ctx.ellipse(p.x,p.y,3.2,2.6,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      if (isSelected) { ctx.strokeStyle = '#ffc779';ctx.lineWidth=1;ctx.strokeRect(p.x-8,p.y-8,16,16); }
      const end = projectRelative({east:vessel.position.east+vessel.velocity.east*180,north:vessel.position.north+vessel.velocity.north*180},sampled.own.position,ppm,orientation);
      ctx.strokeStyle = isSelected ? '#f4cb82' : '#81bda2';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(end.x,end.y);ctx.stroke();
      ctx.fillStyle = isSelected ? '#f4cb82' : '#8dbab0';ctx.font='9px monospace';ctx.fillText(vessel.id.toUpperCase(),p.x+8,p.y-5);
    }
    if (cursor) {
      const a = (cursor.bearing-orientation)*Math.PI/180;
      const r = cursor.rangeM*ppm;
      ctx.strokeStyle='#dfc675';ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.sin(a)*radius,-Math.cos(a)*radius);ctx.stroke();ctx.setLineDash([]);
    }
    ctx.fillStyle='#a9e1d3';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.font='9px monospace';ctx.fillStyle='#7caaa5';ctx.textAlign='center';
    for(let b=0;b<360;b+=30){const a=(b-orientation)*Math.PI/180;ctx.fillText(String(b).padStart(3,'0'),cx+Math.sin(a)*(radius+11),cy-Math.cos(a)*(radius+11)+3);}
  }, [sampled, state.time, state.selectedTarget, size, range, headUp, gain, cursor]);

  return <div className={`instrument radar-instrument ${large?'instrument-large':''}`} data-testid="radar">
    <div className="instrument-controls">
      <div className="instrument-select-group"><label>RANGE <select aria-label="Radar range" value={range} onChange={e=>setRange(Number(e.target.value))}>{[.75,1.5,3,6].map(r=><option key={r} value={r}>{r} NM</option>)}</select></label><button className={headUp?'active':''} onClick={()=>setHeadUp(v=>!v)}>{headUp?'H-UP':'N-UP'}</button></div>
      <button className={measure?'active':''} onClick={()=>setMeasure(v=>!v)} title="Click radar to measure bearing and range">EBL / VRM</button>
    </div>
    <div className="instrument-plot radar-plot"><canvas ref={ref} aria-label="Interactive radar. Click a vessel to acquire target." onClick={e=>{
      const rect=e.currentTarget.getBoundingClientRect(); const x=e.clientX-rect.left-size.width/2,y=e.clientY-rect.top-size.height/2;
      if(Math.hypot(x,y)>radius)return;
      const position=unprojectRelative(x,y,sampled.own.position,ppm,orientation);
      if(measure){setCursor(rangeBearing(sampled.own.position,position));return;}
      const candidates=sampled.traffic.map(v=>({v,p:projectRelative(v.position,sampled.own.position,ppm,orientation)}));
      const nearest=candidates.sort((a,b)=>Math.hypot(a.p.x-x,a.p.y-y)-Math.hypot(b.p.x-x,b.p.y-y))[0];
      if(nearest&&Math.hypot(nearest.p.x-x,nearest.p.y-y)<20)sim.selectTarget(nearest.v.id);
    }}/><span className="plot-label plot-label-left">{range/4} NM / RING</span><span className="plot-label plot-label-right">TRUE · 3 MIN VECTORS</span></div>
    <div className="instrument-bottom"><label className="gain-control">GAIN <input type="range" aria-label="Radar gain" min={5} max={100} value={gain} onChange={e=>setGain(Number(e.target.value))}/><span>{gain}%</span></label><span className="instrument-timestamp">IDEAL · 1 Hz</span></div>
    {cursor&&<div className="measurement-readout">EBL {formatHeading(cursor.bearing)}°T <span>VRM {(cursor.rangeM/1852).toFixed(2)} NM</span></div>}
    {selected&&cpa&&targetBearing ? <div className="target-readout"><div><strong>{selected.name}</strong><button aria-label="Release radar target" onClick={()=>sim.selectTarget(null)}>×</button></div><div className="target-metrics"><span>CPA <b>{(cpa.dcpaFutureM/1852).toFixed(2)} NM</b></span><span>TCPA <b>{cpa.tcpaSignedS!==null&&cpa.tcpaSignedS<0?'OPENING':formatMinutes(cpa.tcpaSignedS)+' MIN'}</b></span><span>BRG <b>{formatHeading(targetBearing.bearing)}°</b></span><span>RNG <b>{(targetBearing.rangeM/1852).toFixed(2)} NM</b></span></div></div> : <div className="instrument-hint">CLICK A TARGET TO ACQUIRE · IDEAL TRAINING TRACKING</div>}
  </div>;
}
export default Radar;
