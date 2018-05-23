"use strict"

/**
 * @see https://github.com/GoogleChrome/chrome-app-samples/blob/master/samples/managed-in-app-payments/scripts/buy.js
 */
function inapp() {
	function* buy(sku) {
		if (typeof sku !== "string") {
			throw new TypeError("Invalid SKU provided: " + typeof sku)
		}

		const response = yield wallet("buy", {
			sku: sku
		})

		return response
	}

	function* consumePurchase(sku) {
		if (typeof sku !== "string") {
			throw new TypeError("Invalid SKU provided: " + typeof sku)
		}

		const response = yield wallet("consumePurchase", {
			sku: sku
		})

		return response
	}

	function* getPurchases() {
		let purchases = yield wallet("getPurchases")
		purchases = purchases.details || []

		return purchases
	}

	function* getSkuDetails() {
		let details = yield wallet("getSkuDetails")
		if (details.hasOwnProperty("details")) {
			details = details.details
		}

		return details
	}

	function wallet(method, request) {
		request = request || {}
		request.parameters = {
			env: "prod"
		}
		request.method = method

		return function(callback) {
			let pipe = chrome.runtime.connect("nmmhkkegccagdldgiimedpiccmgmieda", {})
			let responseReceived = false
			pipe.onMessage.addListener((message) => {
				responseReceived = true

				if (message.hasOwnProperty("response")) {
					message = message.response
				}
				if (message.hasOwnProperty("errorType")) {
					switch (message.errorType) {
						case "PURCHASE_CANCELED":
							break
						case "TOKEN_MISSING_ERROR":
							console.warn("No account is logged into Chrome.")
							break
						default:
							console.warn("Unexpected error: " + message.errorType)
					}
					message = {}
				}

				return callback(null, message) // success
			})
			pipe.onDisconnect.addListener(() => {
				if (!responseReceived) {
					return callback(chrome.runtime.lastError) // failure
				}
			})
			pipe.postMessage(request)
		}
	}

	return {
		buy: buy,
		consumePurchase: consumePurchase,
		getPurchases: getPurchases,
		getSkuDetails: getSkuDetails
	}
}
