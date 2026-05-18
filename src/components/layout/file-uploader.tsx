"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, Link, Download, Loader2, FileAudio, FileJson, Sparkles } from "lucide-react";
import { useLessonStore } from "@/stores/lesson-store";
import { analyzeAudio, analyzeAudioFine, downloadJson, extractAudioBuffer } from "@/lib/audio-analyzer";
import { translateSentences } from "@/lib/translate";
import type { LessonData } from "@/lib/types";

export function FileUploader() {
  const setLesson = useLessonStore((s) => s.setLesson);
  const setAudioBlobUrl = useLessonStore((s) => s.setAudioBlobUrl);
  const lesson = useLessonStore((s) => s.lesson);
  const audioBlobUrl = useLessonStore((s) => s.audioBlobUrl);
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentenceCount, setSentenceCount] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [sensitivity, setSensitivity] = useState<"fine" | "standard" | "coarse">("standard");
  const [fineThreshold, setFineThreshold] = useState(0.05);
  const [fineMinSilence, setFineMinSilence] = useState(0.4);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const generatedLessonRef = useRef<LessonData | null>(null);

  const handleLoad = useCallback(
    async (source: File | string, sourceName?: string) => {
      setAnalyzing(true);
      setError(null);

      try {
        if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);

        setStatus("正在解析媒体文件...");
        const { audioBuffer, blobUrl, fileName } =
          await extractAudioBuffer(source);

        setAudioBlobUrl(blobUrl);

        setStatus("正在分析音频停顿...");
        const generatedLesson = sensitivity === "fine"
          ? await analyzeAudioFine(audioBuffer, { silenceThreshold: fineThreshold, minSilenceDuration: fineMinSilence })
          : await analyzeAudio(audioBuffer, sensitivity === "coarse"
            ? { silenceThreshold: 0.03, minSilenceDuration: 1.0, minSentenceDuration: 0.5 }
            : undefined);
        generatedLesson.source_audio = sourceName || fileName;
        generatedLesson.title = (sourceName || fileName).replace(/\.[^.]+$/, "");
        setSentenceCount(generatedLesson.sentences.length);
        generatedLessonRef.current = generatedLesson;
        setLesson(generatedLesson);

        setStatus("正在翻译...");
        translateSentences(generatedLesson.sentences).then((translations) => {
          const currentLesson = useLessonStore.getState().lesson;
          if (!currentLesson) return;
          const updated = { ...currentLesson };
          updated.sentences = updated.sentences.map((s, i) => ({
            ...s,
            zh: s.zh || translations[i] || "",
          }));
          generatedLessonRef.current = updated;
          useLessonStore.getState().updateLesson(updated);
          setStatus("");
        }).catch(console.error);
      } catch (err) {
        console.error("处理失败:", err);
        setStatus("");
        setError(
          err instanceof Error
            ? `处理失败: ${err.message}`
            : "处理失败，请确认文件或链接有效。"
        );
      } finally {
        setAnalyzing(false);
      }
    },
    [audioBlobUrl, setAudioBlobUrl, setLesson, sensitivity, fineThreshold, fineMinSilence]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleLoad(file, file.name);
    },
    [handleLoad]
  );

  const handleUrlLoad = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const name = trimmed.split("/").pop()?.split("?")[0] || "media";
    handleLoad(trimmed, name);
  }, [urlInput, handleLoad]);

  const handleJsonLoad = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data: LessonData = JSON.parse(ev.target?.result as string);
          if (!data.id || !data.title || !Array.isArray(data.sentences)) {
            setError("JSON 格式不符，请检查是否为有效的课程文件。");
            return;
          }
          generatedLessonRef.current = data;
          setSentenceCount(data.sentences.length);
          setLesson(data);
          translateSentences(data.sentences).then((translations) => {
            const current = useLessonStore.getState().lesson;
            if (!current) return;
            const updated = { ...current };
            updated.sentences = updated.sentences.map((s, i) => ({
              ...s,
              zh: s.zh || translations[i] || "",
            }));
            generatedLessonRef.current = updated;
            useLessonStore.getState().updateLesson(updated);
          }).catch(console.error);
        } catch {
          setError("JSON 解析失败，请检查文件格式。");
        }
      };
      reader.readAsText(file);
    },
    [setLesson]
  );

  const handleDownloadJson = useCallback(() => {
    if (generatedLessonRef.current) {
      const name = generatedLessonRef.current.title || "lesson";
      downloadJson(generatedLessonRef.current, `${name}.json`);
    }
  }, []);

  const ready = lesson && audioBlobUrl;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-4 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-[0_0_20px_-4px_rgba(99,102,241,0.12)]">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            Echo-Lingo
          </h1>
        </div>
        <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
          上传音视频或粘贴链接，自动切分句子开始练习
        </p>
      </div>

      {/* Main upload card */}
      <div className="w-full max-w-sm space-y-3">
        {/* Error display */}
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
            {error}
          </div>
        )}

        {/* Sensitivity selector */}
        {!analyzing && !ready && (
          <>
            <div className="flex items-center gap-2 justify-center">
              <span className="text-[11px] text-zinc-500 shrink-0">分句灵敏度</span>
              <div className="flex items-center bg-zinc-800/30 rounded-lg p-0.5 gap-0.5 ring-1 ring-zinc-700/20">
                {(["fine", "standard", "coarse"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSensitivity(key)}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-all duration-300 font-medium ${
                      sensitivity === key
                        ? "bg-zinc-700/70 text-zinc-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.2)]"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {key === "fine" ? "精细" : key === "standard" ? "标准" : "粗略"}
                  </button>
                ))}
              </div>
            </div>

            {sensitivity === "fine" && (
              <div className="space-y-2 px-1">
                <label className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>静音阈值</span>
                  <span className="font-mono text-zinc-400">{fineThreshold.toFixed(3)}</span>
                </label>
                <input
                  type="range"
                  min="0.02"
                  max="0.12"
                  step="0.005"
                  value={fineThreshold}
                  onChange={(e) => setFineThreshold(parseFloat(e.target.value))}
                  className="w-full h-1 appearance-none bg-zinc-800/60 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(99,102,241,0.3)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:hover:shadow-[0_0_14px_rgba(99,102,241,0.5)]"
                />
                <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
                  <span>0.02 严格</span>
                  <span>0.12 宽松</span>
                </div>

                <label className="flex items-center justify-between text-[11px] text-zinc-500 mt-2">
                  <span>最小停顿时长</span>
                  <span className="font-mono text-zinc-400">{fineMinSilence.toFixed(2)}s</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={fineMinSilence}
                  onChange={(e) => setFineMinSilence(parseFloat(e.target.value))}
                  className="w-full h-1 appearance-none bg-zinc-800/60 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(99,102,241,0.3)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:hover:shadow-[0_0_14px_rgba(99,102,241,0.5)]"
                />
                <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
                  <span>0.1s 细</span>
                  <span>0.8s 粗</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.mov,.mkv,.avi"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* File upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzing}
          className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-500 ${
            analyzing
              ? "border-indigo-500/20 bg-indigo-500/[0.04] text-indigo-400 shadow-[0_0_40px_-8px_rgba(99,102,241,0.08)]"
              : ready
              ? "border-green-500/15 bg-green-500/[0.04] text-green-400 shadow-[0_0_40px_-8px_rgba(34,197,94,0.05)]"
              : "border-zinc-800/50 bg-zinc-900/40 hover:border-zinc-700/60 hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:shadow-[0_0_40px_-8px_rgba(99,102,241,0.08),0_8px_24px_-8px_rgba(0,0,0,0.15)] cursor-pointer"
          }`}
        >
          <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
            analyzing
              ? "bg-indigo-500/10 ring-1 ring-indigo-500/15"
              : ready
              ? "bg-green-500/10 ring-1 ring-green-500/15"
              : "bg-zinc-800/50 group-hover:bg-zinc-700/50"
          }`}>
            {analyzing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileAudio className="w-5 h-5" />
            )}
          </div>
          <div className="text-left flex-1">
            <div className="text-sm font-medium leading-tight">
              {analyzing ? (status || "正在处理...") : ready ? "已加载" : "选择音视频文件"}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {ready ? lesson?.title : "MP3 / MP4 / WAV / MOV ..."}
            </div>
          </div>
        </button>

        {/* URL input toggle */}
        {!analyzing && (
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className={`w-full flex items-center justify-center gap-1.5 text-xs transition-all duration-200 ${
              showUrlInput ? "text-zinc-400" : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            <span className="w-8 h-px bg-zinc-700/30" />
            <span>{showUrlInput ? "收起链接输入" : "或粘贴外部链接"}</span>
            <span className="w-8 h-px bg-zinc-700/30" />
          </button>
        )}

        {/* URL input */}
        {showUrlInput && !analyzing && (
          <div className="space-y-2 animate-slide-up">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2.5 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-3.5 py-3 focus-within:border-indigo-500/30 focus-within:bg-zinc-900/60 transition-all duration-300">
                <Link className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUrlLoad();
                  }}
                  placeholder="粘贴音视频直链 URL..."
                  className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
                />
              </div>
              <button
                onClick={handleUrlLoad}
                disabled={!urlInput.trim() || analyzing}
                className="shrink-0 px-5 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_4px_12px_-2px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_20px_-2px_rgba(99,102,241,0.4)] active:scale-[0.97]"
              >
                加载
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed px-1">
              支持 .mp3/.mp4/.wav 等音视频直链。平台视频（B站/YouTube等）请先下载再上传。
            </p>
          </div>
        )}

        {/* Analyzing status */}
        {analyzing && status && (
          <div className="space-y-2 py-1">
            <div className="w-full h-0.5 bg-zinc-800/40 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500/50 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: "60%", background: "linear-gradient(90deg, transparent, #6366f1, transparent)", backgroundSize: "200% 100%" }} />
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_6px_rgba(99,102,241,0.4)]" />
              <p className="text-xs text-indigo-400/80">
                {status}
              </p>
            </div>
          </div>
        )}

        {/* Ready state: stats + download */}
        {ready && !analyzing && (
          <div className="flex flex-col items-center gap-4 pt-3 animate-slide-up">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">检测到</span>
              <span className="text-indigo-300 font-semibold tabular-nums text-lg">
                {sentenceCount}
              </span>
              <span className="text-zinc-500">个句子</span>
            </div>

            <button
              onClick={handleDownloadJson}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 text-sm transition-all duration-300 border border-zinc-800/30 hover:border-zinc-700/40"
            >
              <Download className="w-3.5 h-3.5" />
              导出 JSON 备份
            </button>
          </div>
        )}
      </div>

      {/* Divider + JSON import */}
      <div className="w-full max-w-sm pt-1">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800/20" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-zinc-950 px-4 text-[11px] text-zinc-500 tracking-wider">
              或者
            </span>
          </div>
        </div>

        <div className="mt-5">
          <input
            ref={jsonInputRef}
            id="json-upload"
            type="file"
            accept=".json"
            onChange={handleJsonLoad}
            className="hidden"
          />
          <label
            htmlFor="json-upload"
            className="flex items-center justify-center gap-2.5 w-full px-4 py-3 rounded-xl border border-zinc-800/30 hover:border-zinc-700/40 bg-zinc-900/15 hover:bg-zinc-900/30 text-zinc-500 hover:text-zinc-300 text-sm transition-all duration-300 cursor-pointer"
          >
            <FileJson className="w-4 h-4" />
            加载已有 JSON 课程
          </label>
        </div>
      </div>
    </div>
  );
}
