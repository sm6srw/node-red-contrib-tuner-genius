# node-red-contrib-tuner-genius

Node-RED nodes for monitoring and operating a 4O3A Tuner Genius XL (SO2R and 3WAY variants) over its TCP API (port 9010).
Framing: `C<seq>|<command>` request, `R<seq>|<hex>|<message>` reply, `S<n>|status key=value ...` status.

[![Node.js CI](https://github.com/sm6srw/node-red-contrib-tuner-genius/actions/workflows/node.js.yml/badge.svg)](https://github.com/sm6srw/node-red-contrib-tuner-genius/actions/workflows/node.js.yml) [![Node.js Package](https://github.com/sm6srw/node-red-contrib-tuner-genius/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/sm6srw/node-red-contrib-tuner-genius/actions/workflows/npm-publish.yml) [![CodeQL](https://github.com/sm6srw/node-red-contrib-tuner-genius/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/sm6srw/node-red-contrib-tuner-genius/actions/workflows/codeql-analysis.yml) [![njsscan sarif](https://github.com/sm6srw/node-red-contrib-tuner-genius/actions/workflows/njsscan-analysis.yml/badge.svg)](https://github.com/sm6srw/node-red-contrib-tuner-genius/actions/workflows/njsscan-analysis.yml)

## Nodes

- **tuner-genius-server** (config): host, port (default 9010), auto connect, status poll interval (default 1000 ms, 0 = off).
- **tuner-genius-status**: subscribes to one status property per node (`fwd`, `peak`, `swr`, `state`, `bypass`, `bandA`, `antA`, ... or *all*). Emits `msg.payload` (the value), `msg.topic` (the property name) and `msg.previous`. With *all*, `msg.payload` is the whole status object and `msg.topic` is `status`. By default it only emits when the value changes; an optional deadband suppresses small numeric changes. A start delay (default 1000 ms) holds back the first output after deploy so that downstream nodes, such as dashboard widgets, can initialize. Any input emits the last known value and refreshes from the device.
- **tuner-genius-info**: emits the device info once after connecting, either as an object or as a single property (`msg.payload` is the value, `msg.topic` the property name). Any input re-reads and emits it. Has the same start delay as the status node.
- **tuner-genius-control**: sends a command to the tuner. The action is fixed in the node, or taken from `msg.topic` when the node is set to `msg.topic`; a fixed action always wins over `msg.topic`.

### Status properties

Values and units as described in the TGXL API documentation.

| Property | Meaning | Unit / values |
|---|---|---|
| `state` | Device state | 0 = standby, 1 = operate |
| `active` | Selected channel | 1 or 2 |
| `tuning` | Tuning in progress | 1 = yes, 0 = no |
| `bypass` | Device bypassed | 1 = yes, 0 = in line |
| `ag` | Antenna Genius connected | 1 = yes, 0 = no |
| `fwd` | Forward power | dBm |
| `peak` | Peak power | dBm |
| `max` | Maximum power | dBm |
| `swr` | Return loss | dB; -60 when there is no RF |
| `relayC1`, `relayL`, `relayC2` | Tuning network relay positions | 0-255 |
| `pttA`, `pttB` | PTT asserted on channel A / B | 1 = yes, 0 = no |
| `modeA`, `modeB` | Active mode | 0 = RF sense, 1 = FLEX, 2 = CAT, 3 = P2B, 4 = BCD |
| `flexA`, `flexB` | FlexRadio nickname | text |
| `freqA`, `freqB` | Current frequency | kHz |
| `bandA`, `bandB` | Band | band index |
| `bypassA`, `bypassB` | Channel bypassed | 1 = yes, 0 = no |
| `bypassRxA`, `bypassRxB` | Channel RX bypass enabled | 1 = yes, 0 = no |
| `antA`, `antB` | Antenna in use | 3WAY units, or SO2R integrated with an Antenna Genius |

### Info properties

| Property | Meaning |
|---|---|
| `name` | Device name with spaces (the nickname with `_` replaced by a space) |
| `nickname` | Device name as reported; `_` stands for a space |
| `serial` | Serial number |
| `version` | Firmware version, from the `info` reply |
| `firmware` | Firmware version, from the banner the device sends on connect |
| `authRequired` | `true` when the device asked for authentication (not supported yet) |
| `3way` | `1` on 3WAY units; not reported by SO2R units |

### Control actions

| Action | Payload | Effect |
|---|---|---|
| `operate` | `true`, `1`, `"1"` or `"on"` enables, anything else disables | Operate / standby |
| `bypass` | `true`, `1`, `"1"` or `"on"` enables, anything else disables | Bypass the tuner / put it in line |
| `activate` | 1-3 on 3WAY units, 1-2 on SO2R units | Select antenna 1-3 (3WAY), or channel 1 = A, 2 = B (SO2R). The variant is detected from `3way=1` in the `info` reply |
| `autotune` | ignored | Start autotuning on the selected channel |

## Commands used

`info`, `status`, `operate set=<0|1>`, `bypass set=<0|1>`, `activate ant=<1-3>` (3WAY) / `activate ch=<1-2>` (SO2R), `autotune`.

Commands are sent as `C<seq>|<command>` terminated by a bare LF (a trailing CR makes the device answer `Invalid command`). The device answers `R<seq>|<result>|<message>`, except for `status`, which is answered with an `S<n>|status key=value ...` line.

Not yet supported: UDP discovery (broadcast on port 9010), `auth` (authentication is only required when connecting from outside the local network) and the `M|<message>` warning/info lines.

## Example

An example flow is included. After installing, use **Import → Examples → node-red-contrib-tuner-genius** in the editor.
It shows one status node per property (`fwd`, `swr`, `state`), a status node for the whole object, the info node and
control nodes with inject buttons for operate, bypass, activate and autotune. Set the host of the
**tuner genius** server node to your tuner before deploying. The flow is in
[examples/tuner-genius-example.json](examples/tuner-genius-example.json).

## Install

    npm install node-red-contrib-tuner-genius
