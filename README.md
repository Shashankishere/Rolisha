# 🧭 Rolisha

### Your career direction, built around the skills real jobs require.

**Rolisha** is an AI-powered career development platform that helps students and early-career professionals turn their current skills, career goals, available learning time, and target salary into a structured path toward becoming job-ready.

Instead of relying on generic career advice, Rolisha combines personalized skill-gap analysis, structured learning roadmaps, portfolio projects, assessments, and job-market data to help users understand **what to learn, what to build, and what opportunities to target next**.

---

## ✨ What Rolisha Does

Rolisha brings career planning, learning, projects, assessments, and job discovery into one platform.

### 🎯 Personalized Career Roadmaps

Generate a structured multi-month roadmap based on:

* Target career
* Current education
* Existing skills
* Skill proficiency
* Weekly learning availability
* Target salary
* Preferred location
* Career goals

Each roadmap breaks the journey into manageable learning stages with tasks, milestones, projects, and assessments.

### 🧩 Skill-Gap Analysis

Understand the difference between your current capabilities and the skills commonly required for your target role.

The platform helps identify:

* Existing strengths
* Skills that need improvement
* Missing skills
* Learning priorities
* Career-readiness progress

### 📚 Structured Learning

Turn the roadmap into an actionable learning system.

Users can:

* Follow roadmap topics
* Complete learning tasks
* Track progress
* Work through assessments
* Build projects
* Continue from their current learning stage

### 💻 Portfolio Projects

Get project recommendations aligned with your career direction and skill gaps.

Projects can help users develop practical experience while building a stronger portfolio.

### 🧪 Assessments

Evaluate knowledge through skill-focused assessments and use the results to track learning progress.

### 💼 Job Discovery

Explore relevant job opportunities using external job-market data.

Job information can include:

* Role
* Company
* Location
* Remote status
* Salary when provided by the source
* Required skills
* Job description
* Original job source

Rolisha preserves provider-supplied salary information and does not fabricate job listings or salary figures.

### 📄 Resume Analysis

Pro users can analyze their resume and receive structured feedback designed around their career direction.

### 🎤 Interview Preparation

Pro functionality includes interview preparation and personalized interview practice workflows to help users prepare for their target roles.

### 🔄 Career Switching

Users exploring a career transition can use the platform to understand the skills and learning path involved in moving toward another role.

---

## 🧠 AI-Powered Career Intelligence

Rolisha uses server-side AI workflows to support career planning and personalization.

AI-assisted functionality includes:

* Career roadmap generation
* Skill-gap interpretation
* Project recommendations
* Learning-plan personalization
* Resume analysis
* Interview preparation
* Career recommendations

AI responses are validated before being used by the application, helping keep structured outputs predictable and safe for downstream features.

The AI layer is implemented server-side so provider credentials are not exposed to the browser.

---

## 🏗️ Technology Stack

| Layer                 | Technology                                        |
| --------------------- | ------------------------------------------------- |
| Frontend              | React + TypeScript                                |
| Application Framework | TanStack Start                                    |
| Routing               | TanStack Router                                   |
| Data Fetching         | TanStack Query                                    |
| Styling               | Tailwind CSS                                      |
| UI Components         | shadcn/ui                                         |
| Icons                 | Lucide                                            |
| Charts                | Recharts                                          |
| Authentication        | Supabase Auth                                     |
| Database              | Supabase PostgreSQL                               |
| Security              | PostgreSQL Row Level Security                     |
| AI                    | Groq-compatible server-side AI integration        |
| Job Data              | Adzuna adapter                                    |
| Validation            | Zod                                               |
| Testing               | Vitest + Playwright                               |
| Build/Deployment      | Vite + Nitro / Cloudflare-compatible architecture |

---

## 🏛️ Architecture

```text
                         ┌─────────────────────┐
                         │      Rolisha UI     │
                         │ React + TypeScript  │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │ TanStack Start     │
                         │ Router + Query      │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
             ┌──────▼──────┐ ┌────▼─────┐   ┌──────▼──────┐
             │ Server      │ │ AI Layer │   │ Job Adapter │
             │ Functions   │ │ Groq     │   │ Adzuna      │
             └──────┬──────┘ └──────────┘   └──────┬──────┘
                    │                              │
                    └──────────────┬───────────────┘
                                   │
                         ┌─────────▼─────────┐
                         │ Supabase          │
                         │ PostgreSQL + Auth │
                         │ + RLS             │
                         └───────────────────┘
```

---

## 🔐 Security

Security is treated as a core part of the application architecture.

Rolisha uses:

* Supabase Authentication
* PostgreSQL Row Level Security
* Server-side AI calls
* Environment-based secrets
* Zod input validation
* Protected application routes
* Protected administrative functionality
* User-scoped database access
* Private, non-cacheable sensitive API responses
* Friendly user-facing error handling

**No secret API keys should be committed to the repository.**

Create your local environment from:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then populate the required environment variables locally.

---

## 💳 Subscription Model

Rolisha currently uses two user-facing plans:

### Free

Designed for users getting started with career planning.

