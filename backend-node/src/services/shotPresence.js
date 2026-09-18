/** Conservative legacy-shot handling: omit only a clearly audio-only named role.
 * Unknown presence stays visible; this is not a semantic/visual quality verdict.
 */
function isAudioOnlyCharacter(shot, name) {
  if (!name) return false;
  const clauses = [shot.action, shot.result].filter(Boolean).join('。')
    .split(/[。！？；\n]/u).filter(clause => clause.includes(name));
  if (!clauses.length) return false;
  return clauses.every(clause => {
    const tail = clause.slice(clause.indexOf(name) + name.length).trim();
    return /^(?:的)?(?:追来(?:的)?)?(?:脚步声|声音|画外音|旁白)/u.test(tail)
      || /^(?:（|\()(?:画外|电话中|未出镜)(?:）|\))/u.test(tail);
  });
}
module.exports = { isAudioOnlyCharacter };
