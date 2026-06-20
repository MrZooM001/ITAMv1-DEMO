import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queryClient";
import { registerLicense } from "@syncfusion/ej2-base";
import App from "./App";
import "./index.css";

registerLicense(`${import.meta.env.VITE_SYNCFUSION_KEY}`);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);