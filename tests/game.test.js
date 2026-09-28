import test from "node:test";
import assert from "node:assert/strict";
import { act, createGame, walkable } from "../src/game.js";
import { WORLD, FLOOR_KEYS as FLOOR } from "../src/world.js";

test("authored rooms and corridors form a connected walkable map", () => {
  assert.ok(WORLD.rooms.length >= 7 && WORLD.rooms.length <= 9);
  const game = createGame();
  const reached = new Set(["2,2"]),
    queue = [{ x: 2, z: 2 }];
  while (queue.length) {
    const { x, z } = queue.shift();
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        key = `${nx},${nz}`;
      if (!reached.has(key) && FLOOR.has(key)) {
        reached.add(key);
        queue.push({ x: nx, z: nz });
      }
    }
  }
  for (const r of WORLD.rooms)
    assert.ok(
      reached.has(`${r.x + Math.floor(r.w / 2)},${r.z + Math.floor(r.h / 2)}`),
      `${r.id} reachable`,
    );
  assert.equal(walkable(game, WORLD.secret.x, WORLD.secret.z), false);
});

test("actions are deterministic for the same seed and invalid actions do not consume a turn", () => {
  const a = createGame(42),
    b = createGame(42);
  assert.deepEqual(
    act(a, { type: "move", dx: 1, dz: 1 }).player,
    act(b, { type: "move", dx: 1, dz: 1 }).player,
  );
  assert.equal(act(a, { type: "move", dx: 1, dz: 1 }).turn, 0);
  assert.equal(act(a, { type: "move", dx: 1, dz: 0 }).turn, 1);
});

test("search reveals secret and nearby trap; revealed traps can be disarmed", () => {
  let g = createGame(2);
  // Hall side of the secret door; secret is at (11,10).
  g.player.x = 10;
  g.player.z = 9;
  g.roomId = "hall";
  g = act(g, { type: "search" });
  assert.equal(g.secretOpen, true);
  assert.equal(walkable(g, WORLD.secret.x, WORLD.secret.z), true);
  g.player.x = 16;
  g.player.z = 8;
  g = act(g, { type: "search" });
  assert.ok(g.traps.some((t) => t.revealed));
  const t = g.traps[0];
  g.player.x = t.x;
  g.player.z = t.z - 1;
  g = act(g, { type: "search" });
  assert.equal(g.traps[0].revealed, true);
  assert.equal(g.traps[0].spent, true);
});

test("attacks are unrestricted, enemies retaliate, and defeated enemies stop acting", () => {
  let g = createGame(99);
  g.player.x = 8;
  g.player.z = 2;
  g.enemies = g.enemies.filter((e) => e.id === "rat-a");
  const hp = g.player.hp;
  g = act(g, { type: "attack" });
  assert.equal("stamina" in g.player, false);
  assert.ok(g.player.hp < hp);
  g.enemies[0].hp = 1;
  g.enemies[0].x = g.player.x + 1;
  g.enemies[0].z = g.player.z;
  g = act(g, { type: "attack" });
  assert.equal(g.enemies[0].alive, false);
});

test("potions heal wounds; exit requires the Emberheart", () => {
  let g = createGame(7);
  g.player.hp = 5;
  g = act(g, { type: "potion" });
  assert.equal(g.player.potions, 2);
  assert.equal(g.player.hp, 13);
  g.player.x = 2;
  g.player.z = 2;
  g = act(g, { type: "interact" });
  assert.equal(g.status, "playing");
  g.player.relic = true;
  g = act(g, { type: "interact" });
  assert.equal(g.status, "won");
});

test("long walks remain unrestricted regardless of loot weight; death ends play", () => {
  let g = createGame(3);
  g.player.gold = 10000;
  g.enemies = [];
  for (let i = 0; i < 200; i++)
    g = act(g, { type: "move", dx: i % 2 ? -1 : 1, dz: 0 });
  assert.equal(g.turn, 200);
  assert.equal(g.player.x, 2);
  assert.equal("stamina" in g.player, false);
  g.player.hp = 1;
  g.enemies = [
    {
      id: "danger",
      x: 3,
      z: 2,
      hp: 100,
      maxHp: 100,
      alive: true,
      kind: "skeleton",
    },
  ];
  g = act(g, { type: "attack" });
  assert.equal(g.status, "dead");
  assert.equal(act(g, { type: "move", dx: 0, dz: 1 }).turn, g.turn);
});

