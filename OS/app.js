// Global variables
let processes = [];
const processTable = document.getElementById('processTable').querySelector('tbody');
const ganttChart = document.getElementById('ganttChart');
const timeGraph = document.getElementById('timeGraph');
const avgMetrics = document.getElementById('avgMetrics');
const readyQueue = document.getElementById('readyQueue');
const resultsTable = document.getElementById('resultsTable').querySelector('tbody');

// Create tooltip div
const tooltip = document.createElement('div');
tooltip.className = 'tooltip';
document.body.appendChild(tooltip);

// Mouse move handler for tooltip
function showTooltip(e, text) {
  tooltip.style.display = 'block';
  tooltip.style.left = (e.pageX + 10) + 'px';
  tooltip.style.top = (e.pageY - 20) + 'px';
  tooltip.textContent = text;
}

function hideTooltip() {
  tooltip.style.display = 'none';
}

// Helper functions for SVG creation
function createAxisLabel(text, x, y, isYAxis = false) {
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.textContent = text;
  label.setAttribute('x', x.toString());
  label.setAttribute('y', y.toString());
  label.setAttribute('fill', '#374151');
  label.setAttribute('font-size', '12');
  if (isYAxis) {
    label.setAttribute('transform', `rotate(-90 ${x} ${y})`);
    label.setAttribute('text-anchor', 'middle');
  } else {
    label.setAttribute('text-anchor', 'middle');
  }
  return label;
}

function createTickMark(x, y, isYAxis = false) {
  const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  if (isYAxis) {
    tick.setAttribute('x1', (x - 5).toString());
    tick.setAttribute('x2', (x + 5).toString());
    tick.setAttribute('y1', y.toString());
    tick.setAttribute('y2', y.toString());
  } else {
    tick.setAttribute('x1', x.toString());
    tick.setAttribute('x2', x.toString());
    tick.setAttribute('y1', (y - 5).toString());
    tick.setAttribute('y2', (y + 5).toString());
  }
  tick.setAttribute('stroke', '#374151');
  tick.setAttribute('stroke-width', '1');
  return tick;
}

function createTickLabel(text, x, y, isYAxis = false) {
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.textContent = text;
  label.setAttribute('x', x.toString());
  label.setAttribute('y', y.toString());
  label.setAttribute('fill', '#374151');
  label.setAttribute('font-size', '10');
  label.setAttribute('text-anchor', isYAxis ? 'end' : 'middle');
  label.setAttribute('dominant-baseline', isYAxis ? 'middle' : 'hanging');
  return label;
}

function createGridLine(direction, startX, startY, length) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', startX.toString());
  line.setAttribute('y1', startY.toString());
  if (direction === 'vertical') {
    line.setAttribute('x2', startX.toString());
    line.setAttribute('y2', length.toString());
  } else {
    line.setAttribute('x2', length.toString());
    line.setAttribute('y2', startY.toString());
  }
  line.setAttribute('stroke', '#e5e7eb');
  line.setAttribute('stroke-width', '1');
  line.setAttribute('stroke-dasharray', '2,2');
  return line;
}

