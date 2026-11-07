# Round Robin CPU Scheduling Simulator

An interactive Operating Systems project that simulates the **Round Robin** CPU scheduling algorithm. The scheduling logic is written in **C**, a **Node.js (Express)** server compiles and runs it, and a browser front end shows the result as an animated simulation.

## Features

- Enter any number of processes (1 to 100) with **Process ID, Arrival Time and Burst Time**
- Adjustable **Time Quantum**
- Simulation **plays automatically** after you click *Simulate Scheduling*
- **Gantt chart** with idle blocks when the CPU waits for the next arrival
- **Context switch** monitor (previous process, next process, total count)
- **Execution timeline** table with remarks for every step
- **Logs** panel with timestamped scheduler events
- **Ready queue** and **remaining burst time** bars
- **Performance results** after the run: AT, BT, CT, TAT, WAT, AVG TAT and AVG WAT
- Play, Pause, Next Step, Reset and animation speed controls

## Project structure

```
round_robin_simulator/
├── server.js            # Express server: validates input, compiles and runs the C program
├── round_robin.c        # Round Robin scheduler used by the web app (outputs JSON)
├── round_robin_cli.c    # Optional: standalone terminal version (no Node.js needed)
├── package.json
└── public/
    ├── index.html
    ├── style.css
    └── script.js
```

## Requirements

- **Node.js** 18 or newer
- **gcc** (the server compiles the C program on every simulation)
  - macOS: run `xcode-select --install`
  - Ubuntu/Debian: `sudo apt install build-essential`
  - Windows: install MinGW-w64 or use WSL

Check that both are available:

```bash
node -v
gcc --version
```

## Installation

```bash
cd round_robin_simulator
npm install
```

## Running the project

Development mode (restarts automatically when files change):

```bash
npm run dev
```

Normal mode:

```bash
node server.js
```

Then open **http://localhost:3000** in your browser.

## How to use

1. Fill in the **Process ID**, **Arrival Time** and **Burst Time** for each process. Use **+ Add Process** for more rows. A blank arrival time counts as 0.
2. Enter the **Time Quantum**.
3. Click **Simulate Scheduling**. The simulation starts playing right away.
4. Use **Pause**, **Next Step**, **Reset** and the speed selector to control playback.
5. When the last step finishes, the **Performance Results** table appears.

### Input rules

| Field | Rule |
| --- | --- |
| Process ID | 1 to 31 characters: letters, numbers, `_` or `-`; must be unique |
| Arrival Time | Whole number, 0 to 1,000,000 ms |
| Burst Time | Whole number, 1 to 1,000,000 ms |
| Time Quantum | Whole number, 1 or more |
| Processes | 1 to 100 |

### Example

| Process | Arrival | Burst |
| --- | --- | --- |
| P1 | 0 | 5 |
| P2 | 2 | 4 |
| P3 | 20 | 3 |

With a quantum of **2**, the Gantt chart shows P1 and P2 alternating, an **IDLE** gap from 9 to 20 ms, then P3. Expected results: total time 23 ms, 5 context switches, AVG TAT 6.00 ms, AVG WAT 2.00 ms.

## How it works

1. The browser sends `POST /simulate` with `{ processes: [{ pid, arrival, burst }], quantum }`.
2. `server.js` validates the data, compiles `round_robin.c` with `gcc`, and sends the input to the program through stdin.
3. The C program runs Round Robin and prints the full result as **JSON** (steps, total time, context switches).
4. The server returns that JSON and the front end animates it.

### Scheduling rules

- A process joins the ready queue only after its arrival time has been reached.
- If no process is ready, the clock jumps to the next arrival (shown as an IDLE block).
- Processes that arrive during a time slice are queued **before** the preempted process returns to the end of the queue.
- The first CPU allocation is not counted as a context switch.

### Formulas

- **CT** (Completion Time): time at which the process finishes
- **TAT** (Turnaround Time) = CT − AT
- **WAT** (Waiting Time) = TAT − BT

### API response format

```json
{
  "quantum": 2,
  "steps": [
    {
      "pid": "P1",
      "previousPid": null,
      "contextSwitch": false,
      "start": 0,
      "end": 2,
      "duration": 2,
      "remaining": 3,
      "completed": false,
      "remarks": "Time quantum expired; process moved to ready queue",
      "queue": ["P2", "P1"]
    }
  ],
  "totalTime": 23,
  "contextSwitches": 5,
  "processes": [{ "pid": "P1", "arrival": 0, "burst": 5, "remaining": 0 }]
}
```

## Terminal-only version

`round_robin_cli.c` is a standalone program with the same scheduling logic. It prints the logs, execution timeline, ASCII Gantt chart and results in the terminal.

```bash
gcc -std=c11 -Wall -Wextra round_robin_cli.c -o round_robin_cli
./round_robin_cli
```

You can also feed it a text file of inputs: `./round_robin_cli < input.txt`.

## Sharing the project

The server must be running for the app to work, so it cannot be opened as a plain static file.

- **Same Wi-Fi:** find your IP (`ipconfig getifaddr en0` on macOS) and open `http://YOUR-IP:3000` on the other device.
- **Public link:** in VS Code, open the **Ports** tab, forward port `3000` and set its visibility to **Public**.
- **Permanent hosting:** deploy with Docker on a service such as Render or Railway. Use a Node image (it includes `gcc`) and read the port from `process.env.PORT`.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Could not read the C program output` | Check the terminal running the server; make sure `round_robin.c` and `server.js` are the latest versions |
| `gcc: command not found` | Install gcc (see Requirements) and restart the terminal |
| Port 3000 already in use | Stop the other process or change `PORT` in `server.js` |
| Page loads but Simulate fails | Open the server terminal and read the error message printed there |
| Style or layout looks old | Hard refresh the browser (`Cmd+Shift+R` or `Ctrl+Shift+R`) |

## Tech stack

- C (scheduling algorithm)
- Node.js and Express (server)
- HTML, CSS and vanilla JavaScript (front end)