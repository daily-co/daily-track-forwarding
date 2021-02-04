# test utilities for real-time audio track streaming

## installation

First, you need gstreamer so that `file-to-ws.js` can pull in an audio file and
decode it. We're using the
[gstreamer-superficial](https://github.com/dturing/node-gstreamer-superficial)
npm module, which looks for `gstreamer-app-1.0.pc` in your pkg-config path.

On Ubuntu this should get everything you need:

```
apt install libgstreamer-plugins-base1.0-dev
```

Now the package dependencies should install:

```
npm i
```

## sending an audio file

Start the reference/toy web socket server:

```
node ws-test-server.js
```

Now, in another terminal, stream our test audio file to the server:

```
node file-to-ws.js counting-to-ten.ogg
```

If everything worked, the newest file in your `/tmp` directory should be a wav
file which is just the raw bytes that the web socket server got from
`file-to-ws.js`.

## protocol

The reference web socket server, `ws-test-server.js`, implements the receiver
side of a very simple protocol. After accepting a connection from a client, it
waits for a message of the form:

````json
{
  tag: 'hello',
  domain_name: 'team-awesome',
  room_name: 'a-room-with-a-view',
  user_session_id: '01234-guid',
  user_id: 'value-passed-in-via-api',
  user_name: 'value-passed-in-via-api',
  muted: true | false
}```

And responds to that message like so:

```json
{
tag: 'ready'
}
````

After sending the `ready` message, it expects to receive messages that
either contain raw audio bytes, or that contain JSON event strings. Check the type
of the message payload to distinguish between audio bytes and events.

Current events are:

```json
{"tag":"muted"}
{"tag":"unmuted"}
```

`file-to-ws.js` implements the sender side of this protocol.

```

```
