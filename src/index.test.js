import interframe from "."

function createWindowMock()
{
  const listeners = []

  const mockWin = {
    postMessage: jest.fn().mockImplementation((message, origin) =>
    {
      listeners.forEach((listener) =>
      {
        listener({
          source: mockWin,
          origin,
          data: message
        })
      })
    }),

    addEventListener: jest.fn().mockImplementation((type, callback) =>
    {
      if (type === "message")
        listeners.push(callback)
    })
  }

  return mockWin
}

test("factory function available", () =>
{
  expect(typeof interframe).toBe("function")
})

test("expect window object in factory function", () =>
{
  expect(() =>
  {
    interframe()
  }).toThrowError(/parameter/)
})

test("can add message listener", () =>
{
  const mockWindow = createWindowMock()
  const channel = interframe(mockWindow)

  expect(() =>
  {
    channel.addListener(() => {
      // noop
    })
  }).not.toThrow()
})

test("can send message", () =>
{
  const mockWindow = createWindowMock()
  const channel = interframe(mockWindow, "*", mockWindow)

  expect(typeof channel.send).toBe("function")

  expect(() =>
  {
    channel.send()
  }).toThrow(/parameter/)

  expect(() =>
  {
    channel.send(123) // eslint-disable-line no-magic-numbers
  }).toThrow(/string/)

  expect(() =>
  {
    channel.send("namespace") // eslint-disable-line no-magic-numbers
  }).not.toThrow()

  expect(typeof channel.send("namespace").then).toBe("function")
})

test("can send and receive", (done) =>
{
  const mockWindow = createWindowMock()
  const channel1 = interframe(mockWindow, "*", mockWindow)
  const channel2 = interframe(mockWindow, "*", mockWindow)

  channel1.addListener((message) => {
    expect(message.namespace).toBe("testNamespace")
    done()
  })

  channel2.send("testNamespace")
})

test("handshakes", (done) =>
{
  const mockWindow = createWindowMock()
  const channel1 = interframe(mockWindow, "*", mockWindow)
  const channel2 = interframe(mockWindow, "*", mockWindow)

  channel1.hasHandshake(() =>
  {
    expect(channel1.hasHandshake()).toEqual(true)
    expect(channel2.hasHandshake()).toEqual(true)
    done()
  })
})

test("response to message", () =>
{
  const mockWindow = createWindowMock()
  const channel1 = interframe(mockWindow, "*", mockWindow)
  const channel2 = interframe(mockWindow, "*", mockWindow)

  channel1.addListener((message) =>
  {
    const responseChannel = message.open()
    setTimeout(() =>
    {
      responseChannel.response({
        hello: `Hi ${message.data.username}`
      })
    }, 1000)
  })

  return channel2
    .send("my namespace", { username: "Sebastian" })
    .then((message) =>
    {
      expect(message).toBeDefined()
      expect(message.data.hello).toBe("Hi Sebastian")
      return true
    })
})
