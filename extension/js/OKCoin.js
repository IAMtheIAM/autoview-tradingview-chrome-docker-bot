"use strict"
/**
 *
 * @returns {*}
 * @constructor
 */
function OKCoin() {
	let state = {
		aliases: [
			"OKCOIN-USD",
			"OKCOIN",
		],
		endpoint: "https://www.okcoin.com/api/v1/",
		fields: {
			public: {
				label: "API Key",
				message: "",
			},
			private: {
				label: "Secret Key",
				message: "",
			},
		},
		name: "OKCoin (USD) (beta)",
		patterns: [],
		permissions: {
			origins: [
				"https://*.okcoin.com/*",
			],
		},
		subscriptions: {
			active: [
				// "ulxirqdphtmwcanefojvszkybg", // OKCoin (USD)
				// "ejyoqtnxkipdszmglchuwrbafv", // OKCoin (USD) - Yearly
			],
			inactive: [
				// "fgzwahkeirbcptolqsvjumxnyd", // OKCoin (USD) - Early Bird
			],
		},
		website: "https://www.okcoin.com/?invid=2016110",
	}

	function* account() {
		const response = yield* post.call(this, "/userinfo.do")
		const account = response.info.funds
		let balances = {}

		for (let code in account.free) {
			if (account.free.hasOwnProperty(code)) {
				balances[code] = normalize_balance(account.free[code])
			}
		}

		if (account.hasOwnProperty("borrow")) {
			for (let code in account.borrow) {
				if (account.borrow.hasOwnProperty(code)) {
					balances[code] = normalize_balance(account.borrow[code], balances[code])
				}
			}
		}

		return balances
	}

	function* get(resource, query) {
		resource = state.endpoint + resource.replace(/^\/+/, "")

		return yield* this.getRequest(resource, query, null, "json")
	}

	function normalize_balance(amount, ret) {
		function normalize(amount, balance) {
			amount = Number(amount)
			balance = Number(balance) || 0.0

			return (amount + balance).toFixed(8)
		}

		if (typeof ret === "object") {
			ret.available = normalize(amount, ret.available)
			ret.total = normalize(amount, ret.total)
		}
		else {
			ret = {}
			ret.available = normalize(amount)
			ret.total = normalize(amount)
		}

		return ret
	}

	function* ordersCancel(order) {
		if (typeof order !== "object") {
			throw new TypeError("Invalid order provided: " + typeof order)
		}

		let params = {}
		params.order_id = order.order_id
		params.symbol = order.symbol

		return yield* post.call(this, "/cancel_order.do", params)
	}

	function* ordersCancelAll(Command) {
		const pair = symbolPair(Command.s)

		const response = yield* ordersOpen.call(this, pair.symbol)
		let orders = response.orders

		orders = orders.filter((order) => {
			if (Command.b && Command.b !== order.type) {
				return false // Order Type mismatch
			}
			if (Command.fp && Command.fp.compare(order.price_avg)) {
				return false // Price mismatch
			}
			if (Command.d) {
				return false // Disabled
			}

			return true
		})

		// Limit the number of cancelled orders by the requested "Cancel Maximum"
		const end = Command.cm.reference(orders.length).resolve(0)
		if (Command.cm.getMax() < orders.length) {
			switch (Command.cmo) {
				case "newest":
					sortByIndex(orders, "create_date", true)
					break
				case "oldest":
					sortByIndex(orders, "create_date")
					break
				case "lowest":
					sortByIndex(orders, "price_avg")
					break
				case "highest":
					sortByIndex(orders, "price_avg", true)
					break
				case "smallest":
					sortByIndex(orders, "amount")
					break
				case "biggest":
					sortByIndex(orders, "amount", true)
					break
				case "random":
					shuffle(orders)
			}
			orders = orders.slice(0, end)
		}

		for (let i = 0; i < orders.length; i++) {
			yield* ordersCancel.call(this, orders[i])
		}
	}

	function* ordersOpen(symbol) {
		let params = {}
		let resource = "/order_info.do"

		params.order_id = -1 // All unfilled
		params.symbol = symbol

		return yield* post.call(this, resource, params)
	}

	function* positionsCloseAll() {
		throw new ReferenceError(this.getExchangeName() + " does not support Margin trading.")
	}

	function* post(resource, parameters) {
		resource = state.endpoint + resource.replace(/^\/+/, "")
		parameters = parameters || {}
		parameters = Object.assign({}, parameters) // Detach reference

		const credentials = yield* this.getExchangeCredentials("private")
		parameters.api_key = credentials.public

		const signature = () => {
			if (typeof md5 !== "function") {
				throw new Error("MD5 not supported")
			}

			let signature = []
			Object.keys(parameters).sort().forEach((key) => {
				signature.push(key + "=" + parameters[key])
			})
			signature.push("secret_key=" + credentials.private)
			signature = signature.join("&").replace("%2C", ",")

			return md5(signature).toUpperCase()
		}
		parameters.sign = signature()

		let headers = {}
		headers["Content-Type"] = "application/x-www-form-urlencoded"

		const response = yield* this.postRequest(resource, parameters, headers, "json")
		if (!response.hasOwnProperty("result") || !response.result) {
			switch (response.error_code) {
				case 20022: // Wrong API interface (cross, fixed)
					return {}
			}

			if (!state.hasOwnProperty("error_strings")) {
				const resource = chrome.runtime.getURL("/cache/okcoin/api_errors.json")
				state.error_strings = yield* this.getRequest(resource, null, null, "json")
			}

			if (state.error_strings.hasOwnProperty(response.error_code)) {
				throw new Error("#" + response.error_code + ": " + state.error_strings[response.error_code])
			}

			throw new Error("OKCoin unexpected response: #" + response.error_code)
		}

		return response
	}

	function symbolPair(symbol) {
		const regexp = /^([A-Z]{3})[-_/]?([A-Z]{3})$/i
		const result = regexp.exec(symbol)
		let so = {}

		if (!result) {
			throw new Error("Unknown market symbol: " + symbol)
		}

		so.contract_type = null
		so.main = result ? result[2].toLowerCase() : ""
		so.pair = result ? result[1].toLowerCase() : ""

		so.precision = 4
		so.symbol = so.pair + "_" + so.main

		return so
	}

	function* symbolTicker(symbol) {
		let query = {}
		query.symbol = symbol

		const response = yield* get.call(this, "/ticker.do", query)
		let ticker = response.ticker
		ticker.timestamp = response.date

		return ticker
	}

	function testCommand() {
		const alert = Alert({
			desc: "d=1 b=long q=1%",
			sym: "OKCOIN:BTCUSD"
		})
		const commands = alert.commands
		const command = commands.shift()

		return command
	}

	function* trade(Command) {
		const pair = symbolPair(Command.s)
		if (Command.isMarginTrading) {
			throw new SyntaxError("Margin trade request made on a Spot market.")
		}
		const balances = yield* account.call(this)
		const currency = Command.isBid ? pair.main : pair.pair
		if (!balances.hasOwnProperty(currency)) {
			throw new ReferenceError("Account Balance (" + currency + ") not available.")
		}

		const balance = balances[currency]
		let available = (Command.y === "equity") ? balance.total : balance.available

		const ticker = yield* symbolTicker.call(this, pair.symbol)
		if (!ticker) {
			throw new ReferenceError("Ticker (" + pair.symbol + ") not available.")
		}
		const first = Command.isBid ? +ticker.buy : +ticker.sell
		let price = Command.p.relative(first).resolve(2)
		if (Command.fp) {
			price = Command.fp.resolve(2)
		}

		if (Command.isBid) {
			available /= price // main => pair
			if (!Command.q.getIsPercent() && Command.u === "currency") {
				Command.q.div(price) // main => pair
			}
		} else {
			if (!Command.q.getIsPercent() && Command.u === "currency") {
				Command.q.div(price) // main => pair
			}
		}
		Command.q.reference(available) // pair

		let params = {}
		params.amount = Command.q.resolve(4)
		params.api_key = null
		params.type = Command.isBid ? "buy" : "sell"
		if (Command.t === "market") {
			// params.price = params.amount
			params.type += "_market"
		}
		else {
			params.price = price
		}
		params.symbol = pair.symbol

		if (Command.d) {
			console.log("OKCoin", params)
			return false // Disabled
		}

		return yield* post.call(this, "/trade.do", params)
	}


	return Object.assign(
		{},
		Exchange(state),
		{
			exchangeOrdersCancelAll: ordersCancelAll,
			exchangePositionsCloseAll: positionsCloseAll,
			exchangeTrade: trade,
			getExchangeTestCommand: testCommand,
		}
	)
}
