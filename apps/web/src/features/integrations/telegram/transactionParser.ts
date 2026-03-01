export type TransactionIntent = {
  type: "expense" | "income";
  amount: number;
  description: string;
  note?: string | null;
  accountKeyword?: string | null;
  categoryKeyword?: string | null;
};

type ParseResult =
  | { success: true; intent: TransactionIntent }
  | { success: false; reason: string };

const directiveExtractor = (input: string, pattern: RegExp) => {
  const match = input.match(pattern);
  if (!match || typeof match.index !== "number") {
    return { next: input.trim(), value: undefined as string | undefined };
  }
  const before = input.slice(0, match.index).trim();
  return { next: before, value: match[1]?.trim() };
};

const amountFromToken = (token: string) => {
  const normalized = token.toLowerCase().replace(/,/g, "").trim();
  if (!/\d/.test(normalized)) return null;

  const suffixMatch = normalized.match(/(k|tr|trieu|triệu|m)$/);
  let multiplier = 1;
  let numericPart = normalized;
  if (suffixMatch) {
    const suffix = suffixMatch[1];
    numericPart = normalized.slice(0, -suffix.length);
    if (suffix === "k") multiplier = 1_000;
    if (suffix === "tr" || suffix === "trieu" || suffix === "triệu" || suffix === "m") multiplier = 1_000_000;
  } else {
    numericPart = numericPart.replace(/\./g, "");
  }

  const value = Number.parseFloat(numericPart);
  if (Number.isNaN(value) || value <= 0) {
    return null;
  }
  return Math.round(value * multiplier);
};

export const parseTransactionIntent = (input: string): ParseResult => {
  if (!input || !input.trim()) {
    return { success: false, reason: "Empty message" };
  }

  let working = input.trim();
  let note: string | undefined;
  let accountKeyword: string | undefined;
  let categoryKeyword: string | undefined;

  ({ next: working, value: note } = directiveExtractor(working, /(?:note|ghi chu|ghi chú)\s*:\s*(.+)$/i));
  ({ next: working, value: accountKeyword } = directiveExtractor(working, /(?:acc|account|vi|ví)\s*:\s*(.+)$/i));
  ({ next: working, value: categoryKeyword } = directiveExtractor(working, /(?:cat|cate|category|nhom|nhóm)\s*:\s*(.+)$/i));

  const tokens = working.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { success: false, reason: "Message too short" };
  }

  const typeToken = tokens.shift() as string;
  let type: "expense" | "income" | null = null;
  if (/^(chi|spend|-)/i.test(typeToken)) {
    type = "expense";
  } else if (/^(thu|nhan|income|\+)/i.test(typeToken)) {
    type = "income";
  }

  if (!type) {
    return { success: false, reason: "Missing thu/chi keyword" };
  }

  const amountIndex = tokens.findIndex((token) => /\d/.test(token));
  if (amountIndex === -1) {
    return { success: false, reason: "Missing amount" };
  }

  const amountToken = tokens.splice(amountIndex, 1)[0];
  const amount = amountFromToken(amountToken);
  if (!amount) {
    return { success: false, reason: "Invalid amount" };
  }

  const rawDescription = tokens.join(" ").trim();
  const description = rawDescription || (type === "expense" ? "Chi tiêu" : "Thu nhập");
  const finalNote = [rawDescription || null, note || null]
    .filter(Boolean)
    .join(" - ")
    .trim();

  return {
    success: true,
    intent: {
      type,
      amount,
      description,
      note: finalNote || null,
      accountKeyword: accountKeyword ?? null,
      categoryKeyword: categoryKeyword ?? null,
    },
  };
};
