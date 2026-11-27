/* App settings. The AI tutor is OFF in this version.
   To switch it on later: set enabled to true and endpoint to the proxy URL.
   Never put an AI provider key in this file: anyone can read it. */
window.IFE_CONFIG = {
  version: '0.17.1',
  passMark: 0.85,     // target: score to reach in practice before the real exam
  examLength: 40,     // module exams: 40 questions (the Day 7 mock is 65, like the real exam)
  realExam: { questions: 65, pass: 45 },   // the real IFE exam: pass mark 45 of 65 (69%), used for every paper (v0.17.0)
  why: true,
  text: { realExam: 'The IFE Level 3 exam has 65 questions and you need 45 of them (69%) to pass. Each question is worth one mark. In this app, a question with several correct answers only scores if every part is right, so treat the real exam the same way.' },
  ai: { enabled: false, endpoint: '', accessKey: null }
};
