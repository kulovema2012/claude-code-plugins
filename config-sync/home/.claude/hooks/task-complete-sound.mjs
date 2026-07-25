// Stop hook: play task-complete sound unless this session created tasks
// that are not all completed. Streaming replacement for the previous
// PowerShell hook — O(1) memory over arbitrarily large transcripts.
import { createInterface } from 'node:readline';
import { createReadStream, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';

const WAV = 'C:\\Users\\new_k\\.claude\\notify-sounds\\task-complete.wav';
const POWERSHELL = 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const dryRun = process.argv.includes('--dry-run');

async function readStdin() {
  let buf = '';
  for await (const chunk of process.stdin) buf += chunk;
  return buf;
}

async function shouldPlay(data) {
  if (data.stop_hook_active) return false;
  const tp = data.transcript_path;
  if (!tp || !existsSync(tp)) return true;

  const created = new Set();
  const statuses = new Map();
  const rl = createInterface({ input: createReadStream(tp, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    // Cheap prefilter: lines without these substrings cannot affect the outcome.
    if (!line.includes('Task #') && !line.includes('TaskUpdate')) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const content = obj?.message?.content;
    if (!Array.isArray(content)) continue;
    if (obj.type === 'user') {
      for (const block of content) {
        if (block?.type !== 'tool_result') continue;
        const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '');
        for (const m of text.matchAll(/Task #(\d+) created/g)) created.add(m[1]);
      }
    } else if (obj.type === 'assistant') {
      for (const block of content) {
        if (block?.type === 'tool_use' && block.name === 'TaskUpdate' && block.input?.taskId != null) {
          statuses.set(String(block.input.taskId), block.input.status);
        }
      }
    }
  }
  for (const id of created) {
    if (statuses.get(id) !== 'completed') return false;
  }
  return true;
}

try {
  let data = {};
  try { data = JSON.parse(await readStdin()); } catch { /* no/bad stdin -> defaults */ }
  const play = await shouldPlay(data);
  if (dryRun) {
    console.log(play ? 'WOULD PLAY' : 'WOULD SKIP');
  } else if (play) {
    await new Promise((resolve) => {
      execFile(
        POWERSHELL,
        ['-NoProfile', '-NonInteractive', '-Command', `(New-Object System.Media.SoundPlayer '${WAV}').PlaySync()`],
        () => resolve(),
      );
    });
  }
} catch { /* never block the turn */ }
process.exit(0);
