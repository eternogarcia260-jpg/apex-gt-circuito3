import * as THREE from 'three';
import { SINGAPORE_WAYPOINTS } from './SingaporeWaypoints';
import { createC3BridgeFoundations } from './SingaporeBridgeFoundations';

export type C3BridgeMemberKind = 'arch' | 'lower-rail' | 'post' | 'diagonal' | 'roof-crossbeam' | 'roof-xbrace';
export interface C3BridgeMember { kind: C3BridgeMemberKind; start: [number, number, number]; end: [number, number, number]; thickness: [number, number, number] }

/** Lightweight visual LOD, deliberately not a surveyed or faithful Anderson Bridge reconstruction. */
export function createC3AndersonBridge(material: THREE.MeshStandardMaterial): THREE.Group {
  const root = new THREE.Group();
  root.name = 'C3_AndersonBridge';
  const anchor = SINGAPORE_WAYPOINTS[372];
  const before = SINGAPORE_WAYPOINTS[371], after = SINGAPORE_WAYPOINTS[373];
  root.position.set(anchor.x, 0, anchor.z);
  root.rotation.y = Math.atan2(after.x - before.x, after.z - before.z);

  // The host safety strip has center offset8.9m and half-thickness0.4m.
  // A64m span keeps low end posts clear of its OUTER face through the bend.
  const span = 64, half = span / 2, side = 11;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 4.8, -half), new THREE.Vector3(0, 10.2, -span / 4),
    new THREE.Vector3(0, 12, 0), new THREE.Vector3(0, 10.2, span / 4), new THREE.Vector3(0, 4.8, half),
  ]);
  const archY = (z: number): number => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 42; i++) { const mid = (lo + hi) / 2; if (curve.getPoint(mid).z < z) lo = mid; else hi = mid; }
    return curve.getPoint((lo + hi) / 2).y;
  };
  const members: C3BridgeMember[] = [];
  const vec = (x:number,y:number,z:number): [number,number,number] => [x,y,z];
  const add = (kind:C3BridgeMemberKind, a:THREE.Vector3, b:THREE.Vector3, thickness:[number,number,number]) => members.push({kind,start:vec(a.x,a.y,a.z),end:vec(b.x,b.y,b.z),thickness});
  const inst: Record<string, { dims:[number,number,number]; items:C3BridgeMember[] }> = {};
  const push = (kind:C3BridgeMemberKind,a:THREE.Vector3,b:THREE.Vector3,dims:[number,number,number]) => {
    add(kind,a,b,dims); (inst[kind] ??= {dims,items:[]}).items.push(members[members.length-1]);
  };
  // Closed extruded I section, shared by both side arches.
  const shape = new THREE.Shape();
  const outline = [[-.36,-.425],[.36,-.425],[.36,-.325],[.06,-.325],[.06,.325],[.36,.325],[.36,.425],[-.36,.425],[-.36,.325],[-.06,.325],[-.06,-.325],[-.36,-.325]];
  shape.moveTo(outline[0][0],outline[0][1]); outline.slice(1).forEach(p=>shape.lineTo(p[0],p[1])); shape.closePath();
  const archGeometry = new THREE.ExtrudeGeometry(shape,{extrudePath:curve,bevelEnabled:false,steps:56,curveSegments:1});
  const archMesh = new THREE.InstancedMesh(archGeometry,material,2); archMesh.name='C3_AndersonArchI';
  [-side,side].forEach((x,i)=>{const m=new THREE.Matrix4().makeTranslation(x,0,0); archMesh.setMatrixAt(i,m);});
  archMesh.instanceMatrix.needsUpdate=true; root.add(archMesh);
  // Metadata represents sampled arch centerline; section bounds are the extruded I profile.
  for (const x of [-side,side]) for(let i=0;i<=56;i++){const p=curve.getPoint(i/56); if(i) {const q=curve.getPoint((i-1)/56); add('arch',new THREE.Vector3(x,q.y,q.z),new THREE.Vector3(x,p.y,p.z),[.72,.72,.85]);}}

  for(const x of [-side,side]) {
    push('lower-rail',new THREE.Vector3(x,.5,-half),new THREE.Vector3(x,.5,half),[.32,.5,.35]);
    for(let k=0;k<=12;k++) {const z=-half+k*(span/12), y=archY(z); push('post',new THREE.Vector3(x,.5,z),new THREE.Vector3(x,y,z),[.28,.28,.28]);}
    // Pratt panel triangulation; alternate diagonals, one diagonal per bay.
    for(let k=0;k<12;k++){const z0=-half+k*(span/12),z1=z0+span/12; const y0=archY(z0),y1=archY(z1); const low0=new THREE.Vector3(x,.5,z0),low1=new THREE.Vector3(x,.5,z1),top0=new THREE.Vector3(x,y0,z0),top1=new THREE.Vector3(x,y1,z1); push('diagonal',k%2===0?low0:low1,k%2===0?top1:top0,[.22,.22,.22]);}
  }
  for(let k=0;k<=6;k++){const z=-half+k*(span/6),y=archY(z);push('roof-crossbeam',new THREE.Vector3(-side,y,z),new THREE.Vector3(side,y,z),[.35,.35,.3]);}
  for(let k=0;k<6;k++){const z0=-half+k*(span/6),z1=z0+span/6,y0=archY(z0),y1=archY(z1); push('roof-xbrace',new THREE.Vector3(-side,y0,z0),new THREE.Vector3(side,y1,z1),[.16,.16,.16]);push('roof-xbrace',new THREE.Vector3(side,y0,z0),new THREE.Vector3(-side,y1,z1),[.16,.16,.16]);}

  const unit = new THREE.BoxGeometry(1,1,1), up = new THREE.Vector3(0,1,0);
  for(const [kind,bucket] of Object.entries(inst)){
    const mesh=new THREE.InstancedMesh(unit,material,bucket.items.length); mesh.name=`C3_Anderson${kind.replace(/(^|-)([a-z])/g,(_,__,c)=>c.toUpperCase())}`;
    bucket.items.forEach((m,i)=>{const a=new THREE.Vector3(...m.start),b=new THREE.Vector3(...m.end),delta=b.clone().sub(a),center=a.clone().add(b).multiplyScalar(.5); const matrix=new THREE.Matrix4().compose(center,new THREE.Quaternion().setFromUnitVectors(up,delta.clone().normalize()),new THREE.Vector3(bucket.dims[0],delta.length(),bucket.dims[2])); mesh.setMatrixAt(i,matrix);});
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  }
  archMesh.computeBoundingBox(); archMesh.computeBoundingSphere();
  root.userData.c3Bridge={spec:{span,width:22,archHeight:12,endHeight:4.8,anchorWaypointIndex:372,anchor:{x:anchor.x,z:anchor.z},yaw:root.rotation.y,waypointYaw:Math.atan2(after.x-before.x,after.z-before.z)},members};
  root.add(createC3BridgeFoundations(material));
  return root;
}
