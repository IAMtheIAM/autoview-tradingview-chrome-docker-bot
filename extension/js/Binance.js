"use strict"
/**
 *
 * @returns {*}
 * @constructor
 */
function Binance() {
	const recvWindow = 5000 // 5 seconds

	const SECURITY_NONE = 0
	const SECURITY_TRADE = 1 // SIGNED endpoint
	const SECURITY_USER_DATA = 2 // SIGNED endpoint
	const SECURITY_USER_STREAM = 4
	const SECURITY_MARKET_DATA = 8

	let state = {
		aliases: [
			"BINANCE",
		],
		endpoint: "https://api.binance.com/api/",
		fields: {
			public: {
				label: "API Key",
				message: "",
			},
			private: {
				label: "Secret",
				message: "",
			},
		},
		name: "Binance (beta)",
		patterns: [

		],
		permissions: {
			origins: [
				"https://*.binance.com/*"
			],
		},
		subscriptions: {
			active: [
				"biaksgztrmlncqovehwydpfujx", // Binance
				"biuevdnwfyargmcpklhqsxojtz", // Binance - Yearly
			],
			inactive: [

			],
		},
		website: "https://www.binance.com/?ref=13612693",
	}

	function* account() {
		const params = {}
		const account = yield* get.call(this, "/v3/account", params, SECURITY_USER_DATA)

		let balances = {}
		for (let i = 0; i < account.balances.length; i++) {
			let balance = account.balances[i]
			balances[balance.asset] = {
				available: Number(balance.free),
				balance: (Number(balance.free) + Number(balance.locked)).toFixed(8),
			}
		}

		return balances
	}

	function* get(resource, query, security) {
		return yield* make.call(this, "GET", resource, query, security)
	}

	function* make(method, resource, parameters, security) {
		parameters = parameters || {}
		resource = state.endpoint + resource.replace(/^\/+/, "")

		const credentials = yield* this.getExchangeCredentials("private")
		const func = method.toLowerCase() + "Request"
		const signature = () => {
			let sha = new jsSHA("SHA-256", "TEXT")
			sha.setHMACKey(credentials.private, "TEXT")
			sha.update(serialize(parameters))

			return sha.getHMAC("HEX")
		}
		const SIGNED = (security & SECURITY_TRADE || security & SECURITY_USER_DATA)

		if (SIGNED) {
			parameters.timestamp = Date.now()
			parameters.recvWindow = recvWindow

			parameters.signature = signature()
		}

		let headers = {}
		headers["Content-Type"] = "application/x-www-form-urlencoded"
		headers["X-MBX-APIKEY"] = credentials.public

		try {
			const response = yield* this[func](resource, parameters, headers, "json")

			return response
		} catch (ex) {
			console.info(this.getExchangeName(), ex)
			throw new Error("#" + ex.code + ": " + ex.msg)
		}
	}

	function* ordersCancel(order) {
		let params = {}
		params.symbol = order.symbol
		params.orderId = order.orderId

		const response = yield* make.call(this, "DELETE", "/v3/order", params, SECURITY_TRADE)

		return response.orderId === order.orderId
	}

	function* ordersCancelAll(Command) {
		const pair = symbolPair(Command.s)
		let orders = yield* ordersOpen.call(this, pair.symbol)

		orders = orders.filter((order) => {
			if (Command.b && Command.b !== order.side.toLowerCase()) {
				return false // BUY, SELL
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
					sortByIndex(orders, "time", true)
					break
				case "oldest":
					sortByIndex(orders, "time")
					break
				case "lowest":
					sortByIndex(orders, "price")
					break
				case "highest":
					sortByIndex(orders, "price", true)
					break
				case "smallest":
					sortByIndex(orders, "origQty")
					break
				case "biggest":
					sortByIndex(orders, "origQty", true)
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
		params.symbol = symbol

		return yield* get.call(this, "/v3/openOrders", params, SECURITY_USER_DATA)
	}

	function* positionsCloseAll() {
		throw new ReferenceError(this.getExchangeName() + " does not support Margin trading.")
	}

	function* post(resource, parameters, security) {
		return yield* make.call(this, "POST", resource, parameters, security)
	}

	function* symbolInfo(symbol) {
		const response = yield* get.call(this, "/v1/exchangeInfo")
		let details = {}

		response.symbols.forEach((info) => {
			let filters = {}
			info.filters.forEach((filter) => {
				filters[filter.filterType] = filter
			})

			info.filters = filters
			details[info.symbol] = info
		})

		if (details.hasOwnProperty(symbol)) {
			return details[symbol]
		}

		return null
	}

	function symbolPair(symbol) {
		symbol = symbol.toUpperCase()
		const reg = /^(.+)(BTC|ETH|BNB|USDT)$/i
		const result = reg.exec(symbol)
		let so = {}

		if (!result) {
			throw new Error("Unknown market symbol: " + symbol)
		}

		so.main = result ? result[2] : ""
		so.pair = result ? result[1] : ""
		so.precision = 8
		so.symbol = so.pair + so.main

		return so
	}

	function* symbolTicker(symbol) {
		let query = {}
		query.symbol = symbol

		const ticker = yield* get.call(this, "/v3/ticker/bookTicker", query)

		return {
			ask: ticker.askPrice,
			bid: ticker.bidPrice,
		}
	}

	function testCommand() {
		const alert = Alert({
			desc: "d=1 b=buy q=1%",
			sym: "BINANCE:BNBBTC"
		})
		const commands = alert.commands
		const command = commands.shift()

		return command
	}

	function* time() {
		const response = yield* this.getRequest(state.endpoint + "v1/time", null, null, "json")
		const epoch = Date.now()
		const offset = (epoch - response.serverTime) / 1000

		console.info(this.getExchangeName(), "time", response.serverTime, "Autoview time", epoch, "Offset", offset, "seconds")

		if (offset > 1) {
			console.error("Your computer's clock is too far into the future for Binance (> 1 second)")
		}
		if (offset < -recvWindow / 1000) {
			console.error("Your computer'c clock is too far into the past for Binance (< ", recvWindow / 1000, " seconds)")
		}
	}

	function* trade(Command) {
		if (!Command.b) {
			throw new SyntaxError("Command [b]ook parameter is invalid.")
		}
		if (Command.isMarginTrading) {
			throw new SyntaxError("Margin trade request made on a Spot market.")
		}
		if (Command.hasOwnProperty("sl") && Command.hasOwnProperty("tp")) {
			throw new SyntaxError("Binance does not support Stop Loss and Take Profit on the same order.")
		}

		const pair = symbolPair(Command.s)
		const balances = yield* account.call(this)
		let currency = Command.isBid ? pair.main : pair.pair

		if (Command.isMarginTrading) {
			currency = pair.pair
		}

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
		const pricePrecision = market.filters.hasOwnProperty("PRICE_FILTER") ? decimals(market.filters.PRICE_FILTER.tickSize) : 8
		const quantityPrecision = market.filters.hasOwnProperty("LOT_SIZE") ? decimals(market.filters.LOT_SIZE.stepSize) : 8
		let price = Command.p.relative(first).resolve(pricePrecision)
		if (Command.fp) {
			price = Command.fp.resolve(pricePrecision)
		}
		let available = Command.y === "equity" ? balance.balance : balance.available

		if (Command.isBid && Command.u !== "currency") {
			available /= price
			Command.q.reference(available)
		} else if (Command.u === "currency") {
			if (Command.isAsk) {
				available *= price
			}
			Command.q.reference(available)
			Command.q.div(price)
		} else {
			Command.q.reference(available)
		}
		const quantity = Command.q.resolve(quantityPrecision)

		let params = {}
		params.symbol = pair.symbol
		params.side = Command.b.toUpperCase() // BUY, SELL
		params.type = Command.t === "market" ? "MARKET" : "LIMIT"
		switch (Command.t) {
			case "fok":
				params.price = price
				params.timeInForce = "FOK" // GTC, IOC, FOK
				break
			case "ioc":
				params.price = price
				params.timeInForce = "IOC" // GTC, IOC, FOK
				break
			case "market":
				break;
			default:
				params.price = price
				params.timeInForce = "GTC"; // GTC, IOC, FOK
		}
		params.quantity = quantity
		if (Command.hasOwnProperty("h")) {
			params.icebergQty = Command.h.reference(quantity).resolve(quantityPrecision)
		}
		params.newOrderRespType = "ACK" // ACK, RESULT, FULL

		if (Command.sl) {
			params.type = Command.t === "market" ? "STOP_LOSS" : "STOP_LOSS_LIMIT"
			params.side = Command.isBid ? "SELL" : "BUY"
			params.stopPrice = Command.sl.relative(first).resolve(pricePrecision)
		}
		if (Command.tp) {
			params.type = Command.t === "market" ? "TAKE_PROFIT" : "TAKE_PROFIT_LIMIT"
			params.side = Command.isBid ? "SELL" : "BUY"
			params.stopPrice = Command.tp.relative(first).resolve(pricePrecision)
		}

		if (Command.d) {
			console.info(this.getExchangeName(), params)
			return false // Disabled
		}

		return yield* post.call(this, "/v3/order", params, SECURITY_TRADE)
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
