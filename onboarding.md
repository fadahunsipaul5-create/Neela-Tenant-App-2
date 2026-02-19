# Tenant Dashboard Onboarding Tour – Implementation Plan

## Overview

A product-tour style onboarding that runs the first time a tenant lands on the dashboard. The tour steps through every major section with a popup and optional auto-advance. Users can also use Next/Previous buttons.

---

## Phase 1: Foundation ✅

**Goal:** Set up the onboarding system and persistence.

1. **First-time detection** ✅
   - [x] Use `localStorage` (e.g. `tenant_onboarding_completed`) to detect first visit.
   - [x] If not completed → show tour; if completed → skip.
   - [x] Add a way (e.g. “Restart Tour” in settings or help) to run the tour again.

2. **Tour engine** ✅
   - [x] Create a reusable tour component/hook that:
     - [x] Accepts steps (target element + content).
     - [x] Highlights the target and shows a popup.
     - [x] Supports Next, Previous, and Skip.
     - [x] Supports optional auto-advance (e.g. after 5–8 seconds).
     - [x] Scrolls target into view and optionally switches tabs when needed.

3. **Step data structure** ✅
   - [x] Each step: `{ id, targetSelector, title, body, tab? }`
   - [x] `tab` optional: switch to Overview/Payments/Maintenance/Documents before showing the step.

---

## Phase 2: Tour Steps (Overview Tab) ✅

**Order and content for each step:**

| # | Target | Title | Message | Status |
|---|--------|-------|---------|--------|
| 1 | Welcome header | Welcome to Your Portal | This is your tenant dashboard. Use this tour to learn how to manage payments, maintenance, and documents. | ✅ |
| 2 | Notifications bell | Notifications | Tap here to jump to your notifications and see rent reminders, updates, and messages. | ✅ |
| 3 | Log out button | Log Out | Use this button to safely sign out of your account. | ✅ |
| 4 | Overview tab | Overview Tab | This is your main dashboard. You’ll see your balance, lease status, and quick actions here. | ✅ |
| 5 | Rent alert banner (if visible) | Rent Due Alert | When rent is due soon or overdue, an alert appears here with a quick “Pay Now” action. | ✅ |
| 6 | Current Balance card | Current Balance | Your total balance (rent and utilities) is shown here. Use “Make Payment” to pay online. | ✅ |
| 7 | Lease Status card | Lease Status | Your lease status (Draft, Sent, Signed) is here. Use the button to view or sign your lease. | ✅ |
| 8 | Quick Actions – Request Repair | Request Repair | Use this to submit a repair or maintenance request. | ✅ |
| 9 | Quick Actions – Message Manager | Message Manager | Opens the Documents tab where you can send a message to your property manager. | ✅ |
| 10 | Quick Actions – Upload proof | Upload Proof of Payment | Use this after making a payment to upload a screenshot or receipt for verification. | ✅ |
| 11 | Notifications section | Notifications | All your updates and alerts appear here. Scroll to this section to stay informed. | ✅ |

---

## Phase 3: Tour Steps (Payments Tab) ✅

| # | Target | Title | Message | Status |
|---|--------|-------|---------|--------|
| 12 | Payments tab | Payments Tab | Switch here to manage all payment-related tasks. | ✅ |
| 13 | Payment History sub-tab | Payment History | View past payments, dates, amounts, and statuses. Download receipts for paid items. | ✅ |
| 14 | Payment Options sub-tab | Payment Options | See how to pay (Zelle, CashApp, Venmo, etc.) and upload proof after paying. | ✅ |
| 15 | Total Balance card (Payments) | Total Balance & Pay Now | Your balance summary. Use "Pay Now" to open the payment modal or upload proof. | ✅ |
| 16 | Payment History table | Payment List | All your rent and utility payments. Paid items have a receipt download button. | ✅ |
| 17 | Digital Payments section | Digital Payments | Instructions for Zelle, CashApp, Venmo, Apple Pay, ACH, and card payments. | ✅ |
| 18 | Cash Payments section | Cash Payments | Instructions for paying with cash at the office. | ✅ |
| 19 | Upload proof section | Upload Proof | After paying, attach a screenshot or receipt here. The manager will review and confirm. | ✅ |

---

