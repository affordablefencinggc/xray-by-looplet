import { availableParallelism, constants, getPriority, setPriority } from "node:os";

// Keep interactive Windows work responsive during local Vite builds.
// CI and explicit Rayon worker settings retain their existing behaviour.
export function localBuildEnvironment(command, args, env, platform = process.platform, cores = availableParallelism()) {
  const localBuild = platform === "win32" && !env.CI &&
    /(^|[\\/])vite(?:\.cmd|\.exe)?$/i.test(command) && args[0] === "build";
  if (!localBuild) return null;
  return {
    ...env,
    RAYON_NUM_THREADS: env.RAYON_NUM_THREADS || String(Math.max(1, Math.min(6, Math.floor(cores / 2)))),
  };
}

export function prepareLocalBuild(command, args, env) {
  const buildEnv = localBuildEnvironment(command, args, env);
  if (!buildEnv) return env;
  // The dedicated Dans1 worker owns its priority. Do not undo its High class.
  if (env.XRAY_BUILD_PROFILE === "dedicated" && env.COMPUTERNAME?.toUpperCase() === "DANS1") {
    console.error(`[build-resources] Dedicated Dans1 build: inherited priority; Rayon workers=${buildEnv.RAYON_NUM_THREADS}.`);
    return buildEnv;
  }
  try {
    // Lower this launcher before spawning, so Windows children inherit it.
    // Preserve an already lower priority instead of raising it.
    setPriority(Math.max(getPriority(), constants.priority.PRIORITY_BELOW_NORMAL));
    console.error(`[build-resources] Local Windows build: below-normal priority; Rayon workers=${buildEnv.RAYON_NUM_THREADS}.`);
  } catch (error) {
    console.error(`[build-resources] Could not lower build priority: ${error.message}. Rayon workers=${buildEnv.RAYON_NUM_THREADS}.`);
  }
  return buildEnv;
}
