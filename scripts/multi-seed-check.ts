import { spawn } from 'node:child_process';
import path from 'node:path';

const SEEDS = [1, 2, 3, 4, 5];
const YEARS = 200;

console.log(`Starting parallel 200-year runs for seeds: ${SEEDS.join(', ')}...`);

function runSeed(seed: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/seed-runner.ts');
    const proc = spawn('npx', ['tsx', scriptPath, String(seed), String(YEARS)], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    let stdout = '';
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('[')) {
          console.log(line);
        }
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Seed ${seed} exited with code ${code}`));
        return;
      }
      try {
        const lines = stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const res = JSON.parse(lastLine);
        resolve(res);
      } catch (err) {
        reject(err);
      }
    });
  });
}

Promise.all(SEEDS.map(runSeed))
  .then((results) => {
    console.log('\n================ 200-Year Stability Results ================');
    console.table(results);
    const allStable = results.every(
      (r) => r.minPopAfterSettled > 4000 && r.maxPopAfterSettled < 16000
    );
    console.log(`All 5 seeds stayed in steady band (4000 - 16000): ${allStable ? 'PASS' : 'FAIL'}`);
    process.exit(allStable ? 0 : 1);
  })
  .catch((err) => {
    console.error('Error running multi-seed check:', err);
    process.exit(1);
  });
