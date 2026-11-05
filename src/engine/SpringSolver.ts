/**
 * SpringSolver.ts
 * Real damped harmonic spring solver and standardized motion tokens.
 * Uses semi-implicit Euler integration with fixed 1/240s stepping for unconditional stability.
 */

export type SpringPresetName = 'soft' | 'snappy' | 'heavy' | 'float';

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

export const SPRING_PRESETS: Record<SpringPresetName, SpringConfig> = {
  // Ambient breathing, soft opacity/rim transitions
  soft:   { stiffness: 75,  damping: 16, mass: 1.0 },
  // Word reveals, active scale lift, liquid fill sweep
  snappy: { stiffness: 190, damping: 22, mass: 1.0 },
  // Line entrances, vertical stage tracking, gravity drop
  heavy:  { stiffness: 120, damping: 24, mass: 1.0 },
  // Camera noise drift, background parallax, floating particles
  float:  { stiffness: 40,  damping: 11, mass: 1.0 }
};

// ─── Standard Easing Curves ───────────────────────────────────────────────────

export const Easing = {
  sineInOut(t: number): number {
    return -(Math.cos(Math.PI * Math.max(0, Math.min(1, t))) - 1) / 2;
  },
  cubicOut(t: number): number {
    const f = Math.max(0, Math.min(1, t)) - 1;
    return f * f * f + 1;
  },
  expoOut(t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped === 1 ? 1 : 1 - Math.pow(2, -10 * clamped);
  }
};

// ─── Damped Harmonic Spring ───────────────────────────────────────────────────

export class HarmonicSpring {
  public position: number;
  public velocity: number;
  public target: number;
  public stiffness: number;
  public damping: number;
  public mass: number;

  constructor(
    initialPosition: number = 0,
    stiffness: number = 180,
    damping: number = 22,
    mass: number = 1.0
  ) {
    this.position = initialPosition;
    this.velocity = 0;
    this.target = initialPosition;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
  }

  public static fromPreset(preset: SpringPresetName, initialPosition: number = 0): HarmonicSpring {
    const cfg = SPRING_PRESETS[preset];
    return new HarmonicSpring(initialPosition, cfg.stiffness, cfg.damping, cfg.mass);
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
    const clampedDt = Math.min(dt, 0.033);
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

  constructor(
    initX: number = 0,
    initY: number = 0,
    stiffness: number = 120,
    damping: number = 22
  ) {
    this.x = new HarmonicSpring(initX, stiffness, damping);
    this.y = new HarmonicSpring(initY, stiffness, damping);
  }

  public static fromPreset(preset: SpringPresetName, initX: number = 0, initY: number = 0): SpringVector2 {
    const cfg = SPRING_PRESETS[preset];
    return new SpringVector2(initX, initY, cfg.stiffness, cfg.damping);
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

  public isSettled(): boolean {
    return this.x.isSettled() && this.y.isSettled();
  }
}

/**
 * Deterministic Fixed Physics Step Accumulator (1/240s = 4.166ms)
 * Guarantees frame-rate independent physics across 60Hz, 120Hz, 144Hz, 240Hz monitors.
 */
export class FixedStepAccumulator {
  private accumulator: number = 0;
  public static readonly FIXED_TIMESTEP: number = 1 / 240; // ~4.166ms

  public update(dt: number, stepCallback: (fixedDt: number) => void): void {
    // Clamp max dt to 100ms to prevent spiral of death when tab is unfocused
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= FixedStepAccumulator.FIXED_TIMESTEP) {
      stepCallback(FixedStepAccumulator.FIXED_TIMESTEP);
      this.accumulator -= FixedStepAccumulator.FIXED_TIMESTEP;
    }
  }

  public reset(): void {
    this.accumulator = 0;
  }
}
