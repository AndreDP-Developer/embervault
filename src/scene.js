import * as THREE from "./vendor/three.module.js";
import { WORLD, FLOOR_KEYS, tileKey } from "./world.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";
import { createAdventurer } from "./character.js";
import { knownTile } from "./navigation.js";

export function createScene(container, onPick = () => {}, onHover = () => {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x101c20, 0.024);
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  let zoom = 5.8,
    state,
    clock = 0;
  const focus = new THREE.Vector3(3, 0, 3);
  scene.add(new THREE.HemisphereLight(0xb9c8d0, 0x15181b, 1.4));
  const sun = new THREE.DirectionalLight(0xa2b7c2, 2.2);
  sun.position.set(-7, 16, -8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -30,
    right: 30,
    top: 30,
    bottom: -30,
  });
  sun.shadow.normalBias = 0.05;
  scene.add(sun);
  const mats = {
    stone: new THREE.MeshStandardMaterial({ color: 0x536561, roughness: 1 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x253b39, roughness: 1 }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xc49a4b,
      metalness: 0.65,
      roughness: 0.35,
    }),
    wood: new THREE.MeshStandardMaterial({ color: 0x46392c, roughness: 1 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x508e84, roughness: 0.9 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xc8b994, roughness: 1 }),
    iron: new THREE.MeshStandardMaterial({
      color: 0x929e9a,
      metalness: 0.8,
      roughness: 0.4,
    }),
    dark: new THREE.MeshStandardMaterial({ color: 0x16272a, roughness: 1 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xb9baa0, roughness: 1 }),
    rat: new THREE.MeshStandardMaterial({ color: 0x6d6660, roughness: 1 }),
    fire: new THREE.MeshBasicMaterial({ color: 0xffc77a }),
    relic: new THREE.MeshStandardMaterial({
      color: 0xebbb53,
      emissive: 0xcb7b17,
      emissiveIntensity: 1.4,
      metalness: 0.5,
      roughness: 0.3,
    }),
  };
  const boxGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
  function box(parent, x, y, z, sx, sy, sz, mat) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function sphere(parent, x, y, z, r, mat, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function cylinder(parent, x, y, z, r, h, mat) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const floorGroups = [];
  const pickables = [];
  function tag(group, data) {
    group.userData.pick = data;
    pickables.push(group);
  }
  function stoneTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const c = canvas.getContext("2d");
    c.fillStyle = "#a9a598";
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1800; i++) {
      const n = Math.abs(Math.sin(i * 78.233) * 43758.5453) % 1;
      const x = (i * 37) % 128,
        y = (i * 71 + Math.floor(i / 128) * 13) % 128;
      c.fillStyle = `rgba(${n > 0.5 ? "240,235,210" : "24,28,25"},${0.03 + n * 0.13})`;
      c.fillRect(x, y, 1 + n * 3, 1 + n * 2);
    }
    c.strokeStyle = "rgba(25,30,28,.28)";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(15, 0);
    c.lineTo(31, 25);
    c.lineTo(25, 41);
    c.lineTo(46, 57);
    c.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const stoneMap = stoneTexture();
  mats.stone.map = stoneMap;
  mats.edge.map = stoneMap;
  const roomAt = (x, z) =>
    WORLD.rooms.find(
      (r) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.h,
    )?.id;
  const torchLights = [];
  function torch(parent, x, z) {
    cylinder(parent, x, 0.55, z, 0.07, 0.65, mats.wood);
    box(parent, x, 0.86, z, 0.23, 0.12, 0.23, mats.gold);
    const flame = sphere(parent, x, 1.02, z, 0.13, mats.fire, 0.65, 1.6, 0.65);
    const light = new THREE.PointLight(0xffb65f, 7, 6, 2);
    light.position.set(x, 1.3, z);
    parent.add(light);
    torchLights.push({ light, flame });
  }
  for (const tile of WORLD.floor) {
    const g = new THREE.Group();
    g.position.set(tile.x, 0, tile.z);
    scene.add(g);
    const n = Math.abs(Math.sin(tile.x * 41.3 + tile.z * 17.8));
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.12, 0.08, 0.34 + n * 0.08),
      map: stoneMap,
      roughness: 1,
    });
    box(g, 0, -0.14, 0, 0.99, 0.28, 0.99, mat);
    tag(g, { type: "floor", x: tile.x, z: tile.z, label: "Move here" });
    box(g, 0, -0.48, 0, 1, 0.4, 1, mats.edge);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (!FLOOR_KEYS.has(tileKey(tile.x + dx, tile.z + dz))) {
        // Near walls are low parapets so the elevated view keeps every tile readable.
        const rows = dz === -1 || dx === -1 ? 3 : 1;
        for (let row = 0; row < rows; row++)
          box(
            g,
            dx * 0.48,
            0.17 + row * 0.34,
            dz * 0.48,
            dx ? 0.19 : 0.98,
            0.32,
            dz ? 0.19 : 0.98,
            row % 2 ? mats.edge : mats.stone,
          );
        if (rows === 3 && n > 0.75)
          box(
            g,
            dx * 0.48,
            1.07,
            dz * 0.48,
            dx ? 0.26 : 1.03,
            0.1,
            dz ? 0.26 : 1.03,
            mats.stone,
          );
      }
    floorGroups.push({
      group: g,
      x: tile.x,
      z: tile.z,
      roomId: roomAt(tile.x, tile.z),
    });
  }
  const decorations = [];
  for (const room of WORLD.rooms) {
    const g = new THREE.Group();
    scene.add(g);
    decorations.push({ group: g, roomId: room.id });
    for (const [x, z] of [
      [room.x + 0.3, room.z + 0.3],
      [room.x + room.w - 1.3, room.z + 0.3],
    ]) {
      box(g, x, 0.1, z, 0.5, 0.2, 0.5, mats.stone);
      cylinder(g, x, 0.77, z, 0.16, 1.25, mats.stone);
      box(g, x, 1.43, z, 0.44, 0.16, 0.44, mats.stone);
      torch(g, x + 0.2, z + 0.15);
    }
    if (room.id === "vestibule") {
      for (let i = 0; i < 3; i++)
        box(g, 1 + i * 0.7, 0.05, 0, 0.65, 0.08, 0.65, mats.gold);
    }
    if (room.id === "cellar" || room.id === "kitchen") {
      for (let i = 0; i < 3; i++) {
        const x = room.x + 0.5 + i * 1.1,
          z = room.z + 0.5;
        sphere(g, x, 0.23, z, 0.25, mats.wood, 1, 1.3, 1);
        cylinder(g, x, 0.49, z, 0.11, 0.08, mats.gold);
      }
    }
    if (room.id === "chapel" || room.id === "sanctum") {
      const x = room.x + room.w / 2 - 0.5,
        z = room.z + 0.8;
      box(g, x, 0.25, z, 1.7, 0.5, 0.65, mats.edge);
      box(g, x, 0.55, z, 1.95, 0.13, 0.82, mats.stone);
      const idol = sphere(g, x, 0.94, z, 0.32, mats.gold, 1, 1.3, 0.55);
      for (let k = 0; k < 3; k++) {
        let leg = box(g, x, 0.94, z, 0.85, 0.055, 0.07, mats.gold);
        leg.rotation.y = (k - 1) * 0.6;
      }
      sphere(g, x, 1.3, z, 0.17, mats.gold);
    }
    if (room.id === "crypt") {
      for (let i = 0; i < 2; i++) {
        box(
          g,
          room.x + 1 + i * 2,
          0.23,
          room.z + 0.6,
          0.7,
          0.46,
          1.1,
          mats.edge,
        );
        box(
          g,
          room.x + 1 + i * 2,
          0.49,
          room.z + 0.6,
          0.8,
          0.12,
          1.2,
          mats.stone,
        );
      }
    }
  }
  const exit = new THREE.Group();
  exit.position.set(WORLD.exit.x, 0.025, WORLD.exit.z);
  scene.add(exit);
  const exitRing = new THREE.Mesh(
    new THREE.RingGeometry(0.29, 0.39, 32),
    new THREE.MeshBasicMaterial({ color: 0xcdb57c, side: THREE.DoubleSide }),
  );
  exitRing.rotation.x = -Math.PI / 2;
  exit.add(exitRing);
  tag(exit, { type: "exit", ...WORLD.exit, label: "Vault entrance" });
  // A broad picking disk makes the entrance usable without hitting its thin ring.
  const exitHit = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 20),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  exitHit.rotation.x = -Math.PI / 2;
  exit.add(exitHit);
  const secret = new THREE.Group();
  secret.position.set(WORLD.secret.x, 0, WORLD.secret.z);
  box(secret, 0, 0.6, 0, 0.88, 1.2, 0.88, mats.stone);
  box(secret, 0, 0.65, -0.45, 0.04, 0.8, 0.015, mats.gold);
  scene.add(secret);
  tag(secret, {
    type: "secret",
    ...WORLD.secret,
    label: "Loose stonework · Search",
  });
  const hero = createAdventurer();
  const player = hero.root;
  player.position.set(2, 0, 2);
  scene.add(player);
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.33, 0.36, 32),
    new THREE.MeshBasicMaterial({
      color: 0xc0d5b3,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.02;
  player.add(halo);
  const enemyMeshes = new Map();
  const enemyRigs = new Map();
  for (const e of WORLD.initialEnemies) {
    let g;
    if (e.kind === "rat") {
      g = new THREE.Group();
      sphere(g, 0, 0.19, 0, 0.25, mats.rat, 1, 0.7, 1.4);
      sphere(g, 0, 0.2, -0.3, 0.15, mats.rat);
      sphere(g, -0.12, 0.34, -0.24, 0.075, mats.rat);
      sphere(g, 0.12, 0.34, -0.24, 0.075, mats.rat);
      box(g, 0, 0.1, 0.44, 0.04, 0.035, 0.35, mats.rat);
      sphere(g, -0.08, 0.23, -0.41, 0.025, mats.fire);
      sphere(g, 0.08, 0.23, -0.41, 0.025, mats.fire);
    } else {
      const rig = createAdventurer(true);
      g = rig.root;
      enemyRigs.set(e.id, rig);
    }
    g.position.set(e.x, 0, e.z);
    scene.add(g);
    enemyMeshes.set(e.id, g);
    const hitArea = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, e.kind === "rat" ? 0.7 : 1.7, 8),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    hitArea.position.y = e.kind === "rat" ? 0.35 : 0.85;
    g.add(hitArea);
    tag(g, {
      type: "enemy",
      id: e.id,
      label: e.kind === "rat" ? "Vault rat" : "Skeleton guardian",
    });
  }
  const pickupMeshes = new Map();
  for (const p of WORLD.initialPickups) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    if (p.kind === "relic") {
      box(g, 0, 0.12, 0, 0.5, 0.24, 0.5, mats.edge);
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.23), mats.relic);
      m.position.y = 0.65;
      g.add(m);
      const l = new THREE.PointLight(0xffc15a, 4, 3);
      l.position.y = 0.8;
      g.add(l);
    } else if (p.kind === "gold") {
      box(g, 0, 0.15, 0, 0.52, 0.3, 0.36, mats.wood);
      box(g, 0, 0.31, 0, 0.56, 0.08, 0.39, mats.gold);
      box(g, 0, 0.2, -0.19, 0.1, 0.15, 0.02, mats.gold);
    } else {
      sphere(
        g,
        0,
        0.22,
        0,
        0.16,
        new THREE.MeshStandardMaterial({ color: 0x72b6a4, emissive: 0x1b4e46 }),
      );
      cylinder(g, 0, 0.39, 0, 0.055, 0.12, mats.gold);
    }
    scene.add(g);
    pickupMeshes.set(p.id, g);
    tag(g, {
      type: "pickup",
      id: p.id,
      x: p.x,
      z: p.z,
      label:
        p.kind === "gold"
          ? "Silver chest"
          : p.kind === "relic"
            ? "Emberheart"
            : "Healing salve",
    });
  }
  const trapMeshes = WORLD.initialTraps.map((t) => {
    const g = new THREE.Group();
    g.position.set(t.x, 0.015, t.z);
    for (let i = 0; i < 3; i++)
      box(g, (i - 1) * 0.19, 0, 0, 0.08, 0.02, 0.65, mats.gold);
    scene.add(g);
    return g;
  });
  function visible(x, z) {
    return knownTile(state, x, z);
  }
  function update(s) {
    const previous = state;
    state = s;
    if (
      hovered?.type === "enemy" &&
      !s.enemies.find((e) => e.id === hovered.id)?.alive
    ) {
      hovered = null;
      marker.visible = false;
      onHover(null);
    }
    if (previous) {
      if (s.player.hp < previous.player.hp) {
        hero.hit();
        floatText(
          `−${previous.player.hp - s.player.hp}`,
          s.player.x,
          1.8,
          s.player.z,
          "hurt",
        );
      } else if (s.player.hp > previous.player.hp)
        floatText(
          `+${s.player.hp - previous.player.hp}`,
          s.player.x,
          1.8,
          s.player.z,
          "heal",
        );
      for (const enemy of s.enemies) {
        const before = previous.enemies.find((e) => e.id === enemy.id);
        if (before && enemy.hp < before.hp) {
          hero.face(enemy.x - s.player.x, enemy.z - s.player.z);
          hero.strike();
          enemyRigs.get(enemy.id)?.hit();
          floatText(`${before.hp - enemy.hp}`, enemy.x, 1.4, enemy.z, "damage");
        }
      }
    }
    floorGroups.forEach((t) => {
      t.group.visible = visible(t.x, t.z);
    });
    decorations.forEach(
      (d) => (d.group.visible = s.discovered.includes(d.roomId)),
    );
    secret.visible =
      !s.secretOpen &&
      Math.hypot(s.player.x - WORLD.secret.x, s.player.z - WORLD.secret.z) < 6;
    s.enemies.forEach((e) => {
      enemyMeshes.get(e.id).visible = e.alive && visible(e.x, e.z);
    });
    s.pickups.forEach(
      (p) =>
        (pickupMeshes.get(p.id).visible = !p.collected && visible(p.x, p.z)),
    );
    s.traps.forEach((t, i) => {
      trapMeshes[i].visible = (t.revealed || t.spent) && visible(t.x, t.z);
    });
  }
  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.left = (-zoom * w) / h;
    camera.right = (zoom * w) / h;
    camera.top = zoom;
    camera.bottom = -zoom;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.31, 40),
    new THREE.MeshBasicMaterial({
      color: 0xdbc38b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.03;
  marker.visible = false;
  scene.add(marker);
  const destination = marker.clone();
  destination.material = marker.material.clone();
  destination.material.color.setHex(0xf1d7a0);
  destination.visible = false;
  scene.add(destination);
  const pathGroup = new THREE.Group();
  scene.add(pathGroup);
  let hovered = null;
  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    let floorHit = null;
    for (const hit of hits) {
      let group = hit.object,
        shown = true;
      for (let p = hit.object; p; p = p.parent) if (!p.visible) shown = false;
      if (!shown) continue;
      while (group && !group.userData.pick) group = group.parent;
      if (group) {
        const data = group.userData.pick;
        if (data.type !== "floor") return data;
        floorHit ??= data;
      }
    }
    return floorHit;
  }
  renderer.domElement.addEventListener("pointermove", (event) => {
    hovered = pick(event);
    onHover(hovered);
    renderer.domElement.style.cursor = hovered
      ? hovered.type === "enemy"
        ? "crosshair"
        : "pointer"
      : "default";
    if (hovered) {
      const obj =
        hovered.type === "enemy"
          ? state.enemies.find((e) => e.id === hovered.id)
          : hovered;
      marker.position.set(obj.x, 0.035, obj.z);
      marker.visible = true;
      marker.material.color.setHex(
        hovered.type === "enemy" ? 0xdc6454 : 0xdbc38b,
      );
    } else marker.visible = false;
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    hovered = null;
    marker.visible = false;
    onHover(null);
  });
  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const data = pick(event);
    if (data) onPick(data);
  });
  renderer.domElement.addEventListener("contextmenu", (event) =>
    event.preventDefault(),
  );
  renderer.domElement.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoom = THREE.MathUtils.clamp(
        zoom + Math.sign(event.deltaY) * 0.4,
        3.6,
        12,
      );
      resize();
    },
    { passive: false },
  );
  const floating = [];
  function floatText(text, x, y, z, kind) {
    const el = document.createElement("span");
    el.className = `floating ${kind}`;
    el.textContent = text;
    container.appendChild(el);
    floating.push({ el, x, y, z, life: 1.0 });
  }
  let last = performance.now();
  function render(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    clock += dt;
    if (state) {
      const target = new THREE.Vector3(state.player.x, 0, state.player.z);
      const delta = target.clone().sub(player.position),
        remaining = delta.length(),
        step = Math.min(remaining, dt * 4.5);
      if (remaining > 0.001) {
        player.position.addScaledVector(delta, step / remaining);
        hero.face(delta.x, delta.z);
      }
      hero.animate(dt, step / dt, clock);
      focus.lerp(player.position, 1 - Math.exp(-dt * 5));
      camera.position.copy(focus).add(new THREE.Vector3(7, 11, 10));
      camera.lookAt(focus.x, 0, focus.z);
      state.enemies.forEach((e) => {
        const m = enemyMeshes.get(e.id);
        const dest = new THREE.Vector3(e.x, 0, e.z),
          d = dest.clone().sub(m.position),
          length = d.length(),
          stride = Math.min(length, dt * 4.5);
        if (length > 0.001) m.position.addScaledVector(d, stride / length);
        const rig = enemyRigs.get(e.id);
        if (rig) {
          rig.face(
            length > 0.03 ? d.x : state.player.x - e.x,
            length > 0.03 ? d.z : state.player.z - e.z,
          );
          rig.animate(dt, stride / dt, clock);
        } else {
          m.rotation.y =
            Math.atan2(state.player.x - e.x, state.player.z - e.z) + Math.PI;
          m.position.y =
            Math.sin(clock * 22) * 0.015 * Math.min(1, stride / dt);
        }
      });
      torchLights.forEach(({ light, flame }, i) => {
        light.intensity = 6.8 + Math.sin(clock * 6 + i) * 0.65;
        flame.scale.y = 1.5 + Math.sin(clock * 8 + i) * 0.15;
      });
      const relic = pickupMeshes.get("relic");
      if (relic) {
        relic.children[1].rotation.y = clock * 0.7;
        relic.children[1].position.y = 0.65 + Math.sin(clock * 2) * 0.08;
      }
      for (let i = floating.length - 1; i >= 0; i--) {
        const f = floating[i];
        f.life -= dt;
        if (f.life <= 0) {
          f.el.remove();
          floating.splice(i, 1);
          continue;
        }
        const v = new THREE.Vector3(f.x, f.y + (1 - f.life) * 0.8, f.z).project(
          camera,
        );
        f.el.style.left = `${(v.x * 0.5 + 0.5) * container.clientWidth}px`;
        f.el.style.top = `${(-v.y * 0.5 + 0.5) * container.clientHeight}px`;
        f.el.style.opacity = Math.min(1, f.life * 3);
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
  return {
    update,
    reset(p) {
      player.position.set(p.x, 0, p.z);
      focus.copy(player.position);
    },
    face(dx, dz) {
      hero.face(dx, dz);
    },
    route(path) {
      for (const child of pathGroup.children) child.geometry.dispose();
      pathGroup.clear();
      for (const p of path) {
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(0.045, 8),
          marker.material,
        );
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(p.x, 0.03, p.z);
        pathGroup.add(dot);
      }
      const end = path.at(-1);
      destination.visible = !!end;
      if (end) destination.position.set(end.x, 0.035, end.z);
    },
    zoom(delta) {
      zoom = THREE.MathUtils.clamp(zoom + delta, 4.8, 15);
      resize();
    },
  };
}
