const processTable = document.getElementById("processTable");
const addProcessBtn = document.getElementById("addProcessBtn");
const simulateBtn = document.getElementById("simulateBtn");

const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nextBtn = document.getElementById("nextBtn");
const resetBtn = document.getElementById("resetBtn");

const quantumInput = document.getElementById("quantum");
const speedSelect = document.getElementById("speedSelect");

let simulationData = null;
let originalProcesses = [];
let currentStep = -1;
let animationTimer = null;

// Add a process row
function addProcessRow(pid = "", arrival = "", burst = "") {
    const row = document.createElement("tr");

    row.innerHTML = `
        <td>
            <input type="text" class="pid-input"
                   maxlength="31" placeholder="Process ID">
        </td>
        <td>
            <input type="number" class="arrival-input"
                   min="0" placeholder="Arrival Time">
        </td>
        <td>
            <input type="number" class="burst-input"
                   min="1" placeholder="Burst Time">
        </td>
        <td>
            <button class="remove-btn">×</button>
        </td>
    `;

    row.querySelector(".pid-input").value = pid;
    row.querySelector(".arrival-input").value = arrival;
    row.querySelector(".burst-input").value = burst;

    processTable.appendChild(row);
    updateRemoveButtons();
}

// Update remove button states
function updateRemoveButtons() {
    const rows = processTable.querySelectorAll("tr");
    const buttons = processTable.querySelectorAll(".remove-btn");

    buttons.forEach(button => {
        button.disabled = rows.length === 1;
    });
}

// Add process button
addProcessBtn.addEventListener("click", () => {
    if (processTable.querySelectorAll("tr").length >= 100) {
        showError("Maximum 100 processes are allowed.");
        return;
    }

    const nextNumber = processTable.querySelectorAll("tr").length + 1;
    addProcessRow(`P${nextNumber}`, "", "");
});

// Remove process button
processTable.addEventListener("click", event => {
    if (event.target.classList.contains("remove-btn")) {
        if (processTable.querySelectorAll("tr").length > 1) {
            event.target.closest("tr").remove();
            updateRemoveButtons();
        }
    }
});

// Display errors
function showError(message) {
    document.getElementById("errorMessage").textContent = message;
}

// Clear errors
function clearError() {
    document.getElementById("errorMessage").textContent = "";
}

// Read and validate process input
function getProcessInputs() {
    const rows = [...processTable.querySelectorAll("tr")];
    const processes = [];
    const usedIds = new Set();

    for (let i = 0; i < rows.length; i++) {
        const pid = rows[i].querySelector(".pid-input")
            .value.trim();

        const arrivalValue = rows[i].querySelector(".arrival-input")
            .value.trim();

        const burstValue = rows[i].querySelector(".burst-input")
            .value.trim();

        // A blank arrival time counts as 0
        const arrival = arrivalValue === "" ? 0 : Number(arrivalValue);
        const burst = Number(burstValue);

        if (!/^[A-Za-z0-9_-]{1,31}$/.test(pid)) {
            throw new Error(
                `Invalid Process ID in row ${i + 1}. Use letters, numbers, _ or - only.`
            );
        }

        if (usedIds.has(pid)) {
            throw new Error(`Duplicate Process ID: ${pid}`);
        }

        if (
            !Number.isInteger(arrival) ||
            arrival < 0 ||
            arrival > 1000000
        ) {
            throw new Error(
                `Enter a valid arrival time (0 or more) for ${pid}.`
            );
        }

        if (
            burstValue === "" ||
            !Number.isInteger(burst) ||
            burst <= 0 ||
            burst > 1000000
        ) {
            throw new Error(
                `Enter a valid positive burst time for ${pid}.`
            );
        }

        usedIds.add(pid);
        processes.push({ pid, arrival, burst });
    }

    return processes;
}

// Simulate scheduling using the C backend
simulateBtn.addEventListener("click", async () => {
    stopAnimation();
    clearError();

    try {
        const processes = getProcessInputs();
        const quantum = Number(quantumInput.value);

        if (
            quantumInput.value.trim() === "" ||
            !Number.isInteger(quantum) ||
            quantum <= 0
        ) {
            throw new Error("Time quantum must be a positive integer.");
        }

        simulateBtn.disabled = true;
        simulateBtn.textContent = "COMPILING AND SIMULATING...";

        const response = await fetch("/simulate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                processes,
                quantum
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Simulation failed.");
        }

        simulationData = result;
        originalProcesses = processes.map(p => ({
            pid: p.pid,
            arrival: p.arrival,
            burst: p.burst
        }));

        currentStep = -1;

        updateStatistics();
        renderInitialState();
        updateControlButtons();

        document.getElementById("completionMessage").textContent =
            "Simulation running...";
        document.getElementById("completionMessage")
            .classList.remove("done");

        // Start playing automatically
        playAnimation();

    } catch (error) {
        showError(error.message);
    } finally {
        simulateBtn.disabled = false;
        simulateBtn.innerHTML = "<span>▶</span> SIMULATE SCHEDULING";
    }
});

