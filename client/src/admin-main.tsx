import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { trpc, makeTrpcClient } from "./lib/trpc";
import PlatformApp from "./PlatformApp";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});
const trpcClient = makeTrpcClient();
const ownerConsoleBase = window.location.pathname.startsWith("/admin.html") ? "/admin.html" : "/admin";

ReactDOM.createRoot(document.getElementById("admin-root")!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={ownerConsoleBase}>
          <PlatformApp />
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>,
);
