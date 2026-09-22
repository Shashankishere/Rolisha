-- Completes learning-content coverage for the only 3 skills (out of 50) that
-- did not yet have a learning_topics row: machine-learning, deep-learning,
-- and r-language. Confirmed by joining `skills` against `learning_topics`
-- (see the 47 topics already seeded across
-- 20260826000100/20260826010000/20260826030000) — these three are the exact
-- remainder, not a guess.
--
-- All three already exist in `career_skills` for data-scientist
-- (machine-learning: critical/advanced, deep-learning: medium/intermediate,
-- r-language: nice_to_have/beginner) — `target_level` below matches that
-- existing, real requirement rather than inventing a new one.

INSERT INTO public.assessments (slug, title, skill_id, difficulty, description)
SELECT v.slug, v.title, s.id, v.diff::public.difficulty_level, v.descr
FROM (VALUES
  ('machine-learning-basics','Machine Learning Fundamentals','machine-learning','intermediate','Five questions on supervised vs unsupervised learning, overfitting, and evaluation metrics.'),
  ('deep-learning-basics','Deep Learning Fundamentals','deep-learning','intermediate','Five questions on neural network structure, activation functions, and training.'),
  ('r-language-basics','R Programming Fundamentals','r-language','beginner','Five questions on R data structures, dplyr, and ggplot2.')
) AS v(slug, title, skill_slug, diff, descr)
JOIN public.skills s ON s.slug = v.skill_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.assessment_questions (assessment_id, prompt, options, correct_index, explanation, sort_order)
SELECT a.id, v.prompt, v.opts, v.correct, v.expl, v.ord
FROM (VALUES
  ('machine-learning-basics','A model scores 99% accuracy on training data but 60% on new data. This is:',ARRAY['Underfitting','Overfitting','Perfect generalization','A labeling error'],1,'A large gap between training and test performance is the classic sign of overfitting: the model memorized the training data instead of learning generalizable patterns.',1),
  ('machine-learning-basics','Which task is an example of supervised learning?',ARRAY['Grouping customers into segments with no predefined labels','Predicting house price from labeled historical sales','Reducing a dataset to two dimensions for visualization','Finding frequently co-purchased items with no labels'],1,'Supervised learning trains on labeled examples (features plus a known correct output, like historical price) to predict labels for new data.',2),
  ('machine-learning-basics','Why do you split data into training and test sets before training a model?',ARRAY['To make training faster','To evaluate the model on data it has not seen, estimating real-world performance','Because most libraries require it syntactically','To reduce the amount of data storage needed'],1,'A held-out test set that the model never trains on is what lets you honestly estimate how it will perform on new, unseen data.',3),
  ('machine-learning-basics','In a binary classifier, precision answers which question?',ARRAY['Of all actual positives, how many did we correctly find?','Of everything we predicted positive, how many were actually positive?','What percentage of all predictions were correct?','How fast does the model make predictions?'],1,'Precision = true positives / (true positives + false positives) — it measures how trustworthy a positive prediction is.',4),
  ('machine-learning-basics','A decision tree that is allowed to grow very deep with no limit tends to:',ARRAY['Underfit the training data','Overfit the training data','Always generalize better','Become a linear model'],1,'An unconstrained deep tree can carve out a rule for nearly every training example, memorizing noise rather than learning general patterns.',5),
  ('deep-learning-basics','What does a neuron''s activation function primarily provide to a neural network?',ARRAY['Faster training speed only','Non-linearity, letting the network learn complex, non-linear relationships','A way to store data between training runs','Automatic feature labeling'],1,'Without a non-linear activation function, stacking layers would collapse mathematically into a single linear transformation, no matter how many layers you add.',1),
  ('deep-learning-basics','What is backpropagation used for?',ARRAY['Loading data into the model faster','Computing how much each weight contributed to the error, to update weights via gradient descent','Splitting data into train/test sets','Visualizing the network architecture'],1,'Backpropagation applies the chain rule to compute the gradient of the loss with respect to every weight, which gradient descent then uses to update them.',2),
  ('deep-learning-basics','Which architecture is generally best suited to image data?',ARRAY['Convolutional Neural Network (CNN)','A single-layer perceptron with no hidden layers','K-means clustering','A basic decision tree'],0,'CNNs use convolutional filters that exploit the spatial structure of images (nearby pixels are related), which plain fully-connected layers do not.',3),
  ('deep-learning-basics','What is the main purpose of a validation set during training?',ARRAY['To train the final production model','To tune hyperparameters and detect overfitting before touching the test set','To replace the need for a test set entirely','To speed up backpropagation'],1,'The validation set lets you tune hyperparameters and catch overfitting during development, while the test set stays untouched for a final, unbiased evaluation.',4),
  ('deep-learning-basics','Transfer learning refers to:',ARRAY['Moving a trained model to a different programming language','Reusing a model already trained on a large dataset as a starting point for a related task','Transferring data between two databases','Converting a classification model into a regression model automatically'],1,'Transfer learning starts from a model pretrained on a large, related dataset (e.g. ImageNet) and fine-tunes it on your smaller, specific dataset, saving time and data.',5),
  ('r-language-basics','Which R data structure holds columns of different types (numeric, character) with equal-length columns, like a spreadsheet?',ARRAY['vector','list','data frame','matrix'],2,'A data frame is R''s tabular structure: each column can be a different type, but all columns must have the same number of rows.',1),
  ('r-language-basics','In dplyr, which function is used to keep only rows matching a condition?',ARRAY['select()','filter()','mutate()','arrange()'],1,'filter() subsets rows based on a logical condition; select() instead picks columns.',2),
  ('r-language-basics','What does the pipe operator (%>% or |>) do in an R data pipeline?',ARRAY['Comments out the following line','Passes the result of one expression as the first argument to the next, making chained steps readable','Imports a package','Declares a new function'],1,'The pipe lets you chain steps left-to-right (data |> filter(...) |> summarise(...)) instead of nesting function calls inside each other.',3),
  ('r-language-basics','In ggplot2, which function starts every plot and sets up the data and aesthetic mappings?',ARRAY['plot()','ggplot()','geom_point()','aes_only()'],1,'ggplot() initializes the plot with the data and aes() mappings; geom_ functions like geom_point() then add the actual visual layer on top.',4),
  ('r-language-basics','Which dplyr function creates a new summary value (like a mean) per group after group_by()?',ARRAY['mutate()','summarise()','filter()','arrange()'],1,'summarise() collapses each group into a single summary row (e.g. mean, count); mutate() instead adds a new column without collapsing rows.',5)
) AS v(assessment_slug, prompt, opts, correct, expl, ord)
JOIN public.assessments a ON a.slug = v.assessment_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.assessment_questions existing
  WHERE existing.assessment_id = a.id AND existing.sort_order = v.ord
);

