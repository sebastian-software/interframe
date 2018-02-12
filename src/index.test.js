import interframe from "."
import jsdom from "jsdom"

function createWindowMock() {
  const virtDom = new jsdom.JSDOM("<!DOCTYPE html>")
  return virtDom.window
}

test("factory function available", () => {
  expect(typeof interframe).toBe("function")
})

test("expect window object in factory function", () => {
  expect(() => {
    interframe()
  }).toThrowError(/parameter/)
})

test("can add message listener", () => {
  const mockWindow = createWindowMock()
  const channel = interframe(mockWindow)

  expect(() => {
    channel.addListener("namespace", () => {
      // noop
    })
  }).not.toThrow()
})

test("can send message", () => {
  const mockWindow = createWindowMock()
  const channel = interframe(mockWindow, "*", mockWindow)

  expect(typeof channel.send).toBe("function")

  expect(() => {
    channel.send()
  }).toThrow(/parameter/)

  expect(() => {
    channel.send(123) // eslint-disable-line no-magic-numbers
  }).toThrow(/string/)

  expect(() => {
    channel.send("namespace") // eslint-disable-line no-magic-numbers
  }).not.toThrow()

  expect(typeof channel.send("namespace").then).toBe("function")
})

test("can send and receive", (done) => {
  const mockWindow = createWindowMock()
  const channel1 = interframe(mockWindow, "*", mockWindow)
  const channel2 = interframe(mockWindow, "*", mockWindow)

  channel1.addListener("testNamespace", (message) => {
    expect(message.namespace).toBe("testNamespace")
    done()
  })

  channel2.send("testNamespace")
})

test("handshakes", (done) => {
  const mockWindow = createWindowMock()
  const mockWindow2 = createWindowMock()
  const channel1 = interframe(mockWindow, "*", mockWindow2)
  const channel2 = interframe(mockWindow2, "*", mockWindow)

  let handshake1 = false
  let handshake2 = false

  const callback = () => {
    if (handshake1 && handshake2) {
      expect(channel1.hasHandshake()).toEqual(true)
      expect(channel2.hasHandshake()).toEqual(true)
      done()
    }
  }

  channel1.hasHandshake(() => {
    handshake1 = true
    callback()
  })
  channel2.hasHandshake(() => {
    handshake2 = true
    callback()
  })
})

test("response to message", (done) => {
  const mockWindow = createWindowMock()
  const channel1 = interframe(mockWindow, "*", mockWindow)
  const channel2 = interframe(mockWindow, "*", mockWindow)

  channel1.addListener("my namespace", (message) => {
    const responseChannel = message.open()
    setTimeout(() => {
      responseChannel.response({
        hello: `Hi ${message.data.username}`
      })
    }, 1000)
  })

  return channel2.send("my namespace", { username: "Sebastian" }).then((message) => {
    expect(message).toBeDefined()
    expect(message.data.hello).toBe("Hi Sebastian")

    return done()
  })
})

test("response to message before handshake", (done) => {
  const mockWindow = createWindowMock({ delay: true })
  const channel1 = interframe(mockWindow, "*", mockWindow)

  channel1
    .send("my namespace", { username: "Sebastian" })
    .then((message) => {
      expect(message).toBeDefined()
      expect(message.data.hello).toBe("Hi Sebastian")
      return done()
    })
    .catch((error) => {
      expect(error).toBeFalsy()
      throw done()
    })

  const channel2 = interframe(mockWindow, "*", mockWindow)

  channel2.addListener("my namespace", (message) => {
    const responseChannel = message.open()
    setTimeout(() => {
      responseChannel.response({
        hello: `Hi ${message.data.username}`
      })
    }, 1000)
  })
})

test("addListener namespace should be respected", (done) => {
  const mockWindow = createWindowMock()
  const channel1 = interframe(mockWindow, "*", mockWindow)
  const channel2 = interframe(mockWindow, "*", mockWindow)

  const callback = jest.fn()

  channel1.addListener("tn", callback)
  channel1.addListener("uncalled", callback)

  channel2.send("tn")

  setTimeout(() => {
    expect(callback.mock.calls).toHaveLength(1)
    done()
  }, 100)
})

