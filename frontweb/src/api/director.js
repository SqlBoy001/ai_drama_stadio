import request from '@/utils/request'
export const directorAPI = {
  create: data => request.post('/director/sessions', data),
  get: id => request.get(`/director/sessions/${id}`),
  update: (id, data) => request.put(`/director/sessions/${id}`, data),
  plan: id => request.post(`/director/sessions/${id}/plan`),
  start: (id, revision) => request.post(`/director/sessions/${id}/start`, { revision }),
}