function createLine(data, color, maxY, width, height) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const xStep = width / (data.length - 1);
  
  const pathData = data.map((point, index) => {
    const x = index * xStep;
    const y = height - (point.y / maxY * height);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  line.setAttribute('d', pathData);
  line.setAttribute('stroke', color);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('class', 'data-line');
  group.appendChild(line);

  data.forEach((point, index) => {
    const x = index * xStep;
    const y = height - (point.y / maxY * height);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    
    circle.setAttribute('cx', x.toString());
    circle.setAttribute('cy', y.toString());
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', color);
    circle.setAttribute('class', 'data-point');
    
    circle.addEventListener('mousemove', (e) => {
      const tooltipText = `${point.y.toFixed(2)} time units`;
      showTooltip(e, tooltipText);
    });
    circle.addEventListener('mouseout', hideTooltip);
    
    group.appendChild(circle);
  });

  return group;
}

// Process management functions
function addProcess() {
  const id = document.getElementById('id').value;
  const arrival = parseInt(document.getElementById('arrival').value);
  const burst = parseInt(document.getElementById('burst').value);
  const priority = parseInt(document.getElementById('priority').value);
  const algorithm = document.getElementById('algorithm').value;

  if (!id || isNaN(arrival) || isNaN(burst)) {
    alert('Please fill Process ID, Arrival Time, and Burst Time fields with valid values');
    return;
  }

  if (algorithm === 'Priority' && isNaN(priority)) {
    alert('Priority value is required for Priority scheduling');
    return;
  }

  processes.push({ id, arrival, burst, priority: isNaN(priority) ? 0 : priority });

  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${id}</td>
    <td>${arrival}</td>
    <td>${burst}</td>
    <td>${priority}</td>
    <td>
      <button onclick="deleteProcess('${id}')" style="background: #e74c3c;">Delete</button>
    </td>
  `;
  document.querySelector('#processTable tbody').appendChild(row);

  document.getElementById('id').value = '';
  document.getElementById('arrival').value = '';
  document.getElementById('burst').value = '';
  document.getElementById('priority').value = '';
}

function deleteProcess(id) {
  const index = processes.findIndex(p => p.id === id);
  if (index > -1) {
    processes.splice(index, 1);
    processTable.deleteRow(index);
  }
}

// Run Simulation
function runSimulation() {
  if (processes.length === 0) {
    alert('Please add some processes first');
    return;
  }

  const algorithm = document.getElementById('algorithm').value;
  let results = [];
  let readyQueueStates = [];
  let currentTime = 0;
  
  // Clear previous results
  document.getElementById('avgMetrics').innerHTML = '';
  document.getElementById('chart').innerHTML = '';
  document.getElementById('timeGraph').innerHTML = '';
  document.querySelector('#resultsTable tbody').innerHTML = '';
  document.querySelector('#readyQueueTable tbody').innerHTML = '';
  
  // Sort processes by arrival time
  const sortedProcesses = [...processes].sort((a, b) => a.arrival - b.arrival);
  const remainingBurst = new Map(sortedProcesses.map(p => [p.id, p.burst]));
  const readyQueue = [];
  
  while (remainingBurst.size > 0 || readyQueue.length > 0) {
    // Add processes that have arrived to ready queue
    sortedProcesses.forEach(process => {
      if (process.arrival <= currentTime && remainingBurst.has(process.id) && !readyQueue.includes(process.id)) {
        readyQueue.push(process.id);
      }
    });

    // Record ready queue state
    readyQueueStates.push({
      time: currentTime,
      queue: [...readyQueue]
    });

    if (readyQueue.length === 0) {
      currentTime++;
      continue;
    }

    // Select process based on algorithm
    let selectedProcess;
    switch (algorithm) {
      case 'FCFS':
        selectedProcess = readyQueue[0];
        break;
      case 'SJF':
        selectedProcess = readyQueue.reduce((a, b) => {
          const burstA = remainingBurst.get(a);
          const burstB = remainingBurst.get(b);
          if (burstA === burstB) {
            const processA = processes.find(p => p.id === a);
            const processB = processes.find(p => p.id === b);
            return processA.arrival <= processB.arrival ? a : b;
          }
          return burstA < burstB ? a : b;
        });
        break;
      case 'SRTF':
        selectedProcess = readyQueue.reduce((a, b) => 
          remainingBurst.get(a) < remainingBurst.get(b) ? a : b
        );
        break;
      case 'RR':
        selectedProcess = readyQueue.shift();
        if (remainingBurst.get(selectedProcess) > 2) { // Time quantum = 2
          readyQueue.push(selectedProcess);
        }
        break;
      case 'Priority':
        selectedProcess = readyQueue.reduce((a, b) => {
          const processA = processes.find(p => p.id === a);
          const processB = processes.find(p => p.id === b);
          if (processA.priority === processB.priority) {
            return processA.arrival <= processB.arrival ? a : b;
          }
          return processA.priority > processB.priority ? a : b;
        });
        break;
    }

    // Execute process
    const process = processes.find(p => p.id === selectedProcess);
    if (!results.find(r => r.id === process.id)) {
      const startTime = currentTime;
      const endTime = startTime + process.burst;
      const waitingTime = startTime - process.arrival;
      const turnaroundTime = endTime - process.arrival;
      
      results.push({
        id: process.id,
        arrival: process.arrival,
        burst: process.burst,
        start: currentTime,
        end: currentTime + process.burst,
        waiting: currentTime - process.arrival,
        turnaround: (currentTime + process.burst) - process.arrival,
        response: currentTime - process.arrival
      });
      
      if (algorithm === 'Priority') {
        currentTime = currentTime + process.burst;
        remainingBurst.delete(selectedProcess);
        const index = readyQueue.indexOf(selectedProcess);
        if (index > -1) {
          readyQueue.splice(index, 1);
        }
      } else if (algorithm === 'FCFS') {
        currentTime = endTime;
        remainingBurst.delete(selectedProcess);
        const index = readyQueue.indexOf(selectedProcess);
        if (index > -1) {
          readyQueue.splice(index, 1);
        }
      } else {
        const timeSlice = algorithm === 'RR' ? Math.min(2, remainingBurst.get(selectedProcess)) : 1;
        remainingBurst.set(selectedProcess, remainingBurst.get(selectedProcess) - timeSlice);
        currentTime += timeSlice;
        
        if (remainingBurst.get(selectedProcess) <= 0) {
          remainingBurst.delete(selectedProcess);
          const index = readyQueue.indexOf(selectedProcess);
          if (index > -1) {
            readyQueue.splice(index, 1);
          }
          const result = results.find(r => r.id === selectedProcess);
          result.end = currentTime;
          result.turnaround = result.end - result.arrival;
          result.waiting = result.turnaround - process.burst;
        }
      }
    }
  }

  // Calculate and display average metrics
  const avgResponse = results.reduce((sum, r) => sum + (r.start - r.arrival), 0) / results.length;
  const avgTurnaround = results.reduce((sum, r) => sum + r.turnaround, 0) / results.length;
  const avgWaiting = results.reduce((sum, r) => sum + r.waiting, 0) / results.length;

  avgMetrics.innerHTML = `
    <h3>Average Metrics</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
      <div>
        <strong>Avg Completion Time:</strong>
        <div>${(avgTurnaround + avgWaiting).toFixed(2)}</div>
      </div>
      <div>
        <strong>Avg Turnaround Time:</strong>
        <div>${avgTurnaround.toFixed(2)}</div>
      </div>
      <div>
        <strong>Avg Waiting Time:</strong>
        <div>${avgWaiting.toFixed(2)}</div>
      </div>
      <div>
        <strong>Suggested Algorithm:</strong>
        <div>FCFS (Lowest Avg Waiting Time)</div>
      </div>
    </div>
  `;

  // Render visualizations
  renderReadyQueue(readyQueueStates);
  renderResultsTable(results);
  renderGanttChart(results);
  renderTimeGraph(results);
}

// Render Ready Queue
function renderReadyQueue(readyQueueStates) {
  const tbody = document.querySelector('#readyQueueTable tbody');
  tbody.innerHTML = readyQueueStates.map(state => `
    <tr>
      <td>${state.time}</td>
      <td>[${state.queue.join(', ')}]</td>
    </tr>
  `).join('');
}

// Render Results Table
function renderResultsTable(results) {
  const tbody = document.querySelector('#resultsTable tbody');
  tbody.innerHTML = results.map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${r.arrival}</td>
      <td>${r.burst}</td>
      <td>${r.start - r.arrival}</td>
      <td>${r.turnaround}</td>
      <td>${r.end}</td>
      <td>${r.waiting}</td>
    </tr>
  `).join('');
}

