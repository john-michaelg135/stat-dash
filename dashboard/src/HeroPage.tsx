import { useState, useCallback, useRef } from "react";
import {
  Upload, FileSpreadsheet, FileJson, FileText,
  BarChart3, TrendingUp, Sparkles, ArrowRight,
  CheckCircle2, AlertCircle, X, AlertTriangle,
} from "lucide-react";

interface HeroPageProps {
  onFileLoaded: (file: File) => void;
  isProcessing: boolean;
  error: string | null;
}

export default function HeroPage({ onFileLoaded, isProcessing, error }: HeroPageProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const pendingFileRef = useRef<File | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      pendingFileRef.current = file;
      setShowDisclaimer(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        pendingFileRef.current = file;
        setShowDisclaimer(true);
      }
    },
    []
  );

  const handleDisclaimerAccept = useCallback(() => {
    setShowDisclaimer(false);
    if (pendingFileRef.current) {
      onFileLoaded(pendingFileRef.current);
      pendingFileRef.current = null;
    }
  }, [onFileLoaded]);

  const handleDisclaimerCancel = useCallback(() => {
    setShowDisclaimer(false);
    pendingFileRef.current = null;
  }, []);

  return (
    <div className="hero-page">
      <div className="hero-bg-gradient" />
      <div className="hero-bg-grid" />

      <header className="hero-header">
        <div className="hero-logo">
          <BarChart3 size={28} />
          <span>StatDash</span>
          <span className="hero-beta-badge">Beta</span>
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

      {showDisclaimer && (
        <div className="disclaimer-overlay" onClick={handleDisclaimerCancel}>
          <div className="disclaimer-modal" onClick={(e) => e.stopPropagation()}>
            <button className="disclaimer-close" onClick={handleDisclaimerCancel} aria-label="Close disclaimer">
              <X size={20} />
            </button>
            <div className="disclaimer-icon">
              <AlertTriangle size={36} />
            </div>
            <h2 className="disclaimer-title">Early Access Software</h2>
            <p className="disclaimer-text">
              StatDash is currently in <strong>beta</strong> and under active development.
              Features may be incomplete, results may contain inaccuracies, and unexpected
              behavior may occur.
            </p>
            <p className="disclaimer-text">
              Please use this tool responsibly — do not rely solely on its outputs for
              critical decisions. Always verify results against your source data.
            </p>
            <div className="disclaimer-actions">
              <button className="disclaimer-btn-secondary" onClick={handleDisclaimerCancel}>
                Cancel
              </button>
              <button className="disclaimer-btn-primary" onClick={handleDisclaimerAccept}>
                I Understand, Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
