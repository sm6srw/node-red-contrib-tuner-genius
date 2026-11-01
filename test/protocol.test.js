const { GeniusV4Protocol, parseKeyValues, parseStatus, parseBanner } = require("../GeniusV4Protocol");

describe("GeniusV4Protocol", () => {
    test("parseStatus", () => {
        expect(parseStatus("status fwd=10.5 swr=1.2 operate=1 name=abc")).toEqual({
            fwd: 10.5, swr: 1.2, operate: 1, name: "abc",
        });
    });

    test("parseKeyValues handles keys starting with a digit", () => {
        expect(parseKeyValues("info 3way=1 nickname=TG")).toEqual({ "3way": 1, nickname: "TG" });
    });

    test("parseBanner", () => {
        expect(parseBanner("V1.2.44 AUTH")).toEqual({ firmware: "1.2.44", authRequired: true });
        expect(parseBanner("V1.2.44")).toEqual({ firmware: "1.2.44", authRequired: false });
    });

    test("banner, command/reply and status", async () => {
        const written = [];
        const p = new GeniusV4Protocol({ write: (d) => written.push(d) });
        const status = [];
        const banners = [];
        p.onStatus((m) => status.push(m));
        p.onBanner((b) => banners.push(b));
        const reply = p.sendCommand("status", 500);
        expect(written[0]).toBe("C1|status\n");
        p.handleData("V1.2.44\r\nS7|status fwd=1\r\nR1|0|status swr=1\r");
        p.handleData("\n");
        await expect(reply).resolves.toBe("status swr=1");
        expect(status).toEqual(["status fwd=1"]);
        expect(banners).toEqual(["V1.2.44"]);
    });

    test("status command is answered by an S line", async () => {
        const written = [];
        const p = new GeniusV4Protocol({ write: (d) => written.push(d) });
        const status = [];
        p.onStatus((m) => status.push(m));
        const reply = p.sendStatusCommand(500);
        expect(written[0]).toBe("C1|status\n");
        p.handleData("S7|status fwd=23.63 swr=-60 state=1\r\n");
        await expect(reply).resolves.toBe("status fwd=23.63 swr=-60 state=1");
        expect(status).toEqual(["status fwd=23.63 swr=-60 state=1"]);
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
