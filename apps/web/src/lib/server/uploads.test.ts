import { describe, expect, test } from 'bun:test'
import { parseImageDimension, validateSourceUpload } from './uploads'

describe('upload helpers', () => {
	test('accepts supported image uploads', () => {
		const file = new File(['ok'], 'room.jpg', { type: 'image/jpeg' })

		expect(validateSourceUpload(file).error).toBeNull()
	})

	test('rejects unsupported mime types', () => {
		const file = new File(['nope'], 'room.gif', { type: 'image/gif' })

		expect(validateSourceUpload(file).error).toBe(
			'Only JPG, PNG, and WebP images are supported right now.'
		)
	})

	test('parses positive image dimensions', () => {
		expect(parseImageDimension('1200')).toBe(1200)
		expect(parseImageDimension('0')).toBeNull()
	})
})
