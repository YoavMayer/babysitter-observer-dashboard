#!/usr/bin/env node

/**
 * CLI entry point for the babysitter observer dashboard.
 *
 * Parses command-line flags, maps them to environment variables,
 * then execs into `next dev` or `next start`.
 *
 * Usage:
 *   npx ts-node src/cli.ts --port 3002 --watch-dir /tmp/runs --poll-interval 5000 --theme light
 *   npx ts-node src/cli.ts --production --port 3000
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

interface CliOptions {
  port?: string;
  watchDir?: string;
  pollInterval?: string;
  theme?: string;
  production?: boolean;
  help?: boolean;
  version?: boolean;
}

function getVersion(): string {
  try {
    const pkgPath = resolve(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

function printUsage(): void {
  const usage = `
babysitter-observer — CLI for the observer dashboard

Usage:
  observer [options]

Options:
  --port <number>           Port to listen on (default: 3000)
  --watch-dir <path>        Directory to watch for .a5c/runs (default: cwd)
  --poll-interval <ms>      Polling interval in milliseconds (default: 2000)
  --theme <dark|light>      Default UI theme (default: dark)
  --production              Run in production mode (next start) instead of dev
  --version, -v             Show version number
  --help                    Show this help message

Environment variable mapping:
  --port           -> OBSERVER_PORT
  --watch-dir      -> OBSERVER_WATCH_DIR
  --poll-interval  -> OBSERVER_POLL_INTERVAL
  --theme          -> OBSERVER_DEFAULT_THEME

Examples:
  # Start dev server on port 3002 watching a specific directory
  observer --port 3002 --watch-dir /home/user/projects

  # Start production server with light theme
  observer --production --theme light
`.trim();

  console.log(usage);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  // Skip first two entries: node binary and script path
  const args = argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--port":
        i++;
        opts.port = args[i];
        if (!opts.port || isNaN(Number(opts.port))) {
          console.error("Error: --port requires a numeric value");
          process.exit(1);
        }
        break;

      case "--watch-dir":
        i++;
        opts.watchDir = args[i];
        if (!opts.watchDir) {
          console.error("Error: --watch-dir requires a path value");
          process.exit(1);
        }
        break;

      case "--poll-interval":
        i++;
        opts.pollInterval = args[i];
        if (!opts.pollInterval || isNaN(Number(opts.pollInterval))) {
          console.error("Error: --poll-interval requires a numeric value (ms)");
          process.exit(1);
        }
        break;

      case "--theme":
        i++;
        opts.theme = args[i];
        if (opts.theme !== "dark" && opts.theme !== "light") {
          console.error('Error: --theme must be "dark" or "light"');
          process.exit(1);
        }
        break;

      case "--production":
        opts.production = true;
        break;

      case "--version":
      case "-v":
        opts.version = true;
        break;

      case "--help":
      case "-h":
        opts.help = true;
        break;

      default:
        console.error(`Unknown flag: ${arg}`);
        console.error('Run with --help for usage information.');
        process.exit(1);
    }
  }

  return opts;
}

function main(): void {
  const opts = parseArgs(process.argv);

  if (opts.version) {
    console.log(`babysitter-observer v${getVersion()}`);
    process.exit(0);
  }

  if (opts.help) {
    printUsage();
    process.exit(0);
  }

  // Map CLI flags to environment variables
  if (opts.port) {
    process.env.OBSERVER_PORT = opts.port;
  }

  if (opts.watchDir) {
    process.env.OBSERVER_WATCH_DIR = opts.watchDir;
  }

  if (opts.pollInterval) {
    process.env.OBSERVER_POLL_INTERVAL = opts.pollInterval;
  }

  if (opts.theme) {
    process.env.OBSERVER_DEFAULT_THEME = opts.theme;
  }

  // Determine the Next.js command
  const port = opts.port || process.env.OBSERVER_PORT || "3000";
  const nextCmd = opts.production
    ? `next start --port ${port}`
    : `next dev --port ${port}`;

  console.log(`Starting observer: ${nextCmd}`);

  if (opts.watchDir) {
    console.log(`  Watch directory: ${opts.watchDir}`);
  }
  if (opts.pollInterval) {
    console.log(`  Poll interval: ${opts.pollInterval}ms`);
  }
  if (opts.theme) {
    console.log(`  Theme: ${opts.theme}`);
  }

  try {
    execSync(nextCmd, {
      env: process.env,
      stdio: "inherit",
      cwd: resolve(__dirname, ".."),
    });
  } catch {
    // next dev exits with non-zero on SIGINT/SIGTERM — that is normal
    process.exit(0);
  }
}

main();
