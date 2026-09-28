import "./style.css";
import { createGame, act, snapshot } from "./game.js";
import { WORLD } from "./world.js";
import { createScene } from "./scene.js";
import { findPath, distance, knownTile } from "./navigation.js";
const $ = (id) => document.getElementById(id);
let state = createGame(42),
  started = false,
  paused = false,
  scene,
  intent = null,
  held = null,
  hover = null,
  nextAction = 0;
const ready = () =>
  started &&
  !paused &&
  !$("help-dialog").open &&
  $("journal").classList.contains("hidden") &&
  state.status === "playing";
const notify = (message) => ($("notification").textContent = message);
function cancel() {
  intent = null;
  held = null;
  scene?.route([]);
}
function drawMap() {
  const c = $("map"),
    ctx = c.getContext("2d"),
    scale = 6.6,
    ox = 39,
    oy = 12;
  ctx.clearRect(0, 0, c.width, c.height);
  for (const t of WORLD.floor) {
    if (!knownTile(state, t.x, t.z)) continue;
    ctx.fillStyle = "#536458";
    ctx.fillRect(ox + t.x * scale, oy + t.z * scale, scale - 0.7, scale - 0.7);
  }
  ctx.strokeStyle = "#c5ab73";
  ctx.strokeRect(
    ox + WORLD.exit.x * scale + 1,
    oy + WORLD.exit.z * scale + 1,
    4,
    4,
  );
  for (const e of state.enemies)
    if (e.alive && knownTile(state, e.x, e.z)) {
      ctx.fillStyle = "#b55547";
      ctx.fillRect(ox + e.x * scale + 1, oy + e.z * scale + 1, 4, 4);
    }
  ctx.fillStyle = "#f4dfb4";
  ctx.beginPath();
  ctx.arc(
    ox + state.player.x * scale + 3,
    oy + state.player.z * scale + 3,
    3,
    0,
    7,
  );
  ctx.fill();
}
function showHover(data) {
  hover = data;
  const target =
    data?.type === "enemy"
      ? state.enemies.find((e) => e.id === data.id)
      : intent?.type === "enemy"
        ? state.enemies.find((e) => e.id === intent.id)
        : null;
  $("enemy-target").classList.toggle("hidden", !target?.alive);
  if (target?.alive) {
    $("enemy-name").textContent =
      target.kind === "rat" ? "VAULT RAT" : "SKELETON GUARDIAN";
    $("enemy-hp").style.width =
      (Math.max(0, target.hp) / target.maxHp) * 100 + "%";
  }
  $("hover-label").textContent = data
    ? data.type === "enemy"
      ? "Click to approach & attack"
      : data.label
    : "";
}
function update() {
  scene?.update(state);
  const p = state.player,
    room = WORLD.rooms.find((r) => r.id === state.roomId);
  $("room-title").textContent = room?.name || "The passages";
  $("room-desc").textContent =
    room?.description || "Worn stone leads deeper into the dark.";
  $("hp-text").textContent = p.hp + " / " + p.maxHp;
  $("hp-fill").style.height = (p.hp / p.maxHp) * 100 + "%";
  $("relic-orb").textContent = p.relic ? "◆" : "◇";
  $("relic-orb").parentElement.classList.toggle("found", p.relic);
  $("gold").textContent = p.gold;
  $("potions").textContent = p.potions;
  $("relic").textContent = p.relic ? "Emberheart found" : "Find the Emberheart";
  $("explored").textContent =
    state.discovered.length + " / " + WORLD.rooms.length;
  $("objective").textContent = p.relic
    ? "Return to the golden entrance circle."
    : "Recover the Emberheart. Return alive.";
  $("turn").textContent = "EXPEDITION · " + state.turn + " ACTIONS";
  $("log").replaceChildren(
    ...state.log
      .slice()
      .reverse()
      .map((message) => {
        const li = document.createElement("li");
        li.textContent = message;
        return li;
      }),
  );
  $("scene-hint").textContent =
    p.hp < 8 ? "Low vitality · 1 to heal" : "Click to move · Click to fight";
  document
    .querySelectorAll("[data-action]")
    .forEach(
      (b) => (b.disabled = !started || paused || state.status !== "playing"),
    );
  showHover(hover);
  drawMap();
  if (state.status !== "playing") showEnd();
}
function perform(action, automatic = false) {
  if (!ready()) return false;
  if (!automatic) cancel();
  const before = state;
  if (action.type === "move") scene?.face(action.dx, action.dz);
  state = act(state, action);
  nextAction = performance.now() + (action.type === "move" ? 225 : 520);
  update();
  if (state.log.at(-1) !== before.log.at(-1)) notify(state.log.at(-1));
  if (state.turn === before.turn) {
    if (automatic) cancel();
    return false;
  }
  if (state.status !== "playing") {
    cancel();
    return true;
  }
  if (action.type === "move" && state.player.hp < before.player.hp) {
    cancel();
    notify("You were hurt. Movement stopped — choose your next action.");
  }
  return true;
}
function choose(data) {
  if (!ready()) return;
  cancel();
  intent = { ...data };
  nextAction = 0;
  const dest =
      data.type === "enemy"
        ? state.enemies.find((e) => e.id === data.id)
        : data,
    reach =
      data.type === "enemy" || data.type === "pickup"
        ? 1
        : data.type === "secret"
          ? 2
          : 0;
  const path = findPath(state, dest, reach);
  if (!path) {
    cancel();
    notify("No clear route. Explore closer or choose another path.");
    return;
  }
  scene?.route(path);
  notify(
    data.type === "enemy"
      ? "Approaching target. Click elsewhere to cancel."
      : data.type === "floor"
        ? "Walking to your destination…"
        : "Approaching " + data.label.toLowerCase() + ".",
  );
  showHover(hover);
}
function navigate() {
  if (!intent) return;
  const target =
    intent.type === "enemy"
      ? state.enemies.find((e) => e.id === intent.id)
      : intent;
  if (!target || (intent.type === "enemy" && !target.alive)) {
    cancel();
    notify("Enemy defeated.");
    return;
  }
  const reach =
    intent.type === "enemy" || intent.type === "pickup"
      ? 1
      : intent.type === "secret"
        ? 2
        : 0;
  if (distance(state.player, target) <= reach) {
    const kind = intent.type,
      id = intent.id;
    if (kind === "enemy") {
      perform({ type: "attack", targetId: id }, true);
      if (!state.enemies.find((e) => e.id === id)?.alive) cancel();
    } else {
      cancel();
      if (kind === "secret") perform({ type: "search" });
      else if (kind === "pickup" || kind === "exit")
        perform({ type: "interact" });
      else notify("Click to move · Click an enemy to attack");
    }
    return;
  }
  if (
    intent.type !== "enemy" &&
    state.enemies.some((e) => e.alive && distance(e, state.player) <= 2)
  ) {
    cancel();
    notify("An enemy is close. Click it to fight, or use WASD to retreat.");
    return;
  }
  const path = findPath(state, target, reach);
  if (!path?.length) {
    cancel();
    notify("The route is blocked.");
    return;
  }
  scene?.route(path);
  perform(
    {
      type: "move",
      dx: path[0].x - state.player.x,
      dz: path[0].z - state.player.z,
    },
    true,
  );
}
function tick(now) {
  if (ready() && now >= nextAction) {
    if (held) {
      const [dx, dz] = held;
      perform({ type: "move", dx, dz }, true);
    } else navigate();
  }
  requestAnimationFrame(tick);
}
function showEnd() {
  cancel();
  const won = state.status === "won";
  $("overlay").classList.remove("hidden");
  $("overlay").innerHTML =
    '<div class="welcome"><span class="eyebrow">' +
    (won ? "THE VAULT RELEASES YOU" : "THE VAULT REMEMBERS") +
    "</span><h2>" +
    (won ? "Back into<br>the daylight." : "Your lantern<br>goes dark.") +
    "</h2><p>" +
    (won
      ? "The Emberheart is yours. You found a way through — and a way back."
      : "Choose your fights, search suspicious stonework, and keep your salves close.") +
    '</p><div class="intro-controls"><span><b>' +
    state.turn +
    "</b>Actions taken</span><span><b>" +
    state.discovered.length +
    "</b>Rooms explored</span><span><b>" +
    state.player.gold +
    '</b>Silver recovered</span></div><button id="again" class="primary">Begin a new expedition ↗</button></div>';
  $("again").onclick = () => restart(false);
}
function restart(confirmFirst = true) {
  if (
    confirmFirst &&
    started &&
    state.status === "playing" &&
    !confirm("Start over? Your current expedition will be lost.")
  )
    return;
  cancel();
  state = createGame(42);
  started = true;
  paused = false;
  nextAction = 0;
  $("overlay").classList.add("hidden");
  $("paused").classList.add("hidden");
  $("journal").classList.add("hidden");
  scene?.reset(state.player);
  update();
  notify("Click the floor to walk. Click an enemy to fight.");
}
function pause() {
  if (!started || state.status !== "playing") return;
  paused = !paused;
  cancel();
  $("paused").classList.toggle("hidden", !paused);
  update();
}
function journal() {
  cancel();
  $("journal").classList.toggle("hidden");
}
$("begin").onclick = () => {
  started = true;
  $("overlay").classList.add("hidden");
  update();
};
$("restart").onclick = () => restart();
$("pause").onclick = $("resume").onclick = pause;
$("zoom-in").onclick = () => scene?.zoom(-0.7);
$("zoom-out").onclick = () => scene?.zoom(0.7);
$("help").onclick = () => {
  cancel();
  $("help-dialog").showModal();
};
$("close-help").onclick = $("help-done").onclick = () =>
  $("help-dialog").close();
