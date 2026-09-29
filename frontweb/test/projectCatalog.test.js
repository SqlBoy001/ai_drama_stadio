import test from 'node:test'
import assert from 'node:assert/strict'
import { selectProjects } from '../src/utils/projectCatalog.js'
const projects = [{ id: 1, title: '旧作', description: 'AI 古装', updated_at: '2026-09-01' }, { id: 2, title: '新作', updated_at: '2026-09-29' }, { id: 3 }]
test('project search covers title and description without mutating source', () => {
  assert.deepEqual(selectProjects(projects, ' ai ').map(p => p.id), [1])
  assert.deepEqual(selectProjects(projects).map(p => p.id), [2, 1, 3])
  assert.deepEqual(projects.map(p => p.id), [1, 2, 3])
  assert.deepEqual(selectProjects(projects, '不存在'), [])
})
test('name ordering handles unnamed projects', () => {
  assert.equal(selectProjects(projects, '', 'name')[0].id, 3)
  assert.equal(selectProjects([], '').length, 0)
})
