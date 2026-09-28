import { WORLD, FLOOR_KEYS, tileKey } from "./world.js";

// Action-driven dungeon combat. Movement and attacks have no resource cost.
function rng(seed) {
  let n = (Number(seed) || 1) >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 0x100000000;
  };
}
const roomAt = (x, z) =>
  WORLD.rooms.find(
    (r) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.h,
  )?.id ?? null;
const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z) <= 1;
const say = (s, message) => {
  s.log.push(message);
  if (s.log.length > 12) s.log.shift();
};

export function walkable(state, x, z) {
  if (!FLOOR_KEYS.has(tileKey(x, z))) return false;
  const secret = WORLD.secret;
  if (x === secret.x && z === secret.z && !state.secretOpen) return false;
  return true;
}

export function createGame(seed = 1) {
  const rand = rng(seed);
  return {
    seed,
    rand,
    player: {
      x: 2,
      z: 2,
      hp: 20,
      maxHp: 20,
      potions: 3,
      gold: 0,
      relic: false,
    },
    enemies: WORLD.initialEnemies.map((e) => ({
      ...e,
      maxHp: e.hp,
      alive: true,
    })),
    pickups: WORLD.initialPickups.map((p) => ({ ...p, collected: false })),
    traps: WORLD.initialTraps.map((t) => ({ ...t })),
    secretOpen: false,
    discovered: ["vestibule"],
    roomId: "vestibule",
    log: [
      "You enter the Embervault. Find the relic and return to the threshold.",
    ],
    status: "playing",
    turn: 0,
  };
}

function updateRoom(s) {
  const id =
    roomAt(s.player.x, s.player.z) ||
    (WORLD.corridors.some((t) => t.x === s.player.x && t.z === s.player.z)
      ? "corridor"
      : s.roomId);
  s.roomId = id;
  if (id !== "corridor" && !s.discovered.includes(id)) {
    s.discovered.push(id);
    say(s, `Discovered: ${WORLD.rooms.find((r) => r.id === id)?.name || id}.`);
  }
}
function collect(s) {
  for (const p of s.pickups)
    if (
      !p.collected &&
      ((p.x === s.player.x && p.z === s.player.z) || adjacent(s.player, p))
    ) {
      p.collected = true;
      if (p.kind === "gold") {
        s.player.gold += p.amount;
        say(s, `Collected ${p.amount} silver.`);
      }
      if (p.kind === "potion") {
        s.player.potions += p.amount;
        say(s, "Found a healing salve.");
      }
      if (p.kind === "relic") {
        s.player.relic = true;
        say(s, "The Emberheart is yours. Return to the entrance.");
      }
    }
}
function enemyTurn(s) {
  for (const e of s.enemies) {
    if (!e.alive || s.status !== "playing") continue;
    const distance = Math.abs(e.x - s.player.x) + Math.abs(e.z - s.player.z);
    if (distance <= 1) {
      const damage =
        e.kind === "skeleton"
          ? 3 + Math.floor(s.rand() * 3)
          : 1 + Math.floor(s.rand() * 3);
      s.player.hp = Math.max(0, s.player.hp - damage);
      say(
        s,
        `${e.kind === "skeleton" ? "Skeleton" : "Rat"} hits you for ${damage}.`,
      );
      if (s.player.hp <= 0) {
        s.status = "dead";
        say(s, "You have fallen in the dungeon.");
        break;
      }
    } else if (distance <= 6) {
      const candidates = [
        [Math.sign(s.player.x - e.x), 0],
        [0, Math.sign(s.player.z - e.z)],
      ].filter(
        ([dx, dz]) =>
          (dx || dz) &&
          walkable(s, e.x + dx, e.z + dz) &&
          !s.enemies.some(
            (other) =>
              other.alive &&
              other !== e &&
              other.x === e.x + dx &&
              other.z === e.z + dz,
          ),
      );
      if (candidates.length) {
        const [dx, dz] = candidates[Math.floor(s.rand() * candidates.length)];
        e.x += dx;
        e.z += dz;
      }
    }
  }
}
function finishTurn(s, enemiesAct = true) {
  if (s.status !== "playing") return;
  s.turn++;
  if (enemiesAct) enemyTurn(s);
}

