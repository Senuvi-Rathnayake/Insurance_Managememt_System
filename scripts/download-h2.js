const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const version = '2.3.232';
const targetDir = path.join(__dirname, '..', 'vendor');
const target = path.join(targetDir, 'h2.jar');
const url = `https://repo1.maven.org/maven2/com/h2database/h2/${version}/h2-${version}.jar`;

if (fs.existsSync(target) && fs.statSync(target).size > 2_000_000) process.exit(0);
fs.mkdirSync(targetDir, { recursive: true });
const output = fs.createWriteStream(target);

https.get(url, (response) => {
  if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    output.close();
    fs.rmSync(target, { force: true });
    console.error('H2 download redirected unexpectedly. Run npm install again.');
    process.exit(1);
  }
  if (response.statusCode !== 200) {
    console.error(`Unable to download H2 (HTTP ${response.statusCode}).`);
    process.exit(1);
  }
  response.pipe(output);
  output.on('finish', () => output.close());
}).on('error', (error) => {
  fs.rmSync(target, { force: true });
  console.error(`Unable to download H2: ${error.message}`);
  process.exit(1);
});
