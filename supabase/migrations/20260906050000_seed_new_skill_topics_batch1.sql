-- CONTENT EXPANSION — Phase F (learning content), topics batch 1
--
-- Audited: none of the 29 skills added in 20260906010000 had any
-- learning_topics/lessons yet, so the roadmap engine's content-aware
-- weekly plan (added in this session) falls back to its generic task for
-- all of them. This adds real topics + lessons (see the paired
-- 20260906050100 migration) for the 12 skills most central to the highest
-- volume of new careers: DevOps/Cloud (kubernetes, terraform, cloud-azure,
-- redis), AI/ML (mlops, llms, prompt-engineering, rag), Data
-- (numpy, apache-spark), and cross-cutting engineering skills
-- (data-structures-algorithms, test-automation) used by many careers.
--
-- The remaining ~17 new skills still fall back to the roadmap's generic
-- task and are left for a follow-up batch rather than being rushed.

INSERT INTO public.learning_topics
  (slug, skill_id, title, why_it_matters, difficulty, estimated_hours, objectives, common_mistakes, target_level)
SELECT v.slug, s.id, v.title, v.why, v.diff::public.difficulty_level, v.hours, v.objectives, v.mistakes, v.target::public.proficiency_level
FROM (VALUES
  (
    'kubernetes-fundamentals','kubernetes','Kubernetes Fundamentals',
    'Kubernetes is required for DevOps Engineer, Cloud Engineer, Site Reliability Engineer and Cloud Security Engineer roles in this catalog — it is the standard way production workloads are deployed and scaled beyond a single machine.',
    'intermediate',8,
    ARRAY['Understand pods, deployments and services and how they relate','Deploy and update an application using kubectl','Understand how Kubernetes handles scaling and self-healing','Debug a pod that will not start','Understand namespaces and basic resource limits'],
    ARRAY['Treating a pod like a permanent VM instead of disposable, replaceable infrastructure','Forgetting to set resource requests/limits, causing noisy-neighbor problems','Exposing a Service without understanding the security implications','Not understanding the difference between a Deployment and a bare Pod'],
    'intermediate'
  ),
  (
    'terraform-fundamentals','terraform','Terraform Fundamentals',
    'DevOps Engineer, Cloud Engineer and Solutions Architect roles all require infrastructure as code — Terraform is the most widely adopted tool for declaring and provisioning cloud infrastructure across providers.',
    'intermediate',6,
    ARRAY['Write a basic Terraform configuration with providers and resources','Understand state and why it must be handled carefully','Use variables and outputs to make configuration reusable','Understand plan vs apply and why plan matters','Use modules to avoid repeating configuration'],
    ARRAY['Editing cloud infrastructure manually after adopting Terraform, causing drift','Committing terraform.tfstate (which can contain secrets) to version control','Running apply without reviewing plan first','Hardcoding values that should be variables'],
    'intermediate'
  ),
  (
    'mlops-fundamentals','mlops','MLOps Fundamentals',
    'Machine Learning Engineer and AI Engineer roles require getting models into reliable production systems, not just training them in a notebook — MLOps is the discipline that makes that repeatable.',
    'advanced',6,
    ARRAY['Understand the difference between training code and production ML systems','Understand model versioning and reproducibility','Understand the purpose of a feature store','Understand model monitoring and drift','Understand a basic CI/CD pipeline for ML'],
    ARRAY['Treating a Jupyter notebook as a deployable artifact','Not tracking which data/code/hyperparameters produced a given model version','Deploying a model with no monitoring for performance degradation','Assuming a model that scored well offline will perform the same in production'],
    'advanced'
  ),
  (
    'llm-fundamentals','llms','Large Language Model Fundamentals',
    'AI Engineer roles are built around working with large language models — understanding how they actually behave, and fail, is the foundation for building anything reliable on top of them.',
    'intermediate',5,
    ARRAY['Understand what a token is and why it matters for cost/limits','Understand what a context window is','Understand hallucination and why it happens','Understand base models vs instruction-tuned/chat models','Understand temperature and its effect on output'],
    ARRAY['Assuming token counts map cleanly onto word counts','Assuming a chatbot truly remembers everything said much earlier in a long conversation','Treating fluent output as verified, factual output','Assuming a larger base model alone behaves like a helpful assistant'],
    'intermediate'
  ),
  (
    'prompt-engineering-fundamentals','prompt-engineering','Prompt Engineering Fundamentals',
    'For AI Engineer roles, how a prompt is structured has a bigger effect on output quality and reliability than almost anything else controllable without fine-tuning a model.',
    'beginner',4,
    ARRAY['Write clear, specific prompts instead of vague ones','Use examples (few-shot prompting) to steer output format','Request structured output reliably','Understand chain-of-thought prompting and when it helps','Understand why prompt engineering is not a substitute for evaluation'],
    ARRAY['Relying on vague prompts and hoping for consistent output','Describing a desired format in prose instead of showing an example','Parsing raw LLM text output as JSON without validation','Assuming a prompt that worked in a few manual tries is production-ready'],
    'beginner'
  ),
  (
    'rag-fundamentals','rag','Retrieval-Augmented Generation Fundamentals',
    'AI Engineer roles building on top of LLMs almost always need RAG to ground answers in real, current or private data the model was never trained on.',
    'advanced',6,
    ARRAY['Understand why RAG exists and what problem it solves','Understand chunking and why chunk size matters','Understand embeddings and vector similarity search','Understand how retrieved context gets combined with a prompt','Understand how to evaluate a RAG system'],
    ARRAY['Fine-tuning a model to keep up with frequently-changing information instead of using RAG','Chunking documents without considering size tradeoffs','Assuming grounding in retrieved context eliminates hallucination entirely','Evaluating only final answers, never checking whether retrieval itself is working'],
    'advanced'
  ),
  (
    'data-structures-algorithms-fundamentals','data-structures-algorithms','Data Structures & Algorithms Fundamentals',
    'Nearly every technical career in this catalog draws on data structures and algorithms for both technical interviews and writing code that performs well at scale.',
    'intermediate',8,
    ARRAY['Understand Big-O notation and why it matters','Understand arrays, hash maps and when to use each','Understand common patterns: two pointers, sliding window','Understand stacks, queues and their real use cases','Understand basic graph traversal (BFS/DFS)'],
    ARRAY['Testing an algorithm only on tiny inputs where inefficiency does not show up','Using an array where a hash map would give O(1) lookup','Reaching for nested loops instead of a two-pointer or sliding-window pattern','Using DFS when the problem actually requires the shortest path (BFS)'],
    'intermediate'
  ),
  (
    'test-automation-fundamentals','test-automation','Test Automation Fundamentals',
    'QA Engineer and QA Automation Engineer roles are built around writing and maintaining automated tests that catch regressions before manual testers or users do.',
    'intermediate',6,
    ARRAY['Understand the test pyramid and why not all tests should be end-to-end','Write a basic UI test with a real automation tool','Understand flaky tests and their common causes','Understand test data management for automated tests','Understand what belongs in CI vs what does not'],
    ARRAY['Relying mostly on slow, brittle end-to-end tests instead of fast unit tests','Selecting UI elements by classes that change with styling instead of stable test IDs','Using fixed sleeps instead of waiting for real conditions','Letting a slow full regression suite block every single pull request'],
    'intermediate'
  ),
  (
    'numpy-fundamentals','numpy','NumPy Fundamentals',
    'Data Engineer, Data Scientist and Machine Learning Engineer roles all rely on NumPy as the foundation for numerical computing in Python — most other data/ML libraries are built on top of it.',
    'beginner',4,
    ARRAY['Understand why NumPy arrays are faster than Python lists for numerical work','Perform vectorized operations instead of manual loops','Understand array shapes and reshaping','Understand broadcasting','Use boolean indexing to filter arrays'],
    ARRAY['Writing manual Python loops over NumPy arrays instead of vectorizing','Reshaping an array to a shape whose element count does not match','Assuming broadcasting works between any two shapes','Not realizing boolean indexing returns a new filtered array, not a mask in place'],
    'beginner'
  ),
  (
    'apache-spark-fundamentals','apache-spark','Apache Spark Fundamentals',
    'Data Engineer roles use Spark as the standard tool for processing datasets too large to fit on, or process fast enough on, a single machine.',
    'advanced',6,
    ARRAY['Understand why Spark exists and when it is actually needed','Understand the difference between transformations and actions','Understand lazy evaluation','Understand partitioning and why it affects performance','Understand DataFrames as Spark''s primary API'],
    ARRAY['Reaching for Spark on a dataset that fits comfortably in memory on one machine','Expecting a transformation to compute something immediately','Not realizing a groupBy or join can trigger an expensive shuffle across the cluster','Using the low-level RDD API where the DataFrame API would be simpler and faster'],
    'advanced'
  ),
  (
    'cloud-azure-fundamentals','cloud-azure','Cloud (Azure) Fundamentals',
    'Cloud Engineer, Solutions Architect and DevOps Engineer roles at organizations using Microsoft''s ecosystem need working Azure knowledge alongside, or instead of, AWS.',
    'intermediate',5,
    ARRAY['Understand Azure''s resource group and subscription model','Understand core compute options: VMs, App Service, Functions','Understand Azure''s storage account types','Understand Azure Active Directory / Entra ID for identity','Understand basic cost management levers'],
    ARRAY['Scattering related resources across resource groups instead of grouping by lifecycle','Choosing a VM when a managed option like App Service or Functions would need far less operational work','Embedding a static storage account key instead of using a managed identity','Leaving non-production VMs running 24/7 with no auto-shutdown schedule'],
    'intermediate'
  ),
  (
    'redis-fundamentals','redis','Redis Fundamentals',
    'Full Stack Developer, Backend Developer and Database Administrator roles use Redis as the standard in-memory store for caching, sessions, and fast lookups where a full relational query would be overkill.',
    'beginner',4,
    ARRAY['Understand why Redis is fast (in-memory) and what that trade-off means','Understand basic data types: strings, hashes, lists, sets','Understand key expiration (TTL) and its use for caching','Understand the cache-aside pattern','Understand that Redis is not a replacement for a durable primary database'],
    ARRAY['Assuming Redis data survives a restart without persistence configured','Storing structured data as a plain string instead of a hash','Caching data with no TTL, letting it grow stale indefinitely','Using Redis as the only copy of critical, non-reproducible data'],
    'beginner'
  )
) AS v(slug, skill_slug, title, why, diff, hours, objectives, mistakes, target)
JOIN public.skills s ON s.slug = v.skill_slug
ON CONFLICT (slug) DO NOTHING;
