const response = require('../response');
const service = require('../services/agentWorkbenchService');
const production = require('../services/agentProductionService');

module.exports = function agentRoutes(db, cfg, log) {
  const audioReviews=require('../services/localAudioReviewJobs');
  audioReviews.recover(db);
  const desktop = handler => async (req, res) => {
    const remote = req.socket.remoteAddress;
    if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)) return response.forbidden(res, '桌面剪辑仅允许本机操作');
    if (req.headers.origin) {
      try { if (!['localhost','127.0.0.1','[::1]'].includes(new URL(req.headers.origin).hostname)) return response.forbidden(res, '不允许跨站桌面操作'); }
      catch { return response.forbidden(res, '无效请求来源'); }
    }
    try { return response.success(res, await handler(req)); }
    catch (err) { return response.badRequest(res, err.message); }
  };
  const wrap = (handler) => (req, res) => {
    try { handler(req, res); }
    catch (err) {
      log.error('Agent workbench request failed', { error: err.message, path: req.path });
      if (err.code === 'BUDGET_BLOCKED' || err.code === 'CONFIGURATION_BLOCKED' || /请输入|预算|必须|已处理|已结束|缺少必要配置/.test(err.message)) return response.badRequest(res, err.message);
      response.internalError(res, err.message);
    }
  };
  const actionForRun = (run) => {
    if (!run || run.dry_run) return null;
    return ({
      SCRIPT_GENERATING: 'script',
      ASSET_GENERATING: 'assets',
      IMAGE_GENERATING: 'images',
      MEDIA_GENERATING: 'media',
    MEDIA_REVIEWING: 'media_review',
      EXPORTING: 'export',
    })[run.status] || null;
  };
  const schedule = (run) => {
    const action = actionForRun(run);
    if (action) production.runAction(db, cfg, log, run.id, action);
  };
  return {
    chatcutConnection: desktop(async () => {
      const client = require('../services/chatcutMcpClient').createClient();
      try {
        const { structured } = require('../services/chatcutEditingService');
        const active = structured(await client.callTool('get_active_project'));
        await client.callTool('get_guidelines');
        const current = structured(await client.callTool('execute', {name:'read_project',arguments:{}}));
        if (current.project.projectId !== active.projectId) throw new Error('读取期间工程变化');
        return { connected:true, project_id:active.projectId, name:current.project.name };
      } finally { client.close(); }
    }),
    chatcutPrepare: desktop(async req => {
      require('../services/editingHandoffService').build(db,cfg,req.params.id);
      return require('../services/chatcutEditingService').prepare(db,cfg,req.params.id,req.body?.project_id);
    }),
    chatcutExport: desktop(async req => {
      require('../services/editingHandoffService').build(db,cfg,req.params.id);
      return require('../services/chatcutEditingService').exportJob(db,cfg,req.params.id,req.params.jobId);
    }),
    chatcutCollect: desktop(async req => {
      require('../services/editingHandoffService').build(db,cfg,req.params.id);
      const jobs=await require('../services/chatcutEditingService').collectExport(db,cfg,req.params.id,req.params.jobId);
      const job=jobs.find(j=>j.id===req.params.jobId);
      if(job?.output && audioReviews.runtime(cfg).available) {
        try { audioReviews.start(db,cfg,req.params.id,job.id); } catch(e) { log.warn('本地音频审核未入队',{error:e.message}); }
      }
      return jobs;
    }),
    chatcutAudioReview: desktop(async req => audioReviews.start(db,cfg,req.params.id,req.params.jobId,{retry:req.body?.retry===true})),
    chatcutApprove: desktop(async req => {
      require('../services/editingHandoffService').build(db,cfg,req.params.id);
      return require('../services/chatcutEditingService').approveExport(db,cfg,req.params.id,req.params.jobId,req.body?.comment);
    }),
    chatcutAdopt: desktop(async req => {
      require('../services/editingHandoffService').build(db,cfg,req.params.id);
      return require('../services/chatcutEditingService').adoptTimeline(db,cfg,req.params.id,req.params.jobId,req.body?.comment);
    }),
    providers: wrap((_req, res) => response.success(res, production.getProviderStatus(db))),
    plan: wrap((req, res) => {
      const status = production.getProviderStatus(db);
      const plan = service.createPlan(req.body || {});
      if (!plan.dry_run) {
        plan.provider_status = status;
        plan.providers = Object.fromEntries(status.capabilities.map((item) => [item.service_type, item.configured ? `${item.name || item.provider} · ${item.model}` : '未配置']));
        if (!status.operational_ready) plan.configuration_blocked = true;
      }
      return response.success(res, plan);
    }),
    createRun: wrap((req, res) => {
      const payload = req.body || {};
      const wantsReal = payload.dry_run === false || payload.plan?.dry_run === false;
      if (wantsReal) {
        const status = production.getProviderStatus(db);
        if (!status.operational_ready) {
          const unavailable = status.capabilities.filter((item) => item.required && !item.operational);
          const detail = unavailable.map((item) => item.known_issue || `${item.label}未配置`).join('；');
          const err = new Error(`真实生产配置尚不可用：${detail}`);
          err.code = 'CONFIGURATION_BLOCKED';
          throw err;
        }
      }
      const run = service.createRun(db, log, payload);
      schedule(run);
      response.created(res, run);
    }),
    editingHandoff: (req, res) => {
      try {
        const handoff = require('../services/editingHandoffService').build(db, cfg, req.params.id);
        res.setHeader('Content-Disposition', 'attachment; filename="editing-handoff.json"');
        return res.json(handoff);
      } catch (err) { return response.badRequest(res, err.message); }
    },
    chatcutImportPlan: (req, res) => {
      try {
        return res.json(require('../services/chatcutImportPlan').build(db, cfg, req.params.id));
      } catch (err) { return response.badRequest(res, err.message); }
    },
    listRuns: wrap((_req, res) => response.success(res, service.listRuns(db))),
    getRun: wrap((req, res) => {
      const run = service.getRun(db, req.params.id);
      if(run)run.local_audio_review_available=audioReviews.runtime(cfg).available;
      if (run) run.editing_jobs = require('../services/chatcutEditingService').list(db, run.id);
      return run ? response.success(res, run) : response.notFound(res, '运行不存在');
    }),
    control: (action) => wrap((req, res) => {
      const run = service.controlRun(db, req.params.id, action);
      schedule(run);
      return run ? response.success(res, run) : response.notFound(res, '运行不存在');
    }),
    listApprovals: wrap((req, res) => response.success(res, service.listApprovals(db, req.query.status || 'PENDING'))),
    resolveApproval: (decision) => wrap((req, res) => {
      const run = service.approve(db, req.params.id, decision, req.body?.comment || '');
      schedule(run);
      return run ? response.success(res, run) : response.notFound(res, '审核不存在');
    }),
    costs: wrap((req, res) => {
      const costs = service.getProjectCosts(db, req.params.id);
      return costs ? response.success(res, costs) : response.notFound(res, '项目成本不存在');
    }),
  };
};
