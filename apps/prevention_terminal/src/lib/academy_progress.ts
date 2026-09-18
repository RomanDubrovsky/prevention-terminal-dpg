import { useState, useEffect } from 'react';

export interface AcademyProgressState {
  readLectures: (number | string)[];
  exploredClusters: string[];
  points: number;
  streak: number;
  lastActiveDate?: string;
  unlockedAchievements: string[];
  completedCases: string[];
  completedTests: string[];
}

export interface Achievement {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  descEn: string;
  icon: string;
  condition: (state: AcademyProgressState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_lesson",
    name: "Первый шаг",
    nameEn: "First Step",
    desc: "Изучена первая лекция Академии",
    descEn: "Completed the first Academy lecture",
    icon: "🌱",
    condition: (state) => state.readLectures.length >= 1
  },
  {
    id: "cluster_explorer",
    name: "Глубоководный дайвер",
    nameEn: "Deep Sea Diver",
    desc: "Исследовано 5 тематических кластеров",
    descEn: "Explored 5 thematic clusters",
    icon: "🤿",
    condition: (state) => state.exploredClusters.length >= 5
  },
  {
    id: "quiz_champion",
    name: "Чемпион Квизов",
    nameEn: "Quiz Champion",
    desc: "Вы набрали 100% за любой квиз кластера",
    descEn: "Scored 100% on any cluster quiz",
    icon: "🏆",
    condition: (state) => state.points >= 50
  },
  {
    id: "clinical_triumph",
    name: "Клинический триумф",
    nameEn: "Clinical Triumph",
    desc: "Пройдена первая клиническая симуляция",
    descEn: "Completed the first clinical simulation",
    icon: "🩺",
    condition: (state) => (state.completedCases || []).length >= 1
  },
  {
    id: "dedicated",
    name: "Постоянный ученик",
    nameEn: "Dedicated Student",
    desc: "Стрик активности достиг 3 дней подряд",
    descEn: "Active streak reached 3 days",
    icon: "🔥",
    condition: (state) => state.streak >= 3
  },
  {
    id: "master_prevention",
    name: "Магистр Профилактики",
    nameEn: "Master of Prevention",
    desc: "Изучены все лекции, пройдены все тесты и закрыты все клинические кейсы!",
    descEn: "Completed all lectures, passed all tests and closed all clinical simulations!",
    icon: "🎓",
    condition: (state) => 
      state.readLectures.length >= 20 && 
      (state.completedTests || []).length >= 3 && 
      (state.completedCases || []).length >= 6
  }
];

const STORAGE_KEY = "teenology_academy_progress";

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calculateStreak(lastActive?: string, currentStreak: number = 0): { streak: number; today: string } {
  const today = getTodayString();
  if (!lastActive) {
    return { streak: 1, today };
  }
  if (lastActive === today) {
    return { streak: Math.max(1, currentStreak), today };
  }
  
  const last = new Date(lastActive);
  const curr = new Date(today);
  const diffTime = Math.abs(curr.getTime() - last.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    return { streak: currentStreak + 1, today };
  } else if (diffDays > 1) {
    return { streak: 1, today };
  }
  return { streak: Math.max(1, currentStreak), today };
}

