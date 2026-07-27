# Dataset Analyzer Dashboard Specification
## Enterprise-Grade Data Cleaning, Validation, Analysis, Insight Generation, and Visualization

Version: 2.0

---

# Objective

The Dataset Analyzer Dashboard must function as a professional-grade data intelligence platform—not merely a chart generator.

Its responsibilities are to:

- Clean datasets automatically
- Detect and repair common data issues
- Validate every transformation
- Analyze statistically correctly
- Choose only appropriate visualizations
- Generate meaningful insights
- Explain findings transparently
- Verify every metric before display
- Never fabricate information
- Report uncertainty whenever applicable

The system should prioritize **correctness over completeness.**

---

# Core Principles

## 1. Never Guess Data

If information does not exist:

- Say it is unavailable
- Do not estimate
- Do not interpolate unless requested
- Never invent missing values

Bad

Revenue grew 12%.

Good

Revenue growth cannot be calculated because previous period data is unavailable.

---

## 2. Verify Every Calculation

Every displayed metric must be recalculated before rendering.

Examples

Before showing:

Average

Median

Mode

Variance

Growth %

Correlation

Outliers

Trendline

Cluster

Feature importance

Run independent validation.

If mismatch occurs:

Display warning

Recalculate

Never cache incorrect values.

---

## 3. Every Insight Must Be Supported

Every generated insight should reference:

Columns used

Rows used

Statistical method

Confidence

Supporting evidence

Example

✔ Supported Insight

Average customer age increased from 31.4 to 35.2 years.

Based on:

Age column

Grouped by Year

n = 12,543

p < 0.05

---

# Data Loading

Support

CSV

Excel

Parquet

JSON

TSV

SQL

SQLite

PostgreSQL

MySQL

DuckDB

Feather

Apache Arrow

Large datasets (>10M rows)

Streaming datasets

---

# Initial Dataset Inspection

Immediately inspect

Rows

Columns

Memory usage

Data types

Unique values

Null values

Duplicate rows

Duplicate columns

Constant columns

Nearly constant columns

Mixed datatypes

Potential IDs

Potential dates

Potential categorical variables

Potential numeric variables

Potential target variable

Potential index column

Generate dataset profile.

---

# Automatic Data Type Detection

Correctly identify

Integer

Float

Currency

Percentage

Boolean

Category

Ordinal

Nominal

Datetime

Timestamp

Text

Email

Phone

URL

UUID

Latitude

Longitude

ZIP code

Country

State

City

Never trust imported datatype blindly.

Validate content first.

---

# Data Cleaning Pipeline

Execute in order.

## Step 1

Remove duplicate rows

Report:

Rows removed

Percentage removed

Duplicate criteria

---

## Step 2

Remove duplicate columns

Compare values

Hashes

Correlation

Column similarity

---

## Step 3

Fix column names

Trim spaces

Remove hidden characters

Normalize casing

Replace special characters

Keep mapping

Original -> Clean

---

## Step 4

Handle Missing Values

Report

Missing %

Pattern

Random

Systematic

Column-wise

Row-wise

Options

Drop rows

Drop columns

Mean

Median

Mode

Interpolation

Forward fill

Backward fill

KNN

Regression

Multiple imputation

Never impute IDs.

---

## Step 5

Outlier Detection

Methods

IQR

Z-score

Modified Z-score

Isolation Forest

DBSCAN

LOF

Allow user selection.

Never automatically remove.

Mark them.

---

## Step 6

Normalize Text

Trim

Lowercase

Title Case

Unicode normalization

Remove invisible characters

Fix spacing

---

## Step 7

Categorical Cleaning

Merge

YES

Yes

yes

Y

Into

Yes

Detect typos

USA

U.S.A.

United States

US

Merge intelligently.

---

## Step 8

Date Cleaning

Detect

MM/DD/YYYY

DD/MM/YYYY

ISO

Unix timestamps

Timezones

Invalid dates

Leap year issues

Mixed formats

---

## Step 9

Numeric Cleaning

Currency symbols

Commas

Percentages

Scientific notation

Negative values

Infinite values

NaN

Overflow

---

# Validation After Cleaning

Verify

Row count

Column count

No accidental deletions

Primary key uniqueness

Referential integrity

Datatype consistency

No impossible values

Generate cleaning report.

---

# Statistical Analysis

Compute only where valid.

---

## Descriptive Statistics

Count

Mean

Median

Mode

Minimum

Maximum

Range

Variance

Standard deviation

MAD

Quartiles

Percentiles

Skewness

Kurtosis

Entropy

Coefficient of variation

---

## Distribution Analysis

Normality tests

Shapiro

Anderson

Kolmogorov

QQ plots

Histogram

Density estimation

---

## Correlation

Pearson

Spearman

Kendall

Mutual information

Heatmap

Never compute Pearson on categorical data.

---

## Regression

Linear

Polynomial

Logistic

Multiple regression

Check assumptions first.

---

## Classification Metrics

Accuracy

Precision

Recall

F1

ROC

AUC

Confusion matrix

Balanced accuracy

MCC

---

## Clustering

KMeans

DBSCAN

Agglomerative

Silhouette score

Davies-Bouldin

---

