-- CONTENT EXPANSION — Phase F (learning content), topics batch 2
--
-- Completes learning-topic coverage for all 29 skills added in
-- 20260906010000 (batch 1, in 20260906050000/050100, covered the first 12
-- highest-priority ones). This batch covers the remaining 17: Authentication,
-- Application Security, Database Design, Database Administration,
-- Cloud (GCP), Monitoring & Observability, Infrastructure as Code, Airflow,
-- NLP, Computer Vision, Generative AI, Cloud Security, Identity & Access
-- Management, Design Patterns, Clean Code, Requirements Analysis, and
-- Mobile Development. After this migration every one of the 29 new skills
-- has real learning content, so the roadmap engine's content-aware weekly
-- plan applies to every career added in this session, not just the first
-- dozen skills.

INSERT INTO public.learning_topics
  (slug, skill_id, title, why_it_matters, difficulty, estimated_hours, objectives, common_mistakes, target_level)
SELECT v.slug, s.id, v.title, v.why, v.diff::public.difficulty_level, v.hours, v.objectives, v.mistakes, v.target::public.proficiency_level
FROM (VALUES
  (
    'authentication-fundamentals','authentication','Authentication Fundamentals',
    'Backend Developer, Full Stack Developer and Cybersecurity Engineer roles all need to get authentication and authorization right — it is one of the most common sources of real security vulnerabilities when implemented carelessly.',
    'intermediate',5,
    ARRAY['Understand the difference between authentication and authorization','Understand password hashing and why plaintext storage is never acceptable','Understand session-based vs token-based (JWT) authentication','Understand refresh tokens and token expiry','Understand common authentication vulnerabilities'],
    ARRAY['Correctly authenticating a user but forgetting to check authorization on a sensitive action','Storing passwords in plaintext or with a fast, non-purpose-built hash','Storing an auth token in localStorage instead of an httpOnly cookie','Using one long-lived token that never expires instead of a short-lived token with a refresh flow'],
    'intermediate'
  ),
  (
    'application-security-fundamentals','application-security','Application Security Fundamentals',
    'Cybersecurity Engineer, Cloud Security Engineer and Backend Developer roles all need to recognize and prevent the most common classes of vulnerabilities that let attackers compromise an application.',
    'intermediate',6,
    ARRAY['Understand SQL injection and how parameterized queries prevent it','Understand XSS (cross-site scripting) and output encoding','Understand CSRF and how tokens prevent it','Understand the principle of least privilege','Understand why input validation must happen server-side'],
    ARRAY['Building SQL queries by string-concatenating user input','Rendering untrusted input as raw HTML instead of escaped text','Relying only on client-side validation for anything security-relevant','Granting broader database or API credentials than a service actually needs'],
    'intermediate'
  ),
  (
    'database-design-fundamentals','database-design','Database Design Fundamentals',
    'Database Administrator, Backend Developer and Data Engineer roles all depend on a well-designed schema — a poor schema causes data integrity problems and performance issues that are expensive to fix later.',
    'intermediate',5,
    ARRAY['Understand normalization and why it prevents data anomalies','Understand when denormalization is a reasonable tradeoff','Understand primary keys, foreign keys and referential integrity','Understand indexing and its tradeoffs','Understand one-to-many and many-to-many relationships'],
    ARRAY['Duplicating a fact like an address across many rows instead of normalizing it','Denormalizing data without a clear reason, accepting staleness risk unintentionally','Skipping foreign key constraints and relying only on application code for integrity','Indexing every column "just in case" and slowing down writes for no read benefit'],
    'intermediate'
  ),
  (
    'database-administration-fundamentals','database-administration','Database Administration Fundamentals',
    'Database Administrator roles are specifically about keeping production databases fast, available and safe — this goes beyond schema design into day-to-day operations.',
    'advanced',6,
    ARRAY['Understand backup strategies and recovery point/time objectives','Understand query performance troubleshooting with EXPLAIN','Understand replication and its purpose','Understand connection pooling','Understand common causes of database downtime'],
    ARRAY['Assuming a nightly backup alone meets every business''s acceptable data-loss window','Guessing at why a query is slow instead of reading its execution plan','Routing all traffic to the primary database with no read replicas under heavy read load','Running a large schema migration on a busy table during peak traffic'],
    'advanced'
  ),
  (
    'cloud-gcp-fundamentals','cloud-gcp','Cloud (GCP) Fundamentals',
    'Cloud Engineer and Solutions Architect roles at organizations using Google Cloud need working GCP knowledge alongside AWS and Azure.',
    'intermediate',5,
    ARRAY['Understand GCP''s project and organization hierarchy','Understand core compute options: Compute Engine, Cloud Run, Cloud Functions','Understand Cloud Storage classes','Understand IAM roles and least privilege in GCP','Understand basic cost management in GCP'],
    ARRAY['Using one shared project for every environment instead of separating dev/staging/prod','Choosing Compute Engine when a managed option like Cloud Run would need far less operational work','Storing rarely-accessed data in Standard class instead of a cheaper archival class','Granting a service account the broad Owner role instead of a scoped role'],
    'intermediate'
  ),
  (
    'monitoring-observability-fundamentals','monitoring-observability','Monitoring & Observability Fundamentals',
    'DevOps Engineer, Site Reliability Engineer and Cloud Engineer roles rely on monitoring and observability to know a system is healthy, and to diagnose it quickly when it is not.',
    'intermediate',5,
    ARRAY['Understand the difference between monitoring and observability','Understand the three pillars: metrics, logs, traces','Understand what makes a good alert','Understand SLOs, SLIs and error budgets','Understand alert fatigue and how to avoid it'],
    ARRAY['Alerting on every internal metric fluctuation instead of user-facing symptoms','Having no clear runbook or action tied to an alert','Treating 100% uptime as the goal instead of a deliberately chosen SLO','Letting alert volume grow unchecked until responders start ignoring notifications'],
    'intermediate'
  ),
  (
    'infrastructure-as-code-fundamentals','infrastructure-as-code','Infrastructure as Code Fundamentals',
    'DevOps Engineer, Cloud Engineer and Solutions Architect roles use infrastructure as code as the standard practice for provisioning infrastructure reliably and repeatably, rather than manual clicking.',
    'intermediate',4,
    ARRAY['Understand why manual ("ClickOps") infrastructure changes cause problems','Understand idempotency and why it matters','Understand the difference between declarative and imperative IaC approaches','Understand drift and how to detect it','Understand code review for infrastructure changes'],
    ARRAY['Making manual console changes after adopting an IaC tool, causing drift','Writing IaC that is not idempotent and creates duplicates on rerun','Never running a plan/diff step to check for drift before applying','Merging infrastructure changes without any review process, unlike application code'],
    'intermediate'
  ),
  (
    'airflow-fundamentals','airflow','Apache Airflow Fundamentals',
    'Data Engineer roles use Airflow as the standard tool for scheduling and orchestrating multi-step data pipelines reliably.',
    'advanced',5,
    ARRAY['Understand DAGs and why pipelines are modeled as directed acyclic graphs','Understand operators and tasks','Understand scheduling and backfilling','Understand retries and failure handling','Understand task dependencies and idempotent task design'],
    ARRAY['Writing a pipeline as one monolithic script instead of a DAG of discrete tasks','Confusing an operator (a template) with a task (a specific instantiation)','Retrying a failing task indefinitely with no limit, hiding a real bug','Writing a load task that appends on every run instead of overwriting a partition idempotently'],
    'advanced'
  ),
  (
    'nlp-fundamentals','nlp','Natural Language Processing Fundamentals',
    'AI Engineer and Machine Learning Engineer roles working with text data need NLP fundamentals to build features like search, classification, and language understanding.',
    'intermediate',5,
    ARRAY['Understand tokenization and why text needs to be converted to numbers','Understand the bag-of-words / TF-IDF approach and its limitations','Understand word embeddings and how they capture meaning','Understand named entity recognition as a common NLP task','Understand why context matters for word meaning'],
    ARRAY['Assuming a bag-of-words model captures word order or meaning','Treating a fixed word embedding as capturing all of a word''s possible meanings','Skipping tokenization strategy considerations for rare or unseen words','Assuming NER perfectly extracts every entity with no error rate'],
    'intermediate'
  ),
  (
    'computer-vision-fundamentals','computer-vision','Computer Vision Fundamentals',
    'Machine Learning Engineer and AI Engineer roles working on image-based products need to understand the core ideas behind how models process images.',
    'advanced',6,
    ARRAY['Understand how images are represented numerically','Understand convolution and why CNNs are suited to images','Understand common vision tasks: classification, detection, segmentation','Understand data augmentation and why it helps','Understand transfer learning for vision tasks'],
    ARRAY['Confusing classification, detection and segmentation as interchangeable tasks','Training a vision model from scratch on a small dataset instead of using transfer learning','Skipping data augmentation on a small labeled image dataset','Assuming a CNN''s shared filters need a separate learned weight per pixel position'],
    'advanced'
  ),
  (
    'generative-ai-fundamentals','generative-ai','Generative AI Fundamentals',
    'AI Engineer roles need to understand the broader landscape of generative models beyond just text — how they work, what they are good at, and their real limitations.',
    'intermediate',4,
    ARRAY['Understand what makes a model "generative"','Understand the difference between generative and discriminative models','Understand diffusion models at a conceptual level','Understand common failure modes of generative models','Understand responsible-use considerations: attribution, bias, misuse'],
    ARRAY['Assuming a generative model''s fluent output is automatically factually correct','Treating generative and discriminative models as interchangeable for any task','Shipping a generative feature without evaluating it for inherited bias','Ignoring copyright/attribution questions around training data'],
    'intermediate'
  ),
  (
    'cloud-security-fundamentals','cloud-security','Cloud Security Fundamentals',
    'Cloud Security Engineer and Cybersecurity Engineer roles need to secure infrastructure that lives in the cloud, which carries different risks than traditional on-premises security.',
    'advanced',5,
    ARRAY['Understand the shared responsibility model','Understand common cloud misconfigurations','Understand cloud security posture management (CSPM)','Understand the risk of overly permissive IAM policies','Understand encryption at rest and in transit in cloud environments'],
    ARRAY['Assuming the cloud provider secures everything, including your own configuration','Leaving a storage bucket or database publicly accessible by mistake','Relying only on periodic manual audits instead of continuous automated scanning','Granting wildcard/broad IAM permissions when a narrow scope would do'],
    'advanced'
  ),
  (
    'identity-access-management-fundamentals','identity-access-management','Identity & Access Management Fundamentals',
    'Cybersecurity Engineer and Cloud Security Engineer roles are centrally concerned with controlling who, and what, can access systems and data.',
    'intermediate',4,
    ARRAY['Understand the difference between identity, authentication and authorization','Understand role-based access control (RBAC)','Understand the principle of least privilege in an IAM context','Understand multi-factor authentication and why it matters','Understand service accounts / machine identities'],
    ARRAY['Assigning permissions directly to individual users instead of roles','Granting broad access "just in case" that is never revisited','Treating a password alone as sufficient without MFA','Using a shared human administrator credential for an automated script instead of a dedicated service account'],
    'intermediate'
  ),
  (
    'design-patterns-fundamentals','design-patterns','Design Patterns Fundamentals',
    'Software Engineer, Full Stack Developer and Backend Developer roles benefit from recognizing common, well-tested solutions to recurring design problems rather than reinventing them inconsistently.',
    'intermediate',5,
    ARRAY['Understand what a design pattern is, and is not','Understand the Singleton pattern and its risks','Understand the Factory pattern','Understand the Observer pattern','Understand the Strategy pattern'],
    ARRAY['Treating a pattern as code to copy-paste rather than an approach to adapt','Reaching for Singleton by default and creating hidden global state','Hardcoding which concrete class to instantiate instead of using a Factory when it varies at runtime','Not recognizing the Strategy pattern as a clean way to add new algorithms without modifying existing code'],
    'intermediate'
  ),
  (
    'clean-code-fundamentals','clean-code','Clean Code Fundamentals',
    'Every engineering role in this catalog benefits from writing code that other engineers, including a future version of yourself, can read, understand and safely change.',
    'beginner',4,
    ARRAY['Understand why naming is one of the highest-leverage things you control','Understand why small functions with one responsibility are easier to reason about','Understand why comments are not a substitute for clear code','Understand code smells as a signal to refactor','Understand the boy scout rule'],
    ARRAY['Choosing vague names like process() or handleData() over descriptive ones','Writing a function that does several unrelated things instead of one clear job','Writing a comment explaining what code does instead of clarifying the code itself','Letting duplicated logic and confusing structure accumulate rather than incrementally improving it'],
    'beginner'
  ),
  (
    'requirements-analysis-fundamentals','requirements-analysis','Requirements Analysis Fundamentals',
    'Business Analyst and Project Manager roles are centrally about turning ambiguous business needs into requirements clear enough for a delivery team to build correctly.',
    'intermediate',4,
    ARRAY['Understand the difference between a business requirement and a functional requirement','Understand user stories and acceptance criteria','Understand techniques for eliciting requirements from stakeholders','Understand why ambiguous requirements cause expensive rework','Understand requirements traceability'],
    ARRAY['Jumping straight to a specific solution before validating the underlying business need','Writing user stories with no clear, testable acceptance criteria','Taking a stakeholder''s first stated request at face value without asking why','Leaving requirements untestable and vague, like "the system should be fast"'],
    'intermediate'
  ),
  (
    'mobile-development-fundamentals','mobile-development','Mobile Development Fundamentals',
    'Mobile App Developer roles need to understand what makes mobile development meaningfully different from web development, beyond just a smaller screen.',
    'intermediate',6,
    ARRAY['Understand native vs cross-platform approaches and their tradeoffs','Understand offline-first design and why mobile apps need it','Understand mobile app lifecycle states','Understand app store review and release considerations','Understand mobile performance constraints: battery, memory, network'],
    ARRAY['Assuming a mobile app can rely on always having a network connection','Assuming an app keeps running indefinitely just because the user has not closed it','Submitting for app store review the same day as a planned launch','Ignoring battery and memory impact of frequent background work like GPS polling'],
    'intermediate'
  )
) AS v(slug, skill_slug, title, why, diff, hours, objectives, mistakes, target)
JOIN public.skills s ON s.slug = v.skill_slug
ON CONFLICT (slug) DO NOTHING;
