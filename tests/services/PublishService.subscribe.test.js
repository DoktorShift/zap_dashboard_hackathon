import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * publishService.subscribe — push-based pending-queue change emitter.
 * Contract:
 * - subscribe() fires the listener synchronously with current state.
 * - listener fires on add/remove/clear + on successful publish clearing queue.
 * - unsubscribe returned by subscribe stops further calls.
 * - Listener exception in one subscriber doesn't break others.
 */

const { mockPublish } = vi.hoisted(() => ({
  mockPublish: vi.fn(),
}))

vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: {
    publish: mockPublish,
    publishInbox: mockPublish,
  },
}))

vi.mock('../../src/services/nostr/SignerService.js', () => ({
  signerService: { signEvent: vi.fn((t) => ({ ...t, id: 'sig-' + Date.now(), sig: 'sig' })) },
}))

vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  verifyEvent: vi.fn(() => true),
}))

beforeEach(async () => {
  vi.resetModules()
  mockPublish.mockReset()
})

describe('publishService.subscribe', () => {
  it('fires the listener synchronously with current state on subscribe', async () => {
    const mod = await import('../../src/services/nostr/PublishService.js')
    const listener = vi.fn()

    const unsubscribe = mod.publishService.subscribe(listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith([]) // empty queue

    unsubscribe()
  })

  it('fires the listener when a publish fails all retries (adds to pending)', async () => {
    mockPublish.mockRejectedValue(new Error('all relays down'))

    const mod = await import('../../src/services/nostr/PublishService.js')
    const listener = vi.fn()
    mod.publishService.subscribe(listener)
    listener.mockClear()

    const template = { kind: 1, content: 'hello', tags: [] }
    await expect(
      mod.publishService.signAndPublish(template, { retries: 0 })
    ).rejects.toThrow()

    // Publish failure added an entry to the queue → listener called
    // with the new pending snapshot.
    expect(listener).toHaveBeenCalled()
    const lastCallArgs = listener.mock.calls[listener.mock.calls.length - 1][0]
    expect(Array.isArray(lastCallArgs)).toBe(true)
    expect(lastCallArgs.length).toBe(1)
    expect(lastCallArgs[0].kind).toBe(1)
  })

  it('removePending fires the listener and shrinks the snapshot', async () => {
    mockPublish.mockRejectedValue(new Error('fail'))
    const mod = await import('../../src/services/nostr/PublishService.js')
    const listener = vi.fn()
    mod.publishService.subscribe(listener)

    // Seed the queue with a failure.
    await mod.publishService.signAndPublish({ kind: 1, content: 'x', tags: [] }, { retries: 0 }).catch(() => {})
    const before = listener.mock.calls[listener.mock.calls.length - 1][0]
    expect(before.length).toBe(1)

    mod.publishService.removePending(before[0].eventId)
    const after = listener.mock.calls[listener.mock.calls.length - 1][0]
    expect(after.length).toBe(0)
  })

  it('clearPending fires the listener once (no-op when queue is empty)', async () => {
    mockPublish.mockRejectedValue(new Error('fail'))
    const mod = await import('../../src/services/nostr/PublishService.js')
    const listener = vi.fn()
    mod.publishService.subscribe(listener)

    const clearCallsBefore = listener.mock.calls.length
    mod.publishService.clearPending() // queue empty — should NOT emit
    expect(listener.mock.calls.length).toBe(clearCallsBefore)

    await mod.publishService.signAndPublish({ kind: 1, content: 'x', tags: [] }, { retries: 0 }).catch(() => {})
    const beforeClear = listener.mock.calls.length
    mod.publishService.clearPending() // now it DOES emit
    expect(listener.mock.calls.length).toBe(beforeClear + 1)
    expect(listener.mock.calls[listener.mock.calls.length - 1][0]).toEqual([])
  })

  it('unsubscribe stops further listener calls', async () => {
    mockPublish.mockRejectedValue(new Error('fail'))
    const mod = await import('../../src/services/nostr/PublishService.js')
    const listener = vi.fn()
    const unsubscribe = mod.publishService.subscribe(listener)

    unsubscribe()
    listener.mockClear()

    await mod.publishService.signAndPublish({ kind: 1, content: 'x', tags: [] }, { retries: 0 }).catch(() => {})
    expect(listener).not.toHaveBeenCalled()
  })

  it('a throwing listener does not prevent other listeners from firing', async () => {
    mockPublish.mockRejectedValue(new Error('fail'))
    const mod = await import('../../src/services/nostr/PublishService.js')
    const bad = vi.fn(() => { throw new Error('listener blew up') })
    const good = vi.fn()
    mod.publishService.subscribe(bad)
    mod.publishService.subscribe(good)

    const origErr = console.error
    console.error = vi.fn()
    try {
      await mod.publishService.signAndPublish({ kind: 1, content: 'x', tags: [] }, { retries: 0 }).catch(() => {})
    } finally {
      console.error = origErr
    }

    expect(bad).toHaveBeenCalled()
    expect(good).toHaveBeenCalled()
  })
})
