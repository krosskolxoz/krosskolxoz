import type { Vec2, Vessel } from './types';
export const NM=1852;
export const DEG=Math.PI/180;
export const knotsToMps=(kn:number)=>kn*NM/3600;
export const mpsToKnots=(mps:number)=>mps*3600/NM;
export const normalizeHeading=(deg:number)=>((deg%360)+360)%360;
export const angleDifference=(target:number,current:number)=>normalizeHeading(target-current+180)-180;
export function groundVelocity(heading:number,surge:number,sway:number,current:Vec2):Vec2 {const h=heading*DEG;return {east:Math.sin(h)*surge+Math.cos(h)*sway+current.east,north:Math.cos(h)*surge-Math.sin(h)*sway+current.north};}
export function velocityCourse(v:Vec2):number|null {return Math.hypot(v.east,v.north)<1e-8?null:normalizeHeading(Math.atan2(v.east,v.north)/DEG);}
export function rangeBearing(own:Vec2,target:Vec2,heading=0){const e=target.east-own.east,n=target.north-own.north;const bearing=normalizeHeading(Math.atan2(e,n)/DEG);return {rangeM:Math.hypot(e,n),bearing,relativeBearing:normalizeHeading(bearing-heading)};}
export interface CpaInput { own:{positionM:[number,number];velocityMps:[number,number]};target:{positionM:[number,number];velocityMps:[number,number]} }
export function computeCpa(input:CpaInput,{relativeSpeedEpsilonMps=1e-6}={}) {const values=[...input.own.positionM,...input.own.velocityMps,...input.target.positionM,...input.target.velocityMps,relativeSpeedEpsilonMps];if(values.some(v=>!Number.isFinite(v))||relativeSpeedEpsilonMps<0)throw new RangeError('CPA requires finite coordinates, velocities and a nonnegative epsilon');const e=input.target.positionM[0]-input.own.positionM[0],n=input.target.positionM[1]-input.own.positionM[1],ve=input.target.velocityMps[0]-input.own.velocityMps[0],vn=input.target.velocityMps[1]-input.own.velocityMps[1];const speed=Math.hypot(ve,vn);const tcpaSignedS=speed<=relativeSpeedEpsilonMps?null:-(e*(ve/speed)+n*(vn/speed))/speed;const tcpaFutureS=tcpaSignedS===null?0:Math.max(0,tcpaSignedS);const dcpaFutureM=Math.hypot(e+ve*tcpaFutureS,n+vn*tcpaFutureS);if(!Number.isFinite(dcpaFutureM)||!(tcpaSignedS===null||Number.isFinite(tcpaSignedS)))throw new RangeError('CPA arithmetic overflow');return {tcpaSignedS,tcpaFutureS,dcpaFutureM};}
export function vesselCpa(own:Vessel,target:Vessel){return computeCpa({own:{positionM:[own.position.east,own.position.north],velocityMps:[own.velocity.east,own.velocity.north]},target:{positionM:[target.position.east,target.position.north],velocityMps:[target.velocity.east,target.velocity.north]}});}
export function localToGeo(position:Vec2){return {lat:37.70+position.north/111320,lon:-122.48+position.east/(111320*Math.cos(37.70*DEG))};}
export function crossTrackDistance(point:Vec2,start:Vec2,end:Vec2){const e=end.east-start.east,n=end.north-start.north,l=Math.hypot(e,n);return l<1e-8?Math.hypot(point.east-start.east,point.north-start.north):((point.east-start.east)*n-(point.north-start.north)*e)/l;}
export function greatCircleDistance(lat1:number,lon1:number,lat2:number,lon2:number){const a=Math.sin((lat2-lat1)*DEG/2)**2+Math.cos(lat1*DEG)*Math.cos(lat2*DEG)*Math.sin((lon2-lon1)*DEG/2)**2;return 6371008.8*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))));}
