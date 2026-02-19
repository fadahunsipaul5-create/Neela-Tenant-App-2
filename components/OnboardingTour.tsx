import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { OnboardingStep } from '../constants/onboardingSteps';

const AUTO_ADVANCE_MS = 6000;
const PROGRESS_UPDATE_MS = 50;

interface OnboardingTourProps {
  steps: OnboardingStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  currentTab?: string;
  onTabChange?: (tab: string) => void;
  paymentSubTab?: string;
  onPaymentSubTabChange?: (subTab: 'history' | 'payment-options') => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  steps,
  isActive,
  onComplete,
  onSkip,
  currentTab,
  onTabChange,
  paymentSubTab,
  onPaymentSubTabChange,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [popupPosition, setPopupPosition] = useState<'top' | 'bottom'>('bottom');
  const [progressPct, setProgressPct] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const updateTargetRect = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Place popup below if target is in top half, else above
      const viewportHeight = window.innerHeight;
      setPopupPosition(rect.top < viewportHeight / 2 ? 'bottom' : 'top');
    } else {
      setTargetRect(null);
    }
  }, [step]);

  // Switch tab if step requires it
  useEffect(() => {
    if (!step || !onTabChange || !step.tab) return;
    if (currentTab !== step.tab) {
      onTabChange(step.tab);
    }
  }, [step, step?.tab, currentTab, onTabChange]);

  // Switch payment sub-tab if step requires it
  useEffect(() => {
    if (!step?.paymentSubTab || !onPaymentSubTabChange || currentTab !== 'payments') return;
    if (paymentSubTab !== step.paymentSubTab) {
      onPaymentSubTabChange(step.paymentSubTab);
    }
  }, [step, step?.paymentSubTab, currentTab, paymentSubTab, onPaymentSubTabChange]);

  // Update target position when step changes or on resize/scroll
  useEffect(() => {
    if (!isActive || !step) return;
    updateTargetRect();
    const interval = setInterval(updateTargetRect, 100);
    return () => clearInterval(interval);
  }, [isActive, step, stepIndex, currentTab, updateTargetRect]);

  // Wait for tab switch and DOM update before measuring
  useEffect(() => {
    if (!isActive || !step) return;
    const t = setTimeout(updateTargetRect, 150);
    return () => clearTimeout(t);
  }, [stepIndex, currentTab, isActive, step, updateTargetRect]);

  // Auto-advance with progress bar
  useEffect(() => {
    if (!isActive || !step) return;
    clearTimer();
    setProgressPct(0);
    const start = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / AUTO_ADVANCE_MS) * 100);
      setProgressPct(pct);
    }, PROGRESS_UPDATE_MS);
    timerRef.current = setTimeout(() => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (isLast) {
        onComplete();
      } else {
        setStepIndex((i) => i + 1);
      }
    }, AUTO_ADVANCE_MS);
    return () => {
      clearTimer();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [isActive, stepIndex, isLast, onComplete, clearTimer]);

  const handleNext = () => {
    clearTimer();
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgressPct(0);
    if (isLast) {
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    clearTimer();
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgressPct(0);
    if (!isFirst) setStepIndex((i) => i - 1);
  };

  const handleSkip = () => {
    clearTimer();
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgressPct(0);
    onSkip();
  };

  if (!isActive || !step || steps.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Dimmed overlay - block clicks on rest of page */}
      <div
        className="absolute inset-0 bg-black/50 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        aria-hidden="true"
      />

      {/* Spotlight highlight around target */}
      {targetRect && (
        <div
          className="absolute pointer-events-none border-2 sm:border-[3px] border-blue-400 rounded-xl shadow-[0_0_0_4px_rgba(59,130,246,0.3)] bg-transparent transition-all duration-300"
          style={{
            left: targetRect.left - 4,
            top: targetRect.top - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}

      {/* Arrow/pointer toward target */}
      {targetRect && (
        <div
          className="absolute w-0 h-0 pointer-events-none"
          style={{
            left: `${Math.max(12, Math.min(targetRect.left + targetRect.width / 2 - 10, (typeof window !== 'undefined' ? window.innerWidth : 400) - 32))}px`,
            ...(popupPosition === 'bottom'
              ? {
                  top: `${targetRect.bottom + 4}px`,
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderBottom: '10px solid white',
                }
              : {
                  bottom: `${(typeof window !== 'undefined' ? window.innerHeight : 600) - targetRect.top + 4}px`,
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderTop: '10px solid white',
                }),
          }}
        />
      )}

      {/* Popup - full-width on mobile, centered on larger screens */}
      <div
        className="absolute left-2 right-2 sm:left-[max(1rem,50%-200px)] sm:right-auto sm:w-[min(400px,calc(100%-2rem))] pointer-events-auto bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-w-[calc(100vw-1rem)]"
        style={
          targetRect
            ? popupPosition === 'bottom'
              ? {
                  top: `${Math.min(targetRect.bottom + 16, window.innerHeight - 260)}px`,
                }
              : {
                  bottom: `${Math.min(window.innerHeight - targetRect.top + 16, window.innerHeight - 260)}px`,
                }
            : { top: '50%', transform: 'translateY(-50%)', margin: '0 auto' }
        }
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="font-bold text-gray-900 text-base sm:text-lg pr-8">{step.title}</h3>
            <button
              onClick={handleSkip}
              className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors -m-1"
              aria-label="Skip tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed">{step.body}</p>
        </div>

        {/* Auto-advance progress bar */}
        <div className="h-1 bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-75 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Footer with buttons - responsive layout */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-t border-gray-100">
          <div className="text-xs text-gray-500 font-medium self-center sm:self-auto">
            {stepIndex + 1} of {steps.length}
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-200"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <button
              onClick={handleSkip}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              <span>{isLast ? 'Finish' : 'Next'}</span>
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
