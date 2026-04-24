import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * useStaleness — push API for "a background refresh is failing".
 * Contract:
 * - markStale/markFresh mutate a reactive shared map.
 * - isStale reflects size > 0.
 * - primaryReason picks a sensible string for 0/1/N sources.
 * - since timestamp preserved across repeated markStale on same source.
 */

async function fresh() {
  vi.resetModules()
  return await import('../../src/composables/core/useStaleness.js')
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1700000000000 })
})

describe('useStaleness', () => {
  it('starts with no stale sources', async () => {
    const { useStaleness } = await fresh()
    const { isStale, sources, primaryReason } = useStaleness()
    expect(isStale.value).toBe(false)
    expect(sources.value).toEqual([])
    expect(primaryReason.value).toBe('')
  })

  it('markStale flips isStale to true and exposes the reason', async () => {
    const mod = await fresh()
    const { isStale, sources, primaryReason } = mod.useStaleness()

    mod.markStale('notes', 'Relay timeout')
    expect(isStale.value).toBe(true)
    expect(sources.value).toHaveLength(1)
    expect(sources.value[0]).toMatchObject({ key: 'notes', reason: 'Relay timeout' })
    expect(primaryReason.value).toBe('Relay timeout')
  })

  it('markFresh clears the source and flips isStale back when empty', async () => {
    const mod = await fresh()
    const { isStale } = mod.useStaleness()

    mod.markStale('notes', 'err')
    expect(isStale.value).toBe(true)
    mod.markFresh('notes')
    expect(isStale.value).toBe(false)
  })

  it('repeated markStale preserves the original `since` timestamp', async () => {
    const mod = await fresh()
    const { sources } = mod.useStaleness()

    mod.markStale('notes', 'first')
    const firstSince = sources.value[0].since

    vi.advanceTimersByTime(5_000)
    mod.markStale('notes', 'second-attempt-also-failed')
    const secondSince = sources.value[0].since

    // `since` unchanged (tracks first-detected time, not latest attempt).
    expect(secondSince).toBe(firstSince)
    // Reason updates to the latest error.
    expect(sources.value[0].reason).toBe('second-attempt-also-failed')
  })

  it('primaryReason summarizes when multiple sources are stale', async () => {
    const mod = await fresh()
    const { primaryReason } = mod.useStaleness()

    mod.markStale('notes', 'a')
    mod.markStale('zaps', 'b')
    mod.markStale('follows', 'c')

    expect(primaryReason.value).toMatch(/3 sources/)
    expect(primaryReason.value).toContain('notes')
    expect(primaryReason.value).toContain('zaps')
    expect(primaryReason.value).toContain('follows')
  })

  it('markFresh on unknown source is a no-op (no throw)', async () => {
    const mod = await fresh()
    const { isStale } = mod.useStaleness()
    expect(() => mod.markFresh('never-marked')).not.toThrow()
    expect(isStale.value).toBe(false)
  })

  it('empty / undefined source keys are ignored silently', async () => {
    const mod = await fresh()
    const { isStale } = mod.useStaleness()
    mod.markStale('')
    mod.markStale(undefined)
    mod.markStale(null)
    expect(isStale.value).toBe(false)
  })

  it('state is shared across calls to useStaleness() (module singleton)', async () => {
    const mod = await fresh()
    const a = mod.useStaleness()
    const b = mod.useStaleness()

    mod.markStale('profiles', 'boom')
    expect(a.isStale.value).toBe(true)
    expect(b.isStale.value).toBe(true)
  })
})
