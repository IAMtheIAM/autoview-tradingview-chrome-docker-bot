"use strict"
console.log("Initialized")

// Globals
window.TRADINGVIEW = TradingView()

chrome.runtime.onInstalled.addListener(run.bind(window, chrome_runtime_onInstall))
chrome.runtime.onMessage.addListener(run.bind(window, executeMessage))

chrome.tabs.onCreated.addListener(run.bind(TRADINGVIEW, TRADINGVIEW.toggleTradingViewListener))
chrome.tabs.onUpdated.addListener(run.bind(TRADINGVIEW, TRADINGVIEW.toggleTradingViewListener))
chrome.tabs.onRemoved.addListener(run.bind(TRADINGVIEW, TRADINGVIEW.toggleTradingViewListener))

run(init)


function* chrome_runtime_onInstall(details) {
	const manifest = chrome.runtime.getManifest()

	console.info("Event:", details.reason)

	switch (details.reason) {
		case "shared_module_update":
		break

		case "install":
			gaEvent("Autoview", "install", manifest.version)

			yield* TRADINGVIEW.reloadTradingViewTabs()
			break

		case "chrome_update":
		case "update":
			gaEvent("Autoview", "update", manifest.version)

			yield* TRADINGVIEW.reloadTradingViewTabs()
	}
}

/**
 *
 * @param message
 * @param sender
 * @param sendResponse
 */
function* executeMessage(message, sender, sendResponse) {
	if (sender && sender.hasOwnProperty("tab") && sender.tab.index < 0) {
		return null // Ignore pre-render tabs
	}

	if (chrome.runtime.lastError) {
		throw chrome.runtime.lastError
	}

	if (message && message.hasOwnProperty("method") && message.method) {
		switch (message.method) {
			case "content.connect":
			case "content.disconnect":
				break

			case "create_alert":
				message.request.id = message.response.p.id
				message.response.p = message.request

			case "event":
				const alert = Alert(message.response.p)
				const lastEventId = yield* TRADINGVIEW.getTradingViewAttribute("EVENT_ID")

				if (alert.eid > lastEventId) {
					yield* TRADINGVIEW.setTradingViewAttribute("EVENT_ID", alert.eid)

					for (let i = 0; i < alert.commands.length; i++) {
						const command = alert.commands[i]
						const isDelay = command.hasOwnProperty("delay")
						const isCommand = !isDelay || command.hasOwnProperty("c") || command.hasOwnProperty("b")

						try {
							// Delay
							if (isDelay) {
								const delay = Number(command.delay.resolve(0))
								yield sleep.bind(this, delay)
							}

							// Exchange
							if (isCommand) {
								let exchange = Broker().getExchange(command.e, command.s)
								if (exchange) {
									gaEvent(exchange.getExchangeName(), "command", command.s)

									yield* exchange.executeCommand(command)
								}
							}
						} catch (ex) {
							console.warn("Command #", i, ex, alert, command)
							// TODO Provide additional information for debugging
							ga("send", "exception", {
								"exDescription": ex.message,
								"exFatal": false,
							})
						}
					}
				}
				break

			case "ping":
				break // pong

			case "storage":
				const name = message.response.name
				const value = message.response.value

				switch (name) {
					case "event_id":
					case "private_channel":
						yield* TRADINGVIEW.setTradingViewAttribute(name, value)
				}
				break

			case "var":
				window[message.response.name] = message.response.value
		}
	}
}

function* init() {
	yield* load_storage()
	yield* TRADINGVIEW.toggleTradingViewListener()

	const binancePermission = yield* Binance().exchangeHasPermission()
	if (binancePermission) {
		yield* Binance().exchangeTime()
	}

	const gdaxPermission = yield* GDAX().exchangeHasPermission()
	if (gdaxPermission) {
		yield* GDAX().exchangeTime()
	}
}

function* load_storage() {
	let storage = (yield* Storage("sync").getStorageValue()) || {}
	if (!storage.hasOwnProperty("exchanges")) {
		storage.exchanges = {}
	}
	if (!storage.hasOwnProperty("permissions")) {
		storage.permissions = {
			google_payments: true,
		}
	}

	for (let key in storage) {
		if (storage.hasOwnProperty(key)) {
			const alias = key.toUpperCase()
			let value = storage[key]

			// Original model (< 1.0.0)
			if (Broker().isExchangeAlias(alias)) {
				value.private = value.private || ""
				value.public = value.public || ""

				// Convert to new model
				storage.exchanges[alias] = {
					"*": value
				}

				// Unset original model
				delete storage[key]
			}
			// Account access
			else if (key === "exchanges") {
				// Skip; Credentials are loaded upon request via Exchange()
			}
			else if (key === "event_id" || key === "private_channel") {
				yield* TRADINGVIEW.setTradingViewAttribute(key, value)
				// Unset original model
				delete storage[key]
			}
		}
	}

	// Save any changes that may have occurred
	yield* Storage("sync").clearStorage()
	yield* Storage("sync").setStorageValue(storage)

	console.log("Storage loaded.")
}
