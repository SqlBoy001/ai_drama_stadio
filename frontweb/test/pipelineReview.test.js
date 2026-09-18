import test from 'node:test'
import assert from 'node:assert/strict'
import { createPipelineReview } from '../src/utils/pipelineReview.js'

test('elapsed time never authorizes the next paid stage; each stage needs its own approval', async () => {
  const gate = createPipelineReview()
  let calls = 0
  const stage = gate.wait().then(() => calls++)
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(calls, 0)
  gate.approve()
  await stage
  assert.equal(calls, 1)
  gate.approve() // duplicate click must not pre-approve the next stage
  const next = gate.wait().then(() => calls++)
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(calls, 1)
  gate.approve()
  await next
  assert.equal(calls, 2)
})

test('cancel on edit or navigation prevents downstream work and permits a fresh run', async () => {
  const gate = createPipelineReview()
  let calls = 0
  const stage = gate.wait().then(() => calls++)
  gate.cancel()
  await assert.rejects(stage, error => error.pipelineAborted === true)
  assert.equal(calls, 0)
  const fresh = gate.wait()
  gate.approve()
  await fresh
})
