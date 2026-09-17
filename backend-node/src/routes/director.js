const express = require('express');
const service = require('../services/directorService');
const response = require('../response');
module.exports = (db, cfg, log) => {
  const router = express.Router();
  const wrap = fn => async (req, res) => {
    try { response.success(res, await fn(req)); }
    catch (e) { response.error(res, e.status || (e.code === 'BUDGET_BLOCKED' ? 400 : 500), e.code || 'DIRECTOR_ERROR', e.status || e.code === 'BUDGET_BLOCKED' ? e.message : '操作失败，草稿已保留，请稍后重试'); }
  };
  router.post('/sessions', wrap(req => service.create(db, req.body)));
  router.get('/sessions/:id', wrap(req => service.get(db, req.params.id)));
  router.put('/sessions/:id', wrap(req => service.update(db, req.params.id, req.body)));
  router.post('/sessions/:id/plan', wrap(req => service.plan(db, log, req.params.id)));
  router.post('/sessions/:id/start', wrap(req => service.start(db, cfg, log, req.params.id, req.body.revision)));
  return router;
};
