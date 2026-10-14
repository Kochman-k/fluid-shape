import * as THREE from 'three';
import './style.css';
import { StrokeTrail } from './stroke.js';
import { StrokeSettling } from './settling.js';
import { RibbonFlow } from './flow.js';
import { ParticleCloud } from './particles.js';
import { OwlExperience } from './owl.js';
let activeExperiment = 'particles', owl;

const $ = id => document.getElementById(id);
const container = $('canvas-container');
const defaults = { dispersion: 58, response: 85, preset: 'rose', paused: false };
const settings = { ...defaults };
const palettes = {
  rose: { color: '#c62c62', highlight: '#fff0f5', label: 'ROSE DUST' },
  ember: { color: '#e04422', highlight: '#ffefdd', label: 'EMBER DUST' },
  amber: { color: '#cb830d', highlight: '#fff7d3', label: 'AMBER DUST' },
};
let renderer, scene, camera, cloud, shadow;
let seed = 1.7, morph = 0, elapsed = 0, lastFrame = 0;
const pointer = new THREE.Vector2(), previousPointer = new THREE.Vector2();
const follow = new THREE.Vector2(), followVelocity = new THREE.Vector2(), followTarget = new THREE.Vector2();
const stroke = new StrokeTrail();
const settling = new StrokeSettling();
const ringCount = 57;
const trailPoints = Array.from({ length: ringCount }, () => new THREE.Vector3());
const ringCenters = Array.from({ length: ringCount }, () => new THREE.Vector3());
const ringNormals = Array.from({ length: ringCount }, () => new THREE.Vector2(0, 1));
const flow = new RibbonFlow(ringCount);
const trailCurve = new THREE.CatmullRomCurve3(flow.points, false, 'centripetal');
const tangent = new THREE.Vector3(), cursorWorld = new THREE.Vector3();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let ready = false;

function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  camera.position.set(0, 0, 9);
  const background = document.createElement('canvas');
  background.width = background.height = 512;
  const ctx = background.getContext('2d');
  const gradient = ctx.createRadialGradient(245, 235, 10, 256, 256, 360);
  gradient.addColorStop(0, '#f4dfe6');
  gradient.addColorStop(.55, '#dfb5c5');
  gradient.addColorStop(1, '#b3849b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(background);
  texture.colorSpace = THREE.SRGBColorSpace;
  scene.background = texture;
  const mobile = container.clientWidth / container.clientHeight < 1;
  cloud = new ParticleCloud(mobile ? 12000 : 24000, seed, mobile);
  scene.add(cloud);
  follow.set(mobile ? 0 : -.55, mobile ? .45 : -.1);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, 'rgba(97,34,65,0.18)');
  glow.addColorStop(1, 'rgba(97,34,65,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);
  shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, .8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  shadow.position.z = -.8;
  scene.add(shadow);
  resize();
  ready = true;
  renderer.domElement.dataset.ready = 'true';
  renderer.domElement.dataset.particles = String(cloud.count);
  requestAnimationFrame(animate);
}

function resize() {
  if (!renderer) return;
  const { width, height } = container.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (cloud) cloud.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
}
new ResizeObserver(resize).observe(container);

function onPointer(event) {
  if (activeExperiment !== 'particles' || settings.paused || event.target.closest('button, input, aside, dialog, a')) return;
  const rect = container.getBoundingClientRect();
  previousPointer.copy(pointer);
  pointer.set(((event.clientX - rect.left) / rect.width - .5) * 2, -((event.clientY - rect.top) / rect.height - .5) * 2);
  if (pointer.distanceToSquared(previousPointer) > .00000001) {
    const now = performance.now();
    stroke.add(pointer.x, pointer.y, now);
    if (stroke.points.length === 1) flow.reset();
    settling.move(pointer.x, pointer.y, now);
  }
}
container.addEventListener('pointermove', onPointer);
container.addEventListener('pointerdown', onPointer);

function updateStroke(now, dt, idleSeconds) {
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const duration = 600 + settings.response * 7;
  for (let row = 0; row < ringCount; row++) {
    stroke.sample(now - row / (ringCount - 1) * duration, trailPoints[row]);
    trailPoints[row].x *= halfHeight * camera.aspect;
    trailPoints[row].y *= halfHeight;
  }
  cursorWorld.copy(trailPoints[0]);
  flow.step(trailPoints, dt, settings.response / 100, idleSeconds, settling.energy);
  for (let row = 0; row < ringCount; row++) {
    const along = row / (ringCount - 1);
    trailCurve.getPoint(along, ringCenters[row]);
    trailCurve.getTangent(along, tangent);
    if (tangent.lengthSq() > .00001) ringNormals[row].set(-tangent.y, tangent.x).normalize();
    else if (row) ringNormals[row].copy(ringNormals[row - 1]);
    ringCenters[row].z += Math.sin(along * 10 - elapsed * 2) * .1 * Math.sin(Math.PI * along);
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - (lastFrame || now)) / 1000, .1);
  lastFrame = now;
  if (activeExperiment !== 'particles' || settings.paused) return;
  const motionScale = reducedMotion.matches ? .22 : 1;
  elapsed += dt * motionScale;
  const softness = settings.response / 100;
  settling.step(now, dt, softness, motionScale);
  morph = settling.morph;
  const mobile = camera.aspect < 1;
  const idleSeconds = settling.lastMove === null ? 10 : Math.max(0, (now - settling.lastMove) / 1000);
  updateStroke(settling.trailTime, dt, idleSeconds);
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const radius = mobile ? 1.1 : 1.45;
  const limitX = Math.max(.05, halfHeight * camera.aspect - radius);
  const limitY = Math.max(.05, halfHeight - radius);
  if (stroke.points.length) followTarget.set(THREE.MathUtils.clamp(cursorWorld.x, -limitX, limitX), THREE.MathUtils.clamp(cursorWorld.y, -limitY, limitY));
  else followTarget.set(mobile ? 0 : -.55, mobile ? .45 : -.1);
  const frequency = 10 - softness * 4, decay = Math.exp(-frequency * dt);
  for (const axis of ['x', 'y']) {
    const offset = follow[axis] - followTarget[axis];
    const impulse = (followVelocity[axis] + frequency * offset) * dt;
    follow[axis] = followTarget[axis] + (offset + impulse) * decay;
    followVelocity[axis] = (followVelocity[axis] - frequency * impulse) * decay;
  }
  cloud.step({ centers: ringCenters, normals: ringNormals, anchor: follow, morph, dispersion: settings.dispersion / 100, time: elapsed, dt, mobile, energy: settling.energy });
  shadow.position.set(follow.x, follow.y - (mobile ? 1.2 : 1.6), -.8);
  shadow.material.opacity = 1 - morph * .6;
  renderer.render(scene, camera);
  $('state-label').textContent = morph > .35 ? 'PRZEPŁYW' : 'SKUPIENIE';
  renderer.domElement.dataset.morph = morph.toFixed(3);
}

