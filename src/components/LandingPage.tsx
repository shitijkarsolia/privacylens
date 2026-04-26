import {
  ArrowRight,
  Badge,
  Bot,
  CheckCircle2,
  Chrome,
  CreditCard,
  Home,
  Lock,
  Mail,
  MoreVertical,
  Paperclip,
  Play,
  Plus,
  Puzzle,
  SendHorizontal,
  Settings,
  ShieldCheck,
  Star,
  User,
  Wand2,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

const piiItems = [
  {
    icon: User,
    label: "Full Name",
    value: "Aisha Patel",
    severity: "Medium Risk",
    tone: "medium",
  },
  {
    icon: Mail,
    label: "Email Address",
    value: "aisha.patel22@gmail.com",
    severity: "Low Risk",
    tone: "low",
  },
  {
    icon: Home,
    label: "Home Address",
    value: "1520 S Mill Ave Apt 3B, Tempe AZ 85281",
    severity: "Medium Risk",
    tone: "medium",
  },
  {
    icon: CreditCard,
    label: "SSN",
    value: "291-XX-XXXX",
    severity: "High Risk",
    tone: "high",
  },
  {
    icon: Badge,
    label: "Employee ID",
    value: "EMP-20418",
    severity: "High Risk",
    tone: "high",
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "Detects PII in real-time",
    text: "Names, IDs, emails, addresses, financial data, and more.",
  },
  {
    icon: Wand2,
    title: "Prevents data leaks",
    text: "Blocks risky info from being sent to any AI platform.",
  },
  {
    icon: Lock,
    title: "Works everywhere",
    text: "Seamless side panel in any AI chat you use.",
  },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center justify-center rounded-[10px] border-2 border-[#079B8E] bg-[#EAF8F5] text-[#079B8E] ${
          compact ? "h-8 w-8" : "h-14 w-14"
        }`}
      >
        <ShieldCheck size={compact ? 21 : 35} strokeWidth={2.3} />
      </div>
      <span
        className={`font-bold tracking-[-0.02em] text-[#101827] ${
          compact ? "text-base" : "text-3xl"
        }`}
      >
        PrivacyLens
      </span>
    </div>
  );
}

function ToneBadge({ tone, label }: { tone: string; label: string }) {
  const classes =
    tone === "high"
      ? "bg-[#FDE9E5] text-[#D7351D]"
      : tone === "medium"
        ? "bg-[#FFF0D5] text-[#D66B00]"
        : "bg-[#E8F8F4] text-[#078C7D]";

  return (
    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}

function PIIRow({ item }: { item: (typeof piiItems)[number] }) {
  const Icon = item.icon;
  const iconTone =
    item.tone === "high"
      ? "bg-[#FDE9E5] text-[#E54D2E]"
      : item.tone === "medium"
        ? "bg-[#FFF2D9] text-[#F59E0B]"
        : "bg-[#E8F8F4] text-[#079B8E]";

  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)_auto_34px] items-center gap-2 border-b border-[#EBEDF0] px-3 py-3 last:border-b-0">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconTone}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-[#111827]">{item.label}</p>
        <p className="truncate text-[11px] leading-4 text-[#5D6675]">{item.value}</p>
      </div>
      <ToneBadge tone={item.tone} label={item.severity} />
      <div className="relative h-5 w-9 rounded-full bg-[#0B9F91] shadow-inner">
        <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
      </div>
    </div>
  );
}

function Highlight({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "high" | "medium" | "low";
}) {
  const classes =
    tone === "high"
      ? "bg-[#FADBD5] text-[#8C1D12]"
      : tone === "medium"
        ? "bg-[#FFE3BD] text-[#7C3F00]"
        : "bg-[#CFF4EA] text-[#035F56]";

  return <mark className={`rounded px-1 ${classes}`}>{children}</mark>;
}

function BrowserMock() {
  return (
    <div className="relative mx-auto w-full max-w-[900px]">
      <div className="overflow-hidden rounded-[18px] border border-[#E3E0DB] bg-white shadow-[0_26px_90px_rgba(15,23,42,0.12)]">
        <div className="flex h-[50px] items-center border-b border-[#ECE9E4] bg-[#FAF9F7] px-5">
          <div className="mr-4 flex gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-[#F0524F]" />
            <span className="h-3.5 w-3.5 rounded-full bg-[#F4B227]" />
            <span className="h-3.5 w-3.5 rounded-full bg-[#32C759]" />
          </div>
          <div className="flex h-full min-w-0 items-center gap-2 rounded-t-xl bg-white px-4 text-sm text-[#111827]">
            <Bot size={18} />
            <span>ChatGPT</span>
            <span className="ml-10 text-[#6B7280]">x</span>
          </div>
          <Plus className="ml-3 text-[#334155]" size={20} />
        </div>

        <div className="flex h-[54px] items-center gap-4 border-b border-[#ECE9E4] bg-white px-5">
          <span className="text-2xl leading-none text-[#334155]">&lt;</span>
          <span className="text-2xl leading-none text-[#94A3B8]">&gt;</span>
          <span className="text-lg text-[#334155]">⟳</span>
          <div className="flex h-9 flex-1 items-center gap-3 rounded-full bg-[#F4F5F7] px-4 text-sm text-[#111827]">
            <Lock size={15} className="text-[#334155]" />
            <span>chatgpt.com</span>
          </div>
          <Star size={20} className="text-[#334155]" />
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#CCF2EC] text-[#079B8E]">
            <ShieldCheck size={24} />
          </div>
          <Puzzle size={21} className="text-[#334155]" />
          <MoreVertical size={21} className="text-[#334155]" />
        </div>

        <div className="grid min-h-[575px] grid-cols-[1fr_360px] bg-white max-lg:grid-cols-1">
          <div className="relative border-r border-[#ECE9E4] px-8 py-8 max-lg:min-h-[520px] max-sm:px-4">
            <div className="mb-9 flex items-center gap-3 text-lg font-semibold">
              <Bot size={26} />
              <span>ChatGPT 4o⌄</span>
            </div>

            <div className="ml-auto mb-8 max-w-[230px] rounded-2xl bg-[#F3F2F1] px-5 py-4 text-sm leading-6">
              Can you help me review this contract?
            </div>

            <div className="mb-5 flex gap-4">
              <Bot className="mt-1 shrink-0" size={24} />
              <p className="max-w-[390px] text-sm leading-6">
                Of course! Please share the details or paste the document here and I will take a look.
              </p>
            </div>

            <div className="mx-auto max-w-[440px] rounded-[20px] border border-[#DFE3EA] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
              <p className="text-base leading-8">
                This agreement is between <Highlight tone="medium">Aisha Patel</Highlight>{" "}
                (<Highlight tone="low">aisha.patel22@gmail.com</Highlight>) of{" "}
                <Highlight tone="medium">1520 S Mill Ave Apt 3B, Tempe AZ 85281</Highlight>{" "}
                and Stellar Solutions LLC. My SSN is{" "}
                <Highlight tone="high">291-XX-XXXX</Highlight> and my employee ID is{" "}
                <Highlight tone="high">EMP-20418</Highlight>. You can also reach me at{" "}
                <Highlight tone="low">(480) 555-0198</Highlight>.
              </p>
              <div className="mt-5 flex items-center justify-between">
                <Paperclip size={20} className="text-[#334155]" />
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#079B8E] text-white shadow-lg">
                  <SendHorizontal size={19} />
                </button>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-[#687385]">
              ChatGPT can make mistakes. Check important info.
            </p>
          </div>

          <aside className="bg-[#FEFDFC] px-4 py-5 max-lg:hidden">
            <div className="mb-5 flex items-center justify-between">
              <Logo compact />
              <span className="text-xl text-[#334155]">x</span>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-lg border border-[#F4A7A0] bg-[#FFF2F0] px-3 py-2 text-sm font-semibold text-[#B42318]">
              <span className="flex items-center gap-2">
                <Zap size={16} />
                5 PII items detected - Send blocked
              </span>
              <Lock size={15} />
            </div>

            <p className="mb-3 text-xs leading-5 text-[#5F6B7A]">
              Choose what to redact. Kept items are approved for this send.
            </p>

            <div className="overflow-hidden rounded-xl border border-[#E8E5DF] bg-white">
              {piiItems.map((item) => (
                <PIIRow item={item} key={item.label} />
              ))}
            </div>

            <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#079B8E] px-4 py-3 text-sm font-bold text-white shadow-[0_14px_28px_rgba(7,155,142,0.22)]">
              <Wand2 size={17} />
              Redact selected and send
            </button>

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#DDEFEA] bg-[#F1FBF9] px-3 py-3 text-xs text-[#305B63]">
              <Zap size={16} className="text-[#079B8E]" />
              <span>Tip: Your SSN can be used for identity theft.</span>
              <ArrowRight className="ml-auto text-[#079B8E]" size={15} />
            </div>

            <div className="mt-10 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#079B8E]" />
                5 items caught before sending.
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#94A3B8] text-[#64748B]">
                i
              </span>
            </div>
          </aside>
        </div>
      </div>

      <div className="absolute -bottom-20 left-[18%] flex min-w-[360px] items-center gap-4 rounded-xl border border-[#E8E5DF] bg-white px-5 py-4 shadow-[0_16px_44px_rgba(15,23,42,0.12)] max-lg:hidden">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#EAF8F5] text-[#079B8E]">
          <ShieldCheck size={38} />
        </div>
        <div className="min-w-0">
          <p className="font-bold">PrivacyLens Active</p>
          <p className="mt-1 flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-[#079B8E]" />
            Scanning all messages
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs">
            <CheckCircle2 size={14} className="text-[#079B8E]" />
            0 items leaked
          </p>
        </div>
        <Settings className="ml-auto text-[#64748B]" size={18} />
      </div>

      <div className="absolute -right-3 top-[76px] hidden h-20 w-20 rounded-full border-r-2 border-t-2 border-dashed border-[#079B8E] lg:block" />
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FDFCFB] text-[#111827]">
      <section className="landing-grid relative mx-auto grid min-h-screen w-full max-w-[1500px] items-start gap-12 px-11 py-11 max-lg:px-6 max-sm:px-4">
        <div className="landing-copy z-10 w-full min-w-0 max-w-[620px] max-xl:max-w-[760px]">
          <Logo />

          <div className="mt-14 inline-flex items-center gap-2 rounded-full border border-[#D7EEE9] bg-[#EFFAF8] px-4 py-2 text-sm font-semibold text-[#078C7D] max-lg:mt-8">
            <Lock size={15} />
            Your data. Your privacy. Always.
          </div>

          <h1 className="mt-7 text-[52px] font-bold leading-[1.08] tracking-[-0.04em] text-[#101827] max-lg:text-5xl max-sm:text-[38px]">
            AI chats.
            <br />
            Zero oversharing.
            <br />
            <span className="text-[#079B8E]">Total peace of mind.</span>
          </h1>

          <p className="mt-7 max-w-[520px] text-[18px] leading-8 text-[#354154]">
            PrivacyLens scans every message before it leaves your browser, detects sensitive
            information, and helps you redact it - so you can use AI with confidence.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-8 max-sm:grid-cols-1">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title}>
                  <Icon className="mb-3 text-[#079B8E]" size={31} />
                  <p className="text-sm font-bold">{feature.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[#4D5B6C]">{feature.text}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-6">
            <a
              href="/install"
              className="inline-flex h-13 items-center gap-3 rounded-lg bg-[#079B8E] px-7 py-4 text-base font-bold text-white shadow-[0_16px_34px_rgba(7,155,142,0.24)] transition hover:bg-[#067F75]"
            >
              Protect Your Privacy for Free
              <ArrowRight size={20} />
            </a>
            <a href="#how-it-works" className="inline-flex items-center gap-3 text-sm font-semibold text-[#079B8E]">
              See how it works
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#B9E5DD] bg-[#F1FBF9]">
                <Play size={14} fill="currentColor" />
              </span>
            </a>
          </div>

          <div className="mt-9 flex max-w-[500px] items-center gap-5 rounded-xl border border-[#D7EEE9] bg-[#F3FBF9] px-5 py-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-[#101827]">
              <Bot size={35} />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md bg-[#EAF8F5] text-[#079B8E]">
                <Lock size={13} />
              </span>
            </div>
            <p className="text-sm leading-6 text-[#263244]">
              Powered by <span className="font-bold text-[#079B8E]">OpenAI&apos;s open source</span>{" "}
              privacy filter model. Runs locally in your browser - nothing is sent to any server. Ever.
            </p>
          </div>
        </div>

        <div className="relative min-w-0 pb-24 pt-4 max-xl:w-full max-lg:hidden">
          <BrowserMock />
        </div>
      </section>

      <section id="how-it-works" className="mx-auto flex max-w-[760px] items-center justify-center gap-3 px-6 pb-9 text-center text-lg text-[#354154]">
        <ShieldCheck className="shrink-0 text-[#079B8E]" size={24} />
        <p>
          Privacy made <span className="font-bold text-[#079B8E]">effortless.</span> Security without slowing you down.
        </p>
      </section>
    </div>
  );
}
