/** A non-mutating catalog projection; missing dates sort after dated projects. */
export function selectProjects(projects, query = '', order = 'recent') {
  const needle = query.trim().toLocaleLowerCase()
  const result = projects.filter(project => `${project.title || ''} ${project.description || ''}`.toLocaleLowerCase().includes(needle))
  return result.sort((a, b) => order === 'name'
    ? (a.title || '').localeCompare(b.title || '', 'zh-CN')
    : (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0))
}
