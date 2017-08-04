/* eslint-disable filenames/match-exported, max-params */

import nextID from "./nextID"

const TYPE = "application/interframe-ssoft-v1+json"
const PROMISE_TIMEOUT = 3000

function interframe(targetWindow, origin = "*", sourceWindow)
{
  if (!targetWindow)
  {
    throw new Error("parameter 'targetWindow' is missing")
  }

  const listeners = []
  const handshakeCallback = []
  const responseResolver = {}
  const preHandshakeSendQueue = []
  let isHandshaken = false

  function addListener(callback)
  {
    listeners.push(callback)
    return callback
  }

  function removeListener(callback)
  {
    const pos = listeners.indexOf(callback)

    if (pos >= 0) {
      listeners.splice(pos, 1)
    }
  }

  function send(namespace, data = null, responseId)
  {
    if (!namespace)
    {
      throw new Error("parameter 'namespace' is missing")
    }
    if (typeof namespace !== "string")
    {
      throw new Error("parameter 'namespace' must be a string")
    }

    if (!isHandshaken) {
      return new Promise((resolve) =>
      {
        preHandshakeSendQueue.push({
          namespace,
          data,
          responseId,
          resolve
        })
      })
    }

    const id = nextID()
    targetWindow.postMessage(JSON.stringify({
      id,
      responseId,
      type: TYPE,
      namespace,
      data
    }), origin)

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        responseResolver[id] = undefined // eslint-disable-line security/detect-object-injection
        resolve()
      }, PROMISE_TIMEOUT)

      responseResolver[id] = { // eslint-disable-line security/detect-object-injection
        resolve,
        timer
      }
    })
  }

  function sendHandshake(acknowledgement = false)
  {
    const message = { type: TYPE }
    if (acknowledgement)
      message.handshakeConfirmation = true
    else
      message.handshake = true

    targetWindow.postMessage(JSON.stringify(message), origin)
  }

  function isSafeMessage(msgSource, msgOrigin, msgType)
  {
    const safeSource = msgSource === targetWindow
    const safeOrigin = (origin === "*") || (msgOrigin === origin)
    const safeType = msgType === TYPE

    return safeSource && safeOrigin && safeType
  }

  function handleHandshake(data)
  {
    if (data.handshake)
      sendHandshake(true)

    isHandshaken = true

    for (const hsCallback of handshakeCallback) {
      hsCallback()
    }
    handshakeCallback.length = 0

    for (const sendItem of preHandshakeSendQueue) {
      send(
        sendItem.namespace,
        sendItem.data,
        sendItem.responseId
      ).then(
        (response) => sendItem.resolve(response)
      ).catch(
        () => sendItem.resolve()
      )
    }
  }

  function createMessage(messageData)
  {
    const message = {
      id: messageData.id,
      data: messageData.data,
      namespace: messageData.namespace,

      open: () => {
        message.isPromise = true

        return Object.assign(
          {},
          messageData,
          {
            response: (data) =>
            {
              send(messageData.namespace, data, messageData.id)
            }
          }
        )
      }
    }

    return message
  }

  function handleMessage(messageData)
  {
    if (messageData.responseId && responseResolver[messageData.responseId])
    {
      const resolver = responseResolver[messageData.responseId]
      clearTimeout(resolver.timer)
      resolver.resolve(messageData)
      responseResolver[messageData.responseId] = undefined
    }
    else
    {
      const message = createMessage(messageData)
      for (const listener of listeners)
        listener(createMessage(message))
    }
  }

  function messageListener(event)
  {
    let data

    try
    {
      data = JSON.parse(event.data)
    }
    catch (error)
    {
      return false
    }

    if (!isSafeMessage(event.source, event.origin, data.type))
    {
      return false
    }

    if (data.handshake || data.handshakeConfirmation)
      return handleHandshake(data)

    return handleMessage(data)
  }

  const ownWindow = sourceWindow || window
  ownWindow.addEventListener("message", messageListener, false)

  sendHandshake()

  function hasHandshake(callback)
  {
    if (isHandshaken)
    {
      if (typeof callback === "function")
        callback()
      return true
    }

    handshakeCallback.push(callback)
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
