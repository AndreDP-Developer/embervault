import * as T from "./vendor/three.module.js";

// Articulated, human-proportioned mesh. Joints remain separate so stride, turning,
// weapon windup and recovery can follow motion rather than sliding a rigid figure.
export function createAdventurer(skeleton = false) {
  const root = new T.Group(),
    body = new T.Group();
  root.add(body);
  const mat = (color, metalness = 0, roughness = 0.75) =>
    new T.MeshStandardMaterial({ color, metalness, roughness });
  const skin = mat(skeleton ? 0xc7bd9f : 0xc8a37c),
    cloth = mat(0x4f655c),
    leather = mat(0x3d2920),
    steel = mat(0x798990, 0.72, 0.32),
    trim = mat(0xb49356, 0.65, 0.35),
    dark = mat(0x19201f),
    capeMat = mat(0x49352e);
  function mesh(geo, material, parent, x, y, z) {
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function ell(parent, x, y, z, sx, sy, sz, m) {
    const obj = mesh(new T.SphereGeometry(1, 16, 12), m, parent, x, y, z);
    obj.scale.set(sx, sy, sz);
    return obj;
  }
  function taper(parent, x, y, z, top, bottom, h, m) {
    return mesh(new T.CylinderGeometry(top, bottom, h, 12), m, parent, x, y, z);
  }
  const torso = ell(
    body,
    0,
    1.04,
    0,
    0.225,
    0.32,
    0.135,
    skeleton ? skin : cloth,
  );
  if (!skeleton) {
    ell(body, 0, 1.1, 0.08, 0.2, 0.22, 0.085, steel);
    taper(body, 0, 0.84, 0, 0.24, 0.28, 0.22, cloth);
    taper(body, 0, 0.85, 0, 0.242, 0.244, 0.07, leather);
    ell(body, 0, 0.85, 0.243, 0.045, 0.046, 0.016, trim);
  } else {
    torso.scale.set(0.1, 0.25, 0.065);
    for (let i = 0; i < 4; i++) {
      const rib = mesh(
        new T.TorusGeometry(0.15 - i * 0.01, 0.022, 6, 16, Math.PI * 1.65),
        skin,
        body,
        0,
        1.21 - i * 0.08,
        0,
      );
      rib.rotation.x = Math.PI / 2;
    }
  }
  taper(body, 0, 1.37, 0, 0.066, 0.077, 0.14, skin);
  ell(body, 0, 1.54, 0, 0.126, 0.166, 0.115, skin);
  ell(body, 0, 1.51, 0.111, 0.032, 0.042, 0.045, skin);
  ell(body, -0.05, 1.57, 0.103, 0.019, 0.013, 0.012, dark);
  ell(body, 0.05, 1.57, 0.103, 0.019, 0.013, 0.012, dark);
  let cape;
  if (!skeleton) {
    ell(body, 0, 1.64, -0.025, 0.137, 0.091, 0.116, leather);
    ell(body, 0, 1.49, -0.081, 0.115, 0.14, 0.055, leather);
    ell(body, -0.24, 1.25, 0, 0.12, 0.1, 0.15, steel);
    ell(body, 0.24, 1.25, 0, 0.12, 0.1, 0.15, steel);
    const shape = new T.Shape();
    shape.moveTo(-0.17, 0);
    shape.quadraticCurveTo(-0.31, -0.35, -0.33, -0.83);
    shape.quadraticCurveTo(0, -0.96, 0.33, -0.83);
    shape.quadraticCurveTo(0.31, -0.35, 0.17, 0);
    cape = mesh(new T.ShapeGeometry(shape, 12), capeMat, body, 0, 1.3, -0.17);
    cape.material.side = T.DoubleSide;
    cape.rotation.x = 0.16;
    // Diagonal leather strap, backpack and shield.
    const strap = mesh(
      new T.CylinderGeometry(0.023, 0.023, 0.56, 8),
      leather,
      body,
      0,
      1.09,
      0.15,
    );
    strap.rotation.z = -0.52;
    const glow = new T.MeshBasicMaterial({ color: 0xffca76 });
    taper(body, -0.26, 0.77, -0.05, 0.06, 0.06, 0.13, glow);
    taper(body, -0.26, 0.69, -0.05, 0.075, 0.075, 0.03, trim);
    taper(body, -0.26, 0.85, -0.05, 0.075, 0.055, 0.035, trim);
    const lanternLight = new T.PointLight(0xffbd71, 2.5, 3.5);
    lanternLight.position.set(-0.25, 0.9, 0);
    body.add(lanternLight);
  }
  const legs = [],
    knees = [],
    arms = [];
  for (const sign of [-1, 1]) {
    const hip = new T.Group();
    hip.position.set(sign * 0.105, 0.78, 0);
    body.add(hip);
    legs.push(hip);
    taper(hip, 0, -0.18, 0, 0.077, 0.057, 0.35, skeleton ? skin : leather);
    const knee = new T.Group();
    knee.position.y = -0.36;
    hip.add(knee);
    knees.push(knee);
    ell(knee, 0, 0, 0, 0.059, 0.064, 0.063, skeleton ? skin : steel);
    taper(knee, 0, -0.155, 0, 0.054, 0.043, 0.31, skeleton ? skin : leather);
    ell(knee, 0, -0.31, 0.047, 0.062, 0.064, 0.117, skeleton ? skin : dark);
    const shoulder = new T.Group();
    shoulder.position.set(sign * 0.265, 1.22, 0);
    body.add(shoulder);
    arms.push(shoulder);
    taper(shoulder, 0, -0.135, 0, 0.059, 0.046, 0.27, skeleton ? skin : cloth);
    ell(shoulder, 0, -0.27, 0, 0.05, 0.053, 0.05, skin);
    taper(
      shoulder,
      0,
      -0.36,
      0.015,
      0.052,
      0.044,
      0.19,
      skeleton ? skin : leather,
    );
    ell(shoulder, 0, -0.48, 0.028, 0.047, 0.065, 0.048, skin);
  }
  const sword = new T.Group();
  sword.position.set(0, -0.43, 0.035);
  arms[1].add(sword);
  sword.rotation.x = -0.55;
  taper(sword, 0, 0.02, 0, 0.024, 0.024, 0.2, leather);
  const guard = mesh(
    new T.CylinderGeometry(0.018, 0.018, 0.24, 8),
    trim,
    sword,
    0,
    0.14,
    0,
  );
  guard.rotation.z = Math.PI / 2;
  const bladeShape = new T.Shape();
  bladeShape.moveTo(-0.045, 0.17);
  bladeShape.lineTo(-0.035, 0.67);
  bladeShape.lineTo(0, 0.8);
  bladeShape.lineTo(0.035, 0.67);
  bladeShape.lineTo(0.045, 0.17);
  bladeShape.closePath();
  const blade = mesh(
    new T.ExtrudeGeometry(bladeShape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.005,
      bevelThickness: 0.005,
    }),
    steel,
    sword,
    0,
    0,
    0,
  );
  if (!skeleton) {
    const shield = mesh(
      new T.CylinderGeometry(0.18, 0.18, 0.045, 16),
      leather,
      arms[0],
      -0.06,
      -0.28,
      0.065,
    );
    shield.rotation.z = Math.PI / 2;
    const rim = mesh(
      new T.TorusGeometry(0.175, 0.016, 8, 24),
      trim,
      arms[0],
      -0.088,
      -0.28,
      0.065,
    );
    rim.rotation.y = Math.PI / 2;
    ell(arms[0], -0.105, -0.28, 0.065, 0.045, 0.055, 0.055, steel);
  }
  let heading = 0,
    attack = 0,
    hurt = 0,
    stride = 0;
  return {
    root,
    face(dx, dz) {
      if (dx || dz) heading = Math.atan2(dx, dz);
    },
    strike() {
      attack = 0.46;
    },
    hit() {
      hurt = 0.25;
    },
    animate(dt, speed, time) {
      stride += dt * speed * 9;
      const gait = Math.min(1, speed / 3.7);
      attack = Math.max(0, attack - dt);
      hurt = Math.max(0, hurt - dt);
      const angle =
        T.MathUtils.euclideanModulo(
          heading - root.rotation.y + Math.PI,
          Math.PI * 2,
        ) - Math.PI;
      root.rotation.y += angle * Math.min(1, dt * 15);
      legs[0].rotation.x = Math.sin(stride) * 0.6 * gait;
      legs[1].rotation.x = -Math.sin(stride) * 0.6 * gait;
      knees[0].rotation.x = Math.max(0, -Math.sin(stride)) * 0.7 * gait;
      knees[1].rotation.x = Math.max(0, Math.sin(stride)) * 0.7 * gait;
      arms[0].rotation.x = -Math.sin(stride) * 0.35 * gait - 0.12;
      arms[1].rotation.x = Math.sin(stride) * 0.35 * gait - 0.2;
      arms[1].rotation.z = -0.12;
      body.rotation.y = 0;
      if (attack) {
        const phase = 1 - attack / 0.46,
          swing = Math.sin(phase * Math.PI);
        arms[1].rotation.x = -0.35 - swing * 2.0;
        arms[1].rotation.z = -0.15 - swing * 0.8;
        body.rotation.y = -Math.sin(phase * Math.PI * 2) * 0.28;
      }
      body.position.y =
        Math.sin(stride * 2) * 0.016 * gait + Math.sin(time * 2) * 0.005;
      body.rotation.z = hurt ? Math.sin(hurt * 35) * 0.1 : 0;
      if (cape)
        cape.rotation.x = 0.16 + gait * 0.15 + Math.sin(stride) * 0.04 * gait;
    },
  };
}
