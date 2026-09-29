import request from '@/utils/request'

export const agentAPI = {
  chatcutAudioReview: (id, job, retry = false) => request.post(`/agent/runs/${id}/chatcut/${job}/audio-review`, { retry }),
  chatcutConnection: () => request.get('/agent/chatcut/connection'),
  chatcutPrepare: (id, project_id) => request.post(`/agent/runs/${id}/chatcut/prepare`, { project_id }),
  chatcutExport: (id, job) => request.post(`/agent/runs/${id}/chatcut/${job}/export`),
  chatcutCollect: (id, job) => request.post(`/agent/runs/${id}/chatcut/${job}/collect`),
  chatcutApprove: (id, job, comment) => request.post(`/agent/runs/${id}/chatcut/${job}/approve`, { comment }),
  chatcutAdopt: (id, job, comment) => request.post(`/agent/runs/${id}/chatcut/${job}/adopt`, { comment }),
  providerStatus: () => request.get('/agent/providers/status'),
  plan: (data) => request.post('/agent/plan', data),
  createRun: (data) => request.post('/agent/runs', data),
  listRuns: () => request.get('/agent/runs'),
  getRun: (id) => request.get(`/agent/runs/${id}`),
  pause: (id) => request.post(`/agent/runs/${id}/pause`),
  resume: (id) => request.post(`/agent/runs/${id}/resume`),
  cancel: (id) => request.post(`/agent/runs/${id}/cancel`),
  retry: (id) => request.post(`/agent/runs/${id}/retry`),
  listApprovals: (status = 'PENDING') => request.get('/approvals', { params: { status } }),
  approve: (id, comment = '') => request.post(`/approvals/${id}/approve`, { comment }),
  reject: (id, comment) => request.post(`/approvals/${id}/reject`, { comment }),
  costs: (projectId) => request.get(`/projects/${projectId}/costs`),
}
