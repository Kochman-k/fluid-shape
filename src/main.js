import * as THREE from 'three';
import './style.css';
import { StrokeTrail } from './stroke.js';
import { StrokeSettling } from './settling.js';

const $ = (id) => document.getElementById(id);
const container = $('canvas-container');
const defaults = { transparency: 92, response: 85, preset: 'opal', paused: false };
const settings = { ...defaults };
const palettes = {
  opal: { color: '#f4faff', metalness: .015, iridescence: .65, label: 'OPAL GLASS' },
  rose: { color: '#fff0ec', metalness: .025, iridescence: .4, label: 'ROSE GLASS' },
  chrome: { color: '#e0e3f0', metalness: .96, iridescence: .18, label: 'LIQUID CHROME' },
};
let renderer, scene, camera, sculpture, geometry, material;
let seed = 1.7, morph = 0, elapsed = 0, lastFrame = 0;
let pointer = new THREE.Vector2(), previousPointer = new THREE.Vector2();
const follow = new THREE.Vector2();
const followVelocity = new THREE.Vector2();
const followTarget = new THREE.Vector2();
const stroke = new StrokeTrail();
const settling = new StrokeSettling();
const radialSegments = 80;
const longitudinalSegments = 56;
const ringCount = longitudinalSegments + 1;
const trailPoints = Array.from({ length: ringCount }, () => new THREE.Vector3());
const ringCenters = Array.from({ length: ringCount }, () => new THREE.Vector3());
const ringNormals = Array.from({ length: ringCount }, () => new THREE.Vector2(0, 1));
const trailCurve = new THREE.CatmullRomCurve3(trailPoints, false, 'centripetal');
const tangent = new THREE.Vector3();
const cursorWorld = new THREE.Vector3();
let base;
let ready = false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.transmissionResolutionScale = .65;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#eeedf4');
  camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  camera.position.set(0, 0, 9);

  const room = new THREE.Scene();
  room.background = new THREE.Color('#33303d');
  // Large studio softboxes produce crisp highlights without remote HDR assets.
  const cardGeometry = new THREE.PlaneGeometry(2.5, 7);
  for (const [x, y, z, color, intensity] of [
    [-4, 2, 4, '#ffffff', 3], [4, 1, 2, '#eecbff', 2],
    [0, 5, -2, '#ffffff', 3], [-3, -1, -3, '#8edcf8', 2],
    [3, -3, 1, '#ffd8ad', 2],
  ]) {
    const card = new THREE.Mesh(cardGeometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    card.material.color.multiplyScalar(intensity);
    card.position.set(x, y, z);
    card.lookAt(0, 0, 0);
    room.add(card);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, .03);
  scene.environment = env.texture;
  room.traverse(object => { if (object.isMesh) object.material.dispose(); });
  cardGeometry.dispose();
  pmrem.dispose();

  material = new THREE.MeshPhysicalMaterial({
    color: '#f4faff', metalness: .015, roughness: .035,
    transmission: .92, thickness: .45, ior: 1.45,
    iridescence: .65, iridescenceIOR: 1.3, iridescenceThicknessRange: [150, 450],
    clearcoat: .65, clearcoatRoughness: .025, envMapIntensity: .8,
    attenuationColor: '#e5efff', attenuationDistance: 12,
    side: THREE.DoubleSide,
  });
  geometry = new THREE.SphereGeometry(1, radialSegments, longitudinalSegments);
  base = geometry.attributes.position.array.slice();
  sculpture = new THREE.Mesh(geometry, material);
  // A cursor stroke can span the viewport and cross the original sphere bounds.
  sculpture.frustumCulled = false;
  scene.add(sculpture);
  const rim = new THREE.DirectionalLight('#e1ddff', .8);
  rim.position.set(3, 4, 5);
  scene.add(rim);
  const light = new THREE.DirectionalLight('#b6e8f2', .6);
  light.position.set(-4, 1, 2);
  scene.add(light);

  // Soft contact shadow is generated locally, with no image dependency.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(98,79,135,0.22)');
  gradient.addColorStop(.35, 'rgba(110,90,150,0.10)');
  gradient.addColorStop(1, 'rgba(110,90,150,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
  shadow.position.set(-.5, -1.75, -.5);
  scene.add(shadow);
  sculpture.userData.shadow = shadow;
  resize();
  ready = true;
  renderer.domElement.dataset.ready = 'true';
  requestAnimationFrame(animate);
}

function resize() {
  if (!renderer) return;
  const { width, height } = container.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);

function onPointer(event) {
  if (event.target.closest('button, input, aside, dialog, a')) return;
  const rect = container.getBoundingClientRect();
  previousPointer.copy(pointer);
  pointer.set(((event.clientX - rect.left) / rect.width - .5) * 2, -((event.clientY - rect.top) / rect.height - .5) * 2);
  if (settings.paused) return;
  if (pointer.distanceToSquared(previousPointer) > .00000001) {
    const now = performance.now();
    stroke.add(pointer.x, pointer.y, now);
    settling.move(pointer.x, pointer.y, now);
  }
}
container.addEventListener('pointermove', onPointer);
container.addEventListener('pointerdown', onPointer);

function updateStroke(now, time) {
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const halfWidth = halfHeight * camera.aspect;
  const duration = 600 + settings.response * 7;
  for (let row = 0; row < ringCount; row++) {
    stroke.sample(now - row / (ringCount - 1) * duration, trailPoints[row]);
    trailPoints[row].x *= halfWidth;
    trailPoints[row].y *= halfHeight;
  }
  cursorWorld.copy(trailPoints[0]);
  // Sample the historical path once per cross-section, not once per vertex.
  for (let row = 0; row < ringCount; row++) {
    const along = (1 - Math.cos(Math.PI * row / (ringCount - 1))) / 2;
    trailCurve.getPoint(along, ringCenters[row]);
    trailCurve.getTangent(along, tangent);
    if (tangent.lengthSq() > .00001) ringNormals[row].set(-tangent.y, tangent.x).normalize();
    else if (row > 0) ringNormals[row].copy(ringNormals[row - 1]);
    const taper = Math.sin(Math.PI * along);
    // A travelling ripple moves from the brush tip toward the older stroke.
    const ripple = Math.sin(along * 14 - time * 4 + seed) * .065 * taper;
    ringCenters[row].x += ringNormals[row].x * ripple;
    ringCenters[row].y += ringNormals[row].y * ripple;
    ringCenters[row].z = Math.sin(along * 10 - time * 3) * .09 * taper;
  }
}

function deform(time, mobile) {
  const positions = geometry.attributes.position;
  const a = positions.array;
  const scale = mobile ? .78 : 1;
  for (let i = 0; i < a.length; i += 3) {
    const x = base[i], y = base[i + 1], z = base[i + 2];
    const row = Math.floor(i / 3 / (radialSegments + 1));
    const along = (1 - y) / 2;
    const organic = 1 + .18 * Math.sin(x * 2.4 + y * 2.8 + time * .48 + seed) * Math.cos(z * 2.5 - x * 1.2 - time * .36) + .09 * Math.sin(y * 3.5 - z * 2 + time * .32 + seed);
    const bx = follow.x + x * organic * 1.35 * scale;
    const by = follow.y + y * organic * 1.43 * scale;
    const bz = z * organic * 1.25 * scale;
    const rotation = along * 7 - time * 1.25 + seed;
    const width = x * .34 * scale;
    const depth = z * .055 * scale;
    const sideways = width * Math.cos(rotation) - depth * Math.sin(rotation);
    const center = ringCenters[row], normal = ringNormals[row];
    const rx = center.x + normal.x * sideways;
    const ry = center.y + normal.y * sideways;
    const rz = center.z + width * Math.sin(rotation) + depth * Math.cos(rotation);
    a[i] = THREE.MathUtils.lerp(bx, rx, morph);
    a[i + 1] = THREE.MathUtils.lerp(by, ry, morph);
    a[i + 2] = THREE.MathUtils.lerp(bz, rz, morph);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - (lastFrame || now)) / 1000, .1);
  lastFrame = now;
  if (settings.paused) return;
  const motionScale = reducedMotion.matches ? .22 : 1;
  elapsed += dt * motionScale;
  const softness = settings.response / 100;
  settling.step(now, dt, softness, motionScale);
  morph = settling.morph;

  const mobile = camera.aspect < 1;
  updateStroke(settling.trailTime, elapsed);
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const halfWidth = halfHeight * camera.aspect;
  const radius = mobile ? 1.15 : 1.5;
  const limitX = Math.max(.05, halfWidth - radius);
  const limitY = Math.max(.05, halfHeight - radius);
  if (stroke.points.length) {
    // The resting blob gathers at the end of the stroke, safely inside the view.
    followTarget.set(
      THREE.MathUtils.clamp(cursorWorld.x, -limitX, limitX),
      THREE.MathUtils.clamp(cursorWorld.y, -limitY, limitY)
    );
  } else followTarget.set(mobile ? 0 : -.55, mobile ? .45 : -.1);
  const frequency = 10 - softness * 4;
  const decay = Math.exp(-frequency * dt);
  for (const axis of ['x', 'y']) {
    const offset = follow[axis] - followTarget[axis];
    const impulse = (followVelocity[axis] + frequency * offset) * dt;
    follow[axis] = followTarget[axis] + (offset + impulse) * decay;
    followVelocity[axis] = (followVelocity[axis] - frequency * impulse) * decay;
  }

  deform(elapsed, mobile);
  sculpture.userData.shadow.position.x = follow.x;
  sculpture.userData.shadow.position.y = follow.y - (mobile ? 1.45 : 1.75);
  sculpture.userData.shadow.scale.x = 1 + morph * .3;
  renderer.render(scene, camera);
  const state = morph > .35 ? 'W RUCHU' : 'SPOCZYNEK';
  if ($('state-label').textContent !== state) $('state-label').textContent = state;
  renderer.domElement.dataset.morph = morph.toFixed(3);
}

