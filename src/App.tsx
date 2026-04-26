import { ChatPage } from "./components/ChatPage";
import { InstallPage } from "./components/InstallPage";
import { LandingPage } from "./components/LandingPage";

export default function App() {
  if (window.location.pathname === "/install") {
    return <InstallPage />;
  }

  if (window.location.pathname === "/demo") {
    return (
      <div className="h-screen overflow-hidden">
        <ChatPage />
      </div>
    );
  }

  return <LandingPage />;
}
