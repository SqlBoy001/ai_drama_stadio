export function summarizeQc(reports = [], dryRun = false) {
  const latest = new Map()
  // API returns newest first. Do not count obsolete attempts as new assets.
  for (const report of reports) {
    const key = `${report.asset_type}:${report.asset_id ?? report.shot_id ?? report.id}`
    if (!latest.has(key)) latest.set(key, report)
  }
  const videoIds = new Set([...latest.values()].filter(r=>r.asset_type==='video').map(r=>String(r.asset_id ?? r.shot_id)))
  const rows = [...latest.values()].filter(r=>r.asset_type!=='shot' || !videoIds.has(String(r.asset_id ?? r.shot_id)))
  const videoRows = rows.filter(r=>r.asset_type==='video' && r.checks?.some(c=>c.key==='decode'))
  const technicalPassed = videoRows.filter(r=>r.checks.every(c=>c.passed)).length
  const passed = rows.filter(row => row.decision === 'PASS').length
  return { total: rows.length, passed, displayPassed: videoRows.length ? technicalPassed : passed, issues: rows.length - passed,
    label: !rows.length ? '尚未检查' : dryRun ? '模拟检查记录' : videoRows.length ? `${technicalPassed}/${videoRows.length} 项视频文件检查通过` : `${passed}/${rows.length} 项基础检查通过`,
    note: dryRun ? '演练未生成媒体文件，模拟通过不代表画面质量。' : '检查范围见逐项证据；技术通过不等于动作、剧情、对白或声音通过，需人工确认。' }
}
