import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ZenModeBackgroundWindow } from "./components/ZenModeBackgroundWindow";
import { ZenModeWindow } from "./components/ZenModeWindow";
import { getZenModeWindowKind } from "./lib/zenMode";
import "./styles.css";

const zenModeWindowKind = getZenModeWindowKind();
const rootSurface =
  zenModeWindowKind === "background" ? <ZenModeBackgroundWindow /> : zenModeWindowKind === "editor" ? <ZenModeWindow /> : <App />;

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode>{rootSurface}</React.StrictMode>);