// Update top statistics
function updateStatistics() {
    document.getElementById("totalProcesses").textContent =
        originalProcesses.length;

    document.getElementById("totalTime").innerHTML =
        `${simulationData.totalTime} <small>ms</small>`;

    document.getElementById("totalContextSwitches").textContent =
        simulationData.contextSwitches;

    document.getElementById("displayQuantum").innerHTML =
        `${simulationData.quantum} <small>ms</small>`;
}

// Render initial simulation state
function renderInitialState() {
    document.getElementById("resultsSection").classList.add("hidden");
    document.getElementById("cpuProcess").textContent = "IDLE";
    document.getElementById("cpuStatus").textContent =
        "Waiting for simulation";

    document.getElementById("previousProcess").textContent = "---";
    document.getElementById("nextProcess").textContent = "---";
    document.getElementById("switchIcon").textContent = "→";
    document.getElementById("switchTime").textContent = "Waiting";
    document.getElementById("contextCount").textContent = "0";

    const contextRemark = document.getElementById("contextRemark");
    contextRemark.textContent =
        "Context-switch information will appear during execution.";
    contextRemark.className = "context-remark";

    renderGantt();
    renderTimeline();
    renderReadyQueue();
    renderRemainingTimes();
    renderLogs();

    document.getElementById("completionMessage").textContent =
        "Simulation ready. Start execution to see the scheduling process.";
    document.getElementById("completionMessage")
        .classList.remove("done");
}

// Calculate the remaining burst time at a given step
function getRemainingTimes(stepIndex) {
    const remaining = {};

    originalProcesses.forEach(process => {
        remaining[process.pid] = process.burst;
    });

    if (stepIndex < 0) {
        return remaining;
    }

    for (let i = 0; i <= stepIndex; i++) {
        const step = simulationData.steps[i];
        remaining[step.pid] -= step.duration;
    }

    return remaining;
}

// Render ready queue
function renderReadyQueue() {
    const container = document.getElementById("readyQueue");
    container.innerHTML = "";

    let queue;

    if (currentStep < 0) {
        // Before the simulation starts, show the processes that arrive at time 0
        // (or all processes if none arrive at 0), ordered by arrival time.
        queue = [...originalProcesses]
            .sort((a, b) => a.arrival - b.arrival)
            .map(p => p.pid);
    } else {
        queue = simulationData.steps[currentStep].queue;
    }

    if (!queue || queue.length === 0) {
        container.innerHTML =
            '<span class="empty-text">All processes completed</span>';
        return;
    }

    queue.forEach(pid => {
        const item = document.createElement("span");
        item.className = "queue-item";
        item.textContent = pid;
        container.appendChild(item);
    });
}

// Render remaining burst times
function renderRemainingTimes() {
    const container = document.getElementById("remainingTimes");
    container.innerHTML = "";

    const remaining = getRemainingTimes(currentStep);

    originalProcesses.forEach(process => {
        const time = remaining[process.pid];
        const percentage = (time / process.burst) * 100;

        const item = document.createElement("div");
        item.className = "remaining-item";

        if (time === 0) {
            item.classList.add("completed");
        }

        const top = document.createElement("div");
        top.className = "remaining-item";

        const pid = document.createElement("span");
        pid.textContent = `${process.pid} (arrival ${process.arrival} ms)`;

        const value = document.createElement("strong");
        value.textContent = `${time} ms`;

        top.appendChild(pid);
        top.appendChild(value);

        const bar = document.createElement("div");
        bar.className = "remaining-bar";

        const fill = document.createElement("div");
        fill.className = "remaining-fill";
        fill.style.width = `${percentage}%`;

        bar.appendChild(fill);
        item.appendChild(top);
        item.appendChild(bar);

        container.appendChild(item);
    });
}

