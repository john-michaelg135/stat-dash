import { useState, useCallback } from "react";
import {
  Upload, FileSpreadsheet, FileJson, FileText,
  BarChart3, TrendingUp, Sparkles, ArrowRight,
  CheckCircle2, AlertCircle,
} from "lucide-react";

interface HeroPageProps {
  onFileLoaded: (file: File) => void;
  isProcessing: boolean;
  error: string | null;
}

export default function HeroPage({ onFileLoaded, isProcessing, error }: HeroPageProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileLoaded(file);
  }, [onFileLoaded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileLoaded(file);
    },
    [onFileLoaded]
  );

  return (
    <div className="hero-page">
      <div className="hero-bg-gradient" />
      <div className="hero-bg-grid" />

      <header className="hero-header">
        <div className="hero-logo">
          <BarChart3 size={28} />
          <span>StatDash</span>
        </div>
        <p className="hero-tagline">Instant analytics from any dataset</p>
      </header>

      <main className="hero-main">
        <div className="hero-text">
          <h1 className="hero-title">
            Drop your data,
            <br />
            <span className="hero-title-accent">get insights instantly</span>
          </h1>
          <p className="hero-description">
            Upload any dataset — JSON, Excel, or CSV — and StatDash will automatically
            analyze your data, determine the best visualizations, and generate a complete
            dashboard with executive summaries, KPIs, and intelligent chart recommendations.
          </p>
        </div>

        <div
          className={`hero-upload-zone ${isDragOver ? "drag-over" : ""} ${isProcessing ? "processing" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isProcessing ? (
            <div className="upload-processing">
              <div className="processing-spinner" />
              <h3>Analyzing your dataset...</h3>
              <p>Detecting columns, generating charts, building insights</p>
            </div>
          ) : (
            <>
              <div className="upload-icon-container">
                <Upload size={32} />
              </div>
              <h3>Drag & drop your dataset here</h3>
              <p>or click to browse files</p>
              <input
                type="file"
                className="upload-input"
                accept=".json,.xlsx,.xls,.csv,.pdf"
                onChange={handleFileInput}
              />
              <div className="upload-formats">
                <span className="format-badge"><FileJson size={14} /> JSON</span>
                <span className="format-badge"><FileSpreadsheet size={14} /> Excel</span>
                <span className="format-badge"><FileSpreadsheet size={14} /> CSV</span>
                <span className="format-badge"><FileText size={14} /> PDF</span>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="hero-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="hero-features">
          <div className="hero-feature">
            <div className="hero-feature-icon"><Sparkles size={20} /></div>
            <h4>Auto-Detection</h4>
            <p>Identifies column types, numeric measures, categories, and time series</p>
          </div>
          <div className="hero-feature">
            <div className="hero-feature-icon"><BarChart3 size={20} /></div>
            <h4>Smart Charts</h4>
            <p>Picks the right chart — bar, line, pie, scatter, and area charts</p>
          </div>
          <div className="hero-feature">
            <div className="hero-feature-icon"><TrendingUp size={20} /></div>
            <h4>Instant Insights</h4>
            <p>Executive summaries, KPI cards, outlier detection, and quality reports</p>
          </div>
        </div>

        <div className="hero-steps">
          <h3>How it works</h3>
          <div className="steps-grid">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h5>Upload</h5>
                <p>Drop your JSON, Excel, CSV, or PDF file</p>
              </div>
            </div>
            <ArrowRight size={20} className="step-arrow" />
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h5>Analyze</h5>
                <p>Auto-detect schema, types & relationships</p>
              </div>
            </div>
            <ArrowRight size={20} className="step-arrow" />
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h5>Visualize</h5>
                <p>Full dashboard with charts & insights</p>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-samples">
          <p className="samples-label">
            <CheckCircle2 size={14} />
            Works with any tabular dataset — sales, finance, inventory, surveys, research, and more
          </p>
        </div>
      </main>
    </div>
  );
}
