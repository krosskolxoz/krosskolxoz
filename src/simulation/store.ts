import { useSyncExternalStore } from 'react';
import type { SimulationState,Vessel,Vec2,Weather } from './types';
import { knotsToMps } from './navigation';
import { clamp, headingRudder, profile,stepVessel,updateGround } from './dynamics';
import { updateTrafficCommands } from './traffic';
import { chartDepth } from './world';
import { hullsOverlap } from './collision';
export const STEP=1/60;
export function createVessel(id:string,name:string,position:Vec2,heading:number,speedKn=12):Vessel {const v:Vessel={id,name,position,heading,surge:knotsToMps(speedKn),sway:0,yawRate:0,rudder:0,rudderCommand:0,engine:1,engineCommand:1,velocity:{east:0,north:0},sog:speedKn,cog:heading,length:profile.length,beam:profile.beam,draft:profile.draft,desiredHeading:heading};updateGround(v,{east:0,north:0});return v;}
export function initialState():SimulationState {const own=createVessel('own','M/V MERIDIAN',{east:0,north:0},0);return {time:0,own,traffic:[createVessel('t1','PACIFIC DAWN',{east:90,north:2600},180,11),createVessel('t2','NORDIC STAR',{east:-1200,north:3600},78,9),createVessel('t3','COASTAL SPIRIT',{east:850,north:1800},354,8),createVessel('t4','OCEAN EXPLORER',{east:-700,north:6300},185,10)],trail:[{...own.position}],route:[{east:0,north:0},{east:0,north:2000},{east:0,north:4500},{east:500,north:7000}],timeScale:1,autopilot:false,targetHeading:0,current:{east:0,north:0},weather:'sunset',gpsFailed:false,sensors:{time:0,position:{...own.position},heading:0,sog:12,cog:0,depth:34},selectedTarget:null,collisions:[]};}
interface Scheduled {time:number;run:(sim:Simulation)=>void}
export class Simulation {
 state=initialState();private accumulator=0;private ticks=0;private scheduled:Scheduled[]=[];private listeners=new Set<()=>void>();private cached:SimulationState={...this.state};private publishTick=0;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
 getSnapshot=()=>this.cached;
 publish(){this.cached={...this.state,own:{...this.state.own,position:{...this.state.own.position}},traffic:this.state.traffic.map(v=>({...v,position:{...v.position}})),trail:[...this.state.trail],sensors:{...this.state.sensors}};for(const listener of this.listeners)listener();}
 advance(wallDeltaSeconds:number){if(!Number.isFinite(wallDeltaSeconds)||wallDeltaSeconds<0)throw new RangeError('Invalid wall delta');if(this.state.timeScale===0)return;this.accumulator+=wallDeltaSeconds*this.state.timeScale;let count=0;while(this.accumulator+1e-10>=STEP&&count<600){while(this.scheduled.length&&this.scheduled[0].time<=this.state.time+1e-9)this.scheduled.shift()!.run(this);this.step();this.accumulator-=STEP;if(this.accumulator<0&&this.accumulator>-1e-9)this.accumulator=0;count++;}if(this.ticks-this.publishTick>=6){this.publishTick=this.ticks;this.publish();}}
 private step(){const s=this.state;if(s.autopilot)s.own.rudderCommand=headingRudder(s.own,s.targetHeading);if(this.ticks%30===0)updateTrafficCommands(s);stepVessel(s.own,s.current,STEP);for(const v of s.traffic)stepVessel(v,s.current,STEP);this.ticks++;s.time=this.ticks*STEP;if(this.ticks%60===0){s.sensors={time:s.time,position:s.gpsFailed?null:{...s.own.position},heading:s.own.heading,sog:s.own.sog,cog:s.own.cog,depth:chartDepth(s.own.position)};s.trail.push({...s.own.position});if(s.trail.length>3600)s.trail.shift();}s.collisions=s.traffic.filter(v=>hullsOverlap(s.own,v)).map(v=>v.id);}
 reset(){this.state=initialState();this.accumulator=0;this.ticks=0;this.publishTick=0;this.scheduled=[];this.publish();}
 setRudder(deg:number){if(!Number.isFinite(deg))return;this.state.autopilot=false;this.state.own.rudderCommand=clamp(deg,-35,35);this.publish();}
 setEngine(order:number){if(!Number.isFinite(order))return;this.state.own.engineCommand=clamp(order,-1,1);this.publish();}
 setAutopilot(enabled:boolean,heading?:number){this.state.autopilot=enabled;if(heading!==undefined&&Number.isFinite(heading))this.state.targetHeading=((heading%360)+360)%360;else if(enabled)this.state.targetHeading=this.state.own.heading;this.publish();}
 setSpeed(factor:number){if(![0,1,2,4,8].includes(factor))throw new RangeError('Time scale must be 0,1,2,4 or 8');this.state.timeScale=factor;this.publish();}
 setWeather(weather:Weather){this.state.weather=weather;this.publish();}
 setGpsFailed(failed:boolean){this.state.gpsFailed=failed;if(failed)this.state.sensors.position=null;this.publish();}
 selectTarget(id:string|null){this.state.selectedTarget=id;this.publish();}
 setWaypoint(index:number,p:Vec2){if(this.state.route[index]&&Number.isFinite(p.east)&&Number.isFinite(p.north)){this.state.route[index]={...p};this.publish();}}
 addWaypoint(p:Vec2){if(Number.isFinite(p.east)&&Number.isFinite(p.north)){this.state.route.push({...p});this.publish();}}
 removeWaypoint(index:number){if(this.state.route.length>2){this.state.route.splice(index,1);this.publish();}}
 schedule(time:number,run:(sim:Simulation)=>void){this.scheduled.push({time,run});this.scheduled.sort((a,b)=>a.time-b.time);}
 snapshot(){return JSON.stringify({state:this.state,ticks:this.ticks,accumulator:this.accumulator});}
 restore(snapshot:string){const data=JSON.parse(snapshot);const s=data?.state;const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);const point=(v:Vec2)=>v&&finite(v.east)&&finite(v.north);const vessel=(v:Vessel)=>v&&typeof v.id==='string'&&typeof v.name==='string'&&point(v.position)&&point(v.velocity)&&[v.heading,v.surge,v.sway,v.yawRate,v.rudder,v.rudderCommand,v.engine,v.engineCommand,v.sog,v.length,v.beam,v.draft].every(finite)&&(v.cog===null||finite(v.cog));if(!s||!Number.isInteger(data.ticks)||data.ticks<0||!finite(data.accumulator)||data.accumulator<0||!Array.isArray(s.traffic)||!s.traffic.every(vessel)||!vessel(s.own)||!Array.isArray(s.route)||s.route.length<2||!s.route.every(point)||!Array.isArray(s.trail)||!s.trail.every(point)||!point(s.current)||![0,1,2,4,8].includes(s.timeScale)||!['sunset','night','fog'].includes(s.weather)||!finite(s.time)||!finite(s.targetHeading)||!s.sensors||!finite(s.sensors.time)||!(s.sensors.position===null||point(s.sensors.position))||!finite(s.sensors.depth))throw new Error('Invalid save');this.state=s;this.ticks=data.ticks;this.accumulator=data.accumulator;this.scheduled=[];this.publish();}
}
export const sim=new Simulation();
export function useSimulation(){return useSyncExternalStore(sim.subscribe,sim.getSnapshot,sim.getSnapshot);}
