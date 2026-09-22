# Career Compass AI

Build a production-ready full-stack SaaS web application called CareerPath AI.

PRODUCT VISION

CareerPath AI helps students and early-career professionals understand exactly what they need to learn to qualify for real jobs.

The core experience is:

User enters:

Target job role

Current education

Current skills

Hours available per week

Target salary

Preferred location

Experience level

The application analyzes relevant real-world job requirements and compares them with the user's current skills.

It then generates:

A personalized 6-month learning roadmap

A skill-gap analysis

A weekly learning plan

Recommended projects

Recommended resources

Internship/job recommendations

A continuously updated "Job Readiness Score"

A percentage showing how much of the required skill set the user already knows

Example:

TARGET ROLE
Data Analyst

CURRENT SKILLS
Excel, Python basics

ANALYSIS

You already know 40% of the commonly requested skills.

Strong:
✓ Excel
✓ Basic Python

Needs improvement:
○ SQL
○ Statistics
○ Power BI
○ Data visualization
○ Business analytics

6-MONTH ROADMAP

Month 1 → Advanced Excel
Month 2 → SQL
Month 3 → Statistics
Month 4 → Power BI
Month 5 → Data Analyst projects
Month 6 → Internship + interview preparation

The most important feature is that the roadmap must be derived from actual job requirements rather than generic career advice.

BRAND

Product name:
CareerPath AI

Tagline:
"Stop guessing what to learn. Learn what real jobs require."

Alternative headline:
"Your career roadmap, built from real job requirements."

Tone:

Modern

Trustworthy

Student-friendly

Professional

Data-driven

Encouraging without being childish

Do NOT make it look like a generic AI chatbot.

It should feel like a serious career intelligence SaaS product.

DESIGN SYSTEM

Create a premium modern SaaS interface.

Style:

Clean white/light background

Dark navy text

Subtle gradients

Blue/purple accent colors

Rounded cards

Soft shadows

Large readable typography

Generous spacing

Minimal but polished animations

Use:

React

TypeScript

Tailwind CSS

shadcn/ui

Lucide icons

Recharts

The UI must be responsive for:

Desktop

Tablet

Mobile

Use accessible contrast and keyboard navigation.

Add tasteful Framer Motion-style animations where appropriate, but do not over-animate.

PUBLIC WEBSITE

Create these public pages:

/
Landing page

/features
Product features

/how-it-works
How CareerPath AI works

/careers
Supported career paths

/pricing
Pricing page

/about
About

/contact
Contact

/privacy
Privacy policy

/terms
Terms of service

LANDING PAGE

Hero section:

"Stop guessing what to learn.
Learn what real jobs require."

Subheading:

"CareerPath AI compares your skills with real job requirements and builds a personalized roadmap to help you become job-ready."

Primary CTA:
"Build My Career Roadmap"

Secondary CTA:
"See How It Works"

Add a visual dashboard preview showing:

Job:
Data Analyst

Readiness:
42%

Skills:
Excel ✓
SQL 20%
Statistics 10%
Power BI 0%
Python 60%

Then show:

"Based on 247 relevant job postings"

Add sections:

How it works

Skill-gap analysis

Personalized roadmap

Real job intelligence

Project recommendations

Progress tracking

Internship readiness

Testimonials

FAQ

Final CTA

AUTHENTICATION

Use Supabase Auth.

Support:

Email/password signup

Email/password login

Google OAuth

Password reset

Logout

Protected dashboard routes

After signup, send the user to onboarding.

ONBOARDING

Create a multi-step onboarding wizard.

Step 1:
What job do you want?

Examples:

Data Analyst

Software Engineer

Frontend Developer

Backend Developer

Data Scientist

Cybersecurity Analyst

Product Manager

UI/UX Designer

Allow custom roles.

Step 2:
Education

Options:

High school

Diploma

Bachelor's

Master's

PhD

Other

