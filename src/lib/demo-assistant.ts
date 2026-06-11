// Local, deterministic assistant used when no Claude API key / backend is
// available (keyless server or fully static deploys). Replies are clearly
// labeled "demo" in the UI so they are never mistaken for a live model.

export interface DemoChatMessage {
  role: "user" | "assistant";
  content: string;
}

const REDACTION_TOKEN =
  /\[(NAME|EMAIL|PHONE|ADDRESS|DATE|URL|ACCOUNT|SECRET|EMPLOYEE ID|SSN|CREDIT CARD)\]/i;
const REDACTION_TOKEN_ALL = new RegExp(REDACTION_TOKEN.source, "gi");

function countRedactions(text: string): number {
  const matches = text.match(REDACTION_TOKEN_ALL);
  return matches ? matches.length : 0;
}

export function generateDemoReply(messages: DemoChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content ?? "";
  const lower = text.toLowerCase();
  const redactions = countRedactions(text);

  const privacyNote = REDACTION_TOKEN.test(text)
    ? `I can see you've redacted ${redactions} personal detail${redactions === 1 ? "" : "s"} before sending - nice. I can still help fully without them.\n\n`
    : "";

  if (lower.includes("[attached") && lower.includes("resume")) {
    return (
      privacyNote +
      "Here's quick feedback on the resume:\n\n" +
      "1. Strong points - clear chronology, quantified achievements, and relevant coursework stand out.\n" +
      "2. Tighten the summary - lead with the strongest skill and the outcome you drive, in one sentence.\n" +
      "3. Add impact metrics - where possible, attach numbers to each bullet (users served, latency cut, revenue influenced).\n" +
      "4. Formatting - keep it to one page and use consistent tense across bullets.\n\n" +
      "Want me to rewrite the summary section or tailor it for a specific role?"
    );
  }

  if (lower.includes("invoice")) {
    return (
      privacyNote +
      "I've looked over the invoice content. A few observations:\n\n" +
      "- Verify the line items match the agreed scope and rates before paying.\n" +
      "- Check the due date and whether late fees apply.\n" +
      "- Confirm the payment details through a channel you trust - never from the document alone.\n\n" +
      "I can draft a payment confirmation email or a dispute note if something looks off."
    );
  }

  if (lower.includes("medical") || lower.includes("patient") || lower.includes("intake")) {
    return (
      privacyNote +
      "Thanks for sharing the intake details. A few general suggestions:\n\n" +
      "- Bring a current medication list and any recent lab results to the appointment.\n" +
      "- Write down symptoms with dates so nothing gets missed.\n" +
      "- Ask the clinic how they store and share your records.\n\n" +
      "Note: I can help organize information, but for medical advice please consult a clinician."
    );
  }

  if (lower.includes("hr") || lower.includes("salary") || lower.includes("employee")) {
    return (
      privacyNote +
      "Here's a concise way to handle this HR thread:\n\n" +
      "1. Summary - acknowledge receipt and confirm the effective dates mentioned.\n" +
      "2. Action - ask HR to confirm the changes in writing through the official portal.\n" +
      "3. Caution - compensation and ID numbers should only ever go through internal systems, not chat tools.\n\n" +
      "Want me to draft that reply email for you?"
    );
  }

  if (lower.includes("business card") || lower.includes("registration")) {
    return (
      privacyNote +
      "I've reviewed the extracted text. If you're saving this contact, I'd suggest recording only the role, company, and a work contact method - personal numbers and home addresses rarely need to be stored.\n\n" +
      "I can format it as a vCard entry or a CRM note if that helps."
    );
  }

  if (lower.includes("contract") || lower.includes("agreement")) {
    return (
      privacyNote +
      "Happy to help review the agreement. Key things I'd check first:\n\n" +
      "- Parties and term - who is bound, for how long, and how renewal works.\n" +
      "- Payment and penalties - amounts, due dates, and what happens on late payment.\n" +
      "- Termination - notice period and any exit fees.\n" +
      "- Liability and confidentiality clauses.\n\n" +
      "Paste the clause you're unsure about and I'll explain it in plain language."
    );
  }

  if (/^(hi|hey|hello|yo|sup)[\s!.,]*$/i.test(text.trim())) {
    return (
      "Hello! I'm the PrivacyLens demo assistant. Try sending a message that contains personal details - an email, a phone number, or an SSN-style number - and watch PrivacyLens catch it before anything is sent.\n\n" +
      "You can also drop in one of the sample files to see PDF and image scanning with visual redaction."
    );
  }

  if (lower.includes("privacylens") || (lower.includes("how") && lower.includes("work"))) {
    return (
      "PrivacyLens scans everything you type or attach - locally, before it is sent anywhere. Detected personal data hard-blocks the send button until you review it. You choose what gets redacted and what stays.\n\n" +
      "This reply comes from the built-in demo assistant; connect an Anthropic API key to chat with Claude for real."
    );
  }

  const firstSentence = text
    .replace(/\[attached[^\]]*\]/gi, "")
    .replace(/^\s*(hi|hey|hello)[!,.\s]+/i, "")
    .trim()
    .split(/(?<=[.?!])\s/)[0]
    ?.slice(0, 140);

  // Echoing a redacted message back reads poorly; the privacy note already
  // acknowledges it, so only quote the topic for unredacted prose.
  const topicLine =
    !privacyNote &&
    firstSentence &&
    firstSentence.replace(REDACTION_TOKEN_ALL, "").trim().length > 15
      ? `Got it - you're asking about: "${firstSentence}"\n\n`
      : "";

  return (
    privacyNote +
    topicLine +
    "Here's how I'd approach it:\n\n" +
    "1. Clarify the goal - what outcome would make this a win for you?\n" +
    "2. List the constraints - timing, budget, or people involved.\n" +
    "3. Take the smallest next step - usually a short message or a checklist.\n\n" +
    "Share a bit more detail and I'll get specific."
  );
}