function updateMaterial() {
  if (!cloud) return;
  const palette = palettes[settings.preset];
  cloud.setPalette(palette.color, palette.highlight);
  $('material-label').textContent = palette.label;
  document.querySelectorAll('.preset').forEach(button => {
    const active = button.dataset.preset === settings.preset;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
document.querySelectorAll('.preset').forEach(button => button.addEventListener('click', () => { settings.preset = button.dataset.preset; updateMaterial(); }));
function updateSliders() {
  for (const id of ['dispersion', 'response']) {
    $(id).value = settings[id];
    $(id).style.setProperty('--progress', `${settings[id]}%`);
    $(`${id}-value`).textContent = `${settings[id]}%`;
  }
}
for (const id of ['dispersion', 'response']) $(id).addEventListener('input', event => {
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
  seed = 1.7;
  cloud.setSeed(seed);
  pointer.set(0, 0); stroke.clear(); settling.reset(); flow.reset();
  updateMaterial(); updateSliders(); updatePause(); toast('Przywrócono początkową formę');
});
$('shuffle').addEventListener('click', () => {
  seed = Math.random() * 20;
  cloud.setSeed(seed);
  toast('Nowy układ drobinek');
});
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
const particleAbout = $('about-dialog').innerHTML;
$('about').addEventListener('click', () => {
  const dialog = $('about-dialog');
  if (activeExperiment === 'owl') {
    dialog.innerHTML = '<button id="close-dialog" aria-label="Zamknij">×</button><div class="eyebrow">FLUID / 002</div><h2>Instynkt formy.</h2><p>Polygonowa sowa wyrzeźbiona z warstwowych piór. Lakierowana czerwień, miedziane oczy i studyjne światło tworzą przestrzenną rzeźbę w Twojej przeglądarce.</p><p>Przeciągnij myszą lub palcem, aby obrócić model. Przybliż kółkiem lub dwoma palcami. Możesz też ustawić fokus na scenie i obracać ją strzałkami.</p>';
  } else dialog.innerHTML = particleAbout;
  $('close-dialog').onclick = () => dialog.close();
  dialog.showModal();
});
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

function selectExperiment(name) {
  activeExperiment = name;
  document.body.dataset.experiment = name;
  for (const id of ['particles', 'owl']) {
    $(`${id}-panel`).hidden = id !== name;
    $(`tab-${id}`).setAttribute('aria-selected', String(id === name));
    $(`tab-${id}`).tabIndex = id === name ? 0 : -1;
  }
  if (name === 'owl' && !owl) {
    try { owl = new OwlExperience($('owl-canvas')); }
    catch (error) { $('owl-error').hidden = false; console.error('Unable to initialize owl:', error); }
  }
  owl?.setActive(name === 'owl');
  if (name === 'particles') resize();
}
for (const name of ['particles', 'owl']) {
  $(`tab-${name}`).addEventListener('click', () => { history.replaceState(null, '', `#${name}`); selectExperiment(name); });
  $(`tab-${name}`).addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const next = event.key === 'Home' ? 'particles' : event.key === 'End' ? 'owl' : name === 'owl' ? 'particles' : 'owl';
      $(`tab-${next}`).click(); $(`tab-${next}`).focus();
    }
  });
}
$('owl-rotate').addEventListener('click', () => {
  if (!owl) return;
  owl.autoRotate = !owl.autoRotate;
  $('owl-rotate').textContent = owl.autoRotate ? 'II' : '▶';
  $('owl-rotate').setAttribute('aria-pressed', String(owl.autoRotate));
});
$('owl-reset').addEventListener('click', () => owl?.reset());
$('owl-capture').addEventListener('click', () => {
  if (!owl) return;
  const link = document.createElement('a');link.download = 'fluid-owl.png';link.href = owl.capture();link.click();
});
$('owl-fullscreen').addEventListener('click', () => $('fullscreen').click());
window.addEventListener('hashchange', () => selectExperiment(location.hash === '#owl' ? 'owl' : 'particles'));
selectExperiment(location.hash === '#owl' ? 'owl' : 'particles');
