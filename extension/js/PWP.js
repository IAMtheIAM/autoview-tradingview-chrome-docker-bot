"use strict"

window.PWP_CACHE = {}

function PWP() {
	let state = {
		aliases: [

		],
		endpoint: "https://pay.with.pink/api/",
		fields: {

		},
		name: "Pay With Pink",
		patterns: [

		],
		permissions: {
			origins: [
				"https://pay.with.pink/*",
			],
		},
		subscriptions: {
			active: [],
			inactive: [],
		},
		website: "https://pay.with.pink/",
	}

	function* checkPurchases(purchases) {
		let parameters = []
		parameters.google_purchases = purchases

		const response = yield* post.call(this, "/purchases/check/", parameters)
		return response
	}

	function* createSubscription(data) {
		const response = yield* post.call(this, "/purchases/create/", data)
		return response
	}

	function* deleteCoupon(couponId) {
		let data = {}
		data.coupon_id = couponId

		const response = yield* post.call(this, "/coupons/remove/", data)
		return response
	}

	function* getAccountOverview() {
		const account = yield* post.call(this, "/account/")
		return account
	}

	function* getCouponCodes() {
		const coupons = yield* post.call(this, "/coupons/")
		return coupons
	}

	function* getNewCoupon() {
		let params = {}
		params.now = Date.now()

		const coupon = yield* post.call(this, "/coupons/create/", params)
		return coupon
	}

	function* getSubscriptions() {
		const subscriptions = yield* post.call(this, "/purchases/")
		return subscriptions
	}

	function* post(resource, parameters) {
		resource = state.endpoint + resource.replace(/^\/+/, "")

		const account = yield identity_user_info.bind(this)
		if (!account || !account.email || !account.id) {
			throw new Error("Please ensure Chrome is logged into an account.")
		}

		parameters = parameters || {}
		parameters.cws_id = chrome.runtime.id
		parameters.email_address = account.email
		parameters.google_account_id = account.id

		let hash = resource + "|" + serialize(parameters)
		hash = md5(hash)

		if (window.PWP_CACHE.hasOwnProperty(hash)) {
			const cache = window.PWP_CACHE[hash]
			const stale = Date.now() - 300000 // 5 minutes
			if (cache.created > stale) {
				return cache.content
			}
		}

		let headers = {}

		let response = yield* this.postRequest(resource, parameters, headers, "json")
		if (!response || !response.hasOwnProperty("success")) {
			throw new Error("Unexpected response from server.")
		}
		if (response.error_code || response.error_message) {
			throw new Error(response.error_message)
		}
		if (response.success) {
			response = response.response
		}

		window.PWP_CACHE[hash] = {
			content: response,
			created: Date.now()
		}

		return response
	}

	function* updateAccountAddress(address) {
		let data = {}
		data.address = address

		const response = yield* post.call(this, "/account/address/", data)

		return response
	}

	function* updateCoupon(couponId, description) {
		let data = {}
		data.coupon_id = couponId
		data.description = description

		const response = yield* post.call(this, "/coupons/update/", data)
		return response
	}

	function* validateCheckoutOrder(sku, orderId) {
		let data = {}
		data.google_order_id = orderId
		data.sku = sku

		const response = yield* post.call(this, "/account/order/", data)
		return response
	}

	return Object.assign(
		{},
		Request(), // API Calling
		{
			checkPurchases: checkPurchases,
			getAccount: getAccountOverview,
			getCouponList: getCouponCodes,
			getExchangeSubscriptions: getSubscriptions,
			getNewCoupon: getNewCoupon,
			getNewSubscription: createSubscription,
			setAccountAddress: updateAccountAddress,
			setCouponDeleted: deleteCoupon,
			setCouponDescription: updateCoupon,
			validateCheckoutOrder: validateCheckoutOrder,
		}
	)
}
