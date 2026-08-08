/* Signal Ledger: the dashboard is the primary workspace; keep navigation contextual and lightweight. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster position="bottom-right"/><Home /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