export function act(state, action) {
  if (state.status !== "playing" || !action || typeof action.type !== "string")
    return state;
  const s = {
    ...state,
    player: { ...state.player },
    enemies: state.enemies.map((e) => ({ ...e })),
    pickups: state.pickups.map((p) => ({ ...p })),
    traps: state.traps.map((t) => ({ ...t })),
    discovered: [...state.discovered],
    log: [...state.log],
  };
  switch (action.type) {
    case "move": {
      const dx = Math.sign(action.dx || 0),
        dz = Math.sign(action.dz || 0);
      if (Math.abs(dx) + Math.abs(dz) !== 1) {
        say(s, "Choose one cardinal direction.");
        return s;
      }
      const nx = s.player.x + dx,
        nz = s.player.z + dz;
      if (
        !walkable(s, nx, nz) ||
        s.enemies.some((e) => e.alive && e.x === nx && e.z === nz)
      ) {
        say(s, "The way is blocked.");
        return s;
      }
      s.player.x = nx;
      s.player.z = nz;
      updateRoom(s);
      collect(s);
      const trap = s.traps.find((t) => t.x === nx && t.z === nz && !t.spent);
      if (trap && !trap.revealed) {
        const damage = 2 + Math.floor(s.rand() * 4);
        trap.spent = true;
        s.player.hp = Math.max(0, s.player.hp - damage);
        say(s, `A hidden trap snaps for ${damage} damage.`);
        if (!s.player.hp) {
          s.status = "dead";
          say(s, "You have fallen in the dungeon.");
        }
      }
      finishTurn(s);
      break;
    }
    case "attack": {
      const target = s.enemies
        .filter(
          (e) =>
            e.alive &&
            adjacent(e, s.player) &&
            (!action.targetId || e.id === action.targetId),
        )
        .sort(
          (a, b) =>
            Math.abs(a.x - s.player.x) +
            Math.abs(a.z - s.player.z) -
            (Math.abs(b.x - s.player.x) + Math.abs(b.z - s.player.z)),
        )[0];
      if (!target) {
        say(s, "There is no adjacent enemy to attack.");
        return s;
      }
      const damage = 2 + Math.floor(s.rand() * 4);
      target.hp -= damage;
      say(s, `You strike the ${target.kind} for ${damage}.`);
      if (target.hp <= 0) {
        target.alive = false;
        say(s, `The ${target.kind} is defeated.`);
      }
      finishTurn(s);
      break;
    }
    case "potion":
      if (s.player.potions <= 0) {
        say(s, "You have no potions.");
        return s;
      }
      if (s.player.hp === s.player.maxHp) {
        say(s, "You are already at full health.");
        return s;
      }
      s.player.potions--;
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 8);
      say(s, "The salve restores your vitality.");
      finishTurn(s);
      break;
    case "search": {
      let found = false;
      const secret = WORLD.secret;
      if (
        !s.secretOpen &&
        Math.abs(s.player.x - secret.x) + Math.abs(s.player.z - secret.z) <= 2
      ) {
        s.secretOpen = true;
        found = true;
        say(s, "Your search reveals a concealed doorway into the chapel.");
      }
      for (const t of s.traps)
        if (
          !t.revealed &&
          !t.spent &&
          Math.abs(s.player.x - t.x) + Math.abs(s.player.z - t.z) <= 2
        ) {
          t.revealed = true;
          t.spent = true;
          found = true;
          say(s, "You spot and disarm a floor trap nearby.");
        }
      if (!found) say(s, "You find nothing unusual.");
      finishTurn(s);
      break;
    }
    case "interact": {
      collect(s);
      if (s.player.x === WORLD.exit.x && s.player.z === WORLD.exit.z) {
        if (s.player.relic) {
          s.status = "won";
          say(s, "You escape with the relic. Victory!");
        } else say(s, "The entrance is here, but the relic is still missing.");
      } else if (
        !s.secretOpen &&
        Math.abs(s.player.x - WORLD.secret.x) +
          Math.abs(s.player.z - WORLD.secret.z) <=
          1
      )
        say(s, "The stonework hides a seam. Search the area.");
      else say(s, "There is nothing more to interact with here.");
      finishTurn(s);
      break;
    }
    default:
      say(s, `Unknown action: ${action.type}.`);
  }
  return s;
}

export function snapshot(state) {
  return {
    player: { ...state.player },
    enemies: state.enemies.map(({ id, x, z, hp, maxHp, kind, alive }) => ({
      id,
      x,
      z,
      hp,
      maxHp,
      kind,
      alive,
    })),
    pickups: state.pickups.map(({ id, x, z, kind, collected }) => ({
      id,
      x,
      z,
      kind,
      collected,
    })),
    traps: state.traps.map((t) => ({ ...t })),
    secretOpen: state.secretOpen,
    discovered: [...state.discovered],
    roomId: state.roomId,
    log: [...state.log],
    status: state.status,
    turn: state.turn,
  };
}
