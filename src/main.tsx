import React from "react";
import ReactDOM from "react-dom/client";
import { Studio } from "./studio/Studio";
import "./styles.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <Studio />
    </React.StrictMode>
  );
}
