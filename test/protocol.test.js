const { GeniusV4Protocol, parseInfo, parseTuner } = require("../GeniusV4Protocol");

describe("GeniusV4Protocol", () => {
    test("parseInfo", () => {
        expect(parseInfo("info v=1.2.3 serial=AB name=Tuner_Genius_XL")).toEqual({
            name: "Tuner Genius XL", firmware: "1.2.3", serial: "AB",
        });
    });

    test("parseTuner", () => {
        expect(parseTuner("tuner 1 operate=1 swr=1.05 mode=auto")).toEqual({
            tunerNum: 1, operate: 1, swr: 1.05, mode: "auto",
        });
    });

    test("command/reply and status", async () => {
        const written = [];
        const p = new GeniusV4Protocol({ write: (d) => written.push(d) });
        const status = [];
        p.onStatus((m) => status.push(m));
        const reply = p.sendCommand("info get", 500);
        expect(written[0]).toBe("C1|info get\r\n");
        p.handleData("S0|tuner 1 operate=1\r\nR1|0|info v=1\r");
        p.handleData("\n");
        await expect(reply).resolves.toBe("info v=1");
        expect(status).toEqual(["tuner 1 operate=1"]);
    });

    test("error reply rejects", async () => {
        const p = new GeniusV4Protocol({ write: () => {} });
        const reply = p.sendCommand("bad");
        p.handleData("R1|10|oops\r\n");
        await expect(reply).rejects.toThrow("Command error");
    });

    test("timeout", async () => {
        const p = new GeniusV4Protocol({ write: () => {} });
        await expect(p.sendCommand("x", 10)).rejects.toMatchObject({ code: "ETIMEDOUT" });
    });
});
