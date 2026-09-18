const test = require('node:test');
const assert = require('node:assert/strict');
const { isAudioOnlyCharacter } = require('../src/services/shotPresence');
test('footsteps offscreen must not supply an on-screen identity', () => {
 const shot = {action:'李默冲进消防通道，拨通电话。',result:'李默站在楼梯间。主管追来的脚步声从身后传来。'};
 assert.equal(isAudioOnlyCharacter(shot,'主管'),true);
 assert.equal(isAudioOnlyCharacter(shot,'李默'),false);
});
test('a visible actor remains visible even when they also speak offscreen', () => {
 assert.equal(isAudioOnlyCharacter({action:'主管站在楼梯口。',result:'主管的声音传来。'},'主管'),false);
 assert.equal(isAudioOnlyCharacter({action:'主管拿起手机。'},'主管'),false);
 assert.equal(isAudioOnlyCharacter({},'主管'),false);
});
