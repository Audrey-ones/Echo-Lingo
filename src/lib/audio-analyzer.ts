import type { LessonData } from "@/lib/types";

export interface AudioExtractResult {
  audioBuffer: AudioBuffer;
  blobUrl: string;
  fileName: string;
}

async function extractFromVideo(blobUrl: string): Promise<AudioBuffer> {
  const video = document.createElement("video");
  video.src = blobUrl;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.volume = 0;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener(
      "error",
      () => reject(new Error("无法加载媒体文件")),
      { once: true }
    );
    video.load();
  });

  const duration = video.duration;
  if (!duration || !isFinite(duration)) {
    video.remove();
    throw new Error("无法读取媒体时长");
  }

  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const source = audioCtx.createMediaElementSource(video);
  source.connect(dest);
  // Also connect to destination to ensure audio processing
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  source.connect(gain);
  gain.connect(audioCtx.destination);

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(dest.stream, {
    mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm",
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (buf: AudioBuffer | null, err?: Error) => {
      if (settled) return;
      settled = true;
      try {
        recorder.stop();
      } catch {}
      video.pause();
      source.disconnect();
      gain.disconnect();
      audioCtx.close();
      video.remove();
      if (buf) resolve(buf);
      else reject(err);
    };

    const timeout = Math.max(duration * 1000 + 30000, 60000);
    const timer = setTimeout(
      () => done(null, new Error("音频提取超时")),
      timeout
    );

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      clearTimeout(timer);
      let decodeCtx: AudioContext | null = null;
      try {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const arrayBuf = await blob.arrayBuffer();
        decodeCtx = new AudioContext();
        const audioBuffer = await decodeCtx.decodeAudioData(arrayBuf);
        await decodeCtx.close();
        decodeCtx = null;
        done(audioBuffer);
      } catch (err) {
        if (decodeCtx) {
          decodeCtx.close().catch(() => {});
        }
        done(null, err as Error);
      }
    };

    recorder.onerror = () => done(null, new Error("录音失败"));

    recorder.start();

    video.playbackRate = 1;
    video.play().catch((e) => done(null, e));

    video.addEventListener(
      "ended",
      () => {
        // Video ended, stop recorder (onstop will handle the rest)
        if (recorder.state !== "inactive") recorder.stop();
      },
      { once: true }
    );

    video.addEventListener(
      "error",
      () => done(null, new Error("视频播放失败")),
      { once: true }
    );
  });
}

export async function extractAudioBuffer(
  source: File | string
): Promise<AudioExtractResult> {
  let arrayBuffer: ArrayBuffer;
  let blobUrl: string;
  let fileName: string;

  if (typeof source === "string") {
    // Validate URL looks like a direct media file
    const url = new URL(source);
    const pathname = url.pathname.split("/").pop() || "";
    const isMediaUrl = /\.(mp3|wav|ogg|m4a|flac|aac|mp4|webm|mov|mkv|avi|wmv)(\?|$)/i.test(
      pathname
    );

    if (!isMediaUrl) {
      throw new Error(
        "链接不是直接的音视频文件 URL。\n\n" +
          "请粘贴以 .mp3 / .mp4 等结尾的直链。\n" +
          "像 B站 / YouTube 等平台页面需要先用下载工具获取直链。"
      );
    }

    try {
      const response = await fetch(source, { mode: "cors" });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("链接返回 404，文件不存在或链接已失效。");
        }
        throw new Error(`无法获取资源 (状态码: ${response.status})`);
      }
      arrayBuffer = await response.arrayBuffer();
      fileName = pathname || "media";
      blobUrl = URL.createObjectURL(new Blob([arrayBuffer]));
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        throw new Error(
          "无法访问该链接，可能是跨域限制 (CORS)。\n\n" +
            "请下载到本地后通过文件上传加载。"
        );
      }
      throw err;
    }
  } else {
    arrayBuffer = await source.arrayBuffer();
    blobUrl = URL.createObjectURL(source);
    fileName = source.name;
  }

  // Try direct decode (audio files)
  try {
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    await audioContext.close();
    return { audioBuffer, blobUrl, fileName };
  } catch {
    // Video or unsupported — extract via media element
  }

  const audioBuffer = await extractFromVideo(blobUrl);
  return { audioBuffer, blobUrl, fileName };
}

