import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Chrome,
  Download,
  FolderOpen,
  Github,
  Puzzle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { appPath, assetUrl } from "../lib/routes";

const GITHUB_URL = "https://github.com/shitijkarsolia/privacylens";

const steps = [
  {
    icon: Download,
    title: "Get the extension package",
    detail:
      "Download the prebuilt zip below and unzip it, or build from source with npm run build (Chrome loads the generated dist folder).",
    command: "privacylens-extension.zip  -  or:  npm run build",
  },
  {
    icon: Puzzle,
    title: "Open Chrome extensions",
    detail: "Go to chrome://extensions and enable Developer mode.",
    command: "chrome://extensions",
  },
  {
    icon: FolderOpen,
    title: "Load unpacked",
    detail: "Choose the unzipped folder (or ./dist when building from source).",
    command: "./privacylens-extension  or  ./dist",
  },
  {
    icon: Chrome,
    title: "Open an AI chat",
    detail: "Try ChatGPT first, then Claude, Gemini, Perplexity, or Copilot.",
    command: "https://chatgpt.com",
  },
  {
    icon: BadgeCheck,
    title: "Confirm protection",
    detail: "Paste sample personal data or upload a sample file. The side panel should open before anything is sent.",
    command: "Aisha Patel, SSN 291-XX-XXXX",
  },
];

const checks = [
  "The toolbar badge shows detected item counts.",
  "Risky sends are blocked before they leave the composer.",
  "The side panel opens for review when risky data is found.",
  "Risky attachments can be redacted and attached as sanitized copies.",
];

export function InstallPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#FDFCFB] text-[#111827]">
      <header className="sticky top-0 z-30 border-b border-[#ECE9E4]/80 bg-[#FDFCFB]/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-8 max-sm:px-4">
          <a href={appPath("")} className="flex items-center gap-3" aria-label="PrivacyLens home">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border-2 border-[#079B8E] bg-[#EAF8F5] text-[#079B8E]">
              <ShieldCheck size={21} strokeWidth={2.3} />
            </div>
            <span className="text-base font-bold tracking-[-0.02em] text-[#101827]">PrivacyLens</span>
          </a>
          <div className="flex items-center gap-6 max-sm:gap-3">
            <a
              href={appPath("demo")}
              className="text-sm font-semibold text-[#354154] transition hover:text-[#079B8E] max-sm:hidden"
            >
              Live demo
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[#354154] transition hover:text-[#079B8E]"
              aria-label="View source on GitHub"
              title="View source on GitHub"
            >
              <Github size={19} />
            </a>
            <a
              href={assetUrl("privacylens-extension.zip")}
              download
              className="inline-flex items-center gap-2 rounded-lg bg-[#079B8E] px-4 py-2 text-sm font-bold text-white shadow-[0_8px_20px_rgba(7,155,142,0.22)] transition hover:bg-[#067F75]"
            >
              <Download size={16} />
              Download .zip
            </a>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-[1180px] flex-1 grid-cols-[0.95fr_1.05fr] gap-14 px-8 py-10 max-lg:grid-cols-1 max-sm:px-4">
        <div className="flex flex-col justify-between">
          <div>
            <a href={appPath("")} className="inline-flex items-center gap-2 text-sm font-semibold text-[#079B8E]">
              <ArrowLeft size={18} />
              Back to PrivacyLens
            </a>

            <div className="mt-12 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#079B8E] bg-[#EAF8F5] text-[#079B8E]">
                <ShieldCheck size={30} />
              </div>
              <p className="text-2xl font-bold tracking-tight">PrivacyLens</p>
            </div>

            <h1 className="mt-10 max-w-[580px] text-6xl font-bold leading-[1.04] tracking-[-0.04em] max-sm:text-4xl">
              Install the local privacy layer for AI chats.
            </h1>
            <p className="mt-6 max-w-[560px] text-lg leading-8 text-[#344154]">
              Load the Chrome extension from the production build, open a supported AI chat,
              and PrivacyLens will block personal data before it can be sent.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href={assetUrl("privacylens-extension.zip")}
                download
                className="inline-flex items-center gap-3 rounded-lg bg-[#079B8E] px-6 py-3.5 text-base font-bold text-white shadow-[0_16px_34px_rgba(7,155,142,0.24)] transition hover:bg-[#067F75]"
              >
                <Download size={20} />
                Download extension (.zip)
              </a>
              <a
                href={appPath("demo")}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-[#079B8E] bg-white px-6 py-3 text-base font-bold text-[#079B8E] transition hover:bg-[#F1FBF9]"
              >
                <Sparkles size={18} />
                Or try the web demo
              </a>
            </div>
          </div>

          <div className="mt-12 rounded-xl border border-[#D7EEE9] bg-[#F2FBF9] p-5">
            <div className="flex items-center gap-3">
              <BadgeCheck className="text-[#079B8E]" size={28} />
              <p className="font-bold">Supported surfaces</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#305B63]">
              ChatGPT, Claude, Gemini, Perplexity, and Copilot use dedicated composer adapters.
              ChatGPT is the primary tested target.
            </p>
          </div>
        </div>

        <div className="self-center">
          <div className="overflow-hidden rounded-2xl border border-[#E8E5DF] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
            <div className="border-b border-[#E8E5DF] px-5 py-4">
              <p className="text-sm font-bold">Install checklist</p>
              <p className="mt-1 text-xs text-[#697386]">Use the generated `dist` folder.</p>
            </div>

            <div>
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="grid grid-cols-[44px_1fr] gap-4 border-b border-[#EEECEA] px-5 py-5 last:border-b-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF8F5] text-[#079B8E]">
                      <Icon size={23} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#079B8E] text-[11px] font-bold text-white">
                          {index + 1}
                        </span>
                        <p className="font-bold">{step.title}</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#4D5B6C]">{step.detail}</p>
                      <code className="mt-3 block overflow-x-auto rounded-lg bg-[#F7F8FA] px-3 py-2 text-xs text-[#111827]">
                        {step.command}
                      </code>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {checks.map((check) => (
              <div key={check} className="flex items-start gap-2 rounded-lg border border-[#E8E5DF] bg-white px-3 py-3 text-sm text-[#354154]">
                <CheckCircle2 className="mt-0.5 shrink-0 text-[#079B8E]" size={17} />
                <span>{check}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#ECE9E4]">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-6 px-8 py-8 max-sm:px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border-2 border-[#079B8E] bg-[#EAF8F5] text-[#079B8E]">
              <ShieldCheck size={21} strokeWidth={2.3} />
            </div>
            <span className="text-sm text-[#697386]">See what AI sees before AI sees it.</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm font-semibold text-[#354154]">
            <a href={appPath("")} className="transition hover:text-[#079B8E]">
              Home
            </a>
            <a href={appPath("demo")} className="transition hover:text-[#079B8E]">
              Live demo
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition hover:text-[#079B8E]"
            >
              <Github size={16} />
              GitHub
            </a>
            <span className="font-normal text-[#697386]">MIT License</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
