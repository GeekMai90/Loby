import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ZenModeWindow } from "./components/ZenModeWindow";
import { isZenModeWindow } from "./lib/zenMode";
import "./styles.css";

const rootSurface = isZenModeWindow() ? <ZenModeWindow /> : <App />;

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode>{rootSurface}</React.StrictMode>);
