import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  LearningTopicDetail,
  LearningTopicRef,
  RecommendedNextTopic,
} from "@/lib/learning.server";

export const getLearningTopicRefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LearningTopicRef[]> => {
    const { listLearningTopicRefs } = await import("@/lib/learning.server");
    return listLearningTopicRefs(context.supabase);
  });

export const getRecommendedNextTopic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecommendedNextTopic | null> => {
    const { getRecommendedNextTopic: get } = await import("@/lib/learning.server");
    return get(context.supabase, context.userId);
  });

const getTopicSchema = z.object({ slug: z.string().min(1) });

export const getLearningTopic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => getTopicSchema.parse(data))
  .handler(async ({ context, data }): Promise<LearningTopicDetail | null> => {
    const { getLearningTopic: get } = await import("@/lib/learning.server");
    return get(context.supabase, context.userId, data.slug);
  });

const toggleLessonSchema = z.object({
  topicId: z.string().uuid(),
  lessonOrder: z.number().int().min(1),
  completed: z.boolean(),
});

export const toggleLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => toggleLessonSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { toggleLessonComplete: toggle } = await import("@/lib/learning.server");
    return toggle(context.supabase, context.userId, data.topicId, data.lessonOrder, data.completed);
  });

const completeTopicSchema = z.object({ topicId: z.string().uuid(), viaSkip: z.boolean() });

export const completeLearningTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => completeTopicSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { completeLearningTopic: complete } = await import("@/lib/learning.server");
    return complete(context.supabase, context.userId, data.topicId, data.viaSkip);
  });
