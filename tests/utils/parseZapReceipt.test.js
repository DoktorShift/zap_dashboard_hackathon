import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock fns so they're available inside vi.mock factories.
const { mockCoreParseZapReceipt, mockCoreValidateZapReceipt, mockBolt11Decode } = vi.hoisted(() => ({
  mockCoreParseZapReceipt: vi.fn(),
  mockCoreValidateZapReceipt: vi.fn(),
  mockBolt11Decode: vi.fn(),
}))

vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  parseZapReceipt: mockCoreParseZapReceipt,
  validateZapReceipt: mockCoreValidateZapReceipt,
  bolt11: { decode: mockBolt11Decode },
}))

import { parseZapReceipt, validateZapReceipt } from '../../src/utils/zaps/parseZapReceipt.js'

// ── Helpers ──────────────────────────────────────────────────────

function makeZapEvent(overrides = {}) {
  return {
    id: 'event123',
    kind: 9735,
    pubkey: 'relay_pubkey_hex',
    created_at: 1700000000,
    tags: [],
    content: '',
    sig: 'sig_hex',
    ...overrides,
  }
}

/**
 * Build a zap event with an embedded, verifiable zap request in the
 * `description` tag plus a matching bolt11 (via the mocked decoder).
 */
function makeVerifiedZapEvent({
  senderPubkey = 'sender_abc',
  recipientPubkey = 'recipient_def',
  requestAmountMsat = 21000000,
  invoiceAmountMsat = 21000000,
  paymentHash = 'hash_xyz',
  bolt11 = 'lnbc21u1xxxxx',
  content = 'nice zap',
  extraRequestTags = [],
  extraEventTags = [],
  eventOverrides = {},
} = {}) {
  const zapRequest = {
    pubkey: senderPubkey,
    content,
    tags: [
      ['p', recipientPubkey],
      ['amount', String(requestAmountMsat)],
      ...extraRequestTags,
    ],
  }
  mockBolt11Decode.mockReturnValue({
    amountMsat: invoiceAmountMsat,
    paymentHash,
  })
  return makeZapEvent({
    tags: [
      ['p', recipientPubkey],
      ['bolt11', bolt11],
      ['description', JSON.stringify(zapRequest)],
      ...extraEventTags,
    ],
    ...eventOverrides,
  })
}

// ── parseZapReceipt ──────────────────────────────────────────────

