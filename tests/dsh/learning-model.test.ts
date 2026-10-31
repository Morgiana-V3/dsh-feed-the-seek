import assert from 'node:assert/strict'
import { test } from 'node:test'
import { learningCallOptions } from '../../src/dsh/index.js'

test('learning leaves output length to the host and only requests a supported effort', async () => {
  const signal = new AbortController().signal
  assert.deepEqual(
    await learningCallOptions(
      {
        resolveModelInfo: async () => ({ reasoning: { efforts: [{ id: 'low' }, { id: 'high' }] } }),
      },
      'provider',
      'model',
      signal,
    ),
    { reasoningEffort: 'low' },
  )
  assert.deepEqual(
    await learningCallOptions(
      { resolveModelInfo: async () => ({ reasoning: { efforts: [{ id: 'high' }] } }) },
      'provider',
      'model',
      signal,
    ),
    {},
  )
  assert.deepEqual(await learningCallOptions({}, 'provider', 'model', signal), {})
})

test('model metadata failure preserves fallback but cancellation propagates', async () => {
  const controller = new AbortController()
  const runtime = {
    resolveModelInfo: async () => {
      throw new Error('lookup failed')
    },
  }
  assert.deepEqual(await learningCallOptions(runtime, 'provider', 'model', controller.signal), {})
  controller.abort()
  await assert.rejects(
    learningCallOptions(runtime, 'provider', 'model', controller.signal),
    /lookup failed/,
  )
})
