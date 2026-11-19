/* App settings. The AI tutor is OFF in this version.
   To switch it on later: set enabled to true and endpoint to the proxy URL.
   Never put an AI provider key in this file: anyone can read it. */
window.IFE_CONFIG = {
  version: '0.1.1',
  passMark: 0.85,
  examLength: 40,
  ai: { enabled: false, endpoint: '', accessKey: null }
};
