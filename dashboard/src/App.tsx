import { useState, useCallback } from "react";
import HeroPage from "./HeroPage";
import DynamicDashboard from "./DynamicDashboard";
import { parseFile } from "./lib/parseFile";
import { analyzeData, type AnalysisResult } from "./lib/analyzeData";

export default function App() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileLoaded = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const parsed = await parseFile(file);
      const result = analyzeData(parsed.rows, parsed.columns, parsed.fileName);
      setAnalysis(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process file.";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  if (analysis) {
    return <DynamicDashboard analysis={analysis} onReset={handleReset} />;
  }

  return (
    <HeroPage
      onFileLoaded={handleFileLoaded}
      isProcessing={isProcessing}
      error={error}
    />
  );
}
