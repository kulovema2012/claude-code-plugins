import fs from 'fs';
import os from 'os';
import path from 'path';

const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const inWarp = process.env.TERM_PROGRAM === 'WarpTerminal';

settings.enabledPlugins['warp@claude-code-warp'] = inWarp;

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
