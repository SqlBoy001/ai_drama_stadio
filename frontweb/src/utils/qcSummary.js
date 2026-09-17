export function summarizeQc(reports = [], dryRun = false) {
  const latest = new Map()
  // API returns newest first. Do not count obsolete attempts as new assets.
  for (const report of reports) {
    const key = `${report.asset_type}:${report.asset_id ?? report.shot_id ?? report.id}`
    if (!latest.has(key)) latest.set(key, report)
  }
  const rows = [...latest.values()]
  const passed = rows.filter(row => row.decision === 'PASS').length
  return { total: rows.length, passed, issues: rows.length - passed,
    label: !rows.length ? '尚未检查' : dryRun ? '模拟检查记录' : `${passed}/${rows.length} 项基础检查通过`,
    note: dryRun ? '演练未生成媒体文件，模拟通过不代表画面质量。' : '当前检查素材记录和计划时长；人物、动作、剧情与声音仍需人工确认。' }
}
