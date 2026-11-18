// scripts/git.js
// Node.js Git runner using isomorphic-git to support standard Git operations reliably

import git from 'isomorphic-git';
import fs from 'node:fs';
import path from 'node:path';

const dir = process.cwd();

async function run() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  if (command === 'status') {
    const matrix = await git.statusMatrix({ fs, dir });
    console.log('On branch: ' + (await git.currentBranch({ fs, dir, fullname: false }) || 'detached'));
    console.log('\nChanges:');
    let hasChanges = false;
    for (const [filepath, head, workdir, stage] of matrix) {
      if (head === workdir && workdir === stage) continue;
      hasChanges = true;
      let statusStr = '';
      if (head === 0 && workdir === 2 && stage === 0) statusStr = 'Untracked: ';
      else if (head === 0 && workdir === 2 && stage === 2) statusStr = 'Added:     ';
      else if (head === 1 && workdir === 2 && stage === 2) statusStr = 'Modified (staged): ';
      else if (head === 1 && workdir === 2 && stage === 1) statusStr = 'Modified:  ';
      else if (head === 1 && workdir === 0 && stage === 1) statusStr = 'Deleted:   ';
      else if (head === 1 && workdir === 0 && stage === 0) statusStr = 'Deleted (staged): ';
      else statusStr = `[${head},${workdir},${stage}] `;
      console.log(`  ${statusStr} ${filepath}`);
    }
    if (!hasChanges) {
      console.log('  Working tree clean');
    }
  } else if (command === 'add') {
    const targets = args.slice(1);
    if (targets.length === 0) {
      console.error('Usage: node scripts/git.js add <file1> [file2...]');
      process.exit(1);
    }
    for (const target of targets) {
      const fullPath = path.resolve(dir, target);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        const addDir = async (subDir) => {
          const entries = fs.readdirSync(subDir, { withFileTypes: true });
          for (const entry of entries) {
            const entryPath = path.join(subDir, entry.name);
            if (entry.isDirectory()) {
              if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
                await addDir(entryPath);
              }
            } else {
              const rel = path.relative(dir, entryPath).replace(/\\/g, '/');
              await git.add({ fs, dir, filepath: rel });
              console.log(`Staged: ${rel}`);
            }
          }
        };
        await addDir(fullPath);
      } else {
        const norm = path.relative(dir, fullPath).replace(/\\/g, '/');
        await git.add({ fs, dir, filepath: norm });
        console.log(`Staged: ${norm}`);
      }
    }
  } else if (command === 'commit') {
    let message = 'Phase implementation update';
    const mIdx = args.indexOf('-m');
    if (mIdx !== -1 && args[mIdx + 1]) {
      message = args[mIdx + 1];
    }
    const sha = await git.commit({
      fs,
      dir,
      message,
      author: {
        name: 'Antigravity',
        email: 'antigravity@google.com',
      },
    });
    console.log(`[commit ${sha}] ${message}`);
  } else if (command === 'log') {
    const depth = parseInt(args[1] || '5', 10);
    const commits = await git.log({ fs, dir, depth });
    for (const c of commits) {
      console.log(`commit ${c.oid}`);
      console.log(`Author: ${c.commit.author.name} <${c.commit.author.email}>`);
      console.log(`Date:   ${new Date(c.commit.author.timestamp * 1000).toISOString()}`);
      console.log(`\n    ${c.commit.message.trim()}\n`);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Git error:', err);
  process.exit(1);
});
