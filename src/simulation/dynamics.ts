import profile from './vessel-profile.json';
import type { Vec2, Vessel } from './types';
import { angleDifference, groundVelocity, knotsToMps, mpsToKnots, normalizeHeading, velocityCourse } from './navigation';
export {profile};
export const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export function updateGround(v:Vessel,current:Vec2){v.velocity=groundVelocity(v.heading,v.surge,v.sway,current);v.sog=mpsToKnots(Math.hypot(v.velocity.east,v.velocity.north));v.cog=velocityCourse(v.velocity);}
export function headingRudder(v:Vessel,target:number){return clamp(angleDifference(target,v.heading)*1.3-v.yawRate*42,-35,35);}
export function stepVessel(v:Vessel,current:Vec2,dt:number){
 v.rudder+=clamp(v.rudderCommand-v.rudder,-profile.rudderRateDegreesPerSecond*dt,profile.rudderRateDegreesPerSecond*dt);
 v.engine+=(v.engineCommand-v.engine)*(1-Math.exp(-dt/profile.engineLagSeconds));
 const service=knotsToMps(profile.serviceSpeedKnots);const thrust=v.engine>=0?v.engine:v.engine*(0.45**2);
 v.surge+=(thrust*service-v.surge*Math.abs(v.surge)/service)*dt/profile.surgeTimeSeconds;
 const effective=clamp(v.surge/service,-0.4,1.4);const targetYaw=profile.nomotoGainPerSecond*v.rudder*effective;
 v.yawRate+=(targetYaw-v.yawRate)*(1-Math.exp(-dt/profile.yawTimeSeconds));
 v.heading=normalizeHeading(v.heading+v.yawRate*dt);
 const targetSway=-v.yawRate*Math.PI/180*v.length*0.13;
 v.sway+=(targetSway-v.sway)*(1-Math.exp(-dt/profile.swayTimeSeconds));
 updateGround(v,current);v.position.east+=v.velocity.east*dt;v.position.north+=v.velocity.north*dt;
}
