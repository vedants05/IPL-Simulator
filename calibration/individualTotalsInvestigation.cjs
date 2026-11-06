// Diagnostic only: neutralise season-total batting penalties in memory.
// Production files are never rewritten.
const fs = require('node:fs');
const ts = require('typescript');
const original = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
 if (!filename.endsWith('matchSimulation.ts')) return original(module, filename);
 let source = fs.readFileSync(filename, 'utf8');
 if (process.env.INVESTIGATION_NO_RUN_PENALTIES === '1') {
  source = source.replace(/(export function seasonBattingRegressionAdjustment\([\s\S]*?\): number \{)/, '$1\n return 0;');
  source = source.replace(/(export function extremeSeasonConversionAdjustment\([\s\S]*?\): \{ scoringFactor: number; wicketIncrease: number \} \{)/, '$1\n return {scoringFactor:1,wicketIncrease:0};');
 }
 module._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:filename}).outputText,filename);
};
require('./leagueRealismAudit.ts');
