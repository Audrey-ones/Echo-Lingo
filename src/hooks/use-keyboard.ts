"use client";

import { useEffect, useRef } from "react";
import { useLessonStore } from "@/stores/lesson-store";

function triggerPlayback() {
  const playFn = (window as any).__echoPlayCurrentSentence as (() => void) | undefined;
  if (playFn) playFn();
}

export function useKeyboard() {
  const store = useLessonStore;
  const tabHeldRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Space: play/pause current sentence
      if (e.code === "Space" && !isInputFocused) {
        e.preventDefault();
        const ws = (window as any).__echoWavesurfer as any;
        if (!ws) return;

        // Mark interaction (hide first-play overlay)
        const markFn = (window as any).__echoMarkInteracted as (() => void) | undefined;
        markFn?.();

        if (ws.isPlaying()) {
          ws.pause();
        } else {
          const resume = () => {
            const state = store.getState();
            const s = state.currentSentence();
            const cur = ws.getCurrentTime();
            if (s && cur >= s.start_time && cur < s.end_time) {
              // Respect loop mode when resuming within current sentence
              if (state.isLooping) {
                ws.play(cur, s.end_time);
              } else {
                ws.play();
              }
            } else {
              triggerPlayback();
            }
          };
          const audioCtx = ws.backend?.ac;
          if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume().then(resume);
          } else {
            resume();
          }
        }
        return;
      }

      // Tab: hold to show translation
      if (e.code === "Tab" && !isInputFocused) {
        e.preventDefault();
        if (!tabHeldRef.current) {
          tabHeldRef.current = true;
          store.getState().setShowTranslation(true);
        }
        return;
      }

      // / : toggle loop
      if (e.code === "Slash" && !isInputFocused) {
        e.preventDefault();
        store.getState().toggleLoop();
        return;
      }

      // ArrowDown: next sentence (playback triggered by page effect)
      if (e.code === "ArrowDown" && !isInputFocused) {
        e.preventDefault();
        const state = store.getState();
        if (!state.isLastSentence()) {
        const resetFlag = (window as any).__echoResetTimeupdateFlag as (() => void) | undefined;
        resetFlag?.();
          state.nextSentence();
        }
        return;
      }

      // ArrowUp: prev sentence (playback triggered by page effect)
      if (e.code === "ArrowUp" && !isInputFocused) {
        e.preventDefault();
        const state = store.getState();
        if (!state.isFirstSentence()) {
        const resetFlag = (window as any).__echoResetTimeupdateFlag as (() => void) | undefined;
        resetFlag?.();
          state.prevSentence();
        }
        return;
      }

      // Shift + ArrowLeft: slow down
      if (e.code === "ArrowLeft" && e.shiftKey) {
        e.preventDefault();
        store.getState().adjustPlaybackRate(-0.1);
        return;
      }

      // Shift + ArrowRight: speed up
      if (e.code === "ArrowRight" && e.shiftKey) {
        e.preventDefault();
        store.getState().adjustPlaybackRate(0.1);
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Tab" && tabHeldRef.current) {
        tabHeldRef.current = false;
        store.getState().setShowTranslation(false);
      }
    };

    // Reset Tab-held state when window loses focus (prevents stuck translation)
    const handleVisibility = () => {
      if (document.hidden && tabHeldRef.current) {
        tabHeldRef.current = false;
        store.getState().setShowTranslation(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
}
