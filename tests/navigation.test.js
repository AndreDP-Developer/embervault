import test from "node:test";
import assert from "node:assert/strict";
import { createGame, act } from "../src/game.js";
import { findPath, distance } from "../src/navigation.js";
import { WORLD } from "../src/world.js";

test("click route stays cardinal, avoids enemies, and cannot enter distant unexplored rooms", () => {
  const s = createGame(42),
    path = findPath(s, { x: 4, z: 4 });
  assert.ok(path?.length);
  let previous = s.player;
  for (const step of path) {
    assert.equal(distance(previous, step), 1);
    previous = step;
  }
  assert.equal(findPath(s, { x: 18, z: 18 }), null);
  s.enemies = [{ id: "blocker", x: 3, z: 2, alive: true }];
  const around = findPath(s, { x: 4, z: 2 });
  assert.ok(around.length > 2);
  assert.ok(!around.some((p) => p.x === 3 && p.z === 2));
});
test("closed secret blocks route and can be approached for contextual search", () => {
  const s = createGame(42);
  s.discovered = WORLD.rooms.map((r) => r.id);
  s.player.x = 12;
  s.player.z = 9;
  s.enemies = [];
  assert.equal(findPath(s, { x: 8, z: 9 }), null);
  assert.deepEqual(findPath(s, WORLD.secret, 2), []);
  const opened = act(s, { type: "search" });
  assert.ok(findPath(opened, { x: 8, z: 9 })?.length);
});
test("clicking a specific enemy attacks that target, not another adjacent enemy", () => {
  const s = createGame(42);
  s.enemies = [
    { id: "first", x: 1, z: 2, hp: 10, maxHp: 10, kind: "rat", alive: true },
    { id: "chosen", x: 3, z: 2, hp: 10, maxHp: 10, kind: "rat", alive: true },
  ];
  const next = act(s, { type: "attack", targetId: "chosen" });
  assert.equal(next.enemies[0].hp, 10);
  assert.ok(next.enemies[1].hp < 10);
  const invalid = act(s, { type: "attack", targetId: "missing" });
  assert.equal(invalid.turn, 0);
  assert.equal(invalid.enemies[0].hp, 10);
});
