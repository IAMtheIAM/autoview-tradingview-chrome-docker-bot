"use strict"
window.TRADINGVIEW_LISTENER_UNSENT = 0
window.TRADINGVIEW_LISTENER_OPENED = 1
window.TRADINGVIEW_LISTENER_LOADING = 3
window.TRADINGVIEW_LISTENER_DONE = 4

/**
 *
 * @param {Object} [state]
 * @returns {*}
 * @constructor
 */
function TradingViewListener(state) {
	state = Object.assign(
		{},
		state,
		{
			eventSource: null,
			lastListenerStatus: null,
			listenerStatus: TRADINGVIEW_LISTENER_UNSENT,
		}
	)

	return {
		closeTradingViewListener: function* () {
			if (state.listenerStatus !== TRADINGVIEW_LISTENER_UNSENT) {
				if (state.eventSource) {
					state.eventSource.close()
					state.eventSource = null

					console.info("TradingView Listener closed.")
				}

				state.listenerStatus = TRADINGVIEW_LISTENER_UNSENT
			}
		},

		getTradingViewListenerStatus: () => state.listenerStatus,

		openTradingViewListener: function* () {
			if (state.listenerStatus === TRADINGVIEW_LISTENER_UNSENT) {
				state.listenerStatus = TRADINGVIEW_LISTENER_OPENED

				const private_channel = yield* this.getTradingViewAttribute("PRIVATE_CHANNEL")
				if (!private_channel) {
					yield* this.closeTradingViewListener()
					throw new TradingViewListenerError("Please log into TradingView. Unable to open TradingView Listener.")
				}

				const _ = Date.now()
				const lastEventId = yield* TRADINGVIEW.getTradingViewAttribute("EVENT_ID")
				const url = "https://pushstream.tradingview.com"
					+ "/message-pipe-es/public/" // -es -ws -stream
					+ "private_" + private_channel
					+ "?_=" + Math.floor(_ / 1000) // seconds
					+ "&tag="
					+ "&time="
					+ "&eventid=" + (lastEventId || "")

				state.eventSource = new EventSource(url)
				state.eventSource.onerror = (e) => {
					if (e.target.readyState === EventSource.CLOSED) {
						this.closeTradingViewListener()
					}
				}
				state.eventSource.onmessage = (e) => {
					state.lisenterStatus = TRADINGVIEW_LISTENER_DONE

					const data = safeJSON(e.data)
					const response = safeJSON(data.text.content)

					if (data.channel === "private_" + private_channel) {
						const payload = {
							method: response.m,
							request: {
								channel: data.text.channel || null,
								id: data.id
							},
							response: {
								m: "success",
								p: response.p || {}
							}
						}

						return run(executeMessage.bind(this, payload))
					}
				}
				state.eventSource.onopen = () => {
					state.lisenterStatus = TRADINGVIEW_LISTENER_LOADING
				}

				console.info("TradingView Listener initialized.")
			}
		},

		toggleTradingViewListener: function* () {
			const tabs = yield* this.getTradingViewTabs()

			if (tabs.length) {
				yield* this.closeTradingViewListener()
			} else {
				try {
					yield* this.openTradingViewListener()
				} catch (error) {
					if (error instanceof TradingViewListenerError) {
						if (state.lastListenerStatus !== state.listenerStatus) {
							state.lastListenerStatus = state.listenerStatus
							console.warn(error.message)
						}
					} else {
						throw error
					}
				}
			}
		}
	}
}

function TradingViewListenerError(message) {
	this.name = 'TradingViewListener'
	this.message = message
	this.stack = (new Error()).stack
}
TradingViewListener.prototype = Object.create(Error.prototype)
TradingViewListener.prototype.constructor = TradingViewListener
