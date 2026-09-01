import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./extended.css";
import "./theme.css";
import "./dialog.css";
import "./permissions.css";
import "./party.css";
import "./editor.css";
import "./floating.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
