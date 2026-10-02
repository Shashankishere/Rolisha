Rolisha
Your career path, mapped to what real jobs require.
<p align="center"> <strong>An AI-powered career roadmap platform that connects career goals, skills, learning, projects, assessments, and real job-market data.</strong> </p> <p align="center"> <strong>Role + Disha → Rolisha</strong> <br> <em>"Disha" (दिशा) means direction or path.</em> </p> <p align="center"> <a href="https://rolisha.in/"> <img src="https://img.shields.io/badge/🚀%20Live%20Demo-rolisha.in-2563EB?style=for-the-badge" alt="Live Demo"> </a> <a href="https://github.com/Shashankishere/Rolisha"> <img src="https://img.shields.io/badge/💻%20Source%20Code-GitHub-181717?style=for-the-badge&logo=github" alt="Source Code"> </a> </p> <p align="center"> <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"> <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"> <img src="https://img.shields.io/badge/TanStack%20Start-FF4154?style=for-the-badge" alt="TanStack Start"> <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase"> <img src="https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare"> </p>
🚀 Live Demo

Try Rolisha: https://rolisha.in/

Rolisha is a production-deployed career planning SaaS. The source code is publicly available for developers and recruiters to explore.

Production credentials, API keys, and secrets are managed through environment and deployment configuration and are not committed to the repository.

🎯 What is Rolisha?

Most career platforms answer individual questions:

What should I learn?

What skills does a job require?

Which projects should I build?

Where can I find relevant jobs?

Rolisha connects these pieces into one workflow.

Career Goal
     ↓
Required Skills
     ↓
Current Skill Assessment
     ↓
Skill Gap
     ↓
Personalized Roadmap
     ↓
Learning + Projects
     ↓
Assessments
     ↓
Progress Tracking
     ↓
Real Job Market


The goal is simple:

Turn a career goal into an actionable path toward becoming job-ready.

The name represents the same idea:

Role + Disha
     ↓
  Rolisha
     ↓
Career Direction


Role represents the professional role a learner wants to achieve.

Disha (दिशा) means direction, path, or guidance.

Together, Rolisha represents helping learners find a clear direction toward their desired career role.

✨ Key Features
🎯 Personalized Career Roadmaps

Create a roadmap around factors such as:

Target career

Current skills

Education

Available learning time

Target salary

Location

🧩 Skill-Gap Analysis

Understand which skills you already have and which skills need to be developed for your target role.

📚 Structured Learning

Follow learning topics as part of the roadmap and track progress as you move through your preparation.

🛠️ Practical Projects

Build projects alongside your learning so that knowledge turns into demonstrable work.

📝 Assessments

Use assessments to reinforce concepts and measure progress.

💼 Job-Market Integration

Rolisha integrates job-market data through an Adzuna-powered ingestion and normalization pipeline.

Job information can include:

Job title

Company

Location

Description

Experience requirements

Work mode

Salary information when available

Application URL

📊 Progress Dashboard

Track roadmap progress, skills, learning, projects, assessments, and career preparation from one place.

🔐 Authentication

Authentication is handled through Supabase, including protected application routes and Google OAuth.

💳 Subscriptions

Razorpay-powered subscription infrastructure with server-side verification and feature gating.

📱 Responsive Interface

Designed for both desktop and mobile experiences.

📸 Product

Add real production screenshots to docs/screenshots/ before publishing these image references.

Landing Page
<p align="center"> <img src="./docs/screenshots/landing.png" alt="Rolisha landing page" width="900"> </p>
Career Roadmap
<p align="center"> <img src="./docs/screenshots/roadmap.png" alt="Rolisha career roadmap" width="900"> </p>
Dashboard
<p align="center"> <img src="./docs/screenshots/dashboard.png" alt="Rolisha dashboard" width="900"> </p>
Job Explorer
<p align="center"> <img src="./docs/screenshots/jobs.png" alt="Rolisha job explorer" width="900"> </p> <p align="center"> <a href="https://rolisha.in/"> <img src="https://img.shields.io/badge/🚀%20Try%20Rolisha-Live%20Application-2563EB?style=for-the-badge" alt="Try Rolisha"> </a> </p>
🧭 How It Works
┌──────────────────────┐
│    Create Account    │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│   Define Career Goal │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│    Add Your Skills   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│   Generate Roadmap   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│   Identify Skill Gap │
└──────────┬───────────┘
           ↓
      ┌────┴────┐
      ↓         ↓
  Learning   Projects
      └────┬────┘
           ↓
      Assessments
           ↓
    Track Progress
           ↓
     Explore Jobs

🏗️ Architecture

Rolisha uses a full-stack TypeScript architecture built around TanStack Start, React, Supabase, and external service integrations.

                         ┌─────────────────┐
                         │      User       │
                         └────────┬────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │       React UI          │
                    │  Tailwind + shadcn/ui   │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │    TanStack Router      │
                    │     TanStack Query      │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │     TanStack Start      │
                    │ Server Functions + SSR  │
                    └───────────┬─────────────┘
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
             ▼                  ▼                  ▼
      ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
      │  Supabase   │    │   Adzuna    │    │  Razorpay   │
      │             │    │             │    │             │
      │ PostgreSQL  │    │ Job Data    │    │ Payments    │
      │ Auth        │    │ Ingestion   │    │ Subscriptions│
      │ RLS         │    │ Normalize   │    │ Verification│
      └──────┬──────┘    └─────────────┘    └─────────────┘
             │
             ▼
      ┌──────────────────┐
      │   Career Data    │
      │                  │
      │ Roadmaps         │
      │ Skills           │
      │ Learning         │
      │ Projects         │
      │ Assessments      │
      │ Progress         │
      └──────────────────┘

