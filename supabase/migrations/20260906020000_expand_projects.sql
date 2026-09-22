-- CONTENT EXPANSION — Phase D (projects)
--
-- Audited: 8 projects existed before this migration, one per original
-- career. This adds 17 new projects spread across the 19 careers added in
-- 20260906010000, each with real difficulty/hours/skills/requirements/
-- expected_output/readme_outline/resume_bullet — matching the exact shape
-- and quality bar of the existing 8, not just a title. career_slug values
-- are joined against public.careers so a typo fails the migration instead
-- of silently leaving career_id NULL.

INSERT INTO public.projects (slug, title, summary, difficulty, estimated_hours, career_id, skills, dataset_suggestion, requirements, expected_output, readme_outline, resume_bullet)
SELECT v.slug, v.title, v.summary, v.diff::public.difficulty_level, v.hours, c.id, v.skills, v.dataset, v.reqs, v.output, v.readme, v.bullet
FROM (VALUES
  (
    'full-stack-ecommerce-platform','Full Stack E-Commerce Platform',
    'Build a working storefront with cart, checkout and an admin panel, end to end.',
    'advanced',35,'full-stack-developer',
    ARRAY['React','Node.js','PostgreSQL','API Design','TypeScript'],
    NULL,
    ARRAY['Product catalog with search and filtering','Cart and a mock checkout flow with order records','Admin panel to manage products and view orders','Auth-gated routes for customer vs admin views','Deployed with environment-based configuration'],
    'A deployed storefront plus an admin panel, with the order/product schema documented.',
    ARRAY['Overview','Architecture diagram','Data model','Auth model','Local setup','Deployment'],
    'Built and deployed a full stack e-commerce platform with cart, checkout and an admin panel over a normalized Postgres schema.'
  ),
  (
    'realtime-chat-application','Real-Time Chat Application',
    'Build a multi-room chat app with live message delivery and presence.',
    'intermediate',22,'backend-developer',
    ARRAY['Node.js','API Design','PostgreSQL','System Design'],
    NULL,
    ARRAY['WebSocket-based real-time message delivery','Multiple chat rooms with message history','Online/offline presence indicators','Reconnection handling when a client drops'],
    'A working chat app with persisted message history and a short design note on how presence and reconnection were handled.',
    ARRAY['Overview','Real-time architecture','Data model','Known limitations','Local setup'],
    'Built a real-time chat application with WebSocket delivery, persisted history and presence across multiple rooms.'
  ),
  (
    'learning-management-system','Learning Management System',
    'Build a small LMS: courses, lessons, progress tracking and a quiz engine.',
    'advanced',30,'full-stack-developer',
    ARRAY['React','Node.js','PostgreSQL','API Design'],
    NULL,
    ARRAY['Course and lesson data model with ordering','Per-user progress tracking across lessons','A quiz engine with scoring','Instructor view to see learner progress'],
    'A working LMS with at least one full course, a quiz, and a progress dashboard.',
    ARRAY['Overview','Data model','Progress tracking design','Quiz engine','Local setup'],
    'Built a learning management system with course progress tracking and a scored quiz engine over a relational schema.'
  ),
  (
    'task-management-platform','Task Management Platform',
    'Build a Trello-style board with drag-and-drop tasks and real-time updates.',
    'intermediate',20,'frontend-developer',
    ARRAY['React','TypeScript','API Design','Accessibility'],
    NULL,
    ARRAY['Drag-and-drop board with columns and cards','Keyboard-accessible alternative to drag-and-drop','Optimistic UI updates with rollback on failure','Responsive layout down to mobile width'],
    'A deployed board app with an accessibility note explaining the keyboard-only path.',
    ARRAY['Overview','State management approach','Accessibility notes','Known limitations','Local setup'],
    'Built an accessible drag-and-drop task board in React with a fully keyboard-operable alternative interaction path.'
  ),
  (
    'api-gateway-service','API Gateway Service',
    'Build a gateway that routes, authenticates and rate-limits requests to backend services.',
    'advanced',24,'backend-developer',
    ARRAY['API Design','Node.js','Authentication','System Design'],
    NULL,
    ARRAY['Request routing to at least two backend services','Centralized authentication check before proxying','Per-client rate limiting with clear error responses','Structured request logging for observability'],
    'A working gateway in front of two mock services, with a short design note on the routing and rate-limit approach.',
    ARRAY['Overview','Routing design','Auth model','Rate limiting','Local setup'],
    'Built an API gateway handling authentication, routing and rate limiting in front of multiple backend services.'
  ),
  (
    'sales-analytics-bi-dashboard','Sales Analytics BI Dashboard',
    'Model raw sales data in SQL and ship a governed BI report on top of it.',
    'intermediate',18,'business-intelligence-analyst',
    ARRAY['SQL','Power BI','Data Visualization','Business Analytics'],
    'Any public retail or e-commerce sales dataset (e.g. Kaggle).',
    ARRAY['Star-schema data model built in SQL views','A BI report with at least three linked visuals','Row-level or role-based access consideration documented','A written summary of the three biggest findings'],
    'A published BI report plus a one-page findings summary for a non-technical stakeholder.',
    ARRAY['Business question','Data model','Report walkthrough','Findings','Caveats'],
    'Modeled sales data into a star schema and shipped a governed BI dashboard surfacing three actionable findings.'
  ),
  (
    'customer-churn-prediction-model','Customer Churn Prediction Model',
    'Train and explain a churn model, then translate it into a business recommendation.',
    'advanced',26,'data-scientist',
    ARRAY['Python','Pandas','Machine Learning','Statistics'],
    'Telco or subscription customer churn dataset (public).',
    ARRAY['Exploratory analysis with leakage checks','A baseline model plus at least one improved candidate','Evaluation with a metric appropriate to class imbalance','Feature importance translated into a plain-language recommendation'],
    'A reproducible notebook and a one-page business memo recommending an action based on the model.',
    ARRAY['Problem framing','Data','Modeling approach','Evaluation','Business recommendation'],
    'Trained a churn prediction model and translated feature importance into a specific retention recommendation for stakeholders.'
  ),
  (
    'realtime-data-pipeline','Real-Time Data Pipeline',
    'Build an orchestrated pipeline that ingests, transforms and loads data on a schedule.',
    'advanced',28,'data-engineer',
    ARRAY['Apache Airflow','Python','SQL','PostgreSQL'],
    'Any public streaming-friendly dataset (e.g. public API with frequent updates) or a simulated event generator.',
    ARRAY['A DAG with clearly separated extract/transform/load steps','Data quality checks that fail the pipeline on bad data','Idempotent reruns without duplicating data','A schema documented for downstream consumers'],
    'A working, scheduled pipeline plus a data-quality check report from a real run.',
    ARRAY['Pipeline architecture','DAG design','Data quality checks','Schema','Local setup'],
    'Built a scheduled, idempotent data pipeline with automated data-quality checks feeding a documented downstream schema.'
  ),
  (
    'ai-resume-analyzer','AI Resume Analyzer',
    'Build an LLM-powered tool that scores a resume against a job description and explains the gaps.',
    'advanced',24,'ai-engineer',
    ARRAY['Large Language Models','Prompt Engineering','API Design','Python'],
    NULL,
    ARRAY['Structured extraction of skills/experience from a resume','A scoring approach that compares resume content to a job description','Grounded, specific explanations for the score (not generic praise)','An evaluation set of resume/job pairs with expected outcomes to catch regressions'],
    'A working tool plus a written evaluation report showing it performs consistently across the test set.',
    ARRAY['Overview','Prompt design','Scoring approach','Evaluation results','Limitations'],
    'Built an LLM-powered resume analyzer with a documented evaluation set used to catch scoring regressions.'
  ),
  (
    'job-recommendation-system','Job Recommendation System',
    'Build a recommender that ranks jobs for a user profile using a real ranking approach, not a random shuffle.',
    'advanced',26,'machine-learning-engineer',
    ARRAY['Machine Learning','Python','Pandas','Statistics'],
    'Any public job postings dataset, or RoleReady-style synthetic profile/job pairs.',
    ARRAY['A content-based or collaborative ranking approach with a documented rationale','An offline evaluation metric (e.g. precision@k) computed on held-out data','A cold-start strategy for a user profile with little history','A short write-up of what the model gets wrong and why'],
    'A ranked recommendation output for sample profiles plus an evaluation report.',
    ARRAY['Approach and rationale','Data','Evaluation metric and results','Cold-start handling','Limitations'],
    'Built and evaluated a job recommendation model, reporting precision@k against a held-out set and documenting failure modes.'
  ),
  (
    'rag-knowledge-assistant','RAG Knowledge Assistant',
    'Build a retrieval-augmented assistant that answers questions grounded in a real document set, with citations.',
    'advanced',28,'ai-engineer',
    ARRAY['Retrieval-Augmented Generation','Large Language Models','Prompt Engineering','API Design'],
    NULL,
    ARRAY['Document ingestion and chunking with a documented chunking strategy','A vector index and retrieval step measured for relevance','Answers that cite the specific source chunk used','A small evaluation set of questions with expected answers to catch hallucination regressions'],
    'A working Q&A assistant over a real document set plus an evaluation report on citation accuracy.',
    ARRAY['Architecture','Chunking strategy','Retrieval evaluation','Citation approach','Limitations'],
    'Built a citation-grounded RAG assistant with a documented chunking strategy and a hallucination-regression evaluation set.'
  ),
  (
    'nlp-sentiment-analysis','NLP Sentiment Analysis System',
    'Build and evaluate a sentiment classifier on real text data, including where it fails.',
    'intermediate',20,'machine-learning-engineer',
    ARRAY['Natural Language Processing','Python','Machine Learning','Statistics'],
    'Public product or app review dataset with star ratings or sentiment labels.',
    ARRAY['Text preprocessing appropriate to the model chosen','A baseline model plus one improved model, compared fairly','A confusion matrix and error analysis on misclassified examples','A short note on classes of text the model handles poorly (sarcasm, negation, mixed sentiment)'],
    'A trained classifier plus an error-analysis writeup covering where and why it fails.',
    ARRAY['Data and labels','Preprocessing','Models compared','Error analysis','Limitations'],
    'Built and evaluated a sentiment classifier, documenting a confusion-matrix-driven error analysis of its failure modes.'
  ),
  (
    'cloud-deployment-project','Cloud Deployment Project',
    'Take an existing application and deploy it to the cloud with real infrastructure decisions, not just clicking "deploy".',
    'intermediate',18,'cloud-engineer',
    ARRAY['Cloud (AWS)','Docker','Terraform','Infrastructure as Code'],
    NULL,
    ARRAY['Infrastructure defined as code, not clicked together manually','A containerized app deployed behind a load balancer','Environment-based configuration (no secrets in source)','A documented rollback plan if a deploy fails'],
    'A live deployed application plus the infrastructure-as-code source and a short architecture diagram.',
    ARRAY['Architecture diagram','Infrastructure as code','Deployment steps','Rollback plan','Cost notes'],
    'Deployed a containerized application to the cloud using infrastructure as code, with a documented rollback plan.'
  ),
  (
    'devops-cicd-pipeline','DevOps CI/CD Pipeline',
    'Build a pipeline that tests, builds and deploys automatically on every push, with a real gate that can fail a bad change.',
    'intermediate',18,'devops-engineer',
    ARRAY['CI/CD','Docker','Git & Version Control','Monitoring & Observability'],
    NULL,
    ARRAY['Automated test run on every pull request','A build step that fails the pipeline on a broken build','An automated deploy step to a staging environment','A basic health check or smoke test after deploy'],
    'A working pipeline configuration plus a recorded example of it correctly failing on a broken change.',
    ARRAY['Pipeline stages','Test gate design','Deployment step','Post-deploy checks','Local setup'],
    'Built a CI/CD pipeline with automated test gating and post-deploy health checks that catch broken releases before users do.'
  ),
  (
    'security-monitoring-dashboard','Security Monitoring Dashboard',
    'Build a dashboard that surfaces real security signal from logs, not just a pretty chart.',
    'intermediate',20,'cybersecurity-engineer',
    ARRAY['SIEM & Log Analysis','Monitoring & Observability','Incident Response','Network Security'],
    'Public sample security/network log datasets from open lab environments.',
    ARRAY['Ingestion of sample logs into a queryable store','At least three detection rules for known attack patterns','A dashboard showing alert volume, severity and trend over time','A documented false-positive review for one of the detection rules'],
    'A working dashboard plus a short write-up of one detection rule and its false-positive rate.',
    ARRAY['Data sources','Detection rules','Dashboard walkthrough','False-positive review','Next steps'],
    'Built a security monitoring dashboard with custom detection rules and a documented false-positive review process.'
  ),
  (
    'auth-authorization-system','Authentication and Authorization System',
    'Build a real auth system: sessions or tokens, roles, and permission checks that actually block access.',
    'intermediate',20,'backend-developer',
    ARRAY['Authentication','API Design','PostgreSQL','Application Security'],
    NULL,
    ARRAY['Secure credential storage (proper hashing, no plaintext)','Token or session-based authentication with expiry','Role-based access control enforced on the server, not just hidden in the UI','Tests proving an unauthorized request is actually rejected'],
    'A working auth service with a test suite that proves access control actually holds.',
    ARRAY['Auth model','Token/session design','Role and permission model','Test coverage','Local setup'],
    'Built a role-based authentication and authorization system with server-enforced access control proven by an automated test suite.'
  ),
  (
    'vulnerability-assessment-lab','Vulnerability Assessment Lab',
    'Run a structured vulnerability assessment against a deliberately vulnerable target and report it professionally.',
    'intermediate',16,'cloud-security-engineer',
    ARRAY['Cloud Security','Identity & Access Management','Security Frameworks','Ethical Hacking'],
    'Deliberately vulnerable public lab environments (e.g. OWASP Juice Shop, cloud security CTF ranges).',
    ARRAY['A documented scope and rules of engagement for the assessment','Findings ranked by severity with real evidence, not guesses','At least one identity/access misconfiguration identified and explained','A remediation plan a non-security engineer could actually act on'],
    'A professional-style vulnerability assessment report with ranked findings and remediation steps.',
    ARRAY['Scope','Methodology','Findings by severity','Remediation plan','Lessons learned'],
    'Ran a scoped vulnerability assessment against a lab environment and delivered a severity-ranked report with remediation guidance.'
  )
) AS v(slug, title, summary, diff, hours, career_slug, skills, dataset, reqs, output, readme, bullet)
JOIN public.careers c ON c.slug = v.career_slug
ON CONFLICT (slug) DO NOTHING;