test("a prepared explorer can reach the relic and escape through the threshold", () => {
  let g = createGame(11);
  // Clear combat to exercise the route and victory condition deterministically.
  g.enemies = [];
  const go = (dx, dz) => {
    g = act(g, { type: "move", dx, dz });
  };
  const walk = (dx, dz, count) => {
    for (let i = 0; i < count; i++) go(dx, dz);
  };
  // Opening the secret reveals the path from the hall into the shrine.
  g.player.x = 13;
  g.player.z = 9;
  g = act(g, { type: "search" });
  // Route over corridor tiles, enter shrine, descend to crypt and cross east.
  const moveTo = (x, z) => {
    while (g.player.x !== x || g.player.z !== z) {
      if (g.player.x !== x) go(Math.sign(x - g.player.x), 0);
      else go(0, Math.sign(z - g.player.z));
    }
  };
  moveTo(11, 9);
  moveTo(10, 9);
  moveTo(7, 12);
  moveTo(7, 15);
  moveTo(10, 17);
  moveTo(14, 17);
  moveTo(18, 18);
  assert.equal(g.player.relic, true);
  // Directly return along the corridor chain and the open doorway.
  moveTo(14, 17);
  moveTo(10, 17);
  moveTo(7, 15);
  moveTo(7, 12);
  moveTo(7, 9);
  moveTo(10, 9);
  moveTo(11, 9);
  moveTo(14, 9);
  moveTo(16, 7);
  moveTo(16, 4);
  moveTo(14, 2);
  moveTo(11, 2);
  moveTo(7, 2);
  moveTo(4, 2);
  moveTo(2, 2);
  g = act(g, { type: "interact" });
  assert.equal(g.status, "won");
});

test("seed 42 supports a complete expedition against the normal enemy set", () => {
  let g = createGame(42);
  const pathTo = (target) => {
    const start = `${g.player.x},${g.player.z}`;
    const queue = [[g.player.x, g.player.z]],
      previous = new Map([[start, null]]);
    for (let i = 0; i < queue.length; i++) {
      const [x, z] = queue[i],
        key = `${x},${z}`;
      if (x === target.x && z === target.z) break;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          nz = z + dz,
          next = `${nx},${nz}`;
        if (
          previous.has(next) ||
          !walkable(g, nx, nz) ||
          g.enemies.some((e) => e.alive && e.x === nx && e.z === nz)
        )
          continue;
        previous.set(next, key);
        queue.push([nx, nz]);
      }
    }
    const end = `${target.x},${target.z}`;
    if (!previous.has(end)) return null;
    const route = [];
    for (let key = end; key; key = previous.get(key)) route.push(key);
    return route.reverse();
  };
  const step = (action) => {
    g = act(g, action);
    assert.notEqual(g.status, "dead", `died on turn ${g.turn}`);
  };
  for (let safety = 0; safety < 600 && g.status === "playing"; safety++) {
    if (
      !g.secretOpen &&
      Math.abs(g.player.x - WORLD.secret.x) +
        Math.abs(g.player.z - WORLD.secret.z) <=
        2
    ) {
      step({ type: "search" });
      continue;
    }
    if (g.player.hp <= 9 && g.player.potions > 0) {
      step({ type: "potion" });
      continue;
    }
    if (
      g.enemies.some(
        (e) =>
          e.alive &&
          Math.abs(e.x - g.player.x) + Math.abs(e.z - g.player.z) <= 1,
      )
    ) {
      step({ type: "attack" });
      continue;
    }
    const target = !g.secretOpen
      ? { x: 12, z: 9 }
      : g.player.relic
        ? WORLD.exit
        : { x: 18, z: 18 };
    const route = pathTo(target);
    if (!route) {
      step({ type: "search" });
      continue;
    }
    if (route.length === 1) {
      step({ type: "interact" });
      continue;
    }
    const [x, z] = route[1].split(",").map(Number);
    step({ type: "move", dx: x - g.player.x, dz: z - g.player.z });
  }
  assert.equal(g.status, "won");
  assert.equal(g.player.relic, true);
  assert.deepEqual([g.player.x, g.player.z], [WORLD.exit.x, WORLD.exit.z]);
  assert.equal(
    g.enemies.some((e) => e.alive),
    false,
  );
  assert.ok(g.turn < 600);
});
