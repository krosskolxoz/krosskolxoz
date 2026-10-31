import type {Vessel,Vec2} from './types';
import {DEG} from './navigation';
/** Oriented hull rectangles. No hydrodynamic collision response is modeled. */
export function hullsOverlap(a:Vessel,b:Vessel){
 const delta={east:b.position.east-a.position.east,north:b.position.north-a.position.north};
 if(Math.hypot(delta.east,delta.north)>Math.hypot(a.length,a.beam)/2+Math.hypot(b.length,b.beam)/2)return false;
 const axes=(v:Vessel):[Vec2,Vec2]=>{const h=v.heading*DEG;return [{east:Math.sin(h),north:Math.cos(h)},{east:Math.cos(h),north:-Math.sin(h)}];};
 const aa=axes(a),bb=axes(b);const dot=(x:Vec2,y:Vec2)=>x.east*y.east+x.north*y.north;
 for(const axis of [...aa,...bb]){const extentA=Math.abs(dot(axis,aa[0]))*a.length/2+Math.abs(dot(axis,aa[1]))*a.beam/2;const extentB=Math.abs(dot(axis,bb[0]))*b.length/2+Math.abs(dot(axis,bb[1]))*b.beam/2;if(Math.abs(dot(delta,axis))>extentA+extentB)return false;}
 return true;
}