$("journal-toggle").onclick = journal;
$("close-journal").onclick = journal;
document
  .querySelectorAll("[data-action]")
  .forEach((b) => (b.onclick = () => perform({ type: b.dataset.action })));
const movement = {
    w: [0, -1],
    ArrowUp: [0, -1],
    s: [0, 1],
    ArrowDown: [0, 1],
    a: [-1, 0],
    ArrowLeft: [-1, 0],
    d: [1, 0],
    ArrowRight: [1, 0],
  },
  actions = {
    f: "attack",
    e: "search",
    h: "potion",
    1: "potion",
    " ": "interact",
  };
window.addEventListener("keydown", (e) => {
  if ($("help-dialog").open) return;
  if (e.target.closest?.("button") && (e.key === " " || e.key === "Enter"))
    return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === "Escape") {
    e.preventDefault();
    if (!$("journal").classList.contains("hidden")) journal();
    else pause();
    return;
  }
  if (k === "j") {
    if (!e.repeat) journal();
    return;
  }
  if (k === "Enter" && !started) {
    $("begin")?.click();
    return;
  }
  if (movement[k] || actions[k]) {
    e.preventDefault();
    if (!ready() || e.repeat) return;
    if (movement[k]) {
      cancel();
      held = movement[k];
      if (performance.now() >= nextAction) {
        const [dx, dz] = held;
        perform({ type: "move", dx, dz }, true);
      }
    } else perform({ type: actions[k] });
  }
});
window.addEventListener("keyup", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (movement[k]) held = null;
});
window.addEventListener("blur", () => {
  if (started && !paused && state.status === "playing") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started && !paused && state.status === "playing")
    pause();
});
try {
  scene = createScene($("scene"), choose, showHover);
} catch (error) {
  $("scene").innerHTML =
    '<p class="error">This expedition needs WebGL. Enable hardware acceleration and reload.</p>';
  console.error(error);
}
window.embervault = { snapshot: () => snapshot(state) };
update();
requestAnimationFrame(tick);
