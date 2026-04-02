import { runGenerationWorker } from './lib/server/generation-worker'
import { parseGenerationWorkerArgs } from './lib/server/generation-worker-cli'

let stopping = false

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		stopping = true
	})
}

try {
	const options = parseGenerationWorkerArgs(process.argv.slice(2))
	const result = await runGenerationWorker(options, () => stopping)

	console.info(
		JSON.stringify({
			at: new Date().toISOString(),
			idleCycles: result.idleCycles,
			processedCount: result.processedCount,
			scope: 'generation-worker',
			stopReason: result.stopReason,
			workerId: result.workerId,
		})
	)
} catch (error) {
	console.error(
		JSON.stringify({
			at: new Date().toISOString(),
			error: error instanceof Error ? error.message : 'Worker failed unexpectedly.',
			scope: 'generation-worker',
		})
	)
	process.exitCode = 1
}
