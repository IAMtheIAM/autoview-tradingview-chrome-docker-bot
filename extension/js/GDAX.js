"use strict"
/**
 *
 * @returns {*}
 * @constructor
 */
function GDAX() {
	let state = {
		aliases: [
			"GDAX",
		],
		endpoint: "https://api.gdax.com",
		fields: {
			password: {
				label: "API Passphrase",
				message: "",
			},
			public: {
				label: "API key",
				message: "",
			},
			private: {
				label: "API secret",
				message: "",
			},
		},
		name: "GDAX (beta)",
		patterns: [

		],
		permissions: {
			origins: [
				"https://*.gdax.com/*",
			],
		},
		subscriptions: {
			active: [
				"gdaxeukowcyhmjrtvblzipsfqn", // GDAX
				"gdaxwlupnqjmhectvizykbrsof", // GDAX - Yearly
			],
			inactive: [

			],
		},
		website: "https://www.gdax.com",
	}

	function* account() {
		const account = yield* get.call(this, "/accounts", null, true)
		let balances = {}

		account.forEach((balance) => {
			balance.available = Number(balance.available)
			balance.balance = Number(balance.balance)

			balances[balance.currency] = balance
		})

		return balances
	}

	function* get(resource, query, authenticate) {
		if (query) {
			resource += "?" + serialize(query)
		}

		return yield* make.call(this, "GET", resource, null, authenticate)
	}

	function* ordersCancel(order) {
		const response = yield* make.call(this, "DELETE", "/orders/" + order.id, null, true)

		return true
	}

	function* ordersCancelAll(Command) {
		const pair = symbolPair(Command.s)
		let orders = yield* ordersOpen.call(this, pair.symbol)

		orders = orders.filter((order) => {
			if (Command.b && Command.b !== order.side) {
				return false // buy, sell
			}
			if (Command.fp && Command.fp.compare(order.price)) {
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
					sortByIndex(orders, "created_at", true)
					break
				case "oldest":
					sortByIndex(orders, "created_at")
					break
				case "lowest":
					sortByIndex(orders, "price")
					break
				case "highest":
					sortByIndex(orders, "price", true)
					break
				case "smallest":
					sortByIndex(orders, "size")
					break
				case "biggest":
					sortByIndex(orders, "size", true)
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
		params.product_id = symbol

		return yield* get.call(this, "/orders", params, true)
	}

	function* positionsCloseAll(Command) {
		throw new ReferenceError(this.getExchangeName() + " does not support Margin trading.")
	}

	function* make(method, requestPath, parameters, authenticate) {
		parameters = parameters ? JSON.stringify(parameters) : ""
		let headers = {}

		if (authenticate) {
			const credentials = yield* this.getExchangeCredentials("private")
			const signature = (raw) => {
				let sha = new jsSHA("SHA-256", "TEXT")
				sha.setHMACKey(credentials.private, "B64")
				sha.update(raw)

				return sha.getHMAC("B64")
			}
			const timestamp = Date.now() / 1000

			const data = timestamp + method + requestPath + parameters

			headers["Content-Type"] = "application/json"
			headers["CB-ACCESS-KEY"] = credentials.public
			headers["CB-ACCESS-SIGN"] = signature(data)
			headers["CB-ACCESS-TIMESTAMP"] = timestamp
			headers["CB-ACCESS-PASSPHRASE"] = credentials.password
		}

		// 2018-01-10 Request header field %s is not allowed
		// by Access-Control-Allow-Headers in preflight response.
		this.util.excludeHeader("X-Ajax-Engine")
		this.util.excludeHeader("X-Requested-With")

		requestPath = state.endpoint + requestPath

		try {
			const func = method.toLowerCase() + "Request"
			const response = yield* this[func](requestPath, parameters, headers, "json")
			if (response.hasOwnProperty("message")) {
				throw new Error(response.message)
			}

			return response
		} catch (ex) {
			throw new Error(ex.message)
		}
	}

	function* post(resource, parameters, authenticate) {
		return yield* make.call(this, "POST", resource, parameters, authenticate)
	}

	function symbolPair(symbol) {
		symbol = symbol.toUpperCase()
		const reg = /^(.+?)[-_/]?(BTC|EUR|GBP|USD)$/i
		const result = reg.exec(symbol)
		let so = {}

		if (!result) {
			throw new Error("Unknown market symbol: " + symbol)
		}

		so.main = result ? result[2] : ""
		so.pair = result ? result[1] : ""
		so.precision = 8
		so.symbol = so.pair + "-" + so.main

		return so
	}

	function* symbolInfo(symbol) {
		// const resource = yield* get.call(this, "/products")
		const resource = chrome.runtime.getURL("/cache/gdax/api_products.json")
		const response = yield* this.getRequest(resource, null, null, "json")
		let products = {}

		response.forEach((info) => {
			products[info.id] = info
		})

		if (products.hasOwnProperty(symbol)) {
			return products[symbol]
		}

		return null
	}

	function* symbolTicker(symbol) {
		let ticker
		try {
			ticker = yield* get.call(this, "/products/" + symbol + "/ticker")
		} catch (ex) {
			throw new Error(this.getExchangeName() + " could not find the ticker symbol: " + symbol)
		}
		// Sandbox returns 0.0 prices
		ticker.ask = ticker.ask || 1
		ticker.bid = ticker.bid || 1
		return ticker
	}

	function testCommand() {
		const alert = Alert({
			desc: "d=1 b=buy q=1%",
			sym: "GDAX:ETHBTC"
		})
		const commands = alert.commands
		const command = commands.shift()

		return command
	}

	function* time() {
		const response = yield* get.call(this, "/time")
		const serverTime = response.epoch * 1000
		const epoch = Date.now()
		const offset = (epoch - serverTime) / 1000

		console.info(this.getExchangeName(), "time", serverTime, "Autoview time", epoch, "Offset", offset, "seconds")
	}

	function* trade(Command) {
		if (!Command.b) {
			throw new SyntaxError("Command [b]ook parameter is invalid.")
		}
		if (Command.isMarginTrading) {
			throw new Error(this.getExchangeName() + " does not support Margin trading.")
		}

		const pair = symbolPair(Command.s)
		const balances = yield* account.call(this)
		const currency = Command.isBid ? pair.main : pair.pair

		if (!balances.hasOwnProperty(currency)) {
			throw new ReferenceError("Account Balance (" + currency + ") not available.")
		}

		const ticker = yield* symbolTicker.call(this, pair.symbol)
		if (!ticker) {
			throw new ReferenceError("Ticker (" + pair.symbol + ") is not available.")
		}

		const balance = balances[currency]
		const first = ((Command.isBid && Command.t !== "market") || (Command.isAsk && Command.t === "market")) ? ticker.bid : ticker.ask
		const market = yield* symbolInfo.call(this, pair.symbol)
		const pricePrecision = decimals(market.quote_increment)
		let price = Number(Command.p.relative(first).resolve(pricePrecision))
		if (Command.fp) {
			price = Number(Command.fp.resolve(pricePrecision))
		}
		let available = Command.y === "equity" ? balance.balance : balance.available

		// POST orders are guaranteed to be maker, which has 0% fees
		if (Command.t !== "post") {
			let fee = 0.0025 // 0.25%
			// ETH & LTC markets have a 0.3% taker fee at the 0-1% volume level.
			if (pair.pair === "ETH" || pair.pair === "LTC") {
				fee = 0.003 // 0.3%
			}
			available *= (1 - fee)
		}

		//		bid		ask
		// api	pair	pair
		// q=	pair	pair
		// u=	main	main
		// bal	main	pair
		if (Command.u === "currency" && !Command.q.getIsPercent()) {
			Command.q.div(price) // main => pair
		}
		if (Command.isBid) {
			available /= price // main => pair
		}

		Command.q.reference(available)

		let params = {}
		params.product_id = pair.symbol
		params.side = Command.b
		params.size = Command.q.resolve(8)
		switch (Command.t) {
			case "fok":
			case "ioc":
				params.type = "limit"
				params.price = price
				params.time_in_force = Command.t.toUpperCase() // GTC, GTT, IOC, FOK
				break
			case "limit":
				params.type = "limit"
				params.price = price
				params.time_in_force = "GTC" // GTC, GTT, IOC, FOK
				break
			case "market":
				params.type = "market"
				break
			case "post":
				params.type = "limit"
				params.price = price
				params.time_in_force = "GTC" // GTC, GTT, IOC, FOK
				params.post_only = true
				break
		}

		if (Command.d) {
			console.info(this.getExchangeName(), params)
			return false // Disabled
		}

		return yield* post.call(this, "/orders", params, true)
	}


	return Object.assign(
		{},
		Exchange(state),
		{
			exchangeOrdersCancelAll: ordersCancelAll,
			exchangePositionsCloseAll: positionsCloseAll,
			exchangeTime: time,
			exchangeTrade: trade,
			getExchangeTestCommand: testCommand,
		}
	)
}
