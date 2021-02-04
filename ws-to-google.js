/**

Usage: node ws-to-google.js [port]

Accepts web sockets connection (defaults to listening on port 7272) and speaks
the very simple protocol described in the header comments of ws-test-server.js.

Passes incoming audio to Google Cloud Speech-to-Text API and prints the results
to the console.

Disconnects the stream out to Google for call participants that are muted. (This
avoids being billed for speech-to-text minutes for muted participants.)

Reconnects to Google every 290 seconds, to allow continuous streaming. (The
Speech-To-Text service has a 305 second maximum connection time.)

Requires Google Cloud credentials to be set up, for example via the
GOOGLE_APPLICATION_CREDENTIALS environment variable.
See: https://cloud.google.com/docs/authentication/getting-started

*/

const WebSocket = require("ws");
const speech = require("@google-cloud/speech");

const SERVER_PORT = process.argv[2] || 7272;
console.log("listening on port ", SERVER_PORT);

//
// speech setup
//

const encoding = "LINEAR16";
const sampleRateHertz = 16000;
const languageCode = "en-US";

const request = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
  },
  interimResults: false,
};

const client = new speech.SpeechClient();

//
// web socket server setup
//

const wss = new WebSocket.Server({
  port: SERVER_PORT,
});

wss.on("connection", async (ws) => {
  console.log("accepted new connection");
  ws.once("message", (msg) => handleHello(ws, msg));
  ws.on("close", () => cleanupSocket(ws));
});

async function handleHello(ws, data) {
  console.log("message ->", data);
  const msg = JSON.parse(data);

  // create the speech-to-textifier :-)
  ws.recognizer = new RestartableRecogniser({
    ws,
    speechClient: client,
    textCallback: (data) => {
      console.log(`${msg.user_session_id}: ${data}`);
    },
  });
  if (!msg.muted) {
    ws.recognizer.start();
  }

  // listen for incoming binary data from now on
  console.log("setting up to read data");
  ws.on("message", (data) => {
    // console.log("INPUT BUFFER ->", data);

    if (typeof data === "string") {
      try {
        const event = JSON.parse(data);
        if (event.tag === "muted") {
          console.log("muted, pausing recognizer");
          ws.recognizer.stop();
        } else if (event.tag === "unmuted") {
          console.log("unmuted, restarting recognizer");
          ws.recognizer.start();
        } else {
          console.log("unrecognized message:", event);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      ws.recognizer.write(data);
    }
  });

  // okay, tell the client we're ready
  ws.send(JSON.stringify({ tag: "ready" }));
}

async function cleanupSocket(ws) {
  console.log("closed a connection");
  if (ws.recognizer) {
    ws.recognizer.stop();
    ws.recognizer = null;
  }
}

//
// Google's StreamingRecognizer session times out after about 10 seconds with no
// data sent. And also after 305 seconds total. So it's necessary to stop and
// restart if we're not sending any data. (Which is the case when the audio
// track is muted by Daily.) And we also need to restart a recognizer that is
// about to hit the 305 second limit.
//
const RESTART_STREAMING_RECOGNIZER_AFTER_MS = 290 * 1000;
const PAUSE_RECOGNIZER_WHEN_MUTED_FOR_MS = 5 * 1000;

class RestartableRecogniser {
  constructor({ speechClient, ws, textCallback }) {
    this.speechClient = speechClient;
    this.ws = ws;
    this.textCallback = textCallback;
    this.recStream = null;
    this.started = false;
    this.restartTimer = null;
  }

  start() {
    if (this.started) {
      return;
    }
    this.started = true;
  }

  stop() {
    if (this.stopped) {
      return;
    }
    this.started = false;
    this._clearRecStream();
  }

  write(buf) {
    if (!this.started) {
      return;
    }
    if (!this.recStream) {
      this._createRecStream();
    }
    this.recStream.write(buf);
  }

  // should only be called from `write()`
  _createRecStream() {
    if (this.recStream) {
      return;
    }
    // create recognizer
    console.log("creating recognizer");
    this.recStream = this.speechClient
      .streamingRecognize(request)
      .on("error", (err) => {
        console.error(err);
        process.exit(1);
      })
      .on("data", (data) =>
        this.textCallback(
          data.results[0] && data.results[0].alternatives[0]
            ? data.results[0].alternatives[0].transcript
            : "[UNEXPECTED] empty transcription result"
        )
      );
    // set up restart timer
    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this._clearRecStream();
      this._createRecStream();
    }, RESTART_STREAMING_RECOGNIZER_AFTER_MS);
  }

  _clearRecStream() {
    if (!this.recStream) {
      return;
    }
    this.recStream.end();
    this.recStream = null;
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }
}
