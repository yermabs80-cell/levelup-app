export const SCHEMA_VERSION = 2;
export const XP_PER_LEVEL = 100;
export const TREE_XP_STEP = 120;
export const STREAK_GRACE_DAYS = 1;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export const STORAGE_KEYS = {
  data: 'levelup-data',
  onboarded: 'levelup-onboarded'
};

export const STATS = [
  { id: 'strength', title: 'Сила', icon: '💪', color: '#fb7185' },
  { id: 'health', title: 'Здоровье', icon: '♥', color: '#4ade80' },
  { id: 'intellect', title: 'Интеллект', icon: '◈', color: '#60a5fa' },
  { id: 'discipline', title: 'Дисциплина', icon: '◎', color: '#fbbf24' },
  { id: 'skills', title: 'Навыки', icon: '✦', color: '#a78bfa' },
  { id: 'wealth', title: 'Финансы', icon: '₸', color: '#4de0ff' },
  { id: 'faith', title: 'Вера', icon: '🕌', color: '#8b5cf6' },
  { id: 'knowledge', title: 'Знания', icon: '📚', color: '#38bdf8' }
];

export const STAT_IDS = STATS.map(stat => stat.id);
export const STAT_BY_ID = new Map(STATS.map(stat => [stat.id, stat]));

export const TREE_STAGES = ['Семя', 'Росток', 'Ствол', 'Крона', 'Легенда'];
export const TREE_STAGE_LEVELS = 4;

export const TREE_BRANCHES = [
  {
    key: 'forcePath',
    icon: '💪',
    title: 'Титан Тела',
    subtitle: 'Путь Силы',
    color: '#fb7185',
    stats: ['strength', 'health']
  },
  {
    key: 'mindPath',
    icon: '🧠',
    title: 'Архитектор Разума',
    subtitle: 'Путь Знаний',
    color: '#60a5fa',
    stats: ['intellect', 'knowledge', 'skills']
  },
  {
    key: 'financePath',
    icon: '💎',
    title: 'Кузница Капитала',
    subtitle: 'Путь Финансов',
    color: '#4de0ff',
    stats: ['wealth']
  },
  {
    key: 'faithPath',
    icon: '🕌',
    title: 'Свет Имана',
    subtitle: 'Путь Веры',
    color: '#8b5cf6',
    stats: ['faith', 'discipline']
  }
];

export const COLLECTIONS = {
  quest: 'quests',
  task: 'tasks',
  schedule: 'schedule',
  money: 'money'
};

export const FOCUS_PRESETS = [
  { id: 'classic', title: '25 / 5', subtitle: 'Классика', focus: 25, break: 5, longBreak: 15, longBreakEvery: 4 },
  { id: 'deep', title: '50 / 10', subtitle: 'Глубокая работа', focus: 50, break: 10, longBreak: 25, longBreakEvery: 3 }
];

/** XP за завершённую сессию фокуса — идёт в дисциплину, как и остальные волевые действия. */
export const FOCUS_XP = { stat: 'discipline', perSession: 20 };

export const AMBIENT_SOUNDS = [
  { id: 'none', title: 'Тишина', icon: '🔇' },
  { id: 'rain', title: 'Дождь', icon: '🌧' },
  { id: 'forest', title: 'Лес', icon: '🌲' },
  { id: 'waves', title: 'Волны', icon: '🌊' },
  { id: 'night', title: 'Ночь', icon: '🌙' }
];

export const MODAL_TITLES = {
  quest: 'Новый квест',
  task: 'Новая задача',
  schedule: 'Событие в расписании',
  money: 'Финансовая операция'
};

export const RANKS = [
  { name: 'EEE', level: 1, color: '#cbd5e1', percentile: '0–1%', score403030: '≤ 5', score333334: '≤ 5', description: 'Новичок. Только начинает свой путь, не имеет опыта и сражается голыми руками.' },
  { name: 'EE', level: 2, color: '#a8b3c2', percentile: '1–3%', score403030: '5–10', score333334: '5–10', description: 'Получил первое простое оружие и начинает осваивать основы боя.' },
  { name: 'E', level: 3, color: '#94a3b8', percentile: '3–5%', score403030: '10–15', score333334: '10–18', description: 'Приобрёл деревянный меч и научился побеждать слабых противников.' },
  { name: 'DDD', level: 5, color: '#16a34a', percentile: '5–8%', score403030: '15–20', score333334: '18–25', description: 'Настоящий ученик воина. Получил первую броню и стал увереннее в бою.' },
  { name: 'DD', level: 7, color: '#22c55e', percentile: '8–12%', score403030: '20–30', score333334: '25–35', description: 'Хорошо владеет мечом и способен противостоять опытным врагам.' },
  { name: 'D', level: 9, color: '#4ade80', percentile: '12–20%', score403030: '30–40', score333334: '35–45', description: 'Полностью освоил базовую подготовку. Готов к серьёзным испытаниям.' },
  { name: 'CCC', level: 12, color: '#2563eb', percentile: '20–30%', score403030: '40–50', score333334: '45–55', description: 'Опытный воин. Использует качественную экипировку и уверенно побеждает большинство противников.' },
  { name: 'CC', level: 15, color: '#3b82f6', percentile: '30–40%', score403030: '50–60', score333334: '55–65', description: 'Элитный боец. Отличается высокой выносливостью, техникой и дисциплиной.' },
  { name: 'C', level: 18, color: '#60a5fa', percentile: '40–50%', score403030: '60–70', score333334: '65–75', description: 'Один из лучших воинов своего поколения. Его навыки вызывают уважение.' },
  { name: 'BBB', level: 22, color: '#7c3aed', percentile: '50–60%', score403030: '70–75', score333334: '75–80', description: 'Великий воин. Освоил особые техники и значительно превосходит обычных бойцов.' },
  { name: 'BB', level: 26, color: '#8b5cf6', percentile: '60–70%', score403030: '75–80', score333334: '80–85', description: 'Легендарный чемпион. Его сила и мастерство известны далеко за пределами своего региона.' },
  { name: 'B', level: 30, color: '#a78bfa', percentile: '70–80%', score403030: '80–85', score333334: '85–90', description: 'Абсолютный мастер. Владеет редкими способностями и почти не знает равных среди людей.' },
  { name: 'AAA', level: 35, color: '#d97706', percentile: '80–90%', score403030: '85–90', score333334: '90–92', description: 'Герой. Символ силы, мужества и лидерства.' },
  { name: 'AA', level: 40, color: '#f59e0b', percentile: '90–95%', score403030: '90–93', score333334: '92–94', description: 'Живая легенда. Его имя известно во многих землях, а способности поражают даже мастеров.' },
  { name: 'A', level: 45, color: '#fbbf24', percentile: '95–99%', score403030: '93–95', score333334: '94–96', description: 'Мифический герой. Его возможности кажутся невозможными для обычного человека.' },
  { name: 'SSS', level: 50, color: '#e11d48', percentile: '99–99.5%', score403030: '95–97', score333334: '96–98', description: 'Эпический воин. Обладает невероятной силой, скоростью и контролем энергии.' },
  { name: 'SS', level: 55, color: '#f43f5e', percentile: '99.5–99.9%', score403030: '97–99', score333334: '98–99', description: 'Высшее воплощение мастерства. Способен менять ход великих битв в одиночку.' },
  { name: 'S', level: 60, color: '#fb7185', percentile: '99.9–100%', score403030: '99–100', score333334: '99–100', description: 'Абсолютная вершина человеческого потенциала. Идеал силы, техники, опыта и воли. Практически недостижимый уровень для большинства.' }
];

export const DEFAULT_NAME = 'Охотник';
