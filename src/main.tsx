import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startCloudSync } from "./lib/store";
import { startCloudPolling } from "./lib/sync";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Cloud is optional: offline, first run and plain-file use all keep working.
void startCloudSync().then(({ adopted }) => {
  if (adopted === "cloud") startCloudPolling();
});
