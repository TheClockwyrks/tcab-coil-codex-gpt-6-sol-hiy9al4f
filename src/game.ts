import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import {
  ACTIONS,
  BINDINGS,
  BEST_LABEL,
  BITE_SECONDS,
  BOARD_X,
  BOARD_Y,
  CELL,
  CLEARED_TEXT,
  COIL_DEBUG_VERSION,
  COMBO_MAX,
  COMBO_WINDOW,
  CUES,
  CUE_PATHS,
  DIRECTIONS,
  GAMEOVER_TEXT,
  GRID_COLS,
  GRID_ROWS,
  HEAD_FRAMES,
  INTERIOR_MAX_COL,
  INTERIOR_MAX_ROW,
  INTERIOR_MIN_COL,
  INTERIOR_MIN_ROW,
  MODE,
  MODE_LABEL,
  OBSTACLE_CELLS,
  OVER_ITEMS,
  PAUSE_ITEMS,
  PELLET_POINTS,
  SCORE_LABEL,
  SCREENS,
  SPRITE_PATHS,
  STAGE_CX,
  STAGE_W,
  START_CELLS,
  START_DIR,
  TAGLINE_TEXT,
  TICK_SECONDS,
  TITLE_ITEMS,
  TITLE_TEXT,
  TURN_QUEUE_MAX,
  type Cell,
  type Direction,
  type Screen,
} from "./constants";

export const BACKGROUND = "#070d1b";
type Rect = { x: number; y: number; w: number; h: number };
type Sprites = {
  head: ImageBitmap[];
  body: ImageBitmap;
  corner: ImageBitmap;
  tail: ImageBitmap;
};
type Arm = { id: number; index: number };
export interface CoilState {
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly mode: typeof MODE;
  readonly score: number;
  readonly best: number;
  readonly combo: number;
  readonly comboWindow: number;
  readonly muted: boolean;
  readonly ticks: number;
  readonly simTime: number;
  readonly dir: Direction;
  readonly turns: readonly Direction[];
  readonly snake: readonly Cell[];
  readonly pellet: Cell | null;
  readonly obstacles: readonly Cell[];
  readonly steering: boolean;
  readonly travel: boolean;
  readonly pelletRespawn: boolean;
  readonly nextPellet: Cell | null;
  readonly accumulator: number;
  readonly bite: number;
  readonly arms: readonly Arm[];
  readonly sprites: Sprites;
}
type View = DeepReadonly<CoilState>;
type Snapshot = Omit<CoilState, "accumulator" | "bite" | "arms" | "sprites"> & {
  version: number;
};
export interface CoilDebugApi {
  readonly version: number;
  reset(s: View): CoilState;
  reconcile(s: View): CoilState;
  snapshot(s: View): Snapshot;
  menuItemRect(s: View, index: number): Rect | null;
  setScreen(s: View, screen: Screen): CoilState;
  setMenuIndex(s: View, index: number): CoilState;
  setScore(s: View, points: number): CoilState;
  setBest(s: View, points: number): CoilState;
  setCombo(s: View, multiplier: number): CoilState;
  setComboWindow(s: View, seconds: number): CoilState;
  setSnake(s: View, cells: readonly Cell[]): CoilState;
  setDirection(s: View, dir: Direction): CoilState;
  clearTurns(s: View): CoilState;
  setSnakeSteering(s: View, enabled: boolean): CoilState;
  setSnakeTravel(s: View, enabled: boolean): CoilState;
  setPellet(s: View, col: number, row: number): CoilState;
  clearPellet(s: View): CoilState;
  setPelletRespawn(s: View, enabled: boolean): CoilState;
  setNextPellet(s: View, col: number, row: number): CoilState;
  drawPelletCell(s: View): Cell | null;
}
const copy = (s: View): CoilState => ({
  ...s,
  snake: [...s.snake],
  turns: [...s.turns],
  obstacles: [...s.obstacles],
  arms: [...s.arms],
  sprites: { ...s.sprites, head: [...s.sprites.head] },
});
const same = (a: Cell, b: Cell) => a.col === b.col && a.row === b.row;
const interior = (p: Cell) =>
  p.col >= INTERIOR_MIN_COL &&
  p.col <= INTERIOR_MAX_COL &&
  p.row >= INTERIOR_MIN_ROW &&
  p.row <= INTERIOR_MAX_ROW;
