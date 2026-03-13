const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const file = path.resolve('c:/dev/m4trix/src/components/admin-panel/navbar.tsx');
const source = fs.readFileSync(file, 'utf8');
const result = ts.transpileModule(source, {
  compilerOptions: {
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext,
    strict: false,
  },
  fileName: file,
  reportDiagnostics: true,
});
console.log(
  result.diagnostics?.map(d => ({
    message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
    start: d.start,
    length: d.length,
    code: d.code,
  }))
);
