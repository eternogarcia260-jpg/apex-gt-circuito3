import * as THREE from 'three';

/**
 * MathPool - Centralized Static Scratch Pool for Three.js Math Objects
 * Eliminates per-frame garbage collector pressure by reusing preallocated instances.
 * Guarantees ZERO dynamic allocations in critical animation and physics loops.
 */
export class MathPool {
  // Pre-allocated Vector3 scratch instances
  public static readonly V0 = new THREE.Vector3();
  public static readonly V1 = new THREE.Vector3();
  public static readonly V2 = new THREE.Vector3();
  public static readonly V3 = new THREE.Vector3();
  public static readonly V4 = new THREE.Vector3();
  public static readonly V5 = new THREE.Vector3();
  public static readonly V6 = new THREE.Vector3();
  public static readonly V7 = new THREE.Vector3();
  public static readonly V8 = new THREE.Vector3();
  public static readonly V9 = new THREE.Vector3();
  public static readonly V10 = new THREE.Vector3();
  public static readonly V11 = new THREE.Vector3();
  public static readonly V12 = new THREE.Vector3();
  public static readonly V13 = new THREE.Vector3();
  public static readonly V14 = new THREE.Vector3();
  public static readonly V15 = new THREE.Vector3();

  // Immutable directional constants
  public static readonly UP = new THREE.Vector3(0, 1, 0);
  public static readonly DOWN = new THREE.Vector3(0, -1, 0);
  public static readonly FORWARD = new THREE.Vector3(0, 0, 1);
  public static readonly BACK = new THREE.Vector3(0, 0, -1);
  public static readonly RIGHT = new THREE.Vector3(1, 0, 0);
  public static readonly LEFT = new THREE.Vector3(-1, 0, 0);
  public static readonly ZERO = new THREE.Vector3(0, 0, 0);

  // Pre-allocated Matrix4 scratch instances
  public static readonly M0 = new THREE.Matrix4();
  public static readonly M1 = new THREE.Matrix4();
  public static readonly M2 = new THREE.Matrix4();
  public static readonly M3 = new THREE.Matrix4();

  // Pre-allocated Quaternion scratch instances
  public static readonly Q0 = new THREE.Quaternion();
  public static readonly Q1 = new THREE.Quaternion();
  public static readonly Q2 = new THREE.Quaternion();
  public static readonly Q3 = new THREE.Quaternion();

  // Pre-allocated Euler scratch instances
  public static readonly E0 = new THREE.Euler(0, 0, 0, 'YXZ');
  public static readonly E1 = new THREE.Euler(0, 0, 0, 'YXZ');

  // Pre-allocated geometric bounds scratch instances
  public static readonly BOX0 = new THREE.Box3();
  public static readonly BOX1 = new THREE.Box3();
  public static readonly SPHERE0 = new THREE.Sphere();
  public static readonly SPHERE1 = new THREE.Sphere();

  // Pre-allocated Raycaster and Ray
  public static readonly RAY = new THREE.Raycaster();
  public static readonly R0 = new THREE.Ray();

  // Pre-allocated Color scratch instances
  public static readonly C0 = new THREE.Color();
  public static readonly C1 = new THREE.Color();
}
