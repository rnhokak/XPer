import type { ImportOrderRow } from '@/lib/api/trading'

/**
 * Parses raw CSV/TSV text into an array of string arrays (RFC 4180 compliant)
 */
export function parseRawCsv(text: string): string[][] {
  // Remove UTF-8 BOM if present
  const cleanText = text.replace(/^\uFEFF/, '')
  if (!cleanText.trim()) return []

  // Detect delimiter: check first non-empty line
  const firstLine = cleanText.split(/\r\n|\n|\r/)[0] || ''
  let delimiter = ','
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const tabCount = (firstLine.match(/\t/g) || []).length

  if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t'
  } else if (semicolonCount > commaCount) {
    delimiter = ';'
  }

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < cleanText.length) {
    const char = cleanText[i]
    const nextChar = cleanText[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      } else if (char === delimiter) {
        currentRow.push(currentField.trim())
        currentField = ''
        i++
        continue
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField.trim())
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i += 2
        continue
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentField.trim())
        rows.push(currentRow)
        currentRow = []
        currentField = ''
        i++
        continue
      } else {
        currentField += char
        i++
        continue
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    rows.push(currentRow)
  }

  return rows.filter((r) => r.some((cell) => cell.length > 0))
}

/**
 * Parses flexible number formats (e.g. 1,234.56 or 1234,56 or ($12.50))
 */
export function parseNumberField(val?: string | null): number | undefined {
  if (!val) return undefined
  let s = val.trim()
  if (!s || s === '-' || s === '—') return undefined

  // Remove currency symbols & spaces
  s = s.replace(/[$€£₫¥\s]/g, '')

  // Handle (12.5) as negative -12.5
  if (s.startsWith('(') && s.endsWith(')')) {
    s = '-' + s.slice(1, -1)
  }

  // Handle European 1.234,56 vs Standard 1,234.56
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 1.234,56 -> 1234.56
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56 -> 1234.56
      s = s.replace(/,/g, '')
    }
  } else if (s.includes(',')) {
    // Only comma: could be 1,5 or 1,000
    // If multiple commas or followed by 3 digits at end, might be thousand separator
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, '')
    } else {
      s = s.replace(',', '.')
    }
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Normalizes date strings from MT4/MT5 (e.g. 2024.12.31 15:30:00) or ISO or standard formats
 */
