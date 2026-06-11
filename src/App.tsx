import { ChatPage } from "./components/ChatPage";
import { InstallPage } from "./components/InstallPage";
import { LandingPage } from "./components/LandingPage";
import { currentRoute } from "./lib/routes";

export default function App() {
  const route = currentRoute();

  if (route === "/install") {
    return <InstallPage />;
  }

  if (route === "/demo") {
    return (
      <div className="h-screen overflow-hidden">
        <ChatPage />
      </div>
    );
  }

  return <LandingPage />;
}
