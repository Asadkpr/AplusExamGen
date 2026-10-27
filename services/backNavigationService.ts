import { useEffect, useRef } from 'react';

type BackHandler = () => boolean;

const handlerStack: Array<{ id: symbol; fn: () => boolean }> = [];
let isInitialized = false;

export const pushBackGuard = () => {
  if (typeof window === 'undefined') return;
  try {
    if (!window.history.state || !window.history.state.__aplusBackGuard) {
      window.history.pushState({ __aplusBackGuard: true, ts: Date.now() }, '');
    }
  } catch (_) {}
};

const initGlobalBackNavigation = () => {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Push initial history guard entry so browser/mobile Back never exits the app
  pushBackGuard();

  // Re-arm guard on user gesture (required by mobile Chrome/Android so back button triggers popstate reliably)
  const armOnGesture = () => {
    pushBackGuard();
  };
  window.addEventListener('pointerdown', armOnGesture, { passive: true });
  window.addEventListener('keydown', armOnGesture, { passive: true });

  window.addEventListener('popstate', () => {
    // Re-push guard immediately so subsequent Back presses also stay inside the app
    try {
      window.history.pushState({ __aplusBackGuard: true, ts: Date.now() }, '');
    } catch (_) {}

    // Execute from innermost (most recently mounted) handler to outermost
    for (let i = handlerStack.length - 1; i >= 0; i--) {
      try {
        const handled = handlerStack[i].fn();
        if (handled) {
          return;
        }
      } catch (e) {
        console.error('Back navigation handler error:', e);
      }
    }
  });
};

export const useBackHandler = (handler: BackHandler) => {
  const handlerRef = useRef<BackHandler>(handler);
  handlerRef.current = handler;

  useEffect(() => {
    initGlobalBackNavigation();
    pushBackGuard();

    const id = Symbol('aplus-back-handler');
    handlerStack.push({
      id,
      fn: () => handlerRef.current()
    });

    return () => {
      const idx = handlerStack.findIndex(item => item.id === id);
      if (idx !== -1) {
        handlerStack.splice(idx, 1);
      }
    };
  }, []);
};