// Render Gantt chart
function renderGantt() {
    const container = document.getElementById("ganttChart");
    container.innerHTML = "";

    if (!simulationData || simulationData.steps.length === 0) {
        container.innerHTML =
            '<div class="gantt-placeholder">No execution data available</div>';
        return;
    }

    const totalTime = simulationData.totalTime;

    simulationData.steps.forEach((step, index) => {
        const block = document.createElement("div");
        block.className = "gantt-item";

        if (index === currentStep) {
            block.classList.add("active");
        }

        // Width is proportional to execution duration.
        // Minimum width keeps small segments readable.
        const proportionalWidth =
            totalTime > 0
                ? (step.duration / totalTime) * 850
                : 65;

        block.style.width =
            `${Math.max(65, proportionalWidth)}px`;

        block.style.opacity =
            index > currentStep ? "0.38" : "1";

        const label = document.createElement("span");
        label.textContent = step.pid;
        block.appendChild(label);

        // Each boundary is labelled only once, centred on the line
        // between blocks. Start label on every block...
        const start = document.createElement("span");
        start.className = "gantt-time gantt-start";
        start.textContent = step.start;
        block.appendChild(start);

        // ...end label only on the last block, or before an idle gap
        const nextStepData = simulationData.steps[index + 1];
        if (!nextStepData || nextStepData.start !== step.end) {
            const end = document.createElement("span");
            end.className = "gantt-time gantt-end";
            end.textContent = step.end;
            block.appendChild(end);
        }

        // Visible idle block when the CPU waited for the next arrival
        const previousStep = simulationData.steps[index - 1];
        if (previousStep && step.start > previousStep.end) {
            const idle = document.createElement("div");
            idle.className = "gantt-item gantt-idle";
            idle.style.width = `${Math.max(
                65,
                ((step.start - previousStep.end) / totalTime) * 850
            )}px`;
            idle.style.opacity = index > currentStep ? "0.38" : "1";
            idle.textContent = "IDLE";
            container.appendChild(idle);
        }

        container.appendChild(block);
    });
}

// Render context-switch details
function renderContextSwitch(step) {
    const previous = step.previousPid || "NONE";
    const next = step.pid;

    document.getElementById("previousProcess").textContent = previous;
    document.getElementById("nextProcess").textContent = next;
    document.getElementById("switchIcon").textContent = "→";

    document.getElementById("switchTime").textContent =
        `${step.start} ms`;

    const switchesSoFar = simulationData.steps
        .slice(0, currentStep + 1)
        .filter(item => item.contextSwitch).length;

    document.getElementById("contextCount").textContent =
        switchesSoFar;

    const remark = document.getElementById("contextRemark");

    if (step.contextSwitch) {
        remark.textContent =
            `Context switch: CPU changes from ${previous} to ${next} at ${step.start} ms.`;
        remark.className = "context-remark switch";
    } else if (currentStep === 0) {
        remark.textContent =
            `Initial CPU allocation: ${next} gets the CPU at ${step.start} ms. This is not counted as a context switch.`;
        remark.className = "context-remark";
    } else {
        remark.textContent =
            `${next} continues execution after its previous time slice. No process change occurred.`;
        remark.className = "context-remark same";
    }

    if (step.completed) {
        remark.textContent += ` ${next} has completed execution.`;
    } else {
        remark.textContent +=
            ` Remaining burst time: ${step.remaining} ms.`;
    }
}

