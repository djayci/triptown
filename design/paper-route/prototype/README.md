# Paper Route concept renderer

`render-courier.html` is the three.js scene that produced `../render-courier-*.jpg`, the regulated concept on the design canvas. It is the reference for `apps/paper-route/src/scene/` (paper-route-mvp tasks 4.1–4.3).

Run it with `three@0.186.0` available at `./node_modules/three` and a static server, for example:

```sh
npm i three@0.186.0 && python3 -m http.server 8765
# http://localhost:8765/render-courier.html?style=courier&state=run&rolls=3   (states: run | splash | wipeout | rideon)
```

The earlier styles (`lowpoly`, `clay`, `toon`, `blocky`, `night`) are kept for reference only. The audit rules out their child-appealing elements (see `docs/compliance/paper-route-2026-09-15.md`).
