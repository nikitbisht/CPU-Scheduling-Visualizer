let processes = [];
let pidCounter = 1;

const resultsSection = document.querySelector(".results-section");
resultsSection.style.display = "none";

document.getElementById("algorithm").addEventListener("change", (e) => {
  const algo = e.target.value;
  document.getElementById("quantum-section").style.display = algo === "rr" ? "block" : "none";

  const priorityInputs = document.querySelectorAll(".priority");
  priorityInputs.forEach(input => {
    input.style.display = algo === "priority" ? "inline-block" : "none";
  });

  const priorityHeaders = document.querySelectorAll("#process-table thead th");
  priorityHeaders[3].style.display = algo === "priority" ? "table-cell" : "none";

  const priorityCells = document.querySelectorAll(".priority-cell");
  priorityCells.forEach(cell => {
    cell.style.display = algo === "priority" ? "table-cell" : "none";
  });
});

function removeLastProcess() {
  const table = document.getElementById("process-body");
  if (table.rows.length > 0) {
    table.deleteRow(table.rows.length - 1);
    pidCounter--;
  }
}

function addProcess() {
  const table = document.getElementById("process-body");
  const row = document.createElement("tr");

  const pid = pidCounter++;
  row.innerHTML = `
    <td>${pid}</td>
    <td><input type="number" min="0" class="at" /></td>
    <td><input type="number" min="1" class="bt" /></td>
    <td class="priority-cell" style="display:none;"><input type="number" min="0" class="priority" /></td>
  `;

  table.appendChild(row);

  document.getElementById("algorithm").dispatchEvent(new Event("change"));
}

function computeSchedule() {
  resultsSection.style.display = "block";
  processes = [];
  const rows = document.querySelectorAll("#process-body tr");

  rows.forEach((row, i) => {
    const at = parseInt(row.querySelector(".at").value);
    const bt = parseInt(row.querySelector(".bt").value);
    const priorityInput = row.querySelector(".priority");
    const priority = priorityInput && priorityInput.offsetParent !== null ? parseInt(priorityInput.value) || 0 : 0;
    processes.push({ pid: i + 1, at, bt, priority });
  });

  const algo = document.getElementById("algorithm").value;
  const quantum = parseInt(document.getElementById("quantum").value) || 2;

  let results = [];
  let gantt = [];

  if (algo === "fcfs") {
    ({ results, gantt, cpuUtil, throughput } = fcfs(processes));
  } else if (algo === "sjf") {
    ({ results, gantt, cpuUtil, throughput } = sjf(processes));
  } else if (algo === "srtf") {
    ({ results, gantt, cpuUtil, throughput } = srtf(processes));
  } else if (algo === "rr") {
    ({ results, gantt, cpuUtil, throughput } = roundRobin(processes, quantum));
  } else if (algo === "priority") {
    ({ results, gantt, cpuUtil, throughput } = priorityScheduling(processes));
  }

  displayResults(results, cpuUtil, throughput);
  drawGantt(gantt);
}

function displayResults(results,cpuUtil, throughput) {
  const body = document.getElementById("results-body");
  body.innerHTML = "";

  let totalTAT = 0, totalWT = 0, totalRT = 0;
  results.forEach(p => {
    const row = `<tr>
      <td>${p.pid}</td>
      <td>${p.tat}</td>
      <td>${p.wt}</td>
      <td>${p.rt}</td>
      <td>${p.start}</td>
      <td>${p.ct}</td>
    </tr>`;
    totalTAT += p.tat;
    totalWT += p.wt;
    totalRT += p.rt;
    body.innerHTML += row;
  });

  const n = results.length;
  document.getElementById("cpu-util").textContent = cpuUtil;
  document.getElementById("throughput").textContent = throughput;
}


