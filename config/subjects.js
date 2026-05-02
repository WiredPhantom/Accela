const SUBJECTS = [
  {
    id: 'kulliyat-advia',
    name: 'Kulliyate Advia wa Advia Jadeeda',
    shortName: 'Kulliyate Advia',
    urduName: 'کلیات ادویہ و ادویہ جدیدہ',
    emoji: '📗',
    description: 'Dawaiyon ke buniyadi usool aur jadeed dawa sazi',
    color: '#00ffcc',
  },
  {
    id: 'advia-mufradat',
    name: 'Advia Mufradat',
    shortName: 'Advia Mufradat',
    urduName: 'ادویہ مفردات',
    emoji: '🌿',
    description: 'Akeli dawaiyon ki pehchaan aur khasiyat',
    color: '#7c5cff',
  },
  {
    id: 'ilmul-saidla',
    name: 'Ilmul Saidla',
    shortName: 'Ilmul Saidla',
    urduName: 'علم الصیدلہ',
    emoji: '⚗️',
    description: 'Dawa sazi ka ilm — banawat aur taqseem',
    color: '#ff7ab6',
  },
  {
    id: 'advia-murakkabat',
    name: 'Advia Murakkabat',
    shortName: 'Advia Murakkabat',
    urduName: 'ادویہ مرکبات',
    emoji: '🧪',
    description: 'Murakkab dawaiyon ki tarikeeb aur istamal',
    color: '#ffd700',
  },
];

function getSubject(id) {
  return SUBJECTS.find(s => s.id === id) || null;
}

function getAllSubjects() {
  return SUBJECTS;
}

module.exports = { SUBJECTS, getSubject, getAllSubjects };
