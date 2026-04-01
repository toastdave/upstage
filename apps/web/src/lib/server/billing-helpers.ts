export function getIncludedCreditsFromFeatureFlags(featureFlags: unknown) {
	if (!featureFlags || typeof featureFlags !== 'object') {
		return 0
	}

	const includedCredits = 'includedCredits' in featureFlags ? featureFlags.includedCredits : 0

	return typeof includedCredits === 'number' && Number.isFinite(includedCredits)
		? Math.max(0, Math.trunc(includedCredits))
		: 0
}

export function buildGenerationChargeDescription(projectTitle: string) {
	return `Accepted generation for ${projectTitle}`
}

export function buildGenerationRefundDescription(projectTitle: string) {
	return `Refunded failed generation for ${projectTitle}`
}

export function buildInsufficientCreditsMessage(creditBalance: number, creditCost: number) {
	return `You need ${creditCost} credits for this generation, but only have ${creditBalance}. Add credits before continuing.`
}
