-- CONTENT EXPANSION -- Phase F (learning content), lessons batch 2
-- Lessons for the 17 topics seeded in 20260906060000_seed_new_skill_topics_batch2.sql

-- Authentication Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Authentication vs authorization',
   'Authentication answers "who are you," proving identity via a password or token; authorization answers "what are you allowed to do," checking permissions once identity is known. Conflating the two is a common source of bugs -- a system can correctly identify a user but still fail to check whether that user is allowed to perform a specific action.',
   'Logging in successfully proves who you are but does not by itself mean you should be able to delete another user''s account -- that requires a separate permission check on every sensitive action.',
   'Give an example of a bug that results from correct authentication but missing authorization.'),
  (2, 'Password hashing, never plaintext',
   'Passwords must never be stored in plaintext or with reversible encryption -- they should be hashed with a slow, purpose-built algorithm such as bcrypt, scrypt, or Argon2, including a per-user salt, making stolen hashes far harder to crack even in bulk.',
   'A leaked database of bcrypt-hashed passwords with per-user salts requires attackers to crack each password individually and slowly; a leaked database of plaintext or fast-hashed passwords can be cracked almost instantly at scale.',
   'Explain why a fast hash function like plain SHA-256 is a poor choice for hashing passwords, even though it is cryptographically secure for other purposes.'),
  (3, 'Session-based vs token-based authentication',
   'Session-based auth stores session state on the server and gives the client an opaque session ID cookie; token-based auth like JWT encodes claims directly in a signed token the client holds, letting the server validate it without a database lookup, at the cost of harder immediate revocation.',
   'Revoking a session-based login is as simple as deleting the server-side session record; revoking a JWT before its natural expiry requires an extra mechanism like a blocklist.',
   'Explain one advantage and one disadvantage of JWTs compared to server-side sessions.'),
  (4, 'Refresh tokens and expiry',
   'Short-lived access tokens limit the damage if one is stolen, but require constant re-authentication unless paired with a longer-lived refresh token that can be exchanged for a new access token.',
   'An access token expiring after 15 minutes limits a stolen token''s usefulness; a refresh token valid for 30 days lets the user stay logged in without re-entering credentials, as long as it is stored securely.',
   'Explain why using a short-lived access token paired with a refresh token is generally safer than one long-lived token that never expires.'),
  (5, 'Common authentication vulnerabilities',
   'Common real-world mistakes include not rate-limiting login attempts, storing tokens insecurely on the client, missing CSRF protection on cookie-based sessions, and not invalidating sessions on password change.',
   'Storing a JWT in localStorage makes it readable by any JavaScript running on the page, including from an XSS vulnerability -- an httpOnly cookie is not readable by JavaScript at all.',
   'Explain why storing an authentication token in an httpOnly cookie is generally safer than storing it in localStorage.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'authentication-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Application Security Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'SQL injection',
   'SQL injection happens when untrusted input is concatenated directly into a SQL query, letting an attacker inject their own SQL logic. Parameterized queries prevent this by treating user input strictly as data, never as executable SQL.',
   'A query built by concatenating user input lets an attacker submit input that bypasses the intended filter entirely; a parameterized query with a placeholder never allows this.',
   'Explain why string-concatenating user input into a SQL query is dangerous even if you trust the input source.'),
  (2, 'Cross-site scripting (XSS)',
   'XSS happens when untrusted input is rendered into a page as executable HTML or JavaScript instead of plain text, letting an attacker run arbitrary script in another user''s browser session. Escaping output before rendering is the primary defense.',
   'A comment field that renders user input directly as HTML lets an attacker submit a script tag that runs in every other visitor''s browser, potentially stealing their session cookie.',
   'Explain why rendering user-submitted content as escaped plain text by default, rather than raw HTML, is a safer framework design choice.'),
  (3, 'Cross-site request forgery (CSRF)',
   'CSRF tricks a logged-in user''s browser into making an unwanted request to a site they are authenticated with, using the browser''s automatically-attached session cookie. CSRF tokens prevent this because an attacker''s page cannot read or forge the token.',
   'A malicious page that auto-submits a transfer form relies on the victim''s browser automatically attaching their session cookie -- a required CSRF token the attacker cannot know defeats this.',
   'Explain why a CSRF token needs to be unpredictable and tied to the user''s session, rather than a fixed value.'),
  (4, 'Principle of least privilege',
   'Every user, service, and process should have only the minimum permissions needed to do its job, reducing the blast radius if that account or service is ever compromised.',
   'A reporting service that only ever reads data should be given a read-only database credential, not the same admin credential used for migrations.',
   'Explain how the principle of least privilege limits the damage from a single compromised service credential.'),
  (5, 'Server-side validation, always',
   'Client-side validation improves user experience but provides zero security, since any client-side check can be bypassed by calling the API directly. Every security-relevant validation must be enforced again on the server.',
   'A form that only checks a positive price in JavaScript can still be bypassed by sending a negative price directly to the API with a tool like curl.',
   'Explain why "we already validate this in the frontend" is never a sufficient security argument on its own.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'application-security-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Database Design Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Normalization and data anomalies',
   'Normalization organizes data to minimize redundancy, storing each fact once, which prevents update anomalies and inconsistency.',
   'Storing a customer''s address on every one of their order rows means an address change requires updating potentially hundreds of rows -- normalizing address into a separate customers table fixes this.',
   'Explain what could go wrong if a customer''s email address is duplicated across every order row instead of stored once in a customers table.'),
  (2, 'When denormalization is a reasonable tradeoff',
   'Normalization is not free, since it can require expensive joins for common read patterns. Deliberately denormalizing is reasonable when read performance matters more than write simplicity and the tradeoff is intentional.',
   'A reporting dashboard that always needs order total with customer name might denormalize the name onto a summary table to avoid a join on every load, accepting a small staleness risk.',
   'Explain one situation where deliberately duplicating a piece of data across tables is a reasonable design decision, and what risk you are accepting.'),
  (3, 'Primary keys, foreign keys and referential integrity',
   'A primary key uniquely identifies each row; a foreign key references a primary key in another table, and the database enforces that the referenced row must exist.',
   'A foreign key constraint from orders to customers prevents inserting an order for a customer that does not exist, catching a bug at the database level.',
   'Explain what referential integrity means and give one concrete bug it would catch that application code alone might miss.'),
  (4, 'Indexing tradeoffs',
   'An index speeds up reads that filter or sort on the indexed column, but every index also slows down writes and consumes extra storage.',
   'Adding an index on a rarely-queried column that is updated on every write adds write overhead with almost no read benefit.',
   'Explain the tradeoff a database makes between read speed and write speed when you add an index.'),
  (5, 'One-to-many and many-to-many relationships',
   'A one-to-many relationship is modeled with a foreign key on the many side. A many-to-many relationship requires a separate join table holding pairs of foreign keys.',
   'Modeling students enrolled in courses needs a join table with student_id and course_id columns, rather than storing a list of course IDs on the students table.',
   'Explain why a many-to-many relationship cannot be modeled with a single foreign key column on either table.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'database-design-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Database Administration Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Backup strategy: RPO and RTO',
   'Recovery Point Objective, how much data loss is acceptable, and Recovery Time Objective, how long recovery can take, drive backup strategy.',
   'A business that can tolerate losing at most 5 minutes of data needs continuous log-based backups, not just a nightly full backup.',
   'Explain the difference between RPO and RTO, and why a nightly-only backup strategy might not be good enough for some businesses.'),
  (2, 'Reading a query plan with EXPLAIN',
   'EXPLAIN shows how the database will actually execute a query -- whether it uses an index or does a full table scan -- which is the starting point for diagnosing a slow query.',
   'An EXPLAIN output showing a sequential scan on a large table for a query filtering on one column is a strong signal an index is missing.',
   'Explain what a sequential scan in a query plan tells you, and what you would typically do in response.'),
  (3, 'Replication',
   'Replication keeps read replicas in sync with a primary database, providing a failover target and a way to offload read traffic, at the cost of replication lag.',
   'A reporting query run against a read replica avoids adding load to the primary database, but might reflect data a few seconds behind.',
   'Explain one benefit and one risk of routing read-only reporting queries to a replica instead of the primary database.'),
  (4, 'Connection pooling',
   'Opening a new database connection is relatively expensive; a connection pool maintains reusable connections that application code borrows and returns.',
   'An application opening a new connection per request can exhaust the database''s max connection limit under load; a connection pool reuses a fixed set instead.',
   'Explain why opening a new database connection per request does not scale well, and what a connection pool does instead.'),
  (5, 'Common causes of database downtime',
   'Frequent causes include running out of disk space, a long-running migration locking a table during peak traffic, connection exhaustion, and a runaway query consuming all resources.',
   'Adding a NOT NULL column with a default to a huge table can lock it for a full table rewrite -- running it as a smaller multi-step migration avoids an outage.',
   'Explain why a seemingly simple schema migration can cause an outage on a large, high-traffic table, and one way to reduce that risk.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'database-administration-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Cloud (GCP) Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Projects and the resource hierarchy',
   'Every GCP resource belongs to a project, the basic unit of billing, quota, and access control; projects are organized under folders and an organization for larger companies.',
   'A company might use separate projects for dev, staging and production, each with its own billing and IAM policies, rolled up under one organization.',
   'Explain one reason a company would use separate GCP projects for different environments instead of one shared project.'),
  (2, 'Compute options: Compute Engine, Cloud Run, Cloud Functions',
   'Compute Engine gives full VM control. Cloud Run runs a containerized app with automatic scaling, including to zero, without managing servers. Cloud Functions runs individual functions in response to events.',
   'A stateless API packaged as a container that should scale to zero when idle is a natural fit for Cloud Run; a single function triggered by a file upload fits Cloud Functions.',
   'For a containerized web API with unpredictable traffic that should scale down to zero cost when idle, which compute option fits best, and why?'),
  (3, 'Cloud Storage classes',
   'Cloud Storage offers different classes trading off cost against retrieval latency and minimum storage duration -- choosing based on actual access frequency avoids overpaying.',
   'Log files retained for compliance but almost never read after 30 days are better stored in Coldline or Archive class than Standard.',
   'Explain why storing rarely-accessed compliance archives in the Standard storage class would likely be an unnecessary cost.'),
  (4, 'IAM roles and least privilege',
   'GCP IAM grants roles to identities at the project, folder, or resource level. Using roles scoped to only what is needed, rather than broad roles like Owner, limits damage if a credential is compromised.',
   'A CI/CD service account that only needs to deploy to Cloud Run should be granted the specific Cloud Run Admin role, not Project Owner.',
   'Explain why granting a service account the broad Owner role, when it only needs to deploy one service, is a security risk.'),
  (5, 'Basic cost management',
   'Common cost levers include budget alerts, committed use discounts for predictable workloads, right-sizing VMs, and cleaning up unused resources like idle disks.',
   'An unattached persistent disk left over after a VM was deleted continues to incur storage charges indefinitely until someone notices.',
   'Name one type of orphaned GCP resource that can silently continue costing money after the workload that created it is gone.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'cloud-gcp-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Monitoring & Observability Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Monitoring vs observability',
   'Monitoring tells you a predefined set of things you already thought to watch. Observability is the broader ability to ask new questions about a system''s internal state you did not anticipate in advance.',
   'A dashboard showing CPU usage is monitoring; asking which specific requests caused a CPU spike after the fact requires observability, not just a pre-built dashboard.',
   'Explain the difference between monitoring and observability with your own example of a question observability could answer that a simple dashboard could not.'),
  (2, 'The three pillars: metrics, logs, traces',
   'Metrics are numeric measurements over time, good for dashboards. Logs are discrete timestamped events, good for debugging a specific incident. Traces follow a single request across services, good for finding where time is spent.',
   'A spike in error-rate metrics tells you something is wrong; logs from that window tell you what failed; a trace shows which downstream service caused it.',
   'For diagnosing why one specific user''s request was slow across five microservices, which of the three pillars would you reach for first, and why?'),
  (3, 'What makes a good alert',
   'A good alert is actionable, based on symptoms that matter to users, and has a clear next step -- an alert nobody acts on is worse than no alert.',
   'Alerting on customer-facing error rate exceeding 5% is actionable; alerting on CPU at 60% with no clear threshold usually just generates noise.',
   'Explain why an alert that fires but has no clear action associated with it tends to get ignored over time.'),
  (4, 'SLOs, SLIs and error budgets',
   'An SLI is a measured metric; an SLO is a target for that metric. The error budget is the allowed amount of failure, and spending it deliberately is a normal, tracked engineering tradeoff.',
   'A team with a 99.9% uptime SLO has roughly 43 minutes of allowed downtime per month -- a planned, tested deploy that risks a few minutes is a reasonable use of that budget.',
   'Explain what an error budget is, and why spending some of it on purpose is a legitimate engineering decision.'),
  (5, 'Alert fatigue',
   'Too many low-value alerts train responders to ignore notifications, meaning a genuinely critical alert can get missed in the noise.',
   'An on-call engineer paged 20 times a night for non-actionable warnings will eventually silence notifications altogether, including the one time it is a real outage.',
   'Explain how having too many non-actionable alerts can make a system less safe, not more.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'monitoring-observability-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Infrastructure as Code Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Why manual changes cause problems',
   'Infrastructure changed by clicking through a console leaves no record of what changed or why, and cannot be easily reproduced elsewhere. IaC fixes this by making every change reviewable and repeatable.',
   'If a production database was manually tweaked six months ago and nobody remembers what changed, recreating an identical disaster-recovery environment becomes a guessing game.',
   'Explain why "someone changed a setting in the console" is a much harder incident to investigate than "someone merged this specific pull request."'),
  (2, 'Idempotency',
   'An idempotent operation produces the same result no matter how many times it is run -- applying an IaC tool twice with no changes should be a no-op.',
   'Running a well-written Terraform apply twice in a row with no configuration changes reports no changes the second time.',
   'Explain why idempotency matters for a tool that might be re-run automatically as part of a CI/CD pipeline.'),
  (3, 'Declarative vs imperative IaC',
   'A declarative approach describes the desired end state and lets the tool figure out how to get there; an imperative approach is a sequence of explicit steps to run in order.',
   'A declarative config saying there should be 3 servers handles the case where 2 already exist by creating just 1 more; a naive imperative script might create 3 more on top.',
   'Explain one advantage a declarative IaC tool has over an imperative script when the actual current state does not match what you expect.'),
  (4, 'Drift and detecting it',
   'Drift happens when real infrastructure diverges from what is declared in code, usually from a manual change. Regularly running a plan step detects drift before it causes confusion.',
   'If someone manually resizes a VM in the console, the next plan will show that resource needing to change back to what is declared in code.',
   'Explain what drift means in the context of infrastructure as code, and one practice that helps catch it early.'),
  (5, 'Code review for infrastructure changes',
   'Treating infrastructure configuration like application code, requiring review before merging, catches mistakes before they are applied and creates a record of who approved what.',
   'A pull request opening a database''s security group to the entire internet is far more likely to be caught by a reviewer before merge than by someone noticing it later.',
   'Explain one specific type of infrastructure mistake that a code review process is well-suited to catch before it reaches production.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'infrastructure-as-code-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Apache Airflow Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'DAGs: why pipelines are graphs',
   'A DAG models a pipeline as tasks with explicit dependencies and no cycles, letting a scheduler understand what can run in parallel and what must wait.',
   'A pipeline extracting from three independent sources before combining them can run those extraction tasks in parallel because the DAG shows they do not depend on each other.',
   'Explain why modeling a pipeline as a DAG lets a scheduler run independent tasks in parallel, while a single monolithic script typically cannot.'),
  (2, 'Operators and tasks',
   'An operator is a template for a specific type of work; a task is a specific instantiation of an operator within a DAG.',
   'The PythonOperator runs an arbitrary Python function as a task; the PostgresOperator runs a SQL statement against a connection Airflow manages.',
   'Explain the difference between an operator and a task in Airflow terms.'),
  (3, 'Scheduling and backfilling',
   'A DAG''s schedule defines how often it runs. Backfilling runs a DAG for past scheduled intervals it missed or that predate when the DAG was created.',
   'Adding a new daily DAG and backfilling from the start of the month lets Airflow catch up by running it for each preceding day as if it had been scheduled then.',
   'Explain why backfilling is valuable when you add a brand-new pipeline that needs to process a month of historical data.'),
  (4, 'Retries and failure handling',
   'Tasks can fail transiently, and Airflow supports automatic retries with a configurable delay before marking a task failed.',
   'A task calling a flaky third-party API is configured to retry 3 times with a delay, so a brief outage does not require manual intervention.',
   'Explain why blindly retrying a failing task indefinitely with no limit could hide a real bug instead of handling a transient failure.'),
  (5, 'Task dependencies and idempotent design',
   'Tasks should be written so re-running them produces the same correct result rather than duplicating data, such as overwriting a partition rather than appending.',
   'A load task that inserts new rows on every run will create duplicates if retried after a partial failure; one that overwrites a date partition can be safely retried.',
   'Explain why a data-loading task that appends rows on every run is risky to retry, and how you would redesign it to be safely retryable.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'airflow-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Natural Language Processing Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Tokenization: turning text into units a model can use',
   'Before any NLP model can process text, it must be split into tokens and converted into numbers. How text is tokenized affects vocabulary size and how well the model handles rare or unseen words.',
   'Subword tokenization can represent a rare word as smaller known pieces even if the whole word never appeared in training data, avoiding an unknown-word problem.',
   'Explain why subword tokenization handles a word the model has never seen before better than whole-word tokenization would.'),
  (2, 'Bag-of-words and TF-IDF',
   'Bag-of-words represents a document as word counts, ignoring order entirely. TF-IDF weights words by importance relative to a whole corpus, downweighting common words.',
   'TF-IDF gives a high weight to a distinctive word like arrhythmia in a medical document, and a low weight to a common word like the.',
   'Explain one type of meaning that bag-of-words / TF-IDF approaches inherently lose because they ignore word order.'),
  (3, 'Word embeddings',
   'Word embeddings represent words as dense vectors positioned so semantically similar words end up close together, learned from patterns of co-occurrence in large amounts of text.',
   'In a good embedding space, king and queen are close together, and the vector difference between king and man is similar to queen and woman.',
   'Explain how word embeddings differ from bag-of-words in what kind of information they capture about a word.'),
  (4, 'Named entity recognition',
   'NER identifies and classifies spans of text into categories like person, organization, location, or date, a common building block for extracting structured information from text.',
   'Given a news sentence, an NER system would tag a company as an organization, a city as a location, and a date as a date.',
   'Give one practical use case where extracting named entities from text would be valuable for a business application.'),
  (5, 'Why context matters',
   'Older embedding approaches assigned a single fixed vector to each word regardless of context; modern contextual models generate a different representation depending on the surrounding sentence.',
   'The word "bank" means something different in "river bank" versus "deposited a check at the bank" -- a contextual model represents these differently.',
   'Explain why a fixed, context-independent word embedding struggles with a word that has multiple distinct meanings depending on context.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'nlp-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Computer Vision Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'How images become numbers',
   'A digital image is a grid of pixels, each with numeric intensity values per color channel. A model operates on this array of numbers directly.',
   'A 224x224 color image is represented as a 224x224x3 array of numbers, one value per pixel per color channel, fed into the model as raw numeric input.',
   'Explain what the three numbers in a 224x224x3 image shape represent.'),
  (2, 'Convolution and why CNNs suit images',
   'A convolutional layer slides a small filter across the image, detecting local patterns regardless of where they appear -- this weight-sharing makes CNNs far more parameter-efficient than a fully-connected network.',
   'A filter trained to detect vertical edges will respond to one whether it appears in the top-left or bottom-right of the image, because the same filter is applied everywhere.',
   'Explain why detecting the same feature at every position in an image is more efficient with a shared convolutional filter than a separate weight per pixel position.'),
  (3, 'Classification, detection and segmentation',
   'Classification assigns one label to an entire image. Detection finds and labels multiple objects with bounding boxes. Segmentation labels every pixel with a category.',
   'A photo app tagging beach for an entire image is classification; a self-driving car needing exact pixel boundaries of a pedestrian needs segmentation.',
   'For a self-driving car that needs the precise outline of a pedestrian to avoid, which task is more appropriate: classification, detection, or segmentation? Explain why.'),
  (4, 'Data augmentation',
   'Data augmentation artificially expands a training set by applying label-preserving transformations to existing images, helping the model generalize better and reducing overfitting.',
   'Randomly flipping and slightly rotating training images of cats teaches the model a cat is still a cat regardless of orientation, without collecting more real photos.',
   'Explain why data augmentation helps prevent overfitting, particularly when the original labeled dataset is small.'),
  (5, 'Transfer learning for vision',
   'Rather than training from scratch, transfer learning starts from a model pretrained on a large general dataset and fine-tunes it on a smaller, specific dataset.',
   'A model pretrained on millions of general images can be fine-tuned on a few thousand medical scans, reaching much better accuracy than training from scratch.',
   'Explain why starting from a model pretrained on a large, general image dataset is usually better than training from scratch on a small, specific dataset.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'computer-vision-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Generative AI Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'What makes a model generative',
   'A generative model learns the underlying distribution of its training data well enough to produce new, plausible examples similar to it, rather than just labeling existing input.',
   'A model that writes a new paragraph of text is generative; a model that only classifies an existing image as cat or dog is not.',
   'Explain, in your own words, what it means for a model to have learned the distribution of its training data well enough to generate new examples.'),
  (2, 'Generative vs discriminative models',
   'A discriminative model learns to distinguish between categories given an input. A generative model learns to produce new data resembling its training distribution.',
   'A spam classifier that outputs spam or not spam is discriminative; a model that writes an entirely new plausible-looking email is generative.',
   'Give an example task that calls for a discriminative model rather than a generative one, and explain why.'),
  (3, 'Diffusion models, conceptually',
   'Diffusion models work by learning to reverse a process of gradually adding noise to an image -- trained to remove noise step by step, they can start from pure noise and iteratively denoise it into a coherent image.',
   'Generating an image from a text prompt starts from random noise and progressively refines it over many steps, guided by the prompt.',
   'Explain, at a conceptual level, why starting from random noise and removing it step by step can produce a coherent, realistic image.'),
  (4, 'Common failure modes',
   'Generative models can hallucinate plausible-but-wrong facts, inherit and amplify training-data biases, and struggle with precise counting or spatial relationships.',
   'An image model asked for a hand may generate an implausible number of fingers, since it learned statistical patterns rather than an explicit counting rule.',
   'Name one common failure mode of generative image or text models, and explain why it happens rather than being a simple bug.'),
  (5, 'Responsible use considerations',
   'Using generative AI raises real questions around attribution and copyright, bias, and misuse potential -- these need consideration during design, not as an afterthought.',
   'A hiring-assistant tool trained on historical hiring data could learn and reproduce past discriminatory patterns unless specifically evaluated for that risk.',
   'Describe one concrete risk you would want to evaluate before shipping a generative-AI feature that summarizes job candidates for a hiring team.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'generative-ai-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Cloud Security Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'The shared responsibility model',
   'Cloud providers secure the underlying infrastructure; customers are responsible for how they configure and use the services they run on top of it. Misunderstanding this split is a common source of breaches.',
   'A provider secures their data centers, but if a customer leaves a storage bucket publicly readable, that misconfiguration is entirely the customer''s responsibility.',
   'Explain, with an example, what falls on the cloud provider''s side of the shared responsibility model versus the customer''s side.'),
  (2, 'Common cloud misconfigurations',
   'The most frequent real-world cloud security incidents come from misconfiguration, not sophisticated attacks -- publicly exposed storage, overly permissive security groups, and default credentials.',
   'A storage bucket accidentally left with public read access has repeatedly caused large real-world data breaches, from a simple configuration mistake.',
   'Name one common cloud misconfiguration and explain why it is dangerous even without any hacking involved.'),
  (3, 'Cloud security posture management (CSPM)',
   'CSPM tools continuously scan a cloud environment for misconfigurations and policy violations, since manually auditing a large, constantly-changing environment is not realistic.',
   'A CSPM tool can automatically flag a newly-created public bucket the moment it is created, rather than someone discovering it months later.',
   'Explain why manual, periodic security audits alone are insufficient for a cloud environment that changes constantly.'),
  (4, 'Overly permissive IAM policies',
   'A common failure is granting broad wildcard permissions when a specific, narrower permission would suffice, increasing the damage possible if a credential is compromised.',
   'An application that only needs to read one storage bucket, but is granted access to all buckets, gives an attacker far more reach than needed.',
   'Explain why granting the narrowest possible IAM permission a workload needs limits the damage from a compromised credential.'),
  (5, 'Encryption at rest and in transit',
   'Encryption at rest protects stored data; encryption in transit protects data moving over the network. Providers make both easy to enable, but a customer must actually configure them.',
   'A database with encryption at rest protects data if storage is physically accessed, but transmitting it over an unencrypted connection still exposes it to interception.',
   'Explain why encryption at rest alone is not sufficient if data is transmitted between services over an unencrypted connection.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'cloud-security-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Identity & Access Management Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Identity, authentication and authorization, together',
   'Identity is the record of who or what an entity is; authentication proves that identity; authorization determines what that identity is allowed to do.',
   'A user account that logs in with a password is then checked against a policy to see if they are allowed to delete a specific resource.',
   'Explain, using a concrete example, how identity, authentication and authorization are three distinct concepts that work together.'),
  (2, 'Role-based access control (RBAC)',
   'RBAC assigns permissions to roles rather than directly to individual users, and users are assigned roles, making access easier to manage at scale.',
   'Adding a new team member as a viewer instantly grants them the same read-only permissions as every other viewer, with no per-person configuration.',
   'Explain why assigning permissions to roles, rather than directly to individual users, scales better as an organization grows.'),
  (3, 'Least privilege in IAM',
   'Every identity, human or service, should be granted only the specific permissions it actually needs, reviewed periodically as needs change.',
   'A contractor who needs temporary read access to one project should be granted exactly that, with an expiration, rather than ongoing broad access.',
   'Explain why access granted "just in case, we might need it later" is a common IAM anti-pattern.'),
  (4, 'Multi-factor authentication',
   'MFA requires a second factor beyond a password, since passwords alone are frequently phished, reused, or leaked in breaches.',
   'Even if an attacker obtains a password through phishing, MFA means they still cannot log in without also having the user''s physical second factor.',
   'Explain why MFA meaningfully reduces risk even when a password has already been compromised.'),
  (5, 'Service accounts and machine identities',
   'Applications and scripts often need their own credentials, service accounts, to access resources. These machine identities need the same least-privilege discipline as human accounts.',
   'A backup script that needs to write to one storage location should use a service account scoped to exactly that, not a human administrator''s personal credentials.',
   'Explain why using a shared human administrator''s credentials for an automated script, instead of a dedicated service account, is a poor practice.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'identity-access-management-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Design Patterns Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'What a design pattern actually is',
   'A design pattern is a named, reusable solution to a commonly recurring design problem -- not a specific piece of code to copy, but a general approach adapted to your situation.',
   'Saying "let''s use the Observer pattern here" communicates a whole design approach instantly to another engineer familiar with it.',
   'Explain why a design pattern is described as a reusable solution rather than a specific reusable piece of code.'),
  (2, 'The Singleton pattern, and its risks',
   'Singleton ensures a class has exactly one instance, globally accessible. It is also widely criticized for introducing hidden global state and making testing harder.',
   'A Singleton-based logger seems convenient until you need to test a component in isolation and cannot easily inject a mock logger.',
   'Explain one specific way the Singleton pattern can make unit testing harder.'),
  (3, 'The Factory pattern',
   'A Factory encapsulates the logic of creating an object, decoupling calling code from exactly which concrete class gets created.',
   'A payment processor factory that returns a credit card, PayPal, or bank transfer processor based on the selected method keeps calling code unaware of the exact class.',
   'Explain what problem the Factory pattern solves when the exact class to instantiate depends on a runtime condition.'),
  (4, 'The Observer pattern',
   'Observer lets one object notify a list of dependent objects automatically when its state changes, without needing to know any specifics about what those observers do.',
   'A UI component that re-renders automatically whenever shared application state changes is following the Observer pattern.',
   'Give one real-world software feature you have used that likely relies on the Observer pattern under the hood.'),
  (5, 'The Strategy pattern',
   'Strategy defines a family of interchangeable algorithms and lets you swap which one is used at runtime without changing the code that uses it.',
   'A shipping-cost calculator that can plug in a flat-rate, by-weight, or by-distance strategy without changing the checkout code is applying the Strategy pattern.',
   'Explain how the Strategy pattern lets you add a brand-new pricing algorithm without modifying the existing code that uses pricing.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'design-patterns-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Clean Code Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Naming: the highest-leverage detail',
   'A well-chosen name communicates intent without needing a comment, and a poorly chosen name actively misleads readers. Code is read far more often than it is written.',
   'A function named process() tells a reader nothing; a function named calculateMonthlyInterest() tells a reader exactly what to expect.',
   'Rewrite a function named handleData() with a name that actually describes what it does, assuming it validates and saves a user''s profile.'),
  (2, 'Small functions, one responsibility',
   'A function that does one clearly-named thing is easier to test, reuse, and reason about than a long function doing several unrelated things.',
   'A function that validates, saves, and emails a user in one is doing three jobs; splitting it into three functions makes each independently testable.',
   'Explain why a function whose name needs the word "and" to describe it is often a sign it should be split up.'),
  (3, 'Comments are not a substitute for clear code',
   'A comment explaining confusing code can go stale the moment the code changes. Comments are best used to explain why a non-obvious decision was made, not what the code does.',
   'A comment saying "adds 1 to x" above a simple increment is redundant noise; a comment explaining a non-obvious retry reason is genuinely useful.',
   'Explain the difference between a comment that explains what code does versus one that explains why, and which is usually more valuable.'),
  (4, 'Code smells as a signal to refactor',
   'A code smell is a surface-level pattern that does not necessarily mean code is broken, but often signals it will be harder to maintain over time.',
   'The same validation logic copy-pasted in five places is a code smell; a fix applied to one copy but forgotten in the others becomes an inconsistency.',
   'Name one common code smell and explain what future problem it tends to cause if left unaddressed.'),
  (5, 'The boy scout rule',
   'The boy scout rule says to leave code a little better than you found it every time you touch it, preventing a codebase from steadily degrading.',
   'While fixing an unrelated bug, renaming one confusingly-named variable you noticed along the way is a small, safe improvement that compounds over time.',
   'Explain why small, incremental improvements made while doing other work tend to be more sustainable than periodic large cleanup efforts.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'clean-code-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Requirements Analysis Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Business requirements vs functional requirements',
   'A business requirement describes a goal at a high level; a functional requirement describes specifically what the system must do to support it. Skipping straight to functional requirements risks solving the wrong problem.',
   'Reducing cart abandonment is a business requirement; adding guest checkout is one possible functional requirement that might address it.',
   'Give a business requirement and two different functional requirements that could both plausibly address it.'),
  (2, 'User stories and acceptance criteria',
   'A user story captures a requirement from the user''s perspective, and acceptance criteria define specific, testable conditions for the story to be considered done.',
   'A story about filtering search results by price paired with acceptance criteria about min/max fields and live updates makes done objectively checkable.',
   'Write a user story and at least two acceptance criteria for a feature that lets a user reset their forgotten password.'),
  (3, 'Eliciting requirements from stakeholders',
   'Stakeholders often describe a desired solution rather than the underlying problem, so effective elicitation focuses on asking why repeatedly to uncover the real need.',
   'A stakeholder asking for an export-to-Excel button might actually need a way to share data with a colleague, which could be solved differently.',
   'Describe a follow-up question you would ask a stakeholder who requests "just add a button that does X," to understand the underlying need.'),
  (4, 'Why ambiguous requirements cause expensive rework',
   'A requirement like "the page should load fast" is not testable, since people will disagree on whether it is met. Ambiguity caught late is far more expensive than catching it on paper.',
   'A dashboard being user-friendly gives no concrete target; a first-time user completing a task within 2 minutes without help is testable.',
   'Rewrite the ambiguous requirement "the system should be secure" into something specific and testable.'),
  (5, 'Requirements traceability',
   'Traceability links each requirement to the design, code, and test cases that implement and verify it, so a requirement change lets you identify everything affected.',
   'If a 24-hour cancellation window changes to 48 hours, traceability lets the team quickly find every piece of code and test that referenced the old rule.',
   'Explain one problem a team could run into if there is no clear link between a requirement and the tests meant to verify it.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'requirements-analysis-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Mobile Development Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Native vs cross-platform',
   'Native development gives full platform-API access and typically the best performance, at the cost of separate codebases per platform. Cross-platform frameworks share code but trade some platform-specific polish.',
   'A small team building an MVP with limited resources often chooses a cross-platform framework to ship on both iOS and Android from one codebase.',
   'Explain one scenario where choosing native development over cross-platform would be the better tradeoff, and why.'),
  (2, 'Offline-first design',
   'Mobile users frequently lose connectivity, so a well-designed app should function reasonably offline, caching data and queuing actions to sync when connectivity returns.',
   'A notes app that lets you keep writing while offline and syncs automatically once connectivity returns provides a far better experience than one that errors out.',
   'Describe what should happen, from a user''s perspective, when they submit a form right as they lose network connectivity, in a well-designed offline-first app.'),
  (3, 'App lifecycle states',
   'A mobile app moves through states such as foreground, background, and terminated, managed by the OS -- code needs to handle being backgrounded at any moment.',
   'A half-finished form should save its draft state when the app is backgrounded, so terminating the app to free memory does not lose the user''s progress.',
   'Explain why a mobile app cannot assume it will keep running indefinitely just because the user has not explicitly closed it.'),
  (4, 'App store review and release considerations',
   'Both major app stores review submissions before publishing, and rejections can add days to a release timeline -- planning with review time in mind avoids last-minute surprises.',
   'A team planning a marketing launch needs to submit for review several days in advance, since a rejection requiring a fix would need resubmission.',
   'Explain why "submit for release the same day as your planned launch" is a risky release strategy for a mobile app.'),
  (5, 'Mobile performance constraints',
   'Mobile apps must be mindful of battery drain, limited memory the OS can reclaim, and variable network conditions, none of which a typical desktop web app has to worry about the same way.',
   'Polling GPS location every second in the background drains a user''s battery noticeably faster than checking location only when actually needed.',
   'Name one mobile-specific performance constraint that a typical desktop web application does not need to worry about as much, and why it matters on mobile.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'mobile-development-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;
