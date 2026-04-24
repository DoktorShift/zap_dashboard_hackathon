import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SubscriptionBroker, canonicalFilterKey } from '../../src/services/nostr/SubscriptionBroker.js'

/**
 * SubscriptionBroker contract:
 * - Identical filters share ONE upstream sub.
 * - Real sub closed only when the LAST consumer releases.
 * - Late joiners get synthetic EOSE if the shared sub already EOSE'd.
 * - Backend's onevent fans out to every consumer's onevent.
 * - Consumer callbacks that throw don't break the broker.
 */

function makeBackend() {
  const opens = []
  const closes = []
  let idSeq = 0

  const backend = {
    subscribe: vi.fn((filters, callbacks, options) => {
      const id = ++idSeq
      const sub = {
        id,
        filters,
        callbacks,
        options,
        close: vi.fn(() => { closes.push(id) }),
      }
      opens.push(sub)
      return sub
    }),
  }
  return { backend, opens, closes }
}

describe('canonicalFilterKey', () => {
  it('produces the same key regardless of author order', () => {
    const a = canonicalFilterKey([{ kinds: [1], authors: ['a', 'b', 'c'] }])
    const b = canonicalFilterKey([{ kinds: [1], authors: ['c', 'a', 'b'] }])
    expect(a).toBe(b)
  })

  it('produces the same key regardless of filter order', () => {
    const f1 = { kinds: [1], authors: ['x'] }
    const f2 = { kinds: [7], '#e': ['id1'] }
    const a = canonicalFilterKey([f1, f2])
    const b = canonicalFilterKey([f2, f1])
    expect(a).toBe(b)
  })

  it('treats different filters as different keys', () => {
    const a = canonicalFilterKey([{ kinds: [1], authors: ['x'] }])
    const b = canonicalFilterKey([{ kinds: [1], authors: ['y'] }])
    expect(a).not.toBe(b)
  })

  it('returns null for non-array input', () => {
    expect(canonicalFilterKey(null)).toBe(null)
    expect(canonicalFilterKey('nope')).toBe(null)
  })
})

