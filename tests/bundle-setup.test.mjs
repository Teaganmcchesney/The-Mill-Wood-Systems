import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=ts.transpileModule(readFileSync(new URL('../lib/bundle-setup.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {missingBundleSetup}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('missing schema is separated from access and network failures',()=>{
 assert.equal(missingBundleSetup({code:'PGRST205'}),true);
 assert.equal(missingBundleSetup({code:'PGRST202'}),true);
 assert.equal(missingBundleSetup({code:'42501',message:'permission denied'}),false);
 assert.equal(missingBundleSetup({message:'Failed to fetch'}),false);
});
