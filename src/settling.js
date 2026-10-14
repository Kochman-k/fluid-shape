// Gesture energy and the release clock are separate from the mouse position.
// The trailing path must not disappear before it has gathered into a sphere.
export class StrokeSettling {
  constructor() { this.reset(); }

  reset() {
    this.morph = 0;
    this.velocity = 0;
    this.energy = 0;
    this.lastMove = null;
    this.lastPoint = null;
    this.trailTime = 0;
  }

  move(x, y, time) {
    if (this.lastMove !== null && time < this.lastMove) return;
    if (this.lastPoint && time - this.lastMove < 1600) {
      const seconds = Math.max(.008, (time - this.lastMove) / 1000);
      const speed = Math.hypot(x - this.lastPoint.x, y - this.lastPoint.y) / seconds;
      this.energy = Math.max(this.energy * Math.exp(-seconds / .5), Math.min(1, speed / 7));
    } else this.energy = 0;
    this.lastPoint = { x, y };
    this.lastMove = time;
  }

  step(now, dt, softness, motionScale = 1) {
    if (this.lastMove === null) { this.trailTime = now; return; }
    const age = Math.max(0, (now - this.lastMove) / 1000);
    const hold = .24 + softness * .13 + this.energy * .17;
    const release = Math.max(0, age - hold);
    const relaxation = .43 + softness * .15 + this.energy * .2;
    const target = Math.exp(-release / relaxation) * motionScale;
    const frequency = target > this.morph ? 10 - softness * 2 : 4.8 - softness * .5 - this.energy * .9;
    // Exact critically damped spring: velocity is continuous when a stroke stops
    // or resumes, and the sphere settles without elastic bouncing.
    const offset = this.morph - target;
    const impulse = (this.velocity + frequency * offset) * dt;
    const decay = Math.exp(-frequency * dt);
    this.morph = target + (offset + impulse) * decay;
    this.velocity = (this.velocity - frequency * impulse) * decay;

    // Continue the path briefly, then preserve its remaining length while the
    // morph gathers it. Advancing wall time indefinitely would erase the tail.
    const coast = .14 + softness * .05 + this.energy * .14;
    this.trailTime = this.lastMove + coast * (1 - Math.exp(-age / coast)) * 1000;
  }
}
