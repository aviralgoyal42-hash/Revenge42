// CSS 3D view of a 4x4x4: drag to orbit, click a sticker to paint it, and
// animated layer turns for solution playback. Depends on cube.js.
"use strict";

(function (root) {
  const C = root.Cube;
  const SIZE = 44; // px per cubie
  const H = SIZE / 2;

  // Model coordinates have y up; CSS has y down.
  const css = ([x, y, z]) => `translate3d(${x * SIZE}px, ${-y * SIZE}px, ${z * SIZE}px)`;

  // Transform that turns a square facing the viewer into a cubie face with
  // the given model-space normal.
  const FACE_XF = {
    "1,0,0": `rotateY(90deg) translateZ(${H}px)`,
    "-1,0,0": `rotateY(-90deg) translateZ(${H}px)`,
    "0,1,0": `rotateX(90deg) translateZ(${H}px)`,
    "0,-1,0": `rotateX(-90deg) translateZ(${H}px)`,
    "0,0,1": `translateZ(${H}px)`,
    "0,0,-1": `rotateY(180deg) translateZ(${H}px)`
  };

  // CSS rotation that matches a clockwise quarter turn of each face in cube.js.
  const TURN = {
    U: ["rotateY", -90], D: ["rotateY", 90],
    R: ["rotateX", 90], L: ["rotateX", -90],
    F: ["rotateZ", 90], B: ["rotateZ", -90]
  };

  class Cube3D {
    constructor(host, opts = {}) {
      this.host = host;
      this.colors = opts.colors;
      this.onSticker = opts.onSticker || null;
      this.rx = -28;
      this.ry = -38;
      this.state = C.SOLVED;

      host.classList.add("c3d");
      this.scene = document.createElement("div");
      this.scene.className = "c3d-scene";
      this.root = document.createElement("div");
      this.root.className = "c3d-root";
      this.scene.appendChild(this.root);
      host.appendChild(this.scene);

      // One element per surface cubie; stickers are children so a layer turn
      // only has to transform the cubie.
      this.cubies = [];
      this.stickerEls = new Array(96);
      const vals = [-1.5, -0.5, 0.5, 1.5];
      for (const x of vals) for (const y of vals) for (const z of vals) {
        if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) < 1.5) continue;
        const el = document.createElement("div");
        el.className = "c3d-cubie";
        const pos = [x, y, z];
        el.style.transform = css(pos);
        for (const n of Object.keys(FACE_XF)) {
          const f = document.createElement("div");
          f.className = "c3d-face";
          f.style.transform = FACE_XF[n];
          el.appendChild(f);
        }
        this.root.appendChild(el);
        this.cubies.push({ el, pos });
      }
      C.STICKERS.forEach((s, i) => {
        const cubie = this.cubies.find((q) => q.pos.every((v, k) => v === s.pos[k]));
        const f = document.createElement("div");
        f.className = "c3d-sticker";
        f.style.transform = FACE_XF[s.normal.join(",")].replace(`translateZ(${H}px)`, `translateZ(${H + 0.6}px)`);
        f.dataset.idx = i;
        cubie.el.appendChild(f);
        this.stickerEls[i] = f;
      });

      this._orbit();
      this._bindDrag();
      this.setState(this.state);
    }

    setState(state) {
      this.state = state;
      for (let i = 0; i < 96; i++) {
        this.stickerEls[i].style.background = this.colors[state[i]] || this.colors["."];
        this.stickerEls[i].classList.toggle("blank", state[i] === ".");
      }
    }

    _orbit() {
      this.root.style.transform = `rotateX(${this.rx}deg) rotateY(${this.ry}deg)`;
    }

    _bindDrag() {
      let drag = null;
      this.scene.addEventListener("pointerdown", (e) => {
        drag = { x: e.clientX, y: e.clientY, rx: this.rx, ry: this.ry, moved: false, target: e.target };
        this.scene.setPointerCapture(e.pointerId);
      });
      this.scene.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (!drag.moved) return;
        this.ry = drag.ry + dx * 0.5;
        this.rx = Math.max(-89, Math.min(89, drag.rx - dy * 0.5));
        this._orbit();
      });
      const end = () => {
        if (drag && !drag.moved && this.onSticker && drag.target.classList.contains("c3d-sticker")) {
          this.onSticker(Number(drag.target.dataset.idx));
        }
        drag = null;
      };
      this.scene.addEventListener("pointerup", end);
      this.scene.addEventListener("pointercancel", () => { drag = null; });
    }

    // Rotate the view by whole quarter turns, for the arrow buttons.
    nudge(dRy, dRx = 0) {
      this.ry += dRy;
      this.rx = Math.max(-89, Math.min(89, this.rx + dRx));
      this.root.classList.add("easing");
      this._orbit();
      setTimeout(() => this.root.classList.remove("easing"), 320);
    }

    // Animate one move, then commit the new state. Resolves when done.
    animate(tok, ms) {
      const mv = C.parseMove(tok);
      const next = C.applyMove(this.state, mv);
      if (!ms) { this.setState(next); return Promise.resolve(); }
      const [fn, base] = TURN[mv.face];
      const total = mv.turns === 3 ? -base : base * mv.turns;
      const moving = this.cubies.filter((q) => C.inLayer(mv, q.pos));
      return new Promise((resolve) => {
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          for (const q of moving) q.el.style.transform = `${fn}(${total * e}deg) ${css(q.pos)}`;
          if (t < 1) { requestAnimationFrame(step); return; }
          for (const q of moving) q.el.style.transform = css(q.pos);
          this.setState(next);
          resolve();
        };
        requestAnimationFrame(step);
      });
    }
  }

  root.Cube3D = Cube3D;
})(self);
