/**

Accept connections on port 7272, wait for a message of the form:

{ 
  tag: 'hello',
  domain_name: 'team-awesome',
  room_name: 'a-room-with-a-view',
  user_session_id: '01234-guid',
  user_id: 'value-passed-in-via-api',
  user_name: 'value-passed-in-via-api',
  muted: true | false
}

Create a file named /tmp/<room_name>-<user_session_id>.wav, then
respond with message of the form:

{
  tag: 'ready'
}

After which, check the type of each incoming web socket message payload.
Write binary data to the tmp file; write string messages to the console.

We are assuming that the sender is handling all the rtp-level packet
re-senquencing (etc) and sending us as clean a byte stream as possible.
However, there *will* be gaps in the byte stream whenever the WebRTC
audio track is muted at the sender end, or is unplayable because of
network issues.

The output file should be a playable wav file filled with a lovely
sequence of pcm_s16le samples.

*/

const SERVER_PORT = 7272;
const BPS_REPORT_INTERVAL_MS = 5 * 1000;
const WebSocket = require("ws");
const fs = require("fs");

const files = {};

let totalBytesCount = 0;
let lastBytesCount = 0;

const wss = new WebSocket.Server({
  port: SERVER_PORT,
});

const bpsReportInterval = setInterval(() => {
  let bps =
    ((totalBytesCount - lastBytesCount) / (BPS_REPORT_INTERVAL_MS / 1000)) * 8;
  console.log("bps: ", bps);
  lastBytesCount = totalBytesCount;
}, BPS_REPORT_INTERVAL_MS);

wss.on("connection", async (ws) => {
  console.log("accepted new connection");
  ws.once("message", (msg) => handleHello(ws, msg));
  ws.on("close", () => cleanupSocket(ws));
});

async function handleHello(ws, data) {
  console.log("message ->", data);
  let msg = JSON.parse(data);

  // create file
  const stream = fs.createWriteStream(
    // `/tmp/${msg.room_name}-${msg.user_session_id}.wav`
    `/tmp/${msg.room_name}-${msg.user_session_id}.webm`
    // { flags: "a" }
  );

  // listen for incoming binary data from now on
  ws.on("message", (data) => {
    // console.log("INPUT BUFFER ->", data);
    if (typeof data === "string") {
      console.log("non-binary event message", data);
    } else {
      stream.write(data);
      totalBytesCount += data.length;
    }
  });

  // okay, tell the client we're ready
  ws.send(JSON.stringify({ tag: "ready" }));
}

async function cleanupSocket(ws) {
  console.log("closed a connection");
}