// ============================================================
// Original sample-by-sample silence detection (unchanged)
// ============================================================

interface SilenceSegment {
  start_time: number;
  end_time: number;
}

interface AnalysisOptions {
  silenceThreshold?: number;
  minSilenceDuration?: number;
  minSentenceDuration?: number;
}

export async function analyzeAudio(
  audioBuffer: AudioBuffer,
  options: AnalysisOptions = {}
): Promise<LessonData> {
  const {
    silenceThreshold = 0.05,
    minSilenceDuration = 0.6,
    minSentenceDuration = 0.4,
  } = options;

  const data = audioBuffer.getChannelData(0); // mono
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = data.length;
  const totalDuration = audioBuffer.duration;

  // Find silent regions
  const silentRegions: SilenceSegment[] = [];
  let silenceStart: number | null = null;

  for (let i = 0; i < totalSamples; i++) {
    const amplitude = Math.abs(data[i]);

    if (amplitude < silenceThreshold) {
      if (silenceStart === null) {
        silenceStart = i;
      }
    } else {
      if (silenceStart !== null) {
        const silenceDuration = (i - silenceStart) / sampleRate;
        if (silenceDuration >= minSilenceDuration) {
          silentRegions.push({
            start_time: silenceStart / sampleRate,
            end_time: (silenceStart + (i - silenceStart)) / sampleRate,
          });
        }
        silenceStart = null;
      }
    }
  }

  // Handle trailing silence
  if (silenceStart !== null) {
    const silenceDuration = (totalSamples - silenceStart) / sampleRate;
    if (silenceDuration >= minSilenceDuration) {
      silentRegions.push({
        start_time: silenceStart / sampleRate,
        end_time: totalDuration,
      });
    }
  }

  // Scan forward past leading silence
  let currentStart = 0;
  for (let i = 0; i < totalSamples; i++) {
    if (Math.abs(data[i]) >= silenceThreshold) {
      currentStart = i / sampleRate;
      break;
    }
  }

  // Split audio into sentences based on silent regions
  const sentences: LessonData["sentences"] = [];
  let sentenceIndex = 1;

  for (const silence of silentRegions) {
    const segmentDuration = silence.start_time - currentStart;

    // Skip very short segments (noise)
    if (segmentDuration >= minSentenceDuration) {
      sentences.push({
        id: `s_${String(sentenceIndex).padStart(3, "0")}`,
        start_time: Math.round(currentStart * 1000) / 1000,
        end_time: Math.round(silence.start_time * 1000) / 1000,
        en: "",
        zh: "",
      });
      sentenceIndex++;
    }

    currentStart = silence.start_time;
  }

  // Last segment (after final silence or if no silence detected)
  const lastDuration = totalDuration - currentStart;
  if (lastDuration >= minSentenceDuration) {
    sentences.push({
      id: `s_${String(sentenceIndex).padStart(3, "0")}`,
      start_time: Math.round(currentStart * 1000) / 1000,
      end_time: Math.round(totalDuration * 1000) / 1000,
      en: "",
      zh: "",
    });
  }

  // If no silence detected at all, make the whole audio one sentence
  if (sentences.length === 0) {
    sentences.push({
      id: "s_001",
      start_time: 0,
      end_time: Math.round(totalDuration * 1000) / 1000,
      en: "",
      zh: "",
    });
  }

  return {
    id: `auto_${Date.now()}`,
    title: "新课程",
    source_audio: "",
    metadata: {
      difficulty: "auto",
      word_count: 0,
    },
    sentences,
  };
}

