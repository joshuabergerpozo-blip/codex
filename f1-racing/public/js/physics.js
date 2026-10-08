// Physique de la voiture (modèle "bicyclette" simplifié, orienté arcade-réaliste).
import { WALL } from "./track.js";

const G = 9.81;
const SURFACE = {
  asphalt: { grip: 1, drag: 0, rough: 0 },
  kerb: { grip: 0.93, drag: 0.4, rough: 0.6 },
  runoff: { grip: 0.9, drag: 0.6, rough: 0.1 },
  grass: { grip: 0.55, drag: 2.5, rough: 1 },
  gravel: { grip: 0.45, drag: 7, rough: 1.4 },
};

export class CarPhysics {
  constructor(stats) {
    this.setStats(stats);
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.vx = 0;
    this.vz = 0;
    this.steer = 0;
    this.hp = stats.maxHp;
    this.nitro = stats.nitroCap;
    this.drs = false;
    this.idx = -1;
    this.lateral = 0;
    this.surface = "asphalt";
    this.longAcc = 0;
    this.latAcc = 0;
    this.slip = 0;
    this.nitroActive = false;
    this.braking = false;
  }

  setStats(stats) {
    const ratio = this.stats ? this.hp / this.stats.maxHp : 1;
    this.stats = stats;
    if (this.hp !== undefined)
      this.hp = Math.min(stats.maxHp, Math.max(this.hp, ratio * stats.maxHp));
    if (this.nitro !== undefined)
      this.nitro = Math.min(this.nitro, stats.nitroCap);
  }

  place(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = this.vz = 0;
    this.steer = 0;
    this.idx = -1;
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }

  get forwardSpeed() {
    return this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
  }

  hpFactor() {
    const s = this.stats;
    if (this.hp <= 0) return 0.35;
    return 0.65 + 0.35 * Math.min(1, this.hp / (s.maxHp * 0.6));
  }

