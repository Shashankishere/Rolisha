-- Seeds the first real assessment content. `assessments` and
-- `assessment_questions` have existed with full RLS since the initial
-- schema migration but have had zero rows — the Assessments page was
-- blocked on content, not on missing schema or missing UI plumbing.
--
-- Two assessments to start: SQL fundamentals (feeds data-analyst,
-- software-engineer, backend-developer, data-scientist — see
-- career_skills) and JavaScript fundamentals (feeds frontend-developer,
-- software-engineer). Both are original questions written for this seed,
-- not sourced from any external quiz bank.

INSERT INTO public.assessments (slug, title, skill_id, difficulty, description, pass_score)
VALUES
  (
    'sql-fundamentals',
    'SQL Fundamentals',
    (SELECT id FROM public.skills WHERE slug = 'sql'),
    'beginner',
    'Core SELECT, JOIN, and aggregation concepts every data role needs.',
    70
  ),
  (
    'javascript-fundamentals',
    'JavaScript Fundamentals',
    (SELECT id FROM public.skills WHERE slug = 'javascript'),
    'beginner',
    'Core language mechanics: types, scope, async, and array methods.',
    70
  )
ON CONFLICT (slug) DO NOTHING;

-- assessment_questions has no natural unique constraint (unlike assessments'
-- slug), so idempotency here uses WHERE NOT EXISTS keyed on
-- (assessment_id, sort_order) — the same natural key
-- learning_lessons_topic_id_sort_order_key enforces for lessons. Restructured
-- from a plain VALUES insert into SELECT ... FROM (VALUES ...) so the guard
-- can reference each row's assessment_id/sort_order.
INSERT INTO public.assessment_questions (assessment_id, prompt, options, correct_index, explanation, sort_order)
SELECT v.assessment_id, v.prompt, v.options, v.correct_index, v.explanation, v.sort_order
FROM (VALUES
  -- SQL Fundamentals (12 questions)
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'Which clause filters rows before any grouping happens?',
   ARRAY['HAVING','WHERE','GROUP BY','ORDER BY'], 1,
   'WHERE filters individual rows before GROUP BY runs; HAVING filters groups after aggregation.', 1),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'Which clause filters groups after an aggregate function has been applied?',
   ARRAY['WHERE','HAVING','LIMIT','ON'], 1,
   'HAVING runs after GROUP BY, so it can reference aggregate results like COUNT() or SUM().', 2),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'An INNER JOIN between two tables returns:',
   ARRAY['Every row from the left table, matched or not','Every row from the right table, matched or not','Only rows with a match in both tables','The cross product of both tables'], 2,
   'INNER JOIN keeps only rows where the join condition matches in both tables.', 3),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'A LEFT JOIN between orders and customers (orders LEFT JOIN customers) that finds no match on the right side will:',
   ARRAY['Drop the order row entirely','Keep the order row with NULLs for customer columns','Raise an error','Duplicate the order row for every customer'], 1,
   'LEFT JOIN always keeps every row from the left table; unmatched right-side columns come back as NULL.', 4),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'Which function returns the number of non-NULL values in a column?',
   ARRAY['SUM()','COUNT()','LENGTH()','DISTINCT()'], 1,
   'COUNT(column) counts non-NULL values; COUNT(*) counts all rows regardless of NULLs.', 5),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'What does `SELECT DISTINCT country FROM customers` do?',
   ARRAY['Returns every country value including duplicates','Returns each unique country value once','Deletes duplicate rows from the table','Counts how many countries exist'], 1,
   'DISTINCT removes duplicate values from the result set — it does not modify the underlying table.', 6),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'Which comparison correctly checks for a missing value in SQL?',
   ARRAY['column = NULL','column == NULL','column IS NULL','column != NULL'], 2,
   'NULL is not a value that can be compared with =, so SQL requires IS NULL / IS NOT NULL.', 7),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'A PRIMARY KEY constraint guarantees that a column (or set of columns) is:',
   ARRAY['Sorted in ascending order','Unique and not NULL for every row','Indexed but can repeat','Always an auto-incrementing integer'], 1,
   'A primary key enforces uniqueness and non-nullability; it does not have to be an integer or auto-increment.', 8),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'What does a FOREIGN KEY constraint enforce?',
   ARRAY['That a column''s values must exist in a referenced table''s key column','That a column is always unique','That a column can never be NULL','That two tables have the same number of rows'], 0,
   'A foreign key ties a column to a primary/unique key in another table, preventing orphaned references.', 9),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'In `GROUP BY department`, which of these can appear in the SELECT list without an aggregate function?',
   ARRAY['Only `department`','Any column from the table','Only numeric columns','No columns at all'], 0,
   'Standard SQL only allows non-aggregated columns in SELECT if they''re part of the GROUP BY clause.', 10),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'Which clause limits results to, at most, the first 10 rows (standard SQL / PostgreSQL)?',
   ARRAY['TOP 10','LIMIT 10','ROWNUM 10','FETCH 10'], 1,
   'PostgreSQL and most databases use LIMIT n; TOP and ROWNUM are vendor-specific alternatives (SQL Server and Oracle respectively).', 11),
  ((SELECT id FROM public.assessments WHERE slug = 'sql-fundamentals'),
   'A subquery in the WHERE clause like `WHERE id IN (SELECT user_id FROM orders)` is used to:',
   ARRAY['Join two tables permanently','Filter rows based on values computed by another query','Create a new table','Sort results by a computed value'], 1,
   'A subquery here produces a set of values the outer query filters against — no permanent join or table is created.', 12),

  -- JavaScript Fundamentals (12 questions)
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'What does `typeof null` return in JavaScript?',
   ARRAY['"null"','"undefined"','"object"','"number"'], 2,
   'This is a long-standing JS quirk: typeof null returns "object", even though null is not an object.', 1),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'Which keyword declares a variable that cannot be reassigned?',
   ARRAY['var','let','const','static'], 2,
   'const prevents reassignment of the binding itself, though object/array contents it points to can still be mutated.', 2),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'What is the main difference between `let` and `var`?',
   ARRAY['let is function-scoped, var is block-scoped','let is block-scoped, var is function-scoped','They are identical','var cannot be reassigned'], 1,
   'let (and const) are scoped to the nearest block {}; var is scoped to the enclosing function, which is a common source of bugs.', 3),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'What does `Array.prototype.map()` return?',
   ARRAY['The original array, mutated in place','A new array with the results of calling a function on every element','A single accumulated value','undefined'], 1,
   'map() always returns a new array of the same length; it does not mutate the original.', 4),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'What does `Array.prototype.filter()` return?',
   ARRAY['A new array containing only elements that pass a test','The count of matching elements','The first matching element','A boolean'], 0,
   'filter() returns a new array with every element for which the callback returned true.', 5),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'What does `Array.prototype.reduce()` do?',
   ARRAY['Removes duplicate elements','Shrinks the array to a fixed size','Accumulates array elements into a single value via a callback','Sorts the array in place'], 2,
   'reduce() applies a callback across the array, carrying an accumulator forward, to produce one final value.', 6),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'What does the `===` operator check that `==` does not?',
   ARRAY['Nothing, they are identical','Type, in addition to value','Only type, never value','Whether both operands are objects'], 1,
   '=== is the strict equality operator: it compares both value and type, with no implicit type coercion.', 7),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'What does `async`/`await` primarily let you do?',
   ARRAY['Run code in a separate thread','Write asynchronous, Promise-based code in a synchronous-looking style','Skip error handling entirely','Make functions run faster'], 1,
   'await pauses execution of an async function until a Promise settles, without blocking the rest of the JS runtime.', 8),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'What does a Promise that is "rejected" and never caught cause?',
   ARRAY['Nothing, it fails silently','An unhandled promise rejection','The program restarts','It resolves automatically after 5 seconds'], 1,
   'An uncaught rejection surfaces as an "unhandled promise rejection" warning/error — it needs a .catch() or try/catch around an await.', 9),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'In `const { name, age } = person;`, what JavaScript feature is being used?',
   ARRAY['Template literals','Destructuring assignment','Spread syntax','Optional chaining'], 1,
   'This is object destructuring — extracting properties from an object into standalone variables.', 10),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'What does the spread operator do in `const copy = [...original, 4];`?',
   ARRAY['Mutates the original array','Expands the original array''s elements into a new array literal, then appends 4','Deletes the last element','Converts the array to a string'], 1,
   'Spread (...) expands an iterable in place; here it copies original''s elements into a new array before adding 4.', 11),
  ((SELECT id FROM public.assessments WHERE slug = 'javascript-fundamentals'),
   'What does `obj?.address?.city` (optional chaining) return if `obj.address` is undefined?',
   ARRAY['Throws a TypeError','undefined','null','An empty string'], 1,
   'Optional chaining short-circuits and returns undefined instead of throwing when an intermediate value is null/undefined.', 12)
) AS v(assessment_id, prompt, options, correct_index, explanation, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.assessment_questions existing
  WHERE existing.assessment_id = v.assessment_id AND existing.sort_order = v.sort_order
);