function drawGantt(gantt) {
  const chart = document.getElementById("gantt-chart");
  chart.innerHTML = "";

  const unitWidth = 20; 

  let i = 0;

  function showBlock() {
    if (i >= gantt.length) return;

    const block = gantt[i];
    const div = document.createElement("div");
    div.className = "gantt-block";
    let width = (block.end - block.start) * unitWidth;
    if(width < 60 ){
      div.style.width = 60 + "px";
    }else{
      div.style.width = width + "px";
    }
    chart.appendChild(div);

    let currentTime = block.start;

    function countTime() {
      if (currentTime <= block.end) {
        div.innerHTML = `
          <div>P${block.pid}</div>
          <div style="font-size: 1em; color: red;">
            ${block.start} - ${currentTime}
          </div>`;
        currentTime++;
        setTimeout(countTime, 500);  
      } else {
        i++;
        showBlock();  
      }
    }

    countTime();
  }

  showBlock();
}


function calculateMetrics(results) {
  const totalBurstTime = results.reduce((sum, p) => sum + p.bt, 0);
  const earliestArrival = Math.min(...results.map(p => p.at));
  const latestCompletion = Math.max(...results.map(p => p.ct));
  const totalTime = latestCompletion - earliestArrival;

  const cpuUtil = ((totalBurstTime / totalTime) * 100).toFixed(2);
  const throughput = (results.length / totalTime).toFixed(2);

  return { cpuUtil, throughput };
}

function fcfs(processes) {
  const sorted = [...processes].sort((a, b) => a.at - b.at);
  let time = 0;
  let results = [], gantt = [];

  sorted.forEach(p => {
    if (time < p.at) time = p.at;
    const start = time;
    const end = start + p.bt;
    results.push({
      pid: p.pid,
      tat: end - p.at,
      wt: start - p.at,
      rt: start - p.at,
      ct: end,
      bt: p.bt,
      at: p.at,
      start
    });
    gantt.push({ pid: p.pid, start, end });
    time = end;
  });

  const { cpuUtil, throughput } = calculateMetrics(results);
  return { results, gantt, cpuUtil, throughput };
}

function sjf(processes) {
  const sorted = [...processes].sort((a, b) => a.at - b.at);
  let time = 0;
  let completed = 0;
  const n = sorted.length;
  let results = [];
  let gantt = [];
  const isCompleted = new Array(n).fill(false);

  while (completed < n) {
    let idx = -1;
    let minBt = Infinity;

    for (let i = 0; i < n; i++) {
      if (sorted[i].at <= time && !isCompleted[i] && sorted[i].bt < minBt) {
        minBt = sorted[i].bt;
        idx = i;
      }
    }

    if (idx === -1) {
      time++;
      continue;
    }

    const p = sorted[idx];
    const start = time;
    const end = start + p.bt;

    results.push({
      pid: p.pid,
      tat: end - p.at,
      wt: start - p.at,
      rt: start - p.at,
      ct: end,
      bt: p.bt,
      at: p.at,
      start,
    });

    gantt.push({ pid: p.pid, start, end });

    time = end;
    isCompleted[idx] = true;
    completed++;
  }

  results.sort((a, b) => a.pid - b.pid);
  const { cpuUtil, throughput } = calculateMetrics(results);
  return { results, gantt, cpuUtil, throughput };
}

function srtf(processes) {
  const n = processes.length;
  const sorted = [...processes].sort((a, b) => a.at - b.at);
  let time = 0;
  let completed = 0;
  let remainingBT = sorted.map(p => p.bt);
  let isStarted = new Array(n).fill(false);
  let startTime = new Array(n).fill(0);
  let completionTime = new Array(n).fill(0);
  let gantt = [];
  let prevProcess = -1;

  while (completed < n) {
    let idx = -1;
    let minRemBT = Infinity;

    for (let i = 0; i < n; i++) {
      if (sorted[i].at <= time && remainingBT[i] > 0 && remainingBT[i] < minRemBT) {
        minRemBT = remainingBT[i];
        idx = i;
      }
    }

    if (idx === -1) {
      time++;
      prevProcess = -1;
      continue;
    }

    if (prevProcess !== idx) {
      if (prevProcess !== -1) {
        gantt[gantt.length - 1].end = time;
      }
      gantt.push({ pid: sorted[idx].pid, start: time, end: null });
      if (!isStarted[idx]) {
        startTime[idx] = time;
        isStarted[idx] = true;
      }
    }

    remainingBT[idx]--;
    time++;
    prevProcess = idx;

    if (remainingBT[idx] === 0) {
      completionTime[idx] = time;
      completed++;
      gantt[gantt.length - 1].end = time;
    }
  }

  let results = [];
  for (let i = 0; i < n; i++) {
    const tat = completionTime[i] - sorted[i].at;
    const wt = tat - sorted[i].bt;
    const rt = startTime[i] - sorted[i].at;
    results.push({
      pid: sorted[i].pid,
      tat,
      wt,
      rt,
      ct: completionTime[i],
      bt: sorted[i].bt,
      at: sorted[i].at,
      start: startTime[i],
    });
  }

  results.sort((a, b) => a.pid - b.pid);
  const { cpuUtil, throughput } = calculateMetrics(results);
  return { results, gantt, cpuUtil, throughput };
}

