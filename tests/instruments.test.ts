import { describe, expect, it } from 'vitest';
import { projectRelative, unprojectRelative } from '../src/instruments/projection';

describe('instrument projection, metres and clockwise heading', () => {
  it('plots north above and east right in north-up', () => {
    expect(projectRelative({east:100,north:200},{east:0,north:0},2)).toEqual({x:200,y:-400});
  });
  it('plots east ahead and north to port when heading east', () => {
    const east = projectRelative({east:100,north:0},{east:0,north:0},2,90);
    const north = projectRelative({east:0,north:100},{east:0,north:0},2,90);
    expect(east.x).toBeCloseTo(0,10); expect(east.y).toBeCloseTo(-200,10);
    expect(north.x).toBeCloseTo(-200,10); expect(north.y).toBeCloseTo(0,10);
  });
  it.each([0, 15, 90, 180, 270, 359])('inverse transform preserves map edits at heading %s', heading => {
    const origin={east:-1500,north:650}; const target={east:814.33,north:-240.89};
    const pixel=projectRelative(target,origin,0.03,heading);
    const result=unprojectRelative(pixel.x,pixel.y,origin,0.03,heading);
    expect(Math.abs(result.east-target.east)).toBeLessThan(1e-8);
    expect(Math.abs(result.north-target.north)).toBeLessThan(1e-8);
  });
});

import { nearestRouteLeg, pointInPolygon, routeCheck } from '../src/instruments/route';
describe('synthetic route monitoring',()=>{
  it('finds signed metre cross track error on northbound route',()=>{
    const result=nearestRouteLeg({east:100,north:500},[{east:0,north:0},{east:0,north:1000}]);
    expect(result.xtd).toBe(100);expect(result.index).toBe(1);
  });
  it('distinguishes land from water',()=>{
    const polygon=[{east:10,north:10},{east:20,north:10},{east:20,north:20},{east:10,north:20}];
    expect(pointInPolygon({east:15,north:15},polygon)).toBe(true);
    expect(pointInPolygon({east:0,north:0},polygon)).toBe(false);
  });
  it('accepts channel route and detects a synthetic land hazard',()=>{
    expect(routeCheck([{east:0,north:0},{east:0,north:3000}],10).safe).toBe(true);
    const hazard=routeCheck([{east:0,north:1000},{east:3000,north:1000}],10);
    expect(hazard.safe).toBe(false);expect(hazard.land).toBe(true);
  });
});
