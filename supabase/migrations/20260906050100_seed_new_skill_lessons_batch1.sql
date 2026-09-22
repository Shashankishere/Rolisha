-- CONTENT EXPANSION -- Phase F (learning content), lessons batch 1
-- Lessons for the 12 topics seeded in 20260906050000_seed_new_skill_topics_batch1.sql

-- Kubernetes Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Pods, Deployments and the reconciliation loop',
   'A Pod is the smallest deployable unit in Kubernetes -- one or more containers that share network and storage. You almost never create Pods directly; a Deployment manages a set of identical Pods via a ReplicaSet, and Kubernetes'' control loop continuously reconciles the actual state toward the desired state you declared, replacing any Pod that dies.',
   'kubectl create deployment web --image=nginx --replicas=3 creates a Deployment; kill one of the resulting pods and Kubernetes replaces it automatically within seconds.',
   'Explain, in your own words, why declaring "I want 3 replicas" is more resilient than manually starting 3 containers yourself.'),
  (2, 'Services and networking basics',
   'Pods are ephemeral and get new IPs when replaced, so a Service provides a stable virtual IP and DNS name that load-balances traffic across whichever Pods currently match its label selector. ClusterIP (internal-only) is the default; NodePort and LoadBalancer expose a Service outside the cluster.',
   'A Service selecting app: web will route traffic to any Pod carrying that label, even after Kubernetes replaces the underlying Pods.',
   'Given a Deployment labeled app: api, write the kubectl command to expose it internally on port 80 as a ClusterIP Service.'),
  (3, 'ConfigMaps, Secrets and configuration',
   'Hardcoding configuration or credentials into a container image makes it non-portable and insecure. ConfigMaps hold non-sensitive configuration; Secrets hold sensitive values (base64-encoded, not encrypted by default) -- both can be mounted as environment variables or files.',
   'A DATABASE_URL that differs between staging and production belongs in a ConfigMap, injected into the container as an env var, not baked into the image.',
   'Explain why a Kubernetes Secret alone, with no additional KMS integration, is not sufficient to call your credentials "encrypted at rest."'),
  (4, 'Debugging a Pod that will not start',
   'kubectl get pods shows the Pod''s status (Pending, CrashLoopBackOff, ImagePullBackOff); kubectl describe pod shows events explaining why; kubectl logs shows the container''s own output. Working through these three commands in order resolves the large majority of "why won''t my Pod start" problems.',
   'A Pod stuck in ImagePullBackOff almost always means a typo in the image name/tag or missing registry credentials -- kubectl describe pod will show the exact pull error.',
   'A Pod shows status CrashLoopBackOff. List, in order, the three kubectl commands you would run to diagnose why, and what each one tells you.'),
  (5, 'Namespaces and resource requests/limits',
   'Namespaces partition a cluster so teams can share it without colliding on names. Resource requests tell the scheduler how much CPU/memory a Pod needs to be placed; limits cap how much it can consume -- omitting them lets one misbehaving Pod starve its neighbors on the same node.',
   'A Pod with no memory limit that leaks memory can consume an entire node''s RAM and get every other Pod on that node evicted -- setting resources.limits.memory prevents this.',
   'Explain the difference between a resource "request" and a "limit," and what happens if a container tries to use more memory than its limit.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'kubernetes-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Terraform Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Providers, resources and the declarative model',
   'Terraform is declarative: you describe the infrastructure you want, not the steps to create it, and Terraform figures out what API calls to make. A provider block configures which cloud Terraform talks to.',
   'resource "aws_instance" "web" { ami = "ami-123"; instance_type = "t3.micro" } declares one desired EC2 instance; Terraform handles the actual API calls to create it.',
   'Explain the difference between a declarative tool like Terraform and an imperative script that runs a sequence of "create this, then that" API calls.'),
  (2, 'State: what it is and why it is dangerous to lose',
   'Terraform state is a file, or remote backend, mapping your configuration to real-world resource IDs. Without it, Terraform cannot know what it already created. Losing or corrupting state, or two people applying at once without remote locking, is one of the most common ways teams break Terraform-managed infrastructure.',
   'If you delete terraform.tfstate and run terraform apply again, Terraform believes nothing exists yet and will try to create duplicate resources instead of recognizing the ones already running.',
   'Explain why a team of more than one person should use a remote state backend, such as S3 with DynamoDB locking, instead of a local state file.'),
  (3, 'Variables and outputs for reusable configuration',
   'Hardcoded values make a configuration usable only once. Variable blocks let callers customize a configuration; output blocks expose values for use elsewhere, such as feeding into another Terraform configuration or a CI pipeline.',
   'variable "environment" { default = "staging" } lets the same configuration deploy to staging or production by overriding one value at apply time.',
   'Rewrite a hardcoded instance_type = "t3.micro" as a variable with a sensible default, and explain why that is an improvement.'),
  (4, 'Plan before apply',
   'terraform plan shows exactly what will change -- create, update, or destroy -- without touching real infrastructure. terraform apply executes those changes. Skipping plan is how teams accidentally destroy production resources, since a small config change can sometimes force a resource to be replaced rather than updated in place.',
   'Changing certain immutable attributes, like an AWS instance''s availability zone, forces Terraform to destroy and recreate the resource -- plan will clearly show this before apply would otherwise do it silently.',
   'Explain what a destroy-and-recreate line in a Terraform plan output means, and why you should stop and investigate before applying it.'),
  (5, 'Modules for avoiding repetition',
   'A module is a reusable, parameterized package of Terraform configuration -- the same pattern as a function in a programming language. Instead of copy-pasting the same setup across every environment, you call a module with different inputs.',
   'A modules/vpc module called once for staging and once for production with different CIDR ranges avoids maintaining two nearly-identical copies of the same 200-line configuration.',
   'Describe one concrete piece of infrastructure in a typical web app you would turn into a module, and what inputs it would need.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'terraform-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- MLOps Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'From notebook to production system',
   'A notebook is fine for exploration, but a production ML system needs versioned code, a defined API contract, tests, and a repeatable training pipeline -- none of which a notebook naturally provides. MLOps is largely about applying standard software engineering discipline to the ML lifecycle.',
   'A model trained by manually running notebook cells in some order is not reproducible; a training script that can be re-run end-to-end with the same inputs and produce the same model is.',
   'List two things a production ML pipeline needs that a one-off notebook typically does not have.'),
  (2, 'Experiment tracking and model versioning',
   'Because the same code can produce different models depending on data version, hyperparameters and random seed, MLOps practice tracks all three alongside each trained model''s metrics -- so you can answer which exact data and settings produced the model currently in production.',
   'Tools like MLflow or Weights & Biases log the dataset version, hyperparameters, and evaluation metrics for every training run, so a specific production model can be traced back to exactly what produced it.',
   'Explain why "we retrained the model and it got worse" is hard to debug without experiment tracking, and what information you would need to investigate it.'),
  (3, 'Feature stores and training/serving skew',
   'Training/serving skew happens when the way a feature is computed during training differs subtly from how it is computed at prediction time in production. A feature store centralizes feature computation so training and serving use identical logic.',
   'If "average purchase in the last 30 days" is computed with a slightly different date-boundary logic in the training pipeline versus the live API, the model can silently underperform in production despite looking fine offline.',
   'Give one example of a feature where training and serving code could easily compute slightly different values if written separately.'),
  (4, 'Model monitoring and drift',
   'A model''s real-world performance can degrade over time as the input data distribution shifts (data drift) or the relationship between inputs and outputs changes (concept drift) -- neither of which shows up until you are specifically monitoring for it.',
   'A fraud model trained on pre-pandemic spending patterns can silently degrade as consumer behavior shifts, with no error or crash -- only a slow decline in real-world precision that monitoring would catch.',
   'Explain the difference between data drift and concept drift with your own example of each.'),
  (5, 'A basic CI/CD pipeline for ML',
   'An ML CI/CD pipeline typically runs automated tests on the training code, validates a newly trained model against a held-out benchmark before allowing deployment, and supports rolling back to a previous model version if the new one underperforms.',
   'A pipeline that blocks deployment unless the new model beats the currently-deployed model''s accuracy on a fixed validation set prevents a regression from silently reaching production.',
   'Describe one automated check you would want in an ML CI/CD pipeline before a new model is allowed to replace the one currently serving traffic.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'mlops-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Large Language Model Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Tokens, not words',
   'LLMs process text as tokens -- pieces of words, not whole words or characters -- and pricing, context limits, and output length are all measured in tokens. A rough rule of thumb is one token is about 4 characters of English text, but this varies by language and content.',
   '"unbelievable" might be split into tokens like "un", "believ", "able" rather than treated as one unit -- which is why token counts do not map cleanly onto word counts.',
   'Explain why a request with a 100,000-character document might fail with a "context length exceeded" error even though it seems like a short document.'),
  (2, 'Context window',
   'The context window is the maximum number of tokens a model can consider at once. Content outside that window is simply not seen by the model -- it does not remember earlier conversation once it scrolls out of the window unless it is explicitly re-included in the prompt.',
   'In a long chat, once the conversation exceeds the model''s context window, the earliest messages are typically dropped or summarized -- the model has no memory of them unless they are re-sent.',
   'Explain why a chatbot appearing to "forget" something said much earlier in a long conversation is not necessarily a bug.'),
  (3, 'Why models hallucinate',
   'An LLM generates the statistically most plausible next token given its training and the prompt -- it has no built-in mechanism to check whether a specific fact is true. When it lacks reliable information, it will still produce a fluent, confident-sounding answer that may be fabricated.',
   'Asked for a citation it does not actually know, a model may generate a plausible-looking paper title, author and year that does not exist -- fluent output is not the same as verified output.',
   'Explain, in your own words, why hallucination is a natural consequence of how LLMs generate text, not a rare bug that will simply be fixed.'),
  (4, 'Base models vs instruction-tuned models',
   'A base model is trained purely to predict the next token from raw text and will often just continue your prompt rather than answer it. An instruction-tuned model is further trained on examples of instructions and desired responses, which is what makes it behave like an assistant.',
   'A base model given "What is the capital of France?" might continue with more geography trivia questions rather than answering; an instruction-tuned model answers "Paris."',
   'Explain why simply having a large, well-trained base model is not enough to build something that behaves like a helpful chat assistant.'),
  (5, 'Temperature and output randomness',
   'Temperature controls how random the model''s token choices are. Low temperature makes output more deterministic and focused, good for factual tasks; higher temperature increases variety and creativity but also the risk of less coherent or more hallucinated output.',
   'Asking the same factual question at temperature 0 will typically return nearly the same answer every time; asking it at temperature 1.0 for a creative writing prompt will return noticeably different results each run.',
   'Would you set temperature closer to 0 or closer to 1 for a task that extracts structured data from a document? Explain why.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'llm-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Prompt Engineering Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Specificity beats cleverness',
   'A vague prompt gets a vague or unpredictable answer. Specifying the exact format, length, audience, and constraints you want dramatically improves consistency -- this matters more for reliable results than any single magic phrase.',
   '"Summarize this" gives an unpredictable length and tone; "Summarize this in exactly 3 bullet points, for a non-technical reader, under 15 words each" gives a consistent, checkable result.',
   'Rewrite the vague prompt "write something about our product" into a specific prompt with format, length and audience constraints.'),
  (2, 'Few-shot prompting with examples',
   'Showing the model one to three examples of the input/output pattern you want, known as few-shot prompting, is often far more reliable than describing the desired format in words alone.',
   'Instead of describing "extract name and date in JSON," showing one example input paired with the exact JSON you want reliably teaches the model the format by demonstration.',
   'Explain why showing one worked example is often more reliable than a long paragraph describing the desired output format.'),
  (3, 'Structured output requests',
   'When you need machine-parseable output, explicitly specifying the exact structure -- and, where the API supports it, using a structured-output feature -- reduces the chance of the model adding conversational filler around the data you need to parse.',
   'Asking for "just the JSON object, no explanation, matching this exact schema" is far more parseable than "give me the data" and hoping the response has no friendly intro sentence.',
   'Explain one risk of parsing an LLM''s raw text output as JSON without validating it first.'),
  (4, 'Chain-of-thought prompting',
   'Asking a model to think step by step before giving a final answer often improves accuracy on multi-step reasoning or math problems, because it gives the model room to work through intermediate steps as tokens rather than jumping straight to a possibly wrong answer.',
   'For "if a train travels 60mph for 2.5 hours, how far does it go," asking the model to show its work step by step is more reliable than asking only for the final number.',
   'Give one example of a task where chain-of-thought prompting would likely help, and one where it probably would not matter.'),
  (5, 'Prompting is not a substitute for evaluation',
   'A prompt that looks good on a handful of manual tests can still fail unpredictably on inputs you did not try. Any prompt used in a real product needs an evaluation set of representative inputs with expected outputs, checked systematically.',
   'A resume-screening prompt that works well on five test resumes might fail badly on resumes with unusual formatting or non-English names -- you would not know without a broader evaluation set.',
   'Explain why "I tried it a few times and it looked right" is not sufficient evidence that a prompt is production-ready.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'prompt-engineering-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Retrieval-Augmented Generation Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Why RAG exists',
   'An LLM''s knowledge is frozen at training time and does not include your private documents. RAG solves this by retrieving relevant text from an external source at query time and inserting it into the prompt, so the model can answer using information it was never trained on.',
   'A support chatbot can answer questions about a product released last month by retrieving the relevant help-doc paragraph at query time, even though the model itself has never seen that document during training.',
   'Explain why fine-tuning a model on your documents is usually a worse solution than RAG for keeping answers up to date with frequently-changing information.'),
  (2, 'Chunking documents',
   'Documents are split into smaller chunks before being indexed, because embedding and retrieving an entire long document as one unit loses precision. Chunk size is a tradeoff: too small loses context, too large dilutes relevance.',
   'Splitting a 50-page policy document into chunks by section, rather than one giant chunk, lets a retrieval system return the exact relevant section instead of the entire document.',
   'Explain what could go wrong if chunks are too small, such as one sentence each, versus too large, such as one chunk per 20-page document.'),
  (3, 'Embeddings and vector similarity search',
   'An embedding model converts text into a vector of numbers such that semantically similar text produces similar vectors. At query time, the question is embedded and compared against stored chunk embeddings to find the most relevant ones.',
   'A query about "canceling a subscription" can retrieve a chunk that talks about "ending your plan" even without any shared exact keywords, because their embeddings are close in vector space.',
   'Explain why embedding-based retrieval can succeed where a simple keyword search would fail.'),
  (4, 'Combining retrieved context with the prompt',
   'The retrieved chunks are inserted into the prompt alongside the user''s question, typically with an instruction to answer only using the provided context and to say so if the answer is not present -- reducing, not eliminating, hallucination.',
   'A prompt like "Answer using ONLY the context below. If the answer isn''t in the context, say you don''t know." is far less likely to fabricate an answer than an ungrounded prompt.',
   'Explain why instructing the model to say "I don''t know" when the context does not contain the answer is an important part of a RAG prompt, not an optional nicety.'),
  (5, 'Evaluating a RAG system',
   'A RAG system can fail in two independent places: retrieval, where the wrong chunks were found, or generation, where the right chunks were found but the model still answered incorrectly. Evaluating each separately is necessary to know which part is broken.',
   'If a RAG system gives a wrong answer, checking which chunks were retrieved first tells you whether it is a retrieval problem or a generation problem.',
   'Describe how you would build a small evaluation set to test whether a RAG system''s retrieval step is working correctly, separate from testing the final answer quality.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'rag-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Data Structures & Algorithms Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Big-O: why it matters',
   'Big-O describes how an algorithm''s runtime or memory grows as input size grows, not the exact runtime. An algorithm that is fine on tiny inputs can become dramatically slower than an alternative once the growth rate dominates at scale.',
   'A nested loop checking every pair in a list of 10,000 items runs 100 million comparisons; a hash-map-based approach checking each item once runs roughly 10,000 operations -- the difference is enormous at scale.',
   'Explain why an algorithm that works fine in testing with 100 items could become unusable in production with 10 million items.'),
  (2, 'Arrays vs hash maps',
   'An array gives fast access by index but slow lookup by value, since you have to scan. A hash map gives fast average-case lookup by key at the cost of extra memory and no guaranteed order in most languages.',
   'Checking whether a user ID has been seen before repeatedly is slow with an array, scanning each time, but fast on average with a hash set -- the difference matters enormously in a loop.',
   'You need to check whether any value in a list appears more than once. Explain why a hash set gives a faster solution than nested loops.'),
  (3, 'Two pointers and sliding window',
   'Two pointers, often start and end of a sorted array moving toward each other, and sliding window, a moving subrange of fixed or variable size, turn many brute-force problems into linear-time solutions by avoiding redundant re-scanning.',
   'Finding two numbers in a sorted array that sum to a target can be done with two pointers moving inward, instead of checking every pair.',
   'Describe, at a high level, how you would use a sliding window to find the length of the longest substring without repeating characters, without writing full code.'),
  (4, 'Stacks and queues in real systems',
   'A stack, last in first out, naturally models nested or recursive structures like function calls or undo history. A queue, first in first out, models processing things in the order they arrived, like a task queue.',
   'A browser''s back button is a stack -- the most recently visited page is the first one you go back to; a print queue is a FIFO queue -- jobs print in the order they were submitted.',
   'Give one real-world example each of something that behaves like a stack and something that behaves like a queue, other than the ones already given.'),
  (5, 'Graph traversal: BFS and DFS',
   'BFS explores level by level using a queue and finds the shortest path in an unweighted graph. DFS explores as deep as possible before backtracking, usually via recursion, and is often simpler for tasks like detecting cycles.',
   'Finding the shortest number of hops between two people in a social network is a BFS problem; exploring all possible paths through a maze is more naturally a DFS problem.',
   'Explain why BFS, not DFS, is the right choice when you specifically need the shortest path in an unweighted graph.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'data-structures-algorithms-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Test Automation Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'The test pyramid',
   'The test pyramid recommends many fast unit tests, fewer integration tests, and the fewest end-to-end tests, because E2E tests are the slowest, most brittle, and most expensive to maintain.',
   'A bug in a discount-calculation function is far cheaper to catch with a unit test that runs in milliseconds than with an E2E test that spins up a browser and checks the final price.',
   'Explain why a test suite made up almost entirely of slow end-to-end UI tests is considered an anti-pattern, even if it technically covers the app.'),
  (2, 'Writing a reliable UI test',
   'A good UI test selects elements by stable attributes, like a test ID, rather than a CSS class that changes with styling, and waits for actual conditions rather than a fixed sleep.',
   'page.getByTestId(''submit-button'').click() is far more stable across UI redesigns than a CSS selector that breaks the moment styling changes.',
   'Explain why using a fixed sleep instead of an explicit wait-for-condition is a common cause of both flaky and needlessly slow tests.'),
  (3, 'Flaky tests and their common causes',
   'A flaky test passes and fails intermittently with no code change, usually due to timing issues, shared unclean test state between runs, or reliance on external systems not fully controlled in the test environment.',
   'A test that assumes a previous test left the database in a specific state will pass when run alone but fail when run after a different test.',
   'List two common causes of test flakiness, and one concrete fix for each.'),
  (4, 'Managing test data',
   'Automated tests need predictable data to assert against. Common approaches are seeding a known dataset before each run, using a dedicated test database that resets between runs, or generating unique data per test.',
   'Two tests that both hardcode signing up with the same test email will collide and fail intermittently when run in parallel -- generating a unique email per test run avoids this.',
   'Explain one problem that can occur when multiple automated tests share the same hardcoded test account, and one way to avoid it.'),
  (5, 'What belongs in CI',
   'Fast, reliable tests should run on every pull request and block merging on failure. Slower or less reliable suites are often run less frequently so they do not bottleneck every commit.',
   'A 45-minute full E2E suite blocking every single PR merge will frustrate a team far more than running it nightly and running only a fast smoke-test subset on each PR.',
   'Explain the tradeoff a team makes when deciding whether a given test suite should block every PR versus run on a schedule.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'test-automation-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- NumPy Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Why NumPy arrays, not Python lists',
   'A Python list stores general Python objects with overhead per element; a NumPy array stores a fixed-type, contiguous block of memory, which lets NumPy perform operations in fast, compiled code instead of a slow Python-level loop.',
   'Squaring every element of a million-item Python list with a for loop is dramatically slower than the equivalent NumPy vectorized operation, often by 10 to 100 times.',
   'Explain, in your own words, why a vectorized NumPy operation is faster than an equivalent Python list comprehension.'),
  (2, 'Vectorized operations instead of loops',
   'Vectorization means expressing an operation as a whole-array computation rather than a manual element-by-element loop -- NumPy applies the operation internally in optimized compiled code.',
   'Multiplying an entire array of prices by 1.1 applies a 10 percent increase in one vectorized operation, instead of looping through each price individually.',
   'Rewrite a loop that adds two same-length Python lists element by element as a single vectorized NumPy expression.'),
  (3, 'Array shapes and reshaping',
   'Every NumPy array has a shape describing its dimensions. Reshape changes how the same underlying data is viewed without copying it, which is essential for feeding data into models expecting a specific shape.',
   'A flat array of 12 numbers can be reshaped to (3, 4), (4, 3), (2, 6) or (12,) -- all describing the same 12 values arranged differently.',
   'Given a flat array of 20 numbers, what are two valid 2D shapes you could reshape it into, and why must the total element count match?'),
  (4, 'Broadcasting',
   'Broadcasting lets NumPy perform operations between arrays of different but compatible shapes without explicitly copying data to match sizes.',
   'Subtracting the per-column mean from every row of a matrix can be done in one broadcasted operation, without writing an explicit loop over rows.',
   'Explain what broadcasting lets you do when adding a smaller array to every row of a larger 2D array, and why the shapes are compatible.'),
  (5, 'Boolean indexing',
   'A boolean array of the same shape can be used to select only the elements where a condition is true, which is the standard NumPy way to filter data.',
   'An expression like arr[arr > 100] returns only the elements greater than 100, in one expression, instead of a manual loop appending matches to a new list.',
   'Given an array of temperatures, write the NumPy expression that returns only the temperatures above 30.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'numpy-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Apache Spark Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Why distributed processing exists',
   'Spark exists to process datasets too large to fit in memory, or process fast enough, on one machine, by splitting the work across a cluster. Using Spark for a dataset that fits comfortably in memory adds unnecessary overhead.',
   'A 500MB CSV is comfortably handled by pandas on a laptop; a 500GB dataset spread across many files is where Spark''s distributed processing actually earns its complexity.',
   'Explain why reaching for Spark on a dataset that fits comfortably in memory on a single machine is often the wrong tool choice.'),
  (2, 'Transformations vs actions',
   'Spark operations are either transformations, which describe a new dataset but do not compute anything yet, or actions, which actually trigger computation.',
   'Chaining filter and select builds up a plan but computes nothing; only calling count or write afterward actually triggers Spark to execute the plan.',
   'Explain why calling filter on a Spark DataFrame does not immediately do any computation.'),
  (3, 'Lazy evaluation',
   'Because transformations are lazy, Spark builds an execution plan of all the transformations chained together, then optimizes the whole plan before running it when an action is finally called.',
   'Chaining multiple filters and a select lets Spark''s optimizer potentially combine or reorder these steps for efficiency before any actual computation happens.',
   'Explain one advantage lazy evaluation gives Spark''s query optimizer that eager, immediate execution would not allow.'),
  (4, 'Partitioning and performance',
   'Spark splits data into partitions distributed across the cluster''s workers. An operation that requires shuffling data between partitions, like a groupBy or join on a non-partitioned key, is one of the most expensive things Spark does.',
   'A groupBy on a column that is not already used to partition the data forces Spark to shuffle data across the network between workers, often the single biggest performance cost in a job.',
   'Explain why a groupBy or join operation is often the most expensive part of a Spark job, in terms of what has to happen across the cluster.'),
  (5, 'DataFrames as the primary API',
   'Spark''s DataFrame API provides a structured, SQL-like interface with named columns and types, and benefits from Spark''s Catalyst query optimizer, which is why modern Spark code favors DataFrames over the older, lower-level RDD API.',
   'A DataFrame filter followed by a groupBy and sum reads similarly to SQL and lets Spark''s optimizer reason about the query, unlike equivalent low-level RDD transformations.',
   'Name one advantage the DataFrame API has over the lower-level RDD API for a typical data engineering task.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'apache-spark-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Cloud (Azure) Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Resource groups and subscriptions',
   'Every Azure resource lives inside a resource group, a logical container typically deleted as a unit -- a useful pattern for grouping resources that share a lifecycle, like all the pieces of one application environment.',
   'Deleting a staging resource group cleanly tears down every resource tied to that environment in one operation, rather than deleting each resource individually.',
   'Explain one advantage of organizing related resources into a single resource group rather than scattering them loosely.'),
  (2, 'Compute options: VMs, App Service, Functions',
   'Azure VMs give full control over the OS at the cost of managing patching and scaling yourself. App Service is a managed platform that handles scaling and patching for you. Azure Functions run code in response to events without managing any server.',
   'A team that just needs to run a web API without managing servers would typically choose App Service; a short task triggered by a file upload is a natural fit for a Function.',
   'For a small script that should run once per day processing a file, which compute option is the best fit, and why?'),
  (3, 'Storage account types',
   'An Azure Storage account can hold Blob storage for unstructured files, File shares for SMB-mounted network shares, Queue storage for message queuing, and Table storage as a simple NoSQL key-value store.',
   'Storing user-uploaded profile photos belongs in Blob storage; a legacy application that needs a network drive it can mount would use a File share instead.',
   'Which Azure storage type would you use to store large uploaded video files, and why not one of the others?'),
  (4, 'Azure Active Directory / Entra ID for identity',
   'Azure AD, now branded Microsoft Entra ID, is Azure''s identity service -- it controls who can access what, both for human users and for applications, via service principals or managed identities.',
   'A web app that needs to read from a storage account should use a managed identity rather than embedding a storage account key directly in its configuration.',
   'Explain why using a managed identity is generally safer than embedding a static access key in application configuration.'),
  (5, 'Basic cost management',
   'Common cost levers include right-sizing VMs, using auto-shutdown for non-production VMs outside working hours, choosing reserved instances for predictable workloads, and setting budget alerts.',
   'A development VM left running 24/7 that is only actually used 8 hours a day on weekdays pays for roughly 4 times more compute time than needed.',
   'Name one concrete way to reduce cost on a non-production VM that is only used during business hours.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'cloud-azure-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;

-- Redis Fundamentals
INSERT INTO public.learning_lessons (topic_id, sort_order, title, content, example, practice)
SELECT t.id, v.ord, v.title, v.content, v.example, v.practice
FROM (VALUES
  (1, 'Why Redis is fast, and what that costs',
   'Redis keeps data in memory rather than on disk, which is why reads and writes are extremely fast compared to a disk-based database -- but data can be lost on a crash unless persistence is explicitly configured.',
   'A cache miss that would take 200ms querying a relational database might take under 1ms from Redis -- but a Redis instance without persistence enabled loses all its data if the process restarts.',
   'Explain the fundamental trade-off Redis makes to achieve its speed, and one consequence of that trade-off.'),
  (2, 'Core data types',
   'Beyond simple strings, Redis supports hashes for small objects, lists for ordered queues, sets for unique membership checks, and sorted sets for values ordered by score, good for leaderboards.',
   'A leaderboard is naturally a Redis sorted set, where score equals points and results are automatically ordered; a user session with multiple fields fits naturally as a hash.',
   'Which Redis data type would you use to build a top-10 most-active-users leaderboard, and why?'),
  (3, 'TTL and expiration',
   'Any Redis key can have a time-to-live after which it is automatically deleted -- this is the core mechanism behind using Redis as a cache: store a value with an expiration and let Redis evict stale data automatically.',
   'Caching an expensive API response with a 5-minute TTL means the cache automatically refreshes itself every 5 minutes without any manual cleanup job.',
   'Explain why setting a TTL on cached data is usually better than caching it forever with no expiration.'),
  (4, 'The cache-aside pattern',
   'The most common caching pattern is cache-aside: on a read, check the cache first; on a miss, fetch from the real database, store the result in the cache, then return it.',
   'A product page checks Redis first; on a cache miss, it queries Postgres for the product, stores the result in Redis with a TTL, and returns it.',
   'Walk through, step by step, what happens on a cache-aside read that results in a cache miss.'),
  (5, 'Redis is not your primary database, usually',
   'Because Redis trades durability for speed, it is generally used alongside a durable primary database rather than as the sole source of truth for critical data.',
   'Losing a Redis cache of product listings just means the next request is a bit slower while it rebuilds from Postgres; losing your only copy of user account data would be catastrophic.',
   'Explain why it is generally risky to use Redis as the only place a critical piece of data is stored.')
) AS v(ord, title, content, example, practice)
JOIN public.learning_topics t ON t.slug = 'redis-fundamentals'
ON CONFLICT (topic_id, sort_order) DO NOTHING;
