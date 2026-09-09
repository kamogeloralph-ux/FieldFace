import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { trpc, makeTrpcClient } from "./lib/trpc";
import AdminApp from "./AdminApp";
import "./index.css";

const queryClient = new QueryClient();
const trpcClient = makeTrpcClient();

ReactDOM.createRoot(document.getElementById("admin-root")!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AdminApp />
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>,
);
