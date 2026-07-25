const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let d = {};
  try { d = JSON.parse(chunks.join('')); } catch(e) {}

  const model = d.model && (d.model.display_name || d.model.id) || 'claude';
  const bs = String.fromCharCode(92);
  const rawCwd = (d.cwd || '').split(bs).join('/');
  const pct = d.context_window && d.context_window.used_percentage;

  const homeRaw = ((process.env.USERPROFILE || process.env.HOME) || '').split(bs).join('/');
  let cwd = rawCwd;
  if (homeRaw && cwd.startsWith(homeRaw)) {
    cwd = '~' + cwd.slice(homeRaw.length);
  }

  const parts = cwd.split('/');
  let fish = cwd;
  if (parts.length > 3) {
    const abbrev = parts.slice(0, parts.length - 2).map(function(p) {
      if (p === '~' || p === '' || p.endsWith(':')) return p;
      return p[0];
    });
    fish = abbrev.concat([parts[parts.length - 2], parts[parts.length - 1]]).join('/');
  }

  const out = ['\uD83E\uDD16 ' + model, '\uD83D\uDCC1 ' + fish];

  try {
    const execFileSync = require('child_process').execFileSync;
    const branch = execFileSync('git', ['-C', rawCwd, '--no-optional-locks', 'branch', '--show-current'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (branch) {
      let branchPart = branch;
      try {
        const diff = execFileSync('git', ['-C', rawCwd, '--no-optional-locks', 'diff', '--shortstat', 'HEAD'],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        const added = (diff.match(/(\d+) insertion/) || [])[1];
        const deleted = (diff.match(/(\d+) deletion/) || [])[1];
        const diffParts = [];
        if (added) diffParts.push('+' + added);
        if (deleted) diffParts.push('-' + deleted);
        if (diffParts.length) branchPart = branch + ' [' + diffParts.join(' ') + ']';
      } catch(e2) {}
      out.push('\u2387 ' + branchPart);
    }
  } catch(e) {}

  const hasPct = pct !== null && pct !== undefined;
  out.push('\uD83D\uDCCA ctx: ' + (hasPct ? Math.round(pct) + '%' : '-'));

  process.stdout.write(out.join(' | '));
});
