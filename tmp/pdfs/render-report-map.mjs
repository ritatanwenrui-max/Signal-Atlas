import { readFile, writeFile } from "node:fs/promises";
import { Resvg, initWasm } from "../../node_modules/.pnpm/@resvg+resvg-wasm@2.4.0/node_modules/@resvg/resvg-wasm/index.mjs";

const wasm = await readFile(new URL("../../node_modules/.pnpm/@resvg+resvg-wasm@2.4.0/node_modules/@resvg/resvg-wasm/index_bg.wasm", import.meta.url));
await initWasm(wasm);
let svg = await readFile(new URL("../../public/world-map-flat.svg", import.meta.url), "utf8");
const css = `<style>path{fill:#d9ddd4;stroke:#fff;stroke-width:.7}#tw,#tw path{fill:#263c19}#hk,#hk path{fill:#91ad52}#th,#th path{fill:#5f7d30}#us,#us path{fill:#bed27f}#cn,#cn path{fill:#dce9bc}#my,#my path{fill:#91ad52}#sg,#sg path{fill:#bed27f}</style>`;
svg = svg.replace("<title>", `${css}<title>`);
const rendered = new Resvg(svg, { fitTo: { mode: "width", value: 1500 }, background: "#fafbf7" }).render();
await writeFile(new URL("./report-map.png", import.meta.url), rendered.asPng());
