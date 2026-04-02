import { describe, expect, test } from 'bun:test'
import { parseGenerationWorkerArgs } from './generation-worker-cli'

describe('generation worker cli parsing', () => {
	test('parses supported worker flags', () => {
		expect(
			parseGenerationWorkerArgs([
				'--once',
				'--worker-id=ops-runner',
				'--batch-size=4',
				'--poll-seconds=9',
				'--idle-exit-seconds=60',
				'--lease-seconds=180',
				'--heartbeat-seconds=20',
			])
		).toEqual({
			batchSize: 4,
			heartbeatIntervalMs: 20_000,
			idleExitMs: 60_000,
			leaseDurationMs: 180_000,
			once: true,
			pollIntervalMs: 9_000,
			workerId: 'ops-runner',
		})
	})

	test('rejects unsupported flags', () => {
		expect(() => parseGenerationWorkerArgs(['--bogus=1'])).toThrow(
			'Unsupported worker flag: --bogus=1'
		)
	})

	test('rejects non-positive integer values', () => {
		expect(() => parseGenerationWorkerArgs(['--batch-size=0'])).toThrow(
			'--batch-size must be a positive integer.'
		)
		expect(() => parseGenerationWorkerArgs(['--poll-seconds=nope'])).toThrow(
			'--poll-seconds must be a positive integer.'
		)
	})
})
