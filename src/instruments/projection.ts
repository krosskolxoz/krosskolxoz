import type { Vec2 } from '../simulation/types';

/** North/east metres to screen pixels. Screen Y points down. */
export function projectRelative(point: Vec2, origin: Vec2, pixelsPerMetre: number, heading = 0): { x: number; y: number } {
  const a = heading * Math.PI / 180;
  const east = point.east - origin.east;
  const north = point.north - origin.north;
  return { x: (east * Math.cos(a) - north * Math.sin(a)) * pixelsPerMetre, y: -(east * Math.sin(a) + north * Math.cos(a)) * pixelsPerMetre };
}

export function unprojectRelative(x: number, y: number, origin: Vec2, pixelsPerMetre: number, heading = 0): Vec2 {
  const a = heading * Math.PI / 180;
  const right = x / pixelsPerMetre;
  const forward = -y / pixelsPerMetre;
  return { east: origin.east + right * Math.cos(a) + forward * Math.sin(a), north: origin.north - right * Math.sin(a) + forward * Math.cos(a) };
}

export function formatHeading(value: number) { return value.toFixed(1).padStart(5, '0'); }
export function formatMinutes(seconds: number | null) { return seconds === null ? '—' : (seconds / 60).toFixed(1); }
