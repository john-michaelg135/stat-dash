# Finance Management Dashboard Design Specification

## Overview

A modern desktop finance dashboard designed around a premium SaaS experience. The interface emphasizes readability, hierarchy, whitespace, and quick financial insights through a card-based layout.

The overall design philosophy is:

- Minimal
- Professional
- Data-first
- Soft visual hierarchy
- Financial trustworthiness
- Modern SaaS aesthetic

---

# Design Principles

## 1. Card-Based Layout

Everything lives inside independent cards.

Each card represents one functional block:

- Balance
- Income
- Expenses
- Analytics
- Transactions
- Budget
- Spending
- Investment
- Activity

Cards never visually merge together.

Characteristics:

- Large border radius
- Soft shadows
- White background
- Comfortable padding
- Equal spacing

---

## 2. Strong Information Hierarchy

Visual importance follows:

Primary

Large balance numbers
Main charts
Account summary

Secondary

Income
Expenses
Savings
Investment values

Tertiary

Small labels
Dates
Categories
Supporting metrics

Typography creates hierarchy more than colors.

---

## 3. Calm Color System

Avoid vibrant colors everywhere.

Most UI uses:

White

Light Gray

Very Light Background

Dark Text

Accent colors are only used for:

Positive values

Negative values

Charts

Buttons

Highlights

Never color everything.

---

# Layout Structure

Desktop width:

1440px

Content width:

1200–1320px

Grid:

12 columns

Gap:

24px

Margins:

32px

---

## Sidebar

Width

280px

Contains

Logo

Navigation

Workspace

Settings

Logout

Layout

Logo

Navigation List

Spacer

Bottom Settings

Logout

Navigation Item

Height:

48px

Padding:

16px

Radius:

12px

Active item:

Colored background

White icon

White text

Inactive:

Transparent

Gray icon

Gray text

---

## Top Navigation

Height

80px

Contains

Search

Notifications

Profile

Quick Action

Spacing

24px

Profile

Avatar

Name

Role

Dropdown

---

# Dashboard Content

Layout

Top Summary Cards

↓

Analytics

↓

Charts

↓

Transactions

↓

Bottom Widgets

---

# Summary Cards

Four cards in one row.

Example

Total Balance

Income

Expenses

Savings

Card Size

280×150

Padding

24px

Border Radius

24px

Content

Small label

Large value

Percentage

Mini graph

Trend indicator

---

# Analytics Card

Largest element.

Occupies approximately:

8 columns

Contains

Title

Time selector

Interactive line graph

Legend

Hover points

Statistics

Graph Style

Smooth curves

Rounded joins

Gradient fill

Soft grid

Thin axis

Small labels

---

# Expense Categories

Card

4 columns

Contains

Donut chart

Legend

Percentages

Color coding

Each category

Food

Travel

Shopping

Bills

Health

Entertainment

---

# Transactions Table

Columns

Recipient

Category

Date

Status

Amount

Actions

Rows

56px height

Hover state

Soft gray background

Avatar

Rounded

Status

Completed

Green

Pending

Orange

Failed

Red

---

# Budget Progress

Horizontal progress bars

Category

Spent

Remaining

Percentage

Progress bar

12px height

Rounded

Gradient fill

---

# Investment Widget

Contains

Portfolio Value

Today's Change

Asset List

Mini Charts

Each asset

Logo

Ticker

Price

Daily %

Mini sparkline

---

# Calendar / Activity

Compact widget

Shows

Upcoming bills

Scheduled transfers

Payment reminders

Events

Color coded

---

# Design Tokens

## Border Radius

Small

12px

Medium

16px

Large

24px

Pill

999px

---

## Shadows

Primary

0 12px 30px rgba(15,23,42,0.08)

Secondary

0 6px 18px rgba(15,23,42,0.05)

Hover

0 18px 40px rgba(15,23,42,0.12)

---

## Spacing Scale

4

8

12

16

20

24

32

40

48

64

---

# Typography

Primary Font

Modern geometric sans-serif.

Examples

Inter

Manrope

Plus Jakarta Sans

General Scale

H1

40

700

H2

30

700

Card Title

18

600

Body

15

400

Small Label

13

500

Caption

12

400

Numbers

Use tabular numbers.

---

# Color Palette

## Background

#F6F8FB

---

## Surface

#FFFFFF

---

## Primary Text

#101828

---

## Secondary Text

#667085

---

## Border

#EAECF0

---

## Primary Accent

Blue

#4F7CFF

---

## Success

#22C55E

---

## Warning

#F59E0B

---

## Danger

#EF4444

---

## Purple

#8B5CF6

---

## Cyan

#06B6D4

---

# Buttons

Primary

Blue

White text

48px height

16px radius

Secondary

White

Gray border

Text button

Transparent

Hover

Light gray

---

# Inputs

Height

48px

Radius

14px

Border

1px

Placeholder

Gray

Focus

Blue border

Soft blue glow

---

# Charts

Line Charts

2–3px stroke

Rounded ends

Gradient fill

Animated on load

Donut Charts

20px thickness

Rounded caps

Soft colors

Bar Charts

Rounded corners

12px radius

---

# Icons

Style

Rounded

Outline

24px

Consistent stroke

Examples

Lucide

Heroicons

Remix Icons

---

# Tables

Header

Uppercase

Small

Gray

Rows

56px

Hover

Gray background

Rounded selection

---

# Animations

Duration

200–300ms

Hover

Lift

Shadow increase

TranslateY(-2px)

Cards

Fade in

Charts

Draw animation

Progress bars

Width animation

Buttons

Color transition

---

# Responsive Behavior

Desktop

1440+

Four-column summary

Large charts

Laptop

1024

Two-column cards

Tablet

768

Single-column widgets

Sidebar collapses

Mobile

Bottom navigation

Stacked cards

Scrollable charts

---

# Accessibility

Minimum contrast ratio

4.5:1

Interactive areas

44×44 minimum

Keyboard navigation

Visible focus rings

Charts

Use color plus labels

Never rely on color alone

---

# Component Inventory

Navigation Sidebar

Top Navigation

Search

Profile Menu

Summary Card

Analytics Card

Line Chart

Donut Chart

Bar Chart

Budget Card

Investment Card

Transaction Table

Progress Bars

Notification Panel

Calendar Widget

Activity Feed

Quick Actions

Buttons

Dropdowns

Badges

Tags

Avatar

Statistic Tile

Metric Badge

Empty State

Loading Skeleton

Toast Notifications

Modal

Confirmation Dialog

Pagination

Filters

Date Picker

---

# Overall Visual Style

The dashboard combines:

- Apple-inspired whitespace
- Stripe-like professionalism
- Linear-inspired polish
- Modern fintech data visualization
- Minimal enterprise SaaS aesthetics

The experience prioritizes clarity over decoration, using restrained color, generous spacing, and modular cards to make complex financial information immediately scannable.