  // input: { throttle, brake, steer (-1 gauche .. 1 droite), handbrake, nitro, drs }
  step(dt, input, track) {
    const s = this.stats;
    const near = track.nearest(this.x, this.z, this.idx);
    this.idx = near.i;
    this.lateral = near.lateral;
    this.surface = track.surface(near.i, near.lateral);
    const surf = SURFACE[this.surface];

    // Nitro / DRS
    this.nitroActive = Boolean(
      input.nitro && this.nitro > 0 && s.nitroCap > 0 && input.throttle > 0,
    );
    if (this.nitroActive) this.nitro = Math.max(0, this.nitro - dt);
    else
      this.nitro = Math.min(
        s.nitroCap,
        this.nitro + s.nitroRegen * dt * (input.brake ? 3 : 1),
      );
    if (!s.drs || input.brake || Math.abs(this.steer) > 0.35) this.drs = false;
    else if (input.drs) this.drs = true;

    // Direction (lissée)
    const steerRate = 5 * s.steer;
    this.steer += (input.steer - this.steer) * Math.min(1, dt * steerRate);

    const speed = this.speed;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    let vLong = this.vx * sinH + this.vz * cosH;
    const df = s.downforce * (this.drs ? 0.45 : 1);
    const gripAcc =
      (s.grip * G + df * vLong * vLong) *
      surf.grip *
      (input.handbrake ? 0.75 : 1);

    // Lacet
    const maxAngle = (0.6 / (1 + speed / 20)) * s.steer;
    const delta = this.steer * maxAngle;
    let yaw = (vLong * Math.tan(delta)) / 2.9;
    const maxYaw =
      (gripAcc * (input.handbrake ? 1.6 : 1.15)) / Math.max(Math.abs(vLong), 4);
    yaw = Math.max(-maxYaw, Math.min(maxYaw, yaw));
    this.heading -= yaw * dt;

    // Repère après rotation : la vitesse "glisse" si le grip ne suit pas.
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = -fz;
    const rz = fx;
    vLong = this.vx * fx + this.vz * fz;
    let vLat = this.vx * rx + this.vz * rz;

    const hpF = this.hpFactor();
    const top =
      s.topSpeed *
      hpF *
      (this.nitroActive ? s.nitroBoost : 1) *
      (this.drs ? 1.05 : 1);
    let acc = 0;
    this.braking = false;
    if (input.throttle > 0) {
      if (vLong < top) {
        const ratio = Math.max(0, vLong) / top;
        let a = s.accel * hpF * (1 - ratio ** 2.2) * input.throttle;
        if (this.nitroActive) a += s.accel * 0.6;
        a = Math.min(a, gripAcc * 1.1 + 1.5);
        acc += a;
      } else {
        acc -= (vLong - top) * 0.6;
      }
    }
    if (input.brake > 0) {
      if (vLong > 0.5) {
        acc -= Math.min(s.brake, gripAcc * 1.35 + 3) * input.brake;
        this.braking = true;
      } else if (vLong > -9) {
        acc -= 5 * input.brake;
      }
    }
    // Frein moteur, roulement, traînée, surface
    const sign = Math.sign(vLong);
    let resist =
      0.25 +
      0.00032 * vLong * vLong +
      surf.drag +
      surf.rough * 0.04 * Math.abs(vLong);
    if (!input.throttle && !input.brake) resist += 0.9;
    const before = vLong;
    vLong += acc * dt;
    vLong -= sign * resist * dt;
    if (
      !input.throttle &&
      !input.brake &&
      Math.sign(vLong) !== Math.sign(before)
    )
      vLong = 0;

    // Adhérence latérale
    const latGrip = gripAcc * dt * (input.handbrake ? 0.3 : 1);
    this.slip = Math.abs(vLat);
    if (Math.abs(vLat) <= latGrip) vLat = 0;
    else vLat -= Math.sign(vLat) * latGrip;

    this.longAcc = (vLong - before) / dt;
    this.latAcc = yaw * vLong;

    this.vx = fx * vLong + rx * vLat;
    this.vz = fz * vLong + rz * vLat;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // Auto-réparation
    if (s.autoRepair > 0 && this.hp > 0)
      this.hp = Math.min(s.maxHp, this.hp + s.autoRepair * dt);

    // Murs
    let impact = 0;
    const after = track.nearest(this.x, this.z, this.idx);
    const limit = WALL - 1.05;
    if (Math.abs(after.lateral) > limit) {
      const out = Math.sign(after.lateral);
      const i = after.i;
      const nx = -track.tz[i] * out;
      const nz = track.tx[i] * out;
      const over = Math.abs(after.lateral) - limit;
      this.x -= nx * over;
      this.z -= nz * over;
      const vn = this.vx * nx + this.vz * nz;
      if (vn > 0) {
        impact = vn;
        this.vx -= nx * vn * 1.35;
        this.vz -= nz * vn * 1.35;
        this.vx *= 0.9;
        this.vz *= 0.9;
        // Le choc fait pivoter la voiture vers la piste.
        const th = Math.atan2(track.tx[i], track.tz[i]);
        let d = th - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) < Math.PI / 2)
          this.heading += d * Math.min(0.5, vn * 0.03);
        this.damage(impact);
      }
    }
    return { impact };
  }

  damage(impact) {
    if (impact < 2.5) return 0;
    const dmg = (impact - 2.5) * 2.2 * (1 - this.stats.damageReduce);
    this.hp = Math.max(0, this.hp - dmg);
    return dmg;
  }

  // Collision avec une autre voiture (cercles avant/arrière).
  collide(ox, oz, oh, ovx, ovz) {
    const pts = (x, z, h) => [
      [x + Math.sin(h) * 1.2, z + Math.cos(h) * 1.2],
      [x - Math.sin(h) * 1.2, z - Math.cos(h) * 1.2],
    ];
    const mine = pts(this.x, this.z, this.heading);
    const theirs = pts(ox, oz, oh);
    const R = 2.1;
    let hit = 0;
    for (const [ax, az] of mine) {
      for (const [bx, bz] of theirs) {
        const dx = ax - bx;
        const dz = az - bz;
        const d = Math.hypot(dx, dz);
        if (d >= R || d < 1e-4) continue;
        const nx = dx / d;
        const nz = dz / d;
        const push = (R - d) * 0.5;
        this.x += nx * push;
        this.z += nz * push;
        const rel = (this.vx - ovx) * nx + (this.vz - ovz) * nz;
        if (rel < 0) {
          this.vx -= nx * rel * 0.8;
          this.vz -= nz * rel * 0.8;
          hit = Math.max(hit, -rel);
        }
      }
    }
    if (hit > 0) this.damage(hit * 0.7);
    return hit;
  }

  gear() {
    const v = this.forwardSpeed;
    if (v < -0.5) return { gear: "R", rpm: Math.min(1, -v / 9) * 0.7 + 0.25 };
    if (v < 0.5) return { gear: "N", rpm: 0.18 };
    const n = this.stats.gears;
    const ratio = Math.min(1.05, v / (this.stats.topSpeed * 1.02));
    const pos = Math.sqrt(ratio) * n;
    const g = Math.min(n, Math.floor(pos) + 1);
    const frac = Math.min(1, pos - (g - 1));
    return { gear: String(g), rpm: 0.35 + frac * 0.65 };
  }
}