describe('parseZapReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when coreParseZapReceipt returns null', () => {
    mockCoreParseZapReceipt.mockReturnValue(null)
    expect(parseZapReceipt(makeZapEvent())).toBeNull()
  })

  it('returns null when description tag is missing (cannot verify)', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender', recipientPubkey: 'r', eventId: null,
      amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    mockBolt11Decode.mockReturnValue({ amountMsat: 21000000, paymentHash: 'h' })
    expect(parseZapReceipt(makeZapEvent({ tags: [['bolt11', 'lnbc21u1xxx']] }))).toBeNull()
  })

  it('returns null when description is not valid JSON', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 's', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    mockBolt11Decode.mockReturnValue({ amountMsat: 21000000, paymentHash: 'h' })
    const event = makeZapEvent({ tags: [['description', 'not{json']] })
    expect(parseZapReceipt(event)).toBeNull()
  })

  it('returns null when bolt11 amount does not match zap request amount (forgery guard)', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent({
      requestAmountMsat: 21000000,
      invoiceAmountMsat: 100000000, // forged — bolt11 claims 100k sats, request says 21
    })
    expect(parseZapReceipt(event)).toBeNull()
  })

  it('returns null when bolt11 is unparsable (cannot verify)', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 's', eventId: null, amount: 21000000, bolt11: 'bad-invoice',
    })
    mockBolt11Decode.mockImplementation(() => { throw new Error('bad bolt11') })
    const zapRequest = { pubkey: 's', content: '', tags: [['p', 'r'], ['amount', '21000000']] }
    const event = makeZapEvent({
      tags: [['p', 'r'], ['bolt11', 'bad-invoice'], ['description', JSON.stringify(zapRequest)]],
    })
    expect(parseZapReceipt(event)).toBeNull()
  })

  it('returns null when recipient p-tag on receipt differs from zap request p-tag', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent({
      recipientPubkey: 'alice',
      eventOverrides: {
        tags: [
          ['p', 'bob'], // different from the 'alice' recipient in the request
          ['bolt11', 'lnbc21u1xxx'],
          ['description', JSON.stringify({
            pubkey: 'sender',
            content: '',
            tags: [['p', 'alice'], ['amount', '21000000']],
          })],
        ],
      },
    })
    expect(parseZapReceipt(event)).toBeNull()
  })

  it('parses a verified zap and converts msats to sats', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender_abc', recipientPubkey: 'recipient_def',
      eventId: 'zapped_event_id', amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent({
      senderPubkey: 'sender_abc',
      recipientPubkey: 'recipient_def',
    })
    const result = parseZapReceipt(event)
    expect(result).not.toBeNull()
    expect(result.amount).toBe(21000)
    expect(result.zapperPubkey).toBe('sender_abc')
    expect(result.zappedEventId).toBe('zapped_event_id')
  })

  it('uses payment hash as dedup id when bolt11 is verifiable', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender_abc', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent({ paymentHash: 'payment_hash_xyz' })
    const result = parseZapReceipt(event)
    expect(result.id).toBe('payment_hash_xyz')
  })

  it('falls back to event id when bolt11 is absent (still requires description)', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender_abc', eventId: null, amount: 21000000, bolt11: null,
    })
    const zapRequest = {
      pubkey: 'sender_abc',
      content: 'Thanks!',
      tags: [['p', 'rec'], ['amount', '21000000']],
    }
    const event = makeZapEvent({
      id: 'event_fallback_id',
      tags: [['p', 'rec'], ['description', JSON.stringify(zapRequest)]],
    })
    const result = parseZapReceipt(event)
    expect(result).not.toBeNull()
    expect(result.id).toBe('event_fallback_id')
  })

  it('tolerates missing amount tag in the zap request (trusts bolt11)', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    mockBolt11Decode.mockReturnValue({ amountMsat: 21000000, paymentHash: 'h' })
    const zapRequest = { pubkey: 'sender', content: '', tags: [['p', 'r']] } // no amount tag
    const event = makeZapEvent({
      tags: [['p', 'r'], ['bolt11', 'lnbc21u1xxx'], ['description', JSON.stringify(zapRequest)]],
    })
    const result = parseZapReceipt(event)
    expect(result).not.toBeNull()
    expect(result.amount).toBe(21000)
  })

  it('extracts goal tag from event tags', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent({
      extraEventTags: [['goal', 'goal_event_id_abc']],
    })
    const result = parseZapReceipt(event)
    expect(result.goalTag).toBe('goal_event_id_abc')
  })

  it('falls back to goal tag in zap request description when not on receipt', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent({
      extraRequestTags: [['goal', 'goal_from_request']],
      content: 'Great work!',
    })
    const result = parseZapReceipt(event)
    expect(result.goalTag).toBe('goal_from_request')
    expect(result.message).toBe('Great work!')
  })

  it('prefers event-tag goal over description-embedded goal', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent({
      extraRequestTags: [['goal', 'goal_from_request']],
      extraEventTags: [['goal', 'goal_from_event']],
    })
    const result = parseZapReceipt(event)
    expect(result.goalTag).toBe('goal_from_event')
  })

  it('extracts message from zap request content', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent({ content: 'Thanks for the awesome content!' })
    const result = parseZapReceipt(event)
    expect(result.message).toBe('Thanks for the awesome content!')
  })

  it('converts created_at to ISO timestamp', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent({ eventOverrides: { created_at: 1700000000 } })
    const result = parseZapReceipt(event)
    expect(result.timestamp).toBe(new Date(1700000000 * 1000).toISOString())
  })

  it('includes raw event reference', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender', eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent()
    const result = parseZapReceipt(event)
    expect(result.rawZapEvent).toBe(event)
  })

  it('falls back to zap request pubkey, then event pubkey, when senderPubkey is missing', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: null, eventId: null, amount: 21000000, bolt11: 'lnbc21u1xxx',
    })
    const event = makeVerifiedZapEvent({
      senderPubkey: 'request_sender',
      eventOverrides: { pubkey: 'relay_pubkey_fallback' },
    })
    const result = parseZapReceipt(event)
    // zap request.pubkey wins when sender is missing
    expect(result.zapperPubkey).toBe('request_sender')
  })

  it('returns null when coreParseZapReceipt throws', () => {
    mockCoreParseZapReceipt.mockImplementation(() => { throw new Error('Parse error') })
    expect(parseZapReceipt(makeZapEvent())).toBeNull()
  })
})

// ── validateZapReceipt ───────────────────────────────────────────

describe('validateZapReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to nostr-core validateZapReceipt', () => {
    mockCoreValidateZapReceipt.mockReturnValue(true)
    const ok = validateZapReceipt({ kind: 9735 }, { kind: 9734 })
    expect(ok).toBe(true)
    expect(mockCoreValidateZapReceipt).toHaveBeenCalled()
  })

  it('returns false when nostr-core throws', () => {
    mockCoreValidateZapReceipt.mockImplementation(() => { throw new Error('boom') })
    expect(validateZapReceipt({}, {})).toBe(false)
  })
})
