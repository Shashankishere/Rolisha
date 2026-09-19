-- BUG FIX — link new learning_topics to their matching new assessments
--
-- Found during the final verification pass, not a new content addition:
-- learning_topics.assessment_id is what the roadmap engine's
-- loadRoadmapContent() reads (via the embedded assessments(slug, title)
-- relation) to show a real "Checkpoint: take the X assessment" task at
-- month-end. All 29 topics seeded in 20260906050000/060000 were inserted
-- without setting assessment_id, and all 29 matching assessments seeded in
-- 20260906080000/090000 were never linked back — so every one of the new
-- skills' roadmap checkpoints was silently falling back to the generic
-- "Review and consolidate" text instead of naming the real assessment,
-- even though that assessment now exists.
--
-- This is the exact same bug class the codebase already hit once before
-- and fixed the same way — see the "Bugfix" comment in
-- 20260826010000_seed_learning_content_batch2.sql (a mismatched-slug
-- version of this same NULL-assessment_id problem for sql-fundamentals).
--
-- This migration links, it does not add: no new careers, skills, projects,
-- assessments, lessons, or resources. It is guarded by
-- `assessment_id IS NULL` so it is safe to re-run and will never overwrite
-- an intentionally-set link.

UPDATE public.learning_topics t
SET assessment_id = a.id
FROM public.assessments a, (VALUES
  ('kubernetes','kubernetes-fundamentals-quiz'),
  ('terraform','terraform-fundamentals-quiz'),
  ('redis','redis-fundamentals-quiz'),
  ('data-structures-algorithms','data-structures-algorithms-quiz'),
  ('test-automation','test-automation-quiz'),
  ('numpy','numpy-fundamentals-quiz'),
  ('authentication','authentication-fundamentals-quiz'),
  ('application-security','application-security-quiz'),
  ('prompt-engineering','prompt-engineering-quiz'),
  ('rag','rag-fundamentals-quiz'),
  ('database-design','database-design-quiz'),
  ('mlops','mlops-fundamentals-quiz'),
  ('llms','llm-fundamentals-quiz'),
  ('cloud-azure','cloud-azure-fundamentals-quiz'),
  ('cloud-gcp','cloud-gcp-fundamentals-quiz'),
  ('monitoring-observability','monitoring-observability-quiz'),
  ('infrastructure-as-code','infrastructure-as-code-quiz'),
  ('airflow','airflow-fundamentals-quiz'),
  ('nlp','nlp-fundamentals-quiz'),
  ('computer-vision','computer-vision-quiz'),
  ('generative-ai','generative-ai-quiz'),
  ('cloud-security','cloud-security-quiz'),
  ('identity-access-management','identity-access-management-quiz'),
  ('design-patterns','design-patterns-quiz'),
  ('clean-code','clean-code-quiz'),
  ('requirements-analysis','requirements-analysis-quiz'),
  ('mobile-development','mobile-development-quiz'),
  ('database-administration','database-administration-quiz'),
  ('apache-spark','apache-spark-quiz')
) AS v(skill_slug, assessment_slug)
WHERE t.skill_id = (SELECT id FROM public.skills WHERE slug = v.skill_slug)
  AND a.slug = v.assessment_slug
  AND t.assessment_id IS NULL;
