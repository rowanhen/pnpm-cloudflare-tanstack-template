// Browser-only SDK fixture. Tests exercise our UI, never card processing or Stripe's own UI.
window.Stripe = () => ({
	elements() {},
	createToken() {},
	createPaymentMethod() {},
	confirmCardPayment() {},
	initCheckoutElementsSdk() {
		let confirmations = 0
		return {
			on() {},
			changeAppearance() {},
			createPaymentElement() {
				return {
					mount(node) {
						node.textContent = 'Payment provider test fixture'
					},
					on() {},
					off() {},
					destroy() {},
					update() {},
				}
			},
			async loadActions() {
				return {
					type: 'success',
					actions: {
						getSession: () => ({ total: { total: { amount: '£12.00' } } }),
						async confirm() {
							confirmations++
							return confirmations === 1
								? { type: 'error', error: { message: 'Fixture decline. Try again.' } }
								: { type: 'success' }
						},
					},
				}
			},
		}
	},
})

window.Stripe.version = 'endive'
