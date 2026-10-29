"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const SnackbarContext = createContext<(text: string) => void>(() => {});

const SAVE_ERROR = "Could not save. Check your connection and try again.";

let reportSaveError: () => void = () => {};

export function setSaveErrorHandler(handler: () => void) {
  reportSaveError = handler;
}

export function notifySaveError() {
  reportSaveError();
}

function SaveErrorBridge() {
  const show = useContext(SnackbarContext);
  useEffect(() => {
    setSaveErrorHandler(() => show(SAVE_ERROR));
    return () => setSaveErrorHandler(() => {});
  }, [show]);
  return null;
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [snack, setSnack] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    const id = Date.now();
    setSnack({ id, text });
    timer.current = window.setTimeout(() => {
      setSnack((current) => (current?.id === id ? null : current));
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <SnackbarContext.Provider value={show}>
      <SaveErrorBridge />
      {children}
      {snack ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(10.5rem+env(safe-area-inset-bottom))] z-40 px-5">
          <button
            type="button"
            role="status"
            onClick={() => setSnack(null)}
            className="pointer-events-auto mx-auto block w-full max-w-lg rounded-2xl bg-foreground px-4 py-3 text-left text-base font-semibold text-background shadow-lg"
          >
            {snack.text}
          </button>
        </div>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): (text: string) => void {
  return useContext(SnackbarContext);
}
