import { Vector3 } from 'three';

// A light viscous motion model for the ribbon centerline. Each section carries
// momentum, instead of being stamped at its sampled mouse position every frame.
export class RibbonFlow {
  constructor(count) {
    this.points = Array.from({ length: count }, () => new Vector3());
    this.velocities = Array.from({ length: count }, () => new Vector3());
    this.previousVelocities = Array.from({ length: count }, () => new Vector3());
    this.initialized = false;
  }

  reset() { this.initialized = false; }

  step(targets, dt, softness, idleSeconds, energy = 0) {
    if (!this.initialized) {
      this.points.forEach((point, i) => point.copy(targets[i]));
      this.velocities.forEach(velocity => velocity.set(0, 0, 0));
      this.initialized = true;
    }
    const duration = Math.max(0, Math.min(dt, .1));
    const steps = Math.max(1, Math.ceil(duration * 120));
    const h = duration / steps;
    const release = Math.exp(-Math.max(0, idleSeconds - .04) / (.2 + softness * .15));
    const speedLimit = 5 + Math.max(0, Math.min(1, energy)) * 5;
    for (let step = 0; step < steps; step++) {
      this.previousVelocities.forEach((velocity, i) => velocity.copy(this.velocities[i]));
      for (let i = 0; i < this.points.length; i++) {
        const along = i / (this.points.length - 1);
        const frequency = (30 - along * 17) * (1 - softness * .22);
        // The brush tip remains attached to the cursor. Older sections are
        // released into free drift and gradually lose energy, like a fluid wake.
        const attachment = i === 0 ? 1 : release;
        const stiffness = frequency * frequency * attachment;
        const drag = 2 * frequency * attachment + (1.7 - softness * .6) * (1 - attachment);
        const velocity = this.velocities[i];
        const point = this.points[i];
        const before = this.previousVelocities[Math.max(0, i - 1)];
        const after = this.previousVelocities[Math.min(this.points.length - 1, i + 1)];
        const previous = this.previousVelocities[i];
        for (const axis of ['x', 'y', 'z']) {
          const viscosity = ((before[axis] + after[axis]) * .5 - previous[axis]) * 4 * (1 - attachment);
          velocity[axis] += ((targets[i][axis] - point[axis]) * stiffness + viscosity) * h;
          velocity[axis] *= Math.exp(-drag * h);
        }
        velocity.clampLength(0, speedLimit);
        point.addScaledVector(velocity, h);
      }
    }
    return this.points;
  }
}
