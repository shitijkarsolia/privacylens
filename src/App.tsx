import { MotionConfig } from "framer-motion";
import { ChatPage } from "./components/ChatPage";
import { InstallPage } from "./components/InstallPage";
import { LandingPage } from "./components/LandingPage";
import { currentRoute } from "./lib/routes";

export default function App() {
  const route = currentRoute();

  // reducedMotion="user" makes every Framer animation honor the viewer's
  // "reduce motion" OS setting - transforms are dropped, opacity kept.
  return (
    <MotionConfig reducedMotion="user">
      {route === "/install" ? (
        <InstallPage />
      ) : route === "/demo" ? (
        <div className="h-screen overflow-hidden">
          <ChatPage />
        </div>
      ) : (
        <LandingPage />
      )}
    </MotionConfig>
  );
}
