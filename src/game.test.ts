import { describe, expect, it, vi } from "vitest";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { Game, InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import { createCanvas } from "@napi-rs/canvas";
import { game, type CoilState } from "./game";
import { TICK_SECONDS } from "./constants";

type Inputs = Set<string>;
async function harness() {
  const cues: string[] = [];
  const api = {
    input: { register: vi.fn() },
    assets: { loadImage: async () => ({}) as ImageBitmap },
    audio: { load: async () => undefined },
    diagnostics: { register: vi.fn() },
  } as unknown as InitApi<CoilState>;
  const [initial, debug] = await game.initialize(api);
  const input: Inputs = new Set();
  const updateApi = {
    input: {
      pressed: (name: string) => input.delete(name),
      pointerSamples: () => [],
    },
    audio: {
      muted: () => false,
      setMuted: vi.fn(),
      play: (name: string) => cues.push(name),
      loop: (name: string) => cues.push(`loop:${name}`),
      stop: (name: string) => cues.push(`stop:${name}`),
    },
  } as unknown as UpdateApi;
  const frame = (state: CoilState, dt: number, ...keys: string[]) => {
    input.clear();
    keys.forEach((key) => input.add(key));
    return game.update(state, updateApi, dt);
  };
  return { initial, debug, frame, cues };
}

describe("Coil simulation", () => {
  it("starts on the title and advances by whole ticks only", async () => {
    const { initial, debug, frame } = await harness();
    expect(debug.snapshot(initial)).toMatchObject({
      screen: "title",
      score: 0,
      best: 0,
      ticks: 0,
      pellet: null,
    });
    let s = frame(initial, 0, "confirm");
    expect(s.screen).toBe("playing");
    expect(s.pellet).not.toBeNull();
    s = frame(s, TICK_SECONDS / 2);
    expect(s.snake[0]).toEqual({ col: 15, row: 8 });
    s = frame(s, TICK_SECONDS / 2);
    expect(s.snake[0]).toEqual({ col: 16, row: 8 });
    expect(s.ticks).toBe(1);
  });

  it("buffers two turns across two ticks and grows and scores on an eat", async () => {
    const { initial, debug, frame, cues } = await harness();
    let s = debug.setScreen(initial, "playing");
    s = debug.setPelletRespawn(s, false);
    s = debug.setPellet(s, 15, 9);
    s = frame(s, 0, "down", "left");
    expect(s.turns).toEqual(["down", "left"]);
    s = frame(s, TICK_SECONDS);
    expect(s.dir).toBe("down");
    expect(s.snake[0]).toEqual({ col: 15, row: 9 });
    expect(s.snake).toHaveLength(4);
    expect(s.score).toBe(10);
    expect(s.comboWindow).toBe(3.375);
    expect(cues).toContain("eat");
    s = frame(s, TICK_SECONDS);
    expect(s.dir).toBe("left");
    expect(s.snake[0]).toEqual({ col: 14, row: 9 });
  });

  it("lapses the combo on schedule while travel is disabled", async () => {
    const { initial, debug, frame } = await harness();
    let s = debug.setScreen(initial, "playing");
    s = debug.setSnakeTravel(s, false);
    s = debug.setCombo(s, 3);
    s = debug.setComboWindow(s, 3.5);
    s = frame(s, 3.5);
    expect(s.ticks).toBe(28);
    expect(s.snake[0]).toEqual({ col: 15, row: 8 });
    expect(s.combo).toBe(1);
    expect(s.comboWindow).toBe(0);
  });

  it("ends immediately on a wall and freezes when paused", async () => {
    const { initial, debug, frame, cues } = await harness();
    let s = debug.setScreen(initial, "playing");
    s = debug.setSnake(s, [{ col: 28, row: 8 }]);
    s = frame(s, TICK_SECONDS);
    expect(s.screen).toBe("gameover");
    expect(s.ticks).toBe(1);
    expect(cues).toContain("death");
    s = frame(s, 1);
    expect(s.ticks).toBe(1);
  });

  it("validates poses and resets the session", async () => {
    const { initial, debug } = await harness();
    expect(() => debug.setSnake(initial, [{ col: 0, row: 0 }])).toThrow();
    expect(() => debug.setCombo(initial, 6)).toThrow();
    const posed = debug.setScore(initial, 120);
    expect(debug.snapshot(posed).best).toBe(0);
    const reset = debug.reset(posed);
    expect(debug.snapshot(reset)).toMatchObject({
      screen: "title",
      score: 0,
      best: 0,
      turns: [],
      nextPellet: null,
    });
  });

  it("runs the simulation through the engine's canvas and scripted clock", async () => {
    const { initial, debug } = await harness();
    const canvas = createCanvas(1280, 720);
    const subject: Game<CoilState, typeof debug> = {
      initialize: () => [initial, debug],
      update: game.update,
      render: () => undefined,
    };
    const engine = createEngine({
      canvas: canvas as unknown as HTMLCanvasElement,
      width: 1280,
      height: 720,
      game: subject,
      clock: new ConstantClock(125),
      surface: {
        cssWidth: () => 1280,
        cssHeight: () => 720,
        dpr: () => 1,
        events: () => new EventTarget(),
      },
    });
    await engine.initialize();
    engine.apply((s) => engine.debug.setScreen(s, "playing"));
    engine.apply((s) => engine.debug.setSnakeTravel(s, false));
    await engine.advance(8);
    expect(engine.debug.snapshot(engine.state)).toMatchObject({
      screen: "playing",
      ticks: 8,
      simTime: 1,
      snake: [
        { col: 15, row: 8 },
        { col: 14, row: 8 },
        { col: 13, row: 8 },
      ],
    });
    engine.destroy();
  });
});
