// Race furniture every course gets from its shape alone, built the same way on every map: the
// chequered start line with the grid's lane labels, the start gantry (banner and waving chequered
// flags), and on a point-to-point race without a kicker a finish gantry over the finish line. The
// venues build only what's theirs (the city, the hills); src/scene/maps.ts adds these on top.
import * as THREE from 'three';
import { pointAt, toWorld, type Course } from '../track';
import { GeoBuilder, box, meshOf, rbox } from './geo';
import { bannerTexture, checkerTexture, laneLabelTexture } from './props';

/** A gantry over the road: posts, a crossbar with the banner, and a chequered flag on each post. */
export interface Gantry {
  group: THREE.Group;
  /** Wave the flags (t: seconds). */
  update(t: number): void;
}

/** A gantry spanning the course at arc length s (its banner LA VOITURE unless it says otherwise; as
 *  wide as the road there unless `hw` says). */
export function buildGantry(course: Course, s: number, name: string, opts: { text?: string; hw?: number } = {}): Gantry {
  const p = pointAt(course, s);
  const hw = opts.hw ?? p.hw;
  const group = new THREE.Group();
  group.name = name;
  const flags: { mesh: THREE.Mesh; base: Float32Array; phase: number }[] = [];
  const gb = new GeoBuilder();
  const topY = 8.1;
  const post = hw + 1.8;
  for (const dz of [-post, post]) {
    rbox(gb, -0.25, 0.25, 0, topY + 0.3, dz - 0.25, dz + 0.25, 0.08, '#f7f7f2');
    box(gb, -0.4, 0.4, -0.4, 0.3, dz - 0.4, dz + 0.4, '#2b2f36');
  }
  rbox(gb, -0.3, 0.3, topY - 0.45, topY + 0.1, -post - 0.3, post + 0.3, 0.08, '#2b2f36');
  group.add(meshOf(gb, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6 }), 'gantryFrame', true, true));
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.75, 2 * hw + 0.2), new THREE.MeshStandardMaterial({ map: bannerTexture(opts.text), roughness: 0.55 }));
  banner.position.set(0, topY - 1.45, 0);
  banner.castShadow = true;
  banner.name = 'gantryBanner';
  group.add(banner);
  // Waving chequered flags on poles above the posts.
  const flagMat = new THREE.MeshStandardMaterial({ map: checkerTexture(6, 4), roughness: 0.6, side: THREE.DoubleSide });
  const poleMat = new THREE.MeshStandardMaterial({ color: '#d8dce2', metalness: 0.8, roughness: 0.3 });
  for (const [i, dz] of [
    [0, -post],
    [1, post],
  ] as const) {
    const g = new THREE.PlaneGeometry(1.8, 1.2, 12, 4);
    g.translate(0.9, 0, 0);
    const mesh = new THREE.Mesh(g, flagMat);
    mesh.position.set(0, topY + 0.9, dz);
    mesh.rotation.y = dz < 0 ? 0.35 : -0.35 + Math.PI;
    mesh.castShadow = true;
    mesh.name = `${name}Flag${i + 1}`;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), poleMat);
    pole.position.set(0, topY + 0.9, dz);
    group.add(pole, mesh);
    flags.push({ mesh, base: Float32Array.from(g.getAttribute('position').array as ArrayLike<number>), phase: i * 1.7 });
  }
  group.position.set(p.x, p.y, p.z);
  group.rotation.y = -p.heading;
  const update = (t: number): void => {
    for (const f of flags) {
      const pos = f.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = f.base[i * 3];
        const y = f.base[i * 3 + 1];
        const amp = 0.18 * (x / 1.8);
        arr[i * 3 + 2] = f.base[i * 3 + 2] + Math.sin(t * 5 + x * 3.2 + f.phase) * amp + Math.sin(t * 3.1 + y * 2) * 0.03 * x;
      }
      pos.needsUpdate = true;
      f.mesh.geometry.computeVertexNormals();
    }
  };
  return { group, update };
}

/** A chequered line painted across the course at arc length s. */
export function chequeredLine(course: Course, s: number, name: string): THREE.Mesh {
  const p = pointAt(course, s);
  const g = new THREE.PlaneGeometry(0.9, 2 * p.hw - 0.4);
  g.rotateX(-Math.PI / 2);
  g.rotateY(-p.heading);
  g.translate(p.x, p.y + 0.05, p.z);
  const line = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({ map: checkerTexture(2, 34), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  );
  line.name = name;
  line.receiveShadow = true;
  return line;
}

/** "P1" and "P2" painted on the grid slots, behind the start line. */
export function gridLabels(course: Course): THREE.Group {
  const group = new THREE.Group();
  group.name = 'gridLabels';
  const laneMat = new THREE.MeshStandardMaterial({ map: laneLabelTexture(), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
  course.grid.forEach((slot, i) => {
    const lg = new THREE.PlaneGeometry(3.0, 3.0);
    const uv = lg.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 2);
    const w = toWorld(course, slot.s - 3.2, slot.d);
    lg.rotateX(-Math.PI / 2);
    lg.rotateY(-Math.PI / 2 - w.heading);
    lg.translate(w.x, w.y + 0.05, w.z);
    const label = new THREE.Mesh(lg, laneMat);
    label.receiveShadow = true;
    label.name = `laneLabel${i + 1}`;
    group.add(label);
  });
  return group;
}

/** The start and finish furniture a course gets: the start line, the grid and the start gantry;
 *  and, on a point-to-point course with a finish line, a finish gantry over it. */
export interface Trackside {
  group: THREE.Group;
  /** The start gantry (the chase camera fades it while it looks through it). */
  gantry: THREE.Object3D;
  /** The finish line's furniture (shown only for events that finish there). */
  finish: THREE.Group | null;
  update(t: number): void;
}

export function buildTrackside(course: Course): Trackside {
  const group = new THREE.Group();
  group.name = 'trackside';
  group.add(chequeredLine(course, course.startS, 'startLine'), gridLabels(course));
  const start = buildGantry(course, course.startS, 'startGantry');
  group.add(start.group);
  const gantries = [start];
  let finish: THREE.Group | null = null;
  if (course.finishS !== null) {
    finish = new THREE.Group();
    finish.name = 'finish';
    const fg = buildGantry(course, course.finishS, 'finishGantry');
    finish.add(chequeredLine(course, course.finishS, 'finishLine'), fg.group);
    gantries.push(fg);
    group.add(finish);
  }
  return {
    group,
    gantry: start.group,
    finish,
    update: (t) => {
      for (const g of gantries) if (g.group.parent?.visible !== false) g.update(t);
    },
  };
}
