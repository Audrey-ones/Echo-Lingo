// Free translation API (no key required)
// Primary: MyMemory (free, 5000 chars/day)
// Fallback: Google Translate unofficial endpoint

async function fetchWithRetry(url: string, retries = 2): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        // Rate limited or server error — wait then retry
        if (i < retries) {
          await new Promise((r) => setTimeout(r, (i + 1) * 1000));
        }
        continue;
      }
      return null;
    } catch {
      if (i < retries) {
        await new Promise((r) => setTimeout(r, (i + 1) * 1000));
      }
    }
  }
  return null;
}

async function translateOne(text: string): Promise<string> {
  // Try MyMemory first
  const mymemoryRes = await fetchWithRetry(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh`
  );
  if (mymemoryRes) {
    try {
      const data = await mymemoryRes.json();
      const translated = data?.responseData?.translatedText;
      if (translated && translated !== text) return translated;
    } catch { /* fall through */ }
  }

  // Fallback: Google Translate (unofficial, may be blocked in China)
  const googleRes = await fetchWithRetry(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`
  );
  if (googleRes) {
    try {
      const data = await googleRes.json();
      const translated = data?.[0]?.map((part: [string]) => part[0]).join("");
      if (translated) return translated;
    } catch { /* fall through */ }
  }

  return "";
}

export async function translateText(text: string): Promise<string> {
  if (!text || !text.trim()) return "";
  try {
    return await translateOne(text.trim());
  } catch (err) {
    console.warn("翻译失败:", err);
    return "";
  }
}

export async function translateSentences(
  sentences: { en: string; zh: string }[]
): Promise<{ [index: number]: string }> {
  const results: { [index: number]: string } = {};

  // Collect indices that need translation
  const pending: { index: number; text: string }[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (!s.en || !s.en.trim()) continue;
    if (s.zh && s.zh.trim()) continue;
    pending.push({ index: i, text: s.en.trim() });
  }

  // Translate in concurrent batches of 3
  const batchSize = 3;
  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const translations = await Promise.all(
      batch.map((item) => translateText(item.text))
    );
    for (let j = 0; j < batch.length; j++) {
      if (translations[j]) {
        results[batch[j].index] = translations[j];
      }
    }
    // Small delay between batches
    if (i + batchSize < pending.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}
