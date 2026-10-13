// Sticker-level 4x4x4 model shared by the painter and the 3D player.
//
// Coordinates: x to the right (R), y up (U), z towards the viewer (F). Cubie
// centres sit at -1.5, -0.5, 0.5, 1.5 on each axis. Each of the 96 stickers
// is a cubie position plus an outward normal, and its index in the solver's
// facelet string follows the solver's own layout: faces in URFDLB order, 16
// stickers each, row by row as on the standard unfolded net.
"use strict";

(function (root) {
  const FACES = "URFDLB";
  const NORMALS = {
    U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1],
    D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1]
  };

  // Position of the sticker at row r, column c of a face, as seen on the net.
  function stickerPos(face, r, c) {
    const a = -1.5 + c, b = 1.5 - r;
    switch (face) {
      case "U": return [a, 1.5, -1.5 + r];
      case "D": return [a, -1.5, 1.5 - r];
      case "F": return [a, b, 1.5];
      case "B": return [1.5 - c, b, -1.5];
      case "R": return [1.5, b, 1.5 - c];
      case "L": return [-1.5, b, -1.5 + c];
    }
  }

  const STICKERS = [];
  for (const f of FACES) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        STICKERS.push({ face: f, r, c, pos: stickerPos(f, r, c), normal: NORMALS[f].slice() });
      }
    }
  }

  const key = (pos, n) => pos.map((v) => Math.round(v * 2)).join(",") + "|" + n.join(",");
  const INDEX = new Map(STICKERS.map((s, i) => [key(s.pos, s.normal), i]));

  // A clockwise quarter turn of each face, as seen looking at that face.
  // U sends R to F, R sends F to U, F sends L to U; the opposite faces turn
  // the other way about the same axis.
  const QUARTER = {
    U: ([x, y, z]) => [-z, y, x],
    D: ([x, y, z]) => [z, y, -x],
    R: ([x, y, z]) => [x, z, -y],
    L: ([x, y, z]) => [x, -z, y],
    F: ([x, y, z]) => [y, -x, z],
    B: ([x, y, z]) => [-y, x, z]
  };
  const AXIS = { U: [1, 1], D: [1, -1], R: [0, 1], L: [0, -1], F: [2, 1], B: [2, -1] };

  function parseMove(tok) {
    const m = /^([URFDLB])(w?)([2']?)$/.exec(tok);
    if (!m) return null;
    return { face: m[1], wide: m[2] === "w", turns: m[3] === "2" ? 2 : m[3] === "'" ? 3 : 1 };
  }

  // Does the cubie at pos move with this move?
  function inLayer(mv, pos) {
    const [axis, sign] = AXIS[mv.face];
    const v = pos[axis] * sign;
    return mv.wide ? v > 0 : v > 1;
  }

  // Apply a move to a facelet string; returns the new string.
  function applyMove(state, tok) {
    const mv = typeof tok === "string" ? parseMove(tok) : tok;
    if (!mv) throw new Error("bad move: " + tok);
    const out = state.split("");
    const q = QUARTER[mv.face];
    for (let i = 0; i < 96; i++) {
      const s = STICKERS[i];
      if (!inLayer(mv, s.pos)) continue;
      let p = s.pos, n = s.normal;
      for (let t = 0; t < mv.turns; t++) { p = q(p); n = q(n); }
      out[INDEX.get(key(p, n))] = state[i];
    }
    return out.join("");
  }

  const SOLVED = FACES.split("").map((f) => f.repeat(16)).join("");
  const tokens = (alg) => alg.trim().split(/\s+/).filter(Boolean);
  const applyAlg = (state, alg) => tokens(alg).reduce(applyMove, state);

  // ---------------------------------------------------------------- pieces
  // Group stickers into the pieces they belong to: 8 corners (3 stickers),
  // 24 edge wings (2 stickers) and 24 centres (1 sticker).
  const det = (a, b, c) =>
    a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  const PIECES = { corners: [], wings: [], centres: [] };
  {
    const byPos = new Map();
    STICKERS.forEach((s, i) => {
      const k = s.pos.join(",");
      if (!byPos.has(k)) byPos.set(k, []);
      byPos.get(k).push(i);
    });
    for (const [k, idx] of byPos) {
      const pos = k.split(",").map(Number);
      if (idx.length === 3) {
        // Start from the U/D sticker, then go round the corner the same way
        // for every corner, so twists can be summed.
        idx.sort((a, b) => Math.abs(STICKERS[b].normal[1]) - Math.abs(STICKERS[a].normal[1]));
        const n = idx.map((i) => STICKERS[i].normal);
        if (det(n[0], n[1], n[2]) < 0) idx.splice(1, 2, idx[2], idx[1]);
        PIECES.corners.push({ pos, idx });
      } else if (idx.length === 2) {
        // Order the two stickers by handedness relative to the wing's offset
        // along its edge. Moves preserve handedness, so a wing's ordered colour
        // pair identifies the piece; a wing cannot be flipped in place.
        const off = pos.map((v) => (Math.abs(v) === 0.5 ? Math.sign(v) : 0));
        const [a, b] = idx;
        if (det(STICKERS[a].normal, STICKERS[b].normal, off) < 0) idx.reverse();
        PIECES.wings.push({ pos, idx });
      } else {
        PIECES.centres.push({ pos, idx });
      }
    }
  }
  const HOME_WINGS = new Set(PIECES.wings.map((w) => w.idx.map((i) => SOLVED[i]).join("")));

  const FACE_NAME = { U: "top", D: "bottom", F: "front", B: "back", R: "right", L: "left" };
  const COLOUR_NAME = { U: "white", R: "red", F: "green", D: "yellow", L: "orange", B: "blue" };
  const OPP = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };
  const facesOf = (idx) => idx.map((i) => STICKERS[i].face);
  // Natural reading order: top/bottom, then front/back, then left/right.
  const RANK = { U: 0, D: 0, F: 1, B: 1, L: 2, R: 2 };
  const byRank = (a, b) => RANK[a] - RANK[b];
  const where = (idx) => facesOf(idx).sort(byRank).map((f) => FACE_NAME[f]).join("-");
  const colours = (cs) => cs.slice().sort(byRank).map((c) => COLOUR_NAME[c]).join("-");
  const colourSet = (cs) => cs.slice().sort().join("");

  // Explain what makes a painted cube impossible. Returns a list of
  // { text, stickers } problems; an empty list means the solver will accept
  // it. Mirrors the solver's own state check: centre counts, the eight
  // corners all present, total corner twist, and all 24 edge wings present.
  function diagnose(state) {
    const problems = [];
    const add = (text, stickers) => problems.push({ text, stickers });

    // Colour totals.
    const total = {};
    for (const ch of state) total[ch] = (total[ch] || 0) + 1;
    if (total["."]) add(`${total["."]} sticker${total["."] === 1 ? " is" : "s are"} still unpainted.`,
      [...state].map((c, i) => (c === "." ? i : -1)).filter((i) => i >= 0));
    const off = FACES.split("").filter((f) => (total[f] || 0) !== 16);
    if (off.length) add("Each colour needs exactly 16 stickers: " +
      off.map((f) => `${COLOUR_NAME[f]} has ${total[f] || 0}`).join(", ") + ".", []);
    if (problems.length) return problems;

    // Centres: four of each colour.
    const ct = {};
    for (const c of PIECES.centres) ct[state[c.idx[0]]] = (ct[state[c.idx[0]]] || 0) + 1;
    const ctOff = FACES.split("").filter((f) => (ct[f] || 0) !== 4);
    if (ctOff.length) {
      add("Centres must have four of each colour: " +
        ctOff.map((f) => `${COLOUR_NAME[f]} has ${ct[f] || 0}`).join(", ") + ".",
        PIECES.centres.filter((c) => ctOff.includes(state[c.idx[0]])).map((c) => c.idx[0]));
    }

    // Corners.
    const seen = new Map();
    let twist = 0, cornersOk = true;
    for (const c of PIECES.corners) {
      const cs = c.idx.map((i) => state[i]);
      const at = `The corner at ${where(c.idx)}`;
      if (new Set(cs).size < 3) {
        add(`${at} has two ${COLOUR_NAME[cs.find((x, k) => cs.indexOf(x) !== k)]} stickers. Every corner has three different colours.`, c.idx);
        cornersOk = false; continue;
      }
      const opp = cs.find((x) => cs.includes(OPP[x]));
      if (opp) {
        add(`${at} has ${COLOUR_NAME[opp]} and ${COLOUR_NAME[OPP[opp]]} together. They are opposite colours, so no corner has both.`, c.idx);
        cornersOk = false; continue;
      }
      const ns = c.idx.map((i) => STICKERS[i].normal);
      const hs = cs.map((x) => NORMALS[x]);
      if (Math.sign(det(ns[0], ns[1], ns[2])) !== Math.sign(det(hs[0], hs[1], hs[2]))) {
        add(`${at} has two of its stickers swapped. It reads as a ${colours(cs)} corner, but going round a real ${colours(cs)} corner the colours come in the opposite order, so the cube can't exist. Swap two of these three stickers.`, c.idx);
        cornersOk = false; continue;
      }
      const key = colourSet(cs);
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(c);
      twist += cs.findIndex((x) => x === "U" || x === "D");
    }
    for (const [key, list] of seen) {
      if (list.length > 1) {
        add(`There are ${list.length} ${colours(list[0].idx.map((i) => state[i]))} corners (at ${list.map((c) => where(c.idx)).join(" and ")}). ` +
          "A cube has only one of each, so one is painted wrong.", list.flatMap((c) => c.idx));
        cornersOk = false;
      }
    }
    if (cornersOk && twist % 3 !== 0) {
      add("One corner is twisted in place: every corner has valid colours, but they cannot all point this way at once. " +
        "Check each corner's three stickers against your cube; rotating one corner's colours by one step fixes it.",
        PIECES.corners.flatMap((c) => c.idx));
    }

    // Edge wings.
    const wseen = new Map();
    for (const w of PIECES.wings) {
      const cs = w.idx.map((i) => state[i]);
      const at = `The edge piece at ${where(w.idx)}`;
      if (cs[0] === cs[1]) { add(`${at} has two ${COLOUR_NAME[cs[0]]} stickers. Every edge piece has two different colours.`, w.idx); continue; }
      if (OPP[cs[0]] === cs[1]) { add(`${at} has ${COLOUR_NAME[cs[0]]} and ${COLOUR_NAME[cs[1]]}, which are opposite colours, so no edge has both.`, w.idx); continue; }
      const id = cs.join("");
      if (!wseen.has(id)) wseen.set(id, []);
      wseen.get(id).push(w);
    }
    for (const [id, list] of wseen) {
      if (list.length > 1 && HOME_WINGS.has(id)) {
        add(`Two ${colours(id.split(""))} edge pieces are the same way round (at ${list.map((w) => where(w.idx)).join(" and ")}). ` +
          "Each 4x4 edge has a left and a right piece and neither can flip in place, so one of these has its two stickers the wrong way round. Swap the two stickers on one of them.",
          list.flatMap((w) => w.idx));
      }
    }

    return problems;
  }

  const api = { FACES, NORMALS, STICKERS, SOLVED, PIECES, parseMove, inLayer, applyMove, applyAlg, tokens, QUARTER, AXIS, diagnose };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Cube = api;
})(typeof self !== "undefined" ? self : this);
