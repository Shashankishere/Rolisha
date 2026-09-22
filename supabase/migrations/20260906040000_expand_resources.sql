-- CONTENT EXPANSION — Phase J (YouTube) + Phase K (external resources)
--
-- Audited: 34 resources existed before this migration, only 1 typed
-- 'video' (a Tableau training page — not YouTube), 0 real YouTube links.
--
-- Every URL below was individually checked via web search before being
-- added — none were invented. Two YouTube videos (Kubernetes, Terraform)
-- were confirmed by cross-referencing the exact video ID against multiple
-- independent citations (a course-aggregator listing and a third-party
-- forum post linking the same watch?v= URL). The rest are official-vendor
-- or well-established-provider documentation/course URLs (developer.
-- hashicorp.com, kubernetes.io, spark.apache.org, airflow.apache.org,
-- playwright.dev, huggingface.co, freecodecamp.org, etc.) confirmed live
-- via search results referencing the same path.
--
-- This batch intentionally covers the highest-value new skills rather than
-- all 29 — Redis, cloud-security, identity-access-management, clean-code
-- and a few others are left for a follow-up batch rather than filling them
-- with a lower-confidence resource just to raise the count.

INSERT INTO public.resources (title, provider, url, type, skill_id, is_free, description)
SELECT v.title, v.provider, v.url, v.rtype::public.resource_type, s.id, v.free, v.descr
FROM (VALUES
  ('Kubernetes Tutorial for Beginners [FULL COURSE in 4 Hours]','TechWorld with Nana','https://www.youtube.com/watch?v=X48VuDVv0do','video','kubernetes',true,'Hands-on 4-hour walkthrough of core Kubernetes components, architecture, kubectl, and a full demo deployment.'),
  ('Kubernetes Documentation','Kubernetes','https://kubernetes.io/docs/home/','documentation','kubernetes',true,'Official Kubernetes concepts, tasks and reference documentation.'),
  ('Complete Terraform Course - Beginner to Advanced','TechWorld with Nana','https://www.youtube.com/watch?v=SLB_c_ayRMo','video','terraform',true,'Hands-on Terraform course covering providers, resources, state, variables, provisioners and modules by automating AWS infrastructure.'),
  ('Terraform Documentation','HashiCorp','https://developer.hashicorp.com/terraform/docs','documentation','terraform',true,'Official Terraform language, CLI and provider documentation.'),
  ('Redis Documentation','Redis','https://redis.io/docs/latest/','documentation','redis',true,'Official Redis documentation covering data types, commands and deployment.'),
  ('Azure Documentation','Microsoft','https://learn.microsoft.com/en-us/azure/','documentation','cloud-azure',true,'Official Microsoft Learn documentation hub for Azure services.'),
  ('Google Cloud Documentation','Google Cloud','https://cloud.google.com/docs','documentation','cloud-gcp',true,'Official documentation hub for Google Cloud Platform services.'),
  ('MLOps Course: Build Machine Learning Production-Grade Projects','freeCodeCamp','https://www.freecodecamp.org/news/mlops-course-learn-to-build-machine-learning-production-grade-projects','course','mlops',true,'A 3-hour course on deploying and maintaining ML models reliably in production, covering the core MLOps lifecycle.'),
  ('Playwright Documentation','Microsoft','https://playwright.dev/docs/intro','documentation','test-automation',true,'Official Playwright documentation: installation, writing tests, fixtures, and CI setup for end-to-end testing.'),
  ('Data Structure and Algorithm Patterns for Coding Interviews','freeCodeCamp','https://www.freecodecamp.org/news/data-structure-and-algorithm-patterns-for-leetcode-interviews','course','data-structures-algorithms',true,'Covers core DSA patterns — arrays, hashmaps, two pointers, sliding window, BFS/DFS, backtracking — with practice problems.'),
  ('Apache Spark Documentation','Apache Spark','https://spark.apache.org/docs/latest/','documentation','apache-spark',true,'Official Spark programming guides, API docs and deployment guides.'),
  ('Apache Airflow Documentation','Apache Airflow','https://airflow.apache.org/docs/','documentation','airflow',true,'Official Airflow documentation covering DAGs, operators, scheduling and deployment.'),
  ('OWASP Top 10','OWASP','https://owasp.org/www-project-top-ten/','documentation','application-security',true,'The industry-standard reference for the most critical web application security risks.'),
  ('Design Patterns Catalog','Refactoring.Guru','https://refactoring.guru/design-patterns','documentation','design-patterns',true,'Clear explanations and examples of the classic Gang-of-Four design patterns.'),
  ('Hugging Face NLP Course','Hugging Face','https://huggingface.co/learn/nlp-course/chapter0/1','course','nlp',true,'Free course covering NLP with the Hugging Face ecosystem — Transformers, Datasets, Tokenizers and the Hub.'),
  ('NumPy Documentation','NumPy','https://numpy.org/doc/stable/','documentation','numpy',true,'Official NumPy reference and user guide for array computing in Python.'),
  ('React Native Documentation','Meta','https://reactnative.dev/docs/getting-started','documentation','mobile-development',true,'Official React Native documentation for building cross-platform mobile apps.'),
  ('Prometheus Documentation','Prometheus','https://prometheus.io/docs/introduction/overview/','documentation','monitoring-observability',true,'Official documentation for Prometheus, the widely-used monitoring and alerting toolkit.')
) AS v(title, provider, url, rtype, skill_slug, free, descr)
JOIN public.skills s ON s.slug = v.skill_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources existing
  WHERE existing.skill_id = s.id AND existing.url = v.url
);
