// Client for the Genius V4 line based API (shared pattern with Antenna Genius).
//   request:   C<seq>|<command>\r\n
//   reply:     R<seq>|<hex result>|<message>\r\n
//   status:    S0|<message>\r\n
class GeniusV4Protocol {
    constructor(socket) {
        this.socket = socket;
        this.seq = 0;
        this.pending = new Map();
        this.lineBuffer = "";
        this.statusHandler = null;
    }

    nextSeq() {
        this.seq = (this.seq % 255) + 1;
        return this.seq;
    }

    handleData(chunk) {
        this.lineBuffer += chunk.toString("utf8");
        const lines = this.lineBuffer.split("\n");
        this.lineBuffer = lines.pop();
        for (const line of lines) {
            this._handleLine(line.replace(/\r$/, ""));
        }
    }

    _handleLine(line) {
        if (!line) return;

        if (line.startsWith("S")) {
            const pipeIdx = line.indexOf("|");
            const msg = pipeIdx !== -1 ? line.substring(pipeIdx + 1) : "";
            if (this.statusHandler) {
                this.statusHandler(msg);
            }
            return;
        }

        if (line.startsWith("R")) {
            const pipeIdx1 = line.indexOf("|");
            if (pipeIdx1 === -1) return;
            const pipeIdx2 = line.indexOf("|", pipeIdx1 + 1);
            const seq = parseInt(line.substring(1, pipeIdx1), 10);
            const hexResult = line.substring(pipeIdx1 + 1, pipeIdx2 !== -1 ? pipeIdx2 : undefined);
            const message = pipeIdx2 !== -1 ? line.substring(pipeIdx2 + 1) : "";

            const pending = this.pending.get(seq);
            if (!pending) return;

            if (parseInt(hexResult, 16) !== 0) {
                this.pending.delete(seq);
                pending.reject(new Error(`Command error: 0x${hexResult} - ${message}`));
                return;
            }

            if (pending.multi) {
                if (message === "") {
                    this.pending.delete(seq);
                    pending.resolve(pending.lines);
                } else {
                    pending.lines.push(message);
                }
            } else {
                this.pending.delete(seq);
                pending.resolve(message);
            }
        }
    }

    sendCommand(cmd, timeoutMs) {
        return this._send(cmd, false, timeoutMs);
    }

    sendCommandMulti(cmd, timeoutMs) {
        return this._send(cmd, true, timeoutMs);
    }

    _send(cmd, multi, timeoutMs) {
        const seq = this.nextSeq();
        return new Promise((resolve, reject) => {
            const entry = { resolve, reject, lines: multi ? [] : null, multi };
            if (timeoutMs) {
                const timer = setTimeout(() => {
                    this.pending.delete(seq);
                    const error = new Error(`Timeout waiting for reply to '${cmd}'`);
                    error.code = "ETIMEDOUT";
                    reject(error);
                }, timeoutMs);
                entry.resolve = (v) => { clearTimeout(timer); resolve(v); };
                entry.reject = (e) => { clearTimeout(timer); reject(e); };
            }
            this.pending.set(seq, entry);
            this.socket.write(`C${seq}|${cmd}\r\n`);
        });
    }

    onStatus(handler) {
        this.statusHandler = handler;
    }
}

const parseKeyValues = (tokens, startIndex) => {
    const kv = {};
    for (let i = startIndex; i < tokens.length; i++) {
        const eq = tokens[i].indexOf("=");
        if (eq !== -1) {
            kv[tokens[i].substring(0, eq)] = tokens[i].substring(eq + 1);
        }
    }
    return kv;
};

const toNumber = (value) => {
    if (value === undefined || value === "") return undefined;
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
};

const parseInfo = (msg) => {
    // "info v=1.0.0 serial=XX name=Tuner_Genius_XL"
    const kv = parseKeyValues(msg.split(" "), 1);
    return {
        name: (kv.name || "").replace(/_/g, " "),
        firmware: kv.v || "",
        serial: kv.serial || "",
    };
};

const parseTuner = (msg) => {
    // "tuner 1 operate=1 bypass=0 tuning=0 swr=1.05 fwd=100.0 band=3 c=120 l=45 ant=1"
    const tokens = msg.trim().split(" ");
    const kv = parseKeyValues(tokens, 2);
    const tuner = { tunerNum: parseInt(tokens[1], 10) };
    for (const key of Object.keys(kv)) {
        const n = toNumber(kv[key]);
        tuner[key] = n === undefined ? kv[key] : n;
    }
    return tuner;
};

exports.GeniusV4Protocol = GeniusV4Protocol;
exports.parseKeyValues = parseKeyValues;
exports.parseInfo = parseInfo;
exports.parseTuner = parseTuner;
