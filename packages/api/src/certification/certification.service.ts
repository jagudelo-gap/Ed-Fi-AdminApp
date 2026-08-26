import { Injectable } from '@nestjs/common';

@Injectable()
export class CertificationService {
  //   // ------------------------------------------------------------------------------
  //   // @TODO: The underlying methods were copied from the original POC and will be refactored in Certification 2.2
  //   // ------------------------------------------------------------------------------

  //   // Run Bruno against a folder. Returns raw stdout and exit code
  //   async runBruno(folder: string, env?: string): Promise<{ exitCode: number; output: string }> {
  //     env = env || this.brunoEnv;

  //     // Run from the Bruno collection root whenever available.
  //     const collectionRoot = path.join(this.runtimeRoot, this.collectionRootName);
  //     const cwd = fs.existsSync(path.join(collectionRoot, 'bruno.json')) ? collectionRoot : this.runtimeRoot;
  //     let target = folder;
  //     try {
  //       const absoluteFolder = path.isAbsolute(folder) ? folder : path.resolve(cwd, folder);
  //       const relativeTarget = path.relative(cwd, absoluteFolder);
  //       if (!relativeTarget.startsWith('..') && !path.isAbsolute(relativeTarget)) {
  //         target = relativeTarget || '.';
  //       }
  //     } catch (_) {
  //       // ignore
  //     }

  //     const runtimeBin = path.join(this.runtimeRoot, 'node_modules', '.bin');
  //     const localBru = path.join(runtimeBin, process.platform === 'win32' ? 'bru.cmd' : 'bru');
  //     const hasLocalBru = fs.existsSync(localBru);
  //     const cmd = hasLocalBru ? `${localBru} run "${target}" --env ${env}` : `bru run "${target}" --env ${env}`;
  //     const fallback = `npx -p @usebruno/cli bru run "${target}" --env ${env}`;
  //     this.logger.log(`Running: ${cmd} (cwd: ${cwd})`);

  //     // Persist the exact command and cwd for debugging
  //     try {
  //       const cmdFile = path.join(this.runtimeRoot, 'last-command.txt');
  //       fs.writeFileSync(cmdFile, `cmd: ${cmd}\ncwd: ${cwd}\nfallback: ${fallback}\n`, 'utf8');
  //     } catch (err) {
  //       this.logger.debug(`Failed to write last-command.txt: ${err}`);
  //     }

  //     const spawnEnv = {
  //       ...process.env,
  //       PATH: [runtimeBin, process.env.PATH].filter(Boolean).join(path.delimiter),
  //     };
  //     let proc = hasLocalBru
  //       ? spawnSync(localBru, ['run', target, '--env', env], {
  //         shell: process.platform === 'win32',
  //         encoding: 'utf8',
  //         stdio: 'pipe',
  //         cwd,
  //         timeout: 10 * 60 * 1000,
  //         env: spawnEnv,
  //       })
  //       : spawnSync(fallback, { shell: true, encoding: 'utf8', stdio: 'pipe', cwd, timeout: 10 * 60 * 1000, env: spawnEnv });

  //     if (hasLocalBru && proc?.error) {
  //       this.logger.log(`Local Bruno CLI failed to execute (${proc.error.message}). Trying fallback.`);
  //       proc = spawnSync(fallback, { shell: true, encoding: 'utf8', stdio: 'pipe', cwd, timeout: 10 * 60 * 1000, env: spawnEnv });
  //     }

  //     const output = (proc && proc.stdout ? proc.stdout : '') + '\n' + (proc && proc.stderr ? proc.stderr : '');
  //     this.logger.log(`Bruno exit code: ${proc && proc.status}`);
  //     // Write last-output.txt for debugging
  //     try {
  //       const outFile = path.join(this.runtimeRoot, 'last-output.txt');
  //       fs.writeFileSync(outFile, `cmd: ${cmd}\ncwd: ${cwd}\n\nOUTPUT:\n${output}`, 'utf8');
  //     } catch (err) {
  //       this.logger.debug(`Failed to write last-output.txt: ${err}`);
  //     }

  //     return { exitCode: (proc && typeof proc.status === 'number') ? proc.status : 1, output };
  //   }

  //   // Prepare a working copy of a scenario and apply placeholder replacements
  //   async prepareScenario(scenarioPath: string, params: Record<string, any> = {}): Promise<string> {
  //     const scenarioSrc = path.join(this.runtimeRoot, this.collectionRootName, scenarioPath);
  //     if (!fs.existsSync(scenarioSrc)) {
  //       throw new Error(`Scenario source not found: ${scenarioSrc}`);
  //     }

  //     const workDir = path.join(this.runtimeRoot, this.collectionRootName, 'work', `${Date.now()}`);
  //     this.copyDirRecursive(scenarioSrc, workDir);

