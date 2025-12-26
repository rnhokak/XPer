import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { QueryProvider } from "./lib/query/QueryProvider";
import { Toaster } from "./components/ui/toaster";
import "./index.css";

const normalizeBasename = (value: string | undefined) => {
  if (!value) return "/app/cashflow";
  const trimmed = value.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const basename = normalizeBasename(import.meta.env.VITE_BASE_PATH);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryProvider>
      <BrowserRouter basename={basename}>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryProvider>
  </React.StrictMode>
);
