// 테스트 전용 CJS 프리로드 — 'server-only' 가드를 빈 모듈로 치환.
// tsx가 TS import를 CJS require로 컴파일하므로 Module._load를 후킹한다. 빌드/런타임 무관.
const Module = require('node:module');
const orig = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'server-only') return {};
  return orig.call(this, request, ...rest);
};
