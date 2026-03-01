"use client";

import { useEffect } from "react";

/**
 * iOS Optimization Component
 * - Prevents zoom on double-tap
 * - Prevents pinch-to-zoom
 * - Optimizes for PWA when added to Home Screen
 */
export function IOSOptimization() {
  useEffect(() => {
    // Prevent double-tap zoom
    let lastTouchEnd = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    // Prevent pinch zoom
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    // Add passive: false for better touch handling
    document.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEnd, {
      passive: false,
    });
    document.addEventListener("gesturestart", handleGestureStart, {
      passive: false,
    });
    document.addEventListener("gesturechange", handleGestureStart, {
      passive: false,
    });
    document.addEventListener("gestureend", handleGestureStart, {
      passive: false,
    });

    // Prevent overscroll bounce on iOS
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const isScrollable =
        target.scrollHeight > target.clientHeight &&
        getComputedStyle(target).overflowY === "auto";

      if (!isScrollable) {
        e.preventDefault();
      }
    };

    document.addEventListener("scroll", handleScroll, {
      passive: false,
    });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("gesturestart", handleGestureStart);
      document.removeEventListener("gesturechange", handleGestureStart);
      document.removeEventListener("gestureend", handleGestureStart);
      document.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return null;
}
