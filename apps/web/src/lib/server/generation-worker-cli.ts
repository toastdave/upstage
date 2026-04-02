export type GenerationWorkerCliOptions = {
	batchSize?: number
	heartbeatIntervalMs?: number
	idleExitMs?: number | null
	leaseDurationMs?: number
	once?: boolean
	pollIntervalMs?: number
	workerId?: string
}

function parsePositiveIntegerFlag(rawValue: string, label: string) {
	const value = Number.parseInt(rawValue, 10)

	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`${label} must be a positive integer.`)
	}

	return value
}

export function parseGenerationWorkerArgs(argv: string[]): GenerationWorkerCliOptions {
	const parsed: GenerationWorkerCliOptions = {}

	for (const argument of argv) {
		if (argument === '--once') {
			parsed.once = true
			continue
		}

		if (argument.startsWith('--worker-id=')) {
			parsed.workerId = argument.slice('--worker-id='.length).trim()
			continue
		}

		if (argument.startsWith('--batch-size=')) {
			parsed.batchSize = parsePositiveIntegerFlag(
				argument.slice('--batch-size='.length),
				'--batch-size'
			)
			continue
		}

		if (argument.startsWith('--poll-seconds=')) {
			parsed.pollIntervalMs =
				parsePositiveIntegerFlag(argument.slice('--poll-seconds='.length), '--poll-seconds') * 1000
			continue
		}

		if (argument.startsWith('--idle-exit-seconds=')) {
			parsed.idleExitMs =
				parsePositiveIntegerFlag(
					argument.slice('--idle-exit-seconds='.length),
					'--idle-exit-seconds'
				) * 1000
			continue
		}

		if (argument.startsWith('--lease-seconds=')) {
			parsed.leaseDurationMs =
				parsePositiveIntegerFlag(argument.slice('--lease-seconds='.length), '--lease-seconds') *
				1000
			continue
		}

		if (argument.startsWith('--heartbeat-seconds=')) {
			parsed.heartbeatIntervalMs =
				parsePositiveIntegerFlag(
					argument.slice('--heartbeat-seconds='.length),
					'--heartbeat-seconds'
				) * 1000
			continue
		}

		throw new Error(`Unsupported worker flag: ${argument}`)
	}

	return parsed
}
