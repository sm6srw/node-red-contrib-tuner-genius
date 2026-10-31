// Client for the Genius V4 line based API (shared pattern with Antenna Genius).
//   request:   C<seq>|<command>\r\n
//   reply:     R<seq>|<hex result>|<message>\r\n
//   status:    S<n>|<message>\r\n   (TGXL pushes S7|status fwd=... swr=...)
//   banner:    V<version>[ AUTH]\r\n  (sent once on connect)
class GeniusV4Protocol {
    constructor(socket) {
        this.socket = socket;
        this.seq = 0;
        this.pending = new Map();
        this.lineBuffer = "";
        this.statusHandler = null;
        this.bannerHandler = null;
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

        if (line.startsWith("V")) {
            if (this.bannerHandler) {
                this.bannerHandler(line);
            }
            return;
        }

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

    onBanner(handler) {
        this.bannerHandler = handler;
    }
}

const toValue = (value) => {
    if (value === "") return value;
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
};

// Parses "key=value key=value ..." (optionally prefixed by a word such as "status").
const parseKeyValues = (msg) => {
    const kv = {};
    const re = /([A-Za-z_]\w*)=(\S*)/g;
    let m;
    while ((m = re.exec(msg)) !== null) {
        kv[m[1]] = toValue(m[2]);
    }
    return kv;
};

const parseStatus = (msg) => parseKeyValues(msg);

// "V1.1.8 AUTH"
const parseBanner = (line) => {
    const tokens = line.trim().split(/\s+/);
    return {
        firmware: tokens[0].replace(/^V/, ""),
        authRequired: tokens.includes("AUTH"),
    };
};

exports.GeniusV4Protocol = GeniusV4Protocol;
exports.parseKeyValues = parseKeyValues;
exports.parseStatus = parseStatus;
exports.parseBanner = parseBanner;
