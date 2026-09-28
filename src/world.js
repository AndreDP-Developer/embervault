// Hand-authored, connected dungeon on an integer x/z grid. Corridors are explicit floor tiles.
const rooms = [
  { id: 'vestibule', name: 'The Threshold', description: 'Dusty steps descend into the Embervault.', x: 0, z: 0, w: 5, h: 5 },
  { id: 'kitchen', name: 'Offering Hall', description: 'Blackened braziers stand beside a long stone altar.', x: 7, z: 0, w: 5, h: 5 },
  { id: 'cellar', name: 'Votive Store', description: 'Broken jars and votive bowls litter the damp floor.', x: 14, z: 0, w: 5, h: 5 },
  { id: 'hall', name: 'Hall of Pillars', description: 'Faded murals watch over a broad processional hall.', x: 14, z: 7, w: 7, h: 5 },
  { id: 'chapel', name: 'Ashen Shrine', description: 'A cracked altar stands beneath a collapsed dome.', x: 5, z: 7, w: 6, h: 5 },
  { id: 'armory', name: 'Guard Shrine', description: 'Rusty weapon racks line this narrow chamber.', x: 0, z: 7, w: 3, h: 3 },
  { id: 'crypt', name: 'The Lower Crypt', description: 'The air grows still among the old stone beds.', x: 5, z: 15, w: 6, h: 5 },
  { id: 'sanctum', name: 'The Emberheart Chamber', description: 'A captive ember burns within the vault’s ancient seal.', x: 14, z: 15, w: 7, h: 6 },
];

const tileKey = (x, z) => `${x},${z}`;
const floor = new Map();
for (const room of rooms) {
  for (let z = room.z; z < room.z + room.h; z++) for (let x = room.x; x < room.x + room.w; x++) {
    floor.set(tileKey(x, z), room.id);
  }
}
// Corridors join threshold↔kitchen↔cellar↔hall↔chapel↔crypt↔sanctum; chapel also links to armory.
const corridors = [];
function corridor(x1, z1, x2, z2) {
  let x = x1, z = z1;
  while (x !== x2) { floor.set(tileKey(x, z), null); corridors.push({ x, z }); x += Math.sign(x2 - x); }
  while (z !== z2) { floor.set(tileKey(x, z), null); corridors.push({ x, z }); z += Math.sign(z2 - z); }
  floor.set(tileKey(x, z), null); corridors.push({ x, z });
}
corridor(4, 2, 7, 2);
corridor(11, 2, 14, 2);
corridor(16, 4, 16, 7);
corridor(14, 9, 11, 9);
corridor(11, 9, 11, 10);
corridor(7, 12, 7, 15);
corridor(10, 17, 14, 17);
corridor(5, 8, 2, 8);

export const WORLD = Object.freeze({
  rooms, corridors,
  floor: [...floor].map(([key, roomId]) => { const [x, z] = key.split(',').map(Number); return { x, z, roomId }; }),
  secret: { x: 11, z: 9, roomId: 'hall', leadsTo: 'chapel' },
  exit: { x: 2, z: 2, roomId: 'vestibule' },
  initialEnemies: [
    { id: 'rat-a', x: 9, z: 2, hp: 5, kind: 'rat' },
    { id: 'skeleton-a', x: 17, z: 2, hp: 8, kind: 'skeleton' },
    { id: 'rat-b', x: 8, z: 9, hp: 5, kind: 'rat' },
    { id: 'skeleton-b', x: 17, z: 9, hp: 8, kind: 'skeleton' },
    { id: 'rat-c', x: 8, z: 17, hp: 5, kind: 'rat' },
    { id: 'skeleton-c', x: 18, z: 19, hp: 8, kind: 'skeleton' },
  ],
  initialPickups: [
    { id: 'coins-cellar', x: 17, z: 3, kind: 'gold', amount: 8 },
    { id: 'potion-chapel', x: 8, z: 10, kind: 'potion', amount: 1 },
    { id: 'coins-crypt', x: 8, z: 18, kind: 'gold', amount: 12 },
    { id: 'relic', x: 18, z: 18, kind: 'relic', amount: 1 },
  ],
  initialTraps: [{ x: 16, z: 9, revealed: false, spent: false }],
});

export const FLOOR_KEYS = new Set(WORLD.floor.map(({ x, z }) => tileKey(x, z)));
export { tileKey };
