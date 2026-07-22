/**
 * [INPUT]: 依赖 React 运行时
 * [OUTPUT]: 启动 React renderer 并挂载 AppRoot
 * [POS]: renderer 启动入口，选择应用组合根并挂载全局样式，不承载产品状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@/app/AppRoot";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
