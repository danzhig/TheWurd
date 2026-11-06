/** pnpm tokens — write styles/tokens.css from lib/design/tokens.ts. */
import fs from 'node:fs';
import path from 'node:path';
import { tokensCss } from '../lib/design/tokens';
import { ROOT } from './lib/paths';

fs.writeFileSync(path.join(ROOT, 'styles/tokens.css'), tokensCss());
console.log('wrote styles/tokens.css');
