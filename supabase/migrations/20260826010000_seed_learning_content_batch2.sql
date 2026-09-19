-- Batch 2: real, non-placeholder learning content for 12 more skills that
-- already have a career mapping (career_skills) but no learning_topics row
-- yet, so they were falling through to "Coming soon" on /skills and having
-- no "Learn" link on /roadmap. Picked for maximum coverage across the 7
-- priority career paths (Data Analyst, Frontend Developer, Backend
-- Developer, Software Engineer, Product Manager, UI/UX Designer,
-- Cybersecurity Analyst).

-- Bugfix: the first learning-content seed (20260826000100) linked the SQL
-- Fundamentals topic to assessment slug 'sql-basics', but the actual seeded
-- assessment slug is 'sql-fundamentals' (see 20260824000000_seed_assessments),
-- so the join silently produced a NULL assessment_id. Fix the reference.
UPDATE public.learning_topics
SET assessment_id = (SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals')
WHERE slug = 'sql-fundamentals' AND assessment_id IS NULL;

INSERT INTO public.learning_topics
  (slug, skill_id, title, why_it_matters, difficulty, estimated_hours, objectives, common_mistakes, target_level)
SELECT v.slug, s.id, v.title, v.why, v.diff::public.difficulty_level, v.hours, v.objectives, v.mistakes, v.target::public.proficiency_level
FROM (VALUES
  (
    'python-fundamentals',
    'python',
    'Python Fundamentals',
    'Python appears as a required or preferred skill for Data Analyst, Software Engineer, Data Scientist and even Cybersecurity Analyst roles in this catalog — it is the most broadly useful general-purpose language for scripting, data work and backend services alike.',
    'beginner',
    7,
    ARRAY[
      'Work confidently with core data types: strings, numbers, lists, dicts, sets',
      'Write functions with default arguments and return values',
      'Use loops and comprehensions to transform data',
      'Understand mutability and how it causes subtle bugs',
      'Read and handle exceptions with try/except',
      'Structure a small script into reusable functions/modules'
    ],
    ARRAY[
      'Mutating a list while iterating over it',
      'Using a mutable default argument like def f(x=[]) that persists across calls',
      'Catching bare `except:` and silently swallowing real errors',
      'Writing one giant script instead of small, testable functions'
    ],
    'intermediate'
  ),
  (
    'statistics-fundamentals',
    'statistics',
    'Statistics Fundamentals',
    'Data Analyst and Data Scientist roles both list statistics as a core, often critical, requirement — it is what turns a spreadsheet of numbers into a defensible conclusion instead of a guess.',
    'beginner',
    6,
    ARRAY[
      'Distinguish mean, median and mode and know when each is misleading',
      'Explain standard deviation and variance in plain terms',
      'Understand what a p-value does and does not tell you',
      'Recognize correlation vs causation traps',
      'Choose an appropriate chart/summary for a distribution',
      'Understand sampling and why sample size affects confidence'
    ],
    ARRAY[
      'Reporting a mean for a heavily skewed distribution instead of a median',
      'Treating a low p-value as proof a result is important or large',
      'Assuming correlation implies causation without ruling out confounders',
      'Drawing strong conclusions from a very small, unrepresentative sample'
    ],
    'intermediate'
  ),
  (
    'excel-for-analysts',
    'excel',
    'Excel for Analysts',
    'Excel (and Excel-compatible tools like Google Sheets) is the single most in-demand tool for Data Analyst roles in this catalog — most business stakeholders expect analysis delivered in a spreadsheet they can open and manipulate themselves.',
    'beginner',
    5,
    ARRAY[
      'Use core formulas: SUM, AVERAGE, IF, COUNTIFS/SUMIFS',
      'Look up values across sheets with VLOOKUP/XLOOKUP and INDEX/MATCH',
      'Summarize data with PivotTables',
      'Clean messy data with text functions and Find & Replace',
      'Build a chart that actually communicates the right comparison',
      'Avoid the most common formula and reference mistakes'
    ],
    ARRAY[
      'Using relative references where an absolute reference ($A$1) was needed, breaking formulas when copied',
      'VLOOKUP that only looks rightward, missing columns to the left of the lookup column (XLOOKUP avoids this)',
      'Building a pivot table on unclean data (merged cells, inconsistent categories) and getting silently wrong totals',
      'Picking a pie chart for data with many categories or negative values, where a bar chart would communicate better'
    ],
    'intermediate'
  ),
  (
    'data-visualization-fundamentals',
    'data-visualization',
    'Data Visualization Fundamentals',
    'Both Data Analysts and Data Scientists are judged as much on how clearly they present findings as on the analysis itself — a technically correct chart that misleads or confuses the reader defeats the purpose of the analysis.',
    'beginner',
    4,
    ARRAY[
      'Choose the right chart type for the comparison you are making',
      'Avoid the most common misleading-chart mistakes (truncated axes, 3D distortion)',
      'Use color purposefully instead of decoratively',
      'Design for the audience: executive summary vs analyst deep-dive',
      'Label charts so they stand on their own without a verbal explanation'
    ],
    ARRAY[
      'Truncating a bar chart''s y-axis to exaggerate small differences',
      'Using more than 5-6 colors/categories in a single chart, making it unreadable',
      'Defaulting to a pie chart for data that would be clearer as a sorted bar chart',
      'Leaving a chart without axis labels, units, or a title, forcing the reader to guess'
    ],
    'intermediate'
  ),
  (
    'react-fundamentals',
    'react',
    'React Fundamentals',
    'React is the dominant UI library behind most modern frontend job postings in this catalog — Frontend Developer roles list it as a high-importance, high-demand requirement second only to JavaScript itself.',
    'beginner',
    7,
    ARRAY[
      'Understand components, props and one-way data flow',
      'Manage local state with useState and understand when re-renders happen',
      'Run side effects correctly with useEffect, including cleanup',
      'Render lists correctly with stable keys',
      'Lift state up when two components need to share it',
      'Recognize common causes of unnecessary re-renders'
    ],
    ARRAY[
      'Using an array index as a list key when items can be reordered/removed',
      'Forgetting the useEffect cleanup function, causing leaked subscriptions or timers',
      'Mutating state directly (state.push(x)) instead of creating a new array/object',
      'Overusing global state for data that only one component actually needs'
    ],
    'intermediate'
  ),
  (
    'typescript-fundamentals',
    'typescript',
    'TypeScript Fundamentals',
    'TypeScript is now expected alongside React/JavaScript in most Frontend Developer postings in this catalog — it catches an entire category of bugs (wrong types, typos in property names) before code ever runs.',
    'beginner',
    5,
    ARRAY[
      'Type variables, function parameters and return values',
      'Model shapes of data with interfaces and type aliases',
      'Use union types to represent a value that can be one of several types',
      'Understand how type narrowing works with if-checks',
      'Know when (and when not) to reach for `any`'
    ],
    ARRAY[
      'Reaching for `any` the moment a type error appears instead of fixing the actual type',
      'Not narrowing a union type before using a property that only exists on one branch',
      'Marking everything optional (field?: string) out of laziness, hiding real bugs',
      'Confusing `interface` extension with type intersection when they need slightly different behavior'
    ],
    'intermediate'
  ),
  (
    'system-design-fundamentals',
    'system-design',
    'System Design Fundamentals',
    'System design shows up as a high-importance skill for both Software Engineer and Backend Developer roles in this catalog — it is the skill interviewers use to see whether a candidate can reason about a system beyond a single function.',
    'intermediate',
    6,
    ARRAY[
      'Explain the difference between vertical and horizontal scaling',
      'Understand what a load balancer does and why statelessness matters for scaling',
      'Explain caching, and where it helps vs where it introduces staleness bugs',
      'Understand database read replicas and basic sharding at a conceptual level',
      'Reason about the CAP-theorem tradeoff in plain terms',
      'Sketch a simple system design (client -> API -> DB) for a small product'
    ],
    ARRAY[
      'Jumping straight to microservices for a system with no real scaling need yet',
      'Adding a cache without a plan for invalidation, causing stale data bugs',
      'Assuming a single database can scale indefinitely by just adding more RAM',
      'Designing for millions of users on day one instead of designing for the actual current load and evolving it'
    ],
    'intermediate'
  ),
  (
    'testing-fundamentals',
    'testing',
    'Automated Testing Fundamentals',
    'Automated testing is listed as a high-importance skill across Software Engineer, Backend Developer and Frontend Developer roles in this catalog — untested code is far more expensive to change safely, which is why teams filter for it directly.',
    'beginner',
    5,
    ARRAY[
      'Explain the difference between unit, integration and end-to-end tests',
      'Write a unit test with clear arrange/act/assert structure',
      'Use mocks/stubs to isolate a unit from its external dependencies',
      'Recognize a flaky test and know common causes',
      'Understand what test coverage does and does not guarantee'
    ],
    ARRAY[
      'Testing implementation details (private internals) instead of observable behavior, so tests break on harmless refactors',
      'Writing a test with no clear assertion, which passes even when the code is broken',
      'Chasing 100% coverage as a goal in itself instead of testing the paths that actually matter',
      'Leaving real network/database calls in a "unit" test, making it slow and flaky'
    ],
    'intermediate'
  ),
  (
    'postgresql-for-developers',
    'postgresql',
    'PostgreSQL for Developers',
    'PostgreSQL is the most commonly required relational database across Backend Developer and Software Engineer postings in this catalog — knowing SQL is necessary but not sufficient; understanding schema design, constraints and indexes is what production backend work actually needs.',
    'beginner',
    6,
    ARRAY[
      'Design a normalized schema with appropriate primary/foreign keys',
      'Use constraints (NOT NULL, UNIQUE, CHECK) to enforce data integrity in the database, not just the app',
      'Understand when and why to add an index, and its write-cost tradeoff',
      'Use transactions to keep multi-step writes consistent',
      'Understand row-level locking at a conceptual level to avoid basic race conditions'
    ],
    ARRAY[
      'Relying only on application code to enforce uniqueness/required fields instead of database constraints',
      'Adding an index to every column "just in case", slowing down writes for no benefit',
      'Performing multiple related writes outside a transaction, risking inconsistent state on failure',
      'Storing repeating groups of data in one column instead of a proper related table (violating normalization)'
    ],
    'intermediate'
  ),
  (
    'networking-fundamentals',
    'networking',
    'Networking Fundamentals',
    'Networking is the highest-demand, critical-importance skill for Cybersecurity Analyst roles in this catalog — you cannot detect or investigate an attack on traffic you don''t understand at the protocol level.',
    'beginner',
    6,
    ARRAY[
      'Explain the OSI/TCP-IP model layers at a working level',
      'Understand IP addressing, subnets and basic routing',
      'Explain how DNS resolution works, including why it is commonly abused in attacks',
      'Understand the TCP three-way handshake and common port/protocol pairs',
      'Read basic output from tools like ping, traceroute and netstat'
    ],
    ARRAY[
      'Confusing a public IP with a private (RFC 1918) address range',
      'Assuming HTTPS alone means a connection is fully trustworthy (it encrypts, it does not vouch for the destination''s intent)',
      'Not recognizing that a SYN with no completed handshake can indicate scanning activity',
      'Treating DNS as inherently safe and ignoring DNS-based exfiltration or spoofing risks'
    ],
    'intermediate'
  ),
  (
    'incident-response-fundamentals',
    'incident-response',
    'Incident Response Fundamentals',
    'Incident response is a critical-importance skill for Cybersecurity Analyst roles in this catalog — detecting an alert is only the first step; how an analyst triages, contains and documents an incident determines the actual business impact.',
    'intermediate',
    5,
    ARRAY[
      'Describe the standard incident response lifecycle (prepare, detect, contain, eradicate, recover, lessons learned)',
      'Distinguish containment from eradication and explain why order matters',
      'Know what to preserve for forensics before touching a compromised system',
      'Write a clear, factual incident timeline',
      'Understand escalation criteria: when an analyst should involve others immediately'
    ],
    ARRAY[
      'Wiping/rebooting a compromised system immediately, destroying volatile evidence needed for forensics',
      'Treating containment as "done" and skipping eradication, so the attacker persists via a hidden foothold',
      'Writing vague incident notes ("something looked weird") instead of specific, timestamped facts',
      'Sitting on an escalation-worthy incident too long instead of looping in the right people early'
    ],
    'intermediate'
  ),
  (
    'figma-for-designers',
    'figma',
    'Figma for Designers',
    'Figma is the critical-importance, most in-demand tool for UI/UX Designer roles in this catalog — it is where design actually gets produced, reviewed and handed off to engineering.',
    'beginner',
    5,
    ARRAY[
      'Structure a file with frames, components and variants',
      'Use auto-layout to build responsive-feeling components',
      'Build and reuse a component with variants instead of duplicating designs',
      'Use constraints so designs resize predictably',
      'Prepare a design for developer handoff (specs, exportable assets)'
    ],
    ARRAY[
      'Duplicating a button 10 times to make small variations instead of using variants/component properties',
      'Manually resizing/repositioning every element instead of using auto-layout, breaking on content changes',
      'Leaving constraints on "left and top" by default so redesigned frames resize incorrectly',
      'Handing off a design with no naming/spacing consistency, forcing engineers to guess intended values'
    ],
    'intermediate'
  )
) AS v(slug, skill_slug, title, why, diff, hours, objectives, mistakes, target)
JOIN public.skills s ON s.slug = v.skill_slug
ON CONFLICT (slug) DO NOTHING;
