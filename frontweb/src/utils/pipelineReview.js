// Explicit user approval is the only way to release a production stage.
export function createPipelineReview() {
  let pending = null
  return {
    wait() {
      if (pending) throw new Error('已有待审核阶段')
      return new Promise((resolve, reject) => { pending = { resolve, reject } })
    },
    approve() {
      const current = pending
      pending = null
      current?.resolve()
    },
    cancel() {
      const current = pending
      pending = null
      current?.reject(Object.assign(new Error('已停止，请修改后重新启动分阶段制作'), { pipelineAborted: true }))
    },
  }
}
