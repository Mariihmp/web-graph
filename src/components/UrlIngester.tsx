import React, { useState, useEffect } from "react";
import { Link2, Sparkles, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BrainNode } from "../types";

interface UrlIngesterProps {
  onIngestSuccess: (node: BrainNode) => void;
}

export default function UrlIngester({ onIngestSuccess }: UrlIngesterProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const steps = [
    "Contacting Jina AI Reader to harvest webpage text...",
    "Distilling concepts, titles, and descriptions with Gemini...",
    "Grounding semantic connections against your existing brain...",
    "Persisting nodes & relational links to SQLite database...",
  ];

  // Rotate steps visually during ingestion
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setCurrentStep(0);
      interval = setInterval(() => {
        setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !url.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong during ingestion.");
      }

      setUrl("");
      onIngestSuccess(data.node);
    } catch (err: any) {
      setError(err.message || "Failed to connect to the ingestion service.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="url-ingester-card" className="bg-[#1A1D23] rounded-xl border border-[#374151] p-5 shadow-sm">
      <h3 className="font-sans font-semibold text-xs text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]" />
        Ingest Brain Wave
      </h3>
      <form onSubmit={handleIngest} className="space-y-3">
        <div className="relative">
          <Link2 className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <textarea
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="https://example.com/article&#10;https://example.com/course (one per line)"
            disabled={isLoading}
            rows={isFocused || url.trim() || isLoading ? 5 : 3}
            className={`w-full bg-[#0F1115] border rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none disabled:opacity-50 transition-all duration-300 resize-none ${
              isFocused || url.trim() || isLoading
                ? "border-blue-500 ring-2 ring-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                : "border-[#374151]"
            }`}
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
              Analyzing & Connecting...
            </>
          ) : (
            <>
              Feed into Brain
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 border-t border-[#374151] pt-4"
          >
            <div className="space-y-3">
              {steps.map((stepText, idx) => {
                const isActive = idx === currentStep;
                const isCompleted = idx < currentStep;
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 text-xs transition-colors duration-300 ${
                      isActive
                        ? "text-blue-400 font-medium"
                        : isCompleted
                        ? "text-slate-500"
                        : "text-slate-600"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-4 h-4 border border-[#374151] rounded-full shrink-0 mt-0.5" />
                    )}
                    <span>{stepText}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 bg-red-950/40 border border-red-900/50 rounded-lg p-3 text-xs text-red-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
