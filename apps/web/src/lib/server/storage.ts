import { env } from '$env/dynamic/private'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const globalForStorage = globalThis as typeof globalThis & {
	__upstageStorageClient?: S3Client
}

function createStorageClient() {
	if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
		throw new Error('S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY are required for uploads')
	}

	return new S3Client({
		region: 'auto',
		endpoint: env.S3_ENDPOINT,
		forcePathStyle: true,
		credentials: {
			accessKeyId: env.S3_ACCESS_KEY,
			secretAccessKey: env.S3_SECRET_KEY,
		},
	})
}

function getStorageClient() {
	if (!globalForStorage.__upstageStorageClient) {
		globalForStorage.__upstageStorageClient = createStorageClient()
	}

	return globalForStorage.__upstageStorageClient
}

function sanitizeStorageSegment(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9.-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48)
}

export function buildSourceAssetStorageKey(projectSlug: string, originalFilename: string) {
	const extension = originalFilename.includes('.')
		? (originalFilename.split('.').pop()?.toLowerCase() ?? 'jpg')
		: 'jpg'
	const filename = sanitizeStorageSegment(originalFilename.replace(/\.[^.]+$/, '')) || 'room-photo'

	return `source-assets/${projectSlug}/${crypto.randomUUID()}-${filename}.${extension}`
}

export function buildSourceAssetUrl(storageKey: string) {
	return `/media/${storageKey}`
}

export async function uploadSourceAssetObject(options: {
	body: Uint8Array
	contentType: string
	storageKey: string
	cacheControl?: string
}) {
	await getStorageClient().send(
		new PutObjectCommand({
			Bucket: env.S3_BUCKET,
			Key: options.storageKey,
			Body: options.body,
			ContentType: options.contentType,
			CacheControl: options.cacheControl,
		})
	)
}

export async function getStoredObject(storageKey: string) {
	return getStorageClient().send(
		new GetObjectCommand({
			Bucket: env.S3_BUCKET,
			Key: storageKey,
		})
	)
}
