import * as THREE from 'three';
import { createResinPlanes, resinRadius } from './resin.js';

export class ParticleCloud extends THREE.Points {
  constructor(count, seed = 1.7, mobile = false) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute('aLight', new THREE.BufferAttribute(new Float32Array(count), 1));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color('#c62c62') },
        uHighlight: { value: new THREE.Color('#fff0f5') },
        uPixelRatio: { value: 1 },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aTint;
        attribute float aLight;
        uniform float uPixelRatio;
        varying float vTint;
        varying float vLight;
        void main() {
          vTint = aTint;
          vLight = aLight;
          vec4 eye = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * eye;
          gl_PointSize = clamp(aSize * uPixelRatio * 8.0 / -eye.z, 0.7 * uPixelRatio, 5.0 * uPixelRatio);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uHighlight;
        varying float vTint;
        varying float vLight;
        void main() {
          vec2 point = gl_PointCoord * 2.0 - 1.0;
          float radius = dot(point, point);
          if (radius > 1.0) discard;
          float edge = 1.0 - smoothstep(0.5, 1.0, radius);
          float glint = pow(max(0.0, 1.0 - length(point - vec2(-0.25, 0.3))), 4.0);
          float sparkle = 0.04 + vTint * 0.22 + vLight * vLight * 0.58 + glint * 0.12;
          vec3 color = mix(uColor * (0.3 + vLight * 0.65), uHighlight, sparkle);
          gl_FragColor = vec4(color, edge * (0.65 + vLight * 0.28));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    super(geometry, material);
    this.frustumCulled = false;
    this.count = count;
    this.mobile = mobile;
    this.homes = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.cross = new Float32Array(count * 2);
    this.along = new Float32Array(count);
    this.phases = new Float32Array(count);
    this.decays = new Float64Array(8);
    this.frequencies = new Float64Array(8);
    this.bins = new Uint8Array(count);
    this.initialized = false;
    this.setSeed(seed);
  }

  setSeed(seed) {
    let state = Math.floor(seed * 1000003) >>> 0;
    const random = () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
    const planes = createResinPlanes(seed);
    const positions = this.geometry.attributes.position.array;
    for (let i = 0; i < this.count; i++) {
      const y = random() * 2 - 1, angle = random() * Math.PI * 2;
      const ring = Math.sqrt(1 - y * y), x = ring * Math.cos(angle), z = ring * Math.sin(angle);
      const shell = random() < .24 ? Math.cbrt(random()) : .86 + random() * .14;
      const radius = resinRadius(x, y, z, planes) * 1.3 * shell;
      const j = i * 3;
      this.homes[j] = x * radius;
      this.homes[j + 1] = y * radius;
      this.homes[j + 2] = z * radius;
      const across = random() * Math.PI * 2, distance = Math.sqrt(random());
      this.cross[i * 2] = Math.cos(across) * distance;
      this.cross[i * 2 + 1] = Math.sin(across) * distance;
      this.along[i] = random();
      this.phases[i] = random() * Math.PI * 2;
      this.bins[i] = Math.min(7, Math.floor(this.along[i] * 8));
      this.geometry.attributes.aSize.array[i] = .8 + random() ** 2 * 2.3;
      this.geometry.attributes.aTint.array[i] = random() ** 1.4;
      this.geometry.attributes.aLight.array[i] = THREE.MathUtils.clamp(.16 + Math.max(0, -x * .55 + y * .45 + z * .7) * .84, .1, 1);
      if (!this.initialized) {
        const scale = this.mobile ? .78 : 1;
        positions[j] = x * radius * scale + (this.mobile ? 0 : -.55);
        positions[j + 1] = y * radius * scale + (this.mobile ? .45 : -.1);
        positions[j + 2] = z * radius * scale;
      }
    }
    this.initialized = true;
    for (const key of ['position', 'aSize', 'aTint', 'aLight']) this.geometry.attributes[key].needsUpdate = true;
  }

  setPalette(color, highlight) {
    this.material.uniforms.uColor.value.set(color);
    this.material.uniforms.uHighlight.value.set(highlight);
  }

  step({ centers, normals, anchor, morph, dispersion, time, dt, mobile, energy = 0 }) {
    const positions = this.geometry.attributes.position.array;
    const h = Math.max(0, Math.min(dt, .1));
    const mix = THREE.MathUtils.smoothstep(morph, 0, 1);
    const scale = mobile ? .78 : 1;
    const spread = (.25 + dispersion * .7 + energy * .15) * scale;
    for (let bin = 0; bin < 8; bin++) {
      const frequency = THREE.MathUtils.lerp(4.2 + bin * .15, 11 - bin * .65, mix);
      this.frequencies[bin] = frequency;
      this.decays[bin] = Math.exp(-frequency * h);
    }
    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      const sample = this.along[i] * (centers.length - 1);
      const row = Math.min(centers.length - 2, Math.floor(sample));
      const fraction = sample - row;
      const a = centers[row], b = centers[row + 1];
      const nx = THREE.MathUtils.lerp(normals[row].x, normals[row + 1].x, fraction);
      const ny = THREE.MathUtils.lerp(normals[row].y, normals[row + 1].y, fraction);
      const phase = this.phases[i];
      const wave = Math.sin(time * 1.15 - this.along[i] * 9 + phase);
      const cross = this.cross[i * 2] * spread;
      const dustDepth = this.cross[i * 2 + 1] * spread * .8;
      const drift = wave * (.025 + mix * dispersion * .17);
      const tx = THREE.MathUtils.lerp(a.x, b.x, fraction) + nx * (cross + drift);
      const ty = THREE.MathUtils.lerp(a.y, b.y, fraction) + ny * (cross + drift);
      const tz = THREE.MathUtils.lerp(a.z, b.z, fraction) + dustDepth + drift;
      const breath = 1 + .018 * Math.sin(time * .6 + phase);
      const hx = anchor.x + this.homes[j] * scale * breath;
      const hy = anchor.y + this.homes[j + 1] * scale * breath;
      const hz = this.homes[j + 2] * scale * breath;
      const frequency = this.frequencies[this.bins[i]], decay = this.decays[this.bins[i]];
      // Each grain has its own position and momentum. Target changes never
      // replace positions, so drawing and gathering use one continuous motion.
      for (let axis = 0; axis < 3; axis++) {
        const home = axis === 0 ? hx : axis === 1 ? hy : hz;
        const trail = axis === 0 ? tx : axis === 1 ? ty : tz;
        const target = THREE.MathUtils.lerp(home, trail, mix);
        const offset = positions[j + axis] - target;
        const impulse = (this.velocities[j + axis] + frequency * offset) * h;
        const next = target + (offset + impulse) * decay;
        this.velocities[j + axis] = (this.velocities[j + axis] - frequency * impulse) * decay;
        positions[j + axis] = next;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
}
