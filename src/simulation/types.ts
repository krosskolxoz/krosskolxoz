export interface Vec2 { east:number; north:number }
export interface Vessel { id:string; name:string; position:Vec2; heading:number; surge:number; sway:number; yawRate:number; rudder:number; rudderCommand:number; engine:number; engineCommand:number; velocity:Vec2; sog:number; cog:number|null; length:number; beam:number; draft:number; desiredHeading?:number; avoidingUntil?:number }
export interface Sensors { time:number; position:Vec2|null; heading:number; sog:number; cog:number|null; depth:number }
export type Weather = 'sunset'|'night'|'fog';
export interface SimulationState { time:number; own:Vessel; traffic:Vessel[]; trail:Vec2[]; route:Vec2[]; timeScale:number; autopilot:boolean; targetHeading:number; current:Vec2; weather:Weather; gpsFailed:boolean; sensors:Sensors; selectedTarget:string|null; collisions:string[] }
