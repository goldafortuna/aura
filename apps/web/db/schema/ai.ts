import { boolean, pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const aiProviderKindEnum = ['openai_compatible', 'anthropic'] as const;
export type AiProviderKind = (typeof aiProviderKindEnum)[number];

export const aiProviderConfigs = pgTable(
  'ai_provider_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'deepseek' | 'openai' | 'anthropic' (logical label)
    kind: text('kind').notNull(), // 'openai_compatible' | 'anthropic'
    displayName: text('display_name').notNull(),
    apiKey: text('api_key').notNull(),
    baseUrl: text('base_url'),
    model: text('model').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqUserProvider: uniqueIndex('ai_provider_configs_user_provider_uidx').on(t.userId, t.provider),
  }),
);

export type AiProviderConfig = typeof aiProviderConfigs.$inferSelect;
export type NewAiProviderConfig = typeof aiProviderConfigs.$inferInsert;

export const aiPromptKindEnum = ['document_review', 'minutes_review'] as const;
export type AiPromptKind = (typeof aiPromptKindEnum)[number];

export const aiPromptSettings = pgTable(
  'ai_prompt_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    systemPrompt: text('system_prompt').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqUserKind: uniqueIndex('ai_prompt_settings_user_kind_uidx').on(t.userId, t.kind),
  }),
);

export type AiPromptSetting = typeof aiPromptSettings.$inferSelect;
export type NewAiPromptSetting = typeof aiPromptSettings.$inferInsert;