Fields:

Degree

Field of study

Graduation year

Step 3:
Current skills

Allow users to select skills and assign confidence levels:

Beginner
Intermediate
Advanced

Allow custom skills.

Step 4:
Experience

No experience

<1 year

1–2 years

2–5 years

5+ years

Step 5:
Hours available per week

Slider:
1–40 hours

Step 6:
Target salary

Allow:

Currency

Minimum salary

Desired salary

Step 7:
Location

Allow:

Country

City

Remote preference

Hybrid

On-site

Step 8:
Generate roadmap.

Show a beautiful loading experience explaining:

"Analyzing job requirements..."
"Identifying required skills..."
"Comparing your current skills..."
"Building your roadmap..."

Then redirect to dashboard.

MAIN DASHBOARD

Create a premium career dashboard.

Header:

"Good morning, {name}"

"Your path to becoming a Data Analyst"

Main readiness card:

JOB READINESS

42%

"You're approximately 42% of the way toward the current skill profile for your target role."

Use an animated circular progress indicator.

Also display:

Required skills: 12
Skills mastered: 5
Skills in progress: 3
Skills missing: 4

SKILL GAP ANALYSIS

Create a skill matrix.

Columns:

Skill | Importance | Your Level | Required Level | Gap | Status

Example:

Excel
High
Advanced
Advanced
0%
Ready

SQL
Critical
Beginner
Advanced
65%
Needs Work

Statistics
High
Beginner
Intermediate
55%
Needs Work

Power BI
High
None
Intermediate
100%
Missing

Python
Medium
Intermediate
Intermediate
0%
Ready

Visualize this with:

Progress bars

Donut charts

Radar chart

Skill cards

Use color/status indicators consistently.

REAL JOB INTELLIGENCE

This is the core differentiator.

Create a "Job Market Intelligence" section.

Show:

"Based on current job requirements"

Metrics:

Jobs analyzed
Average experience required
Most requested skills
Salary range
Remote availability
Top locations

Example:

247 jobs analyzed

Most requested skills:
SQL — 84%
Excel — 76%
Power BI — 61%
Python — 48%
Tableau — 35%

The system should NOT claim these numbers are real unless actual job data has been retrieved.

If job APIs are not connected yet, use clearly labeled demo/mock data.

Never fabricate real job-posting statistics.

JOB REQUIREMENT ENGINE

Create a backend architecture that can ingest job postings.

Each job should contain:

job title

company

location

remote status

salary if available

description

required skills

preferred skills

experience requirement

education requirement

source

source URL

posting date

retrieved date

Normalize skills into a canonical skills database.

For example:

"Structured Query Language"
"SQL"
"SQL Server"

can map to a normalized skill such as:

SQL

Similarly:

"Microsoft Power BI"
"Power BI"

→ Power BI

Do not scrape websites in a way that violates their terms.

Create an adapter-based architecture so legitimate APIs/job feeds can be connected later.

CAREER ROADMAP ENGINE

Create an AI-powered roadmap generator.

Inputs:

target role

current skills

skill proficiency

hours/week

target salary

location

job market requirements

preferred learning style

Output:

6-month roadmap.

Each month contains:

goals

skills

estimated hours

learning resources

exercises

project

milestone

assessment

Example:

MONTH 1
Advanced Excel

Estimated time:
25 hours

Topics:

Pivot tables

XLOOKUP

Power Query

Data cleaning

Conditional formatting

Dashboard creation

Project:
"Sales Performance Dashboard"

Milestone:
"Build a dashboard from a raw CSV dataset."

WEEKLY PLAN

Break every month into weekly tasks.

Example:

Week 1
Excel formulas
5 hours

Week 2
Pivot tables
5 hours

Week 3
Power Query
6 hours

Week 4
Excel dashboard
8 hours

Allow users to mark tasks complete.

Persist progress in Supabase.

PROJECT GENERATOR

