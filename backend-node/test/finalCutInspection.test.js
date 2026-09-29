const test=require('node:test'),assert=require('node:assert/strict');
const {intervals}=require('../src/services/finalCutInspection');
test('detect intervals include unfinished freeze/silence through end, ignore unrelated metadata',()=>{
 assert.deepEqual(intervals('lavfi.freezedetect.freeze_start=1.2\nlavfi.freezedetect.freeze_end=3\nlavfi.freezedetect.freeze_start=4','freezedetect.freeze',5),[{start:1.2,end:3},{start:4,end:5}]);
 assert.deepEqual(intervals('lavfi.silence_start=0\nlavfi.silence_end=2.3','silence',5),[{start:0,end:2.3}]);
 assert.deepEqual(intervals('lavfi.black_start=2\nlavfi.black_end=3','black',5),[{start:2,end:3}]);
});