function updateMaterial() {
  if (!material) return;
  const palette = palettes[settings.preset];
  material.color.set(palette.color);
  material.metalness = palette.metalness;
  material.iridescence = palette.iridescence;
  material.transmission = settings.preset === 'chrome' ? settings.transparency / 100 * .18 : settings.transparency / 100;
  material.attenuationColor.set(settings.preset === 'rose' ? '#ffe9e3' : '#e5efff');
  $('material-label').textContent = palette.label;
  document.querySelectorAll('.preset').forEach(button => {
    const active = button.dataset.preset === settings.preset;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
document.querySelectorAll('.preset').forEach(button => button.addEventListener('click', () => { settings.preset = button.dataset.preset; updateMaterial(); }));
function updateSliders() {
  for (const id of ['transparency', 'response']) {
    $(id).value = settings[id];
    $(id).style.setProperty('--progress', `${settings[id]}%`);
    $(`${id}-value`).textContent = `${settings[id]}%`;
  }
}
for (const id of ['transparency', 'response']) $(id).addEventListener('input', event => {
  settings[id] = Number(event.target.value);
  updateSliders();
  updateMaterial();
});
function updatePause() {
  $('pause').textContent = settings.paused ? '▶' : 'II';
  $('pause').setAttribute('aria-label', settings.paused ? 'Wznów animację' : 'Wstrzymaj animację');
  $('pause').title = $('pause').getAttribute('aria-label');
  $('pause').setAttribute('aria-pressed', String(settings.paused));
}
$('pause').addEventListener('click', () => { settings.paused = !settings.paused; updatePause(); });
$('reset').addEventListener('click', () => {
  Object.assign(settings, defaults);
  seed = 1.7; pointer.set(0, 0); stroke.clear(); settling.reset();
  updateMaterial(); updateSliders(); updatePause(); toast('Przywrócono początkową formę');
});
$('shuffle').addEventListener('click', () => { seed = Math.random() * 20; toast('Nowa forma. Nowy rytm.'); });
$('capture').addEventListener('click', () => {
  if (!ready) return;
  renderer.render(scene, camera);
  const link = document.createElement('a');
  link.download = `fluid-${settings.preset}.png`;
  link.href = renderer.domElement.toDataURL('image/png');
  link.click();
  toast('Zapisano Twoją formę');
});
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else toast('Pełny ekran nie jest dostępny w tej przeglądarce');
  } catch { toast('Pełny ekran nie jest dostępny w tym widoku'); }
});
$('about').addEventListener('click', () => $('about-dialog').showModal());
$('close-dialog').addEventListener('click', () => $('about-dialog').close());
$('about-dialog').addEventListener('click', event => { if (event.target === $('about-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
let toastTimer;
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2400);
}
updateSliders(); updatePause();
try { initialize(); updateMaterial(); } catch (error) { $('error').hidden = false; console.error('Unable to initialize 3D scene:', error); }
