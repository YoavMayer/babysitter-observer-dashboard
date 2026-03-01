import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

/**
 * Detect a CLI tool version by running `<command> --version`.
 * Returns the parsed version string (e.g. "0.0.168") or "N/A" on failure.
 */
function detectVersion(command) {
  try {
    const raw = execSync(command, { encoding: 'utf-8', timeout: 1000 }).trim();
    const match = raw.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : raw || 'N/A';
  } catch {
    return 'N/A';
  }
}

const babysitterVersion = detectVersion('babysitter --version');

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BABYSITTER_VERSION: babysitterVersion,
  },
  // Enable optimized barrel-import tree-shaking for heavy icon libraries.
  // This transforms `import { X } from "lucide-react"` into direct subpath
  // imports at build time, dramatically reducing the amount of module code
  // that webpack must parse and eliminating unused icons from the bundle.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
