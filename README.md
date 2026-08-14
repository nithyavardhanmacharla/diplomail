# Diplomail 📜✉️

> **Automated Certificate & Document Email Distribution Platform**

🔗 **Live Demo:** [https://diplomail.netlify.app/](https://diplomail.netlify.app/)

---

## 🌟 Overview

**Diplomail** streamlines the process of sending personalized certificates and documents to hundreds of recipients. Upload your recipient data (CSV/Excel) along with your PDF certificates, and Diplomail will intelligently match, compose, and dispatch emails with real-time tracking.

## ✨ Key Features

- 🔍 **Smart Filename Matching** – Intelligent fuzzy matching (Levenshtein distance) maps recipient names or IDs directly to PDF certificates.
- ⚡ **Throttled Bulk Sending** – Rate-limited email dispatch with pause & resume controls to safeguard sender reputation and SMTP limits.
- 👁️ **Read-Receipt & Status Tracking** – Multi-stage tracking (Sent → Delivered → Seen) with tracking pixels and delivery reports.
- 📝 **Rich Dynamic Templates** – Personalized email body and subject line templating with variable substitution.
- 🔒 **Custom SMTP Support** – Connect with Gmail, Outlook, Amazon SES, SendGrid, or custom SMTP servers.
- 📊 **Detailed Batch Reports** – Comprehensive logs and exportable reports for every distribution campaign.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or newer recommended)
- npm, yarn, or pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nithyavardhanmacharla/diplomail.git
   cd diplomail
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Tech Stack

- **Framework:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS, Framer Motion, Lucide Icons
- **PDF & File Processing:** `pdf-lib`, `unpdf`, `jszip`, `xlsx`, `papaparse`
- **Email Delivery:** `nodemailer`

---

## 🌐 Deployment

Try the live version at: **[https://diplomail.netlify.app/](https://diplomail.netlify.app/)**
