import * as THREE from 'three';
import { SPEEDWAY_WAYPOINTS } from '../src/game/circuits/speedway/SpeedwayWaypoints';

const lakeCenter = new THREE.Vector3(505, -0.35, 95);
const lakeShoreWest = new THREE.Vector3(460, -0.35, 95);

console.log('--- SIGHTLINE ANALYSIS FROM DRIVER PERSPECTIVE ---');
// Car eye height is ~1.2m (cockpit) or 2.0m (chase cam)
const eyeHeights = [1.2, 2.0];

for (let i = 0; i < SPEEDWAY_WAYPOINTS.length; i++) {
  const wp = SPEEDWAY_WAYPOINTS[i];
  // Filter for points near Curvone (x > 380, z > -80 and z < 180)
  if (wp.x > 360 && wp.z > -80 && wp.z < 180) {
    const nextWp = SPEEDWAY_WAYPOINTS[(i + 1) % SPEEDWAY_WAYPOINTS.length];
    const forwardX = nextWp.x - wp.x;
    const forwardZ = nextWp.z - wp.z;
    const yaw = Math.atan2(forwardX, forwardZ); // Car forward yaw

    // Vector to lake center
    const toLakeX = lakeCenter.x - wp.x;
    const toLakeZ = lakeCenter.z - wp.z;
    const distToLake = Math.hypot(toLakeX, toLakeZ);
    const angleToLake = Math.atan2(toLakeX, toLakeZ);
    
    // Relative angle to car forward (in degrees)
    let relAngle = ((angleToLake - yaw) * 180 / Math.PI) % 360;
    if (relAngle > 180) relAngle -= 360;
    if (relAngle < -180) relAngle += 360;

    // Check barrier along outer edge:
    // Outer barrier is ~11.8m to the right (+normal) of track
    const len = Math.hypot(forwardX, forwardZ);
    const normX = -forwardZ / len;
    const normZ = forwardX / len;
    // Outer wall position:
    const wallX = wp.x + normX * 11.8;
    const wallZ = wp.z + normZ * 11.8;
    const distToWall = 11.8;

    // Line from eye (wp.x, eyeY, wp.z) to lake (460, -0.35, 95):
    // At distance 11.8m (the wall), what is the line-of-sight Y?
    const eyeY = 1.8; // chase cam
    const tWall = distToWall / distToLake;
    const losYAtWall = eyeY + tWall * (lakeCenter.y - eyeY);

    console.log(`WP ${i} (x:${wp.x.toFixed(0)}, z:${wp.z.toFixed(0)}): distLake=${distToLake.toFixed(0)}m, relAngle=${relAngle.toFixed(0)}°, losYAtWall=${losYAtWall.toFixed(2)}m (Barrier height=3.35m)`);
  }
}
