import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/baloo-2/latin-400.css";
import "@fontsource/baloo-2/latin-500.css";
import "@fontsource/baloo-2/latin-600.css";
import "@fontsource/baloo-2/latin-700.css";
import "@fontsource/baloo-2/latin-800.css";
import App from "./App";
import { CELL_W, LINE_H } from "./game/metrics";
import "./App.css";

document.documentElement.style.setProperty("--cell", `${CELL_W}px`);
document.documentElement.style.setProperty("--line-h", `${LINE_H}px`);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
