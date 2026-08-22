// localStorage ラッパ。プライベートブラウジング等で例外が出ても落ちないようにする。

const KEY = 'king-petition-solo/v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function getSettings() {
  const { settings } = read();
  return { difficulty: 'normal', ...settings };
}

export function saveSettings(settings) {
  const data = read();
  data.settings = { ...data.settings, ...settings };
  write(data);
}

/** 難易度別のハイスコア。 */
export function getHighScores() {
  return read().highScores ?? {};
}

/** 更新されたら true を返す。 */
export function recordScore(difficultyId, entry) {
  const data = read();
  data.highScores = data.highScores ?? {};
  const current = data.highScores[difficultyId];
  if (current && current.total >= entry.total) return false;
  data.highScores[difficultyId] = entry;
  return write(data);
}
