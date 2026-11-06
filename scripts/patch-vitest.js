import fs from 'node:fs';
import path from 'node:path';

// Fix Vitest 3.2.7 bug where "onTaskUpdate" was omitted from eventNames in rpc.-pEldfrD.js,
// causing birpc to time out after 60s on long test runs.
const file = path.resolve('node_modules/vitest/dist/chunks/rpc.-pEldfrD.js');
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('"onTaskUpdate"')) {
    content = content.replace(
      'eventNames: [\n\t\t\t"onUserConsoleLog",\n\t\t\t"onCollected",\n\t\t\t"onCancel"\n\t\t],',
      'eventNames: [\n\t\t\t"onUserConsoleLog",\n\t\t\t"onCollected",\n\t\t\t"onCancel",\n\t\t\t"onTaskUpdate"\n\t\t],'
    );
    fs.writeFileSync(file, content, 'utf8');
  }
}
