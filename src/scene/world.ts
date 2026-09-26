// Renderer, sky, lighting, environment and fog: the "premium toy" photo studio.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  /** Unit vector pointing from the scene towards the sun. */
  sunDir: THREE.Vector3;
  /** Karl the Fog. */
  fog: THREE.FogExp2;
  /** Pre-filtered reflection of the sky alone (the water reflects this, not the studio). */
  skyEnv: THREE.Texture;
  resize(): void;
  /** Keep the sun's shadow frustum centred on the action. */
  setShadowFocus(p: THREE.Vector3, radius?: number): void;
  render(): void;
}

export const FOG_COLOR = new THREE.Color(0xc6d3de);
export const FOG_DENSITY = 0.00062;

export function createWorld(container: HTMLElement): World {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  renderer.shadowMap.enabled = true;
  // r186 removed PCFSoftShadowMap (it warns); PCFShadowMap now does soft Vogel-disk filtering.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.classList.add('scene-canvas');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.3, 9000);

  // Sun low enough for long toy-like shadows, from behind the chase camera and the side camera.
  const sunDir = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();

  const sky = new Sky();
  sky.scale.setScalar(40000);
  const u = sky.material.uniforms;
  u.turbidity.value = 5.5;
  u.rayleigh.value = 1.35;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);

  // Neutral studio reflections: clearcoat paint picks up soft light panels like a product shot.
  const pmrem = new THREE.PMREMGenerator(renderer);
  // The Bay reflects the real sky instead (a studio at grazing angles looks like oil on water).
  const skyScene = new THREE.Scene();
  const skyForEnv = new Sky();
  skyForEnv.scale.setScalar(1000);
  const su = skyForEnv.material.uniforms;
  su.turbidity.value = u.turbidity.value;
  su.rayleigh.value = u.rayleigh.value;
  su.mieCoefficient.value = u.mieCoefficient.value;
  su.mieDirectionalG.value = u.mieDirectionalG.value;
  su.sunPosition.value.copy(sunDir);
  skyScene.add(skyForEnv);
  const skyEnv = pmrem.fromScene(skyScene, 0).texture;
  skyForEnv.geometry.dispose();
  skyForEnv.material.dispose();
  const envScene = new RoomEnvironment();
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 0.55;
  envScene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
  pmrem.dispose();

  const fog = new THREE.FogExp2(FOG_COLOR.getHex(), FOG_DENSITY);
  scene.fog = fog;

  const hemi = new THREE.HemisphereLight(0xe3f0ff, 0x9a8a70, 1.1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d8, 2.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.near = 1;
  sc.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);

  const focus = new THREE.Vector3();
  const setShadowFocus = (p: THREE.Vector3, radius = 55): void => {
    // Snap to texel-sized steps so shadows don't shimmer while the focus moves.
    const texel = (radius * 2) / sun.shadow.mapSize.x;
    focus.set(Math.round(p.x / texel) * texel, Math.round(p.y / texel) * texel, Math.round(p.z / texel) * texel);
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(sunDir, 250);
    if (sc.right !== radius) {
      sc.left = -radius;
      sc.right = radius;
      sc.top = radius;
      sc.bottom = -radius;
      sc.updateProjectionMatrix();
    }
  };
  setShadowFocus(new THREE.Vector3(0, 30, 0));

  const resize = (): void => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  return {
    renderer,
    scene,
    camera,
    sun,
    sunDir,
    fog,
    skyEnv,
    resize,
    setShadowFocus,
    render: () => renderer.render(scene, camera),
  };
}