## Time Series

Trend

Seasonality

Stationarity

Autocorrelation

Forecast readiness

---

## Categorical Analysis

Frequency

Proportion

Entropy

Chi-square

Cramer's V

---

# Smart Chart Selection

The dashboard must automatically select charts based on data.

Never allow meaningless charts.

---

## Numeric Distribution

Histogram

Boxplot

Violin plot

Density plot

---

## Category Counts

Bar chart

Horizontal bar

Treemap

---

## Time Series

Line chart

Area chart

Rolling average

---

## Relationships

Scatter

Hexbin

Regression line

Bubble chart

---

## Correlation

Heatmap

Cluster map

---

## Composition

Pie ONLY

if <=6 categories

Otherwise

Bar chart

Treemap

Sunburst

---

## Geographic

Map

Choropleth

Bubble map

Latitude-longitude map

---

## High Dimensional

PCA

UMAP

t-SNE

Parallel coordinates

---

# Chart Validation Rules

Every chart must pass validation.

## Verify

Columns exist

Correct datatype

No empty series

No NaNs

No infinite values

Meaningful axis labels

Readable scale

No duplicated legends

Proper aggregation

Correct sorting

No misleading truncation

Correct units

No overlapping labels

If validation fails

Reject chart

Explain why

---

# Insight Engine

Generate

Trends

Anomalies

Correlations

Seasonality

Segments

Clusters

Risk indicators

Business opportunities

Unexpected behavior

Each insight should include

Finding

Evidence

Confidence

Supporting metrics

Limitations

Recommended action

---

Example

Finding

Customers aged 25–34 contribute 48% of total revenue.

Evidence

Revenue grouped by age.

Confidence

High

Limitations

Region data missing.

Recommendation

Increase marketing investment for this demographic.

---

# Insight Quality Rules

Never state

"Interesting"

"Significant"

"Important"

Unless statistically supported.

Instead report

Effect size

Confidence interval

P-value

Sample size

Variance explained

---

# Explainability

Every metric should provide

Formula

Definition

Interpretation

When useful

When misleading

Assumptions

---

# Error Prevention

Detect

Division by zero

Empty datasets

Single-row datasets

Constant columns

Infinite values

NaNs

Mixed units

Duplicate indices

Integer overflow

Floating precision issues

Memory exhaustion

Circular dependencies

---

# Validation Layer

Every dashboard update runs

Data validation

Metric validation

Visualization validation

Insight validation

Consistency validation

---

# Confidence Scoring

Assign confidence.

Very High

High

Medium

Low

Unknown

Based on

Sample size

Missing values

Variance

Statistical assumptions

Model quality

---

# Dashboard Sections

## Dataset Overview

Rows

Columns

Size

Memory

Missing

Duplicates

Data types

---

## Data Quality

Quality score

Completeness

Consistency

Accuracy

Validity

Uniqueness

Integrity

---

## Cleaning Report

Every action logged.

Rows removed

Columns renamed

Missing values handled

Outliers flagged

Datatype corrections

---

## Statistics

Summary

Distribution

Correlations

Feature importance

---

## Visualizations

Only validated charts.

---

## Insights

Ranked by confidence.

---

## Recommendations

Automatically generated.

Examples

Collect more samples

Fix missing data

Remove leakage

Balance classes

Normalize features

Merge categories

---

# Performance Requirements

Support

100M+ rows

Lazy loading

Parallel processing

Chunk processing

GPU acceleration

Caching

Streaming

Memory optimization

Incremental computation

---

# Security

Escape HTML

Prevent code execution

Prevent CSV injection

Prevent formula injection

Prevent SQL injection

Validate uploads

Sanitize filenames

---

# Logging

Record

Cleaning actions

Analysis pipeline

Warnings

Errors

Runtime

Memory

Statistics

Chart generation

Insight generation

---

# Testing Requirements

Every release should include automated tests.

Unit Tests

Metric calculations

Cleaning functions

Chart selection

Type detection

Null handling

Aggregation

Regression metrics

Integration Tests

Upload → Clean → Analyze → Visualize → Insight

Regression Tests

Ensure no metric changes unexpectedly.

---

# Final Quality Checklist

Before displaying any dashboard:

✓ Dataset parsed successfully

✓ Types verified

✓ Missing values analyzed

✓ Duplicates removed or reported

✓ Statistics validated independently

✓ Metrics recalculated

✓ Correlations checked

✓ Charts validated

✓ Visualizations match source data

✓ No misleading scales

✓ Insights backed by evidence

✓ Confidence score assigned

✓ Recommendations justified

✓ Errors logged

✓ Pipeline reproducible

✓ Dashboard internally consistent

✓ No fabricated information

✓ Every displayed number traceable to source rows

---

# Gold Standard Principle

The dashboard should behave like an experienced data scientist:

- Question every assumption.
- Validate every calculation.
- Never fabricate insights.
- Prefer transparency over certainty.
- Surface uncertainty explicitly.
- Make every visualization truthful, statistically appropriate, and directly traceable to the underlying dataset.
- Ensure all transformations are reproducible, logged, and reversible where practical.
- Deliver insights that are actionable, evidence-backed, and proportional to the quality of the available data.