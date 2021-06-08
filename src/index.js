/* eslint-disable filenames/match-exported, max-params, compat/compat */
/* eslint-env browser */

import nextID from "./nextID"

const TYPE = "application/interframe-ssoft-v1+json"
const PROMISE_TIMEOUT = 3000
const HAS_CONSOLE_LOG =
  typeof console !== "undefined" && typeof console.log === "function"
const UNIQUE_ID_RANDOM_LENGTH = 5

function log(id, ...messages) {
  if (HAS_CONSOLE_LOG) {
    // eslint-disable-next-line no-console
    console.log(`[interframe ${id}]`, ...messages)
  }
}

function generateUniqueId() {
  const nowDate = Date.now().toString()

  return `${nowDate.substring(nowDate.length - UNIQUE_ID_RANDOM_LENGTH)}-${Math.random()
    .toFixed(UNIQUE_ID_RANDOM_LENGTH)
    .substring(2)}`
}

function interframe(
  targetWindow,
  origin = "*",
  sourceWindow,
  { debug } = { debug: false }
) {
  if (!targetWindow) {
    throw new Error("parameter 'targetWindow' is missing")
  }

  const ownId = generateUniqueId()

  const listeners = new Map()
  const handshakeCallback = new Set()
  const responseResolver = new Map()
  const preHandshakeSendQueue = new Set()
  const outstandingMessages = new Map()
  let isHandshaken = false

  function addListener(namespace, callback) {
    if (debug) {
      log(ownId, `addListener() to ${namespace}`)
    }
    if (!listeners.has(namespace)) {
      listeners.set(namespace, new Set())
    }
    listeners.get(namespace).add(callback)

    if (outstandingMessages.has(namespace)) {
      if (debug) {
        log(
          ownId,
          ` \\- has ${outstandingMessages.get(namespace).length} outstanding messages`
        )
      }
      outstandingMessages.get(namespace).forEach((message) => callback(message))
      outstandingMessages.delete(namespace)
    }

    return callback
  }

  function removeListener(namespace, callback) {
    if (debug) {
      log(ownId, `removeListener() to ${namespace}`)
    }
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
      if (debug) {
        log(ownId, `send() to ${namespace} without handshake`, data)
      }
      return new Promise((resolve) => {
        preHandshakeSendQueue.add({
          namespace,
          data,
          responseId,
          resolve
        })
      })
    }

    if (debug) {
      log(ownId, `send() to ${namespace}`, data)
    }
    const id = nextID()

    if (origin !== null) {
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
    } else {
      targetWindow.postMessage(
        JSON.stringify({
          id,
          responseId,
          type: TYPE,
          namespace,
          data
        })
      )
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        responseResolver.delete(id)
        resolve()
      }, PROMISE_TIMEOUT)

      responseResolver.set(id, {
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

    if (debug) {
      if (acknowledgement) {
        log(ownId, `sendHandshake() as acknowledgement to handshake request`)
      } else {
        log(ownId, `sendHandshake() as initial handshake request`)
      }
    }

    if (origin !== null) {
      targetWindow.postMessage(JSON.stringify(message), origin)
    } else {
      targetWindow.postMessage(JSON.stringify(message))
    }
  }

  function isSafeMessage(msgSource, msgOrigin, msgType) {
    const jsdom = window.navigator.userAgent.indexOf("jsdom") >= 0 && msgSource === null
    const safeSource = msgSource === targetWindow || jsdom
    const safeOrigin = origin === "*" || origin === null || msgOrigin === origin
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

  function objectAssignPolyfill(target) {
    const result = Object(target)

    for (let index = 1; index < arguments.length; index++) {
      const nextSource = arguments[index] // eslint-disable-line prefer-rest-params

      // Skip over if undefined or null
      if (nextSource != null) {
        for (const nextKey in nextSource) {
          // Avoid bugs when hasOwnProperty is shadowed
          // eslint-disable-next-line max-depth
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            result[nextKey] = nextSource[nextKey]
          }
        }
      }
    }

    return result
  }
  const objectAssign =
    typeof Object.assign == "function" ? Object.assign : objectAssignPolyfill

  function createMessage(messageData) {
    const message = {
      id: messageData.id,
      data: messageData.data,
      namespace: messageData.namespace,

      open: () => {
        message.isPromise = true

        return objectAssign({}, messageData, {
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
      if (debug) {
        log(ownId, `handleMessage() having response id`, messageData)
      }
      const resolver = responseResolver.get(messageData.responseId)
      clearTimeout(resolver.timer)
      resolver.resolve(messageData)
      responseResolver.delete(messageData.responseId)
    } else {
      const message = createMessage(messageData)

      if (listeners.has(message.namespace)) {
        if (debug) {
          log(
            ownId,
            `handleMessage() received message having namespace listeners`,
            messageData
          )
        }

        listeners.get(message.namespace).forEach((listener) => {
          // eslint-disable-next-line max-depth
          if (typeof listener === "function") {
            listener(createMessage(message))
          } else if (listener) {
            console.error("Listener is no function: ", listener) // eslint-disable-line
          }
        })
      } else {
        if (debug) {
          log(
            ownId,
            `handleMessage() received message without listeners, put into outstanding messages queue`,
            messageData
          )
        }
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
