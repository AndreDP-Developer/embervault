import { WORLD, tileKey } from "./world.js";
import { walkable } from "./game.js";

export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
export function knownTile(state, x, z) {
  const room = WORLD.rooms.find(
    (r) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.h,
  );
  return (
    (room && state.discovered.includes(room.id)) ||
    distance(state.player, { x, z }) <= 3
  );
}
// Return a cardinal route, excluding the starting tile. Never route through an
// enemy, a closed secret, or unexplored distant rooms. Adjacent goals support loot/combat.
export function findPath(state, target, reach = 0) {
  const start = state.player,
    queue = [{ x: start.x, z: start.z, path: [] }],
    seen = new Set([tileKey(start.x, start.z)]);
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (distance(node, target) <= reach) return node.path;
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      const x = node.x + dx,
        z = node.z + dz,
        key = tileKey(x, z);
      if (
        seen.has(key) ||
        !walkable(state, x, z) ||
        !knownTile(state, x, z) ||
        state.enemies.some((e) => e.alive && e.x === x && e.z === z)
      )
        continue;
      seen.add(key);
      queue.push({ x, z, path: [...node.path, { x, z }] });
    }
  }
  return null;
}