// Render execution timeline
function renderTimeline() {
    const tbody = document.getElementById("timelineBody");
    tbody.innerHTML = "";

    if (currentStep < 0) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td colspan="7" class="empty-row">
                Execution details will appear here.
            </td>
        `;
        tbody.appendChild(row);
        return;
    }

    simulationData.steps.slice(0, currentStep + 1)
        .forEach((step, index) => {
            const row = document.createElement("tr");

            if (index === currentStep) {
                row.classList.add("active-row");
            }

            const contextText = step.contextSwitch
                ? `Context switch from ${step.previousPid}`
                : index === 0
                    ? "Initial CPU allocation"
                    : "No process change";

            const executionText = step.completed
                ? "Process completed"
                : "Time quantum expired; re-entered ready queue";

            const remarks = `${contextText}. ${executionText}.`;

            const values = [
                index + 1,
                step.pid,
                `${step.start} ms`,
                `${step.end} ms`,
                `${step.duration} ms`,
                `${step.remaining} ms`,
                remarks
            ];

            values.forEach((value, cellIndex) => {
                const cell = document.createElement("td");
                cell.textContent = value;

                if (cellIndex === 6) {
                    cell.classList.add("remark-cell");
                }

                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });
}

// Render scheduler logs (newest event first)
function renderLogs() {
    const box = document.getElementById("logsBox");
    box.innerHTML = "";

    if (!simulationData || currentStep < 0) {
        box.innerHTML =
            '<div class="log-line log-empty">Logs will appear here during execution.</div>';
        return;
    }

    const events = [];

    for (let i = 0; i <= currentStep; i++) {
        const step = simulationData.steps[i];

        if (i > 0 && step.start > simulationData.steps[i - 1].end) {
            events.push({
                time: simulationData.steps[i - 1].end,
                type: "idle",
                text: `CPU idle until ${step.start} ms (no process ready)`
            });
        }

        if (step.contextSwitch) {
            events.push({
                time: step.start,
                type: "switch",
                text: `Context switch: ${step.previousPid} -> ${step.pid}`
            });
        }

        events.push({
            time: step.start,
            type: "running",
            text: `${step.pid} running for ${step.duration} ms`
        });

        events.push({
            time: step.end,
            type: step.completed ? "completed" : "preempted",
            text: step.completed
                ? `${step.pid} completed`
                : `${step.pid} preempted (${step.remaining} ms left)`
        });
    }

    if (currentStep === simulationData.steps.length - 1) {
        events.push({
            time: simulationData.totalTime,
            type: "final",
            text: "-> Scheduling complete."
        });
    }

    events.reverse().forEach(event => {
        const line = document.createElement("div");
        line.className = `log-line ${event.type}`;

        const time = document.createElement("span");
        time.className = "log-time";
        time.textContent = `[t=${event.time} ms] `;

        const msg = document.createElement("span");
        msg.className = "log-msg";
        msg.textContent = event.text;

        line.appendChild(time);
        line.appendChild(msg);
        box.appendChild(line);
    });
}

// Execute the next scheduling step
function nextStep() {
    if (!simulationData) return;

    if (currentStep >= simulationData.steps.length - 1) {
        finishSimulation();
        return;
    }

    currentStep++;

    const step = simulationData.steps[currentStep];

    document.getElementById("cpuProcess").textContent = step.pid;
    document.getElementById("cpuStatus").textContent =
        `Executing from ${step.start} ms to ${step.end} ms`;

    renderGantt();
    renderContextSwitch(step);
    renderTimeline();
    renderReadyQueue();
    renderRemainingTimes();
    renderLogs();

    updateControlButtons();

    if (currentStep === simulationData.steps.length - 1) {
        finishSimulation();
    }
}

// Finish simulation
function finishSimulation() {
    stopAnimation();

    document.getElementById("cpuProcess").textContent = "COMPLETED";
    document.getElementById("cpuStatus").textContent =
        `All processes finished at ${simulationData.totalTime} ms`;

    document.getElementById("completionMessage").textContent =
        `Simulation completed successfully. Total execution time: ${simulationData.totalTime} ms. Context switches: ${simulationData.contextSwitches}.`;

    document.getElementById("completionMessage")
        .classList.add("done");

    renderResults();
    updateControlButtons();
}

// Render AT / BT / CT / TAT / WAT table with averages
function renderResults() {
    const tbody = document.getElementById("resultsBody");
    tbody.innerHTML = "";

    let totalTat = 0;
    let totalWat = 0;

    originalProcesses.forEach(process => {
        // Completion time = end of the step where this process completed
        const lastStep = simulationData.steps
            .filter(s => s.pid === process.pid && s.completed)
            .pop();

        const ct = lastStep ? lastStep.end : 0;
        const tat = ct - process.arrival;
        const wat = tat - process.burst;

        totalTat += tat;
        totalWat += wat;

        const row = document.createElement("tr");

        [process.pid, process.arrival, process.burst, ct, tat, wat]
            .forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

        tbody.appendChild(row);
    });

    const count = originalProcesses.length;

    document.getElementById("avgTat").textContent =
        (totalTat / count).toFixed(2);
    document.getElementById("avgWat").textContent =
        (totalWat / count).toFixed(2);

    document.getElementById("resultsSection")
        .classList.remove("hidden");
}

// Play animation
function playAnimation() {
    if (!simulationData) return;

    if (currentStep >= simulationData.steps.length - 1) {
        return;
    }

    stopAnimation();

    animationTimer = setInterval(() => {
        if (currentStep < simulationData.steps.length - 1) {
            nextStep();
        } else {
            stopAnimation();
        }
    }, Number(speedSelect.value));

    updateControlButtons();
}

// Pause animation
function pauseAnimation() {
    stopAnimation();
    updateControlButtons();
}

// Stop timer
function stopAnimation() {
    if (animationTimer !== null) {
        clearInterval(animationTimer);
        animationTimer = null;
    }
}

// Reset animation to the beginning
function resetSimulation() {
    stopAnimation();

    if (!simulationData) return;

    currentStep = -1;
    renderInitialState();
    updateControlButtons();
}

// Update control button states
function updateControlButtons() {
    const hasData = Boolean(simulationData);
    const finished = hasData &&
        currentStep >= simulationData.steps.length - 1;

    playBtn.disabled = !hasData || finished || animationTimer !== null;
    pauseBtn.disabled = !hasData || animationTimer === null;
    nextBtn.disabled = !hasData || finished;
    resetBtn.disabled = !hasData;
}

// Button events
playBtn.addEventListener("click", playAnimation);
pauseBtn.addEventListener("click", pauseAnimation);
nextBtn.addEventListener("click", () => {
    stopAnimation();
    nextStep();
});
resetBtn.addEventListener("click", resetSimulation);

// Change animation speed while playing
speedSelect.addEventListener("change", () => {
    if (animationTimer !== null) {
        playAnimation();
    }
});

// Initial button state
updateRemoveButtons();
updateControlButtons();