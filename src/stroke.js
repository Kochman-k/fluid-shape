// Pointer positions are retained in time order, so the ribbon follows the
// actual stroke through corners rather than rotating a fixed shape.
export class StrokeTrail {
  constructor() { this.points = []; }

  clear() { this.points.length = 0; }

  add(x, y, time) {
    const previous = this.points.at(-1);
    if (previous && time < previous.time) return;
    if (previous && time - previous.time > 1600) this.clear();
    const last = this.points.at(-1);
    if (last && time - last.time < 4) this.points[this.points.length - 1] = { x, y, time };
    else this.points.push({ x, y, time });
    while (this.points.length > 2 && this.points[1].time < time - 2000) this.points.shift();
    if (this.points.length > 512) this.points.splice(0, this.points.length - 512);
  }

  sample(time, target) {
    const points = this.points;
    if (!points.length) return target.set(0, 0, 0);
    const first = points[0], last = points.at(-1);
    if (time <= first.time) return target.set(first.x, first.y, 0);
    if (time >= last.time) return target.set(last.x, last.y, 0);
    let low = 0, high = points.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (points[middle].time <= time) low = middle;
      else high = middle;
    }
    const a = points[low], b = points[high];
    const blend = (time - a.time) / (b.time - a.time);
    return target.set(a.x + (b.x - a.x) * blend, a.y + (b.y - a.y) * blend, 0);
  }
}