export function parseDateField(val?: string | null): string | undefined {
  if (!val) return undefined
  let s = val.trim()
  if (!s) return undefined

  // Replace dots in YYYY.MM.DD with dashes YYYY-MM-DD
  if (/^\d{4}\.\d{2}\.\d{2}/.test(s)) {
    s = s.replace(/^(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3')
  }

  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return d.toISOString()
  }

  // Try parsing DD/MM/YYYY or DD-MM-YYYY
  const parts = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(.*)$/)
  if (parts) {
    const [, day, month, year, rest] = parts
    const tryDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}${rest}`)
    if (!isNaN(tryDate.getTime())) {
      return tryDate.toISOString()
    }
  }

  return undefined
}

export type ParseOrderCsvResult = {
  validOrders: ImportOrderRow[]
  errors: Array<{
    rowNumber: number
    message: string
    raw?: Record<string, string>
  }>
  totalRows: number
}

/**
 * Normalizes column header name to a standard key
 */
function normalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Parses and maps CSV data into ImportOrderRow objects.
 */
export function parseTradingOrdersCsv(
  csvText: string,
  balanceAccountId: string
): ParseOrderCsvResult {
  const rawRows = parseRawCsv(csvText)
  const validOrders: ImportOrderRow[] = []
  const errors: ParseOrderCsvResult['errors'] = []

  if (rawRows.length === 0) {
    return { validOrders, errors, totalRows: 0 }
  }

  // Find header row: row containing at least 2 common trading column terms
  let headerIndex = -1
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const rowNorm = rawRows[i].map(normalizeHeaderName)
    const matches = rowNorm.filter((h) =>
      [
        'ticket',
        'position',
        'symbol',
        'item',
        'type',
        'side',
        'volume',
        'size',
        'lots',
        'price',
        'opentime',
        'openingtime',
        'openingtimeutc',
        'openingprice',
        'openprice',
        'time',
      ].includes(h)
    )
    if (matches.length >= 2) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    return {
      validOrders: [],
      errors: [
        {
          rowNumber: 1,
          message: 'Không tìm thấy dòng tiêu đề hợp lệ (cần chứa các cột như Ticket, Symbol/Item, Type/Side, Volume/Size/Lots, Price).',
        },
      ],
      totalRows: rawRows.length,
    }
  }

  const rawHeaders = rawRows[headerIndex]
  const headers = rawHeaders.map(normalizeHeaderName)

  // Map header index to target field
  // Note: MT4/MT5 often have duplicate header names like "Time" (Open Time vs Close Time) and "Price" (Open Price vs Close Price)
  let seenTime = 0
  let seenPrice = 0

  const fieldIndexes: {
    ticket?: number
    symbol?: number
    side?: number
    entry_price?: number
    volume?: number
    open_time?: number
    sl_price?: number
    tp_price?: number
    close_time?: number
    close_price?: number
    commission_usd?: number
    swap_usd?: number
    pnl_amount?: number
    status?: number
    note?: number
    original_position_size?: number
    leverage?: number
    equity_usd?: number
    margin_level?: number
    close_reason?: number
  } = {}

  headers.forEach((h, idx) => {
    if (['ticket', 'position', 'deal', 'orderid', 'ticketid', 'id'].includes(h)) {
      if (fieldIndexes.ticket === undefined) fieldIndexes.ticket = idx
    } else if (['symbol', 'item', 'pair', 'asset', 'ticker', 'instrument'].includes(h)) {
      if (fieldIndexes.symbol === undefined) fieldIndexes.symbol = idx
    } else if (['type', 'side', 'cmd', 'action', 'direction'].includes(h)) {
      if (fieldIndexes.side === undefined) fieldIndexes.side = idx
    } else if (['volume', 'size', 'lots', 'amount', 'qty', 'quantity'].includes(h)) {
      if (fieldIndexes.volume === undefined) fieldIndexes.volume = idx
    } else if (['originalpositionsize', 'origpositionsize', 'origposition', 'originalsize', 'positionsize'].includes(h)) {
      if (fieldIndexes.original_position_size === undefined) fieldIndexes.original_position_size = idx
    } else if (['opentime', 'opentimegmt', 'opentimeutc', 'openingtime', 'openingtimeutc', 'opentimestamp'].includes(h)) {
      fieldIndexes.open_time = idx
    } else if (['closetime', 'closetimegmt', 'closetimeutc', 'closingtime', 'closingtimeutc', 'closetimestamp'].includes(h)) {
      fieldIndexes.close_time = idx
    } else if (['time', 'date', 'datetime'].includes(h)) {
      if (seenTime === 0) {
        fieldIndexes.open_time = idx
        seenTime++
      } else if (seenTime === 1) {
        fieldIndexes.close_time = idx
        seenTime++
      }
    } else if (['openprice', 'entryprice', 'openingprice'].includes(h)) {
      fieldIndexes.entry_price = idx
    } else if (['closeprice', 'exitprice', 'closingprice'].includes(h)) {
      fieldIndexes.close_price = idx
    } else if (['price'].includes(h)) {
      if (seenPrice === 0) {
        fieldIndexes.entry_price = idx
        seenPrice++
      } else if (seenPrice === 1) {
        fieldIndexes.close_price = idx
        seenPrice++
      }
    } else if (['sl', 'stoploss', 'stop_loss'].includes(h)) {
      fieldIndexes.sl_price = idx
    } else if (['tp', 'takeprofit', 'take_profit'].includes(h)) {
      fieldIndexes.tp_price = idx
    } else if (['commission', 'comm', 'fee', 'fees', 'commissionusd'].includes(h)) {
      fieldIndexes.commission_usd = idx
    } else if (['swap', 'swapusd', 'rollover', 'financing'].includes(h)) {
      fieldIndexes.swap_usd = idx
    } else if (['profit', 'pnl', 'netpnl', 'netprofit', 'pnlusd', 'pnlamount'].includes(h)) {
      fieldIndexes.pnl_amount = idx
    } else if (['status', 'state'].includes(h)) {
      fieldIndexes.status = idx
    } else if (['comment', 'comments', 'note', 'memo', 'description'].includes(h)) {
      fieldIndexes.note = idx
    } else if (['leverage'].includes(h)) {
      fieldIndexes.leverage = idx
    } else if (['equity', 'equityusd'].includes(h)) {
      fieldIndexes.equity_usd = idx
    } else if (['marginlevel', 'margin_level'].includes(h)) {
      fieldIndexes.margin_level = idx
    } else if (['closereason', 'reason', 'close_reason'].includes(h)) {
      fieldIndexes.close_reason = idx
    }
  })

  // Validate that minimum necessary fields exist in header
  if (fieldIndexes.symbol === undefined) {
    return {
      validOrders: [],
      errors: [
        {
          rowNumber: headerIndex + 1,
          message: 'Không tìm thấy cột Symbol (hoặc Item/Pair) trong file CSV.',
        },
      ],
      totalRows: rawRows.length,
    }
  }

  const dataRows = rawRows.slice(headerIndex + 1)

  dataRows.forEach((row, dataIdx) => {
    const rowNumber = headerIndex + 2 + dataIdx

    // Skip empty lines or MT4 summary rows (e.g. Total Net Profit, Balance, etc.)
    const firstCell = (row[0] || '').toLowerCase()
    if (
      firstCell.startsWith('total') ||
      firstCell.startsWith('balance') ||
      firstCell.startsWith('summary') ||
      row.every((c) => !c.trim())
    ) {
      return
    }

    const rawObj: Record<string, string> = {}
    rawHeaders.forEach((h, i) => {
      rawObj[h] = row[i] || ''
    })

    const symbolRaw = fieldIndexes.symbol !== undefined ? row[fieldIndexes.symbol]?.trim() : ''
    if (!symbolRaw) {
      // If symbol is blank, skip without error if it's an empty or summary line
      return
    }

    // Side: buy or sell
    const sideRaw = fieldIndexes.side !== undefined ? row[fieldIndexes.side]?.trim().toLowerCase() : ''
    let side: 'buy' | 'sell' = 'buy'
    if (sideRaw === 'buy' || sideRaw === '0') {
      side = 'buy'
    } else if (sideRaw === 'sell' || sideRaw === '1') {
      side = 'sell'
    } else if (sideRaw.includes('buy')) {
      side = 'buy'
    } else if (sideRaw.includes('sell')) {
      side = 'sell'
    } else {
      errors.push({
        rowNumber,
        message: `Loại lệnh không hợp lệ: "${sideRaw}". Cần là "buy" hoặc "sell".`,
        raw: rawObj,
      })
      return
    }

    // Entry Price
    const entryPrice = fieldIndexes.entry_price !== undefined ? parseNumberField(row[fieldIndexes.entry_price]) : undefined
    if (entryPrice === undefined || entryPrice <= 0) {
      errors.push({
        rowNumber,
        message: `Giá vào lệnh (Entry Price) không hợp lệ ở dòng ${rowNumber}.`,
        raw: rawObj,
      })
      return
    }

    // Volume
    const volume = fieldIndexes.volume !== undefined ? parseNumberField(row[fieldIndexes.volume]) : undefined
    if (volume === undefined || volume <= 0) {
      errors.push({
        rowNumber,
        message: `Khối lượng (Volume / Size) không hợp lệ ở dòng ${rowNumber}.`,
        raw: rawObj,
      })
      return
    }

    // Open Time
    let openTime = fieldIndexes.open_time !== undefined ? parseDateField(row[fieldIndexes.open_time]) : undefined
    if (!openTime) {
      openTime = new Date().toISOString()
    }

    // Optional fields
    const ticket = fieldIndexes.ticket !== undefined ? row[fieldIndexes.ticket]?.trim() || null : null
    const slPrice = fieldIndexes.sl_price !== undefined ? parseNumberField(row[fieldIndexes.sl_price]) : null
    const tpPrice = fieldIndexes.tp_price !== undefined ? parseNumberField(row[fieldIndexes.tp_price]) : null
    const closeTime = fieldIndexes.close_time !== undefined ? parseDateField(row[fieldIndexes.close_time]) : null
    const closePrice = fieldIndexes.close_price !== undefined ? parseNumberField(row[fieldIndexes.close_price]) : null
    const commissionUsd = fieldIndexes.commission_usd !== undefined ? parseNumberField(row[fieldIndexes.commission_usd]) : null
    const swapUsd = fieldIndexes.swap_usd !== undefined ? parseNumberField(row[fieldIndexes.swap_usd]) : null
    const pnlAmount = fieldIndexes.pnl_amount !== undefined ? parseNumberField(row[fieldIndexes.pnl_amount]) : null
    const note = fieldIndexes.note !== undefined ? row[fieldIndexes.note]?.trim() || null : null
    const leverage = fieldIndexes.leverage !== undefined ? Math.round(parseNumberField(row[fieldIndexes.leverage]) || 0) || null : null
    const originalPositionSize = fieldIndexes.original_position_size !== undefined ? parseNumberField(row[fieldIndexes.original_position_size]) : null
    const equityUsd = fieldIndexes.equity_usd !== undefined ? parseNumberField(row[fieldIndexes.equity_usd]) : null
    const marginLevel = fieldIndexes.margin_level !== undefined ? parseNumberField(row[fieldIndexes.margin_level]) : null
    const closeReason = fieldIndexes.close_reason !== undefined ? row[fieldIndexes.close_reason]?.trim() || null : null

    // Determine status
    let status: 'open' | 'closed' | 'cancelled' = 'open'
    if (fieldIndexes.status !== undefined && row[fieldIndexes.status]) {
      const st = row[fieldIndexes.status].trim().toLowerCase()
      if (['open', 'closed', 'cancelled'].includes(st)) {
        status = st as 'open' | 'closed' | 'cancelled'
      } else if (closePrice !== null || closeTime !== null || pnlAmount !== null) {
        status = 'closed'
      }
    } else if (closePrice !== null || closeTime !== null || pnlAmount !== null) {
      status = 'closed'
    }

    validOrders.push({
      ticket,
      symbol: symbolRaw.toUpperCase(),
      side,
      entry_price: entryPrice,
      volume,
      open_time: openTime,
      sl_price: slPrice ?? null,
      tp_price: tpPrice ?? null,
      status,
      close_time: closeTime ?? null,
      close_price: closePrice ?? null,
      commission_usd: commissionUsd ?? null,
      swap_usd: swapUsd ?? null,
      pnl_amount: pnlAmount ?? null,
      pnl_percent: null,
      note,
      leverage,
      original_position_size: originalPositionSize ?? null,
      equity_usd: equityUsd ?? null,
      margin_level: marginLevel ?? null,
      close_reason: closeReason ?? null,
      balance_account_id: balanceAccountId,
    })
  })

  return {
    validOrders,
    errors,
    totalRows: dataRows.length,
  }
}

/**
 * Generates sample CSV template content with standard headers and sample data
 */
export function generateTradingCsvTemplate(): string {
  const headers = [
    'ticket',
    'opening_time_utc',
    'closing_time_utc',
    'type',
    'lots',
    'original_position_size',
    'symbol',
    'opening_price',
    'closing_price',
    'stop_loss',
    'take_profit',
    'commission',
    'swap',
    'profit',
    'equity',
    'margin_level',
    'close_reason',
  ]

  const rows = [
    [
      '2258108180',
      '2026-09-03T09:29:11',
      '2026-09-03T09:29:25',
      'sell',
      '0.03',
      '0.03',
      'XAUUSD',
      '4434.48',
      '4435.881',
      '',
      '',
      '-0.33',
      '',
      '-4.2',
      '-0.08',
      '',
      'so',
    ],
    [
      '2258103584',
      '2026-09-03T09:24:42',
      '2026-09-03T09:25:16',
      'buy',
      '0.03',
      '0.03',
      'XAUUSD',
      '4433.332',
      '4432.259',
      '4432.259',
      '',
      '-0.33',
      '',
      '-3.22',
      '',
      '',
      'sl',
    ],
    [
      '2258101046',
      '2026-09-03T09:22:09',
      '2026-09-03T09:23:19',
      'buy',
      '0.03',
      '0.03',
      'XAUUSD',
      '4434.47',
      '4433.397',
      '4433.397',
      '',
      '-0.33',
      '',
      '-3.22',
      '',
      '',
      'sl',
    ],
    [
      '2258050611',
      '2026-09-03T08:33:30',
      '2026-09-03T08:33:58',
      'sell',
      '0.03',
      '0.03',
      'XAUUSD',
      '4437.584',
      '4438.595',
      '',
      '',
      '-0.33',
      '',
      '-3.04',
      '-0.23',
      '',
      'so',
    ],
  ]

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

