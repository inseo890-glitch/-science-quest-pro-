const questions = [
  { id: 1, subject: "생명과학", level: "중", question: "식물이 광합성에 사용하는 기체는 무엇인가요?", options: ["산소", "이산화탄소", "질소", "수소"], answer: 1, explanation: "식물은 이산화탄소와 물을 이용해 빛에너지를 저장합니다." },
  { id: 2, subject: "화학", level: "중", question: "물의 화학식은 무엇인가요?", options: ["CO₂", "O₂", "H₂O", "NaCl"], answer: 2, explanation: "물은 수소 원자 2개와 산소 원자 1개로 이루어집니다." },
  { id: 3, subject: "물리", level: "중", question: "힘의 단위는 무엇인가요?", options: ["줄", "와트", "뉴턴", "파스칼"], answer: 2, explanation: "힘의 SI 단위는 뉴턴(N)입니다." },
  { id: 4, subject: "지구과학", level: "중", question: "지구가 태양을 한 바퀴 공전하는 데 걸리는 시간은?", options: ["하루", "한 달", "약 1년", "약 10년"], answer: 2, explanation: "지구의 공전 주기는 약 365.25일입니다." },
  { id: 5, subject: "생명과학", level: "상", question: "세포 호흡으로 ATP를 많이 생성하는 소기관은?", options: ["리보솜", "미토콘드리아", "골지체", "핵"], answer: 1, explanation: "미토콘드리아는 세포 호흡에서 ATP를 생성합니다." },
  { id: 6, subject: "화학", level: "상", question: "25°C에서 중성 용액의 pH는?", options: ["1", "5", "7", "14"], answer: 2, explanation: "25°C에서 중성 용액의 pH는 7입니다." },
  { id: 7, subject: "물리", level: "상", question: "뉴턴의 제2법칙을 나타내는 식은?", options: ["F = ma", "E = mc²", "V = IR", "p = mv²"], answer: 0, explanation: "알짜힘 F는 질량 m과 가속도 a의 곱입니다." },
  { id: 8, subject: "지구과학", level: "상", question: "지진파 중 액체 상태의 외핵을 통과하지 못하는 것은?", options: ["P파", "S파", "표면파", "전자기파"], answer: 1, explanation: "S파는 전단 변형을 전달하므로 액체를 통과하지 못합니다." },
  { id: 9, subject: "생명과학", level: "중", question: "유전 정보를 주로 저장하는 분자는?", options: ["DNA", "포도당", "지방산", "전분"], answer: 0, explanation: "DNA는 생물의 유전 정보를 저장합니다." },
  { id: 10, subject: "화학", level: "중", question: "원자핵을 구성하는 입자는?", options: ["전자와 광자", "양성자와 중성자", "전자와 중성자", "양성자와 전자"], answer: 1, explanation: "원자핵은 양성자와 중성자로 이루어집니다." }
];
function getQuestions({ subject = "전체", level = "전체", count = 5 } = {}) {
  let list = questions.filter(q => (subject === "전체" || q.subject === subject) && (level === "전체" || q.level === level));
  if (!list.length) list = questions;
  return list.sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.min(Number(count) || 5, 10)))
    .map(({ answer, explanation, ...q }) => q);
}
function gradeAnswers(answers) {
  const map = new Map(questions.map(q => [q.id, q]));
  let score = 0;
  const results = (Array.isArray(answers) ? answers : []).map(a => {
    const q = map.get(Number(a.questionId));
    if (!q) return null;
    const correct = Number(a.answer) === q.answer;
    if (correct) score++;
    return { questionId: q.id, correct, correctAnswer: q.answer, explanation: q.explanation };
  }).filter(Boolean);
  return { score, total: results.length, results };
}
module.exports = { getQuestions, gradeAnswers };
