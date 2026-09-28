// The water beyond a kicker (the Bay, on Russian Hill): animated water, distance buoys in both lanes
// with labels, and the session-record flag buoy. Laid out from any course's lip: the buoys run out
// the way the kicker points, every BUOY_SPACING metres, in line with the grid's two lanes.
import * as THREE from 'three';
import type { Lip } from '../track';
import { canvasTexture } from './util';

export interface Bay {
  group: THREE.Group;
  update(t: number): void;
  /** Before each view is drawn: the distance labels show side-on and hide end-on. */
  labelsFor(camera: THREE.Camera): void;
  /** Move the session-record flag buoy; null hides it. */
  setBest(distance: number | null, holder?: string, color?: string): void;
  /** Small wave height used to bob floating things. */
  waveHeight(x: number, z: number, t: number): number;
}

export const BUOY_SPACING = 10;
export const BUOY_MAX = 250;

/** Tileable ripple normal map: a sum of integer-frequency waves over the tile. */
function makeWaterNormals(size: number, seed: number): THREE.CanvasTexture {
  const waves: { kx: number; ky: number; a: number; p: number }[] = [];
  let s = seed;
  const rnd = (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  // Many waves with evenly spread directions (integer wave vectors keep the tile seamless) and
  // amplitude falling with frequency, so no single direction reads as stripes in the distance.
  for (let i = 0; i < 26; i++) {
    const ang = ((i + rnd() * 0.8) / 26) * Math.PI * 2;
    const k = 4 + rnd() * 14;
    const kx = Math.round(Math.cos(ang) * k);
    const ky = Math.round(Math.sin(ang) * k) || 1;
    waves.push({ kx, ky, a: 3 / Math.hypot(kx, ky), p: rnd() * Math.PI * 2 });
  }
  return canvasTexture(
    size,
    size,
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const strength = 0.9;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const u = x / w;
          const v = y / h;
          let dx = 0;
          let dy = 0;
          for (const wv of waves) {
            const ph = 2 * Math.PI * (wv.kx * u + wv.ky * v) + wv.p;
            const c = Math.cos(ph) * wv.a;
            dx += c * wv.kx;
            dy += c * wv.ky;
          }
          const nx = -dx * strength * 0.03;
          const ny = -dy * strength * 0.03;
          const len = Math.hypot(nx, ny, 1);
          const i = (y * w + x) * 4;
          img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
          img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
          img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    { srgb: false, repeat: [1, 1] },
  );
}

function labelTexture(text: string, big: boolean): { tex: THREE.CanvasTexture; aspect: number } {
  const h = big ? 128 : 96;
  const font = `900 ${big ? 84 : 64}px "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const w = Math.ceil(measure.measureText(text).width + h * 0.9);
  const tex = canvasTexture(w, h, (ctx) => {
    const r = h / 2 - 4;
    ctx.fillStyle = big ? '#ffd21f' : '#fffaf0';
    ctx.strokeStyle = big ? '#1b2440' : '#24304f';
    ctx.lineWidth = big ? 8 : 6;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1b2440';
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

function makeLabel(text: string, big: boolean, height: number): THREE.Sprite {
  const { tex, aspect } = labelTexture(text, big);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(height * aspect, height, 1);
  return sprite;
}

export function buildBay(lip: Lip, lanes: readonly number[], opts: { envMap?: THREE.Texture; anisotropy?: number } = {}): Bay {
  const group = new THREE.Group();
  group.name = 'bay';
  // A point d metres out from the lip along the jump, `side` metres to the right of its line.
  const out = (d: number, side = 0): { x: number; z: number } => ({ x: lip.x + lip.tx * d - lip.tz * side, z: lip.z + lip.tz * d + lip.tx * side });

  // Water: one big plane, two scrolling ripple layers (normal map + clearcoat normal map).
  const normals = makeWaterNormals(256, 7);
  const normals2 = makeWaterNormals(256, 91);
  const size = 14000;
  const tile = 21; // metres per ripple tile
  for (const tex of [normals, normals2]) {
    tex.repeat.set(size / tile, size / tile);
    tex.anisotropy = opts.anisotropy ?? 8;
  }
  // A much larger, non-integer second layer breaks up the tiling pattern in the distance.
  normals2.repeat.multiplyScalar(0.37);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b4c68,
    roughness: 0.2,
    metalness: 0,
    normalMap: normals,
    normalScale: new THREE.Vector2(0.55, 0.55),
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
    clearcoatNormalMap: normals2,
    clearcoatNormalScale: new THREE.Vector2(0.3, 0.3),
    envMap: opts.envMap ?? null,
    envMapIntensity: opts.envMap ? 0.36 : 0.5,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(size, size), waterMat);
  water.rotation.x = -Math.PI / 2;
  const far = out(1500);
  water.position.set(far.x, lip.waterY, far.z);
  water.receiveShadow = true;
  water.name = 'water';
  group.add(water);

  // Buoys: every 10 m in both lanes; number labels every 10 m, big labels every 50 m.
  const buoyGeo = new THREE.SphereGeometry(0.42, 18, 12);
  const bandGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.16, 18);
  const capGeo = new THREE.ConeGeometry(0.16, 0.5, 10);
  const orange = new THREE.MeshPhysicalMaterial({ color: 0xff6a1a, roughness: 0.35, clearcoat: 0.8 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf6f3ea, roughness: 0.4, clearcoat: 0.6 });
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xffd21f, roughness: 0.35, clearcoat: 0.8 });
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8);
  const pole = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.5, metalness: 0.4 });

  interface Floater {
    obj: THREE.Object3D;
    x: number;
    z: number;
    phase: number;
  }
  const floaters: Floater[] = [];
  const labels: THREE.Sprite[] = [];
  for (let d = BUOY_SPACING; d <= BUOY_MAX; d += BUOY_SPACING) {
    const big = d % 50 === 0;
    for (const lane of lanes) {
      const at = out(d, lane);
      const b = new THREE.Group();
      const body = new THREE.Mesh(buoyGeo, big ? yellow : orange);
      body.scale.y = 0.8;
      const band = new THREE.Mesh(bandGeo, white);
      band.position.y = 0.05;
      const cap = new THREE.Mesh(capGeo, white);
      cap.position.y = 0.45;
      b.add(body, band, cap);
      if (big) {
        const p = new THREE.Mesh(poleGeo, pole);
        p.position.y = 1.7;
        b.add(p);
      }
      b.position.set(at.x, lip.waterY, at.z);
      b.traverse((o) => {
        o.castShadow = true;
      });
      group.add(b);
      floaters.push({ obj: b, x: at.x, z: at.z, phase: d * 0.37 + lane });
    }
    // Labels float between the lanes so the two rows never overlap on screen.
    const label = makeLabel(big ? `${d} m` : `${d}`, big, big ? 4.2 : 2.1);
    labels.push(label);
    const mid = out(d);
    label.position.set(mid.x, lip.waterY + (big ? 6.2 : 2.6), mid.z);
    // Drawn after the (transparent) flight trails so trails never scribble over the numbers.
    label.renderOrder = 5;
    group.add(label);
  }

  // Session-record flag buoy: a tall pole with a chequered flag and a label.
  const best = new THREE.Group();
  best.visible = false;
  const bestBody = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), yellow);
  bestBody.scale.y = 0.75;
  const bestPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10, 10), pole);
  bestPole.position.y = 5;
  const flagTex = canvasTexture(128, 96, (ctx, w, h) => {
    const n = 4;
    for (let i = 0; i < n * 2; i++) {
      for (let j = 0; j < n + 1; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#111' : '#fff';
        ctx.fillRect((i * w) / (n * 2), (j * h) / (n + 1) - 1, w / (n * 2) + 1, h / (n + 1) + 2);
      }
    }
  });
  const flagGeo = new THREE.PlaneGeometry(2.6, 1.7, 12, 4);
  const flagBase = Float32Array.from(flagGeo.getAttribute('position').array);
  const flag = new THREE.Mesh(
    flagGeo,
    new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.7 }),
  );
  flag.position.set(1.3, 9.1, 0);
  best.add(bestBody, bestPole, flag);
  best.traverse((o) => {
    o.castShadow = true;
  });
  let bestLabel: THREE.Sprite | null = null;
  group.add(best);

  const setBest = (distance: number | null, holder?: string, color?: string): void => {
    if (bestLabel) {
      best.remove(bestLabel);
      bestLabel.material.map?.dispose();
      bestLabel.material.dispose();
      bestLabel = null;
    }
    if (distance === null || distance <= 0) {
      best.visible = false;
      return;
    }
    best.visible = true;
    const at = out(distance);
    best.position.set(at.x, lip.waterY, at.z);
    best.rotation.y = -lip.heading;
    bestLabel = makeLabel(`BEST ${distance.toFixed(1)} m${holder ? ` · ${holder}` : ''}`, true, 2.6);
    bestLabel.position.set(0, 12.2, 0);
    bestLabel.renderOrder = 5;
    if (color) bestLabel.material.color.set(color).lerp(new THREE.Color('#ffffff'), 0.55);
    best.add(bestLabel);
  };

  const waveHeight = (x: number, z: number, t: number): number =>
    0.09 * Math.sin(t * 1.3 + x * 0.21 + z * 0.13) + 0.05 * Math.sin(t * 2.1 - x * 0.17 + z * 0.29);

  // Looking down the lanes (chase and build views) the labels line up into one cluttered stack,
  // so they go; side-on, where the distances are read, they are fully opaque. Per view (the halves
  // of a split can look different ways); the camera rigs already ease the turn.
  const viewDir = new THREE.Vector3();
  const labelsFor = (camera: THREE.Camera): void => {
    camera.getWorldDirection(viewDir);
    const opacity = THREE.MathUtils.clamp((0.88 - Math.abs(viewDir.x * lip.tx + viewDir.z * lip.tz)) / 0.3, 0, 1);
    for (const l of labels) {
      l.material.opacity = opacity;
      l.visible = opacity > 0.02;
    }
  };
  const update = (t: number): void => {
    normals.offset.set(t * 0.012, t * 0.007);
    normals2.offset.set(-t * 0.009, t * 0.011);
    for (const f of floaters) {
      f.obj.position.y = lip.waterY + waveHeight(f.x, f.z, t) * 1.4;
      f.obj.rotation.z = Math.sin(t * 1.1 + f.phase) * 0.12;
      f.obj.rotation.x = Math.cos(t * 0.9 + f.phase) * 0.1;
    }
    if (best.visible) {
      best.position.y = lip.waterY + waveHeight(best.position.x, best.position.z, t);
      best.rotation.z = Math.sin(t * 0.8) * 0.05;
      const pos = flagGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x0 = flagBase[i * 3];
        const u = (x0 + 1.3) / 2.6;
        pos.setZ(i, Math.sin(t * 6 + u * 5) * 0.18 * u);
      }
      pos.needsUpdate = true;
    }
  };

  return { group, update, labelsFor, setBest, waveHeight };
}