describe('SubscriptionBroker', () => {
  let broker, backend, opens, closes

  beforeEach(() => {
    ;({ backend, opens, closes } = makeBackend())
    broker = new SubscriptionBroker(backend)
  })

  it('opens only ONE upstream sub when two consumers request the same filters', () => {
    const filters = [{ kinds: [1], authors: ['alice'] }]
    const consumerA = broker.subscribe(filters, { onevent: vi.fn() })
    const consumerB = broker.subscribe(filters, { onevent: vi.fn() })

    expect(backend.subscribe).toHaveBeenCalledTimes(1)
    expect(broker.sharedCount).toBe(1)
    expect(broker.consumerCount).toBe(2)

    consumerA.close()
    consumerB.close()
  })

  it('opens distinct subs for distinct filters', () => {
    broker.subscribe([{ kinds: [1], authors: ['alice'] }], { onevent: vi.fn() })
    broker.subscribe([{ kinds: [1], authors: ['bob'] }], { onevent: vi.fn() })

    expect(backend.subscribe).toHaveBeenCalledTimes(2)
    expect(broker.sharedCount).toBe(2)
  })

  it('fans out onevent to every consumer', () => {
    const filters = [{ kinds: [7], '#e': ['post-1'] }]
    const a = vi.fn()
    const b = vi.fn()
    broker.subscribe(filters, { onevent: a })
    broker.subscribe(filters, { onevent: b })

    const [open] = opens
    open.callbacks.onevent({ id: 'evt-1' })
    open.callbacks.onevent({ id: 'evt-2' })

    expect(a).toHaveBeenCalledTimes(2)
    expect(b).toHaveBeenCalledTimes(2)
  })

  it('only closes the real sub when the last consumer releases', () => {
    const filters = [{ kinds: [1], authors: ['alice'] }]
    const a = broker.subscribe(filters, { onevent: vi.fn() })
    const b = broker.subscribe(filters, { onevent: vi.fn() })

    a.close()
    expect(closes).toEqual([]) // not yet

    b.close()
    expect(closes).toEqual([1]) // NOW
    expect(broker.sharedCount).toBe(0)
  })

  it('closing a consumer twice is a no-op', () => {
    const filters = [{ kinds: [1], authors: ['alice'] }]
    const a = broker.subscribe(filters, { onevent: vi.fn() })
    const b = broker.subscribe(filters, { onevent: vi.fn() })

    a.close()
    a.close() // second close — should not affect refcount
    expect(broker.consumerCount).toBe(1)

    b.close()
    expect(closes).toEqual([1])
  })

  it('fires oneose once per consumer, even for late joiners', async () => {
    const filters = [{ kinds: [1], authors: ['alice'] }]
    const earlyEose = vi.fn()
    broker.subscribe(filters, { onevent: vi.fn(), oneose: earlyEose })

    // Upstream EOSE fires.
    const [open] = opens
    open.callbacks.oneose()
    expect(earlyEose).toHaveBeenCalledTimes(1)

    // Late joiner — should get a synthetic EOSE.
    const lateEose = vi.fn()
    broker.subscribe(filters, { onevent: vi.fn(), oneose: lateEose })
    // Synthetic EOSE fires via queueMicrotask.
    await Promise.resolve()
    expect(lateEose).toHaveBeenCalledTimes(1)
  })

  it('does not double-fire oneose to early consumers when late joiners arrive', async () => {
    const filters = [{ kinds: [1], authors: ['alice'] }]
    const eoseA = vi.fn()
    broker.subscribe(filters, { onevent: vi.fn(), oneose: eoseA })
    opens[0].callbacks.oneose()
    expect(eoseA).toHaveBeenCalledTimes(1)

    broker.subscribe(filters, { onevent: vi.fn(), oneose: vi.fn() })
    await Promise.resolve()

    expect(eoseA).toHaveBeenCalledTimes(1) // still 1
  })

  it('onclose from upstream notifies every consumer and purges the shared record', () => {
    const filters = [{ kinds: [1], authors: ['alice'] }]
    const closeA = vi.fn()
    const closeB = vi.fn()
    broker.subscribe(filters, { onevent: vi.fn(), onclose: closeA })
    broker.subscribe(filters, { onevent: vi.fn(), onclose: closeB })

    opens[0].callbacks.onclose('relay-gone')
    expect(closeA).toHaveBeenCalledWith('relay-gone')
    expect(closeB).toHaveBeenCalledWith('relay-gone')
    expect(broker.sharedCount).toBe(0)

    // Next subscribe with the same filters creates a fresh upstream.
    broker.subscribe(filters, { onevent: vi.fn() })
    expect(backend.subscribe).toHaveBeenCalledTimes(2)
  })

  it('handler that throws does not break fan-out to other consumers', () => {
    const filters = [{ kinds: [1], authors: ['alice'] }]
    const badHandler = vi.fn(() => { throw new Error('boom') })
    const goodHandler = vi.fn()

    broker.subscribe(filters, { onevent: badHandler })
    broker.subscribe(filters, { onevent: goodHandler })

    // Suppress the expected console.error.
    const origErr = console.error
    console.error = vi.fn()
    try {
      opens[0].callbacks.onevent({ id: 'evt-1' })
    } finally {
      console.error = origErr
    }

    expect(badHandler).toHaveBeenCalled()
    expect(goodHandler).toHaveBeenCalled()
  })

  it('bypasses the broker for unkeyable filters', () => {
    // Null is unkeyable — should go straight to the backend.
    const sub = broker.subscribe(null, { onevent: vi.fn() })
    expect(backend.subscribe).toHaveBeenCalledTimes(1)
    expect(broker.sharedCount).toBe(0) // nothing shared
    sub.close()
  })
})
