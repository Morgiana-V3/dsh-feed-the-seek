import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateProposal } from '../../src/learning/index.js'

test('invalid generated structure gets one correction while preserving original evidence', async () => {
  let calls = 0
  const input = { events: [{ id: 'new-evidence', text: '用户原话' }] }
  const result = await generateProposal(
    async (_system, user) => {
      calls++
      const payload = JSON.parse(user)
      assert.deepEqual(payload.events, input.events)
      if (calls === 1) {
        return JSON.stringify({ operations: [], unsupported: true })
      }
      assert.match(payload.formatCorrection, /unsupported/)
      return JSON.stringify({ operations: [], state: null })
    },
    'system',
    input,
    new AbortController().signal,
  )
  assert.equal(calls, 2)
  assert.equal(result.repaired, true)
})

test('repeated invalid output stops after one repair and transport failures are not retried', async () => {
  let calls = 0
  await assert.rejects(
    generateProposal(
      async () => {
        calls++
        return 'invalid'
      },
      '',
      {},
      new AbortController().signal,
    ),
  )
  assert.equal(calls, 2)
  calls = 0
  await assert.rejects(
    generateProposal(
      async () => {
        calls++
        throw new Error('network')
      },
      '',
      {},
      new AbortController().signal,
    ),
    /network/,
  )
  assert.equal(calls, 1)
})
