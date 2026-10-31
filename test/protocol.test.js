const { GeniusV4Protocol, parseStatus, parseBanner } = require("../GeniusV4Protocol");

describe("GeniusV4Protocol", () => {
    test("parseStatus", () => {
        expect(parseStatus("status fwd=10.5 swr=1.2 operate=1 name=abc")).toEqual({
            fwd: 10.5, swr: 1.2, operate: 1, name: "abc",
        });
    });

    test("parseBanner", () => {
        expect(parseBanner("V1.1.8 AUTH")).toEqual({ firmware: "1.1.8", authRequired: true });
        expect(parseBanner("V1.1.8")).toEqual({ firmware: "1.1.8", authRequired: false });
    });

    test("banner, command/reply and status", async () => {
        const written = [];
        const p = new GeniusV4Protocol({ write: (d) => written.push(d) });
        const status = [];
        const banners = [];
        p.onStatus((m) => status.push(m));
        p.onBanner((b) => banners.push(b));
        const reply = p.sendCommand("status", 500);
        expect(written[0]).toBe("C1|status\r\n");
        p.handleData("V1.1.8\r\nS7|status fwd=1\r\nR1|0|status swr=1\r");
        p.handleData("\n");
        await expect(reply).resolves.toBe("status swr=1");
        expect(status).toEqual(["status fwd=1"]);
        expect(banners).toEqual(["V1.1.8"]);
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
