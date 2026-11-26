/* App settings. The AI tutor is OFF in this version.
   To switch it on later: set enabled to true and endpoint to the proxy URL.
   Never put an AI provider key in this file: anyone can read it. */
window.IFE_CONFIG = {
  version: '0.16.0',
  passMark: 0.85,     // target: score to reach in practice before the real exam
  examLength: 65,     // module final exams: 65 questions, like the real IFE exam
  examPass: 45,       // exam pass mark: 45 of 65 (v0.16.0)
  why: true,
  text: { realExam: 'The IFE Level 3 exam has 65 questions and you need 45 of them (69%) to pass. Each question is worth one mark. In this app, a question with several correct answers only scores if every part is right, so treat the real exam the same way.' },
  ai: { enabled: false, endpoint: '', accessKey: null }
};
