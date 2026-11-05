/**
 * SpringSolver.ts
 * Real damped harmonic spring solver for 120Hz/144Hz sub-pixel typography physics.
 * Uses semi-implicit Euler integration for unconditional stability.
 */

export class HarmonicSpring {
  public position: number;
  public velocity: number;
  public target: number;
  public stiffness: number;
  public damping: number;
  public mass: number;

  constructor(initialPosition: number = 0, stiffness: number = 180, damping: number = 22, mass: number = 1.0) {
    this.position = initialPosition;
    this.velocity = 0;
    this.target = initialPosition;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
  }

  public setTarget(target: number): void {
    this.target = target;
  }

  public reset(position: number, velocity: number = 0): void {
    this.position = position;
    this.velocity = velocity;
    this.target = position;
  }

  /**
   * Semi-implicit Euler integration step
   * @param dt delta time in seconds (clamped to prevent explosion on tab blur)
   */
  public step(dt: number): number {
    const clampedDt = Math.min(dt, 0.033); // Clamp to max ~30Hz delta
    const springForce = -this.stiffness * (this.position - this.target);
    const dampingForce = -this.damping * this.velocity;
    const acceleration = (springForce + dampingForce) / this.mass;

    this.velocity += acceleration * clampedDt;
    this.position += this.velocity * clampedDt;

    // Settle threshold to avoid continuous micro-calculations
    if (Math.abs(this.velocity) < 0.0001 && Math.abs(this.position - this.target) < 0.0001) {
      this.position = this.target;
      this.velocity = 0;
    }

    return this.position;
  }

  public isSettled(): boolean {
    return Math.abs(this.velocity) < 0.0001 && Math.abs(this.position - this.target) < 0.0001;
  }
}

/**
 * 2D Spring Vector for Camera translation and tracking
 */
export class SpringVector2 {
  public x: HarmonicSpring;
  public y: HarmonicSpring;

  constructor(initX: number = 0, initY: number = 0, stiffness: number = 120, damping: number = 22) {
    this.x = new HarmonicSpring(initX, stiffness, damping);
    this.y = new HarmonicSpring(initY, stiffness, damping);
  }

  public setTarget(targetX: number, targetY: number): void {
    this.x.setTarget(targetX);
    this.y.setTarget(targetY);
  }

  public step(dt: number): { x: number; y: number } {
    return {
      x: this.x.step(dt),
      y: this.y.step(dt)
    };
  }

  public reset(x: number, y: number): void {
    this.x.reset(x);
    this.y.reset(y);
  }
}