Includes limited access to:

* Career roadmaps
* Projects
* Assessments
* Learning content

### Pro

Provides expanded access to the platform, including:

* Full roadmap access
* Unlimited learning
* Unlimited projects
* Unlimited assessments
* Resume analysis
* Resume optimization
* Interview preparation
* Personalized interview questions
* Mock interviews
* Career switching workflows
* AI career recommendations

Feature access is enforced through application-level subscription gating rather than relying only on frontend UI restrictions.

---

## 📊 Career Roadmap System

A core design requirement is that a user's weekly learning capacity is treated as a **hard maximum**.

For example, if a user specifies:

```text
6 hours/week
```

the generated weekly plan must not allocate more than:

```text
6 hours
```

Tasks are allocated using whole-hour values because roadmap hour fields are stored as PostgreSQL integers.

This prevents invalid fractional-hour values and keeps the learning plan consistent with the user's available schedule.

---

## 💼 Job Data Integrity

Rolisha can integrate external job data through an adapter-based architecture.

The application distinguishes between:

* Live job data
* Available catalogue data
* No matching jobs
* Temporarily unavailable job sources

The platform does not intentionally fabricate:

* Companies
* Job postings
* Salary figures
* Job URLs
* Job-market statistics

When salary information is available, the provider's currency is preserved.

For example:

```text
₹8–12 LPA
$80K–$100K
```

rather than incorrectly converting or relabeling the original provider data.

---

## 🗄️ Database

Rolisha uses Supabase PostgreSQL with migrations managed through the Supabase CLI.

Core data areas include:

* User profiles
* Careers
* Skills
* User skills
* Jobs
* Job sources
* Roadmaps
* Roadmap months
* Roadmap tasks
* Projects
* Learning resources
* Assessments
* Assessment attempts
* Applications
* Progress tracking
* Subscription data

Database access is protected using PostgreSQL Row Level Security policies.

---

## 🧪 Testing

The project includes automated testing across application logic, server functionality, security-sensitive workflows, and responsive behavior.

Run the test suite with:

```bash
npm test
```

Type checking:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

Linting:

```bash
npm run lint
```

For browser-level testing where configured:

```bash
npx playwright test
```

---

## 🚀 Local Development

### 1. Clone the repository

```bash
git clone https://github.com/Shashankishere/Rolisha.git
cd Rolisha
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```powershell
Copy-Item .env.example .env
```

Add the required Supabase, AI, job-data, and application configuration values to `.env`.

### 4. Start development server

```bash
npm run dev
```

The development server will provide the local application URL in the terminal.

---

## 🗂️ Project Structure

```text
Rolisha/
├── docs/
├── public/
├── scripts/
├── server/
│   └── tasks/
├── src/
│   ├── components/
│   ├── routes/
│   ├── lib/
│   └── ...
├── supabase/
│   ├── migrations/
│   └── ...
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🔄 Scheduled Job Synchronization

Rolisha includes server-side scheduled job synchronization infrastructure.

The scheduled workflow is designed to:

1. Fetch available job data.
2. Normalize incoming records.
3. Validate records.
4. Insert or update jobs.
5. Record synchronization status.
6. Handle malformed individual records without aborting the complete batch.
7. Track successful and failed synchronization runs.

The application is structured to support scheduled execution in the production deployment environment.

---

## 🌐 Production Considerations

Before deploying a production instance, configure:

* Supabase project
* Supabase Auth providers
* Database migrations
* Row Level Security policies
* AI provider credentials
* Job provider credentials
* Application secrets
* Subscription/billing configuration
* Scheduled job synchronization
* Production domain
* OAuth redirect URLs

Never commit `.env` or production credentials to Git.

---

## 🎨 Product Principles

Rolisha is designed around a few core principles:

### Real-world relevance

Career recommendations should be connected to actual role requirements and available job data whenever possible.

### Actionable guidance

The platform should tell users what they can work on next rather than simply displaying information.

### Transparent data

Live job-market information should be distinguished from unavailable or non-live information.

### Practical learning

Learning should lead toward projects, assessments, and demonstrable skills.

### User-controlled progress

Users decide their learning pace and can track their own progress through the roadmap.

### Secure by default

Authentication, authorization, database policies, and server-side secrets are treated as first-class concerns.

---

## 🛣️ Roadmap

Future development may include:

* Deeper job-market analytics
* More career paths
* Additional job-data providers
* Expanded learning resources
* More assessment types
* Advanced interview simulations
* Improved career-transition workflows
* Additional personalization capabilities
* Enhanced analytics and progress insights

---

## 👨‍💻 Author

**Shashank Kumar Mishra**

Computer Science student and full-stack developer interested in:

* Software Engineering
* Full-Stack Development
* Artificial Intelligence
* SaaS Products
* Developer Tools
* Career Technology

GitHub:
https://github.com/Shashankishere

---

## 📄 License

This project is currently maintained as a personal software project.

See the repository for the applicable license and usage terms.

---

<p align="center">
  Built with ❤️ for students and early-career professionals.
</p>

