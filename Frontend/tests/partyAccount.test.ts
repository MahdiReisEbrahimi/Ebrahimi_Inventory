import test from 'node:test'
import assert from 'node:assert/strict'
import { newestFirst } from '../src/lib/partyAccount.ts'

test('account history shows recent events first, breaks equal timestamps by id, and preserves each running balance', () => {
  const entries = [
    { id: 1, createdAt: '2026-11-01T06:00:00Z', balance: 100 },
    { id: 2, createdAt: '2026-11-01T08:00:00Z', balance: 50 },
    { id: 3, createdAt: '2026-11-01T08:00:00Z', balance: 0 },
  ]
  assert.deepEqual(
    newestFirst(entries).map((entry) => [entry.id, entry.balance]),
    [
      [3, 0],
      [2, 50],
      [1, 100],
    ],
  )
  assert.deepEqual(
    entries.map((entry) => entry.id),
    [1, 2, 3],
  )
})
