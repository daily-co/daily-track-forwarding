# test utilities for real-time audio track streaming

## How audio is forwarded

On the Daily media servers, we take the opus audio streams coming
from each client, decode the opus and re-encode at 16-bit PCM
with a 16khz sample rate. (This format is sometimes called LINEAR16).
The bitrate is 265 kb/s.

These "raw" audio streams are then forwarded via a web socket connection
to your server.

When a new track is available to send, the Daily media server opens an
outgoing web socket connection to your server
and sends an initial text JSON message, which looks like this:

```
{
  tag: 'hello',
  domain_name: 'team-awesome',
  room_name: 'a-room-with-a-view',
  user_session_id: '01234-guid',
  user_id: 'value-passed-in-via-api',
  user_name: 'value-passed-in-via-api',
  muted: true | false
}
```

Your server must send the following response when it is ready to
receive audio data:

```
{
  tag: 'ready'
}
```

After you send the `ready` message, audio track data will be sent
as binary messages.

Muted/unmuted events will be sent as text messages:

```
{
  tag: 'muted'
}
```

```
{
  tag: 'unmuted'
}
```

The Daily media servers will attempt to open and use a new web
socket connection for each audio track that is part of the call.

## Installation of the test utilities in this repo

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

## Testing by saving audio in a file

You can run `ws-test-server.js` to save audio tracks to files
in your `/tmp` directory.

On a machine accessible from the internet, run:

```
node ws-test-server.js
```

This will start a web socket server to receive your audio, running on
port 7272.

If you're testing on a local machine, you can use ngrok to set up a tunnel
to port 7272.

```
ngrok http http://localhost:7272
```

Once the server is up and running, start forwarding audio tracks to it.
We've attached `beta...()` functions to the `window` object, while
our audio track forwarding feature is in beta. So, in client-side
javascript code, you can do this:

```
// start forwarding audio tracks
//
await window.betaStartTrackForwarding({ wsUri: 'http://79178811e590.ngrok.io' });

// stop forwarding audio tracks
//
await window.betaStopTrackForwarding();

// get current status of all tracks being forwarded to the socket
//
await window.betaGetTrackForwardingStats();
```

## Testing by sending audio streams to Google

You can run `ws-to-google.js` to send audio data to the Google
Cloud speech to text sevice.

If you don't already have appropriate Google cloud credentials set up,
create them as described here:

https://cloud.google.com/docs/authentication/getting-started

Then export them so the test server we run can find them:

```
export GOOGLE_APPLICATION_CREDENTIALS=<credentials-filename>
```

Then run:

```
node ws-to-google.js
```

And open a tunnel (if necessary) and start and stop track forwarding
as described above.

## Sending a test audio file directly to your web socket server

It can be useful to test your web socket server without starting and
stopping actual call audio tracks. Here's how to do that. `file-to-ws.js`
implements the sending side of the audio track forwarding protocol.

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
