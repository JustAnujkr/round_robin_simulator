const express = require("express");
const path = require("path");
const { execFile, spawn } = require("child_process");

const app = express();
const PORT = 3000;

const cFile = path.join(__dirname, "round_robin.c");
const executable = path.join(__dirname, "round_robin");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function compileCProgram() {
    return new Promise((resolve, reject) => {
        execFile(
            "gcc",
            ["-std=c11", "-Wall", "-Wextra", cFile, "-o", executable],
            (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || error.message));
                    return;
                }
                resolve();
            }
        );
    });
}

app.post("/simulate", async (req, res) => {
    try {
        const { processes, quantum } = req.body;

        if (!Array.isArray(processes) ||
            processes.length < 1 ||
            processes.length > 100) {
            return res.status(400).json({
                error: "Enter between 1 and 100 processes."
            });
        }

        if (!Number.isInteger(quantum) || quantum <= 0) {
            return res.status(400).json({
                error: "Time quantum must be a positive integer."
            });
        }

        const ids = new Set();

        for (const process of processes) {
            if (
                typeof process.pid !== "string" ||
                !/^[A-Za-z0-9_-]{1,31}$/.test(process.pid)
            ) {
                return res.status(400).json({
                    error: "Process IDs can contain letters, numbers, _ and - only."
                });
            }

            if (ids.has(process.pid)) {
                return res.status(400).json({
                    error: `Duplicate Process ID: ${process.pid}`
                });
            }

            ids.add(process.pid);

            if (
                !Number.isInteger(process.arrival) ||
                process.arrival < 0 ||
                process.arrival > 1000000
            ) {
                return res.status(400).json({
                    error: `Invalid arrival time for ${process.pid}.`
                });
            }

            if (
                !Number.isInteger(process.burst) ||
                process.burst <= 0 ||
                process.burst > 1000000
            ) {
                return res.status(400).json({
                    error: `Invalid burst time for ${process.pid}.`
                });
            }
        }

        await compileCProgram();

        const input = [
            processes.length,
            ...processes.map(p => `${p.pid} ${p.arrival} ${p.burst}`),
            quantum
        ].join("\n");

        const child = spawn(executable);

        let output = "";
        let errorOutput = "";
        let responded = false;

        const respond = (status, body) => {
            if (responded) return;
            responded = true;
            res.status(status).json(body);
        };

        child.stdout.on("data", data => {
            output += data.toString();
        });

        child.stderr.on("data", data => {
            errorOutput += data.toString();
        });

        child.on("error", error => {
            respond(500, { error: error.message });
        });

        child.on("close", code => {
            if (code !== 0) {
                respond(500, {
                    error: errorOutput || "C program execution failed."
                });
                return;
            }

            try {
                respond(200, JSON.parse(output));
            } catch (error) {
                respond(500, {
                    error: "Could not read the C program output.",
                    details: output
                });
            }
        });

        child.stdin.write(input);
        child.stdin.end();

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Round Robin Simulator running at http://localhost:${PORT}`);
});