// Render Gantt Chart
function renderGanttChart(results) {
  const chart = document.getElementById('chart');
  chart.innerHTML = '';
  results.forEach(r => {
    const block = document.createElement('div');
    block.className = 'gantt-block';
    block.style.backgroundColor = getRandomColor();
    block.style.width = `${(r.end - r.start) * 30}px`;
    block.innerText = r.id;
    block.title = `Process ${r.id}\nStart: ${r.start}\nEnd: ${r.end}`;
    chart.appendChild(block);
  });
}

// Add random color generator for Gantt chart
function getRandomColor() {
  const colors = [
    '#3498db', '#2ecc71', '#e74c3c', '#f1c40f',
    '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Render Time Graph
function renderTimeGraph(results) {
  timeGraph.innerHTML = '';

  if (!results || results.length === 0) return;

  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const width = 800;
  const height = 400;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', (width + margin.left + margin.right).toString());
  svg.setAttribute('height', (height + margin.top + margin.bottom).toString());

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
  svg.appendChild(g);

  // Calculate max Y value with some padding
  const maxY = Math.max(...results.map(r => Math.max(r.end, r.turnaround, r.waiting))) * 1.1;

  // Add grid lines and ticks
  const numYTicks = 10;
  const yStep = height / numYTicks;
  const yScale = maxY / numYTicks;

  // Add horizontal grid lines and Y-axis ticks
  for (let i = 0; i <= numYTicks; i++) {
    const y = height - (i * yStep);
    const gridLine = createGridLine('horizontal', 0, y, width);
    g.appendChild(gridLine);
    
    const tick = createTickMark(0, y, true);
    const label = createTickLabel((i * yScale).toFixed(1), -10, y, true);
    g.appendChild(tick);
    g.appendChild(label);
  }

  // Add vertical grid lines and X-axis ticks
  const xStep = width / (results.length - 1);
  results.forEach((result, i) => {
    const x = i * xStep;
    const gridLine = createGridLine('vertical', x, 0, height);
    g.appendChild(gridLine);
    
    const tick = createTickMark(x, height);
    const label = createTickLabel(`P${result.id}`, x, height + 20);
    g.appendChild(tick);
    g.appendChild(label);
  });

  // Add axis labels
  const xLabel = createAxisLabel('Process ID', width/2, height + 40);
  const yLabel = createAxisLabel('Time Units', -40, height/2, true);
  g.appendChild(xLabel);
  g.appendChild(yLabel);

  // Create and add data lines
  const completionData = results.map(r => ({ x: r.id, y: r.end }));
  const turnaroundData = results.map(r => ({ x: r.id, y: r.turnaround }));
  const waitingData = results.map(r => ({ x: r.id, y: r.waiting }));

  g.appendChild(createLine(completionData, '#3498db', maxY, width, height));
  g.appendChild(createLine(turnaroundData, '#2ecc71', maxY, width, height));
  g.appendChild(createLine(waitingData, '#e74c3c', maxY, width, height));

  timeGraph.appendChild(svg);
}


function runSimulation() {
  if (processes.length === 0) {
    alert('Please add some processes first');
    return;
  }

  const algorithm = document.getElementById('algorithm').value;
  let results = [];
  let readyQueueStates = [];
  let currentTime = 0;
  
  const sortedProcesses = [...processes].sort((a, b) => a.arrival - b.arrival);
  const remainingBurst = new Map(sortedProcesses.map(p => [p.id, p.burst]));
  const readyQueue = [];
  
  while (remainingBurst.size > 0 || readyQueue.length > 0) {
    // Add processes that have arrived to ready queue
    sortedProcesses.forEach(process => {
      if (process.arrival <= currentTime && remainingBurst.has(process.id) && !readyQueue.includes(process.id)) {
        readyQueue.push(process.id);
      }
    });

    // Record ready queue state
    readyQueueStates.push({
      time: currentTime,
      queue: [...readyQueue]
    });

    if (readyQueue.length === 0) {
      currentTime++;
      continue;
    }

    // Select process based on algorithm
    let selectedProcess;
    switch (algorithm) {
      case 'FCFS':
        selectedProcess = readyQueue[0];
        break;
      case 'SJF':
        selectedProcess = readyQueue.reduce((a, b) => 
          remainingBurst.get(a) < remainingBurst.get(b) ? a : b
        );
        break;
      case 'SRTF':
        selectedProcess = readyQueue.reduce((a, b) => 
          remainingBurst.get(a) < remainingBurst.get(b) ? a : b
        );
        if (readyQueue.length > 1) {
          const nextProcess = readyQueue.find(p => p !== selectedProcess && 
            remainingBurst.get(p) < remainingBurst.get(selectedProcess));
          if (nextProcess) {
            selectedProcess = nextProcess;
          }
        }
        break;
      case 'RR':
        selectedProcess = readyQueue.shift();
        if (remainingBurst.get(selectedProcess) > 2) { // Time quantum = 2
          readyQueue.push(selectedProcess);
        }
        break;
      case 'Priority':
        selectedProcess = readyQueue.reduce((a, b) => {
          const processA = processes.find(p => p.id === a);
          const processB = processes.find(p => p.id === b);
          if (processA.priority === processB.priority) {
            return processA.arrival <= processB.arrival ? a : b;
          }
          return processA.priority > processB.priority ? a : b;
        });
        break;
    }

    // Execute process
    const process = processes.find(p => p.id === selectedProcess);
    if (!results.find(r => r.id === process.id)) {
      results.push({
        id: process.id,
        arrival: process.arrival,
        burst: process.burst,
        start: currentTime,
        end: currentTime,
        waiting: currentTime - process.arrival,
        turnaround: 0
      });
    }

    const timeSlice = algorithm === 'RR' ? Math.min(2, remainingBurst.get(selectedProcess)) :
                     algorithm === 'Priority' ? remainingBurst.get(selectedProcess) :
                     algorithm === 'FCFS' ? remainingBurst.get(selectedProcess) :
                     algorithm === 'SJF' ? remainingBurst.get(selectedProcess) : 1;

    if (algorithm === 'Priority') {
      const result = results.find(r => r.id === selectedProcess);
      result.end = currentTime + timeSlice;
      result.turnaround = result.end - result.arrival;
      result.waiting = result.turnaround - process.burst;
      remainingBurst.delete(selectedProcess);
      readyQueue.splice(readyQueue.indexOf(selectedProcess), 1);
    } else {
      remainingBurst.set(selectedProcess, remainingBurst.get(selectedProcess) - timeSlice);
      currentTime += timeSlice;
      
      // Update result if process is complete
      if (remainingBurst.get(selectedProcess) <= 0) {
        remainingBurst.delete(selectedProcess);
        readyQueue.splice(readyQueue.indexOf(selectedProcess), 1);
        const result = results.find(r => r.id === selectedProcess);
        result.end = currentTime;
        result.turnaround = result.end - result.arrival;
        result.waiting = result.turnaround - process.burst;
      }
    }
    if (algorithm === 'Priority') {
      currentTime = Math.max(...results.map(r => r.end));
    }
  }

  // Calculate and display average metrics
  const avgResponse = results.reduce((sum, r) => sum + (r.start - r.arrival), 0) / results.length;
  const avgTurnaround = results.reduce((sum, r) => sum + r.turnaround, 0) / results.length;
  const avgWaiting = results.reduce((sum, r) => sum + r.waiting, 0) / results.length;

  avgMetrics.innerHTML = `
    <h3>Average Metrics</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
      <div>
        <strong>Avg Completion Time:</strong>
        <div>${(avgTurnaround + avgWaiting).toFixed(2)}</div>
      </div>
      <div>
        <strong>Avg Turnaround Time:</strong>
        <div>${avgTurnaround.toFixed(2)}</div>
      </div>
      <div>
        <strong>Avg Waiting Time:</strong>
        <div>${avgWaiting.toFixed(2)}</div>
      </div>
      <div>
        <strong>Suggested Algorithm:</strong>
        <div>FCFS (Lowest Avg Waiting Time)</div>
      </div>
    </div>
  `;

  // Render visualizations
  renderReadyQueue(readyQueueStates);
  renderResultsTable(results);
  renderGanttChart(results);
  renderTimeGraph(results);
}