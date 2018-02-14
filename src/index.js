/* eslint-disable filenames/match-exported, max-params, compat/compat */
/* eslint-env browser */

import nextID from "./nextID"

const TYPE = "application/interframe-ssoft-v1+json"
const PROMISE_TIMEOUT = 3000

function interframe(targetWindow, origin = "*", sourceWindow) {
  if (!targetWindow) {
    throw new Error("parameter 'targetWindow' is missing")
  }

  const listeners = new Map()
  const handshakeCallback = new Set()
  const responseResolver = new Map()
  const preHandshakeSendQueue = new Set()
  const outstandingMessages = new Map()
  let isHandshaken = false

  function addListener(namespace, callback) {
    if (!listeners.has(namespace)) {
      listeners.set(namespace, new Set())
    }
    listeners.get(namespace).add(callback)

    if (outstandingMessages.has(namespace)) {
      outstandingMessages.get(namespace).forEach((message) => callback(message))
      outstandingMessages.delete(namespace)
    }

    return callback
  }

  function removeListener(namespace, callback) {
    listeners.get(namespace).delete(callback)
  }

  function send(namespace, data = null, responseId) {
    if (!namespace) {
      throw new Error("parameter 'namespace' is missing")
    }
    if (typeof namespace !== "string") {
      throw new Error("parameter 'namespace' must be a string")
    }

    if (!isHandshaken) {
      return new Promise((resolve) => {
        preHandshakeSendQueue.add({
          namespace,
          data,
          responseId,
          resolve
        })
      })
    }

    const id = nextID()
    targetWindow.postMessage(
      JSON.stringify({
        id,
        responseId,
        type: TYPE,
        namespace,
        data
      }),
      origin
    )

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        responseResolver.delete(id)
        resolve()
      }, PROMISE_TIMEOUT)

      responseResolver.set(id, {
        // eslint-disable-line security/detect-object-injection
        resolve,
        timer
      })
    })
  }

  function sendHandshake(acknowledgement = false) {
    const message = {
      type: TYPE,
      handshakeConfirmation: Boolean(acknowledgement),
      handshake: !acknowledgement
    }

    targetWindow.postMessage(JSON.stringify(message), origin)
  }

  function isSafeMessage(msgSource, msgOrigin, msgType) {
    const jsdom = window.navigator.userAgent.indexOf("jsdom") >= 0 && msgSource === null
    const safeSource = msgSource === targetWindow || jsdom
    const safeOrigin = origin === "*" || msgOrigin === origin
    const safeType = msgType === TYPE

    return safeSource && safeOrigin && safeType
  }

  function handleHandshake(data) {
    if (data.handshake) sendHandshake(true)

    isHandshaken = true

    handshakeCallback.forEach((hsCallback) => hsCallback())
    handshakeCallback.clear()

    preHandshakeSendQueue.forEach((sendItem) =>
      send(sendItem.namespace, sendItem.data, sendItem.responseId)
        .then((response) => sendItem.resolve(response)) // eslint-disable-line promise/prefer-await-to-then
        .catch(() => sendItem.resolve())
    )
    preHandshakeSendQueue.clear()
  }

  function createMessage(messageData) {
    const message = {
      id: messageData.id,
      data: messageData.data,
      namespace: messageData.namespace,

      open: () => {
        message.isPromise = true // eslint-disable-line immutable/no-mutation

        return Object.assign({}, messageData, {
          response: (data) => {
            send(messageData.namespace, data, messageData.id)
          }
        })
      }
    }

    return message
  }

  function handleMessage(messageData) {
    if (messageData.responseId && responseResolver.has(messageData.responseId)) {
      const resolver = responseResolver.get(messageData.responseId)
      clearTimeout(resolver.timer)
      resolver.resolve(messageData)
      responseResolver.delete(messageData.responseId)
    } else {
      const message = createMessage(messageData)

      if (listeners.has(message.namespace)) {
        listeners.get(message.namespace).forEach((listener) => {
          // eslint-disable-next-line max-depth
          if (typeof listener === "function") {
            listener(createMessage(message))
          } else if (listener) {
            console.error("Listener is no function: ", listener) // eslint-disable-line
          }
        })
      } else {
        if (!outstandingMessages.has(message.namespace)) {
          outstandingMessages.set(message.namespace, new Set())
        }

        outstandingMessages.get(message.namespace).add(createMessage(message))
      }
    }
  }

  function messageListener(event) {
    let data
    try {
      data = JSON.parse(event.data)
    } catch (error) {
      return false
    }

    if (!isSafeMessage(event.source, event.origin, data.type)) {
      return false
    }

    if (data.handshake || data.handshakeConfirmation) return handleHandshake(data)

    return handleMessage(data)
  }

  const ownWindow = sourceWindow || window
  ownWindow.addEventListener("message", messageListener, false)

  sendHandshake()

  function hasHandshake(callback) {
    if (isHandshaken) {
      if (typeof callback === "function") {
        callback()
      }
      return true
    }

    if (typeof callback === "function") {
      handshakeCallback.add(callback)
    }
    return false
  }

  return {
    addListener,
    removeListener,
    send,

    hasHandshake
  }
}

export default interframe
