# Rolisha

### Your career path, mapped to what real jobs require.

<p align="center">
  <strong>A career roadmap platform that connects career goals, skills, learning, projects, assessments, and real job-market data.</strong>
</p>

<p align="center">
  <a href="https://rolisha.in/">
    <img src="https://img.shields.io/badge/🚀%20Live%20Demo-rolisha.in-2563EB?style=for-the-badge" alt="Live Demo">
  </a>
  <a href="https://github.com/Shashankishere/Rolisha">
    <img src="https://img.shields.io/badge/💻%20Source%20Code-GitHub-181717?style=for-the-badge&logo=github" alt="Source Code">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-React-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/TanStack-Start-FF4154?style=for-the-badge" alt="TanStack Start">
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Cloudflare-Wrangler-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare">
</p>

---

## 🌐 Live Application

**Rolisha is deployed and available at:**

### 🚀 https://rolisha.in/

The production application is publicly accessible while the complete source code is available on GitHub.

**Source Code:** [github.com/Shashankishere/Rolisha](https://github.com/Shashankishere/Rolisha)

The project is open-source, allowing developers and recruiters to explore the codebase while users can try out the deployed application.

> 🔒 Production credentials, API keys, and secrets are kept outside the repository and are configured through secure environment/deployment settings.

---

# 💡 Why "Rolisha"?

**Rolisha** comes from combining two words:

> **Role + Disha = Rolisha**

**Role** represents the professional career or job role a learner wants to achieve.

**Disha** (दिशा) is a Sanskrit/Hindi word meaning **direction**, **path**, or **guidance**.

Together:

```text
Role + Disha
     ↓
  Rolisha
     ↓
Career Direction
```

The name represents the core idea behind the platform:

> **Helping learners find a clear direction toward their desired career role.**

Instead of simply asking *"What should I learn?"*, Rolisha focuses on:

```text
Where do I want to go?
          ↓
What skills does that role require?
          ↓
What do I already know?
          ↓
What should I learn next?
          ↓
What should I build?
          ↓
How am I progressing?
          ↓
What jobs match my preparation?
```


# 🎯 What is Rolisha?

Rolisha is a **career planning and learning platform** designed to help students and early-career professionals turn a career goal into a structured, actionable roadmap.

A learner can provide information such as:

* Education
* Current skills
* Target career
* Available hours per week
* Target salary
* Location

Rolisha uses these inputs to create a structured career path covering relevant skills, learning topics, projects, assessments, and career preparation.

The platform also incorporates real job-market data so learners can connect their preparation with requirements found in actual job listings.

---

# ✨ Features

<table>
<tr>
<td width="50%">

## 🎯 Personalized Roadmaps

Generate structured career paths based on education, current skills, target role, available time, salary target, and location.

</td>
<td width="50%">

## 🧩 Skill Gap Tracking

Identify skills already known and areas that require additional learning.

</td>
</tr>

<tr>
<td width="50%">

## 📚 Learning System

Follow structured learning topics and track progress throughout the roadmap.

</td>
<td width="50%">

## 💼 Real Job Data

Explore job-market information through an Adzuna-powered job ingestion and normalization pipeline.

</td>
</tr>

<tr>
<td width="50%">

## 🛠️ Projects

Build practical projects alongside learning to turn knowledge into demonstrable work.

</td>
<td width="50%">

## 📝 Assessments

Complete assessments to reinforce concepts and track learning progress.

</td>
</tr>

<tr>
<td width="50%">

## 📊 Progress Dashboard

Monitor roadmaps, skills, learning, projects, assessments, and career preparation from one place.

</td>
<td width="50%">

## 🔐 Authentication

Secure authentication with Supabase, protected routes, and Google OAuth support.

</td>
</tr>

<tr>
<td width="50%">

## 💳 Subscriptions

Razorpay-powered subscription infrastructure with server-side verification and feature gating.

</td>
<td width="50%">

## 📱 Responsive UI

A responsive interface designed for desktop and mobile experiences.

</td>
</tr>
</table>

---

# 🔄 How Rolisha Works

```text
┌──────────────────────┐
│    Create Account    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Define Career Goal   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Add Current Skills   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Generate Roadmap     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Identify Skill Gaps  │
└──────────┬───────────┘
           │
           ▼
     ┌─────┴─────┐
     │           │
     ▼           ▼
  Learning    Projects
     │           │
     └─────┬─────┘
           │
           ▼
      Assessments
           │
           ▼
    Track Progress
           │
           ▼
    Explore Jobs
```

---

# 🏗️ Architecture

Rolisha follows a full-stack TypeScript architecture built around TanStack Start, Supabase, and external service integrations.

```text
                              ┌─────────────────┐
                              │      User       │
                              └────────┬────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │        React UI          │
                         │   Tailwind + shadcn/ui   │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │     TanStack Router      │
                         │      TanStack Query      │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │     TanStack Start       │
                         │     Server Functions     │
                         │          SSR             │
                         └────────────┬─────────────┘
                                      │
             ┌────────────────────────┼─────────────────────────┐
             │                        │                         │
             ▼                        ▼                         ▼
     ┌───────────────┐       ┌────────────────┐       ┌────────────────┐
     │   Supabase    │       │     Adzuna     │       │    Razorpay    │
     │               │       │                │       │                │
     │ PostgreSQL    │       │ Job Data       │       │ Subscriptions  │
     │ Auth          │       │ Ingestion       │       │ Payments       │
     │ RLS           │       │ Normalization   │       │ Verification   │
     └───────┬───────┘       └────────────────┘       └────────────────┘
             │
             ▼
     ┌────────────────────┐
     │   Career Data      │
     │                    │
     │ Roadmaps           │
     │ Skills             │
     │ Learning           │
     │ Projects           │
     │ Assessments        │
     │ Progress           │
     └────────────────────┘
```

---

# 💼 Job Data Pipeline

Rolisha processes job-market data through an ingestion and normalization pipeline.

```text
                    ┌──────────────┐
                    │    Adzuna    │
                    └──────┬───────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ API Job Data    │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   Normalize     │
                  │   Job Data      │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Structured Job  │
                  │     Record      │
                  └────────┬────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
             Job Listings    Job Details
                    │             │
                    └──────┬──────┘
                           ▼
                    Rolisha UI
```

Normalized job information can include:

* Job title
* Company
* Location
* Description
* Experience
* Work mode
* Salary information where available
* Application URL

---

# 🛠️ Tech Stack

### Frontend

| Technology   | Purpose                |
| ------------ | ---------------------- |
| React        | User interface         |
| TypeScript   | Type-safe development  |
| Tailwind CSS | Styling                |
| shadcn/ui    | Reusable UI components |

### Full-Stack Framework

| Technology      | Purpose                          |
| --------------- | -------------------------------- |
| TanStack Start  | Full-stack React framework / SSR |
| TanStack Router | File-based routing               |
| TanStack Query  | Server-state management          |
| Vite            | Development and build tooling    |

### Backend & Database

| Technology         | Purpose                       |
| ------------------ | ----------------------------- |
| Supabase           | Backend platform              |
| PostgreSQL         | Relational database           |
| Supabase Auth      | Authentication                |
| Row Level Security | Database access control       |
| Server Functions   | Server-side application logic |
| Zod                | Runtime validation            |

### External Integrations

| Service      | Purpose               |
| ------------ | --------------------- |
| Adzuna       | Job-market data       |
| Razorpay     | Subscription payments |
| Google OAuth | Authentication        |

### Testing & Deployment

| Technology | Purpose               |
| ---------- | --------------------- |
| Vitest     | Automated testing     |
| ESLint     | Code quality          |
| TypeScript | Static type checking  |
| Cloudflare | Production hosting    |
| Wrangler   | Cloudflare deployment |

---

# 📂 Project Structure

```text
Rolisha/
│
├── src/
│   ├── components/
│   │   └── ...                    # Reusable UI components
│   │
│   ├── lib/
│   │   ├── auth/
│   │   │   └── ...                # Authentication
│   │   │
│   │   ├── jobs/
│   │   │   ├── description.ts     # Job description processing
│   │   │   ├── normalize.ts       # Job normalization
│   │   │   └── ...                # Job ingestion
│   │   │
│   │   ├── payments/
│   │   │   └── ...                # Razorpay integration
│   │   │
│   │   └── ...                    # Core application logic
│   │
│   └── routes/
│       ├── _authenticated/
│       │   └── ...                 # Protected routes
│       └── ...
│
├── supabase/
│   └── migrations/                 # Database migrations
│
├── public/                         # Static assets
├── docs/                           # Documentation & screenshots
│
├── .env.example                    # Environment template
├── package.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.jsonc
```

---

# 🚀 Getting Started

## Prerequisites

You need:

* Node.js
* npm
* Git
* A Supabase project
* Required third-party API credentials

---

## 1. Clone the repository

```bash
git clone https://github.com/Shashankishere/Rolisha.git
cd Rolisha
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure environment variables

Create your local environment file using the repository template:

```bash
cp .env.example .env
```

Configure the required Supabase, authentication, Adzuna, Razorpay, and application variables.

> Never commit `.env` or production credentials.

---

## 4. Start the development server

```bash
npm run dev
```

Open the local URL displayed by the development server.

---

# 🧪 Testing

Rolisha uses automated testing and static validation to protect application behavior.

### Full test suite

```bash
npm test
```

### TypeScript validation

```bash
npx tsc --noEmit
```

### Production build

```bash
npm run build
```

### Git diff validation

```bash
git diff --check
```

### Recommended pre-deployment checks

```bash
npm test
npx tsc --noEmit
npm run build
git diff --check
```

---

# 🔐 Security

Rolisha uses multiple layers of security:

* Supabase Authentication
* PostgreSQL Row Level Security
* Protected authenticated routes
* Server-side authorization
* Zod input validation
* Server-side payment verification
* Secure environment variables
* Subscription/webhook synchronization

Production secrets should never be stored in the Git repository.

---

# 💳 Payment System

Rolisha uses Razorpay for subscription payments.

Payment-sensitive operations are handled server-side and subscription/payment information is verified before updating application state.

The current customer-facing pricing flow is configured for:

```text
Region   → India
Currency → INR (₹)
```

Payment credentials and account configuration are managed outside the public repository.

---

# ☁️ Deployment

Rolisha is deployed using **Cloudflare** with **Wrangler**.

## Cloudflare authentication

```bash
npx wrangler login
```

## Production build

```bash
npm run build
```

## Deploy

```bash
npx wrangler deploy
```

### Production URL

**https://rolisha.in/**

---

# 🔄 Production Release Workflow

A typical production release follows:

```text
Code Change
    ↓
Run Tests
    ↓
TypeScript Check
    ↓
Production Build
    ↓
Review Git Diff
    ↓
Commit
    ↓
Push to GitHub
    ↓
Deploy with Wrangler
    ↓
Verify Production
```

Recommended commands:

```bash
git status
git fetch origin
git pull --rebase origin main

npm test
npx tsc --noEmit
npm run build
git diff --check

git add .
git commit -m "describe your change"
git push origin main

npx wrangler deploy
```

> Review `git status` and `git diff` before using `git add .` if unrelated changes are present.

---

# 🗄️ Database Migrations

Database changes are managed through Supabase migrations.

Migration files are located at:

```text
supabase/migrations/
```

When deploying database-related changes, ensure the required migrations have been applied to the target Supabase environment before depending on the new schema or data.

---

# 🌱 Product Vision

Career planning often separates several different activities:

```text
Career Advice
      +
Learning Resources
      +
Projects
      +
Assessments
      +
Job Searching
```

Rolisha connects these into a single workflow:

```text
Career Goal
     ↓
Required Skills
     ↓
Skill Gap
     ↓
Learning
     ↓
Projects
     ↓
Assessments
     ↓
Progress
     ↓
Real Job Market
```

The goal is to give learners a clearer and more actionable path from **career intention to career preparation**.

---

# 🗺️ Future Development

Areas for continued development include:

* Expanding supported career paths
* Improving job-market insights
* Expanding learning content
* Improving skill recommendations
* Enhancing progress analytics
* Expanding career preparation workflows

---

# 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

### Development workflow

1. Fork the repository.
2. Create a feature branch.

```bash
git checkout -b feature/your-feature
```

3. Make your changes.
4. Add or update tests.
5. Run the validation suite.

```bash
npm test
npx tsc --noEmit
npm run build
```

6. Commit your changes.

```bash
git commit -m "feat: describe your change"
```

7. Push your branch and open a pull request.

---

# 👨‍💻 Author

## Shashank Kumar Mishra

**Computer Science Student • Full Stack Developer • AI & Software Enthusiast**

Building ideas into real products.

<p align="center">
  <a href="https://github.com/Shashankishere">
    <img src="https://img.shields.io/badge/GitHub-Shashankishere-181717?style=for-the-badge&logo=github" alt="GitHub">
  </a>
  <a href="https://rolisha.in/">
    <img src="https://img.shields.io/badge/Website-Rolisha-2563EB?style=for-the-badge" alt="Rolisha Website">
  </a>
</p>

---

# 📄 License

Rolisha is licensed under the MIT License.

See the [LICENSE](LICENSE) file for the full license text.

---

<p align="center">
  <strong>Rolisha</strong><br>
  <em>Role + Disha — Direction toward your desired career role.</em>
  <br><br>
  <a href="https://rolisha.in/">🚀 Visit Rolisha</a>
  &nbsp; • &nbsp;
  <a href="https://github.com/Shashankishere/Rolisha">💻 View Source</a>
</p>
