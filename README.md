# Interframe<br/>[![Sponsored by][sponsor-img]][sponsor] [![Version][npm-version-img]][npm] [![Downloads][npm-downloads-img]][npm] [![Build Status Unix][travis-img]][travis] [![Dependencies][deps-img]][deps]

Communication made easy between browser frames.

[sponsor-img]: https://img.shields.io/badge/Sponsored%20by-Sebastian%20Software-692446.svg
[sponsor]: https://www.sebastian-software.de
[deps]: https://david-dm.org/sebastian-software/interframe
[deps-img]: https://david-dm.org/sebastian-software/interframe.svg
[npm]: https://www.npmjs.com/package/interframe
[npm-downloads-img]: https://img.shields.io/npm/dm/interframe.svg
[npm-version-img]: https://img.shields.io/npm/v/interframe.svg
[travis-img]: https://img.shields.io/travis/sebastian-software/interframe/master.svg?branch=master&label=unix%20build
[travis]: https://travis-ci.org/sebastian-software/interframe


# Using Interframe

*Interframe* provides a factory function that takes a `window` and an `origin`
to open a communication channel. Please provide the `window` object of the
counterpart frame to open a communication channel with that frame.

````
import interframe from "interframe"

/* get reference to iframe */
const iframe = document.getElementById("#myIframe")

const channel = interframe(iframe.contentWindow, "*")
````

Using `*` as origin allows communication with every other message provider.


## Listening for messages

*Interframe* allowes to add message event listeners to receive messages from
the opposite side. As long as no message listener is assigned messages are
cached.

````
channel.addListener((message) =>
{
  console.log(message.id)
  console.log(message.namespace)
  console.log(message.data)
  console.log(message.channel)
})
````


## Sending messages

A message consist of a namespace and, optional, a serializable object.

````
channel.send("namespace", { foo: "bar" })
````


## Responding to messages

As each message has a unique *id* interframe is able to response to messages.
For this the `send()` method returns a *promise* that is resolved with a message.
If response channel is not opened inside message callback the promise is rejected.

````
const channel1 = interframe(window, "*")
const channel2 = interframe(window, "*")

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

channel2
  .send("my namespace", { username: "Sebastian" })
  .then((message) =>
  {
    console.log(message.id)
    console.log(message.namespace)
    console.log(message.data)
    console.log(message.channel)
  })
````

`response()` is a shortcut of send with preset namespace of source message.

## Copyright

<img src="https://raw.githubusercontent.com/sebastian-software/s15e-javascript/master/assets/sebastiansoftware.png" alt="Sebastian Software GmbH Logo" width="250" height="200"/>

Copyright 2016-2017<br/>[Sebastian Software GmbH](http://www.sebastian-software.de)