// ============================================================
// RMS windowed algorithm (for audio with background music/noise)
// ============================================================

export interface FineSplitOptions {
  silenceThreshold?: number;
  minSilenceDuration?: number;
  minSentenceDuration?: number;
}

export async function analyzeAudioFine(
  audioBuffer: AudioBuffer,
  options: FineSplitOptions = {}
): Promise<LessonData> {
  const {
    silenceThreshold = 0.05,
    minSilenceDuration = 0.4,
    minSentenceDuration = 0.3,
  } = options;

  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = data.length;
  const totalDuration = audioBuffer.duration;

  const WINDOW_SIZE = 1024;
  const windowCount = Math.floor(totalSamples / WINDOW_SIZE);
  const minSilentWindows = Math.ceil(minSilenceDuration / (WINDOW_SIZE / sampleRate));
  const silentRegions: SilenceSegment[] = [];
  let runStart: number | null = null;

  for (let w = 0; w < windowCount; w++) {
    let sumSq = 0;
    const offset = w * WINDOW_SIZE;
    for (let j = 0; j < WINDOW_SIZE; j++) {
      sumSq += data[offset + j] * data[offset + j];
    }
    const rms = Math.sqrt(sumSq / WINDOW_SIZE);

    if (rms < silenceThreshold) {
      if (runStart === null) runStart = w;
    } else {
      if (runStart !== null) {
        const runLen = w - runStart;
        if (runLen >= minSilentWindows) {
          silentRegions.push({
            start_time: (runStart * WINDOW_SIZE) / sampleRate,
            end_time: (w * WINDOW_SIZE) / sampleRate,
          });
        }
        runStart = null;
      }
    }
  }
  if (runStart !== null && (windowCount - runStart) >= minSilentWindows) {
    silentRegions.push({
      start_time: (runStart * WINDOW_SIZE) / sampleRate,
      end_time: (windowCount * WINDOW_SIZE) / sampleRate,
    });
  }

  // Scan forward past leading silence
  let currentStart = 0;
  for (let w = 0; w < windowCount; w++) {
    let sumSq = 0;
    const offset = w * WINDOW_SIZE;
    for (let j = 0; j < WINDOW_SIZE; j++) {
      sumSq += data[offset + j] * data[offset + j];
    }
    if (Math.sqrt(sumSq / WINDOW_SIZE) >= silenceThreshold) {
      currentStart = (w * WINDOW_SIZE) / sampleRate;
      break;
    }
  }

  const sentences: LessonData["sentences"] = [];
  let sentenceIndex = 1;

  for (const silence of silentRegions) {
    const segmentDuration = silence.start_time - currentStart;
    if (segmentDuration >= minSentenceDuration) {
      sentences.push({
        id: `s_${String(sentenceIndex).padStart(3, "0")}`,
        start_time: Math.round(currentStart * 1000) / 1000,
        end_time: Math.round(silence.start_time * 1000) / 1000,
        en: "",
        zh: "",
      });
      sentenceIndex++;
    }
    currentStart = silence.start_time;
  }

  const lastDuration = totalDuration - currentStart;
  if (lastDuration >= minSentenceDuration) {
    sentences.push({
      id: `s_${String(sentenceIndex).padStart(3, "0")}`,
      start_time: Math.round(currentStart * 1000) / 1000,
      end_time: Math.round(totalDuration * 1000) / 1000,
      en: "",
      zh: "",
    });
  }

  if (sentences.length === 0) {
    sentences.push({
      id: "s_001",
      start_time: 0,
      end_time: Math.round(totalDuration * 1000) / 1000,
      en: "",
      zh: "",
    });
  }

  return {
    id: `auto_${Date.now()}`,
    title: "新课程",
    source_audio: "",
    metadata: {
      difficulty: "auto",
      word_count: 0,
    },
    sentences,
  };
}

export function downloadJson(lesson: LessonData, filename: string) {
  const jsonStr = JSON.stringify(lesson, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
