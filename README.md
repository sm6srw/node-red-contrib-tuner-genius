# node-red-contrib-tuner-genius

Node-RED nodes for monitoring and controlling a 4O3A Tuner Genius using the
Genius V4 line API (same pattern as `node-red-contrib-antenna-genius`):

    C<seq>|<command>        request
    R<seq>|<hex>|<message>  reply
    S0|<message>            status push

## Nodes

- **tuner-genius-server** (config): host, port (default 9010), auto connect.
- **tuner-genius-status**: emits `msg.payload` (object of the tuner state) on every change; any input re-sends the current state.
- **tuner-genius-control**: `msg.topic` = `operate`, `bypass` or `tune`; `msg.payload` true/1/"on" enables for operate/bypass.

## Commands used

`info get`, `tuner get 1`, `sub tuner all`, `tuner set 1 operate=<0|1>`, `tuner set 1 bypass=<0|1>`, `tuner tune 1`.
Status lines of the form `tuner 1 key=value ...` are parsed to numbers where possible.

## Install

    npm install node-red-contrib-tuner-genius
