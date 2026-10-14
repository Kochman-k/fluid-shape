import * as THREE from 'three';
import './style.css';

const $ = (id) => document.getElementById(id);
const container = $('canvas-container');
const settings = { transparency: 65, response: 70, preset: 'opal', paused: false };
const palettes = {
  opal: { color: '#ddd9ff', metalness: .22, iridescence: 1, label: 'OPAL GLASS' },
  rose: { color: '#f6c7b5', metalness: .32, iridescence: .45, label: 'ROSE GLASS' },
  chrome: { color: '#e0e3f0', metalness: .96, iridescence: .18, label: 'LIQUID CHROME' },
};
let renderer, scene, camera, sculpture, geometry, material;
let seed = 1.7, morph = 0, elapsed = 0, lastFrame = 0, lastMove = -10000;
let pointer = new THREE.Vector2(), previousPointer = new THREE.Vector2();
let velocity = new THREE.Vector2(), follow = new THREE.Vector2();
let angle = 0, targetAngle = 0;
let base;
let ready = false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
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
    color: '#ddd9ff', metalness: .22, roughness: .075,
    transmission: .65, thickness: 1.1, ior: 1.48,
    iridescence: 1, iridescenceIOR: 1.32, iridescenceThicknessRange: [180, 580],
    clearcoat: 1, clearcoatRoughness: .035, envMapIntensity: 1.1,
    attenuationColor: '#d5c1f0', attenuationDistance: 4,
    side: THREE.DoubleSide,
  });
  geometry = new THREE.SphereGeometry(1, 80, 56);
  base = geometry.attributes.position.array.slice();
  sculpture = new THREE.Mesh(geometry, material);
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
  velocity.subVectors(pointer, previousPointer);
  if (velocity.length() > .001) {
    lastMove = performance.now();
    targetAngle = Math.atan2(velocity.y, velocity.x);
    // A ribbon has no forward orientation; choose the nearest half turn.
    while (targetAngle - angle > Math.PI / 2) targetAngle -= Math.PI;
    while (targetAngle - angle < -Math.PI / 2) targetAngle += Math.PI;
  }
}
container.addEventListener('pointermove', onPointer);
container.addEventListener('pointerdown', onPointer);
container.addEventListener('pointerleave', () => { lastMove = -10000; pointer.set(0, 0); });

function deform(time) {
  const positions = geometry.attributes.position;
  const a = positions.array;
  const twist = time * .22 + seed;
  for (let i = 0; i < a.length; i += 3) {
    const x = base[i], y = base[i + 1], z = base[i + 2];
    const organic = 1 + .18 * Math.sin(x * 2.4 + y * 2.8 + time * .48 + seed) * Math.cos(z * 2.5 - x * 1.2 - time * .36) + .09 * Math.sin(y * 3.5 - z * 2 + time * .32 + seed);
    const bx = x * organic * 1.35;
    const by = y * organic * 1.43;
    const bz = z * organic * 1.25;
    const rotation = y * 5.5 + twist;
    const width = x * .64;
    const depth = z * .14;
    const rx = y * 3.1;
    const ry = Math.sin(y * 3.5 + time * .9 + seed) * .44 + width * Math.cos(rotation) - depth * Math.sin(rotation);
    const rz = Math.cos(y * 3 + time * .6) * .32 + width * Math.sin(rotation) + depth * Math.cos(rotation);
    a[i] = THREE.MathUtils.lerp(bx, rx, morph);
    a[i + 1] = THREE.MathUtils.lerp(by, ry, morph);
    a[i + 2] = THREE.MathUtils.lerp(bz, rz, morph);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - (lastFrame || now)) / 1000, .1);
  lastFrame = now;
  if (settings.paused) return;
  const motionScale = reducedMotion.matches ? .22 : 1;
  elapsed += dt * motionScale;
  const active = now - lastMove < 350;
  const targetMorph = active ? motionScale : 0;
  const rate = 3 + (100 - settings.response) * .055;
  morph = THREE.MathUtils.damp(morph, targetMorph, rate, dt);
  follow.lerp(pointer, 1 - Math.exp(-dt * 2.5));
  angle = THREE.MathUtils.damp(angle, targetAngle, 3, dt);
  deform(elapsed);
  const mobile = camera.aspect < 1;
  const originX = mobile ? 0 : -.55;
  sculpture.position.set(originX + follow.x * (mobile ? .7 : 1.8) * morph, (mobile ? .45 : -.1) + follow.y * 1.1 * morph, 0);
  sculpture.scale.setScalar(mobile ? .78 : 1);
  sculpture.rotation.set(Math.sin(elapsed * .15) * .12, elapsed * .12 * (1 - morph), angle * morph + Math.sin(elapsed * .2) * .12 * (1 - morph));
  sculpture.userData.shadow.position.x = sculpture.position.x;
  sculpture.userData.shadow.position.y = mobile ? -1.1 : -1.85;
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
  material.attenuationColor.set(settings.preset === 'rose' ? '#e8acae' : '#d5c1f0');
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
  Object.assign(settings, { transparency: 65, response: 70, preset: 'opal', paused: false });
  seed = 1.7; pointer.set(0, 0); lastMove = -10000;
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