const grid = (p: Cell) =>
  p.col >= 0 && p.col < GRID_COLS && p.row >= 0 && p.row < GRID_ROWS;
const valid = (s: View, p: Cell) =>
  interior(p) &&
  !s.snake.some((c) => same(c, p)) &&
  !s.obstacles.some((c) => same(c, p)) &&
  (s.pellet === null || !same(s.pellet, p));
function eligible(s: View): Cell[] {
  const cells: Cell[] = [];
  for (let row = INTERIOR_MIN_ROW; row <= INTERIOR_MAX_ROW; row++)
    for (let col = INTERIOR_MIN_COL; col <= INTERIOR_MAX_COL; col++)
      if (valid(s, { col, row })) cells.push({ col, row });
  return cells;
}
function draw(s: View): Cell | null {
  const cells = eligible(s);
  return cells.length ? cells[Math.floor(Math.random() * cells.length)] : null;
}
function spawn(s: View): CoilState {
  const cells = eligible(s);
  const selected = s.nextPellet && cells.find((c) => same(c, s.nextPellet!));
  return {
    ...copy(s),
    pellet:
      selected ??
      (cells.length ? cells[Math.floor(Math.random() * cells.length)] : null),
    nextPellet: null,
    screen: cells.length ? s.screen : "cleared",
  };
}
function opening(sprites: Sprites, muted = false): CoilState {
  return {
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    mode: MODE,
    score: 0,
    best: 0,
    combo: 1,
    comboWindow: 0,
    muted,
    ticks: 0,
    simTime: 0,
    dir: START_DIR as Direction,
    turns: [],
    snake: [...START_CELLS],
    pellet: null,
    obstacles: [...OBSTACLE_CELLS],
    steering: true,
    travel: true,
    pelletRespawn: true,
    nextPellet: null,
    accumulator: 0,
    bite: 0,
    arms: [],
    sprites,
  };
}
function round(s: View): CoilState {
  const start = {
    ...copy(s),
    screen: "playing" as Screen,
    menuIndex: 0,
    score: 0,
    combo: 1,
    comboWindow: 0,
    dir: START_DIR as Direction,
    turns: [],
    snake: [...START_CELLS],
    pellet: null,
    obstacles: [...OBSTACLE_CELLS],
    accumulator: 0,
    bite: 0,
    arms: [],
  };
  return spawn(start);
}
function check(ok: boolean, message: string): void {
  if (!ok) throw new RangeError(message);
}
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
const isDir = (d: unknown): d is Direction =>
  DIRECTIONS.includes(d as Direction);
const isScreen = (v: unknown): v is Screen => SCREENS.includes(v as Screen);
function items(screen: Screen): readonly string[] {
  return screen === "title"
    ? TITLE_ITEMS
    : screen === "paused"
      ? PAUSE_ITEMS
      : screen === "gameover" || screen === "cleared"
        ? OVER_ITEMS
        : screen === "howto"
          ? ["BACK"]
          : [];
}
function itemRect(screen: Screen, index: number): Rect | null {
  if (!integer(index) || index >= items(screen).length) return null;
  const width = screen === "paused" ? 300 : 360;
  const height = 54;
  const top =
    screen === "title"
      ? 470
      : screen === "howto"
        ? 570
        : screen === "paused"
          ? 330
          : 485;
  return { x: STAGE_CX - width / 2, y: top + index * 64, w: width, h: height };
}
function hit(screen: Screen, x: number, y: number): number {
  return items(screen).findIndex((_, i) => {
    const r = itemRect(screen, i)!;
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  });
}
function accept(s: View, api: UpdateApi): CoilState {
  if (s.screen === "title") {
    const titleIndex = s.menuIndex;
    if (titleIndex === 0) {
      api.audio.loop(CUES.music);
      return { ...round(s), titleIndex };
    }
    return { ...copy(s), screen: "howto", titleIndex, menuIndex: 0, arms: [] };
  }
  if (s.screen === "howto")
    return { ...copy(s), screen: "title", menuIndex: s.titleIndex, arms: [] };
  if (s.screen === "paused") {
    if (s.menuIndex === 0)
      return { ...copy(s), screen: "playing", menuIndex: 0, arms: [] };
    if (s.menuIndex === 1) {
      api.audio.loop(CUES.music);
      return round(s);
    }
    api.audio.stop(CUES.music);
    return { ...copy(s), screen: "title", menuIndex: s.titleIndex, arms: [] };
  }
  if (s.screen === "gameover" || s.screen === "cleared") {
    if (s.menuIndex === 0) {
      api.audio.loop(CUES.music);
      return round(s);
    }
    return { ...copy(s), screen: "title", menuIndex: s.titleIndex, arms: [] };
  }
  return copy(s);
}
const delta: Record<Direction, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};
const perpendicular = (a: Direction, b: Direction) =>
  delta[a].col !== 0 ? delta[b].row !== 0 : delta[b].col !== 0;
