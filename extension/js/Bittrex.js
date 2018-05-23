"use strict"
window.BITTREX_NONCE = 0
window.BITTREX_NONCE_OFFSET = -1
/**
 *
 * @returns {*}
 * @constructor
 */
function Bittrex() {
	let state = {
		aliases: [
			"BITTREX",
		],
		endpoint: "https://bittrex.com/api/",
		fee: 0.0025, // 0.25%
		fields: {
			public: {
				label: "Key",
				message: "",
			},
			private: {
				label: "Secret",
				message: "",
			},
		},
		name: "Bittrex",
		patterns: [

		],
		permissions: {
			origins: [
				"https://*.bittrex.com/*"
			],
		},
		subscriptions: {
			active: [
				"tfnmhjoyxcvsugpezalrwiqbdk", // Bittrex
				"tnjcfgeosirmxqwzhulkybvapd", // Bittrex - Yearly
			],
			inactive: [

			],
		},
		version: "v1.1",
		website: "https://bittrex.com/",
	}

	function* account(isMarginTrading) {
		const result = yield* get.call(this, "/account/getbalances")
		let balances = {}
		for (let i = 0; i < result.length; i++) {
			const item = result[i]
			balances[item.Currency] = item
		}

		return balances
	}

	function* get(resource, query, headers) {
		const credentials = yield* this.getExchangeCredentials("private")
		const signature = (credentials, content) => {
			let sha = new jsSHA("SHA-512", "TEXT")
			sha.setHMACKey(credentials.private, "TEXT")
			sha.update(content)

			return sha.getHMAC("HEX")
		}

		query = query || {}
		if (resource.indexOf("/public/") === -1) {
			query.apikey = credentials.public
			query.nonce = getNonce()
		}

		resource = state.endpoint + state.version + resource
		resource = resource + "?" + serialize(query)

		headers = headers || {}
		if (resource.indexOf("/public/") === -1) {
			headers["apisign"] = signature(credentials, resource)
		}

		let response = yield* this.getRequest(resource, {}, headers, "json")
		if (!response.success || response.message) {
			throw new Error(response.message || "An unknown error has occurred")
		}

		response = response.result

		return response
	}

	function getNonce() {
		return Math.floor(Date.now() / 1000)
		let nonce = Math.round(Date.now() / 1000) * 1000 // second precision

		if (window.BITTREX_NONCE !== nonce) {
			window.BITTREX_NONCE_OFFSET = -1
		}

		window.BITTREX_NONCE = nonce
		window.BITTREX_NONCE_OFFSET++

		nonce += window.BITTREX_NONCE_OFFSET

		return nonce
	}

	function* ordersCancel(order) {
		if (typeof order !== "object") {
			throw new TypeError("Invalid order provided: " + typeof order)
		}

		let query = {}
		query.uuid = order.OrderUuid

		return yield* get.call(this, "/market/cancel", query)
	}

	function* ordersCancelAll(Command) {
		const pair = symbolPair(Command.s)
		let types = []
		if (Command.isBid) {
			types.push("LIMIT_BUY")
			types.push("MARKET_BUY")
		} else {
			types.push("LIMIT_SELL")
			types.push("MARKET_SELL")
		}

		let orders = yield* ordersOpen.call(this, pair.symbol)
		orders = orders.filter((order) => {
			if (types.indexOf(order.OrderType) === -1) {
				return false // Order Type mismatch
			}
			if (Command.fp && Command.fp.compare(order.Limit)) {
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
					sortByIndex(orders, "Opened", true)
					break
				case "oldest":
					sortByIndex(orders, "Opened")
					break
				case "lowest":
					sortByIndex(orders, "Limit")
					break
				case "highest":
					sortByIndex(orders, "Limit", true)
					break
				case "smallest":
					sortByIndex(orders, "Quantity")
					break
				case "biggest":
					sortByIndex(orders, "Quantity", true)
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
		params.market = symbol

		return yield* get.call(this, "/market/getopenorders", params)
	}

	function* positionsCloseAll() {
		throw new ReferenceError(this.getExchangeName() + " does not support Margin trading.")
	}

	function symbolPair(symbol) {
		symbol = symbol.toUpperCase()
		let reg
		let result
		let so = {}

		// Base currencies: unique array of /public/getmarkets->BaseCurrency

		// Bittrex URL (e.g. https://bittrex.com/Market/Index?MarketName=BTC-PINK)
		reg = /^(BITCNY|BTC|ETH|USDT)-?(.*?)$/i
		result = reg.exec(symbol)
		if (result) {
			so.main = result ? result[1] : ""
			so.pair = result ? result[2] : ""
		}

		// TradingView (e.g. BITTREX:PINKBTC)
		reg = /^(.*?)-?(BITCNY|BTC|ETH|USDT)$/i
		result = reg.exec(symbol)
		if (result) {
			so.main = result ? result[2] : ""
			so.pair = result ? result[1] : ""
		}

		// Neither expression matches
		if (!so.main || !so.pair) {
			throw new Error("Unknown market symbol: " + symbol)
		}

		so.precision = 8
		so.symbol = so.main + "-" + so.pair

		return so
	}

	function* symbolTicker(symbol) {
		let query = {}
		query.market = symbol

		return yield* get.call(this, "/public/getticker", query)
	}

	function testCommand() {
		const alert = Alert({
			desc: "d=1 b=buy q=1%",
			sym: "BITTREX:PINKBTC"
		})
		const commands = alert.commands
		const command = commands.shift()

		return command
	}

	function* trade(Command) {
		if (!Command.b) {
			throw new SyntaxError("Command [b]ook parameter is invalid.")
		}
		if (Command.isMarginTrading) {
			throw new SyntaxError("Margin trade request made on Spot market.")
		}

		const pair = symbolPair(Command.s)
		const balances = yield* account.call(this, Command.isMarginTrading)
		const currency = Command.isBid ? pair.main : pair.pair
		if (!balances.hasOwnProperty(currency)) {
			throw new ReferenceError("Account Balance (" + currency + ") not available.")
		}

		const ticker = yield* symbolTicker.call(this, pair.symbol)
		if (!ticker) {
			throw new ReferenceError("Ticker (" + pair.symbol + ") is not available.")
		}

		const overview = balances[currency]
		const balance = Command.y === "equity" ? overview.Balance : overview.Available
		const first = ((Command.isBid && Command.t !== "market") || (Command.isAsk && Command.t === "market")) ? ticker.Bid : ticker.Ask
		const method = (Command.isBid ? "buy" : "sell") + (Command.t === "market" ? "market" : "limit")
		let price = Command.p.relative(first).resolve(8)
		if (Command.fp) {
			price = Command.fp.resolve(8)
		}
		let available = (1 - state.fee) * balance

		if (Command.isBid && Command.u !== "currency") {
			available = balance / price
			Command.q.reference(available)
		} else if (Command.u === "currency") {
			if (Command.isAsk) {
				available = balance * price
			}
			Command.q.reference(available)
			Command.q.div(price)
		} else {
			Command.q.reference(available)
		}

		let params = {}
		params.quantity = Command.q.resolve(8)
		params.market = pair.symbol
		params.rate = price

		if (Command.d) {
			console.info("Bittrex", params)
			return false // Disabled
		}

		return yield* get.call(this, "/market/" + method, params)
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