  //     // Replace placeholders in .bru and .json files
  //     this.replacePlaceholdersInDir(workDir, params);

  //     // If test-config.json exists, attempt to rewrite meta.seq based on order
  //     const configPath = path.join(workDir, 'test-config.json');
  //     if (fs.existsSync(configPath)) {
  //       try {
  //         const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')) as any;
  //         if (Array.isArray(cfg.order) && cfg.order.length) {
  //           this.rewriteMetaSeqForOrder(workDir, cfg.order);
  //         }
  //       } catch (err) {
  //         this.logger.warn(`Failed to parse test-config.json: ${err}`);
  //       }
  //     }

  //     return workDir;
  //   }

  //   private replacePlaceholdersInDir(dir: string, params: Record<string, any>) {
  //     const entries = fs.readdirSync(dir, { withFileTypes: true });
  //     for (const entry of entries) {
  //       const p = path.join(dir, entry.name);
  //       if (entry.isDirectory()) {
  //         this.replacePlaceholdersInDir(p, params);
  //         continue;
  //       }
  //       if (!/\.bru$|\.json$/i.test(entry.name)) continue;
  //       let content = fs.readFileSync(p, 'utf8');
  //       for (const [k, v] of Object.entries(params)) {
  //         const val = typeof v === 'string' ? v : JSON.stringify(v);
  //         const normKey = k
  //           .replace(/([a-z])([A-Z])/g, '$1_$2')
  //           .replace(/[^A-Za-z0-9_]/g, '_')
  //           .toUpperCase();

  //         // 1) URL query param occurrences: e.g. schoolId=[...]
  //         const urlRe = new RegExp(`(${this.escapeRegExp(k)}=)([^&\\s\\)\"]*)`, 'gi');
  //         content = content.replace(urlRe, `$1${val}`);

  //         // 2) Params object lines: match only standalone param definitions like "schoolId: ..."
  //         //    Avoid matching property paths (e.g. `res.body[0].schoolId:`) by requiring
  //         //    the param name to be at start of line or preceded by whitespace/{/(, characters.
  //         const propRe = new RegExp(`(^|[\\s{(,])(${this.escapeRegExp(k)})\\s*:\\s*\\[?[^,\\n\\r}]*`, 'gmi');
  //         content = content.replace(propRe, `$1$2: ${val}`);

  //         // 3) Any bracketed token that contains the normalized key, e.g. [ENTER_SCHOOL_ID]
  //         const bracketRe = new RegExp(`\\[[^\\]]*${this.escapeRegExp(normKey)}[^\\]]*\\]`, 'gi');
  //         content = content.replace(bracketRe, val);

  //         // 4) Simple [KEY] pattern
  //         const simpleBr = new RegExp(`\\[${this.escapeRegExp(normKey)}\\]`, 'gi');
  //         content = content.replace(simpleBr, val);

  //       }
  //       fs.writeFileSync(p, content, 'utf8');
  //     }
  //   }

  //   private rewriteMetaSeqForOrder(workDir: string, order: string[]) {
  //     // Map filenames to sequence index
  //     const fileToSeq = new Map<string, number>();
  //     order.forEach((rel, idx) => {
  //       const base = path.basename(rel);
  //       fileToSeq.set(base, idx + 1);
  //     });

  //     const entries = fs.readdirSync(workDir, { withFileTypes: true });
  //     for (const entry of entries) {
  //       if (entry.isFile() && /\.bru$/i.test(entry.name)) {
  //         const full = path.join(workDir, entry.name);
  //         let content = fs.readFileSync(full, 'utf8');
  //         const seq = fileToSeq.get(entry.name);
  //         if (seq !== undefined) {
  //           // Try to replace common patterns: "meta":{"seq":<num>} or meta.seq = <num>
  //           content = content.replace(/("meta"\s*:\s*\{[^}]*"seq"\s*:\s*)\d+/i, `$1${seq}`);
  //           content = content.replace(/(meta\.seq\s*=\s*)\d+/i, `$1${seq}`);
  //           fs.writeFileSync(full, content, 'utf8');
  //         }
  //       }
  //     }
  //   }

  //   private copyDirRecursive(src: string, dest: string) {
  //     const entries = fs.readdirSync(src, { withFileTypes: true });
  //     fs.mkdirSync(dest, { recursive: true });
  //     for (const entry of entries) {
  //       if (entry.name === 'node_modules' || entry.name === '.git') continue;
  //       const srcPath = path.join(src, entry.name);
  //       const destPath = path.join(dest, entry.name);
  //       if (entry.isDirectory()) {
  //         this.copyDirRecursive(srcPath, destPath);
  //       } else if (entry.isFile()) {
  //         fs.copyFileSync(srcPath, destPath);
  //       }
  //     }
  //   }

  //   private escapeRegExp(str: string) {
  //     return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  //   }
  // }
}