## Phase 4: Tour Steps (Maintenance Tab) ✅

| # | Target | Title | Message | Status |
|---|--------|-------|---------|--------|
| 20 | Maintenance tab | Maintenance Tab | Switch here for repair and maintenance requests. | ✅ |
| 21 | New Request button | New Request | Click to open the form for submitting a repair or maintenance ticket. | ✅ |
| 22 | Maintenance form (if visible) | Submit a Ticket | Describe the issue, pick a category and urgency, add photos, and submit. AI can suggest urgency. | ✅ |
| 23 | My tickets list | Your Tickets | See status of all your maintenance requests: Open, In Progress, or Resolved. | ✅ |

---

## Phase 5: Tour Steps (Documents Tab) ✅

| # | Target | Title | Message | Status |
|---|--------|-------|---------|--------|
| 24 | Documents tab | Documents Tab | Switch here for leases, notices, and other documents. | ✅ |
| 25 | Official Documents section | Official Documents | View and download your lease, notices, and other documents from the management. | ✅ |
| 26 | Document list item | Document List | Each document shows type and date. Click to download or view the PDF. | ✅ |
| 27 | Notice Archive | Notice Archive | Active compliance notices and lease violations appear here when applicable. | ✅ |
| 28 | Contact Manager section | Contact Manager | Send messages to your property manager. Office hours and phone number are listed here. | ✅ |

---

## Phase 6: Popup UI & Behavior ✅

1. **Popup design** ✅
   - [x] Small arrow/pointer toward the highlighted element.
   - [x] Title (bold).
   - [x] Body text.
   - [x] Footer: Previous | Next (or Finish on last step) | Skip Tour.
   - Step indicator (e.g. “3 / 28”).

2. **Highlighting** ✅
   - [x] Dim overlay on the rest of the page.
   - [x] Spotlight or border around the target element.

3. **Auto-advance** ✅
   - [x] Optional timer (e.g. 6 seconds) to move to the next step.
   - [x] Timer resets when the user clicks Next/Previous.
   - [x] Clear visual cue that auto-advance is active (e.g. progress bar).

4. **Tab switching** ✅
   - [x] When a step belongs to another tab (e.g. Payments, Maintenance, Documents), switch to that tab before highlighting and showing the popup.

---

## Phase 7: Technical Implementation ✅

1. **Targeting elements** ✅
   - [x] Add `data-onboarding` attributes (e.g. `data-onboarding="step-1"`) to each target element.
   - [x] Use `data-onboarding` selectors in the tour config so the tour can find and scroll to them.

2. **Conditional steps** ✅
   - [x] Rent alert: show only if `daysUntilDue <= 3 && residentBalance > 0`.
   - [x] Maintenance form: show only when the form is visible, or skip to “New Request” if not.

3. **Responsiveness** ✅
   - [x] Ensure popups are positioned correctly on mobile.
   - [x] Consider full-width popups on small screens.

4. **Completion** ✅
   - [x] On last “Next” or “Skip”, set `tenant_onboarding_completed = true` in `localStorage`.
   - [ ] Optionally track completion in analytics.

---

## Summary: Elements to Touch

**Overview tab**
- Welcome header
- Notifications bell
- Log out button
- Overview tab
- Rent alert banner (conditional)
- Current Balance card
- Lease Status card
- Quick Actions (Request Repair, Message Manager, Upload proof)
- Notifications section

**Payments tab**
- Payments tab
- Payment History sub-tab
- Payment Options sub-tab
- Total Balance + Pay Now
- Payment History table
- Digital Payments block
- Cash Payments block
- Upload proof section

**Maintenance tab**
- Maintenance tab
- New Request button
- Maintenance form (or New Request explanation)
- My tickets list

**Documents tab**
- Documents tab
- Official Documents header/section
- Document list
- Notice Archive
- Contact Manager section

**Total:** ~28 steps covering the full tenant dashboard.

---

## Order of Execution

1. Phase 1 – Foundation (storage, tour engine, step structure)
2. Phase 2 – Overview steps
3. Phase 3 – Payments steps (with tab switching)
4. Phase 4 – Maintenance steps
5. Phase 5 – Documents steps
6. Phase 6 – Popup UI polish
7. Phase 7 – Data attributes, conditionals, and completion logic

