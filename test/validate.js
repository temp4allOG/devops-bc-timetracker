const fs = require('fs');
const required = ['vss-extension.json','time-tracker.html','time-tracker.css','time-tracker.js','bc-api.js','auth.js','README.md','PRIVACY.md','TERMS.md','img/logo.png','img/icon.png','img/preview.png'];
for (const f of required) {
  if (!fs.existsSync(f)) throw new Error(`Missing ${f}`);
}
const manifest = JSON.parse(fs.readFileSync('vss-extension.json','utf8'));
if (!manifest.contributions?.length) throw new Error('No contributions');
if (!manifest.scopes.includes('vso.work_write')) throw new Error('Missing work write scope');
for (const f of ['time-tracker.js','bc-api.js','auth.js']) {
  new Function(fs.readFileSync(f,'utf8'));
}
console.log('Validation passed');
