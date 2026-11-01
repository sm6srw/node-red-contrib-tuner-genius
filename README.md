# node-red-contrib-tuner-genius

Node-RED nodes for monitoring and operating a 4O3A Tuner Genius XL over its TCP API (port 9010).
Framing: `C<seq>|<command>` request, `R<seq>|<hex>|<message>` reply, `S<n>|status key=value ...` pushed status.

## Nodes

- **tuner-genius-server** (config): host, port (default 9010), auto connect, status poll interval (default 1000 ms, 0 = off).
- **tuner-genius-status**: subscribes to one status property per node (`fwd`, `peak`, `swr`, `state`, `bypass`, `bandA`, `antA`, ... or *all*). Emits `msg.payload` (the value), `msg.topic` (the property name) and `msg.previous`. With *all*, `msg.payload` is the whole status object and `msg.topic` is `status`. By default it only emits when the value changes; an optional deadband suppresses small numeric changes. Any input emits the last known value and refreshes from the device.
- **tuner-genius-control**: `msg.topic` selects the action:
  - `operate` / `bypass`: payload true/1/"on" enables, anything else disables
  - `activate`: payload 1-3 (antenna, 3WAY units) or 1-2 (channel, SO2R units); the variant is detected from `3way=1` in the `info` reply
  - `autotune`

## Commands used

`info`, `status`, `operate set=<0|1>`, `bypass set=<0|1>`, `activate ant=<1-3>` (3WAY) / `activate ch=<1-2>` (SO2R), `autotune`.

Not yet supported: UDP discovery and `auth` (authentication is only required when connecting from outside the local network).

## Install

    npm install node-red-contrib-tuner-genius