💼 Job Data Pipeline

Job-market data is processed before being surfaced in the application.

┌──────────────┐
│    Adzuna    │
└──────┬───────┘
       ↓
┌──────────────┐
│   Job API    │
│     Data     │
└──────┬───────┘
       ↓
┌──────────────┐
│  Normalize   │
│  Job Data    │
└──────┬───────┘
       ↓
┌──────────────┐
│  Structured  │
│  Job Record  │
└──────┬───────┘
       ↓
┌──────────────────────┐
│      Rolisha UI      │
└──────────────────────┘


This normalization layer allows external job data to be represented consistently inside the application.

🛠️ Tech Stack
Frontend
Technology	Purpose
React	User interface
TypeScript	Type-safe development
Tailwind CSS	Styling
shadcn/ui	Reusable UI components
Application
Technology	Purpose
TanStack Start	Full-stack React framework
TanStack Router	Application routing
TanStack Query	Server-state management
Vite	Development and build tooling
Zod	Runtime validation
Backend & Database
Technology	Purpose
Supabase	Backend platform
PostgreSQL	Relational database
Supabase Auth	Authentication
Row Level Security	Database access control
Server Functions	Server-side application logic
External Services
Service	Purpose
Adzuna	Job-market data
Razorpay	Subscription payments
Google OAuth	Authentication
Testing & Deployment
Technology	Purpose
Vitest	Automated testing
ESLint	Code quality
TypeScript	Static type checking
Cloudflare	Production hosting
Wrangler	Deployment
📂 Project Structure
Rolisha/
├── src/
│   ├── components/          # Reusable UI components
│   ├── lib/
│   │   ├── auth/            # Authentication
│   │   ├── jobs/            # Job ingestion & normalization
│   │   ├── payments/        # Razorpay integration
│   │   └── ...              # Application logic
│   └── routes/
│       ├── _authenticated/  # Protected routes
│       └── ...
│
├── server/
│   └── tasks/               # Server-side tasks
│
├── supabase/
│   └── migrations/          # Database migrations
│
├── public/                  # Static assets
├── docs/                    # Documentation & screenshots
│
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── wrangler.jsonc

🚀 Getting Started
Prerequisites

Node.js

npm

Git

A Supabase project

Required third-party API credentials

1. Clone the repository
git clone https://github.com/Shashankishere/Rolisha.git
cd Rolisha

2. Install dependencies
npm install

3. Configure environment variables
cp .env.example .env


Configure the required application, Supabase, Adzuna, authentication, and Razorpay variables.

Never commit .env or production credentials.

4. Start development
npm run dev


Open the local URL provided by the development server.

🧪 Testing & Validation

Run the test suite:

npm test


Run TypeScript validation:

npx tsc --noEmit


Create a production build:

npm run build


Check for whitespace errors:

git diff --check


Recommended validation before deployment:

npm test
npx tsc --noEmit
npm run build
git diff --check

🔐 Security

Rolisha uses several layers of application security:

Supabase Authentication

PostgreSQL Row Level Security

Protected routes

Server-side authorization

Zod input validation

Server-side payment verification

Secure environment variables

Subscription/webhook synchronization

Production secrets are not stored in the repository.

💳 Payments

Rolisha uses Razorpay for subscription payments.

Payment-sensitive operations are handled server-side, with verification performed before updating subscription-related application state.

The current customer-facing payment flow is configured for:

Region   → India
Currency → INR (₹)


Payment credentials are managed outside the repository.

☁️ Deployment

Rolisha is deployed to Cloudflare using Wrangler.

Authenticate with Cloudflare:

npx wrangler login


Build the application:

npm run build


Deploy:

npx wrangler deploy

Production

https://rolisha.in/

🗄️ Database Migrations

Database changes are managed through Supabase migrations:

supabase/migrations/


When deploying schema changes, ensure the required migrations have been applied to the target Supabase environment.

🗺️ Roadmap

Planned areas of development include:

Expanding supported career paths

Improving job-market insights

Expanding learning content

Improving skill recommendations

Enhancing progress analytics

Expanding career-preparation workflows

🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

Development workflow

Fork the repository.

Create a feature branch:

git checkout -b feature/your-feature


Make your changes.

Add or update tests.

Run the validation suite:

npm test
npx tsc --noEmit
npm run build


Commit your changes:

git commit -m "feat: describe your change"


Push your branch and open a pull request.

👨‍💻 Author
Shashank Kumar Mishra

Full-stack developer building products around AI, career development, and real-world data.

<p align="center"> <a href="https://github.com/Shashankishere"> <img src="https://img.shields.io/badge/GitHub-Shashankishere-181717?style=for-the-badge&logo=github" alt="GitHub"> </a> <a href="https://rolisha.in/"> <img src="https://img.shields.io/badge/Rolisha-2563EB?style=for-the-badge" alt="Rolisha"> </a> </p>
📄 License

See LICENSE for the applicable license and usage terms.

<p align="center"> <strong>Rolisha</strong><br> <em>Role + Disha — a clearer direction toward your desired career.</em> <br><br> <a href="https://rolisha.in/">🚀 Visit Rolisha</a> &nbsp; • &nbsp; <a href="https://github.com/Shashankishere/Rolisha">💻 View Source</a> </p>
