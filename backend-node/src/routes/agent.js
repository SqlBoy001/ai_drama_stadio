const response = require('../response');
const service = require('../services/agentWorkbenchService');
const production = require('../services/agentProductionService');

module.exports = function agentRoutes(db, cfg, log) {
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
      MEDIA_GENERATING: 'media',
      EXPORTING: 'export',
    })[run.status] || null;
  };
  const schedule = (run) => {
    const action = actionForRun(run);
    if (action) production.runAction(db, cfg, log, run.id, action);
  };
  return {
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
    listRuns: wrap((_req, res) => response.success(res, service.listRuns(db))),
    getRun: wrap((req, res) => {
      const run = service.getRun(db, req.params.id);
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
