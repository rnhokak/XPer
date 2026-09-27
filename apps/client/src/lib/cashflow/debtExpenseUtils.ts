export type DebtExpenseMode = 'none' | 'borrowed_spent' | 'lent_spent';

export interface DebtExpenseMeta {
  mode: DebtExpenseMode;
  partnerName: string | null;
  isSettled: boolean;
  cleanNote: string;
  tagLabel: string | null;
}

const BORROWED_REGEX = /\[(?:Chi từ tiền vay|Vay chi tiêu|Chi vay|Chi nợ|Chi ghi nợ|Ghi nợ|Vay nợ):\s*([^\]]+)\]/i;
const LENT_REGEX = /\[(?:Mua hộ|Chi cho vay|Cho vay|Chi hộ|Cho mượn):\s*([^\]]+)\]/i;
const SETTLED_REGEX = /\[(?:Đã trả lại|Đã thu lại|Đã thanh toán|Đã xong|Đã hoàn thành)\]/i;

/**
 * Parses note text to extract debt expense metadata.
 */
export function parseDebtExpenseMeta(note?: string | null): DebtExpenseMeta {
  if (!note || typeof note !== 'string') {
    return {
      mode: 'none',
      partnerName: null,
      isSettled: false,
      cleanNote: '',
      tagLabel: null,
    };
  }

  const borrowedMatch = note.match(BORROWED_REGEX);
  const lentMatch = note.match(LENT_REGEX);
  const isSettled = SETTLED_REGEX.test(note);

  let mode: DebtExpenseMode = 'none';
  let partnerName: string | null = null;
  let tagLabel: string | null = null;

  if (borrowedMatch) {
    mode = 'borrowed_spent';
    partnerName = borrowedMatch[1].trim();
    tagLabel = `Chi nợ (${partnerName})`;
  } else if (lentMatch) {
    mode = 'lent_spent';
    partnerName = lentMatch[1].trim();
    tagLabel = `Chi cho vay (${partnerName})`;
  }

  // Clean note by removing bracketed metadata tags
  const cleanNote = note
    .replace(BORROWED_REGEX, '')
    .replace(LENT_REGEX, '')
    .replace(SETTLED_REGEX, '')
    .trim();

  return {
    mode,
    partnerName,
    isSettled,
    cleanNote,
    tagLabel,
  };
}

/**
 * Formats note text by injecting or updating debt expense tags.
 */
export function formatDebtExpenseNote(
  baseNote: string | null | undefined,
  mode: DebtExpenseMode,
  partnerName?: string | null,
  isSettled = false
): string {
  // Strip existing tags first
  let cleaned = (baseNote ?? '')
    .replace(BORROWED_REGEX, '')
    .replace(LENT_REGEX, '')
    .replace(SETTLED_REGEX, '')
    .trim();

  if (mode === 'none') {
    return cleaned;
  }

  const name = partnerName?.trim() || (mode === 'borrowed_spent' ? 'Người cho vay' : 'Người được mua hộ');

  let tag = '';
  if (mode === 'borrowed_spent') {
    tag = `[Chi từ tiền vay: ${name}]`;
    if (isSettled) {
      tag += ' [Đã trả lại]';
    }
  } else if (mode === 'lent_spent') {
    tag = `[Mua hộ: ${name}]`;
    if (isSettled) {
      tag += ' [Đã thu lại]';
    }
  }

  return cleaned ? `${cleaned} ${tag}` : tag;
}

/**
 * Toggles or marks the settled status in a debt expense note.
 */
export function toggleDebtExpenseSettled(note: string | null | undefined): string {
  const meta = parseDebtExpenseMeta(note);
  if (meta.mode === 'none') return note ?? '';

  const nextSettled = !meta.isSettled;
  return formatDebtExpenseNote(meta.cleanNote, meta.mode, meta.partnerName, nextSettled);
}

export interface DebtExpenseStats {
  borrowed: {
    total: number;
    settled: number;
    remaining: number;
    count: number;
    settledCount: number;
    pendingCount: number;
  };
  lent: {
    total: number;
    settled: number;
    remaining: number;
    count: number;
    settledCount: number;
    pendingCount: number;
  };
}

/**
 * Aggregates statistics for debt expenses from any list of transactions.
 */
export function computeDebtExpenseStats(
  transactions: Array<{ note?: string | null; amount: number; type: string }>
): DebtExpenseStats {
  const stats: DebtExpenseStats = {
    borrowed: { total: 0, settled: 0, remaining: 0, count: 0, settledCount: 0, pendingCount: 0 },
    lent: { total: 0, settled: 0, remaining: 0, count: 0, settledCount: 0, pendingCount: 0 },
  };

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const meta = parseDebtExpenseMeta(tx.note);
    if (meta.mode === 'none') continue;

    const amount = Number(tx.amount) || 0;

    if (meta.mode === 'borrowed_spent') {
      stats.borrowed.total += amount;
      stats.borrowed.count += 1;
      if (meta.isSettled) {
        stats.borrowed.settled += amount;
        stats.borrowed.settledCount += 1;
      } else {
        stats.borrowed.remaining += amount;
        stats.borrowed.pendingCount += 1;
      }
    } else if (meta.mode === 'lent_spent') {
      stats.lent.total += amount;
      stats.lent.count += 1;
      if (meta.isSettled) {
        stats.lent.settled += amount;
        stats.lent.settledCount += 1;
      } else {
        stats.lent.remaining += amount;
        stats.lent.pendingCount += 1;
      }
    }
  }

  return stats;
}
