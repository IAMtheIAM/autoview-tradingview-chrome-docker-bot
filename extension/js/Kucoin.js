"use strict"
window.KUCOIN_NONCE = 0
window.KUCOIN_NONCE_OFFSET = -1
/**
 *
 * @returns {*}
 * @constructor
 */
function Kucoin() {
	let state = {
		aliases: [
			"KUCOIN",
		],
		endpoint: "https://api.kucoin.com",
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
		name: "Kucoin (beta)",
		patterns: [

		],
		permissions: {
			origins: [
				"https://*.kucoin.com/*",
			],
		},
		subscriptions: {
			active: [
				"kucgtsrevdlfwzijbyhnaqmpox", // Kucoin
				"kuctgwdzjobpnlhvisqmxearfy", // Kucoin - Yearly
			],
			inactive: [

			],
		},
		version: "v1",
		website: "https://www.kucoin.com/",
	}

	function* account(currency) {
		const resource = "/account/" + currency + "/balance"
		const response = yield* get.call(this, resource)
		const balance = {
			available: Number(response.balanceStr),
			balance: Number(response.balanceStr) + Number(response.freezeBalanceStr),
		}

		return balance
	}

	function* get(resource, query, authenticate) {
		return yield* make.call(this, "GET", resource, query, authenticate)
	}

	function* make(method, resource, parameters) {
		resource = "/" + state.version + "/" + resource.replace(/^\/+/, "")

		parameters = parameters || {}

		const credentials = yield* this.getExchangeCredentials("private")
		const nonce = yield* getNonce()
		const signature = (data) => {
			const b64 = btoa(data) // base64 encode
			let sha = new jsSHA("SHA-256", "TEXT")
			sha.setHMACKey(credentials.private, "TEXT")
			sha.update(b64)

			return sha.getHMAC("HEX")
		}

		const endpoint = state.endpoint + resource
		const queryString = serialize(parameters)
		const data = resource + "/" + nonce + "/" + queryString

		let headers = {}
		headers["Accept-Language"] = "en_US"
		headers["Content-Type"] = "application/x-www-form-urlencoded"
		headers["KC-API-KEY"] = credentials.public
		headers["KC-API-NONCE"] = nonce
		headers["KC-API-SIGNATURE"] = signature(data)

		try {
			const func = method.toLowerCase() + "Request"
			const response = yield* this[func](endpoint, parameters, headers, "json")
			if (!response.success) {
				throw new Error(response.msg)
			}

			return response.data
		} catch (ex) {
			if (ex.hasOwnProperty("error")) {
				throw new Error(ex.error)
			}
			if (ex.hasOwnProperty("message")) {
				throw new Error(ex.message)
			}
			throw new Error("An unknown error has occurred.")
		}
	}

	function* getNonce() {
		let nonce = Math.round(Date.now() / 1000) * 1000 // second precision

		if (window.KUCOIN_NONCE != nonce) {
			window.KUCOIN_NONCE_OFFSET = -1
		}

		window.KUCOIN_NONCE = nonce
		window.KUCOIN_NONCE_OFFSET++

		nonce += window.KUCOIN_NONCE_OFFSET

		return nonce
	}

	function* ordersCancel(order) {
		let params = {}
		params.orderOid = order.id
		params.symbol = order.symbol
		params.type = order.type

		const response = yield* post.call(this, "/cancel-order", params, true)

		return true
	}

	function* ordersCancelAll(Command) {
		const pair = symbolPair(Command.s)
		let orders = yield* ordersOpen.call(this, pair.symbol)

		orders = orders.filter((order) => {
			if (Command.b && Command.b.toUpperCase() !== order.type) {
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
					sortByIndex(orders, "timestamp", true)
					break
				case "oldest":
					sortByIndex(orders, "timestamp")
					break
				case "lowest":
					sortByIndex(orders, "price")
					break
				case "highest":
					sortByIndex(orders, "price", true)
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
		function normalizeOrder(order) {
			return {
				amount: order[3],
				dealAmount: order[4],
				id: order[5],
				price: order[2],
				symbol: symbol,
				timestamp: order[0],
				type: order[1],
			}
		}

		let params = {}
		params.symbol = symbol
		const response = yield* get.call(this, "/order/active", params, true)

		const buys = response.BUY.map(normalizeOrder)
		const sells = response.SELL.map(normalizeOrder)
		const orders = [].concat(buys, sells)

		return orders
	}

	function* positionsCloseAll(Command) {
		throw new Error(this.getExchangeName() + " does not support Margin trading.")
	}

	function* post(resource, parameters, authenticate) {
		return yield* make.call(this, "POST", resource, parameters, authenticate)
	}

	function* symbolInfo(symbol) {
		const resource = chrome.runtime.getURL("/cache/kucoin/api_market_open_coins.json")
		const response = yield* this.getRequest(resource, null, null, "json")

		for (let i = 0; i < response.data.length; i++) {
			const coin = response.data[i]
			if (coin.coin === symbol) {
				return coin
			}
		}

		throw new Error("Currency symbol not found: " + symbol)
	}

	function symbolPair(symbol) {
		symbol = symbol.toUpperCase()
		const reg = /^(.+?)[-_/]?(BCH|BTC|ETH|KCS|NEO|USDT)$/i
		const result = reg.exec(symbol)
		if (!result) {
			throw new Error("Unknown market symbol: " + symbol)
		}

		let so = {}
		so.main = result ? result[2] : ""
		so.pair = result ? result[1] : ""
		so.precision = 8
		so.symbol = so.pair + "-" + so.main

		return so
	}

	function* symbolTicker(symbol) {
		function normalizeTicker(ticker) {
			return {
				active: ticker.trading,
				ask: ticker.sell,
				bid: ticker.buy,
				high: ticker.high,
				last: ticker.lastDealPrice,
				low: ticker.low
			}
		}

		let query = {}
		query.symbol = symbol

		const response = yield* get.call(this, "/open/tick", query)
		const ticker = normalizeTicker(response)

		return ticker
	}

	function testCommand() {
		const alert = Alert({
			desc: "d=1 b=buy q=1%",
			sym: "KUCOIN:ETH-BTC"
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
			throw new SyntaxError(this.getExchangeName() + " does not support Margin trading.")
		}

		const pair = symbolPair(Command.s)
		const currency = Command.isBid ? pair.main : pair.pair
		const balance = yield* account.call(this, currency)
		const market = yield* symbolInfo.call(this, pair.pair)
		const ticker = yield* symbolTicker.call(this, pair.symbol)
		if (!ticker) {
			throw new ReferenceError("Ticker (" + pair.symbol + ") is not available.")
		}

		const first = ((Command.isBid && Command.t !== "market") || (Command.isAsk && Command.t === "market")) ? ticker.bid : ticker.ask
		let price = Number(Command.p.relative(first).resolve(market.tradePrecision))
		if (Command.fp) {
			price = Number(Command.fp.resolve(market.tradePrecision))
		}
		let available = Command.y === "equity" ? balance.balance : balance.available

		if (Command.u === "currency" && !Command.q.getIsPercent()) {
			Command.q.div(price) // main => pair
		}
		if (Command.isBid) {
			available /= price // main => pair
		}

		Command.q.reference(available)

		let params = {}
		params.amount = Command.q.resolve(market.tradePrecision)
		params.price = price
		params.symbol = pair.symbol
		params.type = Command.b.toUpperCase() // BUY, SELL

		if (Command.d) {
			console.info(this.getExchangeName(), params)
			return false // Disabled
		}

		return yield* post.call(this, "/order", params, true)
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
