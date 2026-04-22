const DEV_BYPASS_ENABLED = process.env.DEV_BYPASS_AUTH === '1';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

export function isDevBypassAllowed() {
  return DEV_BYPASS_ENABLED && IS_DEVELOPMENT;
}

export function isDevBypassRequested() {
  return DEV_BYPASS_ENABLED;
}

export function getDevBypassWarningContext() {
  return {
    requested: DEV_BYPASS_ENABLED,
    nodeEnv: process.env.NODE_ENV ?? 'undefined',
  };
}