Recommend portfolio projects based on skill gaps.

Each project should contain:

title

difficulty

estimated hours

skills demonstrated

dataset suggestion

project requirements

expected output

GitHub README outline

resume bullet suggestion

Example:

"Customer Churn Analysis Dashboard"

Skills:
SQL
Excel
Power BI
Statistics

Difficulty:
Intermediate

Estimated time:
15 hours

RESOURCE RECOMMENDATIONS

Each roadmap topic should have resources.

Categories:

Documentation

Courses

Videos

Books

Practice platforms

Projects

Resources must be stored separately so they can be updated.

Do not invent URLs.

Allow admins to manage resources.

JOB RECOMMENDATIONS

Create a "Jobs You Can Target" page.

For each job show:

Company
Role
Location
Salary if available
Match percentage
Required skills
Missing skills
Experience requirement

Example:

Data Analyst
Company Name

82% Match

✓ Excel
✓ SQL
✓ Power BI
⚠ Statistics

Button:
"View Job"

Clicking should open the original job source.

Never fabricate companies, jobs, salary data, or job URLs.

JOB MATCH SCORE

Build a transparent matching algorithm.

Example weighted factors:

Skills: 55%
Experience: 15%
Education: 10%
Location: 10%
Salary alignment: 10%

Make weights configurable.

Show users WHY they received their score.

Example:

Skill match: 72%
Experience match: 90%
Education match: 100%
Location match: 80%
Salary match: 70%

Overall:
79%

CONTINUOUS PROGRESS

The dashboard should update as users complete learning tasks.

Example:

Yesterday:
40%

Today:
43%

After completing SQL:
48%

Show a progress timeline.

Track:

completed skills

completed roadmap tasks

projects

assessments

job applications

JOB READINESS CHECK

Create a "Check My Readiness" feature.

Ask:

"What have you completed?"

Then compare completed skills with current job requirements.

Output:

READY FOR:
Junior Data Analyst

ALMOST READY:
Business Intelligence Analyst

NOT YET:
Senior Data Analyst

Explain the reasoning.

ASSESSMENTS

Create lightweight skill assessments.

Examples:

SQL assessment
Excel assessment
Statistics assessment
Power BI assessment

Store:

questions

answers

score

skill

difficulty

After assessment update skill confidence.

For example:

SQL confidence:
Beginner → Intermediate

Then recalculate readiness.

APPLICATION TRACKER

Create a job application tracker.

Statuses:

Saved
Applied
Interview
Offer
Rejected

Allow:

company

role

URL

salary

date applied

notes

status

Dashboard metrics:

Applications
Interviews
Offers
Response rate

PROFILE

Create profile page with:

education

skills

target role

target salary

location

availability

experience

Allow editing.

ADMIN DASHBOARD

Create protected admin routes.

Admin can manage:

users

careers

skills

job sources

jobs

learning resources

projects

assessments

roadmap templates

Admin dashboard should show:

Total users
Active users
Popular careers
Average readiness
Most missing skills
Jobs analyzed

DATABASE

Use Supabase PostgreSQL.

Create proper normalized tables.

Suggested schema:

profiles
skills
user_skills
careers
career_skills
jobs
job_skills
job_sources
roadmaps
roadmap_months
roadmap_tasks
projects
resources
assessments
assessment_questions
assessment_attempts
applications
progress_events

Use UUID primary keys.

Add:

created_at

updated_at

where appropriate.

Use foreign keys and indexes.

SECURITY

Implement:

Supabase Row Level Security

users can only access their own private profile/progress/application data

admins have separate permissions

never expose service-role keys to frontend

secrets must be environment variables

validate all API inputs

protect admin routes

sanitize user-generated content

rate-limit AI/API endpoints where appropriate

AI ARCHITECTURE

Do not expose the AI API key in frontend code.

Create secure server-side functions.

AI should be responsible for:

Skill-gap interpretation