INSERT INTO public.learning_topics
  (slug, skill_id, title, why_it_matters, difficulty, estimated_hours, objectives, common_mistakes, target_level, assessment_id)
SELECT v.slug, s.id, v.title, v.why, v.diff::public.difficulty_level, v.hours,
       v.objectives, v.mistakes, v.target::public.proficiency_level, a.id
FROM (VALUES
  (
    'machine-learning-fundamentals',
    'machine-learning',
    'Machine Learning Fundamentals',
    'Machine Learning is a critical, advanced-level requirement for the Data Scientist career path in this catalog, and the single highest-demand skill listed for it. Without a working grasp of how models learn, generalize, and fail, the rest of a data scientist''s toolkit (statistics, Python, SQL) has no way to turn into an actual predictive system.',
    'intermediate',
    8,
    ARRAY[
      'Distinguish supervised, unsupervised, and reinforcement learning by the kind of problem each solves',
      'Explain why data is split into training, validation, and test sets',
      'Identify overfitting and underfitting from training vs test performance',
      'Choose an appropriate evaluation metric for a given classification or regression problem',
      'Describe how a handful of common algorithms (linear/logistic regression, decision trees, k-NN) actually work at a conceptual level',
      'Walk through the end-to-end ML workflow from raw data to a deployed, monitored model'
    ],
    ARRAY[
      'Evaluating a model only on the data it was trained on, producing a falsely optimistic accuracy number',
      'Treating accuracy as the right metric for every problem, even on imbalanced datasets where it can be misleading',
      'Tuning hyperparameters against the test set, which quietly turns the test set into a second training set',
      'Jumping straight to a complex model (deep learning, ensembles) before trying a simple baseline that might already be good enough',
      'Ignoring data leakage — accidentally letting information from the future or the label itself leak into the features'
    ],
    'advanced',
    'machine-learning-basics'
  ),
  (
    'deep-learning-fundamentals',
    'deep-learning',
    'Deep Learning Fundamentals',
    'Deep Learning is listed as a medium-importance, intermediate-level skill for the Data Scientist career path in this catalog — relevant once classical machine learning has been covered, particularly for problems involving images, text, or audio where hand-engineered features stop scaling.',
    'intermediate',
    6,
    ARRAY[
      'Explain what a neuron, layer, and weight represent in a neural network',
      'Explain why activation functions are necessary for a network to learn non-linear patterns',
      'Describe how backpropagation and gradient descent update a network''s weights during training',
      'Distinguish when a CNN, RNN/Transformer, or a plain feedforward network is the appropriate architecture',
      'Recognize practical constraints: overfitting in large networks, the role of GPUs, and when transfer learning is the pragmatic choice'
    ],
    ARRAY[
      'Building a deep network from scratch when a simpler classical ML model would already solve the problem with far less data and compute',
      'Not normalizing or scaling input data, which can stall or destabilize training',
      'Using a plain fully-connected network on image data instead of a CNN that actually exploits spatial structure',
      'Training for too many epochs without early stopping, overfitting a network that had already converged',
      'Assuming more layers always means a better model, regardless of the amount of training data available'
    ],
    'intermediate',
    'deep-learning-basics'
  ),
  (
    'r-programming-fundamentals',
    'r-language',
    'R Programming Fundamentals',
    'R is listed as a nice-to-have, beginner-level skill for the Data Scientist career path in this catalog — many statistics-heavy teams and academic-adjacent roles still standardize on R (via dplyr and ggplot2) for exploratory analysis and reporting alongside or instead of Python.',
    'beginner',
    4,
    ARRAY[
      'Work with R''s core data structures: vectors, lists, and data frames',
      'Filter, transform, and summarize tabular data using dplyr',
      'Build clear, publication-quality charts with ggplot2''s layered grammar of graphics',
      'Compute and interpret basic summary statistics directly in R',
      'Produce a reproducible report combining code, output, and narrative with R Markdown'
    ],
    ARRAY[
      'Using base R loops for row-by-row data manipulation instead of vectorized dplyr operations, which are both faster and more readable',
      'Forgetting that R is 1-indexed (the first element is index 1, not 0), a common source of off-by-one bugs for people coming from Python',
      'Building a ggplot2 chart by piling on geoms without first checking whether the data is in the right (usually "long") shape',
      'Confusing summarise() (collapses each group to one row) with mutate() (adds a column, keeps all rows) after group_by()',
      'Hardcoding file paths or values instead of writing a script that reruns cleanly top to bottom'
    ],
    'beginner',
    'r-language-basics'
  )
) AS v(slug, skill_slug, title, why, diff, hours, objectives, mistakes, target, assessment_slug)
JOIN public.skills s ON s.slug = v.skill_slug
LEFT JOIN public.assessments a ON a.slug = v.assessment_slug
ON CONFLICT (slug) DO NOTHING;
