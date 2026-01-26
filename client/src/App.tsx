import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Loader2 } from "lucide-react";

// Ленивая загрузка страниц (Code Splitting)
const Home = lazy(() => import("./pages/Home"));
const Wiki = lazy(() => import("./pages/Wiki"));
const Search = lazy(() => import("./pages/Search"));
const Admin = lazy(() => import("./pages/Admin"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Компонент загрузки
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground text-sm">Загрузка...</span>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/wiki" component={Wiki} />
        <Route path="/wiki/:slug" component={Wiki} />
        <Route path="/search" component={Search} />
        <Route path="/admin" component={Admin} />
        <Route path="/admin/:section" component={Admin} />
        <Route path="/settings/notifications" component={NotificationSettings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