Roadmap generation

Project recommendations

Learning-plan personalization

Job explanation

AI should NOT invent job-market statistics.

AI should only use supplied job data when making job-market claims.

Create structured JSON outputs from AI so results are predictable.

Validate AI responses before storing them.

AI ROADMAP OUTPUT STRUCTURE

The AI should return structured data containing:

career
summary
readiness_score
skills
skill_gaps
months
weekly_tasks
projects
resources
milestones

Use schema validation.

If AI generation fails, show a useful error and allow retry.

SEARCH

Global search should allow users to search:

careers

skills

jobs

projects

resources

Add filtering.

NOTIFICATIONS

Create notification infrastructure for:

roadmap milestones

weekly goals

assessment results

saved-job reminders

application follow-ups

Initially implement in-app notifications.

Structure the system so email notifications can be added later.

ANALYTICS

Track product events such as:

signup
onboarding_completed
roadmap_generated
task_completed
assessment_completed
project_started
job_saved
application_created

Do not collect unnecessary sensitive personal information.

Create an admin analytics dashboard.

EMPTY STATES

Every page must have useful empty states.

Examples:

"No roadmap yet"
"Complete onboarding to generate your roadmap."

"No saved jobs"
"Save a job to compare it against your skills."

"No projects completed"
"Start your first portfolio project."

ERROR HANDLING

Never show raw technical errors to users.

Create friendly error states.

Include retry actions.

Handle:

API failures

AI failures

authentication errors

database errors

missing job data

invalid forms

network errors

PERFORMANCE

Optimize for production:

lazy-load heavy components

paginate job listings

debounce search

cache suitable data

avoid unnecessary database requests

use indexed database queries

optimize images

avoid huge client bundles

SEO

Implement:

metadata

Open Graph tags

sitemap

robots.txt

semantic HTML

proper page titles

career-specific landing pages

Example SEO pages:

/careers/data-analyst
/careers/software-engineer
/careers/frontend-developer

PWA / MOBILE

Make the application mobile-first and installable as a PWA if practical.

Dashboard must work particularly well on mobile.

DEMO MODE

Create a demo account/data mode so the application looks impressive even before real job APIs are connected.

Clearly label demo data as:

"Demo data — connect job sources to enable live market intelligence."

Do not present demo data as real-world current statistics.

PRICING ARCHITECTURE

Prepare the application for:

Free
Pro
Premium

Free:

one career roadmap

basic skill analysis

limited job matches

Pro:

unlimited roadmaps

advanced job matching

assessments

application tracker

detailed analytics

Premium:

advanced AI career coaching

personalized interview preparation

advanced market intelligence

Do not activate payments until the core product works.

Prepare the database and UI architecture for Stripe later.

CODE QUALITY

Use:

TypeScript

reusable components

clean folder structure

typed API responses

reusable hooks

service layer for API/database logic

environment variables

clear naming

comments only where useful

Do not create one giant component.

Do not duplicate logic.

Do not hardcode user-specific data.

IMPORTANT PRODUCT PRINCIPLES

Real job requirements are the source of truth for market intelligence.

Never fabricate job statistics.

Never fabricate companies or job postings.

Separate demo data from production data.

Make every recommendation explainable.

Make the readiness score transparent.

The roadmap should adapt when the user's skills change.

The application must be useful even when live job APIs are unavailable.

Build the architecture so additional job sources can be plugged in later.

Treat user data as private.

FINAL DELIVERABLE

Generate the complete working application.

Do not build a static mockup.

Build:

frontend

authentication

database schema

backend functions

AI integration architecture

dashboards

onboarding

roadmap

skill tracking

job matching

projects

resources

assessments

application tracker

admin dashboard

responsive UI

error handling

security policies

SEO

demo data

Before considering the application complete, test every major user flow.

The final application should feel like a real startup product that could be shown to investors, recruiters, students, or early users.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
