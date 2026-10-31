import type { Vec2 } from '../simulation/types';
import { crossTrackDistance } from '../simulation/navigation';
import { chartDepth, WORLD } from '../simulation/world';

export function pointInPolygon(point: Vec2, polygon: Vec2[]) {
  let inside = false;
  for (let i = 0, j = polygon.length-1; i < polygon.length; j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.north>point.north)!==(b.north>point.north) && point.east < (b.east-a.east)*(point.north-a.north)/(b.north-a.north)+a.east) inside=!inside;
  }
  return inside;
}

/** Educational route check: synthetic bathymetry sampled every <=50 m. */
export function routeCheck(route: Vec2[], draft: number) {
  let minUkc=Infinity;
  let land=false;
  for(let leg=1;leg<route.length;leg++){
    const a=route[leg-1],b=route[leg];
    const count=Math.max(1,Math.ceil(Math.hypot(b.east-a.east,b.north-a.north)/50));
    for(let step=0;step<=count;step++){
      const t=step/count;
      const p={east:a.east+(b.east-a.east)*t,north:a.north+(b.north-a.north)*t};
      minUkc=Math.min(minUkc,chartDepth(p)-draft);
      if(WORLD.coasts.some(poly=>pointInPolygon(p,poly)))land=true;
    }
  }
  return {minUkc,land,safe:!land&&minUkc>=2};
}

export function nearestRouteLeg(point: Vec2, route: Vec2[]) {
  let closest=Infinity,xtd=0,index=0;
  for(let leg=1;leg<route.length;leg++){
    const a=route[leg-1],b=route[leg],dx=b.east-a.east,dy=b.north-a.north;
    const sq=dx*dx+dy*dy,t=sq?Math.max(0,Math.min(1,((point.east-a.east)*dx+(point.north-a.north)*dy)/sq)):0;
    const distance=Math.hypot(point.east-a.east-t*dx,point.north-a.north-t*dy);
    if(distance<closest){closest=distance;xtd=crossTrackDistance(point,a,b);index=leg;}
  }
  return {xtd,index};
}
