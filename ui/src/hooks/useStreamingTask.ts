/**
 * G6 — useStreamingTask
 *
 * Subscribes to the company SSE stream and accumulates agent.writing chunks
 * for a specific taskId into a live text buffer.
 *
 * Usage:
 *   const { streamingText, isStreaming } = useStreamingTask(taskId)
 *
 * - streamingText  grows as chunks arrive; resets when a new stream starts
 * - isStreaming    true from first chunk until the done:true sentinel arrives
 */

import { useState, useEffect, useRef } from "react";
import { useCompanyEvents } from "./useCompanyEvents";

export interface UseStreamingTaskReturn {
  /** Accumulated text so far for this task */
  streamingText: string;
  /** True while chunks are arriving (before done sentinel) */
  isStreaming: boolean;
}

export function useStreamingTask(taskId: string | null | undefined): UseStreamingTaskReturn {
  const { lastEvent } = useCompanyEvents();
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming,   setIsStreaming]   = useState(false);
  const currentTaskRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastEvent || lastEvent.type !== "agent.writing") return;

    const { taskId: eventTaskId, chunk, done } = lastEvent.data as {
      taskId?: string;
      chunk?: string;
      done?: boolean;
    };

    if (eventTaskId !== taskId) return;

    // New task stream starting — reset buffer
    if (currentTaskRef.current !== taskId) {
      currentTaskRef.current = taskId ?? null;
      setStreamingText("");
    }

    if (done) {
      setIsStreaming(false);
      return;
    }

    if (chunk) {
      setIsStreaming(true);
      setStreamingText(prev => prev + chunk);
    }
  }, [lastEvent, taskId]);

  // Reset when taskId changes
  useEffect(() => {
    setStreamingText("");
    setIsStreaming(false);
    currentTaskRef.current = taskId ?? null;
  }, [taskId]);

  return { streamingText, isStreaming };
}
