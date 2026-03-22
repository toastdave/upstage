import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'

export const projectTypeEnum = pgEnum('project_type', [
	'virtual_staging',
	'empty_room_design',
	'existing_room_redesign',
])

export const projectStatusEnum = pgEnum('project_status', ['draft', 'active', 'archived'])

export const jobStatusEnum = pgEnum('job_status', [
	'queued',
	'processing',
	'succeeded',
	'failed',
	'cancelled',
])

export const creditEntryTypeEnum = pgEnum('credit_entry_type', [
	'grant',
	'purchase',
	'generation',
	'adjustment',
	'refund',
])

export const entitlementStatusEnum = pgEnum('entitlement_status', [
	'free',
	'trialing',
	'active',
	'past_due',
	'cancelled',
])

export const moderationStatusEnum = pgEnum('moderation_status', [
	'pending',
	'approved',
	'flagged',
	'blocked',
])

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
	},
	(table) => [uniqueIndex('session_token_idx').on(table.token)]
)

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('account_user_idx').on(table.userId),
		uniqueIndex('account_provider_account_idx').on(table.providerId, table.accountId),
	]
)

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [uniqueIndex('verification_identifier_value_idx').on(table.identifier, table.value)]
)

export const project = pgTable(
	'project',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		ownerUserId: text('owner_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		slug: varchar('slug', { length: 80 }).notNull().unique(),
		title: varchar('title', { length: 140 }).notNull(),
		projectType: projectTypeEnum('project_type').notNull(),
		propertyType: varchar('property_type', { length: 80 }),
		roomType: varchar('room_type', { length: 80 }),
		styleIntent: varchar('style_intent', { length: 120 }),
		status: projectStatusEnum('status').notNull().default('draft'),
		locationLabel: varchar('location_label', { length: 160 }),
		notes: text('notes'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('project_owner_idx').on(table.ownerUserId),
		index('project_status_idx').on(table.status),
	]
)

export const sourceAsset = pgTable(
	'source_asset',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		ownerUserId: text('owner_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		storageKey: text('storage_key').notNull().unique(),
		url: text('url').notNull(),
		originalFilename: varchar('original_filename', { length: 180 }),
		mimeType: varchar('mime_type', { length: 80 }).notNull(),
		fileSizeBytes: integer('file_size_bytes').notNull(),
		width: integer('width'),
		height: integer('height'),
		moderationStatus: moderationStatusEnum('moderation_status').notNull().default('pending'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('source_asset_project_idx').on(table.projectId),
		index('source_asset_owner_idx').on(table.ownerUserId),
	]
)

export const generationPreset = pgTable('generation_preset', {
	id: text('id').primaryKey(),
	slug: varchar('slug', { length: 64 }).notNull().unique(),
	name: varchar('name', { length: 120 }).notNull(),
	category: varchar('category', { length: 80 }).notNull(),
	promptTemplate: text('prompt_template').notNull(),
	defaultAspectRatio: varchar('default_aspect_ratio', { length: 16 }).notNull().default('4:3'),
	isFeatured: boolean('is_featured').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const generationJob = pgTable(
	'generation_job',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		sourceAssetId: uuid('source_asset_id')
			.notNull()
			.references(() => sourceAsset.id, { onDelete: 'cascade' }),
		presetId: text('preset_id').references(() => generationPreset.id, { onDelete: 'set null' }),
		status: jobStatusEnum('status').notNull().default('queued'),
		provider: varchar('provider', { length: 80 }).notNull(),
		model: varchar('model', { length: 120 }).notNull(),
		prompt: text('prompt').notNull(),
		negativePrompt: text('negative_prompt'),
		styleLabel: varchar('style_label', { length: 120 }),
		roomType: varchar('room_type', { length: 80 }),
		aspectRatio: varchar('aspect_ratio', { length: 16 }).notNull().default('4:3'),
		requestedCount: integer('requested_count').notNull().default(1),
		creditCost: integer('credit_cost').notNull().default(0),
		errorMessage: text('error_message'),
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('generation_job_project_idx').on(table.projectId),
		index('generation_job_status_idx').on(table.status),
	]
)

export const generationImage = pgTable(
	'generation_image',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		jobId: uuid('job_id')
			.notNull()
			.references(() => generationJob.id, { onDelete: 'cascade' }),
		storageKey: text('storage_key').notNull().unique(),
		url: text('url').notNull(),
		revisedPrompt: text('revised_prompt'),
		seed: integer('seed'),
		width: integer('width'),
		height: integer('height'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('generation_image_job_idx').on(table.jobId)]
)

export const plan = pgTable('plan', {
	id: text('id').primaryKey(),
	slug: varchar('slug', { length: 48 }).notNull().unique(),
	name: varchar('name', { length: 80 }).notNull(),
	monthlyPriceCents: integer('monthly_price_cents').notNull(),
	annualPriceCents: integer('annual_price_cents'),
	featureFlags: jsonb('feature_flags').notNull().default({}),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userEntitlement = pgTable(
	'user_entitlement',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		planId: text('plan_id')
			.notNull()
			.references(() => plan.id),
		status: entitlementStatusEnum('status').notNull().default('free'),
		polarCustomerId: text('polar_customer_id'),
		polarSubscriptionId: text('polar_subscription_id'),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
		endsAt: timestamp('ends_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('user_entitlement_user_idx').on(table.userId)]
)

export const creditLedger = pgTable(
	'credit_ledger',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		entryType: creditEntryTypeEnum('entry_type').notNull(),
		amount: integer('amount').notNull(),
		balanceAfter: integer('balance_after'),
		description: varchar('description', { length: 160 }),
		referenceId: text('reference_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('credit_ledger_user_idx').on(table.userId)]
)

export const billingEvent = pgTable('billing_event', {
	id: uuid('id').defaultRandom().primaryKey(),
	providerEventId: text('provider_event_id').notNull().unique(),
	eventName: varchar('event_name', { length: 120 }).notNull(),
	payload: jsonb('payload').notNull(),
	processedAt: timestamp('processed_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const moderationReview = pgTable(
	'moderation_review',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		reviewerUserId: text('reviewer_user_id').references(() => user.id, { onDelete: 'set null' }),
		sourceAssetId: uuid('source_asset_id').references(() => sourceAsset.id, {
			onDelete: 'set null',
		}),
		generationImageId: uuid('generation_image_id').references(() => generationImage.id, {
			onDelete: 'set null',
		}),
		status: moderationStatusEnum('status').notNull().default('pending'),
		reason: varchar('reason', { length: 120 }),
		notes: text('notes'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('moderation_review_status_idx').on(table.status)]
)

export const projectCollaborator = pgTable(
	'project_collaborator',
	{
		projectId: uuid('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: varchar('role', { length: 40 }).notNull().default('editor'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.projectId, table.userId] })]
)
