import { useCallback, useRef, useState, type TouchEvent } from "react";

const REFRESH_THRESHOLD = 72;
const MAX_PULL_DISTANCE = 104;

export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const startY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (window.scrollY > 0 || isRefreshing) return;
    startY.current = event.touches[0]?.clientY ?? null;
  }, [isRefreshing]);

  const onTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (startY.current === null || window.scrollY > 0) return;
    const currentY = event.touches[0]?.clientY;
    if (currentY === undefined) return;

    const distance = currentY - startY.current;
    if (distance <= 0) {
      setPullDistance(0);
      return;
    }

    setPullDistance(Math.min(MAX_PULL_DISTANCE, distance * 0.55));
  }, []);

  const finishPull = useCallback(async () => {
    const shouldRefresh = pullDistance >= REFRESH_THRESHOLD;
    startY.current = null;
    setPullDistance(0);

    if (!shouldRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefresh, pullDistance]);

  return {
    pullDistance,
    isRefreshing,
    pullHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd: finishPull,
      onTouchCancel: finishPull,
    },
  };
}