export function loadProgress(): AcademyProgressState {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    let state: AcademyProgressState;
    if (data) {
      const parsed = JSON.parse(data);
      state = {
        readLectures: Array.isArray(parsed.readLectures) ? parsed.readLectures : [],
        exploredClusters: Array.isArray(parsed.exploredClusters) ? parsed.exploredClusters : [],
        points: typeof parsed.points === 'number' ? parsed.points : 0,
        streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
        lastActiveDate: parsed.lastActiveDate,
        unlockedAchievements: Array.isArray(parsed.unlockedAchievements) ? parsed.unlockedAchievements : [],
        completedCases: Array.isArray(parsed.completedCases) ? parsed.completedCases : [],
        completedTests: Array.isArray(parsed.completedTests) ? parsed.completedTests : []
      };
    } else {
      state = { readLectures: [], exploredClusters: [], points: 0, streak: 0, unlockedAchievements: [], completedCases: [], completedTests: [] };
    }
    
    // Update streak on load/activity
    const streakInfo = calculateStreak(state.lastActiveDate, state.streak);
    let updated = false;
    if (state.streak !== streakInfo.streak || state.lastActiveDate !== streakInfo.today) {
      state.streak = streakInfo.streak;
      state.lastActiveDate = streakInfo.today;
      updated = true;
    }
    
    // Check achievements
    const oldAchievementsCount = state.unlockedAchievements.length;
    checkAchievements(state);
    if (state.unlockedAchievements.length > oldAchievementsCount || updated) {
      saveProgress(state);
    }
    
    return state;
  } catch (e) {
    console.error("Failed to load academy progress", e);
  }
  return { readLectures: [], exploredClusters: [], points: 0, streak: 1, lastActiveDate: getTodayString(), unlockedAchievements: [] };
}

export function saveProgress(state: AcademyProgressState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("academy_progress_updated"));
  } catch (e) {
    console.error("Failed to save academy progress", e);
  }
}

function checkAchievements(state: AcademyProgressState) {
  for (const ach of ACHIEVEMENTS) {
    if (!state.unlockedAchievements.includes(ach.id)) {
      if (ach.condition(state)) {
        state.unlockedAchievements.push(ach.id);
        state.points += 50; // Bonus 50 points for unlocking an achievement!
      }
    }
  }
}

export function markLectureRead(lectureId: number | string) {
  const state = loadProgress();
  if (!state.readLectures.includes(lectureId)) {
    state.readLectures.push(lectureId);
    state.points += 5; // 5 points for starting/reading a lecture
    checkAchievements(state);
    saveProgress(state);
  }
}

export function markClusterExplored(clusterId: string) {
  const state = loadProgress();
  if (!state.exploredClusters.includes(clusterId)) {
    state.exploredClusters.push(clusterId);
    state.points += 15; // 15 points for exploring a cluster
    checkAchievements(state);
    saveProgress(state);
  }
}

export function markCaseCompleted(caseId: string) {
  const state = loadProgress();
  if (!state.completedCases.includes(caseId)) {
    state.completedCases.push(caseId);
    state.points += 50; // +50 XP for clinical simulation pass!
    checkAchievements(state);
    saveProgress(state);
  }
}

export function markTestCompleted(testId: string) {
  const state = loadProgress();
  if (!state.completedTests.includes(testId)) {
    state.completedTests.push(testId);
    state.points += 25; // +25 XP for checkpoint pass
    checkAchievements(state);
    saveProgress(state);
  }
}

export function addPoints(amount: number) {
  const state = loadProgress();
  state.points += amount;
  checkAchievements(state);
  saveProgress(state);
}

export function unlockAchievementDirect(achievementId: string) {
  const state = loadProgress();
  if (!state.unlockedAchievements.includes(achievementId)) {
    state.unlockedAchievements.push(achievementId);
    state.points += 50;
    saveProgress(state);
  }
}

export function getRank(points: number): { title: string; en: string; icon: string } {
  if (points >= 500) return { title: "Магистр профилактики", en: "Master of Prevention", icon: "🎓" };
  if (points >= 300) return { title: "Архитектор смыслов", en: "Architect of Meaning", icon: "🏛️" };
  if (points >= 150) return { title: "Аналитик", en: "Analyst", icon: "🔬" };
  if (points >= 50) return { title: "Исследователь", en: "Explorer", icon: "🧭" };
  return { title: "Новичок", en: "Novice", icon: "🌱" };
}

export function useAcademyProgress() {
  const [progress, setProgress] = useState<AcademyProgressState>(loadProgress());
  
  useEffect(() => {
    const handleUpdate = () => setProgress(loadProgress());
    window.addEventListener("academy_progress_updated", handleUpdate);
    return () => window.removeEventListener("academy_progress_updated", handleUpdate);
  }, []);
  
  return progress;
}