function tick(s: View, api: UpdateApi): CoilState {
  let n = copy(s);
  n = { ...n, ticks: n.ticks + 1 };
  if (n.steering && n.turns.length) {
    const [candidate, ...rest] = n.turns;
    n = {
      ...n,
      dir: perpendicular(n.dir, candidate) ? candidate : n.dir,
      turns: rest,
    };
  }
  if (n.travel) {
    const head = {
      col: n.snake[0].col + delta[n.dir].col,
      row: n.snake[0].row + delta[n.dir].row,
    };
    const eat = n.pellet !== null && same(head, n.pellet);
    const body = n.snake.slice(0, eat ? undefined : -1);
    if (
      !interior(head) ||
      n.obstacles.some((c) => same(c, head)) ||
      body.some((c) => same(c, head))
    ) {
      api.audio.play(CUES.death);
      api.audio.stop(CUES.music);
      return { ...n, screen: "gameover", accumulator: 0 };
    }
    n = { ...n, snake: [head, ...body] };
    if (eat) {
      const raised = n.comboWindow > 0;
      const combo = raised ? Math.min(COMBO_MAX, n.combo + 1) : 1;
      const score = n.score + PELLET_POINTS * combo;
      n = {
        ...n,
        score,
        best: Math.max(n.best, score),
        combo,
        comboWindow: COMBO_WINDOW,
        bite: BITE_SECONDS,
        pellet: null,
      };
      api.audio.play(CUES.eat);
      if (raised && combo > s.combo) api.audio.play(CUES.comboUp);
      if (n.pelletRespawn) {
        n = spawn(n);
        if (n.screen === "cleared") api.audio.stop(CUES.music);
      }
    }
  }
  const comboWindow = Math.max(
    0,
    Math.round((n.comboWindow - TICK_SECONDS) * 1000) / 1000,
  );
  return { ...n, comboWindow, combo: comboWindow === 0 ? 1 : n.combo };
}
function debugSurface(): CoilDebugApi {
  return {
    version: COIL_DEBUG_VERSION,
    reset: (s) => opening({ ...s.sprites, head: [...s.sprites.head] }, s.muted),
    reconcile: (s) => copy(s),
    snapshot: (s) => ({
      version: COIL_DEBUG_VERSION,
      screen: s.screen,
      menuIndex: s.menuIndex,
      titleIndex: s.titleIndex,
      mode: s.mode,
      score: s.score,
      best: s.best,
      combo: s.combo,
      comboWindow: s.comboWindow,
      muted: s.muted,
      ticks: s.ticks,
      simTime: s.simTime,
      dir: s.dir,
      turns: [...s.turns],
      snake: s.snake.map((c) => ({ ...c })),
      pellet: s.pellet && { ...s.pellet },
      obstacles: s.obstacles.map((c) => ({ ...c })),
      steering: s.steering,
      travel: s.travel,
      pelletRespawn: s.pelletRespawn,
      nextPellet: s.nextPellet && { ...s.nextPellet },
    }),
    menuItemRect: (s, i) => {
      check(integer(i), "menu index");
      return itemRect(s.screen, i);
    },
    setScreen: (s, screen) => {
      check(isScreen(screen), "screen");
      return { ...copy(s), screen };
    },
    setMenuIndex: (s, index) => {
      check(
        integer(index) &&
          (s.screen === "playing"
            ? index === 0
            : index < items(s.screen).length),
        "menu index",
      );
      return { ...copy(s), menuIndex: index };
    },
    setScore: (s, points) => {
      check(integer(points), "score");
      return { ...copy(s), score: points };
    },
    setBest: (s, points) => {
      check(integer(points), "best");
      return { ...copy(s), best: points };
    },
    setCombo: (s, multiplier) => {
      check(
        integer(multiplier) && multiplier >= 1 && multiplier <= COMBO_MAX,
        "combo",
      );
      return { ...copy(s), combo: multiplier };
    },
    setComboWindow: (s, seconds) => {
      check(
        Number.isFinite(seconds) && seconds >= 0 && seconds <= COMBO_WINDOW,
        "combo window",
      );
      return { ...copy(s), comboWindow: seconds };
    },
    setSnake: (s, cells) => {
      check(cells.length > 0, "snake empty");
      cells.forEach((c, i) => {
        check(
          Number.isInteger(c.col) &&
            Number.isInteger(c.row) &&
            interior(c) &&
            !s.obstacles.some((o) => same(o, c)),
          "snake cell",
        );
        check(!cells.slice(0, i).some((p) => same(p, c)), "snake overlap");
        if (i)
          check(
            Math.abs(c.col - cells[i - 1].col) +
              Math.abs(c.row - cells[i - 1].row) ===
              1,
            "snake link",
          );
      });
      return { ...copy(s), snake: cells.map((c) => ({ ...c })) };
    },
    setDirection: (s, dir) => {
      check(isDir(dir), "direction");
      return { ...copy(s), dir };
    },
    clearTurns: (s) => ({ ...copy(s), turns: [] }),
    setSnakeSteering: (s, enabled) => {
      check(typeof enabled === "boolean", "steering");
      return {
        ...copy(s),
        steering: enabled,
        turns: enabled ? [...s.turns] : [],
      };
    },
    setSnakeTravel: (s, enabled) => {
      check(typeof enabled === "boolean", "travel");
      return { ...copy(s), travel: enabled };
    },
    setPellet: (s, col, row) => {
      const p = { col, row };
      check(
        Number.isInteger(col) &&
          Number.isInteger(row) &&
          interior(p) &&
          !s.snake.some((c) => same(c, p)) &&
          !s.obstacles.some((c) => same(c, p)),
        "pellet",
      );
      return { ...copy(s), pellet: p };
    },
    clearPellet: (s) => ({ ...copy(s), pellet: null }),
    setPelletRespawn: (s, enabled) => {
      check(typeof enabled === "boolean", "respawn");
      return { ...copy(s), pelletRespawn: enabled };
    },
    setNextPellet: (s, col, row) => {
      const p = { col, row };
      check(
        Number.isInteger(col) && Number.isInteger(row) && grid(p),
        "next pellet",
      );
      return { ...copy(s), nextPellet: p };
    },
    drawPelletCell: (s) => draw(s),
  };
}
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = "#e7fbff",
  align: CanvasTextAlign = "left",
  weight = "700",
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "rgba(7,13,27,.92)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#2fe4dc";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#2fe4dc";
  ctx.fillRect(x, y, 48, 3);
  ctx.fillRect(x + w - 48, y + h - 3, 48, 3);
}
function sprite(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  c: Cell,
  turns: number,
) {
  const x = BOARD_X + c.col * CELL,
    y = BOARD_Y + c.row * CELL;
  ctx.save();
  ctx.translate(x + CELL / 2, y + CELL / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(img, -CELL / 2, -CELL / 2);
  ctx.restore();
}
const angle = (d: Direction) => ({ right: 0, down: 1, left: 2, up: 3 })[d];
function direction(a: Cell, b: Cell): Direction {
  return b.col > a.col
    ? "right"
    : b.col < a.col
      ? "left"
      : b.row > a.row
        ? "down"
        : "up";
}
function snake(ctx: CanvasRenderingContext2D, s: View) {
  ctx.imageSmoothingEnabled = false;
  for (let i = s.snake.length - 1; i >= 0; i--) {
    const c = s.snake[i];
    let img: ImageBitmap, turn: number;
    if (i === 0) {
      const progress = (BITE_SECONDS - s.bite) / BITE_SECONDS;
      const frame =
        s.bite > 0
          ? Math.min(
              HEAD_FRAMES - 1,
              1 + Math.floor(progress * (HEAD_FRAMES - 1)),
            )
          : 0;
      img = s.sprites.head[frame];
      turn = angle(s.dir);
    } else if (i === s.snake.length - 1) {
      img = s.sprites.tail;
      turn = angle(direction(c, s.snake[i - 1]));
    } else {
      const a = direction(c, s.snake[i - 1]),
        b = direction(c, s.snake[i + 1]);
      if ((a === "left" && b === "right") || (a === "right" && b === "left")) {
        img = s.sprites.body;
        turn = 0;
      } else if ((a === "up" && b === "down") || (a === "down" && b === "up")) {
        img = s.sprites.body;
        turn = 1;
      } else {
        img = s.sprites.corner;
        const pair = [a, b].sort().join(",");
        turn =
          pair === "down,right"
            ? 0
            : pair === "down,left"
              ? 1
              : pair === "left,up"
                ? 2
                : 3;
      }
    }
    sprite(ctx, img, c, turn);
  }
}
function board(ctx: CanvasRenderingContext2D, s: View) {
  ctx.fillStyle = "#0c182a";
  ctx.fillRect(BOARD_X, BOARD_Y, GRID_COLS * CELL, GRID_ROWS * CELL);
  for (let row = 0; row < GRID_ROWS; row++)
    for (let col = 0; col < GRID_COLS; col++) {
      const x = BOARD_X + col * CELL,
        y = BOARD_Y + row * CELL;
      if (
        row === 0 ||
        row === GRID_ROWS - 1 ||
        col === 0 ||
        col === GRID_COLS - 1
      ) {
        ctx.fillStyle = (row + col) % 2 ? "#14344b" : "#194058";
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = "#246a79";
        ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        ctx.fillStyle = "#2a8794";
        ctx.fillRect(x + 5, y + 5, 3, 3);
      } else {
        ctx.strokeStyle = "rgba(59,145,165,.16)";
        ctx.strokeRect(x + 0.5, y + 0.5, CELL, CELL);
      }
    }
  ctx.strokeStyle = "#38ced8";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    BOARD_X + CELL,
    BOARD_Y + CELL,
    (GRID_COLS - 2) * CELL,
    (GRID_ROWS - 2) * CELL,
  );
  if (s.pellet) {
    const x = BOARD_X + s.pellet.col * CELL + CELL / 2,
      y = BOARD_Y + s.pellet.row * CELL + CELL / 2;
    ctx.shadowColor = "#ffb544";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffb544";
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 12, y);
    ctx.lineTo(x, y + 12);
    ctx.lineTo(x - 12, y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff1ae";
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
  snake(ctx, s);
}
function hud(ctx: CanvasRenderingContext2D, s: View) {
  ctx.fillStyle = "#0a1424";
  ctx.fillRect(BOARD_X, 14, GRID_COLS * CELL, 88);
  text(ctx, SCORE_LABEL, BOARD_X + 16, 44, 17, "#64a9bc");
  text(ctx, String(s.score).padStart(4, "0"), BOARD_X + 16, 83, 34);
  text(ctx, BEST_LABEL, BOARD_X + 250, 44, 17, "#64a9bc");
  text(ctx, String(s.best).padStart(4, "0"), BOARD_X + 250, 83, 34);
  if (s.combo >= 2) {
    text(ctx, `x${s.combo}`, BOARD_X + 525, 77, 42, "#ffc05d");
    ctx.fillStyle = "#29485a";
    ctx.fillRect(BOARD_X + 620, 69, 115, 8);
    ctx.fillStyle = "#ffc05d";
    ctx.fillRect(BOARD_X + 620, 69, (115 * s.comboWindow) / COMBO_WINDOW, 8);
  }
  text(ctx, MODE_LABEL, BOARD_X + 760, 48, 20, "#6cf0dd");
  text(
    ctx,
    s.muted ? "SOUND OFF" : "SOUND ON",
    BOARD_X + 760,
    82,
    15,
    s.muted ? "#e8829d" : "#76adba",
  );
}
function menu(ctx: CanvasRenderingContext2D, s: View) {
  const opts = items(s.screen);
  opts.forEach((label, i) => {
    const r = itemRect(s.screen, i)!;
    const selected = i === s.menuIndex;
    ctx.fillStyle = selected ? "#144452" : "#101c2d";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = selected ? "#69ffe1" : "#36566a";
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (selected) {
      ctx.fillStyle = "#ffbf58";
      ctx.fillRect(r.x + 12, r.y + 14, 4, r.h - 28);
    }
    text(
      ctx,
      label,
      r.x + r.w / 2,
      r.y + 36,
      23,
      selected ? "#f3ffff" : "#8caebc",
      "center",
    );
  });
}
export const game: Game<CoilState, CoilDebugApi> = {
  async initialize(api: InitApi<CoilState>) {
    for (const name of ACTIONS)
      api.input.register(name, { keys: [...BINDINGS[name]] });
    const images = await Promise.all(
      [
        ...SPRITE_PATHS.head,
        SPRITE_PATHS.body,
        SPRITE_PATHS.corner,
        SPRITE_PATHS.tail,
      ].map((path) => api.assets.loadImage(path)),
    );
    await Promise.all(
      Object.entries(CUE_PATHS).map(([cue, path]) => api.audio.load(cue, path)),
    );
    const sprites = {
      head: images.slice(0, HEAD_FRAMES),
      body: images[4],
      corner: images[5],
      tail: images[6],
    };
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("score", (s) => s.score);
    api.diagnostics.register("best", (s) => s.best);
    api.diagnostics.register(
      "combo",
      (s) => `x${s.combo} ${s.comboWindow.toFixed(2)}s`,
    );
    api.diagnostics.register("direction", (s) => s.dir);
    api.diagnostics.register("length", (s) => s.snake.length);
    api.diagnostics.register(
      "head",
      (s) => `${s.snake[0].col},${s.snake[0].row}`,
    );
    api.diagnostics.register("pellet", (s) =>
      s.pellet ? `${s.pellet.col},${s.pellet.row}` : "none",
    );
    return [opening(sprites), debugSurface()];
  },
  update(state: View, api: UpdateApi, dt: number) {
    let n = copy(state);
    if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
    n = { ...n, muted: api.audio.muted(), best: Math.max(n.best, n.score) };
    if (
      n.screen === "title" ||
      n.screen === "howto" ||
      n.screen === "gameover" ||
      n.screen === "cleared"
    )
      api.audio.stop(CUES.music);
    const edges = Object.fromEntries(
      ACTIONS.map((a) => [a, api.input.pressed(a)]),
    ) as Record<(typeof ACTIONS)[number], boolean>;
    if (n.screen === "playing") {
      if (edges.back || edges.pause)
        return { ...n, screen: "paused", menuIndex: 0, arms: [] };
      if (n.steering) {
        const turns = [...n.turns];
        for (const d of DIRECTIONS)
          if (edges[d] && turns.length < TURN_QUEUE_MAX) turns.push(d);
        n = { ...n, turns };
      }
      n = {
        ...n,
        simTime: n.simTime + dt,
        bite: Math.max(0, n.bite - dt),
        accumulator: n.accumulator + dt,
      };
      while (n.screen === "playing" && n.accumulator + 1e-9 >= TICK_SECONDS) {
        n = { ...tick(n, api), accumulator: n.accumulator - TICK_SECONDS };
      }
      if (n.screen !== "playing") n = { ...n, accumulator: 0 };
    } else {
      if (edges.up)
        n = {
          ...n,
          menuIndex:
            (n.menuIndex + items(n.screen).length - 1) % items(n.screen).length,
        };
      if (edges.down)
        n = { ...n, menuIndex: (n.menuIndex + 1) % items(n.screen).length };
      if (
        (n.screen === "paused" && edges.pause) ||
        (edges.back && n.screen === "paused")
      )
        n = { ...n, screen: "playing", menuIndex: 0, arms: [] };
      else if (
        edges.back &&
        (n.screen === "howto" ||
          n.screen === "gameover" ||
          n.screen === "cleared")
      )
        n = { ...n, screen: "title", menuIndex: n.titleIndex, arms: [] };
      else if (edges.confirm) n = accept(n, api);
      if (n.screen !== "playing") {
        let arms = [...n.arms];
        for (const sample of api.input.pointerSamples()) {
          const index = hit(n.screen, sample.x, sample.y);
          if (index >= 0) n = { ...n, menuIndex: index };
          if (sample.type === "down" && sample.button === "primary")
            arms = [
              ...arms.filter((a) => a.id !== sample.id),
              { id: sample.id, index },
            ];
          if (sample.type === "up" && sample.button === "primary") {
            const arm = arms.find((a) => a.id === sample.id);
            arms = arms.filter((a) => a.id !== sample.id);
            if (arm && index >= 0 && index === arm.index) {
              n = { ...n, menuIndex: index };
              n = accept(n, api);
              arms = [];
              break;
            }
          }
        }
        n = { ...n, arms };
      }
    }
    return { ...n, best: Math.max(n.best, n.score) };
  },
  render(s: View, api: RenderApi) {
    const ctx = api.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, STAGE_W, 720);
    ctx.fillStyle = "#102337";
    ctx.fillRect(0, 107, STAGE_W, 2);
    board(ctx, s);
    hud(ctx, s);
    if (s.screen === "playing") return;
    ctx.fillStyle = "rgba(3,8,19,.75)";
    ctx.fillRect(0, 0, STAGE_W, 720);
    if (s.screen === "title") {
      panel(ctx, 340, 162, 600, 435);
      text(ctx, TITLE_TEXT, STAGE_CX, 306, 122, "#9bfff0", "center");
      text(ctx, TAGLINE_TEXT, STAGE_CX, 350, 24, "#61b7c1", "center");
      text(ctx, BEST_LABEL, STAGE_CX, 402, 18, "#6dabb8", "center");
      text(
        ctx,
        String(s.best).padStart(4, "0"),
        STAGE_CX,
        441,
        38,
        "#f6c96f",
        "center",
      );
    } else if (s.screen === "howto") {
      panel(ctx, 260, 70, 760, 570);
      text(ctx, "HOW TO PLAY", STAGE_CX, 126, 42, "#9bfff0", "center");
      const lines = [
        "Your serpent never stops. Turn on the next beat.",
        "Use ARROWS or WASD to steer. Only right-angle turns count.",
        "No doubling back: your body remembers every path.",
        "Eat the bright pellets to grow one cell longer.",
        "Walls and your own coil end the round.",
        "Chain quick bites to raise your combo up to x5.",
        "Wait too long and the multiplier falls back to x1.",
        "ENTER / SPACE select   ESC goes back   P pauses   M mutes",
      ];
      lines.forEach((line, i) =>
        text(
          ctx,
          line,
          STAGE_CX,
          187 + i * 47,
          i === 7 ? 18 : 20,
          i === 7 ? "#efbb78" : "#d7eef1",
          "center",
          "500",
        ),
      );
    } else {
      panel(
        ctx,
        390,
        s.screen === "paused" ? 240 : 258,
        500,
        s.screen === "paused" ? 300 : 365,
      );
      text(
        ctx,
        s.screen === "paused"
          ? "PAUSED"
          : s.screen === "cleared"
            ? CLEARED_TEXT
            : GAMEOVER_TEXT,
        STAGE_CX,
        330,
        42,
        "#9bfff0",
        "center",
      );
      if (s.screen !== "paused") {
        text(ctx, SCORE_LABEL, 550, 395, 16, "#70a9bc", "center");
        text(ctx, String(s.score), 550, 435, 32, "#fff", "center");
        text(ctx, BEST_LABEL, 730, 395, 16, "#70a9bc", "center");
        text(ctx, String(s.best), 730, 435, 32, "#ffd174", "center");
      }
    }
    menu(ctx, s);
  },
};