function roundRobin(processes, quantum) {
  const n = processes.length;
  const sorted = [...processes].sort((a, b) => a.at - b.at);
  let time = 0;
  let remainingBT = sorted.map(p => p.bt);
  let completed = 0;
  let queue = [];
  let visited = new Array(n).fill(false);
  let startTime = new Array(n).fill(-1);
  let completionTime = new Array(n).fill(0);
  let gantt = [];

  for (let i = 0; i < n; i++) {
    if (sorted[i].at <= time) {
      queue.push(i);
      visited[i] = true;
    }
  }

  while (completed < n) {
    if (queue.length === 0) {
      time++;
      for (let i = 0; i < n; i++) {
        if (!visited[i] && sorted[i].at <= time) {
          queue.push(i);
          visited[i] = true;
        }
      }
      continue;
    }

    const idx = queue.shift();

    if (startTime[idx] === -1) startTime[idx] = time;

    const execTime = Math.min(quantum, remainingBT[idx]);
    gantt.push({ pid: sorted[idx].pid, start: time, end: time + execTime });

    remainingBT[idx] -= execTime;
    time += execTime;

    for (let i = 0; i < n; i++) {
      if (!visited[i] && sorted[i].at <= time) {
        queue.push(i);
        visited[i] = true;
      }
    }

    if (remainingBT[idx] > 0) {
      queue.push(idx);
    } else {
      completed++;
      completionTime[idx] = time;
    }
  }

  let results = [];
  for (let i = 0; i < n; i++) {
    const tat = completionTime[i] - sorted[i].at;
    const wt = tat - sorted[i].bt;
    const rt = startTime[i] - sorted[i].at;
    results.push({
      pid: sorted[i].pid,
      tat,
      wt,
      rt,
      ct: completionTime[i],
      bt: sorted[i].bt,
      at: sorted[i].at,
      start: startTime[i],
    });
  }

  results.sort((a, b) => a.pid - b.pid);
  const { cpuUtil, throughput } = calculateMetrics(results);
  return { results, gantt, cpuUtil, throughput };
}

function priorityScheduling(processes) {
  const sorted = [...processes].sort((a, b) => a.at - b.at);
  const n = sorted.length;
  let time = 0;
  let completed = 0;
  let results = [];
  let gantt = [];

  const isCompleted = new Array(n).fill(false);

  while (completed < n) {
    let idx = -1;
    let highestPriority = Infinity;

    for (let i = 0; i < n; i++) {
      if (sorted[i].at <= time && !isCompleted[i]) {
        if (sorted[i].priority < highestPriority) {
          highestPriority = sorted[i].priority;
          idx = i;
        } else if (sorted[i].priority === highestPriority) {
          if (sorted[i].at < sorted[idx].at) {
            idx = i;
          }
        }
      }
    }

    if (idx === -1) {
      time++;
      continue;
    }

    const p = sorted[idx];
    const start = time;
    const end = start + p.bt;

    results.push({
      pid: p.pid,
      tat: end - p.at,
      wt: start - p.at,
      rt: start - p.at,
      ct: end,
      bt: p.bt,
      at: p.at,
      start,
    });

    gantt.push({ pid: p.pid, start, end });

    time = end;
    isCompleted[idx] = true;
    completed++;
  }

  results.sort((a, b) => a.pid - b.pid);
  const { cpuUtil, throughput } = calculateMetrics(results);
  return { results, gantt, cpuUtil, throughput };
}
