import { useState, useCallback, lazy, Suspense } from "react";
import HeroPage from "./HeroPage";
import { parseFile } from "./lib/parseFile";
import { cleanDataset, type CleaningReport } from "./lib/cleanData";
import { analyzeData, type AnalysisResult } from "./lib/analyzeData";

const DynamicDashboard = lazy(() => import("./DynamicDashboard"));

export default function App() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [cleaningReport, setCleaningReport] = useState<CleaningReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileLoaded = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const parsed = await parseFile(file);
      const cleaned = cleanDataset(parsed.rows, parsed.columns);
      setCleaningReport(cleaned.report);
      const result = analyzeData(cleaned.rows, cleaned.columns, parsed.fileName);
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
    setCleaningReport(null);
    setError(null);
  }, []);

  if (analysis) {
    return (
      <Suspense fallback={
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Loading dashboard...</p>
        </div>
      }>
        <DynamicDashboard analysis={analysis} cleaningReport={cleaningReport} onReset={handleReset} />
      </Suspense>
    );
  }

  return (
    <HeroPage
      onFileLoaded={handleFileLoaded}
      isProcessing={isProcessing}
      error={error}
    />
  );
}
